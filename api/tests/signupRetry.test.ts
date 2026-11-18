export {};

// Signing up again with an email whose earlier sign-up was never verified restarts that
// sign-up instead of failing with "already exists".

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(async () => null),
    create: jest.fn(async ({ data }: any) => ({ id: 'new-user', roleId: null, ...data })),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, email: 'a@example.test', roleId: null, ...data })),
  },
  refreshToken: {
    create: jest.fn(async ({ data }: any) => data),
    deleteMany: jest.fn(async () => ({ count: 1 })),
  },
  $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};
const mockSendVerification = jest.fn(async () => undefined);

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));
jest.mock('../src/services/emailService', () => ({
  __esModule: true,
  ...jest.requireActual('../src/services/emailService'),
  sendEmailVerificationEmail: mockSendVerification,
}));

const { signup } = require('../src/controllers/authController') as typeof import('../src/controllers/authController');

type MockResponse = { statusCode: number; body: any; status: jest.Mock; json: jest.Mock; cookie: jest.Mock };

const createResponse = (): MockResponse => {
  const response = { statusCode: 200, body: null } as MockResponse;
  response.cookie = jest.fn(() => response);
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

const body = { email: 'a@example.test', name: 'New Name', password: 'a-long-password-1' };

const existing = (overrides: Record<string, unknown>) => ({
  id: 'old-user',
  email: 'a@example.test',
  username: 'a',
  status: 'pending',
  isEmailVerified: false,
  googleId: null,
  subject: null,
  ...overrides,
});

describe('signup with an email that already has an account', () => {
  beforeEach(() => jest.clearAllMocks());

  it('restarts an unverified sign-up: new password and code, old sessions ended', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(existing({}));
    const res = createResponse();
    await signup({ body } as any, res as any);

    expect(res.statusCode).toBe(201);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'old-user' } });
    const update = mockPrisma.user.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'old-user' });
    expect(update.data.displayName).toBe('New Name');
    expect(update.data.password).not.toBe(body.password);
    expect(update.data.otpPurpose).toBe('verify_email');
    expect(mockSendVerification).toHaveBeenCalled();
  });

  it.each([
    ['a verified account', { status: 'active', isEmailVerified: true }],
    ['a Google account', { googleId: 'google-1' }],
    ['an Apple account', { subject: 'apple-1' }],
    ['a suspended account', { status: 'suspended' }],
  ])('refuses %s', async (_label, overrides) => {
    mockPrisma.user.findFirst.mockResolvedValue(existing(overrides));
    const res = createResponse();
    await signup({ body } as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('User with this email already exists');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
  });
});
