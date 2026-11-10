/** Assessment only: real app/routers/auth/HTTP, synthetic Prisma and no external services.
 * Security assertions describe the desired protection. Failures reproduce findings.
 */
export {};
import type { Server } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const mockModels: any = {};
const mockPrisma: any = new Proxy({
  $queryRaw: jest.fn(async () => [{ value: 1 }]),
  $transaction: jest.fn(async (ops: any) => typeof ops === 'function' ? ops(mockPrisma) : Promise.all(ops)),
}, {
  get(target: any, key: string) {
    if (key in target) return target[key];
    if (!mockModels[key]) mockModels[key] = {
      findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: any) => ({ id: 'synthetic-record', ...data })),
      update: jest.fn(async ({ data }: any) => ({ id: 'synthetic-user', ...data })),
      updateMany: jest.fn(async () => ({ count: 1 })),
      deleteMany: jest.fn(async () => ({ count: 1 })),
      upsert: jest.fn(), count: jest.fn(async () => 0),
    };
    return mockModels[key];
  },
});
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));
jest.mock('@quixo3/prisma-session-store', () => ({
  PrismaSessionStore: require('express-session').MemoryStore,
}));
jest.mock('../src/services/emailService', () => ({
  sendEmailVerificationEmail: jest.fn(), sendPasswordResetEmail: jest.fn(),
}));
const mockDeleteUserAndData = jest.fn(async (..._args: any[]) => ({ id: 'synthetic-user' }));
jest.mock('../src/services/accountDeletionService', () => ({
  deleteUserAndData: (...args: any[]) => mockDeleteUserAndData(...args),
}));
const mockMobileTokens: Record<string, string> = {};
jest.mock('../../../services/tokenStorage', () => ({ TokenStorage: {
  getItem: jest.fn(async (key: string) => mockMobileTokens[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockMobileTokens[key] = value; }),
  multiSet: jest.fn(async (pairs: [string, string][]) => { for (const [key, value] of pairs) mockMobileTokens[key] = value; }),
  multiRemove: jest.fn(async (keys: string[]) => { for (const key of keys) delete mockMobileTokens[key]; }),
} }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../../services/connectivity', () => ({ isDeviceOnline: () => true }));

process.env.UPLOAD_PATH = path.resolve(__dirname, '../../../reports/security-assessment/uploads');
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
// Prevent accidental use of configured external services in the app under test.
delete process.env.STRIPE_SECRET_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GOOGLE_CLIENT_SECRET;

const jwt = require('jsonwebtoken');
const app = require('../src/app').default;
const accessSecret = process.env.JWT_SECRET!;
const refreshSecret = process.env.JWT_REFRESH_SECRET!;
const token = () => jwt.sign({ userId: 'synthetic-user', email: 'audit@example.test' }, accessSecret, { expiresIn: '15m' });
let server: Server;
let base: string;
let user: any;
let mobileApi: typeof import('../../../services/api');
let MobileAuth: typeof import('../../../services/authService').AuthService;
const createdFiles: string[] = [];
const call = async (route: string, options: any = {}, auth: string | null = token()) => {
  const headers: any = { ...(options.headers || {}) };
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (options.body && typeof options.body === 'string') headers['Content-Type'] = 'application/json';
  return fetch(base + route, { ...options, headers });
};

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  process.env.EXPO_PUBLIC_API_URL = base + '/api';
  (global as any).__DEV__ = false;
  mobileApi = require('../../../services/api');
  MobileAuth = require('../../../services/authService').AuthService;
});
afterAll(async () => {
  for (const file of createdFiles) if (fs.existsSync(file)) fs.unlinkSync(file);
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockMobileTokens)) delete mockMobileTokens[key];
  user = { id: 'synthetic-user', email: 'audit@example.test', role: { name: 'user' },
    isEmailVerified: true, status: 'active', roleId: null, password: null };
  mockPrisma.user.findUnique.mockImplementation(async () => user);
  mockPrisma.user.findFirst.mockImplementation(async () => user);
  mockPrisma.questionnaire.findFirst.mockResolvedValue(null);
  mockPrisma.refreshToken.findFirst.mockImplementation(async () => ({ id: 'synthetic-refresh', user }));
});

