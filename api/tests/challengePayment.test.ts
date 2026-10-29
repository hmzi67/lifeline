export {};

const mockPrisma: any = {
  challenge: { findUnique: jest.fn() },
  challengeFee: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  userChallenge: { findFirst: jest.fn(), create: jest.fn() },
  $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
};

jest.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    constructor(message: string, readonly code: string) {
      super(message);
    }
  }
  return { PrismaClient: jest.fn(() => mockPrisma), Prisma: { PrismaClientKnownRequestError } };
});

const mockVerifySignedTransaction = jest.fn();
const mockGetOrCreateAppAccountToken = jest.fn();
jest.mock('../src/services/appStoreService', () => ({
  verifySignedTransaction: (...args: unknown[]) => mockVerifySignedTransaction(...args),
  getOrCreateAppAccountToken: (...args: unknown[]) => mockGetOrCreateAppAccountToken(...args),
}));

const mockNotifyUser = jest.fn();
jest.mock('../src/services/notificationService', () => ({
  notifyUser: (...args: unknown[]) => mockNotifyUser(...args),
}));

const {
  challengePricing,
  confirmStripeCheckout,
  handleChallengePaymentIntent,
  recordApplePurchase,
  startStripeCheckout,
} = require('../src/services/challengePaymentService') as typeof import('../src/services/challengePaymentService');

const openChallenge = (overrides: Record<string, unknown> = {}) => ({
  id: 'challenge-1',
  name: 'Morning Run',
  approvalStatus: 'APPROVED',
  status: 'ACTIVE',
  scheduledAt: null,
  startDate: null,
  endDate: null,
  dailyFee: 1,
  durationDays: 7,
  ...overrides,
});

const stripe = {
  paymentIntents: {
    create: jest.fn(async () => ({ id: 'pi_1', client_secret: 'secret' })),
    retrieve: jest.fn(),
  },
};

// A tiny in-memory fee table so finalize/replay behaviour is exercised for real.
let fees: any[];
beforeEach(() => {
  fees = [];
  mockPrisma.challenge.findUnique.mockResolvedValue(openChallenge());
  mockPrisma.userChallenge.findFirst.mockResolvedValue(null);
  mockPrisma.challengeFee.create.mockImplementation(async ({ data }: any) => {
    const fee = { id: `fee-${fees.length + 1}`, providerReference: null, createdAt: new Date(), ...data };
    fees.push(fee);
    return fee;
  });
  mockPrisma.challengeFee.update.mockImplementation(async ({ where, data }: any) => {
    const fee = fees.find((f) => f.id === where.id);
    Object.assign(fee, data);
    return fee;
  });
  mockPrisma.challengeFee.updateMany.mockImplementation(async ({ where, data }: any) => {
    const fee = fees.find((f) => f.id === where.id && f.status !== 'PAID');
    if (!fee) return { count: 0 };
    Object.assign(fee, data);
    return { count: 1 };
  });
  mockPrisma.challengeFee.findUnique.mockImplementation(async ({ where }: any) =>
    fees.find((f) => (where.id ? f.id === where.id : f.providerReference === where.providerReference)) ?? null,
  );
  mockPrisma.challengeFee.findMany.mockImplementation(async () =>
    fees.filter((f) => f.status === 'PENDING' && f.method === 'apple' && !f.providerReference)
      .map((f) => ({ ...f, challenge: openChallenge() })),
  );
  mockGetOrCreateAppAccountToken.mockResolvedValue('token-user-1');
});

describe('challengePricing', () => {
  it('charges the daily fee for each day and maps standard lengths to App Store products', () => {
    expect(challengePricing({ dailyFee: 1, durationDays: 7 })).toEqual({ isPaid: true, price: 7, appleProductId: 'challenge_7_days' });
    expect(challengePricing({ dailyFee: 2, durationDays: 7 })).toEqual({ isPaid: true, price: 14, appleProductId: null });
    expect(challengePricing({ dailyFee: null, durationDays: 7 })).toEqual({ isPaid: false, price: 0, appleProductId: null });
  });
});

