import type { TFunction } from 'i18next';
import type { Book, Quote } from '../db/types';
import { db } from '../db/db';
import { toast } from '../ui/kit';
import { renderQuoteCard, type CardText } from './cards';

export function cardText(t: TFunction): CardText {
  return {
    untitled: t('common.untitled'),
    dateLocale: t('share.locale'),
    minutes: t('share.minutes'), pages: t('share.pages'), streakDays: t('share.streakDays'), readToday: t('share.readToday'),
    finished: t('share.finished'), daysToFinish: t('share.daysToFinish'), hours: t('share.hours'),
    page: (n) => t('quote.page', { page: n }), booksFinished: t('share.booksFinished'), daysRead: t('share.daysRead'), topGenre: t('share.topGenre'),
    minutesValue: (m) => t('time.m', { m }),
  };
}

/** Share an image via the Web Share sheet when files are supported, else download it. */
export async function shareBlob(blob: Blob, filename: string, t: TFunction): Promise<void> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  downloadBlob(blob, filename);
  toast(t('share.saved'), 'ok');
}

/** Download a file. */
export async function downloadBlob(blob: Blob, filename: string): Promise<{ kept?: string }> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return {};
}

export async function shareQuote(q: Quote, t: TFunction) {
  const book = (await db.books.get(q.bookId)) as Book | undefined;
  if (!book) return;
  const blob = await renderQuoteCard({ text: q.text, page: q.page, book }, cardText(t));
  await shareBlob(blob, 'ireadbook-quote.png', t);
}
