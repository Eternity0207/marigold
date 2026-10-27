// Copy the ONNX Runtime WASM into public/ so the app serves everything from
// its own origin: it works offline and doesn't depend on a CDN staying up.
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pub = (p) => new URL(`../public/${p}`, import.meta.url);

const ort = join(dirname(require.resolve('@huggingface/transformers')), '..', '..', '..', 'onnxruntime-web', 'dist');
mkdirSync(pub('ort'), { recursive: true });
for (const f of ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) {
  cpSync(join(ort, f), pub(`ort/${f}`));
}
console.log('Copied ONNX Runtime into public/');
