import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { revealResult } from './result-reveal.js';

function setup() {
  const dom = new JSDOM('<header class="ff-header" style="position:sticky"></header><main><h2>Photo result</h2></main>');
  const doc = dom.window.document, target = doc.querySelector('h2'), scrolls = [], frames = new Map();
  let frameId = 0;
  dom.window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  dom.window.cancelAnimationFrame = id => frames.delete(id);
  dom.window.matchMedia = () => ({ matches: false });
  doc.querySelector('header').getBoundingClientRect = () => ({ bottom: 86.4 });
  target.scrollIntoView = options => scrolls.push(options);
  return { dom, doc, target, scrolls, flush: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); } };
}

test('photo result receives focus and scrolls below the measured sticky header after rendering', () => {
  const ui = setup(); revealResult(ui.target);
  assert.equal(ui.scrolls.length, 0); ui.flush();
  assert.equal(ui.doc.activeElement, ui.target); assert.equal(ui.target.style.scrollMarginTop, '107px');
  assert.deepEqual(ui.scrolls, [{ behavior: 'smooth', block: 'start', inline: 'nearest' }]); ui.dom.window.close();
});

for (const preference of ['system', 'site']) test(`${preference} motion preference makes the reveal immediate`, () => {
  const ui = setup();
  if (preference === 'system') ui.dom.window.matchMedia = () => ({ matches: true });
  else ui.doc.body.classList.add('ff-paused');
  revealResult(ui.target); ui.flush(); assert.equal(ui.scrolls[0].behavior, 'auto'); ui.dom.window.close();
});

test('ordinary non-sticky headers do not leave an oversized gap above the result', () => {
  const ui = setup(); ui.doc.querySelector('header').style.position = 'static'; revealResult(ui.target); ui.flush();
  assert.equal(ui.target.style.scrollMarginTop, '20px'); ui.dom.window.close();
});

test('existing document scroll padding is not counted twice', () => {
  const ui = setup(); ui.doc.documentElement.style.scrollPaddingTop = '100px'; revealResult(ui.target); ui.flush();
  assert.equal(ui.target.style.scrollMarginTop, '7px'); ui.dom.window.close();
});

test('reduced motion neutralises legacy smooth CSS during scrolling and restores it afterward', () => {
  const ui = setup(); ui.doc.documentElement.style.scrollBehavior = 'smooth'; ui.doc.body.classList.add('ff-paused');
  let behaviorDuringScroll;
  ui.target.scrollIntoView = () => { behaviorDuringScroll = ui.doc.documentElement.style.scrollBehavior; };
  revealResult(ui.target); ui.flush(); assert.equal(behaviorDuringScroll, 'auto');
  assert.equal(ui.doc.documentElement.style.scrollBehavior, 'smooth'); ui.dom.window.close();
});

for (const reason of ['aborted', 'stale', 'removed', 'hidden', 'cancelled']) test(`${reason} results cannot steal focus or scroll`, () => {
  const ui = setup(), aborter = new AbortController(); let current = true;
  const cancel = revealResult(ui.target, { signal: aborter.signal, isCurrent: () => current });
  if (reason === 'aborted') aborter.abort();
  if (reason === 'stale') current = false;
  if (reason === 'removed') ui.target.remove();
  if (reason === 'hidden') ui.target.parentElement.hidden = true;
  if (reason === 'cancelled') cancel();
  ui.flush(); assert.equal(ui.scrolls.length, 0); assert.notEqual(ui.doc.activeElement, ui.target); ui.dom.window.close();
});
