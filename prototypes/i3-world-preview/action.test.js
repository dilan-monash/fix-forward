/** Adult workspace regressions use invented data and a fresh DOM. They verify
 * interaction and evidence rules; they do not claim real recalls or nearby shops.
 * Run: node --test prototypes/i3-world-preview/action.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountAction, readActionPlan, saveActionPlan } from './action.js';

const settle = () => new Promise(resolve => setImmediate(resolve));

// Each mount owns a DOM and a mocked GET adapter. Listener teardown is always
// exercised at the end so later tests cannot receive a stale API update.
async function makeAction(t, { kind = 'recall', appliance = 'kettle', available = false } = {}) {
  const dom = new JSDOM('<!doctype html><main id="host"></main>', { url: 'http://preview.test/' });
  const previous = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const requests = [], routes = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const path = new URL(url, 'http://preview.test').pathname;
    requests.push({ path, method: options.method || 'GET' });
    if (!available || !path.startsWith('/api/')) return { ok: false, status: 404, json: async () => ({}) };
    const field = path.endsWith('repair-evidence') ? 'evidence' : path.split('/').at(-1);
    return { ok: true, status: 200, json: async () => ({ [field]: [], meta: { retrievalDate: 'Synthetic fixture' } }) };
  });
  const host = dom.window.document.querySelector('#host');
  const dispose = mountAction(host, { route: `action?kind=${kind}&appliance=${encodeURIComponent(appliance)}`, onNavigate: route => routes.push(route) });
  t.after(() => {
    dispose(); dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  });
  await settle(); await settle();
  return { dom, host, requests, routes, dispose, query: selector => host.querySelector(selector) };
}

// Dispatch browser events rather than calling private helpers, exercising the
// actual button -> form listener -> matcher -> visible result chain.
function submit(ui, selector) {
  ui.query(selector).dispatchEvent(new ui.dom.window.Event('submit', { bubbles: true, cancelable: true }));
}
function type(ui, selector, value) {
  ui.query(selector).value = value;
  ui.query(selector).dispatchEvent(new ui.dom.window.Event('input', { bubbles: true }));
}

test('unsupported world item remains exact and cannot masquerade as a clean recall result', async t => {
  const ui = await makeAction(t, { appliance: 'laptop', available: true });
  assert.equal(ui.query('#action-category').value, 'Laptop');
  assert.equal(ui.query('[data-coverage-note]').hidden, false);
  type(ui, '#action-brand', 'Fixture Brand'); type(ui, '#action-model', 'TEST-123');
  submit(ui, '#action-recall-form');
  assert.match(ui.query('#action-recall-result').textContent, /do not cover this item/i);
  assert.doesNotMatch(ui.query('#action-recall-result').textContent, /no exact match|kettle/i);
  ui.query('[data-family-lens]').click();
  assert.equal(ui.routes[0], 'explore?appliance=laptop');
});

test('known engine alias maps to its actual adult category and returns to the same object', async t => {
  const ui = await makeAction(t, { appliance: 'vacuum' });
  assert.equal(ui.query('#action-category').value, 'Vacuum cleaner');
  ui.query('[data-action-kind="repair"]').click();
  assert.equal(ui.routes[0], 'action?kind=repair&appliance=Vacuum%20cleaner');
  ui.query('[data-family-lens]').click();
  assert.equal(ui.routes[1], 'explore?appliance=vacuum');
});

test('a data outage stays unavailable, offers an official source, and performs GET only', async t => {
  const ui = await makeAction(t);
  type(ui, '#action-brand', 'Fixture Brand'); type(ui, '#action-model', 'TEST-ABSENT');
  submit(ui, '#action-recall-form');
  assert.match(ui.query('#action-recall-result').textContent, /records are unavailable/i);
  assert.doesNotMatch(ui.query('#action-recall-result').textContent, /no exact match/i);
  assert.ok(ui.query('#action-recall-result a[href="https://www.productsafety.gov.au/recalls"]'));
  assert.ok(ui.requests.length >= 4);
  assert.ok(ui.requests.every(request => request.method === 'GET'));
  assert.ok(ui.requests.every(request => !/\.onnx|\.wasm/.test(request.path)));
});

test('successful empty records carry limits and identity edits invalidate the previous result', async t => {
  const ui = await makeAction(t, { available: true });
  type(ui, '#action-brand', 'Fixture Brand'); type(ui, '#action-model', 'TEST-ABSENT');
  submit(ui, '#action-recall-form');
  assert.match(ui.query('#action-recall-result').textContent, /no exact match in the records checked/i);
  assert.match(ui.query('#action-recall-result').textContent, /does not prove.*safe/is);
  type(ui, '#action-model', 'CHANGED');
  assert.equal(ui.query('#action-recall-result').textContent, '');
});

test('missing locations never become fictional providers or an empty successful search', async t => {
  const ui = await makeAction(t, { kind: 'repair' });
  type(ui, '#action-area', '3168 — Clayton'); submit(ui, '#action-services-form');
  assert.match(ui.query('#action-service-result').textContent, /have not searched or confirmed nearby places/i);
  assert.doesNotMatch(ui.query('#action-service-result').textContent, /no recorded options within/i);
  assert.equal(ui.query('.action-location'), null);
  assert.ok(ui.query('a[href="https://www.repaircafe.org/en/visit/"]'));
});

test('one postcode covering several suburbs asks the owner instead of inventing a location', async t => {
  const ui = await makeAction(t, { kind: 'recycle', available: true });
  type(ui, '#action-area', '3168'); submit(ui, '#action-services-form');
  assert.match(ui.query('#action-area-options').textContent, /which suburb/i);
  assert.ok(ui.host.querySelectorAll('[data-area-choice]').length > 1);
  assert.equal(ui.query('#action-service-result').textContent, '');
  ui.query('[data-area-choice]').click();
  assert.match(ui.query('#action-service-result').textContent, /no recorded options within 20 km/i);
  assert.match(ui.query('#action-service-result').textContent, /does not mean there are no services nearby/i);
});

test('postcode missing from local index uses an official finder without guessed distances', async t => {
  const ui = await makeAction(t, { kind: 'recycle', available: true });
  type(ui, '#action-area', '3000'); submit(ui, '#action-services-form');
  assert.match(ui.query('#action-service-result').textContent, /not in our local coordinate index/i);
  assert.match(ui.query('#action-service-result').textContent, /have not calculated nearby places or distances/i);
  assert.equal(ui.query('.action-location'), null);
});

test('personal plan persists only selected item/task/date and is explicitly removable', async t => {
  const ui = await makeAction(t, { kind: 'repair', appliance: 'blender' });
  type(ui, '#action-area', '3168 — Clayton');
  const form = ui.query('#action-save-plan');
  form.elements.task.value = 'manual'; form.elements.date.value = '2026-11-01';
  submit(ui, '#action-save-plan');
  assert.deepEqual(readActionPlan(ui.dom.window.localStorage), { appliance: 'Blender', task: 'manual', date: '2026-11-01' });
  assert.doesNotMatch(ui.dom.window.localStorage.getItem('fixforward-world-adult-plan-v1'), /3168|brand|model|area/);
  assert.match(ui.query('[data-plan-status]').textContent, /saved on this browser/i);
  ui.query('[data-delete-plan]').click();
  assert.equal(readActionPlan(ui.dom.window.localStorage), null);
});

test('damaged/uncertain reuse stays a pause and needs no data request to express the plan', async t => {
  const ui = await makeAction(t, { kind: 'reuse', appliance: 'toaster' });
  assert.equal(ui.requests.length, 0);
  const condition = ui.query('#action-reuse-condition'); condition.value = 'unsure';
  condition.dispatchEvent(new ui.dom.window.Event('change', { bubbles: true }));
  assert.equal(ui.query('.action-reuse-warning').hidden, false);
  assert.match(ui.query('.action-reuse-warning').textContent, /pause before passing/i);
  assert.doesNotMatch(ui.query('.action-reuse-status').textContent, /plan is ready/i);
});

test('leaving the workspace removes navigation listeners', async t => {
  const ui = await makeAction(t); ui.dispose();
  ui.query('[data-action-kind="repair"]').click();
  assert.deepEqual(ui.routes, []);
});

test('corrupt or blocked browser storage does not prevent practical planning', () => {
  for (const raw of ['{broken', 'null', '[]', '{"appliance":"Kettle","task":"invented"}']) {
    assert.equal(readActionPlan({ getItem: () => raw }), null);
  }
  assert.equal(readActionPlan({ getItem() { throw new Error('blocked'); } }), null);
  assert.equal(saveActionPlan(null, { appliance: 'Kettle', task: 'manual', date: '' }), false);
  assert.equal(saveActionPlan({ setItem() { throw new Error('full'); } }, { appliance: 'Kettle', task: 'manual', date: '' }), false);
});
