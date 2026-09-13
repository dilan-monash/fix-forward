/**
 * Picture-first summaries for the existing Quest layout. These drawings describe
 * reviewed story facts; they never assess a real appliance, select an answer, or
 * award progress. app.js keeps the full authored condition in its reading panel.
 */
import { artwork, rewardBurst } from './art.js';
import { SORT_ITEMS } from './content.js';

// Reuse the illustration library. Small authored symbols add a visible meaning
// where another appliance portrait would merely repeat the large draggable item.
const icon = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 90" aria-hidden="true" focusable="false" fill="none" stroke="#112858" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const symbols = Object.freeze({
  pause: icon('<rect x="15" y="10" width="70" height="68" rx="20" fill="#f8dbaa"/><path d="M39 31v25m22-25v25" stroke-width="9"/>'),
  finished: icon('<path d="M25 13h53v61H25q-10 0-10-9V22q0-9 10-9Z" fill="#91b8e8"/><path d="M25 61h53v13H25q-10 0-10-7t10-6Z" fill="#fffaf0"/><path d="M25 13v48m8 7h37" stroke="#22796b"/><path d="M59 13v24l-8-5-8 5V13" fill="#f4c45d"/>'),
  checked: icon('<path d="M16 14h48v62H16z" fill="#fffaf0"/><path d="M25 27h25m-25 12h17" stroke="#91b8e8"/><circle cx="61" cy="51" r="19" fill="#d8e9f6"/><path d="m54 50 6 7 10-14" stroke="#22796b"/><path d="m75 66 13 13" stroke-width="8"/>'),
  clean: icon('<path d="M21 24h50l9 51H13z" fill="#fffaf0"/><path d="m69 10 3 10 11 3-11 3-3 11-3-11-10-3 10-3z" fill="#f4c45d"/><path d="m36 39 2 7 8 2-8 2-2 8-2-8-8-2 8-2z" fill="#b9d9c1"/><path d="M26 65h39" stroke="#91b8e8"/>'),
  noCover: icon('<path d="M29 23h37v48H29z" fill="#fffaf0"/><path d="m24 15 49 5 6 57-57-3z" fill="#91b8e8" fill-opacity=".35" stroke-dasharray="5 5"/><path d="m14 77 72-63" stroke="#a9513b" stroke-width="5"/>'),
  separate: icon('<path d="M12 38h25v31H12z" fill="#f4c45d"/><path d="M63 27h25v42H63z" fill="#91b8e8"/><path d="M47 20v52" stroke="#22796b" stroke-dasharray="4 7"/><path d="m31 14-8 7 8 7m-8-7h15m31-7 8 7-8 7m8-7H62"/>'),
  dry: icon('<path d="M39 11C34 24 23 32 23 44a16 16 0 0 0 32 0C55 32 44 24 39 11Z" fill="#d8e9f6"/><path d="m13 67 50-54" stroke="#a9513b" stroke-width="5"/><path d="M65 55h19v23H58V62z" fill="#fffaf0"/><path d="M64 66h13m-13 6h13" stroke="#91b8e8"/>'),
  look: icon('<path d="M14 16h43v59H14z" fill="#fffaf0"/><path d="M23 29h23m-23 10h15" stroke="#91b8e8"/><circle cx="56" cy="46" r="22" fill="#b9d9c1" fill-opacity=".65"/><circle cx="56" cy="46" r="15" fill="#fffaf0"/><path d="m72 63 16 16" stroke-width="10"/><path d="m51 45 4 5 7-10" stroke="#22796b"/>'),
  choose: icon('<rect x="10" y="9" width="33" height="39" rx="8" fill="#b9d9c1"/><rect x="57" y="9" width="33" height="39" rx="8" fill="#f8dbaa"/><path d="m20 27 5 5 10-12" stroke="#22796b"/><path d="M51 77V46q0-7-6-7t-6 7v15l-7-8q-6-6-10 0l14 26q3 5 11 5h12q10 0 10-12V61q0-6-7-6l-11-3" fill="#e99a7a"/>')
});

