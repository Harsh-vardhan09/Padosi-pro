import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { signAccessToken } from '../lib/jwt.js';
import { authenticatedUser, requireAuth } from '../middleware/auth.js';
import * as otps from '../repositories/otps.js';
import * as users from '../repositories/users.js';
import type { UserRecord } from '../repositories/users.js';
import {
  burnPasswordComparison,
  hashPassword,
  loginOutcome,
  passwordMeetsPolicy,
  PASSWORD_MIN_LENGTH,
  registrationOutcome,
  verifyPassword,
} from '../services/auth.js';
import { OTP_LENGTH, verifyOtp } from '../services/otp.js';
import { issueOtp } from '../services/otpDelivery.js';

const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .toLowerCase();

const passwordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .refine(passwordMeetsPolicy, 'Include at least one letter and one number');

const credentialsSchema = z.object({ email: emailField, password: passwordField });
const emailOnlySchema = z.object({ email: emailField });
const verifyOtpSchema = z.object({
  email: emailField,
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^[0-9]{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code`),
});

type PublicUser = { id: string; email: string; profileCompleted: boolean };

function publicUser(user: UserRecord): PublicUser {
  return { id: user.id, email: user.email, profileCompleted: user.profileCompleted };
}

function issueSession(user: UserRecord): { token: string; user: PublicUser } {
  const { JWT_SECRET, JWT_EXPIRES_IN } = config();
  return {
    token: signAccessToken({ sub: user.id, tv: user.tokenVersion }, JWT_SECRET, JWT_EXPIRES_IN),
    user: publicUser(user),
  };
}

function userNotFound(): AppError {
  return new AppError({
    status: 404,
    code: 'USER_NOT_FOUND',
    message: 'We have no account for that email. Please register first.',
  });
}

function alreadyVerified(): AppError {
  return new AppError({
    status: 409,
    code: 'EMAIL_ALREADY_VERIFIED',
    message: 'This email is already verified. Please log in.',
  });
}

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body);
  const now = new Date();
  const existing = await users.findByEmail(email);
  const outcome = registrationOutcome(existing);

  if (outcome === 'email_taken') {
    throw new AppError({
      status: 409,
      code: 'EMAIL_TAKEN',
      message: 'That email is already registered. Please log in instead.',
    });
  }

  let user: UserRecord;
  if (outcome === 'resend' && existing !== null) {
    // Same address, never verified: treat it as a retry and let them set the password again.
    await users.updatePassword(existing.id, await hashPassword(password));
    user = existing;
  } else {
    user = await users.createUnverified({ email, passwordHash: await hashPassword(password) });
  }

  const issue = await issueOtp({ userId: user.id, email: user.email, now });

  res.status(201).json({
    email: user.email,
    otpSent: issue.sent,
    otpExpiresAt: issue.otpExpiresAt.toISOString(),
    resendAvailableAt: issue.resendAvailableAt.toISOString(),
  });
});

authRouter.post('/verify-otp', async (req, res) => {
  const { email, code } = verifyOtpSchema.parse(req.body);
  const now = new Date();

  const user = await users.findByEmail(email);
  if (user === null) throw userNotFound();

  const record = await otps.findByUserId(user.id);

  // A consumed code is reported as single-use before the account state, so re-submitting the code
  // that just verified the account says so precisely instead of only "already verified".
  if (record !== null && record.consumedAt !== null) {
    throw new AppError({
      status: 409,
      code: 'OTP_ALREADY_USED',
      message: 'That code has already been used. Please log in.',
    });
  }

  if (user.isVerified) throw alreadyVerified();

  if (record === null) {
    throw new AppError({
      status: 404,
      code: 'OTP_NOT_FOUND',
      message: 'No code has been sent yet. Please request one.',
    });
  }

  const result = verifyOtp(record, code, config().OTP_PEPPER, now);

  if (!result.ok) {
    if (result.code === 'OTP_INVALID') {
      await otps.incrementAttempts(user.id);
      throw new AppError({
        status: 400,
        code: 'OTP_INVALID',
        message: 'That code is not right. Please check and try again.',
        details: { attemptsLeft: result.attemptsLeft },
      });
    }

    const failures = {
      OTP_EXPIRED: {
        status: 400,
        message: 'That code has expired. Please request a new one.',
      },
      OTP_LOCKED: {
        status: 429,
        message: 'Too many incorrect attempts. Please request a new code.',
      },
      OTP_ALREADY_USED: {
        status: 409,
        message: 'That code has already been used. Please log in.',
      },
    } as const;

    const failure = failures[result.code];
    throw new AppError({ status: failure.status, code: result.code, message: failure.message });
  }

  await otps.markConsumed(user.id, now);
  await users.markVerified(user.id);

  res.json(issueSession({ ...user, isVerified: true }));
});

authRouter.post('/resend-otp', async (req, res) => {
  const { email } = emailOnlySchema.parse(req.body);
  const now = new Date();

  const user = await users.findByEmail(email);
  if (user === null) throw userNotFound();
  if (user.isVerified) throw alreadyVerified();

  const issue = await issueOtp({ userId: user.id, email: user.email, now });

  if (!issue.sent) {
    throw new AppError({
      status: 429,
      code: 'OTP_COOLDOWN',
      message: `Please wait ${issue.retryAfterSeconds} seconds before asking for another code.`,
      details: { retryAfterSeconds: issue.retryAfterSeconds },
    });
  }

  res.json({
    otpSent: true,
    otpExpiresAt: issue.otpExpiresAt.toISOString(),
    resendAvailableAt: issue.resendAvailableAt.toISOString(),
  });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body);
  const now = new Date();

  const user = await users.findByEmail(email);
  const passwordMatches =
    user === null
      ? await burnPasswordComparison(password)
      : await verifyPassword(password, user.passwordHash);

  const outcome = loginOutcome(user, passwordMatches);

  if (outcome === 'invalid_credentials' || user === null) {
    throw new AppError({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'That email or password is not right.',
    });
  }

  if (outcome === 'email_not_verified') {
    const issue = await issueOtp({ userId: user.id, email: user.email, now });
    throw new AppError({
      status: 403,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email to continue. We have sent you a code.',
      details: {
        otpSent: String(issue.sent),
        otpExpiresAt: issue.otpExpiresAt.toISOString(),
        resendAvailableAt: issue.resendAvailableAt.toISOString(),
      },
    });
  }

  res.json(issueSession(user));
});

authRouter.post('/logout', requireAuth, async (req, res) => {
  await users.incrementTokenVersion(authenticatedUser(req).id);
  res.json({ ok: true });
});
