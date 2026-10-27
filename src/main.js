import '@fontsource-variable/fraunces';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/700.css';
import './style.css';
import { startWorker, restartWorker, load, call, on, stopGeneration } from './client.js';
import * as db from './db.js';
import { parseChat, looksLikeChat } from './chat.js';
import { chatPassages, letterPassages, sayings, nicknames, topEmoji, usualTime, span } from './words.js';
import { KeywordIndex, rank } from './search.js';
import { CATEGORIES, CAT_BY_ID, candidates, prompt, verifyAll, merge, backfill } from './offerings.js';
import * as sample from './sample.js';
import { altarHTML } from './altar.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const SAMPLE_ID = 'sample-rosa';
// Bump when sayings or nicknames are counted differently, so saved ofrendas
// get recounted when opened.
const WORDS_VERSION = 2;

const state = {
  list: [],
  cur: null,
  index: null,
  vecList: [],
  protoVecs: null,
  core: 'idle',
  llm: 'idle',
  llmDevice: null,
  download: null,
  job: null, // { kind: 'embed' | 'offerings' | 'draft', stop: bool }
  seen: new Set(),
  photoUrl: null,
  editing: null,
};

// ---------- models ----------

on('progress', ({ which, loaded, total }) => {
  const frac = total ? Math.min(1, loaded / total) : 0;
  if (which === 'core') {
    state.download = frac;
  } else {
    $('llmBarWrap').hidden = false;
    $('llmBar').style.width = `${frac * 100}%`;
    $('llmState').textContent = `${Math.round(loaded / 1e6)} of ${Math.round(total / 1e6)} MB`;
    if (state.job?.kind === 'offerings' || state.job?.kind === 'draft') {
      buildBar(`${store.get('llmDownloaded', false) ? 'Loading' : 'Downloading'} Gemma`, `${Math.round(frac * 100)}% · once, then it stays on this device`, frac);
    }
  }
  renderStatus();
});
on('status', ({ which, text }) => { if (which === 'llm') $('llmState').textContent = text; });

async function ensureCore() {
  if (state.core === 'ready') return;
  state.core = 'loading';
  renderStatus();
  try {
    await load('core');
    state.core = 'ready';
    state.download = null;
  } catch (err) {
    state.core = 'error';
    toast(navigator.onLine ? `Couldn't load the search model: ${err.message}` : 'You are offline and the search model is not downloaded yet.');
    throw err;
  } finally {
    renderStatus();
  }
}

function llmDevice() {
  return navigator.gpu && !store.get('gpuFailed', false) ? 'webgpu' : 'wasm';
}

async function ensureLlm() {
  if (state.llm === 'ready') return;
  state.llm = 'loading';
  renderModels();
  const device = llmDevice();
  try {
    await load('llm', { device });
    state.llm = 'ready';
    state.llmDevice = device;
    store.set('llmDownloaded', true);
  } catch (err) {
    if (device === 'webgpu') {
      // GPU path failed: remember that, start a fresh worker, and use the CPU.
      store.set('gpuFailed', true);
      restartWorker();
      state.core = 'idle';
      state.llm = 'idle';
      toast('Gemma could not use the GPU here, switching to the smaller CPU model.');
      await ensureCore();
      return ensureLlm();
    }
    state.llm = 'error';
    $('llmState').textContent = `Couldn't load: ${err.message}`;
    throw err;
  } finally {
    renderModels();
  }
}

const gemmaLabel = () => (llmDevice() === 'webgpu' ? 'Gemma 3 1B' : 'Gemma 3 270M');
const gemmaSize = () => (llmDevice() === 'webgpu' ? '790 MB' : '590 MB');

function renderModels() {
  const label = { idle: 'Not loaded', loading: 'Loading…', ready: 'Ready', error: 'Error' };
  $('coreState').textContent = state.core === 'loading' && state.download != null ? `${Math.round(state.download * 100)}%` : label[state.core];
  $('coreState').dataset.state = state.core;
  if (state.llm !== 'loading') $('llmState').textContent = label[state.llm];
  $('llmState').dataset.state = state.llm;
  $('llmInfo').textContent = llmDevice() === 'webgpu' ? 'Gemma 3 1B on your GPU · ~790 MB' : 'Gemma 3 270M on your CPU (no WebGPU here) · ~590 MB';
  if (state.llm === 'ready') $('llmBarWrap').hidden = true;
}

function renderStatus() {
  renderModels();
  const pill = $('statusPill');
  if (state.core === 'loading' && state.download != null && state.download < 1) {
    pill.hidden = false;
    pill.dataset.state = 'loading';
    $('statusText').textContent = `Downloading search model ${Math.round(state.download * 100)}%`;
  } else if (state.llm === 'ready') {
    pill.hidden = false;
    pill.dataset.state = 'ready';
    $('statusText').textContent = `${state.llmDevice === 'webgpu' ? 'Gemma 3 1B' : 'Gemma 3 270M'} on this device`;
  } else {
    pill.hidden = true;
  }
}

// ---------- navigation ----------

function show(view) {
  for (const id of ['home', 'setup', 'ofrenda']) $(id).hidden = id !== view;
  window.scrollTo({ top: 0 });
}

