export {};

// How a signed-in user confirms deleting their own account: password-only accounts re-enter
// the password; accounts that also sign in with Google/Apple may type DELETE instead.

const mockPrisma = {
  user: { findUnique: jest.fn() },
};
const mockDeleteUserAndData = jest.fn(async () => undefined);

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));
jest.mock('../src/services/accountDeletionService', () => ({
  deleteUserAndData: mockDeleteUserAndData,
}));

const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
const { deleteOwnAccount } = require('../src/controllers/userController') as typeof import('../src/controllers/userController');

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

const request = (body: Record<string, unknown>) =>
  ({ body, user: { id: 'user-1', email: 'a@example.test', role: 'user' } }) as any;

const account = async (overrides: Record<string, unknown>) => ({
  id: 'user-1',
  email: 'a@example.test',
  password: await bcrypt.hash('right-password', 4),
  googleId: null,
  subject: null,
  ...overrides,
});

describe('deleteOwnAccount confirmation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('makes a password-only account re-enter its password, not type DELETE', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(await account({}));
    const res = createResponse();
    await deleteOwnAccount(request({ confirmation: 'DELETE' }), res as any);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('PASSWORD_REQUIRED');
    expect(mockDeleteUserAndData).not.toHaveBeenCalled();
  });

  it('lets an email account later linked to Google confirm with DELETE', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(await account({ googleId: 'google-1' }));
    const res = createResponse();
    await deleteOwnAccount(request({ confirmation: 'DELETE' }), res as any);
    expect(res.statusCode).toBe(200);
    expect(mockDeleteUserAndData).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  it('lets an account linked to Apple confirm with DELETE', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(await account({ subject: 'apple-1' }));
    const res = createResponse();
    await deleteOwnAccount(request({ confirmation: 'DELETE' }), res as any);
    expect(res.statusCode).toBe(200);
  });

  it('still checks a password that a linked account chooses to send', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(await account({ googleId: 'google-1' }));
    const res = createResponse();
    await deleteOwnAccount(request({ password: 'wrong-password' }), res as any);
    expect(res.statusCode).toBe(403);
    expect(mockDeleteUserAndData).not.toHaveBeenCalled();
  });

  it('refuses a linked account that sends neither DELETE nor a password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(await account({ googleId: 'google-1' }));
    const res = createResponse();
    await deleteOwnAccount(request({}), res as any);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('CONFIRMATION_REQUIRED');
    expect(mockDeleteUserAndData).not.toHaveBeenCalled();
  });
});
