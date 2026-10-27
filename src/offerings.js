// Offerings for the altar: the foods, drinks, songs, places and small loves
// that show up in their messages. Three steps, and only the middle one is a
// language model:
//   1. Meaning search (gte-small) picks the few messages most likely to
//      mention each kind of thing, so Gemma reads dozens of messages, not
//      thousands.
//   2. Gemma reads one message at a time and names the thing, or says NONE.
//   3. The name must appear, word for word, in that message. Anything Gemma
//      made up is thrown away, so every offering points at a real message.

import { contains, fold } from './words.js';
import { dot, zscores } from './search.js';

export const CATEGORIES = [
  {
    id: 'food', label: 'Food', icon: '🍲', ask: 'a food or dish',
    protos: ['I am cooking tamales for dinner', 'my recipe for mole, you need chiles and chocolate', 'come over, I made your favorite soup', 'I baked bread this morning', 'eat something, there are enchiladas in the fridge'],
  },
  {
    id: 'drink', label: 'Drink', icon: '☕', ask: 'a drink',
    protos: ['I made a pot of coffee with cinnamon', 'a cup of hot chocolate before bed', 'drink some tea for your throat', 'we had a cold beer on the porch', 'I brought you a glass of horchata'],
  },
  {
    id: 'music', label: 'Music', icon: '🎵', ask: 'a song, singer or band',
    protos: ['they played my favorite song on the radio', 'I was singing that old song all day', 'listen to this singer, he had such a voice', 'we danced to that band at the wedding', 'put on the record I like'],
  },
  {
    id: 'place', label: 'Places', icon: '📍', ask: 'a place, town or city',
    protos: ['I miss my hometown so much', 'we went to the beach that summer', 'the church in the village where I grew up', 'we should visit the market downtown', 'when I lived in that city by the sea'],
  },
  {
    id: 'love', label: 'Loves', icon: '🌼', ask: 'a flower, plant, pastime or treasured thing',
    protos: ['my roses are blooming in the garden', 'I spent the afternoon knitting a scarf', 'watching my telenovela tonight', 'I planted marigolds and tomatoes', 'playing cards with my friends on Sundays'],
  },
];
export const CAT_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// Words that name a kind of thing rather than the thing itself.
// Times and people aren't offerings either ("summer" is not a place).
const GENERIC = new Set(`food dish meal dinner lunch breakfast supper snack something nothing none everything thing stuff drink drinks song songs music singer band radio record place town city home house garden flower flowers plant plants pastime hobby favorite favourite it this that them one some
today tonight tomorrow yesterday morning afternoon evening night day week weekend month year summer winter spring fall autumn sunday monday tuesday wednesday thursday friday saturday christmas easter birthday holiday
family mother father mom dad abuelo abuela grandma grandpa children kids friends everybody
comida cena almuerzo desayuno cosa algo nada bebida canción musica música lugar casa pueblo ciudad jardín flor flores hoy mañana noche día verano invierno navidad familia`.split(/\s+/));

const PER_CATEGORY = 18;
const MIN_Z = 0.9;

// passages: their passages; vecs: matching gte vectors; protoVecs: { catId: [vec, ...] }
export function candidates(passages, vecs, protoVecs, perCat = PER_CATEGORY) {
  const jobs = [];
  for (const cat of CATEGORIES) {
    const raw = vecs.map((v) => (v ? Math.max(...protoVecs[cat.id].map((p) => dot(v, p))) : null));
    const z = zscores(raw);
    const top = raw
      .map((r, i) => ({ i, z: z[i], r }))
      .filter((x) => x.r !== null && x.z >= MIN_Z && passages[x.i].text.length >= 12)
      .sort((a, b) => b.z - a.z)
      .slice(0, perCat);
    for (const t of top) jobs.push({ cat: cat.id, i: t.i, z: t.z });
  }
  return jobs;
}

