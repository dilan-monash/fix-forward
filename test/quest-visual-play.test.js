/** Picture summaries must retain decisive story facts and never create controls,
 * answers or progress. DOM checks cover accessible words and authored art; real
 * device layout is reviewed in the browser rather than simulated by jsdom. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { SORT_ITEMS } from '../quest/content.js';
import { sortingVisualClues, playTrail } from '../quest/visual-play.js';

// Parse a returned component without loading scripts, network resources or saves.
const fragment = markup => JSDOM.fragment(markup);
const labels = id => [...fragment(sortingVisualClues(SORT_ITEMS.find(item => item.id === id))).querySelectorAll('strong')].map(element => element.textContent);

test('every reviewed sorting picture has two or three short illustrated facts without answer buttons', () => {
  for (const item of SORT_ITEMS) {
    const before = structuredClone(item);
    const content = fragment(sortingVisualClues(item));
    const rows = [...content.querySelectorAll('.q-visual-clue')];
    assert.ok(rows.length >= 2 && rows.length <= 3, item.id);
    for (const row of rows) {
      assert.ok(row.querySelector('svg'), `${item.id} has a picture for each fact`);
      assert.equal(row.querySelector('svg').getAttribute('aria-hidden'), 'true');
      assert.ok(row.querySelector('strong').textContent.split(/\s+/).length <= 7, item.id);
    }
    assert.equal(content.querySelector('button, a, input, [data-destination], [id]'), null);
    assert.deepEqual(item, before);
  }
});

test('collection summaries retain both the finished check and the no-further-use-or-repair condition', () => {
  for (const id of ['kettle-ready', 'toaster-ready', 'fan-ready', 'shaver-ready']) {
    assert.ok(labels(id).includes("Repairer's check finished"), id);
    assert.ok(labels(id).includes('No more use or repair'), id);
    assert.doesNotMatch(labels(id).join(' '), /safe|fixed|repaired|recycled/i);
  }
  assert.ok(labels('kettle-ready').includes('Kettle + electrical base'));
  assert.ok(labels('shaver-ready').includes('No warning signs'));
});

test('unresolved stories show what is missing instead of visually pretending a check happened', () => {
  assert.deepEqual(labels('fan-unassessed'), ['Fan stopped working', 'Nobody has checked why']);
  assert.deepEqual(labels('jug-unknown'), ['Jug from an appliance', 'Collection place unknown']);
  assert.deepEqual(labels('toaster-unknown'), ['The note says it works', 'Next plan not checked']);
  const warning = fragment(sortingVisualClues(SORT_ITEMS.find(item => item.id === 'shaver-warning')));
  assert.deepEqual(labels('shaver-warning'), ['Battery is bulging', 'Stop the usual plan']);
  assert.equal(warning.querySelectorAll('.q-visual-clue--warning').length, 2);
  assert.ok(warning.querySelector('.q-warning-object'));
});

test('packaging facts retain clean, separate and material clues rather than guessing from a printed appliance', () => {
  for (const id of ['toaster-box', 'kettle-box']) {
    assert.ok(labels(id).includes('Empty cardboard box'));
    assert.ok(labels(id).includes('Clean and plain'));
    assert.match(labels(id).at(-1), /is separate$/);
  }
  assert.deepEqual(labels('office-paper'), ['Clean paper, not needed', 'No plastic cover']);
  assert.deepEqual(labels('newspaper'), ['Clean newspaper', 'Dry paper', 'Nothing attached']);
});

test('unknown sorting inputs cannot invent facts or insert caller markup', () => {
  for (const item of [null, {}, { id: 'unknown' }, { id: '<img src=x onerror=alert(1)>' }]) assert.equal(sortingVisualClues(item), '');
  const markup = sortingVisualClues({ id: 'jug-unknown', title: '<script>changed</script>' });
  assert.doesNotMatch(markup, /script|changed/);
});

test('the picture route exposes one current stage and keeps Look, Choose and Discover as readable instructions', () => {
  for (const [step, expected] of [['look', 'Look'], ['choose', 'Choose'], ['celebrate', 'Discover'], ['unknown', 'Look']]) {
    const content = fragment(playTrail({ step }));
    assert.deepEqual([...content.querySelectorAll('strong')].map(element => element.textContent), ['Look', 'Choose', 'Discover']);
    assert.equal(content.querySelectorAll('[aria-current="step"]').length, 1);
    assert.equal(content.querySelector('[aria-current="step"] strong').textContent, expected);
    assert.equal(content.querySelectorAll('svg').length, 3);
    assert.equal(content.querySelector('button, a, input'), null);
  }
});
