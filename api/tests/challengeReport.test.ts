export {};

const mockPrisma = {
  challenge: { findUnique: jest.fn(), update: jest.fn() },
  challengeReport: { upsert: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const mockNotifyUser = jest.fn();
jest.mock('../src/services/notificationService', () => ({
  notifyUser: (...args: unknown[]) => mockNotifyUser(...args),
}));

const { reportChallenge, resolveChallengeReports } =
  require('../src/controllers/challengeController') as typeof import('../src/controllers/challengeController');

type MockResponse = { statusCode: number; body: any; status: jest.Mock; json: jest.Mock };

const createResponse = (): MockResponse => {
  const response = { statusCode: 200, body: null } as MockResponse;
  response.status = jest.fn((statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  });
  response.json = jest.fn((body: any) => {
    response.body = body;
    return response;
  });
  return response;
};

const CHALLENGE_ID = 'ckchallenge0000000000000001';
const liveChallenge = { id: CHALLENGE_ID, name: 'Morning Run', approvalStatus: 'APPROVED', status: 'ACTIVE', submittedById: 'host-1' };

beforeEach(() => {
  mockPrisma.challenge.findUnique.mockResolvedValue(liveChallenge);
  mockPrisma.challengeReport.upsert.mockResolvedValue({ id: 'report-1' });
  mockPrisma.challengeReport.updateMany.mockResolvedValue({ count: 2 });
  mockPrisma.challenge.update.mockResolvedValue({ ...liveChallenge, approvalStatus: 'REJECTED' });
});

describe('reportChallenge', () => {
  const report = async (body: Record<string, unknown>, userId = 'user-1') => {
    const res = createResponse();
    await reportChallenge({ params: { id: CHALLENGE_ID }, body, user: { id: userId, role: 'user' } } as any, res as any);
    return res;
  };

  it('records one open report per user, reopening it when they report again', async () => {
    const res = await report({ reason: 'INAPPROPRIATE', details: 'Offensive name' });

    expect(res.statusCode).toBe(201);
    const { where, create, update } = mockPrisma.challengeReport.upsert.mock.calls[0][0];
    expect(where).toEqual({ challengeId_reporterId: { challengeId: CHALLENGE_ID, reporterId: 'user-1' } });
    expect(create).toEqual({ challengeId: CHALLENGE_ID, reporterId: 'user-1', reason: 'INAPPROPRIATE', details: 'Offensive name' });
    expect(update).toMatchObject({ reason: 'INAPPROPRIATE', status: 'OPEN', resolvedAt: null });
  });

  it('rejects an unknown reason', async () => {
    const res = await report({ reason: 'BORING' });
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.challengeReport.upsert).not.toHaveBeenCalled();
  });

  it('only accepts reports on challenges users can see', async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue({ ...liveChallenge, approvalStatus: 'PENDING' });
    const res = await report({ reason: 'SPAM' });
    expect(res.statusCode).toBe(404);
  });

  it('does not let a host report their own challenge', async () => {
    const res = await report({ reason: 'SPAM' }, 'host-1');
    expect(res.statusCode).toBe(400);
  });
});

describe('resolveChallengeReports', () => {
  const resolve = async (action: string) => {
    const res = createResponse();
    await resolveChallengeReports({ params: { id: CHALLENGE_ID }, body: { action } } as any, res as any);
    return res;
  };

  it('removes the challenge, closes its reports and tells the host', async () => {
    const res = await resolve('remove');

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.challenge.update.mock.calls[0][0].data).toMatchObject({ approvalStatus: 'REJECTED' });
    expect(mockPrisma.challengeReport.updateMany.mock.calls[0][0]).toMatchObject({
      where: { challengeId: CHALLENGE_ID, status: 'OPEN' },
      data: { status: 'RESOLVED' },
    });
    expect(mockNotifyUser).toHaveBeenCalledWith('host-1', expect.objectContaining({ title: 'Challenge removed' }));
  });

  it('dismisses the reports and leaves the challenge live', async () => {
    await resolve('dismiss');

    expect(mockPrisma.challenge.update).not.toHaveBeenCalled();
    expect(mockPrisma.challengeReport.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'DISMISSED' });
    expect(mockNotifyUser).not.toHaveBeenCalled();
  });
});
