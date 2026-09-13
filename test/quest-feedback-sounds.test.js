/**
 * Exercise app.js feedback with real narration/sound controllers and silent native
 * API stand-ins. jsdom cannot create a trusted browser click, so capture-handler
 * checks explicitly call the registered handler with a native-shaped event. They
 * test its routing policy, not browser permission or real device loudness.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createState, transition } from '../quest/engine.js';
import { MISSIONS } from '../quest/content.js';
import { STORAGE_KEY } from '../quest/storage.js';

const html = await readFile(new URL('../quest/index.html', import.meta.url), 'utf8');
let instance = 0;

// The audio context records scheduled notes without speakers. Normal app cleanup
// still releases real controller timers and cancels narration on page exit.
async function feedbackPage(t, saved = createState()) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, { url: 'http://localhost/quest/', pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  const { document } = window;
  const notes = [];
  const utterances = [];
  const parameter = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  window.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    addEventListener() {}
    removeEventListener() {}
    close() { this.state = 'closed'; return Promise.resolve(); }
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
    createOscillator() {
      const note = { frequency: parameter(), connect() {}, disconnect() {}, start() {}, stop() {}, onended: null };
      notes.push(note); return note;
    }
  };
  window.Audio = undefined;
  window.speechSynthesis = {
    paused: false, cancel() { this.paused = false; },
    getVoices: () => [{ lang: 'en-AU', localService: true }],
    speak(utterance) { utterances.push(utterance); utterance.onstart?.(); },
    pause() { this.paused = true; utterances.at(-1)?.onpause?.(); },
    resume() { this.paused = false; utterances.at(-1)?.onresume?.(); }
  };
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent; } });
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  const captureClicks = [];
  const add = document.addEventListener.bind(document);
  document.addEventListener = (type, listener, options) => {
    if (type === 'click' && (options === true || options?.capture)) captureClicks.push(listener);
    return add(type, listener, options);
  };
  const originalGlobals = new Map();
  for (const [name, value] of Object.entries({ window, document, localStorage: window.localStorage })) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  t.after(() => {
    window.dispatchEvent(new window.Event('pagehide'));
    window.close();
    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    assert.deepEqual(errors, [], 'Feedback causes no uncaught DOM errors');
  });
  await import(`../quest/app.js?feedback-sounds=${++instance}`);
  const required = selector => { const element = document.querySelector(selector); assert.ok(element, selector); return element; };
  const click = selector => required(selector).click();
  // Explicit Sound off/on follows the shipping unlock path without pretending
  // that synthetic DOM clicks grant browser autoplay permission.
  click('[data-game-sound]'); click('[data-game-sound]');
  await Promise.resolve(); await Promise.resolve();
  assert.equal(required('[data-game-sound]').dataset.soundState, 'ready');
  const press = (target, isTrusted = true) => {
    assert.ok(captureClicks.length, 'The app registered a delegated press handler');
    for (const listener of captureClicks) listener({ target, isTrusted, detail: 1 });
  };
  return { window, document, notes, utterances, required, click, press };
}

test('ordinary press sounds return after natural narration completion and while paused', async t => {
  const q = await feedbackPage(t);
  q.click('[data-picker]');
  q.click('[data-hear]');
  const control = q.required('[data-character]');
  const reading = q.utterances.at(-1);
  const before = q.notes.length;
  q.press(control);
  assert.equal(q.notes.length, before, 'A currently speaking voice retains priority');
  reading.onend();
  assert.equal(q.required('body > [data-audio-dock]').hidden, true);
  q.press(control);
  assert.equal(q.notes.length, before + 1, 'Finishing the voice restores the next ordinary tap');
  q.press(control, false);
  assert.equal(q.notes.length, before + 1, 'Untrusted events do not produce generic audio');
  q.click('[data-hear]');
  q.click('body > [data-audio-dock] [data-audio-pause]');
  q.press(control);
  assert.equal(q.notes.length, before + 2, 'A paused voice leaves space for a quiet press sound');
  assert.equal(q.window.speechSynthesis.paused, true, 'A tap never resumes the paused story');
});

test('sorting pickup and result controls bypass generic tap audio', async t => {
  const q = await feedbackPage(t);
  q.click('[data-sort-start]');
  q.click('body > [data-audio-dock] [data-audio-stop]');
  const picture = q.required('[data-sort-picture]');
  const before = q.notes.length;
  q.press(picture);
  assert.equal(q.notes.length, before, 'A direct picture press waits for its own pickup sound');
  picture.click();
  assert.equal(q.notes.length, before + 2, 'The accepted tap-to-pick action schedules one two-note pickup');
  q.press(q.required('[data-sort-drag]'));
  q.press(q.required('[data-destination]'));
  assert.equal(q.notes.length, before + 2, 'A drag follow-up or answer control adds no competing generic cue');
});

test('an incorrect picture reflection still sounds after its reading finishes', async t => {
  const item = MISSIONS[0];
  let saved = transition(createState(), { type: 'CHOOSE_MISSION', id: item.id });
  saved = transition(saved, { type: 'START_MISSION' });
  for (const clue of item.clues) saved = transition(saved, { type: 'COLLECT_CLUE', id: clue.id });
  saved = transition(saved, { type: 'OPEN_PLAN' });
  for (const [slotId, actionId] of Object.entries(item.acceptedPlans[0])) saved = transition(saved, { type: 'SET_PLAN', slotId, actionId });
  saved = transition(saved, { type: 'CHECK_PLAN' });
  saved = transition(saved, { type: 'COMPLETE_MISSION' });
  const q = await feedbackPage(t, saved);
  q.click('.q-reflection [data-hear]');
  q.utterances.at(-1).onend();
  const before = q.notes.length;
  const wrong = item.reflection.options.find(option => option.id !== item.reflection.correctId);
  const control = q.required(`[data-reflection="${wrong.id}"]`);
  q.press(control); control.click();
  assert.equal(q.notes.length, before + 2, 'Only the two-note retry sounds after completed speech');
  assert.ok(q.required('.q-reflection-hint').textContent.includes('Try again'));
  assert.deepEqual(JSON.parse(q.window.localStorage.getItem(STORAGE_KEY)).reflections, {}, 'A wrong choice never adds a discovery reward');
});
