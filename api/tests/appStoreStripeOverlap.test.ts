export {};

const mockPrisma = {
  pricingPlan: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  userLicense: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  subscriptionPayment: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockStripe = {
  paymentIntents: {
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => mockStripe),
}));

process.env.STRIPE_SECRET_KEY = 'sk_test_overlap';

const {
  createSubscription,
  processDueTrialCharges,
} = require('../src/controllers/paymentController') as typeof import('../src/controllers/paymentController');

const createResponse = () => {
  const response: any = {};
  response.status = jest.fn(() => response);
  response.json = jest.fn(() => response);
  return response;
};

describe('App Store and Stripe billing overlap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses Stripe checkout while any App Store license is active', async () => {
    mockPrisma.pricingPlan.findFirst.mockResolvedValue({ id: 'plan-one', isActive: true });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-one', trialUsedAt: null });
    mockPrisma.userLicense.findFirst.mockResolvedValue({ id: 'license-app-store' });
    const response = createResponse();

    await createSubscription({
      user: { id: 'user-one' },
      body: { pricingPlanId: 'plan-one' },
    } as any, response);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(mockPrisma.userLicense.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'user-one', payment: { method: 'app_store' } }),
    }));
  });

  it('cancels a due Stripe trial instead of charging when the user subscribed on iOS', async () => {
    mockPrisma.subscriptionPayment.findMany.mockResolvedValue([{
      id: 'trial-one',
      userId: 'user-one',
      amount: 9.99,
      durationMonths: 1,
      stripeCustomerId: 'cus_one',
      stripePaymentMethodId: 'pm_one',
    }]);
    mockPrisma.userLicense.findFirst.mockResolvedValue({ id: 'license-app-store' });

    await processDueTrialCharges();

    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptionPayment.update).toHaveBeenCalledWith({
      where: { id: 'trial-one' },
      data: { status: 'CANCELLED' },
    });
  });

  it('still charges a due Stripe trial when there is no App Store subscription', async () => {
    mockPrisma.subscriptionPayment.findMany.mockResolvedValue([{
      id: 'trial-two',
      userId: 'user-two',
      amount: 9.99,
      durationMonths: 1,
      stripeCustomerId: 'cus_two',
      stripePaymentMethodId: 'pm_two',
    }]);
    mockPrisma.userLicense.findFirst.mockResolvedValue(null);
    mockStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_two', status: 'succeeded' });
    mockPrisma.$transaction.mockResolvedValue([]);

    await processDueTrialCharges();

    expect(mockStripe.paymentIntents.create).toHaveBeenCalledTimes(1);
  });
});
