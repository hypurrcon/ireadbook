import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SessionMode } from '../db/types';

export const CORRECTION_AFTER_MS = 3 * 3600_000;

export interface ActiveSession {
  bookId: string;
  mode: SessionMode;
  startedAt: number;
  startPage: number;
  targetMin?: number;
  pausedMs: number;
  pausedAt?: number;
}

export interface Draft {
  bookId: string;
  mode: SessionMode;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  startPage: number;
}

interface TimerState {
  active: ActiveSession | null;
  start: (bookId: string, mode: SessionMode, startPage: number, targetMin?: number, now?: number) => void;
  pause: (now?: number) => void;
  resume: (now?: number) => void;
  elapsedSec: (now?: number) => number;
  stop: (now?: number) => Draft | null;
  discard: () => void;
  needsCorrection: (now?: number) => boolean;
}

export const useTimer = create<TimerState>()(
  persist(
    (set, get) => ({
      active: null,
      start: (bookId, mode, startPage, targetMin, now = Date.now()) =>
        set({ active: { bookId, mode, startPage, targetMin, startedAt: now, pausedMs: 0 } }),
      pause: (now = Date.now()) => {
        const a = get().active;
        if (a && !a.pausedAt) set({ active: { ...a, pausedAt: now } });
      },
      resume: (now = Date.now()) => {
        const a = get().active;
        if (a?.pausedAt) set({ active: { ...a, pausedMs: a.pausedMs + (now - a.pausedAt), pausedAt: undefined } });
      },
      elapsedSec: (now = Date.now()) => {
        const a = get().active;
        if (!a) return 0;
        const end = a.pausedAt ?? now;
        return Math.max(0, Math.floor((end - a.startedAt - a.pausedMs) / 1000));
      },
      stop: (now = Date.now()) => {
        const a = get().active;
        if (!a) return null;
        const durationSec = get().elapsedSec(now);
        set({ active: null });
        return { bookId: a.bookId, mode: a.mode, startedAt: a.startedAt, endedAt: a.pausedAt ?? now, durationSec, startPage: a.startPage };
      },
      discard: () => set({ active: null }),
      needsCorrection: (now = Date.now()) => {
        const a = get().active;
        return !!a && now - a.startedAt > CORRECTION_AFTER_MS;
      },
    }),
    { name: 'ireadbook-timer', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ active: s.active }) },
  ),
);
