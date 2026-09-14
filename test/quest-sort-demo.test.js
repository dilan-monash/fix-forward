/** Test finite practice animation, narration gating and cleanup without a real
 * speaker, display or game engine. The fixture preserves a live answer beside it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createSortDemo } from '../quest/sort-demo.js';

function fixture(t, { animation = true } = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="practice"></div><button id="answer">Ask for help</button></body>');
  const { document } = dom.window;
  const animations = [];
  const timers = new Map();
  let timerId = 0;
  const speech = { playing: false };
  if (animation) dom.window.Element.prototype.animate = function (frames, options) {
    if (animation === 'reject') throw new Error('Unsupported animation');
    const effect = { element: this, frames, options, cancelled: false, cancel() { this.cancelled = true; }, finished: Promise.resolve() };
    animations.push(effect);
    return effect;
  };
  const controller = createSortDemo({ document, canPlay: () => !speech.playing,
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  t.after(() => { controller.dispose(); dom.window.close(); });
  return { document, container: document.querySelector('#practice'), answer: document.querySelector('#answer'), controller, timers, animations, speech };
}

test('the isolated practice uses generic paper and finishes once within four seconds', t => {
  const f = fixture(t);
  f.answer.focus();
  let finished = 0;
  const originalAnswer = f.answer.outerHTML;
  assert.equal(f.controller.play({ container: f.container, onDone: () => finished++ }), true);
  assert.equal(f.controller.playing, true);
  assert.match(f.container.textContent, /Watch the paper move to the practice box/);
  assert.equal(f.container.querySelectorAll('button, input, [tabindex], audio, img, script').length, 0);
  assert.equal(f.document.activeElement, f.answer);
  assert.equal(f.answer.outerHTML, originalAnswer);
  assert.equal(f.animations.length, 3);
  assert.ok(f.animations.every(effect => effect.element.localName === 'g' && effect.options.duration === 4000));
  const timer = [...f.timers.values()][0];
  assert.equal(timer.delay, 4000);
  timer.callback();
  assert.equal(finished, 1);
  assert.equal(f.controller.playing, false);
  assert.equal(f.container.children.length, 0);
  assert.equal(f.timers.size, 0);
  timer.callback();
  assert.equal(finished, 1, 'an old callback cannot finish twice');
});

test('skip or a real interaction can cancel immediately without finishing or changing the answer', t => {
  const f = fixture(t);
  let finished = 0;
  f.controller.play({ container: f.container, onDone: () => finished++ });
  const delayed = [...f.timers.values()][0].callback;
  f.controller.cancel();
  assert.equal(f.container.children.length, 0);
  assert.equal(f.controller.playing, false);
  assert.equal(f.timers.size, 0);
  assert.ok(f.animations.every(animation => animation.cancelled));
  delayed();
  assert.equal(finished, 0);
  assert.equal(f.answer.textContent, 'Ask for help');
});

test('replay has one local example and rejects overlap with narration', t => {
  const f = fixture(t);
  f.speech.playing = true;
  assert.equal(f.controller.play({ container: f.container }), false);
  assert.equal(f.container.children.length, 0);
  assert.equal(f.timers.size, 0);
  f.speech.playing = false;
  f.controller.play({ container: f.container });
  const old = [...f.timers.values()][0].callback;
  f.controller.play({ container: f.container });
  assert.equal(f.container.children.length, 1);
  assert.equal(f.timers.size, 1);
  old();
  assert.equal(f.controller.playing, true, 'a previous replay cannot clear the newer demo');
});

test('missing or rejected WAAPI still shows a readable static example then cleans up', t => {
  for (const animation of [false, 'reject']) {
    const f = fixture(t, { animation });
    assert.equal(f.controller.play({ container: f.container }), true);
    assert.ok(f.container.querySelector('.q-sort-demo__paper'));
    assert.ok(f.container.querySelector('.q-sort-demo__route'));
    assert.ok(f.container.querySelector('.q-sort-demo__box'));
    assert.equal(f.animations.length, 0);
    [...f.timers.values()][0].callback();
    assert.equal(f.container.children.length, 0);
  }
});

test('detached containers and disposed controllers cannot create orphan demonstrations', t => {
  const f = fixture(t);
  const detached = f.document.createElement('div');
  assert.equal(f.controller.play({ container: detached }), false);
  assert.equal(f.controller.play(), false);
  f.controller.play({ container: f.container });
  f.controller.dispose();
  assert.equal(f.controller.play({ container: f.container }), false);
  assert.equal(f.container.children.length, 0);
  assert.equal(f.timers.size, 0);
});
