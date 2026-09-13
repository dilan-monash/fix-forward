// Quest rewards are already saved by the game engine before this module runs.
// This small presentation controller only makes that earned progress visible:
// stars burst from the choice, fly to the HUD, then release its displayed count.
// It never changes points, storage, game answers or the child's focus.

const FLIGHT_MS = 850;
const STAR_COUNT = 12;
const STAGGER_MS = 18;
const ARRIVAL_MS = FLIGHT_MS + (STAR_COUNT - 1) * STAGGER_MS;
const LIFETIME_MS = ARRIVAL_MS + 180;
const SVG_NS = 'http://www.w3.org/2000/svg';

// Keep particles inside the visible tablet screen even when a source is clipped.
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// Accept a real element or a captured DOMRect; detached/invalid sources fall back
// to a visible point instead of producing NaN transforms or off-screen rewards.
function centreOf(value, fallback, viewport) {
  let rect;
  try { rect = value?.getBoundingClientRect ? value.getBoundingClientRect() : value; }
  catch { rect = null; }
  const x = rect && Number.isFinite(rect.left) && Number.isFinite(rect.width)
    ? rect.left + rect.width / 2 : rect?.x;
  const y = rect && Number.isFinite(rect.top) && Number.isFinite(rect.height)
    ? rect.top + rect.height / 2 : rect?.y;
  return {
    x: clamp(Number.isFinite(x) ? x : fallback.x, 24, Math.max(24, viewport.width - 24)),
    y: clamp(Number.isFinite(y) ? y : fallback.y, 24, Math.max(24, viewport.height - 24))
  };
}

// Build a reusable star with native SVG rather than a downloaded GIF, image or
// emoji whose appearance varies between tablets. CSS supplies the chosen colour.
function addStar(document, parent, className, size) {
  const star = document.createElementNS(SVG_NS, 'svg');
  star.setAttribute('viewBox', '0 0 40 40');
  star.setAttribute('width', String(size));
  star.setAttribute('height', String(size));
  star.setAttribute('class', className);
  star.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS(SVG_NS, 'path');
  shape.setAttribute('d', 'M20 2 25.4 13.1 37.6 14.9 28.8 23.5 30.9 35.6 20 29.9 9.1 35.6 11.2 23.5 2.4 14.9 14.6 13.1Z');
  shape.setAttribute('fill', 'currentColor');
  star.append(shape);
  // A rejected animation stays invisible instead of leaving half a particle in
  // the top-left corner. Native keyframes override this base opacity while live.
  Object.assign(star.style, { position: 'absolute', left: `${-size / 2}px`, top: `${-size / 2}px`, opacity: '0' });
  parent.append(star);
  return star;
}

