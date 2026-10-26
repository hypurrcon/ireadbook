import { findIsbnInText } from '../domain/isbn';

export interface OcrLine { text: string; height: number }
export interface OcrGuess { title?: string; originalTitle?: string; authors?: string[]; translators?: string[]; publisher?: string; isbn?: string }

const THAI = /[฀-๿]/;
const clean = (s: string) => s.replace(/[|~_=*•“”"«»\[\]{}<>]/g, ' ').replace(/\s+/g, ' ').trim();

function letters(s: string) {
  const m = s.match(/[฀-๿a-zA-Z]/g);
  return m ? m.length : 0;
}

const isJunk = (s: string) => letters(s) < 2 || letters(s) / s.replace(/\s/g, '').length < 0.5;
const TRANSL = /(แปล(?:โดย)?|เรียบเรียง|translated by|translation by)/i;
const AUTHOR = /^(?:เขียนโดย|ผู้เขียน|เรื่อง(?:โดย)?|by|written by)\s*[:：]?\s*/i;
const AUTHOR_SUFFIX = /\s*(?:เขียน|ผู้เขียน)$/;
const PUB = /(สำนักพิมพ์|publishing|publisher|press|books$)/i;
const NOISE = /(บาท|isbn|ราคา|www\.|\.com|ภาพปก|ออกแบบ|พิมพ์ครั้ง)/i;

/** OCR sometimes splits stylised words: "The Em p ire" -> "The Empire". */
function fixSplitWords(s: string) {
  return s.replace(/\b([A-Z][a-z]{0,3}) ([a-z]{1,2}) ([a-z]{2,})\b/g, '$1$2$3');
}

export function guessFromOcr(front: OcrLine[], back: OcrLine[]): OcrGuess {
  const out: OcrGuess = {};
  const isbn = findIsbnInText([...back, ...front].map((l) => l.text).join('\n'));
  if (isbn) out.isbn = isbn;

  const lines = front.map((l) => ({ ...l, text: clean(l.text) })).filter((l) => l.text && !isJunk(l.text) && !NOISE.test(l.text));
  if (!lines.length) return out;

  const rest: typeof lines = [];
  for (const l of lines) {
    if (TRANSL.test(l.text)) {
      const name = l.text.replace(TRANSL, '').replace(/[:：]/g, '').trim();
      if (name) (out.translators ??= []).push(name);
    } else if (AUTHOR.test(l.text) || AUTHOR_SUFFIX.test(l.text)) {
      const name = l.text.replace(AUTHOR, '').replace(AUTHOR_SUFFIX, '').trim();
      if (name) (out.authors ??= []).push(name);
    } else if (PUB.test(l.text)) {
      out.publisher ??= l.text.replace(/สำนักพิมพ์\s*/, '').trim() || l.text;
    } else rest.push(l);
  }
  if (!rest.length) return out;

  // group consecutive lines of similar size and script into "blocks"
  type Block = { text: string; height: number; thai: boolean; idx: number };
  const blocks: Block[] = [];
  rest.forEach((l, i) => {
    const thai = THAI.test(l.text);
    const last = blocks[blocks.length - 1];
    if (last && last.thai === thai && Math.abs(last.height - l.height) / Math.max(last.height, l.height) < 0.25) {
      last.text += ' ' + l.text;
    } else blocks.push({ text: l.text, height: l.height, thai, idx: i });
  });

  const maxH = Math.max(...blocks.map((b) => b.height));
  const big = blocks.filter((b) => b.height >= maxH * 0.45);
  const engTitle = big.find((b) => !b.thai);
  // Thai editions of translated books often print the original title huge and the Thai title smaller
  // right below it; prefer a Thai title when one sits close to the big English one and is still prominent.
  const smallest = Math.min(...blocks.map((b) => b.height));
  const thaiTitle = big.find((b) => b.thai) ?? (engTitle
    ? blocks.find((b) => b.thai && b.idx > engTitle.idx && b.idx <= engTitle.idx + 2 && letters(b.text) >= 4 && b.height > smallest * 1.2)
    : undefined);
  const titleBlock = thaiTitle ?? big[0];
  out.title = fixSplitWords(titleBlock.text);
  if (thaiTitle && engTitle) out.originalTitle = fixSplitWords(engTitle.text);

  if (!out.authors?.length) {
    const used = new Set([titleBlock, engTitle].filter(Boolean));
    const cand = blocks.find((b) => !used.has(b) && b.height < maxH * 0.6 && b.text.length <= 40 && b.idx > titleBlock.idx);
    if (cand) out.authors = [cand.text];
  }
  return out;
}

export interface OcrWord { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }

/** Rebuild lines from sparse-mode OCR words (confident words only). */
export function groupWords(words: OcrWord[], minConf = 60): OcrLine[] {
  const ws = words
    .filter((w) => w.confidence >= minConf && w.text.trim())
    .map((w) => ({ ...w, cy: (w.bbox.y0 + w.bbox.y1) / 2, h: w.bbox.y1 - w.bbox.y0 }))
    .sort((a, b) => a.cy - b.cy);
  const lines: { words: typeof ws; cy: number; h: number }[] = [];
  for (const w of ws) {
    const line = lines.find((l) => Math.abs(l.cy - w.cy) < Math.max(l.h, w.h) * 0.45);
    if (line) { line.words.push(w); line.h = Math.max(line.h, w.h); }
    else lines.push({ words: [w], cy: w.cy, h: w.h });
  }
  return lines.map((l) => {
    const sorted = l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    let text = '';
    sorted.forEach((w, i) => {
      const t = w.text.trim();
      const prev = sorted[i - 1];
      const thaiJoin = prev && THAI.test(t) && THAI.test(prev.text) && w.bbox.x0 - prev.bbox.x1 < l.h * 0.35;
      text += i === 0 || thaiJoin ? t : ' ' + t;
    });
    const hs = l.words.map((w) => w.h).sort((a, b) => a - b);
    return { text, height: hs[Math.floor(hs.length / 2)] };
  });
}
