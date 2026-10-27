// The altar itself: papel picado across the top, then three tiers, as on many
// ofrendas: the person, the offerings, and their words. Candles and a path of
// marigold petals at the foot, to help them find the way.

import { CATEGORIES } from './offerings.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const PAPEL = ['var(--rosa)', 'var(--marigold)', 'var(--turq)', 'var(--sun)', 'var(--violet)', 'var(--leaf)'];

// Cut shapes for each flag, drawn in black inside a mask so they become holes.
const MOTIFS = [
  // flower
  () => `<circle cx="50" cy="46" r="7"/>${[...Array(8)].map((_, i) => `<ellipse cx="50" cy="28" rx="5" ry="10" transform="rotate(${i * 45} 50 46)"/>`).join('')}`,
  // heart
  () => '<path d="M50 66C30 52 26 42 30 34c4-8 15-8 20 1 5-9 16-9 20-1 4 8 0 18-20 32Z"/>',
  // sun
  () => `<circle cx="50" cy="46" r="11"/>${[...Array(12)].map((_, i) => `<rect x="48.5" y="20" width="3" height="9" rx="1.5" transform="rotate(${i * 30} 50 46)"/>`).join('')}`,
  // calavera
  () => '<path d="M50 24c-12 0-20 8-20 19 0 6 3 10 7 13v8h26v-8c4-3 7-7 7-13 0-11-8-19-20-19Zm-8 16a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm16 0a5 5 0 1 1 0 10 5 5 0 0 1 0-10ZM50 52l3 5h-6Z" fill-rule="evenodd"/>',
  // star
  () => '<path d="m50 24 6 15 16 1-12 10 4 16-14-9-14 9 4-16-12-10 16-1Z"/>',
];

function flag(i) {
  const id = `pp${i}`;
  const border = [...Array(9)].map((_, k) => `<rect x="${8 + k * 10.5}" y="7" width="4" height="4" transform="rotate(45 ${10 + k * 10.5} 9)"/>`).join('');
  const dots = [[16, 78], [84, 78], [16, 22], [84, 22], [50, 82]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('');
  return `<svg class="flag" viewBox="0 0 100 110" aria-hidden="true" style="--d:${(i % 5) * -0.7}s">
    <defs><mask id="${id}"><rect width="100" height="110" fill="#fff"/><g fill="#000">${border}${MOTIFS[i % MOTIFS.length]()}${dots}</g></mask></defs>
    <path d="M0 0H100V94L92 104 83 94 75 104 67 94 58 104 50 94 42 104 33 94 25 104 17 94 8 104 0 94Z" fill="${PAPEL[i % PAPEL.length]}" mask="url(#${id})"/>
  </svg>`;
}

const monthYear = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

export function altarHTML(o, { photoUrl, who, years, job }) {
  const flags = [...Array(9)].map((_, i) => flag(i)).join('');
  const nick = o.nicknames?.[0];
  const facts = [];
  if (o.passages.length) {
    facts.push(o.span ? `${o.passages.length} messages, ${monthYear(o.span.first)} – ${monthYear(o.span.last)}` : `${o.passages.length} passages`);
    if (o.usual && o.usual.share >= 0.3) facts.push(`usually ${o.usual.label}`);
  }
  const emoji = (o.emoji || []).slice(0, 4).map((e) => e.text).join(' ');

  const portrait = photoUrl
    ? `<img src="${photoUrl}" alt="${esc(o.name)}" />`
    : `<span class="monogram" aria-hidden="true">${esc((who || '?').trim()[0])}</span>`;

  const offerings = o.offerings.filter((x) => !x.hidden);
  const busy = job?.kind === 'offerings';
  let offerHTML;
  if (offerings.length) {
    offerHTML = `<div class="offerings">${CATEGORIES.flatMap((c) => offerings.filter((x) => x.cat === c.id).slice(0, 6).map((x) => `
      <button class="offering cat-${c.id}" type="button" data-offering="${x.id}">
        <span class="off-icon" aria-hidden="true">${c.icon}</span>
        <span class="off-name">${esc(x.name)}</span>
        <span class="off-meta">${x.auto ? `${x.passageIds.length}×` : c.label}</span>
      </button>`)).join('')}</div>`;
  } else if (busy) {
    offerHTML = `<p class="tier-empty">Gemma is reading ${esc(who)}'s messages for the foods, songs and places they loved…</p>`;
  } else if (o.passages.length && !o.gemma) {
    offerHTML = `<div class="tier-empty"><p>What should go on ${esc(who)}'s altar? Gemma can look through their messages for the foods, drinks, songs and places they loved.</p><button class="btn small primary" type="button" data-act="find">Find offerings</button></div>`;
  } else if (!o.passages.length) {
    offerHTML = '<p class="tier-empty">The offerings come from their own messages.</p>';
  } else {
    offerHTML = '<p class="tier-empty">Nothing found yet. Add offerings yourself in Arrange.</p>';
  }

  const says = o.sayings.map((s, i) => ({ s, i })).filter(({ s }) => !s.hidden).slice(0, 6);
  const sayHTML = says.length
    ? `<div class="sayings">${says.map(({ s, i }, k) => `<button class="saying" type="button" data-saying="${i}" style="--tilt:${[-2, 1.5, -1, 2, -1.5, 1][k]}deg"><span class="say-text">${esc(s.text)}</span><span class="say-count">${s.count} times</span></button>`).join('')}</div>`
    : o.passages.length
      ? '<p class="tier-empty">No phrase came up often enough to call it a saying. Add more of their messages.</p>'
      : `<div class="tier-empty"><p>Bring ${esc(who)}'s messages, letters or cards, and the things they said again and again will appear here.</p><button class="btn small primary" type="button" data-act="gather">Gather their words</button></div>`;

  return `
    <div class="papel" aria-hidden="true"><span class="string"></span>${flags}</div>
    <div class="tier t1">
      <div class="portrait">${portrait}</div>
      <div class="who">
        <h1 class="altar-name">${esc(who)}</h1>
        ${o.short && o.short !== o.name ? `<p class="full-name">${esc(o.name)}</p>` : ''}
        ${years ? `<p class="years">${esc(years)}</p>` : ''}
        ${nick ? `<p class="called">${esc(who)} called you <strong>${esc(nick.text)}</strong><span class="n">${nick.count} times</span></p>` : ''}
        ${facts.length ? `<p class="facts">${esc(facts.join(' · '))}${emoji ? ` <span class="emoji">${emoji}</span>` : ''}</p>` : ''}
      </div>
    </div>
    <section class="tier t2" aria-label="Offerings">
      <h2 class="tier-label"><span lang="es">Ofrendas</span> · what they loved</h2>
      ${offerHTML}
    </section>
    <section class="tier t3" aria-label="Sayings">
      <h2 class="tier-label"><span lang="es">Lo que siempre decía</span> · what they always said</h2>
      ${sayHTML}
    </section>
    <div class="floor" aria-hidden="true">
      ${[...Array(5)].map((_, i) => `<span class="candle" style="--h:${[38, 54, 70, 50, 34][i]}px;--d:${i * -0.37}s"><span class="flame"></span></span>`).join('')}
    </div>
    <div class="petals" aria-hidden="true"></div>`;
}
