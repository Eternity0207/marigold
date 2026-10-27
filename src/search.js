// "Listen": find what they really said about something. Two signals:
//   - keywords (BM25 over their words and the message they were answering)
//   - meaning (gte-small), so "when I was sad" finds "don't cry, it passes"
// The meaning scores become z-scores across all their passages ("how unusually
// close is this one?"), so the two signals can be added fairly.
// Nothing is generated: every result is a message they actually wrote.

const STOP = new Set('a an and are as at be by did do does for from had has have how i in is it its me my of on or our so that the their them then there these this those to was we were what when where which who why will with you your about say said tell told her his she he y o de la el los las que en un una por para con lo le mi tu su se me te'.split(' '));

export function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokens(s, keepStop = false) {
  return (s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w && (keepStop || !STOP.has(w)))
    .map(stem);
}

export class KeywordIndex {
  // docs: [{ text, replyTo }]. What they were answering counts for half.
  constructor(docs) {
    this.tf = docs.map((d) => {
      const m = new Map();
      for (const t of tokens(d.text)) m.set(t, (m.get(t) || 0) + 1);
      for (const t of tokens(d.replyTo)) m.set(t, (m.get(t) || 0) + 0.5);
      return m;
    });
    this.len = this.tf.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
    this.avg = this.len.reduce((a, b) => a + b, 0) / (docs.length || 1) || 1;
    this.df = new Map();
    for (const m of this.tf) for (const t of m.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
    this.N = docs.length;
  }

  score(q) {
    const qt = [...new Set(tokens(q))];
    const out = new Float32Array(this.N);
    for (const t of qt) {
      const df = this.df.get(t);
      if (!df) continue;
      const idf = Math.log(1 + (this.N - df + 0.5) / (df + 0.5));
      for (let d = 0; d < this.N; d++) {
        const f = this.tf[d].get(t);
        if (!f) continue;
        out[d] += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (this.len[d] / this.avg))));
      }
    }
    return out;
  }
}

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function zscores(arr) {
  const vals = arr.filter((x) => x !== null);
  if (vals.length < 2) return arr.map(() => 0);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
  return arr.map((x) => (x === null ? 0 : (x - mean) / sd));
}

export const WEIGHTS = { kw: 1, sem: 0.8 };

// vecs: one gte vector per passage (or null). qvec: the query's vector.
export function rank(index, vecs, q, qvec, w = WEIGHTS) {
  const kwRaw = index.score(q);
  const kwMax = Math.max(0, ...kwRaw);
  const sem = zscores(vecs.map((v) => (v && qvec ? dot(v, qvec) : null)));
  return vecs
    .map((_, i) => {
      const kw = kwMax > 0 ? kwRaw[i] / kwMax : 0;
      return { i, score: w.kw * kw + w.sem * Math.max(0, sem[i]), kw, sem: sem[i] };
    })
    .sort((a, b) => b.score - a.score);
}
