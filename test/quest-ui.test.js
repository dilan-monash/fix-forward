/**
 * End-to-end DOM journeys through the actual Quest page and app.js controls.
 * Tests cover mission/retry/reward flows, sorting, reloads, accessibility alternatives,
 * parent navigation, narration and local postcard downloads. Every fixture rejects
 * data fetches and restores its browser globals, keeping user progress untouched.
 * jsdom verifies behaviour and markup; real layout, animation and device feel still
 * need browser review. Test names below describe each user-facing regression.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import { MISSIONS, SORT_ITEMS, CONCEPTS } from '../quest/content.js';
import { STORAGE_KEY } from '../quest/storage.js';
import { STORY_LINES } from '../quest/story-audio.js';

// Use the shipping page rather than a parallel test-only copy of its root elements.
const html = await readFile(new URL('../quest/index.html', import.meta.url), 'utf8');
// A distinct import URL starts app.js again for each isolated page/reload fixture.
let instance = 0;

/**
 * Start an isolated Quest page with optional saved text and browser capability flags.
 * Return helpers that activate rendered controls and inspect the resulting DOM/save.
 * The URL option exercises parent entry and ordinary child entry without a web server.
 */
async function createQuest(t, { saved, storageBlocked = false, storageRemovalBlocked = false, speech = true, reducedMotion = false, downloads = false, controlledAnimations = false, historyEntries = [], url = 'http://localhost:5055/quest/' } = {}) {
  const errors = [];
  const requests = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, { url, pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  const { document } = window;
  // This DOM suite deliberately exercises the browser-speech fallback. The
  // recorded-story controller has its own media fixtures; jsdom's Audio stub
  // cannot play a file and would otherwise hide the speech assertions below.
  window.Audio = undefined;
  // A reload retains native history even though module variables start afresh.
  // Rebuild captured browser entries when a regression needs that distinction.
  for (const entry of historyEntries) window.history.pushState(entry, '', window.location.href);
  // jsdom lacks visual scrolling, dialog presentation and computed innerText. These
  // shims preserve the DOM behaviour needed here without pretending to measure layout.
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent; } });
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  // Hold native-style animations until a scenario finishes one. This tests the
  // visible reward/score hand-off without sleeping or claiming to render frames.
  const animations = [];
  if (controlledAnimations) window.Element.prototype.animate = function (frames, options) {
    // An exposed but rejecting animation API must fall back to static feedback.
    if (controlledAnimations === 'reject') throw new Error('This WebView rejects the requested visual effect');
    let resolveFinished;
    let rejectFinished;
    const finished = new Promise((resolve, reject) => { resolveFinished = resolve; rejectFinished = reject; });
    const animation = {
      element: this, frames, options, finished, cancelled: false, onfinish: null,
      finish() { if (!this.cancelled) { this.onfinish?.(); resolveFinished(); } },
      cancel() { this.cancelled = true; rejectFinished(new Error('Test animation cancelled')); }
    };
    // A promise rejection is normal when navigation interrupts a Web Animation.
    finished.catch(() => {});
    animations.push(animation);
    return animation;
  };
  // Let scenarios change the device motion preference and notify the real app listener.
  const media = { matches: reducedMotion, callbacks: [], addEventListener(type, callback) { if (type === 'change') this.callbacks.push(callback); } };
  window.matchMedia = () => media;
  // Record actual controller calls without producing audio or using a voice service.
  // Pause/resume also send native-shaped callbacks so visible controls are exercised.
  const narration = {
    cancelled: 0, pauses: 0, resumes: 0, paused: false, utterances: [],
    cancel() { this.cancelled += 1; this.paused = false; },
    speak(utterance) { this.utterances.push(utterance); utterance.onstart?.(); },
    pause() { this.pauses += 1; this.paused = true; this.utterances.at(-1)?.onpause?.(); },
    resume() { this.resumes += 1; this.paused = false; this.utterances.at(-1)?.onresume?.(); },
    getVoices: () => [{ lang: 'en-AU', localService: true }]
  };
  if (speech) {
    window.speechSynthesis = narration;
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  }
  const actualStorage = window.localStorage;
  const download = { blobs: [], anchors: [], revoked: [] };
  // Capture local Blobs and download clicks; do not ask jsdom to navigate or write files.
  if (downloads) {
    window.URL.createObjectURL = blob => { download.blobs.push(blob); return `blob:quest-test-${download.blobs.length}`; };
    window.URL.revokeObjectURL = url => download.revoked.push(url);
    window.HTMLAnchorElement.prototype.click = function () { download.anchors.push({ href: this.href, filename: this.download }); };
  }
  // An unrelated same-origin key makes accidental clear-all-storage resets observable.
  actualStorage.setItem('adult-session-fixture', 'Adult journey remains separate');
  if (saved !== undefined) actualStorage.setItem(STORAGE_KEY, typeof saved === 'string' ? saved : JSON.stringify(saved));
  const localStorage = storageBlocked
    ? { getItem() { throw new Error('Policy blocks storage'); }, setItem() { throw new Error('Quota or policy'); }, removeItem() { throw new Error('Policy blocks storage'); } }
    : storageRemovalBlocked
      ? { getItem: key => actualStorage.getItem(key), setItem: (key, value) => actualStorage.setItem(key, value), removeItem() { throw new Error('Removal denied'); } }
      : actualStorage;
  // Any attempted data/API call fails and is also checked at teardown, even if caught.
  const fakeFetch = async url => { requests.push(String(url)); throw new Error('Data API deliberately unavailable in Quest test'); };
  window.fetch = fakeFetch;
  const replacements = { window, document, localStorage, fetch: fakeFetch };
  // app.js reads browser globals at import. Save descriptors so each test can restore
  // the previous environment exactly, including globals that did not exist beforehand.
  const originals = new Map();
  for (const [name, value] of Object.entries(replacements)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  let disposed = false;
  // Simulate leaving the page, restore globals and enforce no errors/network use.
  // Explicit disposal supports reload scenarios; t.after can call it again safely.
  function dispose() {
    if (disposed) return;
    disposed = true;
    window.dispatchEvent(new window.Event('pagehide'));
    window.close();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    assert.deepEqual(errors, [], 'Rendered Quest controls must not cause uncaught DOM errors');
    assert.deepEqual(requests, [], 'Quest play must never request unavailable data, scores, names or analytics');
  }
  t.after(dispose);
  await import(`../quest/app.js?quest-ui=${++instance}`);

  // Optional lookup for elements whose appearance/disappearance is part of a scenario.
  const query = selector => document.querySelector(selector);
  // Fail at a missing control with its selector, instead of a later null-property error.
  const required = selector => { const element = query(selector); assert.ok(element, `Expected Quest control ${selector}`); return element; };
  // Follow the rendered tap path and fail clearly if the child cannot activate a control.
  const click = selector => { const element = required(selector); assert.equal(element.disabled, false, `Quest control must be enabled: ${selector}`); element.click(); };
  // Check semantic button access and exercise its keyboard-style activation path.
  const keyboardActivate = selector => {
    const element = required(selector);
    assert.equal(element.tagName, 'BUTTON', 'Tap alternative is a semantic keyboard-operable button');
    assert.equal(element.disabled, false);
    element.focus();
    // jsdom has no browser keyboard default action. detail=0 models the click a
    // native Enter/Space activation produces; real browser key tests are separate.
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
  };
  // Change a visible form control and send the event the application actually listens to.
  const change = (selector, value) => {
    const element = required(selector);
    if (element.type === 'checkbox') element.checked = value;
    else element.value = value;
    element.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  // Read serialized output rather than importing or reaching into app.js private state.
  const savedState = () => JSON.parse(actualStorage.getItem(STORAGE_KEY));
  // Open a story through the picker; an injected activator exercises tap or keyboard paths.
  const selectMission = (mission, activate = click) => {
    if (!query('[data-picker]')) activate('.q-header [data-nav="home"]');
    activate('[data-picker]');
    activate(`[data-mission="${mission.id}"]`);
    activate('[data-start-mission]');
  };
  // Both modes now keep evidence beside the current scene. Follow the numbered
  // Guided clues or Challenge hotspots; neither route opens a text-only dialog.
  const inspect = (mission, activate = click) => {
    for (const clue of mission.clues) {
      const selector = query(`[data-picture-clue="${clue.id}"]`)
        ? `[data-picture-clue="${clue.id}"]` : `[data-clue="${clue.id}"]`;
      activate(selector);
      assert.equal(required('#q-dialog').open, false);
      assert.ok(required('[data-picture-help-text]').textContent.includes(clue.text), `Visible evidence: ${clue.id}`);
      assert.ok(required('[data-picture-help]').querySelector('svg'), `The evidence stays illustrated: ${clue.id}`);
    }
    assert.equal(required('[data-open-plan]').disabled, false);
    activate('[data-open-plan]');
  };
  // Fill authored slot choices through the UI. One-slot stories place on the first tap;
  // two-slot stories require choosing the destination slot after selecting a picture.
  const plan = (answer, activate = click) => {
    for (const [slotId, actionId] of Object.entries(answer)) {
      activate(`[data-action-select="${actionId}"]`);
      assert.equal(required(`[data-action-select="${actionId}"]`).getAttribute('aria-pressed'), 'true');
      if (!query('.q-single-plan')) activate(`[data-plan-slot="${slotId}"]`);
    }
  };
  // Use the browser history cursor, not the app's private route restoration API.
  // A timeout makes a missing entry fail clearly instead of hanging the test suite.
  const historyMove = direction => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { window.removeEventListener('popstate', moved); reject(new Error(`No popstate from history.${direction}()`)); }, 2000);
    function moved() { clearTimeout(timeout); resolve(); }
    window.addEventListener('popstate', moved, { once: true });
    window.history[direction]();
  });
  return { window, document, query, required, click, keyboardActivate, change, savedState, actualStorage, selectMission, inspect, plan, narration, media, dispose, requests, download, historyMove, animations };
}

