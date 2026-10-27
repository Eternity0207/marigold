// Everything here is counting, not AI: it turns raw messages into passages,
// and finds the things a person said again and again (their sayings, what
// they called you, their emoji, the hour they usually wrote). No model can
// make these up, because every one is a tally of their real words.

const STOP = new Set(`a an and are as at be been but by can could did do does doing done for from get got had has have he her him his how i if in into is it its just me my no not of oh ok okay on or our out so some than that the their them then there they this to too up us was we were what when where which who why will with would yes you your yours im i'm it's that's don't
y o a e el la los las un una unos unas de del al en con por para que qué es son se lo le les mi mis tu tus su sus me te nos ya muy más mas pero como si sí no ni hay está esta este eso esa ese`.split(/\s+/));

// Words that can't open or close a saying ("of the ..." or "... and").
const GLUE = new Set('a an and as at but by for from in into of on or so than that the to with y o de del al en con por para que el la los las un una'.split(' '));

const POSSESSIVE = new Set('my your his her our their its mi tu su mis tus sus nuestro nuestra'.split(' '));

// Never a nickname, even when it sits next to a comma.
const NOT_NAMES = new Set('yes no ok okay well thanks thank sorry hello hi hey yeah lol haha jaja ah ay oh bueno pues gracias sí si hola claro ya bye good morning night today tomorrow anyway also because'.split(' '));

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu;
export const words = (s) => (s.toLowerCase().match(WORD) || []).map((w) => w.replace('’', "'"));
const fold = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

let nextId = 0;
const pid = () => `p${Date.now().toString(36)}${(nextId++).toString(36)}`;

// One chat export -> their passages (consecutive messages within a few
// minutes merged, each with the message it answered) and your messages.
export function chatPassages(messages, theirName, sourceId) {
  const out = [];
  const yours = [];
  let lastOther = null;
  for (const m of messages) {
    if (m.sender !== theirName) {
      lastOther = m;
      yours.push(m.text);
      continue;
    }
    const prev = out[out.length - 1];
    const close = prev && prev.sourceId === sourceId && prev._last && m.date && minutes(prev._last, m.date) <= 4 && prev._after === lastOther;
    if (close && prev.text.length < 600) {
      prev.text += '\n' + m.text;
      prev._last = m.date;
      continue;
    }
    const replyTo = lastOther && m.date && lastOther.date && minutes(lastOther.date, m.date) <= 360 ? trim(lastOther.text, 160) : '';
    out.push({ id: pid(), sourceId, text: m.text, date: m.date, replyTo, _last: m.date, _after: lastOther });
  }
  for (const p of out) { delete p._last; delete p._after; }
  return { passages: out, yours };
}

// A letter, email or note -> paragraph-sized passages.
export function letterPassages(text, date, sourceId) {
  const paras = text.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const out = [];
  for (const para of paras) {
    for (const chunk of chunkSentences(para, 420)) out.push({ id: pid(), sourceId, text: chunk, date: date || null, replyTo: '' });
  }
  return out;
}