async function route() {
  const m = location.hash.match(/^#\/o\/(.+)$/);
  if (m) {
    const o = await db.get(decodeURIComponent(m[1]));
    if (o) return openOfrenda(o);
  }
  if (location.hash === '#/new') return openSetup(null);
  state.cur = null;
  await renderHome();
  show('home');
}
window.addEventListener('hashchange', route);
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { e.preventDefault(); location.hash = go.dataset.go === 'home' ? '' : `#/${go.dataset.go}`; }
});

// ---------- home ----------

async function renderHome() {
  state.list = (await db.all()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  $('savedWrap').hidden = !state.list.length;
  $('saved').innerHTML = state.list.map((o) => `
    <a class="saved-card" href="#/o/${encodeURIComponent(o.id)}">
      <svg class="saved-mark" viewBox="0 0 48 48" aria-hidden="true"><use href="#marigold" /></svg>
      <span><strong>${esc(o.short || o.name)}</strong><small>${esc(years(o) || o.relation || '')}${o.passages.length ? ` · ${o.passages.length} of their messages` : ''}</small></span>
    </a>`).join('');
  $('sampleBtn').textContent = state.list.some((o) => o.id === SAMPLE_ID) ? "Visit Abuela Rosa's" : "See Abuela Rosa's";
}

$('newBtn').addEventListener('click', () => { location.hash = '#/new'; });
$('sampleBtn').addEventListener('click', async () => {
  let o = await db.get(SAMPLE_ID);
  if (!o) {
    o = blank({ ...sample.PERSON, id: SAMPLE_ID });
    o.sample = true;
    const { messages } = parseChat(sample.CHAT, 'en-GB');
    addChat(o, messages, 'Abuela Rosa', 'WhatsApp chat with Abuela Rosa');
    addLetter(o, sample.LETTER.text, sample.LETTER.date, sample.LETTER.title);
    for (const m of sample.MEMORIES) o.memories.push({ id: uid('m'), text: m });
    analyzeWords(o);
    await db.put(o);
  }
  location.hash = `#/o/${encodeURIComponent(o.id)}`;
});

$('importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const o = fromJSON(JSON.parse(await f.text()));
    const exists = await db.get(o.id);
    if (exists && !confirm(`There is already an ofrenda for ${o.short || o.name} on this device. Replace it with the saved copy?`)) return;
    await db.put(o);
    location.hash = `#/o/${encodeURIComponent(o.id)}`;
  } catch (err) {
    toast(`That file couldn't be opened: ${err.message}`);
  }
});

// ---------- setup ----------

function blank(p) {
  return {
    id: p.id || uid('o'),
    name: p.name.trim(),
    short: (p.short || '').trim(),
    relation: (p.relation || '').trim(),
    you: (p.you || '').trim(),
    born: (p.born || '').trim(),
    died: (p.died || '').trim(),
    photo: p.photo || null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sources: [],
    passages: [],
    yours: [],
    memories: [],
    vecs: {},
    sayings: [],
    nicknames: [],
    emoji: [],
    usual: null,
    span: null,
    offerings: [],
    asked: [],
    gemma: null,
    remembrance: '',
  };
}

function openSetup(o) {
  state.editing = o;
  const f = $('setupForm');
  f.reset();
  $('setupTitle').textContent = o ? `About ${o.short || o.name}` : 'Who are you remembering?';
  $('setupSubmit').textContent = o ? 'Save' : 'Next: gather their words';
  if (o) for (const k of ['name', 'short', 'relation', 'born', 'died', 'you']) f.elements[k].value = o[k] || '';
  show('setup');
  f.elements.name.focus();
}

$('setupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const v = Object.fromEntries(['name', 'short', 'relation', 'born', 'died', 'you'].map((k) => [k, f.elements[k].value]));
  const file = f.elements.photo.files[0];
  const photo = file ? await shrinkPhoto(file) : null;
  let o = state.editing;
  if (o) {
    Object.assign(o, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()])));
    if (photo) o.photo = photo;
    o.updatedAt = Date.now();
  } else {
    o = blank({ ...v, photo });
  }
  await db.put(o);
  state.editing = null;
  location.hash = `#/o/${encodeURIComponent(o.id)}`;
  if (!o.passages.length) selectTab('gather');
});

// Photos are kept small: this is for an altar, not an archive.
async function shrinkPhoto(file) {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
    const c = new OffscreenCanvas(Math.round(bmp.width * s), Math.round(bmp.height * s));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await c.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
  } catch {
    return file;
  }
}

// ---------- one ofrenda ----------

async function openOfrenda(o) {
  const same = state.cur?.id === o.id;
  state.cur = o;
  if (!same) {
    state.seen = new Set();
    $('visitQuote').hidden = true;
    $('lightBtn').classList.remove('lit');
    $('lightLabel').textContent = 'Light a candle';
    $('listenQ').value = '';
    $('listenResults').innerHTML = '';
    $('listenMeta').textContent = '';
  }
  if (o.wordsVersion !== WORDS_VERSION && o.passages.length) {
    analyzeWords(o);
    await db.put(o);
  }
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  state.photoUrl = o.photo ? URL.createObjectURL(o.photo) : null;
  rebuildIndex();
  renderAll();
  show('ofrenda');
  if (!same && !o.passages.length) selectTab('gather');
  else if (!same) selectTab('visit');
  continueBuild();
}

