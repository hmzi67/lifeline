export {};

const mockPrisma = {
  exercisePlan: { findUnique: jest.fn() },
  userFavoriteExercisePlan: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  addFavoriteExercisePlan,
  getFavoriteExercisePlans,
  removeFavoriteExercisePlan,
} from '../src/controllers/userFavoriteExercisePlanController';

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const request = (overrides: Record<string, unknown> = {}) =>
  ({ user: { id: 'user-1', role: 'user' }, params: {}, body: {}, ...overrides }) as any;

const favoriteRow = {
  id: 'fav-1',
  planId: 'plan-1',
  favoritedAt: new Date('2026-10-31T10:00:00Z'),
  plan: {
    id: 'plan-1',
    name: 'Core Basics',
    level: 'Beginner',
    image: null,
    durationWeeks: 4,
    // The same exercise in two weeks counts once.
    exercisePlanWeeks: [
      { exercisePlanSchedule: [{ exerciseId: 'ex-1' }, { exerciseId: 'ex-2' }] },
      { exercisePlanSchedule: [{ exerciseId: 'ex-1' }] },
    ],
  },
};

describe('favourite exercise plans', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists only the caller\'s favourites with an exercise count', async () => {
    mockPrisma.userFavoriteExercisePlan.findMany.mockResolvedValue([favoriteRow]);
    const res = mockResponse();

    await getFavoriteExercisePlans(request(), res);

    expect(mockPrisma.userFavoriteExercisePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
    const body = res.json.mock.calls[0][0];
    expect(body.data[0].plan).toEqual({
      id: 'plan-1', name: 'Core Basics', level: 'Beginner', image: null, durationWeeks: 4, exerciseCount: 2,
    });
  });

  it('adds a plan idempotently', async () => {
    mockPrisma.exercisePlan.findUnique.mockResolvedValue({ id: 'plan-1' });
    mockPrisma.userFavoriteExercisePlan.upsert.mockResolvedValue(favoriteRow);
    const res = mockResponse();

    await addFavoriteExercisePlan(request({ body: { planId: 'plan-1' } }), res);

    expect(mockPrisma.userFavoriteExercisePlan.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_planId: { userId: 'user-1', planId: 'plan-1' } },
      create: { userId: 'user-1', planId: 'plan-1' },
      update: {},
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects a missing planId and an unknown plan', async () => {
    const missing = mockResponse();
    await addFavoriteExercisePlan(request({ body: {} }), missing);
    expect(missing.status).toHaveBeenCalledWith(400);

    mockPrisma.exercisePlan.findUnique.mockResolvedValue(null);
    const unknown = mockResponse();
    await addFavoriteExercisePlan(request({ body: { planId: 'nope' } }), unknown);
    expect(unknown.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.userFavoriteExercisePlan.upsert).not.toHaveBeenCalled();
  });

  it('removes only the caller\'s favourite', async () => {
    mockPrisma.userFavoriteExercisePlan.deleteMany.mockResolvedValue({ count: 1 });
    const res = mockResponse();

    await removeFavoriteExercisePlan(request({ params: { planId: 'plan-1' } }), res);

    expect(mockPrisma.userFavoriteExercisePlan.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', planId: 'plan-1' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('requires authentication', async () => {
    const res = mockResponse();
    await getFavoriteExercisePlans(request({ user: undefined }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
