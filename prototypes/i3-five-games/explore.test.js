import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { mountExplore, resolveExploreRoute, filterExploreItems, cameraMessage } from './explore.js';
import { explorePhotoValidation } from './support/explore-photo-helper.js';
import { validateSiglipPhotoContent } from './support/siglip-appliance-classifier.js?v=i3-photo-review-v4';
import { EXPLORE_ITEMS32 } from './support/explore-catalogue.js';
import { CATALOGUE } from './reference/catalogue.js';
import { validateExplorePolicy } from './support/explore-classifier.js';
import { publicAssets } from './serve.mjs';

const tick = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
const photo = { type: 'image/png', size: 24 };
const imageData = 'data:image/png;base64,aGVsbG8=';
function setup(route = '#explore', options = {}) {
  const dom = new JSDOM('<main></main>', { url: 'http://127.0.0.1:5537/' });
  const host = dom.window.document.querySelector('main');
  const routes = [], records = { classify: 0, camera: 0, released: 0 };
  const photoServices = { availability: async () => ({ available: true }), validateContent: async () => {},
    readPreview: async () => imageData, classify: async () => { records.classify++; return { accepted: true, alternatives: [{ slug: 'kettle' }] }; },
    releaseModel: () => { records.released++; }, ...options.photoServices };
  const cleanup = mountExplore(host, { route, onNavigate: path => routes.push(path), ...options, photoServices });
  const click = selector => { const element = host.querySelector(selector); assert.ok(element, selector); element.click(); };
  const upload = async file => { const input = host.querySelector('[data-photo-upload]'); Object.defineProperty(input, 'files', { configurable: true, value: [file] }); input.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await tick(); };
  return { dom, host, routes, records, cleanup, click, upload };
}

test('entry exposes both photo and manual paths plus the separate 3D room', () => {
  const ui = setup();
  assert.match(ui.host.textContent, /Use a photo/); assert.match(ui.host.textContent, /Choose a device/);
  ui.click('[data-explore-world]'); assert.deepEqual(ui.routes, ['#explore?view=world']); ui.cleanup();
});

test('all 32 immutable catalogue entries resolve to a specific actual 3D lesson', () => {
  assert.equal(EXPLORE_ITEMS32.length, 32);
  for (const item of EXPLORE_ITEMS32) {
    assert.ok(CATALOGUE.some(model => model.id === item.worldId), item.slug);
    assert.equal(resolveExploreRoute(`#explore?appliance=${item.slug}`).item, item);
    assert.equal(resolveExploreRoute(`#explore?appliance=${item.worldId}&confirmed=1`).mode, 'detail');
  }
  assert.equal(filterExploreItems('AIR FRYER')[0].slug, 'air_fryer');
  assert.equal(filterExploreItems('hair_dryer')[0].worldId, 'hairdryer');
  assert.equal(filterExploreItems('kettle', 'Workshop').length, 0);
  assert.equal(resolveExploreRoute('#explore?appliance=made-up').invalid, true);
  assert.equal(resolveExploreRoute('#explore?appliance=kettle').mode, 'confirm');
});

test('search and room filters combine without replacing the focused search field', () => {
  const ui = setup('#explore?mode=manual');
  const search = ui.host.querySelector('[data-device-search]'); search.focus(); search.value = 'heater';
  search.dispatchEvent(new ui.dom.window.Event('input', { bubbles: true }));
  assert.equal(ui.host.querySelectorAll('[data-device]').length, 1);
  assert.equal(ui.dom.window.document.activeElement, search);
  const group = ui.host.querySelector('[data-device-group]'); group.value = 'Kitchen';
  group.dispatchEvent(new ui.dom.window.Event('change', { bubbles: true }));
  assert.equal(ui.host.querySelectorAll('[data-device]').length, 0);
  ui.click('[data-clear-search]'); assert.equal(ui.host.querySelectorAll('[data-device]').length, 32); ui.cleanup();
});

test('manual selection requires an explicit confirmation and Back clears the choice', () => {
  const ui = setup('#explore?mode=manual'); ui.click('[data-device="rice_cooker"]');
  assert.match(ui.host.textContent, /Is this your device/); assert.deepEqual(ui.routes, []);
  ui.click('[data-confirm-back]'); assert.equal(ui.host.querySelector('[data-device-confirm]'), null);
  ui.click('[data-device="hair_dryer"]'); ui.click('[data-device-confirm]');
  assert.deepEqual(ui.routes, ['#explore?appliance=hairdryer&confirmed=1']); ui.cleanup();
});

