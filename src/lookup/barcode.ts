import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, GlobalHistogramBinarizer, MultiFormatReader, RGBLuminanceSource } from '@zxing/library';
import type { Raw } from '../image/raw';
import { downscaleRaw } from '../image/raw';
import { normalizeIsbn } from '../domain/isbn';

const hints = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]],
  [DecodeHintType.TRY_HARDER, true],
]);

function lumOf(raw: Raw, x0: number, y0: number, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y0 + y) * raw.width + (x0 + x)) * 4;
    out[y * w + x] = (raw.data[i] * 77 + raw.data[i + 1] * 150 + raw.data[i + 2] * 29) >> 8;
  }
  return out;
}

function tryDecode(raw: Raw, x0: number, y0: number, w: number, h: number): string | null {
  // resample the tile so its width is ~600px: enough pixels per bar without huge cost
  const tile: Raw = { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
  for (let y = 0; y < h; y++) {
    const si = ((y0 + y) * raw.width + x0) * 4;
    tile.data.set(raw.data.subarray(si, si + w * 4), y * w * 4);
  }
  const { img } = downscaleRaw(tile, Math.max(600, Math.round(600 * h / w)));
  const lum = lumOf(img, 0, 0, img.width, img.height);
  for (const Bin of [HybridBinarizer, GlobalHistogramBinarizer]) {
    try {
      const reader = new MultiFormatReader();
      reader.setHints(hints);
      const res = reader.decode(new BinaryBitmap(new Bin(new RGBLuminanceSource(lum, img.width, img.height))));
      const n = normalizeIsbn(res.getText());
      if (n) return n;
    } catch { /* not found in this tile */ }
  }
  return null;
}

/** Decode an ISBN barcode from an image: whole frame, then overlapping tiles (bottom first). */
export function decodeIsbnFromRaw(input: Raw): string | null {
  const { img } = downscaleRaw(input, 2400);
  const { width: W, height: H } = img;
  const whole = tryDecode(img, 0, 0, W, H);
  if (whole) return whole;
  for (const n of [2, 3]) {
    const tw = Math.floor(W / n * 1.0), th = Math.floor(H / n * 1.0);
    const xs: number[] = [], ys: number[] = [];
    for (let x = 0; x + tw <= W; x += Math.floor(tw / 2)) xs.push(x);
    for (let y = 0; y + th <= H; y += Math.floor(th / 2)) ys.push(y);
    ys.reverse(); // barcodes usually sit low on the back cover
    for (const y of ys) for (const x of [...xs].reverse()) {
      const r = tryDecode(img, x, y, tw, th);
      if (r) return r;
    }
  }
  return null;
}

/** Browser: native BarcodeDetector first (fast), zxing as fallback. */
export async function decodeIsbnFromBlob(blob: Blob, raw: Raw): Promise<string | null> {
  const BD = (globalThis as any).BarcodeDetector;
  if (BD) {
    try {
      const det = new BD({ formats: ['ean_13', 'ean_8', 'upc_a'] });
      const bmp = await createImageBitmap(blob);
      const codes = await det.detect(bmp);
      for (const c of codes) { const n = normalizeIsbn(c.rawValue); if (n) return n; }
    } catch { /* fall through */ }
  }
  return decodeIsbnFromRaw(raw);
}
