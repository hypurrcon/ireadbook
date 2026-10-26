import { describe, it, expect } from 'vitest';
import { renderPrompt, unreadList, BUILTIN, buildVars } from '../src/domain/prompts';
import type { Book, Session } from '../src/db/types';

const B = (id: string, extra: Partial<Book> = {}): Book => ({ id, title: id, authors: [], translators: [], tags: [], format: 'paperback', status: 'want', progressUnit: 'page', currentPage: 0, rereadCount: 0, needsLookup: false, needsReview: false, createdAt: 0, updatedAt: 0, ...extra });

describe('prompts', () => {
  it('renderPrompt replaces known variables and leaves unknown ones', () => {
    expect(renderPrompt('Hi {name}, {x}', { name: 'A' })).toBe('Hi A, {x}');
  });
  it('unreadList numbers books with author, ISBN, genre label, pages and series order', () => {
    const list = unreadList([B('อาณาจักรมด', { authors: ['เอช.จี.เวลส์'], isbn: '9786169433736', genre: 'scifi', pageCount: 120 }), B('Dune', { seriesIndex: 1 })], { genre: (g) => g, series: () => 'Dune Saga', untitled: '-', page: (n) => `${n}p`, vol: (n, s) => `${s} #${n}` });
    expect(list).toContain('1. อาณาจักรมด — เอช.จี.เวลส์ | ISBN 9786169433736 | scifi | 120p');
    expect(list).toContain('2. Dune');
    expect(list).toContain('Dune Saga #1');
  });
  it('whatNext only lists books not finished and not stopped', () => {
    const books = [B('a'), B('b', { status: 'finished', rating: 5 }), B('c', { status: 'dnf' }), B('d', { status: 'reading' })];
    const v = buildVars({ books, sessions: [] as Session[], quotes: [], lang: 'en', fmt: { genre: (g) => g, series: () => '', untitled: '-', page: (n) => `${n}p`, vol: (n, s) => `${s} ${n}` } });
    expect(v.unreadBooks).toContain('a');
    expect(v.unreadBooks).toContain('d');
    expect(v.unreadBooks).not.toContain('b');
    expect(v.readBooks).toContain('b');
    expect(v.readBooks).toContain('5/5');
  });
  it('every built-in template exists in both languages and mentions its key variable', () => {
    for (const tpl of BUILTIN) {
      expect(tpl.body.th.length).toBeGreaterThan(50);
      expect(tpl.body.en.length).toBeGreaterThan(50);
    }
    expect(BUILTIN.find((x) => x.id === 'whatNext')!.body.en).toContain('{unreadBooks}');
  });
});
