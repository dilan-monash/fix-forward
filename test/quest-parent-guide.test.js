/**
 * Check the parent renderer without a browser session or network request. These
 * contracts keep privacy/source claims, optional controls and escaped story
 * data accurate while allowing the visual layout and wording to evolve.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderParentGuide } from '../quest/parent-guide.js';

// Parse returned markup only; do not execute scripts or load remote resources.
function guide(options) {
  return new JSDOM(renderParentGuide(options)).window.document;
}

test('the restored family welcome explains the game without an age debate or learning guarantee', () => {
  const page = guide();
  const copy = page.body.textContent;
  assert.equal(page.querySelector('h1').textContent, 'For parents and curious families');
  assert.equal(page.querySelectorAll('h1').length, 1);
  assert.match(page.querySelector('.q-family-welcome').textContent, /picture-story game about caring for the things around us/);
  assert.match(page.querySelector('.q-family-welcome').textContent, /Your child is the decision-maker/);
  assert.match(page.querySelector('.q-family-welcome').textContent, /try again, ask for a hint or hear the words/);
  assert.equal(page.querySelector('#q-parent-age-title'), null);
  assert.doesNotMatch(copy, /Why ages|What about 6 or 13|birthday does not decide/);
  assert.match(copy, /not measured learning improvements or tested this version with children/);
  assert.match(copy, /Pip is the toaster\. Flo is the fan/);
  assert.match(copy, /map is a menu of places to play/);
  assert.equal(page.querySelector('input, form, [data-age-gate]'), null);
  assert.ok(page.querySelector('h1[data-focus][tabindex="-1"]'));
  assert.equal(page.querySelectorAll('details[open]').length, 0);
  assert.equal(page.querySelectorAll('.q-parent-restored-goals article').length, 4);
});

test('the preferred purpose and parent invitation remain below the restored welcome, with the FAQs intact', () => {
  const page = guide();
  assert.match(page.querySelector('#q-parent-purpose-title').textContent, /“Throw it away” is only one possible ending/);
  const firstSection = page.querySelector('.q-parent-guide>section');
  assert.ok(firstSection.classList.contains('q-family-welcome'));
  // The sample never starts a mission itself; the parent chooses when to enter play.
  assert.equal(page.querySelectorAll('.q-parent-demo').length, 1);
  assert.ok(page.querySelector('.q-parent-demo [data-parent-demo][aria-pressed="false"]'));
  assert.equal(page.querySelector('.q-parent-demo [data-mission]'), null);
  assert.ok(page.querySelector('.q-parent-restored-join [data-picker]'));
  assert.match(page.querySelector('.q-parent-restored-join').textContent, /Let your child lead/);
  assert.equal(page.querySelectorAll('.q-parent-restored-goals article svg[aria-hidden="true"]').length, 4);
  assert.deepEqual([...page.querySelectorAll('details>summary')].map(node => node.textContent), [
    'Safety: the adventure stays on screen', 'What do Sparks and levels mean?',
    'Saving, privacy and read aloud', 'Where the ideas and rules come from'
  ]);
});

test('the illustrated learning example connects evidence, a choice and its result without changing game state', () => {
  const page = guide();
  const steps = [...page.querySelectorAll('.q-family-steps>li')];
  assert.deepEqual(steps.map(step => step.querySelector('h3').textContent), ['Look', 'Choose', 'Discover']);
  assert.match(steps[0].textContent, /story report says.*trained repairer checked this fan/s);
  assert.match(steps[1].textContent, /new home for the working fan/);
  assert.match(steps[2].textContent, /which clue helped/);
  for (const step of steps) assert.ok(step.querySelector('svg[aria-hidden="true"]'));
  assert.match(page.querySelector('.q-family-help-note').textContent, /explains the clue.*another try.*do not reduce the reward/s);
  assert.match(page.querySelector('.q-family-art figcaption').textContent, /Pip the toaster.*Flo the fan/s);
  assert.equal(page.querySelector('.q-family-learning [data-mission], .q-family-learning button'), null);
  assert.ok(page.querySelector('.q-family-welcome [data-picker]'));
});

test('active story text is escaped and return controls only appear for resumable work', () => {
  const activeMission = Object.freeze({
    title: '<img src=x onerror=alert(1)>',
    learningGoal: '<script>doNotRun()</script>',
    discussionPrompt: 'Which "clue" & why?'
  });
  const page = guide({ activeMission, canContinueMission: true, canContinueSorting: true });
  assert.equal(page.querySelector('img, script'), null);
  assert.match(page.body.textContent, /<script>doNotRun\(\)<\/script>/);
  assert.ok(page.querySelector('[data-continue]'));
  assert.ok(page.querySelector('[data-nav="sorting"]'));
  const finished = guide({ activeMission });
  assert.equal(finished.querySelector('[data-continue]'), null);
  assert.equal(finished.querySelector('[data-nav="sorting"]'), null);
  assert.equal(guide({ canContinueMission: true }).querySelector('[data-continue]'), null);
});

test('privacy and local-fixture details remain accurate and source links are explicit', () => {
  const ordinary = guide();
  assert.equal(ordinary.querySelector('[href="/test-fixture-info"]'), null);
  const preview = guide({ reviewFixture: true, storageAvailable: false });
  assert.ok(preview.querySelector('[href="/test-fixture-info"]'));
  assert.match(preview.body.textContent, /Saving is blocked.*play during this visit/s);
  assert.doesNotMatch(preview.body.textContent, /Reset my adventure clears/);
  assert.match(preview.body.textContent, /Some voices may use an online service/);
  assert.match(preview.body.textContent, /story voice is made with AI and included with the game/);
  assert.match(preview.body.textContent, /words stay visible.*device's voice.*recording cannot play/s);
  assert.match(preview.body.textContent, /does not record your child or send their voice anywhere/);
  assert.match(preview.body.textContent, /Game sounds start off.*separate from Hear it/s);
  assert.match(preview.body.textContent, /Pause and Resume control reading aloud; Stop ends the reading/);
  assert.match(preview.body.textContent, /Every appliance, check and report in Quest is fictional/);
  assert.match(preview.body.textContent, /leave the item alone and tell a trusted adult/);
  assert.match(preview.body.textContent, /not a school mark, ability rating or measure of waste saved/);
  for (const link of preview.querySelectorAll('a[target="_blank"]')) {
    assert.equal(link.rel, 'noopener');
    assert.match(link.textContent, /opens in a new tab/);
  }
  assert.ok(preview.querySelector('a[href="https://www.unicef.org/innocenti/projects/responsible-innovation-technology-children"]'));
});
