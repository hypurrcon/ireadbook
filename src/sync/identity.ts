/** This device's place in a shared library. Kept in localStorage (per device, never synced). */
export interface PeerInfo { deviceId: string; name: string; lastSyncAt?: number }
export interface Identity { libraryId: string; libraryKey: string; deviceId: string; deviceName: string; peers: PeerInfo[] }

const KEY = 'ireadbook-sync';
export const PAIR_TTL_MS = 5 * 60 * 1000;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function hex(bytes: number) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

function guessDeviceName() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad/i.test(ua)) return 'iPhone';
  if (/mac/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows';
  return 'Device';
}

export function loadIdentity(): Identity | null {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
function save(id: Identity) { try { localStorage.setItem(KEY, JSON.stringify(id)); } catch { /* storage blocked */ } }

export function ensureIdentity(): Identity {
  const cur = loadIdentity();
  if (cur) return cur;
  const id: Identity = { libraryId: hex(16), libraryKey: hex(24), deviceId: hex(16), deviceName: guessDeviceName(), peers: [] };
  save(id);
  return id;
}

export function updateIdentity(patch: Partial<Identity>) { save({ ...ensureIdentity(), ...patch }); }

export function adoptLibrary(lib: { libraryId: string; libraryKey: string }) { updateIdentity({ libraryId: lib.libraryId, libraryKey: lib.libraryKey }); }

export function upsertPeer(p: PeerInfo) {
  const me = ensureIdentity();
  if (p.deviceId === me.deviceId) return;
  const peers = me.peers.filter((x) => x.deviceId !== p.deviceId);
  const old = me.peers.find((x) => x.deviceId === p.deviceId);
  peers.push({ ...old, ...p });
  save({ ...me, peers });
}

export function removePeer(deviceId: string) {
  const me = ensureIdentity();
  save({ ...me, peers: me.peers.filter((x) => x.deviceId !== deviceId) });
}

/** Start over with a fresh library (used when all data is wiped). */
export function resetIdentity() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

export function newPairCode(): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function normalizeCode(input: string): string | null {
  const c = input.replace(/\s+/g, '').toUpperCase();
  return c.length === 6 && [...c].every((ch) => ALPHABET.includes(ch)) ? c : null;
}

export const devicePeerId = (deviceId: string) => `ireadbook-${deviceId}`;
export const pairPeerId = (code: string) => `ireadbook-pair-${code}`;
