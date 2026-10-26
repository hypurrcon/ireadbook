import type { Book } from '../db/types';

export function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const palette = ['#7a3b2e', '#2f4b6e', '#3f5e45', '#8a6a2f', '#5b3a5e', '#2c5d63', '#8c4a3c', '#40465c', '#6e5a3a', '#2e3f35', '#9a7b4f', '#4d2f2f'];
  return palette[h % palette.length];
}

export function bookColor(b: Book) { return b.dominantColor ?? hashColor(b.title || b.id); }

export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
}

export function inkOn(hex: string) { return luminance(hex) > 0.58 ? '#1b1714' : '#f6eedf'; }

