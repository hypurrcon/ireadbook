import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { getSettings } from '../db/repo';
import { evaluateAchievements } from '../domain/achievements';
import { todayKey } from '../domain/dates';
import { toast } from '../ui/kit';

/** Watches data and unlocks achievements as soon as they are earned. */
export function useAchievementWatcher() {
  const { t } = useTranslation();
  const stamp = useLiveQuery(async () => {
    const [b, s, q] = await Promise.all([db.books.count(), db.sessions.count(), db.quotes.count()]);
    const last = await db.books.orderBy('updatedAt').last();
    return `${b}:${s}:${q}:${last?.updatedAt ?? 0}`;
  }, []);
  const busy = useRef(false);
  useEffect(() => {
    if (!stamp || busy.current) return;
    busy.current = true;
    (async () => {
      const [sessions, books, quotes, unlocked, settings] = await Promise.all([
        db.sessions.toArray(), db.books.toArray(), db.quotes.count(), db.achievements.toArray(), getSettings(),
      ]);
      const fresh = evaluateAchievements({ sessions, books, quotes, goalMin: settings.dailyGoalMin, today: todayKey() }, new Set(unlocked.map((a) => a.id)));
      if (!fresh.length) return;
      const now = Date.now();
      await db.achievements.bulkPut(fresh.map((id) => ({ id, unlockedAt: now })));
      toast(fresh.length === 1 ? t('ach.unlocked', { name: t(`ach.list.${fresh[0]}.name`) }) : t('ach.many', { count: fresh.length }), 'reward');
    })().finally(() => { busy.current = false; });
  }, [stamp, t]);
}
