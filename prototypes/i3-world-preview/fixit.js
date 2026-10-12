/** Pip's Fix-it Workshop (Fix-it Station). Children read clues about a fictional
 * item, then drag the real 3D model to a workshop station (Repair Café, Reuse &
 * Share, E-waste drop-off, Ask an adult) or a kerbside bin (Recycling, Food &
 * garden, Rubbish). Every result shows on the workshop itself: a big ✓ or ✗,
 * a shake, sounds, fireworks, and a bouncing Next button, so nobody has to scroll.
 * Station buttons and number keys do everything dragging does. A first-visit
 * intro teaches the game in three steps, and a learning record shows grown-ups
 * which items needed more tries. The 3D view (fixit-3d.js) loads only here;
 * without WebGL a 2D view remains. */
import { STATIONS, BINS, TARGETS, BIN, CARDS, ROUNDS, STORIES, roundById, cardById, targetById, createRound, currentStory, isRoundDone, drop, starsFor, readSave, writeSave, recordRound, recordHistory, roundSummary, learningRecord } from './fixit-engine.js';
import { productIcon } from './explore.js';
import { createSound } from './fixit-sound.js';
import { createParty } from './fixit-party.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONS = {
  repair: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  reuse: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  ewaste: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
  adult: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="M12 8v5M12 16.5h.01"/>',
  recycle: '<path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-2.7L7.2 9.5M11 19h8.2a1.8 1.8 0 0 0 1.6-2.7l-1.3-2.1"/><path d="m14 16-3 3 3 3M8.3 13.6 7.2 9.5l-4.1 1.1M9.3 5.8l1.1-1.9A1.8 1.8 0 0 1 12 3a1.8 1.8 0 0 1 1.5.9l4 6.8M13.4 9.6l4.1 1.1 1.1-4.1"/>',
  compost: '<path d="M5 20c0-9 6-15 15-15 0 9-6 15-15 15z"/><path d="M5 20c3-4 6-7 10-9"/>',
  bin: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5-2.7L3.2 14a1.5 1.5 0 0 1 2.5-1.7L8 15"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9 5 6m0-6-5 6"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  musicOff: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path d="M3 3l18 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  cross: '<path d="M6 6l12 12M18 6 6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 16.5h.01"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>',
  print: '<path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z"/>',
};
const icon = (name, cls = 'fx-icon') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
const stars = (count, total = 3) => `<span class="fx-stars" role="img" aria-label="${count} of ${total} stars">${Array.from({ length: total }, (_, n) => `<span class="${n < count ? 'on' : ''}" style="--fx-n:${n}" aria-hidden="true">${icon('star', 'fx-star')}</span>`).join('')}</span>`;

// Flat pictures of the everyday things, for the 2D view, the intro and the record.
const ITEM_ART = {
  banana: '<path d="M32 18V9" stroke="#6b7a2a" stroke-width="4" stroke-linecap="round"/><path d="M30 19c-10 4-18 15-20 30 6-6 12-11 19-13z" fill="#f3cf3c" stroke="#16283c" stroke-width="2.5" stroke-linejoin="round"/><path d="M34 19c10 4 18 15 20 30-6-6-12-11-19-13z" fill="#f3cf3c" stroke="#16283c" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 19c-4 8-4 21 0 31 4-10 4-23 0-31z" fill="#f8e27a" stroke="#16283c" stroke-width="2.5"/>',
  can: '<rect x="20" y="13" width="24" height="41" rx="5" fill="#e0463a" stroke="#16283c" stroke-width="2.5"/><rect x="21.3" y="28" width="21.4" height="7" fill="#fff"/><rect x="22" y="8" width="20" height="6" rx="2" fill="#c9d1d6" stroke="#16283c" stroke-width="2.5"/>',
  mug: '<path d="M13 18h31v28a6 6 0 0 1-6 6H19a6 6 0 0 1-6-6z" fill="#f2f0ea" stroke="#16283c" stroke-width="2.5"/><path d="M44 24h4a6 6 0 0 1 0 12h-4" fill="none" stroke="#16283c" stroke-width="2.5"/><path d="M13 30h31" stroke="#3f8fd8" stroke-width="5"/><path d="M30 18l-4 8 6 6-5 8 4 6" fill="none" stroke="#d23b2e" stroke-width="3" stroke-linejoin="round"/>',
  battery: '<rect x="22" y="14" width="20" height="40" rx="4" fill="#23292e" stroke="#16283c" stroke-width="2.5"/><path d="M23.3 18a3 3 0 0 1 3-3h11.4a3 3 0 0 1 3 3v10H23.3z" fill="#d88a2c"/><rect x="28" y="9" width="8" height="5" rx="1.5" fill="#c6cdd1" stroke="#16283c" stroke-width="2"/><path d="M32 36v8M28 40h8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>',
  box: '<path d="M12 25h40v27H12z" fill="#c49a6c" stroke="#16283c" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 25 6 16h18l8 9M52 25l6-9H40l-8 9" fill="#d8b285" stroke="#16283c" stroke-width="2.5" stroke-linejoin="round"/><path d="M28 25.5v12h8v-12" fill="#e9d9b6"/>',
  teddy: '<circle cx="18" cy="15" r="7" fill="#b07a4a" stroke="#16283c" stroke-width="2.5"/><circle cx="46" cy="15" r="7" fill="#b07a4a" stroke="#16283c" stroke-width="2.5"/><circle cx="32" cy="29" r="17" fill="#b07a4a" stroke="#16283c" stroke-width="2.5"/><ellipse cx="32" cy="35" rx="8" ry="6" fill="#e7c79b"/><circle cx="26" cy="26" r="2.2" fill="#16283c"/><circle cx="38" cy="26" r="2.2" fill="#16283c"/><circle cx="32" cy="33" r="2.4" fill="#2a1a12"/><path d="M20 55l4-5 4 5 4-5 4 5 4-5 4 5" fill="none" stroke="#d23b2e" stroke-width="2.5" stroke-linejoin="round"/>',
  cup: '<path d="M16 14h32l-5 40H21z" fill="#f6f3ea" stroke="#16283c" stroke-width="2.5" stroke-linejoin="round"/><path d="M13 14h38" stroke="#16283c" stroke-width="3.5" stroke-linecap="round"/><path d="M19 26h26M20 36h24M21 46h22" stroke="#d8d1c0" stroke-width="2"/>',
  apple: '<path d="M18 13h28c0 6-6 9-6 14 0 4 6 7 6 13H18c0-6 6-9 6-13 0-5-6-8-6-14z" fill="#f3e7c4" stroke="#16283c" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 13h28c-1 3-3 4-5 5H23c-2-1-4-2-5-5zM18 40h28c-.5 6-6 10-14 10s-13.5-4-14-10z" fill="#c8302c" stroke="#16283c" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 13V6" stroke="#5a3a1e" stroke-width="3" stroke-linecap="round"/><path d="M33 8c4-4 9-3 10 0-4 3-8 2-10 0z" fill="#4c9a3a"/><ellipse cx="29" cy="28" rx="2" ry="3" fill="#3b2412"/><ellipse cx="35" cy="28" rx="2" ry="3" fill="#3b2412"/>',
};
const itemIcon = model => ITEM_ART[model] ? `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${ITEM_ART[model]}</svg>` : productIcon(model);
/** A wheelie bin with a coloured lid, for the bin buttons and cards. */
const binArt = lid => `<svg class="fx-bin-art" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M11 14h26l-2.5 26h-21z" fill="#34424c"/><rect x="7.5" y="8.5" width="33" height="6.5" rx="2.5" fill="${lid}" stroke="#16283c" stroke-width="1.5"/><rect x="18" y="21" width="12" height="11" rx="2.5" fill="#fff"/><circle cx="15.5" cy="42.5" r="3.3" fill="#1d2429"/><circle cx="32.5" cy="42.5" r="3.3" fill="#1d2429"/></svg>`;
const placeArt = target => target.kind === 'bin' ? binArt(target.lid) : icon(target.id);