test('invalid route text never enters a template or falls through to kettle', () => {
  const ui = setup('#explore?appliance=%3Cimg%20src=x%20onerror=alert(1)%3E');
  assert.match(ui.host.textContent, /not in our collection/); assert.equal(ui.host.querySelector('img'), null);
  assert.equal(ui.host.querySelector('[data-explore-detail]'), null); ui.cleanup();
});

test('file validation rejects unsupported, empty and oversized photos before preview', async () => {
  assert.match(explorePhotoValidation({ type: 'image/svg+xml', size: 4 }), /JPG, PNG or WebP/);
  assert.match(explorePhotoValidation({ type: 'image/png', size: 0 }), /empty/);
  assert.match(explorePhotoValidation({ type: 'image/png', size: 11 * 1024 * 1024 }), /10 MB/);
  assert.equal(explorePhotoValidation(photo), '');
  let reads = 0;
  const ui = setup('#explore?mode=photo', { photoServices: { readPreview: async () => { reads++; return imageData; } } });
  await ui.upload({ type: 'text/html', size: 12 });
  assert.equal(reads, 0); assert.equal(ui.host.querySelector('[data-photo-check]').disabled, true);
  assert.match(ui.host.querySelector('[data-photo-status]').textContent, /JPG, PNG or WebP/); ui.cleanup();
});

test('actual photo-header validation rejects disguised files and oversized dimensions', async () => {
  const fake = new Blob(['<svg></svg>'], { type: 'image/png' });
  await assert.rejects(validateSiglipPhotoContent(fake));
  const png = new Uint8Array(57); png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  png.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  png.set([73, 68, 65, 84], 37); png.set([73, 69, 78, 68], 49);
  new DataView(png.buffer).setUint32(16, 9000); new DataView(png.buffer).setUint32(20, 9000);
  await assert.rejects(validateSiglipPhotoContent(new Blob([png], { type: 'image/png' })), error => error.code === 'excessive_image_dimensions');
});

test('photo path does not request a camera or classify until the user acts', async () => {
  const ui = setup('#explore?mode=photo', { mediaDevices: { getUserMedia: async () => { ui.records.camera++; throw Object.assign(new Error(), { name: 'NotAllowedError' }); } } });
  await tick(); assert.equal(ui.records.camera, 0); assert.equal(ui.records.classify, 0);
  await ui.upload(photo); assert.equal(ui.records.classify, 0);
  ui.click('[data-photo-check]'); await tick(); assert.equal(ui.records.classify, 1);
  assert.deepEqual(ui.routes, []); ui.click('[data-photo-suggestion="kettle"]'); assert.deepEqual(ui.routes, []);
  ui.click('[data-device-confirm]'); assert.deepEqual(ui.routes, ['#explore?appliance=kettle&confirmed=1']); ui.cleanup();
});

test('untrusted and uncertain classifier alternatives never become invented devices', async () => {
  const ui = setup('#explore?mode=photo', { photoServices: { classify: async () => ({ alternatives: [{ slug: '<script>' }] }) } });
  await ui.upload(photo); ui.click('[data-photo-check]'); await tick();
  assert.equal(ui.host.querySelectorAll('[data-photo-suggestion]').length, 0); assert.match(ui.host.textContent, /not sure/);
  assert.equal(ui.host.querySelector('script'), null); assert.deepEqual(ui.routes, []); ui.cleanup();
});

test('replacing a photo prevents an older preview and older recognition from reappearing', async () => {
  let resolveOld, readCount = 0;
  const ui = setup('#explore?mode=photo', { photoServices: { readPreview: () => ++readCount === 1 ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve('data:image/png;base64,bmV3') } });
  const first = ui.upload(photo); await tick(); await ui.upload({ ...photo, size: 30 });
  resolveOld(imageData); await first;
  assert.equal(ui.host.querySelector('[data-photo-preview] img').getAttribute('src'), 'data:image/png;base64,bmV3');
  ui.click('[data-photo-clear]'); assert.equal(ui.host.querySelector('[data-photo-preview] img').hasAttribute('src'), false);
  assert.equal(ui.host.querySelector('[data-photo-check]').disabled, true); ui.cleanup();
});

test('permission denial keeps manual, native camera-app and upload routes usable', async () => {
  const ui = setup('#explore?mode=photo', { mediaDevices: { getUserMedia: async () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }); } } });
  ui.click('[data-photo-camera]'); await tick();
  assert.match(ui.host.querySelector('[data-photo-status]').textContent, /not allowed/);
  assert.ok(ui.host.querySelector('[data-photo-native][capture="environment"]'));
  assert.ok(ui.host.querySelector('[data-photo-upload]:not([capture])'));
  ui.click('[data-explore-mode="manual"]'); assert.equal(ui.host.querySelectorAll('[data-device]').length, 32);
  assert.match(cameraMessage({ name: 'NotFoundError' }), /No camera/); ui.cleanup();
});

