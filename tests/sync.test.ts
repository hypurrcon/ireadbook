// @vitest-environment node
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from 'vitest';
import { IreadDB } from '../src/db/db';
import { buildManifest, planRequest, collectPayload, applyTombstones, applyPayload } from '../src/sync/core';

let A: IreadDB, B: IreadDB;
let n = 0;
beforeEach(async () => { n++; A = new IreadDB('a' + n); B = new IreadDB('b' + n); await A.open(); await B.open(); });

/** one full two-way exchange, the way two connected devices do it */
async function sync(x: IreadDB, y: IreadDB) {
  const mx = await buildManifest(x), my = await buildManifest(y);
  await applyTombstones(x, my.tombstones);
  await applyTombstones(y, mx.tombstones);
  const forX = await collectPayload(y, planRequest(await buildManifest(x), my));
  const forY = await collectPayload(x, planRequest(await buildManifest(y), mx));
  await applyPayload(x, forX);
  await applyPayload(y, forY);
}

const book = (id: string, updatedAt: number, extra: any = {}) => ({ id, title: id, authors: [], translators: [], tags: [], format: 'paperback', status: 'want', progressUnit: 'page', currentPage: 0, rereadCount: 0, needsLookup: false, needsReview: false, createdAt: 1, updatedAt, ...extra });

describe('sync core', () => {
  it('books from both devices end up on both', async () => {
    await A.books.put(book('a1', 10) as any);
    await B.books.put(book('b1', 10) as any);
    await sync(A, B);
    expect((await A.books.toArray()).map((b) => b.id).sort()).toEqual(['a1', 'b1']);
    expect((await B.books.toArray()).map((b) => b.id).sort()).toEqual(['a1', 'b1']);
  });
  it('the newer edit wins on both sides', async () => {
    await A.books.put(book('x', 10, { title: 'old' }) as any);
    await B.books.put(book('x', 20, { title: 'new' }) as any);
    await sync(A, B);
    expect((await A.books.get('x'))!.title).toBe('new');
    expect((await B.books.get('x'))!.title).toBe('new');
  });
  it('a deletion on one device removes the book on the other', async () => {
    await A.books.put(book('x', 10) as any);
    await B.books.put(book('x', 10) as any);
    await A.books.delete('x');
    await A.tombstones.put({ key: 'books:x', table: 'books', id: 'x', deletedAt: 15 });
    await sync(A, B);
    expect(await B.books.get('x')).toBeUndefined();
    expect(await A.books.get('x')).toBeUndefined();
  });
  it('an edit made after the deletion brings the book back', async () => {
    await A.tombstones.put({ key: 'books:x', table: 'books', id: 'x', deletedAt: 15 });
    await B.books.put(book('x', 30) as any);
    await sync(A, B);
    expect(await A.books.get('x')).toBeDefined();
  });
  it('a deleted book is not re-sent by a device that still has an older copy', async () => {
    await A.tombstones.put({ key: 'books:x', table: 'books', id: 'x', deletedAt: 15 });
    await B.books.put(book('x', 10) as any);
    await sync(A, B);
    expect(await A.books.get('x')).toBeUndefined();
    expect(await B.books.get('x')).toBeUndefined();
  });
  it('images missing on one side are copied with their bytes and type', async () => {
    await A.images.put({ id: 'img1', blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }) });
    await sync(A, B);
    const got = await B.images.get('img1');
    expect(got).toBeDefined();
    expect(got!.blob.type).toBe('image/jpeg');
    expect(new Uint8Array(await got!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
  it('achievements merge and keep the earliest unlock time', async () => {
    await A.achievements.put({ id: 'first_book', unlockedAt: 50 });
    await B.achievements.put({ id: 'first_book', unlockedAt: 20 });
    await B.achievements.put({ id: 'streak_3', unlockedAt: 30 });
    await sync(A, B);
    expect((await A.achievements.get('first_book'))!.unlockedAt).toBe(20);
    expect(await A.achievements.get('streak_3')).toBeDefined();
  });
  it('shared settings follow the newer device, device-only settings stay', async () => {
    await A.settings.put({ id: 'main', dailyGoalMin: 5, yearlyGoal: 12, quality: 'high', sharedUpdatedAt: 10 } as any);
    await B.settings.put({ id: 'main', dailyGoalMin: 20, yearlyGoal: 30, quality: 'low', sharedUpdatedAt: 99 } as any);
    await sync(A, B);
    const a = (await A.settings.get('main'))!;
    expect(a.dailyGoalMin).toBe(20);
    expect(a.yearlyGoal).toBe(30);
    expect(a.quality).toBe('high');
  });
  it('a second sync with nothing new transfers nothing', async () => {
    await A.books.put(book('a1', 10) as any);
    await sync(A, B);
    const req = planRequest(await buildManifest(B), await buildManifest(A));
    expect(Object.values(req.records).flat()).toEqual([]);
    expect(req.images).toEqual([]);
    expect(req.settings).toBe(false);
  });
});
