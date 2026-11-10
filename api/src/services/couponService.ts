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
 * for the same payment (the app's confirm call and Stripe's webhook can both finalize),
 * and safe under concurrency: call it inside a transaction so both writes commit together.
 * Returns false when nothing was recorded (unknown code, already recorded, or no uses left).
 */
export const recordCouponUsage = async (db: Db, code: string, userId: string, paymentId: string) => {
  const coupon = await db.couponCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) return false;

  // The (couponId, userId) unique key makes a concurrent second insert a no-op.
  const { count: inserted } = await db.couponUsage.createMany({
    data: [{ couponId: coupon.id, userId, paymentId }],
    skipDuplicates: true,
  });
  if (!inserted) return false;

  // Row-level conditional increment: two redemptions racing for the last use cannot both win.
  const { count: incremented } = await db.couponCode.updateMany({
    where: { id: coupon.id, currentUses: { lt: db.couponCode.fields.maxUses } },
    data: { currentUses: { increment: 1 } },
  });
  if (!incremented) {
    await db.couponUsage.deleteMany({ where: { couponId: coupon.id, userId, paymentId } });
    // The payment already succeeded at the discounted price, so access is still granted.
    console.warn(`Coupon ${coupon.code} had no uses left when payment ${paymentId} was finalized`);
    return false;
  }
  return true;
};