describe('Stripe checkout', () => {
  it('charges the server-side price and tags the intent as a challenge fee', async () => {
    const checkout = await startStripeCheckout(stripe as any, 'challenge-1', 'user-1');

    expect(checkout).toMatchObject({ clientSecret: 'secret', amount: 7 });
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 700,
      metadata: expect.objectContaining({ kind: 'challenge_fee', challengeId: 'challenge-1', userId: 'user-1' }),
    }));
    expect(fees[0]).toMatchObject({ status: 'PENDING', providerReference: 'pi_1', amount: 7 });
  });

  it('refuses free, pending-review and already-joined challenges', async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(openChallenge({ dailyFee: null }));
    await expect(startStripeCheckout(stripe as any, 'challenge-1', 'user-1')).rejects.toMatchObject({ statusCode: 400 });

    mockPrisma.challenge.findUnique.mockResolvedValueOnce(openChallenge({ approvalStatus: 'PENDING' }));
    await expect(startStripeCheckout(stripe as any, 'challenge-1', 'user-1')).rejects.toMatchObject({ statusCode: 404 });

    mockPrisma.userChallenge.findFirst.mockResolvedValueOnce({ id: 'uc-1' });
    await expect(startStripeCheckout(stripe as any, 'challenge-1', 'user-1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('joins once after a verified payment, even when the webhook also arrives', async () => {
    await startStripeCheckout(stripe as any, 'challenge-1', 'user-1');
    const succeeded = { id: 'pi_1', status: 'succeeded', amount: 700, metadata: { kind: 'challenge_fee' } };
    stripe.paymentIntents.retrieve.mockResolvedValue(succeeded);

    await confirmStripeCheckout(stripe as any, 'challenge-1', 'user-1', 'pi_1');
    await handleChallengePaymentIntent(succeeded as any);

    expect(fees[0].status).toBe('PAID');
    expect(mockPrisma.userChallenge.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.userChallenge.create.mock.calls[0][0].data).toMatchObject({ userId: 'user-1', feeId: 'fee-1' });
  });

  it('does not join on an unfinished or under-paid intent, or for another user', async () => {
    await startStripeCheckout(stripe as any, 'challenge-1', 'user-1');

    stripe.paymentIntents.retrieve.mockResolvedValueOnce({ id: 'pi_1', status: 'processing', amount: 700 });
    await expect(confirmStripeCheckout(stripe as any, 'challenge-1', 'user-1', 'pi_1')).rejects.toMatchObject({ statusCode: 402 });

    stripe.paymentIntents.retrieve.mockResolvedValueOnce({ id: 'pi_1', status: 'succeeded', amount: 100 });
    await expect(confirmStripeCheckout(stripe as any, 'challenge-1', 'user-1', 'pi_1')).rejects.toMatchObject({ statusCode: 400 });

    await expect(confirmStripeCheckout(stripe as any, 'challenge-1', 'user-2', 'pi_1')).rejects.toMatchObject({ statusCode: 404 });
    expect(mockPrisma.userChallenge.create).not.toHaveBeenCalled();
  });

  it('leaves subscription payments to the existing webhook handling', async () => {
    expect(await handleChallengePaymentIntent({ id: 'pi_sub', metadata: {} } as any)).toBe(false);
  });
});

describe('App Store purchase', () => {
  const transaction = (overrides: Record<string, unknown> = {}) => ({
    transactionId: 'tx-1',
    productId: 'challenge_7_days',
    appAccountToken: 'token-user-1',
    ...overrides,
  });

  beforeEach(async () => {
    // startAppleCheckout records a pending fee before StoreKit runs.
    await mockPrisma.challengeFee.create({
      data: { userId: 'user-1', challengeId: 'challenge-1', amount: 7, method: 'apple', status: 'PENDING' },
    });
  });

  it('matches the transaction to the pending fee and joins', async () => {
    mockVerifySignedTransaction.mockResolvedValue(transaction());

    await recordApplePurchase('user-1', 'jws');

    expect(fees[0]).toMatchObject({ status: 'PAID', providerReference: 'tx-1' });
    expect(mockPrisma.userChallenge.create).toHaveBeenCalledTimes(1);
  });

  it('treats a redelivered transaction as already recorded', async () => {
    mockVerifySignedTransaction.mockResolvedValue(transaction());

    await recordApplePurchase('user-1', 'jws');
    await recordApplePurchase('user-1', 'jws');

    expect(mockPrisma.userChallenge.create).toHaveBeenCalledTimes(1);
  });

  it('rejects purchases from another account or for non-challenge products', async () => {
    mockVerifySignedTransaction.mockResolvedValueOnce(transaction({ appAccountToken: 'token-someone-else' }));
    await expect(recordApplePurchase('user-1', 'jws')).rejects.toMatchObject({ statusCode: 409 });

    mockVerifySignedTransaction.mockResolvedValueOnce(transaction({ productId: 'lifeline_vip_monthly' }));
    await expect(recordApplePurchase('user-1', 'jws')).rejects.toMatchObject({ statusCode: 400 });

    expect(mockPrisma.userChallenge.create).not.toHaveBeenCalled();
  });
});
