export {};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    deleteMany: jest.fn(async () => ({ count: 2 })),
    create: jest.fn(async ({ data }: any) => data),
  },
  $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const mockAuthenticate = jest.fn((_req, _res, next) => next());
const mockAdminAuthorization = jest.fn((_req, _res, next) => next());
const mockAuthorize = jest.fn(() => mockAdminAuthorization);

jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: mockAuthenticate,
}));

jest.mock('../src/middleware/authorize', () => ({
  __esModule: true,
  default: mockAuthorize,
}));

const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
const { updateOwnProfile } = require('../src/controllers/userController') as typeof import('../src/controllers/userController');
const roleRouter = require('../src/routes/roleRoutes').default;

type MockResponse = { statusCode: number; body: any; status: jest.Mock; json: jest.Mock; set: jest.Mock };

const createResponse = (): MockResponse => {
  const response = { statusCode: 200, body: null } as MockResponse;
  response.set = jest.fn(() => response);
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

const ownRequest = (body: Record<string, unknown>) =>
  ({
    params: { id: 'user-1' },
    body,
    user: { id: 'user-1', email: 'a@example.test', role: 'user' },
    protocol: 'https',
    get: () => 'api.example.test',
  }) as any;

describe('updateOwnProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.update.mockImplementation(async ({ data }: any) => ({ id: 'user-1', ...data }));
  });

  it('ignores role, status, subject and email so a user cannot escalate privileges', async () => {
    const res = createResponse();

    await updateOwnProfile(
      ownRequest({ username: 'elsa', roleId: 'admin-role', status: 'active', subject: 'x', email: 'b@example.test' }),
      res as any,
    );

    expect(res.statusCode).toBe(200);
    const { data } = mockPrisma.user.update.mock.calls[0][0];
    expect(data).toEqual({ username: 'elsa' });
  });

  it('rejects a request that only carries admin-only fields', async () => {
    const res = createResponse();

    await updateOwnProfile(ownRequest({ roleId: 'admin-role' }), res as any);

    expect(res.statusCode).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('requires the current password before changing an existing password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ password: await bcrypt.hash('old-password', 4) });

    const missing = createResponse();
    await updateOwnProfile(ownRequest({ password: 'new-password' }), missing as any);
    expect(missing.statusCode).toBe(400);

    const wrong = createResponse();
    await updateOwnProfile(ownRequest({ password: 'new-password', currentPassword: 'nope' }), wrong as any);
    expect(wrong.statusCode).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();

    const ok = createResponse();
    await updateOwnProfile(ownRequest({ password: 'new-password', currentPassword: 'old-password' }), ok as any);
    expect(ok.statusCode).toBe(200);
    const { data } = mockPrisma.user.update.mock.calls[0][0];
    expect(await bcrypt.compare('new-password', data.password)).toBe(true);
    // Every existing session ends; this device gets a fresh one.
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(ok.body.data.session).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    expect(mockPrisma.refreshToken.create.mock.calls[0][0].data.token).toBe(ok.body.data.session.refreshToken);
    // The controller hashes at production cost; under a parallel run that can pass 5s.
  }, 30000);

  it('keeps sessions when the password is not changed', async () => {
    const res = createResponse();
    await updateOwnProfile(ownRequest({ username: 'elsa' }), res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.session).toBeUndefined();
    expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
  });

  it('lets an OAuth account without a password set its first password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ password: null });
    const res = createResponse();

    await updateOwnProfile(ownRequest({ password: 'first-password' }), res as any);

    expect(res.statusCode).toBe(200);
  });
});

describe('role routes', () => {
  it('require admin authorization for reads as well as writes', () => {
    for (const layer of roleRouter.stack as Array<{ route?: { stack: Array<{ handle: unknown }> } }>) {
      if (!layer.route) continue;
      const handlers = layer.route.stack.map((entry) => entry.handle);
      expect(handlers[0]).toBe(mockAuthenticate);
      expect(handlers[1]).toBe(mockAdminAuthorization);
    }
  });
});
