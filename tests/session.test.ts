// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IreadDB } from '../src/db/db';
import { memoryPair } from '../src/sync/transport';
import { runSession, type SessionStatus } from '../src/sync/session';

let A: IreadDB, B: IreadDB, n = 0;
beforeEach(async () => { n++; A = new IreadDB('sa' + n); B = new IreadDB('sb' + n); await A.open(); await B.open(); });

const lib = { libraryId: 'L', libraryKey: 'K' };
const book = (id: string, updatedAt: number) => ({ id, title: id, authors: [], translators: [], tags: [], format: 'paperback', status: 'want', progressUnit: 'page', currentPage: 0, rereadCount: 0, needsLookup: false, needsReview: false, createdAt: 1, updatedAt });
const until = async (f: () => boolean, ms = 3000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 10)); } };

describe('sync session over a connection', () => {
  it('two devices of the same library exchange everything, including images', async () => {
    await A.books.put(book('a', 5) as any);
    await A.images.put({ id: 'i1', blob: new Blob([new Uint8Array([9, 9])], { type: 'image/png' }) });
    await B.books.put(book('b', 5) as any);
    const [ca, cb] = memoryPair();
    const st: Record<string, SessionStatus> = {};
    const peersSeen: string[] = [];
    runSession(ca, A, { ...lib, deviceId: 'dA', deviceName: 'Phone' }, { onStatus: (s) => (st.a = s), onPeer: (p) => peersSeen.push(p.name) });
    runSession(cb, B, { ...lib, deviceId: 'dB', deviceName: 'PC' }, { onStatus: (s) => (st.b = s), onPeer: (p) => peersSeen.push(p.name) });
    await until(() => st.a === 'synced' && st.b === 'synced');
    expect((await A.books.toArray()).map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect((await B.books.toArray()).map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(await B.images.get('i1')).toBeDefined();
    expect(peersSeen.sort()).toEqual(['PC', 'Phone']);
  });
  it('a device with the wrong library key is rejected and gets nothing', async () => {
    await A.books.put(book('secret', 5) as any);
    const [ca, cb] = memoryPair();
    const st: Record<string, SessionStatus> = {};
    runSession(ca, A, { ...lib, deviceId: 'dA', deviceName: 'A' }, { onStatus: (s) => (st.a = s) });
    runSession(cb, B, { libraryId: 'L', libraryKey: 'WRONG', deviceId: 'dB', deviceName: 'B' }, { onStatus: (s) => (st.b = s) });
    await until(() => st.a === 'rejected' || st.a === 'closed');
    await new Promise((r) => setTimeout(r, 50));
    expect(await B.books.count()).toBe(0);
  });
  it('resync() after a local change pushes it to the other side', async () => {
    const [ca, cb] = memoryPair();
    const st: Record<string, SessionStatus> = {};
    const sa = runSession(ca, A, { ...lib, deviceId: 'dA', deviceName: 'A' }, { onStatus: (s) => (st.a = s) });
    runSession(cb, B, { ...lib, deviceId: 'dB', deviceName: 'B' }, { onStatus: (s) => (st.b = s) });
    await until(() => st.a === 'synced' && st.b === 'synced');
    await A.books.put(book('late', 9) as any);
    sa.resync();
    const t0 = Date.now();
    while (!(await B.books.get('late')) && Date.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 20));
    expect(await B.books.get('late')).toBeDefined();
  });
});
