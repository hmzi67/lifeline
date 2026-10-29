export {};

const mockPrisma = {
  userLicense: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  freeWeekClaim: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { getSubscriptionStatus } = require('../src/controllers/subscriptionController') as typeof import('../src/controllers/subscriptionController');
const { startFreeWeekAccess } = require('../src/controllers/subscriptionController') as typeof import('../src/controllers/subscriptionController');
const { default: requireActiveLicense } = require('../src/middleware/requireActiveLicense') as typeof import('../src/middleware/requireActiveLicense');

type MockResponse = {
  statusCode: number;
  body: any;
  status: jest.Mock;
  json: jest.Mock;
};

const createResponse = (): MockResponse => {
  const response = { statusCode: 0, body: null } as MockResponse;
  response.status = jest.fn((statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  });
  response.json = jest.fn((body: any) => {
    response.body = body;
    return response;
  });
  return response;
};

const authenticatedRequest = () => ({
  user: { id: 'user-one', email: 'user@example.com', role: '' },
});

describe('subscription access', () => {
  beforeEach(() => {
    mockPrisma.userLicense.findFirst.mockReset();
    mockPrisma.user.findUnique.mockReset().mockResolvedValue({ trialUsedAt: null });
    mockPrisma.freeWeekClaim.findUnique.mockReset().mockResolvedValue(null);
    mockPrisma.freeWeekClaim.upsert.mockReset();
  });

  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  it('returns the authenticated user active entitlement without trusting payment status', async () => {
    const expiresAt = new Date('2026-10-01T00:00:00.000Z');
    mockPrisma.userLicense.findFirst.mockResolvedValue({
      expiresAt,
      payment: {
        cancelAtPeriodEnd: true,
        method: 'app_store',
        pricingPlanId: 'plan-one',
        storeProductId: 'com.irtaza.lifeline.vip.monthly',
      },
    });
    const response = createResponse();

    await getSubscriptionStatus(authenticatedRequest() as any, response as any);

    expect(mockPrisma.userLicense.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: 'user-one',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: expect.any(Date) } },
        ],
      },
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual({
      active: true,
      expiresAt: expiresAt.toISOString(),
      cancelAtPeriodEnd: true,
      pricingPlanId: 'plan-one',
      productId: 'com.irtaza.lifeline.vip.monthly',
      source: 'app_store',
      trialAvailable: true,
      freeWeek: { active: false, startedAt: null, endsAt: null },
      hasAccess: true,
      serverTime: expect.any(String),
    });
  });

  it('returns an inactive canonical state when no active license exists', async () => {
    mockPrisma.userLicense.findFirst.mockResolvedValue(null);
    const response = createResponse();

    await getSubscriptionStatus(authenticatedRequest() as any, response as any);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual({
      active: false,
      expiresAt: null,
      cancelAtPeriodEnd: false,
      pricingPlanId: null,
      productId: null,
      source: null,
      trialAvailable: true,
      freeWeek: { active: false, startedAt: null, endsAt: null },
      hasAccess: false,
      serverTime: expect.any(String),
    });
  });

  it('reports the free trial as used once the account has claimed it', async () => {
    mockPrisma.userLicense.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ trialUsedAt: new Date('2026-09-01T00:00:00.000Z') });
    const response = createResponse();

    await getSubscriptionStatus(authenticatedRequest() as any, response as any);

    expect(response.body.data.trialAvailable).toBe(false);
  });

  it('blocks protected content when the backend has no active license', async () => {
    mockPrisma.userLicense.findFirst.mockResolvedValue(null);
    const response = createResponse();
    const next = jest.fn();

    await requireActiveLicense(authenticatedRequest() as any, response as any, next);

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe('ACTIVE_SUBSCRIPTION_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('allows protected content when the backend has an active license', async () => {
    mockPrisma.userLicense.findFirst.mockResolvedValue({
      expiresAt: null,
      payment: null,
    });
    const response = createResponse();
    const next = jest.fn();

    await requireActiveLicense(authenticatedRequest() as any, response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('allows administrators to preview protected content without a consumer license', async () => {
    const response = createResponse();
    const next = jest.fn();

    await requireActiveLicense({
      user: { id: 'admin-one', email: 'admin@example.com', role: 'admin' },
    } as any, response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockPrisma.userLicense.findFirst).not.toHaveBeenCalled();
  });

  it('gives full access during the free week, timed by the server clock', async () => {
    mockPrisma.userLicense.findFirst.mockResolvedValue(null);
    mockPrisma.freeWeekClaim.findUnique.mockResolvedValue({ startedAt: daysAgo(3) });
    const response = createResponse();
    const next = jest.fn();

    await getSubscriptionStatus(authenticatedRequest() as any, response as any);
    await requireActiveLicense(authenticatedRequest() as any, createResponse() as any, next);

    expect(response.body.data.freeWeek.active).toBe(true);
    expect(response.body.data.hasAccess).toBe(true);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('locks the app once seven days have passed since the free week started', async () => {
    mockPrisma.userLicense.findFirst.mockResolvedValue(null);
    mockPrisma.freeWeekClaim.findUnique.mockResolvedValue({ startedAt: daysAgo(8) });
    const status = createResponse();
    const blocked = createResponse();
    const next = jest.fn();

    await getSubscriptionStatus(authenticatedRequest() as any, status as any);
    await requireActiveLicense(authenticatedRequest() as any, blocked as any, next);

    expect(status.body.data.freeWeek.active).toBe(false);
    expect(status.body.data.hasAccess).toBe(false);
    expect(blocked.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps the first free week start when "Continue for free" is pressed again', async () => {
    const startedAt = daysAgo(8);
    mockPrisma.freeWeekClaim.upsert.mockResolvedValue({ startedAt });
    const response = createResponse();

    await startFreeWeekAccess(authenticatedRequest() as any, response as any);

    // An existing claim is never overwritten, so the week cannot be restarted.
    expect(mockPrisma.freeWeekClaim.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
    expect(response.body.data.freeWeek).toEqual(expect.objectContaining({ active: false, startedAt: startedAt.toISOString() }));
  });

  it('ties the free week to the email, not the account, so re-signing up does not reset it', async () => {
    mockPrisma.freeWeekClaim.upsert.mockResolvedValue({ startedAt: new Date() });

    await startFreeWeekAccess({ user: { id: 'a', email: ' User@Example.com ', role: '' } } as any, createResponse() as any);
    await startFreeWeekAccess({ user: { id: 'b', email: 'user@example.com', role: '' } } as any, createResponse() as any);

    const [first, second] = mockPrisma.freeWeekClaim.upsert.mock.calls.map((call) => call[0].where.emailHash);
    expect(first).toBe(second);
  });
});
