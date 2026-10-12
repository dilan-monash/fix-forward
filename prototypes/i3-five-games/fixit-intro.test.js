/** The tutorial must escape the animated page's fixed-position containing block.
 * JSDOM checks the portal and its interaction/lifecycle contract; it cannot prove
 * iPad pixel geometry. Scenes are local stand-ins, so no WebGL or network runs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountFixit } from './reference/fixit.js';
import { SAVE_KEY } from './reference/fixit-engine.js';

const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}
function sceneStub(log) {
  return {
    showItem: async item => log.shown.push(item.id),
    preview() {}, resetStations() {}, setVisible() {},
    accept: async (_id, { onLand } = {}) => onLand?.(), reject: async () => {},
    dispose: () => { log.disposed++; },
  };
}
function setup(t, { storage = memoryStorage(), createScene, beforeMount, abortBeforeMount = false } = {}) {
  const dom = new JSDOM('<button id="outside">Outside the game</button><main id="main" tabindex="-1"><div id="preview-app"></div></main><aside id="already-inert" inert>Other content</aside><div id="announcement"></div>', {
    url: 'http://localhost/#learn?game=fix-it', pretendToBeVisual: true,
  });
  const win = dom.window, doc = win.document, host = doc.querySelector('#preview-app');
  // The real route animation leaves translate:0 0 behind. Fixed descendants
  // must not live under this node even after that animation has finished.
  host.style.translate = '0 0';
  host.style.minHeight = '1800px';
  win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  win.HTMLElement.prototype.scrollIntoView = () => {};
  let x = 12, y = 480;
  const scrollCalls = [];
  Object.defineProperties(win, { scrollX: { configurable: true, get: () => x }, scrollY: { configurable: true, get: () => y } });
  win.scrollTo = (first, second) => {
    if (typeof first === 'object') { x = first.left ?? x; y = first.top ?? y; }
    else { x = first; y = second; }
    scrollCalls.push([x, y]);
  };
  const route = new win.AbortController();
  if (abortBeforeMount) route.abort();
  const log = { shown: [], disposed: 0 };
  beforeMount?.({ win, doc, host });
  const cleanup = mountFixit(host, {
    storage, signal: route.signal, reducedMotion: true,
    createScene: createScene || (async () => sceneStub(log)),
  });
  t.after(() => { cleanup(); dom.window.close(); });
  const modal = () => doc.querySelector('.fx-intro[role="dialog"]');
  const click = async selector => {
    const button = doc.querySelector(selector);
    assert.ok(button, `Expected a tutorial/game control: ${selector}`);
    button.click(); await flush();
  };
  const key = (value, options = {}) => {
    const event = new win.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options });
    (doc.activeElement || doc).dispatchEvent(event);
    return event;
  };
  return { dom, win, doc, host, storage, route, cleanup, modal, click, key, log, scrollCalls };
}

test('first visit places the named modal at the viewport level and focuses its instructions', t => {
  const ui = setup(t);
  const modal = ui.modal();
  assert.ok(modal);
  assert.equal(modal.parentElement, ui.doc.body, 'The fixed tutorial must escape all animated game ancestors');
  assert.equal(ui.host.contains(modal), false);
  assert.equal(modal.getAttribute('aria-modal'), 'true');
  assert.ok(modal.contains(ui.doc.getElementById(modal.getAttribute('aria-labelledby'))));
  assert.ok(modal.contains(ui.doc.activeElement), 'First focus belongs to the tutorial');
  assert.match(modal.textContent, /Look at the clues/);
  assert.equal(ui.doc.body.style.position, 'fixed', 'The page behind the tutorial cannot scroll');
  assert.equal(ui.doc.documentElement.style.overflow, 'hidden');
  assert.equal(ui.doc.querySelector('#main').hasAttribute('inert'), true);
});

test('portalled buttons support next, back, step selection, skip, reopening and starting play', async t => {
  const ui = setup(t);
  await ui.click('[data-intro-next]');
  assert.match(ui.modal().textContent, /Drag it to the right place/);
  await ui.click('[data-intro-back]');
  assert.match(ui.modal().textContent, /Look at the clues/);
  await ui.click('[data-intro-dot="2"]');
  assert.match(ui.modal().textContent, /Win stars and cards/);
  await ui.click('[data-intro-skip]');
  assert.equal(ui.modal(), null);
  assert.equal(JSON.parse(ui.storage.getItem(SAVE_KEY)).intro, true);
  await ui.click('[data-howto]');
  assert.equal(ui.doc.querySelectorAll('.fx-intro').length, 1);
  assert.match(ui.modal().textContent, /Look at the clues/);
  await ui.click('[data-intro-dot="2"]');
  await ui.click('[data-intro-play]');
  assert.equal(ui.modal(), null);
  assert.ok(ui.host.querySelector('.fx-play[data-round-id="1"]'));
  assert.deepEqual(ui.log.shown, ['fan-works']);
  assert.notEqual(ui.doc.body.style.position, 'fixed');
  assert.equal(Boolean(ui.doc.querySelector('#main').hasAttribute('inert')), false);
});

test('keyboard focus remains in the tutorial and Escape returns to its opener', async t => {
  const ui = setup(t);
  await ui.click('[data-intro-skip]');
  const opener = ui.host.querySelector('[data-howto]');
  opener.focus(); await ui.click('[data-howto]');
  const buttons = [...ui.modal().querySelectorAll('button')], first = buttons[0], last = buttons.at(-1);
  last.focus();
  assert.equal(ui.key('Tab').defaultPrevented, true);
  assert.equal(ui.doc.activeElement, first);
  first.focus();
  assert.equal(ui.key('Tab', { shiftKey: true }).defaultPrevented, true);
  assert.equal(ui.doc.activeElement, last);
  // JSDOM allows programmatic focus on inert elements, reproducing a caller
  // such as the route shell trying to focus its main region after mounting.
  ui.doc.querySelector('#outside').focus();
  ui.key('Tab');
  assert.ok(ui.modal().contains(ui.doc.activeElement));
  ui.key('ArrowRight');
  assert.match(ui.modal().textContent, /Drag it to the right place/);
  ui.key('ArrowLeft');
  assert.match(ui.modal().textContent, /Look at the clues/);
  assert.equal(ui.key('Escape').defaultPrevented, true);
  assert.equal(ui.modal(), null);
  assert.equal(ui.doc.activeElement, opener);
});

test('closing restores prior inline styles, inert state and scroll position exactly', async t => {
  let snapshots;
  const ui = setup(t, { beforeMount: ({ doc }) => {
    const body = doc.body.style, html = doc.documentElement.style;
    body.setProperty('position', 'relative'); body.setProperty('top', '7px');
    body.setProperty('left', '3px'); body.setProperty('right', '2px');
    body.setProperty('width', '91%'); body.setProperty('overflow', 'auto', 'important');
    body.setProperty('background-color', 'rgb(1, 2, 3)');
    html.setProperty('overflow', 'scroll', 'important');
    snapshots = [body, html].map(style => [...style].map(name => [name, style.getPropertyValue(name), style.getPropertyPriority(name)]));
  } });
  await ui.click('[data-intro-skip]');
  const restored = [ui.doc.body.style, ui.doc.documentElement.style].map(style => [...style].map(name => [name, style.getPropertyValue(name), style.getPropertyPriority(name)]));
  assert.deepEqual(restored.map(entries => entries.sort()), snapshots.map(entries => entries.sort()));
  assert.equal(Boolean(ui.doc.querySelector('#main').hasAttribute('inert')), false);
  assert.equal(ui.doc.querySelector('#already-inert').hasAttribute('inert'), true);
  assert.deepEqual([ui.win.scrollX, ui.win.scrollY], [12, 480]);
  assert.deepEqual(ui.scrollCalls.at(-1), [12, 480]);
});

test('route abort removes an unfinished tutorial without recording it as seen', async t => {
  const ui = setup(t);
  const detachedNext = ui.modal().querySelector('[data-intro-next]');
  ui.route.abort();
  assert.equal(ui.modal(), null);
  assert.notEqual(ui.doc.body.style.position, 'fixed');
  assert.notEqual(ui.doc.documentElement.style.overflow, 'hidden');
  assert.equal(Boolean(ui.doc.querySelector('#main').hasAttribute('inert')), false);
  assert.equal(ui.doc.querySelector('#already-inert').hasAttribute('inert'), true);
  assert.equal(ui.storage.getItem(SAVE_KEY), null);
  const afterCleanup = ui.host.innerHTML;
  detachedNext.click(); ui.key('ArrowRight'); await flush();
  assert.equal(ui.host.innerHTML, afterCleanup);
  assert.equal(ui.modal(), null);
  assert.doesNotThrow(() => { ui.cleanup(); ui.cleanup(); });
  assert.deepEqual([ui.win.scrollX, ui.win.scrollY], [12, 480]);
});

test('direct cleanup is idempotent and restores scrolling without dismissing permanently', t => {
  const ui = setup(t);
  ui.cleanup(); ui.cleanup();
  assert.equal(ui.modal(), null);
  assert.notEqual(ui.doc.body.style.position, 'fixed');
  assert.notEqual(ui.doc.documentElement.style.overflow, 'hidden');
  assert.equal(ui.storage.getItem(SAVE_KEY), null);
  assert.deepEqual([ui.win.scrollX, ui.win.scrollY], [12, 480]);
});

test('an already aborted mount does not create or lock anything', t => {
  const ui = setup(t, { abortBeforeMount: true });
  assert.equal(ui.modal(), null);
  assert.equal(ui.host.children.length, 0);
  assert.equal(ui.doc.body.style.position, '');
  assert.equal(ui.doc.documentElement.style.overflow, '');
  assert.equal(Boolean(ui.doc.querySelector('#main').hasAttribute('inert')), false);
  assert.equal(ui.storage.getItem(SAVE_KEY), null);
});

test('blocked browser storage does not prevent dismissing and reopening instructions', async t => {
  const ui = setup(t, { storage: {
    getItem() { throw new Error('Synthetic storage unavailable'); },
    setItem() { throw new Error('Synthetic storage unavailable'); },
  } });
  await ui.click('[data-intro-skip]');
  assert.equal(ui.modal(), null);
  await ui.click('[data-howto]');
  assert.ok(ui.modal());
  ui.key('Escape');
  assert.equal(ui.modal(), null);
  assert.notEqual(ui.doc.body.style.position, 'fixed');
});

test('scene failure after Let\'s play releases the tutorial and leaves usable 2D choices', async t => {
  const warning = t.mock.method(console, 'warn', () => {});
  const ui = setup(t, { createScene: async () => { throw new Error('Synthetic WebGL unavailable'); } });
  await ui.click('[data-intro-dot="2"]');
  await ui.click('[data-intro-play]');
  assert.equal(ui.modal(), null);
  assert.notEqual(ui.doc.body.style.position, 'fixed');
  assert.ok(ui.host.querySelector('[data-canvas-wrap].is-2d'));
  const choices = [...ui.host.querySelectorAll('[data-station]')];
  assert.ok(choices.length > 0);
  assert.ok(choices.every(button => !button.disabled));
  assert.equal(warning.mock.callCount(), 1);
});

test('a scene arriving after route abort is disposed and cannot recreate the tutorial', async t => {
  let resolveScene;
  const log = { shown: [], disposed: 0 };
  const delayed = new Promise(resolve => { resolveScene = resolve; });
  const ui = setup(t, { createScene: () => delayed });
  await ui.click('[data-intro-dot="2"]');
  await ui.click('[data-intro-play]');
  assert.equal(ui.modal(), null);
  assert.notEqual(ui.doc.body.style.position, 'fixed');
  ui.route.abort();
  const afterAbort = ui.host.innerHTML;
  resolveScene(sceneStub(log)); await flush();
  assert.equal(log.disposed, 1);
  assert.deepEqual(log.shown, []);
  assert.equal(ui.host.innerHTML, afterAbort);
  assert.equal(ui.modal(), null);
});
