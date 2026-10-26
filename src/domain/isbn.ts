function isbn13Valid(d: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(d[12]);
}

function isbn10Valid(d: string) {
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (d[i] === 'X' ? 10 : Number(d[i])) * (10 - i);
  return sum % 11 === 0;
}

function toIsbn13(d10: string) {
  const base = '978' + d10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 ? 3 : 1);
  return base + ((10 - (sum % 10)) % 10);
}

/** Returns a validated ISBN-13 or null. Accepts ISBN-10/13 with any separators. */
export function normalizeIsbn(raw: string): string | null {
  const s = raw.toUpperCase().replace(/ISBN(-1[03])?:?/g, '').replace(/[^0-9X]/g, '');
  if (s.length === 13 && /^\d{13}$/.test(s) && isbn13Valid(s)) return s;
  if (s.length === 10 && /^\d{9}[\dX]$/.test(s) && isbn10Valid(s)) return toIsbn13(s);
  return null;
}

/** Find the first valid ISBN anywhere inside a block of text (e.g. OCR). */
export function findIsbnInText(text: string): string | null {
  const thai = text.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50));
  const re = /(97[89][\d\s-]{10,16}|\d[\d\s-]{8,12}[\dX])/gi;
  for (const m of thai.matchAll(re)) {
    const n = normalizeIsbn(m[0]);
    if (n) return n;
  }
  return null;
}