describe('HTTP integration: baseline protections', () => {
  it('serves the real health response contract (DB probe mocked)', async () => {
    const response = await call('/health', {}, null);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'healthy', services: { database: 'connected' } });
  });
  it('rejects unauthenticated private profile reads', async () => {
    expect((await call('/api/user/profile', {}, null)).status).toBe(401);
  });
  it('rejects a forged signature', async () => {
    const forged = jwt.sign({ userId: user.id }, 'attacker-controlled-secret');
    expect((await call('/api/user/profile', {}, forged)).status).toBe(401);
  });
  it('rejects unsigned JWTs', async () => {
    const unsigned = jwt.sign({ userId: user.id }, '', { algorithm: 'none' });
    expect((await call('/api/user/profile', {}, unsigned)).status).toBe(401);
  });
  it('rejects expired JWTs', async () => {
    const expired = jwt.sign({ userId: user.id }, accessSecret, { expiresIn: -1 });
    expect((await call('/api/user/profile', {}, expired)).status).toBe(401);
  });
  it('rejects a non-admin reading the admin user list', async () => {
    expect((await call('/api/user/admin/users')).status).toBe(403);
  });
  it('rejects cross-account profile changes', async () => {
    const response = await call('/api/user/profile/victim-user', { method: 'PUT', body: JSON.stringify({ username: 'hijacked' }) });
    expect(response.status).toBe(403);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
  it('rejects cross-account deletion', async () => {
    expect((await call('/api/user/profile/victim-user', { method: 'DELETE' })).status).toBe(403);
    expect(mockDeleteUserAndData).not.toHaveBeenCalled();
  });
  it('enforces confirmation on the documented account-deletion endpoint', async () => {
    expect((await call('/api/user/account', { method: 'DELETE', body: '{}' })).status).toBe(400);
    expect(mockDeleteUserAndData).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated uploads', async () => {
    expect((await call('/api/uploads', { method: 'POST' }, null)).status).toBe(401);
  });
  it('rejects unknown content extensions on static upload URLs', async () => {
    expect((await call('/uploads/image/probe.html', {}, null)).status).toBe(404);
  });
  it('enforces the login limit over real HTTP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await call('/api/auth/login', { method: 'POST', body: '{}' }, null);
      statuses.push(response.status);
      await response.text();
    }
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
  });
});

describe('Mobile API service to backend over real loopback HTTP (DB/native storage mocked)', () => {
  it('logs in, stores the issued session, reads the profile and logs out', async () => {
    // Different synthetic IP keeps this success flow independent of the login limiter probe.
    user.password = await require('bcryptjs').hash('Synthetic-password-2026!', 4);
    const login = await mobileApi.apiCall('/auth/login', {
      method: 'POST', headers: { 'X-Forwarded-For': '192.0.2.40' },
      body: JSON.stringify({ email: user.email, password: 'Synthetic-password-2026!' }),
    }, true);
    expect(login.success).toBe(true);
    const session: any = login.data;
    await MobileAuth.storeTokens(session.accessToken, session.refreshToken);
    const profile = await mobileApi.apiCall('/user/profile');
    expect(profile.success).toBe(true);
    await MobileAuth.logout();
    expect(mockMobileTokens).toEqual({});
  });
  it('rotates an expired session through the actual refresh controller and retries the profile', async () => {
    mockMobileTokens.accessToken = jwt.sign({ userId: user.id }, accessSecret, { expiresIn: -1 });
    mockMobileTokens.refreshToken = jwt.sign({ userId: user.id }, refreshSecret, { expiresIn: '7d' });
    const previousRefresh = mockMobileTokens.refreshToken;
    const result = await mobileApi.apiCall('/user/profile');
    expect(result.success).toBe(true);
    expect(mockMobileTokens.refreshToken).not.toBe(previousRefresh);
    expect(jwt.verify(mockMobileTokens.accessToken, accessSecret).userId).toBe(user.id);
  });
  it('surfaces the backend admin denial as an HTTP 403 ApiError', async () => {
    mockMobileTokens.accessToken = token();
    await expect(mobileApi.apiCall('/user/admin/users')).rejects.toMatchObject({ status: 403, kind: 'http' });
  });
});

