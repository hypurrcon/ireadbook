import type { Book } from '../db/types';

export function pickRandom(books: Book[], rng: () => number = Math.random): Book | null {
  const pool = books.filter((b) => b.status === 'want' || b.status === 'paused' || b.status === 'reading');
  if (!pool.length) return null;
  const weights = pool.map((b) => (b.status === 'paused' ? 2 : 1));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r < 0) return pool[i]; }
  return pool[pool.length - 1];
}
