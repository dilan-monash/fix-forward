/** Focused regression tests for what the parent/child can actually do.
 * WebGL and camera AR are validated separately; the injected scene tests the
 * contract between DOM controls, learning state and the real engine API. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { CATALOGUE, calculateImpact, findAppliance, GRID_FACTORS } from './catalogue.js';
import { MODEL_PARTS } from './models.js';
import { mountExplore } from './explore.js';

/** One fixture per test avoids global DOM state and reproduces route disposal. */
async function fixture(route = 'explore', supported = false) {
  const dom = new JSDOM('<main><div id="host"></div></main>', { url: 'http://127.0.0.1:5524/#explore' });
  const host = dom.window.document.querySelector('#host');
  const calls = [], awards = [], lessons = [];
  let callbacks;
  const engine = Object.fromEntries(['setAppliance', 'setSelectedPart', 'setExploded', 'setRotation', 'resetView', 'showRoom', 'dispose'].map(method => [method, (...args) => calls.push([method, ...args])]));
  engine.isARSupported = supported;
  engine.enterAR = async () => { calls.push(['enterAR']); };
  const cleanup = await mountExplore(host, {
    route, worldFactory: async (canvas, options) => { callbacks = options; return engine; },
    onAward: (...args) => awards.push(args), onLearn: lesson => lessons.push(lesson),
  });
  const click = selector => { const item = host.querySelector(selector); assert.ok(item, `Control exists: ${selector}`); item.click(); return item; };
  const edit = (name, value) => {
    const field = host.querySelector(`[name="${name}"]`); field.value = value;
    field.dispatchEvent(new dom.window.Event('input', { bubbles: true })); return field;
  };
  return { dom, host, calls, awards, lessons, callbacks, cleanup, click, edit };
}

test('electricity calculation converts watts and minutes before applying the published factor', () => {
  const result = calculateImpact({ watts: 2000, minutes: 6, days: 30, factor: GRID_FACTORS.VIC.factor });
  assert.ok(Math.abs(result.kwh - 6) < 1e-10);
  assert.ok(Math.abs(result.kgCO2e - 4.44) < 1e-10);
});

test('zero use is valid but missing, nonfinite, negative and unreasonable entries are not', () => {
  const base = { watts: 1000, minutes: 60, days: 1, factor: .74 };
  assert.equal(calculateImpact({ ...base, minutes: 0 }).kgCO2e, 0);
  for (const bad of ['', null, undefined, -1, Infinity, 'not a number']) assert.equal(calculateImpact({ ...base, watts: bad }), null);
  assert.equal(calculateImpact({ ...base, minutes: 1441 }), null);
  assert.equal(calculateImpact({ ...base, days: 367 }), null);
  assert.equal(calculateImpact({ ...base, factor: 5.1 }), null);
});

test('every catalogue part maps to a real selectable mesh rather than a dead hotspot', () => {
  assert.equal(CATALOGUE.length, 8);
  for (const product of CATALOGUE) assert.deepEqual(product.parts.map(part => part.id).sort(), [...MODEL_PARTS[product.id]].sort());
  assert.equal(findAppliance('Vacuum cleaner').id, 'vacuum');
  assert.equal(findAppliance('Kettle').id, 'kettle');
  assert.equal(findAppliance('unknown arbitrary route').id, 'kettle');
});

test('direct care links open the requested appliance and carry it into adult action', async () => {
  const f = await fixture('explore?appliance=microwave&tab=care');
  assert.equal(f.host.querySelector('#appliance-title').textContent, 'Microwave');
  assert.equal(f.host.querySelector('[data-tab="care"]').getAttribute('aria-selected'), 'true');
  assert.match(f.host.querySelector('.explore-care-list').textContent, /Never remove the cover/);
  const link = f.host.querySelector('.explore-care-next');
  assert.equal(link.hash, '#action?kind=repair&appliance=Microwave');
  f.cleanup(); f.dom.window.close();
});

test('part selection by button updates the mesh and explanation; mesh selection uses the same UI', async () => {
  const f = await fixture();
  f.click('[data-part="heater"]');
  assert.ok(f.calls.some(call => call[0] === 'setSelectedPart' && call[1] === 'heater'));
  assert.match(f.host.querySelector('.explore-part-detail').textContent, /Heating element/);
  f.callbacks.onSelectPart({ applianceId: 'kettle', partId: 'handle' });
  assert.equal(f.host.querySelector('[data-part="handle"]').getAttribute('aria-pressed'), 'true');
  assert.match(f.host.querySelector('.explore-part-detail').textContent, /place to hold/);
  f.cleanup(); f.dom.window.close();
});

test('room selection changes product context without retaining the previous care or action links', async () => {
  const f = await fixture('explore?tab=care');
  f.callbacks.onSelectAppliance('laptop');
  assert.equal(f.host.querySelector('#appliance-title').textContent, 'Laptop');
  assert.match(f.host.querySelector('.explore-care-list').textContent, /securely erase/);
  assert.ok([...f.host.querySelectorAll('.explore-action-links a')].every(link => link.hash.includes('appliance=Laptop')));
  f.cleanup(); f.dom.window.close();
});

test('wrong understanding answer is immediately retryable and only the right answer earns a learning card', async () => {
  const f = await fixture();
  f.click('[data-answer="1"]');
  assert.match(f.host.querySelector('.explore-answer-feedback').textContent, /Try another choice/);
  assert.equal(f.host.querySelector('[data-answer="0"]').disabled, false);
  assert.equal(f.awards.length, 0);
  f.click('[data-answer="0"]');
  assert.equal(f.awards.length, 1);
  assert.deepEqual(f.awards[0].slice(0, 2), ['world-kettle', 10]);
  assert.equal(f.lessons[0].appliance, 'Kettle');
  f.click('[data-answer="0"]');
  assert.equal(f.awards.length, 1);
  f.cleanup(); f.dom.window.close();
});

