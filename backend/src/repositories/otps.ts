import { prisma } from '../db/prisma.js';
import type { OtpRecord } from '../services/otp.js';

export async function findByUserId(userId: string): Promise<OtpRecord | null> {
  return prisma.emailOtp.findUnique({
    where: { userId },
    select: {
      codeHash: true,
      expiresAt: true,
      attempts: true,
      lastSentAt: true,
      consumedAt: true,
    },
  });
}

/** One row per user: issuing a code replaces any previous one and clears its attempts. */
export async function replace(input: {
  userId: string;
  codeHash: string;
  expiresAt: Date;
  sentAt: Date;
}): Promise<void> {
  const { userId, codeHash, expiresAt, sentAt } = input;
  const fields = { codeHash, expiresAt, lastSentAt: sentAt, attempts: 0, consumedAt: null };

  await prisma.emailOtp.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: fields,
  });
}

export async function incrementAttempts(userId: string): Promise<void> {
  await prisma.emailOtp.update({ where: { userId }, data: { attempts: { increment: 1 } } });
}

export async function markConsumed(userId: string, consumedAt: Date): Promise<void> {
  await prisma.emailOtp.update({ where: { userId }, data: { consumedAt } });
}
