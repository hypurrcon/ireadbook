import type { Book, BookStatus } from '../db/types';

export type SortMode = 'genre' | 'series' | 'author' | 'status' | 'added' | 'color';
export interface Shelf { label?: string; books: Book[]; segments: { label: string; start: number }[] }
export interface Bookcase { shelves: Shelf[] }

const STATUS_ORDER: BookStatus[] = ['reading', 'want', 'paused', 'finished', 'dnf'];

export function hueOf(hex?: string): number {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return 999;
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.08) return 400 + (1 - max) * 100; // greys/black/white at the end, light → dark
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

type Group = { label?: string; books: Book[]; pack: boolean };

function groups(books: Book[], mode: SortMode, seriesNames: Record<string, string>): Group[] {
  const by = (key: (b: Book) => string, order?: (a: string, b: string) => number, pack = false) => {
    const m = new Map<string, Book[]>();
    for (const b of books) { const k = key(b); if (!m.has(k)) m.set(k, []); m.get(k)!.push(b); }
    const keys = [...m.keys()].sort(order);
    return keys.map((k) => ({ label: k, books: m.get(k)!.sort((a, b) => a.title.localeCompare(b.title)), pack }));
  };
  switch (mode) {
    case 'genre':
      return by((b) => b.genre ?? 'other', (a, b) => (a === 'other' ? 1 : b === 'other' ? -1 : a.localeCompare(b)), true);
    case 'status':
      return by((b) => b.status, (a, b) => STATUS_ORDER.indexOf(a as BookStatus) - STATUS_ORDER.indexOf(b as BookStatus), true);
    case 'author':
      return by((b) => b.authors[0]?.trim() || '—', (a, b) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)), true);
    case 'series': {
      const series = new Map<string, Book[]>();
      const solo: Book[] = [];
      for (const b of books) {
        if (b.seriesId) { if (!series.has(b.seriesId)) series.set(b.seriesId, []); series.get(b.seriesId)!.push(b); }
        else solo.push(b);
      }
      const gs: Group[] = [...series.entries()]
        .map(([id, bs]) => ({ label: seriesNames[id] ?? bs[0].title, books: bs.sort((a, b) => (a.seriesIndex ?? 999) - (b.seriesIndex ?? 999)), pack: true }))
        .sort((a, b) => a.label!.localeCompare(b.label!));
      if (solo.length) gs.push({ label: undefined, books: solo.sort((a, b) => a.title.localeCompare(b.title)), pack: true });
      return gs;
    }
    case 'added':
      return [{ books: [...books].sort((a, b) => b.createdAt - a.createdAt), pack: true }];
    case 'color':
      return [{ books: [...books].sort((a, b) => hueOf(a.dominantColor) - hueOf(b.dominantColor)), pack: true }];
  }
}

export function layoutShelves(books: Book[], mode: SortMode, perShelf: number, shelvesPerCase: number, seriesNames: Record<string, string> = {}): Bookcase[] {
  const shelves: Shelf[] = [];
  let cur: Shelf | null = null;
  for (const g of groups(books, mode, seriesNames)) {
    const fits = cur && g.pack && cur.books.length > 0 && cur.books.length + Math.min(g.books.length, perShelf) <= perShelf;
    if (!fits) { cur = { label: g.label, books: [], segments: [] }; shelves.push(cur); }
    if (g.label) cur!.segments.push({ label: g.label, start: cur!.books.length });
    for (const b of g.books) {
      if (cur!.books.length >= perShelf) { cur = { label: g.label, books: [], segments: g.label ? [{ label: g.label, start: 0 }] : [] }; shelves.push(cur); }
      cur!.books.push(b);
    }
  }
  if (shelves.length === 0) return [{ shelves: [] }];
  const cases: Bookcase[] = [];
  for (let i = 0; i < shelves.length; i += shelvesPerCase) cases.push({ shelves: shelves.slice(i, i + shelvesPerCase) });
  return cases;
}

/** Books per shelf: fill every row of the first bookcase before crowding a single shelf. */
export function shelfCapacity(n: number, rows: number, max = 22, min = 6): number {
  return Math.max(min, Math.min(max, Math.ceil(n / Math.max(1, rows))));
}

/** Shelves to show in a bookcase: a small library gets fewer, fuller shelves (about 9 books each). */
export function effectiveRows(n: number, maxRows: number): number {
  return Math.max(2, Math.min(maxRows, Math.ceil(n / 9)));
}
