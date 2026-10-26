import type { Pt } from '../db/types';
import { type Raw, warpRaw, guessCornersRaw, autoLevelRaw, dominantColorRaw } from './raw';

export const COVER_MAX = 1024;
export const WORK_MAX = 1600;

export async function blobToRaw(blob: Blob, maxSide = WORK_MAX): Promise<Raw> {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const id = ctx.getImageData(0, 0, w, h);
  return { data: id.data, width: w, height: h };
}

export function rawToCanvas(raw: Raw): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = raw.width; c.height = raw.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height), 0, 0);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/jpeg', quality));
}

export const guessCorners = (raw: Raw) => guessCornersRaw(raw);

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Straighten a cover from its 4 corners, gently auto-level, return JPEG + dominant colour. */
export async function processCover(raw: Raw, corners: Pt[]): Promise<{ blob: Blob; color: string; aspect: number; raw: Raw }> {
  const wq = (dist(corners[0], corners[1]) + dist(corners[3], corners[2])) / 2;
  const hq = (dist(corners[0], corners[3]) + dist(corners[1], corners[2])) / 2;
  const aspect = wq / Math.max(1, hq);
  const s = Math.min(1, COVER_MAX / Math.max(wq, hq));
  const w = Math.max(16, Math.round(wq * s)), h = Math.max(16, Math.round(hq * s));
  const out = warpRaw(raw, corners, w, h);
  autoLevelRaw(out);
  const color = dominantColorRaw(out);
  return { blob: await canvasToBlob(rawToCanvas(out)), color, aspect, raw: out };
}

/** Downscale any image blob to JPEG with max side. */
export async function downscaleBlob(blob: Blob, max = COVER_MAX): Promise<Blob> {
  const raw = await blobToRaw(blob, max);
  return canvasToBlob(rawToCanvas(raw));
}
