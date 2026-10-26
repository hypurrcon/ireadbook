import { describe, it, expect } from 'vitest';
import { dayKey, addDays } from '../src/domain/dates';
import { computeStreak, minutesByDay } from '../src/domain/streak';
import type { Session } from '../src/db/types';

let n = 0;
function s(y: number, m: number, d: number, min: number, h = 20, mi = 0): Session {
  const start = new Date(y, m - 1, d, h, mi).getTime();
  return { id: String(n++), bookId: 'b', startedAt: start, endedAt: start + min * 60000, durationSec: min * 60, startPage: 0, endPage: 1, mode: 'timer', updatedAt: 0 };
}

describe('dates', () => {
  it('dayKey is local date', () => {
    expect(dayKey(new Date(2026, 9, 5, 23, 59).getTime())).toBe('2026-10-05');
  });
  it('addDays crosses month', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    const ss = [1, 2, 3, 4, 5].map((d) => s(2026, 10, d, 10));
    const r = computeStreak(ss, 5, '2026-10-05');
    expect(r.current).toBe(5);
    expect(r.todayDone).toBe(true);
  });
  it('session crossing midnight counts on start day', () => {
    const m = minutesByDay([s(2026, 10, 5, 30, 23, 50)]);
    expect(m.get('2026-10-05')).toBe(30);
    expect(m.get('2026-10-06')).toBeUndefined();
  });
  it('days below goal do not count', () => {
    const r = computeStreak([s(2026, 10, 4, 10), s(2026, 10, 5, 3)], 5, '2026-10-05');
    expect(r.todayDone).toBe(false);
    expect(r.current).toBe(1);
  });
  it('single missed day is frozen and streak continues', () => {
    const ss = [1, 2, 4, 5].map((d) => s(2026, 10, d, 10));
    const r = computeStreak(ss, 5, '2026-10-05');
    expect(r.current).toBe(4);
    expect(r.frozenDays).toEqual(['2026-10-03']);
  });
  it('third gap in the same month breaks the streak', () => {
    const ss = [1, 3, 5, 7, 8].map((d) => s(2026, 10, d, 10));
    const r = computeStreak(ss, 5, '2026-10-08');
    expect(r.current).toBe(2);
    expect(r.best).toBe(3);
  });
  it('freezes reset in a new month', () => {
    const ss = [28, 30].map((d) => s(2026, 9, d, 10)).concat([2, 4].map((d) => s(2026, 10, d, 10)));
    // gaps: 9/29 (sep freeze 1), 10/1 (oct freeze 1), 10/3 (oct freeze 2)
    const r = computeStreak(ss, 5, '2026-10-04');
    expect(r.current).toBe(4);
  });
  it('two-day gap breaks', () => {
    const ss = [1, 2, 5].map((d) => s(2026, 10, d, 10));
    expect(computeStreak(ss, 5, '2026-10-05').current).toBe(1);
  });
  it('unread today keeps yesterday streak alive', () => {
    const ss = [1, 2, 3].map((d) => s(2026, 10, d, 10));
    const r = computeStreak(ss, 5, '2026-10-04');
    expect(r.current).toBe(3);
    expect(r.todayDone).toBe(false);
  });
  it('no sessions → zero', () => {
    expect(computeStreak([], 5, '2026-10-04')).toMatchObject({ current: 0, best: 0, todayDone: false });
  });
});
