// Copies tesseract worker/core and Thai+English language data into public/ocr so OCR works self-hosted & offline.
import { mkdirSync, copyFileSync, existsSync } from 'fs';
const out = 'public/ocr';
mkdirSync(`${out}/core`, { recursive: true });
mkdirSync(`${out}/lang`, { recursive: true });
const copy = (a, b) => { if (!existsSync(b)) copyFileSync(a, b); };
copy('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`);
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm', 'tesseract-core-simd-lstm.wasm', 'tesseract-core-lstm.js', 'tesseract-core-simd-lstm.js']) {
  copy(`node_modules/tesseract.js-core/${f}`, `${out}/core/${f}`);
}
copy('node_modules/@tesseract.js-data/tha/4.0.0_best_int/tha.traineddata.gz', `${out}/lang/tha.traineddata.gz`);
copy('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', `${out}/lang/eng.traineddata.gz`);
console.log('ocr assets ready');