// One controller owns one temporary overlay. Injectable timers/document make
// cancellation races testable without waiting for a real animation or browser.
export function createRewardFx({
  document = globalThis.document,
  reducedMotion = () => false,
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: unschedule = globalThis.clearTimeout
} = {}) {
  let current = null;
  let disposed = false;

  // Remove a run before cancelling its native animations: their completion
  // callbacks may fire late, but a stale run can no longer update the HUD.
  function clearRun(run) {
    if (!run) return;
    if (current === run) current = null;
    run.cancelled = true;
    run.timers.forEach(timer => unschedule(timer));
    run.timers.clear();
    run.animations.forEach(animation => {
      try { animation.cancel(); } catch { /* Removed browser animations need no further cleanup. */ }
    });
    run.animations.clear();
    run.layer?.remove();
  }

  // Navigation cancels presentation only. The caller renders the authoritative
  // saved points for its new screen; the old arrival callback must not run there.
  function cancel() {
    clearRun(current);
  }

  // Guard both native completion and the time-based fallback with the same flag:
  // either can arrive first, but a displayed score is released at most once.
  function arrive(run) {
    if (current !== run || run.cancelled || run.arrived) return;
    run.arrived = true;
    run.onArrive?.();
  }

  // Track every timer so a quick Back, next choice or teardown leaves no hidden
  // work that could interfere with the next scene's freshly rendered controls.
  function later(run, callback, delay) {
    const timer = schedule(() => {
      run.timers.delete(timer);
      if (current === run && !run.cancelled) callback();
    }, delay);
    run.timers.add(timer);
  }

  // Some older WebViews expose animate but reject individual effects. A failed
  // decorative effect is harmless: the independent arrival timer still runs.
  function animate(run, element, frames, options) {
    try {
      const animation = element.animate(frames, { fill: 'both', ...options });
      run.animations.add(animation);
      // Cancelling a Web Animation rejects finished; handle that expected result
      // so rapid taps/navigation never create an unhandled promise rejection.
      animation.finished?.catch?.(() => {});
      return animation;
    } catch { return null; }
  }

  // A short, non-interactive overlay celebrates either earned sparks or a replay
  // win. Replays can pass zero points and get "Great thinking!", never fake +0.
  function play({ points = 0, origin = null, target = null, levelUp = false, label: rewardLabel = '', onArrive = null } = {}) {
    if (disposed) return false;
    cancel();
    const run = { layer: null, timers: new Set(), animations: new Set(), arrived: false, cancelled: false, onArrive };
    current = run;
    if (!document?.body) {
      arrive(run);
      clearRun(run);
      return false;
    }

    const view = document.defaultView;
    const viewport = { width: view?.innerWidth || 1024, height: view?.innerHeight || 768 };
    const start = centreOf(origin, { x: viewport.width / 2, y: viewport.height * 0.53 }, viewport);
    const finish = centreOf(target, { x: viewport.width - 70, y: 65 }, viewport);
    const amount = Number.isFinite(points) ? Math.max(0, Math.trunc(points)) : 0;
    const layer = document.createElement('div');
    layer.className = 'q-reward-fx';
    layer.setAttribute('aria-hidden', 'true');
    layer.dataset.levelUp = String(Boolean(levelUp));
    // Nonblocking geometry is also inline so even a missing/late stylesheet can
    // never turn a reward into a scrollable panel or prevent the next tablet tap.
    Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', overflow: 'hidden', zIndex: '1000' });
    run.layer = layer;
    document.body.append(layer);

    const popup = document.createElement('div');
    popup.className = 'q-reward-fx__popup';
    const label = document.createElement('span');
    label.className = 'q-reward-fx__label';
    label.textContent = typeof rewardLabel === 'string' && rewardLabel.trim()
      ? rewardLabel.trim() : levelUp ? 'Level up!' : amount > 0 ? 'Sparks collected!' : 'Great thinking!';
    const count = document.createElement('strong');
    count.className = 'q-reward-fx__amount';
    count.textContent = amount > 0 ? `+${amount}` : '★';
    popup.append(label, count);
    Object.assign(popup.style, { position: 'absolute', left: '50%', top: '42%', transform: 'translate(-50%, -50%)' });
    layer.append(popup);

    // Reduced motion keeps the same visible reward and instant HUD update, with
    // no flying, scaling, flashing or delay before the child can keep playing.
    const quiet = Boolean(typeof reducedMotion === 'function' ? reducedMotion() : reducedMotion);
    layer.dataset.reducedMotion = String(quiet);
    if (quiet || typeof popup.animate !== 'function') {
      later(run, () => clearRun(run), 1000);
      arrive(run);
      return true;
    }

    const ring = document.createElement('span');
    ring.className = 'q-reward-fx__ring';
    Object.assign(ring.style, { position: 'absolute', width: '80px', height: '80px', left: `${start.x - 40}px`, top: `${start.y - 40}px`, opacity: '0' });
    layer.append(ring);
    animate(run, ring, [
      { transform: 'scale(.25)', opacity: .8 },
      { transform: 'scale(2.2)', opacity: 0 }
    ], { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)' });
    animate(run, popup, [
      { transform: 'translate(-50%, -50%) scale(.65)', opacity: 0, offset: 0 },
      { transform: 'translate(-50%, -50%) scale(1.08)', opacity: 1, offset: .18 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: .32 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: .76 },
      { transform: 'translate(-50%, -65%) scale(.96)', opacity: 0, offset: 1 }
    ], { duration: LIFETIME_MS, easing: 'ease-out' });

    // Every spark briefly fans out from the answer before joining a curved
    // stream to the top bar. Deterministic angles avoid visual/test randomness.
    let lastFlight = null;
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const angle = (index / STAR_COUNT) * Math.PI * 2 - Math.PI / 2;
      const radius = 48 + (index % 3) * 18;
      const kick = {
        x: clamp(start.x + Math.cos(angle) * radius, 20, viewport.width - 20),
        y: clamp(start.y + Math.sin(angle) * radius - 22, 20, viewport.height - 20)
      };
      const curve = {
        x: clamp(kick.x + (finish.x - kick.x) * .38 + Math.cos(angle) * 40, 20, viewport.width - 20),
        y: Math.max(20, Math.min(kick.y, finish.y) - 34 - (index % 3) * 9)
      };
      const star = addStar(document, layer, 'q-reward-fx__star', 26 + (index % 3) * 5);
      star.dataset.spark = String(index);
      const turn = index % 2 ? 125 : -125;
      lastFlight = animate(run, star, [
        { transform: `translate(${start.x}px, ${start.y}px) scale(.25) rotate(0deg)`, opacity: 0, offset: 0 },
        { transform: `translate(${kick.x}px, ${kick.y}px) scale(1.12) rotate(${turn * .25}deg)`, opacity: 1, offset: .2 },
        { transform: `translate(${curve.x}px, ${curve.y}px) scale(.85) rotate(${turn * .7}deg)`, opacity: 1, offset: .61 },
        { transform: `translate(${finish.x}px, ${finish.y}px) scale(.3) rotate(${turn}deg)`, opacity: 1, offset: .94 },
        { transform: `translate(${finish.x}px, ${finish.y}px) scale(.1) rotate(${turn}deg)`, opacity: 0, offset: 1 }
      ], { duration: FLIGHT_MS, delay: index * STAGGER_MS, easing: 'cubic-bezier(.32,0,.55,1)' });
    }

    // Tiny four-direction glints stay near the answer; they disappear while the
    // main stars travel, giving tactile feedback without continuous confetti.
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2;
      const glint = addStar(document, layer, 'q-reward-fx__glint', 9);
      animate(run, glint, [
        { transform: `translate(${start.x}px, ${start.y}px) scale(0)`, opacity: 1 },
        { transform: `translate(${start.x + Math.cos(angle) * 110}px, ${start.y + Math.sin(angle) * 90}px) scale(1)`, opacity: 0 }
      ], { duration: 550, delay: index * 12, easing: 'ease-out' });
    }

    // Native completion follows actual painting; a short deadline also settles
    // the HUD if an older WebView does not dispatch an animation finish event.
    if (lastFlight) lastFlight.onfinish = () => arrive(run);
    later(run, () => arrive(run), ARRIVAL_MS + 35);
    later(run, () => clearRun(run), LIFETIME_MS);
    // If the API exists but every effect is rejected, keep the static feedback
    // and release the display immediately, just like the no-animation fallback.
    if (run.animations.size === 0) arrive(run);
    return true;
  }

  // Page teardown releases all objects. A disposed controller cannot accidentally
  // create a new body overlay from a stale event listener after navigation.
  function destroy() {
    cancel();
    disposed = true;
  }

  return { play, cancel, destroy };
}
