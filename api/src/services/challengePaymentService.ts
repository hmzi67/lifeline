import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { prisma } from '../config/database.js';
import { getOrCreateAppAccountToken, verifySignedTransaction } from './appStoreService.js';
import { challengePhase, isChallengeVisible } from './challengeTimeline.js';
import { notifyUser } from './notificationService.js';

/** Lengths a user can choose for a challenge they submit. */
export const CHALLENGE_DURATIONS = [7, 14, 30] as const;
export type ChallengeDuration = (typeof CHALLENGE_DURATIONS)[number];

/** USD per day charged to joiners of user-submitted challenges. */
export const DEFAULT_DAILY_FEE = 1;

/** Stripe metadata marking a PaymentIntent as a challenge fee rather than a subscription. */
export const CHALLENGE_FEE_KIND = 'challenge_fee';

/**
 * The prices, in whole US dollars, a paid challenge can cost. App Store prices are fixed per
 * product, so each price is a consumable product (challenge_usd_<price>) and every paid
 * challenge, whatever its length, can be bought on iOS. Adding a price needs its product in
 * App Store Connect first.
 */
export const CHALLENGE_PRICES = [1, 2, 3, 5, 7, 10, 14, 15, 20, 21, 25, 30, 40, 50, 60, 75, 90, 100] as const;
export const isChallengePrice = (usd: number) => (CHALLENGE_PRICES as readonly number[]).includes(usd);
export const challengeAppleProductId = (usd: number) => `challenge_usd_${usd}`;
const CHALLENGE_PRODUCT_ID = /^challenge_usd_(\d+)$/;

/** The price in US dollars of a challenge product, or null for any other product. */
export const challengeProductPrice = (productId: string | undefined | null): number | null => {
  const usd = Number(CHALLENGE_PRODUCT_ID.exec(productId ?? '')?.[1] ?? NaN);
  return isChallengePrice(usd) ? usd : null;
};

export class ChallengePaymentError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'ChallengePaymentError';
  }
}

type PricedChallenge = {
  entryFee?: Prisma.Decimal | number | null;
  dailyFee: Prisma.Decimal | number | null;
  durationDays: number | null;
};

const legacyPrice = ({ dailyFee, durationDays }: PricedChallenge) => {
  const fee = dailyFee === null ? 0 : Number(dailyFee);
  const days = durationDays ?? 0;
  return fee > 0 && days > 0 ? Math.round(fee * days * 100) / 100 : 0;
};

/** What joining costs: the entry fee, or daily fee x days for a challenge saved before entry fees. */
export const challengePricing = (challenge: PricedChallenge) => {
  const price = challenge.entryFee === null || challenge.entryFee === undefined
    ? legacyPrice(challenge)
    : Math.max(0, Number(challenge.entryFee));
  // An older price outside the list has no App Store product, so it cannot be bought on iOS.
  const appleProductId = isChallengePrice(price) ? challengeAppleProductId(price) : null;
  return { isPaid: price > 0, price, appleProductId };
};

/** The challenge a user is about to pay for, after checking it can be joined at all. */
const loadPayableChallenge = async (challengeId: string, userId: string) => {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || !isChallengeVisible(challenge)) {
    throw new ChallengePaymentError('Challenge not found', 404);
  }
  if (challengePhase(challenge) === 'ended') throw new ChallengePaymentError('This challenge has ended', 400);

  const pricing = challengePricing(challenge);
  if (!pricing.isPaid) throw new ChallengePaymentError('This challenge is free to join', 400);

  const joined = await prisma.userChallenge.findFirst({ where: { challengeId, userId }, select: { id: true } });
  if (joined) throw new ChallengePaymentError('You have already joined this challenge', 409);

  return { challenge, pricing };
};

/**
 * Marks a fee paid and joins its user to the challenge. Safe to call more than once
 * (the app's confirm call and Stripe's webhook can race): only the first call joins.
 */
const finalizeFee = async (feeId: string) => {
  const joined = await prisma.$transaction(async (tx) => {
    const { count } = await tx.challengeFee.updateMany({
      where: { id: feeId, status: { not: 'PAID' } },
      data: { status: 'PAID', paidAt: new Date() },
    });
    const fee = await tx.challengeFee.findUnique({ where: { id: feeId } });
    if (!fee?.userId || !fee.challengeId) throw new ChallengePaymentError('Payment record is incomplete', 500);
    if (count === 0) return { fee, newlyJoined: false };

    await tx.userChallenge.create({
      data: { challengeId: fee.challengeId, userId: fee.userId, feeId: fee.id, joinedAt: new Date() },
    });
    return { fee, newlyJoined: true };
  });

  if (joined.newlyJoined) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: joined.fee.challengeId! },
      select: { name: true },
    });
    await notifyUser(joined.fee.userId!, {
      type: 'challenge',
      title: 'Challenge joined',
      body: `You joined "${challenge?.name ?? 'a challenge'}". Good luck!`,
      data: { challengeId: joined.fee.challengeId },
    });
  }
  return joined.fee;
};

