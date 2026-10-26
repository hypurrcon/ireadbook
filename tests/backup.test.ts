// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { db, resetDb } from '../src/db/db';
import * as repo from '../src/db/repo';
import { exportBackup, importBackup, BackupError } from '../src/backup/backup';

beforeEach(async () => { await resetDb(); });

async function seed() {
  const img = await repo.putImage(new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }));
  const b = await repo.addBook({ title: 'อาณาจักรมด', authors: ['เอช.จี.เวลส์'], coverFrontId: img, pageCount: 150 });
  await repo.addSession({ bookId: b.id, startedAt: 1000, endedAt: 601000, durationSec: 600, startPage: 0, endPage: 10, mode: 'timer' });
  await repo.saveSettings({ dailyGoalMin: 15 });
  return b;
}

describe('backup', () => {
  it('round trip restores books, sessions, settings and images', async () => {
    const b = await seed();
    const blob = await exportBackup();
    await resetDb();
    const r = await importBackup(blob, 'replace');
    expect(r).toEqual({ books: 1, sessions: 1 });
    const back = await db.books.get(b.id);
    expect(back!.title).toBe('อาณาจักรมด');
    expect((await repo.getSettings()).dailyGoalMin).toBe(15);
    const img = await repo.getImage(back!.coverFrontId);
    expect(new Uint8Array(await img!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('merge keeps the newer updatedAt', async () => {
    const b = await seed();
    const blob = await exportBackup();
    await new Promise((r) => setTimeout(r, 5));
    await repo.updateBook(b.id, { title: 'ใหม่กว่า' });
    await importBackup(blob, 'merge');
    expect((await db.books.get(b.id))!.title).toBe('ใหม่กว่า');
  });

  it('merge adds books that are not present', async () => {
    const b = await seed();
    const blob = await exportBackup();
    await repo.deleteBook(b.id);
    await repo.addBook({ title: 'อื่น' });
    await importBackup(blob, 'merge');
    expect(await db.books.count()).toBe(2);
  });

  it('corrupt file is rejected and data untouched', async () => {
    await seed();
    await expect(importBackup(new Blob(['not a zip']), 'replace')).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.books.count()).toBe(1);
  });

  it('newer format version is rejected', async () => {
    await seed();
    const z = zipSync({ 'data.json': strToU8(JSON.stringify({ formatVersion: 99, app: 'ireadbook' })) });
    await expect(importBackup(new Blob([z]), 'replace')).rejects.toBeInstanceOf(BackupError);
    await expect(importBackup(new Blob([z]), 'replace')).rejects.toMatchObject({ code: 'version' });
    expect(await db.books.count()).toBe(1);
  });
});
