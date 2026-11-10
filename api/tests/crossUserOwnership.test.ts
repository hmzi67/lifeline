export {};

// User A tries to read, change and delete rows that belong to user B.
// Every attempt must be refused and must never reach a write.

const owned = { id: 'row-b', userId: 'user-b' };
const model = () => ({
  findUnique: jest.fn().mockResolvedValue(owned),
  findFirst: jest.fn().mockResolvedValue(null), // queries scoped to the caller find nothing
  findMany: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
  update: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  updateMany: jest.fn(),
});

const mockPrisma: any = {
  sleepLog: model(),
  cheatDay: model(),
  medicationReminder: model(),
  waterIntakeLog: model(),
  userDailyRoutine: model(),
  userDailyRoutineSleep: model(),
};

jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return { ...actual, PrismaClient: jest.fn(() => mockPrisma) };
});

const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
const sleep = require('../src/controllers/sleepLogController') as typeof import('../src/controllers/sleepLogController');
const cheat = require('../src/controllers/cheatDayController') as typeof import('../src/controllers/cheatDayController');
const reminder =
  require('../src/controllers/medicationReminderController') as typeof import('../src/controllers/medicationReminderController');
const water = require('../src/controllers/waterIntakeController').default;
const { UserDailyRoutineController: routine } =
  require('../src/controllers/userDailyRoutineController') as typeof import('../src/controllers/userDailyRoutineController');

const createResponse = () => {
  const response: any = { statusCode: 200, body: null };
  response.status = jest.fn((code: number) => { response.statusCode = code; return response; });
  response.json = jest.fn((body: any) => { response.body = body; return response; });
  return response;
};

const token = jwt.sign({ userId: 'user-a' }, process.env.JWT_SECRET!);
const asUserA = (extra: Record<string, unknown> = {}) =>
  ({
    headers: { authorization: `Bearer ${token}` },
    user: { id: 'user-a', email: 'a@example.test', role: 'user' },
    params: { id: 'row-b', userId: 'user-b' },
    query: {},
    body: { notes: 'mine now', amount: 250, reminderTime: '08:00', userId: 'user-a' },
    ...extra,
  }) as any;

const expectRefused = (res: any) => expect([403, 404]).toContain(res.statusCode);
const writes = () =>
  Object.values(mockPrisma).flatMap((m: any) => [m.update, m.delete, m.deleteMany, m.updateMany]);

beforeEach(() => {
  for (const m of Object.values(mockPrisma) as any[]) {
    m.findUnique.mockResolvedValue(owned);
    m.findFirst.mockResolvedValue(null);
  }
  for (const fn of writes()) fn.mockClear();
});
afterEach(() => {
  for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
});

const cases: Array<[string, (req: any, res: any) => Promise<unknown>]> = [
  ['sleep log: read', sleep.getSleepLogById],
  ['sleep log: update', sleep.updateSleepLog],
  ['sleep log: delete', sleep.deleteSleepLog],
  ['cheat day: list by user', cheat.getUserCheatDays],
  ['cheat day: read', cheat.getCheatDayById],
  ['cheat day: update', cheat.updateCheatDay],
  ['cheat day: delete', cheat.deleteCheatDay],
  ['medication reminder: list by user', reminder.getUserMedicationReminders],
  ['medication reminder: read', reminder.getMedicationReminderById],
  ['medication reminder: update', reminder.updateMedicationReminder],
  ['medication reminder: toggle', reminder.toggleMedicationReminder],
  ['medication reminder: delete', reminder.deleteMedicationReminder],
  ['water intake: list by user', (req, res) => water.getWaterIntakesByUserId(req, res)],
  ['water intake: read', (req, res) => water.getWaterIntakeById(req, res)],
  ['water intake: update', (req, res) => water.updateWaterIntake(req, res)],
  ['water intake: delete', (req, res) => water.deleteWaterIntake(req, res)],
  ['daily routine: list by user', (req, res) => routine.getUserDailyRoutinesByUserId(req, res)],
  ['daily routine: read', (req, res) => routine.getUserDailyRoutineById(req, res)],
  ['daily routine: update', (req, res) => routine.updateUserDailyRoutine(req, res)],
  ['daily routine: delete', (req, res) => routine.deleteUserDailyRoutine(req, res)],
];

describe("user A cannot touch user B's data", () => {
  it.each(cases)('%s', async (_name, handler) => {
    const res = createResponse();
    await handler(asUserA(), res);
    expectRefused(res);
  });

  it('cannot delete a sleep log that has no owner', async () => {
    mockPrisma.sleepLog.findUnique.mockResolvedValue({ id: 'row-x', userId: null });
    const res = createResponse();
    await sleep.deleteSleepLog(asUserA({ params: { id: 'row-x' } }), res);
    expect(res.statusCode).toBe(403);
  });
});
