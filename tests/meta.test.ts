import { describe, it, expect } from 'vitest';
import { mergeMeta as patchOf } from '../src/domain/meta';
const mergeMeta = (b: any, m: any, o?: boolean) => ({ ...b, ...patchOf(b, m, o) });

describe('mergeMeta', () => {
  it('fills only empty fields by default', () => {
    const p = mergeMeta({ title: 'อาณาจักรมด', authors: [], pageCount: undefined }, { title: 'The Empire of the Ants', authors: ['H. G. Wells'], pageCount: 120, publisher: 'X', genre: 'scifi' });
    expect(p.title).toBe('อาณาจักรมด');
    expect(p.authors).toEqual(['H. G. Wells']);
    expect(p.pageCount).toBe(120);
    expect(p.publisher).toBe('X');
    expect(p.genre).toBe('scifi');
  });
  it('keeps a different-language API title as originalTitle when title exists', () => {
    const p = mergeMeta({ title: 'อาณาจักรมด', authors: [] }, { title: 'The Empire of the Ants', authors: [] });
    expect(p.originalTitle).toBe('The Empire of the Ants');
  });
  it('overwrite replaces existing values', () => {
    const p = mergeMeta({ title: 'abc', authors: ['a'] }, { title: 'Real', authors: ['b'] }, true);
    expect(p.title).toBe('Real');
    expect(p.authors).toEqual(['b']);
  });
  it('clears needsLookup when meta found', () => {
    const p = mergeMeta({ title: '', authors: [], needsLookup: true }, { title: 'T', authors: [] });
    expect(p.needsLookup).toBe(false);
  });
  it('does not set genre other when existing genre present', () => {
    const p = mergeMeta({ title: 'a', authors: [], genre: 'fantasy' }, { title: 'a', authors: [], genre: 'fiction' });
    expect(p.genre).toBe('fantasy');
  });
});

import { fillEmpty } from '../src/domain/meta';
describe('fillEmpty', () => {
  it('fills only empty fields and keeps user input', () => {
    const p = fillEmpty({ title: 'my title', authors: [], pageCount: undefined } as any, { title: 'api', authors: ['A'], pageCount: 99, needsLookup: false });
    expect(p).toEqual({ authors: ['A'], pageCount: 99, needsLookup: false });
  });
});
