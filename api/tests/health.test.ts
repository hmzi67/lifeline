import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// The real app with a stand-in database, served on a random port and called with fetch
// (no supertest needed).
const mockQueryRaw = jest.fn();
const mockModels: Record<string, unknown> = {};
const mockPrisma: any = new Proxy({
  $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn(),
}, {
  get(target: any, key: string) {
    if (key in target) return target[key];
    return (mockModels[key] ||= new Proxy({}, { get: () => jest.fn(async () => null) }));
  },
});
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma), Prisma: {} }));
jest.mock('@quixo3/prisma-session-store', () => ({ PrismaSessionStore: require('express-session').MemoryStore }));
jest.mock('../src/services/emailService', () => ({ sendEmailVerificationEmail: jest.fn(), sendPasswordResetEmail: jest.fn() }));

import app from '../src/app';

let server: Server;
let base: string;

beforeAll(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));
beforeEach(() => mockQueryRaw.mockReset());

describe('API health', () => {
  it.each(['/health', '/api/health'])('%s reports healthy when the database answers', async (path) => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = await fetch(base + path);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: 'healthy', services: { database: 'connected', server: 'running' } });
  });

  it('answers 503 when the database is down', async () => {
    mockQueryRaw.mockRejectedValue(new Error('connection refused'));
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(503);
    expect((await res.json()).services.database).toBe('disconnected');
  });
});

describe('rate limiting', () => {
  it('applies to API routes', async () => {
    const res = await fetch(`${base}/api/no-such-route`);
    expect(res.headers.get('ratelimit-limit')).not.toBeNull();
  });

  it('does not apply to resized images, which a single screen requests dozens of', async () => {
    const res = await fetch(`${base}/api/img?src=/uploads/x.jpg&w=1`);
    expect(res.status).toBe(400);
    expect(res.headers.get('ratelimit-limit')).toBeNull();
  });
});
