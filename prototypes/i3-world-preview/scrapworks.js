/** Scrapworks: a no-timer e-waste strategy game for ages 10–13. The player runs a
 * recovery hub; each completed shift restores one part of a neglected town.
 * Rules live in scrapworks-engine.js. This module only draws screens and turns
 * taps, keys and drags into engine calls. Nothing here teaches real disassembly. */
import {
  LEVELS, ITEMS, DESTINATIONS, DESTINATION_LABELS, levelById,
  createShift, currentItem, isShiftComplete, inspect, clearData, applyChoice,
  bestScore, starsFor, readSave, writeSave, resetSave, recordStars, isUnlocked, restoredCount,
} from './scrapworks-engine.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CONDITION_TEXT = { working: 'Works', minor_fault: 'Minor fault', end_of_life: 'End of life' };
const DEST_ICONS = { reuse: '⇄', repair: '🔧', recycle: '♻', hold: '⚠', bin: '🗑' };
const DEST_LABEL = dest => DESTINATION_LABELS[dest];
const DEST_HINTS = { reuse: 'Pass it on as it is', repair: 'Spend tokens to fix it', recycle: 'Recover its materials', hold: 'Adult or specialist only', bin: 'Ordinary rubbish' };

/** Original, simple device drawings. Shapes are friendly icons, not internal diagrams. */
const ART = {
  tablet: '<rect x="30" y="16" width="60" height="88" rx="8" fill="#dceffa"/><rect x="36" y="24" width="48" height="68" rx="3" fill="#fff"/><circle cx="60" cy="98" r="3"/>',
  phone: '<rect x="38" y="14" width="44" height="92" rx="9" fill="#e7e0f5"/><rect x="43" y="24" width="34" height="68" rx="3" fill="#fff"/><path d="M54 99h12"/>',
  laptop: '<rect x="24" y="24" width="72" height="50" rx="5" fill="#dceffa"/><rect x="30" y="30" width="60" height="38" rx="2" fill="#fff"/><path d="M14 80h92l-8 12H22z" fill="#c9d8e6"/>',
  headphones: '<path d="M28 70V58a32 32 0 0 1 64 0v12" fill="none"/><rect x="20" y="66" width="18" height="30" rx="7" fill="#d9efd8"/><rect x="82" y="66" width="18" height="30" rx="7" fill="#d9efd8"/>',
  player: '<rect x="14" y="44" width="92" height="34" rx="5" fill="#e3e6ea"/><path d="M24 60h40"/><circle cx="88" cy="61" r="7" fill="#fff"/>',
  keyboard: '<rect x="12" y="40" width="96" height="42" rx="6" fill="#f0e9fc"/>' + [0, 1, 2].map(r => [0, 1, 2, 3, 4, 5, 6].map(c => `<rect x="${19 + c * 12.5}" y="${47 + r * 11}" width="8" height="7" rx="1.5" fill="#fff"/>`).join('')).join(''),
  speaker: '<rect x="34" y="16" width="52" height="88" rx="10" fill="#fff0dd"/><circle cx="60" cy="46" r="11" fill="#fff"/><circle cx="60" cy="80" r="16" fill="#fff"/><circle cx="60" cy="80" r="5"/>',
  controller: '<path d="M30 46h60a18 18 0 0 1 17 24l-5 14a10 10 0 0 1-17 2l-6-8H41l-6 8a10 10 0 0 1-17-2l-5-14a18 18 0 0 1 17-24z" fill="#dceffa"/><path d="M34 58v12m-6-6h12"/><circle cx="82" cy="60" r="3"/><circle cx="90" cy="68" r="3"/>',
  printer: '<rect x="32" y="16" width="56" height="26" rx="2" fill="#fff"/><rect x="16" y="40" width="88" height="40" rx="6" fill="#e3e6ea"/><rect x="32" y="70" width="56" height="30" rx="2" fill="#fff"/><path d="M40 82h40M40 90h28"/>',
  lamp: '<path d="M44 104h32M60 104V70l20-30" fill="none"/><path d="M68 26l30 10-12 20z" fill="#fbf4d9"/><circle cx="60" cy="70" r="4"/>',
  radio: '<rect x="16" y="40" width="88" height="56" rx="8" fill="#fff0dd"/><path d="M30 40 78 18"/><circle cx="44" cy="68" r="14" fill="#fff"/><path d="M70 58h22M70 68h22M70 78h22"/>',
  powerbank: '<rect x="30" y="24" width="60" height="78" rx="10" fill="#d9efd8"/><path d="M50 18h20"/><path d="M62 48l-8 16h12l-8 16" fill="none"/>',
  watch: '<rect x="46" y="10" width="28" height="22" rx="4" fill="#e3e6ea"/><rect x="46" y="88" width="28" height="22" rx="4" fill="#e3e6ea"/><rect x="36" y="30" width="48" height="60" rx="12" fill="#e7e0f5"/><rect x="43" y="38" width="34" height="44" rx="7" fill="#fff"/><path d="M60 50v12l7 5"/>',
  monitor: '<rect x="14" y="18" width="92" height="62" rx="5" fill="#e3e6ea"/><rect x="20" y="24" width="80" height="50" rx="2" fill="#fff"/><path d="M52 80v14m16-14v14M40 98h40"/>',
  camera: '<rect x="16" y="38" width="88" height="58" rx="9" fill="#fbf4d9"/><path d="M40 38l6-12h28l6 12" fill="#fbf4d9"/><circle cx="60" cy="67" r="17" fill="#fff"/><circle cx="60" cy="67" r="7"/>',
  ereader: '<rect x="30" y="12" width="60" height="96" rx="7" fill="#e3e6ea"/><rect x="36" y="20" width="48" height="70" rx="2" fill="#fff"/><path d="M42 32h36M42 42h36M42 52h28M42 62h36"/><path d="M52 98h16"/>',
  charger: '<rect x="38" y="20" width="44" height="40" rx="6" fill="#fff"/><path d="M50 20V8m20 12V8M60 60v14c0 14 22 10 22 24v10" fill="none"/>',
  router: '<rect x="14" y="62" width="92" height="30" rx="7" fill="#dceffa"/><path d="M32 62 24 26m64 36 8-36"/><circle cx="34" cy="77" r="3"/><circle cx="46" cy="77" r="3"/><circle cx="58" cy="77" r="3"/>',
  mouse: '<rect x="38" y="24" width="44" height="76" rx="22" fill="#f0e9fc"/><path d="M60 24v26M38 50h44"/>',
  console: '<rect x="14" y="44" width="92" height="40" rx="8" fill="#e7e0f5"/><path d="M26 64h36"/><circle cx="88" cy="64" r="6" fill="#fff"/>',
  remote: '<rect x="44" y="10" width="32" height="100" rx="12" fill="#e3e6ea"/><circle cx="60" cy="28" r="5" fill="#fff"/>' + [0, 1, 2, 3].map(r => `<circle cx="53" cy="${48 + r * 13}" r="3"/><circle cx="67" cy="${48 + r * 13}" r="3"/>`).join(''),
  battery: '<rect x="24" y="30" width="72" height="66" rx="9" fill="#ffe3c2"/><path d="M40 30v-8h14v8m12 0v-8h14v8M48 63h24M60 51v24"/>',
};
export function deviceArt(name) {
  return `<svg viewBox="0 0 120 120" fill="none" stroke="#16283c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ART[name] || ART.tablet}</svg>`;
}

