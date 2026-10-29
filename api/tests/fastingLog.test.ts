export {};

const mockPrisma: any = {
  fastingLog: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
const { createFastingLog, endFast, getActiveFastingLog, updateFastingLog } =
  require('../src/controllers/fastingLogController') as typeof import('../src/controllers/fastingLogController');

const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET!);
const authed = (extra: Record<string, unknown>) => ({ headers: { authorization: `Bearer ${token}` }, ...extra }) as any;

const createResponse = () => {
  const response: any = { statusCode: 200, body: null };
  response.status = jest.fn((code: number) => { response.statusCode = code; return response; });
  response.json = jest.fn((body: any) => { response.body = body; return response; });
  return response;
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const legacyFields = { date: '2026-10-20', timeStart: '20:00', timeEnd: '12:00' };

beforeEach(() => {
  mockPrisma.fastingLog.create.mockImplementation(async ({ data }: any) => ({ id: 'fast-1', ...data }));
  mockPrisma.fastingLog.update.mockImplementation(async ({ data }: any) => ({ id: 'fast-1', ...data }));
});

describe('endFast', () => {
  it('completes a fast that reached its target and stops one that did not', () => {
    const start = new Date('2026-10-20T20:00:00Z');
    expect(endFast(start, new Date('2026-10-21T12:00:00Z'), 960)).toEqual({ durationMinutes: 960, status: 'COMPLETED' });
    expect(endFast(start, new Date('2026-10-21T08:00:00Z'), 960)).toEqual({ durationMinutes: 720, status: 'STOPPED' });
    expect(endFast(start, new Date('2026-10-21T08:00:00Z'), null).status).toBe('COMPLETED');
  });
});

describe('starting a fast', () => {
  it('records the real start time and target as an active fast', async () => {
    mockPrisma.fastingLog.findFirst.mockResolvedValue(null);
    const res = createResponse();
    const startedAt = hoursAgo(0).toISOString();

    await createFastingLog(authed({ body: { ...legacyFields, startedAt, targetMinutes: 960 } }), res);

    expect(res.statusCode).toBe(201);
    expect(mockPrisma.fastingLog.create.mock.calls[0][0].data).toMatchObject({
      status: 'ACTIVE', targetMinutes: 960, startedAt: new Date(startedAt),
    });
  });

  it('allows only one fast in progress', async () => {
    mockPrisma.fastingLog.findFirst.mockResolvedValue({ id: 'running', status: 'ACTIVE' });
    const res = createResponse();

    await createFastingLog(authed({ body: { ...legacyFields, startedAt: hoursAgo(0).toISOString(), targetMinutes: 960 } }), res);

    expect(res.statusCode).toBe(409);
    expect(mockPrisma.fastingLog.create).not.toHaveBeenCalled();
  });

  it('keeps accepting the date/time payload older app versions send', async () => {
    const res = createResponse();
    await createFastingLog(authed({ body: legacyFields }), res);
    expect(res.statusCode).toBe(201);
    expect(mockPrisma.fastingLog.create.mock.calls[0][0].data.status).toBeUndefined();
  });
});

describe('ending a fast', () => {
  it('works out duration and outcome on the server, even across midnight', async () => {
    mockPrisma.fastingLog.findFirst.mockResolvedValue({ id: 'fast-1', userId: 'user-1', status: 'ACTIVE', startedAt: hoursAgo(10), targetMinutes: 960 });
    const res = createResponse();

    await updateFastingLog(authed({ params: { id: 'fast-1' }, body: { endedAt: new Date().toISOString() } }), res);

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.fastingLog.update.mock.calls[0][0].data).toMatchObject({ durationMinutes: 600, status: 'STOPPED' });
  });

  it('refuses to end a fast twice', async () => {
    mockPrisma.fastingLog.findFirst.mockResolvedValue({ id: 'fast-1', userId: 'user-1', status: 'COMPLETED', startedAt: hoursAgo(20), targetMinutes: 960 });
    const res = createResponse();

    await updateFastingLog(authed({ params: { id: 'fast-1' }, body: { endedAt: new Date().toISOString() } }), res);

    expect(res.statusCode).toBe(409);
  });
});

describe('active fast', () => {
  it('is found by status, not by calendar day', async () => {
    mockPrisma.fastingLog.findFirst.mockResolvedValue({ id: 'overnight', status: 'ACTIVE' });
    const res = createResponse();

    await getActiveFastingLog(authed({}), res);

    expect(mockPrisma.fastingLog.findFirst.mock.calls[0][0].where).toEqual({ userId: 'user-1', status: 'ACTIVE' });
    expect(res.body.data.fastingLog.id).toBe('overnight');
  });
});
