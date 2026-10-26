import { describe, it, expect } from 'vitest';
import { periodStats, monthRange, yearRange } from '../src/domain/stats';
import type { Book, Session } from '../src/db/types';

const at = (y: number, m: number, d: number, h = 20) => new Date(y, m - 1, d, h, 0).getTime();
const S = (start: number, min: number, from: number, to: number, bookId = 'a'): Session => ({ id: String(start), bookId, startedAt: start, endedAt: start + min * 60000, durationSec: min * 60, startPage: from, endPage: to, mode: 'timer', updatedAt: 0 });
const B = (id: string, genre: any, finishedAt?: number): Book => ({ id, title: id, authors: [], translators: [], tags: [], format: 'paperback', status: finishedAt ? 'finished' : 'reading', progressUnit: 'page', currentPage: 0, rereadCount: 0, needsLookup: false, needsReview: false, createdAt: 0, updatedAt: 0, genre, finishedAt });

describe('periodStats', () => {
  const sessions = [S(at(2026, 10, 1, 21), 30, 0, 20), S(at(2026, 10, 1, 22), 10, 20, 26), S(at(2026, 10, 3, 7), 20, 0, 15, 'b'), S(at(2026, 9, 30), 60, 0, 50)];
  const books = [B('a', 'fantasy', at(2026, 10, 2)), B('b', 'history'), B('c', 'fantasy', at(2026, 9, 1))];
  const [from, to] = monthRange(2026, 10);
  const s = periodStats(sessions, books, from, to);
  it('sums minutes and pages in range only', () => {
    expect(s.minutes).toBe(60);
    expect(s.pages).toBe(41);
  });
  it('counts distinct reading days', () => { expect(s.daysRead).toBe(2); });
  it('finished books in range', () => { expect(s.finished.map((b) => b.id)).toEqual(['a']); });
  it('genres weighted by minutes read', () => { expect(s.genres).toEqual({ fantasy: 40, history: 20 }); });
  it('hour histogram', () => { expect(s.hours[21]).toBe(30); expect(s.hours[7]).toBe(20); });
  it('longest session and speed', () => {
    expect(s.longestMin).toBe(30);
    expect(s.pagesPerHour).toBeCloseTo(41, 5);
  });
  it('year range includes all of the year', () => {
    const [a, b] = yearRange(2026);
    expect(periodStats(sessions, books, a, b).minutes).toBe(120);
  });
});
