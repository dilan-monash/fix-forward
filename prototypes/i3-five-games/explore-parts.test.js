import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountExplore } from './reference/explore.js';
import { findAppliance } from './reference/catalogue.js';

/** Exercise the real shared controller with a renderer boundary. Mesh picks and
 * projections are real callback contracts; no GPU is needed to test the UI. */
async function setup(options = {}) {
  const dom = new JSDOM('<main></main>', { url: 'http://127.0.0.1:5537/' });
  const host = dom.window.document.querySelector('main');
  const calls = [];
  let callbacks;
  const world = Object.fromEntries(['setAppliance', 'setSelectedPart', 'setExploded', 'setRotation', 'resetView', 'showRoom', 'dispose'].map(name => [name, (...args) => calls.push([name, ...args])]));
  const cleanup = await mountExplore(host, {
    route: '#explore?appliance=kettle',
    photoHelperOptions: { availability: async () => ({ available: false }), releaseModel: () => {} },
    worldFactory: async (canvas, value) => { callbacks = value; return world; },
    ...options,
  });
  const click = selector => { const target = host.querySelector(selector); assert.ok(target, selector); target.click(); };
  const card = () => host.querySelector('#explore-part-callout');
  const choose = id => click(`.explore-part-list button[data-part="${id}"]`);
  const finish = () => { cleanup(); dom.window.close(); };
  return { dom, host, calls, callbacks, cleanup, click, choose, card, finish };
}

test('each selected part opens its own explanation and replaces the existing card', async () => {
  const ui = await setup();
  const kettle = findAppliance('kettle');
  const card = ui.card();
  assert.equal(card.hidden, true);
  for (const part of kettle.parts) {
    ui.choose(part.id);
    assert.equal(ui.card(), card);
    assert.equal(card.hidden, false);
    assert.equal(card.dataset.part, part.id);
    assert.equal(card.querySelector('h3').textContent, part.name);
    assert.equal(card.querySelector('.explore-part-callout-job').textContent, part.job);
    assert.equal(card.querySelector('.explore-part-callout-material p').textContent, part.material);
    assert.match(ui.host.querySelector('.explore-part-detail').textContent, new RegExp(part.name));
    assert.deepEqual(ui.calls.at(-1), ['setSelectedPart', part.id]);
    assert.equal(ui.host.querySelectorAll('button[data-part][aria-expanded="true"]').length, 2);
  }
  assert.equal(card.querySelector('[role="status"]').getAttribute('aria-atomic'), 'true');
  assert.equal(ui.host.querySelector('.explore-part-detail').getAttribute('role'), 'region');
  ui.finish();
});

test('canvas mesh picks and numbered hotspots share the same part and appliance identity', async () => {
  const ui = await setup();
  ui.callbacks.onPartProjection([{ partId: 'lid', x: .7, y: .35, visible: true }]);
  const hotspot = ui.host.querySelector('.explore-hotspots button[data-part="lid"]');
  assert.equal(hotspot.hidden, false);
  hotspot.focus(); hotspot.click();
  assert.equal(ui.card().querySelector('h3').textContent, 'Lid');
  assert.equal(ui.card().querySelector('.explore-part-callout-number').textContent, '2');
  ui.callbacks.onPartProjection([{ partId: 'lid', x: .8, y: .4, visible: true }]);
  assert.equal(ui.dom.window.document.activeElement, hotspot);
  assert.equal(hotspot.getAttribute('aria-expanded'), 'true');
  ui.callbacks.onSelectPart({ applianceId: 'fan', partId: 'motor' });
  assert.equal(ui.card().dataset.appliance, 'fan');
  assert.equal(ui.card().querySelector('h3').textContent, 'Motor');
  assert.match(ui.card().textContent, /Fan/);
  assert.doesNotMatch(ui.card().textContent, /Kettle|Steam/);
  assert.equal(ui.host.querySelector('.explore-part-list [data-part="motor"]').getAttribute('aria-pressed'), 'true');
  ui.finish();
});

