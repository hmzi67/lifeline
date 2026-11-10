import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Stored files land in a throwaway directory, not the repo's uploads/.
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-limits-'));
process.env.UPLOAD_PATH = uploadDir;
process.env.USER_UPLOAD_DAILY_LIMIT = '3';

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => ({})) }));
// The caller's role comes from a test header instead of a JWT.
jest.mock('../src/middleware/authenticate', () => ({
  __esModule: true,
  default: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-user'] || 'user-1', role: req.headers['x-role'] || 'user' };
    next();
  },
}));

const express = require('express') as typeof import('express');
const uploadRoutes = require('../src/routes/uploadRoutes').default;
const { serveUploads } = require('../src/middleware/upload') as typeof import('../src/middleware/upload');

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c80000000049454e44ae426082', 'hex');
const MP3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(64)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

// Real HTTP with a 10MB body: allow for a busy machine.
jest.setTimeout(30000);

let server: Server;
let base: string;

beforeAll(() => {
  const app = express();
  app.use('/api/uploads', uploadRoutes);
  app.use('/uploads', ...serveUploads());
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

const upload = (file: Buffer, type: string, name: string, headers: Record<string, string> = {}) => {
  const form = new FormData();
  form.append('file', new Blob([file], { type }), name);
  return fetch(`${base}/api/uploads`, { method: 'POST', body: form, headers });
};

describe('POST /api/uploads', () => {
  it('lets a user upload a photo and serves it as a download that cannot be sniffed', async () => {
    const res = await upload(PNG, 'image/png', 'a.png', { 'x-user': 'photo-user' });
    expect(res.status).toBe(201);
    const { data } = await res.json();

    const served = await fetch(`${base}${data.path}`);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-disposition')).toBe('attachment');
    expect(served.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('refuses SVG for everyone, admins included', async () => {
    const asUser = await upload(SVG, 'image/svg+xml', 'x.svg', { 'x-user': 'svg-user' });
    const asAdmin = await upload(SVG, 'image/svg+xml', 'x.svg', { 'x-role': 'admin' });
    expect([asUser.status, asAdmin.status]).toEqual([400, 400]);
  });

  it('accepts audio and video only from admins', async () => {
    const asUser = await upload(MP3, 'audio/mpeg', 'a.mp3', { 'x-user': 'audio-user' });
    const asAdmin = await upload(MP3, 'audio/mpeg', 'a.mp3', { 'x-role': 'admin' });
    expect(asUser.status).toBe(400);
    expect(asAdmin.status).toBe(201);
  });

  it('caps a user photo at 10MB', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
    const res = await upload(big, 'image/png', 'big.png', { 'x-user': 'big-user' });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/10MB/);
  });

  it('stops a user at the daily quota but not an admin', async () => {
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await upload(PNG, 'image/png', 'q.png', { 'x-user': 'quota-user' })).status);
    expect(statuses).toEqual([201, 201, 201, 429]);

    for (let i = 0; i < 4; i++) {
      expect((await upload(PNG, 'image/png', 'q.png', { 'x-role': 'admin', 'x-user': 'quota-admin' })).status).toBe(201);
    }
  });
});
