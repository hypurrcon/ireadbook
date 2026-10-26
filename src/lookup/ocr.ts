import type { Raw } from '../image/raw';
import { textMaskRaw, downscaleRaw } from '../image/raw';
import { groupWords, type OcrLine, type OcrWord } from './guess';

type Worker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;
let workerP: Promise<Worker> | null = null;

const base = () => new URL('./ocr/', document.baseURI).href;

function getWorker(): Promise<Worker> {
  if (!workerP) {
    workerP = import('tesseract.js').then(async ({ createWorker }) => {
      const w = await createWorker(['tha', 'eng'], 1, {
        workerPath: base() + 'worker.min.js',
        corePath: base() + 'core',
        langPath: base() + 'lang',
        gzip: true,
      });
      await w.setParameters({ tessedit_pageseg_mode: '11' as any });
      return w;
    }).catch((e) => { workerP = null; throw e; });
  }
  return workerP;
}

function rawToCanvas(r: Raw) {
  const c = document.createElement('canvas');
  c.width = r.width; c.height = r.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0);
  return c;
}

const score = (lines: OcrLine[]) => lines.reduce((a, l) => a + (l.text.match(/[฀-๿a-zA-Z]/g)?.length ?? 0), 0);

/** OCR a straightened cover. Tries light-text, dark-text and plain variants; keeps the richest result. */
export async function ocrCover(raw: Raw): Promise<OcrLine[]> {
  const w = await getWorker();
  const { img } = downscaleRaw(raw, 1600);
  let best: OcrLine[] = [];
  for (const variant of [textMaskRaw(img, 'light'), textMaskRaw(img, 'dark'), img]) {
    const { data } = await w.recognize(rawToCanvas(variant), {}, { blocks: true } as any);
    const words: OcrWord[] = (data as any).blocks?.flatMap((b: any) => b.paragraphs.flatMap((p: any) => p.lines.flatMap((l: any) => l.words))) ?? [];
    const lines = groupWords(words);
    if (score(lines) > score(best)) best = lines;
  }
  return best;
}

export async function ocrPlain(raw: Raw): Promise<string> {
  const w = await getWorker();
  const { img } = downscaleRaw(raw, 1800);
  await w.setParameters({ tessedit_pageseg_mode: '3' as any });
  try {
    const { data } = await w.recognize(rawToCanvas(img));
    return data.text;
  } finally {
    await w.setParameters({ tessedit_pageseg_mode: '11' as any });
  }
}
