import { z } from 'zod';
import { request } from './client';
import { profileSchema } from './profile';

const meSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    profileCompleted: z.boolean(),
  }),
  profile: profileSchema.nullable(),
  selectedTaskCount: z.number(),
});

export type Me = z.infer<typeof meSchema>;

export function getMe(token: string): Promise<Me> {
  return request('/api/me', meSchema, { method: 'GET', token });
}
