import type { Book, Session } from '../db/types';
import { dayKey } from './dates';

export const monthRange = (y: number, m: number): [number, number] => [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()];
export const yearRange = (y: number): [number, number] => [new Date(y, 0, 1).getTime(), new Date(y + 1, 0, 1).getTime()];

export interface PeriodStats {
  minutes: number; pages: number; daysRead: number; finished: Book[]; genres: Record<string, number>;
  hours: number[]; longestMin: number; pagesPerHour: number | null; perDay: Map<string, number>; sessions: number;
}

/** Aggregate reading in [from, to). Sessions count on their start time. */
export function periodStats(sessions: Session[], books: Book[], from: number, to: number): PeriodStats {
  const byId = new Map(books.map((b) => [b.id, b]));
  const inRange = sessions.filter((s) => s.startedAt >= from && s.startedAt < to);
  const perDay = new Map<string, number>();
  const genres: Record<string, number> = {};
  const hours = new Array(24).fill(0);
  let minutes = 0, pages = 0, longestMin = 0, pageMin = 0;
  for (const s of inRange) {
    const m = s.durationSec / 60;
    minutes += m;
    longestMin = Math.max(longestMin, m);
    const k = dayKey(s.startedAt);
    perDay.set(k, (perDay.get(k) ?? 0) + m);
    hours[new Date(s.startedAt).getHours()] += m;
    const b = byId.get(s.bookId);
    const g = b?.genre ?? 'other';
    genres[g] = (genres[g] ?? 0) + m;
    if (!b || b.progressUnit === 'page') { pages += Math.max(0, s.endPage - s.startPage); pageMin += m; }
  }
  const finished = books.filter((b) => b.status === 'finished' && b.finishedAt !== undefined && b.finishedAt >= from && b.finishedAt < to)
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
  return {
    minutes: Math.round(minutes), pages, daysRead: perDay.size, finished, genres, hours, longestMin: Math.round(longestMin),
    pagesPerHour: pageMin >= 10 && pages > 0 ? (pages / pageMin) * 60 : null, perDay, sessions: inRange.length,
  };
}
