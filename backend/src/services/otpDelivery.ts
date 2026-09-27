import { config } from '../config.js';
import { createMailer } from '../mail/index.js';
import * as otps from '../repositories/otps.js';
import {
  OTP_TTL_MINUTES,
  cooldownSecondsLeft,
  generateCode,
  hashCode,
  otpExpiresAt,
  resendAvailableAt,
} from './otp.js';

const mailer = createMailer(config());

export type OtpIssue = {
  sent: boolean;
  otpExpiresAt: Date;
  resendAvailableAt: Date;
  retryAfterSeconds: number;
};

/**
 * Issues a fresh code unless the 30s cooldown is still running, in which case the existing code
 * stays valid and `sent` is false. Callers decide whether that is an error or just information.
 */
export async function issueOtp(input: {
  userId: string;
  email: string;
  now: Date;
}): Promise<OtpIssue> {
  const { userId, email, now } = input;
  const existing = await otps.findByUserId(userId);

  if (existing !== null) {
    const retryAfterSeconds = cooldownSecondsLeft(existing.lastSentAt, now);
    if (retryAfterSeconds > 0) {
      return {
        sent: false,
        otpExpiresAt: existing.expiresAt,
        resendAvailableAt: resendAvailableAt(existing.lastSentAt),
        retryAfterSeconds,
      };
    }
  }

  const code = generateCode();
  const expiresAt = otpExpiresAt(now);

  await otps.replace({
    userId,
    codeHash: hashCode(code, config().OTP_PEPPER),
    expiresAt,
    sentAt: now,
  });

  await mailer.sendOtp({ to: email, code, expiryMinutes: OTP_TTL_MINUTES });

  return {
    sent: true,
    otpExpiresAt: expiresAt,
    resendAvailableAt: resendAvailableAt(now),
    retryAfterSeconds: 0,
  };
}
