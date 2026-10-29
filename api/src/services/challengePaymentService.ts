import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { prisma } from '../config/database.js';
import { getOrCreateAppAccountToken, verifySignedTransaction } from './appStoreService.js';
import { challengePhase, isChallengeVisible } from './challengeTimeline.js';
import { notifyUser } from './notificationService.js';

/** Lengths a user can choose for a challenge they submit; each maps to an App Store product. */
export const CHALLENGE_DURATIONS = [7, 14, 30] as const;
export type ChallengeDuration = (typeof CHALLENGE_DURATIONS)[number];

/** USD per day charged to joiners of user-submitted challenges. */
export const DEFAULT_DAILY_FEE = 1;

/** Stripe metadata marking a PaymentIntent as a challenge fee rather than a subscription. */
export const CHALLENGE_FEE_KIND = 'challenge_fee';

/** Consumable App Store products, one per length, priced at DEFAULT_DAILY_FEE x days. */
export const challengeAppleProductId = (days: number) => `challenge_${days}_days`;

export class ChallengePaymentError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'ChallengePaymentError';
  }
}

type PricedChallenge = { dailyFee: Prisma.Decimal | number | null; durationDays: number | null };

export const challengePricing = ({ dailyFee, durationDays }: PricedChallenge) => {
  const fee = dailyFee === null ? 0 : Number(dailyFee);
  const days = durationDays ?? 0;
  const price = fee > 0 && days > 0 ? Math.round(fee * days * 100) / 100 : 0;
  // App Store prices are fixed per product, so only the standard rate and lengths can be sold there.
  const appleProductId =
    price > 0 && fee === DEFAULT_DAILY_FEE && (CHALLENGE_DURATIONS as readonly number[]).includes(days)
      ? challengeAppleProductId(days)
      : null;
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
  if (!pending) {
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
  !!productId && /^challenge_\d+_days$/.test(productId);

/** Verifies a StoreKit transaction for a challenge product and joins the matching challenge. */
export const recordApplePurchase = async (userId: string, signedTransaction: string) => {
  const transaction = await verifySignedTransaction(signedTransaction);
  const transactionId = transaction.transactionId;
  if (!transactionId || !isChallengeProductId(transaction.productId)) {
    throw new ChallengePaymentError('This is not a challenge purchase', 400);
  }
  if (transaction.revocationDate) throw new ChallengePaymentError('This purchase was refunded', 400);

  const token = await getOrCreateAppAccountToken(userId);
  if (transaction.appAccountToken && transaction.appAccountToken.toLowerCase() !== token.toLowerCase()) {
    throw new ChallengePaymentError('This purchase belongs to a different Lifeline account', 409);
  }

  // Already recorded: StoreKit redelivers unfinished transactions.
  const recorded = await prisma.challengeFee.findUnique({ where: { providerReference: transactionId } });
  if (recorded) {
    if (recorded.userId !== userId) {
      throw new ChallengePaymentError('This purchase belongs to a different Lifeline account', 409);
    }
    return finalizeFee(recorded.id);
  }

  const pendingFees = await prisma.challengeFee.findMany({
    where: { userId, method: 'apple', status: 'PENDING', providerReference: null },
    include: { challenge: true },
    orderBy: { createdAt: 'desc' },
  });
  const fee = pendingFees.find(
    (candidate) => candidate.challenge && challengePricing(candidate.challenge).appleProductId === transaction.productId,
  );
  if (!fee) throw new ChallengePaymentError('No challenge is waiting for this purchase', 404);

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