test('rendered mission supports wrong choice, retry, tap planning, saved discovery and optional decorating', async t => {
  const q = await createQuest(t);
  const item = MISSIONS[0];
  assert.ok(q.query('.q-home'));
  assert.match(q.required('.q-boundary').textContent, /Real appliances need adult help/);
  q.selectMission(item);
  assert.equal(q.required('[data-open-plan]').disabled, false, 'Guided facts are visible without opening every clue');
  q.inspect(item);
  assert.equal(q.document.activeElement, q.required('[data-plan-focus]'));
  const wrong = item.allowedActions.find(action => !item.acceptedPlans.some(plan => plan[item.slots[0].id] === action.id));
  assert.ok(wrong);
  q.plan({ [item.slots[0].id]: wrong.id });
  q.click('[data-check-plan]');
  assert.ok(q.required('.q-feedback.retry').textContent.includes(wrong.feedback.replace(/^(?:Pip|Flo):\s*/, '')), 'The selected action receives its authored reason; the nearby portrait supplies the speaker name');
  assert.equal(q.query('[data-complete]'), null);
  assert.equal(q.document.activeElement, q.required('[data-feedback-focus]'));
  q.click('[data-retry]');
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  assert.equal(q.required('h1').textContent, item.outcome.title);
  assert.equal(q.savedState().completed[item.id].assisted, true);
  assert.ok(q.query('.q-resolved'));
  q.click('[data-nav="book"]');
  const discovery = CONCEPTS.find(concept => concept.id === item.conceptIds[0]);
  assert.ok(q.required('.q-book-pages').textContent.includes(discovery.title));
  assert.equal(q.query('[data-decoration]'), null, 'Learning ideas and making decorations have separate screens');
  q.click('[data-nav="creations"]');
  q.click(`[data-decoration="${discovery.decoration}"]`);
  q.click('[data-decoration-slot="studio"]');
  assert.equal(q.savedState().decorations.studio, discovery.decoration);
  assert.ok(q.required('[data-decoration-slot="studio"]').textContent.includes(discovery.decoration));
  q.click('.q-footer [data-nav="grownups"]');
  const adult = q.required('a[href="/"]');
  assert.equal(adult.getAttribute('target'), '_blank');
  assert.equal(adult.search, '', 'No fictional evidence or category is silently passed to the adult app');
  assert.match(q.required('.q-parent-guide').textContent, /Every appliance, check and report in Quest is fictional/);
  assert.equal(q.actualStorage.getItem('adult-session-fixture'), 'Adult journey remains separate');
});

test('semantic keyboard alternatives complete a two-slot story and preserve optional cooperative evidence', async t => {
  const q = await createQuest(t, { reducedMotion: true });
  const item = MISSIONS.find(mission => mission.slots.length === 2);
  q.selectMission(item, q.keyboardActivate);
  q.inspect(item, q.keyboardActivate);
  q.plan(Object.fromEntries(Object.entries(item.acceptedPlans[0]).reverse()), q.keyboardActivate);
  q.keyboardActivate('[data-check-plan]');
  q.keyboardActivate('[data-complete]');
  assert.equal(q.savedState().activeMission.step, 'outcome');
  assert.equal(q.savedState().completed[item.id].assisted, false);
  assert.equal(q.document.documentElement.dataset.motion, 'reduce');
  const cooperative = MISSIONS.find(mission => mission.cooperative);
  q.keyboardActivate('[data-picker]');
  q.keyboardActivate(`[data-mission="${cooperative.id}"]`);
  q.keyboardActivate('[data-evidence]');
  assert.ok(q.required('#q-dialog-body').textContent.includes(cooperative.cooperative.text));
  assert.match(q.required('#q-dialog-body').textContent, /Read it solo or team up with someone/);
  q.keyboardActivate('[data-close-clue]');
  q.keyboardActivate('[data-start-mission]');
  q.inspect(cooperative, q.keyboardActivate);
  q.plan(cooperative.acceptedPlans[0], q.keyboardActivate);
  q.keyboardActivate('[data-check-plan]');
  q.keyboardActivate('[data-complete]');
  assert.equal(q.savedState().activeMission.step, 'outcome');
});

test('Revisit the clues from wrong feedback opens the scene and preserves a helped retry', async t => {
  const q = await createQuest(t);
  const item = MISSIONS[0];
  q.click('[data-mode="challenge"]');
  q.selectMission(item);
  q.inspect(item);
  const slotId = item.slots[0].id;
  const wrong = item.allowedActions.find(action => !item.acceptedPlans.some(plan => plan[slotId] === action.id));
  q.plan({ [slotId]: wrong.id });
  q.click('[data-check-plan]');
  q.click('[data-revisit-clues]');
  assert.equal(q.savedState().activeMission.step, 'explore');
  assert.equal(q.savedState().activeMission.feedback, null);
  assert.equal(q.savedState().activeMission.plan[slotId], wrong.id);
  assert.equal(q.savedState().activeMission.assisted, true);
  q.click(`[data-clue="${item.clues[0].id}"]`);
  assert.ok(q.required('[data-picture-help-text]').textContent.includes(item.clues[0].text));
  q.click('[data-open-plan]');
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  assert.equal(q.savedState().completed[item.id].assisted, true);
});

test('all eight rendered stories and reflection retries award Sparks once and update every level badge', async t => {
  const q = await createQuest(t);
  // Calculate expected rewards independently from observed UI progress, so calling the
  // production progression() function cannot accidentally repeat the same scoring bug.
  const discovered = new Set();
  let expectedPoints = 0;
  for (const item of MISSIONS) {
    q.selectMission(item);
    assert.equal(q.required('h1').textContent, item.title);
    q.inspect(item);
    q.plan(item.acceptedPlans[0]);
    q.click('[data-check-plan]');
    q.click('[data-complete]');
    assert.equal(q.required('h1').textContent, item.outcome.title);
    assert.ok(q.required('.q-story-heading').textContent.includes(item.outcome.text));
    assert.ok(q.required('.q-mission-scene').querySelector('svg'), 'Every outcome is an illustrated scene');
    assert.ok(q.savedState().completed[item.id]);
    const newIdeas = item.conceptIds.filter(id => !discovered.has(id));
    newIdeas.forEach(id => discovered.add(id));
    expectedPoints += 20 + newIdeas.length * 5;
    assert.match(q.required('.q-level-chip').getAttribute('aria-label'), new RegExp(`\\. ${expectedPoints} Sparks\\.`));
    assert.ok(q.required('.q-reflection h2').textContent.includes(item.reflection.prompt));
    assert.equal(q.document.querySelectorAll('[data-reflection]').length, 2);
    const wrongId = item.reflection.options.find(option => option.id !== item.reflection.correctId).id;
    const beforeWrong = q.savedState();
    q.keyboardActivate(`[data-reflection="${wrongId}"]`);
    assert.deepEqual(q.savedState(), beforeWrong, 'Wrong picture answers do not remove points or save a failed attempt');
    assert.ok(q.required('.q-reflection-hint').textContent.includes(item.reflection.explanation));
    assert.equal(q.document.activeElement, q.required('[data-reflection-focus]'));
    const repeatedCorrect = q.required(`[data-reflection="${item.reflection.correctId}"]`);
    q.keyboardActivate(`[data-reflection="${item.reflection.correctId}"]`);
    expectedPoints += 10;
    assert.equal(q.savedState().reflections[item.id], item.reflection.correctId);
    assert.equal(q.query('[data-reflection]'), null);
    assert.ok(q.required('.q-reflection.answered').textContent.includes(item.reflection.explanation));
    const afterCorrect = q.savedState();
    repeatedCorrect.click();
    assert.deepEqual(q.savedState(), afterCorrect, 'A stale button from rapid repeated activation cannot award twice');
    const expectedLevel = expectedPoints >= 240 ? 4 : expectedPoints >= 140 ? 3 : expectedPoints >= 60 ? 2 : 1;
    const expectedTitle = ['Clue Scout', 'Story Solver', 'Next-Chapter Maker', 'Quest Guide'][expectedLevel - 1];
    assert.equal(q.required('.q-level-chip').getAttribute('aria-label'), `Level ${expectedLevel}: ${expectedTitle}. ${expectedPoints} Sparks. See rewards.`);
    q.click('[data-play-ending]');
    assert.deepEqual(q.savedState(), afterCorrect, 'Playing an ending is creative replay, not another award');
  }
  assert.equal(Object.keys(q.savedState().completed).length, 8);
  assert.equal(Object.keys(q.savedState().reflections).length, 8);
  assert.equal(expectedPoints, 280);
  assert.equal(q.required('[role="progressbar"]').getAttribute('aria-valuenow'), '100');
  assert.match(q.required('.q-spark-meter').textContent, /All four level badges earned/);
  q.click('[data-nav="book"]');
  assert.equal(q.document.querySelectorAll('.q-discovery').length, CONCEPTS.length);
});