test('keyboard list selection retains focus; Close and Escape dismiss without changing the selected part', async () => {
  const ui = await setup();
  ui.host.querySelector('.explore-part-list [data-part="heater"]').focus();
  ui.choose('heater');
  assert.equal(ui.dom.window.document.activeElement.dataset.part, 'heater');
  assert.ok(ui.dom.window.document.activeElement.closest('.explore-part-list'));
  ui.click('[data-close-part-callout]');
  assert.equal(ui.card().hidden, true);
  assert.equal(ui.card().querySelector('[data-part-callout-content]').textContent, '');
  assert.equal(ui.host.querySelector('.explore-part-list [data-part="heater"]').getAttribute('aria-pressed'), 'true');
  assert.equal(ui.dom.window.document.activeElement.dataset.part, 'heater');
  assert.equal(ui.host.querySelectorAll('button[data-part][aria-expanded="true"]').length, 0);
  ui.choose('heater');
  const close = ui.host.querySelector('[data-close-part-callout]'); close.focus();
  close.dispatchEvent(new ui.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(ui.card().hidden, true);
  assert.equal(ui.dom.window.document.activeElement.dataset.part, 'heater');
  ui.choose('heater'); assert.equal(ui.card().hidden, false);
  ui.finish();
});

test('Care and CO2e remain appliance lessons, close the card, and keep edited energy inputs', async () => {
  const ui = await setup();
  ui.choose('lid'); ui.click('[data-tab="care"]');
  assert.equal(ui.card().hidden, true);
  for (const [title] of findAppliance('kettle').care) assert.ok(ui.host.querySelector('#explore-panel').textContent.includes(title));
  ui.click('[data-tab="parts"]'); assert.equal(ui.card().hidden, true);
  ui.choose('base'); ui.click('[data-tab="impact"]');
  assert.equal(ui.card().hidden, true);
  const input = ui.host.querySelector('[name="watts"]');
  assert.equal(Number(input.value), findAppliance('kettle').watts);
  input.value = '1234'; input.dispatchEvent(new ui.dom.window.Event('input', { bubbles: true }));
  ui.click('[data-tab="parts"]'); ui.choose('heater'); ui.click('[data-tab="impact"]');
  assert.equal(ui.host.querySelector('[name="watts"]').value, '1234');
  ui.click('[data-product="fan"]');
  assert.equal(Number(ui.host.querySelector('[name="watts"]').value), findAppliance('fan').watts);
  ui.click('[data-product="kettle"]'); assert.equal(ui.host.querySelector('[name="watts"]').value, '1234');
  ui.finish();
});

test('room and appliance changes clear stale cards, including renderer-originated overview changes', async () => {
  const ui = await setup();
  ui.choose('lid'); ui.click('[data-world="room"]');
  assert.equal(ui.card().hidden, true);
  ui.callbacks.onPartProjection([]);
  ui.choose('handle');
  assert.equal(ui.card().hidden, false);
  assert.equal(ui.host.querySelector('[data-world="room"]').getAttribute('aria-pressed'), 'false');
  assert.ok(ui.calls.some(call => call[0] === 'setAppliance' && call[1] === 'kettle'));
  ui.callbacks.onStatus({ type: 'room-overview', message: 'Room' });
  assert.equal(ui.card().hidden, true);
  ui.choose('body'); ui.click('[data-product="fan"]');
  assert.equal(ui.card().hidden, true);
  assert.equal(ui.card().dataset.part, undefined);
  ui.choose('blades'); assert.equal(ui.card().querySelector('h3').textContent, 'Blades');
  ui.finish();
});

test('connector follows the selected projected mesh without replacing text, and hides for offscreen or docked cards', async () => {
  const ui = await setup();
  const stage = ui.host.querySelector('.explore-stage');
  const canvas = ui.host.querySelector('canvas');
  Object.defineProperties(canvas, { clientWidth: { value: 800 }, clientHeight: { value: 500 } });
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500 });
  ui.card().getBoundingClientRect = () => ({ left: 18, top: 75, right: 298, bottom: 325, width: 280, height: 250 });
  ui.callbacks.onPartProjection([{ partId: 'lid', x: .75, y: .4, visible: true }]);
  ui.choose('lid');
  const line = ui.host.querySelector('.explore-part-callout-line');
  const copy = ui.card().querySelector('.explore-part-callout-job');
  assert.equal(line.hasAttribute('hidden'), false);
  assert.equal(line.querySelector('circle').getAttribute('cx'), '600');
  ui.callbacks.onPartProjection([{ partId: 'lid', x: .8, y: .5, visible: true }]);
  assert.equal(line.querySelector('circle').getAttribute('cx'), '640');
  assert.equal(ui.card().querySelector('.explore-part-callout-job'), copy);
  ui.callbacks.onPartProjection([]); assert.equal(line.hasAttribute('hidden'), true);
  assert.equal(ui.card().hidden, false);
  ui.callbacks.onPartProjection([{ partId: 'lid', x: .8, y: .5, visible: true }]);
  ui.card().getBoundingClientRect = () => ({ left: 0, top: 512, right: 800, bottom: 720, width: 800, height: 208 });
  ui.dom.window.dispatchEvent(new ui.dom.window.Event('resize'));
  assert.equal(line.hasAttribute('hidden'), true);
  ui.finish();
});

