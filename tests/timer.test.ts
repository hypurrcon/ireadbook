import { describe, it, expect, beforeEach } from 'vitest';
import { useTimer, CORRECTION_AFTER_MS } from '../src/state/timer';

const T0 = 1_700_000_000_000;
beforeEach(() => { localStorage.clear(); useTimer.getState().discard(); });

describe('timer', () => {
  it('elapsed is computed from the clock', () => {
    useTimer.getState().start('b1', 'timer', 12, undefined, T0);
    expect(useTimer.getState().elapsedSec(T0 + 90_000)).toBe(90);
  });
  it('survives a reload via localStorage', async () => {
    useTimer.getState().start('b1', 'timer', 0, undefined, T0);
    const raw = localStorage.getItem('ireadbook-timer');
    expect(raw).toContain('b1');
    useTimer.setState({ active: null });
    localStorage.setItem('ireadbook-timer', raw!);
    await useTimer.persist.rehydrate();
    expect(useTimer.getState().active?.bookId).toBe('b1');
    expect(useTimer.getState().elapsedSec(T0 + 60_000)).toBe(60);
  });
  it('paused time is excluded', () => {
    const t = useTimer.getState();
    t.start('b1', 'timer', 0, undefined, T0);
    useTimer.getState().pause(T0 + 60_000);
    expect(useTimer.getState().elapsedSec(T0 + 600_000)).toBe(60);
    useTimer.getState().resume(T0 + 600_000);
    expect(useTimer.getState().elapsedSec(T0 + 630_000)).toBe(90);
  });
  it('stop returns a draft and clears active', () => {
    useTimer.getState().start('b1', '5min', 7, 5, T0);
    const d = useTimer.getState().stop(T0 + 300_000);
    expect(d).toMatchObject({ bookId: 'b1', mode: '5min', startedAt: T0, endedAt: T0 + 300_000, durationSec: 300, startPage: 7 });
    expect(useTimer.getState().active).toBeNull();
  });
  it('flags correction after 3 hours', () => {
    useTimer.getState().start('b1', 'timer', 0, undefined, T0);
    expect(CORRECTION_AFTER_MS).toBe(3 * 3600_000);
    expect(useTimer.getState().needsCorrection(T0 + 3 * 3600_000 - 1)).toBe(false);
    expect(useTimer.getState().needsCorrection(T0 + 3 * 3600_000 + 1)).toBe(true);
  });
});