test('a camera permission response arriving after Back stops every returned track', async () => {
  let grant, stops = 0;
  const ui = setup('#explore?mode=photo', { mediaDevices: { getUserMedia: () => new Promise(resolve => { grant = resolve; }) } });
  ui.click('[data-photo-camera]'); ui.click('[data-explore-back]');
  grant({ getTracks: () => [{ stop: () => stops++ }, { stop: () => stops++ }] }); await tick();
  assert.equal(stops, 2); assert.equal(ui.host.querySelector('video'), null); ui.cleanup();
});

test('camera capture stops hardware, previews the captured file and still waits for Check', async () => {
  let stops = 0, captured = 0;
  const ui = setup('#explore?mode=photo', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stops++ }] }) }, captureFrame: async () => { captured++; return photo; } });
  const video = ui.host.querySelector('video'); video.play = async () => {};
  Object.defineProperty(video, 'videoWidth', { value: 640 }); Object.defineProperty(video, 'videoHeight', { value: 480 });
  ui.click('[data-photo-camera]'); await tick(); ui.click('[data-photo-capture]'); await tick();
  assert.equal(stops, 1); assert.equal(captured, 1); assert.equal(ui.records.classify, 0);
  assert.equal(ui.host.querySelector('[data-photo-preview]').hidden, false); assert.equal(ui.host.querySelector('[data-photo-check]').disabled, false); ui.cleanup();
});

test('abort stops an active camera and a late classifier result cannot change the next page', async () => {
  let stops = 0, complete;
  const ui = setup('#explore?mode=photo', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stops++ }] }) }, photoServices: { classify: () => new Promise(resolve => { complete = resolve; }) } });
  ui.host.querySelector('video').play = async () => {}; ui.click('[data-photo-camera]'); await tick();
  await ui.upload(photo); assert.equal(stops, 1);
  ui.click('[data-photo-check]'); ui.click('[data-explore-mode="manual"]');
  complete({ alternatives: [{ slug: 'laptop' }] }); await tick();
  assert.equal(ui.host.querySelectorAll('[data-device]').length, 32); assert.equal(ui.host.querySelector('[data-photo-suggestion]'), null); ui.cleanup();
});

test('external abort releases camera tracks exactly once and cancels photo work', async () => {
  const controller = new AbortController(); let stops = 0;
  const ui = setup('#explore?mode=photo', { signal: controller.signal, mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stops++ }] }) } });
  ui.host.querySelector('video').play = async () => {}; ui.click('[data-photo-camera]'); await tick();
  controller.abort(); ui.cleanup(); assert.equal(stops, 1); assert.equal(ui.host.querySelector('video').srcObject, null);
});

test('unavailable photo service does not load the model and still allows manual selection', async () => {
  const ui = setup('#explore?mode=photo', { photoServices: { availability: async () => ({ available: false, message: 'Paused for checks.' }) } });
  await ui.upload(photo); assert.equal(ui.host.querySelector('[data-photo-check]').disabled, true); assert.equal(ui.records.classify, 0);
  ui.click('[data-explore-mode="manual"]'); ui.click('[data-device="laptop"]'); assert.ok(ui.host.querySelector('[data-device-confirm]')); ui.cleanup();
});

test('detail wrapping retains genuine renderer controls, hides excluded AR and opens world on request', async () => {
  let room = 0, disposed = 0;
  const { mountExplore: mountReference } = await import('./reference/explore.js');
  const ui = setup('#explore?view=world', { detailMount: mountReference,
    photoHelperOptions: { availability: async () => ({ available: false }) },
    worldFactory: async () => ({ setAppliance() {}, setSelectedPart() {}, setExploded() {}, showRoom() { room++; }, dispose() { disposed++; } }) });
  await tick();
  assert.equal(room, 1); assert.equal(ui.host.querySelector('.explore-ar-row').hidden, true);
  assert.equal(ui.host.querySelector('.explore-heading').hidden, true);
  assert.ok(ui.host.querySelector('[data-world="rotate"]')); assert.ok(ui.host.querySelector('[data-tab="care"]'));
  ui.click('[data-explore-mode="manual"]'); assert.equal(disposed, 1); ui.cleanup();
});