// Each label is deliberately short. Conditions about an unfinished check or an
// unknown collection place must stay visible: an appliance shape is not a clue
// that something works, is safe, or belongs in a particular collection stream.
const facts = Object.freeze({
  'kettle-ready': [{ art: 'evidence', label: "Repairer's check finished" }, { symbol: 'finished', label: 'No more use or repair' }, { art: 'kettle', label: 'Kettle + electrical base' }],
  'toaster-ready': [{ art: 'evidence', label: "Repairer's check finished" }, { symbol: 'finished', label: 'No more use or repair' }],
  'fan-ready': [{ art: 'evidence', label: "Repairer's check finished" }, { symbol: 'finished', label: 'No more use or repair' }],
  'shaver-ready': [{ art: 'evidence', label: "Repairer's check finished" }, { symbol: 'finished', label: 'No more use or repair' }, { symbol: 'checked', label: 'No warning signs' }],
  'toaster-box': [{ art: 'cardboard', label: 'Empty cardboard box' }, { symbol: 'clean', label: 'Clean and plain' }, { symbol: 'separate', label: 'Toaster is separate' }],
  'kettle-box': [{ art: 'cardboard', label: 'Empty cardboard box' }, { symbol: 'clean', label: 'Clean and plain' }, { symbol: 'separate', label: 'Kettle is separate' }],
  'office-paper': [{ art: 'paper', label: 'Clean paper, not needed' }, { symbol: 'noCover', label: 'No plastic cover' }],
  'newspaper': [{ art: 'newspaper', label: 'Clean newspaper' }, { symbol: 'dry', label: 'Dry paper' }, { symbol: 'separate', label: 'Nothing attached' }],
  'shaver-warning': [{ art: 'battery-shaver', label: 'Battery is bulging', warning: true }, { symbol: 'pause', label: 'Stop the usual plan', warning: true }],
  'fan-unassessed': [{ art: 'fan', label: 'Fan stopped working' }, { art: 'empty-report', label: 'Nobody has checked why' }],
  'jug-unknown': [{ art: 'glass-jug', label: 'Jug from an appliance' }, { art: 'missing-answer', label: 'Collection place unknown' }],
  'toaster-unknown': [{ art: 'toaster', label: 'The note says it works' }, { art: 'empty-report', label: 'Next plan not checked' }]
});

// Render only fixed reviewed content. Caller-supplied text never becomes HTML;
// unknown IDs return nothing so the controller can retain the original sentence.
export function sortingVisualClues(item) {
  const reviewed = SORT_ITEMS.find(entry => entry.id === item?.id);
  const entries = reviewed && facts[reviewed.id];
  if (!entries) return '';
  return `<ul class="q-visual-clues${entries.length === 3 ? ' q-visual-clues--three' : ''}" aria-label="Picture clues from this story">${entries.map(entry => `<li class="q-visual-clue${entry.warning ? ' q-visual-clue--warning' : ''}"><span class="q-visual-clue-art" aria-hidden="true">${entry.art ? artwork(entry.art) : symbols[entry.symbol]}</span><strong>${entry.label}</strong></li>`).join('')}</ul>`;
}

/** A short picture route explains how to play without another paragraph. The
 * active step names a stage, not a clickable control or an earned achievement. */
export function playTrail({ step = 'look' } = {}) {
  const stages = [
    { id: 'look', label: 'Look', picture: symbols.look },
    { id: 'choose', label: 'Choose', picture: symbols.choose },
    { id: 'celebrate', label: 'Discover', picture: rewardBurst({ kind: 'win' }) }
  ];
  const current = stages.some(stage => stage.id === step) ? step : 'look';
  return `<ol class="q-play-trail" aria-label="Your picture adventure">${stages.map(stage => `<li class="q-play-trail-step${stage.id === current ? ' is-current' : ''}"${stage.id === current ? ' aria-current="step"' : ''}><span class="q-play-trail-art" aria-hidden="true">${stage.picture}</span><strong>${stage.label}</strong></li>`).join('')}</ol>`;
}