test('Collection Station tap and keyboard controls finish five cards, distinguish help and allow a fresh round', async t => {
  // Static reward rendering makes the number assertions independent of the
  // separate star-flight timing suite while exercising the same real actions.
  const q = await createQuest(t, { reducedMotion: true });
  q.click('[data-place="station"]');
  q.click('[data-sort-start]');
  const firstIds = q.savedState().sorting.itemIds;
  const learned = new Set();
  assert.match(q.required('#q-game-hud .q-round-hud').textContent, /0\s*\/\s*5 sorted/);
  assert.match(q.required('#q-game-hud .q-round-hud').textContent, /0\s*\/\s*12 different pictures/);
  for (let index = 0; index < 5; index += 1) {
    const run = q.savedState().sorting;
    const item = SORT_ITEMS.find(card => card.id === run.itemIds[index]);
    assert.ok(q.required('.q-sort-object').textContent.includes(item.title));
    if (index === 0) {
      const wrong = ['paper', 'ewaste', 'ask'].find(id => id !== item.answer);
      q.click(`[data-destination="${wrong}"]`);
      assert.equal(q.savedState().sorting.feedback.correct, false);
      assert.ok(q.required('.q-feedback.retry').textContent.includes(item.clue));
      assert.equal(q.required('[data-sort-retry]').textContent.trim(), 'Try again');
      assert.match(q.required('.q-sort-retry').textContent, /×/);
      assert.ok([...q.document.querySelectorAll('[data-destination]')].every(element => element.disabled));
      assert.equal(Object.keys(q.savedState().sorting.answers).length, 0);
      assert.match(q.required('.q-round-hud').textContent, /0\s*\/\s*5 sorted/);
      assert.equal(Number(q.required('[data-spark-value]').textContent), 0);
      q.click('[data-sort-retry]');
      assert.ok([...q.document.querySelectorAll('[data-destination]')].every(element => !element.disabled));
    }
    if (index === 1) {
      q.click('[data-hint]');
      assert.ok(q.required('[data-picture-help-text]').textContent.includes(item.clue));
      assert.equal(q.required('#q-dialog').open, false);
      q.click('[data-close-picture-help]');
    }
    q.keyboardActivate(`[data-destination="${item.answer}"]`);
    learned.add(item.conceptId);
    assert.equal(Number(q.required('[data-spark-value]').textContent), (index + 1) * 5 + learned.size * 5);
    assert.match(q.required('.q-round-hud').textContent, new RegExp(`${index + 1}\\s*\\/\\s*5 sorted`));
    assert.match(q.required('.q-round-hud').textContent, new RegExp(`${index + 1}\\s*\\/\\s*12 different pictures`));
    assert.ok(q.required('.q-feedback.correct').textContent.includes(item.explanation));
    assert.ok(q.required(`[data-destination="${item.answer}"]`).classList.contains('q-accepted'));
    assert.equal(q.required(`[data-destination="${item.answer}"]`).disabled, true);
    assert.equal(q.document.activeElement, q.required('[data-feedback-focus]'));
    q.keyboardActivate('[data-sort-next]');
  }
  assert.match(q.required('h1').textContent, /Five thoughtful choices/);
  assert.match(q.required('.q-run-reflection').textContent, /3 on your own/);
  assert.match(q.required('.q-run-reflection').textContent, /2 with a clue/);
  assert.equal(q.savedState().sorting.status, 'complete');
  assert.equal(Object.keys(q.savedState().sorting.answers).length, 5);
  assert.match(q.required('.q-round-hud').textContent, /5\s*\/\s*5 sorted/);
  q.click('[data-sort-start]');
  assert.equal(q.savedState().sorting.index, 0);
  assert.deepEqual(q.savedState().sorting.answers, {});
  assert.notDeepEqual(q.savedState().sorting.itemIds, firstIds);
  assert.match(q.required('.q-round-hud').textContent, /0\s*\/\s*5 sorted/);
  assert.match(q.required('.q-round-hud').textContent, /5\s*\/\s*12 different pictures/);
});

test('partial sorting resumes from its companion, home and station without replacing the card or help history', async t => {
  const q = await createQuest(t);
  q.click('[data-place="station"]');
  q.click('[data-sort-start]');
  const first = SORT_ITEMS.find(item => item.id === q.savedState().sorting.itemIds[0]);
  q.click(`[data-destination="${first.answer}"]`);
  q.click('[data-sort-next]');
  q.click('[data-hint]');
  q.click('[data-close-picture-help]');
  const partial = q.savedState().sorting;
  const current = SORT_ITEMS.find(item => item.id === partial.itemIds[partial.index]);
  q.click('.q-footer [data-nav="grownups"]');
  assert.ok(q.query('.q-parent-guide'));
  q.click('[data-nav="sorting"]');
  assert.deepEqual(q.savedState().sorting, partial);
  assert.ok(q.required('.q-sort-object').textContent.includes(current.title));
  q.click('.q-header [data-nav="home"]');
  q.click('[data-nav="sorting"]');
  assert.deepEqual(q.savedState().sorting, partial);
  q.click('.q-header [data-nav="home"]');
  q.click('[data-place="station"]');
  q.click('[data-sort-start]');
  assert.deepEqual(q.savedState().sorting, partial);
  assert.ok(q.required('.q-sort-object').textContent.includes(current.title));
});

test('reload resumes an unfinished plan and settings; reset requires confirmation and preserves adult data', async t => {
  let q = await createQuest(t);
  const item = MISSIONS[0];
  q.click('[data-mode="challenge"]');
  q.selectMission(item);
  q.click('[data-clue-list]');
  assert.equal(q.required('.q-clue-list').hidden, false);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  const saved = q.savedState();
  q.dispose();
  q = await createQuest(t, { saved });
  assert.equal(q.savedState().settings.mode, 'challenge');
  assert.ok(q.required('[data-plan-slot]').classList.contains('filled'));
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  q.click('#quest-settings');
  q.change('#q-motion', 'reduce');
  assert.equal(q.document.documentElement.dataset.motion, 'reduce');
  q.click('#q-reset');
  assert.match(q.required('#q-dialog-title').textContent, /Start a new adventure/);
  assert.equal(Object.keys(q.savedState().completed).length, 1);
  q.click('#q-keep');
  assert.equal(Object.keys(q.savedState().completed).length, 1);
  q.click('#quest-settings');
  q.click('#q-reset');
  q.click('#q-confirm-reset');
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), null);
  assert.equal(q.required('#book-count').textContent, '0');
  assert.ok(q.query('.q-home'));
  assert.equal(q.actualStorage.getItem('adult-session-fixture'), 'Adult journey remains separate');
});

test('corrupt and blocked storage leave the rendered mission playable with no data API', async t => {
  let q = await createQuest(t, { saved: '{bad json' });
  assert.match(q.required('#q-announcement').textContent, /could not read the saved adventure/);
  q.selectMission(MISSIONS[0]);
  assert.ok(q.query('[data-picture-help]'));
  q.dispose();
  q = await createQuest(t, { storageBlocked: true });
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  assert.equal(q.required('h1').textContent, item.outcome.title);
  q.click('.q-footer [data-nav="grownups"]');
  assert.match(q.required('.q-parent-guide').textContent, /Saving is blocked/);
  assert.deepEqual(q.requests, []);
});

test('read aloud is optional, cancels on navigation and page exit, and has a visible-text fallback', async t => {
  let q = await createQuest(t);
  assert.equal(q.narration.utterances.length, 0, 'Loading the game does not start audio');
  q.click('#read-aloud');
  assert.equal(q.narration.utterances.length, 1);
  assert.match(q.narration.utterances[0].text, /Pip the toaster and Flo the fan/);
  assert.match(q.narration.utterances[0].text, /Look for a clue.*Choose what happens next/s, 'The opening voice tells the child how to join the story');
  let previous = q.narration.cancelled;
  q.click('[data-picker]');
  assert.ok(q.narration.cancelled > previous);
  q.click(`[data-mission="${MISSIONS[0].id}"]`);
  q.click('#quest-settings');
  q.change('#q-mode', 'challenge');
  q.change('#q-narration', true);
  assert.equal(q.savedState().settings.narration, true);
  previous = q.narration.cancelled;
  q.click('#q-dialog-close');
  assert.ok(q.narration.cancelled > previous);
  const spoken = q.narration.utterances.length;
  q.click('[data-start-mission]');
  assert.ok(q.narration.utterances.length > spoken);
  q.click(`[data-clue="${MISSIONS[0].clues[0].id}"]`);
  previous = q.narration.cancelled;
  q.click('[data-word-help]');
  assert.ok(q.narration.cancelled > previous, 'Opening another explanation cancels the inline clue narration');
  previous = q.narration.cancelled;
  q.window.dispatchEvent(new q.window.Event('pagehide'));
  assert.ok(q.narration.cancelled > previous);
  q.dispose();
  q = await createQuest(t, { speech: false });
  q.click('#read-aloud');
  assert.match(q.required('#q-announcement').textContent, /voice is not available here/);
  assert.ok(q.query('.q-home'));
});

test('story projector compares before and after without awarding again; earned postcard design survives creations reload', async t => {
  let q = await createQuest(t, { reducedMotion: true });
  const item = MISSIONS[0];
  q.click('[data-nav="creations"]');
  assert.equal(q.query('[data-postcard]'), null, 'Unexplored stories offer a mission, not an unearned postcard');
  assert.match(q.required('.q-created-postcards').textContent, /Finish one story to unlock its postcard/);
  assert.ok(q.query('[data-picker]'), 'The empty creations screen offers a clear first activity');
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  const completedState = q.savedState();
  const afterScene = q.required('[data-story-scene] svg').outerHTML;
  for (let repeat = 0; repeat < 2; repeat += 1) {
    q.keyboardActivate('[data-story-view="before"]');
    assert.equal(q.required('[data-story-view="before"]').getAttribute('aria-pressed'), 'true');
    assert.notEqual(q.required('[data-story-scene] svg').outerHTML, afterScene);
    q.keyboardActivate('[data-story-view="after"]');
    assert.equal(q.required('[data-story-view="after"]').getAttribute('aria-pressed'), 'true');
    assert.equal(q.required('[data-story-scene] svg').outerHTML, afterScene);
    assert.deepEqual(q.savedState(), completedState, 'A scene replay cannot unlock or count completion twice');
  }
  q.keyboardActivate(`[data-postcard="${item.id}"]`);
  assert.ok(q.query('.q-postcard-studio'));
  assert.equal(q.query('.q-postcard-studio input,.q-postcard-studio textarea'), null, 'Design uses fixed choices, without child disclosures');
  q.keyboardActivate('button[data-postcard-theme="starlight"]');
  assert.equal(q.document.activeElement, q.required('button[data-postcard-theme="starlight"]'));
  assert.ok(q.required('button[data-postcard-sticker="leaf"] b[aria-hidden="true"] svg'));
  assert.equal(q.required('button[data-postcard-sticker="leaf"]').textContent.trim(), 'leaf');
  q.keyboardActivate('button[data-postcard-sticker="leaf"]');
  assert.deepEqual(q.savedState().postcards[item.id], { theme: 'starlight', sticker: 'leaf' });
  assert.equal(q.required('[data-postcard-preview] > svg').getAttribute('data-postcard-palette'), 'starlight');
  assert.equal(q.required('[data-postcard-preview] [data-postcard-mark]').getAttribute('data-postcard-mark'), 'leaf');
  q.click('[data-nav="creations"]');
  assert.equal(q.document.querySelectorAll('.q-creation-card[data-postcard]').length, 1);
  assert.equal(q.query(`[data-postcard="${MISSIONS[1].id}"]`), null);
  const saved = q.savedState();
  q.dispose();
  q = await createQuest(t, { saved });
  assert.ok(q.query('.q-creations-studio'));
  q.click(`[data-postcard="${item.id}"]`);
  assert.equal(q.required('button[data-postcard-theme="starlight"]').getAttribute('aria-pressed'), 'true');
  assert.equal(q.required('button[data-postcard-sticker="leaf"]').getAttribute('aria-pressed'), 'true');
  assert.equal(q.required('[data-postcard-preview] > svg').getAttribute('data-postcard-palette'), 'starlight');
  assert.deepEqual(q.savedState().completed, completedState.completed);
  assert.deepEqual(q.savedState().discoveries, completedState.discoveries);
});