function renderAll() {
  renderAltar();
  renderVisitIntro();
  renderArrange();
  renderGather();
  $('remembrance').value = state.cur.remembrance || '';
  renderDraftInfo();
}

const who = (o = state.cur) => o.short || o.name.split(' ')[0];
const years = (o) => (o.born || o.died ? `${o.born || '?'} – ${o.died || ''}`.trim() : '');

function renderAltar() {
  $('altar').innerHTML = altarHTML(state.cur, { photoUrl: state.photoUrl, who: who(), years: years(state.cur), job: state.job });
}

$('altar').addEventListener('click', (e) => {
  const off = e.target.closest('[data-offering]');
  if (off) return openDrawer('offering', off.dataset.offering);
  const say = e.target.closest('[data-saying]');
  if (say) return openDrawer('saying', +say.dataset.saying);
  const act = e.target.closest('[data-act]');
  if (act?.dataset.act === 'find') findOfferings();
  if (act?.dataset.act === 'gather') selectTab('gather', true);
});

// ---------- words (no AI) ----------

function addChat(o, messages, theirName, title) {
  const sourceId = uid('s');
  const { passages, yours } = chatPassages(messages, theirName, sourceId);
  o.sources.push({ id: sourceId, type: 'chat', title, count: passages.length, sender: theirName });
  o.passages.push(...passages);
  o.yours.push(...yours.map((text) => ({ sourceId, text })));
  return passages.length;
}

function addLetter(o, text, date, title) {
  const sourceId = uid('s');
  const ps = letterPassages(text, date, sourceId);
  o.sources.push({ id: sourceId, type: 'letter', title: title || 'A letter', count: ps.length, date: date || null });
  o.passages.push(...ps);
  return ps.length;
}

// Recount sayings, nicknames and the rest. Anything you hid stays hidden.
function analyzeWords(o) {
  const hidden = new Set(o.sayings.filter((s) => s.hidden).map((s) => s.text.toLowerCase()));
  o.passages.sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  o.sayings = sayings(o.passages, o.yours.map((y) => y.text)).map((s) => ({ ...s, hidden: hidden.has(s.text.toLowerCase()) }));
  o.nicknames = nicknames(o.passages, `${o.name} ${o.short}`);
  o.emoji = topEmoji(o.passages);
  o.usual = usualTime(o.passages);
  o.span = span(o.passages);
  o.wordsVersion = WORDS_VERSION;
  o.updatedAt = Date.now();
}

function rebuildIndex() {
  const o = state.cur;
  state.index = new KeywordIndex(o.passages);
  state.vecList = o.passages.map((p) => o.vecs[p.id] || null);
}

const save = () => db.put(state.cur);

// ---------- building: meaning vectors, then offerings ----------

function buildBar(title, detail, frac) {
  $('buildBar').hidden = false;
  $('buildTitle').textContent = title;
  $('buildDetail').textContent = detail ? ` · ${detail}` : '';
  $('buildFill').style.width = `${Math.round((frac ?? 0) * 100)}%`;
  $('buildFill').parentElement.classList.toggle('indeterminate', frac == null);
}
const hideBuild = () => { $('buildBar').hidden = true; $('buildStop').hidden = true; };

async function continueBuild() {
  if (state.job) return;
  const o = state.cur;
  if (!o?.passages.length) return;
  if (o.passages.some((p) => !o.vecs[p.id])) await embedAll();
  // Once Gemma is on this device, new messages get read for offerings
  // without asking again.
  if (state.cur === o && store.get('llmDownloaded', false) && o.gemma && unaskedJobs(o).length) await findOfferings();
}

async function embedAll() {
  const o = state.cur;
  const todo = o.passages.filter((p) => !o.vecs[p.id]);
  if (!todo.length) return;
  state.job = { kind: 'embed', stop: false };
  buildBar('Reading their words', state.core === 'ready' ? `0 of ${todo.length}` : 'loading the search model (34 MB, once)', state.core === 'ready' ? 0 : null);
  try {
    await ensureCore();
    const B = 16;
    for (let i = 0; i < todo.length; i += B) {
      if (state.job.stop || state.cur !== o) break;
      const batch = todo.slice(i, i + B);
      const vecs = await call('embed', { texts: batch.map((p) => p.text.slice(0, 600)) });
      batch.forEach((p, j) => { o.vecs[p.id] = vecs[j]; });
      buildBar('Reading their words', `${Math.min(i + B, todo.length)} of ${todo.length}`, Math.min(1, (i + B) / todo.length));
      if ((i / B) % 20 === 19) await db.put(o);
    }
    await db.put(o);
  } catch (err) {
    console.error(err);
  } finally {
    state.job = null;
    hideBuild();
    if (state.cur === o) rebuildIndex();
  }
}

async function protoVecs() {
  if (state.protoVecs) return state.protoVecs;
  const flat = CATEGORIES.flatMap((c) => c.protos.map((p) => ({ c: c.id, p })));
  const vecs = await call('embed', { texts: flat.map((x) => x.p) });
  const out = {};
  flat.forEach((x, i) => (out[x.c] ??= []).push(vecs[i]));
  return (state.protoVecs = out);
}

