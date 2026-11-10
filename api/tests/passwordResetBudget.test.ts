export {};

// One user row with just enough of Prisma's updateMany semantics (equality, lt/gte,
// increment) to exercise the conditional writes the reset flow relies on.
let row: Record<string, any>;
const matches = (where: Record<string, any>) =>
  Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('lt' in cond) return row[key] < cond.lt;
      if ('gte' in cond) return row[key] >= cond.gte;
    }
    return cond instanceof Date ? row[key]?.getTime() === cond.getTime() : row[key] === cond;
  });
const apply = (data: Record<string, any>) => {
  for (const [key, value] of Object.entries(data)) {
    row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : value;
  }
};

const mockPrisma: any = {
  user: {
    findUnique: jest.fn(async () => ({ ...row })),
    findFirst: jest.fn(async () => ({ ...row })),
    update: jest.fn(async ({ data }: any) => { apply(data); return { ...row }; }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      await new Promise((resolve) => setImmediate(resolve)); // let parallel requests interleave
      if (!matches(where)) return { count: 0 };
      apply(data);
      return { count: 1 };
    }),
  },
  refreshToken: { deleteMany: jest.fn() },
  $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));
const mockSendReset = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/services/emailService', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendReset(...args),
  sendEmailVerificationEmail: jest.fn(),
}));

const { requestPasswordReset, resetPassword } =
  require('../src/controllers/authController') as typeof import('../src/controllers/authController');
const { RESET_COOLDOWN_MS, RESET_DAILY_FAILURES, RESET_DAILY_SENDS, RESET_WINDOW_MS } =
  require('../src/services/passwordResetBudget') as typeof import('../src/services/passwordResetBudget');
const { MAX_OTP_ATTEMPTS } = require('../src/services/otpService') as typeof import('../src/services/otpService');

const createResponse = () => {
  const response: any = { statusCode: 200, body: null };
  response.status = jest.fn((code: number) => { response.statusCode = code; return response; });
  response.json = jest.fn((body: any) => { response.body = body; return response; });
  return response;
};

const request = async () => {
  const res = createResponse();
  await requestPasswordReset({ body: { email: 'eve@example.test' } } as any, res);
  return res;
};
const guess = async (otp: string) => {
  const res = createResponse();
  await resetPassword({ body: { email: 'eve@example.test', otp, newPassword: 'NewPass123!' } } as any, res);
  return res;
};
const wrongCode = () => (row.otp === '000000' ? '111111' : '000000');

let clock = new Date('2026-11-10T08:00:00Z').getTime();
const advance = (ms: number) => { clock += ms; jest.setSystemTime(clock); };

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  jest.setSystemTime(clock);
  mockSendReset.mockClear();
  row = {
    id: 'user-1', email: 'eve@example.test', username: 'eve', password: 'old',
    otp: null, otpPurpose: null, otpExpiresAt: null, otpAttempts: 0,
    passwordResetWindowStart: null, passwordResetSentCount: 0, passwordResetLastSentAt: null, passwordResetFailedCount: 0,
  };
});
afterEach(() => jest.useRealTimers());

describe('sending reset codes', () => {
  it('waits out the cooldown before sending another code, with the same reply', async () => {
    const first = await request();
    advance(RESET_COOLDOWN_MS - 1000);
    const tooSoon = await request();

    expect(mockSendReset).toHaveBeenCalledTimes(1);
    expect(tooSoon.body).toEqual(first.body);

    advance(1000);
    await request();
    expect(mockSendReset).toHaveBeenCalledTimes(2);
  });

  it('sends at most the daily number of codes, then again once the window has passed', async () => {
    for (let i = 0; i < RESET_DAILY_SENDS + 2; i++) {
      await request();
      advance(RESET_COOLDOWN_MS);
    }
    expect(mockSendReset).toHaveBeenCalledTimes(RESET_DAILY_SENDS);

    advance(RESET_WINDOW_MS);
    await request();
    expect(mockSendReset).toHaveBeenCalledTimes(RESET_DAILY_SENDS + 1);
  });

  it('sends one code when two requests arrive together', async () => {
    await Promise.all([request(), request(), request()]);
    expect(mockSendReset).toHaveBeenCalledTimes(1);
  });
});

describe('guessing reset codes', () => {
  it('keeps counting wrong guesses across reissued codes', async () => {
    const statuses: number[] = [];
    while (statuses.length < RESET_DAILY_FAILURES) {
      if (!row.otp) {
        advance(RESET_COOLDOWN_MS);
        await request();
      }
      statuses.push((await guess(wrongCode())).statusCode);
    }
    expect(statuses.every((s) => s === 400)).toBe(true);
    expect(row.passwordResetFailedCount).toBe(RESET_DAILY_FAILURES);

    // Out of guesses for the day: no new code is sent, so nothing more can be tried.
    advance(RESET_COOLDOWN_MS);
    const sent = mockSendReset.mock.calls.length;
    await request();
    expect(mockSendReset.mock.calls.length).toBe(sent);
  });

  it('refuses guesses past the budget even with a live code', async () => {
    await request();
    row.passwordResetFailedCount = RESET_DAILY_FAILURES;
    const res = await guess(row.otp);
    expect(res.statusCode).toBe(429);
    expect(row.password).toBe('old');
    expect(row.otp).toBeNull();
  });

  it('lets parallel guesses use at most one code\'s attempts', async () => {
    await request();
    const code = row.otp;
    const results = await Promise.all(Array.from({ length: 20 }, () => guess(wrongCode())));
    expect(results.filter((r) => r.statusCode === 400).length).toBeGreaterThan(0);
    expect(row.passwordResetFailedCount).toBe(MAX_OTP_ATTEMPTS);
    expect(row.otp).not.toBe(code);
  });

  it('refills the budget after a successful reset', async () => {
    await request();
    await guess(wrongCode());
    const res = await guess(row.otp);
    expect(res.statusCode).toBe(200);
    expect(row.passwordResetFailedCount).toBe(0);
    expect(row.passwordResetSentCount).toBe(0);
  }, 30000);
});
