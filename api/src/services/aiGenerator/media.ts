import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getUploadRootPath, storedFileName } from '../../middleware/upload.js';
import { generateImage } from './openai.js';
import type { MediaSource } from './constants.js';

/**
 * Pictures and videos for generated content, stored in our own uploads folder (the app never
 * depends on another service's links). Which source is used is the batch's choice:
 * ai_generated (OpenAI images), stock (Pixabay), stock_or_ai (Pixabay, else OpenAI), or admin_upload
 * (nothing; an admin adds them).
 */

const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

export type MediaResult = { url: string | null; costUsd: number; note?: string };

/** Writes bytes into uploads/<category>/ and returns the path the app loads (/uploads/...). */
export const saveUpload = async (data: Buffer, mimeType: 'image/png' | 'image/jpeg' | 'video/mp4'): Promise<string> => {
  const category = mimeType.startsWith('video/') ? 'video' : 'image';
  const filename = storedFileName(mimeType);
  const directory = path.join(getUploadRootPath(), category);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, filename), data);
  return `${publicOrigin()}/uploads/${category}/${filename}`;
};

/**
 * Uploads are stored as full links (like the admin upload route does), because several app
 * screens use the link as is. PUBLIC_BASE_URL wins; otherwise FRONTEND_URL's origin.
 */
const publicOrigin = () => {
  const raw = process.env.PUBLIC_BASE_URL || process.env.FRONTEND_URL || '';
  try {
    return raw ? new URL(raw).origin : '';
  } catch {
    return '';
  }
};

const pixabayKey = () => process.env.PIXABAY_API_KEY ?? '';

/** Pixabay search (photos or videos). The key goes in the query string; q is capped at 100 characters. */
const pixabay = async (kind: 'photo' | 'video', query: string, signal: AbortSignal) => {
  const params = new URLSearchParams({ key: pixabayKey(), q: query.slice(0, 100), safesearch: 'true', per_page: '3' });
  if (kind === 'photo') params.set('image_type', 'photo');
  const endpoint = kind === 'photo' ? 'https://pixabay.com/api/' : 'https://pixabay.com/api/videos/';
  const response = await fetch(`${endpoint}?${params}`, { signal });
  if (!response.ok) return null;
  return response.json();
};

const download = async (url: string, signal: AbortSignal, maxBytes: number): Promise<Buffer | null> => {
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const size = Number(response.headers.get('content-length') ?? 0);
  if (size > maxBytes) return null;
  const data = Buffer.from(await response.arrayBuffer());
  return data.length > maxBytes ? null : data;
};

const stockPhoto = async (query: string, signal: AbortSignal): Promise<MediaResult> => {
  if (!pixabayKey()) return { url: null, costUsd: 0, note: 'PIXABAY_API_KEY is not set; no stock image added.' };
  const result = await pixabay('photo', query, signal);
  const hit = result?.hits?.[0];
  const src = hit?.largeImageURL || hit?.webformatURL;
  if (!src) return { url: null, costUsd: 0, note: `No stock image found for "${query}".` };
  const data = await download(src, signal, 10 * 1024 * 1024);
  return data ? { url: await savePicture(data, 'image/jpeg'), costUsd: 0 } : { url: null, costUsd: 0, note: 'Stock image download failed.' };
};

/** A short stock clip for an exercise (smallest rendition at least 640 px wide), or nothing. */
export const stockVideo = async (query: string, signal: AbortSignal): Promise<MediaResult> => {
  if (!pixabayKey()) return { url: null, costUsd: 0, note: 'PIXABAY_API_KEY is not set; no video added.' };
  const result = await pixabay('video', query, signal);
  const files = (result?.hits ?? [])
    .flatMap((hit: any) => Object.values(hit.videos ?? {}) as any[])
    .filter((file: any) => file?.url && Number(file.width) >= 640)
    .sort((a: any, b: any) => Number(a.width) - Number(b.width));
  if (!files.length) return { url: null, costUsd: 0, note: `No stock video found for "${query}".` };
  const data = await download(files[0].url, signal, MAX_VIDEO_BYTES);
  return data ? { url: await saveUpload(data, 'video/mp4'), costUsd: 0 } : { url: null, costUsd: 0, note: 'Stock video was too large or failed to download.' };
};

/**
 * Re-encodes a picture as a JPEG at most 1280 px wide: an AI picture arrives as a ~1.4 MB PNG,
 * and this makes it roughly a tenth of that with no visible loss on a phone. If the bytes can't
 * be read as an image, they are kept as they came.
 */
export const compactPicture = async (data: Buffer, fallback: 'image/png' | 'image/jpeg'): Promise<{ data: Buffer; mimeType: 'image/png' | 'image/jpeg' }> => {
  try {
    const jpeg = await sharp(data).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    return { data: jpeg, mimeType: 'image/jpeg' };
  } catch {
    return { data, mimeType: fallback };
  }
};

const savePicture = async (data: Buffer, fallback: 'image/png' | 'image/jpeg') => {
  const picture = await compactPicture(data, fallback);
  return saveUpload(picture.data, picture.mimeType);
};

/** One picture for a meal, exercise or plan cover from the batch's chosen source. */
export const pictureFor = async (
  source: MediaSource,
  subject: { prompt: string; stockQuery: string },
  signal: AbortSignal,
): Promise<MediaResult> => {
  if (source === 'admin_upload') return { url: null, costUsd: 0 };
  if (source === 'stock') return stockPhoto(subject.stockQuery, signal);
  if (source === 'stock_or_ai') {
    const stock = await stockPhoto(subject.stockQuery, signal);
    if (stock.url) return stock;
  }
  const image = await generateImage(subject.prompt, signal);
  return { url: await savePicture(image.data, 'image/png'), costUsd: image.costUsd };
};
