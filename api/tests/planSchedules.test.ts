export {};

const tx = {
  dietPlanDay: { findMany: jest.fn(), deleteMany: jest.fn(), update: jest.fn(), create: jest.fn() },
  dietPlanMeal: { deleteMany: jest.fn(), update: jest.fn(), create: jest.fn() },
  exercisePlanWeek: { findMany: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
  exercisePlanSchedule: { deleteMany: jest.fn(), update: jest.fn(), create: jest.fn() },
};

const mockPrisma = {
  dietPlan: { findUnique: jest.fn(), create: jest.fn() },
  dietPlanDay: { findMany: jest.fn() },
  mealType: { findMany: jest.fn() },
  exercisePlan: { findUnique: jest.fn() },
  exercise: { findMany: jest.fn() },
  exercisePlanWeek: { findMany: jest.fn() },
  $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));

import { saveDietPlanSchedule } from '../src/controllers/dietPlanScheduleController';
import { saveExercisePlanSchedule } from '../src/controllers/exercisePlanBuilderController';
import { createDietPlan } from '../src/controllers/dietPlanController';

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
const request = (params: Record<string, string>, body: unknown) => ({ params, body, headers: {} }) as any;

// Like the database: only the rows whose ids were asked for.
const rowsIn = (ids: string[]) => ({ where }: any) => Promise.resolve(ids.filter(id => where.id.in.includes(id)).map(id => ({ id })));

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
});

