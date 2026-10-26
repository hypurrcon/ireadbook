import type { Session } from '../db/types';
import { dayKey, addDays, monthOf } from './dates';

export const FREEZES_PER_MONTH = 2;

export function minutesByDay(sessions: Session[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(s.startedAt);
    m.set(k, (m.get(k) ?? 0) + s.durationSec / 60);
  }
  return m;
}

export interface StreakResult { current: number; best: number; frozenDays: string[]; todayDone: boolean; }

export function computeStreak(sessions: Session[], goalMin: number, today: string): StreakResult {
  const mins = minutesByDay(sessions);
  const read = (k: string) => (mins.get(k) ?? 0) >= goalMin;
  const keys = [...mins.keys()].filter(read).sort();
  const todayDone = read(today);
  if (keys.length === 0) return { current: 0, best: 0, frozenDays: [], todayDone };

  const used = new Map<string, number>();
  let run = 0;
  let best = 0;
  let frozen: string[] = [];
  for (let d = keys[0]; d <= today; d = addDays(d, 1)) {
    if (read(d)) {
      run++;
    } else if (d === today) {
      // today not finished yet: pending, does not break
    } else {
      const next = addDays(d, 1);
      const nextOk = read(next) || (next === today && !todayDone);
      const m = monthOf(d);
      if (run > 0 && nextOk && (used.get(m) ?? 0) < FREEZES_PER_MONTH) {
        used.set(m, (used.get(m) ?? 0) + 1);
        frozen.push(d);
      } else {
        run = 0;
        frozen = [];
      }
    }
    best = Math.max(best, run);
  }
  return { current: run, best, frozenDays: frozen, todayDone };
}
