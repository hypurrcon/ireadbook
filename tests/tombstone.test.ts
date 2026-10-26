import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb } from '../src/db/db';
import * as repo from '../src/db/repo';

beforeEach(async () => { await resetDb(); });

describe('deletions leave tombstones (so other devices delete too)', () => {
  it('deleteBook records the book, its sessions, quotes and images', async () => {
    const img = await repo.putImage(new Blob(['x']));
    const b = await repo.addBook({ title: 'A', coverFrontId: img });
    const s = await repo.addSession({ bookId: b.id, startedAt: 1, endedAt: 2, durationSec: 60, startPage: 0, endPage: 3, mode: 'timer' });
    const q = await repo.addQuote({ bookId: b.id, text: 'q' });
    await repo.deleteBook(b.id);
    const keys = (await db.tombstones.toArray()).map((t) => t.key).sort();
    expect(keys).toEqual([`books:${b.id}`, `images:${img}`, `quotes:${q.id}`, `sessions:${s.id}`].sort());
  });
  it('deleteSession and deletePrompt record tombstones', async () => {
    const b = await repo.addBook({ title: 'A' });
    const s = await repo.addSession({ bookId: b.id, startedAt: 1, endedAt: 2, durationSec: 60, startPage: 0, endPage: 3, mode: 'timer' });
    await repo.deleteSession(s.id);
    await db.prompts.put({ id: 'p1', name: 'n', body: 'b', builtIn: false, updatedAt: 1 });
    await repo.deletePrompt('p1');
    const keys = (await db.tombstones.toArray()).map((t) => t.key).sort();
    expect(keys).toEqual([`prompts:p1`, `sessions:${s.id}`]);
  });
  it('saving shared settings bumps sharedUpdatedAt, device-only settings do not', async () => {
    await repo.saveSettings({ quality: 'low' });
    expect((await repo.getSettings()).sharedUpdatedAt ?? 0).toBe(0);
    await repo.saveSettings({ dailyGoalMin: 15 });
    expect((await repo.getSettings()).sharedUpdatedAt).toBeGreaterThan(0);
  });
});
