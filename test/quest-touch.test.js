/**
 * Regressions for finger drags: primary-pointer ownership, tap tolerance, cancellation,
 * live target bounds and cleanup. Drops call the real sorting engine, so tests can
 * prove that off-board/cancelled gestures leave answers and Sparks unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bindDrag } from '../quest/drag.js';
import { createState, transition } from '../quest/engine.js';
import { SORT_ITEMS } from '../quest/content.js';
import { progression } from '../quest/progression.js';

// These are synthetic touch PointerEvents sent through the real DOM listeners.
// jsdom supplies no physical screen/layout: DOMRect fixtures model the target
// positions. This verifies protocol regressions, not real-device touch usability.
// Return touch controls, observable callbacks and a real sorting state; teardown
// always disposes listeners/window even when a scenario fails partway through.
function touchFixture(t) {
  const dom = new JSDOM(`<!doctype html><main id="surround"><article id="picture"><button id="handle" style="touch-action:manipulation"><svg id="artwork" viewBox="0 0 100 100" tabindex="0"><title>Jug picture</title><a id="art-link" href="#artwork" tabindex="0"><path id="jug-shape" d="M20 20h50v60H20Z"/></a></svg><span id="move-label">Pick up</span></button><div id="picture-copy"><h2>Collection picture</h2><p>Read this clue before choosing a place.</p></div></article><section id="places"><button data-place="ewaste">E-waste collection</button><button data-place="paper">Paper and cardboard</button><button data-place="ask">Ask for help</button></section></main>`, { pretendToBeVisual: true });
  const { window } = dom;
  const { document } = window;
  const handle = document.getElementById('handle');
  const picture = document.getElementById('picture');
  const artwork = document.getElementById('artwork');
  const surround = document.getElementById('surround');
  const captures = new Set();
  const released = [];
  const drops = [];
  const cancellations = [];
  let taps = 0;
  let state = transition(createState(), { type: 'START_SORT' });
  // Model scrolling by moving every viewport rectangle, leaving page positions fixed.
  let scroll = { x: 0, y: 0 };
  const positions = { ewaste: [40, 300, 280, 90], paper: [40, 410, 280, 90], ask: [40, 520, 280, 90] };
  picture.getBoundingClientRect = () => new window.DOMRect(40 - scroll.x, 90 - scroll.y, 280, 130);
  handle.getBoundingClientRect = () => new window.DOMRect(180 - scroll.x, 155 - scroll.y, 120, 50);
  artwork.getBoundingClientRect = () => new window.DOMRect(185 - scroll.x, 156 - scroll.y, 90, 45);
  const targets = [...document.querySelectorAll('[data-place]')].map(element => {
    const id = element.dataset.place;
    element.getBoundingClientRect = () => {
      const [left, top, width, height] = positions[id];
      return new window.DOMRect(left - scroll.x, top - scroll.y, width, height);
    };
    element.onclick = () => { state = transition(state, { type: 'ANSWER_SORT', destinationId: id }); };
    return { id, element };
  });
  // Dispatch an actual touch PointerEvent with controllable finger ID and client point.
  function pointer(target, type, { id = 11, primary = true, x = 220, y = 180 } = {}) {
    const event = new window.PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: primary,
      clientX: x, clientY: y, button: type === 'pointermove' ? -1 : 0,
      buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      pressure: type === 'pointerup' || type === 'pointercancel' ? 0 : .5, width: 18, height: 18
    });
    // Supply consistent page coordinates as a browser would after scrolling.
    // hit testing must still use client coordinates alongside viewport DOMRects.
    Object.defineProperties(event, { pageX: { value: x + scroll.x }, pageY: { value: y + scroll.y } });
    target.dispatchEvent(event);
    return event;
  }
  // jsdom needs a capture stand-in. Releasing it sends lostpointercapture immediately,
  // exposing cleanup that accidentally tries to finish the same gesture a second time.
  handle.setPointerCapture = id => captures.add(id);
  handle.hasPointerCapture = id => captures.has(id);
  handle.releasePointerCapture = id => {
    if (captures.delete(id)) {
      released.push(id);
      pointer(handle, 'lostpointercapture', { id });
    }
  };
  const cleanup = bindDrag(handle, {
    ghostSource: () => artwork, targets: () => targets,
    onDrop: id => { drops.push(id); state = transition(state, { type: 'ANSWER_SORT', destinationId: id }); },
    onCancel: reason => cancellations.push(reason)
  });
  handle.addEventListener('click', () => { taps += 1; });
  t.after(() => { cleanup(); window.close(); });
  const item = SORT_ITEMS.find(card => card.id === state.sorting.itemIds[0]);
  // Find a destination from its current rectangle, including the fixture's scroll offset.
  const center = id => {
    const rect = targets.find(target => target.id === id).element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  // Use the reviewed card's answer so the test is independent of first-round ordering.
  const correctPoint = () => center(item.answer);
  // Cross the real movement threshold with the primary finger, without releasing yet.
  const lift = () => { pointer(handle, 'pointerdown'); pointer(document, 'pointermove', correctPoint()); };
  // Model the extra click browsers send after a touch; a completed drag must suppress it.
  const touchClick = () => handle.dispatchEvent(new window.PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 11, isPrimary: true, detail: 1 }));
  return { window, document, handle, picture, artwork, surround, targets, pointer, cleanup, captures, released, drops, cancellations, item, center, correctPoint, lift, touchClick, state: () => state, taps: () => taps, scrollTo: (x, y) => { scroll = { x, y }; } };
}

test('a finger lifts only product artwork while the clue and move label remain in their original card', t => {
  const q = touchFixture(t);
  const copy = q.document.getElementById('picture-copy');
  const originalCopy = copy.outerHTML;
  q.lift();
  const ghost = q.document.querySelector('.q-drag-ghost');
  assert.equal(ghost.tagName.toLowerCase(), 'svg');
  assert.ok(ghost.querySelector('path'));
  assert.equal(ghost.textContent, 'Jug picture');
  assert.equal(ghost.querySelector('button, h2, p'), null);
  assert.equal(ghost.style.width, '90px');
  assert.equal(ghost.style.height, '45px');
  assert.equal(copy.outerHTML, originalCopy, 'The instructions remain readable and unmoved');
  assert.equal(q.document.querySelectorAll('#move-label').length, 1);
  assert.equal(q.artwork.classList.contains('q-drag-source'), true);
  assert.equal(q.picture.classList.contains('q-drag-source'), false);
  assert.equal(q.picture.style.transform, '');
  assert.ok(q.captures.has(11), 'The large touch button retains pointer ownership');
  q.pointer(q.document, 'pointerup', q.correctPoint());
  assert.equal(q.artwork.classList.contains('q-drag-source'), false);
  assert.equal(q.state().sorting.feedback.correct, true);
});

test('an artwork ghost has no copied IDs or keyboard stops and never alters the source artwork', t => {
  const q = touchFixture(t);
  q.lift();
  const ghost = q.document.querySelector('.q-drag-ghost');
  assert.equal(ghost.id, '');
  assert.equal(ghost.querySelector('[id]'), null);
  assert.equal(ghost.getAttribute('aria-hidden'), 'true');
  assert.equal(ghost.hasAttribute('inert'), true);
  assert.equal(ghost.getAttribute('focusable'), 'false');
  assert.equal(ghost.getAttribute('tabindex'), '-1');
  assert.equal(ghost.querySelector('a').getAttribute('tabindex'), '-1');
  assert.equal(q.artwork.getAttribute('tabindex'), '0');
  assert.equal(q.document.getElementById('art-link').getAttribute('tabindex'), '0');
  q.cleanup();
  assert.equal(q.artwork.classList.contains('q-drag-source'), false);
});

// jsdom has no layout engine: combine the actual ghost styles to locate its
// painted centre, then compare it with the finger and the board's drop position.
function ghostCenter(ghost) {
  const [, x, y] = ghost.style.transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/);
  return { x: parseFloat(ghost.style.left) + Number(x) + parseFloat(ghost.style.width) / 2,
    y: parseFloat(ghost.style.top) + Number(y) + parseFloat(ghost.style.height) / 2 };
}

test('dragging the separate Move handle places the artwork under the finger and over its highlighted destination', t => {
  const q = touchFixture(t);
  const destination = q.correctPoint();
  // This point is inside the Move handle but outside the picture's right edge.
  q.pointer(q.handle, 'pointerdown', { x: 295, y: 180 });
  q.pointer(q.document, 'pointermove', destination);
  const ghost = q.document.querySelector('.q-drag-ghost');
  assert.deepEqual(ghostCenter(ghost), destination, 'The picture visibly reaches the same destination that receives the drop');
  assert.equal(q.picture.style.transform, '', 'The instruction card stays in place');
  q.pointer(q.document, 'pointerup', destination);
  assert.deepEqual(q.drops, [q.item.answer]);
  assert.equal(q.document.querySelector('.q-drag-ghost'), null);
});

test('a direct picture drag keeps the grabbed point instead of jumping its centre to the finger', t => {
  const q = touchFixture(t);
  const start = { x: 200, y: 170 };
  const destination = q.correctPoint();
  const bounds = q.artwork.getBoundingClientRect();
  const grip = { x: bounds.left + bounds.width / 2 - start.x, y: bounds.top + bounds.height / 2 - start.y };
  q.pointer(q.handle, 'pointerdown', start);
  q.pointer(q.document, 'pointermove', destination);
  assert.deepEqual(ghostCenter(q.document.querySelector('.q-drag-ghost')), { x: destination.x + grip.x, y: destination.y + grip.y });
  q.pointer(q.document, 'pointerup', destination);
  assert.deepEqual(q.drops, [q.item.answer]);
});

test('a product dropped at the wrong place returns its artwork and records feedback without Sparks', t => {
  const q = touchFixture(t);
  const wrong = q.targets.find(target => target.id !== q.item.answer);
  const copy = q.document.getElementById('picture-copy').outerHTML;
  q.lift();
  q.pointer(q.document, 'pointerup', q.center(wrong.id));
  assert.deepEqual(q.drops, [wrong.id]);
  assert.equal(q.state().sorting.feedback.correct, false);
  assert.equal(progression(q.state()).points, 0);
  assert.equal(q.document.querySelector('.q-drag-ghost'), null);
  assert.equal(q.artwork.isConnected, true);
  assert.equal(q.artwork.classList.contains('q-drag-source'), false);
  assert.equal(q.document.getElementById('picture-copy').outerHTML, copy);
});

test('only a primary finger starts a drag; a second finger cannot steal, finish or cancel it', t => {
  const q = touchFixture(t);
  const original = q.state();
  q.pointer(q.handle, 'pointerdown', { id: 22, primary: false });
  q.pointer(q.document, 'pointermove', { id: 22, primary: false, ...q.correctPoint() });
  q.pointer(q.document, 'pointerup', { id: 22, primary: false, ...q.correctPoint() });
  assert.equal(q.document.querySelector('.q-drag-ghost'), null);
  assert.equal(q.captures.size, 0);
  assert.equal(q.state(), original);
  q.lift();
  assert.ok(q.document.querySelector('.q-drag-ghost'));
  assert.ok(q.captures.has(11));
  q.pointer(q.handle, 'pointerdown', { id: 22, primary: false });
  const secondMove = q.pointer(q.document, 'pointermove', { id: 22, primary: false, x: 800, y: 800 });
  q.pointer(q.document, 'pointercancel', { id: 22, primary: false });
  q.pointer(q.document, 'pointerup', { id: 22, primary: false, ...q.correctPoint() });
  assert.equal(secondMove.defaultPrevented, false, 'An unrelated finger is not treated as the captured drag');
  assert.ok(q.document.querySelector('.q-drag-ghost'));
  assert.deepEqual(q.drops, []);
  assert.deepEqual(q.cancellations, []);
  q.pointer(q.document, 'pointerup', q.correctPoint());
  assert.deepEqual(q.drops, [q.item.answer]);
  assert.equal(q.state().sorting.feedback.correct, true);
  assert.equal(progression(q.state()).points, 10);
  assert.deepEqual(q.released, [11]);
});

test('a non-primary pointer with ID zero cannot cancel another finger', t => {
  const q = touchFixture(t);
  q.lift();
  q.pointer(q.document, 'pointercancel', { id: 0, primary: false });
  assert.ok(q.document.querySelector('.q-drag-ghost'), 'Pointer ID zero must be compared as an ID, not a wildcard cancellation');
  assert.deepEqual(q.cancellations, []);
  q.pointer(q.document, 'pointerup', q.correctPoint());
  assert.equal(q.state().sorting.feedback.correct, true);
});

test('small finger movement remains a tap and every destination retains its tap alternative', t => {
  const q = touchFixture(t);
  q.pointer(q.handle, 'pointerdown');
  const smallMove = q.pointer(q.document, 'pointermove', { x: 222, y: 182 });
  q.pointer(q.document, 'pointerup', { x: 222, y: 182 });
  q.touchClick();
  assert.equal(smallMove.defaultPrevented, false);
  assert.equal(q.taps(), 1);
  assert.equal(q.document.querySelector('.q-drag-ghost'), null);
  assert.deepEqual(q.drops, []);
  assert.equal(progression(q.state()).points, 0);
  q.targets.find(target => target.id === q.item.answer).element.click();
  assert.equal(q.state().sorting.feedback.correct, true);
  assert.equal(progression(q.state()).points, 10);
});

test('a completed touch drag does not also activate its synthetic click or award twice', t => {
  const q = touchFixture(t);
  q.lift();
  q.pointer(q.document, 'pointerup', q.correctPoint());
  q.touchClick();
  assert.equal(q.taps(), 0);
  q.pointer(q.document, 'pointerup', q.correctPoint());
  assert.deepEqual(q.drops, [q.item.answer]);
  assert.equal(Object.keys(q.state().sorting.answers).length, 1);
  assert.equal(progression(q.state()).points, 10);
  q.handle.dispatchEvent(new q.window.MouseEvent('click', { bubbles: true, detail: 0 }));
  assert.equal(q.taps(), 1, 'Keyboard activation remains available after a pointer drop');
});

test('a touch released off-target returns to the original card without recording a response', t => {
  const q = touchFixture(t);
  const original = q.state();
  q.lift();
  q.pointer(q.document, 'pointermove', { x: -35, y: 900 });
  q.pointer(q.document, 'pointerup', { x: -35, y: 900 });
  assert.equal(q.state(), original);
  assert.equal(progression(q.state()).points, 0);
  assert.deepEqual(q.drops, []);
  assert.deepEqual(q.cancellations, ['off-target']);
  assert.equal(q.document.querySelector('.q-drag-ghost'), null);
  assert.equal(q.picture.isConnected, true);
  assert.equal(q.handle.classList.contains('q-dragging'), false);
  assert.equal(q.artwork.classList.contains('q-drag-source'), false);
  assert.equal(q.captures.size, 0);
});

test('touch placement uses scrolled viewport rectangles rather than page coordinates or board thirds', t => {
  const q = touchFixture(t);
  q.lift();
  q.scrollTo(30, 250);
  const point = q.correctPoint();
  const moved = q.pointer(q.document, 'pointermove', point);
  assert.equal(moved.pageX, moved.clientX + 30);
  assert.equal(moved.pageY, moved.clientY + 250);
  q.pointer(q.document, 'pointerup', point);
  assert.deepEqual(q.drops, [q.item.answer]);
  assert.equal(q.state().sorting.feedback.correct, true);
  assert.equal(progression(q.state()).points, 10);
});

test('touch cancellation, lost capture and resize clean up without points and allow the next gesture', async t => {
  for (const reason of ['cancel', 'lost-capture', 'resize']) {
    await t.test(reason, child => {
      const q = touchFixture(child);
      const original = q.state();
      q.lift();
      if (reason === 'cancel') q.pointer(q.document, 'pointercancel');
      if (reason === 'lost-capture') q.pointer(q.handle, 'lostpointercapture');
      if (reason === 'resize') q.window.dispatchEvent(new q.window.Event('resize'));
      q.pointer(q.document, 'pointerup', q.correctPoint());
      assert.equal(q.state(), original);
      assert.equal(progression(q.state()).points, 0);
      assert.equal(q.document.querySelector('.q-drag-ghost'), null);
      assert.equal(q.captures.size, 0);
      assert.equal(q.cancellations.length, 1);
      q.lift();
      q.pointer(q.document, 'pointerup', q.correctPoint());
      assert.equal(q.state().sorting.feedback.correct, true);
      assert.equal(progression(q.state()).points, 10);
    });
  }
});

test('touch scrolling outside the handle stays unrestricted and navigation releases every drag listener', t => {
  const q = touchFixture(t);
  const original = q.state();
  assert.equal(q.handle.style.touchAction, 'none');
  assert.equal(q.surround.style.touchAction, '');
  assert.equal(q.picture.style.touchAction, '');
  q.pointer(q.surround, 'pointerdown');
  const pageMove = q.pointer(q.surround, 'pointermove', { y: 40 });
  q.pointer(q.surround, 'pointerup', { y: 40 });
  assert.equal(pageMove.defaultPrevented, false);
  assert.equal(q.state(), original);
  q.lift();
  q.cleanup();
  assert.equal(q.handle.style.touchAction, 'manipulation');
  assert.equal(q.document.querySelector('.q-drag-ghost'), null);
  assert.equal(q.captures.size, 0);
  assert.deepEqual(q.cancellations, ['navigation']);
  q.pointer(q.document, 'pointerup', q.correctPoint());
  q.lift();
  q.pointer(q.document, 'pointerup', q.correctPoint());
  assert.equal(q.state(), original);
  assert.equal(progression(q.state()).points, 0);
});
