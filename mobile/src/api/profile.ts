import { z } from 'zod';
import { request } from './client';

export const profileSchema = z.object({
  fullName: z.string(),
  mobile: z.string(),
  address: z.string(),
  businessName: z.string().nullable(),
  updatedAt: z.string(),
});

const savedProfileSchema = z.object({ profile: profileSchema });

export type Profile = z.infer<typeof profileSchema>;

export type ProfileInput = {
  fullName: string;
  mobile: string;
  address: string;
  businessName: string;
};

export function saveProfile(token: string, body: ProfileInput): Promise<{ profile: Profile }> {
  return request('/api/profile', savedProfileSchema, { method: 'PUT', body, token });
}
