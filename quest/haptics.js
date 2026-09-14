/**
 * Optional tiny touch pulses. A supported tablet may acknowledge a lift or an
 * answer; a browser without vibration simply plays the same game without it.
 * This controller never asks for permission, starts a timer, or changes progress.
 * app.js supplies the last real pointer type and the separate Touch feedback choice.
 */
const PATTERNS = Object.freeze({
  lift: Object.freeze([8]),
  correct: Object.freeze([10, 35, 14]),
  retry: Object.freeze([8, 45, 8])
});

/** Invoke play during a touch action. Mouse clicks, keyboard activation and
 * loading a page stay vibration-free, including on touch-capable laptops. */
export function createHaptics({ navigator = globalThis.navigator, isEnabled = () => true } = {}) {
  let active = false;
  let disposed = false;

  function play(kind, { pointerType } = {}) {
    try {
      if (disposed || pointerType !== 'touch' || !isEnabled()
        || !Object.hasOwn(PATTERNS, kind) || !(navigator?.maxTouchPoints > 0)
        || typeof navigator.vibrate !== 'function') return false;
      // A new short pattern replaces the current one through the native API.
      // Its boolean result describes whether the browser accepted the request,
      // not proof that a device has a vibration motor or the child felt it.
      const accepted = navigator.vibrate([...PATTERNS[kind]]) === true;
      active = accepted || active;
      return accepted;
    } catch { return false; /* Unsupported or blocked touch feedback stays quiet. */ }
  }

  // Turning Touch feedback off or leaving Quest cancels our accepted pulse.
  // This never changes sound or narration preferences; quiet-room play can buzz.
  function stop() {
    if (!active) return;
    active = false;
    try { navigator.vibrate(0); } catch { /* Stopping is best effort. */ }
  }

  function dispose() { stop(); disposed = true; }
  return { play, stop, dispose };
}