describe('diet plan schedule', () => {
  const meal = (over: Record<string, unknown> = {}) => ({ mealTypeId: 'mt-breakfast', name: 'Oats', calories: 300, ...over });

  beforeEach(() => {
    mockPrisma.dietPlan.findUnique.mockResolvedValue({ id: 'plan-1' });
    mockPrisma.mealType.findMany.mockImplementation(rowsIn(['mt-breakfast', 'mt-lunch']));
    mockPrisma.dietPlanDay.findMany.mockResolvedValue([]);
    tx.dietPlanDay.create.mockImplementation(({ data }: any) => Promise.resolve({ id: `day-${data.dayNumber}`, ...data }));
    tx.dietPlanDay.update.mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data }));
  });

  it('saves each day with its own meals', async () => {
    tx.dietPlanDay.findMany.mockResolvedValue([]);
    const res = mockResponse();

    await saveDietPlanSchedule(request({ id: 'plan-1' }, {
      days: [
        { dayNumber: 1, meals: [meal(), meal({ mealTypeId: 'mt-lunch', name: 'Salad' })] },
        { dayNumber: 2, meals: [meal({ name: 'Eggs' })] },
      ],
    }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(tx.dietPlanDay.create).toHaveBeenCalledTimes(2);
    expect(tx.dietPlanMeal.create).toHaveBeenCalledWith({ data: expect.objectContaining({ dayId: 'day-2', name: 'Eggs' }) });
    expect(tx.dietPlanMeal.create).toHaveBeenCalledTimes(3);
  });

  it('updates a meal sent with its id instead of recreating it', async () => {
    tx.dietPlanDay.findMany.mockResolvedValue([
      { id: 'day-a', dayNumber: 1, dietPlanMeals: [{ id: 'meal-1', name: 'Oats', _count: { dietMealLogs: 4 } }] },
    ]);
    const res = mockResponse();

    await saveDietPlanSchedule(request({ id: 'plan-1' }, { days: [{ dayNumber: 1, meals: [meal({ id: 'meal-1', name: 'Steel-cut oats' })] }] }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(tx.dietPlanMeal.update).toHaveBeenCalledWith({ where: { id: 'meal-1' }, data: expect.objectContaining({ name: 'Steel-cut oats' }) });
    expect(tx.dietPlanMeal.create).not.toHaveBeenCalled();
    expect(tx.dietPlanMeal.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses to remove a meal users have logged', async () => {
    tx.dietPlanDay.findMany.mockResolvedValue([
      { id: 'day-a', dayNumber: 3, dietPlanMeals: [{ id: 'meal-1', name: 'Oats', _count: { dietMealLogs: 2 } }] },
    ]);
    const res = mockResponse();

    await saveDietPlanSchedule(request({ id: 'plan-1' }, { days: [] }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain('"Oats" on day 3');
    expect(tx.dietPlanMeal.deleteMany).not.toHaveBeenCalled();
  });

  it('removes unlogged meals and days that were left out', async () => {
    tx.dietPlanDay.findMany.mockResolvedValue([
      { id: 'day-a', dayNumber: 1, dietPlanMeals: [{ id: 'meal-1', name: 'Oats', _count: { dietMealLogs: 0 } }] },
      { id: 'day-b', dayNumber: 2, dietPlanMeals: [] },
    ]);
    const res = mockResponse();

    await saveDietPlanSchedule(request({ id: 'plan-1' }, { days: [{ dayNumber: 1, meals: [] }] }), res);

    expect(tx.dietPlanMeal.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['meal-1'] } } });
    expect(tx.dietPlanDay.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['day-b'] } } });
  });

  it.each([
    [{ days: [{ dayNumber: 1, meals: [meal({ name: 'x'.repeat(101) })] }] }, 'Meal names must be 100 characters or fewer'],
    [{ days: [{ dayNumber: 1, meals: [meal({ portionSize: 'p'.repeat(151) })] }] }, 'Portion size must be 150 characters or fewer'],
    [{ days: [{ dayNumber: 2, meals: [] }, { dayNumber: 2, meals: [] }] }, 'Day 2 appears twice'],
  ])('rejects invalid input with a clear message', async (body, message) => {
    const res = mockResponse();
    await saveDietPlanSchedule(request({ id: 'plan-1' }, body), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe(message);
  });

  it('rejects a meal type that no longer exists', async () => {
    mockPrisma.mealType.findMany.mockImplementation(rowsIn(['mt-breakfast']));
    const res = mockResponse();
    await saveDietPlanSchedule(request({ id: 'plan-1' }, { days: [{ dayNumber: 1, meals: [meal({ mealTypeId: 'gone' })] }] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('diet plan goal', () => {
  it('saves a known goal and returns it as category for the app filter', async () => {
    mockPrisma.dietPlan.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'p', ...data }));
    const res = mockResponse();

    await createDietPlan(request({}, { name: 'IMDIAN', goal: 'weight_gain' }), res);

    expect(mockPrisma.dietPlan.create).toHaveBeenCalledWith({ data: expect.objectContaining({ goal: 'weight_gain' }) });
    expect(res.json.mock.calls[0][0].data.category).toBe('weight gain');
  });

  it('rejects an unknown goal', async () => {
    const res = mockResponse();
    await createDietPlan(request({}, { name: 'X', goal: 'fly' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.dietPlan.create).not.toHaveBeenCalled();
  });
});

describe('exercise plan schedule', () => {
  beforeEach(() => {
    mockPrisma.exercisePlan.findUnique.mockResolvedValue({ id: 'xp-1' });
    mockPrisma.exercise.findMany.mockImplementation(rowsIn(['ex-1', 'ex-2']));
    mockPrisma.exercisePlanWeek.findMany.mockResolvedValue([]);
    tx.exercisePlanWeek.create.mockImplementation(({ data }: any) => Promise.resolve({ id: `week-${data.weekNumber}`, ...data }));
  });

  it('saves workouts per week and weekday in the order given', async () => {
    tx.exercisePlanWeek.findMany.mockResolvedValue([]);
    const res = mockResponse();

    await saveExercisePlanSchedule(request({ id: 'xp-1' }, {
      weeks: [{ weekNumber: 1, days: [{ dayOfWeek: 'Monday', exercises: [{ exerciseId: 'ex-2', sets: 3, reps: '10' }, { exerciseId: 'ex-1' }] }] }],
    }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(tx.exercisePlanSchedule.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ weekId: 'week-1', exerciseId: 'ex-2', dayOfWeek: 'Monday', orderIndex: 1, sets: 3 }) });
    expect(tx.exercisePlanSchedule.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ exerciseId: 'ex-1', orderIndex: 2 }) });
  });

  it('refuses to remove a workout users have progress on', async () => {
    tx.exercisePlanWeek.findMany.mockResolvedValue([{
      id: 'week-1', weekNumber: 1,
      exercisePlanSchedule: [{ id: 'row-1', dayOfWeek: 'Monday', exercise: { name: 'Squat' }, _count: { userExerciseProgress: 5 } }],
    }]);
    const res = mockResponse();

    await saveExercisePlanSchedule(request({ id: 'xp-1' }, { weeks: [] }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain('"Squat" on week 1 Monday');
    expect(tx.exercisePlanSchedule.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a weekday the app does not know', async () => {
    const res = mockResponse();
    await saveExercisePlanSchedule(request({ id: 'xp-1' }, { weeks: [{ weekNumber: 1, days: [{ dayOfWeek: 'Funday', exercises: [] }] }] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
