export {};

const mockPrisma: any = {
  challenge: { findMany: jest.fn(), count: jest.fn() },
  userChallenge: { findMany: jest.fn() },
  couponCode: { findUnique: jest.fn(), update: jest.fn() },
  couponUsage: { findUnique: jest.fn(), create: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const mockAuthenticate = jest.fn((_req, _res, next) => next());
jest.mock('../src/middleware/authenticate', () => ({ __esModule: true, default: mockAuthenticate }));

const { isChallengeVisible, visibleChallengeWhere } =
  require('../src/services/challengeTimeline') as typeof import('../src/services/challengeTimeline');
const { getAllChallenges } =
  require('../src/controllers/challengeController') as typeof import('../src/controllers/challengeController');
const { applyDiscount, findUsableCoupon, recordCouponUsage } =
  require('../src/services/couponService') as typeof import('../src/services/couponService');
const paymentRouter = require('../src/routes/paymentRoutes').default;

const createResponse = () => {
  const response: any = { statusCode: 200, body: null };
  response.status = jest.fn((code: number) => { response.statusCode = code; return response; });
  response.json = jest.fn((body: any) => { response.body = body; return response; });
  return response;
};

describe('challenge visibility', () => {
  it('hides drafts, inactive challenges and unapproved submissions from users', () => {
    expect(isChallengeVisible({ approvalStatus: 'APPROVED', status: 'ACTIVE' })).toBe(true);
    expect(isChallengeVisible({ approvalStatus: 'APPROVED', status: null })).toBe(true);
    expect(isChallengeVisible({ approvalStatus: 'APPROVED', status: 'DRAFT' })).toBe(false);
    expect(isChallengeVisible({ approvalStatus: 'APPROVED', status: 'INACTIVE' })).toBe(false);
    expect(isChallengeVisible({ approvalStatus: 'PENDING', status: 'ACTIVE' })).toBe(false);
  });

  it('applies the rule to the public list without dropping the search filter', async () => {
    mockPrisma.challenge.findMany.mockResolvedValue([]);
    mockPrisma.challenge.count.mockResolvedValue(0);

    await getAllChallenges({ query: { search: 'run' }, headers: {} } as any, createResponse());

    const { where } = mockPrisma.challenge.findMany.mock.calls[0][0];
    expect(where.AND).toEqual([visibleChallengeWhere]);
    expect(where.OR).toHaveLength(2); // name/description search
  });
});

describe('couponService', () => {
  const coupon = { id: 'c1', code: 'SAVE20', discountPercent: 20, isActive: true, expiresAt: null, maxUses: 10, currentUses: 0 };

  it('discounts on the server and rounds to cents', () => {
    expect(applyDiscount(9.99, 20)).toBe(7.99);
    expect(applyDiscount(60, 150)).toBe(0);
  });

  it('rejects inactive, expired, exhausted and already-used coupons', async () => {
    mockPrisma.couponUsage.findUnique.mockResolvedValue(null);

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce(null);
    await expect(findUsableCoupon(mockPrisma, 'nope', 'u1')).rejects.toMatchObject({ statusCode: 404 });

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce({ ...coupon, isActive: false });
    await expect(findUsableCoupon(mockPrisma, 'save20', 'u1')).rejects.toMatchObject({ statusCode: 400 });

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce({ ...coupon, expiresAt: new Date(Date.now() - 1000) });
    await expect(findUsableCoupon(mockPrisma, 'save20', 'u1')).rejects.toMatchObject({ statusCode: 400 });

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce({ ...coupon, currentUses: 10 });
    await expect(findUsableCoupon(mockPrisma, 'save20', 'u1')).rejects.toMatchObject({ statusCode: 400 });

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce(coupon);
    mockPrisma.couponUsage.findUnique.mockResolvedValueOnce({ id: 'used' });
    await expect(findUsableCoupon(mockPrisma, 'save20', 'u1')).rejects.toMatchObject({ statusCode: 400 });

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce(coupon);
    await expect(findUsableCoupon(mockPrisma, ' save20 ', 'u1')).resolves.toEqual(coupon);
  });

  it('records a coupon use once even if the payment is finalized twice', async () => {
    mockPrisma.couponCode.findUnique.mockResolvedValue(coupon);
    mockPrisma.couponUsage.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'usage-1' });

    await recordCouponUsage(mockPrisma, 'SAVE20', 'u1', 'pay-1');
    await recordCouponUsage(mockPrisma, 'SAVE20', 'u1', 'pay-1');

    expect(mockPrisma.couponUsage.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.couponCode.update).toHaveBeenCalledTimes(1);
  });
});

describe('payment routes', () => {
  it('only offers server-priced checkout; client-priced intents are gone', () => {
    const paths = (paymentRouter.stack as Array<{ route?: { path: string } }>)
      .filter((layer) => layer.route)
      .map((layer) => layer.route!.path);
    expect(paths).toEqual(['/subscriptions', '/subscriptions/confirm', '/publishable-key']);
  });
});
