import { describe, expect, it } from 'vitest';
import {
  BCRYPT_COST,
  burnPasswordComparison,
  hashPassword,
  loginOutcome,
  passwordMeetsPolicy,
  registrationOutcome,
  verifyPassword,
} from '../src/services/auth.js';
import { signAccessToken, verifyAccessToken } from '../src/lib/jwt.js';

const SECRET = 'test-jwt-secret-at-least-16';

describe('passwordMeetsPolicy', () => {
  it('requires eight characters with a letter and a number', () => {
    expect(passwordMeetsPolicy('Passw0rd')).toBe(true);
    expect(passwordMeetsPolicy('a1234567')).toBe(true);
  });

  it('rejects too short, letters only, and digits only', () => {
    expect(passwordMeetsPolicy('Pass0rd')).toBe(false);
    expect(passwordMeetsPolicy('password')).toBe(false);
    expect(passwordMeetsPolicy('12345678')).toBe(false);
  });
});

describe('password hashing', () => {
  it('produces a cost-12 bcrypt hash that verifies', async () => {
    const hash = await hashPassword('Passw0rd');

    expect(hash).toMatch(new RegExp(`^\\$2[aby]\\$${BCRYPT_COST}\\$`));
    expect(hash).not.toContain('Passw0rd');
    expect(await verifyPassword('Passw0rd', hash)).toBe(true);
    expect(await verifyPassword('Passw0rd!', hash)).toBe(false);
  });

  it('salts, so the same password hashes differently each time', async () => {
    expect(await hashPassword('Passw0rd')).not.toBe(await hashPassword('Passw0rd'));
  });

  it('burns a comparison for an unknown email and always reports false', async () => {
    expect(await burnPasswordComparison('anything')).toBe(false);
  });
});

describe('registrationOutcome', () => {
  it('creates a user when the email is new', () => {
    expect(registrationOutcome(null)).toBe('create');
  });

  it('rejects an email that is already verified', () => {
    expect(registrationOutcome({ isVerified: true })).toBe('email_taken');
  });

  it('re-sends for an existing but unverified email', () => {
    expect(registrationOutcome({ isVerified: false })).toBe('resend');
  });
});

describe('loginOutcome', () => {
  it('gives the same answer for an unknown email and a wrong password', () => {
    expect(loginOutcome(null, false)).toBe('invalid_credentials');
    expect(loginOutcome({ isVerified: true }, false)).toBe('invalid_credentials');
  });

  it('blocks a correct password on an unverified account', () => {
    expect(loginOutcome({ isVerified: false }, true)).toBe('email_not_verified');
  });

  it('never reports not-verified when the password is wrong', () => {
    expect(loginOutcome({ isVerified: false }, false)).toBe('invalid_credentials');
  });

  it('succeeds for a verified user with the right password', () => {
    expect(loginOutcome({ isVerified: true }, true)).toBe('ok');
  });
});

describe('access tokens', () => {
  it('round-trips the user id and token version', () => {
    const token = signAccessToken({ sub: 'user-1', tv: 3 }, SECRET, '7d');
    expect(verifyAccessToken(token, SECRET)).toEqual({ sub: 'user-1', tv: 3 });
  });

  it('rejects a token signed with another secret', () => {
    const token = signAccessToken({ sub: 'user-1', tv: 0 }, 'another-secret-16-chars', '7d');
    expect(() => verifyAccessToken(token, SECRET)).toThrow(/session has expired/);
  });

  it('rejects an expired token', () => {
    const token = signAccessToken({ sub: 'user-1', tv: 0 }, SECRET, '0s');
    expect(() => verifyAccessToken(token, SECRET)).toThrow(/session has expired/);
  });

  it('rejects a token whose payload is missing the token version', () => {
    // Signed with the real secret but without `tv`: a valid signature is not enough.
    const token = signAccessToken({ sub: 'user-1' } as { sub: string; tv: number }, SECRET, '7d');
    expect(() => verifyAccessToken(token, SECRET)).toThrow(/session has expired/);
  });
});