test('text selections still explain the right part when WebGL cannot start', async () => {
  const ui = await setup({ worldFactory: async () => { throw new Error('No GPU'); } });
  ui.choose('heater');
  assert.equal(ui.card().querySelector('h3').textContent, 'Heating element');
  assert.equal(ui.host.querySelector('.explore-part-callout-line').hasAttribute('hidden'), true);
  ui.finish();
});

test('only an offscreen docked explanation reveals itself; visible cards and model overlays leave scroll still', async () => {
  const ui = await setup();
  const reveals = [];
  ui.card().scrollIntoView = options => reveals.push(options);
  ui.host.querySelector('.explore-stage').getBoundingClientRect = () => ({ bottom: 700 });
  ui.card().getBoundingClientRect = () => ({ top: 712, bottom: 940, height: 228 });
  ui.choose('lid');
  assert.deepEqual(reveals, [{ block: 'nearest', behavior: 'instant' }]);
  ui.host.querySelector('.explore-stage').getBoundingClientRect = () => ({ bottom: 480 });
  ui.card().getBoundingClientRect = () => ({ top: 492, bottom: 720, height: 228 });
  ui.choose('handle'); assert.equal(reveals.length, 1);
  ui.host.querySelector('.explore-stage').getBoundingClientRect = () => ({ bottom: 950 });
  ui.card().getBoundingClientRect = () => ({ top: 620, bottom: 840, height: 220 });
  ui.choose('heater'); assert.equal(reveals.length, 1);
  ui.finish();
});

test('adult next steps use the canonical Decide route and preserve the current appliance', async () => {
  const ui = await setup();
  ui.click('[data-product="fan"]');
  for (const link of ui.host.querySelectorAll('.explore-action-links a')) {
    assert.ok(link.getAttribute('href').startsWith('#decide?'));
    const query = new URLSearchParams(link.hash.split('?')[1]);
    assert.equal(query.get('appliance'), 'Fan');
    assert.ok(['recall', 'repair', 'recycle'].includes(query.get('kind')));
  }
  ui.click('[data-tab="care"]');
  assert.equal(ui.host.querySelector('.explore-care-next').getAttribute('href'), '#decide?kind=repair&appliance=Fan');
  ui.finish();
});

test('cleanup closes the card and removes interactions, projections and resize work exactly once', async () => {
  const ui = await setup();
  ui.choose('lid'); ui.cleanup(); ui.cleanup();
  assert.equal(ui.calls.filter(call => call[0] === 'dispose').length, 1);
  assert.equal(ui.card().hidden, true);
  const html = ui.host.innerHTML;
  ui.choose('heater');
  ui.callbacks.onSelectPart({ applianceId: 'fan', partId: 'motor' });
  ui.callbacks.onPartProjection([{ partId: 'lid', x: .2, y: .3, visible: true }]);
  ui.dom.window.dispatchEvent(new ui.dom.window.Event('resize'));
  assert.equal(ui.host.innerHTML, html);
  ui.dom.window.close();
});
