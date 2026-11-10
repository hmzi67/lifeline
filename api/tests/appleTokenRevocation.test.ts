import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  decryptAppleToken,
  encryptAppleToken,
  exchangeAppleAuthorizationCode,
  isAppleTokenRevocationConfigured,
  revokeAppleRefreshToken,
} from '../src/services/appleTokenService';
import { deleteUserAndData } from '../src/services/accountDeletionService';

const BUNDLE_ID = 'com.irtaza.lifeline';
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const ENV_KEYS = ['APPLE_TEAM_ID', 'APPLE_SIGNIN_KEY_ID', 'APPLE_SIGNIN_PRIVATE_KEY', 'APPLE_SIGNIN_PRIVATE_KEY_PATH'];
const saved: Record<string, string | undefined> = {};

const configure = () => {
  process.env.APPLE_TEAM_ID = 'TEAM123456';
  process.env.APPLE_SIGNIN_KEY_ID = 'KEY1234567';
  process.env.APPLE_SIGNIN_PRIVATE_KEY = PRIVATE_PEM.replace(/\n/g, '\\n');
};

const formOf = (call: unknown[]) => new URLSearchParams((call[1] as RequestInit).body as string);

describe('Sign in with Apple token revocation', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    for (const key of ENV_KEYS) delete process.env[key];
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('round-trips the encrypted refresh token and rejects tampering', () => {
    const stored = encryptAppleToken('r.refresh-token');
    expect(stored).not.toContain('r.refresh-token');
    expect(decryptAppleToken(stored)).toBe('r.refresh-token');

    const [v, iv, tag, data] = stored.split(':');
    const flipped = data[0] === 'A' ? `B${data.slice(1)}` : `A${data.slice(1)}`;
    expect(() => decryptAppleToken([v, iv, tag, flipped].join(':'))).toThrow();
  });

  it('does nothing without a Sign in with Apple key', async () => {
    expect(isAppleTokenRevocationConfigured()).toBe(false);
    await expect(exchangeAppleAuthorizationCode('code', BUNDLE_ID)).resolves.toBeNull();
    await expect(revokeAppleRefreshToken('token', BUNDLE_ID)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exchanges the authorization code with a client secret Apple accepts', async () => {
    configure();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ refresh_token: 'r.abc' }), { status: 200 }));

    await expect(exchangeAppleAuthorizationCode('c.code', BUNDLE_ID)).resolves.toBe('r.abc');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://appleid.apple.com/auth/token');
    const form = formOf(fetchMock.mock.calls[0]);
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('c.code');
    expect(form.get('client_id')).toBe(BUNDLE_ID);

    // Client secret claims per Apple's "Creating a client secret".
    const secret = form.get('client_secret')!;
    const decoded = jwt.verify(secret, publicKey, { algorithms: ['ES256'], complete: true });
    const payload = decoded.payload as jwt.JwtPayload;
    expect(decoded.header.kid).toBe('KEY1234567');
    expect(payload.iss).toBe('TEAM123456');
    expect(payload.aud).toBe('https://appleid.apple.com');
    expect(payload.sub).toBe(BUNDLE_ID);
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(15777000);
  });

  it('returns null when Apple refuses the code', async () => {
    configure();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
    await expect(exchangeAppleAuthorizationCode('expired', BUNDLE_ID)).resolves.toBeNull();
  });

  it('revokes the refresh token', async () => {
    configure();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await expect(revokeAppleRefreshToken('r.abc', BUNDLE_ID)).resolves.toBe(true);

    expect(fetchMock.mock.calls[0][0]).toBe('https://appleid.apple.com/auth/revoke');
    const form = formOf(fetchMock.mock.calls[0]);
    expect(form.get('token')).toBe('r.abc');
    expect(form.get('token_type_hint')).toBe('refresh_token');
    expect(form.get('client_id')).toBe(BUNDLE_ID);
  });

  describe('account deletion', () => {
    const makePrisma = (appleRefreshToken: string | null) => {
      const deletedRow = { id: 'u1', appleRefreshToken, appleClientId: appleRefreshToken ? BUNDLE_ID : null };
      const tx = new Proxy({}, {
        get: (_t, model: string) => model === 'user'
          ? { delete: jest.fn().mockResolvedValue(deletedRow) }
          : { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      });
      return { $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)) } as any;
    };

    it('revokes the stored Apple token after deleting the account', async () => {
      configure();
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

      await expect(deleteUserAndData(makePrisma(encryptAppleToken('r.stored')), 'u1')).resolves.toEqual({ id: 'u1' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(formOf(fetchMock.mock.calls[0]).get('token')).toBe('r.stored');
    });

    it('still deletes the account when Apple is unreachable', async () => {
      configure();
      fetchMock.mockRejectedValue(new Error('network down'));
      await expect(deleteUserAndData(makePrisma(encryptAppleToken('r.stored')), 'u1')).resolves.toEqual({ id: 'u1' });
    });

    it('skips revocation for accounts without an Apple token', async () => {
      configure();
      await deleteUserAndData(makePrisma(null), 'u1');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