test('postcard downloads occur only on request, contain local SVG artwork, revoke URLs and reset clears designs', async t => {
  const q = await createQuest(t, { downloads: true });
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  q.click(`[data-postcard="${item.id}"]`);
  q.click('button[data-postcard-theme="mint"]');
  q.click('button[data-postcard-sticker="spark"]');
  assert.equal(q.download.blobs.length, 0, 'Choosing colours does not automatically create a download');
  q.click('[data-save-postcard]');
  assert.equal(q.download.blobs.length, 1);
  assert.equal(q.required('#q-download-message').textContent, 'Postcard download started. Check your browser’s downloads.');
  assert.deepEqual(q.download.anchors, [{ href: 'blob:quest-test-1', filename: `fixforward-quest-${item.id}.svg` }]);
  assert.match(q.download.blobs[0].type, /^image\/svg\+xml/);
  const source = await new Promise((resolve, reject) => {
    const reader = new q.window.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(q.download.blobs[0]);
  });
  const picture = new JSDOM(source, { contentType: 'image/svg+xml' });
  try {
    assert.equal(picture.window.document.documentElement.getAttribute('data-postcard-palette'), 'mint');
    assert.equal(picture.window.document.querySelector('[data-postcard-mark]').getAttribute('data-postcard-mark'), 'spark');
    assert.ok(picture.window.document.querySelector('svg svg'));
    assert.equal(picture.window.document.querySelector('script,image,foreignObject,[href],[src]'), null);
  } finally { picture.window.close(); }
  q.click('[data-save-postcard]');
  assert.deepEqual(q.download.revoked, ['blob:quest-test-1']);
  q.click('[data-nav="creations"]');
  assert.deepEqual(q.download.revoked, ['blob:quest-test-1', 'blob:quest-test-2']);
  q.click(`[data-postcard="${item.id}"]`);
  q.click('[data-save-postcard]');
  q.window.dispatchEvent(new q.window.Event('pagehide'));
  assert.ok(q.download.revoked.includes('blob:quest-test-3'));
  q.click('#quest-settings');
  q.click('#q-reset');
  q.click('#q-confirm-reset');
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), null);
  q.click('[data-nav="creations"]');
  assert.deepEqual(q.savedState().postcards, {});
  assert.equal(q.query('[data-postcard]'), null);
  assert.equal(q.actualStorage.getItem('adult-session-fixture'), 'Adult journey remains separate');
});

test('postcard editor stays usable when the browser cannot create a download', async t => {
  const q = await createQuest(t);
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  q.click(`[data-postcard="${item.id}"]`);
  q.click('[data-save-postcard]');
  assert.match(q.required('#q-download-message').textContent, /saving is unavailable/);
  q.click('button[data-postcard-theme="starlight"]');
  assert.equal(q.savedState().postcards[item.id].theme, 'starlight');
  assert.ok(q.query('[data-postcard-preview] > svg'));
});

test('a one-slot plan takes one picture tap, lets the child change it and needs no extra placement tap', async t => {
  const q = await createQuest(t);
  const item = MISSIONS.find(mission => mission.slots.length === 1);
  q.selectMission(item);
  q.inspect(item);
  const slotId = item.slots[0].id;
  const correctId = item.acceptedPlans[0][slotId];
  const otherId = item.allowedActions.find(action => action.id !== correctId).id;
  assert.ok(q.required('.q-single-plan'));
  assert.equal(q.required('[data-check-plan]').disabled, true);
  q.click(`[data-action-select="${otherId}"]`);
  assert.equal(q.savedState().activeMission.plan[slotId], otherId);
  assert.equal(q.required('[data-check-plan]').disabled, false);
  q.keyboardActivate(`[data-action-select="${correctId}"]`);
  assert.equal(q.savedState().activeMission.plan[slotId], correctId);
  assert.equal(q.required(`[data-action-select="${otherId}"]`).getAttribute('aria-pressed'), 'false');
  assert.equal(q.required(`[data-action-select="${correctId}"]`).getAttribute('aria-pressed'), 'true');
  assert.ok(q.required(`[data-action-select="${correctId}"] svg`), 'The choice is an illustrated semantic button');
  assert.equal(q.document.activeElement, q.required(`[data-action-select="${correctId}"]`));
  q.click('[data-check-plan]');
  assert.equal(q.savedState().activeMission.feedback.correct, true);
  q.click('[data-complete]');
  assert.equal(q.savedState().completed[item.id].assisted, false);
});

test('the level HUD explains all rewards, keeps hints free and never locks stories by level', async t => {
  const q = await createQuest(t);
  assert.equal(q.required('.q-level-chip').getAttribute('aria-label'), 'Level 1: Clue Scout. 0 Sparks. See rewards.');
  assert.equal(q.required('[role="progressbar"]').getAttribute('aria-valuenow'), '0');
  assert.match(q.required('.q-spark-meter').textContent, /60 to Level 2/);
  q.keyboardActivate('[data-level-info]');
  assert.equal(q.document.querySelectorAll('.q-level-trail > div').length, 4);
  assert.equal(q.document.querySelectorAll('.q-level-trail > .earned').length, 1);
  const text = q.required('#q-dialog-body').textContent;
  assert.match(text, /20 Sparks/);
  assert.match(text, /5 Sparks/);
  assert.match(text, /10 Sparks/);
  assert.match(text, /Hints are free/);
  assert.match(text, /every story at any level/);
  q.keyboardActivate('[data-close-clue]');
  q.click('[data-picker]');
  assert.equal(q.document.querySelectorAll('.q-mission-row').length, MISSIONS.length);
  assert.equal(q.document.querySelectorAll('.q-mission-row:disabled').length, 0);
  q.click(`[data-mission="${MISSIONS[0].id}"]`);
  q.click('[data-start-mission]');
  q.click('[data-hint]');
  q.click('[data-close-picture-help]');
  assert.equal(q.required('.q-level-chip').getAttribute('aria-label'), 'Level 1: Clue Scout. 0 Sparks. See rewards.');
  assert.equal(q.savedState().activeMission.assisted, true);
});

test('inline picture listening reads its actual evidence and Word help explains terms without changing progress', async t => {
  const q = await createQuest(t);
  const item = MISSIONS[0];
  const clue = item.clues[0];
  q.click('[data-mode="challenge"]');
  q.selectMission(item);
  q.click(`[data-clue="${clue.id}"]`);
  const afterClue = q.savedState();
  assert.equal(q.narration.utterances.length, 0, 'Optional read aloud waits for the child to ask');
  q.keyboardActivate(`[data-hear-fact="${clue.id}"]`);
  assert.equal(q.narration.utterances.at(-1).text, clue.text);
  assert.ok(q.required('[data-picture-help-text]').textContent.includes(clue.text));
  assert.deepEqual(q.savedState(), afterClue);
  q.keyboardActivate('[data-word-help]');
  const words = [...q.document.querySelectorAll('.q-word-list dt')].map(element => element.textContent);
  for (const word of ['Reuse', 'Repair', 'Recycle', 'E-waste', 'A qualified repairer']) assert.ok(words.includes(word));
  q.keyboardActivate('#q-dialog [data-hear]');
  assert.ok(q.narration.utterances.at(-1).text.includes('Use something again'));
  assert.ok(q.narration.utterances.at(-1).text.includes('A person trained to check and repair'));
  q.keyboardActivate('[data-close-clue]');
  assert.equal(q.document.activeElement, q.required('[data-word-help]'));
  assert.deepEqual(q.savedState(), afterClue, 'Listening and vocabulary help carry no penalty or score side effect');
});

test('the parent URL opens purpose and privacy guidance without changing a saved child mission', async t => {
  let q = await createQuest(t);
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  const saved = q.savedState();
  const serialized = q.actualStorage.getItem(STORAGE_KEY);
  q.dispose();
  q = await createQuest(t, { saved: serialized, url: 'http://localhost:5055/quest/?view=parents' });
  assert.ok(q.query('.q-parent-guide'));
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), serialized, 'Opening the information URL does not rewrite the child save');
  assert.deepEqual(q.savedState().activeMission, saved.activeMission);
  const text = q.required('.q-parent-guide').textContent;
  assert.equal(/\b[A-Za-z]+\?s\b/.test(text), false, 'Parent copy must not contain encoding-damaged apostrophes');
  assert.match(text, /For parents and curious families/);
  assert.equal(q.query('#q-parent-age-title'), null);
  assert.doesNotMatch(text, /Why ages|What about 6 or 13/);
  assert.match(text, /Look before deciding/);
  assert.match(text, /Every appliance, check and report in Quest is fictional/);
  assert.match(text, /not a school mark, ability rating or measure of waste saved/);
  assert.match(text, /Saving, privacy and read aloud/);
  assert.match(text, /no player name, birthday, photo or contact details/);
  assert.match(text, /sends no child scores or play analytics/);
  assert.match(text, /voices may use an online service/);
  assert.match(text, /have not measured learning improvements or tested this version with children/);
  const adult = q.required('.q-parent-guide a[href="/"]');
  assert.equal(adult.getAttribute('target'), '_blank');
  assert.equal(adult.search, '');
  assert.equal(adult.hash, '');
  q.click('[data-continue]');
  assert.ok(q.query('.q-stage-plan'));
  assert.deepEqual(q.savedState().activeMission, saved.activeMission);
  assert.equal(q.actualStorage.getItem('adult-session-fixture'), 'Adult journey remains separate');
});

test('the plain game URL opens child home even after saving the parent view, then continues the same mission', async t => {
  let q = await createQuest(t);
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('.q-header [data-nav="grownups"]');
  assert.ok(q.query('.q-parent-guide'));
  const saved = q.savedState();
  assert.equal(saved.view, 'grownups');
  assert.equal(saved.activeMission.step, 'plan');
  const serialized = q.actualStorage.getItem(STORAGE_KEY);
  q.dispose();
  q = await createQuest(t, { saved: serialized, url: 'http://localhost:5055/quest/' });
  assert.ok(q.query('.q-home'));
  assert.equal(q.query('.q-parent-guide'), null);
  assert.ok(q.query('.q-home'));
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), serialized, 'Entry-point selection does not rewrite the saved adventure');
  q.click('[data-continue]');
  assert.ok(q.query('.q-stage-plan'));
  assert.deepEqual(q.savedState().activeMission, saved.activeMission);
  assert.equal(q.savedState().view, 'mission');
});

