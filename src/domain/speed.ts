import type { Book, Session } from '../db/types';

export const MIN_MINUTES_FOR_SPEED = 10;

export function pagesPerMinute(sessions: Session[], bookId?: string): number | null {
  const list = bookId ? sessions.filter((s) => s.bookId === bookId) : sessions;
  let pages = 0, min = 0;
  for (const s of list) {
    pages += Math.max(0, s.endPage - s.startPage);
    min += s.durationSec / 60;
  }
  if (min < MIN_MINUTES_FOR_SPEED || pages <= 0) return null;
  return pages / min;
}

export function etaMinutes(book: Book, sessions: Session[], pageBookIds?: Set<string>): number | null {
  const total = book.progressUnit === 'percent' ? 100 : book.pageCount;
  if (!total) return null;
  const remaining = Math.max(0, total - book.currentPage);
  let speed = pagesPerMinute(sessions, book.id);
  if (speed == null && book.progressUnit === 'page') {
    const pool = pageBookIds ? sessions.filter((s) => pageBookIds.has(s.bookId)) : sessions;
    speed = pagesPerMinute(pool);
  }
  if (speed == null) return null;
  return Math.round(remaining / speed);
}
