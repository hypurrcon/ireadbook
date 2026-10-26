export interface DecorDef { id: string; needs?: string }

/** Room decorations; some are earned through achievements. */
export const DECOR: DecorDef[] = [
  { id: 'plant' },
  { id: 'mug' },
  { id: 'stack', needs: 'first_book' },
  { id: 'candle', needs: 'streak_7' },
  { id: 'clock', needs: 'hour_10' },
  { id: 'globe', needs: 'genres_5' },
  { id: 'cat', needs: 'streak_30' },
];

export function decorUnlocked(id: string, unlocked: Set<string>): boolean {
  const d = DECOR.find((x) => x.id === id);
  return !!d && (!d.needs || unlocked.has(d.needs));
}