test('Guided stories put numbered illustrated evidence on the current picture and open a plan without any dialog', async t => {
  const q = await createQuest(t);
  const item = MISSIONS.find(mission => mission.slots.length === 2);
  q.selectMission(item);
  assert.deepEqual(q.savedState().activeMission.clueIds, []);
  // Pins on the scene and matching tabs can both target the same clue. Every
  // authored clue must be reachable, rather than imposing one visual control.
  assert.deepEqual(new Set([...q.document.querySelectorAll('[data-picture-clue]')].map(button => button.dataset.pictureClue)), new Set(item.clues.map(clue => clue.id)));
  assert.ok(q.required('[data-picture-help-text]').textContent.includes(item.clues[0].text));
  assert.ok(q.required('[data-picture-help]').querySelector('svg'));
  assert.equal(q.required('#q-dialog').open, false);
  assert.equal(q.required('[data-open-plan]').disabled, false);
  q.keyboardActivate('[data-open-plan]');
  assert.ok(q.query('.q-stage-plan'));
  // The enlarged first clue was visible; unseen tabs must not become inspected facts.
  assert.deepEqual(q.savedState().activeMission.clueIds, [item.clues[0].id]);
  assert.equal(q.savedState().activeMission.assisted, false, 'Reading visible facts is ordinary Guided play');
  assert.deepEqual(q.savedState().completed, {});
  assert.deepEqual(q.savedState().discoveries, []);
});

test('creations and the Discovery Book have distinct purposes while sharing earned progress', async t => {
  const q = await createQuest(t);
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  const completed = q.savedState().completed;
  q.click('[data-nav="book"]');
  assert.ok(q.query('.q-book'));
  assert.ok(q.required('.q-book-pages').textContent.includes(CONCEPTS.find(concept => concept.id === item.conceptIds[0]).text));
  assert.equal(q.query('[data-decoration], [data-postcard]'), null);
  q.click('[data-nav="creations"]');
  assert.ok(q.query('.q-creations-studio'));
  assert.ok(q.query(`[data-postcard="${item.id}"]`));
  assert.ok(q.query('[data-decoration]'));
  assert.equal(q.query('.q-book-pages'), null);
  assert.equal(q.savedState().view, 'creations');
  assert.deepEqual(q.savedState().completed, completed);
});

test('page and dialog reading controls pause, resume and stop without changing game progress', async t => {
  const q = await createQuest(t);
  const pageDock = [...q.document.querySelectorAll('[data-audio-dock]')].find(element => !element.closest('dialog'));
  assert.ok(pageDock, 'The page has accessible speech controls');
  assert.equal(pageDock.hidden, true);
  const initial = q.actualStorage.getItem(STORAGE_KEY);
  q.click('#read-aloud');
  assert.equal(pageDock.hidden, false);
  assert.equal(pageDock.querySelector('[data-audio-pause]').hidden, false);
  const firstUtterance = q.narration.utterances.at(-1);
  pageDock.querySelector('[data-audio-pause]').click();
  assert.equal(q.narration.pauses, 1);
  assert.equal(pageDock.querySelector('[data-audio-pause]').hidden, true);
  assert.equal(pageDock.querySelector('[data-audio-resume]').hidden, false);
  pageDock.querySelector('[data-audio-resume]').click();
  assert.equal(q.narration.resumes, 1);
  assert.equal(q.narration.utterances.at(-1), firstUtterance, 'Resume continues the same utterance');
  const beforeStop = q.narration.cancelled;
  pageDock.querySelector('[data-audio-stop]').click();
  assert.ok(q.narration.cancelled > beforeStop);
  assert.equal(pageDock.hidden, true);
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), initial);

  q.click('[data-mode="challenge"]');
  const item = MISSIONS[0];
  q.selectMission(item);
  q.click(`[data-clue="${item.clues[0].id}"]`);
  const afterClue = q.savedState();
  q.click('[data-word-help]');
  q.click('#q-dialog [data-hear]');
  const dialogDock = q.required('#q-dialog [data-audio-dock]');
  assert.equal(dialogDock.hidden, false);
  q.keyboardActivate('#q-dialog [data-audio-pause]');
  assert.equal(dialogDock.querySelector('[data-audio-resume]').hidden, false);
  q.keyboardActivate('#q-dialog [data-audio-resume]');
  q.keyboardActivate('#q-dialog [data-audio-stop]');
  assert.equal(dialogDock.hidden, true);
  assert.equal(q.document.activeElement, q.required('#q-dialog-close'));
  assert.deepEqual(q.savedState(), afterClue);
});

test('native Back and Forward follow story steps and picker without duplicate entries for a plan choice', async t => {
  const q = await createQuest(t);
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  const planHistoryLength = q.window.history.length;
  q.plan(item.acceptedPlans[0]);
  assert.equal(q.window.history.length, planHistoryLength, 'Selecting an answer updates this step instead of adding another Back stop');
  await q.historyMove('back');
  assert.ok(q.query('.q-stage-explore'));
  await q.historyMove('back');
  assert.ok(q.query('.q-stage-intro'));
  await q.historyMove('back');
  assert.ok(q.query('.q-picker'));
  assert.equal(q.query('.q-mission'), null);
  await q.historyMove('forward');
  assert.ok(q.query('.q-stage-intro'));
  await q.historyMove('forward');
  assert.ok(q.query('.q-stage-explore'));
  await q.historyMove('forward');
  assert.ok(q.query('.q-stage-plan'));
  assert.equal(q.savedState().activeMission.plan[item.slots[0].id], item.acceptedPlans[0][item.slots[0].id]);
  assert.deepEqual(q.savedState().completed, {});
});

test('native Back preserves earned rewards and postcard designs across old story and creations screens', async t => {
  const q = await createQuest(t);
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  q.click(`[data-reflection="${item.reflection.correctId}"]`);
  const earned = q.savedState();
  await q.historyMove('back');
  assert.ok(q.query('.q-stage-feedback'));
  assert.deepEqual(q.savedState().completed, earned.completed);
  assert.deepEqual(q.savedState().reflections, earned.reflections);
  assert.deepEqual(q.savedState().discoveries, earned.discoveries);
  q.click('[data-complete]');
  assert.match(q.required('.q-level-chip').getAttribute('aria-label'), /35 Sparks/);
  assert.deepEqual(q.savedState().completed, earned.completed);
  q.click('.q-header [data-nav="home"]');
  q.click('[data-nav="creations"]');
  q.click(`[data-postcard="${item.id}"]`);
  const postcardHistoryLength = q.window.history.length;
  q.click('[data-postcard-theme="mint"]');
  q.click('[data-postcard-sticker="leaf"]');
  assert.equal(q.window.history.length, postcardHistoryLength);
  await q.historyMove('back');
  assert.ok(q.query('.q-creations-studio'));
  assert.equal(q.query('.q-postcard-studio'), null);
  assert.deepEqual(q.savedState().postcards[item.id], { theme: 'mint', sticker: 'leaf' });
  await q.historyMove('forward');
  assert.ok(q.query('.q-postcard-studio'));
  assert.equal(q.required('[data-postcard-theme="mint"]').getAttribute('aria-pressed'), 'true');
  assert.equal(q.required('[data-postcard-sticker="leaf"]').getAttribute('aria-pressed'), 'true');
  assert.match(q.required('.q-level-chip').getAttribute('aria-label'), /35 Sparks/);
});

test('reset followed by reload and native Back cannot reopen a cleared adventure', async t => {
  let q = await createQuest(t);
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  const beforeResetEntry = structuredClone(q.window.history.state);
  q.click('#quest-settings');
  q.click('#q-reset');
  q.click('#q-confirm-reset');
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), null);
  const afterResetEntry = structuredClone(q.window.history.state);
  q.dispose();
  q = await createQuest(t, { historyEntries: [beforeResetEntry, afterResetEntry] });
  assert.ok(q.query('.q-home'));
  await q.historyMove('back');
  assert.ok(q.query('.q-home'), 'Pre-reset history must stay behind the reset boundary after reloading');
  assert.equal(q.query('.q-mission, [data-complete], [data-continue]'), null);
  assert.match(q.required('.q-level-chip').getAttribute('aria-label'), /0 Sparks/);
  assert.equal(q.actualStorage.getItem('adult-session-fixture'), 'Adult journey remains separate');
});

test('a failed storage reset keeps the adventure and explains the failure before a reload', async t => {
  let q = await createQuest(t, { storageRemovalBlocked: true });
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  const saved = q.actualStorage.getItem(STORAGE_KEY);
  const historyEntry = structuredClone(q.window.history.state);
  q.click('#quest-settings');
  q.click('#q-reset');
  q.click('#q-confirm-reset');
  assert.equal(q.required('#q-dialog').open, true);
  assert.match(q.required('#q-confirm-reset').textContent, /Could not reset/);
  assert.match(q.required('#q-announcement').textContent, /could not clear saved progress.*adventure is still here/s);
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), saved);
  assert.deepEqual(q.window.history.state, historyEntry, 'A failed reset cannot invalidate a still-saved adventure');
  q.click('#q-dialog-close');
  assert.ok(q.query('.q-stage-outcome'));
  q.dispose();
  q = await createQuest(t, { saved });
  assert.ok(q.query('.q-stage-outcome'));
  assert.ok(q.savedState().completed[item.id]);
  assert.equal(q.actualStorage.getItem('adult-session-fixture'), 'Adult journey remains separate');
});

test('reset then Back then reload cannot adopt the old entry epoch or resurrect its mission', async t => {
  let q = await createQuest(t);
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('#quest-settings');
  q.click('#q-reset');
  q.click('#q-confirm-reset');
  await q.historyMove('back');
  assert.ok(q.query('.q-home'));
  const currentEntry = structuredClone(q.window.history.state);
  q.dispose();
  q = await createQuest(t, { historyEntries: [currentEntry] });
  assert.ok(q.query('.q-home'));
  assert.equal(q.query('.q-mission, [data-continue]'), null);
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), null);
  assert.match(q.required('.q-level-chip').getAttribute('aria-label'), /0 Sparks/);
});

