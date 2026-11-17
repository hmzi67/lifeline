export {};

const mockPrisma: any = {
  challenge: { findMany: jest.fn(), count: jest.fn() },
  userChallenge: { findMany: jest.fn() },
  couponCode: { findUnique: jest.fn() },
  couponUsage: { count: jest.fn() },
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
  const coupon = { id: 'c1', code: 'SAVE20', discountPercent: 20, isActive: true, expiresAt: null, maxUses: 10, maxUsesPerUser: 1, currentUses: 0 };

  beforeEach(() => jest.resetAllMocks());

  it('discounts on the server and rounds to cents', () => {
    expect(applyDiscount(9.99, 20)).toBe(7.99);
    expect(applyDiscount(20, 50)).toBe(10);
    expect(applyDiscount(60, 150)).toBe(0);
  });

  it('rejects unknown, inactive, expired and used-up coupons', async () => {
    mockPrisma.couponUsage.count.mockResolvedValue(0);

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce(null);
    await expect(findUsableCoupon(mockPrisma, 'nope', 'u1')).rejects.toMatchObject({ statusCode: 404 });

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce({ ...coupon, isActive: false });
    await expect(findUsableCoupon(mockPrisma, 'save20', 'u1')).rejects.toMatchObject({ message: 'This coupon is no longer active' });

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce({ ...coupon, expiresAt: new Date(Date.now() - 1000) });
    await expect(findUsableCoupon(mockPrisma, 'save20', 'u1')).rejects.toMatchObject({ message: 'This coupon has expired' });

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce({ ...coupon, currentUses: 10 });
    await expect(findUsableCoupon(mockPrisma, 'save20', 'u1')).rejects.toMatchObject({ message: 'This coupon has reached its usage limit' });

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce(coupon);
    await expect(findUsableCoupon(mockPrisma, ' save20 ', 'u1')).resolves.toEqual(coupon);
  });

  it('holds each user to the coupon\'s uses-per-user setting', async () => {
    mockPrisma.couponCode.findUnique.mockResolvedValueOnce(coupon);
    mockPrisma.couponUsage.count.mockResolvedValueOnce(1);
    await expect(findUsableCoupon(mockPrisma, 'save20', 'u1')).rejects.toMatchObject({ message: 'You have already used this coupon code' });

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce({ ...coupon, maxUsesPerUser: 3 });
    mockPrisma.couponUsage.count.mockResolvedValueOnce(2);
    await expect(findUsableCoupon(mockPrisma, 'save20', 'u1')).resolves.toMatchObject({ code: 'SAVE20' });

    mockPrisma.couponCode.findUnique.mockResolvedValueOnce({ ...coupon, maxUsesPerUser: 3 });
    mockPrisma.couponUsage.count.mockResolvedValueOnce(3);
    await expect(findUsableCoupon(mockPrisma, 'save20', 'u1')).rejects.toMatchObject({ message: 'You have already used this coupon 3 times' });
    expect(mockPrisma.couponUsage.count).toHaveBeenLastCalledWith({ where: { couponId: 'c1', userId: 'u1' } });
  });
});

describe('recording coupon uses', () => {
  // A stand-in for Postgres. `SELECT ... FOR UPDATE` takes the coupon row's lock, held
  // until that transaction ends; the (couponId, paymentId) key rejects a second row.
  const fakeDb = (maxUses: number, maxUsesPerUser = 1) => {
    const row = { id: 'c-1', code: 'DOC10', isActive: true, expiresAt: null, maxUses, maxUsesPerUser, currentUses: 0 };
    const usages: { couponId: string; userId: string; paymentId: string }[] = [];
    const tick = () => new Promise((resolve) => setImmediate(resolve));
    let lock: Promise<void> = Promise.resolve();

    /** Runs `fn` like prisma.$transaction: the row lock it takes is released when it returns. */
    const transaction = async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
      let release = () => {};
      let holding = false;
      const tx: any = {
        $queryRaw: async () => {
          const previous = lock;
          lock = new Promise<void>((resolve) => { release = resolve; });
          holding = true;
          await previous;
        },
        couponCode: {
          findUnique: async () => { await tick(); return { ...row }; },
          update: async () => { await tick(); row.currentUses += 1; return { ...row }; },
        },
        couponUsage: {
          findUnique: async ({ where }: any) => {
            await tick();
            const key = where.couponId_paymentId;
            return usages.find((u) => u.couponId === key.couponId && u.paymentId === key.paymentId) ?? null;
          },
          count: async ({ where }: any) => { await tick(); return usages.filter((u) => u.couponId === where.couponId && u.userId === where.userId).length; },
          create: async ({ data }: any) => {
            await tick();
            if (usages.some((u) => u.couponId === data.couponId && u.paymentId === data.paymentId)) throw new Error('unique violation');
            usages.push(data);
            return data;
          },
        },
      };
      try {
        return await fn(tx);
      } finally {
        if (holding) release();
      }
    };
    return { transaction, row, usages };
  };

  const redeem = (db: ReturnType<typeof fakeDb>, userId: string, paymentId: string) =>
    db.transaction((tx) => recordCouponUsage(tx, 'DOC10', userId, paymentId));

  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('lets only one of several racing payments take the last use', async () => {
    const db = fakeDb(1);
    const results = await Promise.all(['u1', 'u2', 'u3', 'u4'].map((u) => redeem(db, u, `pay-${u}`)));

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(db.row.currentUses).toBe(1);
    expect(db.usages).toHaveLength(1);
  });

  it('counts a payment once when the app\'s confirm and Stripe\'s webhook race', async () => {
    const db = fakeDb(10);
    await Promise.all([redeem(db, 'u1', 'pay-1'), redeem(db, 'u1', 'pay-1')]);

    expect(db.row.currentUses).toBe(1);
    expect(db.usages).toHaveLength(1);
  });

  it('a doctor\'s 10 uses run out after 10 different patients', async () => {
    const db = fakeDb(10);
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => redeem(db, `patient-${i}`, `pay-${i}`)));

    expect(results.filter(Boolean)).toHaveLength(10);
    expect(db.row.currentUses).toBe(10);
  });

  it('lets one user use a coupon as many times as it allows, even when paying twice at once', async () => {
    const once = fakeDb(10, 1);
    await Promise.all([redeem(once, 'u1', 'pay-1'), redeem(once, 'u1', 'pay-2')]);
    expect(once.row.currentUses).toBe(1);

    const twice = fakeDb(10, 2);
    const results = await Promise.all([1, 2, 3].map((n) => redeem(twice, 'u1', `pay-${n}`)));
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(twice.row.currentUses).toBe(2);
  });
});

describe('payment routes', () => {
  it('only offers server-priced checkout; client-priced intents are gone', () => {
    const paths = (paymentRouter.stack as { route?: { path: string } }[])
      .filter((layer) => layer.route)
      .map((layer) => layer.route!.path);
    expect(paths).toEqual(['/subscriptions', '/subscriptions/confirm', '/publishable-key']);
  });
});
