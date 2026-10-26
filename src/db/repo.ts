import { db, DEFAULT_SETTINGS } from './db';
import type { Book, Session, Quote, Settings, Series, SyncTable } from './types';

export const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

function tomb(table: SyncTable, ids: (string | undefined)[], at = Date.now()) {
  return db.tombstones.bulkPut(ids.filter(Boolean).map((id) => ({ key: `${table}:${id}`, table, id: id!, deletedAt: at })));
}

export function newBook(partial: Partial<Book>): Book {
  const now = Date.now();
  return {
    id: uid(),
    authors: [],
    translators: [],
    tags: [],
    format: 'paperback',
    status: 'want',
    progressUnit: 'page',
    currentPage: 0,
    rereadCount: 0,
    needsLookup: false,
    needsReview: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
    title: (partial.title ?? '').trim(),
  } as Book;
}

export async function addBook(partial: Partial<Book>): Promise<Book> {
  const b = newBook(partial);
  await db.books.add(b);
  return b;
}

export async function updateBook(id: string, patch: Partial<Book>) {
  const p = { ...patch, updatedAt: Date.now() };
  if (typeof p.title === 'string') p.title = p.title.trim();
  await db.books.update(id, p);
}

export async function deleteBook(id: string) {
  await db.transaction('rw', [db.books, db.sessions, db.quotes, db.images, db.tombstones], async () => {
    const b = await db.books.get(id);
    if (!b) return;
    const quotes = await db.quotes.where('bookId').equals(id).toArray();
    const imgIds = [b.coverFrontId, b.coverBackId, b.spineId, ...quotes.map((q) => q.photoId)].filter(Boolean) as string[];
    const sessionIds = await db.sessions.where('bookId').equals(id).primaryKeys();
    await tomb('books', [id]);
    await tomb('sessions', sessionIds);
    await tomb('quotes', quotes.map((q) => q.id));
    await tomb('images', imgIds);
    await db.images.bulkDelete(imgIds);
    await db.sessions.where('bookId').equals(id).delete();
    await db.quotes.where('bookId').equals(id).delete();
    await db.books.delete(id);
  });
}

export async function putImage(blob: Blob): Promise<string> {
  const id = uid();
  await db.images.put({ id, blob });
  return id;
}

export async function getImage(id?: string): Promise<Blob | undefined> {
  if (!id) return undefined;
  return (await db.images.get(id))?.blob;
}

export async function deleteImage(id?: string) {
  if (!id) return;
  await db.images.delete(id);
  await tomb('images', [id]);
}

function maxProgress(b: Book) {
  return b.progressUnit === 'percent' ? 100 : (b.pageCount ?? Infinity);
}

/** Apply a session's effect on the book's progress/status. */
async function applySessionToBook(s: Session) {
  const b = await db.books.get(s.bookId);
  if (!b) return;
  const patch: Partial<Book> = { currentPage: Math.max(0, s.endPage) };
  if (!b.startedAt || s.startedAt < b.startedAt) patch.startedAt = s.startedAt;
  if (s.endPage >= maxProgress(b)) {
    patch.status = 'finished';
    patch.finishedAt = s.endedAt;
  } else if (b.status === 'want' || b.status === 'paused') {
    patch.status = 'reading';
  }
  await updateBook(b.id, patch);
}

export async function addSession(s: Omit<Session, 'id' | 'updatedAt'>): Promise<Session> {
  const full: Session = { ...s, id: uid(), updatedAt: Date.now() };
  await db.sessions.add(full);
  await applySessionToBook(full);
  return full;
}

export async function updateSession(id: string, patch: Partial<Session>) {
  await db.sessions.update(id, { ...patch, updatedAt: Date.now() });
  const s = await db.sessions.get(id);
  if (s) {
    const latest = await db.sessions.where('bookId').equals(s.bookId).sortBy('startedAt');
    const last = latest[latest.length - 1];
    if (last && last.id === id) await updateBook(s.bookId, { currentPage: s.endPage });
  }
}

export async function deleteSession(id: string) {
  const s = await db.sessions.get(id);
  await db.sessions.delete(id);
  await tomb('sessions', [id]);
  if (!s) return;
  const rest = await db.sessions.where('bookId').equals(s.bookId).sortBy('startedAt');
  const last = rest[rest.length - 1];
  await updateBook(s.bookId, { currentPage: last ? last.endPage : 0 });
}

export async function addQuote(q: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>): Promise<Quote> {
  const now = Date.now();
  const full: Quote = { ...q, id: uid(), createdAt: now, updatedAt: now };
  await db.quotes.add(full);
  return full;
}

export async function deleteQuote(id: string) {
  const q = await db.quotes.get(id);
  if (q?.photoId) await deleteImage(q.photoId);
  await db.quotes.delete(id);
  await tomb('quotes', [id]);
}

export async function upsertSeries(name: string, totalVolumes?: number): Promise<Series> {
  const existing = (await db.series.toArray()).find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    if (totalVolumes && totalVolumes !== existing.totalVolumes) await db.series.update(existing.id, { totalVolumes, updatedAt: Date.now() });
    return existing;
  }
  const s: Series = { id: uid(), name: name.trim(), totalVolumes, updatedAt: Date.now() };
  await db.series.add(s);
  return s;
}

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('main');
  return { ...DEFAULT_SETTINGS, ...(s ?? {}), volume: { ...DEFAULT_SETTINGS.volume, ...(s?.volume ?? {}) } };
}

/** Settings that follow the user to paired devices. Everything else is per device. */
export const SHARED_SETTINGS = ['dailyGoalMin', 'yearlyGoal', 'pomodoroWork', 'pomodoroBreak', 'room', 'rooms'] as const;

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings();
  const shared = SHARED_SETTINGS.some((k) => k in patch);
  await db.settings.put({ ...cur, ...patch, ...(shared ? { sharedUpdatedAt: Date.now() } : {}), id: 'main' });
}

export async function deletePrompt(id: string) {
  await db.prompts.delete(id);
  await tomb('prompts', [id]);
}

/** Put a book into a series by name (created if new). Empty name removes it from its series. */
export async function assignSeries(bookId: string, name: string, index?: number, totalVolumes?: number) {
  if (!name.trim()) {
    await db.books.update(bookId, { seriesId: undefined, seriesIndex: undefined, updatedAt: Date.now() });
    return;
  }
  const s = await upsertSeries(name, totalVolumes);
  await updateBook(bookId, { seriesId: s.id, seriesIndex: index });
}

export async function getSeriesName(id: string): Promise<string | undefined> {
  return (await db.series.get(id))?.name;
}
