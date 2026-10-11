/** Fix-it Station music, sounds and buzzes. Every note is made on the device with
 * the Web Audio API, so there are no audio files and no network requests. Browsers
 * only allow sound after a tap or key press, so the first gesture unlocks it.
 * The Music and Sounds buttons turn each off, and this device remembers the choice.
 * Devices that can vibrate (many Android phones and tablets) buzz gently on a
 * wrong try. iPads have no vibration motor, so the game shakes the screen instead. */
export const SOUND_KEY = 'fixforward-fixit-sound';
export const MUSIC_KEY = 'fixforward-fixit-music';

// A cheerful eight-bar loop (C, A minor, F, G) as MIDI note numbers per eighth note.
// `null` is a rest. The second half varies the tune so the loop doesn't nag.
const TUNE = [
  76, 79, 81, 79, 76, 74, 72, 74, 76, null, 72, 69, 72, null, 76, 74,
  77, 76, 72, 69, 72, 74, 77, 76, 74, null, 71, 74, 79, null, 74, null,
  72, null, 76, null, 79, null, 76, 79, 81, null, 79, 76, 72, null, null, null,
  77, null, 81, null, 77, 76, 74, 72, 71, 74, 79, 74, 71, null, null, null,
];
const ROOTS = [48, 45, 41, 43]; // C3, A2, F2, G2: one chord per bar
const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

