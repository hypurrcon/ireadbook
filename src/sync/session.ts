import type { IreadDB } from '../db/db';
import type { Conn } from './transport';
import { applyPayload, applyTombstones, buildManifest, collectPayload, planRequest, type Manifest, type SyncRequest, type WireImage, type Payload } from './core';

export type SessionStatus = 'hello' | 'syncing' | 'synced' | 'rejected' | 'closed';
export interface Me { libraryId: string; libraryKey: string; deviceId: string; deviceName: string }
export interface Hooks {
  onStatus?: (s: SessionStatus) => void;
  onPeer?: (p: { deviceId: string; name: string }) => void;
  onChanged?: (n: number) => void;
}

type Msg =
  | { t: 'hello'; libraryId: string; key: string; deviceId: string; name: string }
  | { t: 'reject' }
  | { t: 'manifest'; m: Manifest }
  | { t: 'request'; r: SyncRequest }
  | { t: 'records'; p: Omit<Payload, 'images'> }
  | { t: 'image'; img: WireImage }
  | { t: 'sent' };

/** Runs the sync protocol on an open connection until it closes. */
export function runSession(conn: Conn, d: IreadDB, me: Me, hooks: Hooks = {}) {
  let status: SessionStatus = 'hello';
  let trusted = false;
  let waiting = 0; // our requests whose data has not fully arrived yet
  let queue = Promise.resolve();
  const set = (s: SessionStatus) => { if (status !== s) { status = s; hooks.onStatus?.(s); } };
  const send = (m: Msg) => conn.send(m);

  const sendManifest = async () => {
    if (!trusted) return;
    send({ t: 'manifest', m: await buildManifest(d) });
  };

  const handle = async (m: Msg) => {
    if (m.t === 'hello') {
      if (m.libraryId !== me.libraryId || m.key !== me.libraryKey) { send({ t: 'reject' }); set('rejected'); conn.close(); return; }
      trusted = true;
      hooks.onPeer?.({ deviceId: m.deviceId, name: m.name });
      set('syncing');
      await sendManifest();
      return;
    }
    if (m.t === 'reject') { set('rejected'); conn.close(); return; }
    if (!trusted) return;
    switch (m.t) {
      case 'manifest': {
        const removed = await applyTombstones(d, m.m.tombstones);
        if (removed) hooks.onChanged?.(removed);
        const r = planRequest(await buildManifest(d), m.m);
        waiting++;
        set('syncing');
        send({ t: 'request', r });
        break;
      }
      case 'request': {
        const p = await collectPayload(d, m.r);
        send({ t: 'records', p: { records: p.records, settings: p.settings } });
        for (const img of p.images) send({ t: 'image', img });
        send({ t: 'sent' });
        break;
      }
      case 'records': {
        const n = await applyPayload(d, { ...m.p, images: [] });
        if (n) hooks.onChanged?.(n);
        break;
      }
      case 'image': {
        const n = await applyPayload(d, { records: {}, images: [m.img] });
        if (n) hooks.onChanged?.(n);
        break;
      }
      case 'sent': {
        waiting = Math.max(0, waiting - 1);
        if (waiting === 0) set('synced');
        break;
      }
    }
  };

  conn.onMessage((m) => { queue = queue.then(() => handle(m as Msg)).catch(() => undefined); });
  conn.onClose(() => { if (status !== 'rejected') set('closed'); });
  send({ t: 'hello', libraryId: me.libraryId, key: me.libraryKey, deviceId: me.deviceId, name: me.deviceName });

  return {
    /** Tell the other device we may have something new. */
    resync: () => { queue = queue.then(sendManifest).catch(() => undefined); },
    close: () => conn.close(),
    get status() { return status; },
  };
}
