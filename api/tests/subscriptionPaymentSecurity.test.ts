export {};

const mockPrisma = {
  subscriptionPayment: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const {
  createSubscriptionPayment,
  getMySubscriptionPayments,
  updateSubscriptionPayment,
} = require('../src/controllers/subscriptionPaymentController') as typeof import('../src/controllers/subscriptionPaymentController');

const createResponse = () => {
  const response: any = { body: null, statusCode: 0 };
  response.status = jest.fn((statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  });
  response.json = jest.fn((body: unknown) => {
    response.body = body;
    return response;
  });
  response.send = jest.fn(() => response);
  return response;
};

describe('subscription payment ownership and provider-controlled fields', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('lists payments only for the authenticated user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-one' });
    mockPrisma.subscriptionPayment.findMany.mockResolvedValue([]);
    mockPrisma.subscriptionPayment.count.mockResolvedValue(0);
    const response = createResponse();

    await getMySubscriptionPayments({
      params: { userId: 'attacker-selected-user' },
      query: {},
      user: { id: 'user-one', email: 'user@example.com', role: '' },
    } as any, response);

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-one' } });
    expect(mockPrisma.subscriptionPayment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-one' },
    }));
    expect(mockPrisma.subscriptionPayment.count).toHaveBeenCalledWith({
      where: { userId: 'user-one' },
    });
  });

  it('rejects caller-provided status when creating a payment record', async () => {
    const response = createResponse();

    await createSubscriptionPayment({
      body: {
        userId: 'user-one',
        planName: 'VIP Monthly',
        amount: 9.99,
        method: 'app_store',
        status: 'COMPLETED',
      },
    } as any, response);

    expect(response.statusCode).toBe(400);
    expect(mockPrisma.subscriptionPayment.create).not.toHaveBeenCalled();
  });

  it('rejects caller-provided status when updating a payment record', async () => {
    const response = createResponse();

    await updateSubscriptionPayment({
      params: { id: 'payment-one' },
      body: { status: 'COMPLETED' },
    } as any, response);

    expect(response.statusCode).toBe(400);
    expect(mockPrisma.subscriptionPayment.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptionPayment.update).not.toHaveBeenCalled();
  });
});
