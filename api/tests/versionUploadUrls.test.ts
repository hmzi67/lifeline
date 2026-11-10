import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-versions-'));
jest.mock('../src/middleware/upload', () => ({ getUploadRootPath: () => uploadRoot }));

import versionUploadUrls, { versionUploadUrl } from '../src/middleware/versionUploadUrls';

const file = path.join(uploadRoot, 'image', 'content', 'meal-salmon.jpg');
const setTime = (seconds: number) => fs.utimesSync(file, seconds, seconds);
const v = (seconds: number) => seconds.toString(36);

beforeAll(() => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'jpeg');
  setTime(1_700_000_000);
});
afterAll(() => fs.rmSync(uploadRoot, { recursive: true, force: true }));

describe('versioned upload links', () => {
  it('adds the file time to absolute and relative links', () => {
    expect(versionUploadUrl('https://makelifeline.com/uploads/image/content/meal-salmon.jpg'))
      .toBe(`https://makelifeline.com/uploads/image/content/meal-salmon.jpg?v=${v(1_700_000_000)}`);
    expect(versionUploadUrl('/uploads/image/content/meal-salmon.jpg')).toBe(`/uploads/image/content/meal-salmon.jpg?v=${v(1_700_000_000)}`);
  });

  it('replaces an old version saved back by the admin, keeping other query params', () => {
    expect(versionUploadUrl('/uploads/image/content/meal-salmon.jpg?v=old&x=1')).toBe(`/uploads/image/content/meal-salmon.jpg?v=${v(1_700_000_000)}&x=1`);
  });

  it('leaves other hosts, missing files and escapes from uploads alone', () => {
    expect(versionUploadUrl('https://images.unsplash.com/photo-1?w=900')).toBe('https://images.unsplash.com/photo-1?w=900');
    expect(versionUploadUrl('/uploads/image/content/gone.jpg')).toBe('/uploads/image/content/gone.jpg');
    expect(versionUploadUrl('/uploads/../../etc/passwd')).toBe('/uploads/../../etc/passwd');
    expect(versionUploadUrl('see /uploads/image/content/meal-salmon.jpg')).toBe('see /uploads/image/content/meal-salmon.jpg');
  });

  it('rewrites links anywhere in a JSON body without touching dates or other values', () => {
    const res: any = { json: jest.fn((body: unknown) => body) };
    versionUploadUrls({} as any, res, () => undefined);
    const createdAt = new Date('2026-11-05T00:00:00Z');
    const decimalLike = { toJSON: () => '12.50' };

    const out = res.json({
      success: true,
      data: [{ name: 'Salmon', image: '/uploads/image/content/meal-salmon.jpg', createdAt, price: decimalLike, calories: 300, tags: ['/uploads/nope.jpg'] }],
    });

    expect(out.data[0].image).toBe(`/uploads/image/content/meal-salmon.jpg?v=${v(1_700_000_000)}`);
    expect(out.data[0].createdAt).toBe(createdAt);
    expect(out.data[0].price).toBe(decimalLike);
    expect(out.data[0].calories).toBe(300);
    expect(out.data[0].tags).toEqual(['/uploads/nope.jpg']);
  });
});
