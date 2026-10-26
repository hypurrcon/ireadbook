/** A message pipe between two devices. */
export interface Conn {
  send(msg: unknown): void;
  onMessage(cb: (msg: any) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

/** Where devices find each other. `listen` makes this device reachable under `id`. */
export interface Hub {
  listen(id: string, onConn: (c: Conn) => void): Promise<() => void>;
  connect(fromId: string, toId: string, timeoutMs?: number): Promise<Conn>;
}

export class TransportError extends Error {
  constructor(public code: 'unavailable' | 'timeout' | 'taken' | 'network') { super(code); }
}

// ---------------------------------------------------------------- PeerJS (real devices)

type PeerT = import('peerjs').Peer;
const peers = new Map<string, Promise<PeerT>>();

function openPeer(id: string): Promise<PeerT> {
  if (!peers.has(id)) {
    const p = import('peerjs').then(({ Peer }) => new Promise<PeerT>((res, rej) => {
      const peer = new Peer(id, { debug: 0 });
      const fail = (e: any) => {
        peers.delete(id);
        peer.destroy();
        rej(new TransportError(e?.type === 'unavailable-id' ? 'taken' : 'network'));
      };
      peer.once('open', () => { peer.off('error', fail); res(peer); });
      peer.once('error', fail);
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    }));
    peers.set(id, p);
  }
  return peers.get(id)!;
}

function wrap(dc: import('peerjs').DataConnection): Conn {
  const msgCbs: ((m: any) => void)[] = [];
  const closeCbs: (() => void)[] = [];
  let closed = false;
  const fireClose = () => { if (!closed) { closed = true; closeCbs.forEach((f) => f()); } };
  dc.on('data', (d) => msgCbs.forEach((f) => f(d)));
  dc.on('close', fireClose);
  dc.on('error', fireClose);
  return {
    send: (m) => { if (!closed) dc.send(m); },
    onMessage: (cb) => { msgCbs.push(cb); },
    onClose: (cb) => { closeCbs.push(cb); },
    close: () => { dc.close(); fireClose(); },
  };
}

export const peerHub: Hub = {
  async listen(id, onConn) {
    const peer = await openPeer(id);
    const handler = (dc: import('peerjs').DataConnection) => dc.on('open', () => onConn(wrap(dc)));
    peer.on('connection', handler);
    return () => { peer.off('connection', handler); };
  },
  async connect(fromId, toId, timeoutMs = 12000) {
    const peer = await openPeer(fromId);
    return new Promise<Conn>((res, rej) => {
      const dc = peer.connect(toId, { reliable: true, serialization: 'binary' });
      const timer = setTimeout(() => { cleanup(); dc.close(); rej(new TransportError('timeout')); }, timeoutMs);
      const onErr = (e: any) => {
        if (e?.type === 'peer-unavailable' && String(e?.message ?? '').includes(toId)) { cleanup(); rej(new TransportError('unavailable')); }
      };
      const cleanup = () => { clearTimeout(timer); peer.off('error', onErr); };
      peer.on('error', onErr);
      dc.on('open', () => { cleanup(); res(wrap(dc)); });
    });
  },
};

/** Stop being reachable under `id` (e.g. when a pairing code expires). */
export async function dropPeer(id: string) {
  const p = peers.get(id);
  if (!p) return;
  peers.delete(id);
  try { (await p).destroy(); } catch { /* never opened */ }
}

// ---------------------------------------------------------------- BroadcastChannel (tests: two tabs)

interface BcMsg { kind: 'connect' | 'accept' | 'refuse' | 'data' | 'close'; from: string; to: string; cid: string; data?: unknown }

export function bcHub(): Hub {
  const ch = new BroadcastChannel('ireadbook-bc');
  const listening = new Map<string, (c: Conn) => void>();
  const conns = new Map<string, { msg: ((m: any) => void)[]; close: (() => void)[]; closed: boolean }>();
  const pending = new Map<string, { res: (c: Conn) => void; rej: (e: Error) => void }>();
  const post = (m: BcMsg) => ch.postMessage(m);

  const make = (cid: string, me: string, other: string): Conn => {
    const st = { msg: [] as ((m: any) => void)[], close: [] as (() => void)[], closed: false };
    conns.set(`${cid}:${me}`, st);
    return {
      send: (data) => { if (!st.closed) post({ kind: 'data', from: me, to: other, cid, data }); },
      onMessage: (cb) => { st.msg.push(cb); },
      onClose: (cb) => { st.close.push(cb); },
      close: () => { if (!st.closed) { st.closed = true; post({ kind: 'close', from: me, to: other, cid }); st.close.forEach((f) => f()); } },
    };
  };

  ch.onmessage = (e: MessageEvent<BcMsg>) => {
    const m = e.data;
    if (m.kind === 'connect') {
      const l = listening.get(m.to);
      if (!l) { post({ kind: 'refuse', from: m.to, to: m.from, cid: m.cid }); return; }
      post({ kind: 'accept', from: m.to, to: m.from, cid: m.cid });
      l(make(m.cid, m.to, m.from));
    } else if (m.kind === 'accept') {
      const p = pending.get(m.cid);
      if (p) { pending.delete(m.cid); p.res(make(m.cid, m.to, m.from)); }
    } else if (m.kind === 'refuse') {
      // another tab may still accept; only a timeout fails the attempt
    } else {
      const st = conns.get(`${m.cid}:${m.to}`);
      if (!st || st.closed) return;
      if (m.kind === 'data') st.msg.forEach((f) => f(m.data));
      else { st.closed = true; st.close.forEach((f) => f()); }
    }
  };

  return {
    async listen(id, onConn) {
      listening.set(id, onConn);
      return () => { listening.delete(id); };
    },
    connect(fromId, toId, timeoutMs = 3000) {
      return new Promise<Conn>((res, rej) => {
        const cid = Math.random().toString(36).slice(2);
        const timer = setTimeout(() => { pending.delete(cid); rej(new TransportError('unavailable')); }, timeoutMs);
        pending.set(cid, { res: (c) => { clearTimeout(timer); res(c); }, rej });
        post({ kind: 'connect', from: fromId, to: toId, cid });
      });
    },
  };
}

// ---------------------------------------------------------------- in-memory pair (unit tests)

export function memoryPair(): [Conn, Conn] {
  const mk = () => ({ msg: [] as ((m: any) => void)[], close: [] as (() => void)[], closed: false });
  const a = mk(), b = mk();
  const conn = (me: typeof a, other: typeof a): Conn => ({
    send: (m) => { if (!me.closed) setTimeout(() => other.msg.forEach((f) => f(m)), 0); },
    onMessage: (cb) => { me.msg.push(cb); },
    onClose: (cb) => { me.close.push(cb); },
    close: () => {
      for (const s of [me, other]) if (!s.closed) { s.closed = true; s.close.forEach((f) => f()); }
    },
  });
  return [conn(a, b), conn(b, a)];
}
