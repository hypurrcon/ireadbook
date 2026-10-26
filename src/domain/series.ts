import type { Book } from '../db/types';

const thaiDigits = (s: string) => s.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50));

const PATTERNS: RegExp[] = [
  /[\s,:–-]*(?:เล่ม(?:ที่)?|vol\.?|volume|book|ภาค(?:ที่)?|#)\s*(\d{1,3})\s*$/i,
  /\s*\((\d{1,3})\)\s*$/,
  /\s+(\d{1,2})\s*$/,
];

export function parseVolume(title: string): { base: string; index: number | null } {
  const t = thaiDigits(title.trim());
  for (const re of PATTERNS) {
    const m = t.match(re);
    if (m && m.index! > 0) {
      const base = t.slice(0, m.index).replace(/[\s,:–-]+$/, '').trim();
      if (base) return { base, index: Number(m[1]) };
    }
  }
  return { base: title.trim(), index: null };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function bigrams(s: string) {
  const t = norm(s);
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

export function similarity(a: string, b: string): number {
  const A = bigrams(a), B = bigrams(b);
  if (!A.length || !B.length) return norm(a) === norm(b) ? 1 : 0;
  const pool = [...B];
  let hit = 0;
  for (const g of A) {
    const i = pool.indexOf(g);
    if (i >= 0) { hit++; pool.splice(i, 1); }
  }
  return (2 * hit) / (A.length + B.length);
}

export interface SeriesGuess { baseTitle: string; index: number | null; matches: Book[]; }

export function guessSeries(book: Book, others: Book[]): SeriesGuess | null {
  const { base, index } = parseVolume(book.title);
  if (!base) return null;
  const authors = new Set(book.authors.map(norm));
  const matches = others.filter((o) => {
    if (o.id === book.id) return false;
    const ob = parseVolume(o.title).base;
    if (norm(ob) === norm(base) && (index !== null || parseVolume(o.title).index !== null)) return true;
    const shareAuthor = o.authors.some((a) => authors.has(norm(a)));
    return shareAuthor && (index !== null || parseVolume(o.title).index !== null) && similarity(ob, base) >= 0.8;
  });
  if (index === null && matches.length === 0) return null;
  return { baseTitle: base, index, matches };
}
