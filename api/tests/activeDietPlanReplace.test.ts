export {};

const mockPrisma: any = {
  user: { findUnique: jest.fn() },
  dietPlan: { findUnique: jest.fn() },
  userActiveDietPlan: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: any) => unknown) => fn(mockPrisma)),
};

jest.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, { code }: { code: string }) {
      super(message);
      this.code = code;
    }
  }
  return { PrismaClient: jest.fn(() => mockPrisma), Prisma: { PrismaClientKnownRequestError } };
});

import { Prisma } from '@prisma/client';
import { endActiveDietPlan, startActiveDietPlan } from '../src/controllers/userActiveDietPlanController';

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const start = (body: Record<string, unknown>) =>
  ({ user: { id: 'user-1', role: 'user' }, params: {}, body: { userId: 'user-1', dietId: 'diet-new', ...body } }) as any;

const oldPlan = { id: 'plan-old', userId: 'user-1', dietId: 'diet-old', currentDay: 4, startedAt: new Date('2026-10-01'), endedAt: null, diet: { id: 'diet-old', name: 'Keto' } };

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
  mockPrisma.dietPlan.findUnique.mockResolvedValue({ id: 'diet-new' });
  mockPrisma.userActiveDietPlan.create.mockResolvedValue({ id: 'plan-new', dietId: 'diet-new' });
});

describe('starting a diet plan', () => {
  it('starts the plan when the user has none', async () => {
    mockPrisma.userActiveDietPlan.findFirst.mockResolvedValue(null);
    const res = mockResponse();
    await startActiveDietPlan(start({}), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockPrisma.userActiveDietPlan.updateMany).not.toHaveBeenCalled();
  });

  it('asks before replacing a different active plan (409 with the current plan)', async () => {
    mockPrisma.userActiveDietPlan.findFirst.mockResolvedValue(oldPlan);
    const res = mockResponse();
    await startActiveDietPlan(start({}), res);
    expect(res.status).toHaveBeenCalledWith(409);
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe('ACTIVE_DIET_PLAN_EXISTS');
    expect(body.data.activePlan).toMatchObject({ id: 'plan-old', dietName: 'Keto' });
    expect(mockPrisma.userActiveDietPlan.create).not.toHaveBeenCalled();
  });

  it('ends the old plan and starts the new one when the user agreed', async () => {
    mockPrisma.userActiveDietPlan.findFirst.mockResolvedValue(oldPlan);
    const res = mockResponse();
    await startActiveDietPlan(start({ replaceActive: true }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockPrisma.userActiveDietPlan.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', endedAt: null },
      data: { endedAt: expect.any(Date) },
    });
    expect(mockPrisma.userActiveDietPlan.create).toHaveBeenCalled();
  });

  it('returns the current plan when it is the same diet', async () => {
    mockPrisma.userActiveDietPlan.findFirst.mockResolvedValue({ ...oldPlan, dietId: 'diet-new' });
    mockPrisma.userActiveDietPlan.findUnique.mockResolvedValue({ id: 'plan-old' });
    const res = mockResponse();
    await startActiveDietPlan(start({}), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockPrisma.userActiveDietPlan.create).not.toHaveBeenCalled();
  });

  it('answers 409 when a parallel start hits the one-open-plan index', async () => {
    mockPrisma.userActiveDietPlan.findFirst.mockResolvedValue(null);
    mockPrisma.userActiveDietPlan.create.mockRejectedValue(
      new (Prisma.PrismaClientKnownRequestError as any)('unique', { code: 'P2002' }),
    );
    const res = mockResponse();
    await startActiveDietPlan(start({}), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('deactivating a diet plan', () => {
  it('sets endedAt instead of deleting', async () => {
    mockPrisma.userActiveDietPlan.findUnique.mockResolvedValue({ ...oldPlan });
    mockPrisma.userActiveDietPlan.update.mockResolvedValue({ ...oldPlan, endedAt: new Date() });
    const res = mockResponse();
    await endActiveDietPlan({ params: { id: 'plan-old' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockPrisma.userActiveDietPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'plan-old' }, data: { endedAt: expect.any(Date) } }),
    );
  });
});
