// Only the local review helper is tested here. Synthetic classifier responses
// exercise result placement and confirmation, without downloading model weights.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountPhotoHelper } from './support/photo-helper.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const suggestion = { accepted: true, requiresConfirmation: true, alternatives: [{ slug: 'kettle', category: 'Kettle' }] };

async function setup(t, options = {}) {
  const dom = new JSDOM('<main><div id="helper"></div><button id="manual">Manual selection</button></main>', { url: 'http://127.0.0.1:5537/' });
  const host = dom.window.document.querySelector('#helper'), reveals = [], confirmed = [];
  dom.window.HTMLElement.prototype.scrollIntoView = function(settings) { reveals.push({ target: this, settings }); };
  let chooseManually = 0;
  const dispose = mountPhotoHelper(host, { availability: async () => ({ enabled: true }), recognise: async () => suggestion,
    createPreview: async () => 'data:image/png;base64,dGVzdA==', releaseSession: async () => {},
    onConfirm: item => confirmed.push(item), onChooseManually: () => chooseManually++, ...options });
  t.after(() => { dispose(); dom.window.close(); }); await settle();
  const choose = (file = { type: 'image/png', size: 100 }) => {
    const input = host.querySelector('#appliance-photo'); Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new dom.window.Event('change'));
  };
  return { dom, host, reveals, confirmed, choose, dispose, manual: () => chooseManually };
}

test('adult suggestions scroll and focus their heading without confirming the appliance', async t => {
  const ui = await setup(t); ui.choose(); await settle();
  const heading = ui.host.querySelector('#photo-result-title');
  assert.equal(ui.dom.window.document.activeElement, heading); assert.equal(ui.reveals.length, 1);
  assert.equal(ui.reveals[0].target, heading); assert.equal(ui.reveals[0].settings.behavior, 'smooth');
  assert.deepEqual(ui.confirmed, []); ui.host.querySelector('#confirm-photo-appliance').click(); assert.equal(ui.confirmed[0].slug, 'kettle');
});

for (const outcome of ['uncertain', 'error', 'invalid-file']) test(`adult ${outcome} result reveals a useful message`, async t => {
  const ui = await setup(t, { recognise: async () => { if (outcome === 'error') throw new Error('Synthetic failure'); return { accepted: false, reason: 'not_sure' }; } });
  ui.dom.window.matchMedia = () => ({ matches: true });
  ui.choose(outcome === 'invalid-file' ? { type: 'text/html', size: 5 } : undefined); await settle();
  const status = ui.host.querySelector('#photo-detect-status');
  assert.equal(ui.dom.window.document.activeElement, status); assert.equal(ui.reveals[0].target, status);
  assert.equal(ui.reveals[0].settings.behavior, 'auto'); assert.ok(status.textContent.length > 20); assert.deepEqual(ui.confirmed, []);
});

test('adult manual cancellation discards the photo and prevents a late inference from revealing itself', async t => {
  let finish;
  const ui = await setup(t, { recognise: () => new Promise(resolve => { finish = resolve; }) });
  ui.choose(); await settle(); ui.host.querySelector('#photo-choose-manually').click();
  finish(suggestion); await settle();
  assert.equal(ui.host.querySelector('#photo-selected-preview').hidden, true); assert.equal(ui.host.querySelector('#photo-selected-preview img'), null);
  assert.equal(ui.host.querySelector('#photo-result-title'), null); assert.equal(ui.reveals.length, 0); assert.equal(ui.manual(), 1);
});

test('cancelling the native chooser removes the previous preview and queued result reveal', async t => {
  const ui = await setup(t), frames = [];
  ui.dom.window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  ui.dom.window.cancelAnimationFrame = () => {};
  ui.choose(); await settle(); assert.equal(frames.length, 1);
  ui.host.querySelector('#appliance-photo').dispatchEvent(new ui.dom.window.Event('cancel'));
  frames.forEach(callback => callback());
  assert.equal(ui.reveals.length, 0); assert.equal(ui.host.querySelector('#photo-selected-preview img'), null); assert.deepEqual(ui.confirmed, []);
});

test('disposing after a result renders but before the frame runs cancels scroll and clears the image', async t => {
  const ui = await setup(t), frames = [];
  ui.dom.window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  ui.dom.window.cancelAnimationFrame = () => {};
  ui.choose(); await settle(); ui.dispose(); frames.forEach(callback => callback());
  assert.equal(ui.reveals.length, 0); assert.equal(ui.host.querySelector('#photo-selected-preview img'), null);
  assert.equal(ui.host.querySelector('#photo-result-title'), null);
});

test('a late preview cannot restore photo data after manual cancellation', async t => {
  let previewReady;
  const ui = await setup(t, { createPreview: () => new Promise(resolve => { previewReady = resolve; }), recognise: () => new Promise(() => {}) });
  ui.choose(); await settle(); ui.host.querySelector('#photo-choose-manually').click();
  previewReady('data:image/png;base64,bGF0ZQ=='); await settle();
  assert.equal(ui.host.querySelector('#photo-selected-preview img'), null); assert.equal(ui.reveals.length, 0);
});

test('public cancel clears results while leaving future photo uploads usable', async t => {
  const ui = await setup(t); ui.choose(); await settle();
  assert.ok(ui.host.querySelector('#photo-result-title')); ui.dispose.cancel();
  assert.equal(ui.host.querySelector('#photo-result-title'), null); assert.equal(ui.host.querySelector('#photo-selected-preview img'), null);
  ui.choose(); await settle(); assert.ok(ui.host.querySelector('#photo-result-title')); assert.deepEqual(ui.confirmed, []);
});
