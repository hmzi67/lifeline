import jwt from 'jsonwebtoken';

const mockPrisma = {
  refreshToken: {
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { refreshToken } = require('../src/controllers/authController') as typeof import('../src/controllers/authController');

const createResponse = () => {
  const response: any = { statusCode: 0, body: undefined };
  response.cookie = jest.fn(() => response);
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

const user = { id: 'user-1', email: 'user@example.com', roleId: null, status: 'active' };
const tokenA = jwt.sign({ userId: 'user-1' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d', jwtid: 'a' });
const refreshWith = async (token: string) => {
  const response = createResponse();
  await refreshToken({ headers: {}, body: { refreshToken: token } } as any, response);
  return response;
};

describe('refresh token rotation', () => {
  beforeEach(() => {
    for (const mock of Object.values(mockPrisma.refreshToken)) mock.mockReset();
    mockPrisma.$transaction.mockReset();
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockPrisma));
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'b', token: 'token-b' });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  });

  it('issues a replacement and keeps the presented token valid until it is used', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValueOnce({ id: 'a', replacedById: null, user });

    const response = await refreshWith(tokenA);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.refreshToken).toBe('token-b');
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    // Linked, not expired: the old token's expiry is left alone.
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'a', replacedById: null },
      data: { replacedById: 'b' },
    });
    expect(mockPrisma.refreshToken.updateMany.mock.calls[0][0].data).not.toHaveProperty('expiresAt');
  });

  it('resends the unused replacement when the reply was lost', async () => {
    mockPrisma.refreshToken.findFirst
      .mockResolvedValueOnce({ id: 'a', replacedById: 'b', user })
      .mockResolvedValueOnce({ id: 'b', token: 'token-b' });

    const response = await refreshWith(tokenA);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.refreshToken).toBe('token-b');
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('retires the previous token once its replacement is used', async () => {
    const tokenB = jwt.sign({ userId: 'user-1' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d', jwtid: 'b' });
    mockPrisma.refreshToken.findFirst.mockResolvedValueOnce({ id: 'b', replacedById: null, user });
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'c', token: 'token-c' });

    const response = await refreshWith(tokenB);

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { replacedById: 'b' } });
  });

  it('hands both racing refreshes the same replacement', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValueOnce({ id: 'a', replacedById: null, user });
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'loser', token: 'token-loser' });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.refreshToken.findUnique
      .mockResolvedValueOnce({ replacedById: 'winner' })
      .mockResolvedValueOnce({ id: 'winner', token: 'token-winner' });

    const response = await refreshWith(tokenA);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.refreshToken).toBe('token-winner');
    expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'loser' } });
  });

  it('rejects a token that was already replaced and retired', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValueOnce(null);

    const response = await refreshWith(tokenA);

    expect(response.statusCode).toBe(401);
  });
});
