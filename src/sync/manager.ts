import { create } from 'zustand';
import Dexie from 'dexie';
import { db } from '../db/db';
import { runSession, type SessionStatus } from './session';
import { dropPeer, peerHub, type Conn, type Hub } from './transport';
import {
  ensureIdentity, loadIdentity, upsertPeer, removePeer as forgetPeer, adoptLibrary, newPairCode, normalizeCode,
  devicePeerId, pairPeerId, PAIR_TTL_MS, type PeerInfo,
} from './identity';

export type PeerState = 'offline' | 'connecting' | 'syncing' | 'synced';
export type PairState = 'starting' | 'waiting' | 'connected' | 'expired' | 'error';
export type JoinState = 'idle' | 'connecting' | 'syncing' | 'done' | 'notFound' | 'error';

interface SyncStore {
  peerState: Record<string, PeerState>;
  pairing: { code: string; expiresAt: number; state: PairState } | null;
  join: JoinState;
  lastChangeAt: number;
}
export const useSync = create<SyncStore>(() => ({ peerState: {}, pairing: null, join: 'idle', lastChangeAt: 0 }));

const getHub = (): Hub => peerHub;

const sessions = new Map<string, ReturnType<typeof runSession>>();
let stopListening: (() => void) | null = null;
let started = false;

const setPeer = (id: string, s: PeerState) => useSync.setState((st) => ({ peerState: { ...st.peerState, [id]: s } }));

function attach(conn: Conn, knownId?: string) {
  const me = ensureIdentity();
  let peerId = knownId;
  if (peerId) setPeer(peerId, 'syncing');
  const s = runSession(conn, db, me, {
    onPeer: (p) => {
      peerId = p.deviceId;
      const old = sessions.get(p.deviceId);
      if (old && old !== s) old.close();
      sessions.set(p.deviceId, s);
      upsertPeer({ deviceId: p.deviceId, name: p.name });
      setPeer(p.deviceId, 'syncing');
    },
    onStatus: (st: SessionStatus) => {
      if (!peerId) return;
      if (st === 'synced') { upsertPeer({ deviceId: peerId, name: nameOf(peerId), lastSyncAt: Date.now() }); setPeer(peerId, 'synced'); }
      else if (st === 'syncing') setPeer(peerId, 'syncing');
      else if (st === 'closed' || st === 'rejected') {
        if (sessions.get(peerId) === s) sessions.delete(peerId);
        setPeer(peerId, 'offline');
      }
    },
    onChanged: () => useSync.setState({ lastChangeAt: Date.now() }),
  });
  return s;
}

const nameOf = (id: string) => loadIdentity()?.peers.find((p) => p.deviceId === id)?.name ?? '';

async function ensureListening() {
  if (stopListening) return;
  const me = ensureIdentity();
  try {
    stopListening = await getHub().listen(devicePeerId(me.deviceId), (c) => attach(c));
  } catch { stopListening = null; }
}

async function connectTo(p: PeerInfo) {
  if (sessions.has(p.deviceId)) return;
  const me = ensureIdentity();
  setPeer(p.deviceId, 'connecting');
  try {
    const c = await getHub().connect(devicePeerId(me.deviceId), devicePeerId(p.deviceId));
    attach(c, p.deviceId);
  } catch {
    if (!sessions.has(p.deviceId)) setPeer(p.deviceId, 'offline');
  }
}

export async function connectAll() {
  const me = loadIdentity();
  if (!me?.peers.length) return;
  await ensureListening();
  await Promise.all(me.peers.map(connectTo));
}

/** Tell every connected device that something changed here. */
export function pushChanges() { sessions.forEach((s) => s.resync()); }

