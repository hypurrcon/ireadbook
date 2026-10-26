// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { decodeIsbnFromRaw } from '../src/lookup/barcode';
import { lookupIsbn, searchText, mapCategories } from '../src/lookup/books';
import { guessFromOcr } from '../src/lookup/guess';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

describe('barcode', () => {
  it('reads the ISBN barcode from the real back-cover photo', async () => {
    const { data, info } = await sharp('tests/fixtures/ants-back.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const isbn = decodeIsbnFromRaw({ data: new Uint8ClampedArray(data), width: info.width, height: info.height });
    expect(isbn).toBe('9786169433736');
  }, 30000);
  it('returns null for the front cover (no barcode)', async () => {
    const { data, info } = await sharp('tests/fixtures/ants-front.png').resize({ width: 800 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(decodeIsbnFromRaw({ data: new Uint8ClampedArray(data), width: info.width, height: info.height })).toBeNull();
  }, 30000);
});

describe('lookup', () => {
  it('uses Google Books when it has the ISBN', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('googleapis')
      ? json({ items: [{ volumeInfo: { title: 'อาณาจักรมด', authors: ['H.G. Wells'], publisher: 'X', publishedDate: '2020-01-01', pageCount: 120, language: 'th', categories: ['Fiction / Science Fiction'] } }] })
      : json({})));
    const m = await lookupIsbn('9786169433736');
    expect(m).toMatchObject({ title: 'อาณาจักรมด', authors: ['H.G. Wells'], year: 2020, pageCount: 120, genre: 'scifi', isbn: '9786169433736' });
  });
  it('also asks Google by the ISBN-10 form, which some Thai books are indexed under', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('isbn:6169433736')
      ? json({ items: [{ volumeInfo: { title: 'อาณาจักรมด', authors: ['เอช.จี.เวลส์'] } }] })
      : url.includes('googleapis') ? json({ totalItems: 0 }) : json({})));
    const m = await lookupIsbn('9786169433736');
    expect(m).toMatchObject({ title: 'อาณาจักรมด', isbn: '9786169433736' });
  });
  it('falls back to Open Library when Google misses', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('googleapis')
      ? json({ totalItems: 0 })
      : json({ 'ISBN:9786169433736': { title: 'The Empire of the Ants', authors: [{ name: 'H. G. Wells' }], number_of_pages: 96, publish_date: '2019', publishers: [{ name: 'Y' }] } })));
    const m = await lookupIsbn('9786169433736');
    expect(m).toMatchObject({ title: 'The Empire of the Ants', authors: ['H. G. Wells'], pageCount: 96, year: 2019, publisher: 'Y' });
  });
  it('throws when the network is unreachable (so the book is marked for a later retry)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(lookupIsbn('9786169433736')).rejects.toThrow();
    await expect(searchText('x')).rejects.toThrow();
  });
  it('returns null when reachable but not found', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({}, false)));
    expect(await lookupIsbn('9786169433736')).toBeNull();
  });
  it('text search returns several candidates', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ items: [{ volumeInfo: { title: 'A' } }, { volumeInfo: { title: 'B' } }] })));
    expect((await searchText('อาณาจักรมด')).map((m) => m.title)).toEqual(['A', 'B']);
  });
  it('maps categories to genres', () => {
    expect(mapCategories(['Juvenile Fiction / Fantasy & Magic'])).toBe('fantasy');
    expect(mapCategories(['Self-Help'])).toBe('selfhelp');
    expect(mapCategories(['Comics & Graphic Novels'])).toBe('comics');
    expect(mapCategories([])).toBeUndefined();
  });
});

describe('guessFromOcr', () => {
  it('reads the Thai translated cover', () => {
    const front = [
      { text: 'The Empire', height: 60 },
      { text: 'of the Ants', height: 60 },
      { text: 'อาณาจักรมด', height: 34 },
      { text: 'เอช.จี.เวลส์', height: 18 },
      { text: 'นภัค ลิมป์ แปล', height: 18 },
    ];
    const back = [{ text: 'การเดินทางทางเรือเข้าไป', height: 14 }, { text: '200 บาท', height: 10 }, { text: 'ISBN 978-616-94337-3-6', height: 10 }];
    const g = guessFromOcr(front, back);
    expect(g.title).toBe('อาณาจักรมด');
    expect(g.originalTitle).toBe('The Empire of the Ants');
    expect(g.authors).toEqual(['เอช.จี.เวลส์']);
    expect(g.translators).toEqual(['นภัค ลิมป์']);
    expect(g.isbn).toBe('9786169433736');
  });
  it('real OCR of the Ants cover: prefers the smaller Thai title over the big English one', () => {
    const front = [
      { text: 'น', height: 31 }, { text: 'The Em p ire', height: 82 }, { text: 'the A', height: 96 },
      { text: 'อาณาจิกรมต', height: 27 }, { text: 'าเฮอห.จีเวลล์', height: 20 }, { text: 'นภิท aud แปล', height: 19 }, { text: 'WY', height: 16 },
    ];
    const g = guessFromOcr(front, []);
    expect(g.title).toBe('อาณาจิกรมต');
    expect(g.originalTitle).toBe('The Empire the A');
    expect(g.authors).toEqual(['าเฮอห.จีเวลล์']);
    expect(g.translators).toEqual(['นภิท aud']);
  });
  it('English-only cover with "by"', () => {
    const g = guessFromOcr([{ text: 'Atomic Habits', height: 50 }, { text: 'by James Clear', height: 16 }], []);
    expect(g.title).toBe('Atomic Habits');
    expect(g.authors).toEqual(['James Clear']);
  });
  it('empty OCR gives an empty guess', () => {
    expect(guessFromOcr([], [])).toEqual({});
  });
  it('ignores junk lines', () => {
    const g = guessFromOcr([{ text: '~ |', height: 70 }, { text: 'ฉันคือแมว', height: 40 }], []);
    expect(g.title).toBe('ฉันคือแมว');
  });
});

import { groupWords } from '../src/lookup/guess';
import { textMaskRaw } from '../src/image/raw';

describe('groupWords', () => {
  it('joins words on the same baseline, Thai without spaces, English with spaces', () => {
    const lines = groupWords([
      { text: 'The', confidence: 95, bbox: { x0: 10, y0: 444, x1: 100, y1: 620 } },
      { text: 'Empire', confidence: 96, bbox: { x0: 120, y0: 446, x1: 400, y1: 664 } },
      { text: 'อ', confidence: 93, bbox: { x0: 10, y0: 880, x1: 40, y1: 937 } },
      { text: 'า', confidence: 93, bbox: { x0: 42, y0: 880, x1: 60, y1: 937 } },
      { text: 'ณา', confidence: 89, bbox: { x0: 62, y0: 881, x1: 110, y1: 937 } },
      { text: 'junk', confidence: 20, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
    ]);
    expect(lines.map((l) => l.text)).toEqual(['The Empire', 'อาณา']);
    expect(lines[0].height).toBeGreaterThan(lines[1].height);
  });
});

describe('textMaskRaw', () => {
  it('light mode turns bright unsaturated pixels black and the rest white', () => {
    const raw = { data: new Uint8ClampedArray([250, 250, 245, 255, 200, 30, 30, 255]), width: 2, height: 1 };
    const m = textMaskRaw(raw, 'light');
    expect([m.data[0], m.data[4]]).toEqual([0, 255]);
  });
});
