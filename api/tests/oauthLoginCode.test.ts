import { createHash } from 'node:crypto';

const mockPrisma = {
  refreshToken: {
    create: jest.fn(),
  },
  oauthLoginCode: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Stand-in for Passport: googleAuthCallback hands its verify callback to
// passport.authenticate, and each test decides what Google "returned".
let mockGoogleResult: { err: unknown; user: unknown } = { err: null, user: null };
jest.mock('passport', () => ({
  authenticate: jest.fn((_strategy: string, _options: unknown, callback: (err: unknown, user: unknown) => void) => (
    () => callback(mockGoogleResult.err, mockGoogleResult.user)
  )),
}));

const { exchangeOAuthLoginCode, googleAuthCallback } = require('../src/controllers/authController') as typeof import('../src/controllers/authController');

const FRONTEND_URL = 'https://www.makelifeline.com';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const createResponse = () => {
  const response: any = { cookies: {}, cleared: [] as string[], location: '', statusCode: 0, body: undefined };
  response.cookie = jest.fn((name: string, value: string, options: any) => {
    response.cookies[name] = { value, options };
    return response;
  });
  response.clearCookie = jest.fn((name: string) => {
    response.cleared.push(name);
    return response;
  });
  response.redirect = jest.fn((location: string) => {
    response.location = location;
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

const exchangeRequest = (code: unknown, binding?: string) => ({
  headers: binding ? { cookie: `oauth_login=${encodeURIComponent(binding)}` } : {},
  body: { code },
}) as any;

const storedCode = (overrides: Record<string, unknown> = {}) => ({
  id: 'code-record',
  codeHash: sha256('the-code'),
  bindingHash: sha256('the-binding'),
  userId: 'user-1',
  expiresAt: new Date(Date.now() + 30 * 1000),
  user: { id: 'user-1', email: 'user@example.com', roleId: null, status: 'active' },
  ...overrides,
});

describe('web OAuth sign-in code', () => {
  beforeEach(() => {
    process.env.FRONTEND_URL = FRONTEND_URL;
    mockGoogleResult = { err: null, user: null };
    for (const group of Object.values(mockPrisma)) {
      for (const mock of Object.values(group)) mock.mockReset();
    }
    mockPrisma.oauthLoginCode.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'refresh-record' });
  });

  it('redirects from Google with a single-use code and no tokens', async () => {
    mockGoogleResult = { err: null, user: { id: 'user-1', email: 'user@example.com', roleId: null } };
    mockPrisma.oauthLoginCode.create.mockResolvedValue({ id: 'code-record' });
    const response = createResponse();

    googleAuthCallback({} as any, response);
    await new Promise(setImmediate);

    const redirect = new URL(response.location);
    expect(redirect.origin + redirect.pathname).toBe(`${FRONTEND_URL}/auth/callback`);
    expect([...redirect.searchParams.keys()]).toEqual(['code']);
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();

    // Only hashes are stored, and the binding cookie matches the stored hash.
    const code = redirect.searchParams.get('code')!;
    const { data } = mockPrisma.oauthLoginCode.create.mock.calls[0][0];
    expect(data.codeHash).toBe(sha256(code));
    expect(data.bindingHash).toBe(sha256(response.cookies.oauth_login.value));
    expect(data.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60 * 1000);
    expect(response.cookies.oauth_login.options).toEqual(expect.objectContaining({
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/auth/oauth',
    }));
  });

  it('exchanges a valid code once for an access token and refresh cookie', async () => {
    mockPrisma.oauthLoginCode.findUnique.mockResolvedValue(storedCode());
    const response = createResponse();

    await exchangeOAuthLoginCode(exchangeRequest('the-code', 'the-binding'), response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toBeUndefined();
    expect(response.cookies.refreshToken.options).toEqual(expect.objectContaining({ httpOnly: true }));
    expect(mockPrisma.oauthLoginCode.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { codeHash: sha256('the-code') },
    }));
    expect(mockPrisma.oauthLoginCode.deleteMany).toHaveBeenCalledWith({ where: { id: 'code-record' } });
    expect(response.cleared).toContain('oauth_login');
  });

  it('rejects a code presented without the browser binding cookie', async () => {
    const response = createResponse();

    await exchangeOAuthLoginCode(exchangeRequest('the-code'), response);

    expect(response.statusCode).toBe(401);
    expect(mockPrisma.oauthLoginCode.findUnique).not.toHaveBeenCalled();
  });

  it('rejects and burns a code presented from another browser', async () => {
    mockPrisma.oauthLoginCode.findUnique.mockResolvedValue(storedCode());
    const response = createResponse();

    await exchangeOAuthLoginCode(exchangeRequest('the-code', 'someone-elses-binding'), response);

    expect(response.statusCode).toBe(401);
    expect(mockPrisma.oauthLoginCode.deleteMany).toHaveBeenCalledWith({ where: { id: 'code-record' } });
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects a code that was already used', async () => {
    mockPrisma.oauthLoginCode.findUnique.mockResolvedValue(storedCode());
    mockPrisma.oauthLoginCode.deleteMany.mockResolvedValue({ count: 0 });
    const response = createResponse();

    await exchangeOAuthLoginCode(exchangeRequest('the-code', 'the-binding'), response);

    expect(response.statusCode).toBe(401);
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects an expired code', async () => {
    mockPrisma.oauthLoginCode.findUnique.mockResolvedValue(storedCode({ expiresAt: new Date(Date.now() - 1000) }));
    const response = createResponse();

    await exchangeOAuthLoginCode(exchangeRequest('the-code', 'the-binding'), response);

    expect(response.statusCode).toBe(401);
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown code', async () => {
    mockPrisma.oauthLoginCode.findUnique.mockResolvedValue(null);
    const response = createResponse();

    await exchangeOAuthLoginCode(exchangeRequest('made-up', 'the-binding'), response);

    expect(response.statusCode).toBe(401);
    expect(mockPrisma.oauthLoginCode.deleteMany).not.toHaveBeenCalled();
  });

  it('does not sign in a suspended account', async () => {
    mockPrisma.oauthLoginCode.findUnique.mockResolvedValue(storedCode({
      user: { id: 'user-1', email: 'user@example.com', roleId: null, status: 'suspended' },
    }));
    const response = createResponse();

    await exchangeOAuthLoginCode(exchangeRequest('the-code', 'the-binding'), response);

    expect(response.statusCode).toBe(403);
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });
});