/** Call once at app start. */
export function startSync() {
  if (started) return;
  started = true;
  ensureIdentity();
  connectAll();
  let t: ReturnType<typeof setTimeout> | undefined;
  Dexie.on('storagemutated', () => { clearTimeout(t); t = setTimeout(pushChanges, 1200); });
  setInterval(() => { if (document.visibilityState === 'visible') connectAll(); }, 45_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') connectAll(); });
  window.addEventListener('online', () => connectAll());
}

export async function syncNow() {
  await connectAll();
  pushChanges();
}

export function disconnectPeer(deviceId: string) {
  sessions.get(deviceId)?.close();
  sessions.delete(deviceId);
  forgetPeer(deviceId);
  useSync.setState((st) => { const p = { ...st.peerState }; delete p[deviceId]; return { peerState: p }; });
}

// ---------------------------------------------------------------- pairing

let pairTimer: ReturnType<typeof setTimeout> | undefined;
let pairStop: (() => void) | null = null;

/** Stop accepting the code. The connection already made through it stays open; the
 *  code's peer is released when the 5 minutes are over. */
async function endPairing(state: PairState) {
  const p = useSync.getState().pairing;
  pairStop?.(); pairStop = null;
  if (!p) return;
  useSync.setState({ pairing: { ...p, state } });
  clearTimeout(pairTimer);
  const left = Math.max(0, p.expiresAt - Date.now());
  if (state === 'connected') setTimeout(() => dropPeer(pairPeerId(p.code)), left + 60_000);
  else await dropPeer(pairPeerId(p.code));
}

/** This device shows a code; another device types it to join this library. */
export async function startPairing() {
  await endPairing('expired');
  const code = newPairCode();
  const expiresAt = Date.now() + PAIR_TTL_MS;
  useSync.setState({ pairing: { code, expiresAt, state: 'starting' } });
  try {
    pairStop = await getHub().listen(pairPeerId(code), (conn) => {
      conn.onMessage((m: any) => {
        if (m?.t !== 'join' || typeof m.deviceId !== 'string') return;
        const me = ensureIdentity();
        conn.send({ t: 'welcome', libraryId: me.libraryId, key: me.libraryKey, deviceId: me.deviceId, name: me.deviceName, peers: me.peers });
        upsertPeer({ deviceId: m.deviceId, name: String(m.name ?? '') });
        attach(conn, m.deviceId);
        ensureListening();
        endPairing('connected');
      });
    });
    useSync.setState({ pairing: { code, expiresAt, state: 'waiting' } });
    pairTimer = setTimeout(() => endPairing('expired'), PAIR_TTL_MS);
  } catch {
    useSync.setState({ pairing: { code, expiresAt, state: 'error' } });
  }
}

export function cancelPairing() { endPairing('expired').then(() => useSync.setState({ pairing: null })); }

/** Join the library of the device showing `input` as its code. */
export async function joinWithCode(input: string): Promise<JoinState> {
  const code = normalizeCode(input);
  if (!code) { useSync.setState({ join: 'notFound' }); return 'notFound'; }
  useSync.setState({ join: 'connecting' });
  const me = ensureIdentity();
  let conn: Conn;
  try {
    conn = await getHub().connect(devicePeerId(me.deviceId), pairPeerId(code));
  } catch (e: any) {
    const s: JoinState = e?.code === 'network' ? 'error' : 'notFound';
    useSync.setState({ join: s });
    return s;
  }
  return new Promise<JoinState>((resolve) => {
    const timer = setTimeout(() => { conn.close(); useSync.setState({ join: 'error' }); resolve('error'); }, 15000);
    conn.onMessage((m: any) => {
      if (m?.t !== 'welcome') return;
      clearTimeout(timer);
      adoptLibrary({ libraryId: m.libraryId, libraryKey: m.key });
      upsertPeer({ deviceId: m.deviceId, name: String(m.name ?? '') });
      for (const p of (m.peers ?? []) as PeerInfo[]) upsertPeer({ deviceId: p.deviceId, name: p.name });
      useSync.setState({ join: 'syncing' });
      attach(conn, m.deviceId);
      const started = Date.now();
      const wait = setInterval(() => {
        const st = useSync.getState().peerState[m.deviceId];
        if (st === 'synced') { clearInterval(wait); useSync.setState({ join: 'done' }); resolve('done'); return; }
        if (Date.now() - started > 60_000) { clearInterval(wait); useSync.setState({ join: 'error' }); resolve('error'); }
      }, 200);
      ensureListening();
    });
    conn.send({ t: 'join', deviceId: me.deviceId, name: me.deviceName });
  });
}
