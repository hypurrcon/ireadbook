import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb } from '../src/db/db';
import * as repo from '../src/db/repo';

beforeEach(async () => { await resetDb(); });

describe('repo', () => {
  it('addBook sets timestamps, defaults and title fallback', async () => {
    const b = await repo.addBook({ title: '   ' });
    expect(b.id).toBeTruthy();
    expect(b.title).toBe('');
    expect(b.status).toBe('want');
    expect(b.createdAt).toBeGreaterThan(0);
    expect(b.updatedAt).toBe(b.createdAt);
    expect(b.authors).toEqual([]);
    expect(b.progressUnit).toBe('page');
  });

  it('updateBook bumps updatedAt', async () => {
    const b = await repo.addBook({ title: 'อาณาจักรมด' });
    await new Promise((r) => setTimeout(r, 5));
    await repo.updateBook(b.id, { rating: 4 });
    const u = await db.books.get(b.id);
    expect(u!.rating).toBe(4);
    expect(u!.updatedAt).toBeGreaterThan(b.updatedAt);
  });

  it('deleteBook cascades sessions, quotes and images', async () => {
    const img = await repo.putImage(new Blob(['x'], { type: 'image/jpeg' }));
    const b = await repo.addBook({ title: 'A', coverFrontId: img });
    await repo.addSession({ bookId: b.id, startedAt: 1000, endedAt: 61000, durationSec: 60, startPage: 0, endPage: 5, mode: 'manual' });
    await repo.addQuote({ bookId: b.id, text: 'q', page: 3 });
    await repo.deleteBook(b.id);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.quotes.count()).toBe(0);
    expect(await db.images.count()).toBe(0);
  });

  it('addSession updates currentPage, status and startedAt on first session', async () => {
    const b = await repo.addBook({ title: 'A', pageCount: 100 });
    await repo.addSession({ bookId: b.id, startedAt: 5000, endedAt: 65000, durationSec: 60, startPage: 0, endPage: 12, mode: 'timer' });
    const u = await db.books.get(b.id);
    expect(u!.currentPage).toBe(12);
    expect(u!.status).toBe('reading');
    expect(u!.startedAt).toBe(5000);
  });

  it('addSession reaching last page marks finished', async () => {
    const b = await repo.addBook({ title: 'A', pageCount: 100 });
    await repo.addSession({ bookId: b.id, startedAt: 5000, endedAt: 65000, durationSec: 60, startPage: 90, endPage: 100, mode: 'timer' });
    const u = await db.books.get(b.id);
    expect(u!.status).toBe('finished');
    expect(u!.finishedAt).toBe(65000);
  });

  it('settings have defaults and save merges', async () => {
    const s = await repo.getSettings();
    expect(s.dailyGoalMin).toBe(5);
    expect(s.room).toBe('attic');
    await repo.saveSettings({ dailyGoalMin: 10 });
    expect((await repo.getSettings()).dailyGoalMin).toBe(10);
    expect((await repo.getSettings()).room).toBe('attic');
  });
});

describe('series assignment', () => {
  it('assignSeries creates series once and sets index', async () => {
    const a = await repo.addBook({ title: 'ดาบพิฆาตอสูร เล่ม 1' });
    const b = await repo.addBook({ title: 'ดาบพิฆาตอสูร เล่ม 2' });
    await repo.assignSeries(a.id, 'ดาบพิฆาตอสูร', 1, 23);
    await repo.assignSeries(b.id, 'ดาบพิฆาตอสูร ', 2);
    const all = await db.series.toArray();
    expect(all.length).toBe(1);
    expect(all[0].totalVolumes).toBe(23);
    const bb = await db.books.get(b.id);
    expect(bb!.seriesId).toBe(all[0].id);
    expect(bb!.seriesIndex).toBe(2);
  });
  it('assignSeries with empty name removes the book from its series', async () => {
    const a = await repo.addBook({ title: 'x' });
    await repo.assignSeries(a.id, 'S', 1);
    await repo.assignSeries(a.id, '', undefined);
    const aa = await db.books.get(a.id);
    expect(aa!.seriesId).toBeUndefined();
  });
});
