// Reads the chat exports people actually have: WhatsApp's "Export chat" text
// file, in both its Android and iPhone shapes, with any date order and 12- or
// 24-hour clocks. Anything else (letters, emails, notes) is pasted as plain
// text and handled in words.js.

// Android: 12/03/2021, 21:15 - Rosa: text      iPhone: [12/03/2021, 21:15:03] Rosa: text
const ANDROID = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([ap]\.?\s?m\.?)?\s+[-–]\s+([^:]{1,60}?):\s?(.*)$/i;
const IOS = /^\[(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([ap]\.?\s?m\.?)?\]\s+([^:]{1,60}?):\s?(.*)$/i;
// A line with a timestamp but no "Name:" is a system notice (someone joined,
// the encryption notice, a changed number).
const STAMP = /^\[?\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4},?\s+\d{1,2}[:.]\d{2}/;

const SKIP = [
  /^<?(media|image|video|audio|sticker|gif|document|contact card)\s+omitted>?$/i,
  /^<attached: .*>$/i,
  /^(this message was deleted|you deleted this message|message deleted)$/i,
  /^null$/i,
  /^missed (voice|video) call/i,
  /^(voice|video) call(, .*)?$/i,
  /^<this message was edited>$/i,
  /end-to-end encrypted/i,
];

// Invisible direction marks WhatsApp sprinkles into exports.
const clean = (s) => s.replace(/[‎‏‪-‮⁦-⁩﻿]/g, '').replace(/ | /g, ' ');

export function looksLikeChat(text) {
  const lines = clean(text).split(/\r?\n/).filter(Boolean).slice(0, 40);
  if (!lines.length) return false;
  return lines.filter((l) => ANDROID.test(l) || IOS.test(l)).length >= Math.min(3, lines.length) * 0.6;
}

export function parseChat(raw, locale = 'en-US') {
  const lines = clean(raw).split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    const m = line.match(IOS) || line.match(ANDROID);
    if (m) {
      rows.push({ parts: m.slice(1, 4).map(Number), h: +m[4], min: +m[5], ampm: m[6], sender: m[7].trim(), text: m[8] });
    } else if (STAMP.test(line)) {
      rows.push(null); // system notice: also ends the previous message
    } else if (rows.length && rows[rows.length - 1]) {
      rows[rows.length - 1].text += '\n' + line;
    }
  }
  const order = dateOrder(rows.filter(Boolean).map((r) => r.parts), locale);
  const messages = [];
  for (const r of rows) {
    if (!r) continue;
    const text = r.text.trim();
    if (!text || SKIP.some((re) => re.test(text))) continue;
    messages.push({ sender: r.sender, text, date: toDate(r, order) });
  }
  const counts = new Map();
  for (const m of messages) counts.set(m.sender, (counts.get(m.sender) || 0) + 1);
  const senders = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { messages, senders };
}

// Which field is the day? A value over 12 settles it; a four-digit first
// field means year-first. Otherwise fall back to the reader's locale.
function dateOrder(all, locale) {
  if (all.some((p) => p[0] > 31)) return 'ymd';
  if (all.some((p) => p[0] > 12)) return 'dmy';
  if (all.some((p) => p[1] > 12)) return 'mdy';
  return /^en-(US|PH)|^(fil)/i.test(locale) ? 'mdy' : 'dmy';
}

function toDate(r, order) {
  let [a, b, c] = r.parts;
  let y, mo, d;
  if (order === 'ymd') [y, mo, d] = [a, b, c];
  else if (order === 'mdy') [mo, d, y] = [a, b, c];
  else [d, mo, y] = [a, b, c];
  if (y < 100) y += 2000;
  let h = r.h;
  if (r.ampm) {
    const pm = /p/i.test(r.ampm);
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  const dt = new Date(y, mo - 1, d, h, r.min);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}
