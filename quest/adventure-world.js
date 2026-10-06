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
  return `<section class="q-adventure-trail" aria-label="Your story trail">
    <header class="q-adventure-heading"><h2 class="q-sr">Stories</h2><div class="q-adventure-progress"><span class="q-adventure-progress-star" aria-hidden="true">✦</span><p><strong>${count} / ${stories.length}</strong> stamps</p><meter min="0" max="${stories.length}" value="${count}" aria-label="Story stamps collected">${count} of ${stories.length}</meter></div></header>
    <div class="q-story-coach" aria-hidden="true"><span class="q-story-coach-pointer">☝</span><span>Point to, focus or tap a picture to see its story.</span></div>
    <div class="q-adventure-map"><ol class="q-adventure-islands">${stories.map((item, index) => {
      const chapter = chapters[item.id];
      const earned = isEarned(item.id);
      const suggested = !earned && item.id === suggestedId;
      const title = typeof item.title === 'string' && item.title.trim() ? item.title : chapter.title;
      const summary = typeof item.childSummary === 'string' && item.childSummary.trim() ? item.childSummary : title;
      const hintId = `q-story-hint-${index + 1}`;
      return `<li class="q-adventure-stop${earned ? ' is-earned' : ''}${suggested ? ' is-suggested' : ''}" data-chapter="${index + 1}"><button type="button" class="q-adventure-island" data-mission="${escape(item.id)}" aria-label="${escape(`${earned ? 'Replay' : 'Explore'} ${title}${suggested ? '. A story to try next' : ''}`)}" aria-describedby="${hintId}" aria-expanded="false"><span class="q-adventure-chapter"><span aria-hidden="true">${earned ? '✓' : index + 1}</span><span class="q-sr">Chapter ${index + 1}${earned ? ', stamp collected' : ''}</span></span><span class="q-island-stage" aria-hidden="true"><span class="q-island-story-art">${artwork(chapter.art)}</span>${earned ? '<span class="q-island-earned-star">✦</span>' : ''}</span><strong class="q-adventure-title">${chapter.title}</strong><span class="q-story-bubble" id="${hintId}" role="tooltip">${escape(summary)}<small>${earned ? 'Tap to replay' : 'Tap to explore'}</small></span>${item.difficulty === 'trickier' && !earned ? '<span class="q-adventure-action">Trickier</span>' : ''}</button></li>`;
    }).join('')}</ol></div>
  </section>`;
}
