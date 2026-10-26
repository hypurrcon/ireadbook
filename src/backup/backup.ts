import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { db, ALL_TABLES } from '../db/db';

export const FORMAT_VERSION = 1;

export class BackupError extends Error {
  constructor(public code: 'invalid' | 'version') { super(code); this.name = 'BackupError'; }
}

const DATA_TABLES = ALL_TABLES.filter((t) => t !== 'images');

function blobBytes(b: Blob): Promise<Uint8Array> {
  if (typeof b.arrayBuffer === 'function') return b.arrayBuffer().then((a) => new Uint8Array(a));
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => rej(r.error);
    r.readAsArrayBuffer(b);
  });
}

export async function exportBackup(): Promise<Blob> {
  const data: Record<string, unknown> = { app: 'ireadbook', formatVersion: FORMAT_VERSION, exportedAt: Date.now() };
  for (const t of DATA_TABLES) data[t] = await db.table(t).toArray();
  const images = await db.images.toArray();
  const files: Record<string, Uint8Array> = { 'data.json': strToU8(JSON.stringify(data)) };
  const types: Record<string, string> = {};
  for (const img of images) {
    files[`images/${img.id}`] = await blobBytes(img.blob);
    types[img.id] = img.blob.type || 'image/jpeg';
  }
  files['images.json'] = strToU8(JSON.stringify(types));
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
}

export function backupFileName(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `ireadbook-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.ireadbook`;
}

interface Parsed { data: Record<string, any[]>; images: { id: string; blob: Blob }[] }

async function parse(file: Blob): Promise<Parsed> {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(await blobBytes(file)); } catch { throw new BackupError('invalid'); }
  if (!files['data.json']) throw new BackupError('invalid');
  let data: any;
  try { data = JSON.parse(strFromU8(files['data.json'])); } catch { throw new BackupError('invalid'); }
  if (!data || data.app !== 'ireadbook' || typeof data.formatVersion !== 'number') throw new BackupError('invalid');
  if (data.formatVersion > FORMAT_VERSION) throw new BackupError('version');
  for (const t of DATA_TABLES) if (data[t] !== undefined && !Array.isArray(data[t])) throw new BackupError('invalid');
  let types: Record<string, string> = {};
  try { if (files['images.json']) types = JSON.parse(strFromU8(files['images.json'])); } catch { /* default type */ }
  const images = Object.keys(files)
    .filter((k) => k.startsWith('images/') && k.length > 7)
    .map((k) => {
      const id = k.slice(7);
      return { id, blob: new Blob([files[k]], { type: types[id] ?? 'image/jpeg' }) };
    });
  return { data, images };
}

export async function importBackup(file: Blob, mode: 'replace' | 'merge'): Promise<{ books: number; sessions: number }> {
  const { data, images } = await parse(file);
  const tables = ALL_TABLES.map((t) => db.table(t));
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      for (const t of ALL_TABLES) await db.table(t).clear();
      for (const t of DATA_TABLES) if (data[t]?.length) await db.table(t).bulkPut(data[t]);
      if (images.length) await db.images.bulkPut(images);
    } else {
      for (const t of DATA_TABLES) {
        for (const row of data[t] ?? []) {
          const existing = await db.table(t).get(row.id);
          const newer = !existing || (row.updatedAt ?? row.unlockedAt ?? 0) > (existing.updatedAt ?? existing.unlockedAt ?? 0);
          if (t === 'settings' && existing) continue; // keep this device's settings on merge
          if (newer) await db.table(t).put(row);
        }
      }
      for (const img of images) if (!(await db.images.get(img.id))) await db.images.put(img);
    }
  });
  return { books: data.books?.length ?? 0, sessions: data.sessions?.length ?? 0 };
}
