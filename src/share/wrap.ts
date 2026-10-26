/** Split text into word-ish segments (Thai has no spaces, so use Intl.Segmenter when present). */
function segments(text: string): string[] {
  const Seg = (Intl as any).Segmenter;
  if (Seg) return Array.from(new Seg('th', { granularity: 'word' }).segment(text), (s: any) => s.segment as string);
  return text.split(/(\s+)/);
}

/** Greedy line wrap using a measure function. Long single words are broken by characters. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, maxLines = Infinity): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const seg of segments(para)) {
      const next = line + seg;
      if (measure(next.trimEnd()) <= maxWidth) { line = next; continue; }
      if (line.trim()) out.push(line.trim());
      line = seg.trimStart();
      while (measure(line) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut)) > maxWidth) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line.trim());
  }
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length && measure(last + '…') > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = last + '…';
    return kept;
  }
  return out;
}
