const DAY = 86400000;
export const BACKUP_EVERY_DAYS = 14;
export const BACKUP_EVERY_BOOKS = 10;

/** Should we nudge the user to export a backup? */
export function backupDue(s: { lastBackupAt?: number; booksSinceBackup: number; backupSnoozeUntil?: number }, bookCount: number, now: number, firstBookAt?: number): boolean {
  if (bookCount === 0) return false;
  if (s.backupSnoozeUntil && now < s.backupSnoozeUntil) return false;
  if (s.booksSinceBackup >= BACKUP_EVERY_BOOKS) return true;
  const since = s.lastBackupAt ?? firstBookAt;
  if (since === undefined) return false;
  return now - since >= (s.lastBackupAt === undefined ? DAY : BACKUP_EVERY_DAYS * DAY);
}
