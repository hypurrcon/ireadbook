import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db, DEFAULT_SETTINGS } from '../db/db';
import type { Book, Session, Settings, Series } from '../db/types';
import { getSettings } from '../db/repo';

export function useSettings(): Settings {
  return useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS) ?? DEFAULT_SETTINGS;
}
export function useSettingsLoaded(): Settings | undefined {
  return useLiveQuery(() => getSettings(), []);
}
export const useBooks = (): Book[] | undefined => useLiveQuery(() => db.books.toArray(), []);
export const useSessions = (): Session[] | undefined => useLiveQuery(() => db.sessions.orderBy('startedAt').toArray(), []);
export const useSeries = (): Series[] | undefined => useLiveQuery(() => db.series.toArray(), []);
/** undefined while loading, null when the book does not exist */
export const useBook = (id?: string) => useLiveQuery(async () => (id ? (await db.books.get(id)) ?? null : null), [id]);
export const useAchievements = () => useLiveQuery(() => db.achievements.toArray(), []);

const urlCache = new Map<string, string>();

export async function imageUrl(id?: string): Promise<string | undefined> {
  if (!id) return undefined;
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await db.images.get(id);
  if (!rec) return undefined;
  const u = URL.createObjectURL(rec.blob);
  urlCache.set(id, u);
  return u;
}

export function forgetImage(id?: string) {
  if (!id) return;
  const u = urlCache.get(id);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(id);
}

export function useImageUrl(id?: string): string | undefined {
  const [url, setUrl] = useState<string | undefined>(id ? urlCache.get(id) : undefined);
  useEffect(() => {
    let alive = true;
    imageUrl(id).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [id]);
  return url;
}
