import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const findActiveLicense = (userId: string, now = new Date()) =>
  prisma.userLicense.findFirst({
    where: {
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      expiresAt: true,
      payment: {
        select: {
          cancelAtPeriodEnd: true,
          method: true,
          pricingPlanId: true,
          storeProductId: true,
        },
      },
    },
  });

/** Active VIP access billed by Apple, even when a newer non-App Store license exists. */
export const findActiveAppStoreLicense = (userId: string, now = new Date()) =>
  prisma.userLicense.findFirst({
    where: {
      userId,
      payment: { method: 'app_store' },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    select: { id: true },
  });

/** Each account gets one free trial in total (claimed in paymentController.finalizeTrialAccess). */
export const hasUsedFreeTrial = async (userId: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { trialUsedAt: true } });
  return Boolean(user?.trialUsedAt);
};

/** Every account gets one week of the full app (with ads) before it needs VIP. */
export const FREE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const emailHash = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

export type FreeWeek = { startedAt: Date | null; endsAt: Date | null; active: boolean };

const toFreeWeek = (startedAt: Date | null | undefined, now: Date): FreeWeek => {
  if (!startedAt) return { startedAt: null, endsAt: null, active: false };
  const endsAt = new Date(startedAt.getTime() + FREE_WEEK_MS);
  return { startedAt, endsAt, active: now < endsAt };
};

/** The email's free week, judged by the server clock so the phone's date cannot extend it. */
export const findFreeWeek = async (email: string, now = new Date()): Promise<FreeWeek> => {
  const claim = await prisma.freeWeekClaim.findUnique({ where: { emailHash: emailHash(email) } });
  return toFreeWeek(claim?.startedAt, now);
};

/** Starts the free week if this email never had one; an earlier start is kept as is. */
export const startFreeWeek = async (email: string, now = new Date()): Promise<FreeWeek> => {
  const claim = await prisma.freeWeekClaim.upsert({
    where: { emailHash: emailHash(email) },
    create: { emailHash: emailHash(email), startedAt: now },
    update: {},
  });
  return toFreeWeek(claim.startedAt, now);
};
