import { Prisma, PrismaClient } from '@prisma/client';

export class CouponError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'CouponError';
  }
}

type Db = PrismaClient | Prisma.TransactionClient;

/** The active coupon for `code` that `userId` may still use; throws CouponError otherwise. */
export const findUsableCoupon = async (db: Db, code: string, userId: string) => {
  const coupon = await db.couponCode.findUnique({ where: { code: code.trim().toUpperCase() } });

  if (!coupon) throw new CouponError('Invalid coupon code', 404);
  if (!coupon.isActive) throw new CouponError('This coupon is no longer active', 400);
  if (coupon.expiresAt && new Date() > coupon.expiresAt) throw new CouponError('This coupon has expired', 400);
  if (coupon.currentUses >= coupon.maxUses) throw new CouponError('This coupon has reached its usage limit', 400);

  const alreadyUsed = await db.couponUsage.findUnique({
    where: { couponId_userId: { couponId: coupon.id, userId } },
  });
  if (alreadyUsed) throw new CouponError('You have already used this coupon code', 400);

  return coupon;
};

/** Price after a percentage discount, rounded to cents. */
export const applyDiscount = (price: number, discountPercent: number) =>
  Math.round(price * (100 - Math.min(Math.max(discountPercent, 0), 100))) / 100;

/**
 * Records that `userId` used the coupon for `paymentId`. Safe to call more than once
 * for the same payment (the app's confirm call and Stripe's webhook can both finalize).
 */
export const recordCouponUsage = async (db: Db, code: string, userId: string, paymentId: string) => {
  const coupon = await db.couponCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) return;

  const existing = await db.couponUsage.findUnique({
    where: { couponId_userId: { couponId: coupon.id, userId } },
  });
  if (existing) return;

  await db.couponUsage.create({ data: { couponId: coupon.id, userId, paymentId } });
  await db.couponCode.update({ where: { id: coupon.id }, data: { currentUses: { increment: 1 } } });
};
