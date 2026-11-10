import { createHash, generateKeyPairSync } from 'node:crypto';
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

const BUNDLE_ID = 'com.irtaza.lifeline';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...publicKey.export({ format: 'jwk' }), alg: 'RS256', kid: 'apple-test-key', use: 'sig' };

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const identityToken = (nonce?: string) => jwt.sign(
  { sub: 'apple-subject', email: 'apple.user@example.com', email_verified: 'true', ...(nonce ? { nonce } : {}) },
  privateKey,
  { algorithm: 'RS256', audience: BUNDLE_ID, issuer: 'https://appleid.apple.com', keyid: 'apple-test-key', expiresIn: '5m' },
);

const respond = async (body: Record<string, unknown>) => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.set = jest.fn(() => res);
  res.cookie = jest.fn(() => res);
  await appleMobileAuth({ body } as any, res);
  return { status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0] };
};

describe('native Sign in with Apple nonce', () => {
  beforeEach(() => {
    process.env.APPLE_CLIENT_IDS = BUNDLE_ID;
    resetAppleSigningKeyCacheForTests();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ keys: [publicJwk] }),
    } as Response);
    for (const group of Object.values(mockPrisma)) {
      for (const mock of Object.values(group)) mock.mockReset();
    }
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-apple',
      email: 'apple.user@example.com',
      username: 'jane',
      subject: 'apple-subject',
      profileImage: null,
      roleId: null,
      isEmailVerified: true,
      status: 'active',
    });
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'refresh' });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('signs in when the raw nonce hashes to the nonce in the token', async () => {
    const raw = 'a'.repeat(64);
    const { status } = await respond({ identityToken: identityToken(sha256(raw)), nonce: raw });
    expect(status).toBe(200);
  });

  it('refuses a token whose nonce does not match', async () => {
    const { status } = await respond({ identityToken: identityToken(sha256('original')), nonce: 'attacker' });
    expect(status).toBe(401);
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('refuses a replayed token sent without its raw nonce', async () => {
    const { status } = await respond({ identityToken: identityToken(sha256('original')) });
    expect(status).toBe(401);
  });

  it('still accepts tokens from app builds that do not send a nonce', async () => {
    const { status } = await respond({ identityToken: identityToken() });
    expect(status).toBe(200);
  });
});
