import fs from 'node:fs';
import path from 'node:path';
import { NextFunction, Request, Response } from 'express';
import { getUploadRootPath } from './upload.js';

/**
 * Phones cache images by their full URL. A file replaced on disk under the same name would
 * keep showing the old picture, so every /uploads link in a JSON response gets `?v=` set to
 * the file's last-modified time: a replaced file gets a new link and is downloaded again.
 * Only links to files that exist in the uploads folder are touched; other hosts and missing
 * files pass through as they are.
 */

// Matches a link to an upload, absolute or relative, with an optional existing query.
const UPLOAD_URL = /^((?:https?:\/\/[^/\s"?#]+)?\/uploads\/[^?#\s"]+)(\?[^#\s"]*)?$/i;
const STAT_TTL_MS = 60_000;
const MAX_ENTRIES = 20_000;

const versions = new Map<string, { version: string | null; checkedAt: number }>();

const versionOf = (uploadPath: string): string | null => {
  const now = Date.now();
  const cached = versions.get(uploadPath);
  if (cached && now - cached.checkedAt < STAT_TTL_MS) return cached.version;

  const root = path.resolve(getUploadRootPath());
  let relative: string;
  try {
    relative = path.normalize(decodeURIComponent(uploadPath.slice('/uploads/'.length)));
  } catch {
    return null;
  }
  const file = path.resolve(root, relative);
  let version: string | null = null;
  if (file.startsWith(root + path.sep)) {
    try {
      version = Math.floor(fs.statSync(file).mtimeMs / 1000).toString(36);
    } catch {
      version = null;
    }
  }
  if (versions.size >= MAX_ENTRIES) versions.clear();
  versions.set(uploadPath, { version, checkedAt: now });
  return version;
};

export const versionUploadUrl = (value: string): string => {
  const match = UPLOAD_URL.exec(value);
  if (!match) return value;
  const [, base, query = ''] = match;
  const uploadPath = base.replace(/^https?:\/\/[^/]+/i, '');
  const version = versionOf(uploadPath);
  if (!version) return value;
  const params = new URLSearchParams(query.slice(1));
  params.set('v', version);
  return `${base}?${params.toString()}`;
};

const MAX_DEPTH = 12;

const versionAll = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') return value.includes('/uploads/') ? versionUploadUrl(value) : value;
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;
  // Dates, Prisma Decimals, Buffers etc. serialise themselves; walking them would break that.
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') return value;
  if (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value)) return value;
  if (Array.isArray(value)) return value.map(item => versionAll(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) out[key] = versionAll(item, depth + 1);
  return out;
};

const versionUploadUrls = (_req: Request, res: Response, next: NextFunction) => {
  const json = res.json.bind(res);
  res.json = (body?: unknown) => json(versionAll(body));
  next();
};

export default versionUploadUrls;