export function prompt(cat, name, text) {
  const c = CAT_BY_ID[cat];
  return [{
    role: 'user',
    content: `Here is a message written by ${name}:\n\n"""${text.slice(0, 700)}"""\n\nDoes this message name ${c.ask} that ${name} likes, makes, wants or talks about fondly? If yes, reply with only the name, copied exactly from the message (1 to 5 words). If it names more than one, separate them with commas. If not, reply NONE.`,
  }];
}

// Gemma's answer -> each name in it, checked against the message.
export function verifyAll(answer, text) {
  const line = (answer || '').split('\n')[0];
  const parts = line.split(/\s*(?:,|;|\band\b)\s*/i).filter((p) => p.trim()).slice(0, 4);
  return (parts.length ? parts : ['']).map((p) => ({ answer: p.trim(), ...verify(p, text) }));
}

// One name from Gemma -> the name as it really is in the message, or null.
export function verify(answer, text) {
  let a = (answer || '').split('\n')[0].trim();
  a = a.replace(/^(answer|name|yes)\s*[:,-]\s*/i, '').replace(/^["'“”‘’*`]+|["'“”‘’*`.!,;:]+$/g, '').trim();
  if (!a || /^none\b/i.test(a) || /^no\b/i.test(a)) return { name: null, reason: 'none' };
  if (a.split(/\s+/).length > 6) return { name: null, reason: 'long' };
  const bare = fold(a).replace(/^(a|an|the|el|la|los|las|un|una|my|mi|some|her|his|your)\s+/, '');
  if (!bare || GENERIC.has(bare) || bare.split(/\s+/).every((w) => GENERIC.has(w))) return { name: null, reason: 'generic' };
  // "Marigold" for "marigolds" is the same thing; "Star Trek" in a message
  // about the stars is not.
  const form = [bare, `${bare}s`, `${bare}es`, bare.replace(/e?s$/, '')].find((f) => f.length >= 3 && contains(text, f));
  if (!form) return { name: null, reason: 'invented' };
  // Keep the casing from the message itself.
  const re = new RegExp(form.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^\\p{L}\\p{N}]+'), 'iu');
  const folded = fold(text);
  const m = folded.match(re);
  const slice = m ? text.slice(m.index, m.index + m[0].length) : '';
  const name = m && fold(slice) === m[0] ? slice : a;
  return { name, reason: 'ok' };
}

const key = (s) => fold(s).replace(/[^\p{L}\p{N} ]+/gu, '').replace(/\s+/g, ' ').trim().replace(/(es|s)$/, '');

// Verified finds -> offerings, the same thing named in several messages
// counted once, most-mentioned first.
export function merge(finds, existing = []) {
  const byKey = new Map(existing.map((o) => [`${o.cat}:${key(o.name)}`, { ...o, passageIds: [...o.passageIds] }]));
  for (const f of finds) {
    const k = `${f.cat}:${key(f.name)}`;
    let o = byKey.get(k);
    if (!o) byKey.set(k, (o = { id: `o${byKey.size}${Date.now().toString(36)}`, cat: f.cat, name: f.name, passageIds: [], hidden: false, auto: true }));
    if (!o.passageIds.includes(f.passageId)) o.passageIds.push(f.passageId);
  }
  // The same word under two kinds (coffee as food and drink): keep the stronger.
  const out = [...byKey.values()];
  const best = new Map();
  for (const o of out) {
    const k = key(o.name);
    const b = best.get(k);
    if (!b || o.passageIds.length > b.passageIds.length) best.set(k, o);
  }
  return out.filter((o) => best.get(key(o.name)) === o || !o.auto).sort((a, b) => b.passageIds.length - a.passageIds.length);
}

// Everything the same message also mentions: if "pan de muerto" is found,
// other messages that say "pan de muerto" back it up without asking Gemma.
export function backfill(offerings, passages) {
  for (const o of offerings) {
    if (!o.auto) continue;
    for (const p of passages) {
      if (o.passageIds.length >= 30) break;
      if (!o.passageIds.includes(p.id) && contains(p.text, o.name)) o.passageIds.push(p.id);
    }
  }
  return offerings.sort((a, b) => b.passageIds.length - a.passageIds.length);
}
