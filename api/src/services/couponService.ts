import { Prisma, PrismaClient } from '@prisma/client';

export class CouponError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'CouponError';
  }
}

type Db = PrismaClient | Prisma.TransactionClient;

/** How many times `userId` has used the coupon (paid checkouts only). */
const usesByUser = (db: Db, couponId: string, userId: string) =>
  db.couponUsage.count({ where: { couponId, userId } });

/** The active coupon for `code` that `userId` may still use; throws CouponError otherwise. */
export const findUsableCoupon = async (db: Db, code: string, userId: string) => {
  const coupon = await db.couponCode.findUnique({ where: { code: code.trim().toUpperCase() } });

  if (!coupon) throw new CouponError('Invalid coupon code', 404);
  if (!coupon.isActive) throw new CouponError('This coupon is no longer active', 400);
  if (coupon.expiresAt && new Date() > coupon.expiresAt) throw new CouponError('This coupon has expired', 400);
  if (coupon.currentUses >= coupon.maxUses) throw new CouponError('This coupon has reached its usage limit', 400);

  const used = await usesByUser(db, coupon.id, userId);
  if (used >= coupon.maxUsesPerUser) {
    throw new CouponError(
      coupon.maxUsesPerUser === 1
        ? 'You have already used this coupon code'
        : `You have already used this coupon ${coupon.maxUsesPerUser} times`,
      400,
    );
  }

  return coupon;
};

/** Price after a percentage discount, rounded to cents. */
export const applyDiscount = (price: number, discountPercent: number) =>
  Math.round(price * (100 - Math.min(Math.max(discountPercent, 0), 100))) / 100;

/**
 * Records that `userId` used the coupon for `paymentId`. Call it inside a transaction.
 * The coupon row is locked first, so redemptions of one coupon happen one at a time:
 * the total limit and the per-user limit are both checked against committed rows.
 * Safe to call more than once for the same payment (the app's confirm call and Stripe's
 * webhook can both finalize). Returns false when nothing was recorded.
 */
export const recordCouponUsage = async (db: Db, code: string, userId: string, paymentId: string) => {
  const coupon = await db.couponCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) return false;

  await db.$queryRaw`SELECT id FROM coupon_codes WHERE id = ${coupon.id} FOR UPDATE`;
  const current = await db.couponCode.findUnique({ where: { id: coupon.id } });
  if (!current) return false;

  const recorded = await db.couponUsage.findUnique({
    where: { couponId_paymentId: { couponId: coupon.id, paymentId } },
  });
  if (recorded) return false;

  // The payment already succeeded at the discounted price, so access is still granted.
  if (current.currentUses >= current.maxUses) {
    console.warn(`Coupon ${coupon.code} had no uses left when payment ${paymentId} was finalized`);
    return false;
  }
  if ((await usesByUser(db, coupon.id, userId)) >= current.maxUsesPerUser) {
    console.warn(`Coupon ${coupon.code} was over its per-user limit when payment ${paymentId} was finalized`);
    return false;
  }

  await db.couponUsage.create({ data: { couponId: coupon.id, userId, paymentId } });
  await db.couponCode.update({ where: { id: coupon.id }, data: { currentUses: { increment: 1 } } });
  return true;
};
