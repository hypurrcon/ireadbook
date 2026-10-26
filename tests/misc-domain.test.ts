import { describe, it, expect } from 'vitest';
import { normalizeIsbn } from '../src/domain/isbn';
import { parseVolume, guessSeries } from '../src/domain/series';
import { layoutShelves } from '../src/domain/layout';
import { pickRandom } from '../src/domain/random';
import { buildDailyIcs } from '../src/domain/ics';
import { newBook } from '../src/db/repo';

describe('isbn', () => {
  it('accepts the ants book ISBN-13 with dashes', () => {
    expect(normalizeIsbn('ISBN 978-616-94337-3-6')).toBe('9786169433736');
  });
  it('converts ISBN-10 to 13', () => {
    expect(normalizeIsbn('0-306-40615-2')).toBe('9780306406157');
  });
  it('rejects bad checksum', () => {
    expect(normalizeIsbn('9786169433737')).toBeNull();
  });
  it('rejects garbage', () => {
    expect(normalizeIsbn('hello')).toBeNull();
  });
});

describe('series', () => {
  it.each([
    ['ดาบพิฆาตอสูร เล่ม 2', 'ดาบพิฆาตอสูร', 2],
    ['ดาบพิฆาตอสูร เล่ม ๑๒', 'ดาบพิฆาตอสูร', 12],
    ['One Piece Vol. 3', 'One Piece', 3],
    ['Dune Volume 4', 'Dune', 4],
    ['Mistborn #2', 'Mistborn', 2],
    ['Attack on Titan 5', 'Attack on Titan', 5],
    ['Spy x Family (7)', 'Spy x Family', 7],
    ['อาณาจักรมด', 'อาณาจักรมด', null],
    ['1984', '1984', null],
    ['Fahrenheit 451', 'Fahrenheit 451', null],
  ])('parseVolume(%s)', (t, base, idx) => {
    expect(parseVolume(t)).toEqual({ base, index: idx });
  });
  it('guessSeries matches same base title', () => {
    const a = newBook({ title: 'Harry Potter เล่ม 1', authors: ['J.K. Rowling'] });
    const b = newBook({ title: 'Harry Potter เล่ม 2', authors: ['J.K. Rowling'] });
    const c = newBook({ title: 'อาณาจักรมด', authors: ['H.G. Wells'] });
    const g = guessSeries(b, [a, c]);
    expect(g?.baseTitle).toBe('Harry Potter');
    expect(g?.index).toBe(2);
    expect(g?.matches.map((m) => m.id)).toEqual([a.id]);
  });
  it('guessSeries null when no volume and no match', () => {
    expect(guessSeries(newBook({ title: 'อาณาจักรมด' }), [newBook({ title: 'อื่น' })])).toBeNull();
  });
});

describe('layout', () => {
  const genres = ['fantasy', 'history', 'scifi'] as const;
  const books = Array.from({ length: 300 }, (_, i) => newBook({ title: 'B' + i, genre: genres[i % 3], dominantColor: '#' + ((i * 4567) % 0xffffff).toString(16).padStart(6, '0') }));
  it('300 books span multiple cases and each appears once', () => {
    const cases = layoutShelves(books, 'genre', 24, 5);
    expect(cases.length).toBeGreaterThanOrEqual(2);
    const ids = cases.flatMap((c) => c.shelves.flatMap((s) => s.books.map((b) => b.id)));
    expect(ids.length).toBe(300);
    expect(new Set(ids).size).toBe(300);
  });
  it('small genre groups share a shelf, each marked by a segment label', () => {
    const cases = layoutShelves(books.slice(0, 9), 'genre', 24, 5);
    expect(cases[0].shelves.length).toBe(1);
    expect(cases[0].shelves[0].segments).toEqual([
      { label: 'fantasy', start: 0 }, { label: 'history', start: 3 }, { label: 'scifi', start: 6 },
    ]);
  });
  it('a group that does not fit the rest of a shelf starts a new shelf', () => {
    const a = Array.from({ length: 20 }, (_, i) => newBook({ title: 'A' + i, genre: 'fantasy' }));
    const b = Array.from({ length: 10 }, (_, i) => newBook({ title: 'B' + i, genre: 'history' }));
    const cases = layoutShelves([...a, ...b], 'genre', 24, 5);
    expect(cases[0].shelves.map((s) => s.books.length)).toEqual([20, 10]);
  });
  it('series mode orders volumes', () => {
    const s = [3, 1, 2].map((i) => newBook({ title: 'X ' + i, seriesId: 's1', seriesIndex: i }));
    const cases = layoutShelves([newBook({ title: 'Solo' }), ...s], 'series', 24, 5);
    const order = cases[0].shelves.flatMap((sh) => sh.books.map((b) => b.title));
    expect(order.indexOf('X 1')).toBeLessThan(order.indexOf('X 2'));
    expect(order.indexOf('X 2')).toBeLessThan(order.indexOf('X 3'));
  });
  it('a group larger than a shelf wraps onto the next shelf', () => {
    const many = Array.from({ length: 30 }, (_, i) => newBook({ title: 'F' + i, genre: 'fantasy' }));
    const cases = layoutShelves(many, 'genre', 24, 5);
    expect(cases[0].shelves[0].books.length).toBe(24);
    expect(cases[0].shelves[1].books.length).toBe(6);
  });
  it('empty → one empty case', () => {
    expect(layoutShelves([], 'genre', 24, 5)).toEqual([{ shelves: [] }]);
  });
});

describe('random', () => {
  it('only picks unread or paused books', () => {
    const bs = [newBook({ title: 'a', status: 'finished' }), newBook({ title: 'b', status: 'want' }), newBook({ title: 'c', status: 'dnf' })];
    expect(pickRandom(bs, () => 0.99)?.title).toBe('b');
  });
  it('includes books already being read when nothing else is waiting', () => {
    expect(pickRandom([newBook({ title: 'r', status: 'reading' }), newBook({ title: 'f', status: 'finished' })], () => 0.5)?.title).toBe('r');
  });
  it('null when nothing eligible', () => {
    expect(pickRandom([newBook({ status: 'finished' })])).toBeNull();
  });
});

describe('ics', () => {
  it('daily recurring event at chosen time', () => {
    const ics = buildDailyIcs('20:30', 'อ่านหนังสือ', 'แค่ 5 นาที');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toMatch(/DTSTART(;TZID=[^:]+)?:\d{8}T203000/);
    expect(ics).toContain('SUMMARY:อ่านหนังสือ');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics.split('\r\n').length).toBeGreaterThan(5);
  });
});

import { shelfCapacity } from '../src/domain/layout';
describe('shelfCapacity', () => {
  it('spreads a small library over the rows instead of one crowded shelf', () => {
    expect(shelfCapacity(18, 4)).toBe(6);
    expect(shelfCapacity(40, 4)).toBe(10);
  });
  it('caps at the physical maximum for big libraries', () => { expect(shelfCapacity(300, 4)).toBe(22); });
});
