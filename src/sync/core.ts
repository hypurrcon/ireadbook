import type { IreadDB } from '../db/db';
import type { Settings, Tombstone } from '../db/types';
import { SHARED_SETTINGS } from '../db/repo';

export const REC_TABLES = ['books', 'series', 'sessions', 'quotes', 'achievements', 'prompts'] as const;
export type RecTable = typeof REC_TABLES[number];

export interface Manifest {
  v: 1;
  records: Record<RecTable, Record<string, number>>;
  tombstones: Tombstone[];
  images: string[];
  settingsAt: number;
}
export interface SyncRequest { records: Record<RecTable, string[]>; images: string[]; settings: boolean }
export interface WireImage { id: string; type: string; bytes: Uint8Array }
export interface Payload { records: Partial<Record<RecTable, any[]>>; images: WireImage[]; settings?: Partial<Settings> }

const version = (t: RecTable, r: any): number => (t === 'achievements' ? r.unlockedAt : r.updatedAt) ?? 0;

export async function buildManifest(d: IreadDB): Promise<Manifest> {
  const records = {} as Manifest['records'];
  for (const t of REC_TABLES) {
    const rows = await d.table(t).toArray();
    records[t] = Object.fromEntries(rows.map((r: any) => [r.id, version(t, r)]));
  }
  const s = await d.settings.get('main');
  return {
    v: 1, records, tombstones: await d.tombstones.toArray(),
    images: (await d.images.toCollection().primaryKeys()) as string[],
    settingsAt: s?.sharedUpdatedAt ?? 0,
  };
}

/** What `local` should ask `remote` for. */
export function planRequest(local: Manifest, remote: Manifest): SyncRequest {
  const dead = new Map(local.tombstones.map((t) => [t.key, t.deletedAt]));
  const records = {} as SyncRequest['records'];
  for (const t of REC_TABLES) {
    const mine = local.records[t] ?? {};
    records[t] = Object.entries(remote.records[t] ?? {}).filter(([id, at]) => {
      if ((dead.get(`${t}:${id}`) ?? -1) >= at) return false;
      if (t === 'achievements') return !(id in mine) || at < mine[id];
      return !(id in mine) || at > mine[id];
    }).map(([id]) => id);
  }
  const have = new Set(local.images);
  const images = remote.images.filter((id) => !have.has(id) && !dead.has(`images:${id}`));
  return { records, images, settings: remote.settingsAt > local.settingsAt };
}

export async function collectPayload(d: IreadDB, req: SyncRequest): Promise<Payload> {
  const records: Payload['records'] = {};
  for (const t of REC_TABLES) {
    if (!req.records[t]?.length) continue;
    records[t] = (await d.table(t).bulkGet(req.records[t])).filter(Boolean);
  }
  const images: WireImage[] = [];
  for (const img of await d.images.bulkGet(req.images)) {
    if (img) images.push({ id: img.id, type: img.blob.type || 'image/jpeg', bytes: new Uint8Array(await img.blob.arrayBuffer()) });
  }
  let settings: Partial<Settings> | undefined;
  if (req.settings) {
    const s = await d.settings.get('main');
    if (s) settings = Object.fromEntries([...SHARED_SETTINGS, 'sharedUpdatedAt'].filter((k) => k in s).map((k) => [k, (s as any)[k]]));
  }
  return { records, images, settings };
}

/** Delete what the other device deleted, unless we edited it later. */
export async function applyTombstones(d: IreadDB, tombs: Tombstone[]): Promise<number> {
  let removed = 0;
  await d.transaction('rw', [...REC_TABLES.map((t) => d.table(t)), d.images, d.tombstones], async () => {
    for (const tb of tombs) {
      const cur = await d.tombstones.get(tb.key);
      if (!cur || cur.deletedAt < tb.deletedAt) await d.tombstones.put(tb);
      const table = d.table(tb.table);
      const row: any = await table.get(tb.id);
      if (!row) continue;
      const at = tb.table === 'images' ? 0 : version(tb.table as RecTable, row);
      if (at <= tb.deletedAt) { await table.delete(tb.id); removed++; }
    }
  });
  return removed;
}

/** Store what the other device sent, re-checking versions so nothing newer is overwritten. */
export async function applyPayload(d: IreadDB, p: Payload): Promise<number> {
  let changed = 0;
  await d.transaction('rw', [...REC_TABLES.map((t) => d.table(t)), d.images, d.tombstones, d.settings], async () => {
    for (const t of REC_TABLES) {
      for (const row of p.records[t] ?? []) {
        const dead = await d.tombstones.get(`${t}:${row.id}`);
        if (dead && dead.deletedAt >= version(t, row)) continue;
        const cur: any = await d.table(t).get(row.id);
        const newer = t === 'achievements' ? !cur || version(t, row) < version(t, cur) : !cur || version(t, row) > version(t, cur);
        if (newer) { await d.table(t).put(row); changed++; }
      }
    }
    for (const img of p.images) {
      if (await d.tombstones.get(`images:${img.id}`)) continue;
      if (!(await d.images.get(img.id))) { await d.images.put({ id: img.id, blob: new Blob([img.bytes], { type: img.type }) }); changed++; }
    }
    if (p.settings) {
      const cur = await d.settings.get('main');
      if (!cur || (cur.sharedUpdatedAt ?? 0) < (p.settings.sharedUpdatedAt ?? 0)) {
        await d.settings.put({ ...(cur ?? {}), ...p.settings, id: 'main' } as Settings);
        changed++;
      }
    }
  });
  return changed;
}
