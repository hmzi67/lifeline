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
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { appleMobileAuth } = require('../src/controllers/authController') as typeof import('../src/controllers/authController');
const { resetAppleSigningKeyCacheForTests } = require('../src/services/appleIdentityService') as typeof import('../src/services/appleIdentityService');

type MockResponse = {
  statusCode: number;
  body: any;
  status: jest.Mock;
  json: jest.Mock;
};

const createResponse = (): MockResponse => {
  const response = { statusCode: 0, body: null } as MockResponse;
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

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: 'jwk' }),
  alg: 'RS256',
  kid: 'apple-test-key',
  use: 'sig',
};

const createIdentityToken = (audience = 'com.irtaza.lifeline') => jwt.sign(
  {
    sub: 'apple-subject',
    email: 'apple.user@example.com',
    email_verified: 'true',
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

describe('Apple mobile authentication', () => {
  beforeEach(() => {
    process.env.APPLE_CLIENT_IDS = 'com.irtaza.lifeline';
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

  it('fails closed when no Apple audience is configured', async () => {
    delete process.env.APPLE_CLIENT_IDS;
    const response = createResponse();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await appleMobileAuth(
      { body: { identityToken: createIdentityToken() } } as any,
      response as any,
    );

    expect(response.statusCode).toBe(503);
    expect(response.body.message).toBe('Apple authentication is not configured');
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a correctly signed token for a different app audience', async () => {
    const response = createResponse();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await appleMobileAuth(
      { body: { identityToken: createIdentityToken('another.app') } } as any,
      response as any,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Invalid or expired Apple identity token');
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('creates a user only after verifying the Apple signature and claims', async () => {
    const createdUser = {
      id: 'user-apple',
      email: 'apple.user@example.com',
      username: 'apple',
      subject: 'apple-subject',
      profileImage: null,
      roleId: null,
      isEmailVerified: true,
      status: 'active',
    };
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(createdUser);
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'refresh-record' });
    const response = createResponse();

    await appleMobileAuth(
      {
        body: {
          identityToken: createIdentityToken(),
          firstName: 'Apple',
          lastName: 'User',
        },
      } as any,
      response as any,
    );

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'apple.user@example.com',
        subject: 'apple-subject',
        isEmailVerified: true,
      }),
    }));
    expect(response.body.data.user).toEqual(createdUser);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(global.fetch).toHaveBeenCalledWith(
      'https://appleid.apple.com/auth/keys',
      { headers: { Accept: 'application/json' } },
    );
  });

  it('does not relink an email that belongs to another Apple subject', async () => {
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.subject) return null;
      if (where.email) {
        return {
          id: 'existing-user',
          email: 'apple.user@example.com',
          username: 'existing',
          subject: 'different-apple-subject',
          profileImage: null,
          roleId: null,
          isEmailVerified: true,
          status: 'active',
        };
      }
      return null;
    });
    const response = createResponse();

    await appleMobileAuth(
      { body: { identityToken: createIdentityToken() } } as any,
      response as any,
    );

    expect(response.statusCode).toBe(409);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });
});
