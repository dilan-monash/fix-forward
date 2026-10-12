/** Focused regression tests for what the parent/child can actually do.
 * WebGL and camera AR are validated separately; the injected scene tests the
 * contract between DOM controls, learning state and the real engine API. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { CATALOGUE, calculateImpact, findAppliance, GRID_FACTORS } from './catalogue.js';
import { MODEL_PARTS } from './models.js';
import { mountExplore, layoutHotspots, productIcon } from './explore.js';
import { EXPLORE_ACTIVE_ITEMS } from '../../src/explore-catalogue.js';

/** One fixture per test avoids global DOM state and reproduces route disposal. */
async function fixture(route = 'explore', supported = false, photoHelperOptions = {}) {
  const dom = new JSDOM('<main><div id="host"></div></main>', { url: 'http://127.0.0.1:5524/#explore' });
  const host = dom.window.document.querySelector('#host');
  const calls = [], awards = [], lessons = [];
  let callbacks;
  const engine = Object.fromEntries(['setAppliance', 'setSelectedPart', 'setExploded', 'setRotation', 'resetView', 'showRoom', 'dispose'].map(method => [method, (...args) => calls.push([method, ...args])]));
  engine.isARSupported = supported;
  engine.enterAR = async () => { calls.push(['enterAR']); };
  const cleanup = await mountExplore(host, {
    route, worldFactory: async (canvas, options) => { calls.push(['createWorld', options.appliance]); callbacks = options; return engine; },
    onAward: (...args) => awards.push(args), onLearn: lesson => lessons.push(lesson),
    photoHelperOptions: { availability: async () => ({ available: false }), releaseModel: () => {}, validateContent: async () => ({ width: 1, height: 1 }), ...photoHelperOptions },
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
  assert.equal(CATALOGUE.length, 32);
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
  f.click('.explore-part-list [data-part="heater"]');
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

test('prominent selector exposes all products and synchronises the 3D view and cards', async () => {
  const f = await fixture();
  const picker = f.host.querySelector('[data-product-picker]');
  assert.equal(picker.options.length, EXPLORE_ACTIVE_ITEMS.length);
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
  const mounting = mountExplore(host, { route: 'explore', signal: navigation.signal, worldFactory: () => pendingEngine, photoHelperOptions: { availability: async () => ({ available: false }), releaseModel: () => {} } });
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

test('all four additional appliances retain their care, energy scenario and adult category', async () => {
  for (const [id, category] of [['ricecooker', 'Rice cooker'], ['airfryer', 'Air fryer'], ['coffeemachine', 'Coffee machine'], ['mixer', 'Mixer']]) {
    const f = await fixture(`explore?appliance=${id}&tab=care`);
    assert.equal(f.host.querySelector('#appliance-title').textContent, category);
    assert.equal(f.host.querySelectorAll('.explore-care-list li').length, 3);
    assert.ok(f.host.querySelector('.explore-care-reference a'));
    assert.ok(f.host.querySelector('.explore-care-next').hash.includes(`appliance=${encodeURIComponent(category)}`));
    f.click('[data-tab="impact"]');
    assert.notEqual(f.host.querySelector('[data-impact-result]').textContent, '—');
    f.click('[data-tab="parts"]');
    assert.equal(f.host.querySelectorAll('.explore-part-list button').length, 5);
    const item = findAppliance(id);
    f.click(`[data-answer="${item.challenge.correct}"]`);
    assert.equal(f.lessons[0].appliance, category);
    f.cleanup(); f.dom.window.close();
  }
});

test('projected numbered targets select their real part and hide outside the product view', async () => {
  const f = await fixture();
  f.callbacks.onPartProjection([{ partId: 'heater', x: .4, y: .6, visible: true }]);
  const target = f.host.querySelector('.explore-hotspots [data-part="heater"]');
  assert.equal(target.hidden, false);
  assert.equal(target.style.left, '40%');
  assert.equal(target.style.top, '60%');
  target.click();
  assert.match(f.host.querySelector('.explore-part-detail').textContent, /Heating element/);
  assert.ok(f.calls.some(call => call[0] === 'setSelectedPart' && call[1] === 'heater'));
  f.click('[data-product="kettle"]');
  assert.equal(f.host.querySelector('.explore-hotspots [data-part="heater"]'), target);
  assert.equal(target.hidden, false, 'Reselecting the same model preserves unchanged projected targets');
  f.callbacks.onPartProjection([]);
  assert.equal(target.hidden, true);
  f.cleanup(); f.dom.window.close();
});

test('nearby 3D anchors produce separate finger targets and retain connector endpoints', () => {
  const points = ['body', 'lid', 'handle', 'heater', 'base'].map((partId, index) => ({ partId, x: .5, y: .55 + index * .01, visible: true }));
  for (const width of [320, 480, 700]) {
    const placed = layoutHotspots(points, width, 430);
    assert.equal(placed.length, 5);
    placed.forEach((point, index) => {
      assert.equal(point.anchorX, width * .5);
      assert.ok(point.pixelX >= 25 && point.pixelX <= width - 25);
      for (const other of placed.slice(index + 1)) assert.ok(Math.hypot(point.pixelX - other.pixelX, point.pixelY - other.pixelY) >= 48);
    });
  }
});

/** These assertions deliberately inspect the real scene API calls. A matching
 * title alone would miss the old findAppliance fallback drawing a kettle. */
test('all 32 manual items select their own real geometry and keep parts, care and impact available', async () => {
  const f = await fixture();
  assert.equal(EXPLORE_ACTIVE_ITEMS.length, 32);
  for (const item of EXPLORE_ACTIVE_ITEMS) {
    // First choose another item, so a missing renderer call cannot pass just
    // because this is the same model that was already displayed on entry.
    f.click(`[data-product="${item.worldId === 'fan' ? 'kettle' : 'fan'}"]`);
    f.click(`[data-product="${item.worldId}"]`);
    const product = findAppliance(item.worldId);
    assert.equal(f.calls.filter(call => call[0] === 'setAppliance').at(-1)[1], item.worldId, item.slug);
    assert.equal(f.host.querySelector('#appliance-title').textContent, product.name);
    assert.equal(f.host.querySelector('.explore-workspace').hidden, false);
    assert.equal(f.host.querySelector('.explore-to-action').hidden, false);
    assert.equal(f.host.querySelector('[data-product-picker]').value, item.worldId);
    assert.equal(f.host.querySelectorAll('.explore-part-list button').length, product.parts.length);
    assert.equal(f.host.querySelector('.explore-pending-model'), null);
  }
  f.cleanup(); f.dom.window.close();
});

test('every direct recognition-slug route starts the matching 3D engine, including the 20 added lessons', async () => {
  for (const item of EXPLORE_ACTIVE_ITEMS) {
    const f = await fixture(`explore?appliance=${item.slug}`);
    assert.deepEqual(f.calls.find(call => call[0] === 'createWorld'), ['createWorld', item.worldId], item.slug);
    assert.equal(f.host.querySelector('#appliance-title').textContent, findAppliance(item.worldId).name);
    assert.equal(f.host.querySelector('.explore-pending-model'), null);
    f.cleanup(); f.dom.window.close();
  }
});

test('photo suggestions change no scene before confirmation and map recognition slugs to existing world IDs', async () => {
  let candidate = 'vacuum_cleaner';
  const f = await fixture('explore', false, {
    availability: async () => ({ available: true, experimental: true, downloadSizeMb: 92 }),
    classify: async () => ({ accepted: true, requiresConfirmation: true, alternatives: [{ slug: candidate }] }),
    readPreview: async () => 'data:image/jpeg;base64,ZmFrZQ==',
  });
  for (const [slug, worldId] of [['vacuum_cleaner', 'vacuum'], ['hair_dryer', 'hairdryer'], ['rice_cooker', 'ricecooker'], ['air_fryer', 'airfryer'], ['coffee_machine', 'coffeemachine']]) {
    candidate = slug;
    const input = f.host.querySelector('[data-explore-photo-input]');
    Object.defineProperty(input, 'files', { configurable: true, value: [new f.dom.window.File(['pixels'], 'local.jpg', { type: 'image/jpeg' })] });
    input.dispatchEvent(new f.dom.window.Event('change', { bubbles: true }));
    await new Promise(resolve => setImmediate(resolve));
    const callsBefore = f.calls.length;
    f.click('[data-explore-photo-check]');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.length, callsBefore, 'A photo prediction itself must never change the world');
    f.click('[data-explore-photo-confirm]');
    assert.equal(f.calls.filter(call => call[0] === 'setAppliance').at(-1)[1], worldId);
    assert.equal(f.host.querySelector('[data-product-picker]').value, worldId);
  }
  f.cleanup(); f.dom.window.close();
});

test('manual selection cancels a pending photo guess and prevents late confirmation choices', async () => {
  let finish, inferenceSignal;
  const f = await fixture('explore', false, {
    availability: async () => ({ available: true }),
    classify: (file, { signal }) => { inferenceSignal = signal; return new Promise(resolve => { finish = resolve; }); },
    readPreview: async () => 'data:image/jpeg;base64,ZmFrZQ==',
  });
  const input = f.host.querySelector('[data-explore-photo-input]');
  Object.defineProperty(input, 'files', { configurable: true, value: [new f.dom.window.File(['pixels'], 'local.jpg', { type: 'image/jpeg' })] });
  input.dispatchEvent(new f.dom.window.Event('change', { bubbles: true }));
  await new Promise(resolve => setImmediate(resolve));
  f.click('[data-explore-photo-check]');
  f.click('[data-product="fan"]');
  assert.equal(inferenceSignal.aborted, true);
  finish({ accepted: true, alternatives: [{ slug: 'kettle' }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.host.querySelector('#appliance-title').textContent, 'Fan');
  assert.equal(f.host.querySelector('[data-explore-photo-confirm]'), null);
  f.cleanup(); f.dom.window.close();
});

test('all 32 photo suggestions require confirmation before selecting their matching 3D lesson', async () => {
  let candidate = 'smartphone';
  const f = await fixture('explore', false, {
    availability: async () => ({ available: true }),
    classify: async () => ({ accepted: true, alternatives: [{ slug: candidate }] }),
    readPreview: async () => 'data:image/jpeg;base64,ZmFrZQ==',
  });
  assert.equal(EXPLORE_ACTIVE_ITEMS.length, 32);
  for (const item of EXPLORE_ACTIVE_ITEMS) {
    candidate = item.slug;
    const previous = item.worldId === 'fan' ? 'kettle' : 'fan';
    f.click(`[data-product="${previous}"]`);
    const input = f.host.querySelector('[data-explore-photo-input]');
    Object.defineProperty(input, 'files', { configurable: true, value: [new f.dom.window.File(['pixels'], 'local.jpg', { type: 'image/jpeg' })] });
    input.dispatchEvent(new f.dom.window.Event('change', { bubbles: true }));
    await new Promise(resolve => setImmediate(resolve));
    const callsBefore = f.calls.filter(call => call[0] === 'setAppliance').length;
    f.click('[data-explore-photo-check]');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.host.querySelector('.explore-workspace').hidden, false);
    assert.equal(f.host.querySelector('#appliance-title').textContent, findAppliance(previous).name, 'The current model remains until confirmation');
    assert.equal(f.calls.filter(call => call[0] === 'setAppliance').length, callsBefore, 'No 3D model call before confirmation');
    f.click('[data-explore-photo-confirm]');
    assert.equal(f.host.querySelector('.explore-workspace').hidden, false);
    assert.equal(f.host.querySelector('#appliance-title').textContent, findAppliance(item.worldId).name);
    assert.equal(f.host.querySelector('.explore-help-link').hidden, false);
    assert.equal(f.calls.filter(call => call[0] === 'setAppliance').length, callsBefore + 1);
    assert.equal(f.calls.filter(call => call[0] === 'setAppliance').at(-1)[1], item.worldId, item.slug);
    assert.equal(f.host.querySelector('.explore-pending-model'), null);
  }
  f.cleanup(); f.dom.window.close();
});

test('all 32 items have individual icons, five native groups and a real matching model', async () => {
  assert.equal(EXPLORE_ACTIVE_ITEMS.length, 32);
  const withModels = EXPLORE_ACTIVE_ITEMS.filter(item => item.worldId);
  assert.equal(withModels.length, 32);
  assert.deepEqual(withModels.map(item => item.worldId).sort(), CATALOGUE.map(item => item.id).sort());
  const icons = EXPLORE_ACTIVE_ITEMS.map(item => productIcon(item.worldId || item.slug));
  assert.equal(new Set(icons).size, 32, 'Each item has its own recognisable navigation drawing');
  for (const icon of icons) assert.notEqual(icon, productIcon('unknown'), 'No item should use the generic unknown icon');
  const f = await fixture();
  const picker = f.host.querySelector('[data-product-picker]');
  assert.equal(picker.options.length, 32);
  assert.equal(picker.querySelectorAll('optgroup').length, 5);
  assert.equal(f.host.querySelectorAll('[data-product]').length, 32);
  assert.equal([...picker.options].filter(option => /3D coming next/.test(option.textContent)).length, 0);
  assert.match(f.host.querySelector('.explore-product-picker').textContent, /32 items.*32 available in 3D/);
  for (const item of EXPLORE_ACTIVE_ITEMS) {
    picker.value = item.worldId;
    picker.dispatchEvent(new f.dom.window.Event('change', { bubbles: true }));
    assert.equal(f.host.querySelector('#appliance-title').textContent, findAppliance(item.worldId).name);
    assert.equal(f.host.querySelector(`[data-product="${item.worldId}"]`).getAttribute('aria-pressed'), 'true');
  }
  f.cleanup(); f.dom.window.close();
});

test('group filtering narrows cards without changing the scene and an outside selection reveals its card', async () => {
  const f = await fixture();
  const group = f.host.querySelector('[data-product-group]');
  const visibleCards = () => [...f.host.querySelectorAll('[data-product]')].filter(button => !button.hidden);
  const callsBefore = f.calls.length;
  group.value = 'Workshop';
  group.dispatchEvent(new f.dom.window.Event('change', { bubbles: true }));
  assert.deepEqual(visibleCards().map(button => button.dataset.product), ['cordless_drill', 'sewing_machine']);
  assert.match(f.host.querySelector('[data-product-count]').textContent, /2 items.*Workshop/);
  assert.equal(f.calls.length, callsBefore, 'Filtering is navigation, not a model change');
  assert.equal(f.host.querySelector('[data-product-picker]').options.length, 32, 'All items remain in the top picker');
  const picker = f.host.querySelector('[data-product-picker]');
  picker.value = 'refrigerator';
  picker.dispatchEvent(new f.dom.window.Event('change', { bubbles: true }));
  assert.equal(group.value, 'all');
  assert.equal(visibleCards().length, 32);
  assert.equal(f.host.querySelector('[data-product="refrigerator"]').getAttribute('aria-pressed'), 'true');
  assert.equal(f.host.querySelector('#appliance-title').textContent, 'Refrigerator');
  assert.equal(f.calls.filter(call => call[0] === 'setAppliance').at(-1)[1], 'refrigerator');
  f.cleanup(); f.dom.window.close();
});

/** Every selected part must explain both its material connection and a useful
 * care observation; testing the rendered text catches forgotten template wiring. */
test('every part in all 32 lessons renders its own job, material, care and planet connection', async () => {
  const f = await fixture();
  for (const product of CATALOGUE) {
    f.click(`[data-product="${product.id}"]`);
    for (const part of product.parts) {
      for (const field of ['job', 'material', 'care', 'impact'])
        assert.ok(typeof part[field] === 'string' && part[field].trim().length > 15, `${product.id}/${part.id}: ${field}`);
      f.click(`.explore-part-list [data-part="${part.id}"]`);
      const detail = f.host.querySelector('.explore-part-detail');
      const context = f.host.querySelector('.explore-part-context');
      assert.ok(detail.textContent.includes(part.job), `${product.id}/${part.id}: job visible`);
      assert.ok(detail.textContent.includes(part.material), `${product.id}/${part.id}: material visible`);
      assert.ok(context.textContent.includes(part.care), `${product.id}/${part.id}: care visible`);
      assert.ok(context.textContent.includes(part.impact), `${product.id}/${part.id}: planet connection visible`);
      assert.equal(f.calls.filter(call => call[0] === 'setSelectedPart').at(-1)[1], part.id);
    }
  }
  f.cleanup(); f.dom.window.close();
});

test('all 32 care and impact lessons keep their appliance in adult links and calculate finite example emissions', async () => {
  const f = await fixture('explore?tab=care');
  for (const product of CATALOGUE) {
    f.click(`[data-product="${product.id}"]`);
    f.click('[data-tab="care"]');
    const care = f.host.querySelector('.explore-care-list');
    assert.ok(care.querySelectorAll('li').length >= 3, `${product.id}: practical care steps`);
    for (const [title, detail] of product.care) {
      assert.ok(care.textContent.includes(title));
      assert.ok(care.textContent.includes(detail));
    }
    assert.ok(f.host.querySelector('.explore-care-boundary').textContent.includes('Children explore the digital model'));
    const links = [...f.host.querySelectorAll('.explore-action-links a'), f.host.querySelector('.explore-care-next')];
    for (const link of links) {
      const params = new URLSearchParams(link.hash.split('?')[1]);
      assert.equal(params.get('appliance'), product.category, `${product.id}: adult category is retained`);
      assert.ok(['repair', 'recall', 'recycle'].includes(params.get('kind')));
    }
    f.click('[data-tab="impact"]');
    const values = Object.fromEntries(['watts', 'minutes', 'days', 'factor'].map(name => [name, Number(f.host.querySelector(`[name="${name}"]`).value)]));
    const result = calculateImpact(values);
    assert.ok(Number.isFinite(result?.kgCO2e) && Number.isFinite(result?.kwh), `${product.id}: finite calculation`);
    const displayed = f.host.querySelector('[data-impact-result]').textContent;
    assert.match(displayed, /kg CO₂e/);
    assert.doesNotMatch(displayed, /NaN|undefined|Infinity/);
    assert.equal(f.host.querySelector('[data-impact-error]').textContent, '');
    assert.ok(f.host.querySelector('.explore-impact-tip').textContent.includes(product.energyTip));
    assert.match(f.host.querySelector('.explore-impact-limits').textContent, /excludes making, transporting and disposing/i);
  }
  f.cleanup(); f.dom.window.close();
});

test('charging and continuous appliances explain different power and time assumptions', async () => {
  const f = await fixture('explore?tab=impact');
  const modes = new Set();
  for (const product of CATALOGUE) {
    f.click(`[data-product="${product.id}"]`);
    f.click('[data-tab="impact"]');
    const powerLabel = f.host.querySelector('[name="watts"]').closest('label').textContent;
    const timeLabel = f.host.querySelector('[name="minutes"]').closest('label').textContent;
    modes.add(product.energyMode || 'active');
    if (product.energyMode === 'charging') {
      assert.match(powerLabel, /Charging power/);
      assert.match(timeLabel, /Daily charging time/);
      assert.doesNotMatch(timeLabel, /active time/);
    } else if (product.energyMode === 'continuous-average') {
      assert.match(powerLabel, /Average power/);
      assert.match(timeLabel, /Daily plugged-in time/);
    } else {
      assert.match(powerLabel, /Power/);
      assert.match(timeLabel, /Daily active time/);
    }
  }
  assert.ok(modes.has('charging') && modes.has('continuous-average') && modes.has('active'));
  f.cleanup(); f.dom.window.close();
});
