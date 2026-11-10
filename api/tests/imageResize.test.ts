import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import sharp from 'sharp';

// A throwaway uploads folder holding one real 1280px photo.
const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'img-resize-'));
jest.mock('../src/middleware/upload', () => ({ getUploadRootPath: () => uploadRoot }));

import imageRoutes from '../src/routes/imageRoutes';

let server: Server;
let base: string;

beforeAll(async () => {
  fs.mkdirSync(path.join(uploadRoot, 'image', 'content'), { recursive: true });
  await sharp({ create: { width: 1280, height: 850, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .jpeg({ quality: 90 })
    .toFile(path.join(uploadRoot, 'image', 'content', 'meal.jpg'));
  fs.writeFileSync(path.join(uploadRoot, 'secret.txt'), 'nope');

  const app = express();
  app.use('/api/img', imageRoutes);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/img`;
});

afterAll(() => {
  server.close();
  fs.rmSync(uploadRoot, { recursive: true, force: true });
});

const get = (query: string) => fetch(`${base}?${query}`, { redirect: 'manual' });

describe('GET /api/img', () => {
  it('returns a smaller WebP at the requested width and keeps it for next time', async () => {
    const res = await get('src=/uploads/image/content/meal.jpg&w=480');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('cache-control')).toContain('immutable');
    const body = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(body).metadata();
    expect(meta.width).toBe(480);
    expect(body.length).toBeLessThan(fs.statSync(path.join(uploadRoot, 'image', 'content', 'meal.jpg')).size);
    expect(fs.existsSync(path.join(uploadRoot, '.sized', 'w480', 'image', 'content', 'meal.jpg.webp'))).toBe(true);
  });

  it('never makes a copy wider than the original', async () => {
    const res = await get('src=/uploads/image/content/meal.jpg&w=1280');
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect(meta.width).toBe(1280);
  });

  it.each([
    ['a width outside the allowed set', 'src=/uploads/image/content/meal.jpg&w=481'],
    ['a path outside uploads', 'src=/etc/passwd&w=480'],
    ['a path that climbs out of uploads', 'src=/uploads/../../secret.txt&w=480'],
    ['a file that is not an image', 'src=/uploads/secret.txt&w=480'],
    ['an already-resized copy', 'src=/uploads/.sized/w480/image/content/meal.jpg.webp&w=240'],
  ])('rejects %s', async (_label, query) => {
    expect((await get(query)).status).toBe(400);
  });

  it('remakes a copy when the original is replaced on disk', async () => {
    const original = path.join(uploadRoot, 'image', 'content', 'swap.jpg');
    const red = { r: 255, g: 0, b: 0 }, blue = { r: 0, g: 0, b: 255 };
    await sharp({ create: { width: 600, height: 400, channels: 3, background: red } }).jpeg().toFile(original);
    await get('src=/uploads/image/content/swap.jpg&w=320');

    await sharp({ create: { width: 600, height: 400, channels: 3, background: blue } }).jpeg().toFile(original);
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(original, later, later);

    const res = await get('src=/uploads/image/content/swap.jpg&w=320');
    const { dominant } = await sharp(Buffer.from(await res.arrayBuffer())).stats();
    expect(dominant.b).toBeGreaterThan(200);
    expect(dominant.r).toBeLessThan(50);
  });

  it('returns 404 for a missing image', async () => {
    expect((await get('src=/uploads/image/content/missing.jpg&w=480')).status).toBe(404);
  });
});
