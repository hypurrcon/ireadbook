import type { Book } from '../db/types';
import { imageUrl } from '../hooks/data';
import { bookColor, inkOn } from '../ui/color';
import { wrapText } from './wrap';

export const CARD_W = 1080;
export const CARD_H = 1920;

const SERIF = "'Noto Serif Thai', Georgia, serif";
const SANS = "'IBM Plex Sans Thai', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

export interface Palette { bg: string; surface: string; ink: string; soft: string; accent: string; accentInk: string; line: string }

export function currentPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (k: string, d: string) => cs.getPropertyValue(k).trim() || d;
  return {
    bg: v('--bg', '#1d1714'), surface: v('--surface-2', '#362c25'), ink: v('--ink', '#f2e6d0'), soft: v('--ink-soft', '#b9a88f'),
    accent: v('--accent', '#e8a24a'), accentInk: v('--accent-ink', '#1d1714'), line: v('--line', 'rgba(255,255,255,.14)'),
  };
}

async function fonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load(`700 80px ${SERIF}`, 'อักษรAa'), document.fonts.load(`600 80px ${SERIF}`, 'อักษรAa'),
    document.fonts.load(`500 40px ${SANS}`, 'อักษรAa'), document.fonts.load(`400 40px ${MONO}`, 'Aa0'),
  ]).catch(() => undefined);
}

async function loadImg(id?: string): Promise<HTMLImageElement | null> {
  const url = await imageUrl(id);
  if (!url) return null;
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
}

function setup(p: Palette) {
  const c = document.createElement('canvas');
  c.width = CARD_W; c.height = CARD_H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // paper grain
  const g = ctx.createImageData(CARD_W, CARD_H);
  for (let i = 0; i < g.data.length; i += 4) { const n = Math.random() * 18; g.data[i] = g.data[i + 1] = g.data[i + 2] = n; g.data[i + 3] = 10; }
  const tmp = document.createElement('canvas'); tmp.width = CARD_W; tmp.height = CARD_H; tmp.getContext('2d')!.putImageData(g, 0, 0);
  ctx.drawImage(tmp, 0, 0);
  ctx.textBaseline = 'alphabetic';
  return { c, ctx };
}

