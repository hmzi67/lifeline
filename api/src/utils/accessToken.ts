import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export const JWT_ALGORITHM = 'HS256' as const;

export interface AccessTokenPayload extends jwt.JwtPayload {
  userId: string;
  email?: string;
  roleId?: string;
}

/**
 * The one way to check an access token. Pins the algorithm, and refuses refresh tokens:
 * those carry a `jti` and access tokens never do, so a 7-day refresh token can't be used
 * as a bearer token even if JWT_SECRET and JWT_REFRESH_SECRET were set to the same value.
 * Throws jsonwebtoken's own errors (TokenExpiredError, JsonWebTokenError).
 */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, config.jwt.secret, { algorithms: [JWT_ALGORITHM] });
  if (typeof decoded === 'string' || typeof decoded.userId !== 'string' || !decoded.userId || decoded.jti !== undefined) {
    throw new jwt.JsonWebTokenError('invalid token');
  }
  return decoded as AccessTokenPayload;
};

/** Checks a refresh token's signature and algorithm (the database row is still the real check). */
export const verifyRefreshToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, config.jwt.refreshSecret, { algorithms: [JWT_ALGORITHM] });
  if (typeof decoded === 'string' || typeof decoded.userId !== 'string' || !decoded.userId) {
    throw new jwt.JsonWebTokenError('invalid token');
  }
  return decoded as AccessTokenPayload;
};
