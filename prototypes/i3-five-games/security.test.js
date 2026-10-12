/** Hostile inputs are synthetic and stay local. These checks cover the active
 * UI's trust boundaries; they do not claim that local game saves are tamperproof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountDecide } from './decide.js';
import { mountExplore, resolveExploreRoute } from './explore.js';
import { getStaticSnapshot } from '../../src/data-service.js';
import { readSave, writeSave, createRound, currentStory, drop, recordHistory, learningRecord, ROUNDS, STORIES } from './reference/fixit-engine.js';
import { validatePhotoFile } from './support/appliance-classifier.js';
import { explorePhotoValidation } from './support/explore-photo-helper.js';
import { validateSiglipPhotoContent } from './support/siglip-appliance-classifier.js?v=i3-photo-review-v4';

const settle = () => new Promise(resolve => setImmediate(resolve));
const stored = value => ({ getItem: () => typeof value === 'string' ? value : JSON.stringify(value) });
const payload = '<img data-security-probe src=x onerror=alert(1)>';

async function decide(t, { route = '#decide', locations = [], recalls = [] } = {}) {
  const dom = new JSDOM('<main></main>', { url: 'https://security-fixture.test/' });
  t.after(() => dom.window.close());
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const host = dom.window.document.querySelector('main');
  const data = { ...getStaticSnapshot(), locations, recalls, availability: { recalls: true, sources: true, repairEvidence: true, locations: true } };
  const cleanup = mountDecide(host, { route, services: {
    loadData: async () => data, loadPrices: async () => ({ prices: [], repairFees: [] }),
    mountPhoto: () => () => {}, loadMap: async () => false,
  } });
  t.after(cleanup);
  await settle(); await settle();
  const query = selector => host.querySelector(selector);
  const input = (selector, value) => { const node = query(selector); node.value = value; node.dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  const submit = selector => query(selector).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  function nextSteps(brand = '', model = '') {
    query('[data-tile="Kettle"]').click();
    input('#dc-brand', brand); input('#dc-model', model); submit('#dc-details');
    for (const node of host.querySelectorAll('[data-question]')) {
      const answer = node.querySelector('input[value="no"]'); answer.checked = true;
      answer.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    }
    submit('#dc-safety');
  }
  return { dom, host, query, input, submit, nextSteps };
}

for (const value of ['__proto__', 'constructor', 'prototype', 'toString', '%E0%A4%A', encodeURIComponent(payload), 'kettle%26step%3Doptions']) {
  test(`Decide rejects unsupported URL appliance ${value}`, async t => {
    const ui = await decide(t, { route: `#decide?appliance=${value}&step=options&safe=true` });
    assert.equal(ui.query('.dc-tile.is-picked'), null);
    assert.equal(ui.query('#dc-details'), null);
    assert.equal(ui.query('.dc-verdict'), null);
    assert.equal(ui.query('[data-security-probe]'), null);
  });
}

test('Explore rejects prototype names, malformed encodings and HTML without reflecting markup', t => {
  const dom = new JSDOM('<main></main>', { url: 'https://security-fixture.test/' });
  t.after(() => dom.window.close());
  const host = dom.window.document.querySelector('main');
  for (const value of ['__proto__', 'constructor', '%E0%A4%A', encodeURIComponent(payload)]) {
    const route = `#explore?appliance=${value}&confirmed=1`;
    assert.equal(resolveExploreRoute(route).item, null);
    const cleanup = mountExplore(host, { route, photoServices: { releaseModel: () => {} } });
    assert.equal(host.querySelector('[data-security-probe]'), null);
    assert.equal(host.querySelector('[data-explore-detail]'), null);
    assert.match(host.textContent, /not in our collection/);
    cleanup();
  }
});

test('API listing markup is inert text and executable URL schemes never become links', async t => {
  const base = { pathway: 'repair', providerType: 'repair_cafe', address: payload, suburb: 'Clayton', postcode: '3168',
    latitude: -37.918, longitude: 145.12, openingHours: payload, verificationNote: payload, sourceRetrievedAt: payload };
  const locations = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)'].map((url, index) =>
    ({ ...base, id: `fixture-${index}`, name: payload, url, sourceUrl: url }));
  const ui = await decide(t, { locations });
  ui.nextSteps();
  ui.input('#dc-area', '3168 — Clayton'); ui.submit('#dc-area-form');
  assert.equal(ui.host.querySelectorAll('.dc-place').length, locations.length);
  assert.ok([...ui.host.querySelectorAll('.dc-place h4')].every(node => node.textContent === payload));
  assert.equal(ui.query('[data-security-probe], script'), null);
  assert.equal(ui.query('a[href^="javascript:"], a[href^="data:"], a[href^="vbscript:"]'), null);
  assert.ok([...ui.host.querySelectorAll('a[target="_blank"]')].every(node => node.rel.split(' ').includes('noopener')));
});

test('untrusted recall links fall back to the official source without inserting markup', async t => {
  const ui = await decide(t, { recalls: [{ id: 'synthetic', categoryCodes: ['kettle'], brand: 'Fixture', productName: payload,
    identifiers: [{ type: 'model', value: 'K-123', normalizedValue: 'K123' }], noticeUrl: 'https://www.productsafety.gov.au.evil.test/notice' }] });
  ui.nextSteps('Fixture', 'K-123');
  assert.match(ui.query('.dc-recall').textContent, /may be affected/);
  assert.ok(ui.query('.dc-recall').textContent.includes(payload));
  assert.equal(ui.query('[data-security-probe]'), null);
  assert.ok([...ui.host.querySelectorAll('.dc-recall a')].every(node => new URL(node.href).hostname === 'www.productsafety.gov.au'));
});

test('Fix-it parent report derives success from answers, not editable success flags', () => {
  const first = ROUNDS[0].stories[0], answer = STORIES[first].answer;
  const wrong = ['repair', 'reuse', 'ewaste', 'adult'].find(target => target !== answer);
  const save = readSave(stored({ version: 2, history: [{ roundId: 1, at: '2026-10-12T00:00:00Z', finished: true,
    items: [{ story: first, tries: [wrong], solved: true }] }] }));
  assert.equal(save.history.length, 1);
  assert.equal(save.history[0].items[0].solved, false);
  assert.equal(save.history[0].finished, false);
  assert.equal(learningRecord(save.history).firstTries, 0);
});

test('Fix-it rejects impossible ordering, duplicate items and prototype story names', () => {
  const first = ROUNDS[0].stories[0], second = ROUNDS[0].stories[1];
  const item = id => ({ story: id, tries: [STORIES[id]?.answer || 'reuse'], solved: true });
  const invalid = [
    [item(first), item(first)], [item(second)], [item('__proto__')], [item('constructor')],
    [{ story: first, tries: [STORIES[first].answer, 'adult'], solved: true }],
    [{ story: first, tries: ['adult'], solved: false }, item(second)],
    Array.from({ length: 200 }, () => item(first)),
    [{ story: first, tries: Array(121).fill('adult'), solved: false }],
  ];
  for (const items of invalid) {
    const save = readSave(stored({ version: 2, history: [{ roundId: 1, at: '2026-10-12T00:00:00Z', items }] }));
    assert.deepEqual(save.history, [], JSON.stringify(items).slice(0, 200));
  }
  assert.equal(Object.prototype.polluted, undefined);
});

test('Fix-it saves preserve real retries and partial rounds across a reload', () => {
  const save = { stars: {}, cards: [], intro: false, history: [] }, round = createRound(1);
  for (const id of ROUNDS[0].stories) {
    const story = currentStory(round);
    assert.equal(story.id, id);
    drop(round, story.answer === 'bin' ? 'repair' : 'bin');
    drop(round, story.answer);
  }
  recordHistory(save, round, { at: '2026-10-12T00:00:00Z' });
  const partial = createRound(2); drop(partial, 'bin');
  recordHistory(save, partial, { finished: false, at: '2026-10-12T01:00:00Z' });
  let text;
  assert.equal(writeSave({ setItem: (_key, value) => { text = value; } }, save), true);
  const restored = readSave(stored(text));
  assert.deepEqual(restored.history, save.history);
  assert.equal(learningRecord(restored.history).retried, ROUNDS[0].stories.length);
});

test('Fix-it treats malformed and oversized storage as an empty optional record', () => {
  for (const data of ['{broken', 'x'.repeat(1_000_001), null]) {
    assert.deepEqual(readSave(stored(data)).history, []);
  }
  assert.deepEqual(readSave({ getItem() { throw new Error('Storage blocked'); } }).history, []);
});

test('Fix-it migrates version-one round history along with its stars and keeps the old story sequence', () => {
  const at = '2026-10-12T00:00:00Z';
  const oldRounds = [
    ['blender-unwanted', 'vacuum-filter', 'microwave-old', 'hairdryer-cord', 'coffee-pump', 'ricecooker-unknown'],
    ['mixer-moving', 'airfryer-smell', 'toaster-lever', 'fan-motor', 'laptop-cousin', 'kettle-cracked'],
  ];
  const history = oldRounds.map((ids, index) => ({ roundId: index + 2, at, finished: true,
    items: ids.map(story => ({ story, tries: ['bin', STORIES[story].answer], solved: true })) }));
  history.unshift({ roundId: 2, at, finished: false, items: [{ story: 'blender-unwanted', tries: ['reuse'], solved: true }] });
  const restored = readSave(stored({ version: 1, stars: { 2: 2, 3: 3 }, history }));
  assert.deepEqual(restored.stars, { 3: 2, 4: 3 });
  assert.deepEqual(restored.history.map(entry => entry.roundId), [3, 3, 4]);
  assert.deepEqual(restored.history.map(entry => entry.items), history.map(entry => entry.items));
  assert.deepEqual(restored.history.map(entry => entry.finished), [false, true, true]);
  assert.ok(restored.history.every(entry => entry.contentVersion === 1));
  let saved;
  assert.equal(writeSave({ setItem: (_key, value) => { saved = value; } }, restored), true);
  assert.deepEqual(readSave(stored(saved)).history, restored.history, 'a later version-two save must retain migrated evidence');
  assert.equal(readSave(stored({ version: 2, history: [{ ...history[1], roundId: 3 }] })).history.length, 0,
    'current rounds still cannot skip the foam-cup story');
});

test('photo helpers reject script formats, forged types and oversized decoded dimensions', async () => {
  for (const type of ['image/svg+xml', 'text/html', 'application/javascript']) {
    const file = new Blob([payload], { type });
    assert.equal(validatePhotoFile(file).ok, false);
    assert.notEqual(explorePhotoValidation(file), '');
  }
  await assert.rejects(validateSiglipPhotoContent(new Blob([payload], { type: 'image/png' })));
  // Only a structural header is needed: rejection must happen before decoding.
  const png = new Uint8Array(57); png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  png.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  png.set([73, 68, 65, 84], 37); png.set([73, 69, 78, 68], 49);
  new DataView(png.buffer).setUint32(16, 100000, false);
  new DataView(png.buffer).setUint32(20, 100000, false);
  await assert.rejects(validateSiglipPhotoContent(new Blob([png], { type: 'image/png' })), { code: 'excessive_image_dimensions' });
});
