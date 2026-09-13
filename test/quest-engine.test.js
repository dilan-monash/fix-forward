/**
 * Exercise the real game rules across all authored plans, retries, saves and
 * sorting rounds. These tests protect progress from duplicate/stale actions and
 * corrupt local data. The final group checks drag callbacks against controlled
 * DOM rectangles; visual layout and physical-device usability need browser review.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { MISSIONS, SORT_ITEMS, CONCEPTS } from '../quest/content.js';
import { createState, transition, sortingRound, sortingSummary, suggestedMission, hydrateState } from '../quest/engine.js';
import { STORAGE_KEY, loadProgress, saveProgress, clearProgress } from '../quest/storage.js';
import { hitTest, bindDrag } from '../quest/drag.js';
import { progression } from '../quest/progression.js';

// Dispatch a named action through production rules, keeping scenario steps readable.
function apply(state, type, args = {}) { return transition(state, { type, ...args }); }
// Reach planning by actually selecting the story and inspecting its authored clues.
function planning(mission, state = createState()) {
  state = apply(state, 'CHOOSE_MISSION', { id: mission.id });
  state = apply(state, 'START_MISSION');
  for (const clue of mission.clues) state = apply(state, 'COLLECT_CLUE', { id: clue.id });
  return apply(state, 'OPEN_PLAN');
}
// Place a supplied slot-to-action map through the same action used by taps and drops.
function fillPlan(state, plan) {
  for (const [slotId, actionId] of Object.entries(plan)) state = apply(state, 'SET_PLAN', { slotId, actionId });
  return state;
}
// Earn a story through its first accepted plan instead of fabricating a completion map.
function completed(mission, state = createState()) {
  return apply(apply(fillPlan(planning(mission, state), mission.acceptedPlans[0]), 'CHECK_PLAN'), 'COMPLETE_MISSION');
}
// Isolate saved text in a Map; initial entries allow obsolete/corrupt-save scenarios.
function memoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key), entries };
}
// Freeze every nested input so an accidental in-place engine edit fails the test.
function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
}

test('every authored mission and accepted alternative reaches one complete outcome without mutating its input', () => {
  assert.equal(MISSIONS.length, 8);
  let all = createState();
  for (const mission of MISSIONS) {
    assert.ok(mission.clues.length >= 2 && mission.clues.length <= 3);
    assert.ok(mission.allowedActions.every(action => typeof action.feedback === 'string' && action.feedback.length > 15));
    for (const plan of mission.acceptedPlans) {
      const before = deepFreeze(fillPlan(planning(mission), plan));
      const checked = apply(before, 'CHECK_PLAN');
      assert.equal(checked.activeMission.feedback.correct, true, mission.id);
      assert.equal(apply(checked, 'CHECK_PLAN'), checked, 'Repeated check cannot update progress');
      const finished = apply(checked, 'COMPLETE_MISSION');
      assert.equal(finished.activeMission.step, 'outcome');
      assert.deepEqual(finished.completed[mission.id], { assisted: false });
      assert.ok(mission.conceptIds.every(id => finished.discoveries.includes(id)));
      assert.equal(apply(finished, 'COMPLETE_MISSION'), finished);
      assert.equal(before.activeMission.step, 'plan');
      assert.deepEqual(before.completed, {});
    }
    all = completed(mission, all);
  }
  assert.equal(Object.keys(all.completed).length, 8);
  assert.equal(new Set(all.discoveries).size, all.discoveries.length);
});

test('clues, retries and help survive a save; a wrong answer can never finish the mission', () => {
  const mission = MISSIONS[0];
  let state = apply(createState(), 'CHOOSE_MISSION', { id: mission.id });
  state = apply(state, 'START_MISSION');
  assert.equal(apply(state, 'OPEN_PLAN'), state, 'At least one story clue is needed');
  state = apply(state, 'COLLECT_CLUE', { id: mission.clues[0].id });
  assert.equal(apply(state, 'COLLECT_CLUE', { id: mission.clues[0].id }), state);
  state = apply(state, 'OPEN_PLAN');
  const slotId = mission.slots[0].id;
  const wrong = mission.allowedActions.find(action => !mission.acceptedPlans.some(plan => plan[slotId] === action.id));
  assert.ok(wrong, 'The first mission supplies a useful wrong-choice retry');
  state = apply(state, 'SET_PLAN', { slotId, actionId: wrong.id });
  state = apply(state, 'CHECK_PLAN');
  assert.equal(state.activeMission.feedback.correct, false);
  assert.equal(apply(state, 'COMPLETE_MISSION'), state);
  const storage = memoryStorage();
  assert.equal(saveProgress(state, storage), true);
  state = loadProgress(storage).state;
  assert.equal(state.activeMission.step, 'feedback');
  assert.equal(state.activeMission.assisted, true);
  state = apply(state, 'RETRY_PLAN');
  state = fillPlan(state, mission.acceptedPlans[0]);
  state = apply(apply(state, 'CHECK_PLAN'), 'COMPLETE_MISSION');
  assert.deepEqual(state.completed[mission.id], { assisted: true });
  assert.ok(state.practice.some(id => mission.conceptIds.includes(id)));
  const discoveries = state.discoveries;
  state = completed(mission, state);
  assert.deepEqual(state.completed[mission.id], { assisted: true }, 'A replay cannot re-award or rewrite the first completion');
  assert.deepEqual(state.discoveries, discoveries);
});

test('two-part plans accept placements in either order and require both decisions', () => {
  const mission = MISSIONS.find(candidate => candidate.slots.length === 2);
  assert.ok(mission);
  let state = planning(mission);
  const entries = Object.entries(mission.acceptedPlans[0]).reverse();
  state = apply(state, 'SET_PLAN', { slotId: entries[0][0], actionId: entries[0][1] });
  assert.equal(apply(state, 'CHECK_PLAN'), state);
  state = apply(state, 'SET_PLAN', { slotId: entries[1][0], actionId: entries[1][1] });
  assert.equal(apply(state, 'CHECK_PLAN').activeMission.feedback.correct, true);
  state = apply(state, 'REMOVE_PLAN', { slotId: entries[0][0] });
  assert.equal(apply(state, 'CHECK_PLAN'), state);
});

test('a wrong plan can reopen its actual clues without erasing the plan or help history', () => {
  const mission = MISSIONS[0];
  const slotId = mission.slots[0].id;
  const wrong = mission.allowedActions.find(action => !mission.acceptedPlans.some(plan => plan[slotId] === action.id));
  let state = apply(fillPlan(planning(mission), { [slotId]: wrong.id }), 'CHECK_PLAN');
  const plan = state.activeMission.plan;
  const clues = state.activeMission.clueIds;
  state = apply(state, 'EXPLORE_AGAIN');
  assert.equal(state.activeMission.step, 'explore');
  assert.equal(state.activeMission.feedback, null);
  assert.equal(state.activeMission.plan, plan);
  assert.equal(state.activeMission.clueIds, clues);
  assert.equal(state.activeMission.assisted, true);
  state = apply(state, 'OPEN_PLAN');
  state = apply(fillPlan(state, mission.acceptedPlans[0]), 'CHECK_PLAN');
  assert.equal(apply(state, 'EXPLORE_AGAIN'), state, 'Correct feedback continues to the outcome instead');
  assert.equal(apply(state, 'COMPLETE_MISSION').completed[mission.id].assisted, true);
});

test('navigation preserves active work, settings and optional decoration choice', () => {
  const mission = MISSIONS[0];
  let state = completed(mission);
  state = apply(state, 'SET_SETTING', { key: 'mode', value: 'challenge' });
  const concept = CONCEPTS.find(item => state.discoveries.includes(item.id));
  state = apply(state, 'PLACE_DECORATION', { slotId: 'home', conceptId: concept.id });
  assert.equal(state.decorations.home, concept.decoration);
  assert.equal(apply(state, 'PLACE_DECORATION', { slotId: 'unexpected slot', conceptId: concept.id }), state);
  assert.equal(apply(state, 'PLACE_DECORATION', { slotId: 'studio', decorationId: 'private child text' }), state);
  const active = state.activeMission;
  for (const view of ['home', 'book', 'grownups', 'mission']) state = apply(state, 'NAVIGATE', { view });
  assert.equal(state.activeMission, active);
  assert.equal(state.settings.mode, 'challenge');
  assert.equal(state.settings.narration, false);
  state = apply(state, 'NAVIGATE', { view: 'grownups' });
  assert.equal(apply(state, 'COMPLETE_MISSION'), state, 'Hidden stale callbacks cannot finish a mission');
});

// A child can explicitly choose game animations without changing a tablet's own
// accessibility settings. Unrecognised save data must never make that choice.
test('motion starts with the device preference and explicit full or reduce survives a real save', () => {
  const original = deepFreeze(createState());
  assert.equal(original.settings.motion, 'auto');
  let state = original;
  const storage = memoryStorage();
  for (const motion of ['full', 'reduce', 'auto']) {
    state = apply(state, 'SET_SETTING', { key: 'motion', value: motion });
    assert.equal(state.settings.motion, motion);
    assert.equal(saveProgress(state, storage), true);
    state = loadProgress(storage).state;
    assert.equal(state.settings.motion, motion, 'Reload keeps the actual user choice');
    assert.equal(state.settings.narration, false);
    assert.equal(state.settings.sound, false);
    assert.equal(apply(state, 'SET_SETTING', { key: 'motion', value: motion }), state, 'Repeating the same choice is a no-op');
  }
  assert.equal(original.settings.motion, 'auto', 'Setting changes do not mutate the earlier save');
});

test('old or malformed motion preferences follow the device and cannot force full animation', () => {
  const full = apply(createState(), 'SET_SETTING', { key: 'motion', value: 'full' });
  for (const value of [undefined, null, true, false, 1, 'always', 'FULL', {}, []]) {
    assert.equal(apply(full, 'SET_SETTING', { key: 'motion', value }), full, 'Unknown live choices are ignored');
    const raw = { ...full, settings: { ...full.settings, motion: value } };
    assert.equal(hydrateState(raw).settings.motion, 'auto', 'Unknown saved choices fall back to the device');
  }
  const oldSave = { ...full, settings: { mode: 'guided', narration: false } };
  assert.equal(hydrateState(oldSave).settings.motion, 'auto');
});

test('suggestions use reviewed concepts, remain optional and cover unfinished missions', () => {
  const state = createState();
  assert.equal(suggestedMission(state), MISSIONS[0].id);
  const shared = CONCEPTS.find(concept => MISSIONS.filter(mission => mission.conceptIds.includes(concept.id)).length > 1);
  assert.ok(shared, 'At least one appliance concept receives a different-condition practice mission');
  const mission = MISSIONS.find(candidate => candidate.conceptIds.includes(shared.id));
  let helped = planning(mission);
  helped = apply(helped, 'HINT');
  assert.equal(apply(helped, 'HINT'), helped);
  const suggestion = MISSIONS.find(candidate => candidate.id === suggestedMission(helped));
  assert.notEqual(suggestion.id, mission.id);
  assert.ok(suggestion.conceptIds.some(id => helped.practice.includes(id)));
  const ignored = apply(helped, 'CHOOSE_MISSION', { id: MISSIONS.at(-1).id });
  assert.equal(ignored.activeMission.id, MISSIONS.at(-1).id);
});

test('ordinary sorting rounds are deterministic, varied, exactly five unique reviewed cards from twelve', () => {
  assert.equal(SORT_ITEMS.length, 12);
  const seen = new Set();
  const orders = new Set();
  for (let round = 0; round < 40; round += 1) {
    const ids = sortingRound(round);
    assert.deepEqual(ids, sortingRound(round));
    assert.equal(ids.length, 5);
    assert.equal(new Set(ids).size, 5);
    ids.forEach(id => { assert.ok(SORT_ITEMS.some(item => item.id === id)); seen.add(id); });
    orders.add(ids.join(','));
  }
  assert.equal(seen.size, 12);
  assert.ok(orders.size > 30);
});

test('twenty ordinary rounds begin with varied decisions and include at least three concepts', () => {
  for (let round = 0; round < 20; round += 1) {
    const cards = sortingRound(round).map(id => SORT_ITEMS.find(item => item.id === id));
    assert.deepEqual([...new Set(cards.slice(0, 3).map(card => card.answer))].sort(), ['ask', 'ewaste', 'paper'], `round ${round}`);
    assert.ok(new Set(cards.map(card => card.conceptId)).size >= 3, `round ${round} must practise more than packaging alone`);
  }
});

test('valid saves from the earlier selector keep their card order while corrupt rounds are discarded', () => {
  const oldOrder = ['kettle-box', 'toaster-box', 'office-paper', 'newspaper', 'shaver-ready'];
  const state = apply(createState(), 'START_SORT');
  state.sorting.itemIds = oldOrder;
  state.sorting.index = 1;
  state.sorting.answers = { 'kettle-box': { assisted: false } };
  state.sorting.assistedIds = ['toaster-box'];
  assert.deepEqual(hydrateState(state).sorting, state.sorting);
  const unknown = structuredClone(state);
  unknown.sorting.itemIds[3] = 'unreviewed-item';
  assert.equal(hydrateState(unknown).sorting, null);
  assert.equal(hydrateState(unknown).view, 'home');
  const duplicate = structuredClone(state);
  duplicate.sorting.itemIds[3] = 'kettle-box';
  assert.equal(hydrateState(duplicate).sorting, null);
});

test('sorting retries preserve help; correct placements, repeated clicks and reload never double-count', () => {
  let state = apply(createState(), 'START_SORT');
  const solved = [];
  assert.deepEqual(state.sortedItems, []);
  assert.equal(apply(state, 'START_SORT'), state);
  for (let index = 0; index < 5; index += 1) {
    const item = SORT_ITEMS.find(candidate => candidate.id === state.sorting.itemIds[index]);
    if (index === 0) {
      assert.equal(apply(state, 'ANSWER_SORT', { destinationId: null }), state);
      state = apply(state, 'HINT');
      assert.equal(apply(state, 'HINT'), state);
    }
    if (index === 1) {
      const priorPoints = progression(state).points;
      state = apply(state, 'ANSWER_SORT', { destinationId: ['ewaste', 'paper', 'ask'].find(id => id !== item.answer) });
      assert.deepEqual(state.sortedItems, solved);
      assert.equal(progression(state).points, priorPoints, 'A wrong placement changes feedback, not rewards');
      assert.equal(sortingSummary(state.sorting).total, 1);
      assert.equal(apply(state, 'NEXT_SORT'), state);
      state = hydrateState(JSON.parse(JSON.stringify(state)));
      assert.equal(state.sorting.feedback.correct, false);
      state = apply(state, 'RETRY_SORT');
    }
    const previous = deepFreeze(state);
    state = apply(state, 'ANSWER_SORT', { destinationId: item.answer });
    assert.deepEqual(previous.sortedItems, solved, 'Recording the next picture cannot mutate the prior state');
    solved.push(item.id);
    assert.deepEqual(state.sortedItems, solved);
    assert.equal(progression(state).breakdown.sorting, solved.length * 5);
    assert.equal(apply(state, 'ANSWER_SORT', { destinationId: item.answer }), state);
    state = hydrateState(JSON.parse(JSON.stringify(state)));
    assert.deepEqual(state.sortedItems, solved);
    assert.equal(state.sorting.status, 'feedback');
    state = apply(state, 'NEXT_SORT');
    assert.equal(apply(state, 'NEXT_SORT'), state);
  }
  assert.equal(state.sorting.status, 'complete');
  assert.deepEqual(sortingSummary(state.sorting), { independent: 3, helped: 2, total: 5 });
  const restored = hydrateState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.sorting, state.sorting);
  assert.deepEqual(restored.sortedItems, solved);
  assert.equal(apply(state, 'ANSWER_SORT', { destinationId: 'ask' }), state);
  const newRun = apply(state, 'START_SORT');
  assert.equal(newRun.sorting.round, 1);
  assert.deepEqual(sortingSummary(newRun.sorting), { independent: 0, helped: 0, total: 0 });
  assert.notDeepEqual(newRun.sorting.itemIds, state.sorting.itemIds);
  assert.deepEqual(newRun.sortedItems, solved, 'Starting a fresh board preserves earned picture history');
});

test('sorting save recovery filters unknown picture IDs and recovers only answers from a valid board', () => {
  const first = SORT_ITEMS[0].id;
  const second = SORT_ITEMS[1].id;
  const raw = { ...createState(), sortedItems: [first, first, second, 'PRIVATE CHILD TEXT', null, 4, { id: first }] };
  assert.deepEqual(hydrateState(raw).sortedItems, [first, second]);
  for (const sortedItems of [null, {}, 'PRIVATE CHILD TEXT']) assert.deepEqual(hydrateState({ ...raw, sortedItems }).sortedItems, []);
  const storage = memoryStorage();
  assert.equal(saveProgress(raw, storage), true);
  assert.equal(storage.getItem(STORAGE_KEY).includes('PRIVATE'), false);
  assert.deepEqual(loadProgress(storage).state.sortedItems, [first, second]);

  // Version-one boards did not save a lifetime picture list. Recover only answers
  // accepted by the board validator, excluding later cards and arbitrary text.
  const older = apply(createState(), 'START_SORT');
  delete older.sortedItems;
  const [current, future] = older.sorting.itemIds;
  older.sorting.answers = { [current]: { assisted: false }, [future]: { assisted: false }, 'PRIVATE CHILD TEXT': { assisted: false } };
  assert.deepEqual(hydrateState(older).sortedItems, [current]);
  older.sorting.itemIds[4] = 'unreviewed-picture';
  const discarded = hydrateState(older);
  assert.equal(discarded.sorting, null);
  assert.deepEqual(discarded.sortedItems, [], 'A corrupt board cannot create recovered picture rewards');
});

test('storage rejects obsolete/malformed data and whitelists authored IDs with no arbitrary personal text', () => {
  for (const raw of ['{bad json', 'null', '[]', JSON.stringify({ version: 0 }), 'x'.repeat(40001)]) {
    const result = loadProgress(memoryStorage({ [STORAGE_KEY]: raw }));
    assert.equal(result.status, 'invalid');
    assert.deepEqual(result.state, createState());
  }
  assert.equal(loadProgress(memoryStorage()).status, 'empty');
  const raw = {
    ...completed(MISSIONS[0]), name: 'PRIVATE CHILD TEXT', email: 'private@example.test',
    settings: { mode: 'PRIVATE CHILD TEXT', narration: 'yes', motion: 'always' },
    discoveries: ['PRIVATE CHILD TEXT'], practice: ['PRIVATE CHILD TEXT'], sortedItems: ['PRIVATE CHILD TEXT'],
    decorations: { home: 'PRIVATE CHILD TEXT', studio: 'unknown', station: null },
    completed: { [MISSIONS[0].id]: { assisted: false, notes: 'PRIVATE CHILD TEXT' }, 'PRIVATE CHILD TEXT': { assisted: false } }
  };
  raw.activeMission.clueIds.push('PRIVATE CHILD TEXT');
  raw.activeMission.plan['PRIVATE CHILD TEXT'] = 'PRIVATE CHILD TEXT';
  const storage = memoryStorage({ adultJourney: 'unchanged' });
  assert.equal(saveProgress(raw, storage), true);
  const saved = storage.getItem(STORAGE_KEY);
  assert.equal(saved.includes('PRIVATE'), false);
  assert.equal(saved.includes('private@example'), false);
  assert.equal(loadProgress(storage).status, 'restored');
  assert.deepEqual(loadProgress(storage).state.settings, createState().settings);
  assert.equal(clearProgress(storage), true);
  assert.equal(storage.getItem('adultJourney'), 'unchanged');
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('blocked reads, quota failures and blocked removal do not prevent state transitions', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } };
  const result = loadProgress(blocked);
  assert.equal(result.status, 'unavailable');
  assert.equal(saveProgress(result.state, blocked), false);
  assert.equal(clearProgress(blocked), false);
  assert.equal(apply(result.state, 'START_SORT').sorting.itemIds.length, 5);
  assert.equal(loadProgress(null).status, 'unavailable');
});

test('corrupt active state cannot skip required clues, missing cards or record unknown IDs', () => {
  const mission = MISSIONS[0];
  const state = completed(mission);
  const raw = structuredClone(state);
  raw.activeMission.clueIds = [];
  raw.activeMission.feedback = { correct: true, text: 'PRIVATE CHILD TEXT' };
  assert.equal(hydrateState(raw).activeMission.step, 'explore');
  raw.activeMission = { id: 'unknown', step: 'outcome' };
  assert.equal(hydrateState(raw).activeMission, null);
  assert.equal(hydrateState(raw).view, 'home');
  let sort = apply(createState(), 'START_SORT');
  sort.sorting.index = 4;
  sort.sorting.status = 'complete';
  assert.equal(hydrateState(sort).sorting.index, 0);
  assert.equal(hydrateState(sort).sorting.status, 'playing');
  sort.sorting.itemIds[1] = sort.sorting.itemIds[0];
  assert.equal(hydrateState(sort).sorting, null);
});

// Supply a handle and deliberately stacked, movable targets to catch hard-coded
// columns or stale layout assumptions. Callers clean up the binding and jsdom window.
function dragFixture() {
  const dom = new JSDOM('<!doctype html><button id="handle">Move <span id="nested">item</span></button><div id="one"></div><div id="two"></div><div id="three"></div>', { pretendToBeVisual: true });
  const { window } = dom;
  const { document } = window;
  const handle = document.getElementById('handle');
  let rectangles = [[10, 220, 100, 65], [10, 300, 100, 65], [10, 380, 100, 65]];
  // Express layout as viewport rectangles; jsdom itself does not calculate layout.
  const rect = ([left, top, width, height]) => ({ left, top, width, height, right: left + width, bottom: top + height });
  handle.getBoundingClientRect = () => rect([10, 40, 100, 70]);
  const targets = ['one', 'two', 'three'].map((id, index) => {
    const element = document.getElementById(id);
    element.getBoundingClientRect = () => rect(rectangles[index]);
    return { id, element };
  });
  const drops = [];
  const cancellations = [];
  const cleanup = bindDrag(handle, { targets: () => targets, onDrop: id => drops.push(id), onCancel: reason => cancellations.push(reason) });
  // Send browser-shaped events through real listeners; touch-specific protocol has
  // its own PointerEvent suite in quest-touch.test.js.
  function pointer(target, type, x, y, pointerId = 1) {
    const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
    Object.defineProperties(event, { pointerId: { value: pointerId }, isPrimary: { value: true } });
    target.dispatchEvent(event);
  }
  return { dom, window, document, handle, targets, drops, cancellations, cleanup, pointer, setRectangles: value => { rectangles = value; } };
}

test('drop geometry uses actual stacked targets and viewport coordinates, never clamping off-board points', () => {
  const fixture = dragFixture();
  try {
    assert.equal(hitTest(60, 332, fixture.targets), 'two');
    assert.equal(hitTest(60, 290, fixture.targets), null);
    assert.equal(hitTest(-5, 332, fixture.targets), null);
    assert.equal(hitTest(600, 332, fixture.targets), null);
    assert.equal(hitTest(NaN, 332, fixture.targets), null);
    fixture.setRectangles([[10, 20, 100, 65], [10, 100, 100, 65], [10, 180, 100, 65]]);
    assert.equal(hitTest(60, 132, fixture.targets), 'two', 'getBoundingClientRect is re-read after scrolling');
    assert.equal(hitTest(60, 332, fixture.targets), null);
  } finally { fixture.cleanup(); fixture.dom.window.close(); }
});

test('pointer dragging renders a real clone and scores only the actual release target after layout changes', () => {
  const fixture = dragFixture();
  const { pointer, handle, document, drops } = fixture;
  try {
    assert.equal(handle.style.touchAction, 'none');
    assert.equal(document.getElementById('one').style.touchAction, '');
    pointer(handle, 'pointerdown', 40, 60);
    pointer(document, 'pointermove', 60, 330);
    const ghost = document.querySelector('.q-drag-ghost');
    assert.ok(ghost);
    assert.equal(ghost.getAttribute('aria-hidden'), 'true');
    assert.equal(ghost.id, '');
    assert.equal(ghost.querySelector('[id]'), null);
    assert.equal(ghost.style.transform, 'translate(20px, 270px)');
    fixture.setRectangles([[10, 20, 100, 65], [10, 100, 100, 65], [10, 180, 100, 65]]);
    pointer(document, 'pointerup', 60, 210);
    assert.deepEqual(drops, ['three']);
    assert.equal(document.querySelector('.q-drag-ghost'), null);
    pointer(document, 'pointerup', 60, 210);
    assert.deepEqual(drops, ['three'], 'Duplicate releases have no active drag');
  } finally { fixture.cleanup(); fixture.dom.window.close(); }
});

test('off-target, pointer cancellation, resize, Escape and navigation remove dragged items without answers', () => {
  for (const reason of ['outside', 'cancel', 'resize', 'escape', 'cleanup']) {
    const fixture = dragFixture();
    const { pointer, handle, document, window } = fixture;
    try {
      pointer(handle, 'pointerdown', 40, 60);
      pointer(document, 'pointermove', 60, 330);
      if (reason === 'outside') pointer(document, 'pointerup', 900, 900);
      if (reason === 'cancel') pointer(document, 'pointercancel', 60, 330);
      if (reason === 'resize') window.dispatchEvent(new window.Event('resize'));
      if (reason === 'escape') document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      if (reason === 'cleanup') fixture.cleanup();
      assert.equal(document.querySelector('.q-drag-ghost'), null, reason);
      pointer(document, 'pointerup', 60, 330);
      assert.deepEqual(fixture.drops, [], reason);
      assert.equal(fixture.cancellations.length, 1, reason);
      assert.equal(handle.classList.contains('q-dragging'), false);
    } finally { fixture.cleanup(); fixture.dom.window.close(); }
  }
});

test('tap and keyboard activation remain available while other pointers cannot steal a drag', () => {
  const fixture = dragFixture();
  const { pointer, handle, document, window } = fixture;
  let taps = 0;
  handle.addEventListener('click', () => { taps += 1; });
  try {
    pointer(handle, 'pointerdown', 40, 60);
    pointer(document, 'pointermove', 42, 62);
    pointer(document, 'pointerup', 42, 62);
    handle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }));
    assert.equal(taps, 1);
    assert.deepEqual(fixture.drops, []);
    pointer(handle, 'pointerdown', 40, 60);
    pointer(document, 'pointermove', 60, 330);
    pointer(document, 'pointerup', 60, 330, 2);
    assert.deepEqual(fixture.drops, []);
    pointer(document, 'pointerup', 60, 330);
    handle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    assert.equal(taps, 1, 'Synthetic pointer click after drag is suppressed');
    handle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 0 }));
    assert.equal(taps, 2, 'Keyboard click still works');
  } finally { fixture.cleanup(); fixture.dom.window.close(); }
});
