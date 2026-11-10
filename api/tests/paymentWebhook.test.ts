export {};

const mockTransaction = {
  subscriptionPayment: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  userLicense: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    updateMany: jest.fn(),
  },
};

const mockPrisma = {
  subscriptionPayment: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(async (operation: any) => operation(mockTransaction)),
};

const mockStripe = {
  webhooks: {
    constructEvent: jest.fn(),
  },
  paymentMethods: {
    retrieve: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => mockStripe),
}));

process.env.STRIPE_SECRET_KEY = 'sk_test_webhook';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

const { handleStripeWebhook } = require('../src/controllers/paymentController') as typeof import('../src/controllers/paymentController');

const createResponse = () => {
  const response: any = {};
  response.status = jest.fn(() => response);
  response.json = jest.fn(() => response);
  response.send = jest.fn(() => response);
  return response;
};

const basePayment = {
  id: 'payment-one',
  userId: 'user-one',
  durationMonths: 1,
  currentPeriodEnd: null,
  status: 'PENDING',
};

describe('Stripe webhook entitlement provisioning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (operation: any) => operation(mockTransaction));
    mockPrisma.subscriptionPayment.findFirst.mockResolvedValue({ id: 'payment-one' });
    mockTransaction.subscriptionPayment.findUnique.mockResolvedValue(basePayment);
    mockTransaction.subscriptionPayment.update.mockResolvedValue(basePayment);
    mockTransaction.userLicense.findFirst.mockResolvedValue(null);
    mockTransaction.userLicense.create.mockResolvedValue({ id: 'license-one' });
    mockTransaction.user.updateMany.mockResolvedValue({ count: 1 });
    mockStripe.paymentMethods.retrieve.mockResolvedValue({
      id: 'pm_apple',
      type: 'card',
      card: { wallet: { type: 'apple_pay' } },
    });
  });

  it('grants a license when an Apple Pay PaymentIntent succeeds', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_one',
          payment_method: 'pm_apple',
        },
      },
    });
    const response = createResponse();

    await handleStripeWebhook(
      { headers: { 'stripe-signature': 'signature' }, body: Buffer.from('event') } as any,
      response,
    );

    expect(mockTransaction.subscriptionPayment.update).toHaveBeenCalledWith({
      where: { id: 'payment-one' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        method: 'apple_pay',
        stripePaymentMethodId: 'pm_apple',
        currentPeriodEnd: expect.any(Date),
      }),
    });
    expect(mockTransaction.userLicense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-one',
        paymentId: 'payment-one',
        expiresAt: expect.any(Date),
      }),
    });
    expect(response.json).toHaveBeenCalledWith({ received: true });
  });

  it('activates a trial when an Apple Pay SetupIntent succeeds', async () => {
    const trialEndsAt = new Date('2026-09-02T00:00:00.000Z');
    mockTransaction.subscriptionPayment.findUnique.mockResolvedValue({
      ...basePayment,
      status: 'SETUP_PENDING',
      currentPeriodEnd: trialEndsAt,
    });
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'setup_intent.succeeded',
      data: {
        object: {
          id: 'seti_one',
          payment_method: 'pm_apple',
        },
      },
    });
    const response = createResponse();

    await handleStripeWebhook(
      { headers: { 'stripe-signature': 'signature' }, body: Buffer.from('event') } as any,
      response,
    );

    expect(mockTransaction.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-one', trialUsedAt: null },
      data: { trialUsedAt: expect.any(Date) },
    });
    expect(mockTransaction.subscriptionPayment.update).toHaveBeenCalledWith({
      where: { id: 'payment-one' },
      data: {
        status: 'TRIALING',
        method: 'apple_pay',
        stripePaymentMethodId: 'pm_apple',
      },
    });
    expect(mockTransaction.userLicense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ expiresAt: trialEndsAt }),
    });
  });
});
