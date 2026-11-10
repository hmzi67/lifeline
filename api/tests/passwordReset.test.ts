export {};

const mockPrisma: any = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
  refreshToken: { deleteMany: jest.fn() },
  $transaction: jest.fn(async (ops: unknown[]) => ops),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock('../src/services/emailService', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/otpService', () => ({
  ...jest.requireActual('../src/services/otpService'),
  checkOtp: jest.fn(() => 'ok'),
}));

const { requestPasswordReset, resetPassword } =
  require('../src/controllers/authController') as typeof import('../src/controllers/authController');

const createResponse = () => {
  const response: any = { statusCode: 200, body: null };
  response.status = jest.fn((code: number) => { response.statusCode = code; return response; });
  response.json = jest.fn((body: any) => { response.body = body; return response; });
  return response;
};

describe('password reset', () => {
  beforeEach(() => jest.clearAllMocks());

  it('gives the same reply whether or not the email has an account', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const unknown = createResponse();
    await requestPasswordReset({ body: { email: 'ghost@example.test' } } as any, unknown);

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', email: 'eve@example.test', username: 'eve' });
    const known = createResponse();
    await requestPasswordReset({ body: { email: 'eve@example.test' } } as any, known);

    expect(known.statusCode).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it('finds the account case-insensitively, like the request that issued the code', async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'user-1', email: 'eve@example.test', otp: '123456', otpPurpose: 'reset_password', otpAttempts: 0, passwordResetFailedCount: 0, passwordResetWindowStart: new Date() });
    const res = createResponse();

    await resetPassword({ body: { email: ' Eve@Example.TEST ', otp: '123456', newPassword: 'NewPass1234!' } } as any, res);

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({ where: { email: 'eve@example.test' } });
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    // Hashes the new password at production bcrypt cost, which can pass 5s in a parallel run.
  }, 30000);

  it('refuses a new password shorter than 12 characters', async () => {
    const res = createResponse();
    await resetPassword({ body: { email: 'eve@example.test', otp: '123456', newPassword: 'Short1234!x' } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Password must be at least 12 characters long');
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });
});