describe('Security expectations: failures are reproducible findings', () => {
  it('SEC-01 rejects a suspended account with an otherwise valid access token', async () => {
    user.status = 'suspended';
    expect((await call('/api/user/profile')).status).toBe(403);
  });
  it('SEC-01 refuses to refresh a blocked account session', async () => {
    user.status = 'blocked';
    const refreshToken = jwt.sign({ userId: user.id }, refreshSecret, { expiresIn: '7d' });
    const response = await call('/api/auth/refresh-token', { method: 'POST', body: JSON.stringify({ refreshToken }) }, null);
    expect(response.status).toBe(403);
  });
  it('SEC-02 requires confirmation on every self-deletion route', async () => {
    const response = await call('/api/user/profile/synthetic-user', { method: 'DELETE', body: '{}' });
    expect({ status: response.status, deletionCalls: mockDeleteUserAndData.mock.calls.length })
      .toEqual({ status: 400, deletionCalls: 0 });
  });
  it('SEC-03 denies a pending unverified user access to the private profile', async () => {
    user.status = 'pending';
    user.isEmailVerified = false;
    expect((await call('/api/user/profile')).status).toBe(403);
  });
  it('SEC-04 revokes refresh sessions when a profile password changes', async () => {
    user.password = await require('bcryptjs').hash('Synthetic-old-password!', 4);
    const response = await call('/api/user/profile/synthetic-user', {
      method: 'PUT', body: JSON.stringify({ password: 'Synthetic-password-2026!', currentPassword: 'Synthetic-old-password!' }),
    });
    expect(response.status).toBe(200);
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalled();
  });
  it('SEC-05 rejects non-image bytes carrying an image/png MIME label', async () => {
    const form = new FormData();
    form.append('file', new Blob(['not an image; synthetic audit payload'], { type: 'image/png' }), 'probe.png');
    const response = await call('/api/uploads', { method: 'POST', body: form });
    const result: any = await response.json();
    if (result.data?.filename) createdFiles.push(path.join(process.env.UPLOAD_PATH!, 'image', result.data.filename));
    expect(response.status).toBe(400);
  });
  it('SEC-09 never exposes another user medication through the medication reminder list', async () => {
    const victimMedication = { id: 'victim-medication', userId: 'victim-user', name: 'VICTIM_PRIVATE_MEDICATION' };
    mockPrisma.medication.findUnique.mockResolvedValue(victimMedication);
    mockPrisma.medicationReminder.findMany.mockImplementation(async ({ where }: any) => {
      if (where.userId === 'synthetic-user' || where.medication?.userId === 'synthetic-user') return [];
      return [{ id: 'victim-reminder', userId: 'victim-user', medicationId: victimMedication.id,
        medication: victimMedication, user: { email: 'victim@example.test' } }];
    });
    const response = await call('/api/medication-reminders/medication/victim-medication');
    expect(await response.text()).not.toContain('VICTIM_PRIVATE_MEDICATION');
  });
  it('SEC-02 deletes the account when the password is re-entered, not when it is wrong', async () => {
    user.password = await require('bcryptjs').hash('Synthetic-password-2026!', 4);
    const wrong = await call('/api/user/profile/synthetic-user', { method: 'DELETE', body: JSON.stringify({ password: 'nope' }) });
    // 403, not 401: a 401 makes the app treat the session as expired and sign the user out.
    expect(wrong.status).toBe(403);
    expect((await wrong.json()).code).toBe('INVALID_PASSWORD');
    expect(mockDeleteUserAndData).not.toHaveBeenCalled();
    const ok = await call('/api/user/profile/synthetic-user', {
      method: 'DELETE', body: JSON.stringify({ password: 'Synthetic-password-2026!' }),
    });
    expect(ok.status).toBe(200);
    expect(mockDeleteUserAndData).toHaveBeenCalledTimes(1);
  });
  it('SEC-02 lets a Google/Apple account (no password) delete itself with the typed phrase', async () => {
    const ok = await call('/api/user/account', { method: 'DELETE', body: JSON.stringify({ confirmation: 'DELETE' }) });
    expect(ok.status).toBe(200);
    expect(mockDeleteUserAndData).toHaveBeenCalledTimes(1);
  });
  it('SEC-03 still lets a just-signed-up (unverified) session refresh while the code is entered', async () => {
    user.status = 'pending';
    user.isEmailVerified = false;
    const refreshToken = jwt.sign({ userId: user.id }, refreshSecret, { expiresIn: '7d' });
    const response = await call('/api/auth/refresh-token', { method: 'POST', body: JSON.stringify({ refreshToken }) }, null);
    expect(response.status).toBe(200);
  });
  it('SEC-05 accepts a real PNG', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b40000000049454e44ae426082', 'hex');
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png');
    const response = await call('/api/uploads', { method: 'POST', body: form });
    const result: any = await response.json();
    if (result.data?.filename) createdFiles.push(path.join(process.env.UPLOAD_PATH!, 'image', result.data.filename));
    expect(response.status).toBe(201);
  });
  it('SEC-09 rejects creating an own reminder pointing to another user medication', async () => {
    mockPrisma.medication.findUnique.mockResolvedValue({ id: 'victim-medication', userId: 'victim-user' });
    const response = await call('/api/medication-reminders', { method: 'POST', body: JSON.stringify({
      userId: 'synthetic-user', medicationId: 'victim-medication', reminderTime: '2026-10-24T08:00:00Z',
    }) });
    expect([403, 404]).toContain(response.status);
    expect(mockPrisma.medicationReminder.create).not.toHaveBeenCalled();
  });
});
