export {};

const mockPrisma: any = {
  meditation: { findUnique: jest.fn() },
  userMeditationLog: { create: jest.fn(), findMany: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { createMeditationLog, getMeditationLogs } =
  require('../src/controllers/meditationLogController') as typeof import('../src/controllers/meditationLogController');

const createResponse = () => {
  const response: any = { statusCode: 200, body: null };
  response.status = jest.fn((code: number) => { response.statusCode = code; return response; });
  response.json = jest.fn((body: any) => { response.body = body; return response; });
  return response;
};

const asUser = (extra: Record<string, unknown>) => ({ user: { id: 'user-1' }, query: {}, ...extra }) as any;

describe('meditation history', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records a finished meditation for the caller, ignoring a userId in the body', async () => {
    mockPrisma.meditation.findUnique.mockResolvedValue({ id: 'med-1' });
    mockPrisma.userMeditationLog.create.mockImplementation(async ({ data }: any) => ({ id: 'log-1', ...data }));
    const res = createResponse();

    await createMeditationLog(asUser({ body: { meditationId: 'med-1', durationSeconds: 348, userId: 'someone-else' } }), res);

    expect(res.statusCode).toBe(201);
    expect(mockPrisma.userMeditationLog.create.mock.calls[0][0].data).toEqual({ userId: 'user-1', meditationId: 'med-1', durationSeconds: 348 });
  });

  it('keeps every session instead of one per day', async () => {
    mockPrisma.meditation.findUnique.mockResolvedValue({ id: 'med-1' });
    mockPrisma.userMeditationLog.create.mockResolvedValue({ id: 'log' });

    await createMeditationLog(asUser({ body: { meditationId: 'med-1' } }), createResponse());
    await createMeditationLog(asUser({ body: { meditationId: 'med-1' } }), createResponse());

    expect(mockPrisma.userMeditationLog.create).toHaveBeenCalledTimes(2);
  });

  it('rejects a missing or unknown meditation', async () => {
    const missing = createResponse();
    await createMeditationLog(asUser({ body: {} }), missing);
    expect(missing.statusCode).toBe(400);
    expect(missing.body.message).toBe('meditationId is required');

    mockPrisma.meditation.findUnique.mockResolvedValue(null);
    const unknown = createResponse();
    await createMeditationLog(asUser({ body: { meditationId: 'nope' } }), unknown);
    expect(unknown.statusCode).toBe(404);
    expect(mockPrisma.userMeditationLog.create).not.toHaveBeenCalled();
  });

  it("only lists the caller's history, newest first, with a capped limit", async () => {
    mockPrisma.userMeditationLog.findMany.mockResolvedValue([]);
    const res = createResponse();

    await getMeditationLogs(asUser({ query: { limit: '5000' } }), res);

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.userMeditationLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1' },
      orderBy: { completedAt: 'desc' },
      take: 100,
    }));
  });
});
