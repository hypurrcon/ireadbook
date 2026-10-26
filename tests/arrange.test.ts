import { describe, it, expect } from 'vitest';
import { arrangeRow, type RowItem } from '../src/domain/arrange';

const items = (n: number, seed = 1): RowItem[] => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, t: 0.02 + ((i * 7 + seed) % 5) * 0.004, h: 0.19 + ((i * 3) % 4) * 0.01, d: 0.14 }));

/** horizontal extent of each placed book on the shelf */
function extents(p: ReturnType<typeof arrangeRow>['placed'], it: RowItem[]) {
  return p.map((x) => {
    const b = it.find((i) => i.id === x.id)!;
    const w = x.kind === 'stack' ? b.h : x.kind === 'lean' ? b.t * Math.cos(x.rotZ) + b.h * Math.sin(Math.abs(x.rotZ)) : (x.t ?? b.t);
    return [x.x - w / 2, x.x + w / 2] as const;
  });
}

describe('arrangeRow', () => {
  it('places every book once, inside the shelf', () => {
    const it8 = items(8);
    const r = arrangeRow(it8, 0.94, 'shelf-a');
    expect(r.placed.map((p) => p.id).sort()).toEqual(it8.map((i) => i.id).sort());
    for (const [a, b] of extents(r.placed, it8)) { expect(a).toBeGreaterThanOrEqual(-1e-6); expect(b).toBeLessThanOrEqual(0.94 + 1e-6); }
  });
  it('standing books do not overlap', () => {
    const it10 = items(10);
    const r = arrangeRow(it10, 0.94, 'x');
    const ex = extents(r.placed.filter((p) => p.kind !== 'stack'), it10).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ex.length; i++) expect(ex[i][0]).toBeGreaterThanOrEqual(ex[i - 1][1] - 0.002);
  });
  it('with room to spare the last standing book leans on its neighbour', () => {
    const r = arrangeRow(items(5), 0.94, 'lean');
    const standing = r.placed.filter((p) => p.kind !== 'stack');
    expect(standing[standing.length - 1].kind).toBe('lean');
    expect(Math.abs(standing[standing.length - 1].rotZ)).toBeGreaterThan(0.1);
  });
  it('some shelves get a small lying stack, deterministically', () => {
    const seeds = Array.from({ length: 30 }, (_, i) => `s${i}`);
    const withStack = seeds.filter((s) => arrangeRow(items(9), 0.94, s).placed.some((p) => p.kind === 'stack'));
    expect(withStack.length).toBeGreaterThan(2);
    expect(withStack.length).toBeLessThan(25);
    expect(arrangeRow(items(9), 0.94, 's3')).toEqual(arrangeRow(items(9), 0.94, 's3'));
  });
  it('a crowded shelf squeezes, never stacks or leans', () => {
    const many = items(60);
    const r = arrangeRow(many, 0.94, 'full');
    expect(r.placed.every((p) => p.kind === 'stand')).toBe(true);
    const ex = extents(r.placed, many);
    expect(Math.max(...ex.map((e) => e[1]))).toBeLessThanOrEqual(0.94 + 1e-6);
  });
  it('adds a bookend when there is plenty of room', () => {
    expect(arrangeRow(items(4), 0.94, 'e').bookendX).toBeDefined();
    expect(arrangeRow(items(60), 0.94, 'e').bookendX).toBeUndefined();
  });
});
