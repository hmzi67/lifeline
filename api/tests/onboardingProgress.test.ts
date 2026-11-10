export {};

const mockPrisma = {
  onboardingProgress: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  userLicense: {
    findFirst: jest.fn(),
  },
  freeWeekClaim: {
    findUnique: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const {
  getOnboardingProgress,
  updateOnboardingProgress,
} = require('../src/controllers/onboardingProgressController') as typeof import('../src/controllers/onboardingProgressController');

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

const authenticatedRequest = (body: Record<string, unknown> = {}) => ({
  body,
  user: { id: 'user-one', email: 'user@example.com', role: '' },
});

describe('backend onboarding progress', () => {
  beforeEach(() => {
    mockPrisma.onboardingProgress.findUnique.mockReset();
    mockPrisma.onboardingProgress.upsert.mockReset();
    mockPrisma.userLicense.findFirst.mockReset();
    mockPrisma.userLicense.findFirst.mockResolvedValue({ id: 'license-one' });
    mockPrisma.freeWeekClaim.findUnique.mockReset().mockResolvedValue(null);
  });

  it('returns a default state without creating local or database state', async () => {
    mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
    const response = createResponse();

    await getOnboardingProgress(authenticatedRequest() as any, response as any);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.onboardingProgress).toEqual({
      lastRoute: null,
      pricingPlanId: null,
      isComplete: false,
      visitedGenderInfo: false,
      completedAt: null,
    });
    expect(mockPrisma.onboardingProgress.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-one' },
    }));
  });

  it('persists a canonical resume route for only the authenticated user', async () => {
    mockPrisma.onboardingProgress.upsert.mockResolvedValue({
      lastRoute: '/(auth)/currentWeight',
      pricingPlanId: null,
      isComplete: false,
      visitedGenderInfo: true,
      completedAt: null,
    });
    const response = createResponse();

    await updateOnboardingProgress(
      authenticatedRequest({ lastRoute: '/(auth)/currentWeight' }) as any,
      response as any,
    );

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.onboardingProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-one' },
      create: expect.objectContaining({
        userId: 'user-one',
        lastRoute: '/(auth)/currentWeight',
        isComplete: false,
      }),
      update: expect.objectContaining({
        lastRoute: '/(auth)/currentWeight',
        isComplete: false,
      }),
    }));
  });

  it('stores the selected plan with the payment-method resume route', async () => {
    mockPrisma.onboardingProgress.upsert.mockResolvedValue({
      lastRoute: '/(auth)/PaymentMethod',
      pricingPlanId: 'plan-one',
      isComplete: false,
      visitedGenderInfo: true,
      completedAt: null,
    });
    const response = createResponse();

    await updateOnboardingProgress(
      authenticatedRequest({
        lastRoute: '/(auth)/PaymentMethod',
        pricingPlanId: 'plan-one',
      }) as any,
      response as any,
    );

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.onboardingProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        lastRoute: '/(auth)/PaymentMethod',
        pricingPlanId: 'plan-one',
      }),
    }));
  });

  it('clears the resume route and records completion atomically', async () => {
    mockPrisma.onboardingProgress.upsert.mockImplementation(async ({ create }: any) => ({
      ...create,
      completedAt: create.completedAt,
    }));
    const response = createResponse();

    await updateOnboardingProgress(
      authenticatedRequest({ isComplete: true }) as any,
      response as any,
    );

    const call = mockPrisma.onboardingProgress.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId: 'user-one' });
    expect(call.create).toEqual(expect.objectContaining({
      userId: 'user-one',
      isComplete: true,
      lastRoute: null,
      pricingPlanId: null,
      completedAt: expect.any(Date),
    }));
    expect(response.body.data.onboardingProgress.isComplete).toBe(true);
    expect(response.body.data.onboardingProgress.lastRoute).toBeNull();
  });

  it('rejects completion until the backend has confirmed an active license', async () => {
    mockPrisma.userLicense.findFirst.mockResolvedValue(null);
    const response = createResponse();

    await updateOnboardingProgress(
      authenticatedRequest({ isComplete: true }) as any,
      response as any,
    );

    expect(response.statusCode).toBe(409);
    expect(mockPrisma.onboardingProgress.upsert).not.toHaveBeenCalled();
  });

  it('allows completion once the user chose "Continue for free"', async () => {
    mockPrisma.userLicense.findFirst.mockResolvedValue(null);
    mockPrisma.freeWeekClaim.findUnique.mockResolvedValue({ startedAt: new Date() });
    mockPrisma.onboardingProgress.upsert.mockImplementation(async ({ create }: any) => ({ ...create, lastRoute: null }));
    const response = createResponse();

    await updateOnboardingProgress(
      authenticatedRequest({ isComplete: true }) as any,
      response as any,
    );

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.onboardingProgress.upsert).toHaveBeenCalled();
  });

  it('rejects arbitrary routes before writing to the database', async () => {
    const response = createResponse();

    await updateOnboardingProgress(
      authenticatedRequest({ lastRoute: '/(tabs)/admin' }) as any,
      response as any,
    );

    expect(response.statusCode).toBe(400);
    expect(mockPrisma.onboardingProgress.upsert).not.toHaveBeenCalled();
  });
});
