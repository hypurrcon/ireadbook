import * as THREE from 'three';
import type { Book } from '../db/types';
import { imageUrl } from '../hooks/data';

const loader = new THREE.TextureLoader();
const coverCache = new Map<string, Promise<THREE.Texture | null>>();
const canvasCache = new Map<string, THREE.Texture>();

export const FONT_DISPLAY = "'Noto Serif Thai', Georgia, serif";
export const FONT_BODY = "'IBM Plex Sans Thai', system-ui, sans-serif";

let fontsReady: Promise<unknown> | null = null;
export function ensureFonts() {
  if (!fontsReady) {
    fontsReady = typeof document !== 'undefined' && document.fonts
      ? Promise.all([
        document.fonts.load(`600 40px ${FONT_DISPLAY}`, 'อักษรAa'),
        document.fonts.load(`500 40px ${FONT_BODY}`, 'อักษรAa'),
      ]).catch(() => undefined)
      : Promise.resolve();
  }
  return fontsReady;
}

function finish(tex: THREE.Texture, anisotropy = 4) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function coverTexture(imageId?: string): Promise<THREE.Texture | null> {
  if (!imageId) return Promise.resolve(null);
  if (!coverCache.has(imageId)) {
    coverCache.set(imageId, imageUrl(imageId).then((u) => (u ? loader.loadAsync(u).then((t) => finish(t)) : null)).catch(() => null));
  }
  return coverCache.get(imageId)!;
}

export { hashColor, bookColor, luminance, inkOn } from '../ui/color';
import { bookColor, luminance, inkOn } from '../ui/color';

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** Fit text into maxWidth by shrinking the font; returns the font size used. */
function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, maxWidth: number, min = 10) {
  let px = start;
  ctx.font = font(px);
  while (px > min && ctx.measureText(text).width > maxWidth) { px -= 1; ctx.font = font(px); }
  return px;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

/** Spine: drawn sideways (title reads top→bottom as on real Thai/English spines). */
export function spineTexture(b: Book, untitled: string): THREE.Texture {
  const key = `spine:${b.id}:${b.updatedAt}`;
  const hit = canvasCache.get(key);
  if (hit) return hit;
  const W = 96, H = 768;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const col = bookColor(b);
  const ink = inkOn(col);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, shade(col, 0.72));
  g.addColorStop(0.18, shade(col, 1.08));
  g.addColorStop(0.55, col);
  g.addColorStop(1, shade(col, 0.68));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // subtle cloth/paper grain
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 2 + Math.random() * 4);
  }
  // head/tail bands
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(10, 34, W - 20, 2);
  ctx.fillRect(10, H - 38, W - 20, 2);
  ctx.globalAlpha = 1;
  // title
  ctx.save();
  ctx.translate(W / 2 + 2, 60);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = ink;
  ctx.textBaseline = 'middle';
  const title = b.title || untitled;
  const maxLen = H - (b.seriesIndex ? 210 : 150);
  const px = fitText(ctx, title, (p) => `600 ${p}px ${FONT_DISPLAY}`, 40, maxLen, 26);
  ctx.font = `600 ${px}px ${FONT_DISPLAY}`;
  ctx.fillText(truncate(ctx, title, maxLen), 0, 0);
  ctx.restore();
  // author (small, near the bottom)
  if (b.authors[0]) {
    ctx.save();
    ctx.translate(W / 2, H - 60);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.8;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `500 22px ${FONT_BODY}`;
    ctx.fillText(truncate(ctx, b.authors[0], 170), 0, 0);
    ctx.restore();
  }
  if (b.seriesIndex) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(W / 2, H - 250, 24, 0, Math.PI * 2);
    ctx.globalAlpha = 0.16;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = `700 28px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(b.seriesIndex), W / 2, H - 248);
  }
  const tex = finish(new THREE.CanvasTexture(c));
  canvasCache.set(key, tex);
  return tex;
}

/** A plain designed cover for books without a photo. */
export function fallbackCover(b: Book, untitled: string): THREE.Texture {
  const key = `cover:${b.id}:${b.updatedAt}`;
  const hit = canvasCache.get(key);
  if (hit) return hit;
  const W = 400, H = 600;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const col = bookColor(b);
  const ink = inkOn(col);
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, W - 44, H - 44);
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.font = `600 44px ${FONT_DISPLAY}`;
  const words = (b.title || untitled).split(/(\s+)/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur + w;
    if (ctx.measureText(t).width > W - 90 && cur.trim()) { lines.push(cur.trim()); cur = w.trimStart(); } else cur = t;
  }
  if (cur.trim()) lines.push(cur.trim());
  const shown = lines.slice(0, 5).map((l) => truncate(ctx, l, W - 90));
  shown.forEach((l, i) => ctx.fillText(l, W / 2, 190 + i * 58));
  if (b.authors[0]) {
    ctx.font = `500 24px ${FONT_BODY}`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(truncate(ctx, b.authors[0], W - 90), W / 2, H - 70);
  }
  const tex = finish(new THREE.CanvasTexture(c));
  canvasCache.set(key, tex);
  return tex;
}

let pagesTex: THREE.Texture | null = null;
export function pagesTexture(): THREE.Texture {
  if (pagesTex) return pagesTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ece3cf';
  ctx.fillRect(0, 0, 64, 256);
  for (let x = 0; x < 64; x += 2) {
    ctx.fillStyle = `rgba(120,100,70,${0.05 + Math.random() * 0.12})`;
    ctx.fillRect(x, 0, 1, 256);
  }
  pagesTex = finish(new THREE.CanvasTexture(c));
  return pagesTex;
}

/** Text label as a texture (uses the browser's text engine so Thai renders correctly). */
export function labelTexture(text: string, opts: { color: string; bg?: string; font?: string; px?: number; padX?: number; glow?: string }): { tex: THREE.Texture; aspect: number } {
  const key = `label:${text}:${JSON.stringify(opts)}`;
  const px = opts.px ?? 44;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const font = `600 ${px}px ${opts.font ?? FONT_DISPLAY}`;
  ctx.font = font;
  const padX = opts.padX ?? 24;
  const w = Math.ceil(ctx.measureText(text).width + padX * 2);
  const h = Math.ceil(px * 1.9);
  const hit = canvasCache.get(key);
  if (hit) return { tex: hit, aspect: w / h };
  c.width = w; c.height = h;
  ctx.font = font;
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    const r = h * 0.22;
    ctx.beginPath();
    ctx.roundRect(1, 1, w - 2, h - 2, r);
    ctx.fill();
  }
  if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = px * 0.5; }
  ctx.fillStyle = opts.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + px * 0.06);
  const tex = finish(new THREE.CanvasTexture(c));
  canvasCache.set(key, tex);
  return { tex, aspect: w / h };
}

/** Procedural canvas texture helper for room surfaces (wood, plaster, tatami…). */
export function proceduralTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]): THREE.Texture {
  const hit = canvasCache.get('proc:' + key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const tex = finish(new THREE.CanvasTexture(c));
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  canvasCache.set('proc:' + key, tex);
  return tex;
}

/** Deterministic random for stable procedural details. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
