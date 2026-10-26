import type { Book, Pt } from '../db/types';
import type { Raw } from '../image/raw';
import { blobToRaw, guessCorners, processCover } from '../image/process';
import { decodeIsbnFromBlob } from './barcode';
import { lookupIsbn, searchText } from './books';
import { resolveMeta, type ResolveSource } from './resolve';

export interface Shot { file: Blob; raw: Raw; url: string; corners: Pt[] }
export type Step = 'straighten' | 'barcode' | 'lookup' | 'ocr' | 'done';

export async function loadShot(file: Blob): Promise<Shot> {
  const raw = await blobToRaw(file);
  return { file, raw, url: URL.createObjectURL(file), corners: guessCorners(raw) };
}

export interface Processed { blob: Blob; color: string; aspect: number; raw: Raw }

export async function straighten(shot: Shot): Promise<Processed> {
  return processCover(shot.raw, shot.corners);
}

export async function readBarcode(shot: Shot | null): Promise<string | null> {
  if (!shot) return null;
  try {
    // full resolution: decodeIsbnFromRaw downsamples with its own box filter; canvas downscaling blurs the bars
    const big = await blobToRaw(shot.file, 4096);
    return await decodeIsbnFromBlob(shot.file, big);
  } catch { return null; }
}

/**
 * Book details come only from the barcode (ISBN) lookup. Reading text off the cover was too
 * unreliable for Thai covers, so when nothing is found the fields stay empty for the user.
 */
export async function analyze(_front: Processed | null, _back: Processed | null, isbn: string | null, onStep: (s: Step) => void): Promise<{ patch: Partial<Book>; source: ResolveSource }> {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  onStep('lookup');
  const r = await resolveMeta({ isbn, ocr: null, online }, { lookupIsbn, searchText: async () => [] });
  onStep('done');
  return r;
}
