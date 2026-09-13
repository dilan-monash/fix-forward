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

// Use the shipping page rather than a parallel test-only copy of its root elements.
const html = await readFile(new URL('../quest/index.html', import.meta.url), 'utf8');
// A distinct import URL starts app.js again for each isolated page/reload fixture.
let instance = 0;

/**
 * Start an isolated Quest page with optional saved text and browser capability flags.
 * Return helpers that activate rendered controls and inspect the resulting DOM/save.
 * The URL option exercises parent entry and ordinary child entry without a web server.
 */
async function createQuest(t, { saved, storageBlocked = false, speech = true, reducedMotion = false, downloads = false, url = 'http://localhost:5055/quest/' } = {}) {
  const errors = [];
  const requests = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, { url, pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  const { document } = window;
  // jsdom lacks visual scrolling, dialog presentation and computed innerText. These
  // shims preserve the DOM behaviour needed here without pretending to measure layout.
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent; } });
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  // Let scenarios change the device motion preference and notify the real app listener.
  const media = { matches: reducedMotion, callbacks: [], addEventListener(type, callback) { if (type === 'change') this.callbacks.push(callback); } };
  window.matchMedia = () => media;
  // Record speech requests/cancellations without producing audio or using a voice service.
  const narration = { cancelled: 0, utterances: [], cancel() { this.cancelled += 1; }, speak(utterance) { this.utterances.push(utterance); }, getVoices: () => [{ lang: 'en-AU', localService: true }] };
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
  const localStorage = storageBlocked ? { getItem() { throw new Error('Policy blocks storage'); }, setItem() { throw new Error('Quota or policy'); }, removeItem() { throw new Error('Policy blocks storage'); } } : actualStorage;
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
  // Inspect each real clue dialog, including focus/content checks, then open the plan.
  const inspect = (mission, activate = click) => {
    for (const clue of mission.clues) {
      activate(`[data-clue="${clue.id}"]`);
      assert.equal(required('#q-dialog').open, true);
      assert.ok(required('#q-dialog-body').textContent.includes(clue.text));
      assert.equal(document.activeElement.id, 'q-dialog-title');
      activate('[data-close-clue]');
      assert.equal(required('#q-dialog').open, false);
    }
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
  return { window, document, query, required, click, keyboardActivate, change, savedState, actualStorage, selectMission, inspect, plan, narration, media, dispose, requests, download };
}

