export {};

const mockPrisma: any = {
  medication: { findMany: jest.fn(), findFirst: jest.fn() },
  medicationIntake: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  userChallenge: { findFirst: jest.fn(), update: jest.fn() },
  questionnaire: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  weightLog: { upsert: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));
jest.mock('../src/services/notificationService', () => ({ notifyUser: jest.fn() }));

const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
const { medicationAdherence } = require('../src/services/medicationAdherence') as typeof import('../src/services/medicationAdherence');
const { recordIntake } = require('../src/controllers/medicationIntakeController') as typeof import('../src/controllers/medicationIntakeController');
const { completeChallenge } = require('../src/controllers/challengeController') as typeof import('../src/controllers/challengeController');
const { updateWeight } = require('../src/controllers/questionnaireController') as typeof import('../src/controllers/questionnaireController');

const createResponse = () => {
  const response: any = { statusCode: 200, body: null };
  response.status = jest.fn((code: number) => { response.statusCode = code; return response; });
  response.json = jest.fn((body: any) => { response.body = body; return response; });
  return response;
};

describe('medication adherence', () => {
  it('counts taken and skipped doses, and past days with no record as missed', async () => {
    // One daily medication added 4 days before "today" (2026-10-22).
    mockPrisma.medication.findMany.mockResolvedValue([{ id: 'med-1', frequency: 'Everyday', addedAt: new Date('2026-10-18T09:00:00Z') }]);
    mockPrisma.medicationIntake.findMany.mockResolvedValue([
      { medicationId: 'med-1', date: new Date('2026-10-18'), status: 'TAKEN' },
      { medicationId: 'med-1', date: new Date('2026-10-19'), status: 'SKIPPED' },
      { medicationId: 'med-1', date: new Date('2026-10-22'), status: 'TAKEN' },
    ]);

    const summary = await medicationAdherence('user-1', 30, '2026-10-22');

    // 18 taken, 19 skipped, 20 + 21 missed, 22 (today) taken.
    expect(summary).toMatchObject({ taken: 2, skipped: 1, missed: 2, takenPercent: 40, skippedPercent: 20, missedPercent: 40 });
  });

  it('never counts "as needed" medications as missed', async () => {
    mockPrisma.medication.findMany.mockResolvedValue([{ id: 'med-2', frequency: 'As needed', addedAt: new Date('2026-10-01') }]);
    mockPrisma.medicationIntake.findMany.mockResolvedValue([]);
    expect((await medicationAdherence('user-1', 30, '2026-10-22')).missed).toBe(0);
  });
});

describe('recording a dose', () => {
  it("refuses another user's medication", async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(null);
    const res = createResponse();
    await recordIntake({ user: { id: 'user-1' }, params: { id: 'med-x' }, body: { date: '2026-10-22', status: 'TAKEN' } } as any, res);
    expect(res.statusCode).toBe(404);
    expect(mockPrisma.medicationIntake.upsert).not.toHaveBeenCalled();
  });

  it('stores one mark per medication per day', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue({ id: 'med-1' });
    mockPrisma.medicationIntake.upsert.mockResolvedValue({ id: 'i1' });
    const res = createResponse();
    await recordIntake({ user: { id: 'user-1' }, params: { id: 'med-1' }, body: { date: '2026-10-22', status: 'SKIPPED' } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.medicationIntake.upsert.mock.calls[0][0].where).toEqual({
      medicationId_date: { medicationId: 'med-1', date: new Date('2026-10-22') },
    });
  });
});

describe('completing a challenge', () => {
  const CHALLENGE_ID = 'ckchallenge0000000000000001';
  const request = { user: { id: 'user-1' }, params: { id: CHALLENGE_ID } } as any;
  const challenge = (overrides = {}) => ({ status: 'ACTIVE', scheduledAt: null, startDate: null, endDate: null, ...overrides });

  it('needs the user to have joined', async () => {
    mockPrisma.userChallenge.findFirst.mockResolvedValue(null);
    const res = createResponse();
    await completeChallenge(request, res);
    expect(res.statusCode).toBe(404);
  });

  it("can't complete a challenge that hasn't started", async () => {
    mockPrisma.userChallenge.findFirst.mockResolvedValue({ id: 'uc1', completedAt: null, challenge: challenge({ scheduledAt: new Date(Date.now() + 86400000) }) });
    const res = createResponse();
    await completeChallenge(request, res);
    expect(res.statusCode).toBe(400);
  });

  it('records completion once', async () => {
    mockPrisma.userChallenge.findFirst.mockResolvedValue({ id: 'uc1', completedAt: null, challenge: challenge() });
    mockPrisma.userChallenge.update.mockImplementation(async ({ data }: any) => ({ id: 'uc1', ...data }));
    const res = createResponse();
    await completeChallenge(request, res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.userChallenge.update).toHaveBeenCalledTimes(1);

    mockPrisma.userChallenge.findFirst.mockResolvedValue({ id: 'uc1', completedAt: new Date(), challenge: challenge() });
    await completeChallenge(request, createResponse());
    expect(mockPrisma.userChallenge.update).toHaveBeenCalledTimes(1);
  });
});

describe('weight history', () => {
  it('records a reading for the day whenever the weight is saved', async () => {
    const token = jwt.sign({ userId: 'user-1', email: 'a@example.test' }, process.env.JWT_SECRET!);
    mockPrisma.questionnaire.findFirst.mockResolvedValue({ id: 'q1' });
    mockPrisma.questionnaire.update.mockResolvedValue({ id: 'q1', weight: 67.5, weightUnit: 'kg' });
    const res = createResponse();

    await updateWeight({ headers: { authorization: `Bearer ${token}` }, body: { weight: 67.5 } } as any, res);

    expect(res.statusCode).toBe(200);
    const call = mockPrisma.weightLog.upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({ userId: 'user-1', weight: 67.5, unit: 'kg' });
    expect(call.where.userId_date.date.toISOString().slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));
  });
});
