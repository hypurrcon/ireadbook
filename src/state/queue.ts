import { create } from 'zustand';
import { db } from '../db/db';
import * as repo from '../db/repo';
import type { Book } from '../db/types';
import { blobToRaw } from '../image/process';
import { ocrCover } from '../lookup/ocr';
import { guessFromOcr } from '../lookup/guess';
import { lookupIsbn, searchText } from '../lookup/books';
import { resolveMeta } from '../lookup/resolve';
import { fillEmpty } from '../domain/meta';

type JobState = 'queued' | 'working' | 'done' | 'error';
interface QueueState { jobs: Record<string, JobState>; set: (id: string, s: JobState) => void }
export const useQueue = create<QueueState>((set, get) => ({ jobs: {}, set: (id, s) => set({ jobs: { ...get().jobs, [id]: s } }) }));

let running = false;
const order: string[] = [];

async function work(id: string) {
  const book = await db.books.get(id);
  if (!book) return;
  const online = navigator.onLine;
  let guess = {};
  if (!book.isbn || !online) {
    const front = await repo.getImage(book.coverFrontId);
    if (front) {
      try { guess = guessFromOcr(await ocrCover(await blobToRaw(front)), []); } catch { /* ocr unavailable */ }
    }
  }
  const r = await resolveMeta({ isbn: book.isbn, ocr: guess, online }, { lookupIsbn, searchText });
  const fresh = await db.books.get(id);
  if (fresh) await repo.updateBook(id, fillEmpty(fresh, r.patch));
}

async function pump() {
  if (running) return;
  running = true;
  const q = useQueue.getState();
  while (order.length) {
    const id = order.shift()!;
    q.set(id, 'working');
    try { await work(id); q.set(id, 'done'); } catch { q.set(id, 'error'); }
  }
  running = false;
}

/** Analyse a saved book's cover in the background (continuous add mode). */
export function enqueueAnalysis(bookId: string) {
  if (!order.includes(bookId)) order.push(bookId);
  useQueue.getState().set(bookId, 'queued');
  pump();
}

/** Books saved while offline: look them up again now that we are online. */
export async function retryPendingLookups() {
  if (!navigator.onLine) return;
  const pending = (await db.books.toArray()).filter((b) => b.needsLookup);
  for (const b of pending) {
    try {
      const r = await resolveMeta({ isbn: b.isbn, ocr: { title: b.title, originalTitle: b.originalTitle, authors: b.authors }, online: true }, { lookupIsbn, searchText });
      if (r.patch.needsLookup) return; // network still failing
      const fresh = await db.books.get(b.id);
      if (fresh) await repo.updateBook(b.id, { ...fillEmpty(fresh, r.patch), needsLookup: false });
    } catch { return; }
  }
}

/** Re-queue books still waiting for analysis after an app restart. */
export async function resumeQueue() {
  const waiting = (await db.books.toArray()).filter((b) => b.needsReview && !b.title && b.coverFrontId);
  waiting.forEach((b) => enqueueAnalysis(b.id));
}