test('rendered mission supports wrong choice, retry, tap planning, saved discovery and optional decorating', async t => {
  const q = await createQuest(t);
  const item = MISSIONS[0];
  assert.match(q.required('h1').textContent, /Help Pip and Flo/);
  assert.match(q.required('.q-boundary').textContent, /Real appliances need adult help/);
  q.selectMission(item);
  assert.equal(q.required('[data-open-plan]').disabled, true);
  q.inspect(item);
  assert.equal(q.document.activeElement, q.required('[data-plan-focus]'));
  const wrong = item.allowedActions.find(action => !item.acceptedPlans.some(plan => plan[item.slots[0].id] === action.id));
  assert.ok(wrong);
  q.plan({ [item.slots[0].id]: wrong.id });
  q.click('[data-check-plan]');
  assert.ok(q.required('.q-feedback.retry').textContent.includes(wrong.feedback));
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
  q.click(`[data-decoration="${discovery.decoration}"]`);
  q.click('[data-decoration-slot="studio"]');
  assert.equal(q.savedState().decorations.studio, discovery.decoration);
  assert.ok(q.required('[data-decoration-slot="studio"]').textContent.includes(discovery.decoration));
  q.click('.q-footer [data-nav="grownups"]');
  const adult = q.required('a[href="/"]');
  assert.equal(adult.getAttribute('target'), '_blank');
  assert.equal(adult.search, '', 'No fictional evidence or category is silently passed to the adult app');
  assert.match(q.required('.q-grownups').textContent, /Quest never turns story answers into facts about your appliance/);
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
  assert.ok(q.required('#q-dialog-body').textContent.includes(item.clues[0].text));
  q.click('[data-close-clue]');
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
  const q = await createQuest(t);
  q.click('[data-place="station"]');
  q.click('[data-sort-start]');
  const firstIds = q.savedState().sorting.itemIds;
  for (let index = 0; index < 5; index += 1) {
    const run = q.savedState().sorting;
    const item = SORT_ITEMS.find(card => card.id === run.itemIds[index]);
    assert.ok(q.required('.q-sort-object').textContent.includes(item.title));
    if (index === 0) {
      const wrong = ['paper', 'ewaste', 'ask'].find(id => id !== item.answer);
      q.click(`[data-destination="${wrong}"]`);
      assert.equal(q.savedState().sorting.feedback.correct, false);
      assert.ok(q.required('.q-feedback.retry').textContent.includes(item.clue));
      q.click('[data-sort-retry]');
    }
    if (index === 1) {
      q.click('[data-hint]');
      assert.ok(q.required('#q-dialog-body').textContent.includes(item.clue));
      q.click('[data-close-clue]');
    }
    q.keyboardActivate(`[data-destination="${item.answer}"]`);
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
  q.click('[data-sort-start]');
  assert.equal(q.savedState().sorting.index, 0);
  assert.deepEqual(q.savedState().sorting.answers, {});
  assert.notDeepEqual(q.savedState().sorting.itemIds, firstIds);
});

test('partial sorting resumes from its companion, home and station without replacing the card or help history', async t => {
  const q = await createQuest(t);
  q.click('[data-place="station"]');
  q.click('[data-sort-start]');
  const first = SORT_ITEMS.find(item => item.id === q.savedState().sorting.itemIds[0]);
  q.click(`[data-destination="${first.answer}"]`);
  q.click('[data-sort-next]');
  q.click('[data-hint]');
  q.click('[data-close-clue]');
  const partial = q.savedState().sorting;
  const current = SORT_ITEMS.find(item => item.id === partial.itemIds[partial.index]);
  q.click('.q-footer [data-nav="grownups"]');
  assert.ok(q.query('.q-grownups'));
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
  assert.match(q.required('h1').textContent, /Help Pip and Flo/);
  assert.equal(q.actualStorage.getItem('adult-session-fixture'), 'Adult journey remains separate');
});

test('corrupt and blocked storage leave the rendered mission playable with no data API', async t => {
  let q = await createQuest(t, { saved: '{bad json' });
  assert.match(q.required('#q-announcement').textContent, /could not read the saved adventure/);
  q.selectMission(MISSIONS[0]);
  assert.ok(q.query('[data-clue]'));
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
  assert.match(q.required('.q-grownups').textContent, /blocking saving/);
  assert.deepEqual(q.requests, []);
});

test('read aloud is optional, cancels on navigation and page exit, and has a visible-text fallback', async t => {
  let q = await createQuest(t);
  assert.equal(q.narration.utterances.length, 0, 'Loading the game does not start audio');
  q.click('#read-aloud');
  assert.equal(q.narration.utterances.length, 1);
  assert.match(q.narration.utterances[0].text, /Help Pip and Flo/);
  let previous = q.narration.cancelled;
  q.click('[data-picker]');
  assert.ok(q.narration.cancelled > previous);
  q.click(`[data-mission="${MISSIONS[0].id}"]`);
  q.click('#quest-settings');
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
  q.click('[data-close-clue]');
  assert.ok(q.narration.cancelled > previous, 'The visible Keep exploring button also cancels modal narration');
  previous = q.narration.cancelled;
  q.window.dispatchEvent(new q.window.Event('pagehide'));
  assert.ok(q.narration.cancelled > previous);
  q.dispose();
  q = await createQuest(t, { speech: false });
  q.click('#read-aloud');
  assert.match(q.required('#q-announcement').textContent, /voice is not available here/);
  assert.match(q.required('h1').textContent, /Help Pip and Flo/);
});

test('story projector compares before and after without awarding again; earned postcard design survives book reload', async t => {
  let q = await createQuest(t, { reducedMotion: true });
  const item = MISSIONS[0];
  q.click('.q-header [data-nav="book"]');
  assert.equal(q.query('[data-postcard]'), null, 'Unexplored stories offer a mission, not an unearned postcard');
  assert.equal(q.document.querySelectorAll('.q-passport-story[data-mission]').length, MISSIONS.length);
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
  q.click('[data-nav="book"]');
  assert.equal(q.document.querySelectorAll('.q-passport-story[data-postcard]').length, 1);
  assert.equal(q.query(`[data-postcard="${MISSIONS[1].id}"]`), null);
  const saved = q.savedState();
  q.dispose();
  q = await createQuest(t, { saved });
  assert.ok(q.query('.q-book'));
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
  q.click('[data-nav="book"]');
  assert.deepEqual(q.download.revoked, ['blob:quest-test-1', 'blob:quest-test-2']);
  q.click(`[data-postcard="${item.id}"]`);
  q.click('[data-save-postcard]');
  q.window.dispatchEvent(new q.window.Event('pagehide'));
  assert.ok(q.download.revoked.includes('blob:quest-test-3'));
  q.click('#quest-settings');
  q.click('#q-reset');
  q.click('#q-confirm-reset');
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), null);
  q.click('.q-header [data-nav="book"]');
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
  q.click('[data-close-clue]');
  assert.equal(q.required('.q-level-chip').getAttribute('aria-label'), 'Level 1: Clue Scout. 0 Sparks. See rewards.');
  assert.equal(q.savedState().activeMission.assisted, true);
});

