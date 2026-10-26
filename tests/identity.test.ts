import { describe, it, expect, beforeEach } from 'vitest';
import { ensureIdentity, newPairCode, normalizeCode, PAIR_TTL_MS, adoptLibrary, upsertPeer, removePeer, loadIdentity } from '../src/sync/identity';

beforeEach(() => localStorage.clear());

describe('sync identity', () => {
  it('creates a library and device id once and keeps them', () => {
    const a = ensureIdentity();
    const b = ensureIdentity();
    expect(a.libraryId).toMatch(/^[0-9a-f]{32}$/);
    expect(a.deviceId).toMatch(/^[0-9a-f]{32}$/);
    expect(a.libraryKey.length).toBeGreaterThanOrEqual(32);
    expect(b).toEqual(a);
  });
  it('pair codes are 6 easy-to-read characters, valid for 5 minutes', () => {
    const c = newPairCode();
    expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(PAIR_TTL_MS).toBe(5 * 60 * 1000);
  });
  it('normalises typed codes', () => {
    expect(normalizeCode(' ab3 k7q ')).toBe('AB3K7Q');
    expect(normalizeCode('ab3-k7')).toBeNull();
    expect(normalizeCode('ab0k7q')).toBeNull(); // 0 is not in the alphabet
  });
  it('joining another library adopts its id and key and keeps this device id', () => {
    const me = ensureIdentity();
    adoptLibrary({ libraryId: 'f'.repeat(32), libraryKey: 'k'.repeat(40) });
    const after = loadIdentity()!;
    expect(after.libraryId).toBe('f'.repeat(32));
    expect(after.deviceId).toBe(me.deviceId);
  });
  it('peers are stored once and can be removed; this device is never its own peer', () => {
    const me = ensureIdentity();
    upsertPeer({ deviceId: 'p1', name: 'PC' });
    upsertPeer({ deviceId: 'p1', name: 'PC2', lastSyncAt: 5 });
    upsertPeer({ deviceId: me.deviceId, name: 'me' });
    expect(loadIdentity()!.peers).toEqual([{ deviceId: 'p1', name: 'PC2', lastSyncAt: 5 }]);
    removePeer('p1');
    expect(loadIdentity()!.peers).toEqual([]);
  });
});