test('a cached-page return rebinds real sorting drags without awarding or changing saved progress', async t => {
  const q = await createQuest(t);
  q.click('[data-sort-start]');
  const saved = q.actualStorage.getItem(STORAGE_KEY);
  const card = SORT_ITEMS.find(item => item.id === q.savedState().sorting.itemIds[0]);
  // Dispatch the same pointer protocol used by a browser; layout rectangles are
  // supplied because jsdom has no visual layout, not to bypass drag callbacks.
  function pointer(target, type, x, y) {
    const event = new q.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 17 }, isPrimary: { value: true }, pointerType: { value: 'mouse' } });
    target.dispatchEvent(event);
  }
  pointer(q.required('[data-sort-drag]'), 'pointerdown', 10, 10);
  pointer(q.document, 'pointermove', 30, 30);
  assert.ok(q.query('.q-drag-ghost'));
  q.window.dispatchEvent(new q.window.PageTransitionEvent('pagehide', { persisted: true }));
  assert.equal(q.query('.q-drag-ghost'), null);
  q.window.dispatchEvent(new q.window.PageTransitionEvent('pageshow', { persisted: true }));
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), saved, 'cache restoration is presentation only');
  const destination = q.required(`[data-destination="${card.answer}"]`);
  destination.getBoundingClientRect = () => ({ left: 100, top: 100, right: 180, bottom: 180, width: 80, height: 80 });
  pointer(q.required('[data-sort-drag]'), 'pointerdown', 10, 10);
  pointer(q.document, 'pointermove', 130, 130);
  assert.ok(q.query('.q-drag-ghost'), 'the returned screen has an active drag binding');
  pointer(q.document, 'pointerup', 130, 130);
  assert.equal(q.query('.q-drag-ghost'), null);
  assert.equal(q.savedState().sorting.feedback.correct, true);
  assert.deepEqual(q.savedState().sorting.answers[card.id], { assisted: false });
});

test('a child can drag the item picture itself with a finger, or tap it and then tap a destination', async t => {
  const q = await createQuest(t);
  q.click('[data-sort-start]');
  const first = SORT_ITEMS.find(item => item.id === q.savedState().sorting.itemIds[0]);
  const picture = q.required('[data-sort-picture]');
  assert.equal(picture.tagName, 'BUTTON', 'The artwork has the same keyboard and tap access as Move');
  assert.ok(picture.querySelector('svg'), 'The drag begins on the actual illustrated item');
  const wrong = ['ewaste', 'paper', 'ask'].find(id => id !== first.answer);
  q.required(`[data-destination="${wrong}"]`).getBoundingClientRect = () => ({ left: 100, top: 100, right: 180, bottom: 180, width: 80, height: 80 });
  // Synthetic touch pointer events exercise the real shared drag listener. The
  // fixture supplies geometry because jsdom never lays out destination tiles.
  for (const [target, type, coordinate] of [[picture, 'pointerdown', 10], [q.document, 'pointermove', 130], [q.document, 'pointerup', 130]]) {
    const event = new q.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: coordinate, clientY: coordinate });
    Object.defineProperties(event, { pointerId: { value: 41 }, isPrimary: { value: true }, pointerType: { value: 'touch' } });
    target.dispatchEvent(event);
    if (type === 'pointermove') {
      const ghost = q.required('.q-drag-ghost');
      assert.equal(ghost.tagName.toLowerCase(), 'svg', 'Only the product artwork follows the child\'s finger');
      assert.equal(ghost.querySelector('button, h2, p, .q-card-number'), null);
      assert.doesNotMatch(ghost.textContent, /Move|Pick up/);
      assert.ok(q.required('.q-sort-object-copy').textContent.includes(first.condition));
      assert.equal(q.required('.q-sort-object-copy').style.transform, '');
      assert.equal(q.required('.q-sort-object').classList.contains('q-drag-source'), false);
      assert.equal(picture.querySelector('svg').classList.contains('q-drag-source'), true);
    }
  }
  assert.equal(q.query('.q-drag-ghost'), null);
  assert.equal(q.savedState().sorting.feedback.correct, false);
  assert.deepEqual(q.savedState().sorting.answers, {});
  assert.equal(Number(q.required('[data-spark-value]').textContent), 0);
  q.keyboardActivate('[data-sort-retry]');
  const beforePickUp = q.actualStorage.getItem(STORAGE_KEY);
  q.keyboardActivate('[data-sort-picture]');
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), beforePickUp, 'Picking up the picture is not an answer');
  q.keyboardActivate(`[data-destination="${first.answer}"]`);
  assert.equal(q.savedState().sorting.feedback.correct, true);
  assert.deepEqual(q.savedState().sorting.answers[first.id], { assisted: true });
  assert.deepEqual(q.savedState().sortedItems, [first.id]);
});

test('replayed sorting pictures increase the visible round count while new pictures also increase saved Sparks', async t => {
  let q = await createQuest(t, { reducedMotion: true });
  q.click('[data-sort-start]');
  for (let index = 0; index < 5; index += 1) {
    const item = SORT_ITEMS.find(card => card.id === q.savedState().sorting.itemIds[index]);
    q.click(`[data-destination="${item.answer}"]`);
    q.click('[data-sort-next]');
  }
  const saved = q.actualStorage.getItem(STORAGE_KEY);
  const previouslySolved = new Set(q.savedState().sortedItems);
  q.dispose();
  q = await createQuest(t, { saved, reducedMotion: true });
  q.click('[data-sort-start]');
  let replayed = 0;
  for (let index = 0; index < 5; index += 1) {
    const before = q.savedState();
    const item = SORT_ITEMS.find(card => card.id === before.sorting.itemIds[index]);
    const previousPoints = Number(q.required('[data-spark-value]').textContent);
    const isReplay = previouslySolved.has(item.id);
    const reward = isReplay ? 0 : 5 + (before.discoveries.includes(item.conceptId) ? 0 : 5);
    if (isReplay) assert.match(q.required('.q-sort-point-note').textContent, /Practice picture: grow your round count/);
    else assert.match(q.required('.q-sort-point-note').textContent, new RegExp(`\\+${reward} Sparks`));
    q.click(`[data-destination="${item.answer}"]`);
    assert.equal(Number(q.required('[data-spark-value]').textContent), previousPoints + reward);
    assert.match(q.required('.q-round-hud').textContent, new RegExp(`${index + 1}\\s*\\/\\s*5 sorted`));
    if (isReplay) {
      replayed += 1;
      assert.match(q.required('.q-earned-note').textContent, /round count went up/);
      assert.doesNotMatch(q.required('.q-earned-note').textContent, /\+\d/);
    }
    previouslySolved.add(item.id);
    assert.match(q.required('.q-round-hud').textContent, new RegExp(`${previouslySolved.size}\\s*\\/\\s*12 different pictures`));
    assert.deepEqual(new Set(q.savedState().sortedItems), previouslySolved);
    q.click('[data-sort-next]');
  }
  assert.ok(replayed > 0, 'The normal next round must actually exercise a previously solved picture');
  assert.match(q.required('.q-round-hud').textContent, /5\s*\/\s*5 sorted/);
});

test('a mixed two-item plan explains each result, preserves the good choice and removes stale praise after an edit', async t => {
  const q = await createQuest(t);
  const item = MISSIONS.find(mission => mission.slots.length === 2);
  const [goodSlot, retrySlot] = item.slots.map(slot => slot.id);
  const accepted = item.acceptedPlans[0];
  const wrongId = item.allowedActions.find(action => !item.acceptedPlans.some(plan => plan[retrySlot] === action.id)).id;
  q.selectMission(item);
  q.inspect(item);
  q.plan({ [goodSlot]: accepted[goodSlot], [retrySlot]: wrongId });
  q.click('[data-check-plan]');
  const kept = q.required(`[data-plan-result="${goodSlot}"]`);
  const retry = q.required(`[data-plan-result="${retrySlot}"]`);
  assert.equal(kept.classList.contains('correct'), true);
  assert.equal(retry.classList.contains('retry'), true);
  assert.ok(kept.textContent.includes(item.slots[0].label));
  assert.ok(retry.textContent.includes(item.slots[1].label));
  assert.ok(kept.querySelector('p')?.textContent.trim(), 'The good result says why it fits');
  assert.ok(retry.querySelector('p')?.textContent.trim(), 'The other result gives a reason to try again');
  assert.equal(q.query('[data-complete]'), null);
  const mixed = q.savedState().activeMission.plan;
  q.click('[data-retry]');
  assert.deepEqual(q.savedState().activeMission.plan, mixed, 'Retry keeps both choices for the child to review');
  assert.equal(q.required(`[data-plan-slot="${goodSlot}"]`).closest('.q-slot-wrap').classList.contains('q-kept-choice'), true, 'The matching item is marked as a choice to keep');
  // Looking up another clue must not erase the checked choice the child can keep.
  q.click('[data-show-facts]');
  q.click(`[data-picture-clue="${item.clues.at(-1).id}"]`);
  q.click('[data-close-picture-help]');
  assert.equal(q.required(`[data-plan-slot="${goodSlot}"]`).closest('.q-slot-wrap').classList.contains('q-kept-choice'), true);
  const changedGoodId = item.allowedActions.find(action => action.id !== accepted[goodSlot]).id;
  q.plan({ [goodSlot]: changedGoodId });
  assert.equal(q.required(`[data-plan-slot="${goodSlot}"]`).closest('.q-slot-wrap').classList.contains('q-kept-choice'), false, 'An edited choice must not keep the previous green result');
  q.plan(accepted);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  assert.ok(q.savedState().completed[item.id]);
});

test('speech ending or failing during control activation leaves keyboard focus on a visible control', async t => {
  const q = await createQuest(t);
  const pauseSelector = 'body > [data-audio-dock] [data-audio-pause]';
  q.click('#read-aloud');
  q.required(pauseSelector).focus();
  q.narration.utterances.at(-1).onend();
  assert.equal(q.document.activeElement, q.required('#read-aloud'), 'natural completion must not hide the focused control');
  q.click('#read-aloud');
  q.narration.pause = () => { q.narration.utterances.at(-1).onend?.(); };
  q.keyboardActivate(pauseSelector);
  assert.equal(q.document.activeElement, q.required('#read-aloud'), 'synchronous completion must not focus hidden Resume');
  q.click('#read-aloud');
  q.narration.pause = () => { throw new Error('native pause failed'); };
  q.keyboardActivate(pauseSelector);
  assert.equal(q.document.activeElement, q.required('#read-aloud'), 'speech errors leave a useful fallback focus');
});

