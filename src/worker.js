// All model work happens here so the UI never freezes. Both models are open
// and run locally in the browser:
//   - gte-small (Alibaba, MIT): turns each message into a meaning vector, so
//     "when I was sad" finds "don't cry mijo, everything passes".
//   - Gemma 3 (Google, open weights): reads the few messages most likely to
//     mention a food, song or place and names it, and drafts a remembrance in
//     your voice. It never writes as the person you are remembering.
// After the first download they load from disk, so the app works offline.

import {
  env,
  pipeline,
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria,
} from '@huggingface/transformers';
import { opfsCache, opfsAvailable, failures, clearModels } from './opfs-cache.js';

// Serve the ONNX Runtime WASM from our own origin, not a CDN.
const base = new URL(import.meta.env.BASE_URL + 'ort/', self.location.origin).href;
env.backends.onnx.wasm.wasmPaths = {
  mjs: base + 'ort-wasm-simd-threaded.asyncify.mjs',
  wasm: base + 'ort-wasm-simd-threaded.asyncify.wasm',
};
env.allowLocalModels = false;

// Model files go to the Origin Private File System when possible, otherwise
// transformers.js' Cache API default.
let storageReady = null;
const setupStorage = () => (storageReady ??= opfsAvailable().then((ok) => {
  if (ok) {
    env.useBrowserCache = false;
    env.useCustomCache = true;
    env.customCache = opfsCache;
  }
}));

const GTE_ID = 'Xenova/gte-small';
const GEMMA = {
  '1b': 'onnx-community/gemma-3-1b-it-ONNX',
  '270m': 'onnx-community/gemma-3-270m-it-ONNX',
};
const EXPECTED_MB = {
  core: 34,
  '1b:q4': 880, '1b:q4f16': 785,
  '270m:fp16': 590,
};

const post = (msg) => self.postMessage(msg);

function progressReporter(which, expectedMB = 0) {
  const files = new Map();
  return (p) => {
    if (p.status !== 'progress' && p.status !== 'done') return;
    const prev = files.get(p.file) || { loaded: 0, total: 0 };
    files.set(p.file, { loaded: p.status === 'done' ? prev.total || p.loaded || 0 : p.loaded, total: p.total ?? prev.total });
    let loaded = 0, total = 0;
    for (const f of files.values()) { loaded += f.loaded || 0; total += f.total || 0; }
    post({ type: 'progress', which, loaded, total: Math.max(total, expectedMB * 1e6) });
  };
}

// ---------- Meaning model (gte-small) ----------

let gte = null;
let gteLoading = null;

function loadCore() {
  if (gte) return Promise.resolve(gte);
  return (gteLoading ??= (async () => {
    await setupStorage();
    gte = await pipeline('feature-extraction', GTE_ID, { dtype: 'q8', device: 'wasm', progress_callback: progressReporter('core', EXPECTED_MB.core) });
    return gte;
  })().catch((err) => { gteLoading = null; throw err; }));
}

async function embed(texts) {
  const model = await loadCore();
  const out = await model(texts, { pooling: 'mean', normalize: true });
  const [n, d] = out.dims;
  return Array.from({ length: n }, (_, i) => out.data.slice(i * d, (i + 1) * d));
}

// ---------- Gemma ----------

let gemma = null;
const stopper = new InterruptableStoppingCriteria();
let genChain = Promise.resolve();

async function webgpuInfo() {
  try {
    if (!self.navigator.gpu) return null;
    const adapter = await self.navigator.gpu.requestAdapter();
    if (!adapter) return null;
    return { fp16: adapter.features.has('shader-f16') };
  } catch {
    return null;
  }
}

// GPU: Gemma 3 1B in 4-bit. CPU: ONNX Runtime Web has no CPU kernel for the
// 4/8-bit embedding op these exports use, so the 270M model runs in fp16.
// A failed session load can leave this worker unable to create sessions, so
// the UI restarts the worker to fall back rather than retrying here.
async function loadGemma(device = 'webgpu') {
  if (gemma && gemma.device === device) return gemma;
  await setupStorage();
  if (gemma) { await gemma.model.dispose?.(); gemma = null; }
  const gpu = device === 'webgpu' ? await webgpuInfo() : null;
  if (device === 'webgpu' && !gpu) throw new Error('WebGPU is not available');
  const plan = device === 'webgpu'
    ? { id: GEMMA['1b'], size: '1b', dtype: gpu.fp16 ? 'q4f16' : 'q4' }
    : { id: GEMMA['270m'], size: '270m', dtype: 'fp16' };
  const tokenizer = await AutoTokenizer.from_pretrained(plan.id);
  post({ type: 'status', which: 'llm', text: `Loading Gemma 3 ${plan.size.toUpperCase()} on ${device === 'webgpu' ? 'GPU' : 'CPU'}…` });
  const model = await AutoModelForCausalLM.from_pretrained(plan.id, {
    device, dtype: plan.dtype, progress_callback: progressReporter('llm', EXPECTED_MB[`${plan.size}:${plan.dtype}`]),
  });
  // One tiny generation so GPU driver problems show up now, not mid-answer.
  const warm = tokenizer.apply_chat_template([{ role: 'user', content: 'Hi' }], { add_generation_prompt: true, return_dict: true });
  await model.generate({ ...warm, max_new_tokens: 2, do_sample: false });
  gemma = { tokenizer, model, device, size: plan.size };
  return gemma;
}

async function generate(id, messages, maxTokens, prefill, device, stream) {
  const { tokenizer, model } = await loadGemma(device);
  const prompt = tokenizer.apply_chat_template(messages, { add_generation_prompt: true, tokenize: false }) + (prefill || '');
  const inputs = tokenizer(prompt, { add_special_tokens: false });
  let text = '';
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunk) => { text += chunk; if (stream) post({ type: 'token', id, chunk }); },
  });
  stopper.reset();
  await model.generate({
    ...inputs,
    max_new_tokens: maxTokens || 120,
    do_sample: false,
    repetition_penalty: 1.1,
    streamer,
    stopping_criteria: stopper,
  });
  return { text: text.trim() };
}

// ---------- Message loop ----------

self.addEventListener('message', async ({ data }) => {
  const { type, id } = data;
  try {
    switch (type) {
      case 'load-core':
        await loadCore();
        post({ type: 'ready', which: 'core', offline: failures.length === 0 });
        break;
      case 'load-llm': {
        const g = await loadGemma(data.device);
        post({ type: 'ready', which: 'llm', device: g.device, size: g.size, offline: failures.length === 0 });
        break;
      }
      case 'embed':
        post({ type: 'result', id, result: await embed(data.texts) });
        break;
      case 'generate': {
        const run = genChain.then(() => generate(id, data.messages, data.maxTokens, data.prefill, data.device, data.stream));
        genChain = run.catch(() => {});
        post({ type: 'result', id, result: await run });
        break;
      }
      case 'stop':
        stopper.interrupt();
        break;
      case 'clear-models':
        await clearModels();
        await caches.delete('transformers-cache').catch(() => {});
        post({ type: 'result', id, result: true });
        break;
    }
  } catch (err) {
    console.error(err);
    post({ type: 'error', id, which: data.which, message: String(err?.message || err) });
  }
});
