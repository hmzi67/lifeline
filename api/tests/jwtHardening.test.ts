/** Attack cases from the JWT review, thrown at the real `authenticate` middleware. */
export {};
import type { Server } from 'node:http';

const mockUser: any = {};
const mockPrisma: any = {
  user: { findUnique: jest.fn(async () => mockUser.current) },
};
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const jwt = require('jsonwebtoken');
const express = require('express');
const authenticate = require('../src/middleware/authenticate').default;
const { verifyAccessToken } = require('../src/utils/accessToken');
const { generateTokens } = require('../src/controllers/authController');

const accessSecret = process.env.JWT_SECRET!;
const refreshSecret = process.env.JWT_REFRESH_SECRET!;

const app = express();
app.get('/private', authenticate, (_req: any, res: any) => res.json({ ok: true }));
app.use((err: any, _req: any, res: any, _next: any) => res.status(err.statusCode || err.status || 500).json({ code: err.code }));

let server: Server;
let base: string;
beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});
beforeEach(() => {
  mockUser.current = { id: 'user-1', email: 'u@example.test', role: { name: 'user' }, isEmailVerified: true, status: 'active' };
});

const get = (token: string) => fetch(`${base}/private`, { headers: { Authorization: `Bearer ${token}` } });
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('JWT attacks against authenticate', () => {
  it('accepts a genuine access token', async () => {
    expect((await get(generateTokens('user-1', 'u@example.test').accessToken)).status).toBe(200);
  });

  it('rejects alg:none with the signature stripped', async () => {
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: 'user-1', exp: Math.floor(Date.now() / 1000) + 600 })}.`;
    expect((await get(token)).status).toBe(401);
  });

  it('rejects a claim tampered after signing (role escalation)', async () => {
    const [header, , signature] = generateTokens('user-1', 'u@example.test').accessToken.split('.');
    const tampered = `${header}.${b64({ userId: 'admin-1', roleId: 'admin', exp: Math.floor(Date.now() / 1000) + 600 })}.${signature}`;
    expect((await get(tampered)).status).toBe(401);
  });

  it('rejects a token signed with another HMAC algorithm', async () => {
    const hs512 = jwt.sign({ userId: 'user-1' }, accessSecret, { algorithm: 'HS512', expiresIn: '5m' });
    expect((await get(hs512)).status).toBe(401);
  });

  it('reports an expired token as expired, not merely invalid', async () => {
    const expired = jwt.sign({ userId: 'user-1' }, accessSecret, { expiresIn: -10 });
    const response = await get(expired);
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('TOKEN_EXPIRED');
  });

  it('never accepts a refresh token as a bearer token, even with a shared secret', async () => {
    // Simulates JWT_REFRESH_SECRET misconfigured to equal JWT_SECRET.
    const refreshShapedToken = jwt.sign({ userId: 'user-1' }, accessSecret, { expiresIn: '7d', jwtid: 'abc' });
    expect((await get(refreshShapedToken)).status).toBe(401);
    expect(() => verifyAccessToken(generateTokens('user-1', 'u@example.test').refreshToken)).toThrow();
    expect(refreshSecret).not.toBe(accessSecret);
  });

  it('rejects a token without a userId claim', async () => {
    expect((await get(jwt.sign({ email: 'u@example.test' }, accessSecret, { expiresIn: '5m' }))).status).toBe(401);
  });
});
