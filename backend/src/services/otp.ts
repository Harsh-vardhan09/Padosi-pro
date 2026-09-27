import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

/** Cryptographically uniform 6-digit code, zero-padded so "000042" stays six characters. */
export function generateCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

export function hashCode(code: string, pepper: string): string {
  return createHmac('sha256', pepper).update(code).digest('hex');
}

export function codeMatches(code: string, storedHash: string, pepper: string): boolean {
  const candidate = Buffer.from(hashCode(code, pepper), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  // timingSafeEqual throws on a length mismatch, so guard before comparing.
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

export function otpExpiresAt(now: Date): Date {
  return new Date(now.getTime() + OTP_TTL_MINUTES * 60_000);
}

export function resendAvailableAt(lastSentAt: Date): Date {
  return new Date(lastSentAt.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000);
}

export function cooldownSecondsLeft(lastSentAt: Date, now: Date): number {
  const remainingMs = resendAvailableAt(lastSentAt).getTime() - now.getTime();
  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / 1000);
}

export type OtpRecord = {
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
  consumedAt: Date | null;
};

export type OtpVerification =
  | { ok: true }
  | { ok: false; code: 'OTP_ALREADY_USED' | 'OTP_LOCKED' | 'OTP_EXPIRED' }
  | { ok: false; code: 'OTP_INVALID'; attemptsLeft: number };

/**
 * Order matters: a consumed or locked code is a dead end whatever the user typed, so those are
 * reported before we spend a comparison on the code itself.
 */
export function verifyOtp(
  record: OtpRecord,
  code: string,
  pepper: string,
  now: Date,
): OtpVerification {
  if (record.consumedAt !== null) return { ok: false, code: 'OTP_ALREADY_USED' };
  if (record.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, code: 'OTP_LOCKED' };
  if (record.expiresAt.getTime() <= now.getTime()) return { ok: false, code: 'OTP_EXPIRED' };

  if (!codeMatches(code, record.codeHash, pepper)) {
    return {
      ok: false,
      code: 'OTP_INVALID',
      attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - (record.attempts + 1)),
    };
  }

  return { ok: true };
}
