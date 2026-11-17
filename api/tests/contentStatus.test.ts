export {};

const mockPrisma: any = {
  role: { findFirst: jest.fn() },
  dietPlan: { findUnique: jest.fn(), findMany: jest.fn() },
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));
jest.mock('../src/config/index', () => ({ config: { jwt: { secret: 'test-secret' } } }));

import jwt from 'jsonwebtoken';
import detectAdmin, { resetAdminRoleCache } from '../src/middleware/detectAdmin';
import { getAllDietPlans, getDietPlanById } from '../src/controllers/dietPlanController';

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const tokenFor = (roleId: string) => jwt.sign({ userId: 'u1', email: 'a@b.c', roleId }, 'test-secret');

const runDetect = async (authorization?: string) => {
  const req: any = { headers: authorization ? { authorization } : {} };
  const next = jest.fn();
  await detectAdmin(req, {} as any, next);
  expect(next).toHaveBeenCalled();
  return req;
};

beforeEach(() => {
  jest.clearAllMocks();
  resetAdminRoleCache();
  mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-admin' });
});

describe('detectAdmin', () => {
  it('marks a request with an admin token', async () => {
    expect((await runDetect(`Bearer ${tokenFor('role-admin')}`)).viewerIsAdmin).toBe(true);
  });

  it('lets other requests through as normal viewers', async () => {
    expect((await runDetect(`Bearer ${tokenFor('role-user')}`)).viewerIsAdmin).toBeUndefined();
    expect((await runDetect('Bearer not-a-jwt')).viewerIsAdmin).toBeUndefined();
    expect((await runDetect()).viewerIsAdmin).toBeUndefined();
  });
});

describe('diet plans and drafts', () => {
  it('lists only published plans for app users, everything for admins', async () => {
    mockPrisma.dietPlan.findMany.mockResolvedValue([]);

    await getAllDietPlans({ query: {}, headers: {} } as any, mockResponse());
    expect(mockPrisma.dietPlan.findMany.mock.calls[0][0].where).toEqual({ status: 'published' });

    await getAllDietPlans({ query: {}, headers: {}, viewerIsAdmin: true } as any, mockResponse());
    expect(mockPrisma.dietPlan.findMany.mock.calls[1][0].where).toEqual({});
  });

  it('hides a draft plan from app users but shows it to admins', async () => {
    mockPrisma.dietPlan.findUnique.mockResolvedValue({ id: 'd1', status: 'draft', dietPlanDays: [] });

    const userRes = mockResponse();
    await getDietPlanById({ params: { id: 'd1' }, query: {}, headers: {} } as any, userRes);
    expect(userRes.status).toHaveBeenCalledWith(404);

    const adminRes = mockResponse();
    await getDietPlanById({ params: { id: 'd1' }, query: {}, headers: {}, viewerIsAdmin: true } as any, adminRes);
    expect(adminRes.status).not.toHaveBeenCalledWith(404);
  });
});
