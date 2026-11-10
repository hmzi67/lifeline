import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import express, { RequestHandler } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { config } from '../config/index.js';
import { AppError } from './errorHandler.js';

export type MediaCategory = 'image' | 'audio' | 'video';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
]);

const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
  'audio/x-flac',
]);

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/mpeg',
  'video/ogg',
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/mpeg': '.mpeg',
  'video/ogg': '.ogv',
};

const uploadRootPath = path.resolve(process.cwd(), config.upload.path);

// Files stored before names were derived from the MIME type kept the client's
// extension, so common media aliases stay servable.
const LEGACY_MEDIA_EXTENSIONS = ['.jpeg', '.jfif', '.heic', '.heif', '.oga', '.opus', '.weba', '.m4v', '.mpg'];
const SERVABLE_EXTENSIONS = new Set([...Object.values(MIME_EXTENSION_MAP), ...LEGACY_MEDIA_EXTENSIONS]);

// Uploaded files are user content on the API's origin: they must never be
// able to run script there, even when opened directly (SVG can carry script).
const UPLOAD_RESPONSE_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox";

/** Serves only media extensions from the upload directory, with script disabled. */
export const serveUploads = (): RequestHandler[] => [
  (req, res, next) => {
    if (!SERVABLE_EXTENSIONS.has(path.extname(req.path).toLowerCase())) {
      res.status(404).end();
      return;
    }
    next();
  },
  express.static(uploadRootPath, {
    dotfiles: 'deny',
    index: false,
    // Every upload gets a new timestamp + UUID name and is never overwritten, so
    // clients may keep it for good instead of re-checking each image on every view.
    maxAge: '365d',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('Content-Security-Policy', UPLOAD_RESPONSE_CSP);
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }),
];

export const getUploadRootPath = (): string => uploadRootPath;

export const getMediaCategory = (mimeType: string): MediaCategory | null => {
  if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
  if (AUDIO_MIME_TYPES.has(mimeType)) return 'audio';
  if (VIDEO_MIME_TYPES.has(mimeType)) return 'video';
  return null;
};

/**
 * The extension decides the Content-Type a file is served with, so it comes
 * from the allowlisted MIME type, never from the client's filename (an
 * "image/png" upload named x.html would otherwise be served as HTML).
 */
export const storedFileName = (mimeType: string): string =>
  `${Date.now()}-${randomUUID()}${MIME_EXTENSION_MAP[mimeType]}`;

const ensureDirectory = (directoryPath: string) => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

ensureDirectory(uploadRootPath);

const ascii = (bytes: Buffer, start: number, text: string) =>
  bytes.subarray(start, start + text.length).toString('latin1') === text;
const startsWith = (bytes: Buffer, signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
const riff = (bytes: Buffer, form: string) => ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, form);
const isoMedia = (bytes: Buffer) => ascii(bytes, 4, 'ftyp');

