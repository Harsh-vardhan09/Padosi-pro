import { Router } from 'express';
import { z } from 'zod';
import { authenticatedUser } from '../middleware/auth.js';
import * as profiles from '../repositories/profiles.js';
import type { ProfileRecord } from '../repositories/profiles.js';
import {
  ADDRESS_MAX,
  ADDRESS_MIN,
  BUSINESS_NAME_MAX,
  FULL_NAME_MAX,
  FULL_NAME_MIN,
  FULL_NAME_PATTERN,
  normaliseMobile,
} from '../services/profile.js';

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(FULL_NAME_MIN, `Use at least ${FULL_NAME_MIN} characters`)
    .max(FULL_NAME_MAX, `Use at most ${FULL_NAME_MAX} characters`)
    .regex(FULL_NAME_PATTERN, 'Use letters, spaces, apostrophes, hyphens and full stops only'),

  mobile: z.string().transform((value, ctx) => {
    const normalised = normaliseMobile(value);
    if (normalised === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit Indian mobile number' });
      return z.NEVER;
    }
    return normalised;
  }),

  address: z
    .string()
    .trim()
    .min(ADDRESS_MIN, `Use at least ${ADDRESS_MIN} characters`)
    .max(ADDRESS_MAX, `Use at most ${ADDRESS_MAX} characters`),

  // Optional because most PadosiPro customers are households, not businesses. Requiring it would
  // force every family to invent one, so absence is a real answer rather than missing data.
  businessName: z
    .string()
    .trim()
    .max(BUSINESS_NAME_MAX, `Use at most ${BUSINESS_NAME_MAX} characters`)
    .optional(),
});

export function publicProfile(profile: ProfileRecord): Record<string, string | null> {
  return {
    fullName: profile.fullName,
    mobile: profile.mobile,
    address: profile.address,
    businessName: profile.businessName,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export const profileRouter = Router();

profileRouter.get('/', async (req, res) => {
  const profile = await profiles.findByUserId(authenticatedUser(req).id);
  res.json({ profile: profile === null ? null : publicProfile(profile) });
});

profileRouter.put('/', async (req, res) => {
  const { fullName, mobile, address, businessName } = profileSchema.parse(req.body);

  // An omitted business name clears a previously saved one, so the profile always reflects the form.
  const profile = await profiles.save(authenticatedUser(req).id, {
    fullName,
    mobile,
    address,
    businessName: businessName === undefined || businessName === '' ? null : businessName,
  });

  res.json({ profile: publicProfile(profile) });
});