test('Hear this clue reads its actual evidence and Word help explains terms without changing progress', async t => {
  const q = await createQuest(t);
  const item = MISSIONS[0];
  const clue = item.clues[0];
  q.selectMission(item);
  q.click(`[data-clue="${clue.id}"]`);
  const afterClue = q.savedState();
  assert.equal(q.narration.utterances.length, 0, 'Optional read aloud waits for the child to ask');
  assert.match(q.required('#q-dialog [data-hear]').textContent, /Hear this clue/);
  q.keyboardActivate('#q-dialog [data-hear]');
  assert.equal(q.narration.utterances.at(-1).text, `${clue.title}. ${clue.text}`);
  assert.ok(q.required('.q-clue-text').textContent.includes(clue.text));
  assert.deepEqual(q.savedState(), afterClue);
  q.keyboardActivate('[data-close-clue]');
  q.keyboardActivate('[data-word-help]');
  const words = [...q.document.querySelectorAll('.q-word-list dt')].map(element => element.textContent);
  assert.deepEqual(words, ['Reuse', 'Repair', 'Recycle', 'E-waste', 'A qualified repairer']);
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
  assert.match(text, /children aged 7[–-]12/);
  assert.match(text, /Why this website\?/);
  assert.match(text, /What children practise/);
  assert.match(text, /The story supplies the facts/);
  assert.match(text, /Sparks are game progress, not a test score, ability rating or measure of real waste saved/);
  assert.match(text, /What stays private\?/);
  assert.match(text, /no names, dates of birth, photographs, contact details or locations/);
  assert.match(text, /sends no child scores, player names or analytics/);
  assert.match(text, /Voices may use an online service/);
  assert.match(text, /have not yet measured learning outcomes or tested this version with child participants/);
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
  assert.match(q.required('h1').textContent, /Help Pip and Flo/);
  assert.equal(q.actualStorage.getItem(STORAGE_KEY), serialized, 'Entry-point selection does not rewrite the saved adventure');
  q.click('[data-continue]');
  assert.ok(q.query('.q-stage-plan'));
  assert.deepEqual(q.savedState().activeMission, saved.activeMission);
  assert.equal(q.savedState().view, 'mission');
});
