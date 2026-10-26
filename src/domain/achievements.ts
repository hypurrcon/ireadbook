import type { Book, Session } from '../db/types';
import { computeStreak } from './streak';
import { dayKey, keyToDate } from './dates';

export interface AchCtx { sessions: Session[]; books: Book[]; quotes: number; goalMin: number; today: string }
export interface AchDef { id: string; icon: 'flame' | 'read' | 'clock' | 'star' | 'moon' | 'sun' | 'series' | 'quote' | 'shelf' | 'refresh' | 'check'; test: (c: Derived) => boolean }

interface Derived extends AchCtx { minutes: number; finished: Book[]; best: number; longest: number; hours: number[]; maxGapDays: number; fiveMin: number }

function derive(c: AchCtx): Derived {
  const minutes = c.sessions.reduce((a, s) => a + s.durationSec / 60, 0);
  const finished = c.books.filter((b) => b.status === 'finished');
  const best = computeStreak(c.sessions, c.goalMin, c.today).best;
  const longest = c.sessions.reduce((a, s) => Math.max(a, s.durationSec / 60), 0);
  const hours = c.sessions.map((s) => new Date(s.startedAt).getHours());
  const days = [...new Set(c.sessions.map((s) => dayKey(s.startedAt)))].sort();
  let maxGapDays = 0;
  for (let i = 1; i < days.length; i++) {
    const gap = Math.round((keyToDate(days[i]).getTime() - keyToDate(days[i - 1]).getTime()) / 86400000);
    maxGapDays = Math.max(maxGapDays, gap);
  }
  const fiveMin = c.sessions.filter((s) => s.mode === '5min').length;
  return { ...c, minutes, finished, best, longest, hours, maxGapDays, fiveMin };
}

function seriesDone(books: Book[]) {
  const by = new Map<string, Book[]>();
  for (const b of books) if (b.seriesId) by.set(b.seriesId, [...(by.get(b.seriesId) ?? []), b]);
  return [...by.values()].some((l) => l.length >= 2 && l.every((b) => b.status === 'finished'));
}

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'first_session', icon: 'read', test: (c) => c.sessions.length >= 1 },
  { id: 'first_book', icon: 'check', test: (c) => c.finished.length >= 1 },
  { id: 'streak_3', icon: 'flame', test: (c) => c.best >= 3 },
  { id: 'streak_7', icon: 'flame', test: (c) => c.best >= 7 },
  { id: 'streak_30', icon: 'flame', test: (c) => c.best >= 30 },
  { id: 'streak_100', icon: 'flame', test: (c) => c.best >= 100 },
  { id: 'hour_1', icon: 'clock', test: (c) => c.minutes >= 60 },
  { id: 'hour_10', icon: 'clock', test: (c) => c.minutes >= 600 },
  { id: 'hour_50', icon: 'clock', test: (c) => c.minutes >= 3000 },
  { id: 'books_5', icon: 'shelf', test: (c) => c.finished.length >= 5 },
  { id: 'books_12', icon: 'shelf', test: (c) => c.finished.length >= 12 },
  { id: 'books_25', icon: 'shelf', test: (c) => c.finished.length >= 25 },
  { id: 'deep_30', icon: 'star', test: (c) => c.longest >= 30 },
  { id: 'deep_60', icon: 'star', test: (c) => c.longest >= 60 },
  { id: 'night_owl', icon: 'moon', test: (c) => c.hours.some((h) => h >= 23 || h < 4) },
  { id: 'early_bird', icon: 'sun', test: (c) => c.hours.some((h) => h >= 4 && h < 7) },
  { id: 'five_min_10', icon: 'clock', test: (c) => c.fiveMin >= 10 },
  { id: 'comeback', icon: 'refresh', test: (c) => c.maxGapDays >= 7 },
  { id: 'big_book', icon: 'read', test: (c) => c.finished.some((b) => (b.pageCount ?? 0) >= 500) },
  { id: 'genres_5', icon: 'star', test: (c) => new Set(c.finished.map((b) => b.genre ?? 'other')).size >= 5 },
  { id: 'series_done', icon: 'series', test: (c) => seriesDone(c.books) },
  { id: 'quotes_10', icon: 'quote', test: (c) => c.quotes >= 10 },
  { id: 'shelf_20', icon: 'shelf', test: (c) => c.books.length >= 20 },
  { id: 'let_go', icon: 'check', test: (c) => c.books.some((b) => b.status === 'dnf') },
];

/** Ids that are earned now but not yet in `unlocked`. */
export function evaluateAchievements(ctx: AchCtx, unlocked: Set<string>): string[] {
  const d = derive(ctx);
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.test(d)).map((a) => a.id);
}
