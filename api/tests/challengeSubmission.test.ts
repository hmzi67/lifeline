export {};

const mockPrisma = {
  challenge: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userChallenge: { findFirst: jest.fn(), create: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const mockNotifyUser = jest.fn();
jest.mock('../src/services/notificationService', () => ({
  notifyUser: (...args: unknown[]) => mockNotifyUser(...args),
}));

const { joinChallenge, reviewChallenge, submitChallenge } =
  require('../src/controllers/challengeController') as typeof import('../src/controllers/challengeController');
const { challengePhase } = require('../src/services/challengeTimeline') as typeof import('../src/services/challengeTimeline');

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
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3600_000);

// What prisma.challenge.create/update return with challengeInclude.
const storedChallenge = (data: Record<string, unknown>) => ({
  id: CHALLENGE_ID,
  status: 'ACTIVE',
  createdAt: new Date(),
  scheduledAt: null,
  startDate: null,
  endDate: null,
  challengeFees: [],
  _count: { userChallenges: 0 },
  userChallenges: [],
  submittedBy: { id: 'user-1', username: 'elsa', email: 'elsa@example.test', profileImage: null },
  ...data,
});

beforeEach(() => {
  mockPrisma.challenge.count.mockResolvedValue(0);
  mockPrisma.challenge.findFirst.mockResolvedValue(null);
  mockPrisma.challenge.create.mockImplementation(async ({ data }: any) => storedChallenge(data));
  mockPrisma.challenge.update.mockImplementation(async ({ data }: any) => storedChallenge(data));
});

describe('challengePhase', () => {
  const now = new Date('2026-10-20T12:00:00Z');

  it('splits challenges into live, upcoming and ended', () => {
    const base = { status: 'ACTIVE', scheduledAt: null, startDate: null, endDate: null };
    expect(challengePhase({ ...base, scheduledAt: new Date('2026-10-21T09:00:00Z') }, now)).toBe('upcoming');
    expect(challengePhase({ ...base, scheduledAt: new Date('2026-10-20T09:00:00Z') }, now)).toBe('live');
    // The end date is a whole day.
    expect(challengePhase({ ...base, endDate: new Date('2026-10-20T00:00:00Z') }, now)).toBe('live');
    expect(challengePhase({ ...base, endDate: new Date('2026-10-19T00:00:00Z') }, now)).toBe('ended');
    expect(challengePhase({ ...base, status: 'COMPLETED' }, now)).toBe('ended');
  });
});

describe('submitChallenge', () => {
  const submit = async (body: Record<string, unknown>) => {
    const res = createResponse();
    await submitChallenge({ body, user: { id: 'user-1', role: 'user' } } as any, res as any);
    return res;
  };

  it('stores the submission as pending for the caller, ignoring spoofed review fields', async () => {
    const res = await submit({
      name: 'Morning Run',
      purpose: 'Running',
      description: 'Run 5k',
      scheduledAt: hoursFromNow(24).toISOString(),
      durationDays: 7,
      approvalStatus: 'APPROVED',
      submittedById: 'someone-else',
    });

    expect(res.statusCode).toBe(201);
    const { data } = mockPrisma.challenge.create.mock.calls[0][0];
    expect(data).toMatchObject({ approvalStatus: 'PENDING', submittedById: 'user-1', status: 'ACTIVE', dailyFee: 1, durationDays: 7 });
    // A 7-day challenge ends on its 7th day.
    expect(Math.round((data.endDate.getTime() - data.scheduledAt.getTime()) / 86400000)).toBe(6);
    expect(data.scheduledAt).toBeInstanceOf(Date);
    // Public response names the host without exposing their email.
    expect(res.body.data.host).toEqual({ id: 'user-1', username: 'elsa', profileImage: null });
    expect(res.body.data.submittedBy).toBeUndefined();
  });

  it('rejects a start time in the past', async () => {
    const res = await submit({ name: 'Late', description: 'x', scheduledAt: hoursFromNow(-2).toISOString(), durationDays: 7 });
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.challenge.create).not.toHaveBeenCalled();
  });

  it('caps how many submissions can wait for review', async () => {
    mockPrisma.challenge.count.mockResolvedValue(5);
    const res = await submit({ name: 'Sixth', description: 'x', scheduledAt: hoursFromNow(1).toISOString(), durationDays: 7 });
    expect(res.statusCode).toBe(429);
  });
});

describe('reviewChallenge', () => {
  beforeEach(() => {
    mockPrisma.challenge.findUnique.mockResolvedValue({ id: CHALLENGE_ID, name: 'Morning Run', submittedById: 'user-1' });
  });

  it('approves, clears any old reason and notifies the submitter', async () => {
    const res = createResponse();
    await reviewChallenge({ params: { id: CHALLENGE_ID }, body: { action: 'approve' } } as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.challenge.update.mock.calls[0][0].data).toEqual({ approvalStatus: 'APPROVED', rejectionReason: null });
    expect(mockNotifyUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ title: 'Challenge approved' }));
  });

  it('rejects with a reason the submitter can see', async () => {
    const res = createResponse();
    await reviewChallenge(
      { params: { id: CHALLENGE_ID }, body: { action: 'reject', rejectionReason: 'Duplicate' } } as any,
      res as any,
    );

    expect(mockPrisma.challenge.update.mock.calls[0][0].data).toEqual({ approvalStatus: 'REJECTED', rejectionReason: 'Duplicate' });
    expect(mockNotifyUser.mock.calls[0][1].body).toContain('Duplicate');
  });
});

describe('joinChallenge', () => {
  it('does not let users join a challenge that is still pending review', async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue({ id: CHALLENGE_ID, approvalStatus: 'PENDING', status: 'ACTIVE' });
    const res = createResponse();

    await joinChallenge({ params: { id: CHALLENGE_ID }, user: { id: 'user-2' } } as any, res as any);

    expect(res.statusCode).toBe(404);
    expect(mockPrisma.userChallenge.create).not.toHaveBeenCalled();
  });

  it('sends paid challenges through checkout instead of joining for free', async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue({
      id: CHALLENGE_ID, approvalStatus: 'APPROVED', status: 'ACTIVE', dailyFee: 1, durationDays: 7,
      scheduledAt: null, startDate: null, endDate: null,
    });
    const res = createResponse();

    await joinChallenge({ params: { id: CHALLENGE_ID }, user: { id: 'user-2' } } as any, res as any);

    expect(res.statusCode).toBe(402);
    expect(mockPrisma.userChallenge.create).not.toHaveBeenCalled();
  });

  it('rejects a duration the App Store has no product for', async () => {
    const res = createResponse();
    await submitChallenge(
      { body: { name: 'Odd', description: 'x', scheduledAt: hoursFromNow(1).toISOString(), durationDays: 9 }, user: { id: 'user-1' } } as any,
      res as any,
    );
    expect(res.statusCode).toBe(400);
  });
});
