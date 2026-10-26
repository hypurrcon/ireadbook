import { describe, it, expect } from 'vitest';
import th from '../src/i18n/th.json';
import en from '../src/i18n/en.json';

function keys(o: any, p = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, p + k + '.') : [p + k]);
}
function get(o: any, path: string) { return path.split('.').reduce((a, k) => a?.[k], o); }

describe('i18n', () => {
  it('th keys exist in en', () => {
    const missing = keys(th).filter((k) => typeof get(en, k) !== 'string');
    expect(missing).toEqual([]);
  });
  it('en keys exist in th', () => {
    const missing = keys(en).filter((k) => typeof get(th, k) !== 'string');
    expect(missing).toEqual([]);
  });
  it('no empty strings', () => {
    const empty = [...keys(th).filter((k) => !get(th, k)), ...keys(en).filter((k) => !get(en, k))];
    expect(empty).toEqual([]);
  });
});
