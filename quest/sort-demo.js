/**
 * A four-second practice example for the first sorting visit. This controller
 * draws its own clean paper and practice box; it never sees the current item,
 * calls a game action, plays audio, moves focus or awards progress. The caller
 * owns the replay/skip controls and records that the introduction was seen.
 */
const DURATION_MS = 4000;

// This small local SVG shows the gesture, not the answer to a live sorting card.
// Every moving element is decorative; the sentence remains completely still.
const PRACTICE_MARKUP = `
  <p class="q-sort-demo__words">Watch the paper move to the practice box.</p>
  <svg class="q-sort-demo__stage" viewBox="0 0 440 150" role="img" aria-label="Demonstration: a clean piece of paper moves into a practice box.">
    <path class="q-sort-demo__route" d="M95 104 C165 60 235 60 310 96" fill="none" stroke="#789f9c" stroke-width="3" stroke-dasharray="5 9"/>
    <g class="q-sort-demo__box" fill="#f4c45d" stroke="#112858" stroke-width="3" stroke-linejoin="round">
      <path d="m283 74 43-16 47 16-46 18Z" fill="#f9ddb0"/>
      <path d="m283 74 44 18v44l-44-19Z"/>
      <path d="m327 92 46-18v43l-46 19Z" fill="#e99a7a"/>
      <path d="m283 74-16-17 42-14 17 15M326 58l19-16 45 14-17 18" fill="#f4c45d"/>
    </g>
    <g class="q-sort-demo__paper" fill="#fffaf0" stroke="#112858" stroke-width="3" stroke-linejoin="round">
      <path d="M50 47h43l17 17v65H50Z"/>
      <path d="M93 47v17h17" fill="#f9ddb0"/>
      <path d="M62 79h35M62 91h35M62 103h25" stroke="#789f9c"/>
    </g>
    <g class="q-sort-demo__touch" fill="none" stroke="#e99a7a" stroke-width="5"><circle cx="80" cy="92" r="22"/></g>
    <g class="q-sort-demo__check" fill="#d8eee4" stroke="#112858" stroke-width="3">
      <circle cx="329" cy="45" r="19"/><path d="m318 45 8 8 14-17" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </svg>`;

/** Inject the clock for deterministic checks and canPlay for narration policy.
 * A replay returns false during narration; it never pauses a story to compete.
 * play() replaces only its supplied practice container. cancel() removes the
 * example immediately without calling onDone or changing the game underneath.
 */
export function createSortDemo({
  document = globalThis.document,
  canPlay = () => true,
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: unschedule = globalThis.clearTimeout
} = {}) {
  let run = null;
  let disposed = false;

  // Clear the current run before cancelling its native animations. A late
  // completion callback can never delete or finish a newer replay.
  function clear(current) {
    if (!current || current.closed) return;
    current.closed = true;
    if (run === current) run = null;
    if (current.timer !== null) unschedule(current.timer);
    for (const animation of current.animations) {
      try { animation.cancel(); } catch { /* Detached or finished SVGs are safe. */ }
    }
    current.host.remove();
  }
  function cancel() { clear(run); }

  function play({ container, onDone } = {}) {
    if (disposed || !container?.isConnected || container.ownerDocument !== document || !canPlay()) return false;
    cancel();
    const host = document.createElement('div');
    host.className = 'q-sort-demo';
    host.innerHTML = PRACTICE_MARKUP;
    container.append(host);
    const current = { host, animations: [], timer: null, closed: false };
    run = current;
    const paper = host.querySelector('.q-sort-demo__paper');
    const touch = host.querySelector('.q-sort-demo__touch');
    const check = host.querySelector('.q-sort-demo__check');

    // Static fallback still explains the gesture with a dotted route and paper.
    // No network asset, dependency or frame-by-frame JavaScript loop is needed.
    if (typeof paper.animate === 'function') {
      try {
        const animate = (element, frames) => {
          const animation = element.animate(frames, { duration: DURATION_MS, easing: 'linear', fill: 'both' });
          animation.finished?.catch?.(() => {});
          current.animations.push(animation);
        };
        animate(paper, [
          { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1, offset: 0 },
          { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1, offset: .2 },
          { transform: 'translate(0px, -10px) rotate(-7deg)', opacity: 1, offset: .3 },
          { transform: 'translate(247px, -20px) rotate(0deg)', opacity: 1, offset: .63 },
          { transform: 'translate(247px, 20px) rotate(0deg)', opacity: 0, offset: .76 },
          { transform: 'translate(247px, 20px) rotate(0deg)', opacity: 0, offset: 1 }
        ]);
        animate(touch, [
          { opacity: 0, transform: 'translate(0px, 0px) scale(1)', offset: 0 },
          { opacity: 1, transform: 'translate(0px, 0px) scale(.82)', offset: .18 },
          { opacity: 1, transform: 'translate(0px, -10px) scale(1)', offset: .3 },
          { opacity: 1, transform: 'translate(247px, -20px) scale(1)', offset: .63 },
          { opacity: 0, transform: 'translate(247px, -20px) scale(1.2)', offset: .72 },
          { opacity: 0, transform: 'translate(247px, -20px) scale(1.2)', offset: 1 }
        ]);
        animate(check, [
          { opacity: 0, transform: 'scale(.8)', offset: 0 },
          { opacity: 0, transform: 'scale(.8)', offset: .75 },
          { opacity: 1, transform: 'scale(1.08)', offset: .82 },
          { opacity: 1, transform: 'scale(1)', offset: .88 },
          { opacity: 1, transform: 'scale(1)', offset: 1 }
        ]);
      } catch {
        // A partially supported API must leave the same readable static example.
        for (const animation of current.animations) {
          try { animation.cancel(); } catch { /* Continue restoring static art. */ }
        }
        current.animations = [];
      }
    }
    current.timer = schedule(() => {
      if (run !== current || current.closed) return;
      clear(current);
      if (typeof onDone === 'function') onDone();
    }, DURATION_MS);
    return true;
  }

  return {
    play, cancel,
    get playing() { return run !== null; },
    dispose() { cancel(); disposed = true; }
  };
}
