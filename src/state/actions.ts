import type { TFunction } from 'i18next';
import type { Book, SessionMode } from '../db/types';
import { useTimer } from './timer';
import { sfx, haptic } from '../audio/sound';

export function startReading(book: Book, mode: SessionMode, navigate: (to: string) => void, targetMin?: number) {
  const startPage = book.status === 'finished' ? 0 : book.currentPage;
  useTimer.getState().start(book.id, mode, startPage, targetMin);
  sfx('pageFlip');
  haptic(14);
  navigate('/read/session');
}

export function formatMinutes(min: number, t: TFunction): string {
  const m = Math.round(min);
  if (m < 1) return t('time.lessThanMin');
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return t('time.hm', { h, m: r });
  if (h) return t('time.h', { h });
  return t('time.m', { m: r });
}

export function displayTitle(b: Pick<Book, 'title'>, t: TFunction) {
  return b.title || t('common.untitled');
}

export function progressRatio(b: Book): number | null {
  if (b.progressUnit === 'percent') return Math.min(1, b.currentPage / 100);
  if (!b.pageCount) return null;
  return Math.min(1, b.currentPage / b.pageCount);
}
