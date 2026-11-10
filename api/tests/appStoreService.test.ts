export {};

const transaction = {
  subscriptionPayment: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  userLicense: {
    updateMany: jest.fn(),
    upsert: jest.fn(),
  },
  user: {
    updateMany: jest.fn(),
  },
};

const mockPrisma = {
  pricingPlan: {
    findFirst: jest.fn(),
  },
  subscriptionPayment: {
    findUnique: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(async (operation: any) => operation(transaction)),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Signed payloads are opaque strings in these tests; each maps to a decoded
// payload and the environment whose verifier accepts it.
const mockSigned = new Map<string, { environment: string; payload: any }>();
const mockApiClient = { getAllSubscriptionStatuses: jest.fn() };

jest.mock('@apple/app-store-server-library', () => {
  const actual = jest.requireActual('@apple/app-store-server-library');
  const decode = async (environment: string, signed: string) => {
    const entry = mockSigned.get(signed);
    if (!entry) throw new actual.VerificationException(actual.VerificationStatus.VERIFICATION_FAILURE);
    if (entry.environment !== environment) {
      throw new actual.VerificationException(actual.VerificationStatus.INVALID_ENVIRONMENT);
    }
    return entry.payload;
  };
  return {
    ...actual,
    AppStoreServerAPIClient: jest.fn(() => mockApiClient),
    SignedDataVerifier: jest.fn((_certs: Buffer[], _online: boolean, environment: string) => ({
      verifyAndDecodeNotification: (signed: string) => decode(environment, signed),
      verifyAndDecodeRenewalInfo: (signed: string) => decode(environment, signed),
      verifyAndDecodeTransaction: (signed: string) => decode(environment, signed),
    })),
  };
});

process.env.APPLE_BUNDLE_ID = 'com.irtaza.lifeline';
process.env.APPLE_APP_APPLE_ID = '1234567890';
process.env.APPLE_IAP_ALLOW_SANDBOX = 'true';
delete process.env.APPLE_IAP_KEY_ID;
delete process.env.APPLE_IAP_ISSUER_ID;

const {
  AppStoreServiceError,
  getOrCreateAppAccountToken,
  handleAppStoreNotification,
  syncAppStoreTransactions,
} = require('../src/services/appStoreService') as typeof import('../src/services/appStoreService');

const productId = 'com.irtaza.lifeline.vip.monthly';
const accountToken = '6f1c3c1e-8a52-4d5c-9a53-0d0c3b5f4c11';
const plan = {
  id: 'plan-one',
  name: 'Monthly VIP',
  durationMonths: 1,
  price: 9.99,
  originalPrice: null,
};
const future = Date.now() + 20 * 24 * 60 * 60 * 1000;
const past = Date.now() - 24 * 60 * 60 * 1000;

const signTransaction = (
  signed: string,
  overrides: Record<string, unknown> = {},
  environment = 'Sandbox',
) => {
  mockSigned.set(signed, {
    environment,
    payload: {
      appAccountToken: accountToken,
      bundleId: 'com.irtaza.lifeline',
      environment,
      expiresDate: future,
      originalPurchaseDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
      originalTransactionId: '2000000111111111',
      productId,
      purchaseDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
      transactionId: '2000000111111111',
      ...overrides,
    },
  });
  return signed;
};

describe('StoreKit App Store subscription sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSigned.clear();
    delete process.env.APPLE_IAP_KEY_ID;
    delete process.env.APPLE_IAP_ISSUER_ID;
    delete process.env.APPLE_IAP_PRIVATE_KEY;
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-one', appStoreAccountToken: accountToken });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(null);
    mockPrisma.pricingPlan.findFirst.mockResolvedValue(plan);
    mockPrisma.$transaction.mockImplementation(async (operation: any) => operation(transaction));
    transaction.subscriptionPayment.findUnique.mockResolvedValue(null);
    transaction.subscriptionPayment.upsert.mockResolvedValue({ id: 'payment-one' });
    transaction.userLicense.upsert.mockResolvedValue({ id: 'license-one' });
    transaction.user.updateMany.mockResolvedValue({ count: 0 });
  });

  it('verifies a sandbox StoreKit transaction and grants a backend license', async () => {
    const signed = signTransaction('jws-purchase');

    const result = await syncAppStoreTransactions('user-one', [signed]);

    expect(result).toEqual(expect.objectContaining({
      active: true,
      originalTransactionId: '2000000111111111',
      paymentId: 'payment-one',
      pricingPlanId: 'plan-one',
      productId,
      status: 'COMPLETED',
    }));
    expect(transaction.subscriptionPayment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { appStoreEntitlementKey: 'user-one:lifeline_vip' },
      create: expect.objectContaining({
        appStoreOriginalTransactionId: '2000000111111111',
        method: 'app_store',
        status: 'COMPLETED',
        storeEnvironment: 'SANDBOX',
        storeProductId: productId,
      }),
    }));
    expect(transaction.userLicense.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ expiresAt: new Date(future), paymentId: 'payment-one' }),
    }));
  });

  it('accepts production transactions', async () => {
    const signed = signTransaction('jws-production', {}, 'Production');

    await syncAppStoreTransactions('user-one', [signed]);

    expect(transaction.subscriptionPayment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ storeEnvironment: 'PRODUCTION' }),
    }));
  });

  it('rejects data that Apple did not sign', async () => {
    await expect(syncAppStoreTransactions('user-one', ['forged']))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a purchase made with another Lifeline account token', async () => {
    const signed = signTransaction('jws-foreign', {
      appAccountToken: '11111111-2222-4333-8444-555555555555',
    });

    await expect(syncAppStoreTransactions('user-one', [signed]))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an Apple subscription already linked to another user', async () => {
    const signed = signTransaction('jws-claimed');
    mockPrisma.subscriptionPayment.findUnique.mockResolvedValue({ userId: 'user-two' });

    await expect(syncAppStoreTransactions('user-one', [signed]))
      .rejects.toBeInstanceOf(AppStoreServiceError);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('records a free trial and marks the trial as used', async () => {
    const signed = signTransaction('jws-trial', { offerDiscountType: 'FREE_TRIAL', offerType: 1 });

    const result = await syncAppStoreTransactions('user-one', [signed]);

    expect(result.status).toBe('TRIALING');
    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-one', trialUsedAt: null },
      data: { trialUsedAt: expect.any(Date) },
    });
  });

  it('prefers the active transaction when several are restored', async () => {
    const expired = signTransaction('jws-old', {
      expiresDate: past,
      originalTransactionId: '1000',
      transactionId: '1000',
    });
    const active = signTransaction('jws-new', { originalTransactionId: '2000', transactionId: '2001' });

    const result = await syncAppStoreTransactions('user-one', [expired, active]);

    expect(result.originalTransactionId).toBe('2000');
    expect(result.active).toBe(true);
  });

  it('revokes the license for a refunded transaction', async () => {
    const signed = signTransaction('jws-refunded', { revocationDate: past });
    transaction.subscriptionPayment.findUnique.mockResolvedValue({
      id: 'payment-one',
      appStoreOriginalTransactionId: '2000000111111111',
      currentPeriodEnd: new Date(future),
      pricingPlanId: 'plan-one',
      storeProductId: productId,
    });

    const result = await syncAppStoreTransactions('user-one', [signed]);

    expect(result).toEqual(expect.objectContaining({ active: false, status: 'REFUNDED' }));
    expect(transaction.subscriptionPayment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'payment-one' },
      data: expect.objectContaining({ status: 'REFUNDED', cancelAtPeriodEnd: false }),
    }));
    expect(transaction.userLicense.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-one', paymentId: 'payment-one' },
      data: { expiresAt: expect.any(Date) },
    });
  });

  it('does not let an inactive second Apple ID overwrite the tracked subscription', async () => {
    const signed = signTransaction('jws-other-apple-id', {
      expiresDate: past,
      originalTransactionId: '9999',
      transactionId: '9999',
    });
    transaction.subscriptionPayment.findUnique.mockResolvedValue({
      id: 'payment-one',
      appStoreOriginalTransactionId: '2000000111111111',
      currentPeriodEnd: new Date(future),
    });

    const result = await syncAppStoreTransactions('user-one', [signed]);

    expect(result.active).toBe(false);
    expect(transaction.subscriptionPayment.update).not.toHaveBeenCalled();
    expect(transaction.userLicense.updateMany).not.toHaveBeenCalled();
  });

  it('uses the App Store Server API status when credentials are configured', async () => {
    process.env.APPLE_IAP_KEY_ID = 'KEY123';
    process.env.APPLE_IAP_ISSUER_ID = 'issuer';
    process.env.APPLE_IAP_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----';
    const signed = signTransaction('jws-device');
    signTransaction('jws-server-latest', { autoRenewStatus: undefined, transactionId: '2000000222222222' });
    mockSigned.set('jws-renewal', { environment: 'Sandbox', payload: { autoRenewStatus: 0 } });
    mockApiClient.getAllSubscriptionStatuses.mockResolvedValue({
      data: [{
        lastTransactions: [{
          originalTransactionId: '2000000111111111',
          signedRenewalInfo: 'jws-renewal',
          signedTransactionInfo: 'jws-server-latest',
          status: 1,
        }],
      }],
    });

    const result = await syncAppStoreTransactions('user-one', [signed]);

    expect(mockApiClient.getAllSubscriptionStatuses).toHaveBeenCalledWith('2000000111111111');
    expect(result).toEqual(expect.objectContaining({ active: true, cancelAtPeriodEnd: true }));
  });

  it('returns the stored state when the app sends no transactions', async () => {
    mockPrisma.subscriptionPayment.findUnique.mockResolvedValue({
      id: 'payment-one',
      appStoreOriginalTransactionId: '2000000111111111',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(future),
      pricingPlanId: 'plan-one',
      status: 'COMPLETED',
      storeEnvironment: 'SANDBOX',
      storeProductId: productId,
    });

    const result = await syncAppStoreTransactions('user-one', []);

    expect(result).toEqual(expect.objectContaining({ active: true, paymentId: 'payment-one' }));
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('App Store account token', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the existing token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ appStoreAccountToken: accountToken });

    await expect(getOrCreateAppAccountToken('user-one')).resolves.toBe(accountToken);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('creates a UUID token for users without one', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ appStoreAccountToken: null })
      .mockResolvedValueOnce({ appStoreAccountToken: accountToken });

    await expect(getOrCreateAppAccountToken('user-one')).resolves.toBe(accountToken);
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-one', appStoreAccountToken: null },
      data: {
        appStoreAccountToken: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
      },
    });
  });
});