function unaskedJobs(o) {
  if (!state.protoVecs) return o.passages.some((p) => !o.asked.includes(`*:${p.id}`)) ? [true] : [];
  const asked = new Set(o.asked);
  return candidates(o.passages, o.passages.map((p) => o.vecs[p.id] || null), state.protoVecs).filter((j) => !asked.has(`${j.cat}:${o.passages[j.i].id}`));
}

async function findOfferings() {
  const o = state.cur;
  if (state.job || !o.passages.length) return;
  state.job = { kind: 'offerings', stop: false };
  $('buildStop').hidden = false;
  renderArrange();
  try {
    if (o.passages.some((p) => !o.vecs[p.id])) { state.job = null; await embedAll(); state.job = { kind: 'offerings', stop: false }; $('buildStop').hidden = false; }
    await ensureCore();
    await protoVecs();
    buildBar(`Waking up ${gemmaLabel()}`, store.get('llmDownloaded', false) ? 'from this device' : `${gemmaSize()}, once`, null);
    await ensureLlm();
    const jobs = unaskedJobs(o);
    const stats = o.gemma || { asked: 0, kept: 0, none: 0, invented: 0, generic: 0, long: 0, model: '' };
    stats.model = state.llmDevice === 'webgpu' ? 'Gemma 3 1B' : 'Gemma 3 270M';
    const t0 = performance.now();
    for (let k = 0; k < jobs.length; k++) {
      if (state.job.stop || state.cur !== o) break;
      const j = jobs[k];
      const p = o.passages[j.i];
      buildBar(`${stats.model} is reading their messages`, `${k + 1} of ${jobs.length} · ${o.offerings.filter((x) => x.auto).length} offerings so far`, k / jobs.length);
      const res = await call('generate', { messages: prompt(j.cat, who(o), p.text), maxTokens: 24, device: state.llmDevice });
      stats.asked++;
      for (const v of verifyAll(res.text, p.text)) {
        const k = v.reason === 'ok' ? 'kept' : v.reason;
        stats[k] = (stats[k] || 0) + 1;
        // Keep a few of the thrown-away answers so you can see what Gemma made up.
        if (v.reason === 'invented' && (stats.thrown ??= []).length < 40) stats.thrown.push({ cat: j.cat, answer: v.answer, text: p.text.slice(0, 160) });
        if (v.name) o.offerings = merge([{ cat: j.cat, name: v.name, passageId: p.id }], o.offerings);
      }
      renderAltar();
      o.asked.push(`${j.cat}:${p.id}`);
      if (k % 8 === 7) await db.put(o);
    }
    stats.seconds = Math.round((stats.seconds || 0) + (performance.now() - t0) / 1000);
    o.gemma = stats;
    o.offerings = backfill(o.offerings, o.passages);
    o.updatedAt = Date.now();
    await db.put(o);
  } catch (err) {
    console.error(err);
    toast(`Gemma couldn't finish: ${err.message}`);
  } finally {
    state.job = null;
    hideBuild();
    if (state.cur === o) { renderAltar(); renderArrange(); }
  }
}

$('buildStop').addEventListener('click', () => { if (state.job) state.job.stop = true; });

// ---------- visit ----------

function renderVisitIntro() {
  const o = state.cur;
  $('listenTitle').textContent = `What did ${who()} say about…`;
  const ex = o.sample ? ['when I failed my exam', 'my grandfather singing', 'where she grew up', 'being scared at work', 'her recipes'] : ['when I was sad', 'cooking', 'growing up', 'my birthday', 'being proud'];
  $('listenEx').innerHTML = ex.map((q) => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('');
  $('visitNote').textContent = o.passages.length
    ? `Shows something ${who()} really wrote, from this day in another year when there is one.`
    : `Gather some of ${who()}'s messages first.`;
  $('lightBtn').disabled = !o.passages.length;
}

function pickVisit() {
  const o = state.cur;
  const ok = o.passages.filter((p) => p.text.length >= 18 && p.text.length <= 320 && /\p{L}{3}/u.test(p.text) && !state.seen.has(p.id));
  if (!ok.length) { state.seen.clear(); return o.passages[0]; }
  const now = new Date();
  const dayOfYear = (d) => Math.floor((Date.UTC(2001, d.getMonth(), d.getDate()) - Date.UTC(2001, 0, 1)) / 864e5);
  const today = dayOfYear(now);
  const dist = (p) => { if (!p.date) return 999; const x = Math.abs(dayOfYear(new Date(p.date)) - today); return Math.min(x, 365 - x); };
  const exact = ok.filter((p) => dist(p) === 0);
  const near = ok.filter((p) => dist(p) <= 3);
  const pool = exact.length ? exact : near.length ? near : ok;
  return pool[Math.floor(Math.random() * pool.length)];
}

function showVisit() {
  const p = pickVisit();
  if (!p) return;
  state.seen.add(p.id);
  const o = state.cur;
  let when = '';
  if (p.date) {
    const d = new Date(p.date);
    const now = new Date();
    const sameDay = d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    const ago = now.getFullYear() - d.getFullYear();
    when = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    if (sameDay && ago > 0) when += ` · on this day, ${ago === 1 ? 'a year' : `${ago} years`} ago`;
  } else {
    when = o.sources.find((s) => s.id === p.sourceId)?.title || '';
  }
  $('visitWhen').textContent = when;
  $('visitReply').hidden = !p.replyTo;
  $('visitReply').textContent = p.replyTo ? `${o.you || 'You'}: ${p.replyTo}` : '';
  $('visitText').textContent = p.text;
  $('visitQuote').hidden = false;
  $('visitQuote').classList.remove('fade-in');
  void $('visitQuote').offsetWidth;
  $('visitQuote').classList.add('fade-in');
}

$('lightBtn').addEventListener('click', () => {
  $('lightBtn').classList.add('lit');
  $('lightLabel').textContent = `A candle for ${who()}`;
  showVisit();
});
$('visitAgain').addEventListener('click', showVisit);

let listenTimer;
$('listenQ').addEventListener('input', () => { clearTimeout(listenTimer); listenTimer = setTimeout(listen, 280); });
$('listenForm').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(listenTimer); listen(); });
$('listenEx').addEventListener('click', (e) => {
  const b = e.target.closest('[data-q]');
  if (!b) return;
  $('listenQ').value = b.dataset.q;
  listen();
});

