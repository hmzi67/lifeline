import { createPublicKey, JsonWebKey, KeyObject } from 'node:crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = `${APPLE_ISSUER}/auth/keys`;
const JWKS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type AppleJwk = JsonWebKey & {
  alg?: string;
  e?: string;
  kid: string;
  kty: string;
  n?: string;
  use?: string;
};

type AppleJwksResponse = {
  keys: AppleJwk[];
};

export interface AppleIdentityClaims extends JwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
}

export class AppleIdentityConfigurationError extends Error {}
export class AppleIdentityProviderError extends Error {}
export class AppleIdentityVerificationError extends Error {}

let cachedKeys: AppleJwk[] = [];
let cachedKeysExpiresAt = 0;

const getAllowedAudiences = (): string[] => {
  const audiences = (process.env.APPLE_CLIENT_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);

  if (audiences.length === 0) {
    throw new AppleIdentityConfigurationError('APPLE_CLIENT_IDS is not configured');
  }

  return audiences;
};

const fetchAppleKeys = async (forceRefresh = false): Promise<AppleJwk[]> => {
  if (!forceRefresh && cachedKeys.length > 0 && Date.now() < cachedKeysExpiresAt) {
    return cachedKeys;
  }

  let response: Response;
  try {
    response = await fetch(APPLE_JWKS_URL, {
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    throw new AppleIdentityProviderError(
      `Unable to retrieve Apple signing keys: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    throw new AppleIdentityProviderError(
      `Apple signing keys request failed with status ${response.status}`,
    );
  }

  const body = await response.json() as AppleJwksResponse;
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new AppleIdentityProviderError('Apple returned no signing keys');
  }

  cachedKeys = body.keys.filter(key => typeof key.kid === 'string' && key.kty === 'RSA');
  cachedKeysExpiresAt = Date.now() + JWKS_CACHE_TTL_MS;

  if (cachedKeys.length === 0) {
    throw new AppleIdentityProviderError('Apple returned no supported signing keys');
  }

  return cachedKeys;
};

const getSigningKey = async (kid: string): Promise<KeyObject> => {
  let keys = await fetchAppleKeys();
  let jwk = keys.find(key => key.kid === kid);

  // Apple can rotate keys before our cache expires. Refresh once when a token
  // references a key that is not in the cached set.
  if (!jwk) {
    keys = await fetchAppleKeys(true);
    jwk = keys.find(key => key.kid === kid);
  }

  if (!jwk) {
    throw new AppleIdentityVerificationError('Apple token signing key was not found');
  }

  try {
    return createPublicKey({ key: jwk, format: 'jwk' });
  } catch {
    throw new AppleIdentityVerificationError('Apple token signing key is invalid');
  }
};

export const verifyAppleIdentityToken = async (
  identityToken: string,
): Promise<AppleIdentityClaims> => {
  const audiences = getAllowedAudiences();
  const decoded = jwt.decode(identityToken, { complete: true });

  if (
    !decoded ||
    typeof decoded === 'string' ||
    decoded.header.alg !== 'RS256' ||
    typeof decoded.header.kid !== 'string'
  ) {
    throw new AppleIdentityVerificationError('Apple token header is invalid');
  }

  const publicKey = await getSigningKey(decoded.header.kid);

  let payload: string | JwtPayload;
  try {
    payload = jwt.verify(identityToken, publicKey, {
      algorithms: ['RS256'],
      audience: audiences as [string, ...string[]],
      issuer: APPLE_ISSUER,
    });
  } catch (error) {
    throw new AppleIdentityVerificationError(
      `Apple token verification failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !payload.sub) {
    throw new AppleIdentityVerificationError('Apple token subject is missing');
  }

  if (payload.email !== undefined && typeof payload.email !== 'string') {
    throw new AppleIdentityVerificationError('Apple token email is invalid');
  }

  if (
    payload.email &&
    payload.email_verified !== undefined &&
    payload.email_verified !== true &&
    payload.email_verified !== 'true'
  ) {
    throw new AppleIdentityVerificationError('Apple token email is not verified');
  }

  return payload as AppleIdentityClaims;
};

export const resetAppleSigningKeyCacheForTests = (): void => {
  cachedKeys = [];
  cachedKeysExpiresAt = 0;
};
