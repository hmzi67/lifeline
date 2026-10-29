import jwt from 'jsonwebtoken';

const mockPrisma = {
  refreshToken: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { logout, refreshToken } = require('../src/controllers/authController') as typeof import('../src/controllers/authController');

const createResponse = () => {
  const response: any = { cookies: {}, cleared: [] as string[], statusCode: 0, body: undefined };
  response.cookie = jest.fn((name: string, value: string, options: any) => {
    response.cookies[name] = { value, options };
    return response;
  });
  response.clearCookie = jest.fn((name: string) => {
    response.cleared.push(name);
    return response;
  });
  response.set = jest.fn(() => response);
  response.status = jest.fn((code: number) => {
    response.statusCode = code;
    return response;
  });
  response.json = jest.fn((body: unknown) => {
    response.body = body;
    return response;
  });
  return response;
};

// The web client sends no body: the refresh token travels only as the httpOnly cookie.
const cookieRequest = (cookie: string) => ({ headers: { cookie }, body: {} }) as any;

describe('refresh token cookie (web)', () => {
  const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d', jwtid: 'web' });

  beforeEach(() => {
    for (const mock of Object.values(mockPrisma.refreshToken)) mock.mockReset();
    mockPrisma.$transaction.mockReset();
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  it('refreshes a session from the refreshToken cookie alone', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'stored',
      user: { id: 'user-1', email: 'user@example.com', roleId: null },
    });
    const response = createResponse();

    await refreshToken(cookieRequest(`theme=light; refreshToken=${token}`), response);

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.refreshToken.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ token, userId: 'user-1' }),
    }));
    expect(response.cookies.refreshToken.options).toEqual(expect.objectContaining({ httpOnly: true }));
  });

  it('returns 401 when there is no cookie and no body token', async () => {
    const response = createResponse();

    await refreshToken({ headers: {}, body: {} } as any, response);

    expect(response.statusCode).toBe(401);
  });

  it('treats a malformed cookie as missing', async () => {
    const response = createResponse();

    await refreshToken(cookieRequest('refreshToken=%E0%A4%A'), response);

    expect(response.statusCode).toBe(401);
  });

  it('revokes the cookie token on logout', async () => {
    const response = createResponse();

    await logout(cookieRequest(`refreshToken=${token}`), response);

    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { token } });
    expect(response.cleared).toContain('refreshToken');
  });
});