/**
 * Reverses a refunded fee: the fee is marked REFUNDED and the user leaves the challenge
 * it paid for. Safe to call more than once; only the first call changes anything.
 */
const refundFee = async (feeId: string) => {
  const refunded = await prisma.$transaction(async (tx) => {
    const { count } = await tx.challengeFee.updateMany({
      where: { id: feeId, status: { not: 'REFUNDED' } },
      data: { status: 'REFUNDED' },
    });
    const fee = await tx.challengeFee.findUnique({ where: { id: feeId } });
    if (!fee) throw new ChallengePaymentError('Payment not found', 404);
    if (count === 0) return { fee, removed: false };

    const { count: removed } = await tx.userChallenge.deleteMany({ where: { feeId } });
    return { fee, removed: removed > 0 };
  });

  if (refunded.removed && refunded.fee.userId) {
    const challenge = refunded.fee.challengeId
      ? await prisma.challenge.findUnique({ where: { id: refunded.fee.challengeId }, select: { name: true } })
      : null;
    await notifyUser(refunded.fee.userId, {
      type: 'challenge',
      title: 'Challenge payment refunded',
      body: `Your payment for "${challenge?.name ?? 'a challenge'}" was refunded, so you are no longer in that challenge.`,
      data: { challengeId: refunded.fee.challengeId },
    });
  }
  return refunded.fee;
};

// ---------------------------------------------------------------- Stripe (Android)

export const startStripeCheckout = async (stripe: Stripe, challengeId: string, userId: string) => {
  const { challenge, pricing } = await loadPayableChallenge(challengeId, userId);

  const fee = await prisma.challengeFee.create({
    data: { userId, challengeId, amount: pricing.price, method: 'stripe', status: 'PENDING' },
  });
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(pricing.price * 100),
    currency: 'usd',
    // Card only, like subscriptions; Stripe would otherwise offer every wallet enabled in the Dashboard.
    payment_method_types: ['card'],
    description: `Challenge: ${challenge.name ?? challenge.id}`,
    metadata: { kind: CHALLENGE_FEE_KIND, challengeFeeId: fee.id, challengeId, userId },
  });
  await prisma.challengeFee.update({ where: { id: fee.id }, data: { providerReference: intent.id } });

  return { clientSecret: intent.client_secret, paymentIntentId: intent.id, amount: pricing.price, currency: 'usd' };
};

/** Called by the app after PaymentSheet completes. */
export const confirmStripeCheckout = async (
  stripe: Stripe,
  challengeId: string,
  userId: string,
  paymentIntentId: string,
) => {
  const fee = await prisma.challengeFee.findUnique({ where: { providerReference: paymentIntentId } });
  if (!fee || fee.userId !== userId || fee.challengeId !== challengeId) {
    throw new ChallengePaymentError('Payment not found', 404);
  }

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== 'succeeded') throw new ChallengePaymentError('Payment has not completed', 402);
  if (intent.amount !== Math.round(Number(fee.amount) * 100)) {
    throw new ChallengePaymentError('Payment amount does not match the challenge price', 400);
  }

  return finalizeFee(fee.id);
};

