import { describe, it, expect } from 'vitest';
import { pagesPerMinute, etaMinutes } from '../src/domain/speed';
import { xpForSession, levelFromXp, totalXp, XP_FINISH_BOOK } from '../src/domain/xp';
import { newBook } from '../src/db/repo';
import type { Session } from '../src/db/types';

const ses = (bookId: string, min: number, sp: number, ep: number): Session => ({ id: Math.random() + '', bookId, startedAt: 0, endedAt: min * 60000, durationSec: min * 60, startPage: sp, endPage: ep, mode: 'timer', updatedAt: 0 });

describe('speed', () => {
  it('null with under 10 minutes of data', () => {
    expect(pagesPerMinute([ses('a', 5, 0, 5)])).toBeNull();
  });
  it('pages per minute across sessions', () => {
    expect(pagesPerMinute([ses('a', 10, 0, 5), ses('a', 10, 5, 15)])).toBeCloseTo(0.75);
  });
  it('filters by book', () => {
    expect(pagesPerMinute([ses('a', 10, 0, 10), ses('b', 10, 0, 30)], 'b')).toBeCloseTo(3);
  });
  it('eta uses remaining pages / book speed', () => {
    const b = newBook({ id: 'a', pageCount: 200, currentPage: 20 } as any);
    expect(etaMinutes(b, [ses('a', 20, 0, 20)])).toBe(180);
  });
  it('eta falls back to overall speed', () => {
    const b = newBook({ id: 'a', pageCount: 100, currentPage: 0 } as any);
    expect(etaMinutes(b, [ses('z', 20, 0, 40)])).toBe(50);
  });
  it('eta null without page count', () => {
    expect(etaMinutes(newBook({ id: 'a' } as any), [ses('a', 20, 0, 20)])).toBeNull();
  });
});

describe('xp', () => {
  it('1 xp per minute, capped at 180', () => {
    expect(xpForSession(25)).toBe(25);
    expect(xpForSession(400)).toBe(180);
  });
  it('levels', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, next: 100 });
    expect(levelFromXp(100).level).toBe(2);
    const l3 = 100 + Math.round(100 * Math.pow(2, 1.5));
    expect(levelFromXp(l3).level).toBe(3);
  });
  it('totalXp adds finish bonus and achievements', () => {
    expect(totalXp([ses('a', 30, 0, 1)], 1, 2)).toBe(30 + XP_FINISH_BOOK + 2 * 25);
  });
});
