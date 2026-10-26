import type { Pt } from '../db/types';
import { solveHomography, applyHomography } from './homography';

export interface Raw { data: Uint8ClampedArray; width: number; height: number; }

export function makeRaw(width: number, height: number): Raw {
  return { data: new Uint8ClampedArray(width * height * 4), width, height };
}

/** Perspective-warp the quad (TL, TR, BR, BL) in src into a w×h rectangle (bilinear). */
export function warpRaw(src: Raw, corners: Pt[], w: number, h: number): Raw {
  const out = makeRaw(w, h);
  const H = solveHomography([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], corners);
  const { data: s, width: sw, height: sh } = src;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = applyHomography(H, x + 0.5, y + 0.5);
      const fx = Math.min(Math.max(p.x - 0.5, 0), sw - 1.001), fy = Math.min(Math.max(p.y - 0.5, 0), sh - 1.001);
      const x0 = Math.floor(fx), y0 = Math.floor(fy), dx = fx - x0, dy = fy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        out.data[o + c] = (s[i00 + c] * (1 - dx) + s[i10 + c] * dx) * (1 - dy) + (s[i01 + c] * (1 - dx) + s[i11 + c] * dx) * dy;
      }
      out.data[o + 3] = 255;
    }
  }
  return out;
}

/** Box-downscale so the longest side is at most `max`. */
export function downscaleRaw(src: Raw, max: number): { img: Raw; scale: number } {
  const scale = Math.min(1, max / Math.max(src.width, src.height));
  if (scale === 1) return { img: src, scale };
  const w = Math.max(1, Math.round(src.width * scale)), h = Math.max(1, Math.round(src.height * scale));
  const out = makeRaw(w, h);
  const fx = src.width / w, fy = src.height / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx0 = Math.floor(x * fx), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * fx));
    const sy0 = Math.floor(y * fy), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * fy));
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = sy0; yy < sy1; yy += 2) for (let xx = sx0; xx < sx1; xx += 2) {
      const i = (yy * src.width + xx) * 4; r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; n++;
    }
    const o = (y * w + x) * 4;
    out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
  }
  return { img: out, scale };
}

type Line = { a: number; b: number }; // y = a x + b  (horizontal)  or  x = a y + b (vertical)

function fitLine(pts: { u: number; v: number; w: number }[]): Line {
  // weighted least squares v = a u + b, with one pass of outlier rejection
  const fit = (ps: typeof pts) => {
    let sw = 0, su = 0, sv = 0, suu = 0, suv = 0;
    for (const p of ps) { sw += p.w; su += p.w * p.u; sv += p.w * p.v; suu += p.w * p.u * p.u; suv += p.w * p.u * p.v; }
    const den = sw * suu - su * su;
    const a = Math.abs(den) < 1e-9 ? 0 : (sw * suv - su * sv) / den;
    return { a, b: (sv - a * su) / (sw || 1) };
  };
  let l = fit(pts);
  const res = pts.map((p) => Math.abs(p.v - (l.a * p.u + l.b)));
  const sorted = [...res].sort((x, y) => x - y);
  const cut = Math.max(2, sorted[Math.floor(sorted.length * 0.6)] * 2);
  const kept = pts.filter((_, i) => res[i] <= cut);
  if (kept.length >= 3) l = fit(kept);
  return l;
}

/**
 * Guess the 4 corners (TL, TR, BR, BL) of a book held in front of the camera.
 * Edge projection finds each side roughly, then local edge samples are line-fitted.
 */