/** The town gets greener with every restored part. Each part has a neglected
 * stand-in (litter, a dead tree, a grey roof) until its level earns a star. */
const TOWN_PARTS = [
  { neglected: '<path d="M20 172h44l-6-10H28z" fill="#a39a8d"/><circle cx="34" cy="166" r="4" fill="#8b8172"/>', restored: '<rect x="18" y="160" width="48" height="16" rx="3" fill="#8a6a49"/><path d="M26 160c0-10 6-12 6-12s6 2 6 12m4 0c0-8 6-10 6-10s6 2 6 10" fill="#5fae5b"/><circle cx="30" cy="148" r="4" fill="#f4d873"/><circle cx="48" cy="150" r="4" fill="#f29bb2"/>' },
  { neglected: '<rect x="76" y="110" width="52" height="56" fill="#9b9ea3"/><path d="M84 124h12M108 124h12M84 140l12 10" stroke="#6f737a" stroke-width="3"/>', restored: '<rect x="76" y="110" width="52" height="56" fill="#f2c79a"/><path d="M72 112l30-18 30 18z" fill="#d9734a"/><rect x="94" y="140" width="16" height="26" fill="#8a6a49"/><rect x="82" y="122" width="12" height="10" fill="#fff"/><rect x="110" y="122" width="12" height="10" fill="#fff"/><text x="102" y="108" text-anchor="middle" font-size="8" fill="#fff" font-family="Arial">REPAIR</text>' },
  { neglected: '<path d="M150 170v-30m0 10-8-8m8 2 8-10M196 170v-26m0 8 7-7" stroke="#7d7064" stroke-width="3" fill="none"/>', restored: '<path d="M150 170v-24M196 170v-22" stroke="#7a5a3a" stroke-width="4"/><circle cx="150" cy="138" r="14" fill="#5fae5b"/><circle cx="196" cy="140" r="12" fill="#6cc06a"/>' },
  { neglected: '<rect x="214" y="96" width="56" height="70" fill="#9b9ea3"/><path d="M210 98l32-20 32 20z" fill="#7c8087"/>', restored: '<rect x="214" y="96" width="56" height="70" fill="#b0cfeb"/><path d="M210 98l32-20 32 20z" fill="#2f4f75"/><path d="M220 92l10-7m4 9 10-7m4 9 10-7" stroke="#8fd3ff" stroke-width="4"/><rect x="236" y="140" width="14" height="26" fill="#fff"/>' },
  { neglected: '<ellipse cx="292" cy="186" rx="24" ry="8" fill="#8f8a6b"/><path d="M280 184l6-3 5 4" stroke="#5f5a45" stroke-width="2" fill="none"/>', restored: '<ellipse cx="292" cy="186" rx="24" ry="8" fill="#69b7e8"/><path d="M282 186q5-4 10 0t10 0" stroke="#fff" stroke-width="2" fill="none"/><circle cx="272" cy="180" r="4" fill="#5fae5b"/>' },
  { neglected: '<path d="M0 198h320" stroke="#8a8a8a" stroke-width="10"/><path d="M60 198h18m60 0h10" stroke="#6b6b6b" stroke-width="4"/>', restored: '<path d="M0 198h320" stroke="#4fa36c" stroke-width="10"/><path d="M10 198h20m20 0h20m20 0h20m20 0h20m20 0h20m20 0h20m20 0h20m20 0h20" stroke="#fff" stroke-width="2"/><circle cx="160" cy="191" r="5" fill="none" stroke="#16283c" stroke-width="2"/><circle cx="176" cy="191" r="5" fill="none" stroke="#16283c" stroke-width="2"/><path d="M160 191l8-8 8 8m-8-8h6" stroke="#16283c" stroke-width="2" fill="none"/>' },
  { neglected: '<rect x="10" y="74" width="54" height="74" fill="#9b9ea3"/><path d="M18 90h38M18 106h38" stroke="#7c8087" stroke-width="5"/>', restored: '<rect x="10" y="74" width="54" height="74" fill="#d7c4ef"/><path d="M6 76h62l-8-12H14z" fill="#7a5fa8"/><path d="M18 90h10m8 0h10m8 0h4M18 106h10m8 0h10m8 0h4" stroke="#fff" stroke-width="5"/><path d="M10 148c4-10 10-10 14 0m8 0c4-10 10-10 14 0m8 0c3-8 7-8 10 0" fill="#5fae5b"/>' },
  { neglected: '<path d="M300 150V70" stroke="#8f9196" stroke-width="4"/>', restored: '<path d="M300 150V70" stroke="#fff" stroke-width="4"/><path d="M300 70l-2-30 4 0zM300 70l26 14-2 4zM300 70l-24 16-2-3z" fill="#fff" stroke="#9fb4c8" stroke-width="1"/><circle cx="300" cy="70" r="3" fill="#9fb4c8"/>' },
];
export function townMarkup(restored, highlight = 0) {
  const mix = (from, to) => {
    const t = restored / TOWN_PARTS.length, hex = (s, i) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
    return '#' + [0, 1, 2].map(i => Math.round(hex(from, i) + (hex(to, i) - hex(from, i)) * t).toString(16).padStart(2, '0')).join('');
  };
  const parts = TOWN_PARTS.map((part, n) => `<g class="sw-town-part${n < restored ? ' is-restored' : ''}${n + 1 === highlight ? ' is-new' : ''}" data-part="${n + 1}">${n < restored ? part.restored : part.neglected}</g>`).join('');
  return `<svg class="sw-town" viewBox="0 0 320 210" role="img" aria-label="Town scene: ${restored} of ${TOWN_PARTS.length} parts restored"><rect width="320" height="210" fill="${mix('#cfd2d6', '#bfe6ff')}"/><circle cx="270" cy="34" r="16" fill="${restored ? '#f4d873' : '#e6e3da'}"/><rect y="164" width="320" height="46" fill="${mix('#b9ad97', '#8fcf7a')}"/>${parts}</svg>`;
}