/** Pip the toaster, the guide children know from Quest. Mood changes the face:
 * happy, think, oops (with a worried drop) and cheer (happy eyes, open smile). */
const pip = (mood = 'happy') => `<svg class="fx-pip" data-mood="${mood}" viewBox="0 0 120 112" aria-hidden="true" focusable="false"><rect x="14" y="28" width="92" height="74" rx="24" fill="#CFE6F7" stroke="#16283C" stroke-width="4"/><rect x="32" y="18" width="22" height="14" rx="6" fill="#16283C"/><rect x="66" y="18" width="22" height="14" rx="6" fill="#16283C"/><g class="fx-pip-eyes"><circle cx="45" cy="62" r="6" fill="#16283C"/><circle cx="75" cy="62" r="6" fill="#16283C"/><circle cx="47" cy="60" r="2" fill="#fff"/><circle cx="77" cy="60" r="2" fill="#fff"/></g><g class="fx-pip-joy" fill="none" stroke="#16283C" stroke-width="4.5" stroke-linecap="round"><path d="M38 64q7-10 14 0"/><path d="M68 64q7-10 14 0"/></g><circle cx="34" cy="78" r="6" fill="#F59BB0" opacity=".7"/><circle cx="86" cy="78" r="6" fill="#F59BB0" opacity=".7"/><path class="fx-m fx-m-happy" d="M48 80q12 10 24 0" stroke="#16283C" stroke-width="4" stroke-linecap="round" fill="none"/><path class="fx-m fx-m-think" d="M50 83h20" stroke="#16283C" stroke-width="4" stroke-linecap="round" fill="none"/><path class="fx-m fx-m-oops" d="M48 88q12-10 24 0" stroke="#16283C" stroke-width="4" stroke-linecap="round" fill="none"/><g class="fx-m fx-m-cheer"><path d="M45 77h30q-2 17-15 17t-15-17z" fill="#16283C"/><path d="M52 88q8-5 16 0q-3 5-8 5t-8-5z" fill="#F07A8E"/></g><path class="fx-pip-sweat" d="M100 38q6 9 0 13q-6-4 0-13z" fill="#7cc4f5" stroke="#16283C" stroke-width="2"/></svg>`;

const TALK = {
  1: 'Ask your child: “Which station would our old fan go to? What clue would tell us?”',
  2: 'Ask your child: “Which bin does our food go in? What could we recycle at home?”',
  3: 'Ask your child: “What danger signs should make us stop and ask an adult?”',
  4: 'Ask your child: “Is there something at home that could go to a Repair Café?”',
};
/** Conversation starters for the grown-ups' record, by the right place. */
const TALK_BY_ANSWER = {
  repair: '“What could a Repair Café fix in our home?”',
  reuse: '“Who might use something we don’t need any more?”',
  ewaste: '“Why shouldn’t electrical things or batteries go in our bins?”',
  adult: '“What danger signs mean we stop and get an adult?”',
  recycle: '“Which things in our kitchen can go in the recycling bin?”',
  compost: '“What happens to food scraps in the food and garden bin?”',
  bin: '“Why is the rubbish bin the last choice?”',
};
const PRAISE_FIRST = ['Brilliant!', 'Super sorter!', 'Spot on!', 'Amazing!', 'You nailed it!', 'Fantastic!', 'Wow!'];
const PRAISE_RETRY = ['You got it!', 'Well done!', 'Great thinking!', 'Yes, that’s it!'];

// The three-step intro shown on the first visit, like a new app's welcome.
const INTRO = [
  { title: 'Look at the clues', text: 'Each thing that rolls in has clues. The glowing part shows what’s wrong, or that it still works.' },
  { title: 'Drag it to the right place', text: 'Hold it with your finger and drop it on a workshop station or a bin. You can tap the buttons too.' },
  { title: 'Win stars and cards', text: 'Repair and reuse first. Then recycle or compost. The rubbish bin is the last choice!' },
];
const INTRO_ART = [
  `<svg class="fx-art" viewBox="0 0 320 200" aria-hidden="true" focusable="false"><ellipse cx="112" cy="182" rx="74" ry="9" fill="#d9e6f2"/><path d="M66 176q-6-72 50-84 56 12 50 84z" fill="#3a8f87" stroke="#16283c" stroke-width="4" stroke-linejoin="round"/><rect x="98" y="80" width="36" height="12" rx="5" fill="#16283c"/><path d="M164 112q32-2 30-36" fill="none" stroke="#16283c" stroke-width="9" stroke-linecap="round"/><circle class="fx-art-glow" cx="190" cy="92" r="11" fill="#ff4d3d"/><circle cx="96" cy="132" r="6" fill="#16283c"/><circle cx="128" cy="132" r="6" fill="#16283c"/><path d="M100 150q12 9 24 0" stroke="#16283c" stroke-width="4" fill="none" stroke-linecap="round"/><g class="fx-art-clue c1"><rect x="200" y="22" width="112" height="34" rx="12" fill="#fff" stroke="#e5483a" stroke-width="3"/><circle cx="216" cy="39" r="6" fill="#e5483a"/><text x="228" y="44" font-size="14" font-weight="800" fill="#16283c">Switch loose</text></g><g class="fx-art-clue c2"><rect x="214" y="64" width="98" height="34" rx="12" fill="#fff" stroke="#1e8e5a" stroke-width="3"/><circle cx="230" cy="81" r="6" fill="#1e8e5a"/><text x="242" y="86" font-size="14" font-weight="800" fill="#16283c">Fixable!</text></g><g class="fx-art-lens"><circle cx="248" cy="146" r="22" fill="#cfe6f7" fill-opacity=".7" stroke="#16283c" stroke-width="5"/><path d="M264 162l18 18" stroke="#16283c" stroke-width="8" stroke-linecap="round"/></g></svg>`,
  `<svg class="fx-art" viewBox="0 0 320 200" aria-hidden="true" focusable="false"><g><rect x="16" y="14" width="86" height="60" rx="14" fill="#dff4e7" stroke="#1e8e5a" stroke-width="3"/><text x="59" y="50" text-anchor="middle" font-size="15" font-weight="800" fill="#1e8e5a">Repair</text></g><g><rect x="117" y="14" width="86" height="60" rx="14" fill="#e1efff" stroke="#176dc4" stroke-width="3"/><text x="160" y="50" text-anchor="middle" font-size="15" font-weight="800" fill="#176dc4">Reuse</text></g><g><path d="M247 34h34l-3 38h-28z" fill="#34424c"/><rect x="242" y="24" width="44" height="11" rx="4" fill="#f2c12e" stroke="#16283c" stroke-width="2"/><circle cx="252" cy="74" r="4" fill="#1d2429"/><circle cx="276" cy="74" r="4" fill="#1d2429"/><text x="264" y="96" text-anchor="middle" font-size="13" font-weight="800" fill="#8a6400">Recycle</text></g><path d="M168 150Q96 136 62 70" fill="none" stroke="#9fb3c6" stroke-width="3" stroke-dasharray="6 8" stroke-linecap="round"/><ellipse cx="160" cy="186" rx="44" ry="7" fill="#d9e6f2"/><g class="fx-art-drag"><rect x="134" y="142" width="56" height="38" rx="10" fill="#c97959" stroke="#16283c" stroke-width="3"/><rect x="145" y="136" width="12" height="9" rx="3" fill="#16283c"/><rect x="166" y="136" width="12" height="9" rx="3" fill="#16283c"/><g transform="translate(168 154) scale(2.1)"><path d="${'M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5-2.7L3.2 14a1.5 1.5 0 0 1 2.5-1.7L8 15'}" fill="#fff" stroke="#16283c" stroke-width="1.5" stroke-linejoin="round"/></g></g><g class="fx-art-tick"><circle cx="96" cy="18" r="15" fill="#1e8e5a" stroke="#fff" stroke-width="3"/><path d="M89 18l5 5 9-10" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`,
  `<svg class="fx-art" viewBox="0 0 320 200" aria-hidden="true" focusable="false">${[[96, 52, 1], [160, 38, 2], [224, 52, 3]].map(([x, y, n]) => `<g class="fx-art-star s${n}"><path transform="translate(${x - 26} ${y - 26}) scale(2.2)" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="#f4c431" stroke="#a06f00" stroke-width="1.2" stroke-linejoin="round"/></g>`).join('')}${[['Repair', '#1e8e5a', '#dff4e7'], ['Reuse', '#176dc4', '#e1efff'], ['Recycle', '#8a6400', '#fff4cc'], ['Compost', '#3f7a1a', '#e6f4d7'], ['Rubbish', '#a8322b', '#fde4e1']].map(([label, ink, fill], i) => `<g class="fx-art-step" style="--fx-i:${i}"><rect x="${6 + i * 62}" y="${112 + i * 10}" width="58" height="${70 - i * 10}" rx="10" fill="${fill}" stroke="${ink}" stroke-width="2.5"/><text x="${35 + i * 62}" y="${132 + i * 10}" text-anchor="middle" font-size="12" font-weight="800" fill="${ink}">${label}</text></g>`).join('')}<text x="160" y="196" text-anchor="middle" font-size="12" font-weight="700" fill="#4a5a6b">first choice  →  last choice</text></svg>`,
];

