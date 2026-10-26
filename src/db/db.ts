import Dexie, { type Table } from 'dexie';
import type { Book, Series, Session, Quote, Achievement, PromptTemplate, StoredImage, Settings, Tombstone } from './types';

export class IreadDB extends Dexie {
  books!: Table<Book, string>;
  series!: Table<Series, string>;
  sessions!: Table<Session, string>;
  quotes!: Table<Quote, string>;
  achievements!: Table<Achievement, string>;
  prompts!: Table<PromptTemplate, string>;
  images!: Table<StoredImage, string>;
  settings!: Table<Settings, string>;
  tombstones!: Table<Tombstone, string>;

  constructor(name = 'ireadbook') {
    super(name);
    this.version(1).stores({
      books: 'id, status, seriesId, genre, updatedAt, createdAt',
      series: 'id, name',
      sessions: 'id, bookId, startedAt',
      quotes: 'id, bookId, createdAt',
      achievements: 'id',
      prompts: 'id',
      images: 'id',
      settings: 'id',
    });
    this.version(2).stores({ tombstones: 'key, table, deletedAt' });
  }
}

export const db = new IreadDB();

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  onboarded: false,
  room: 'attic',
  rooms: {},
  quality: 'mid',
  volume: { ui: 0.6, book: 0.8, ambience: 0.5, reward: 0.8 },
  ambienceOn: true,
  yearlyGoal: 12,
  dailyGoalMin: 5,
  sortMode: 'status',
  viewMode: '3d',
  pomodoroWork: 25,
  pomodoroBreak: 5,
  booksSinceBackup: 0,
};

export const ALL_TABLES = ['books', 'series', 'sessions', 'quotes', 'achievements', 'prompts', 'images', 'settings', 'tombstones'] as const;

export async function resetDb() {
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
  });
}
