import type { Book, Pt } from '../db/types';
import type { Raw } from '../image/raw';
import { blobToRaw, guessCorners, processCover } from '../image/process';
import { decodeIsbnFromBlob } from './barcode';
import { ocrCover } from './ocr';
import { guessFromOcr, type OcrLine } from './guess';
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

/** Full guess: barcode → online lookup → OCR fallback. Front/back are already straightened. */
export async function analyze(front: Processed | null, back: Processed | null, isbn: string | null, onStep: (s: Step) => void): Promise<{ patch: Partial<Book>; source: ResolveSource }> {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (isbn && online) {
    onStep('lookup');
    const quick = await resolveMeta({ isbn, ocr: null, online }, { lookupIsbn, searchText: async () => [] });
    if (quick.source === 'isbn') {
      // still read translator names from the cover when we can, cheaply skip otherwise
      onStep('done');
      return quick;
    }
  }
  onStep('ocr');
  let frontLines: OcrLine[] = [], backLines: OcrLine[] = [];
  try {
    if (front) frontLines = await ocrCover(front.raw);
    if (back && !isbn) backLines = await ocrCover(back.raw);
  } catch { /* OCR unavailable (e.g. first use offline) */ }
  const guess = guessFromOcr(frontLines, backLines);
  onStep('lookup');
  const r = await resolveMeta({ isbn: isbn ?? guess.isbn, ocr: guess, online }, { lookupIsbn, searchText });
  onStep('done');
  return r;
}
