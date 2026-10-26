import { describe, it, expect } from 'vitest';
import { backupDue } from '../src/domain/backupDue';
import { DECOR, decorUnlocked } from '../src/domain/decor';

const day = 86400000;
describe('backupDue', () => {
  it('not due with no books', () => { expect(backupDue({ booksSinceBackup: 0 }, 0, 100 * day)).toBe(false); });
  it('due when never backed up and there are books older than a day', () => { expect(backupDue({ booksSinceBackup: 3 }, 3, 100 * day, 90 * day)).toBe(true); });
  it('due after 14 days', () => { expect(backupDue({ lastBackupAt: 0, booksSinceBackup: 1 }, 5, 15 * day)).toBe(true); });
  it('not due 3 days after a backup with few new books', () => { expect(backupDue({ lastBackupAt: 10 * day, booksSinceBackup: 2 }, 5, 13 * day)).toBe(false); });
  it('due after 10 new books', () => { expect(backupDue({ lastBackupAt: 10 * day, booksSinceBackup: 10 }, 20, 11 * day)).toBe(true); });
  it('snoozed for a day after dismiss', () => { expect(backupDue({ lastBackupAt: 0, booksSinceBackup: 12, backupSnoozeUntil: 20 * day }, 20, 19 * day)).toBe(false); });
});

describe('decor', () => {
  it('plant and mug are free; cat needs a 30-day streak', () => {
    expect(decorUnlocked('plant', new Set())).toBe(true);
    expect(decorUnlocked('cat', new Set())).toBe(false);
    expect(decorUnlocked('cat', new Set(['streak_30']))).toBe(true);
    expect(DECOR.map((d) => d.id)).toEqual(expect.arrayContaining(['plant', 'mug', 'cat', 'globe', 'candle', 'clock', 'stack']));
  });
});
