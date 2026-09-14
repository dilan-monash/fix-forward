// Picture help uses the exact authored evidence. It connects a numbered marker
// on the current scene to a larger illustration and a short readable fact.
// It never diagnoses an object, chooses an answer or gives the player points.
import { artwork } from './art.js';

// Authored content is still escaped at the HTML boundary so a future edited
// title or imported sentence cannot accidentally become executable markup.
const safe = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

/** Add visible, numbered evidence markers to the existing story illustration. */
export function sceneClues(item, selectedId) {
  return `<div class="q-scene-evidence" aria-label="Clues in this picture">${item.clues.map((clue, index) => `<button class="q-scene-evidence-pin ${clue.id === selectedId ? 'selected' : ''}" data-picture-clue="${safe(clue.id)}" aria-pressed="${clue.id === selectedId}" aria-label="Look at clue ${index + 1}: ${safe(clue.title)}" style="--pin-x:${Math.min(85, Math.max(15, Number(clue.x) || 50))}%;--pin-y:${Math.min(75, Math.max(20, Number(clue.y) || 50))}%"><span>${index + 1}</span><b>${safe(clue.shortLabel || clue.title)}</b></button>`).join('')}</div>`;
}

/** The selected clue is shown beside an enlarged picture, not in a text-only box.
 * Switching clues only changes this local view; app.js owns discovery/help rules. */
export function pictureHelp(item, selectedId, { close = false, closeLabel = 'Back to my choices' } = {}) {
  const clue = item.clues.find(entry => entry.id === selectedId) || item.clues[0];
  if (!clue) return '';
  const index = item.clues.indexOf(clue);
  return `<section class="q-picture-help" data-picture-help data-read aria-label="Look closely at the story clue"><div class="q-picture-help-art"><span class="q-clue-number">${index + 1}</span>${artwork(clue.artworkId)}<span class="q-clue-art-label">${safe(clue.title)}</span></div><div class="q-picture-help-copy"><p class="q-eyebrow">Clue ${index + 1} of ${item.clues.length} · In this story</p><h2 tabindex="-1" data-picture-help-focus>${safe(clue.title)}</h2><p data-picture-help-text>${safe(clue.text)}</p><div class="q-picture-help-tools"><button class="q-button secondary" data-hear-picture="${safe(clue.id)}" data-hear-fact="${safe(clue.id)}">Hear this clue</button>${close ? `<button class="q-button quiet" data-close-picture-help>${safe(closeLabel)}</button>` : ''}</div><div class="q-picture-help-tabs" aria-label="Choose a picture clue">${item.clues.map((entry, number) => `<button data-picture-clue="${safe(entry.id)}" aria-pressed="${entry.id === clue.id}"><span>${number + 1}</span>${safe(entry.shortLabel || entry.title)}</button>`).join('')}</div></div></section>`;
}

/** A sorting hint pairs the same object with the authored clue. The question
 * mark means information/help is needed; it never pretends a check happened. */
export function sortingPictureHelp(item) {
  if (!item) return '';
  return `<section class="q-picture-help q-sort-picture-help" data-picture-help data-read aria-label="Picture help for this item"><div class="q-picture-help-art">${artwork(item.artworkId)}<span class="q-clue-art-label">${safe(item.title)}</span></div><div class="q-picture-help-copy"><p class="q-eyebrow">Look at this story clue · Help is free</p><h2 data-picture-help-focus tabindex="-1">What do we know?</h2><p data-picture-help-text>${safe(item.clue)}</p><div class="q-picture-help-tools"><button class="q-button secondary" data-hear-sort-clue>Hear this clue</button><button class="q-button primary" data-close-picture-help>Try my choice</button></div></div></section>`;
}