/** What the first bytes of each allowed type look like. */
const CONTENT_SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  'image/jpeg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  'image/png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/gif': (b) => ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a'),
  'image/webp': (b) => riff(b, 'WEBP'),
  'image/avif': isoMedia,
  // Text format: served with a sandboxing CSP, so only check it is an SVG document.
  'image/svg+xml': (b) => /<svg[\s>]/i.test(b.toString('utf8')),
  'audio/mpeg': (b) => ascii(b, 0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  'audio/wav': (b) => riff(b, 'WAVE'),
  'audio/ogg': (b) => ascii(b, 0, 'OggS'),
  'audio/webm': (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
  'audio/mp4': isoMedia,
  'audio/aac': (b) => ascii(b, 0, 'ADIF') || (b[0] === 0xff && (b[1] & 0xf6) === 0xf0),
  'audio/flac': (b) => ascii(b, 0, 'fLaC'),
  'video/mp4': isoMedia,
  'video/webm': (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
  'video/quicktime': (b) => ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].some((atom) => ascii(b, 4, atom)),
  'video/x-msvideo': (b) => riff(b, 'AVI '),
  'video/mpeg': (b) => startsWith(b, [0x00, 0x00, 0x01, 0xba]) || startsWith(b, [0x00, 0x00, 0x01, 0xb3]),
  'video/ogg': (b) => ascii(b, 0, 'OggS'),
};
CONTENT_SIGNATURES['audio/mp3'] = CONTENT_SIGNATURES['audio/mpeg'];
CONTENT_SIGNATURES['audio/x-wav'] = CONTENT_SIGNATURES['audio/wav'];
CONTENT_SIGNATURES['audio/x-flac'] = CONTENT_SIGNATURES['audio/flac'];

/** The declared MIME type is the client's claim; the stored bytes must agree with it. */
export const contentMatchesType = async (filePath: string, mimeType: string): Promise<boolean> => {
  const matches = CONTENT_SIGNATURES[mimeType];
  if (!matches) return false;
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const head = Buffer.alloc(1024);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    return bytesRead > 0 && matches(head.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
};

/** Photos larger than this on either side are scaled down (enough for a full-width image on a 3x phone). */
const MAX_IMAGE_EDGE = 1600;
const RESIZABLE_IMAGE_FORMATS: Record<string, 'jpeg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Phone photos arrive at 3000-4000px and several MB, but the app never shows them
 * that large; every viewer would download the full file. Large JPEG/PNG/WebP
 * uploads are scaled down in place (same format, so the stored name stays valid),
 * turned upright from their EXIF orientation, and stripped of metadata such as GPS.
 * Returns the new size in bytes, or null when the file was left as it was.
 */
export const shrinkImage = async (filePath: string, mimeType: string): Promise<number | null> => {
  const format = RESIZABLE_IMAGE_FORMATS[mimeType];
  if (!format) return null;
  // Read into memory first: on Windows the file can't be rewritten while sharp holds it open.
  const input = await fs.promises.readFile(filePath);
  const { width = 0, height = 0 } = await sharp(input).metadata();
  if (Math.max(width, height) <= MAX_IMAGE_EDGE) return null;
  const output = await sharp(input)
    .rotate()
    .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: 'inside', withoutEnlargement: true })
    .toFormat(format, format === 'png' ? { compressionLevel: 9 } : { quality: 82 })
    .toBuffer();
  await fs.promises.writeFile(filePath, output);
  return output.length;
};

const diskStorage = multer.diskStorage({
  destination: (_req, file, callback) => {
    const category = getMediaCategory(file.mimetype);
    if (!category) {
      callback(new Error('Unsupported file type'), '');
      return;
    }

    const targetDirectory = path.join(uploadRootPath, category);
    ensureDirectory(targetDirectory);
    callback(null, targetDirectory);
  },
  filename: (_req, file, callback) => {
    callback(null, storedFileName(file.mimetype));
  },
});

/** Disk storage that deletes and rejects a file whose bytes do not match its declared type. */
const storage: multer.StorageEngine = {
  _handleFile(req, file, callback) {
    diskStorage._handleFile(req, file, (error, info) => {
      if (error || !info?.path) {
        callback(error, info);
        return;
      }
      const storedPath = info.path;
      contentMatchesType(storedPath, file.mimetype)
        .catch(() => false)
        .then((matches) => {
          if (matches) {
            // A failed resize keeps the original: a large image beats a lost upload.
            shrinkImage(storedPath, file.mimetype)
              .catch(() => null)
              .then((size) => callback(null, size == null ? info : { ...info, size }));
            return;
          }
          fs.unlink(storedPath, () =>
            callback(new AppError('File content does not match its type', 400, 'INVALID_FILE_CONTENT')));
        });
    });
  },
  _removeFile(req, file, callback) {
    diskStorage._removeFile(req, file, callback);
  },
};

const fileFilter: multer.Options['fileFilter'] = (_req, file, callback) => {
  if (!getMediaCategory(file.mimetype)) {
    callback(new AppError('Only image, audio, and video files are allowed', 400, 'UNSUPPORTED_FILE_TYPE'));
    return;
  }

  callback(null, true);
};

export const mediaUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 1,
  },
});
