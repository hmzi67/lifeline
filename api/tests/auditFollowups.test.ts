export {};

const mockPrisma: any = new Proxy({}, {
  get: (target: any, model: string) => {
    if (!(model in target)) {
      target[model] = {
        findFirst: jest.fn(), findMany: jest.fn(async () => []), findUnique: jest.fn(),
        update: jest.fn(), create: jest.fn(), groupBy: jest.fn(),
      };
    }
    return target[model];
  },
});

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { cheatDayEligibility } = require('../src/services/cheatDayEligibility') as typeof import('../src/services/cheatDayEligibility');
const { ageOn, getUserQuestionnaire, updateDateOfBirth } = require('../src/controllers/questionnaireController') as typeof import('../src/controllers/questionnaireController');
const { exportOwnData, updateOwnProfile } = require('../src/controllers/userController') as typeof import('../src/controllers/userController');

const createResponse = () => {
  const response: any = { statusCode: 200, body: null };
  response.status = jest.fn((code: number) => { response.statusCode = code; return response; });
  response.json = jest.fn((body: any) => { response.body = body; return response; });
  return response;
};

describe('cheat day eligibility', () => {
  // Plan started 2026-10-10; every plan day has 3 meals.
  const plan = {
    id: 'ap1',
    startedAt: new Date('2026-10-10T08:00:00Z'),
    diet: { dietPlanDays: Array.from({ length: 30 }, (_, i) => ({ dayNumber: i + 1, _count: { dietPlanMeals: 3 } })) },
  };
  const logged = (days: string[], perDay = 3) => days.map((d) => ({ date: new Date(d), _count: { _all: perDay } }));
  const lastSeven = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'];

  it('is eligible after 7 days in a row with every planned meal logged', async () => {
    mockPrisma.userActiveDietPlan.findFirst.mockResolvedValueOnce(plan);
    mockPrisma.dietMealLog.groupBy.mockResolvedValueOnce(logged(lastSeven));
    expect(await cheatDayEligibility('u1', '2026-10-22')).toMatchObject({ eligible: true, streakDays: 7 });
  });

  it('counts the streak only up to the last day with a missed meal', async () => {
    mockPrisma.userActiveDietPlan.findFirst.mockResolvedValueOnce(plan);
    mockPrisma.dietMealLog.groupBy.mockResolvedValueOnce([
      ...logged(lastSeven.filter((d) => d !== '2026-10-18')),
      ...logged(['2026-10-18'], 2),
    ]);
    expect(await cheatDayEligibility('u1', '2026-10-22')).toMatchObject({ eligible: false, streakDays: 3 });
  });

  it('is not eligible without an active plan', async () => {
    mockPrisma.userActiveDietPlan.findFirst.mockResolvedValueOnce(null);
    expect(await cheatDayEligibility('u1', '2026-10-22')).toMatchObject({ eligible: false, hasActivePlan: false });
  });
});

describe('age rule', () => {
  it('counts birthdays correctly', () => {
    expect(ageOn(new Date('2008-10-23'), new Date('2026-10-23'))).toBe(18);
    expect(ageOn(new Date('2008-10-24'), new Date('2026-10-23'))).toBe(17);
  });

  it('rejects a date of birth outside 18-75 with a readable message', async () => {
    const tooYoung = new Date();
    tooYoung.setUTCFullYear(tooYoung.getUTCFullYear() - 15);
    const res = createResponse();
    await updateDateOfBirth({ user: { id: 'u1' }, body: { dateOfBirth: tooYoung.toISOString() } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Age must be between 18 and 75 years');
  });
});

describe('questionnaire for a new user', () => {
  it('returns 200 with an empty questionnaire instead of a 404', async () => {
    mockPrisma.questionnaire.findFirst.mockResolvedValueOnce(null);
    const res = createResponse();
    await getUserQuestionnaire({ user: { id: 'u1' } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: { questionnaire: null } });
  });
});

describe('display name', () => {
  it('can be changed on the profile without touching the unique username', async () => {
    mockPrisma.user.update.mockImplementationOnce(async ({ data }: any) => ({ id: 'u1', ...data }));
    const res = createResponse();
    await updateOwnProfile({ params: { id: 'u1' }, user: { id: 'u1' }, body: { displayName: 'Elsa John' } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.user.update.mock.calls.at(-1)[0].data).toEqual({ displayName: 'Elsa John' });
  });
});

describe('data export', () => {
  it("returns only the caller's own data, without secrets", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', email: 'a@example.test' });
    const res = createResponse();
    await exportOwnData({ user: { id: 'u1' } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.profile).toEqual({ id: 'u1', email: 'a@example.test' });
    const select = mockPrisma.user.findUnique.mock.calls.at(-1)[0].select;
    expect(select.password).toBeUndefined();
    expect(select.otp).toBeUndefined();
    expect(mockPrisma.foodLog.findMany.mock.calls.at(-1)[0].where).toEqual({ userId: 'u1' });
  });
});