test('Back to Explore keeps help already used when the child chooses a new plan', async t => {
  const q = await createQuest(t);
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.click('[data-hint]');
  q.click('[data-close-picture-help]');
  assert.equal(q.savedState().activeMission.assisted, true);
  const knownClues = q.savedState().activeMission.clueIds;
  await q.historyMove('back');
  assert.ok(q.query('.q-stage-explore'));
  q.click('[data-open-plan]');
  assert.equal(q.savedState().activeMission.assisted, true, 'Back is not a way to erase previously used help');
  assert.deepEqual(new Set(q.savedState().activeMission.clueIds), new Set(knownClues));
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  assert.deepEqual(q.savedState().completed[item.id], { assisted: true });
});

test('sorting keeps one activity history entry and resumes answers and help after Book and Back', async t => {
  const q = await createQuest(t);
  q.click('[data-sort-start]');
  const length = q.window.history.length;
  const cards = q.savedState().sorting.itemIds.map(id => SORT_ITEMS.find(item => item.id === id));
  const wrong = ['ewaste', 'paper', 'ask'].find(destination => destination !== cards[0].answer);
  q.click(`[data-destination="${wrong}"]`);
  q.click('[data-sort-retry]');
  q.click(`[data-destination="${cards[0].answer}"]`);
  q.click('[data-sort-next]');
  assert.equal(q.window.history.length, length, 'answers and Next update the activity instead of adding browser Back steps');
  const before = q.savedState().sorting;
  assert.deepEqual(before.answers[cards[0].id], { assisted: true });
  q.click('[data-nav="book"]');
  await q.historyMove('back');
  assert.ok(q.required('.q-sort-object').textContent.includes(cards[1].title));
  q.click(`[data-destination="${cards[1].answer}"]`);
  const after = q.savedState().sorting;
  assert.equal(after.round, before.round);
  assert.equal(after.index, 1);
  assert.deepEqual(after.assistedIds, before.assistedIds);
  assert.deepEqual(after.answers[cards[0].id], before.answers[cards[0].id]);
  assert.deepEqual(after.answers[cards[1].id], { assisted: false });
});

test('a failed reset leaves the existing sorting drag usable after closing its message', async t => {
  const q = await createQuest(t, { storageRemovalBlocked: true });
  q.click('[data-sort-start]');
  const card = SORT_ITEMS.find(item => item.id === q.savedState().sorting.itemIds[0]);
  q.click('#quest-settings');
  q.click('#q-reset');
  q.click('#q-confirm-reset');
  assert.match(q.required('#q-confirm-reset').textContent, /Could not reset/);
  q.click('#q-dialog-close');
  q.required(`[data-destination="${card.answer}"]`).getBoundingClientRect = () => ({ left: 100, top: 100, right: 180, bottom: 180, width: 80, height: 80 });
  // A real drag sequence detects removed listeners that a tap-only check would miss.
  for (const [target, type, coordinate] of [[q.required('[data-sort-drag]'), 'pointerdown', 10], [q.document, 'pointermove', 130], [q.document, 'pointerup', 130]]) {
    const event = new q.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: coordinate, clientY: coordinate });
    Object.defineProperties(event, { pointerId: { value: 23 }, isPrimary: { value: true }, pointerType: { value: 'mouse' } });
    target.dispatchEvent(event);
  }
  assert.equal(q.savedState().sorting.feedback?.correct, true);
  assert.deepEqual(q.savedState().sorting.answers[card.id], { assisted: false });
});

test('Hear this fact reads the selected evidence and a browser interruption offers a usable retry', async t => {
  const q = await createQuest(t);
  const item = MISSIONS.find(mission => mission.clues.length > 1);
  q.selectMission(item);
  const saved = q.actualStorage.getItem(STORAGE_KEY);
  const dock = q.required('body > [data-audio-dock]');
  for (const clue of item.clues) {
    q.click(`[data-picture-clue="${clue.id}"]`);
    q.click(`[data-hear-fact="${clue.id}"]`);
    assert.equal(q.narration.utterances.at(-1).text, clue.text, 'The selected fact must not fall back to the story heading');
    assert.equal(dock.hidden, false);
    assert.equal(dock.querySelector('[data-audio-pause]').hidden, false);
  }
  q.narration.utterances.at(-1).onerror({ error: 'interrupted' });
  assert.equal(dock.hidden, false, 'Unexpected silence needs visible feedback');
  assert.match(dock.querySelector('[data-audio-status]').textContent, /voice stopped.*try again/i);
  assert.equal(dock.querySelector('[data-audio-pause]').hidden, true);
  assert.equal(dock.querySelector('[data-audio-resume]').hidden, true);
  assert.equal(dock.querySelector('[data-audio-stop]').hidden, true);
  q.click(`[data-picture-clue="${item.clues[0].id}"]`);
  q.click(`[data-hear-fact="${item.clues[0].id}"]`);
  assert.equal(q.narration.utterances.at(-1).text, item.clues[0].text);
  assert.equal(dock.querySelector('[data-audio-pause]').hidden, false);
  assert.deepEqual(q.savedState().completed, JSON.parse(saved).completed, 'Listening does not complete or reward a story');
  assert.deepEqual(q.savedState().discoveries, JSON.parse(saved).discoveries);
});

test('the tablet progress bar remains outside changing play screens and sound is an independent saved choice', async t => {
  const q = await createQuest(t);
  const hud = q.required('#q-game-hud');
  assert.ok(hud.closest('.q-game-chrome'), 'The score belongs to the persistent game chrome');
  assert.equal(q.required('#quest-app').contains(hud), false, 'Scrolling or replacing a scene cannot bury or remove the score container');
  assert.equal(q.document.querySelectorAll('#q-game-hud').length, 1);
  assert.equal(q.required('[data-game-sound]').getAttribute('aria-pressed'), 'false');
  q.selectMission(MISSIONS[0]);
  const beforeSound = q.savedState();
  q.click('[data-game-sound]');
  assert.equal(q.savedState().settings.sound, true);
  assert.equal(q.savedState().settings.narration, false, 'Game tones do not turn on automatic reading');
  assert.equal(q.required('[data-game-sound]').getAttribute('aria-pressed'), 'true');
  const afterSound = q.savedState();
  assert.deepEqual({ ...afterSound, settings: { ...afterSound.settings, sound: beforeSound.settings.sound } }, beforeSound, 'Choosing sound changes no answer, discovery or reward');
  assert.equal(q.required('#q-game-hud'), hud, 'A scene render retains the original HUD container');
  q.click('[data-game-sound]');
  assert.equal(q.savedState().settings.sound, false);
  assert.equal(q.required('[data-game-sound]').getAttribute('aria-pressed'), 'false');
  q.click('.q-header [data-nav="home"]');
  assert.equal(q.required('#q-game-hud'), hud);
  assert.equal(q.document.querySelectorAll('#q-game-hud').length, 1);
});

test('earned stars travel before the HUD fills, while points are saved once and replay earns no extra Sparks', async t => {
  const q = await createQuest(t, { controlledAnimations: true });
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  const earned = 20 + new Set(item.conceptIds).size * 5;
  assert.ok(q.savedState().completed[item.id], 'Progress is already saved even while decorative stars are travelling');
  assert.deepEqual(new Set(q.savedState().discoveries), new Set(item.conceptIds));
  assert.equal(Number(q.required('[data-spark-value]').textContent), 0, 'The top bar waits for the arriving stars');
  assert.equal(q.required('.q-reward-fx').style.position, 'fixed');
  assert.equal(q.required('.q-reward-fx').style.pointerEvents, 'none', 'Celebration never blocks a tablet tap');
  assert.equal(q.required('.q-reward-fx').getAttribute('aria-hidden'), 'true', 'The live status announces the reward once; particles are decoration');
  assert.match(q.required('.q-reward-fx__amount').textContent, new RegExp(`^\\+${earned}$`));
  assert.equal(q.required('.q-reward-fx').contains(q.document.activeElement), false);
  const finalStar = q.animations.findLast(animation => animation.element.matches('.q-reward-fx__star') && typeof animation.onfinish === 'function');
  assert.ok(finalStar, 'Native animation moves authored stars toward the HUD');
  const completed = q.actualStorage.getItem(STORAGE_KEY);
  finalStar.finish();
  assert.equal(Number(q.required('[data-spark-value]').textContent), earned);
  assert.equal(q.required('[role="progressbar"]').getAttribute('aria-valuenow'), String(Math.round(earned / 60 * 100)));
  assert.match(q.required('#q-announcement').textContent, /Sparks/);
  const settledHud = q.required('#q-game-hud').innerHTML;
  finalStar.finish();
  assert.equal(q.required('#q-game-hud').innerHTML, settledHud, 'A repeated native finish cannot fill the meter twice');
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), completed, 'The animation never saves or awards progress');

  // Replaying stays fun but cannot be used to farm an already-earned story.
  q.click('[data-replay]');
  q.click('[data-start-mission]');
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  assert.equal(Number(q.required('[data-spark-value]').textContent), earned);
  assert.ok(q.required('.q-reward-fx__label').textContent.trim().length > 0, 'Replays still receive a joyful message');
  assert.doesNotMatch(q.required('.q-reward-fx__amount').textContent, /\+/);
  assert.equal(Object.keys(q.savedState().completed).length, 1);
  assert.deepEqual(new Set(q.savedState().discoveries), new Set(item.conceptIds));
});

test('leaving a star flight settles the next screen from saved progress and ignores late animation callbacks', async t => {
  const q = await createQuest(t, { controlledAnimations: true });
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  const finalStar = q.animations.findLast(animation => animation.element.matches('.q-reward-fx__star') && typeof animation.onfinish === 'function');
  assert.ok(finalStar);
  const lateFinish = finalStar.onfinish;
  const completed = q.savedState().completed;
  const discoveries = q.savedState().discoveries;
  q.click('.q-header [data-nav="home"]');
  assert.equal(q.query('.q-reward-fx'), null);
  assert.equal(finalStar.cancelled, true);
  assert.equal(Number(q.required('[data-spark-value]').textContent), 20 + new Set(item.conceptIds).size * 5);
  const settledHud = q.required('#q-game-hud').innerHTML;
  const liveStatus = q.required('#q-announcement').textContent;
  lateFinish();
  assert.equal(q.required('#q-game-hud').innerHTML, settledHud);
  assert.equal(q.required('#q-announcement').textContent, liveStatus);
  assert.deepEqual(q.savedState().completed, completed);
  assert.deepEqual(q.savedState().discoveries, discoveries);
  assert.ok(q.query('.q-home'));
});

