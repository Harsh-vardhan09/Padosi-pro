import { prisma } from '../db/prisma.js';

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  tokenVersion: number;
  profileCompleted: boolean;
};

// `profile` is selected only to learn whether one exists; the app never needs its columns here.
const userSelect = {
  id: true,
  email: true,
  passwordHash: true,
  isVerified: true,
  tokenVersion: true,
  profile: { select: { userId: true } },
} as const;

type SelectedUser = {
  id: string;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  tokenVersion: number;
  profile: { userId: string } | null;
};

function toRecord(user: SelectedUser): UserRecord {
  const { profile, ...rest } = user;
  return { ...rest, profileCompleted: profile !== null };
}

export async function findByEmail(email: string): Promise<UserRecord | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: userSelect });
  return user === null ? null : toRecord(user);
}

export async function findById(id: string): Promise<UserRecord | null> {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  return user === null ? null : toRecord(user);
}

export async function createUnverified(input: {
  email: string;
  passwordHash: string;
}): Promise<UserRecord> {
  const user = await prisma.user.create({ data: input, select: userSelect });
  return toRecord(user);
}

export async function updatePassword(id: string, passwordHash: string): Promise<void> {
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}

export async function markVerified(id: string): Promise<void> {
  await prisma.user.update({ where: { id }, data: { isVerified: true } });
}

/** Invalidates every token already issued for this user, without a blocklist table. */
export async function incrementTokenVersion(id: string): Promise<number> {
  const user = await prisma.user.update({
    where: { id },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  return user.tokenVersion;
}
