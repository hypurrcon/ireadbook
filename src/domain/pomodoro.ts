export interface PomodoroState { phase: 'work' | 'break'; round: number; remainingSec: number; readingSec: number }

/** Where we are in a work/break cycle after `elapsedSec`, and how much of it was reading. */
export function pomodoroState(elapsedSec: number, workMin: number, breakMin: number): PomodoroState {
  const W = workMin * 60, B = breakMin * 60, C = W + B;
  const full = Math.floor(elapsedSec / C);
  const rem = elapsedSec - full * C;
  const inWork = rem < W;
  return {
    phase: inWork ? 'work' : 'break',
    round: full + 1,
    remainingSec: inWork ? W - rem : C - rem,
    readingSec: full * W + Math.min(rem, W),
  };
}
