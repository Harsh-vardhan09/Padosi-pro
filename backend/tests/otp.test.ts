import { describe, expect, it } from 'vitest';
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  codeMatches,
  cooldownSecondsLeft,
  generateCode,
  hashCode,
  otpExpiresAt,
  resendAvailableAt,
  verifyOtp,
  type OtpRecord,
} from '../src/services/otp.js';

const PEPPER = 'test-otp-pepper-at-least-16';
const NOW = new Date('2026-09-28T10:00:00.000Z');

function record(overrides: Partial<OtpRecord> = {}): OtpRecord {
  return {
    codeHash: hashCode('123456', PEPPER),
    expiresAt: otpExpiresAt(NOW),
    attempts: 0,
    lastSentAt: NOW,
    consumedAt: null,
    ...overrides,
  };
}

describe('generateCode', () => {
  it('is always six digits, zero-padded', () => {
    for (let i = 0; i < 500; i += 1) {
      const code = generateCode();
      expect(code).toMatch(/^[0-9]{6}$/);
      expect(code).toHaveLength(OTP_LENGTH);
    }
  });

  it('does not return a constant', () => {
    const codes = new Set(Array.from({ length: 50 }, generateCode));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('hashCode', () => {
  it('never stores the code itself', () => {
    const hash = hashCode('123456', PEPPER);
    expect(hash).not.toContain('123456');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is peppered, so the same code hashes differently per server secret', () => {
    expect(hashCode('123456', PEPPER)).not.toBe(hashCode('123456', 'another-pepper-16-chars'));
  });
});

describe('codeMatches', () => {
  it('accepts the right code and rejects a wrong one', () => {
    const hash = hashCode('123456', PEPPER);
    expect(codeMatches('123456', hash, PEPPER)).toBe(true);
    expect(codeMatches('123457', hash, PEPPER)).toBe(false);
  });

  it('returns false instead of throwing on a malformed stored hash', () => {
    expect(codeMatches('123456', 'deadbeef', PEPPER)).toBe(false);
  });
});

describe('expiry window', () => {
  it('is ten minutes from issue', () => {
    expect(otpExpiresAt(NOW).getTime() - NOW.getTime()).toBe(OTP_TTL_MINUTES * 60_000);
  });

  it('accepts a code one second before expiry and rejects it one second after', () => {
    const justBefore = new Date(NOW.getTime() + (OTP_TTL_MINUTES * 60 - 1) * 1000);
    const justAfter = new Date(NOW.getTime() + (OTP_TTL_MINUTES * 60 + 1) * 1000);

    expect(verifyOtp(record(), '123456', PEPPER, justBefore)).toEqual({ ok: true });
    expect(verifyOtp(record(), '123456', PEPPER, justAfter)).toEqual({
      ok: false,
      code: 'OTP_EXPIRED',
    });
  });

  it('treats the exact expiry instant as expired', () => {
    expect(verifyOtp(record(), '123456', PEPPER, otpExpiresAt(NOW))).toEqual({
      ok: false,
      code: 'OTP_EXPIRED',
    });
  });
});

describe('attempt limits', () => {
  it('counts down the attempts left on each wrong code', () => {
    for (let attempts = 0; attempts < OTP_MAX_ATTEMPTS; attempts += 1) {
      expect(verifyOtp(record({ attempts }), '000000', PEPPER, NOW)).toEqual({
        ok: false,
        code: 'OTP_INVALID',
        attemptsLeft: OTP_MAX_ATTEMPTS - attempts - 1,
      });
    }
  });

  it('locks once the fifth wrong attempt has been recorded', () => {
    expect(verifyOtp(record({ attempts: OTP_MAX_ATTEMPTS }), '123456', PEPPER, NOW)).toEqual({
      ok: false,
      code: 'OTP_LOCKED',
    });
  });

  it('locks even when the code typed is correct', () => {
    const locked = record({ attempts: OTP_MAX_ATTEMPTS });
    expect(verifyOtp(locked, '123456', PEPPER, NOW)).toEqual({ ok: false, code: 'OTP_LOCKED' });
  });
});

describe('single use', () => {
  it('rejects a code that was already consumed', () => {
    const consumed = record({ consumedAt: NOW });
    expect(verifyOtp(consumed, '123456', PEPPER, NOW)).toEqual({
      ok: false,
      code: 'OTP_ALREADY_USED',
    });
  });

  it('reports already-used before expiry, so a used code never reads as merely expired', () => {
    const consumedAndExpired = record({ consumedAt: NOW, expiresAt: NOW });
    expect(verifyOtp(consumedAndExpired, '123456', PEPPER, NOW)).toEqual({
      ok: false,
      code: 'OTP_ALREADY_USED',
    });
  });
});

describe('resend cooldown', () => {
  it('is thirty seconds from the last send', () => {
    expect(resendAvailableAt(NOW).getTime() - NOW.getTime()).toBe(
      OTP_RESEND_COOLDOWN_SECONDS * 1000,
    );
  });

  it('rounds the remaining wait up to whole seconds', () => {
    const after = (ms: number): number => cooldownSecondsLeft(NOW, new Date(NOW.getTime() + ms));

    expect(after(0)).toBe(OTP_RESEND_COOLDOWN_SECONDS);
    expect(after(500)).toBe(OTP_RESEND_COOLDOWN_SECONDS);
    expect(after(29_001)).toBe(1);
  });

  it('is zero once the window has passed', () => {
    expect(cooldownSecondsLeft(NOW, new Date(NOW.getTime() + 30_000))).toBe(0);
    expect(cooldownSecondsLeft(NOW, new Date(NOW.getTime() + 60_000))).toBe(0);
  });
});