test('late asynchronous detail mount receives abort and its eventual cleanup runs', async () => {
  let done, detailSignal, cleaned = 0;
  const ui = setup('#explore?appliance=fan&confirmed=1', { detailMount: (_host, options) => { detailSignal = options.signal; return new Promise(resolve => { done = resolve; }); } });
  await tick(); ui.click('[data-explore-mode="manual"]'); assert.equal(detailSignal.aborted, true);
  done(() => cleaned++); await tick(); assert.equal(cleaned, 1); assert.equal(ui.host.querySelectorAll('[data-device]').length, 32); ui.cleanup();
});

test('reselecting the same device after an internal Back reopens details without hashchange', async () => {
  let mounts = 0;
  const ui = setup('#explore?appliance=kettle&confirmed=1', { detailMount: async () => { mounts++; return () => {}; } });
  ui.dom.reconfigure({ url: 'http://127.0.0.1:5537/#explore?appliance=kettle&confirmed=1' });
  await tick(); ui.click('[data-explore-mode="manual"]'); ui.click('[data-device="kettle"]'); ui.click('[data-device-confirm]'); await tick();
  assert.equal(mounts, 2); assert.ok(ui.host.querySelector('[data-explore-detail]')); ui.cleanup();
});

test('reused live policy remains valid and genuinely enabled without changing calibration', async () => {
  // Resolve the same public policy used by either a clean release or the local review.
  const policy = JSON.parse(await readFile(publicAssets.get('/model/explore-siglip/model_manifest.json'), 'utf8'));
  assert.equal(policy.recognition_enabled, true); assert.ok(validateExplorePolicy(policy));
});

test('photo suggestions scroll into view and focus the result without selecting a device', async () => {
  const ui = setup('#explore?mode=photo'), reveals = [];
  ui.dom.window.HTMLElement.prototype.scrollIntoView = function(options) { reveals.push({ target: this, options }); };
  await ui.upload(photo); ui.click('[data-photo-check]'); await tick();
  const result = ui.host.querySelector('[data-photo-results] h2');
  assert.equal(ui.dom.window.document.activeElement, result);
  assert.equal(reveals.length, 1); assert.equal(reveals[0].target, result); assert.equal(reveals[0].options.behavior, 'smooth');
  assert.deepEqual(ui.routes, []); assert.equal(ui.host.querySelector('[data-device-confirm]'), null); ui.cleanup();
});

for (const outcome of ['uncertain', 'error']) test(`${outcome} photo response reveals the useful message without navigation`, async () => {
  const ui = setup('#explore?mode=photo', { photoServices: { classify: async () => { if (outcome === 'error') throw new Error('Check failed'); return { alternatives: [] }; } } }), reveals = [];
  ui.dom.window.matchMedia = () => ({ matches: true });
  ui.dom.window.HTMLElement.prototype.scrollIntoView = function(options) { reveals.push({ target: this, options }); };
  await ui.upload(photo); ui.click('[data-photo-check]'); await tick();
  const status = ui.host.querySelector('[data-photo-status]');
  assert.equal(ui.dom.window.document.activeElement, status); assert.equal(reveals[0].target, status); assert.equal(reveals[0].options.behavior, 'auto');
  assert.ok(status.textContent.length > 20); assert.deepEqual(ui.routes, []); ui.cleanup();
});

test('leaving Explore between detection and the next frame cancels result reveal', async () => {
  const ui = setup('#explore?mode=photo'), pending = [], reveals = [];
  ui.dom.window.requestAnimationFrame = callback => { pending.push(callback); return pending.length; };
  ui.dom.window.cancelAnimationFrame = () => {};
  ui.dom.window.HTMLElement.prototype.scrollIntoView = function(options) { reveals.push(options); };
  await ui.upload(photo); ui.click('[data-photo-check]'); await tick();
  assert.equal(pending.length, 1); ui.click('[data-explore-mode="manual"]'); pending.forEach(callback => callback());
  assert.equal(reveals.length, 0); assert.match(ui.dom.window.document.activeElement.textContent, /What will you discover/); ui.cleanup();
});

test('invalid photo content reveals the replacement guidance before any classifier call', async () => {
  const ui = setup('#explore?mode=photo', { photoServices: { validateContent: async () => { throw new Error('Bad content'); } } }), reveals = [];
  ui.dom.window.HTMLElement.prototype.scrollIntoView = function() { reveals.push(this); };
  await ui.upload(photo);
  assert.deepEqual(reveals, [ui.host.querySelector('[data-photo-status]')]);
  assert.match(ui.dom.window.document.activeElement.textContent, /could not be read/); assert.equal(ui.records.classify, 0); ui.cleanup();
});