export function mountFixit(host, { onLearn = () => {}, onAward = () => {}, signal, storage, createScene, reducedMotion } = {}) {
  if (signal?.aborted) return () => {};
  const doc = host.ownerDocument, win = doc.defaultView;
  const controller = new win.AbortController(), on = { signal: controller.signal };
  if (storage === undefined) { try { storage = win.localStorage; } catch { storage = null; } }
  if (reducedMotion === undefined) reducedMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const makeScene = createScene || (async (canvas, callbacks) => (await import('./fixit-3d.js')).createFixitScene(canvas, callbacks));
  const sound = createSound(win, { storage });
  let save = readSave(storage), round = null, scene = null, party = null, view = 'hub', busy = false, solvedNow = false, dragged = false, observer = null, sceneToken = 0, layout = null, intro = null;
  const timers = new Set();
  const later = (fn, ms) => { const id = win.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const clearTimers = () => { for (const id of timers) win.clearTimeout(id); timers.clear(); };
  const announce = text => { const region = doc.querySelector('#announcement'); if (region) region.textContent = text; };
  const firstUnfinished = () => (ROUNDS.find(r => !save.stars[r.id]) || ROUNDS[0]).id;

  function disposeScene() { sceneToken++; observer?.disconnect(); observer = null; scene?.dispose?.(); scene = null; party?.dispose(); party = null; clearTimers(); intro = null; }
  /** Leaving a round part-way still keeps its tries for the grown-ups' record. */
  function leavePlay() {
    if (view === 'play' && round && round.attempts.length && !isRoundDone(round)) { recordHistory(save, round, { finished: false }); writeSave(storage, save); }
  }
  function mountParty() { const canvas = host.querySelector('[data-party]'); party = canvas ? createParty(canvas, { reducedMotion, onBurst: () => sound.play('pop') }) : null; }
  const toggles = () => `<span class="fx-toggles"><button type="button" class="fx-toggle" data-music aria-pressed="${sound.musicOn}">${icon(sound.musicOn ? 'music' : 'musicOff')}<span>Music</span></button><button type="button" class="fx-toggle" data-sound aria-pressed="${sound.enabled}">${icon(sound.enabled ? 'sound' : 'mute')}<span>Sounds</span></button></span>`;
  function refreshToggles() {
    host.querySelectorAll('[data-music]').forEach(b => { b.setAttribute('aria-pressed', String(sound.musicOn)); b.querySelector('svg').outerHTML = icon(sound.musicOn ? 'music' : 'musicOff'); });
    host.querySelectorAll('[data-sound]').forEach(b => { b.setAttribute('aria-pressed', String(sound.enabled)); b.querySelector('svg').outerHTML = icon(sound.enabled ? 'sound' : 'mute'); });
  }

  // ---- Start screen ----
  function renderHub(focus = 'h1') {
    leavePlay(); disposeScene(); view = 'hub'; sound.music(true);
    const orbit = ['banana', 'kettle', 'can', 'teddy'];
    host.innerHTML = `<section class="fx-page fx-hub">
      <div class="challenge-top fx-hub-top"><a href="#learn" data-hub>← All challenges</a><span>FIX-IT STATION · AGES 7–12</span>${toggles()}</div>
      <header class="fx-hero">
        <div class="fx-hero-copy"><p class="fx-kicker">Fix-it Station</p><h1 tabindex="-1">Pip’s Fix-it Workshop</h1>
          <p class="fx-lead">Broken things and everyday rubbish are rolling in! Read the clues, then grab each 3D item and drop it at the right station or bin.</p>
          <ol class="fx-how"><li>${icon('eye')}<span><strong>Look</strong> for clues</span></li><li>${icon('hand')}<span><strong>Drag</strong> it to a place</span></li><li>${icon('star')}<span><strong>Win</strong> stars and cards</span></li></ol>
          <div class="fx-hero-actions"><button type="button" class="fx-btn fx-btn-go" data-round="${firstUnfinished()}">${save.stars[1] ? 'Keep playing' : 'Start playing'} ${icon('arrow')}</button>
            <button type="button" class="fx-btn fx-btn-soft" data-howto>${icon('help')} How to play</button>
            <button type="button" class="fx-btn fx-btn-soft" data-book>${icon('book')} Discovery Book <span class="fx-count">${save.cards.length}/${CARDS.length}</span></button></div>
        </div>
        <div class="fx-hero-scene" aria-hidden="true">${orbit.map((model, n) => `<span class="fx-orbit fx-orbit-${n}">${itemIcon(model)}</span>`).join('')}${[0, 1, 2, 3].map(n => `<span class="fx-twinkle fx-twinkle-${n}"></span>`).join('')}${pip('happy')}<p class="fx-bubble">Hi, I’m Pip! Help me sort the workshop.</p></div>
      </header>
      <h2 class="fx-h2">Choose a round</h2>
      <ol class="fx-rounds">${ROUNDS.map(r => `<li><button type="button" class="fx-round" data-round="${r.id}"><span class="fx-round-art" aria-hidden="true">${r.stories.slice(0, 3).map(id => `<span>${itemIcon(STORIES[id].model)}</span>`).join('')}</span><span class="fx-round-num">Round ${r.id}</span><strong>${escape(r.title)}</strong><span>${escape(r.copy)}</span><span class="fx-round-meta">${r.stories.length} things ${save.stars[r.id] ? stars(save.stars[r.id]) : '<span class="fx-new">New</span>'}</span></button></li>`).join('')}</ol>
      <h2 class="fx-h2">Meet the workshop</h2>
      <ul class="fx-station-cards">${STATIONS.map(s => `<li class="fx-station-card fx-tone-${s.id}"><span class="fx-station-icon">${icon(s.id)}</span><h3>${escape(s.name)}</h3><p>${escape(s.about)}</p></li>`).join('')}</ul>
      <h2 class="fx-h2">The Bin corner</h2>
      <ul class="fx-station-cards fx-bin-cards">${BINS.map(b => `<li class="fx-station-card fx-tone-${b.id}"><span class="fx-station-icon">${binArt(b.lid)}</span><h3>${escape(b.name)}</h3><p>${escape(b.about)}</p></li>`).join('')}</ul>
      <aside class="fx-grownups"><span class="fx-station-icon">${icon('people')}</span><div><h2>For grown-ups</h2><p>See which items your child sorted, what they chose and how many tries it took. Use it to start a conversation.</p></div><button type="button" class="fx-btn fx-btn-soft" data-parents>Open the learning record ${icon('arrow')}</button></aside>
      <p class="fx-note">Stories are fictional. Children sort digital models only; real appliances stay closed and adults make real decisions. Bins differ between councils, so check your council’s guide. Progress stays in this browser.</p>
    </section>`;
    host.querySelector(focus)?.focus();
    if (!save.intro) openIntro({ auto: true });
  }

  // ---- How-to-play intro: three steps, with Skip ----
  function openIntro({ auto = false } = {}) {
    if (intro) return;
    let step = 0;
    const overlay = doc.createElement('div');
    overlay.className = 'fx-intro'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'fx-intro-title');
    intro = { overlay, auto, returnFocus: doc.activeElement, go: n => { step = Math.max(0, Math.min(INTRO.length - 1, n)); sound.play('tap'); draw(); }, get step() { return step; } };
    function draw() {
      const slide = INTRO[step], last = step === INTRO.length - 1;
      overlay.innerHTML = `<div class="fx-intro-card">
        <div class="fx-intro-top"><span class="fx-intro-kicker">How to play</span><button type="button" class="fx-intro-skip" data-intro-skip>Skip</button></div>
        <div class="fx-intro-art" data-step="${step + 1}">${INTRO_ART[step]}</div>
        <div class="fx-intro-body"><span class="fx-intro-num" aria-hidden="true">${step + 1}</span><div><h2 id="fx-intro-title" tabindex="-1">${escape(slide.title)}</h2><p>${escape(slide.text)}</p></div></div>
        <div class="fx-intro-dots" role="group" aria-label="Steps">${INTRO.map((_, n) => `<button type="button" class="fx-intro-dot${n === step ? ' is-on' : ''}" data-intro-dot="${n}" aria-label="Step ${n + 1} of ${INTRO.length}"${n === step ? ' aria-current="step"' : ''}></button>`).join('')}</div>
        <div class="fx-intro-nav">${step ? '<button type="button" class="fx-btn fx-btn-soft" data-intro-back>Back</button>' : '<span></span>'}${last ? `<button type="button" class="fx-btn fx-btn-go" data-intro-play>Let’s play! ${icon('arrow')}</button>` : `<button type="button" class="fx-btn fx-btn-primary" data-intro-next>Next ${icon('arrow')}</button>`}</div>
      </div>`;
      overlay.querySelector('h2').focus({ preventScroll: true });
    }
    // Swipe left or right between steps on a touch screen.
    let startX = null;
    overlay.addEventListener('pointerdown', event => { startX = event.clientX; }, on);
    overlay.addEventListener('pointerup', event => {
      if (startX === null || event.target.closest('button')) { startX = null; return; }
      const dx = event.clientX - startX; startX = null;
      if (Math.abs(dx) > 60) intro?.go(intro.step + (dx < 0 ? 1 : -1));
    }, on);
    host.querySelector('.fx-page')?.append(overlay);
    draw();
  }
  function closeIntro({ play = false } = {}) {
    if (!intro) return;
    const { overlay, returnFocus } = intro; intro = null; overlay.remove();
    if (!save.intro) { save.intro = true; writeSave(storage, save); }
    if (play && view !== 'play') { startRound(firstUnfinished()); return; }
    (returnFocus && host.contains(returnFocus) ? returnFocus : host.querySelector('h1,h2'))?.focus({ preventScroll: true });
  }

  // ---- Play screen ----
  async function startRound(id) {
    leavePlay(); disposeScene();
    round = createRound(id); view = 'play'; busy = true; solvedNow = false; layout = null; sound.music(true);
    const r = roundById(id);
    host.innerHTML = `<section class="fx-page fx-play" data-round-id="${r.id}">
      <div class="fx-topbar"><button type="button" class="fx-link" data-to-hub>← Workshop</button>
        <span class="fx-pill fx-pill-round"><strong>Round ${r.id}</strong> <span class="fx-round-title">${escape(r.title)}</span></span>
        <span class="fx-pill fx-pill-progress"><span class="fx-dots" data-dots aria-hidden="true">${r.stories.map(() => '<i></i>').join('')}</span><span data-progress></span></span>
        <span class="fx-pill fx-pill-stars" data-star-pill>${icon('star', 'fx-star on')} <span data-first>0</span> first tries</span>
        ${toggles()}<button type="button" class="fx-toggle fx-toggle-help" data-howto aria-label="How to play">${icon('help')}</button></div>
      <div class="fx-stage">
        <div class="fx-canvas-wrap" data-canvas-wrap>
          <canvas class="fx-canvas" aria-hidden="true"></canvas>
          <div class="fx-labels">${TARGETS.map(t => `<button type="button" class="fx-label fx-tone-${t.id}${t.kind === 'bin' ? ' fx-label-bin' : ''}" data-label="${t.id}" aria-label="About the ${escape(t.name)}">${escape(t.label)}${t.kind === 'station' ? ` ${icon('info', 'fx-icon-sm')}` : ''}</button>`).join('')}
            <span class="fx-item-anchor" data-item-anchor aria-hidden="true"><span class="fx-drag-hint"><span class="fx-drag-hand">${icon('hand', 'fx-icon-sm')}</span> Drag me!</span><span class="fx-mark fx-mark-no" data-mark-no>${icon('cross', 'fx-mark-icon')}</span></span>
            <span class="fx-mark fx-mark-yes" data-mark-yes aria-hidden="true">${icon('check', 'fx-mark-icon')}</span></div>
          <p class="fx-2d-note">3D isn’t available on this device. Tap a station or bin to sort each item.</p>
          <div class="fx-loading" data-loading><span class="fx-spinner"></span>Opening the workshop…</div>
          <div class="fx-station-info" data-station-info hidden role="dialog" aria-modal="false" aria-labelledby="fx-info-title"></div>
          <div class="fx-feedback" data-feedback role="status" aria-live="polite"></div>
        </div>
        <aside class="fx-panel">
          <div class="fx-guide">${pip('happy')}<p class="fx-bubble" data-pip>Here comes the first one!</p></div>
          <article class="fx-item" data-item></article>
          <div class="fx-choose"><p class="fx-choose-label">Drag it, or tap a place:</p>
            <div class="fx-choices" role="group" aria-label="Workshop stations">${STATIONS.map(choiceButton).join('')}</div>
            <div class="fx-choices fx-choices-bins" role="group" aria-label="Bin corner">${BINS.map(choiceButton).join('')}</div></div>
        </aside>
      </div>
      <canvas class="fx-party" data-party aria-hidden="true"></canvas>
    </section>`;
    setChoicesEnabled(false); fitToScreen(); mountParty();
    const canvas = host.querySelector('.fx-canvas'), wrap = host.querySelector('[data-canvas-wrap]'), token = sceneToken;
    try {
      const made = await makeScene(canvas, {
        reducedMotion,
        onDrop: target => choose(target),
        onHover: id => { host.querySelectorAll('[data-label],[data-station]').forEach(n => n.classList.toggle('is-hot', (n.dataset.label || n.dataset.station) === id)); if (id) sound.play('hover'); },
        onDragStart: () => { dragged = true; hideHint(); sound.play('grab'); const fb = host.querySelector('[data-feedback].is-retry'); fb?.classList.remove('is-shown'); },
        onMiss: () => { sound.play('miss'); say('Drop it right on a station or a bin!', 'think'); showHint(); },
        onLayout: placeLabels,
      });
      if (token !== sceneToken || view !== 'play') { made?.dispose?.(); return; }
      scene = made;
      if ('IntersectionObserver' in win) { observer = new win.IntersectionObserver(([entry]) => scene?.setVisible?.(entry.isIntersecting)); observer.observe(wrap); }
    } catch (error) {
      if (token !== sceneToken) return;
      scene = null; wrap.classList.add('is-2d');
      console.warn('Fix-it Station is using its 2D view.', error);
    }
    host.querySelector('[data-loading]')?.remove();
    await nextItem(true);
  }
  // A non-breaking hyphen keeps "E-waste" on one line in the narrow buttons.
  function choiceButton(t) {
    return `<button type="button" class="fx-choice fx-tone-${t.id}${t.kind === 'bin' ? ' fx-choice-bin' : ''}" data-station="${t.id}" aria-keyshortcuts="${t.key}">${placeArt(t)}<span>${escape(t.short).replace(/-/g, '‑')}</span><kbd>${t.key}</kbd></button>`;
  }
  /** On tablets and computers the play screen fits exactly below the site header,
   * so the item, clues, feedback and Next button are always in view. */
  function fitToScreen() {
    const page = host.querySelector('.fx-play'); if (!page) return;
    if (win.scrollY > 0) { try { win.scrollTo(0, 0); } catch { /* not available */ } }
    const top = page.getBoundingClientRect().top + (win.scrollY || 0);
    page.style.setProperty('--fx-top', `${Math.max(0, Math.round(top))}px`);
  }

  function placeLabels(next) {
    layout = next;
    for (const [id, pos] of Object.entries(next.targets || {})) {
      const label = host.querySelector(`[data-label="${id}"]`); if (label) { label.style.left = `${pos.label.x}px`; label.style.top = `${pos.label.y}px`; }
    }
    const anchor = host.querySelector('[data-item-anchor]'); if (anchor && next.item) { anchor.style.left = `${next.item.x}px`; anchor.style.top = `${next.item.y}px`; }
  }
  function setChoicesEnabled(enabled) { host.querySelectorAll('[data-station]').forEach(button => { button.disabled = !enabled; }); }
  function say(text, mood = 'happy') {
    const bubble = host.querySelector('[data-pip]'); if (bubble) { bubble.textContent = text; bubble.classList.remove('is-new'); void bubble.offsetWidth; bubble.classList.add('is-new'); }
    host.querySelector('.fx-guide .fx-pip')?.setAttribute('data-mood', mood);
  }
  const showHint = () => { if (!dragged && scene) host.querySelector('[data-item-anchor]')?.classList.add('is-showing'); };
  const hideHint = () => host.querySelector('[data-item-anchor]')?.classList.remove('is-showing');
  function updateProgress() {
    const r = roundById(round.roundId), total = r.stories.length;
    host.querySelector('[data-progress]').textContent = `Item ${Math.min(round.index + 1, total)} of ${total}`;
    host.querySelectorAll('[data-dots] i').forEach((dot, n) => { dot.className = n < round.index ? 'done' : n === round.index ? 'now' : ''; });
  }
  /** Restart a CSS animation class, and remove it after it has played. */
  function flash(node, cls, ms = 900) { if (!node) return; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); later(() => node.classList.remove(cls), ms); }

  async function nextItem(first = false) {
    const item = currentStory(round);
    updateProgress();
    const feedback = host.querySelector('[data-feedback]'); feedback.className = 'fx-feedback'; feedback.innerHTML = '';
    solvedNow = false;
    host.querySelector('[data-item]').innerHTML = `<p class="fx-kicker">${item.tone === 'danger' ? 'Careful clues' : 'Clues'}</p>
      <div class="fx-item-head">${scene ? '' : `<span class="fx-item-icon">${itemIcon(item.model)}</span>`}<h2 tabindex="-1">${escape(item.name)}</h2></div>
      <ul class="fx-clues">${item.clues.map((clue, n) => `<li class="fx-clue fx-clue-${item.tone}" style="--fx-i:${n}">${escape(clue)}</li>`).join('')}</ul>
      ${scene ? `<p class="fx-glow-note fx-glow-${item.tone}">${item.tone === 'ok' ? 'The glowing part is fine.' : item.tone === 'danger' ? 'The glowing part has a warning.' : 'The glowing part has a problem.'}</p>` : ''}`;
    say(first ? `Here comes ${item.name}! Read the clues.` : `Next up: ${item.name}!`, 'happy');
    busy = true; setChoicesEnabled(false);
    sound.play('arrive');
    if (scene) await scene.showItem(item);
    if (view !== 'play') return;
    busy = false; setChoicesEnabled(true);
    reveal(host.querySelector('[data-canvas-wrap]'));
    say(`Where should ${item.name} go? Drag it to a station or a bin!`, 'think');
    showHint();
    if (!first) host.querySelector('[data-item] h2')?.focus({ preventScroll: true });
    announce(`${item.name}. Clues: ${item.clues.join(' ')}`);
  }

  // Screen points (relative to the whole play section) for marks and fireworks.
  function pointFor(target) {
    const section = host.querySelector('.fx-play'), wrap = host.querySelector('[data-canvas-wrap]'); if (!section || !wrap) return null;
    const s = section.getBoundingClientRect(), w = wrap.getBoundingClientRect(), label = layout?.targets?.[target]?.label;
    if (label && scene) return { x: w.left - s.left + label.x, y: w.top - s.top + label.y };
    const button = host.querySelector(`[data-station="${target}"]`)?.getBoundingClientRect();
    return button && button.width ? { x: button.left - s.left + button.width / 2, y: button.top - s.top } : { x: w.left - s.left + w.width / 2, y: w.top - s.top + w.height / 3 };
  }
  function celebrate(target, big) {
    const point = pointFor(target), wrap = host.querySelector('[data-canvas-wrap]'), section = host.querySelector('.fx-play');
    if (!party || !point || !wrap || !section) return;
    const s = section.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    const sky = { x: point.x, y: Math.max(40, point.y - 70) };
    party.fireworks(big ? [sky, { x: w.left - s.left + w.width * .2, y: w.top - s.top + w.height * .2 }, { x: w.left - s.left + w.width * .8, y: w.top - s.top + w.height * .16 }] : [sky], { big });
    party.confetti({ count: big ? 130 : 60 });
    party.stars(point.x, point.y);
  }
  function flyStar(target) {
    const pill = host.querySelector('[data-star-pill]'), section = host.querySelector('.fx-play'); if (!pill || !section) return;
    const bump = () => { flash(pill, 'is-bump', 700); sound.play('star'); };
    const from = pointFor(target);
    if (reducedMotion || !from || typeof section.animate !== 'function') { bump(); return; }
    const star = doc.createElement('span'); star.className = 'fx-fly-star'; star.setAttribute('aria-hidden', 'true'); star.innerHTML = icon('star', 'fx-star on'); section.append(star);
    const s = section.getBoundingClientRect(), p = pill.getBoundingClientRect(), to = { x: p.left - s.left + 22, y: p.top - s.top + p.height / 2 };
    const move = star.animate([
      { transform: `translate(${from.x}px, ${from.y}px) scale(.3)`, opacity: 0 },
      { transform: `translate(${from.x}px, ${from.y - 70}px) scale(1.8)`, opacity: 1, offset: .35 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(.8)`, opacity: 1 },
    ], { duration: 1000, easing: 'cubic-bezier(.5,0,.25,1)' });
    move.finished.then(() => { star.remove(); bump(); }, () => star.remove());
  }
  function markYes(target) {
    const mark = host.querySelector('[data-mark-yes]'), label = layout?.targets?.[target]?.label; if (!mark || !label) return;
    mark.style.left = `${label.x}px`; mark.style.top = `${label.y}px`;
    flash(mark, 'is-on', 1700);
  }
  /** On phones the buttons sit below the workshop, so bring the result into view. */
  function reveal(node) { if (win.matchMedia?.('(max-width: 720px)').matches) node?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' }); }

  /** Every route in: a 3D drop, a button tap or a number key. */
  async function choose(target) {
    if (view !== 'play' || busy || solvedNow || !round || isRoundDone(round) || !targetById(target)) return;
    busy = true; setChoicesEnabled(false); hideHint();
    const result = drop(round, target);
    const feedback = host.querySelector('[data-feedback]'), wrap = host.querySelector('[data-canvas-wrap]');
    const unlockedCard = result.unlocked ? cardById(result.unlocked) : null;
    const cardPop = unlockedCard ? `<div class="fx-card-pop">${icon('book')}<span><small>New Discovery card</small><strong>${escape(unlockedCard.title)}</strong>${escape(unlockedCard.text)}</span></div>` : '';
    host.querySelector('[data-first]').textContent = String(round.firstTry);
    announce(`${result.title} ${result.text}${unlockedCard ? ` New Discovery card: ${unlockedCard.title}.` : ''}`);
    if (unlockedCard && !save.cards.includes(unlockedCard.id)) onLearn({ id: `fixit:card:${unlockedCard.id}`, title: unlockedCard.title, detail: unlockedCard.text });
    if (result.ok) {
      solvedNow = true;
      const praise = (result.firstTry ? PRAISE_FIRST : PRAISE_RETRY)[(round.index + round.firstTry) % (result.firstTry ? PRAISE_FIRST : PRAISE_RETRY).length];
      feedback.className = 'fx-feedback is-ok';
      feedback.innerHTML = `<div class="fx-win">${pip('cheer')}<div class="fx-win-copy"><p class="fx-win-praise"><span class="fx-badge fx-badge-yes">${icon('check')}</span>${escape(praise)}${result.firstTry ? `<span class="fx-plus">${icon('star', 'fx-star on')} +1</span>` : ''}</p><strong class="fx-win-title">${escape(result.title)}</strong><p class="fx-win-why">${escape(result.text)}</p></div>${cardPop}<div class="fx-next-wrap" data-next-wrap></div></div>`;
      say(`${praise} ${result.title}`, 'cheer');
      sound.play('right'); sound.buzz(40);
      markYes(target); flash(host.querySelector(`[data-label="${target}"]`), 'is-right', 1200); flash(host.querySelector(`[data-station="${target}"]`), 'is-right', 1200);
      updateProgress();
      let landed = false;
      const land = () => { if (landed || view !== 'play') return; landed = true; sound.play('land'); celebrate(target, result.firstTry); if (result.firstTry) flyStar(target); };
      if (scene) await scene.accept(target, { onLand: land });
      land();
      if (view !== 'play') return;
      const done = isRoundDone(round);
      feedback.classList.add('is-shown');
      feedback.querySelector('[data-next-wrap]').innerHTML = `<button type="button" class="fx-btn fx-btn-go" data-next>${done ? 'See my workshop report' : 'Next one'} ${icon('arrow')}</button>`;
      if (unlockedCard) later(() => sound.play('card'), 300);
      host.querySelector('[data-next]').focus({ preventScroll: true });
      reveal(feedback);
      busy = false;
    } else {
      const bin = result.reason === 'bin';
      feedback.className = 'fx-feedback is-retry is-shown';
      feedback.innerHTML = `<div class="fx-retry"><span class="fx-badge fx-badge-no">${icon('cross')}</span><div><strong>${escape(result.title)}</strong><span>${escape(result.text)}</span></div>${cardPop}</div>`;
      say(bin ? `Oops! ${result.title} Electrical things never go in home bins.` : 'Hmm, not quite. Look at the clues again!', 'oops');
      sound.play(bin || targetById(target).kind === 'bin' ? 'bin' : 'wrong'); sound.buzz([90, 60, 90]);
      // The "buzz" everyone can feel: the workshop shakes, a big ✗ pops on the
      // item, and the place that was chosen wobbles red.
      flash(wrap, 'is-shaking', 650); flash(host.querySelector('[data-mark-no]'), 'is-on', 1500);
      flash(host.querySelector(`[data-label="${target}"]`), 'is-wrong', 900); flash(host.querySelector(`[data-station="${target}"]`), 'is-wrong', 900);
      reveal(feedback);
      if (scene) await scene.reject(target);
      if (view !== 'play') return;
      busy = false; setChoicesEnabled(true); showHint();
      host.querySelector(`[data-station="${target}"]`)?.focus({ preventScroll: true });
    }
  }

  function next() {
    if (!solvedNow || busy) return;
    sound.play('tap');
    if (isRoundDone(round)) finishRound(); else nextItem();
  }

  /** The places chosen for one item, in order, with ✓ or ✗. */
  function path(item, answer) {
    return `<ol class="fx-path" aria-label="Choices in order">${item.tries.map(id => { const t = targetById(id), right = id === answer; return `<li class="fx-path-step fx-tone-${id} ${right ? 'is-right' : 'is-wrong'}">${icon(right ? 'check' : 'cross', 'fx-icon-sm')}<span>${escape(t.short)}</span><span class="fx-sr"> (${right ? 'right' : 'another try'})</span></li>`; }).join('')}</ol>`;
  }
  const tryLabel = item => !item.solved ? 'Not finished' : item.tries.length === 1 ? 'First try!' : `Got it on try ${item.tries.length}`;

  // ---- Round report ----
  function finishRound() {
    const r = roundById(round.roundId), total = r.stories.length;
    const { stars: earned, first } = recordRound(save, round);
    const summary = roundSummary(round);
    recordHistory(save, round, { finished: true });
    writeSave(storage, save);
    disposeScene(); view = 'results';
    const nextRound = roundById(r.id + 1);
    const cards = round.cards.map(cardById).filter(Boolean);
    host.innerHTML = `<section class="fx-page fx-results">
      <div class="challenge-top"><button type="button" class="fx-link" data-to-hub>← Workshop</button><span>WORKSHOP REPORT · ROUND ${r.id}</span>${toggles()}</div>
      <div class="fx-report">
        <div class="fx-report-main">${pip('cheer')}<h2 tabindex="-1">${earned === 3 ? 'Super sorter!' : 'Workshop sorted!'}</h2>${stars(earned)}
          <p class="fx-report-score"><strong>${round.firstTry}</strong> of ${total} sorted on the first try.</p>
          <p>Every item found its next step. Wrong tries are part of learning.</p>
          <p class="fx-talk"><strong>Talk together.</strong> ${escape(TALK[r.id])}</p>
          <div class="fx-hero-actions">${nextRound ? `<button type="button" class="fx-btn fx-btn-go" data-round="${nextRound.id}">Round ${nextRound.id}: ${escape(nextRound.title)} ${icon('arrow')}</button>` : ''}
            <button type="button" class="fx-btn fx-btn-soft" data-round="${r.id}">Play again</button><button type="button" class="fx-btn fx-btn-soft" data-book>${icon('book')} Discovery Book</button></div>
        </div>
        <div class="fx-report-side">
          <section class="fx-howitwent"><h3>How it went</h3><ol>${summary.map(item => { const s = STORIES[item.story]; return `<li class="${item.tries.length === 1 ? 'is-first' : ''}"><span class="fx-item-icon">${itemIcon(s.model)}</span><div><strong>${escape(s.name)}</strong>${path(item, s.answer)}</div><span class="fx-result">${tryLabel(item)}</span></li>`; }).join('')}</ol>
            <button type="button" class="fx-link" data-parents>${icon('people', 'fx-icon-sm')} Grown-ups: open the learning record</button></section>
          <section class="fx-report-cards"><h3>Cards you discovered</h3>${cards.length ? `<ul>${cards.map(c => `<li class="fx-card"><strong>${escape(c.title)}</strong><span>${escape(c.text)}</span></li>`).join('')}</ul>` : '<p>You already had these cards. Can you find them all in the book?</p>'}</section>
        </div>
      </div>
      <canvas class="fx-party" data-party aria-hidden="true"></canvas></section>`;
    host.querySelector('h2').focus();
    announce(`Round ${r.id} finished with ${earned} of 3 stars.`);
    if (first) onAward(`fixit:round:${r.id}`, 10, host.querySelector('.fx-stars'));
    mountParty();
    sound.play('fanfare');
    for (let n = 0; n < earned; n++) later(() => sound.play('star'), 500 + n * 380);
    const main = host.querySelector('.fx-report-main'), section = host.querySelector('.fx-results');
    if (party && main && section) {
      const s = section.getBoundingClientRect(), m = main.getBoundingClientRect();
      party.confetti({ count: 160 });
      later(() => party?.fireworks([{ x: m.left - s.left + m.width * .3, y: m.top - s.top + 60 }, { x: m.left - s.left + m.width * .75, y: m.top - s.top + 40 }, { x: s.width * .85, y: 90 }], { big: true }), 350);
    }
  }

  // ---- Discovery Book ----
  function renderBook() {
    leavePlay(); disposeScene(); view = 'book'; sound.music(true);
    host.innerHTML = `<section class="fx-page fx-book">
      <div class="challenge-top"><button type="button" class="fx-link" data-to-hub>← Workshop</button><span>DISCOVERY BOOK · ${save.cards.length} OF ${CARDS.length}</span>${toggles()}</div>
      <h1 tabindex="-1">Discovery Book</h1><p class="fx-lead">Each card is something you learned in the workshop.</p>
      <ul class="fx-book-grid">${CARDS.map((card, n) => save.cards.includes(card.id)
        ? `<li class="fx-card is-found" style="--n:${n}"><strong>${escape(card.title)}</strong><span>${escape(card.text)}</span></li>`
        : `<li class="fx-card is-locked">${icon('lock')}<strong>Still hidden</strong><span>Keep sorting to discover this card.</span></li>`).join('')}</ul>
      <div class="fx-hero-actions"><button type="button" class="fx-btn fx-btn-go" data-round="${firstUnfinished()}">Play a round ${icon('arrow')}</button></div>
    </section>`;
    host.querySelector('h1').focus();
  }

  // ---- Grown-ups' learning record ----
  function renderParents() {
    leavePlay(); disposeScene(); view = 'parents'; sound.music(false);
    const record = learningRecord(save.history);
    const date = value => { const d = new Date(value); return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d) : 'Saved round'; };
    const talkCard = item => {
      const s = STORIES[item.story];
      return `<li class="fx-talk-card"><div class="fx-talk-head"><span class="fx-item-icon">${itemIcon(s.model)}</span><div><h3>${escape(s.name)}</h3><p>${tryLabel(item)} · Round ${item.roundId}</p></div></div>
        ${path(item, s.answer)}<p><strong>The idea:</strong> ${escape(s.why)}</p><blockquote>Try asking: ${escape(TALK_BY_ANSWER[s.answer])}</blockquote>
        <button type="button" class="fx-btn fx-btn-soft" data-round="${item.roundId}">Practise round ${item.roundId} ${icon('arrow')}</button></li>`;
    };
    const entry = (e, n) => {
      const r = roundById(e.roundId), first = e.items.filter(i => i.tries.length === 1 && i.solved).length;
      return `<details class="fx-history-entry"${n === 0 ? ' open' : ''}><summary><strong>Round ${r.id}: ${escape(r.title)}</strong><span>${escape(date(e.at))} · ${e.finished ? `${first} of ${e.items.length} first tries` : 'Left part-way'}</span></summary>
        <table class="fx-history-table"><thead><tr><th scope="col">Item</th><th scope="col">Places chosen, in order</th><th scope="col">Result</th></tr></thead><tbody>${e.items.map(item => { const s = STORIES[item.story]; return `<tr><th scope="row">${escape(s.name)}</th><td>${path(item, s.answer)}</td><td>${tryLabel(item)}</td></tr>`; }).join('')}</tbody></table></details>`;
    };
    host.innerHTML = `<section class="fx-page fx-parents">
      <div class="challenge-top"><button type="button" class="fx-link" data-to-hub>← Workshop</button><span>FOR GROWN-UPS · LEARNING RECORD</span></div>
      <header class="fx-parent-hero"><div><p class="fx-kicker">For grown-ups</p><h1 tabindex="-1">What your child sorted</h1><p class="fx-lead">See each choice made in Pip’s workshop, find a teaching moment and talk about it together.</p><p class="fx-privacy">${icon('lock', 'fx-icon-sm')} Saved only in this browser. No names, no accounts, nothing sent anywhere.</p></div>${pip('happy')}</header>
      ${save.history.length ? `
      <ul class="fx-parent-stats"><li><strong>${record.rounds}</strong><span>${record.rounds === 1 ? 'round' : 'rounds'} played</span></li><li><strong>${record.sorted}</strong><span>things sorted</span></li><li><strong>${record.firstTries}</strong><span>first tries</span></li><li><strong>${record.retried}</strong><span>needed another try</span></li></ul>
      <p class="fx-note">Stars celebrate progress; they are not a test score. A different choice can mean experimenting or an accidental drop, so ask your child what they noticed.</p>
      <h2 class="fx-h2">Talk together about these</h2>
      ${record.talk.length ? `<ul class="fx-talk-list">${record.talk.map(talkCard).join('')}</ul>` : '<p class="fx-empty-note">Everything was sorted on the first try. Ask your child to explain one choice in their own words.</p>'}
      <h2 class="fx-h2">Every round, step by step</h2>
      <div class="fx-history">${save.history.map(entry).join('')}</div>
      <div class="fx-hero-actions"><button type="button" class="fx-btn fx-btn-soft" data-print>${icon('print')} Print the record</button><button type="button" class="fx-btn fx-btn-soft fx-btn-danger" data-ask-clear>Clear the record</button></div>
      <div class="fx-confirm" data-confirm hidden role="group" aria-labelledby="fx-clear-title"><h3 id="fx-clear-title">Clear the learning record?</h3><p>This removes the saved choices from this browser. Stars and Discovery cards stay.</p><div class="fx-hero-actions"><button type="button" class="fx-btn fx-btn-danger" data-clear>Yes, clear it</button><button type="button" class="fx-btn fx-btn-soft" data-keep>Keep it</button></div></div>`
      : `<div class="fx-parent-empty"><h2>Nothing recorded yet</h2><p>Play a round with your child. Each choice and try will appear here, ready for a conversation.</p><button type="button" class="fx-btn fx-btn-go" data-round="${firstUnfinished()}">Start the workshop ${icon('arrow')}</button></div>`}
      <aside class="fx-parent-help"><h3>Take the next step together</h3><p>A right answer in a game doesn’t show what is safe for a real appliance: adults check real items. Repair Cafés differ in what they accept, and your council’s website lists what goes in each bin.</p></aside>
    </section>`;
    host.querySelector('h1').focus();
  }

  function showStationInfo(id) {
    const t = targetById(id), panel = host.querySelector('[data-station-info]'); if (!t || !panel) return;
    panel.className = `fx-station-info fx-tone-${id}`; panel.dataset.for = id;
    panel.innerHTML = `<span class="fx-station-icon">${placeArt(t)}</span><h3 id="fx-info-title">${escape(t.name)}</h3><p>${escape(t.about)}</p><button type="button" class="fx-btn fx-btn-soft" data-info-close>Got it</button>`;
    panel.hidden = false; panel.querySelector('[data-info-close]').focus();
  }

  // Sound may only start after a gesture, so every tap or key press unlocks it.
  for (const type of ['pointerdown', 'keydown', 'touchend', 'click']) host.addEventListener(type, () => sound.unlock(), { ...on, capture: true, passive: true });
  doc.addEventListener('visibilitychange', () => sound.pause(doc.hidden), on);
  win.addEventListener('resize', () => { if (view === 'play') fitToScreen(); }, on);

  host.addEventListener('click', event => {
    const target = event.target.closest('button,a'); if (!target || !host.contains(target) || target.disabled) return;
    if (target.matches('[data-hub]')) return; // ordinary link back to the Learn hub
    if (target.matches('[data-intro-skip]')) { sound.play('tap'); closeIntro(); return; }
    if (target.matches('[data-intro-next]')) { intro?.go(intro.step + 1); return; }
    if (target.matches('[data-intro-back]')) { intro?.go(intro.step - 1); return; }
    if (target.matches('[data-intro-dot]')) { intro?.go(Number(target.dataset.introDot)); return; }
    if (target.matches('[data-intro-play]')) { sound.play('tap'); closeIntro({ play: true }); return; }
    if (target.matches('[data-howto]')) { sound.play('tap'); openIntro(); return; }
    if (target.matches('[data-music]')) { sound.setMusic(!sound.musicOn); refreshToggles(); return; }
    if (target.matches('[data-sound]')) { sound.setEnabled(!sound.enabled); refreshToggles(); sound.play('tap'); return; }
    if (target.matches('[data-to-hub]')) { sound.play('tap'); renderHub(); return; }
    if (target.matches('[data-round]')) { sound.play('tap'); startRound(Number(target.dataset.round)); return; }
    if (target.matches('[data-book]')) { sound.play('tap'); renderBook(); return; }
    if (target.matches('[data-parents]')) { sound.play('tap'); renderParents(); return; }
    if (target.matches('[data-station]')) { choose(target.dataset.station); return; }
    if (target.matches('[data-next]')) { next(); return; }
    if (target.matches('[data-label]')) { sound.play('tap'); showStationInfo(target.dataset.label); return; }
    if (target.matches('[data-info-close]')) { const panel = host.querySelector('[data-station-info]'); panel.hidden = true; host.querySelector(`[data-label="${panel.dataset.for}"]`)?.focus(); return; }
    if (target.matches('[data-print]')) { host.querySelectorAll('.fx-history-entry').forEach(d => { d.open = true; }); try { win.print(); } catch { /* printing unavailable */ } return; }
    if (target.matches('[data-ask-clear]')) { const box = host.querySelector('[data-confirm]'); box.hidden = false; box.querySelector('[data-keep]').focus(); return; }
    if (target.matches('[data-keep]')) { host.querySelector('[data-confirm]').hidden = true; host.querySelector('[data-ask-clear]').focus(); return; }
    if (target.matches('[data-clear]')) { save.history = []; writeSave(storage, save); renderParents(); }
  }, on);
  // Hovering or focusing a station button lights up that place in 3D.
  for (const type of ['pointerover', 'focusin']) host.addEventListener(type, event => { const button = event.target.closest?.('[data-station]'); if (button) scene?.preview?.(button.dataset.station); }, on);
  for (const type of ['pointerout', 'focusout']) host.addEventListener(type, event => { if (event.target.closest?.('[data-station]')) scene?.preview?.(null); }, on);
  doc.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '')) return;
    if (intro) {
      if (event.key === 'Escape') { event.preventDefault(); closeIntro(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); intro.go(intro.step + 1); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); intro.go(intro.step - 1); }
      else if (event.key === 'Tab') {
        // Keep keyboard focus inside the intro while it is open.
        const items = [...intro.overlay.querySelectorAll('button')], first = items[0], last = items.at(-1);
        if (event.shiftKey && (doc.activeElement === first || !intro.overlay.contains(doc.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if (view !== 'play') return;
    const place = TARGETS.find(t => t.key === event.key);
    if (place) { event.preventDefault(); choose(place.id); }
    else if (event.key.toLowerCase() === 'n' && solvedNow) { event.preventDefault(); next(); }
    else if (event.key === 'Escape') { const panel = host.querySelector('[data-station-info]'); if (panel && !panel.hidden) panel.hidden = true; }
  }, on);

  renderHub();
  const cleanup = () => { leavePlay(); controller.abort(); disposeScene(); sound.dispose(); view = 'closed'; signal?.removeEventListener('abort', cleanup); };
  signal?.addEventListener('abort', cleanup, { once: true });
  return cleanup;
}

// Exposed for tests and the content check.
export const STORY_COUNT = Object.keys(STORIES).length;
export { BIN, starsFor };