/** Mount the game into the shared shell. Returns cleanup for route changes. */
export function mountScrapworks(host, { onLearn = () => {}, onAward = () => {}, signal, storage } = {}) {
  if (signal?.aborted) return () => {};
  const doc = host.ownerDocument, win = doc.defaultView;
  const controller = new win.AbortController();
  if (storage === undefined) { try { storage = win.localStorage; } catch { storage = null; } }
  let save = readSave(storage);
  let view = 'map', shift = null, feedback = null, outcome = null, finished = null, confirmReset = false;
  const cleanup = () => { controller.abort(); signal?.removeEventListener('abort', cleanup); };
  signal?.addEventListener('abort', cleanup, { once: true });

  const announce = text => { const region = doc.querySelector('#announcement'); if (region) region.textContent = text; };
  const stars = count => `<span class="sw-stars" aria-label="${count} of 3 stars">${[1, 2, 3].map(n => `<span class="${n <= count ? 'on' : ''}" aria-hidden="true">★</span>`).join('')}</span>`;

  function renderMap(focusSelector) {
    view = 'map';
    const restored = restoredCount(save);
    host.innerHTML = `<section class="sw-page sw-map"><div class="challenge-top"><a href="#learn">← All challenges</a><span>STRATEGY GAME · AGES 10–13</span></div>
      <header class="sw-hero"><div><p class="challenge-eyebrow">SCRAPWORKS RECOVERY HUB</p><h1 tabindex="-1">Scrapworks</h1><p>Run the town’s recovery hub. Inspect each device, send it to the right place and spend your repair tokens wisely. Every finished shift restores part of the town.</p>
      <ul class="sw-rules"><li><strong>Reuse</strong> working devices · 4 points</li><li><strong>Repair</strong> minor faults · 3 + life bonus, costs tokens</li><li><strong>Specialist Recycle</strong> end-of-life devices · 3 points</li><li><strong>Safety Hold</strong> anything hazardous · 3 points</li></ul>
      <p class="sw-small">No timer. Wrong tries never cost points or tokens. Points are game values, not real carbon or material savings.</p></div>
      <figure class="sw-town-frame">${townMarkup(restored)}<figcaption>${restored} of 8 town parts restored</figcaption></figure></header>
      <h2 class="sw-section-title">Choose a shift</h2><ol class="sw-levels">${LEVELS.map(level => {
        const open = isUnlocked(save, level.id), got = save.stars[level.id];
        return `<li><button type="button" class="sw-level${open ? '' : ' is-locked'}" data-level="${level.id}" ${open ? '' : 'disabled'}><span class="sw-level-number">Shift ${level.id}</span><strong>${escape(level.title)}</strong><span>${level.items.length} items · ${level.tokens} repair token${level.tokens > 1 ? 's' : ''}</span>${open ? stars(got ?? 0) : '<span class="sw-lock">🔒 Earn 1 star on the shift before</span>'}</button></li>`;
      }).join('')}</ol>
      <div class="sw-reset">${confirmReset ? '<p>Clear all stars and the restored town on this browser?</p><button type="button" class="challenge-button" data-reset-yes>Yes, reset progress</button><button type="button" class="challenge-button secondary" data-reset-no>Keep my progress</button>' : '<button type="button" class="challenge-button secondary" data-reset>Reset progress</button>'}<p class="sw-small">Progress stays only in this browser. No account, photos or personal details.</p></div></section>`;
    host.querySelector(focusSelector || 'h1')?.focus();
  }

  function startLevel(id) {
    if (!isUnlocked(save, id)) return;
    shift = createShift(id); feedback = null; outcome = null; finished = null; view = 'play';
    renderPlay('h2');
  }

  function cluesMarkup(entry) {
    if (!shift.inspected) return '<p class="sw-hint">Tap <strong>Inspect</strong> to reveal this item’s condition and warnings.</p>';
    const repair = entry.hazard ? 'Not for you to repair—specialists only.'
      : entry.condition === 'minor_fault' ? `Repair costs ${entry.repairCost} token${entry.repairCost > 1 ? 's' : ''} · life bonus +${entry.lifeBonus}`
      : entry.condition === 'working' ? 'No repair needed' : 'Cannot be repaired';
    return `<ul class="sw-clues"><li><span>Condition</span><strong>${CONDITION_TEXT[entry.condition]}</strong></li>
      <li class="${entry.hazard ? 'is-warning' : ''}"><span>Safety</span><strong>${entry.hazard ? '⚠ Hazard · Safety Hold only' : 'No hazard found'}</strong></li>
      <li class="${entry.personalData ? (shift.dataCleared ? 'is-cleared' : 'is-data') : ''}"><span>Personal data</span><strong>${entry.personalData ? (shift.dataCleared ? '✓ Cleared by an adult' : 'Holds personal data') : 'None'}</strong></li>
      <li><span>Repair value</span><strong>${repair}</strong></li></ul><p class="sw-clue-text">${escape(entry.clue)}</p>
      ${entry.personalData && !entry.hazard && !shift.dataCleared ? '<button type="button" class="sw-adult" data-clear>👤 Ask an adult to clear data</button>' : ''}`;
  }

  function renderPlay(focusSelector) {
    const level = levelById(shift.levelId), entry = outcome ? outcome.item : currentItem(shift);
    const remaining = level.items.length - shift.index, restored = restoredCount(save);
    const showBin = level.tutorialBin && !shift.binShown && !outcome;
    const destinations = [...DESTINATIONS, ...(showBin ? ['bin'] : [])];
    const tokens = Array.from({ length: level.tokens }, (_, n) => `<span class="${n < shift.tokens ? 'on' : ''}" aria-hidden="true"></span>`).join('');
    host.innerHTML = `<section class="sw-page sw-play"><div class="challenge-top"><button type="button" class="sw-link" data-map>← Shift map</button><span>SCRAPWORKS · SHIFT ${level.id}</span></div>
      <div class="sw-layout"><div class="sw-main">
        <div class="sw-hud" role="group" aria-label="Shift status"><span><small>Level</small><strong>${level.id} · ${escape(level.title)}</strong></span><span><small>Items left</small><strong>${remaining}</strong></span><span><small>Repair tokens</small><strong class="sw-tokens">${tokens}<em>${shift.tokens}</em></strong></span><span><small>Score</small><strong class="sw-score${outcome ? ' is-bumped' : ''}">${shift.score}</strong></span></div>
        ${shift.index === 0 && !outcome ? `<p class="sw-intro">${escape(level.intro)}</p>` : ''}
        <article class="sw-item${outcome ? ' is-sent sw-sent-' + outcome.destination : ''}${entry.hazard && (shift.inspected || outcome) ? ' is-hazard' : ''}">
          <div class="sw-drag" ${outcome ? '' : 'data-draggable title="Drag me to a destination"'}>${deviceArt(entry.illustration)}</div>
          <div class="sw-item-body"><p class="challenge-eyebrow">${outcome ? 'HANDLED' : `ITEM ${shift.index + 1} OF ${level.items.length}`}</p><h2 tabindex="-1">${escape(entry.name)}</h2>
          ${outcome ? `<p class="sw-outcome"><strong>${DEST_LABEL(outcome.destination)} · +${outcome.points} point${outcome.points === 1 ? '' : 's'}${outcome.cost ? ` · −${outcome.cost} token${outcome.cost > 1 ? 's' : ''}` : ''}</strong>${escape(outcome.message)}</p><button type="button" class="challenge-button" data-next>${isShiftComplete(shift) ? 'Finish shift' : 'Next item'} →</button>`
            : `${shift.inspected ? '' : '<button type="button" class="challenge-button" data-inspect>🔍 Inspect</button>'}${cluesMarkup(entry)}`}</div></article>
        <div class="sw-feedback${feedback ? ' is-' + feedback.tone : ''}" role="status">${feedback ? `<strong>${escape(feedback.title)}</strong> ${escape(feedback.copy)}` : ''}</div>
        <div class="sw-destinations" role="group" aria-label="Destinations">${destinations.map((dest, n) => `<button type="button" class="sw-dest sw-dest-${dest}" data-dest="${dest}" ${outcome ? 'disabled' : ''}><span class="sw-dest-icon" aria-hidden="true">${DEST_ICONS[dest]}</span><strong>${DEST_LABEL(dest)}</strong><small>${dest === 'bin' ? DEST_HINTS.bin : `${n + 1} · ${DEST_HINTS[dest]}`}</small></button>`).join('')}</div>
        <p class="sw-small sw-keys">Keys: <kbd>I</kbd> inspect · <kbd>A</kbd> ask an adult · <kbd>1</kbd>–<kbd>4</kbd> destinations · or drag the item onto a destination.</p>
      </div><aside class="sw-side"><figure class="sw-town-frame">${townMarkup(restored)}<figcaption>Finish this shift with a star to restore the ${escape(level.town.toLowerCase())}.</figcaption></figure></aside></div></section>`;
    host.querySelector(focusSelector || 'h2')?.focus();
  }

  /** Every route attempt goes through here: buttons, number keys and drops. */
  function choose(destination, focusSelector) {
    if (view !== 'play' || outcome || !shift) return;
    const entry = currentItem(shift), result = applyChoice(shift, destination);
    if (!result.ok) {
      const titles = { inspect: 'Inspect first.', bin: 'Not the bin!', hazard: 'Safety first.', data: 'Pause.', tokens: 'Not enough tokens.', 'no-hazard': 'Not a hazard.', invalid: 'Not this route.' };
      feedback = { tone: result.reason === 'hazard' ? 'stop' : 'retry', title: titles[result.reason] || 'Try again.', copy: result.message };
      announce(`${feedback.title} ${result.message}`);
      // The tutorial bin disappears after one try, so its focus moves to Reuse.
      renderPlay(focusSelector || (destination === 'bin' ? '.sw-dest' : `[data-dest="${destination}"]`));
      return;
    }
    feedback = null;
    outcome = { ...result, item: entry };
    announce(`${DEST_LABEL(destination)}. Plus ${result.points} points. ${result.message}`);
    renderPlay('[data-next]');
  }

  function next() {
    if (!outcome) return;
    outcome = null;
    if (isShiftComplete(shift)) finishShift(); else renderPlay('h2');
  }

  function finishShift() {
    const level = levelById(shift.levelId), best = bestScore(level.id), earned = starsFor(shift.score, best);
    const before = restoredCount(save), firstStar = earned >= 1 && !(save.stars[level.id] >= 1);
    recordStars(save, level.id, earned);
    writeSave(storage, save);
    const after = restoredCount(save);
    if (firstStar) { onLearn({ id: `scrapworks:level:${level.id}`, title: `Scrapworks · ${level.title}`, detail: `Restored the ${level.town.toLowerCase()} with ${earned} star${earned > 1 ? 's' : ''}.` }); }
    finished = { level, best, earned, score: shift.score, newPart: after > before ? after : 0 };
    view = 'results';
    renderResults();
    if (firstStar) onAward(`scrapworks:level:${level.id}`, 10, host.querySelector('.sw-stars'));
  }

  function renderResults() {
    const { level, best, earned, score, newPart } = finished, restored = restoredCount(save);
    const canNext = earned >= 1 && levelById(level.id + 1);
    announce(`Shift ${level.id} finished with ${earned} of 3 stars.`);
    host.innerHTML = `<section class="sw-page sw-results"><div class="challenge-top"><button type="button" class="sw-link" data-map>← Shift map</button><span>SCRAPWORKS · SHIFT ${level.id}</span></div>
      <div class="sw-result-grid"><div><p class="challenge-eyebrow">SHIFT COMPLETE</p><h2 tabindex="-1">${earned === 3 ? 'Perfect shift!' : earned >= 1 ? 'Shift complete!' : 'So close—try that shift again.'}</h2>${stars(earned)}
      <p class="sw-result-score">${score}<span> / ${best} best possible points</span></p>
      <p>${earned >= 1 ? (newPart ? `You restored the <strong>${escape(level.town.toLowerCase())}</strong>.` : 'Your town is already restored here. Can you beat your stars?') : 'You need 60% of the best score for a star. Wrong tries never cost points, so experiment freely.'}</p>
      ${earned < 3 ? `<p class="sw-small">Tip: ${level.id >= 5 ? 'compare each repair’s life bonus with its token cost.' : 'reuse what works, repair what is fixable and recycle only what is finished.'}</p>` : ''}
      <div class="challenge-result-actions">${canNext ? `<button type="button" class="challenge-button" data-level="${level.id + 1}">Next shift →</button>` : ''}<button type="button" class="challenge-button${canNext ? ' secondary' : ''}" data-retry>Retry shift ↻</button><button type="button" class="challenge-button secondary" data-map>Shift map</button></div>
      ${level.id === LEVELS.length && earned >= 1 ? '<p class="sw-small">That was the final shift. The whole town can now be restored—chase three stars everywhere!</p>' : ''}</div>
      <figure class="sw-town-frame">${townMarkup(restored, newPart)}<figcaption>${restored} of 8 town parts restored</figcaption></figure></div></section>`;
    host.querySelector('h2').focus();
  }

  function handleClick(event) {
    const target = event.target.closest('button');
    if (!target || !host.contains(target) || target.disabled) return;
    if (target.matches('[data-map]')) { confirmReset = false; renderMap(); return; }
    if (target.matches('[data-level]')) { startLevel(Number(target.dataset.level)); return; }
    if (target.matches('[data-retry]')) { startLevel(finished.level.id); return; }
    if (target.matches('[data-reset]')) { confirmReset = true; renderMap('[data-reset-no]'); return; }
    if (target.matches('[data-reset-no]')) { confirmReset = false; renderMap('[data-reset]'); return; }
    if (target.matches('[data-reset-yes]')) { save = resetSave(storage); confirmReset = false; announce('Progress reset.'); renderMap('[data-reset]'); return; }
    if (target.matches('[data-inspect]')) { inspect(shift); feedback = null; renderPlay(currentItem(shift).personalData && !currentItem(shift).hazard ? '[data-clear]' : '.sw-dest'); return; }
    if (target.matches('[data-clear]')) { if (clearData(shift)) { feedback = { tone: 'ok', title: 'Data cleared.', copy: 'An adult has taken care of the personal data. You can route it now.' }; announce('An adult cleared the data.'); } renderPlay('.sw-dest'); return; }
    if (target.matches('[data-next]')) { next(); return; }
    if (target.matches('[data-dest]')) choose(target.dataset.dest);
  }

  // Keyboard shortcuts mirror the buttons, so drag-and-drop is never required.
  function handleKey(event) {
    if (view !== 'play' || event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '')) return;
    const key = event.key.toLowerCase();
    if (outcome) { if (key === 'n') { event.preventDefault(); next(); } return; }
    if (key === 'i' && !shift.inspected) { event.preventDefault(); host.querySelector('[data-inspect]')?.click(); }
    else if (key === 'a') { const button = host.querySelector('[data-clear]'); if (button) { event.preventDefault(); button.click(); } }
    else if (/^[1-4]$/.test(key)) { event.preventDefault(); choose(DESTINATIONS[Number(key) - 1]); }
  }

  /** Pointer drag works for mouse, pen and touch. A short move starts the drag;
   * releasing over a destination routes the item exactly like a tap. */
  function handlePointerDown(event) {
    const handle = event.target.closest('[data-draggable]');
    if (!handle || event.button !== 0 || view !== 'play' || outcome) return;
    const start = { x: event.clientX, y: event.clientY }, drag = new win.AbortController();
    let ghost = null, over = null;
    const targetAt = (x, y) => doc.elementFromPoint?.(x, y)?.closest?.('[data-dest]:not([disabled])') || null;
    const finish = () => { drag.abort(); ghost?.remove(); over?.classList.remove('is-drop-target'); handle.classList.remove('is-dragging'); };
    win.addEventListener('pointermove', move => {
      if (!ghost && Math.hypot(move.clientX - start.x, move.clientY - start.y) < 8) return;
      if (!ghost) { ghost = handle.cloneNode(true); ghost.className = 'sw-ghost'; ghost.removeAttribute('data-draggable'); doc.body.append(ghost); handle.classList.add('is-dragging'); }
      ghost.style.left = `${move.clientX}px`; ghost.style.top = `${move.clientY}px`;
      const target = targetAt(move.clientX, move.clientY);
      if (target !== over) { over?.classList.remove('is-drop-target'); over = target; over?.classList.add('is-drop-target'); }
    }, { signal: drag.signal });
    win.addEventListener('pointerup', up => { const target = ghost && targetAt(up.clientX, up.clientY); finish(); if (target) choose(target.dataset.dest); }, { signal: drag.signal });
    win.addEventListener('pointercancel', finish, { signal: drag.signal });
    controller.signal.addEventListener('abort', finish, { once: true });
  }

  host.addEventListener('click', handleClick, { signal: controller.signal });
  host.addEventListener('pointerdown', handlePointerDown, { signal: controller.signal });
  doc.addEventListener('keydown', handleKey, { signal: controller.signal });
  renderMap();
  return cleanup;
}

// Exposed for tests: confirms every scenario has a drawing.
export const ART_NAMES = Object.freeze(Object.keys(ART));
export const SCENARIO_COUNT = Object.keys(ITEMS).length;
