/**
 * Exercise optional inline meanings with a real DOM and a fake reading callback.
 * No browser speaker, storage or game state is used; keyboard focus and literal
 * sentence text remain inspectable without executing a page or injecting HTML.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { addWordHelp } from '../quest/word-help.js';

function fixture(t, html) {
  const dom = new JSDOM(`<main>${html}</main>`);
  t.after(() => dom.window.close());
  const document = dom.window.document;
  const root = document.querySelector('main');
  const readings = [];
  const enhance = () => addWordHelp(root, { read: text => readings.push(text) });
  return { document, root, readings, enhance };
}

test('a meaning sits beside its teaching paragraph and keeps the complete original narration text', t => {
  const f = fixture(t, '<p data-picture-help-text>A qualified repairer checks the appliance before collection.</p>');
  const paragraph = f.root.querySelector('p');
  const transcript = paragraph.textContent;
  f.enhance();
  const words = [...paragraph.querySelectorAll('[data-word]')];
  assert.deepEqual(words.map(button => button.dataset.word), ['qualified repairer', 'appliance', 'collection']);
  const note = paragraph.nextElementSibling;
  assert.ok(note.classList.contains('q-inline-definition'));
  assert.equal(note.hidden, true);
  assert.equal(note.getAttribute('role'), 'note', 'small meanings do not create extra page landmarks');
  assert.equal(note.getAttribute('aria-label'), 'Word meaning');
  assert.ok(words.every(button => button.getAttribute('aria-controls') === note.id));
  words[0].click();
  assert.equal(note.hidden, false);
  assert.match(note.querySelector('p').textContent, /^qualified repairer: A person trained to check and repair/);
  assert.equal(paragraph.textContent, transcript, 'opening a meaning cannot alter the packaged recording match');
  assert.equal(paragraph.querySelector('aside'), null, 'definition text stays out of the narrated paragraph');
});

test('native word buttons toggle one shared note, and Close returns keyboard focus to the current word', t => {
  const f = fixture(t, '<section class="q-guide-dialogue"><p>Repair or reuse this appliance?</p></section>');
  f.enhance();
  const repair = f.root.querySelector('[data-word="repair"]');
  const reuse = f.root.querySelector('[data-word="reuse"]');
  const note = f.root.querySelector('.q-inline-definition');
  assert.equal(repair.tagName, 'BUTTON');
  assert.equal(repair.type, 'button', 'word activation cannot submit a surrounding form');
  assert.equal(repair.tabIndex, 0, 'native controls remain in the keyboard sequence');
  assert.equal(repair.getAttribute('aria-label'), 'What does Repair mean?');
  repair.focus();
  repair.click();
  assert.equal(f.document.activeElement, repair, 'opening a small disclosure does not steal focus');
  assert.equal(repair.getAttribute('aria-expanded'), 'true');
  repair.click();
  assert.equal(note.hidden, true);
  assert.equal(repair.getAttribute('aria-expanded'), 'false');
  repair.click();
  reuse.click();
  assert.equal(repair.getAttribute('aria-expanded'), 'false');
  assert.equal(reuse.getAttribute('aria-expanded'), 'true');
  const close = [...note.querySelectorAll('button')].find(button => button.textContent === 'Back to the clue');
  close.focus();
  close.click();
  assert.equal(note.hidden, true);
  assert.equal(reuse.getAttribute('aria-expanded'), 'false');
  assert.equal(f.document.activeElement, reuse);
});

test('Hear reads only the currently visible definition and never starts speech just by opening it', t => {
  const f = fixture(t, '<div class="q-plan-result"><p>Repair, then check collection.</p></div>');
  f.enhance();
  const note = f.root.querySelector('.q-inline-definition');
  const hear = [...note.querySelectorAll('button')].find(button => button.textContent === 'Hear the meaning');
  f.root.querySelector('[data-word="repair"]').click();
  assert.deepEqual(f.readings, []);
  hear.click();
  assert.deepEqual(f.readings, ['Repair: Fix something so it can work again.']);
  f.root.querySelector('[data-word="collection"]').click();
  hear.click();
  assert.equal(f.readings[1], 'collection: Taking an item to a place that accepts it. Check which items the place takes.');
});

test('duplicate terms and repeated enhancement cannot create duplicate or nested definition controls', t => {
  const f = fixture(t, '<div class="q-plan-result"><p>Repair, repair and <em>REPAIR</em>; ask a qualified repairer.</p></div>');
  const paragraph = f.root.querySelector('p');
  const before = paragraph.textContent;
  f.enhance();
  f.root.querySelector('[data-word="qualified repairer"]').click();
  const existing = f.root.innerHTML;
  f.enhance();
  assert.equal(f.root.innerHTML, existing, 'an opened definition must not be re-enhanced as teaching prose');
  assert.equal(f.root.querySelectorAll('[data-word="repair"]').length, 1);
  assert.equal(f.root.querySelectorAll('[data-word="qualified repairer"]').length, 1);
  assert.equal(f.root.querySelectorAll('.q-inline-definition').length, 1);
  assert.equal(f.root.querySelector('.q-inline-definition [data-word]'), null);
  assert.equal(paragraph.textContent, before);
  assert.equal(paragraph.querySelector('em').textContent, 'REPAIR', 'inline emphasis remains intact');
});

test('sentences own separate identified notes and paragraphs without terms gain no empty note', t => {
  const f = fixture(t, '<p data-picture-help-text>Repair the story.</p><details class="q-full-clue"><p>Reuse the story.</p><p>Look at the fan.</p></details>');
  f.enhance();
  const notes = [...f.root.querySelectorAll('.q-inline-definition')];
  assert.equal(notes.length, 2);
  assert.equal(new Set(notes.map(note => note.id)).size, 2);
  for (const word of f.root.querySelectorAll('[data-word]')) assert.equal(f.document.getElementById(word.getAttribute('aria-controls')), word.closest('p').nextElementSibling);
  assert.equal(f.root.querySelector('details p:last-child').textContent, 'Look at the fan.');
});

test('literal markup remains text and enhancement does not touch links, existing buttons or unrelated UI', t => {
  const f = fixture(t, '<h1>Repair</h1><p id="ordinary">Repair and reuse.</p><button id="next">Collection</button><p data-picture-help-text><a href="#existing">repair</a> <button type="button">reuse</button> <span></span></p>');
  const paragraph = f.root.querySelector('[data-picture-help-text]');
  paragraph.querySelector('span').textContent = 'collection <img src=x onerror=alert(1)> <script>repair()</script>';
  const before = paragraph.textContent;
  const untouched = ['h1', '#ordinary', '#next', 'a', '[data-picture-help-text]>button'].map(selector => [selector, f.root.querySelector(selector).outerHTML]);
  f.enhance();
  assert.equal(paragraph.textContent, before);
  assert.equal(f.root.querySelector('img, script'), null, 'input-looking text is never interpreted as markup');
  for (const [selector, html] of untouched) assert.equal(f.root.querySelector(selector).outerHTML, html);
  assert.equal(f.root.querySelector('a [data-word], button [data-word]'), null);
  assert.equal(f.root.querySelectorAll('[data-word="reuse"]').length, 0, 'existing UI buttons are not turned into nested controls');
});

test('e-waste help does not claim all unwanted electrical items are impossible to reuse', t => {
  const f = fixture(t, '<p data-picture-help-text>Ask about e-waste collection.</p>');
  f.enhance();
  f.root.querySelector('[data-word="e-waste"]').click();
  const meaning = f.root.querySelector('.q-inline-definition p').textContent;
  assert.match(meaning, /Unwanted electrical things/);
  assert.match(meaning, /service that accepts them/);
  assert.doesNotMatch(meaning, /cannot be used|always broken|safe/i);
});
