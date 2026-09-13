/**
 * Check sound consent, browser failures and note cleanup without opening speakers.
 * These tests prove controller behavior, not how a chime sounds on a physical iPad.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameSounds } from '../quest/sounds.js';
import { createState, transition, hydrateState } from '../quest/engine.js';

// Keep native audio behavior inspectable: each note records its schedule, volume
// envelope and connections while a fake clock controls cleanup deterministically.
function audioFixture({ initial = 'suspended', resume = null, enabled = false, onChange = null } = {}) {
  const changes = [];
  const contexts = [];
  const timers = new Map();
  let timerId = 0;
  function parameter() {
    return {
      values: [],
      setValueAtTime(value, time) { this.values.push(['set', value, time]); },
      linearRampToValueAtTime(value, time) { this.values.push(['linear', value, time]); },
      exponentialRampToValueAtTime(value, time) { this.values.push(['exponential', value, time]); }
    };
  }
  class FakeContext {
    constructor() {
      this.state = initial;
      this.currentTime = 12;
      this.destination = {};
      this.oscillators = [];
      this.gains = [];
      this.resumeCalls = 0;
      this.closeCalls = 0;
      this.listeners = new Set();
      contexts.push(this);
    }
    addEventListener(name, callback) { assert.equal(name, 'statechange'); this.listeners.add(callback); }
    removeEventListener(name, callback) { assert.equal(name, 'statechange'); this.listeners.delete(callback); }
    setState(value) { this.state = value; for (const callback of this.listeners) callback(); }
    resume() {
      this.resumeCalls += 1;
      if (resume) return resume(this);
      this.setState('running');
      return Promise.resolve();
    }
    close() { this.closeCalls += 1; this.setState('closed'); return Promise.resolve(); }
    createGain() {
      const gain = { gain: parameter(), connections: [], disconnected: 0, connect(target) { this.connections.push(target); }, disconnect() { this.disconnected += 1; } };
      this.gains.push(gain);
      return gain;
    }
    createOscillator() {
      const oscillator = {
        frequency: parameter(), connections: [], starts: [], stops: [], disconnected: 0, onended: null,
        connect(target) { this.connections.push(target); },
        disconnect() { this.disconnected += 1; },
        start(time) { this.starts.push(time); },
        stop(time) { this.stops.push(time); }
      };
      this.oscillators.push(oscillator);
      return oscillator;
    }
  }
  const sounds = createGameSounds({
    AudioContext: FakeContext,
    enabled,
    onChange: snapshot => { changes.push(snapshot); onChange?.(snapshot); },
    setTimer: callback => { timers.set(++timerId, callback); return timerId; },
    cancelTimer: id => timers.delete(id)
  });
  return { sounds, contexts, changes, timers };
}

test('a fresh game and a restored sound preference both wait for a user gesture', async () => {
  const quiet = audioFixture();
  assert.equal(quiet.sounds.getState().status, 'off');
  assert.equal(quiet.sounds.play('win'), false);
  assert.equal(await quiet.sounds.unlock(), false);
  assert.equal(quiet.contexts.length, 0);
  await quiet.sounds.enable(true);
  assert.equal(quiet.sounds.getState().status, 'locked');
  assert.equal(quiet.contexts.length, 0, 'Saving a preference is not permission to start audio');
  quiet.sounds.dispose();
  const restored = audioFixture({ enabled: true });
  assert.equal(restored.sounds.play('win'), false);
  assert.equal(restored.contexts.length, 0);
  assert.equal(await restored.sounds.unlock(), true);
  assert.equal(restored.contexts.length, 1);
  restored.sounds.dispose();
});

test('the Sound gesture resumes synchronously and enables distinct short soft feedback', async () => {
  const f = audioFixture();
  const result = f.sounds.enable(true, { gesture: true });
  assert.equal(f.contexts[0].resumeCalls, 1, 'resume must happen before the caller awaits');
  assert.equal(await result, true);
  assert.equal(f.sounds.getState().status, 'ready');
  const firstNotes = [];
  for (const kind of ['tap', 'retry', 'win', 'level']) {
    const start = f.contexts[0].oscillators.length;
    assert.equal(f.sounds.play(kind), true);
    const notes = f.contexts[0].oscillators.slice(start);
    firstNotes.push(notes[0].frequency.values[0][1]);
    assert.ok(notes.length >= 1 && notes.length <= 5);
    assert.ok(f.timers.size <= 5, 'Rapid feedback cannot build an unbounded sound queue');
    for (const note of notes) {
      assert.equal(note.type, 'sine');
      assert.ok(note.stops[0] - f.contexts[0].currentTime < 0.8, 'Every melody ends in under a second');
      const envelope = note.connections[0].gain.values;
      assert.equal(envelope[0][1], 0, 'A short fade-in avoids a sharp click');
      assert.ok(envelope.every(([, value]) => value <= 0.045), 'Effect volume stays modest');
    }
  }
  assert.notEqual(firstNotes[0], firstNotes[1], 'Tap and retry are different cues');
  assert.equal(f.sounds.play('surprise'), false);
  f.sounds.dispose();
});

test('wins begin with the original melody, rotate through two gentle variations and never overlap', async () => {
  const f = audioFixture();
  await f.sounds.enable(true, { gesture: true });
  const context = f.contexts[0];
  const played = [];
  for (let index = 0; index < 4; index += 1) {
    const previous = [...context.oscillators];
    const first = context.oscillators.length;
    assert.equal(f.sounds.play('win'), true);
    assert.ok(previous.every(note => note.disconnected === 1), 'a new chime releases every earlier note');
    const notes = context.oscillators.slice(first);
    played.push(notes.map(note => note.frequency.values[0][1]));
    assert.ok(f.timers.size <= 4, 'wins cannot accumulate a background sound queue');
    for (const note of notes) {
      assert.equal(note.type, 'sine');
      assert.ok(note.stops[0] - context.currentTime < 0.6, 'each win remains brief');
      assert.ok(note.connections[0].gain.values.every(([, volume]) => volume <= 0.045));
    }
  }
  assert.deepEqual(played[0], [523.25, 659.25, 783.99, 1046.50], 'the first chime preserves the old win');
  assert.notDeepEqual(played[1], played[0]);
  assert.notDeepEqual(played[2], played[0]);
  assert.notDeepEqual(played[2], played[1]);
  assert.deepEqual(played[3], played[0], 'the sequence returns to the familiar original');
  f.sounds.dispose();
});

test('muted, locked and partly failed wins do not advance the next celebration chime', async () => {
  const f = audioFixture();
  assert.equal(f.sounds.play('win'), false, 'muted requests stay quiet');
  await f.sounds.enable(true);
  assert.equal(f.sounds.play('win'), false, 'a restored preference still needs a gesture');
  await f.sounds.unlock();
  const context = f.contexts[0];
  f.sounds.play('win');
  assert.deepEqual(context.oscillators.map(note => note.frequency.values[0][1]), [523.25, 659.25, 783.99, 1046.50]);
  const originalCreate = context.createOscillator;
  let count = 0;
  context.createOscillator = function () {
    count += 1;
    if (count === 2) throw new Error('Device interrupted partway through scheduling');
    return originalCreate.call(this);
  };
  assert.equal(f.sounds.play('win'), false);
  assert.equal(f.timers.size, 0, 'a partly scheduled win is cleaned up');
  context.createOscillator = originalCreate;
  await f.sounds.enable(false);
  assert.equal(f.sounds.play('win'), false);
  await f.sounds.enable(true, { gesture: true });
  const first = context.oscillators.length;
  assert.equal(f.sounds.play('win'), true);
  assert.deepEqual(context.oscillators.slice(first).map(note => note.frequency.values[0][1]), [659.25, 783.99, 1046.50], 'the next success still uses the second melody');
  f.sounds.dispose();
});

test('Sound off stops and disconnects every note immediately without touching narration', async () => {
  const f = audioFixture();
  await f.sounds.enable(true, { gesture: true });
  f.sounds.play('level');
  await f.sounds.enable(false);
  assert.equal(f.sounds.getState().status, 'off');
  assert.equal(f.timers.size, 0);
  assert.ok(f.contexts[0].oscillators.every(note => note.stops.includes(undefined) && note.disconnected === 1));
  assert.ok(f.contexts[0].gains.every(gain => gain.disconnected === 1));
  assert.equal(f.sounds.play('tap'), false);
  f.sounds.dispose();
});

test('normal endings and fallback timers each release a note exactly once', async () => {
  const f = audioFixture();
  await f.sounds.enable(true, { gesture: true });
  f.sounds.play('win');
  const notes = f.contexts[0].oscillators;
  notes[0].onended();
  assert.equal(notes[0].disconnected, 1);
  for (const callback of [...f.timers.values()]) callback();
  assert.equal(f.timers.size, 0);
  f.sounds.stop();
  assert.ok(notes.every(note => note.disconnected === 1));
  assert.ok(notes.every(note => note.onended === null));
  f.sounds.dispose();
});

test('an interrupted tablet context stops old notes and only another gesture resumes it', async () => {
  const f = audioFixture();
  await f.sounds.enable(true, { gesture: true });
  f.sounds.play('win');
  f.contexts[0].setState('suspended');
  assert.equal(f.sounds.getState().status, 'locked');
  assert.equal(f.timers.size, 0);
  assert.equal(f.sounds.play('retry'), false);
  assert.equal(f.contexts[0].resumeCalls, 1, 'Feedback cannot resume itself outside a gesture');
  assert.equal(await f.sounds.unlock(), true);
  assert.equal(f.contexts[0].resumeCalls, 2);
  assert.equal(f.contexts[0].oscillators.length, 4, 'Unlock does not replay the missed retry or win');
  f.sounds.dispose();
});

test('blocked autoplay and constructor failures remain quiet and never reject to the game', async () => {
  const blocked = audioFixture({ resume: () => Promise.reject(new Error('autoplay blocked')) });
  assert.equal(await blocked.sounds.enable(true, { gesture: true }), false);
  assert.equal(blocked.sounds.getState().status, 'locked');
  assert.equal(blocked.sounds.play('win'), false);
  blocked.sounds.dispose();
  const unsupported = createGameSounds({ AudioContext: null });
  assert.equal(await unsupported.enable(true, { gesture: true }), false);
  assert.equal(unsupported.getState().status, 'unavailable');
  const throwing = createGameSounds({ AudioContext: class { constructor() { throw new Error('no device'); } } });
  assert.equal(await throwing.enable(true, { gesture: true }), false);
  assert.equal(throwing.getState().status, 'unavailable');
  throwing.dispose();
  unsupported.dispose();
});

test('turning Sound off during a slow browser resume never restores on state', async () => {
  let finish;
  const f = audioFixture({ resume: context => new Promise(resolve => { finish = () => { context.setState('running'); resolve(); }; }) });
  const enabling = f.sounds.enable(true, { gesture: true });
  await f.sounds.enable(false);
  finish();
  assert.equal(await enabling, false);
  assert.equal(f.sounds.getState().status, 'off');
  assert.equal(f.sounds.getState().enabled, false);
  assert.equal(f.contexts[0].oscillators.length, 0);
  f.sounds.dispose();
});

test('a disposed page ignores slow unlocks, closes its context once and cannot restart', async () => {
  let finish;
  const f = audioFixture({ resume: () => new Promise(resolve => { finish = resolve; }) });
  const unlocking = f.sounds.enable(true, { gesture: true });
  const changesBefore = f.changes.length;
  f.sounds.dispose();
  f.sounds.dispose();
  finish();
  assert.equal(await unlocking, false);
  assert.equal(f.contexts[0].closeCalls, 1);
  assert.equal(f.contexts[0].listeners.size, 0);
  assert.equal(f.changes.length, changesBefore);
  assert.equal(await f.sounds.enable(true, { gesture: true }), false);
  assert.equal(f.sounds.play('win'), false);
});

test('native note failures and a removed UI callback cannot break the next game action', async () => {
  const f = audioFixture({ onChange: () => { throw new Error('UI has gone'); } });
  assert.equal(await f.sounds.enable(true, { gesture: true }), true);
  f.contexts[0].createOscillator = () => { throw new Error('audio device lost'); };
  assert.equal(f.sounds.play('tap'), false);
  assert.equal(f.sounds.getState().status, 'unavailable');
  assert.equal(f.timers.size, 0);
  f.contexts[0].close = () => Promise.reject(new Error('already closed'));
  f.sounds.dispose();
  await Promise.resolve();
});

test('sound preferences save separately from narration and older or malformed saves stay quiet', () => {
  const original = createState();
  assert.equal(original.settings.sound, false);
  const selected = transition(original, { type: 'SET_SETTING', key: 'sound', value: true });
  assert.equal(selected.settings.sound, true);
  assert.equal(selected.settings.narration, false);
  assert.equal(original.settings.sound, false, 'A saved-state input is never mutated');
  assert.equal(hydrateState(selected).settings.sound, true);
  for (const value of ['true', 1, null, undefined]) {
    assert.equal(hydrateState({ ...selected, settings: { ...selected.settings, sound: value } }).settings.sound, false);
    assert.equal(transition(original, { type: 'SET_SETTING', key: 'sound', value }), original);
  }
  const oldSave = { ...selected, settings: { mode: 'guided', narration: true, motion: 'auto' } };
  assert.equal(hydrateState(oldSave).settings.sound, false);
  assert.equal(hydrateState(oldSave).settings.narration, true);
});
