import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import sharp from 'sharp';
import { getUploadRootPath } from '../middleware/upload.js';

const router = Router();

/**
 * Widths (device pixels) the app may ask for. A fixed set keeps the number of stored copies
 * small: the app picks the smallest one that is at least as wide as the image is drawn.
 */
export const IMAGE_WIDTHS = [160, 240, 320, 480, 640, 800, 1080, 1280] as const;

const RESIZABLE = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const SIZED_DIR = '.sized';

// One render per file at a time; concurrent requests for the same copy wait for it.
const inFlight = new Map<string, Promise<void>>();

// sharp is CPU-heavy: cap how many renders run at once and how many may queue. A request
// that cannot get a slot in time skips the render and gets the full-size original instead.
const MAX_RENDERS = Number(process.env.IMAGE_MAX_CONCURRENT_RENDERS || 2);
const MAX_QUEUED = Number(process.env.IMAGE_MAX_QUEUED_RENDERS || 50);
const SLOT_WAIT_MS = 5000;
const RENDER_TIMEOUT_SECONDS = 10;
let activeRenders = 0;
const waitingRenders: Array<() => void> = [];

/** Runs `job` in a render slot; rejects when the queue is full or no slot frees within SLOT_WAIT_MS. */
export const withRenderSlot = <T>(job: () => Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const start = () => {
      activeRenders++;
      job().then(resolve, reject).finally(() => {
        activeRenders--;
        waitingRenders.shift()?.();
      });
    };
    if (activeRenders < MAX_RENDERS) return start();
    if (waitingRenders.length >= MAX_QUEUED) return reject(new Error('Image render queue is full'));
    const go = () => {
      clearTimeout(timer);
      start();
    };
    const timer = setTimeout(() => {
      waitingRenders.splice(waitingRenders.indexOf(go), 1);
      reject(new Error('Timed out waiting for an image render slot'));
    }, SLOT_WAIT_MS);
    waitingRenders.push(go);
  });

const render = async (source: string, target: string, width: number) => {
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    // Read it ourselves: sharp caches files by name (a replaced original could come back stale)
    // and holds them open, which blocks replacing the file on Windows.
    await sharp(await fs.promises.readFile(source))
      // Aborts libvips work on an image that takes too long, instead of letting it run on.
      .timeout({ seconds: RENDER_TIMEOUT_SECONDS })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(tmp);
    await fs.promises.rename(tmp, target);
  } catch (error) {
    await fs.promises.rm(tmp, { force: true });
    throw error;
  }
};

/**
 * GET /api/img?src=/uploads/image/...jpg&w=480
 * A smaller WebP copy of an uploaded image. Copies are made once and kept under
 * uploads/.sized, so later requests only read a file. Uploads are never overwritten
 * (each gets a new name), so a copy can be cached by phones for good.
 */
router.get('/', async (req, res) => {
  const width = Number(req.query.w);
  const src = typeof req.query.src === 'string' ? req.query.src : '';
  if (!IMAGE_WIDTHS.includes(width as (typeof IMAGE_WIDTHS)[number]) || !src.startsWith('/uploads/')) {
    res.status(400).json({ success: false, message: `src must be an /uploads/ path and w one of ${IMAGE_WIDTHS.join(', ')}` });
    return;
  }

  const root = path.resolve(getUploadRootPath());
  const relative = path.normalize(src.slice('/uploads/'.length));
  const source = path.resolve(root, relative);
  const ext = path.extname(source).toLowerCase();
  // Stay inside the uploads folder, skip the copies themselves, and only resize still images.
  if (!source.startsWith(root + path.sep) || relative.split(path.sep).includes(SIZED_DIR) || !RESIZABLE.has(ext)) {
    res.status(400).json({ success: false, message: 'Not a resizable upload' });
    return;
  }

  const target = path.join(root, SIZED_DIR, `w${width}`, `${relative}.webp`);
  try {
    const sourceStat = await fs.promises.stat(source).catch(() => null);
    if (!sourceStat) {
      res.status(404).json({ success: false, message: 'Image not found' });
      return;
    }
    const targetStat = await fs.promises.stat(target).catch(() => null);
    // Remake the copy when the original was replaced on disk after it was made.
    if (!targetStat || targetStat.mtimeMs < sourceStat.mtimeMs) {
      let job = inFlight.get(target);
      if (!job) {
        job = withRenderSlot(() => render(source, target, width)).finally(() => inFlight.delete(target));
        inFlight.set(target, job);
      }
      await job;
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type('image/webp').sendFile(target);
  } catch (error) {
    console.error('Image resize failed:', src, width, error);
    // A full-size image beats a broken one.
    res.redirect(302, src);
  }
});

export default router;
