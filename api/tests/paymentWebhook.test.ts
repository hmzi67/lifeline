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

const processedEvents = new Set<string>();
const mockPrisma = {
  processedStripeEvent: {
    createMany: jest.fn(async ({ data: [{ id }] }: any) => {
      if (processedEvents.has(id)) return { count: 0 };
      processedEvents.add(id);
      return { count: 1 };
    }),
    deleteMany: jest.fn(async ({ where: { id } }: any) => ({ count: processedEvents.delete(id) ? 1 : 0 })),
  },
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
    processedEvents.clear();
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
      id: 'evt_pi_one',
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
      id: 'evt_seti_one',
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

  describe('duplicate delivery', () => {
    const deliver = async () => {
      const response = createResponse();
      await handleStripeWebhook(
        { headers: { 'stripe-signature': 'signature' }, body: Buffer.from('event') } as any,
        response,
      );
      return response;
    };
    const succeeded = { id: 'evt_dup', type: 'payment_intent.succeeded', data: { object: { id: 'pi_dup', payment_method: 'pm_apple' } } };

    it('applies a redelivered event once', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(succeeded);

      await deliver();
      const second = await deliver();

      expect(mockTransaction.userLicense.create).toHaveBeenCalledTimes(1);
      expect(mockTransaction.subscriptionPayment.update).toHaveBeenCalledTimes(1);
      expect(second.json).toHaveBeenCalledWith({ received: true, duplicate: true });
    });

    it('applies simultaneous deliveries of the same event once', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(succeeded);

      await Promise.all([deliver(), deliver(), deliver()]);

      expect(mockTransaction.userLicense.create).toHaveBeenCalledTimes(1);
    });

    it('lets Stripe retry an event whose processing failed', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(succeeded);
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('db down'));

      await expect(deliver()).rejects.toThrow('db down');
      await deliver();

      expect(mockTransaction.userLicense.create).toHaveBeenCalledTimes(1);
      expect(processedEvents.has('evt_dup')).toBe(true);
    });

    it('records nothing when the signature is invalid', async () => {
      mockStripe.webhooks.constructEvent.mockImplementationOnce(() => { throw new Error('bad signature'); });

      const response = await deliver();

      expect(response.status).toHaveBeenCalledWith(400);
      expect(mockPrisma.processedStripeEvent.createMany).not.toHaveBeenCalled();
    });
  });
});
