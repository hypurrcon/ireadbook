import { describe, it, expect, vi } from 'vitest';
import { resolveMeta } from '../src/lookup/resolve';
import type { BookMeta } from '../src/lookup/books';

const meta = (m: Partial<BookMeta>): BookMeta => ({ title: '', authors: [], ...m });

describe('resolveMeta', () => {
  it('uses ISBN lookup when found and keeps OCR translators', async () => {
    const deps = { lookupIsbn: vi.fn(async () => meta({ title: 'อาณาจักรมด', authors: ['เอช.จี.เวลส์'], pageCount: 120 })), searchText: vi.fn(async () => []) };
    const r = await resolveMeta({ isbn: '9786169433736', ocr: { title: 'อาณาจกรมด', translators: ['นภัค ลิมป์'] }, online: true }, deps);
    expect(r.source).toBe('isbn');
    expect(r.patch.title).toBe('อาณาจักรมด');
    expect(r.patch.isbn).toBe('9786169433736');
    expect(r.patch.translators).toEqual(['นภัค ลิมป์']);
    expect(r.patch.needsLookup).toBe(false);
    expect(deps.searchText).not.toHaveBeenCalled();
  });

  it('falls back to OCR guess, then text search fills empty fields', async () => {
    const deps = {
      lookupIsbn: vi.fn(async () => null),
      searchText: vi.fn(async () => [meta({ title: 'The Empire of the Ants', authors: ['H. G. Wells'], year: 1905 })]),
    };
    const r = await resolveMeta({ isbn: '9786169433736', ocr: { title: 'อาณาจักรมด', originalTitle: 'The Empire of the Ants', authors: ['เอช.จี.เวลส์'] }, online: true }, deps);
    expect(r.source).toBe('ocr+text');
    expect(r.patch.title).toBe('อาณาจักรมด');
    expect(r.patch.originalTitle).toBe('The Empire of the Ants');
    expect(r.patch.authors).toEqual(['เอช.จี.เวลส์']);
    expect(r.patch.year).toBe(1905);
    expect(r.patch.isbn).toBe('9786169433736');
    expect(deps.searchText).toHaveBeenCalledWith('The Empire of the Ants');
  });

  it('ignores a text search hit whose title does not resemble the guess', async () => {
    const deps = { lookupIsbn: vi.fn(async () => null), searchText: vi.fn(async () => [meta({ title: 'Totally Different Book', authors: ['X'] })]) };
    const r = await resolveMeta({ ocr: { title: 'Dune' }, online: true }, deps);
    expect(r.patch.authors).toEqual([]);
    expect(r.source).toBe('ocr');
  });

  it('offline: no network calls and needsLookup true', async () => {
    const deps = { lookupIsbn: vi.fn(), searchText: vi.fn() };
    const r = await resolveMeta({ isbn: '9786169433736', ocr: { title: 'อาณาจักรมด' }, online: false }, deps as any);
    expect(deps.lookupIsbn).not.toHaveBeenCalled();
    expect(r.patch.needsLookup).toBe(true);
    expect(r.patch.title).toBe('อาณาจักรมด');
  });

  it('nothing at all still returns a saveable patch', async () => {
    const deps = { lookupIsbn: vi.fn(async () => null), searchText: vi.fn(async () => []) };
    const r = await resolveMeta({ ocr: {}, online: true }, deps);
    expect(r.source).toBe('none');
    expect(r.patch.title ?? '').toBe('');
  });

  it('network errors are treated like offline', async () => {
    const deps = { lookupIsbn: vi.fn(async () => { throw new Error('net'); }), searchText: vi.fn(async () => { throw new Error('net'); }) };
    const r = await resolveMeta({ isbn: '9786169433736', ocr: { title: 'x' }, online: true }, deps);
    expect(r.patch.needsLookup).toBe(true);
  });
});
