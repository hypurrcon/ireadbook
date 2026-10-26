import type { Book } from '../db/types';
import type { BookMeta } from './books';
import type { OcrGuess } from './guess';
import { mergeMeta } from '../domain/meta';
import { similarity } from '../domain/series';

export interface ResolveDeps {
  lookupIsbn: (isbn: string) => Promise<BookMeta | null>;
  searchText: (q: string) => Promise<BookMeta[]>;
}
export interface ResolveInput { isbn?: string | null; ocr: OcrGuess | null; online: boolean }
export type ResolveSource = 'isbn' | 'ocr+text' | 'ocr' | 'none';

const low = (s?: string) => (s ?? '').toLowerCase().trim();

/** Decide book details from barcode + OCR guess + online lookups. Never throws. */
export async function resolveMeta(input: ResolveInput, deps: ResolveDeps): Promise<{ patch: Partial<Book>; source: ResolveSource }> {
  const ocr = input.ocr ?? {};
  const base: Partial<Book> = {
    title: ocr.title ?? '', originalTitle: ocr.originalTitle, authors: ocr.authors ?? [], translators: ocr.translators ?? [],
    publisher: ocr.publisher, isbn: input.isbn ?? ocr.isbn ?? undefined,
  };
  let netFailed = !input.online;

  if (input.online && base.isbn) {
    try {
      const m = await deps.lookupIsbn(base.isbn);
      if (m?.title) {
        const patch: Partial<Book> = { ...base, ...mergeMeta({ authors: [], translators: base.translators }, m, true), isbn: base.isbn, translators: base.translators, needsLookup: false };
        if (!patch.originalTitle && ocr.originalTitle && low(ocr.originalTitle) !== low(m.title)) patch.originalTitle = ocr.originalTitle;
        return { patch, source: 'isbn' };
      }
    } catch { netFailed = true; }
  }

  const query = ocr.originalTitle || [ocr.title, ocr.authors?.[0]].filter(Boolean).join(' ');
  if (input.online && !netFailed && query) {
    try {
      const hits = await deps.searchText(query);
      const want = [ocr.title, ocr.originalTitle].filter(Boolean).map(low);
      const hit = hits.find((h) => want.some((w) => similarity(low(h.title), w) >= 0.6 || low(h.title).includes(w) || w.includes(low(h.title))));
      if (hit) return { patch: { ...base, ...mergeMeta(base, hit), isbn: base.isbn ?? hit.isbn, needsLookup: false }, source: 'ocr+text' };
    } catch { netFailed = true; }
  }

  const has = !!(ocr.title || ocr.authors?.length);
  return { patch: { ...base, needsLookup: netFailed }, source: has ? 'ocr' : 'none' };
}
