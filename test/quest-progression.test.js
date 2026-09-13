/**
 * Protect the local reward rules: 20 Sparks per story, 5 per new idea and 10 per
 * earned reflection, with no help penalty or replay farming. Real action paths
 * test earning/reloading; small constructed states isolate level-meter boundaries.
 * No saved score scalar or network service is used to supply an expected result.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, CONCEPTS, SORT_ITEMS } from '../quest/content.js';
import { createState, transition, hydrateState, isReflectionCorrect } from '../quest/engine.js';
import { progression, LEVELS, SPARK_VALUES } from '../quest/progression.js';
import { STORAGE_KEY, saveProgress, loadProgress } from '../quest/storage.js';

// Apply a named production action without changing the caller's state in place.
const act = (state, type, fields = {}) => transition(state, { type, ...fields });
// Complete a mission normally; the optional hint compares assisted and independent play.
function finish(mission, state = createState(), assisted = false) {
  state = act(state, 'CHOOSE_MISSION', { id: mission.id });
  state = act(state, 'START_MISSION');
  state = act(state, 'COLLECT_CLUE', { id: mission.clues[0].id });
  if (assisted) state = act(state, 'HINT');
  state = act(state, 'OPEN_PLAN');
  for (const [slotId, actionId] of Object.entries(mission.acceptedPlans[0])) state = act(state, 'SET_PLAN', { slotId, actionId });
  state = act(state, 'CHECK_PLAN');
  return act(state, 'COMPLETE_MISSION');
}
// Submit the authored evidence answer, leaving earned gating and duplicates to the engine.
const reflect = (state, mission) => act(state, 'CHECK_REFLECTION', { missionId: mission.id, answerId: mission.reflection.correctId });
// Keep serialized reload tests deterministic and separate from real browser/user data.
function memoryStorage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

test('Sparks start at zero and a finished story, new idea and reflection have their stated values', () => {
  assert.deepEqual(SPARK_VALUES, { mission: 20, discovery: 5, reflection: 10 });
  assert.deepEqual(createState().reflections, {});
  assert.deepEqual(progression(createState()), {
    points: 0, level: 1, title: 'Clue Scout', nextThreshold: 60, pointsRemaining: 60,
    percent: 0, withinLevelPercent: 0, breakdown: { missions: 0, discoveries: 0, reflections: 0 }
  });
  const mission = MISSIONS[0];
  const state = finish(mission);
  const expectedDiscoveries = new Set(mission.conceptIds).size * 5;
  assert.equal(progression(state).points, 20 + expectedDiscoveries);
  assert.deepEqual(progression(reflect(state, mission)).breakdown, { missions: 20, discoveries: expectedDiscoveries, reflections: 10 });
});

test('reflections require an earned mission and an authored option; a wrong answer allows a later retry', () => {
  const mission = MISSIONS[0];
  const correctId = mission.reflection.correctId;
  const wrongId = mission.reflection.options.find(option => option.id !== correctId).id;
  const fresh = createState();
  assert.equal(act(fresh, 'CHECK_REFLECTION', { missionId: mission.id, answerId: correctId }), fresh);
  assert.equal(isReflectionCorrect(mission, correctId), true);
  assert.equal(isReflectionCorrect(mission, wrongId), false);
  assert.equal(isReflectionCorrect(mission, 'unreviewed-answer'), false);
  assert.equal(isReflectionCorrect(null, correctId), false);
  assert.equal(isReflectionCorrect({ reflection: { correctId, options: [] } }, correctId), false);
  let state = finish(mission);
  const before = progression(state);
  assert.equal(act(state, 'CHECK_REFLECTION', { missionId: mission.id, answerId: wrongId }), state);
  assert.equal(act(state, 'CHECK_REFLECTION', { missionId: 'unknown', answerId: correctId }), state);
  assert.deepEqual(progression(state), before);
  state = reflect(state, mission);
  assert.deepEqual(state.reflections, { [mission.id]: correctId });
  assert.equal(progression(state).points, before.points + 10);
  assert.equal(reflect(state, mission), state, 'Repeated correct clicks cannot award another reflection');
  assert.equal(act(state, 'CHECK_REFLECTION', { missionId: mission.id, answerId: wrongId }), state, 'A later wrong click cannot remove earned Sparks');
});

test('all eight authored reflection answers work and the full reviewed bank has a finite points total', () => {
  let state = createState();
  for (const mission of MISSIONS) {
    assert.equal(mission.reflection.options.length, 2);
    assert.ok(mission.reflection.options.some(option => option.id === mission.reflection.correctId));
    state = reflect(finish(mission, state), mission);
  }
  assert.equal(Object.keys(state.reflections).length, 8);
  assert.equal(progression(state).points, 8 * 20 + CONCEPTS.length * 5 + 8 * 10);
  assert.equal(progression(state).points, 280);
  assert.equal(progression(state).level, 4);
  assert.equal(progression(state).title, 'Quest Guide');
  assert.equal(progression(state).nextThreshold, null);
  assert.equal(progression(state).pointsRemaining, 0);
  assert.equal(progression(state).percent, 100);
});

test('help and repeated stories never reduce points or create replay farming', () => {
  const mission = MISSIONS[0];
  const independent = reflect(finish(mission), mission);
  const assisted = reflect(finish(mission, createState(), true), mission);
  assert.equal(independent.completed[mission.id].assisted, false);
  assert.equal(assisted.completed[mission.id].assisted, true);
  assert.deepEqual(progression(assisted), progression(independent));
  let replayed = assisted;
  for (let round = 0; round < 4; round += 1) replayed = reflect(finish(mission, replayed, round % 2 === 0), mission);
  assert.deepEqual(progression(replayed), progression(assisted));
  assert.deepEqual(replayed.reflections, assisted.reflections);
});

test('repeated sorting can discover an idea once but cannot farm points through repeated rounds', () => {
  let state = createState();
  const known = new Set();
  for (let round = 0; round < 12; round += 1) {
    state = act(state, 'START_SORT');
    for (let index = 0; index < 5; index += 1) {
      const item = SORT_ITEMS.find(card => card.id === state.sorting.itemIds[index]);
      state = act(state, 'ANSWER_SORT', { destinationId: item.answer });
      known.add(item.conceptId);
      assert.equal(progression(state).points, known.size * 5);
      state = act(state, 'NEXT_SORT');
    }
  }
  assert.deepEqual(progression(state).breakdown, { missions: 0, discoveries: known.size * 5, reflections: 0 });
  assert.ok(progression(state).points <= CONCEPTS.length * 5);
});

// Find a combination of known IDs worth the requested boundary total, or fail clearly
// if no such fixture exists. These counters test calculation, not a complete play history.
function boundaryState(points) {
  // These bounded counters isolate meter boundaries; actual mission/round paths
  // are exercised separately above. No score scalar is supplied to production.
  for (let missions = 0; missions <= MISSIONS.length; missions += 1) {
    for (let discoveries = 0; discoveries <= CONCEPTS.length; discoveries += 1) {
      for (let reflections = 0; reflections <= missions; reflections += 1) {
        if (missions * 20 + discoveries * 5 + reflections * 10 !== points) continue;
        return {
          ...createState(),
          completed: Object.fromEntries(MISSIONS.slice(0, missions).map(mission => [mission.id, { assisted: false }])),
          discoveries: CONCEPTS.slice(0, discoveries).map(concept => concept.id),
          reflections: Object.fromEntries(MISSIONS.slice(0, reflections).map(mission => [mission.id, mission.reflection.correctId]))
        };
      }
    }
  }
  throw new Error(`No boundary fixture for ${points}`);
}

test('level thresholds and within-level progress change correctly at every boundary', () => {
  assert.deepEqual(LEVELS.map(({ threshold, title }) => [threshold, title]), [
    [0, 'Clue Scout'], [60, 'Story Solver'], [140, 'Next-Chapter Maker'], [240, 'Quest Guide']
  ]);
  for (const [points, level, nextThreshold, pointsRemaining, percent] of [
    [0, 1, 60, 60, 0], [55, 1, 60, 5, 92],
    [60, 2, 140, 80, 0], [135, 2, 140, 5, 94],
    [140, 3, 240, 100, 0], [235, 3, 240, 5, 95],
    [240, 4, null, 0, 100], [280, 4, null, 0, 100]
  ]) {
    const result = progression(boundaryState(points));
    assert.equal(result.points, points);
    assert.equal(result.level, level, `level at ${points} Sparks`);
    assert.equal(result.nextThreshold, nextThreshold);
    assert.equal(result.pointsRemaining, pointsRemaining);
    assert.equal(result.percent, percent);
    assert.equal(result.withinLevelPercent, percent);
  }
});

test('reflection reload is idempotent and version-one saves without reflections stay compatible', () => {
  const mission = MISSIONS[0];
  const state = reflect(finish(mission, createState(), true), mission);
  const storage = memoryStorage();
  assert.equal(saveProgress(state, storage), true);
  const loaded = loadProgress(storage);
  assert.equal(loaded.status, 'restored');
  assert.deepEqual(loaded.state.reflections, state.reflections);
  assert.deepEqual(progression(loaded.state), progression(state));
  assert.equal(reflect(loaded.state, mission), loaded.state);
  const legacy = structuredClone(state);
  delete legacy.reflections;
  const restoredLegacy = hydrateState(legacy);
  assert.deepEqual(restoredLegacy.reflections, {});
  assert.deepEqual(restoredLegacy.completed, state.completed);
  assert.deepEqual(restoredLegacy.discoveries, state.discoveries);
  assert.equal(progression(restoredLegacy).points, progression(state).points - 10);
});

test('storage whitelists completed reflection IDs and never retains arbitrary answers or a score scalar', () => {
  const mission = MISSIONS[0];
  const locked = MISSIONS[1];
  const state = reflect(finish(mission), mission);
  const raw = {
    ...state, points: 99999, score: 99999, level: 99,
    reflections: { ...state.reflections, [locked.id]: locked.reflection.correctId, 'PRIVATE CHILD NAME': 'PRIVATE CHILD DISCLOSURE' }
  };
  const storage = memoryStorage();
  assert.equal(saveProgress(raw, storage), true);
  const serialized = storage.getItem(STORAGE_KEY);
  assert.equal(serialized.includes('PRIVATE'), false);
  const saved = JSON.parse(serialized);
  assert.equal(Object.hasOwn(saved, 'points'), false);
  assert.equal(Object.hasOwn(saved, 'score'), false);
  assert.equal(Object.hasOwn(saved, 'level'), false);
  assert.deepEqual(saved.reflections, state.reflections);
  assert.deepEqual(progression(saved), progression(state));
  const wrongId = mission.reflection.options.find(option => option.id !== mission.reflection.correctId).id;
  for (const reflections of [{ [mission.id]: wrongId }, { [mission.id]: { answerId: mission.reflection.correctId } }, ['PRIVATE CHILD NAME'], null]) {
    const sanitized = hydrateState({ ...state, reflections });
    assert.deepEqual(sanitized.reflections, {});
    assert.equal(progression(sanitized).points, progression(state).points - 10);
  }
});

test('point derivation ignores duplicate/unknown IDs and malformed counters without mutating progress', () => {
  const mission = MISSIONS[0];
  const state = reflect(finish(mission), mission);
  const original = progression(state);
  const malformed = {
    ...state, points: Infinity, level: 99,
    completed: { ...state.completed, 'unreviewed-mission': { assisted: false } },
    discoveries: [...state.discoveries, ...state.discoveries, 'unknown-concept'],
    reflections: { ...state.reflections, 'unreviewed-mission': 'claimed-answer' }
  };
  const before = structuredClone(malformed);
  assert.deepEqual(progression(malformed), original);
  assert.deepEqual(malformed, before);
  assert.equal(progression(null).points, 0);
  assert.equal(progression({ completed: [], discoveries: 'PRIVATE CHILD NAME', reflections: [], points: 10000 }).points, 0);
});
