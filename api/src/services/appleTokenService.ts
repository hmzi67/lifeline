import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Sign in with Apple REST API: turn the one-time authorization code into a refresh token at
 * sign-in, and revoke that token when the account is deleted. Apple asks apps that offer
 * Sign in with Apple to "use the Sign in with Apple REST API to revoke user tokens" on deletion.
 *
 * Needs a Sign in with Apple key (not the In-App Purchase key):
 *   APPLE_TEAM_ID, APPLE_SIGNIN_KEY_ID, and APPLE_SIGNIN_PRIVATE_KEY or APPLE_SIGNIN_PRIVATE_KEY_PATH.
 * Without them sign-in still works; there is just no token to revoke later.
 */

const APPLE_AUDIENCE = 'https://appleid.apple.com';
const TOKEN_URL = `${APPLE_AUDIENCE}/auth/token`;
const REVOKE_URL = `${APPLE_AUDIENCE}/auth/revoke`;
const REQUEST_TIMEOUT_MS = 10_000;

interface SigningKey {
  teamId: string;
  keyId: string;
  privateKey: string;
}

const readSigningKey = (): SigningKey | null => {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_SIGNIN_KEY_ID?.trim();
  const inline = process.env.APPLE_SIGNIN_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const path = process.env.APPLE_SIGNIN_PRIVATE_KEY_PATH?.trim();
  if (!teamId || !keyId || (!inline && !path)) return null;
  try {
    return { teamId, keyId, privateKey: inline || readFileSync(path!, 'utf8') };
  } catch {
    console.error('Sign in with Apple private key could not be read; Apple token revocation is off.');
    return null;
  }
};

export const isAppleTokenRevocationConfigured = (): boolean => readSigningKey() !== null;

/** Client secret JWT for Apple's token endpoints (ES256, signed with the Sign in with Apple key). */
const createClientSecret = (key: SigningKey, clientId: string): string =>
  jwt.sign({}, key.privateKey, {
    algorithm: 'ES256',
    keyid: key.keyId,
    issuer: key.teamId,
    audience: APPLE_AUDIENCE,
    subject: clientId,
    expiresIn: '5m',
  });

const postForm = (url: string, body: Record<string, string>) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

// Refresh tokens are stored encrypted (AES-256-GCM) with a key derived from the JWT secret.
const encryptionKey = () => createHmac('sha256', config.jwt.secret).update('lifeline-apple-refresh-token').digest();

export const encryptAppleToken = (token: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join(':');
};

export const decryptAppleToken = (stored: string): string => {
  const [version, iv, tag, data] = stored.split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unknown Apple token format');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
};

/**
 * Exchanges a Sign in with Apple authorization code ("single-use only and valid for five
 * minutes") for a refresh token. Returns null when not configured or Apple refuses the code.
 */
export const exchangeAppleAuthorizationCode = async (code: string, clientId: string): Promise<string | null> => {
  const key = readSigningKey();
  if (!key) return null;
  const response = await postForm(TOKEN_URL, {
    client_id: clientId,
    client_secret: createClientSecret(key, clientId),
    code,
    grant_type: 'authorization_code',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: string } | null;
    console.error(`Apple authorization code exchange failed: ${response.status} ${error?.error ?? ''}`.trim());
    return null;
  }
  const body = await response.json() as { refresh_token?: string };
  return typeof body.refresh_token === 'string' && body.refresh_token ? body.refresh_token : null;
};

/** Revokes a refresh token. Apple answers 200 even when the token was already revoked. */
export const revokeAppleRefreshToken = async (refreshToken: string, clientId: string): Promise<boolean> => {
  const key = readSigningKey();
  if (!key) return false;
  const response = await postForm(REVOKE_URL, {
    client_id: clientId,
    client_secret: createClientSecret(key, clientId),
    token: refreshToken,
    token_type_hint: 'refresh_token',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: string } | null;
    console.error(`Apple token revocation failed: ${response.status} ${error?.error ?? ''}`.trim());
  }
  return response.ok;
};