export function guessCornersRaw(src: Raw): Pt[] {
  const { img, scale } = downscaleRaw(src, 320);
  const { width: w, height: h, data } = img;
  // colour-aware gradient
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11;
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  const ch = (i: number, c: number) => data[i * 4 + c];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    let bx = 0, by = 0;
    for (let c = 0; c < 3; c++) {
      const vx = (ch(i - w + 1, c) + 2 * ch(i + 1, c) + ch(i + w + 1, c)) - (ch(i - w - 1, c) + 2 * ch(i - 1, c) + ch(i + w - 1, c));
      const vy = (ch(i + w - 1, c) + 2 * ch(i + w, c) + ch(i + w + 1, c)) - (ch(i - w - 1, c) + 2 * ch(i - w, c) + ch(i - w + 1, c));
      if (Math.abs(vx) > Math.abs(bx)) bx = vx;
      if (Math.abs(vy) > Math.abs(by)) by = vy;
    }
    gx[i] = Math.abs(bx); gy[i] = Math.abs(by);
  }
  void lum;

  // edge "straightness" score: a real side is a long continuous edge. Project with a short run requirement.
  const rowScore = (y: number, x0: number, x1: number) => {
    let s = 0;
    for (let x = x0; x < x1; x++) s += Math.min(gy[y * w + x], 400);
    return s / (x1 - x0);
  };
  const colScore = (x: number, y0: number, y1: number) => {
    let s = 0;
    for (let y = y0; y < y1; y++) s += Math.min(gx[y * w + x], 400);
    return s / (y1 - y0);
  };

  const pickRow = (lo: number, hi: number, x0: number, x1: number, inward: 1 | -1) => {
    let best = lo, bs = -1;
    for (let y = lo; y < hi; y++) {
      // prefer edges nearer to the centre slightly (the book is centred)
      const centreBias = 1 + 0.35 * (inward === 1 ? (y - lo) / (hi - lo) : (hi - y) / (hi - lo));
      const sc = rowScore(y, x0, x1) * centreBias;
      if (sc > bs) { bs = sc; best = y; }
    }
    return best;
  };
  const pickCol = (lo: number, hi: number, y0: number, y1: number, inward: 1 | -1) => {
    let best = lo, bs = -1;
    for (let x = lo; x < hi; x++) {
      const centreBias = 1 + 0.35 * (inward === 1 ? (x - lo) / (hi - lo) : (hi - x) / (hi - lo));
      const sc = colScore(x, y0, y1) * centreBias;
      if (sc > bs) { bs = sc; best = x; }
    }
    return best;
  };

  const m = 2;
  let top = pickRow(m, Math.floor(h * 0.45), Math.floor(w * 0.25), Math.floor(w * 0.75), 1);
  let bottom = pickRow(Math.floor(h * 0.55), h - m, Math.floor(w * 0.25), Math.floor(w * 0.75), -1);
  let left = pickCol(m, Math.floor(w * 0.45), Math.floor(top + (bottom - top) * 0.2), Math.floor(top + (bottom - top) * 0.8), 1);
  let right = pickCol(Math.floor(w * 0.55), w - m, Math.floor(top + (bottom - top) * 0.2), Math.floor(top + (bottom - top) * 0.8), -1);
  // second pass with the horizontal range restricted to the found sides
  const span = (a: number, b: number, f: number) => [Math.floor(a + (b - a) * f), Math.floor(b - (b - a) * f)] as const;
  {
    const [x0, x1] = span(left, right, 0.15);
    top = pickRow(m, Math.floor(h * 0.45), x0, x1, 1);
    bottom = pickRow(Math.floor(h * 0.55), h - m, x0, x1, -1);
    const [y0, y1] = span(top, bottom, 0.15);
    left = pickCol(m, Math.floor(w * 0.45), y0, y1, 1);
    right = pickCol(Math.floor(w * 0.55), w - m, y0, y1, -1);
  }

  const win = Math.max(3, Math.round(Math.min(w, h) * 0.04));
  const samples = 12;
  const hPts = (row: number, x0: number, x1: number) => {
    const pts: { u: number; v: number; w: number }[] = [];
    for (let k = 0; k < samples; k++) {
      const x = Math.round(x0 + ((x1 - x0) * (k + 0.5)) / samples);
      let by = row, bv = -1;
      for (let y = Math.max(1, row - win); y <= Math.min(h - 2, row + win); y++) {
        const v = gy[y * w + x] + gy[y * w + x - 1] + gy[y * w + x + 1];
        if (v > bv) { bv = v; by = y; }
      }
      pts.push({ u: x, v: by, w: Math.max(1, bv) });
    }
    return pts;
  };
  const vPts = (col: number, y0: number, y1: number) => {
    const pts: { u: number; v: number; w: number }[] = [];
    for (let k = 0; k < samples; k++) {
      const y = Math.round(y0 + ((y1 - y0) * (k + 0.5)) / samples);
      let bx = col, bv = -1;
      for (let x = Math.max(1, col - win); x <= Math.min(w - 2, col + win); x++) {
        const v = gx[y * w + x] + gx[(y - 1) * w + x] + gx[(y + 1) * w + x];
        if (v > bv) { bv = v; bx = x; }
      }
      pts.push({ u: y, v: bx, w: Math.max(1, bv) });
    }
    return pts;
  };
  const [hx0, hx1] = span(left, right, 0.08);
  const [vy0, vy1] = span(top, bottom, 0.08);
  const T = fitLine(hPts(top, hx0, hx1));
  const B = fitLine(hPts(bottom, hx0, hx1));
  const L = fitLine(vPts(left, vy0, vy1));
  const R = fitLine(vPts(right, vy0, vy1));
  // intersect y = a1 x + b1 with x = a2 y + b2
  const meet = (hl: Line, vl: Line): Pt => {
    const y = (hl.a * vl.b + hl.b) / (1 - hl.a * vl.a);
    return { x: vl.a * y + vl.b, y };
  };
  const clamp = (p: Pt): Pt => ({ x: Math.min(Math.max(p.x, 0), w - 1) / scale, y: Math.min(Math.max(p.y, 0), h - 1) / scale });
  const corners = [meet(T, L), meet(T, R), meet(B, R), meet(B, L)].map(clamp);
  const area = Math.abs((corners[1].x - corners[0].x) * (corners[3].y - corners[0].y));
  if (!corners.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) || area < src.width * src.height * 0.08) {
    return defaultCorners(src.width, src.height);
  }
  return corners;
}

