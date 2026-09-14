/** HOME STORY TRAIL: draws a small, local SVG world around the authored
 * missions. It reads saved completion state but never changes progress, gives
 * rewards, starts audio, or fetches images. app.js owns the button actions. */
import { artwork } from './art.js';

// These short names match the existing story passport. Art is selected from this
// reviewed list so an unknown input cannot substitute a working/warning picture.
const chapters = Object.freeze({
  'flo-next-home': { title: 'A new home', art: 'fan', place: 'home' },
  'quiet-fan': { title: 'A quiet mystery', art: 'fan', place: 'home' },
  'pip-damaged-cable': { title: 'A warning clue', art: 'toaster-damaged', place: 'home' },
  'kettle-second-chance': { title: 'A second chance', art: 'kettle', place: 'studio' },
  'kettle-last-chapter': { title: 'The next stop', art: 'kettle', place: 'studio' },
  'moving-day-box': { title: 'Two different paths', art: 'boxed-toaster', place: 'station' },
  'bulging-gadget': { title: 'Pause the plan', art: 'battery-shaver', place: 'station' },
  'mystery-glass-jug': { title: 'A missing answer', art: 'glass-jug', place: 'station' },
  'fan-no-takers': { title: 'A fan nobody wants', art: 'fan', place: 'studio' }
});

// Dynamic words and attributes are escaped together. No caller can introduce
// HTML, SVG handlers, or additional navigation controls through a story title.
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

// A tiny original backdrop reuses the neighbourhood palette. Its building and
// path identify the place; the appliance itself is supplied by artwork() above.
// Flags are landmarks, not answers: no animation may imply an appliance is safe.
function island(place) {
  const landmark = place === 'home'
    ? '<path d="M24 91V62l23-17 24 17v29Z" fill="#fff8e9"/><path d="m18 64 29-22 30 22" fill="none"/><path d="M41 91V75h13v16" fill="#e99a7a"/><path d="M28 65h9v9h-9Z" fill="#91b8e8"/>'
    : place === 'studio'
      ? '<path d="M19 91V55h56v36Z" fill="#fff8e9"/><path d="M17 53h60v12H17Z" fill="#e99a7a"/><path d="M24 73h21v18H24Zm29 0h15v10H53Z" fill="#91b8e8"/><path d="m38 42 5-5 8 8-5 5Z" fill="#f4c45d"/>'
      : '<path d="M18 91V62h60v29Z" fill="#fff8e9"/><path d="m14 63 8-14h52l8 14Z" fill="#91b8e8"/><path d="M24 73h17v18H24Zm24 0h22v12H48Z" fill="#b9d9c1"/><path d="m26 53 6 6 6-6m11 6 6-6 6 6" fill="none"/>';
  return `<svg class="q-island-ground" viewBox="0 0 240 165" aria-hidden="true" focusable="false" fill="none" stroke="#112858" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="121" cy="151" rx="86" ry="9" fill="#112858" opacity=".08" stroke="none"/><path d="M16 110q0-30 104-30t104 30v13q0 27-104 27T16 123Z" fill="#b9d9c1"/><ellipse cx="120" cy="109" rx="104" ry="29" fill="#dcebe0"/><path d="M118 86q-37 16-6 27t-3 23" stroke="#fff8e9" stroke-width="15"/>${landmark}<path d="M199 63v42"/><path class="q-island-pennant" d="M200 64h24l-6 9 6 9h-24Z" fill="#f4c45d"/><path d="M31 110v-7m-4 4 4 3 4-3m151 18v-7m-4 4 4 3 4-3" stroke="#22796b"/><circle cx="62" cy="123" r="3" fill="#e99a7a" stroke="none"/></svg>`;
}

