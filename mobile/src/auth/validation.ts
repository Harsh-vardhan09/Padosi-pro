export const PASSWORD_MIN_LENGTH = 8;

// Messages are the server's word for word, so a field error looks the same whichever side caught it.
export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (email === '') return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return 'Enter a valid email address';
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters`;
  if (!/[a-zA-Z]/u.test(value) || !/[0-9]/u.test(value)) {
    return 'Include at least one letter and one number';
  }
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (confirm === '') return 'Confirm your password';
  if (confirm !== password) return 'Passwords do not match';
  return null;
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}
