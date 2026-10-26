import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, evaluateAchievements, type AchCtx } from '../src/domain/achievements';
import type { Book, Session } from '../src/db/types';

const day = 86400000;
const base = new Date(2026, 9, 1, 20, 0).getTime();
const S = (i: number, min: number, extra: Partial<Session> = {}): Session => ({
  id: 's' + i + Math.random(), bookId: 'b1', startedAt: base + i * day, endedAt: base + i * day + min * 60000, durationSec: min * 60, startPage: 0, endPage: 10, mode: 'timer', updatedAt: 0, ...extra,
});
const B = (id: string, extra: Partial<Book> = {}): Book => ({
  id, title: id, authors: [], translators: [], tags: [], format: 'paperback', status: 'want', progressUnit: 'page', currentPage: 0,
  rereadCount: 0, needsLookup: false, needsReview: false, createdAt: 0, updatedAt: 0, ...extra,
});
const ctx = (p: Partial<AchCtx>): AchCtx => ({ sessions: [], books: [], quotes: 0, goalMin: 5, today: '2026-10-30', ...p });

describe('achievements', () => {
  it('has about 20 unique achievements', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
  it('first session unlocks first_session only once', () => {
    const c = ctx({ sessions: [S(0, 6)] });
    expect(evaluateAchievements(c, new Set())).toContain('first_session');
    expect(evaluateAchievements(c, new Set(['first_session']))).not.toContain('first_session');
  });
  it('3-day streak', () => {
    const c = ctx({ sessions: [S(0, 6), S(1, 6), S(2, 6)], today: '2026-10-03' });
    expect(evaluateAchievements(c, new Set())).toContain('streak_3');
  });
  it('first finished book and big book', () => {
    const c = ctx({ books: [B('b1', { status: 'finished', pageCount: 600 })] });
    const got = evaluateAchievements(c, new Set());
    expect(got).toContain('first_book');
    expect(got).toContain('big_book');
  });
  it('night owl', () => {
    const late = new Date(2026, 9, 1, 23, 30).getTime();
    expect(evaluateAchievements(ctx({ sessions: [S(0, 10, { startedAt: late })] }), new Set())).toContain('night_owl');
  });
  it('comeback after 7+ days away', () => {
    const c = ctx({ sessions: [S(0, 6), S(9, 6)] });
    expect(evaluateAchievements(c, new Set())).toContain('comeback');
  });
  it('letting go of a book is an achievement, not a failure', () => {
    expect(evaluateAchievements(ctx({ books: [B('x', { status: 'dnf' })] }), new Set())).toContain('let_go');
  });
  it('series finisher needs every owned volume of a 2+ book series finished', () => {
    const books = [B('a', { seriesId: 's', status: 'finished' }), B('b', { seriesId: 's', status: 'finished' })];
    expect(evaluateAchievements(ctx({ books }), new Set())).toContain('series_done');
    books[1].status = 'reading';
    expect(evaluateAchievements(ctx({ books }), new Set())).not.toContain('series_done');
  });
});