let listenSeq = 0;
async function listen() {
  const q = $('listenQ').value.trim();
  const seq = ++listenSeq;
  if (!q) { $('listenResults').innerHTML = ''; $('listenMeta').textContent = ''; return; }
  const o = state.cur;
  let qvec = null;
  const haveVecs = state.vecList.some(Boolean);
  if (haveVecs) {
    try { await ensureCore(); [qvec] = await call('embed', { texts: [q] }); } catch { /* keywords only */ }
  }
  if (seq !== listenSeq) return;
  const rows = rank(state.index, state.vecList, q, qvec).filter((r) => r.score > 0.35).slice(0, 8);
  $('listenMeta').textContent = rows.length
    ? `${rows.length === 8 ? 'The 8 closest' : rows.length} of ${o.passages.length} messages, word for word${haveVecs ? '' : ' (matching words only until Marigold finishes reading)'}.`
    : `Nothing ${who()} wrote matches that. Try other words.`;
  $('listenResults').innerHTML = rows.map((r) => quoteHTML(o.passages[r.i])).join('');
}

function quoteHTML(p) {
  const o = state.cur;
  const date = p.date ? new Date(p.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : (o.sources.find((s) => s.id === p.sourceId)?.title || '');
  return `<li class="quote">
    <p class="q-date">${esc(date)}</p>
    ${p.replyTo ? `<p class="q-reply">${esc(o.you || 'You')}: ${esc(p.replyTo)}</p>` : ''}
    <p class="q-text">${esc(p.text)}</p>
  </li>`;
}

// ---------- drawer: the messages behind an offering or saying ----------

function openDrawer(kind, key) {
  const o = state.cur;
  let ids, title, eyebrow, meta;
  if (kind === 'offering') {
    const off = o.offerings.find((x) => x.id === key);
    if (!off) return;
    ids = off.passageIds;
    title = off.name;
    eyebrow = `${CAT_BY_ID[off.cat].icon} ${CAT_BY_ID[off.cat].label}`;
    meta = off.auto
      ? `Found by Gemma and checked word for word: it appears in ${ids.length} of ${who()}'s messages.`
      : 'You added this one.';
  } else {
    const s = o.sayings[key];
    ids = s.passageIds;
    title = `“${s.text}”`;
    eyebrow = 'Something they always said';
    meta = `In ${s.count} different messages. Counted, not generated.`;
  }
  const byId = new Map(o.passages.map((p) => [p.id, p]));
  $('drawerKind').textContent = eyebrow;
  $('drawerTitle').textContent = title;
  $('drawerMeta').textContent = meta;
  $('drawerList').innerHTML = ids.map((id) => byId.get(id)).filter(Boolean).slice(0, 30).map(quoteHTML).join('');
  $('drawer').hidden = false;
  $('drawer').querySelector('.close').focus();
}
$('drawer').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) $('drawer').hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('drawer').hidden) $('drawer').hidden = true; });

// ---------- tabs ----------

