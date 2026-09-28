export const FULL_NAME_MIN = 2;
export const FULL_NAME_MAX = 80;
export const ADDRESS_MIN = 10;
export const ADDRESS_MAX = 300;
export const BUSINESS_NAME_MAX = 100;
export const MOBILE_DIGITS = 10;

// Same as the server: letters plus combining marks, so Indic vowel signs in "आशा" are not rejected.
const FULL_NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;

export const PROFILE_FIELDS = ['fullName', 'mobile', 'address', 'businessName'] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type ProfileValues = Record<ProfileField, string>;
export type ProfileErrors = Partial<Record<ProfileField, string>>;

export const EMPTY_PROFILE: ProfileValues = {
  fullName: '',
  mobile: '',
  address: '',
  businessName: '',
};

// Messages and their order match the server's zod schema, which reports the first failing check.
function validateFullName(value: string): string | undefined {
  const name = value.trim();
  if (name.length < FULL_NAME_MIN) return `Use at least ${FULL_NAME_MIN} characters`;
  if (name.length > FULL_NAME_MAX) return `Use at most ${FULL_NAME_MAX} characters`;
  if (!FULL_NAME_PATTERN.test(name)) {
    return 'Use letters, spaces, apostrophes, hyphens and full stops only';
  }
  return undefined;
}

function validateMobile(value: string): string | undefined {
  if (!/^[6-9][0-9]{9}$/u.test(value)) return 'Enter a 10-digit Indian mobile number';
  return undefined;
}

function validateAddress(value: string): string | undefined {
  const address = value.trim();
  if (address.length < ADDRESS_MIN) return `Use at least ${ADDRESS_MIN} characters`;
  if (address.length > ADDRESS_MAX) return `Use at most ${ADDRESS_MAX} characters`;
  return undefined;
}

function validateBusinessName(value: string): string | undefined {
  if (value.trim().length > BUSINESS_NAME_MAX) return `Use at most ${BUSINESS_NAME_MAX} characters`;
  return undefined;
}

export const PROFILE_VALIDATORS: Record<ProfileField, (value: string) => string | undefined> = {
  fullName: validateFullName,
  mobile: validateMobile,
  address: validateAddress,
  businessName: validateBusinessName,
};

export function validateProfile(values: ProfileValues): ProfileErrors {
  const errors: ProfileErrors = {};
  for (const field of PROFILE_FIELDS) {
    const message = PROFILE_VALIDATORS[field](values[field]);
    if (message !== undefined) errors[field] = message;
  }
  return errors;
}

export function hasErrors(errors: ProfileErrors): boolean {
  return PROFILE_FIELDS.some((field) => errors[field] !== undefined);
}
