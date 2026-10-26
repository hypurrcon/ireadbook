import type { Genre } from '../db/types';

export interface BookMeta {
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  year?: number;
  pageCount?: number;
  language?: string;
  genre?: Genre;
  isbn?: string;
  description?: string;
  thumbnail?: string;
}

const RULES: [RegExp, Genre][] = [
  [/comic|graphic novel|manga/i, 'comics'],
  [/fantasy|magic/i, 'fantasy'],
  [/science fiction|sci-?fi/i, 'scifi'],
  [/mystery|detective|thriller|crime|suspense/i, 'mystery'],
  [/romance|love/i, 'romance'],
  [/horror|ghost/i, 'horror'],
  [/biography|autobiography|memoir/i, 'biography'],
  [/history/i, 'history'],
  [/self-?help|personal growth|motivation/i, 'selfhelp'],
  [/business|economics|management|finance|marketing/i, 'business'],
  [/psychology/i, 'psychology'],
  [/philosophy|religion/i, 'philosophy'],
  [/science|nature|mathematics|technology|medical/i, 'science'],
  [/poetry/i, 'poetry'],
  [/juvenile|children/i, 'children'],
  [/fiction|novel|literature/i, 'fiction'],
];

export function mapCategories(cats: string[] | undefined): Genre | undefined {
  if (!cats?.length) return undefined;
  const s = cats.join(' | ');
  // juvenile fantasy should be fantasy, so children rule is checked after genre rules
  for (const [re, g] of RULES) if (re.test(s)) return g;
  return 'other';
}

export class NetworkError extends Error {}

/** null = server answered without data; throws NetworkError when unreachable. */
async function getJson(url: string, timeoutMs = 8000): Promise<any | null> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const t = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : undefined;
  let r: Response;
  try {
    r = await fetch(url, { signal: ctrl?.signal });
  } catch {
    throw new NetworkError(url);
  } finally {
    if (t) clearTimeout(t);
  }
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

/** Try sources in order; throw only if every source was unreachable. */
async function firstOf<T>(...tries: (() => Promise<T | null>)[]): Promise<T | null> {
  let reached = false;
  for (const f of tries) {
    try {
      const v = await f();
      reached = true;
      if (v) return v;
    } catch (e) { if (!(e instanceof NetworkError)) throw e; }
  }
  if (!reached) throw new NetworkError('all sources unreachable');
  return null;
}

const yearOf = (d?: string) => { const m = d?.match(/\d{4}/); return m ? Number(m[0]) : undefined; };

function fromGoogle(v: any, isbn?: string): BookMeta {
  return {
    title: v.title ?? '',
    subtitle: v.subtitle,
    authors: v.authors ?? [],
    publisher: v.publisher,
    year: yearOf(v.publishedDate),
    pageCount: v.pageCount || undefined,
    language: v.language,
    genre: mapCategories(v.categories),
    isbn: isbn ?? v.industryIdentifiers?.find((x: any) => x.type === 'ISBN_13')?.identifier,
    description: v.description,
    thumbnail: v.imageLinks?.thumbnail?.replace('http://', 'https://'),
  };
}

export async function lookupIsbn(isbn: string): Promise<BookMeta | null> {
  return firstOf<BookMeta>(
    async () => {
      const g = await getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const item = g?.items?.[0]?.volumeInfo;
      return item?.title ? fromGoogle(item, isbn) : null;
    },
    async () => {
      const o = await getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const ob = o?.[`ISBN:${isbn}`];
      if (!ob?.title) return null;
      return {
        title: ob.title,
        subtitle: ob.subtitle,
        authors: (ob.authors ?? []).map((a: any) => a.name),
        publisher: ob.publishers?.[0]?.name,
        year: yearOf(ob.publish_date),
        pageCount: ob.number_of_pages,
        genre: mapCategories((ob.subjects ?? []).map((s: any) => s.name)),
        isbn,
        thumbnail: ob.cover?.medium,
      };
    },
  );
}

export async function searchText(q: string): Promise<BookMeta[]> {
  if (!q.trim()) return [];
  const r = await firstOf<BookMeta[]>(
    async () => {
      const g = await getJson(`https://www.googleapis.com/books/v1/volumes?maxResults=8&q=${encodeURIComponent(q)}`);
      return g?.items?.length ? g.items.map((i: any) => fromGoogle(i.volumeInfo)) : null;
    },
    async () => {
      const o = await getJson(`https://openlibrary.org/search.json?limit=8&q=${encodeURIComponent(q)}`);
      const docs = o?.docs ?? [];
      return docs.length ? docs.map((d: any) => ({
        title: d.title,
        authors: d.author_name ?? [],
        year: d.first_publish_year,
        pageCount: d.number_of_pages_median,
        isbn: d.isbn?.find((x: string) => x.length === 13),
        genre: mapCategories(d.subject),
        thumbnail: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
      })) : null;
    },
  );
  return r ?? [];
}

export async function fetchImageBlob(url?: string): Promise<Blob | null> {
  if (!url) return null;
  try { const r = await fetch(url); return r.ok ? await r.blob() : null; } catch { return null; }
}