function selectTab(name, scroll = false) {
  for (const b of document.querySelectorAll('[role=tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const p of document.querySelectorAll('[role=tabpanel]')) p.hidden = p.id !== `tab-${name}`;
  if (scroll) document.querySelector('.tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[role=tab]');
  if (b) selectTab(b.dataset.tab);
});

// ---------- arrange ----------

function renderArrange() {
  const o = state.cur;
  const g = o.gemma;
  const busy = state.job?.kind === 'offerings';
  $('findOfferings').textContent = busy ? 'Gemma is reading…' : g ? 'Look again for new offerings' : `Find offerings with Gemma (${gemmaSize()}, once)`;
  $('findOfferings').disabled = busy || !o.passages.length;
  $('offeringsInfo').innerHTML = g
    ? `${esc(g.model)} read ${g.asked} likely messages and named ${g.kept + (g.invented || 0)} things. <strong>${g.invented || 0}</strong> of those weren't actually in the message, so Marigold threw them away. Everything left points at something ${esc(who())} really wrote.`
    : `Gemma reads the messages most likely to mention a food, drink, song, place or small love, one at a time, and names it. Marigold keeps a name only if it appears word for word in that message.`;
  const thrown = g?.thrown || [];
  $('thrownBox').hidden = !thrown.length;
  $('thrownSummary').textContent = `What Gemma made up (${thrown.length})`;
  $('thrownList').innerHTML = thrown.map((t) => `<li><strong>${esc(t.answer)}</strong> <small>as ${esc(CAT_BY_ID[t.cat].label.toLowerCase())}</small><span>${esc(t.text)}${t.text.length >= 160 ? '…' : ''}</span></li>`).join('');
  const groups = CATEGORIES.map((c) => {
    const items = o.offerings.filter((x) => x.cat === c.id);
    if (!items.length) return '';
    return `<div class="arr-group"><h3 class="label">${c.icon} ${c.label}</h3>${items.map((x) => `
      <label class="arr-item"><input type="checkbox" data-toggle-off="${x.id}" ${x.hidden ? '' : 'checked'} />
        <span>${esc(x.name)}<small>${x.auto ? `${x.passageIds.length} message${x.passageIds.length === 1 ? '' : 's'}` : 'added by you'}</small></span>
        ${x.auto ? '' : `<button class="icon-btn tiny" type="button" data-del-off="${x.id}" aria-label="Remove ${esc(x.name)}">✕</button>`}
      </label>`).join('')}</div>`;
  }).join('');
  $('offeringList').innerHTML = groups || '';
  $('sayingList').innerHTML = o.sayings.length
    ? o.sayings.map((s, i) => `<label class="arr-item"><input type="checkbox" data-toggle-say="${i}" ${s.hidden ? '' : 'checked'} /><span>“${esc(s.text)}”<small>${s.count} messages</small></span></label>`).join('')
    : `<p class="fine">${o.passages.length < 6 ? 'Add more of their messages to find sayings.' : 'No phrase came up often enough yet.'}</p>`;
  const sel = $('addOffering').elements.cat;
  if (!sel.options.length) sel.innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
}

$('findOfferings').addEventListener('click', () => findOfferings());
$('offeringList').addEventListener('change', async (e) => {
  const id = e.target.dataset.toggleOff;
  const x = state.cur.offerings.find((y) => y.id === id);
  if (!x) return;
  x.hidden = !e.target.checked;
  await save();
  renderAltar();
});
$('offeringList').addEventListener('click', async (e) => {
  const id = e.target.closest('[data-del-off]')?.dataset.delOff;
  if (!id) return;
  state.cur.offerings = state.cur.offerings.filter((y) => y.id !== id);
  await save();
  renderAltar();
  renderArrange();
});
$('sayingList').addEventListener('change', async (e) => {
  const i = e.target.dataset.toggleSay;
  if (i == null) return;
  state.cur.sayings[+i].hidden = !e.target.checked;
  await save();
  renderAltar();
});
$('addOffering').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const name = f.elements.name.value.trim();
  if (!name) return;
  state.cur.offerings.push({ id: uid('o'), cat: f.elements.cat.value, name, passageIds: [], hidden: false, auto: false });
  f.elements.name.value = '';
  await save();
  renderAltar();
  renderArrange();
});
$('editDetails').addEventListener('click', () => openSetup(state.cur));

// ---------- gather ----------

const SOURCE_ICON = { chat: '💬', letter: '✉️', memory: '🕯️' };

function renderGather() {
  const o = state.cur;
  const rows = [
    ...o.sources.map((s) => `<li><span class="src-icon" aria-hidden="true">${SOURCE_ICON[s.type]}</span><span class="src-main"><strong>${esc(s.title)}</strong><small>${s.count} of ${esc(who())}'s ${s.type === 'chat' ? 'messages' : 'passages'}</small></span><button class="icon-btn tiny" type="button" data-del-src="${s.id}" aria-label="Remove ${esc(s.title)}">✕</button></li>`),
    ...o.memories.map((m) => `<li><span class="src-icon" aria-hidden="true">${SOURCE_ICON.memory}</span><span class="src-main"><strong>Your memory</strong><small>${esc(m.text.slice(0, 110))}${m.text.length > 110 ? '…' : ''}</small></span><button class="icon-btn tiny" type="button" data-del-mem="${m.id}" aria-label="Remove this memory">✕</button></li>`),
  ];
  $('sources').innerHTML = rows.join('') || `<li class="empty">Nothing yet. Start with a chat export or a letter.</li>`;
  $('gatherBadge').hidden = !!o.passages.length;
  $('gatherBadge').textContent = 'start here';
}

$('chatFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const text = await f.text();
  if (!looksLikeChat(text)) {
    toast("That doesn't look like a WhatsApp chat export. For anything else, use “Paste a letter or note”.");
    return;
  }
  const { messages, senders } = parseChat(text, navigator.language);
  const theirName = await pickSender(senders);
  if (!theirName) return;
  const o = state.cur;
  const n = addChat(o, messages, theirName, `Chat with ${theirName}`);
  await afterGather(`${n} of ${theirName}'s messages added.`);
});

