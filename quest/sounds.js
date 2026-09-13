/**
 * Short game sounds made on the device: no audio downloads, microphones or music.
 * app.js saves the Sound choice and calls this controller after a real game action.
 * Loading a save never starts audio. enable(true, { gesture: true }) or unlock()
 * belongs directly in a click, touch or keyboard handler so tablet browsers can
 * permit audio. play() never tries to bypass a browser's autoplay decision.
 */

// Each tuple is [frequency in Hz, delay in seconds, length in seconds]. These
// original little melodies use soft sine waves, not a startling wrong-answer buzzer.
const MELODIES = Object.freeze({
  tap: [[740, 0, 0.08]],
  retry: [[330, 0, 0.14], [294, 0.12, 0.20]],
  win: [[523.25, 0, 0.16], [659.25, 0.10, 0.18], [783.99, 0.20, 0.20], [1046.50, 0.32, 0.25]],
  level: [[523.25, 0, 0.16], [659.25, 0.10, 0.18], [783.99, 0.20, 0.20], [1046.50, 0.32, 0.24], [1318.51, 0.46, 0.28]]
});
const PEAK_VOLUME = 0.045;

/**
 * Own one audio context and at most one short melody. The optional constructor and
 * timer dependencies let tests check browser failures without using real speakers.
 * onChange receives { enabled, status, message }; it can update a visible Sound
 * button without rebuilding the activity or moving the child's keyboard focus.
 */
export function createGameSounds({
  AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext,
  enabled = false,
  onChange = () => {},
  setTimer = globalThis.setTimeout,
  cancelTimer = globalThis.clearTimeout
} = {}) {
  let selected = enabled === true;
  let context = null;
  let disposed = false;
  let pendingUnlock = null;
  let revision = 0;
  let status = selected ? (typeof AudioContext === 'function' ? 'locked' : 'unavailable') : 'off';
  const voices = new Set();

  // Return a copy: callers can read state without changing the controller's rules.
  function getState() {
    const messages = {
      off: 'Game sounds are off.',
      locked: 'Tap Sound to start game sounds.',
      ready: 'Game sounds are on.',
      unavailable: 'Sound is unavailable here. You can still play.'
    };
    return { enabled: selected, status, message: messages[status] };
  }

  // A removed UI must not turn a native audio callback into an uncaught exception.
  function publish(next) {
    status = next;
    if (!disposed) {
      try { onChange(getState()); } catch { /* Sound feedback must never block play. */ }
    }
  }

  // Disconnect each oscillator and its volume envelope once, even when Stop and
  // the browser's ended event arrive together. A timer is a suspended-tab fallback.
  function release(voice) {
    if (!voices.delete(voice)) return;
    cancelTimer(voice.timer);
    voice.oscillator.onended = null;
    try { voice.oscillator.disconnect(); } catch { /* It may already be disconnected. */ }
    try { voice.gain.disconnect(); } catch { /* It may already be disconnected. */ }
  }

  // Navigation, narration and Sound off silence all notes immediately; they do not
  // erase the saved Sound preference. New melodies replace old ones, never pile up.
  function stop() {
    for (const voice of [...voices]) {
      try { voice.oscillator.stop(); } catch { /* An ended note is already silent. */ }
      release(voice);
    }
  }

  // Tablets can suspend audio when a tab loses focus. Reflect that state honestly
  // and wait for another user gesture instead of queueing a surprise sound later.
  function contextChanged() {
    if (disposed || !selected) return;
    if (context?.state !== 'running') stop();
    publish(context?.state === 'running' ? 'ready' : context?.state === 'closed' ? 'unavailable' : 'locked');
  }

  /** Resume audio only when the caller is handling a deliberate user gesture. */
  function unlock() {
    if (disposed || !selected) return Promise.resolve(false);
    if (typeof AudioContext !== 'function') { publish('unavailable'); return Promise.resolve(false); }
    if (pendingUnlock) return pendingUnlock;
    const request = revision;
    try {
      if (!context) {
        context = new AudioContext();
        context.addEventListener?.('statechange', contextChanged);
      }
      if (context.state === 'running') { publish('ready'); return Promise.resolve(true); }
      // Calling resume before the first await preserves the browser's user gesture.
      const resumed = context.resume();
      const task = Promise.resolve(resumed).then(() => {
        if (disposed || !selected || request !== revision) return false;
        contextChanged();
        return context.state === 'running';
      }, () => {
        if (!disposed && selected && request === revision) publish('locked');
        return false;
      }).finally(() => { if (pendingUnlock === task) pendingUnlock = null; });
      pendingUnlock = task;
      return task;
    } catch {
      publish('unavailable');
      return Promise.resolve(false);
    }
  }

  /** Change the Sound preference; only the visible user gesture may unlock audio. */
  function enable(value, { gesture = false } = {}) {
    if (disposed) return Promise.resolve(false);
    const next = value === true;
    if (selected !== next) {
      revision += 1;
      // A quick off/on choice must not reuse the result of the older unlock call.
      pendingUnlock = null;
    }
    selected = next;
    if (!selected) { stop(); publish('off'); return Promise.resolve(false); }
    publish(typeof AudioContext !== 'function' ? 'unavailable' : context?.state === 'running' ? 'ready' : 'locked');
    return gesture ? unlock() : Promise.resolve(status === 'ready');
  }

  /** Play one known feedback sound; an unavailable or muted device stays playable. */
  function play(kind) {
    if (disposed || !selected || !Object.hasOwn(MELODIES, kind)) return false;
    if (context?.state !== 'running') { publish(typeof AudioContext === 'function' ? 'locked' : 'unavailable'); return false; }
    stop();
    try {
      const now = context.currentTime;
      for (const [frequency, delay, duration] of MELODIES[kind]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const voice = { oscillator, gain, timer: null };
        voices.add(voice);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, now + delay);
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(PEAK_VOLUME, now + delay + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => release(voice);
        oscillator.start(now + delay);
        oscillator.stop(now + delay + duration + 0.015);
        voice.timer = setTimer(() => {
          try { oscillator.stop(); } catch { /* The natural ending may have won. */ }
          release(voice);
        }, (delay + duration + 0.12) * 1000);
      }
      return true;
    } catch {
      stop();
      publish('unavailable');
      return false;
    }
  }

  // Page cleanup closes our own context, handles its rejected promise, and prevents
  // a late resume callback from restoring controls on a page that has gone away.
  function dispose() {
    if (disposed) return;
    disposed = true;
    revision += 1;
    selected = false;
    status = 'off';
    stop();
    context?.removeEventListener?.('statechange', contextChanged);
    try { Promise.resolve(context?.close?.()).catch(() => {}); } catch { /* Closing is best effort. */ }
  }

  return { enable, unlock, play, stop, dispose, getState };
}
