import { describe, it, expect } from 'vitest';
import { pomodoroState } from '../src/domain/pomodoro';

describe('pomodoroState', () => {
  const W = 25 * 60, B = 5 * 60;
  it('first work phase', () => {
    expect(pomodoroState(60, 25, 5)).toEqual({ phase: 'work', round: 1, remainingSec: W - 60, readingSec: 60 });
  });
  it('break phase does not count as reading', () => {
    expect(pomodoroState(W + 120, 25, 5)).toEqual({ phase: 'break', round: 1, remainingSec: B - 120, readingSec: W });
  });
  it('second round', () => {
    const s = pomodoroState(W + B + 30, 25, 5);
    expect(s.phase).toBe('work');
    expect(s.round).toBe(2);
    expect(s.readingSec).toBe(W + 30);
  });
});