function pickSender(senders) {
  const o = state.cur;
  const guess = senders.find((s) => [o.name, o.short].some((n) => n && s.name.toLowerCase().includes(n.toLowerCase().split(' ')[0]))) || senders.find((s) => o.you && !s.name.toLowerCase().includes(o.you.toLowerCase())) || senders[0];
  $('senderName').textContent = who();
  $('senderOpts').innerHTML = senders.slice(0, 12).map((s) => `<label class="radio"><input type="radio" name="sender" value="${esc(s.name)}" ${s === guess ? 'checked' : ''} /><span><strong>${esc(s.name)}</strong><small>${s.count} messages</small></span></label>`).join('');
  const dlg = $('senderDlg');
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue === 'ok' ? dlg.querySelector('input[name=sender]:checked')?.value : null);
    }, { once: true });
  });
}

function askText({ title, label, letter }) {
  $('textTitle').textContent = title;
  $('textLabel').textContent = label;
  $('textTitleField').hidden = !letter;
  $('textDateField').hidden = !letter;
  $('textName').value = '';
  $('textDate').value = '';
  $('textBody').value = '';
  const dlg = $('textDlg');
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => {
      const body = $('textBody').value.trim();
      resolve(dlg.returnValue === 'ok' && body ? { body, name: $('textName').value.trim(), date: $('textDate').value } : null);
    }, { once: true });
  });
}

$('addLetter').addEventListener('click', async () => {
  const r = await askText({ title: `Something ${who()} wrote`, label: 'Their words, typed or pasted', letter: true });
  if (!r) return;
  const n = addLetter(state.cur, r.body, r.date || null, r.name || 'A letter');
  await afterGather(`Added, in ${n} passage${n === 1 ? '' : 's'}.`);
});

$('addMemory').addEventListener('click', async () => {
  const r = await askText({ title: 'A memory of your own', label: `What do you remember about ${who()}?`, letter: false });
  if (!r) return;
  state.cur.memories.push({ id: uid('m'), text: r.body });
  await save();
  renderGather();
  toast('Memory kept. Gemma will use it for your remembrance.');
});

$('sources').addEventListener('click', async (e) => {
  const o = state.cur;
  const src = e.target.closest('[data-del-src]')?.dataset.delSrc;
  const mem = e.target.closest('[data-del-mem]')?.dataset.delMem;
  if (mem) {
    o.memories = o.memories.filter((m) => m.id !== mem);
    await save();
    return renderGather();
  }
  if (!src || state.job) return;
  const s = o.sources.find((x) => x.id === src);
  if (!confirm(`Remove “${s.title}” and its ${s.count} passages from the altar?`)) return;
  const gone = new Set(o.passages.filter((p) => p.sourceId === src).map((p) => p.id));
  o.sources = o.sources.filter((x) => x.id !== src);
  o.passages = o.passages.filter((p) => !gone.has(p.id));
  o.yours = o.yours.filter((y) => y.sourceId !== src);
  for (const id of gone) delete o.vecs[id];
  o.asked = o.asked.filter((a) => !gone.has(a.split(':')[1]));
  for (const x of o.offerings) x.passageIds = x.passageIds.filter((id) => !gone.has(id));
  o.offerings = o.offerings.filter((x) => !x.auto || x.passageIds.length);
  analyzeWords(o);
  await save();
  rebuildIndex();
  renderAll();
});

async function afterGather(msg) {
  const o = state.cur;
  analyzeWords(o);
  await save();
  rebuildIndex();
  renderAll();
  toast(msg);
  continueBuild();
}

// ---------- remembrance ----------

function renderDraftInfo() {
  const o = state.cur;
  const busy = state.job?.kind === 'draft';
  $('draftBtn').disabled = !!state.job;
  $('draftBtn').textContent = busy ? 'Writing…' : o.remembrance ? 'Draft a new version' : 'Draft it with Gemma';
  $('draftStop').hidden = !busy;
  $('draftInfo').textContent = !o.memories.length && !busy ? 'Tip: add a memory of your own in Gather first; the draft is only as good as what it knows.' : '';
}

let saveTimer;
$('remembrance').addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { state.cur.remembrance = $('remembrance').value; save(); }, 500);
});

function remembrancePrompt(o) {
  const facts = [];
  if (o.relation) facts.push(`${who(o)} was ${o.relation}.`);
  if (o.born || o.died) facts.push(`Years: ${years(o)}.`);
  const nick = o.nicknames[0]?.text;
  if (nick) facts.push(`${who(o)} called me "${nick}".`);
  const says = o.sayings.filter((s) => !s.hidden).slice(0, 5).map((s) => `"${s.text}"`);
  if (says.length) facts.push(`Things ${who(o)} always said: ${says.join(', ')}.`);
  const loves = o.offerings.filter((x) => !x.hidden).slice(0, 10).map((x) => x.name);
  if (loves.length) facts.push(`Things ${who(o)} loved: ${loves.join(', ')}.`);
  for (const m of o.memories) facts.push(`My memory: ${m.text}`);
  const me = o.you || 'the writer';
  return [{
    role: 'user',
    content: `Help me write a short remembrance of ${who(o)} for their ofrenda on Día de los Muertos. Write it in first person, as me (${me}), speaking about ${who(o)}. About 130 words, warm and plain, no title, no greeting. Use only these facts and do not invent any events, places or details:\n\n${facts.map((f) => `- ${f}`).join('\n')}`,
  }];
}

