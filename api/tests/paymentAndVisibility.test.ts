export {};

const mockPrisma: any = {
  challenge: { findMany: jest.fn(), count: jest.fn() },
  userChallenge: { findMany: jest.fn() },
  couponCode: { findUnique: jest.fn(), updateMany: jest.fn(), fields: { maxUses: 'maxUses-ref' } },
  couponUsage: { findUnique: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() },
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
    mockPrisma.couponUsage.createMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    mockPrisma.couponCode.updateMany.mockResolvedValue({ count: 1 });

    await expect(recordCouponUsage(mockPrisma, 'SAVE20', 'u1', 'pay-1')).resolves.toBe(true);
    await expect(recordCouponUsage(mockPrisma, 'SAVE20', 'u1', 'pay-1')).resolves.toBe(false);

    expect(mockPrisma.couponUsage.createMany.mock.calls[0][0]).toMatchObject({ skipDuplicates: true });
    expect(mockPrisma.couponCode.updateMany).toHaveBeenCalledTimes(1);
    // The increment is conditional on the row itself, not on a value read earlier.
    expect(mockPrisma.couponCode.updateMany.mock.calls[0][0].where).toEqual({
      id: coupon.id, currentUses: { lt: 'maxUses-ref' },
    });
  });
});

describe('concurrent coupon redemption', () => {
  // A stand-in for Postgres: the usage insert honours the unique key and the
  // counter only moves when the row still has uses left, both checked at write time.
  const fakeDb = (maxUses: number) => {
    const row = { id: 'c-1', code: 'LAST1', isActive: true, expiresAt: null, maxUses, currentUses: 0 };
    const usages: Array<{ couponId: string; userId: string; paymentId: string }> = [];
    const tick = () => new Promise((resolve) => setImmediate(resolve));
    const db: any = {
      couponCode: {
        fields: { maxUses: 'maxUses-ref' },
        findUnique: async () => { await tick(); return { ...row }; },
        updateMany: async ({ where }: any) => {
          await tick();
          if (where.id !== row.id || where.currentUses.lt !== 'maxUses-ref' || row.currentUses >= row.maxUses) return { count: 0 };
          row.currentUses += 1;
          return { count: 1 };
        },
      },
      couponUsage: {
        createMany: async ({ data: [usage] }: any) => {
          await tick();
          if (usages.some((u) => u.couponId === usage.couponId && u.userId === usage.userId)) return { count: 0 };
          usages.push(usage);
          return { count: 1 };
        },
        deleteMany: async ({ where }: any) => {
          const before = usages.length;
          for (let i = usages.length - 1; i >= 0; i--) {
            if (usages[i].userId === where.userId && usages[i].paymentId === where.paymentId) usages.splice(i, 1);
          }
          return { count: before - usages.length };
        },
      },
    };
    return { db, row, usages };
  };

  it('lets only one of several racing payments take the last use', async () => {
    const { db, row, usages } = fakeDb(1);
    const results = await Promise.all(
      ['u1', 'u2', 'u3', 'u4'].map((userId) => recordCouponUsage(db, 'LAST1', userId, `pay-${userId}`)),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(row.currentUses).toBe(1);
    expect(usages).toHaveLength(1);
  });

  it('counts the same user once when confirm and webhook race', async () => {
    const { db, row, usages } = fakeDb(5);
    await Promise.all([
      recordCouponUsage(db, 'LAST1', 'u1', 'pay-1'),
      recordCouponUsage(db, 'LAST1', 'u1', 'pay-1'),
    ]);

    expect(row.currentUses).toBe(1);
    expect(usages).toHaveLength(1);
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