test('impact inputs recalculate in place, label invalid values, and survive tab changes', async () => {
  const f = await fixture('explore?tab=impact');
  const watts = f.edit('watts', '1000');
  assert.equal(f.host.querySelector('[name="watts"]'), watts, 'Do not replace the field being typed into');
  assert.match(f.host.querySelector('[data-impact-result]').textContent, /2\.22/);
  f.edit('minutes', '');
  assert.equal(f.host.querySelector('[data-impact-result]').textContent, '—');
  assert.match(f.host.querySelector('[data-impact-error]').textContent, /minutes/);
  f.edit('minutes', '12');
  f.click('[data-tab="parts"]'); f.click('[data-tab="impact"]');
  assert.equal(f.host.querySelector('[name="minutes"]').value, '12');
  assert.equal(f.host.querySelector('[name="watts"]').value, '1000');
  f.cleanup(); f.dom.window.close();
});

test('changing region uses that factor; a custom factor is never presented as a government default', async () => {
  const f = await fixture('explore?tab=impact');
  f.edit('region', 'SA');
  assert.equal(f.host.querySelector('[name="factor"]').value, '0.21');
  assert.match(f.host.querySelector('[data-impact-result]').textContent, /1\.26/);
  f.edit('factor', '.5');
  assert.equal(f.host.querySelector('[name="region"]').value, 'custom');
  assert.match(f.host.querySelector('[data-impact-result]').textContent, /^3 kg/);
  f.cleanup(); f.dom.window.close();
});

test('AR support is honest: unsupported devices show guidance and never start a camera session', async () => {
  const f = await fixture();
  f.click('[data-world="ar"]');
  assert.match(f.host.querySelector('#ar-support-status').textContent, /WebXR/);
  assert.equal(f.calls.some(call => call[0] === 'enterAR'), false);
  f.cleanup(); f.dom.window.close();
});

test('AR can start only from the explicit control on a supported renderer', async () => {
  const f = await fixture('explore', true);
  assert.equal(f.calls.some(call => call[0] === 'enterAR'), false);
  f.click('[data-world="ar"]');
  assert.equal(f.calls.some(call => call[0] === 'enterAR'), true);
  f.cleanup(); f.dom.window.close();
});

test('route cleanup stops the scene and removes event handlers', async () => {
  const f = await fixture();
  f.cleanup();
  assert.equal(f.calls.filter(call => call[0] === 'dispose').length, 1);
  const count = f.calls.length;
  f.click('[data-product="fan"]');
  assert.equal(f.calls.length, count, 'Old route controls must not call a disposed renderer');
  f.dom.window.close();
});

test('tab keys activate the next panel without trapping keyboard navigation', async () => {
  const f = await fixture();
  const tab = f.host.querySelector('[data-tab="parts"]');
  tab.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(f.host.querySelector('[data-tab="care"]').getAttribute('aria-selected'), 'true');
  assert.equal(f.dom.window.document.activeElement.dataset.tab, 'care');
  f.cleanup(); f.dom.window.close();
});

test('prominent selector exposes eight products and synchronises the 3D view and cards', async () => {
  const f = await fixture();
  const picker = f.host.querySelector('[data-product-picker]');
  assert.equal(picker.options.length, 8);
  assert.equal(f.host.querySelector('[data-world="enter-room"]'), null);
  picker.value = 'laptop';
  picker.dispatchEvent(new f.dom.window.Event('change', { bubbles: true }));
  assert.equal(f.host.querySelector('#appliance-title').textContent, 'Laptop');
  assert.equal(f.host.querySelector('[data-product="laptop"]').getAttribute('aria-pressed'), 'true');
  assert.ok(f.calls.some(call => call[0] === 'setAppliance' && call[1] === 'laptop'));
  f.cleanup(); f.dom.window.close();
});

test('room overview remains available and AR capability notes never cover the 3D model', async () => {
  const f = await fixture();
  f.callbacks.onStatus({ type: 'ready', message: 'Tap a part to discover it.' });
  f.callbacks.onStatus({ type: 'ar-unavailable', message: 'AR is not supported by this device.' });
  assert.equal(f.host.querySelector('.explore-world-status').textContent, 'Tap a part to discover it.');
  assert.equal(f.host.querySelector('#ar-support-status').textContent, 'AR is not supported by this device.');
  f.click('[data-world="room"]');
  assert.ok(f.calls.some(call => call[0] === 'showRoom'));
  assert.equal(f.host.querySelector('[data-world="room"]').getAttribute('aria-pressed'), 'true');
  f.cleanup(); f.dom.window.close();
});

test('navigating away during asynchronous engine startup never overwrites the next page and disposes once', async () => {
  const dom = new JSDOM('<main id="host"></main>');
  const host = dom.window.document.querySelector('#host');
  const navigation = new AbortController();
  let finishEngine;
  let disposals = 0;
  const pendingEngine = new Promise(resolve => { finishEngine = resolve; });
  const mounting = mountExplore(host, { route: 'explore', signal: navigation.signal, worldFactory: () => pendingEngine });
  navigation.abort();
  host.innerHTML = '<h1>The next page</h1>';
  finishEngine({ dispose: () => { disposals++; } });
  const cleanup = await mounting;
  assert.equal(host.innerHTML, '<h1>The next page</h1>');
  assert.equal(disposals, 1);
  cleanup();
  assert.equal(disposals, 1, 'Root may safely call returned cleanup after the aborted mount resolves');
  dom.window.close();
});