$('draftBtn').addEventListener('click', async () => {
  const o = state.cur;
  if (state.job) return;
  if (o.remembrance && !confirm('Replace what you have written with a new draft?')) return;
  state.job = { kind: 'draft', stop: false };
  renderDraftInfo();
  const box = $('remembrance');
  try {
    buildBar(`Waking up ${gemmaLabel()}`, store.get('llmDownloaded', false) ? 'from this device' : `${gemmaSize()}, once`, null);
    await ensureLlm();
    hideBuild();
    box.value = '';
    await call('generate', { messages: remembrancePrompt(o), maxTokens: 260, device: state.llmDevice, stream: true }, (chunk) => { box.value += chunk; });
    o.remembrance = box.value.trim();
    box.value = o.remembrance;
    await save();
  } catch (err) {
    toast(`Gemma couldn't write a draft: ${err.message}`);
  } finally {
    state.job = null;
    hideBuild();
    renderDraftInfo();
  }
});
$('draftStop').addEventListener('click', () => stopGeneration());

// ---------- keep ----------

$('printBtn').addEventListener('click', () => {
  let pr = $('printRemembrance');
  if (!pr) {
    pr = document.createElement('div');
    pr.id = 'printRemembrance';
    pr.className = 'print-only';
    $('altar').after(pr);
  }
  const t = state.cur.remembrance?.trim();
  pr.innerHTML = t ? t.split(/\n\s*\n/).map((p) => `<p>${esc(p)}</p>`).join('') + (state.cur.you ? `<p class="sig">— ${esc(state.cur.you)}</p>` : '') : '';
  window.print();
});

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const fileName = (o, ext) => `ofrenda-${(o.short || o.name).toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')}.${ext}`;

async function toJSON(o) {
  const photo = o.photo ? await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(o.photo); }) : null;
  const { vecs, ...rest } = o;
  return { app: 'marigold', version: 1, ...rest, photo };
}

function fromJSON(j) {
  if (j.app !== 'marigold' || !j.name || !Array.isArray(j.passages)) throw new Error('not a Marigold file');
  const o = { ...blank({ name: j.name }), ...j, vecs: {} };
  delete o.app; delete o.version;
  if (typeof j.photo === 'string' && j.photo.startsWith('data:image/')) {
    const [head, b64] = j.photo.split(',');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    o.photo = new Blob([bytes], { type: head.slice(5).split(';')[0] });
  } else {
    o.photo = null;
  }
  o.updatedAt = Date.now();
  return o;
}

$('exportBtn').addEventListener('click', async () => {
  const o = state.cur;
  download(fileName(o, 'json'), new Blob([JSON.stringify(await toJSON(o))], { type: 'application/json' }));
});

$('mdBtn').addEventListener('click', () => {
  const o = state.cur;
  const lines = [`# ${o.short || o.name}`, ''];
  if (o.short && o.short !== o.name) lines.push(o.name);
  if (years(o)) lines.push(years(o));
  lines.push('');
  if (o.nicknames[0]) lines.push(`${who(o)} called me *${o.nicknames[0].text}*.`, '');
  const says = o.sayings.filter((s) => !s.hidden);
  if (says.length) lines.push('## What they always said', '', ...says.map((s) => `- “${s.text}” (${s.count} times)`), '');
  const offs = o.offerings.filter((x) => !x.hidden);
  if (offs.length) {
    lines.push('## Offerings', '');
    for (const c of CATEGORIES) {
      const items = offs.filter((x) => x.cat === c.id);
      if (items.length) lines.push(`**${c.label}:** ${items.map((x) => x.name).join(', ')}`, '');
    }
  }
  if (o.remembrance) lines.push('## Remembrance', '', o.remembrance, '');
  download(fileName(o, 'md'), new Blob([lines.join('\n')], { type: 'text/markdown' }));
});

$('deleteBtn').addEventListener('click', async () => {
  const o = state.cur;
  if (!confirm(`Delete the ofrenda for ${o.short || o.name} from this device? This can't be undone unless you saved a copy.`)) return;
  await db.remove(o.id);
  state.cur = null;
  location.hash = '';
});

// ---------- settings ----------

$('settingsBtn').addEventListener('click', () => { renderModels(); $('settings').showModal(); });
$('statusPill').addEventListener('click', () => { renderModels(); $('settings').showModal(); });
$('clearModels').addEventListener('click', async () => {
  if (!confirm('Delete the downloaded models? Your ofrendas stay. Models download again next time they are needed.')) return;
  await call('clear-models');
  store.set('llmDownloaded', false);
  restartWorker();
  state.core = 'idle';
  state.llm = 'idle';
  renderStatus();
  toast('Models deleted.');
});

// ---------- toast ----------

let toastTimer;
function toast(text, action) {
  $('toastText').textContent = text;
  const btn = $('toastAction');
  btn.hidden = !action;
  if (action) { btn.textContent = action.label; btn.onclick = () => { $('toast').hidden = true; action.fn(); }; }
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, action ? 8000 : 5000);
}

// ---------- start ----------

startWorker();
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js').catch(() => {});
navigator.storage?.persist?.().catch(() => {});
route();
