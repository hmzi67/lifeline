export {};

const mockPrisma: any = {
  foodLog: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  dietMealLog: { findMany: jest.fn() },
  cheatDay: { findMany: jest.fn().mockResolvedValue([]) },
  userActiveDietPlan: { findFirst: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
const { createFoodLog, deleteFoodLog } =
  require('../src/controllers/foodLogController') as typeof import('../src/controllers/foodLogController');
const { getCaloriesIntake } =
  require('../src/controllers/progressController') as typeof import('../src/controllers/progressController');

const createResponse = () => {
  const response: any = { statusCode: 200, body: null };
  response.status = jest.fn((code: number) => { response.statusCode = code; return response; });
  response.json = jest.fn((body: any) => { response.body = body; return response; });
  return response;
};

const asUser = (extra: Record<string, unknown>) => ({ user: { id: 'user-1' }, ...extra }) as any;
const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET!);

describe('food log', () => {
  it('stores a scanned food for the caller on the local day sent by the app', async () => {
    mockPrisma.foodLog.create.mockImplementation(async ({ data }: any) => ({ id: 'f1', ...data }));
    const res = createResponse();

    await createFoodLog(asUser({ body: { date: '2026-10-22', name: 'Granola', calories: 210, protein: 5, carbs: 30, fat: 8, source: 'barcode', barcode: '123', userId: 'someone-else' } }), res);

    expect(res.statusCode).toBe(201);
    expect(mockPrisma.foodLog.create.mock.calls[0][0].data).toMatchObject({
      userId: 'user-1', date: new Date('2026-10-22'), calories: 210, source: 'barcode',
    });
  });

  it('rejects entries without a name or a valid day', async () => {
    const res = createResponse();
    await createFoodLog(asUser({ body: { date: 'today', name: '', source: 'manual' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it("only deletes the caller's own entries", async () => {
    mockPrisma.foodLog.deleteMany.mockResolvedValue({ count: 0 });
    const res = createResponse();
    await deleteFoodLog(asUser({ params: { id: 'theirs' } }), res);
    expect(mockPrisma.foodLog.deleteMany.mock.calls[0][0].where).toEqual({ id: 'theirs', userId: 'user-1' });
    expect(res.statusCode).toBe(404);
  });
});

describe('calorie intake', () => {
  const request = { headers: { authorization: `Bearer ${token}` }, query: { date: '2026-10-22' } } as any;

  it('counts checked-off plan meals and logged food (it used to always be 0)', async () => {
    mockPrisma.dietMealLog.findMany.mockResolvedValue([{ calories: 400, mealId: 'm1' }]);
    mockPrisma.foodLog.findMany.mockResolvedValue([{ calories: 210, protein: 5, carbs: 30, fat: 8 }]);
    mockPrisma.userActiveDietPlan.findFirst.mockResolvedValue({
      id: 'ap1', dietId: 'd1', startedAt: new Date('2026-10-20'), currentDay: 3,
      diet: { name: 'Keto', calories: 1800, dietPlanDays: [] },
    });
    const res = createResponse();

    await getCaloriesIntake(request, res);

    expect(res.body.data).toMatchObject({ totalCalories: 610, foodLogCalories: 210, loggedMealIds: ['m1'], planCalorieTarget: 1800 });
    expect(res.body.data.macros).toEqual({ protein: 5, carbs: 30, fat: 8 });
  });

  it('still counts logged food without an active diet plan', async () => {
    mockPrisma.dietMealLog.findMany.mockResolvedValue([]);
    mockPrisma.foodLog.findMany.mockResolvedValue([{ calories: 350, protein: null, carbs: null, fat: null }]);
    mockPrisma.userActiveDietPlan.findFirst.mockResolvedValue(null);
    const res = createResponse();

    await getCaloriesIntake(request, res);

    expect(res.body.data).toMatchObject({ totalCalories: 350, activePlan: null });
  });

  it("counts cheat meals logged during the user's local day", async () => {
    mockPrisma.dietMealLog.findMany.mockResolvedValue([]);
    mockPrisma.foodLog.findMany.mockResolvedValue([]);
    mockPrisma.cheatDay.findMany.mockResolvedValue([{ calories: 820, protein: 34, carbs: 92, fat: 36 }]);
    mockPrisma.userActiveDietPlan.findFirst.mockResolvedValue(null);
    const res = createResponse();

    // UTC+5: getTimezoneOffset() is -300, so the local day starts at 19:00 UTC the day before.
    await getCaloriesIntake({ ...request, query: { date: '2026-10-22', tzOffset: '-300' } }, res);

    expect(mockPrisma.cheatDay.findMany.mock.calls.at(-1)[0].where).toEqual({
      userId: 'user-1',
      loggedAt: { gte: new Date('2026-10-21T19:00:00.000Z'), lt: new Date('2026-10-22T19:00:00.000Z') },
    });
    expect(res.body.data).toMatchObject({ totalCalories: 820, cheatMealCalories: 820 });
    expect(res.body.data.macros).toEqual({ protein: 34, carbs: 92, fat: 36 });
  });

  it('totals what was eaten across a range, not what the plan prescribes', async () => {
    mockPrisma.dietMealLog.findMany.mockResolvedValue([
      { calories: 400, mealId: 'm1', date: new Date('2026-10-20') },
      { calories: 600, mealId: 'm2', date: new Date('2026-10-22') },
    ]);
    mockPrisma.foodLog.findMany.mockResolvedValue([{ calories: 200, protein: 10, carbs: 20, fat: 5, date: new Date('2026-10-21') }]);
    mockPrisma.cheatDay.findMany.mockResolvedValue([{ calories: 800, protein: 30, carbs: 90, fat: 35, loggedAt: new Date('2026-10-21T20:00:00Z') }]);
    mockPrisma.userActiveDietPlan.findFirst.mockResolvedValue({
      id: 'ap1', dietId: 'd1', startedAt: new Date('2026-10-20'), currentDay: 3,
      // The plan prescribes 1800 a day; that must not be reported as eaten.
      diet: { name: 'Keto', calories: 1800, dietPlanDays: [{ dayNumber: 1, dietPlanMeals: [{ name: 'x', calories: 1800, portionSize: null, image: null, mealType: { name: 'Lunch' } }] }] },
    });
    const res = createResponse();

    await getCaloriesIntake({ ...request, query: { startDate: '2026-10-20', endDate: '2026-10-22', tzOffset: '-300' } }, res);

    const [mealWhere] = mockPrisma.dietMealLog.findMany.mock.calls.at(-1);
    expect(mealWhere.where.date).toEqual({ gte: new Date('2026-10-20'), lte: new Date('2026-10-22') });
    expect(res.body.data.totalCalories).toBe(2000);
    expect(res.body.data.macros).toEqual({ protein: 40, carbs: 110, fat: 40 });
    // 20:00 UTC on the 21st is 01:00 on the 22nd in UTC+5, so the cheat meal counts on the 22nd.
    expect(res.body.data.dailyBreakdown.map((d: any) => d.calories)).toEqual([400, 200, 1400]);
  });
});
