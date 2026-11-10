export {};

const mockPrisma: any = {
  userExerciseProgress: { findMany: jest.fn() },
  userDailyRoutine: { findMany: jest.fn().mockResolvedValue([]) },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
const { getExerciseActiveDays } =
  require('../src/controllers/progressController') as typeof import('../src/controllers/progressController');

const createResponse = () => {
  const response: any = { statusCode: 200, body: null };
  response.status = jest.fn((code: number) => { response.statusCode = code; return response; });
  response.json = jest.fn((body: any) => { response.body = body; return response; });
  return response;
};

const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET!);
const workout = (completedAt: string) => ({ completedAt: new Date(completedAt), exerciseSchedule: { dayOfWeek: 1, exercise: { name: 'Squats', caloriesBurnEstimate: 50 } } });

describe('exercise active days', () => {
  afterEach(() => jest.useRealTimers());

  it("builds the week and its days in the user's timezone", async () => {
    // Monday 26 Oct 2026, 03:00 in UTC+5 (Sunday 22:00 UTC).
    jest.useFakeTimers().setSystemTime(new Date('2026-10-25T22:00:00Z'));
    // 23:30 local on Sunday the 25th is 18:30 UTC; 00:30 local Monday is 19:30 UTC Sunday.
    mockPrisma.userExerciseProgress.findMany.mockResolvedValue([workout('2026-10-25T18:30:00Z'), workout('2026-10-25T19:30:00Z')]);
    const res = createResponse();

    await getExerciseActiveDays({ headers: { authorization: `Bearer ${token}` }, query: { weekOffset: '0', tzOffset: '-300' } } as any, res);

    const where = mockPrisma.userExerciseProgress.findMany.mock.calls.at(-1)[0].where.completedAt;
    expect(where.gte).toEqual(new Date('2026-10-24T19:00:00.000Z')); // Sunday 00:00 local
    expect(res.body.data.weekStart).toBe('2026-10-25');
    expect(res.body.data.weekEnd).toBe('2026-10-31');
    expect(res.body.data.weekDays.map((d: any) => d.exercisesCompleted)).toEqual([1, 1, 0, 0, 0, 0, 0]);
  });
});
