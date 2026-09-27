import bcrypt from 'bcryptjs';

export const BCRYPT_COST = 12;
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Compared against when the email is unknown, so an unknown address costs the same bcrypt work as a
 * wrong password. It is a hash of a fixed throwaway string — not a credential for anything.
 */
const TIMING_DECOY_HASH = '$2b$12$vIt/gmB.Zhw5x9S5uiJ4Qu3QvjSzx9ibkxKFe5RMTeOj2id6d0oAe';

export function passwordMeetsPolicy(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH && /[a-zA-Z]/.test(password) && /[0-9]/.test(password)
  );
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/** Burns the same time as a real comparison so an unknown email is not detectable by timing. */
export async function burnPasswordComparison(password: string): Promise<false> {
  await bcrypt.compare(password, TIMING_DECOY_HASH);
  return false;
}

export type RegistrationOutcome = 'create' | 'resend' | 'email_taken';

export function registrationOutcome(existing: { isVerified: boolean } | null): RegistrationOutcome {
  if (existing === null) return 'create';
  return existing.isVerified ? 'email_taken' : 'resend';
}

export type LoginOutcome = 'ok' | 'invalid_credentials' | 'email_not_verified';

export function loginOutcome(
  user: { isVerified: boolean } | null,
  passwordMatches: boolean,
): LoginOutcome {
  if (user === null || !passwordMatches) return 'invalid_credentials';
  return user.isVerified ? 'ok' : 'email_not_verified';
}