/** Stripe webhook: covers payments whose app session ended before it could confirm. */
export const handleChallengePaymentIntent = async (intent: Stripe.PaymentIntent): Promise<boolean> => {
  if (intent.metadata?.kind !== CHALLENGE_FEE_KIND) return false;

  const fee = await prisma.challengeFee.findUnique({ where: { providerReference: intent.id } });
  if (!fee) return true;

  if (intent.status === 'succeeded' && intent.amount === Math.round(Number(fee.amount) * 100)) {
    await finalizeFee(fee.id);
  } else if (intent.status === 'canceled' || intent.status === 'requires_payment_method') {
    await prisma.challengeFee.updateMany({
      where: { id: fee.id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  }
  return true;
};

// ---------------------------------------------------------------- App Store (iOS)

/**
 * Records that the user is about to buy a challenge in the App Store, so the purchase
 * can be matched to the challenge even if it is delivered later by the transaction listener.
 */
export const startAppleCheckout = async (challengeId: string, userId: string) => {
  const { pricing } = await loadPayableChallenge(challengeId, userId);
  if (!pricing.appleProductId) {
    throw new ChallengePaymentError('This challenge cannot be purchased on iOS', 400);
  }

  const pending = await prisma.challengeFee.findFirst({
    where: { userId, challengeId, method: 'apple', status: 'PENDING' },
  });
  if (pending) {
    // The purchase is matched to the newest pending fee for its product, so going back to
    // a challenge after opening another one at the same price must make this one newest again.
    await prisma.challengeFee.update({ where: { id: pending.id }, data: { createdAt: new Date() } });
  } else {
    await prisma.challengeFee.create({
      data: { userId, challengeId, amount: pricing.price, method: 'apple', status: 'PENDING' },
    });
  }

  return {
    productId: pricing.appleProductId,
    appAccountToken: await getOrCreateAppAccountToken(userId),
    amount: pricing.price,
  };
};

export const isChallengeProductId = (productId: string | undefined | null) =>
  challengeProductPrice(productId) !== null;

/**
 * Keeps a paid purchase that no challenge is waiting for (the challenge was removed or its
 * price changed after checkout started). The user is told, and the fee stays on record as
 * UNMATCHED so support can refund it or add the user to a challenge by hand.
 */
const recordUnmatchedPurchase = async (userId: string, transactionId: string, productId: string) => {
  try {
    const fee = await prisma.challengeFee.create({
      data: {
        userId,
        amount: challengeProductPrice(productId) ?? 0,
        method: 'apple',
        status: 'UNMATCHED',
        providerReference: transactionId,
        paidAt: new Date(),
      },
    });
    console.error(`Challenge purchase ${transactionId} (${productId}) by user ${userId} matches no pending challenge`);
    await notifyUser(userId, {
      type: 'challenge',
      title: 'Challenge payment received',
      body: 'We received your payment, but that challenge is no longer available, so you were not added to it. '
        + 'You can ask Apple for a refund at reportaproblem.apple.com.',
    });
    return fee;
  } catch (error) {
    // A concurrent request recorded the same transaction first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await prisma.challengeFee.findUnique({ where: { providerReference: transactionId } });
      if (winner) return winner;
    }
    throw error;
  }
};

/**
 * Verifies a StoreKit transaction for a challenge product and joins the matching challenge.
 *
 * Returns the fee whenever the purchase has been dealt with, so the app can finish the
 * transaction: PAID (joined), REFUNDED, or UNMATCHED (paid, but no challenge to join).
 * It throws only when the app should keep the transaction and try again later.
 */
export const recordApplePurchase = async (
  userId: string,
  signedTransaction: string,
): Promise<{ challengeId: string | null; status: string | null }> => {
  const transaction = await verifySignedTransaction(signedTransaction);
  const transactionId = transaction.transactionId;
  const productId = transaction.productId;
  if (!transactionId || !productId || !isChallengeProductId(productId)) {
    throw new ChallengePaymentError('This is not a challenge purchase', 400);
  }

  const token = await getOrCreateAppAccountToken(userId);
  if (transaction.appAccountToken && transaction.appAccountToken.toLowerCase() !== token.toLowerCase()) {
    throw new ChallengePaymentError('This purchase belongs to a different Lifeline account', 409);
  }

  // Already recorded: StoreKit redelivers unfinished transactions.
  const recorded = await prisma.challengeFee.findUnique({ where: { providerReference: transactionId } });
  if (recorded && recorded.userId !== userId) {
    throw new ChallengePaymentError('This purchase belongs to a different Lifeline account', 409);
  }

  // Apple refunded it: nothing to join, and anything it paid for is taken back.
  if (transaction.revocationDate) {
    return recorded ? refundFee(recorded.id) : { challengeId: null, status: 'REFUNDED' };
  }

  if (recorded) {
    return recorded.challengeId && recorded.status !== 'REFUNDED' ? finalizeFee(recorded.id) : recorded;
  }

  const pendingFees = await prisma.challengeFee.findMany({
    where: { userId, method: 'apple', status: 'PENDING', providerReference: null },
    include: { challenge: true },
    orderBy: { createdAt: 'desc' },
  });
  const fee = pendingFees.find(
    (candidate) => candidate.challenge && challengePricing(candidate.challenge).appleProductId === transaction.productId,
  );
  if (!fee) return recordUnmatchedPurchase(userId, transactionId, productId);

  try {
    await prisma.challengeFee.update({ where: { id: fee.id }, data: { providerReference: transactionId } });
  } catch (error) {
    // A concurrent request recorded the same transaction first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await prisma.challengeFee.findUnique({ where: { providerReference: transactionId } });
      if (winner) return finalizeFee(winner.id);
    }
    throw error;
  }
  return finalizeFee(fee.id);
};

/**
 * App Store Server Notifications for challenge purchases. Returns null for other products
 * (subscriptions). A refund takes the user back out of the challenge.
 */
export const handleAppleChallengeNotification = async (
  transaction: { productId?: string; transactionId?: string },
  notificationType: string | null,
): Promise<{ handled: boolean; reason: string } | null> => {
  if (!isChallengeProductId(transaction.productId)) return null;
  if (notificationType !== 'REFUND' || !transaction.transactionId) {
    return { handled: false, reason: 'challenge_purchase' };
  }

  const fee = await prisma.challengeFee.findUnique({ where: { providerReference: transaction.transactionId } });
  // Not recorded yet: the app reports the refunded transaction itself when it next syncs.
  if (!fee) return { handled: false, reason: 'unknown_challenge_purchase' };

  await refundFee(fee.id);
  return { handled: true, reason: 'challenge_refunded' };
};
