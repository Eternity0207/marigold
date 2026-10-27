// Checks the parts that need no model: the chat parser, sayings, nicknames,
// and the rule that throws away any offering Gemma made up.
// Run with: npm test
import assert from 'node:assert/strict';
import { parseChat, looksLikeChat } from '../src/chat.js';
import { chatPassages, letterPassages, sayings, nicknames, topEmoji, usualTime, contains } from '../src/words.js';
import { verify, merge } from '../src/offerings.js';
import { CHAT, LETTER, PERSON } from '../src/sample.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`ok  ${name}`); };

test('sample looks like a chat', () => assert.ok(looksLikeChat(CHAT)));

const { messages, senders } = parseChat(CHAT);
test('parses senders and skips system lines', () => {
  assert.deepEqual(senders.map((s) => s.name), ['Abuela Rosa', 'Leo']);
  assert.ok(!messages.some((m) => /omitted|encrypted/.test(m.text)));
  assert.equal(new Date(messages[0].date).getMonth(), 0);
});

test('iPhone format, 12-hour clock, month-first', () => {
  const ios = `[3/14/24, 9:05:11 PM] Mom: hi honey\n[3/14/24, 9:06:02 PM] Me: hi!\n[3/15/24, 7:00:00 AM] Mom: did you sleep\nwell?`;
  const r = parseChat(ios);
  assert.equal(r.messages.length, 3);
  assert.equal(r.messages[2].text, 'did you sleep\nwell?');
  const d = new Date(r.messages[0].date);
  assert.equal(d.getHours(), 21);
  assert.equal(d.getMonth(), 2);
});

const { passages, yours } = chatPassages(messages, 'Abuela Rosa', 's1');
const all = [...passages, ...letterPassages(LETTER.text, LETTER.date, 's2')];

test('merges messages sent in a row and keeps what they answered', () => {
  const exam = passages.find((p) => p.text.includes('One exam is not your life'));
  assert.ok(exam.text.includes('Everything passes'));
  assert.match(exam.replyTo, /failed my chemistry exam/);
});

test('finds her sayings, not his', () => {
  const s = sayings(all, yours).map((x) => x.text.toLowerCase());
  console.log('    sayings:', s.join(' | '));
  for (const want of ['dios te bendiga', 'ponte un suéter', 'did you eat', 'everything passes']) {
    assert.ok(s.some((x) => x.includes(want)), `missing "${want}"`);
  }
});

test('finds what she called him', () => {
  const n = nicknames(all, PERSON.short);
  console.log('    nicknames:', n.map((x) => `${x.text}×${x.count}`).join(', '));
  assert.equal(n[0].text, 'mijo');
});

test('emoji and hours', () => {
  console.log('    emoji:', topEmoji(all).map((e) => e.text).join(' '), '| usually', usualTime(passages).label);
  assert.equal(usualTime(passages).label, 'early in the morning');
});

test('contains is accent and case blind', () => {
  assert.ok(contains('I bought the Cempasúchil today', 'cempasuchil'));
  assert.ok(!contains('cafeteria', 'cafe'));
});

test('verify keeps real names and drops invented ones', () => {
  const t = 'I put his cigarettes and his café de olla. He was a terrible man';
  assert.equal(verify('Café de olla', t).name, 'café de olla');
  assert.equal(verify('"cafe de olla."', t).name, 'café de olla');
  assert.equal(verify('hot chocolate', t).reason, 'invented');
  assert.equal(verify('NONE', t).reason, 'none');
  assert.equal(verify('drink', 'a drink').reason, 'generic');
  assert.equal(verify('Marigold', 'I bought marigolds at the mercado').name, 'marigolds');
  assert.equal(verify('Star Trek', 'I love you more than all the stars').reason, 'invented');
  assert.equal(verify('summer', 'we went to the beach that summer').reason, 'generic');
});

test('merge counts the same thing once', () => {
  const o = merge([
    { cat: 'food', name: 'tamales', passageId: 'a' },
    { cat: 'food', name: 'Tamales', passageId: 'b' },
    { cat: 'love', name: 'tamales', passageId: 'c' },
  ]);
  assert.equal(o.length, 1);
  assert.equal(o[0].passageIds.length, 2);
});

console.log(`\n${passed} passed`);
