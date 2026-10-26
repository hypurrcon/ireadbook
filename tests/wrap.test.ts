import { describe, it, expect } from 'vitest';
import { wrapText } from '../src/share/wrap';

const measure = (s: string) => s.length * 10;

describe('wrapText', () => {
  it('wraps English on spaces within width', () => {
    const lines = wrapText('the quick brown fox jumps', 100, measure);
    expect(lines).toEqual(['the quick', 'brown fox', 'jumps']);
  });
  it('wraps Thai text without spaces at word boundaries', () => {
    const lines = wrapText('การเดินทางทางเรือเข้าไปในป่าลึกของบราซิล', 100, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('การเดินทางทางเรือเข้าไปในป่าลึกของบราซิล');
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(100);
  });
  it('keeps explicit newlines', () => {
    expect(wrapText('a\nb', 100, measure)).toEqual(['a', 'b']);
  });
  it('limits lines and adds ellipsis', () => {
    const lines = wrapText('aa bb cc dd ee ff', 50, measure, 2);
    expect(lines.length).toBe(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });
});
