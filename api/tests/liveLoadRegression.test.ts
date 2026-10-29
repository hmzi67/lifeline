export {};
import type { Server } from 'node:http';
import path from 'node:path';

const mockModels: Record<string, any> = {};
const mockPrisma: any = new Proxy({ $queryRaw: jest.fn(async () => [{ value: 1 }]) }, {
  get(target: any, key: string) {
    if (key in target) return target[key];
    if (!mockModels[key]) mockModels[key] = {
      findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0), create: jest.fn(), update: jest.fn(), delete: jest.fn(),
    };
    return mockModels[key];
  },
});
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));
jest.mock('@quixo3/prisma-session-store', () => ({ PrismaSessionStore: require('express-session').MemoryStore }));
// All requests go to a loopback app; provider calls and database writes are unnecessary.
process.env.UPLOAD_PATH = path.resolve(__dirname, '../../../reports/live-load/regression-uploads');
const app = require('../src/app').default;
const jwt = require('jsonwebtoken');
let server: Server;
let base: string;
const users = ['fixture-a', 'fixture-b'];
const date = '2026-10-23';
const ownRoutine = (userId: string) => ({ id: `routine-${userId}`, userId, routinesDate: new Date(date),
  fasting: null, sleep: null, medication: null, water: null, meditation: { id: 'shared-meditation' } });
const token = (userId: string) => jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '15m' });
const call = (endpoint: string, userId: string | null = users[0], init: RequestInit = {}) => fetch(base + endpoint, {
  ...init, headers: { 'Content-Type': 'application/json', ...(userId ? { Authorization: `Bearer ${token(userId)}` } : {}) },
});

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockImplementation(async ({ where }: any) => ({
    id: where.id, email: `${where.id}@example.test`, role: { name: 'user' }, isEmailVerified: true,
  }));
  mockPrisma.userDailyRoutine.findMany.mockImplementation(async ({ where }: any) =>
    users.filter(id => id === where.userId).map(ownRoutine));
  mockPrisma.userDailyRoutine.count.mockResolvedValue(1);
  mockPrisma.userLicense.findFirst.mockResolvedValue(null);
});

describe('Live-load report regression: real app over HTTP, synthetic database', () => {
  it.each(['/health', '/api/health'])('advertises the fixed API contract on %s', async endpoint => {
    const response = await call(endpoint, null);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'healthy', apiContract: '2026-10-24.routines-weight.v1' });
  });
  it.each(users)('returns only %s routines and scopes the count to that same user', async id => {
    const response = await call(`/api/user-daily-routines?date=${date}&limit=1`, id);
    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].userId).toBe(id);
    expect(mockPrisma.userDailyRoutine.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: id, routinesDate: new Date(date) }, take: 1,
    }));
    expect(mockPrisma.userDailyRoutine.count).toHaveBeenCalledWith({ where: { userId: id, routinesDate: new Date(date) } });
    expect(mockPrisma.userDailyRoutine.findMany.mock.calls[0][0].include.user).toBeUndefined();
  });
  it('denies anonymous routine reads', async () => {
    expect((await call('/api/user-daily-routines', null)).status).toBe(401);
    expect(mockPrisma.userDailyRoutine.findMany).not.toHaveBeenCalled();
  });
  it('rejects a query-string attempt to select another user', async () => {
    expect((await call('/api/user-daily-routines?userId=fixture-b')).status).toBe(403);
    expect(mockPrisma.userDailyRoutine.findMany).not.toHaveBeenCalled();
  });
  it('returns no data if a faulty list query returns a foreign routine', async () => {
    mockPrisma.userDailyRoutine.findMany.mockResolvedValueOnce([ownRoutine('fixture-b')]);
    const response = await call('/api/user-daily-routines');
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain('fixture-b');
    expect(body).not.toContain('shared-meditation');
  });
  it.each(['fasting', 'sleep', 'medication', 'water'])('rejects an own routine with a historical foreign %s link', async relation => {
    mockPrisma.userDailyRoutine.findMany.mockResolvedValueOnce([{
      ...ownRoutine('fixture-a'), [relation]: { userId: 'fixture-b', name: 'PRIVATE_FOREIGN_HEALTH_DATA' },
    }]);
    const response = await call('/api/user-daily-routines');
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('PRIVATE_FOREIGN_HEALTH_DATA');
  });
  it('also rejects foreign records on the own-user list alias', async () => {
    mockPrisma.userDailyRoutine.findMany.mockResolvedValueOnce([ownRoutine('fixture-b')]);
    const response = await call('/api/user-daily-routines/user/fixture-a');
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('fixture-b');
  });
  it('hides another user routine by ID', async () => {
    mockPrisma.userDailyRoutine.findUnique.mockResolvedValueOnce(ownRoutine('fixture-b'));
    const response = await call('/api/user-daily-routines/routine-fixture-b');
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('fixture-b');
  });
  it('rejects creating a routine linked to another user medication', async () => {
    mockPrisma.medication.findUnique.mockResolvedValueOnce({ userId: 'fixture-b' });
    const response = await call('/api/user-daily-routines', 'fixture-a', {
      method: 'POST', body: JSON.stringify({ medicationId: 'foreign-medication' }),
    });
    expect(response.status).toBe(400);
    expect(mockPrisma.userDailyRoutine.create).not.toHaveBeenCalled();
  });
  it('mounts weight history behind authentication rather than returning route-not-found', async () => {
    expect((await call('/api/weight-logs?days=30', null)).status).toBe(401);
  });
  it.each(users)('returns %s weight history using the caller identity, ignoring a forged userId', async id => {
    mockPrisma.weightLog.findMany.mockImplementation(async ({ where }: any) => [{
      date, weight: where.userId === 'fixture-a' ? 70 : 80, unit: 'kg',
    }]);
    const response = await call('/api/weight-logs?days=30&userId=attacker-supplied', id);
    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.data).toEqual([{ date, weight: id === 'fixture-a' ? 70 : 80, unit: 'kg' }]);
    expect(mockPrisma.weightLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: id, date: { gte: expect.any(Date) } },
      select: { date: true, weight: true, unit: true },
    }));
  });
  it('continues enforcing VIP for free accounts', async () => {
    const response = await call('/api/progress/summary');
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'ACTIVE_SUBSCRIPTION_REQUIRED' });
  });
});