function wordmark(ctx: CanvasRenderingContext2D, p: Palette) {
  ctx.fillStyle = p.soft;
  ctx.font = `400 30px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('IREADBOOK', 90, CARD_H - 110);
  ctx.fillStyle = p.accent;
  ctx.fillRect(90, CARD_H - 92, 60, 4);
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, maxW: number, lh: number, maxLines = 3, align: CanvasTextAlign = 'left') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align;
  const lines = wrapText(s, maxW, (t) => ctx.measureText(t).width, maxLines);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + lines.length * lh;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, book: Book, x: number, y: number, w: number, untitled: string, tilt = 0) {
  const h = img ? Math.round(w * (img.height / img.width)) : Math.round(w * 1.48);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(tilt);
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
  else {
    const col = bookColor(book);
    ctx.fillStyle = col; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowColor = 'transparent';
    text(ctx, book.title || untitled, 0, -h / 2 + h * 0.3, `700 ${Math.round(w / 9)}px ${SERIF}`, inkOn(col), w * 0.78, Math.round(w / 7.5), 5, 'center');
  }
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(-w / 2 + 6, -h / 2, 3, h); // spine crease
  ctx.restore();
  return h;
}

function stat(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, value: string, label: string) {
  ctx.textAlign = 'left';
  ctx.fillStyle = p.ink; ctx.font = `700 96px ${SERIF}`; ctx.fillText(value, x, y);
  ctx.fillStyle = p.soft; ctx.font = `500 34px ${SANS}`; ctx.fillText(label, x, y + 52);
}

function toBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

export interface SessionCard { book: Book; minutes: number; fromPage: number; toPage: number; percent: boolean; streak: number; date: Date }
export interface FinishedCard { book: Book; days: number; minutes: number }
export interface QuoteCard { text: string; page?: number; book: Book }
export interface WrappedCard { heading: string; minutes: number; booksFinished: number; daysRead: number; pages: number; topGenre?: string; covers: Book[] }

export interface CardText {
  untitled: string; dateLocale: string;
  minutes: string; pages: string; streakDays: string; readToday: string;
  finished: string; daysToFinish: string; hours: string;
  page: (n: number) => string; booksFinished: string; daysRead: string; topGenre: string;
  minutesValue: (m: number) => string;
}

export async function renderSessionCard(d: SessionCard, tx: CardText, p = currentPalette()): Promise<Blob> {
  await fonts();
  const { c, ctx } = setup(p);
  const img = await loadImg(d.book.coverFrontId);
  ctx.fillStyle = p.soft; ctx.font = `400 32px ${MONO}`; ctx.textAlign = 'left';
  ctx.fillText(d.date.toLocaleDateString(tx.dateLocale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(), 90, 170);
  ctx.fillStyle = p.accent; ctx.font = `600 44px ${SANS}`; ctx.fillText(tx.readToday, 90, 330);
  ctx.fillStyle = p.ink; ctx.font = `700 340px ${SERIF}`; ctx.fillText(String(Math.max(1, Math.round(d.minutes))), 76, 640);
  ctx.fillStyle = p.soft; ctx.font = `500 52px ${SANS}`; ctx.fillText(tx.minutes, 90, 730);
  drawCover(ctx, img, d.book, 600, 300, 390, tx.untitled, 0.05);
  const y = text(ctx, d.book.title || tx.untitled, 90, 1060, `700 76px ${SERIF}`, p.ink, 900, 96, 3);
  if (d.book.authors.length) text(ctx, d.book.authors.join(', '), 90, y + 10, `500 40px ${SANS}`, p.soft, 900, 52, 1);
  ctx.fillStyle = p.line; ctx.fillRect(90, 1440, 900, 2);
  const pages = d.percent ? `${d.fromPage}→${d.toPage}%` : `${Math.max(0, d.toPage - d.fromPage)}`;
  stat(ctx, p, 90, 1580, pages, d.percent ? tx.pages : tx.pages);
  if (d.streak > 0) stat(ctx, p, 560, 1580, String(d.streak), tx.streakDays);
  wordmark(ctx, p);
  return toBlob(c);
}

export async function renderFinishedCard(d: FinishedCard, tx: CardText, p = currentPalette()): Promise<Blob> {
  await fonts();
  const { c, ctx } = setup(p);
  const img = await loadImg(d.book.coverFrontId);
  ctx.fillStyle = p.accent; ctx.font = `600 48px ${SANS}`; ctx.textAlign = 'center';
  ctx.fillText(tx.finished, CARD_W / 2, 210);
  const h = drawCover(ctx, img, d.book, (CARD_W - 560) / 2, 280, 560, tx.untitled);
  let y = text(ctx, d.book.title || tx.untitled, CARD_W / 2, 280 + h + 150, `700 80px ${SERIF}`, p.ink, 900, 100, 2, 'center');
  if (d.book.authors.length) y = text(ctx, d.book.authors.join(', '), CARD_W / 2, y + 6, `500 42px ${SANS}`, p.soft, 900, 54, 1, 'center');
  if (d.book.rating) {
    ctx.fillStyle = p.accent; ctx.font = `400 60px ${SANS}`; ctx.textAlign = 'center';
    ctx.fillText('★'.repeat(d.book.rating) + '☆'.repeat(5 - d.book.rating), CARD_W / 2, y + 70);
  }
  const sy = Math.min(CARD_H - 300, Math.max(y + 190, 1580));
  stat(ctx, p, 160, sy, String(Math.max(1, d.days)), tx.daysToFinish);
  stat(ctx, p, 600, sy, (d.minutes / 60).toFixed(d.minutes < 600 ? 1 : 0), tx.hours);
  wordmark(ctx, p);
  return toBlob(c);
}

export async function renderQuoteCard(d: QuoteCard, tx: CardText, p = currentPalette()): Promise<Blob> {
  await fonts();
  const { c, ctx } = setup(p);
  const len = d.text.length;
  const size = len < 80 ? 76 : len < 180 ? 62 : len < 320 ? 50 : 42;
  const lh = Math.round(size * 1.55);
  ctx.font = `600 ${size}px ${SERIF}`;
  const n = wrapText(d.text, 900, (x) => ctx.measureText(x).width, 16).length;
  const top = Math.max(430, Math.round((CARD_H - (n * lh + 330)) / 2) + 90);
  ctx.fillStyle = p.accent; ctx.font = `700 300px ${SERIF}`; ctx.textAlign = 'left';
  ctx.fillText('“', 70, top - 90);
  const y = text(ctx, d.text, 90, top, `600 ${size}px ${SERIF}`, p.ink, 900, lh, 16);
  ctx.fillStyle = p.accent; ctx.fillRect(90, y + 40, 60, 4);
  let y2 = text(ctx, d.book.title || tx.untitled, 90, y + 130, `600 44px ${SANS}`, p.ink, 900, 58, 2);
  const by = [d.book.authors.join(', '), d.page ? tx.page(d.page) : ''].filter(Boolean).join(' · ');
  if (by) y2 = text(ctx, by, 90, y2 + 4, `500 36px ${SANS}`, p.soft, 900, 48, 1);
  wordmark(ctx, p);
  return toBlob(c);
}

export async function renderWrappedCard(d: WrappedCard, tx: CardText, p = currentPalette()): Promise<Blob> {
  await fonts();
  const { c, ctx } = setup(p);
  ctx.fillStyle = p.soft; ctx.font = `400 34px ${MONO}`; ctx.textAlign = 'left';
  ctx.fillText(d.heading.toUpperCase(), 90, 170);
  ctx.fillStyle = p.ink; ctx.font = `700 300px ${SERIF}`;
  const hours = d.minutes / 60;
  ctx.fillText(hours >= 10 ? String(Math.round(hours)) : hours.toFixed(1), 76, 470);
  ctx.fillStyle = p.soft; ctx.font = `500 50px ${SANS}`; ctx.fillText(tx.hours, 90, 560);
  // covers
  const covers = d.covers.slice(0, 6);
  const imgs = await Promise.all(covers.map((b) => loadImg(b.coverFrontId)));
  const cw = 250;
  covers.forEach((b, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    drawCover(ctx, imgs[i], b, 90 + col * (cw + 75), 680 + row * 420, cw, tx.untitled, (i % 2 ? 1 : -1) * 0.025);
  });
  const sy = covers.length > 3 ? 1560 : covers.length ? 1180 : 760;
  ctx.fillStyle = p.line; ctx.fillRect(90, sy - 130, 900, 2);
  stat(ctx, p, 90, sy, String(d.booksFinished), tx.booksFinished);
  stat(ctx, p, 430, sy, String(d.daysRead), tx.daysRead);
  stat(ctx, p, 760, sy, String(d.pages), tx.pages);
  if (d.topGenre) {
    ctx.fillStyle = p.soft; ctx.font = `500 36px ${SANS}`; ctx.textAlign = 'left';
    ctx.fillText(`${tx.topGenre}: `, 90, sy + 160);
    const w = ctx.measureText(`${tx.topGenre}: `).width;
    ctx.fillStyle = p.accent; ctx.font = `600 36px ${SANS}`; ctx.fillText(d.topGenre, 90 + w, sy + 160);
  }
  wordmark(ctx, p);
  return toBlob(c);
}

/** Numbered grid of covers, for pasting into an AI chat together with the prompt. */
export async function renderCollage(books: Book[], untitled: string, p = currentPalette()): Promise<Blob> {
  await fonts();
  const cols = books.length <= 4 ? 2 : books.length <= 9 ? 3 : books.length <= 16 ? 4 : 5;
  const cw = 300, ch = 450, gap = 48, pad = 60, label = 64;
  const rows = Math.ceil(books.length / cols);
  const c = document.createElement('canvas');
  c.width = pad * 2 + cols * cw + (cols - 1) * gap;
  c.height = pad * 2 + rows * (ch + label) + (rows - 1) * gap;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
  const imgs = await Promise.all(books.map((b) => loadImg(b.coverFrontId)));
  books.forEach((b, i) => {
    const x = pad + (i % cols) * (cw + gap), y = pad + Math.floor(i / cols) * (ch + label + gap);
    const img = imgs[i];
    if (img) {
      const s = Math.min(cw / img.width, ch / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.drawImage(img, x + (cw - w) / 2, y + (ch - h), w, h);
    } else {
      const col = bookColor(b);
      ctx.fillStyle = col; ctx.fillRect(x, y, cw, ch);
      ctx.save(); ctx.translate(x + cw / 2, y);
      text(ctx, b.title || untitled, 0, ch * 0.3, `700 34px ${SERIF}`, inkOn(col), cw * 0.8, 44, 6, 'center');
      ctx.restore();
    }
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + 30, y + ch + 36, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 30px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x + 30, y + ch + 46);
    ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.font = `500 26px ${SANS}`;
    const t = wrapText(b.title || untitled, cw - 70, (s) => ctx.measureText(s).width, 1)[0];
    ctx.fillText(t, x + 66, y + ch + 45);
  });
  return toBlob(c);
}
