/** Test the real decorative DOM with only paint and timers replaced. No test
 * speaker, game progress, storage or network is involved in these touch effects. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createTouchFx } from '../quest/touch-fx.js';

function fixture(t, { animation = true } = {}) {
  const dom = new JSDOM('<!doctype html><body><article id="card"><button id="picture"><svg viewBox="0 0 40 40"><path d="M2 2h36v36H2z"/></svg><span>Keep the words still</span></button><p id="warning" role="alert">Leave the item alone.</p></article><button id="target"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15"/></svg><strong>Choose a place</strong></button></body>');
  const { document } = dom.window;
  const effects = [];
  const timers = new Map();
  let nextTimer = 0;
  if (animation) dom.window.Element.prototype.animate = function (frames, options) {
    if (animation === 'reject') throw new Error('Animation unavailable');
    const effect = { element: this, frames, options, cancelled: 0, onfinish: null, cancel() { this.cancelled += 1; }, finished: Promise.resolve() };
    effects.push(effect);
    return effect;
  };
  const controller = createTouchFx({ document,
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  const picture = document.querySelector('#picture');
  const target = document.querySelector('#target');
  picture.getBoundingClientRect = () => ({ left: 100, top: 200, width: 120, height: 100 });
  target.getBoundingClientRect = () => ({ left: 400, top: 400, width: 100, height: 100 });
  t.after(() => { controller.dispose(); dom.window.close(); });
  return { document, controller, picture, target, timers, effects };
}

test('a touch ripple starts at the actual finger and only the nested drawing squishes', t => {
  const f = fixture(t);
  const before = f.picture.outerHTML;
  f.target.focus();
  assert.equal(f.controller.press({ element: f.picture, x: 118, y: 219, pointerType: 'touch' }), true);
  const layer = f.document.querySelector('.q-touch-fx');
  const ring = layer.querySelector('.q-touch-fx__ring');
  assert.equal(layer.dataset.pointer, 'touch');
  assert.equal(ring.style.left, '92px');
  assert.equal(ring.style.top, '193px');
  assert.equal(f.picture.outerHTML, before, 'art animation does not modify the real product or label');
  assert.equal(f.document.activeElement, f.target, 'decoration never steals keyboard focus');
  assert.ok(f.effects.some(effect => effect.element === f.picture.querySelector('svg')));
  assert.ok(f.effects.every(effect => effect.element !== f.picture && !['P', 'ARTICLE', 'STRONG'].includes(effect.element.tagName)));
  assert.equal(layer.getAttribute('aria-hidden'), 'true');
  assert.equal(layer.style.pointerEvents, 'none');
  assert.equal(layer.style.position, 'fixed');
  assert.equal(layer.querySelector('button, a, input, [tabindex]'), null);
  assert.ok([...layer.children].every(piece => piece.style.pointerEvents === 'none'));
});

test('keyboard activation uses the control centre while off-screen coordinates are bounded', t => {
  const f = fixture(t);
  f.controller.press({ element: f.picture });
  let ring = f.document.querySelector('.q-touch-fx__ring');
  assert.equal(ring.style.left, '139px');
  assert.equal(ring.style.top, '229px');
  assert.equal(f.document.querySelector('.q-touch-fx').dataset.pointer, 'keyboard');
  f.controller.cancel();
  f.controller.press({ element: f.picture, x: -900, y: 9000, pointerType: 'mouse' });
  ring = f.document.querySelector('.q-touch-fx__ring');
  assert.equal(ring.style.left, '-15px');
  assert.equal(ring.style.top, '741px');
  assert.ok(f.effects.every(effect => !JSON.stringify(effect.frames).includes('NaN')));
});

test('clue discovery has one short lens and four stars without touching the clue words', t => {
  const f = fixture(t);
  const originalText = f.picture.textContent;
  assert.equal(f.controller.clue({ element: f.picture }), true);
  const layer = f.document.querySelector('[data-effect="clue"]');
  assert.equal(layer.querySelectorAll('.q-touch-fx__lens').length, 1);
  assert.equal(layer.querySelectorAll('.q-touch-fx__star').length, 4);
  assert.equal(f.picture.textContent, originalText);
  assert.equal([...f.timers.values()][0].delay, 720);
});

test('warning pictures, their containers and teaching paragraphs never receive touch animation', t => {
  const f = fixture(t);
  assert.equal(f.controller.press({ element: f.document.querySelector('#warning'), x: 10, y: 10 }), false);
  f.picture.querySelector('path').classList.add('q-warning-object');
  for (const element of [f.picture, f.picture.querySelector('svg'), f.picture.querySelector('path')]) {
    assert.equal(f.controller.press({ element }), false);
    assert.equal(f.controller.clue({ element }), false);
  }
  assert.equal(f.effects.length, 0);
  assert.equal(f.document.querySelector('.q-touch-fx'), null);
  assert.equal(f.controller.drop({ target: f.target, correct: true, artwork: f.picture.querySelector('svg') }), true, 'the correct choice can still have a separate destination stamp');
  assert.equal(f.document.querySelector('.q-touch-fx__item'), null, 'warning evidence itself never flies or bounces');
});

test('correct and retry drops decorate the actual destination, while only an optional item copy travels', t => {
  const f = fixture(t);
  const before = f.document.querySelector('#card').outerHTML;
  const artwork = f.picture.querySelector('svg');
  f.controller.drop({ origin: { left: 100, top: 200, width: 120, height: 100 }, target: f.target, correct: true, artwork });
  const correct = f.document.querySelector('[data-effect="drop-correct"]');
  assert.equal(correct.querySelectorAll('.q-touch-fx__correct').length, 1);
  assert.equal(correct.querySelectorAll('.q-touch-fx__star').length, 3);
  assert.equal(correct.querySelectorAll('.q-touch-fx__item').length, 1);
  const flight = f.effects.find(effect => effect.element.classList.contains('q-touch-fx__item'));
  assert.match(flight.frames.at(-1).transform, /translate\(290px,200px\)/);
  assert.equal(f.document.querySelector('#card').outerHTML, before);
  f.controller.cancel();
  f.controller.drop({ origin: f.picture, target: f.target, correct: false, artwork });
  const retry = f.document.querySelector('[data-effect="drop-retry"]');
  assert.equal(retry.querySelectorAll('.q-touch-fx__retry').length, 1);
  assert.equal(retry.querySelectorAll('.q-touch-fx__star').length, 0, 'a retry does not show a successful discovery');
  const returnFlight = f.effects.findLast(effect => effect.element.classList.contains('q-touch-fx__item'));
  assert.match(returnFlight.frames[0].transform, /translate\(290px,200px\)/);
  assert.match(returnFlight.frames.at(-1).transform, /translate\(0,0\)/);
  assert.equal(f.document.querySelector('#card').outerHTML, before);
  assert.ok(f.effects.every(effect => effect.element !== f.target), 'the full destination textbox never springs');
});

test('an optional artwork copy contains only passive shapes and cannot duplicate IDs or load assets', t => {
  const f = fixture(t);
  const ns = 'http://www.w3.org/2000/svg';
  const art = f.document.createElementNS(ns, 'svg');
  art.setAttribute('viewBox', '0 0 40 40'); art.id = 'keep-original-id';
  art.setAttribute('onload', 'unexpected()');
  art.innerHTML = '<path id="piece" class="q-pop" fill="url(https://example.invalid/paint)" d="M2 2h36v36H2z"/><script>unexpected()</script><image href="https://example.invalid/tracker"/><foreignObject><div>Not a picture</div></foreignObject>';
  f.controller.drop({ target: f.target, artwork: art, correct: true });
  const copy = f.document.querySelector('.q-touch-fx__item');
  assert.ok(copy);
  assert.equal(copy.querySelector('script, image, foreignObject, div, [id], [href]'), null);
  assert.equal(copy.hasAttribute('id'), false);
  assert.equal(copy.hasAttribute('onload'), false);
  assert.equal(copy.querySelector('path').hasAttribute('fill'), false);
  assert.equal(copy.querySelector('path').hasAttribute('class'), false);
  assert.equal(art.id, 'keep-original-id');
  assert.ok(art.querySelector('image'), 'only the decorative copy is sanitised');
  f.controller.cancel();
  f.controller.drop({ target: f.target, artwork: '<svg onload="unexpected()"></svg>', correct: true });
  assert.equal(f.document.querySelector('.q-touch-fx__item'), null, 'HTML strings are never interpreted');
});

test('rapid interactions cap all active decorations and animations instead of building a queue', t => {
  const f = fixture(t);
  for (let index = 0; index < 60; index += 1) {
    if (index % 3 === 0) f.controller.press({ element: f.picture, x: 130, y: 220, pointerType: 'touch' });
    else if (index % 3 === 1) f.controller.clue({ element: f.picture });
    else f.controller.drop({ origin: f.picture, target: f.target, artwork: f.picture.querySelector('svg'), correct: true });
    assert.ok(f.document.querySelectorAll('.q-touch-fx__piece').length <= 10);
    assert.ok(f.document.querySelectorAll('.q-touch-fx').length <= 3);
    assert.ok(f.effects.filter(effect => !effect.cancelled).length <= 13);
    assert.ok(f.timers.size <= 3);
  }
  assert.ok(f.effects.some(effect => effect.cancelled), 'old effects are actively released');
});

test('every effect has a sub-900ms cleanup deadline and cancellation invalidates stale callbacks', t => {
  const f = fixture(t);
  f.controller.press({ element: f.picture });
  f.controller.drop({ target: f.target, correct: true });
  const oldTimers = [...f.timers.values()];
  assert.ok(oldTimers.every(timer => timer.delay > 0 && timer.delay < 900));
  assert.ok(f.effects.every(effect => effect.options.duration < 900));
  f.controller.cancel();
  assert.equal(f.timers.size, 0);
  assert.equal(f.document.querySelector('.q-touch-fx'), null);
  assert.ok(f.effects.every(effect => effect.cancelled === 1));
  f.controller.clue({ element: f.picture });
  oldTimers.forEach(timer => timer.callback());
  assert.equal(f.document.querySelectorAll('.q-touch-fx').length, 1, 'stale cleanup cannot remove a new clue effect');
  [...f.timers.values()].forEach(timer => timer.callback());
  assert.equal(f.document.querySelector('.q-touch-fx'), null);
  assert.equal(f.timers.size, 0);
});

test('missing and rejected animation APIs leave no static particle, timer or mutated control', t => {
  for (const animation of [false, 'reject']) {
    const f = fixture(t, { animation });
    const original = f.picture.outerHTML;
    assert.equal(f.controller.press({ element: f.picture }), false);
    assert.equal(f.controller.clue({ element: f.picture }), false);
    assert.equal(f.controller.drop({ target: f.target, artwork: f.picture.querySelector('svg'), correct: true }), false);
    assert.equal(f.picture.outerHTML, original);
    assert.equal(f.document.querySelector('.q-touch-fx'), null);
    assert.equal(f.timers.size, 0);
  }
});

test('detached or invalid sources fail quietly and disposal prevents every late effect', t => {
  const f = fixture(t);
  assert.equal(f.controller.press(), false);
  assert.equal(f.controller.clue({ element: f.document.createElement('button') }), false);
  assert.equal(f.controller.drop({ target: { left: NaN, top: 2 } }), false);
  assert.equal(f.controller.drop({ target: { getBoundingClientRect() { throw new Error('removed'); } } }), false);
  f.controller.press({ element: f.picture });
  f.controller.dispose();
  assert.equal(f.controller.press({ element: f.picture }), false);
  assert.equal(f.controller.clue({ element: f.picture }), false);
  assert.equal(f.controller.drop({ target: f.target }), false);
  assert.equal(f.document.querySelector('.q-touch-fx'), null);
  const missing = createTouchFx({ document: null });
  assert.equal(missing.drop({ target: { left: 3, top: 4 } }), false);
  missing.dispose();
});
