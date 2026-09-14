// These tests check the reward's browser-boundary behaviour, especially races
// from rapid taps and Back navigation. They do not award or mock game points.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRewardFx } from '../quest/reward-fx.js';

// Fake only the paint/timer boundary. Real DOM nodes let us check that every
// overlay is non-interactive and is actually removed after finish/cancellation.
function fixture({ motion = false, animation = true } = {}) {
  const dom = new JSDOM('<!doctype html><body><button id="answer">Choose</button><div id="score"></div></body>');
  const { document } = dom.window;
  const effects = [];
  if (animation) {
    dom.window.Element.prototype.animate = function (frames, options) {
      if (animation === 'reject') throw new Error('This WebView cannot animate this effect');
      const effect = {
        element: this, frames, options, cancels: 0, onfinish: null,
        // Native cancellation is harmless even if finish arrives after cancel.
        cancel() { this.cancels += 1; }
      };
      effects.push(effect);
      return effect;
    };
  }
  let nextTimer = 1;
  const timers = new Map();
  const controller = createRewardFx({
    document,
    reducedMotion: () => motion,
    // Store deadlines rather than sleeping, so tests remain deterministic.
    setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  // Run a captured timer even if its run was cancelled, modelling an already
  // queued browser callback that clearTimeout can no longer remove.
  function fire(timer) {
    for (const [id, pending] of timers) if (pending === timer) timers.delete(id);
    timer.callback();
  }
  return { dom, document, controller, timers, effects, fire };
}

test('earned sparks fly from the chosen answer to the HUD and release its display exactly once', () => {
  const { document, controller, timers, effects, fire } = fixture();
  let arrivals = 0;
  const source = document.querySelector('#answer');
  source.focus();
  controller.play({
    points: 20,
    origin: { left: 100, top: 300, width: 100, height: 50 },
    target: { left: 850, top: 10, width: 100, height: 60 },
    onArrive: () => { arrivals += 1; }
  });
  const layer = document.querySelector('.q-reward-fx');
  assert.equal(layer.getAttribute('aria-hidden'), 'true');
  assert.equal(layer.style.pointerEvents, 'none');
  assert.equal(layer.style.position, 'fixed', 'celebration stays in the viewport, not below a long page');
  assert.equal(document.activeElement, source, 'a reward must never steal the next tablet/key action');
  assert.equal(layer.querySelector('.q-reward-fx__amount').textContent, '+20');
  assert.equal(layer.querySelectorAll('.q-reward-fx__star').length, 12);
  const flights = effects.filter(effect => effect.element.classList.contains('q-reward-fx__star'));
  assert.match(flights[0].frames[0].transform, /translate\(150px, 325px\)/);
  assert.match(flights[0].frames.at(-1).transform, /translate\(900px, 40px\)/);
  assert.equal(arrivals, 0, 'the displayed count waits until the sparks reach it');
  flights.at(-1).onfinish();
  assert.equal(arrivals, 1);
  const deadlines = [...timers.values()].sort((a, b) => a.delay - b.delay);
  fire(deadlines[0]);
  assert.equal(arrivals, 1, 'the fallback deadline does not duplicate native completion');
  assert.ok(document.querySelector('.q-reward-fx__label'), 'the praise remains readable after the Sparks reach the score');
  assert.ok(deadlines[1].delay - deadlines[0].delay >= 500, 'there is a reading moment after the score begins filling');
  fire(deadlines[1]);
  assert.equal(document.querySelector('.q-reward-fx'), null);
  assert.equal(timers.size, 0);
  assert.ok(effects.every(effect => effect.cancels === 1));
});

test('Back/navigation cancellation prevents stale animation and timer callbacks from changing a new HUD', () => {
  const { document, controller, timers, effects, fire } = fixture();
  let arrivals = 0;
  controller.play({ points: 10, onArrive: () => { arrivals += 1; } });
  const pending = [...timers.values()];
  const oldFinish = effects.findLast(effect => effect.element.classList.contains('q-reward-fx__star')).onfinish;
  controller.cancel();
  oldFinish();
  pending.forEach(fire);
  assert.equal(arrivals, 0);
  assert.equal(timers.size, 0);
  assert.equal(document.querySelector('.q-reward-fx'), null);
});

test('rapid wins replace the old effect while only the newest arrival callback runs', () => {
  const { document, controller, effects } = fixture();
  const updates = [];
  controller.play({ points: 5, onArrive: () => updates.push('old') });
  const firstFinish = effects.findLast(effect => effect.element.classList.contains('q-reward-fx__star')).onfinish;
  controller.play({ points: 10, onArrive: () => updates.push('new') });
  const secondFinish = effects.findLast(effect => effect.element.classList.contains('q-reward-fx__star')).onfinish;
  assert.equal(document.querySelectorAll('.q-reward-fx').length, 1);
  firstFinish();
  secondFinish();
  secondFinish();
  assert.deepEqual(updates, ['new']);
  controller.destroy();
});

test('reduced motion gives static positive feedback and updates the HUD immediately', () => {
  const { document, controller, effects, timers, fire } = fixture({ motion: true });
  let arrivals = 0;
  controller.play({ points: 5, onArrive: () => { arrivals += 1; } });
  assert.equal(arrivals, 1);
  assert.equal(effects.length, 0);
  assert.equal(document.querySelector('.q-reward-fx').dataset.reducedMotion, 'true');
  assert.equal(document.querySelectorAll('.q-reward-fx__star').length, 0);
  assert.equal(document.querySelector('.q-reward-fx__amount').textContent, '+5');
  assert.ok([...timers.values()][0].delay >= 2000, 'Less movement gives the child time to read the same praise');
  fire([...timers.values()][0]);
  assert.equal(document.querySelector('.q-reward-fx'), null);
});

test('no-animation and rejected-animation WebViews keep a static reward and settle immediately', () => {
  for (const animation of [false, 'reject']) {
    const { document, controller } = fixture({ animation });
    let arrivals = 0;
    controller.play({ points: 10, onArrive: () => { arrivals += 1; } });
    assert.equal(arrivals, 1);
    assert.equal(document.querySelector('.q-reward-fx__amount').textContent, '+10');
    controller.destroy();
  }
});

test('replay celebrations never imply extra sparks and custom labels are plain text', () => {
  const { document, controller } = fixture({ motion: true });
  controller.play({ points: 0, label: 'Story solved!' });
  assert.equal(document.querySelector('.q-reward-fx__label').textContent, 'Story solved!');
  assert.equal(document.querySelector('.q-reward-fx__amount').textContent, '★');
  assert.doesNotMatch(document.querySelector('.q-reward-fx').textContent, /\+0|Sparks/);
  controller.play({ points: -12, label: '<img src=x onerror=alert(1)>' });
  assert.equal(document.querySelector('.q-reward-fx img'), null);
  assert.equal(document.querySelector('.q-reward-fx__label').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(document.querySelector('.q-reward-fx__amount').textContent, '★');
  controller.destroy();
});

test('missing elements and off-screen coordinates remain inside the viewport', () => {
  const { controller, effects } = fixture();
  controller.play({
    points: 5,
    origin: { left: -500, top: 3000, width: 10, height: 20 },
    target: { getBoundingClientRect() { throw new Error('A removed target has no layout'); } }
  });
  const flight = effects.find(effect => effect.element.classList.contains('q-reward-fx__star'));
  assert.match(flight.frames[0].transform, /translate\(24px, 744px\)/);
  assert.match(flight.frames.at(-1).transform, /translate\(954px, 65px\)/);
  assert.ok(effects.every(effect => !JSON.stringify(effect.frames).includes('NaN')));
  controller.destroy();
});

test('an absent document settles display without crashing and destroy prevents later overlays', () => {
  let arrivals = 0;
  const withoutDocument = createRewardFx({ document: null });
  assert.equal(withoutDocument.play({ points: 5, onArrive: () => { arrivals += 1; } }), false);
  assert.equal(arrivals, 1);
  withoutDocument.destroy();
  assert.equal(withoutDocument.play({ onArrive: () => { arrivals += 1; } }), false);
  assert.equal(arrivals, 1);
  const { document, controller } = fixture();
  controller.play({ points: 5 });
  controller.destroy();
  assert.equal(controller.play({ points: 5 }), false);
  assert.equal(document.querySelector('.q-reward-fx'), null);
});