export function createSound(win, { storage } = {}) {
  const remembered = (key, fallback) => { try { const value = storage?.getItem(key); return value ? value !== 'off' : fallback; } catch { return fallback; } };
  let enabled = remembered(SOUND_KEY, true), musicOn = remembered(MUSIC_KEY, true), musicWanted = false;
  const Context = win.AudioContext || win.webkitAudioContext;
  let ctx = null, master = null, musicBus = null, noise = null, timer = 0, step = 0, nextAt = 0;

  /** Create or wake the audio context. Call only from a tap, click or key press. */
  function unlock() {
    if ((!enabled && !musicOn) || !Context) return;
    // Only a real tap or key press can start sound; skip events a script made.
    if (!ctx && win.navigator.userActivation && !win.navigator.userActivation.isActive) return;
    try {
      if (!ctx) {
        ctx = new Context();
        // A soft limiter stops layered sounds (fireworks over a fanfare) from crackling.
        const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -12; limiter.ratio.value = 6; limiter.connect(ctx.destination);
        master = ctx.createGain(); master.gain.value = .5; master.connect(limiter);
        musicBus = ctx.createGain(); musicBus.gain.value = .32; musicBus.connect(limiter);
        // Older iPads only finish unlocking once a sound has started inside the gesture.
        const blip = ctx.createBufferSource(); blip.buffer = ctx.createBuffer(1, 1, 22050); blip.connect(ctx.destination); blip.start(0);
      }
      if (ctx.state === 'suspended') ctx.resume();
      if (musicWanted && musicOn) startMusic();
    } catch { ctx = null; }
  }

  // One note with a quick attack and a smooth fade, optionally sliding in pitch.
  function note(freq, at, { dur = .16, type = 'sine', vol = .2, to, attack = .01, bus = master, absolute = false } = {}) {
    const t = absolute ? at : ctx.currentTime + at, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(vol, t + attack); gain.gain.exponentialRampToValueAtTime(.0001, t + dur);
    osc.connect(gain); gain.connect(bus); osc.start(t); osc.stop(t + dur + .05);
  }
  // Filtered noise for whooshes, pops and crackles.
  function hiss(at, { dur = .3, vol = .15, freq = 1200, to, q = .8, type = 'bandpass', bus = master, absolute = false } = {}) {
    if (!noise) { noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const data = noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; }
    const t = absolute ? at : ctx.currentTime + at, src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = noise; filter.type = type; filter.Q.value = q; filter.frequency.setValueAtTime(freq, t);
    if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(vol, t); gain.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(bus); src.start(t, Math.random() * .5); src.stop(t + dur + .05);
  }

  // Music: a small look-ahead scheduler queues the next notes a moment early, so
  // the beat stays steady even when the game is busy drawing.
  const EIGHTH = 60 / 112 / 2;
  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    // After a pause, rejoin the beat instead of rushing through missed notes.
    if (nextAt < ctx.currentTime - .05) nextAt = ctx.currentTime + .05;
    while (nextAt < ctx.currentTime + .25) {
      const bar = Math.floor(step / 8) % 4, beat = step % 8, melody = TUNE[step % TUNE.length], opt = { bus: musicBus, absolute: true };
      if (melody) note(hz(melody), nextAt, { ...opt, dur: EIGHTH * 1.6, type: 'triangle', vol: .16 });
      if (beat === 0 || beat === 4) note(hz(ROOTS[bar]), nextAt, { ...opt, dur: EIGHTH * 3, vol: .3 });
      if (beat === 2 || beat === 6) for (const tone of CHORDS[bar]) note(hz(tone), nextAt, { ...opt, dur: EIGHTH * .9, type: 'triangle', vol: .035 });
      if (beat % 2 === 1) hiss(nextAt, { ...opt, dur: .05, vol: .05, freq: 7000, type: 'highpass' });
      nextAt += EIGHTH; step++;
    }
  }
  function startMusic() {
    if (!ctx || timer || !musicOn) return;
    nextAt = ctx.currentTime + .1; step = 0;
    musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(.32, ctx.currentTime);
    timer = win.setInterval(schedule, 60); schedule();
  }
  function stopMusic() { if (timer) { win.clearInterval(timer); timer = 0; } }
  /** Lower the music for a moment so a celebration sound stands out. */
  function duck(seconds = 1.4) {
    if (!timer || !musicBus) return;
    const now = ctx.currentTime, g = musicBus.gain;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(.08, now + .08); g.linearRampToValueAtTime(.32, now + seconds);
  }
  const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;
  const SOUNDS = {
    tap: () => note(660, 0, { dur: .08, type: 'triangle', vol: .1 }),
    arrive: () => { hiss(0, { dur: .55, vol: .05, freq: 300, to: 1500 }); note(E5, .5, { dur: .12, type: 'triangle', vol: .12 }); note(G5, .6, { dur: .18, type: 'triangle', vol: .12 }); },
    grab: () => note(380, 0, { dur: .14, vol: .18, to: 700 }),
    hover: () => note(990, 0, { dur: .07, type: 'triangle', vol: .06 }),
    miss: () => note(500, 0, { dur: .2, vol: .12, to: 330 }),
    // "Uh-oh": two soft falling notes, gentle rather than scary.
    wrong: () => { note(440, 0, { dur: .2, type: 'square', vol: .05 }); note(311, .2, { dur: .38, type: 'square', vol: .05, to: 290 }); },
    // The bin lid clangs, then the appliance boings back out.
    bin: () => { hiss(0, { dur: .2, vol: .22, freq: 2600, q: 3 }); note(160, 0, { dur: .22, type: 'square', vol: .05 }); note(260, .26, { dur: .45, vol: .2, to: 820 }); },
    right: () => [C5, E5, G5, C6].forEach((f, i) => note(f, i * .085, { dur: i === 3 ? .5 : .22, type: 'triangle', vol: .18 })),
    land: () => { note(1568, 0, { dur: .45, vol: .08 }); note(2093, .07, { dur: .5, vol: .06 }); },
    pop: () => { hiss(0, { dur: .25, vol: .22, freq: 500, type: 'lowpass' }); for (let i = 0; i < 5; i++) hiss(.08 + Math.random() * .35, { dur: .04, vol: .08, freq: 5000, q: 4 }); },
    card: () => { note(1318.5, 0, { dur: .35, vol: .1 }); note(1760, .12, { dur: .55, vol: .09 }); },
    star: () => { note(1174.7, 0, { dur: .3, type: 'triangle', vol: .13 }); note(1568, .06, { dur: .35, vol: .07 }); },
    fanfare: () => [[C5, 0, .16], [E5, .14, .16], [G5, .28, .16], [C6, .42, .3], [G5, .74, .14], [C6, .88, .7]].forEach(([f, t, d]) => { note(f, t, { dur: d, type: 'triangle', vol: .16 }); note(f / 2, t, { dur: d, vol: .07 }); }),
  };

  return {
    get enabled() { return enabled; },
    get musicOn() { return musicOn; },
    unlock,
    play(name) {
      if (!enabled || !ctx) return;
      try {
        if (ctx.state === 'suspended') ctx.resume();
        if (name === 'right' || name === 'fanfare') duck(name === 'fanfare' ? 2.2 : 1.4);
        SOUNDS[name]?.();
      } catch { /* sound is optional */ }
    },
    setEnabled(value) {
      enabled = Boolean(value);
      try { storage?.setItem(SOUND_KEY, enabled ? 'on' : 'off'); } catch { /* not remembered */ }
      if (enabled) unlock();
    },
    /** Ask for music on this screen. It starts once sound is unlocked and music is on. */
    music(wanted) { musicWanted = Boolean(wanted); if (musicWanted && musicOn) startMusic(); else stopMusic(); },
    setMusic(value) {
      musicOn = Boolean(value);
      try { storage?.setItem(MUSIC_KEY, musicOn ? 'on' : 'off'); } catch { /* not remembered */ }
      if (musicOn && musicWanted) { unlock(); startMusic(); } else stopMusic();
    },
    /** Pause everything while the page is hidden, then carry on. */
    pause(hidden) { if (!ctx) return; try { if (hidden) { stopMusic(); ctx.suspend(); } else { ctx.resume(); if (musicWanted && musicOn) startMusic(); } } catch { /* optional */ } },
    /** A short vibration where the device supports it; elsewhere nothing happens. */
    buzz(pattern) { try { if (win.navigator.userActivation?.hasBeenActive !== false) win.navigator.vibrate?.(pattern); } catch { /* not supported */ } },
    dispose() { stopMusic(); try { ctx?.close?.(); } catch { /* already closed */ } ctx = null; },
  };
}
