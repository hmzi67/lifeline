import { randomBytes } from 'crypto';
import os from 'os';
import path from 'path';

const mockGenerateImage = jest.fn();
jest.mock('../src/services/aiGenerator/openai', () => ({ generateImage: (...args: unknown[]) => mockGenerateImage(...args) }));
jest.mock('../src/middleware/upload', () => ({
  getUploadRootPath: () => path.join(os.tmpdir(), 'lifeline-media-test'),
  storedFileName: () => `${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
}));

import sharp from 'sharp';
import { compactPicture, pictureFor } from '../src/services/aiGenerator/media';

const subject = { prompt: 'a squat', stockQuery: 'squat exercise' };
const signal = new AbortController().signal;
const json = (body: unknown) => ({ ok: true, headers: new Headers(), json: async () => body, arrayBuffer: async () => new ArrayBuffer(0) });
const bytes = () => ({ ok: true, headers: new Headers({ 'content-length': '3' }), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });

const realFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.PIXABAY_API_KEY = 'test-key';
  mockGenerateImage.mockResolvedValue({ data: Buffer.from([9]), costUsd: 0.02 });
});
afterAll(() => {
  global.fetch = realFetch;
});

describe('stock_or_ai pictures', () => {
  it('uses the stock photo when Pixabay has a match, at no cost', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json({ hits: [{ largeImageURL: 'https://cdn.example/squat.jpg' }] })).mockResolvedValueOnce(bytes()) as any;
    const result = await pictureFor('stock_or_ai', subject, signal);
    expect(result.url).toMatch(/\/uploads\/image\//);
    expect(result.costUsd).toBe(0);
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it('falls back to an AI picture when Pixabay has no match', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json({ hits: [] })) as any;
    const result = await pictureFor('stock_or_ai', subject, signal);
    expect(mockGenerateImage).toHaveBeenCalledWith('a squat', signal);
    expect(result.url).toMatch(/\/uploads\/image\//);
    expect(result.costUsd).toBe(0.02);
  });

  it('plain stock does not fall back to AI', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json({ hits: [] })) as any;
    const result = await pictureFor('stock', subject, signal);
    expect(result.url).toBeNull();
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });
});

describe('smaller pictures', () => {
  it('turns a large PNG into a JPEG no wider than 1280 px', async () => {
    // Random noise compresses badly as PNG, like a photo does.
    const noise = randomBytes(1600 * 900 * 3);
    const png = await sharp(noise, { raw: { width: 1600, height: 900, channels: 3 } }).png().toBuffer();

    const picture = await compactPicture(png, 'image/png');
    const meta = await sharp(picture.data).metadata();

    expect(picture.mimeType).toBe('image/jpeg');
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(1280);
    expect(picture.data.length).toBeLessThan(png.length);
  });

  it('keeps bytes it cannot read as they came', async () => {
    const odd = Buffer.from([1, 2, 3]);
    expect(await compactPicture(odd, 'image/png')).toEqual({ data: odd, mimeType: 'image/png' });
  });
});
