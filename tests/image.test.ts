// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { solveHomography, applyHomography } from '../src/image/homography';
import { warpRaw, guessCornersRaw, dominantColorRaw, type Raw } from '../src/image/raw';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

async function load(path: string): Promise<Raw> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

function synthetic(): Raw {
  const w = 400, h = 600, data = new Uint8ClampedArray(w * h * 4);
  const quad = [{ x: 60, y: 90 }, { x: 330, y: 70 }, { x: 350, y: 520 }, { x: 40, y: 540 }];
  const H = solveHomography([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], quad);
  const Hinv = solveHomography(quad, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = applyHomography(Hinv, x, y);
    const inside = p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
    const i = (y * w + x) * 4;
    const n = ((x * 7919 + y * 104729) % 40);
    data[i] = inside ? 200 : 30 + n; data[i + 1] = inside ? 60 : 30 + n; data[i + 2] = inside ? 50 : 35 + n; data[i + 3] = 255;
  }
  void H;
  return { data, width: w, height: h };
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }, tol: number) =>
  Math.hypot(a.x - b.x, a.y - b.y) <= tol;

describe('homography', () => {
  it('maps the four corners exactly', () => {
    const src = [{ x: 10, y: 20 }, { x: 300, y: 5 }, { x: 320, y: 410 }, { x: 0, y: 380 }];
    const dst = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 300 }, { x: 0, y: 300 }];
    const H = solveHomography(src, dst);
    src.forEach((p, i) => {
      const q = applyHomography(H, p.x, p.y);
      expect(q.x).toBeCloseTo(dst[i].x, 6);
      expect(q.y).toBeCloseTo(dst[i].y, 6);
    });
  });
});

describe('raw image ops', () => {
  it('warp of the synthetic red quad is red everywhere', () => {
    const img = synthetic();
    const out = warpRaw(img, [{ x: 60, y: 90 }, { x: 330, y: 70 }, { x: 350, y: 520 }, { x: 40, y: 540 }], 100, 150);
    let red = 0;
    for (let i = 0; i < out.data.length; i += 4) if (out.data[i] > 150 && out.data[i + 1] < 100) red++;
    expect(red / (100 * 150)).toBeGreaterThan(0.97);
  });
  it('guesses corners of the synthetic quad', () => {
    const c = guessCornersRaw(synthetic());
    const truth = [{ x: 60, y: 90 }, { x: 330, y: 70 }, { x: 350, y: 520 }, { x: 40, y: 540 }];
    c.forEach((p, i) => expect(near(p, truth[i], 16)).toBe(true));
  });
  it('dominant colour of the synthetic quad warp is reddish', () => {
    const out = warpRaw(synthetic(), [{ x: 60, y: 90 }, { x: 330, y: 70 }, { x: 350, y: 520 }, { x: 40, y: 540 }], 50, 75);
    const hex = dominantColorRaw(out);
    expect(parseInt(hex.slice(1, 3), 16)).toBeGreaterThan(150);
  });
  it('guesses corners of the real front cover photo', async () => {
    const img = await load('tests/fixtures/ants-front.png');
    const c = guessCornersRaw(img);
    const s = img.width / 1125;
    const truth = [{ x: 97, y: 380 }, { x: 978, y: 383 }, { x: 968, y: 1508 }, { x: 148, y: 1522 }].map((p) => ({ x: p.x * s, y: p.y * s }));
    c.forEach((p, i) => expect(near(p, truth[i], img.width * 0.05), JSON.stringify({ i, p, t: truth[i] })).toBe(true));
  });
  it('guesses corners of the real back cover photo', async () => {
    const img = await load('tests/fixtures/ants-back.png');
    const c = guessCornersRaw(img);
    const s = img.width / 1125;
    const truth = [{ x: 52, y: 318 }, { x: 1000, y: 316 }, { x: 997, y: 1532 }, { x: 58, y: 1532 }].map((p) => ({ x: p.x * s, y: p.y * s }));
    c.forEach((p, i) => expect(near(p, truth[i], img.width * 0.05), JSON.stringify({ i, p, t: truth[i] })).toBe(true));
  });
});