export function defaultCorners(w: number, h: number, inset = 0.06): Pt[] {
  return [{ x: w * inset, y: h * inset }, { x: w * (1 - inset), y: h * inset }, { x: w * (1 - inset), y: h * (1 - inset) }, { x: w * inset, y: h * (1 - inset) }];
}

/** Most common colour bucket, favouring saturated colours a little. */
export function dominantColorRaw(src: Raw): string {
  const { img } = downscaleRaw(src, 64);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const wgt = 1 + (max - min) / 255;
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n += wgt; e.r += r * wgt; e.g += g * wgt; e.b += b * wgt;
    buckets.set(key, e);
  }
  let best = { n: 0, r: 0, g: 0, b: 0 };
  for (const e of buckets.values()) if (e.n > best.n) best = e;
  const hex = (v: number) => Math.round(v / (best.n || 1)).toString(16).padStart(2, '0');
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}

/** Gentle contrast stretch (in place). */
export function autoLevelRaw(img: Raw, strength = 0.7) {
  const hist = new Uint32Array(256);
  const n = img.width * img.height;
  for (let i = 0; i < img.data.length; i += 4) hist[Math.round(img.data[i] * 0.3 + img.data[i + 1] * 0.59 + img.data[i + 2] * 0.11)]++;
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255; lo++) { acc += hist[lo]; if (acc > n * 0.005) break; }
  acc = 0;
  for (; hi > 0; hi--) { acc += hist[hi]; if (acc > n * 0.005) break; }
  if (hi - lo < 20) return;
  const k = 255 / (hi - lo);
  for (let i = 0; i < img.data.length; i += 4) for (let c = 0; c < 3; c++) {
    const v = img.data[i + c];
    img.data[i + c] = v + ((v - lo) * k - v) * strength;
  }
}

/** Black-on-white mask of likely text pixels: light text (white titles) or dark text. */
export function textMaskRaw(src: Raw, mode: 'light' | 'dark'): Raw {
  const out = makeRaw(src.width, src.height);
  for (let i = 0; i < src.data.length; i += 4) {
    const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = r * 0.3 + g * 0.59 + b * 0.11;
    const sat = max ? (max - min) / max : 0;
    const hit = mode === 'light' ? l > 175 && sat < 0.3 : l < 60;
    const v = hit ? 0 : 255;
    out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
    out.data[i + 3] = 255;
  }
  return out;
}
