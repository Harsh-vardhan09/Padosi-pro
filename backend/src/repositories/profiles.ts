import { prisma } from '../db/prisma.js';

export type ProfileRecord = {
  fullName: string;
  mobile: string;
  address: string;
  businessName: string | null;
  updatedAt: Date;
};

const profileSelect = {
  fullName: true,
  mobile: true,
  address: true,
  businessName: true,
  updatedAt: true,
} as const;

export function findByUserId(userId: string): Promise<ProfileRecord | null> {
  return prisma.profile.findUnique({ where: { userId }, select: profileSelect });
}

export type ProfileInput = {
  fullName: string;
  mobile: string;
  address: string;
  businessName: string | null;
};

/** One profile per user, so the first save and every later edit are the same operation. */
export function save(userId: string, input: ProfileInput): Promise<ProfileRecord> {
  return prisma.profile.upsert({
    where: { userId },
    create: { userId, ...input },
    update: input,
    select: profileSelect,
  });
}
