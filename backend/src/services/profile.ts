export const FULL_NAME_MIN = 2;
export const FULL_NAME_MAX = 80;
export const ADDRESS_MIN = 10;
export const ADDRESS_MAX = 300;
export const BUSINESS_NAME_MAX = 100;

// Letters plus combining marks: Indic vowel signs are marks, not letters, so \p{L} alone would
// reject "आशा". Spaces and .'- cover the punctuation real names carry.
export const FULL_NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;

/**
 * Accepts the shapes people actually type — "9876543210", "+919876543210", "+91 98765 43210",
 * "091-98765-43210" — and returns +91XXXXXXXXXX, or null when it is not a valid Indian mobile.
 */
export function normaliseMobile(input: string): string | null {
  const digits = input.replace(/[\s()\-.]/g, '').replace(/^\+/, '');

  let local = digits;
  if (local.length === 12 && local.startsWith('91')) local = local.slice(2);
  else if (local.length === 11 && local.startsWith('0')) local = local.slice(1);
  else if (local.length === 13 && local.startsWith('910')) local = local.slice(3);

  // Indian mobile numbers are ten digits and never start below 6.
  if (!/^[6-9][0-9]{9}$/.test(local)) return null;

  return `+91${local}`;
}
