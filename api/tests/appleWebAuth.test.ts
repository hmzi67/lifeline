import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
  },
  oauthLoginCode: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { appleAuth, appleAuthCallback } = require('../src/controllers/authController') as typeof import('../src/controllers/authController');
const { resetAppleSigningKeyCacheForTests } = require('../src/services/appleIdentityService') as typeof import('../src/services/appleIdentityService');

const SERVICES_ID = 'com.irtaza.lifeline.web';
const FRONTEND_URL = 'https://www.makelifeline.com';

const createResponse = () => {
  const response: any = { cookies: {}, cleared: [] as string[], location: '' };
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
  return response;
};

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: 'jwk' }),
  alg: 'RS256',
  kid: 'apple-test-key',
  use: 'sig',
};

const createIdentityToken = (nonce: string, audience = SERVICES_ID) => jwt.sign(
  {
    sub: 'apple-subject',
    email: 'apple.user@example.com',
    email_verified: 'true',
    nonce,
  },
  privateKey,
  {
    algorithm: 'RS256',
    audience,
    issuer: 'https://appleid.apple.com',
    keyid: 'apple-test-key',
    expiresIn: '5m',
  },
);

const appleStartRequest = (host = 'www.makelifeline.com', query: Record<string, string> = {}) => ({
  get: (name: string) => (name.toLowerCase() === 'host' ? host : undefined),
  query,
}) as any;

/** Starts the flow and returns the state/nonce Apple would echo back. */
const startFlow = () => {
  const response = createResponse();
  appleAuth(appleStartRequest(), response);
  const authorizeUrl = new URL(response.location);
  return {
    cookie: `apple_oauth=${encodeURIComponent(response.cookies.apple_oauth.value)}`,
    state: authorizeUrl.searchParams.get('state')!,
    nonce: authorizeUrl.searchParams.get('nonce')!,
    authorizeUrl,
    response,
  };
};

const callbackResult = (response: any) => new URL(response.location).searchParams;

describe('Apple web authentication', () => {
  beforeEach(() => {
    process.env.APPLE_CLIENT_IDS = `com.irtaza.lifeline,${SERVICES_ID}`;
    process.env.APPLE_WEB_SERVICES_ID = SERVICES_ID;
    process.env.APPLE_WEB_REDIRECT_URI = 'https://www.makelifeline.com/api/auth/apple/callback';
    process.env.FRONTEND_URL = FRONTEND_URL;
    resetAppleSigningKeyCacheForTests();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ keys: [publicJwk] }),
    } as Response);
    for (const group of Object.values(mockPrisma)) {
      for (const mock of Object.values(group)) mock.mockReset();
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('redirects to Apple with a form_post request bound to a state cookie', () => {
    const { authorizeUrl, response } = startFlow();

    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe('https://appleid.apple.com/auth/authorize');
    expect(authorizeUrl.searchParams.get('client_id')).toBe(SERVICES_ID);
    expect(authorizeUrl.searchParams.get('response_mode')).toBe('form_post');
    expect(authorizeUrl.searchParams.get('scope')).toBe('name email');
    expect(response.cookies.apple_oauth.options).toEqual(expect.objectContaining({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    }));
  });

  it('sends the user back with an error when the web flow is not configured', () => {
    delete process.env.APPLE_WEB_SERVICES_ID;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = createResponse();

    appleAuth(appleStartRequest(), response);

    expect(response.location).toBe(`${FRONTEND_URL}/auth/callback?error=apple_not_configured`);
  });

  it('moves the flow to the return URL host so the state cookie comes back', () => {
    const response = createResponse();

    appleAuth(appleStartRequest('makelifeline.com'), response);

    expect(response.location).toBe('https://www.makelifeline.com/api/auth/apple?canonical=1');
    expect(response.cookies.apple_oauth).toBeUndefined();
  });

  it('does not redirect twice when a proxy hides the original host', () => {
    const response = createResponse();

    appleAuth(appleStartRequest('api:3000', { canonical: '1' }), response);

    expect(response.location.startsWith('https://appleid.apple.com/auth/authorize?')).toBe(true);
  });

  it('signs the user in after verifying state, nonce and the Apple signature', async () => {
    const { cookie, state, nonce } = startFlow();
    const createdUser = {
      id: 'user-apple',
      email: 'apple.user@example.com',
      username: 'jane',
      subject: 'apple-subject',
      profileImage: null,
      roleId: null,
      isEmailVerified: true,
      status: 'active',
    };
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(createdUser);
    mockPrisma.oauthLoginCode.create.mockResolvedValue({ id: 'code-record' });
    mockPrisma.oauthLoginCode.deleteMany.mockResolvedValue({ count: 0 });
    const response = createResponse();

    await appleAuthCallback({
      headers: { cookie },
      body: {
        state,
        id_token: createIdentityToken(nonce),
        user: JSON.stringify({ name: { firstName: 'Jane', lastName: 'Doe' } }),
      },
    } as any, response);

    expect(response.location.startsWith(`${FRONTEND_URL}/auth/callback?`)).toBe(true);
    // Only a single-use code goes in the URL; tokens come from the exchange.
    expect(callbackResult(response).get('code')).toEqual(expect.any(String));
    expect(callbackResult(response).get('token')).toBeNull();
    expect(response.cookies.refreshToken).toBeUndefined();
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    expect(response.cookies.oauth_login.options).toEqual(expect.objectContaining({ httpOnly: true, sameSite: 'lax' }));
    expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ username: 'jane', subject: 'apple-subject' }),
    }));
    expect(response.cleared).toContain('apple_oauth');
  });

  it('rejects a callback whose state does not match the cookie', async () => {
    const { cookie, nonce } = startFlow();
    const response = createResponse();

    await appleAuthCallback({
      headers: { cookie },
      body: { state: 'forged', id_token: createIdentityToken(nonce) },
    } as any, response);

    expect(callbackResult(response).get('error')).toBe('apple_failed');
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a replayed id_token issued for a different nonce', async () => {
    const { cookie, state } = startFlow();
    const response = createResponse();

    await appleAuthCallback({
      headers: { cookie },
      body: { state, id_token: createIdentityToken('other-nonce') },
    } as any, response);

    expect(callbackResult(response).get('error')).toBe('apple_failed');
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('reports a cancelled Apple consent without an error page', async () => {
    const { cookie } = startFlow();
    const response = createResponse();

    await appleAuthCallback({
      headers: { cookie },
      body: { error: 'user_cancelled_authorize' },
    } as any, response);

    expect(callbackResult(response).get('error')).toBe('apple_cancelled');
  });

  it('does not relink an email that belongs to another Apple subject', async () => {
    const { cookie, state, nonce } = startFlow();
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: any) => (
      where.email ? { id: 'existing', email: 'apple.user@example.com', subject: 'different-subject' } : null
    ));
    const response = createResponse();

    await appleAuthCallback({
      headers: { cookie },
      body: { state, id_token: createIdentityToken(nonce) },
    } as any, response);

    expect(callbackResult(response).get('error')).toBe('apple_account_conflict');
    expect(mockPrisma.oauthLoginCode.create).not.toHaveBeenCalled();
  });
});
