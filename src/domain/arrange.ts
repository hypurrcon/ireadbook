/** How books sit on one shelf so it looks lived-in rather than a row of soldiers. */
export interface RowItem { id: string; t: number; h: number; d: number }
export interface Placed {
  id: string;
  kind: 'stand' | 'lean' | 'stack';
  /** centre x measured from the left inner edge of the shelf */
  x: number;
  /** centre height above the shelf board */
  y: number;
  /** rotation about the front-back axis (+ tilts the top to the left) */
  rotZ: number;
  /** small push back from the front edge */
  inset: number;
  /** drawn thickness when a crowded shelf squeezes books */
  t?: number;
}

const GAP = 0.0022;
const LEAN = 0.2; // radians

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

export function arrangeRow(items: RowItem[], inner: number, seed: string): { placed: Placed[]; bookendX?: number } {
  const r = rng(seed);
  const total = items.reduce((a, b) => a + b.t + GAP, 0);
  const spare = inner - total;

  // crowded: plain squeezed row
  if (spare < 0.04) {
    const k = total > inner ? inner / total : 1;
    let x = 0;
    return {
      placed: items.map((b) => {
        const t = b.t * k;
        const p: Placed = { id: b.id, kind: 'stand', x: x + t / 2, y: b.h / 2, rotZ: 0, inset: 0, t };
        x += t + GAP * k;
        return p;
      }),
    };
  }

  // maybe lay two or three books flat in a small stack somewhere along the row
  let stack: RowItem[] = [];
  let stackAt = -1;
  if (items.length >= 5 && r() < 0.32) {
    const n = items.length >= 8 && r() < 0.5 ? 3 : 2;
    const at = Math.floor(r() * (items.length - n + 1));
    const cand = items.slice(at, at + n);
    const width = Math.max(...cand.map((b) => b.h)) + GAP * 2;
    const left = total - cand.reduce((a, b) => a + b.t + GAP, 0) + width;
    if (left < inner - 0.05) { stack = cand; stackAt = at; }
  }

  const placed: Placed[] = [];
  let x = 0.004;
  const standing = items.filter((b) => !stack.includes(b));
  const order: (RowItem | 'stack')[] = [];
  items.forEach((b, i) => {
    if (i === stackAt) order.push('stack');
    if (!stack.includes(b)) order.push(b);
  });

  const lastStanding = standing[standing.length - 1];
  for (const it of order) {
    if (it === 'stack') {
      const w = Math.max(...stack.map((b) => b.h));
      let y = 0;
      stack.forEach((b, i) => {
        placed.push({ id: b.id, kind: 'stack', x: x + w / 2 + (r() - 0.5) * 0.01, y: y + b.t / 2, rotZ: (i % 2 ? -1 : 1) * Math.PI / 2, inset: 0.004 + r() * 0.01 });
        y += b.t;
      });
      x += w + GAP * 2;
      continue;
    }
    const b = it;
    if (b === lastStanding && standing.length > 1) {
      // lean the last book on its neighbour: it rests on its bottom-left corner, top tipped to the left
      const a = LEAN;
      const xl = x + b.h * Math.sin(a);
      const right = xl + b.t * Math.cos(a);
      if (right <= inner) {
        placed.push({
          id: b.id, kind: 'lean', rotZ: a, inset: 0.002,
          x: xl + (b.t / 2) * Math.cos(a) - (b.h / 2) * Math.sin(a),
          y: (b.t / 2) * Math.sin(a) + (b.h / 2) * Math.cos(a),
        });
        x = right;
        continue;
      }
    }
    const tilt = (r() - 0.5) * 0.02;
    placed.push({ id: b.id, kind: 'stand', x: x + b.t / 2, y: b.h / 2, rotZ: tilt, inset: r() * 0.012 });
    x += b.t + GAP + (r() < 0.12 ? 0.006 : 0);
  }

  const bookendX = inner - x > 0.1 ? x + 0.02 : undefined;
  // centre what's there a little instead of hugging the left wall
  return { placed, bookendX };
}