test('the compact plan reveals pictures inline without resetting either choice or earning anything', async t => {
  const q = await createQuest(t);
  const item = MISSIONS.find(mission => mission.clues.length > 1);
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  const before = q.actualStorage.getItem(STORAGE_KEY);
  assert.equal(q.query('#quest-app .q-picture-fact'), null, 'Full evidence cards do not push the tablet choices down the page');
  q.keyboardActivate('[data-show-facts]');
  assert.equal(q.required('#q-dialog').open, false);
  assert.ok(q.required('[data-picture-help]').querySelector('svg'), 'Picture help includes a real illustration');
  for (const clue of item.clues) {
    q.keyboardActivate(`[data-picture-clue="${clue.id}"]`);
    assert.ok(q.required('[data-picture-help-text]').textContent.includes(clue.text), `Every fact remains available: ${clue.id}`);
  }
  q.click('[data-close-picture-help]');
  assert.equal(q.required('#q-dialog').open, false);
  assert.equal(q.query('[data-picture-help]'), null);
  assert.equal(q.document.activeElement, q.required('[data-show-facts]'));
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), before);
});

test('reduced motion awards the same Sparks immediately without requiring a star flight', async t => {
  const q = await createQuest(t, { controlledAnimations: true, reducedMotion: true });
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  assert.equal(Number(q.required('[data-spark-value]').textContent), 20 + new Set(item.conceptIds).size * 5);
  assert.equal(q.required('.q-reward-fx').dataset.reducedMotion, 'true');
  assert.equal(q.query('.q-reward-fx__star'), null);
  assert.equal(q.animations.filter(animation => animation.element.matches('.q-reward-fx__star')).length, 0);
  assert.ok(q.savedState().completed[item.id]);
  assert.ok(q.required('[data-picker]'), 'The child can continue immediately without waiting for an effect');
});

test('rejected browser animations retain the completed story and a usable up-to-date score', async t => {
  const q = await createQuest(t, { controlledAnimations: 'reject' });
  const item = MISSIONS[0];
  q.selectMission(item);
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  assert.equal(Number(q.required('[data-spark-value]').textContent), 20 + new Set(item.conceptIds).size * 5);
  assert.ok(q.savedState().completed[item.id]);
  assert.equal(q.required('h1').textContent, item.outcome.title);
  q.click('.q-header [data-nav="home"]');
  assert.ok(q.query('.q-home'));
  assert.equal(q.query('.q-reward-fx'), null);
});

test('device reduced motion stays the default while an explicit Game animations choice can enable and disable flight', async t => {
  const q = await createQuest(t, { controlledAnimations: true, reducedMotion: true });
  const item = MISSIONS[0];
  assert.equal(q.document.documentElement.dataset.motion, 'reduce');
  q.selectMission(item);
  assert.equal(q.savedState().settings.motion, 'auto');
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  const firstTotal = 20 + new Set(item.conceptIds).size * 5;
  assert.equal(q.query('.q-reward-fx__star'), null, 'Default play follows the device request for less movement');
  assert.equal(Number(q.required('[data-spark-value]').textContent), firstTotal);

  // The user changes only the game preference; the simulated device keeps its
  // reduced-motion preference, proving the override is deliberate and reversible.
  q.keyboardActivate('[data-game-settings]');
  assert.match(q.required('#q-motion option[value="full"]').textContent, /Game animations/);
  q.change('#q-motion', 'full');
  q.click('#q-dialog-close');
  // Changing a setting replaces HUD contents; modal close finds the new gear,
  // rather than returning focus to the removed button that opened the dialog.
  assert.equal(q.document.activeElement, q.required('[data-game-settings]'));
  assert.equal(q.media.matches, true);
  assert.equal(q.savedState().settings.motion, 'full');
  assert.equal(q.document.documentElement.dataset.motion, 'full');
  q.keyboardActivate(`[data-reflection="${item.reflection.correctId}"]`);
  assert.equal(q.savedState().reflections[item.id], item.reflection.correctId);
  assert.equal(q.required('.q-reward-fx').dataset.reducedMotion, 'false');
  assert.equal(q.document.querySelectorAll('.q-reward-fx__star').length, 12);
  const finalStar = q.animations.findLast(animation => animation.element.matches('.q-reward-fx__star') && typeof animation.onfinish === 'function');
  assert.ok(finalStar);
  finalStar.finish();
  assert.equal(Number(q.required('[data-spark-value]').textContent), firstTotal + 10);

  q.keyboardActivate('[data-game-settings]');
  q.change('#q-motion', 'reduce');
  q.click('#q-dialog-close');
  assert.equal(q.document.activeElement, q.required('[data-game-settings]'));
  assert.equal(q.savedState().settings.motion, 'reduce');
  assert.equal(q.document.documentElement.dataset.motion, 'reduce');
  q.click('[data-replay]');
  q.click('[data-start-mission]');
  q.inspect(item);
  q.plan(item.acceptedPlans[0]);
  q.click('[data-check-plan]');
  q.click('[data-complete]');
  assert.equal(q.required('.q-reward-fx').dataset.reducedMotion, 'true');
  assert.equal(q.query('.q-reward-fx__star'), null, 'Less movement immediately restores static celebration');
  assert.equal(Number(q.required('[data-spark-value]').textContent), firstTotal + 10);
});

test('the visible animation button explicitly overrides the device, preserves progress and survives reload', async t => {
  let q = await createQuest(t, { reducedMotion: true });
  assert.ok(q.required('#quest-app').classList.contains('q-play-enter'), 'Arrival includes the character greeting hook');
  assert.equal(q.document.documentElement.dataset.motion, 'reduce');
  assert.equal(q.required('[data-game-motion]').getAttribute('aria-pressed'), 'false');
  assert.match(q.required('[data-game-motion]').textContent, /Animations off/);
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), null, 'Merely visiting never opts into animation or rewrites a save');
  q.keyboardActivate('[data-game-motion]');
  assert.equal(q.media.matches, true, 'The device itself still requests reduced motion');
  assert.equal(q.savedState().settings.motion, 'full');
  assert.equal(q.document.documentElement.dataset.motion, 'full');
  assert.equal(q.required('[data-game-motion]').getAttribute('aria-pressed'), 'true');
  assert.equal(q.document.activeElement, q.required('[data-game-motion]'));
  assert.equal(Number(q.required('[data-spark-value]').textContent), 0);
  assert.deepEqual(q.savedState().sortedItems, []);
  assert.deepEqual(q.savedState().completed, {});
  const saved = q.actualStorage.getItem(STORAGE_KEY);
  q.dispose();
  q = await createQuest(t, { saved, reducedMotion: true });
  assert.equal(q.document.documentElement.dataset.motion, 'full');
  assert.equal(q.required('[data-game-motion]').getAttribute('aria-pressed'), 'true');
  assert.ok(q.required('#quest-app').classList.contains('q-play-enter'));
  q.keyboardActivate('[data-game-motion]');
  assert.equal(q.savedState().settings.motion, 'reduce');
  assert.equal(q.document.documentElement.dataset.motion, 'reduce');
  assert.equal(q.required('[data-game-motion]').getAttribute('aria-pressed'), 'false');
  assert.match(q.required('#q-announcement').textContent, /Animations paused/);
  assert.equal(Number(q.required('[data-spark-value]').textContent), 0);
  assert.deepEqual(q.savedState().sortedItems, []);
});

test('the home animation invitation still enables motion after the device preference changes while the page is open', async t => {
  const q = await createQuest(t, { reducedMotion: true });
  const invitation = q.required('[data-enable-game-motion]');
  assert.match(invitation.textContent, /Make Pip and Flo move/);
  assert.equal(q.document.documentElement.dataset.motion, 'reduce');
  // The OS can change while the child is looking at an already-rendered button.
  // Send the real media listener a new preference without rebuilding that screen.
  q.media.matches = false;
  for (const callback of q.media.callbacks) callback({ matches: false });
  assert.equal(q.document.documentElement.dataset.motion, 'full');
  assert.equal(q.required('[data-game-motion]').getAttribute('aria-pressed'), 'true', 'The visible HUD follows the new device setting immediately');
  assert.equal(q.required('[data-enable-game-motion]'), invitation);
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), null, 'A device change itself does not save an explicit choice');
  q.keyboardActivate('[data-enable-game-motion]');
  assert.equal(q.savedState().settings.motion, 'full', 'Turn on must never act as a toggle that turns moving characters off');
  assert.equal(q.document.documentElement.dataset.motion, 'full');
  assert.equal(q.required('[data-game-motion]').getAttribute('aria-pressed'), 'true');
  assert.equal(q.query('[data-enable-game-motion]'), null);
  assert.equal(q.document.activeElement, q.required('[data-game-motion]'));
  assert.equal(Number(q.required('[data-spark-value]').textContent), 0);
  assert.deepEqual(q.savedState().sortedItems, []);
  assert.deepEqual(q.savedState().completed, {});
});

// Saying hello is an explicit audio request. The visible words teach the names,
// while progress and sound-effect preferences remain independent of narration.
test('character hello taps read the visible introduction without changing progress', async t => {
  const q = await createQuest(t);
  const saved = q.actualStorage.getItem(STORAGE_KEY);
  assert.equal(q.narration.utterances.length, 0, 'Arrival is quiet until the child requests a voice');
  for (const [character, words] of [['pip', STORY_LINES.pipHello], ['flo', STORY_LINES.floHello]]) {
    q.click(`[data-greet="${character}"]`);
    assert.equal(q.required('.q-world-dialogue').textContent, words);
    assert.equal(q.narration.utterances.at(-1).text, words);
    assert.equal(q.required('body > [data-audio-dock] [data-audio-transcript]').textContent, words);
    assert.equal(q.actualStorage.getItem(STORAGE_KEY), saved);
  }
});