function chunkSentences(text, max) {
  if (text.length <= max) return [text];
  const sents = text.match(/[^.!?…]+[.!?…]+["'”’)]*\s*|[^.!?…]+$/g) || [text];
  const out = [];
  let cur = '';
  for (const s of sents) {
    if (cur && (cur + s).length > max) { out.push(cur.trim()); cur = ''; }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const minutes = (a, b) => Math.abs(new Date(b) - new Date(a)) / 60000;
const trim = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

// ---------- Sayings ----------

// Phrases of 2-6 words they used in many different messages, and much more
// often than you did (so "good morning" only counts if it was theirs).
export function sayings(passages, yours = [], limit = 8) {
  const N = passages.length;
  if (N < 6) return [];
  const minCount = Math.max(3, Math.round(Math.sqrt(N) / 4));
  const theirs = countGrams(passages.map((p) => p.text));
  const mine = yours.length ? countGrams(yours) : null;
  const cands = [];
  for (const [gram, rec] of theirs) {
    if (rec.n < minCount) continue;
    const toks = gram.split(' ');
    if (GLUE.has(toks[0]) || GLUE.has(toks[toks.length - 1])) continue;
    // "your abuelo", "my roses": a thing they mentioned, not a saying.
    if (toks.length === 2 && POSSESSIVE.has(toks[0])) continue;
    if (!toks.some((t) => !STOP.has(t) && t.length >= 3)) continue;
    if (mine) {
      const theirRate = rec.n / N;
      const myRate = ((mine.get(gram)?.n || 0) + 0.5) / yours.length;
      if (theirRate < 2 * myRate) continue;
    }
    // Sayings open a sentence ("Everything passes."); filler like "this year"
    // sits in the middle of one, so phrases that start sentences rank higher.
    const opens = rec.starts / rec.n;
    cands.push({ gram, toks, count: rec.n, ids: rec.ids, score: rec.n * (1 + 0.6 * (toks.length - 2)) * (0.35 + opens) });
  }
  cands.sort((a, b) => b.score - a.score || b.toks.length - a.toks.length);
  const kept = [];
  for (const c of cands) {
    if (kept.some((k) => overlaps(k.toks, c.toks))) continue;
    kept.push(c);
    if (kept.length >= limit) break;
  }
  return kept.map((k) => ({
    text: display(k.toks, passages[k.ids[0]].text),
    count: k.count,
    passageIds: k.ids.slice(0, 40).map((i) => passages[i].id),
  }));
}

function countGrams(texts) {
  const map = new Map();
  texts.forEach((t, i) => {
    const seen = new Map(); // gram -> did it open a sentence here?
    for (const line of t.split(/[\n.!?…;,]+/)) {
      const w = words(line);
      for (let n = 2; n <= 6; n++) {
        for (let s = 0; s + n <= w.length; s++) {
          const g = w.slice(s, s + n).join(' ');
          seen.set(g, seen.get(g) || s === 0);
        }
      }
    }
    for (const [g, start] of seen) {
      let r = map.get(g);
      if (!r) map.set(g, (r = { n: 0, starts: 0, ids: [] }));
      r.n++;
      if (start) r.starts++;
      r.ids.push(i);
    }
  });
  return map;
}

// Two phrases are the same saying when one mostly contains the other.
function overlaps(a, b) {
  const short = a.length <= b.length ? a : b;
  const long = short === a ? b : a;
  let best = 0;
  for (let i = 0; i < short.length; i++) {
    for (let j = 0; j < long.length; j++) {
      let k = 0;
      while (i + k < short.length && j + k < long.length && short[i + k] === long[j + k]) k++;
      best = Math.max(best, k);
    }
  }
  return best >= 2 && best >= Math.ceil((short.length * 2) / 3);
}

// Show the phrase the way they actually typed it.
function display(toks, source) {
  const re = new RegExp(toks.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace("'", "['’]")).join('[^\\p{L}\\p{N}]+'), 'iu');
  const m = source.match(re);
  return m ? m[0] : toks.join(' ');
}

// ---------- What they called you ----------

// The words people say right before they call you something.
const ADDRESS = /\b(ay|oh|hola|hi|hey|hello|bye|buenos días|buenas noches|good morning|good night|thank you|thanks|gracias|love you|te quiero|te amo|bendiga|bless you|birthday|cumpleaños|navidad|christmas|pascua|easter|proud of you|miss you|that is|that's|you are|eres|good)\s*$/iu;

export function nicknames(passages, theirName = '', limit = 3) {
  const own = new Set(words(theirName));
  const counts = new Map();
  const add = (w) => {
    const k = w.toLowerCase();
    const bare = k.replace(/^(mi|my)\s+/, '');
    if (bare.length < 2 || bare.length > 16 || STOP.has(bare) || NOT_NAMES.has(bare) || own.has(bare)) return;
    counts.set(k, (counts.get(k) || 0) + 1);
  };
  for (const p of passages) {
    for (const line of p.text.split(/\n|[.!?…]+/)) {
      const l = line.replace(/[\s\p{Extended_Pictographic}️‍"'”’)]+$/u, '').trim();
      if (!l) continue;
      // "Mijo, ..." / "Ay mijo, ..." / "Hi sweetheart! ..."
      const start = l.match(/^(?:(?:ay|oh|hola|hi|hey|hello|buenos días|good morning|good night)[\s,!]+)?((?:mi |my )?\p{L}+)\s*,/iu);
      if (start) add(start[1]);
      // "..., mija" / "Buenos días mijo" / "Dios te bendiga mijo" / "Ay mijo"
      const end = l.match(/(,\s*|\s)((?:mi |my )?\p{L}+)$/iu);
      if (end && (end[1].startsWith(',') || ADDRESS.test(l.slice(0, end.index)))) add(end[2]);
    }
  }
  return [...counts].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([text, count]) => ({ text, count }));
}

// ---------- Small portraits ----------

export function topEmoji(passages, limit = 5) {
  const counts = new Map();
  for (const p of passages) {
    for (const e of p.text.match(/\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu) || []) {
      const k = e.replace(/️/g, '');
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([text, count]) => ({ text, count }));
}

const DAYPARTS = [
  { from: 5, to: 8, label: 'early in the morning' },
  { from: 8, to: 12, label: 'in the morning' },
  { from: 12, to: 17, label: 'in the afternoon' },
  { from: 17, to: 21, label: 'in the evening' },
  { from: 21, to: 29, label: 'late at night' },
];

export function usualTime(passages) {
  const dated = passages.filter((p) => p.date);
  if (dated.length < 10) return null;
  const tally = DAYPARTS.map(() => 0);
  for (const p of dated) {
    let h = new Date(p.date).getHours();
    if (h < 5) h += 24;
    tally[DAYPARTS.findIndex((d) => h >= d.from && h < d.to)]++;
  }
  const best = tally.indexOf(Math.max(...tally));
  return { label: DAYPARTS[best].label, share: tally[best] / dated.length };
}

export function span(passages) {
  const ds = passages.map((p) => p.date).filter(Boolean).sort();
  return ds.length ? { first: ds[0], last: ds[ds.length - 1] } : null;
}

// Accent- and case-insensitive "does this phrase appear in this text?"
export function contains(text, phrase) {
  const t = ` ${fold(text).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  const p = fold(phrase).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return !!p && t.includes(` ${p} `);
}

export { fold };
