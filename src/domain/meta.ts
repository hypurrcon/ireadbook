import type { Book } from '../db/types';
import type { BookMeta } from '../lookup/books';

const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Patch for a book from looked-up metadata. Fills only empty fields unless overwrite. */
export function mergeMeta(book: Partial<Book>, meta: BookMeta, overwrite = false): Partial<Book> {
  const p: Partial<Book> = { needsLookup: false };
  const set = <K extends keyof Book>(k: K, v: Book[K] | undefined) => {
    if (empty(v)) return;
    if (overwrite || empty(book[k])) p[k] = v as Book[K];
  };
  if (!overwrite && book.title && meta.title && book.title.trim().toLowerCase() !== meta.title.trim().toLowerCase()) {
    if (empty(book.originalTitle)) p.originalTitle = meta.title;
  } else {
    set('title', meta.title);
  }
  set('subtitle', meta.subtitle);
  set('authors', meta.authors);
  set('publisher', meta.publisher);
  set('year', meta.year);
  set('pageCount', meta.pageCount);
  set('language', meta.language);
  set('isbn', meta.isbn);
  set('description', meta.description);
  set('genre', meta.genre);
  return p;
}

/** Fill only the fields the user has not typed yet. */
export function fillEmpty(book: Book, patch: Partial<Book>): Partial<Book> {
  const out: Partial<Book> = {};
  for (const [k, v] of Object.entries(patch) as [keyof Book, unknown][]) {
    const cur = book[k];
    const empty = cur === undefined || cur === '' || (Array.isArray(cur) && cur.length === 0);
    if (empty && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) (out as any)[k] = v;
  }
  if (patch.needsLookup !== undefined) out.needsLookup = patch.needsLookup;
  return out;
}