// One decorative route per layout connects chapters without creating controls
// or reordering keyboard navigation. All chapters are open from the beginning.
function route() {
  return '<svg class="q-adventure-route q-adventure-route--wide" viewBox="0 0 1000 580" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M125 130H875Q980 130 980 250Q980 290 875 290H125Q20 290 20 390Q20 420 125 420H875"/></svg><svg class="q-adventure-route q-adventure-route--narrow" viewBox="0 0 500 1080" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M125 115H375Q475 115 475 240Q475 270 375 270H125Q25 270 25 350Q25 385 125 385H375Q475 385 475 510Q475 540 375 540H125Q25 540 25 620Q25 655 125 655H375Q475 655 475 780Q475 810 375 810H125Q25 810 25 890Q25 925 125 925H375"/></svg>';
}

/** Render available missions and earned stamps from the controller's state.
 * Every island opens its story, including completed ones. Earned stamps remain
 * visible; the separate My creations page owns postcard editing.
 * Only valid authored completion records count; this renderer never repairs or
 * overwrites a save, and duplicate/unknown input missions cannot inflate totals. */
export function renderAdventureTrail({ missions = [], completed = {}, suggestedId = '' } = {}) {
  const seen = new Set();
  const stories = (Array.isArray(missions) ? missions : []).filter(item => {
    if (!item || !Object.hasOwn(chapters, item.id) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  if (!stories.length) return '';
  const isEarned = id => completed && typeof completed === 'object' && Object.hasOwn(completed, id)
    && completed[id] && typeof completed[id] === 'object' && typeof completed[id].assisted === 'boolean';
  const count = stories.filter(item => isEarned(item.id)).length;
  const allEarned = count === stories.length;
  return `<section class="q-adventure-trail" aria-label="Your story trail">
    <header class="q-adventure-heading"><div><p class="q-adventure-kicker">Your story trail</p><h2>${allEarned ? 'Look how far you have explored!' : `A little world. ${stories.length} big stories.`}</h2><p>${allEarned ? 'Every stamp tells a story. Pick one to play again.' : 'Pick any island. Find a clue. Collect its stamp.'}</p></div><div class="q-adventure-progress"><span class="q-adventure-progress-star" aria-hidden="true">✦</span><p><strong>${count} / ${stories.length}</strong> stamps</p><meter min="0" max="${stories.length}" value="${count}" aria-label="Story stamps collected">${count} of ${stories.length}</meter></div></header>
    <div class="q-adventure-map"><span class="q-adventure-cloud q-adventure-cloud--one" aria-hidden="true"></span><span class="q-adventure-cloud q-adventure-cloud--two" aria-hidden="true"></span>${route()}<ol class="q-adventure-islands">${stories.map((item, index) => {
      const chapter = chapters[item.id];
      const earned = isEarned(item.id);
      const suggested = !earned && item.id === suggestedId;
      const title = typeof item.title === 'string' && item.title.trim() ? item.title : chapter.title;
      return `<li class="q-adventure-stop${earned ? ' is-earned' : ''}${suggested ? ' is-suggested' : ''}" data-chapter="${index + 1}"><button type="button" class="q-adventure-island" data-mission="${escape(item.id)}" aria-label="${escape(`${earned ? 'Replay' : 'Explore'} ${title}${suggested ? '. A story to try next' : ''}`)}"><span class="q-adventure-chapter"><span aria-hidden="true">${earned ? '✓' : index + 1}</span><span class="q-sr">Chapter ${index + 1}${earned ? ', stamp collected' : ''}</span></span>${suggested ? '<span class="q-adventure-next">Try this!</span>' : ''}<span class="q-island-stage" aria-hidden="true">${island(chapter.place)}<span class="q-island-story-art">${artwork(chapter.art)}</span>${earned ? '<span class="q-island-earned-star">✦</span>' : ''}</span><strong class="q-adventure-title">${chapter.title}</strong><span class="q-adventure-action">${earned ? 'Replay story' : item.difficulty === 'trickier' ? 'Trickier story' : 'Explore story'} <span aria-hidden="true">${earned ? '✦' : '→'}</span></span></button></li>`;
    }).join('')}</ol></div>
  </section>`;
}
