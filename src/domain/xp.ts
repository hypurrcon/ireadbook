import type { Session } from '../db/types';

export const XP_FINISH_BOOK = 50;
export const XP_ACHIEVEMENT = 25;
export const XP_SESSION_CAP = 180;

export const xpForSession = (minutes: number) => Math.min(Math.round(minutes), XP_SESSION_CAP);

export function totalXp(sessions: Session[], finishedBooks: number, achievements: number): number {
  return sessions.reduce((a, s) => a + xpForSession(s.durationSec / 60), 0)
    + finishedBooks * XP_FINISH_BOOK + achievements * XP_ACHIEVEMENT;
}

const step = (level: number) => Math.round(100 * Math.pow(level, 1.5));

export function levelFromXp(xp: number): { level: number; into: number; next: number } {
  let level = 1, base = 0;
  while (xp >= base + step(level)) { base += step(level); level++; }
  return { level, into: xp - base, next: step(level) };
}
