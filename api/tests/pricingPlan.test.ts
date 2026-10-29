export {};

const mockPrisma = {
  pricingPlan: {
    create: jest.fn(async ({ data }: any) => ({ id: 'plan-new', ...data })),
    update: jest.fn(async ({ data }: any) => ({ id: 'plan-1', ...data })),
    findUnique: jest.fn(),
  },
  subscriptionPayment: { count: jest.fn(async () => 0) },
};

jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return { ...actual, PrismaClient: jest.fn(() => mockPrisma) };
});

const { Prisma } = jest.requireActual('@prisma/client');
const { createPricingPlan, updatePricingPlan } =
  require('../src/controllers/pricingPlanController') as typeof import('../src/controllers/pricingPlanController');

const response = () => {
  const res: any = { statusCode: 200, body: null };
  res.status = jest.fn((code: number) => { res.statusCode = code; return res; });
  res.json = jest.fn((body: unknown) => { res.body = body; return res; });
  return res;
};

const validPlan = { name: 'VIP Monthly', price: 9.99, durationMonths: 1 };
const existingPlan = {
  id: 'plan-1', price: 9.99, originalPrice: null, appleProductId: 'com.lifeline.vip.monthly',
};

describe('pricing plan creation and editing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.pricingPlan.findUnique.mockResolvedValue(existingPlan);
  });

  it('creates a valid plan', async () => {
    const res = response();
    await createPricingPlan({ body: validPlan } as any, res);
    expect(res.statusCode).toBe(201);
  });

  it('rejects a price below the $0.50 card minimum', async () => {
    const res = response();
    await createPricingPlan({ body: { ...validPlan, price: 0.3 } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.pricingPlan.create).not.toHaveBeenCalled();
  });

  it('rejects an original price that is not above the price', async () => {
    const res = response();
    await createPricingPlan({ body: { ...validPlan, originalPrice: 5 } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/original price/i);
  });

  it('checks the original price against the stored price on a partial update', async () => {
    const res = response();
    await updatePricingPlan({ params: { id: 'plan-1' }, body: { originalPrice: 8 } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.pricingPlan.update).not.toHaveBeenCalled();
  });

  it('reports a duplicate App Store product ID as a conflict', async () => {
    mockPrisma.pricingPlan.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002', clientVersion: 'test', meta: { target: ['apple_product_id'] },
    }));
    const res = response();
    await createPricingPlan({ body: { ...validPlan, appleProductId: 'com.lifeline.vip.monthly' } } as any, res);
    expect(res.statusCode).toBe(409);
  });

  it('refuses to change the App Store product ID once App Store subscribers exist', async () => {
    mockPrisma.subscriptionPayment.count.mockResolvedValueOnce(3);
    const res = response();
    await updatePricingPlan({ params: { id: 'plan-1' }, body: { appleProductId: 'com.lifeline.vip.other' } } as any, res);
    expect(res.statusCode).toBe(409);
    expect(mockPrisma.pricingPlan.update).not.toHaveBeenCalled();
  });

  it('allows other edits to a plan with App Store subscribers', async () => {
    mockPrisma.subscriptionPayment.count.mockResolvedValue(3);
    const res = response();
    await updatePricingPlan({
      params: { id: 'plan-1' },
      body: { name: 'VIP Monthly (new)', appleProductId: 'com.lifeline.vip.monthly' },
    } as any, res);
    expect(res.statusCode).toBe(200);
  });
});