describe('App Store Server Notifications V2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSigned.clear();
    delete process.env.APPLE_IAP_KEY_ID;
    mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.pricingPlan.findFirst.mockResolvedValue(plan);
    transaction.subscriptionPayment.findUnique.mockResolvedValue(null);
    transaction.subscriptionPayment.upsert.mockResolvedValue({ id: 'payment-one' });
  });

  const signNotification = (signed: string, payload: Record<string, unknown>) => {
    mockSigned.set(signed, { environment: 'Sandbox', payload });
    return signed;
  };

  it('acknowledges TEST notifications without touching data', async () => {
    const signed = signNotification('notification-test', { notificationType: 'TEST' });

    const result = await handleAppStoreNotification(signed);

    expect(result).toEqual(expect.objectContaining({ handled: false, reason: 'test' }));
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects unsigned notifications', async () => {
    await expect(handleAppStoreNotification('forged')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('applies a renewal to the user who owns the original transaction', async () => {
    signTransaction('jws-renewed');
    mockPrisma.subscriptionPayment.findUnique
      .mockResolvedValueOnce({ userId: 'user-one' })
      .mockResolvedValue({ userId: 'user-one' });
    const signed = signNotification('notification-renew', {
      notificationType: 'DID_RENEW',
      data: { signedTransactionInfo: 'jws-renewed', status: 1 },
    });

    const result = await handleAppStoreNotification(signed);

    expect(result.handled).toBe(true);
    expect(result.result).toEqual(expect.objectContaining({ active: true }));
    expect(transaction.subscriptionPayment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { appStoreEntitlementKey: 'user-one:lifeline_vip' },
    }));
  });

  it('falls back to the appAccountToken for a first purchase', async () => {
    signTransaction('jws-first');
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-one' });
    const signed = signNotification('notification-subscribed', {
      notificationType: 'SUBSCRIBED',
      data: { signedTransactionInfo: 'jws-first', status: 1 },
    });

    const result = await handleAppStoreNotification(signed);

    expect(result.handled).toBe(true);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { appStoreAccountToken: { equals: accountToken, mode: 'insensitive' } },
    }));
  });

  it('ignores notifications for unknown users', async () => {
    signTransaction('jws-unknown');
    const signed = signNotification('notification-unknown', {
      notificationType: 'SUBSCRIBED',
      data: { signedTransactionInfo: 'jws-unknown', status: 1 },
    });

    const result = await handleAppStoreNotification(signed);

    expect(result).toEqual(expect.objectContaining({ handled: false, reason: 'unknown_user' }));
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('ignores an out-of-order notification older than the stored period', async () => {
    signTransaction('jws-stale', { expiresDate: past });
    mockPrisma.subscriptionPayment.findUnique.mockResolvedValue({ userId: 'user-one' });
    transaction.subscriptionPayment.findUnique.mockResolvedValue({
      id: 'payment-one',
      appStoreOriginalTransactionId: '2000000111111111',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(future),
      pricingPlanId: 'plan-one',
      status: 'COMPLETED',
      storeProductId: productId,
    });
    const signed = signNotification('notification-stale', {
      notificationType: 'EXPIRED',
      data: { signedTransactionInfo: 'jws-stale', status: 2 },
    });

    const result = await handleAppStoreNotification(signed);

    expect(result.result).toEqual(expect.objectContaining({ active: true }));
    expect(transaction.subscriptionPayment.update).not.toHaveBeenCalled();
    expect(transaction.subscriptionPayment.upsert).not.toHaveBeenCalled();
  });
});
