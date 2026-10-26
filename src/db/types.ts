export type BookStatus = 'want' | 'reading' | 'paused' | 'finished' | 'dnf';
export type Format = 'paperback' | 'hardcover' | 'ebook' | 'audiobook';
export type SessionMode = 'timer' | '5min' | 'pomodoro' | 'facedown' | 'manual';
export type ProgressUnit = 'page' | 'percent';
export type Pt = { x: number; y: number };

export const GENRES = ['fiction', 'fantasy', 'scifi', 'mystery', 'romance', 'horror', 'history', 'biography', 'selfhelp', 'business', 'psychology', 'philosophy', 'science', 'comics', 'poetry', 'children', 'other'] as const;
export type Genre = typeof GENRES[number];

export interface Book {
  id: string;
  title: string;
  originalTitle?: string;
  subtitle?: string;
  authors: string[];
  translators: string[];
  publisher?: string;
  isbn?: string;
  year?: number;
  language?: string;
  pageCount?: number;
  format: Format;
  genre?: Genre;
  tags: string[];
  seriesId?: string;
  seriesIndex?: number;
  coverFrontId?: string;
  coverBackId?: string;
  spineId?: string;
  cropPoints?: Pt[];
  dominantColor?: string;
  coverAspect?: number;
  status: BookStatus;
  progressUnit: ProgressUnit;
  currentPage: number;
  rating?: number;
  review?: string;
  whyRead?: string;
  recommendedBy?: string;
  acquiredAt?: number;
  startedAt?: number;
  finishedAt?: number;
  rereadCount: number;
  needsLookup: boolean;
  needsReview: boolean;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Series { id: string; name: string; totalVolumes?: number; updatedAt: number; }

export interface Session {
  id: string;
  bookId: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  startPage: number;
  endPage: number;
  mode: SessionMode;
  note?: string;
  mood?: string;
  updatedAt: number;
}

export interface Quote { id: string; bookId: string; page?: number; text: string; photoId?: string; createdAt: number; updatedAt: number; }
export interface Achievement { id: string; unlockedAt: number; }
export interface PromptTemplate { id: string; name: string; body: string; builtIn: boolean; updatedAt: number; }
export interface StoredImage { id: string; blob: Blob; }
export type SyncTable = 'books' | 'series' | 'sessions' | 'quotes' | 'achievements' | 'prompts' | 'images';
export interface Tombstone { key: string; table: SyncTable; id: string; deletedAt: number }

export type Quality = 'low' | 'mid' | 'high';
export interface RoomCustomization { shelfColor?: string; shelfMaterial: 'wood' | 'metal' | 'painted'; shelfRows: number; night: boolean; decor: string[]; }

export interface Settings {
  id: 'main';
  onboarded: boolean;
  room: string;
  rooms: Record<string, RoomCustomization>;
  quality: Quality;
  volume: { ui: number; book: number; ambience: number; reward: number };
  ambienceOn: boolean;
  muted?: boolean;
  yearlyGoal: number;
  dailyGoalMin: number;
  reminderTime?: string;
  sortMode: 'genre' | 'series' | 'author' | 'status' | 'added' | 'color';
  viewMode: '3d' | '2d';
  pomodoroWork: number;
  pomodoroBreak: number;
  lastBackupAt?: number;
  booksSinceBackup: number;
  backupSnoozeUntil?: number;
  /** last change to settings that are shared between paired devices */
  sharedUpdatedAt?: number;
  minutesPerDayHint?: number;
}
