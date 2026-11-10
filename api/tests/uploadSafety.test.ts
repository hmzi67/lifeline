import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const { serveUploads, shrinkImage, storedFileName } = require('../src/middleware/upload') as typeof import('../src/middleware/upload');

const runGuard = (requestPath: string) => {
  const [guard] = serveUploads();
  const res: any = { statusCode: 0 };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.end = jest.fn(() => res);
  const next = jest.fn();
  (guard as any)({ path: requestPath }, res, next);
  return { res, next };
};

describe('upload safety', () => {
  it('names stored files from the MIME type, not the client filename', () => {
    expect(path.extname(storedFileName('image/png'))).toBe('.png');
    expect(path.extname(storedFileName('audio/mpeg'))).toBe('.mp3');
    expect(storedFileName('image/png')).not.toBe(storedFileName('image/png'));
  });

  it.each(['/image/x.html', '/image/x.js', '/image/x.htm', '/image/x', '/image/.env', '/image/x.PNG.html'])(
    'refuses to serve %s',
    (requestPath) => {
      const { res, next } = runGuard(requestPath);
      expect(res.statusCode).toBe(404);
      expect(next).not.toHaveBeenCalled();
    },
  );

  // SVG can no longer be uploaded; files stored earlier stay viewable.
  it.each(['/image/x.png', '/image/x.JPG', '/image/legacy.jpeg', '/audio/x.mp3', '/video/x.mp4', '/image/legacy.svg'])('serves media file %s', (requestPath) => {
    const { res, next } = runGuard(requestPath);
    expect(res.statusCode).toBe(0);
    expect(next).toHaveBeenCalledTimes(1);
  });

  describe('shrinkImage', () => {
    const tmpFile = (name: string) => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'upload-')), name);
    const photo = (width: number, height: number) =>
      sharp({ create: { width, height, channels: 3, background: { r: 62, g: 198, b: 201 } } });

    it('scales a large photo down to 1600px on its longest side, keeping the format', async () => {
      const file = tmpFile('big.jpg');
      await photo(4000, 3000).jpeg().toFile(file);
      const size = await shrinkImage(file, 'image/jpeg');
      const meta = await sharp(fs.readFileSync(file)).metadata();
      expect(size).toBe(fs.statSync(file).size);
      expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1600, 1200]);
    });

    it('leaves small images and unsupported types untouched', async () => {
      const small = tmpFile('small.png');
      await photo(800, 600).png().toFile(small);
      const before = fs.readFileSync(small);
      expect(await shrinkImage(small, 'image/png')).toBeNull();
      expect(fs.readFileSync(small).equals(before)).toBe(true);
      expect(await shrinkImage(small, 'image/gif')).toBeNull();
    });
  });
});
