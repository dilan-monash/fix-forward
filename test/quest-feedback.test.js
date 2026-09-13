/** Feedback must explain the child's real choices without changing game rules. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, SORT_ITEMS } from '../quest/content.js';
import { createState, transition, isAcceptedPlan } from '../quest/engine.js';
import { progression } from '../quest/progression.js';
import { planFeedback, celebrationCopy, rewardPreview } from '../quest/feedback.js';

const box = MISSIONS.find(mission => mission.id === 'moving-day-box');

test('two-item feedback identifies which chosen item is correct and why the other needs a retry', () => {
  for (const [plan, correctId, wrongText] of [
    [{ toaster: 'reuse', cardboard: 'ewaste' }, 'toaster', /box has no electrical parts/i],
    [{ toaster: 'paper', cardboard: 'paper' }, 'cardboard', /toaster is electrical, not cardboard/i],
    [{ toaster: 'reuse', cardboard: 'reuse' }, 'toaster', /Nobody needs this empty box/i]
  ]) {
    const originalPlan = { ...plan };
    Object.freeze(plan);
    const feedback = planFeedback(box, { plan });
    assert.equal(feedback.correct, false);
    assert.equal(feedback.complete, true);
    assert.equal(feedback.mixed, true);
    assert.equal(feedback.matchedCount, 1);
    assert.deepEqual(feedback.slots.filter(slot => slot.chosenCorrect).map(slot => slot.slotId), [correctId]);
    assert.match(feedback.slots.find(slot => !slot.chosenCorrect).message, wrongText);
    assert.match(feedback.summary, /Keep it/);
    assert.deepEqual(plan, originalPlan, 'the supplied attempt remains unchanged');
  }
});

test('every full authored answer agrees with the engine and exposes its actual chosen pictures', () => {
  for (const mission of MISSIONS) {
    for (const accepted of mission.acceptedPlans) {
      const feedback = planFeedback(mission, accepted);
      assert.equal(feedback.correct, isAcceptedPlan(mission, accepted), mission.id);
      assert.equal(feedback.matchedCount, mission.slots.length);
      for (const row of feedback.slots) {
        assert.equal(row.chosenAction.id, accepted[row.slotId]);
        assert.equal(row.expectedAction.id, row.chosenAction.id);
        assert.equal(row.status, 'correct');
        assert.ok(row.message.length);
      }
    }
  }
});

test('a mixed pair of otherwise valid alternatives is compared with one coherent variant', () => {
  // A future authored story can have two valid whole plans. Mixing them is not
  // accepted, even when each individual action occurs in some valid plan.
  const mission = {
    id: 'two-valid-plans', slots: [{ id: 'one', label: 'First item' }, { id: 'two', label: 'Second item' }],
    allowedActions: ['a', 'b'].map(id => ({ id, label: id, artworkId: 'paper', feedback: 'A story clue.' })),
    acceptedPlans: [{ one: 'a', two: 'a' }, { one: 'b', two: 'b' }]
  };
  const mixed = planFeedback(mission, { one: 'a', two: 'b' });
  assert.equal(mixed.correct, false);
  assert.equal(mixed.matchedVariantIndex, 0);
  assert.deepEqual(mixed.slots.map(slot => slot.chosenCorrect), [true, false]);
  assert.match(mixed.slots[1].message, /need to work together/);
  const alternative = planFeedback(mission, { one: 'b', two: 'b' });
  assert.equal(alternative.correct, true);
  assert.equal(alternative.matchedVariantIndex, 1);
});

test('missing, unknown, or malformed choices cannot produce successful feedback', () => {
  for (const plan of [{}, { toaster: 'made-up', cardboard: 'paper' }, null, []]) {
    const feedback = planFeedback(box, plan);
    assert.equal(feedback.correct, false);
    assert.equal(feedback.complete, false);
    assert.ok(feedback.slots.some(slot => slot.status === 'missing'));
  }
  assert.equal(planFeedback(null).correct, false);
  assert.equal(planFeedback({ ...box, acceptedPlans: [{}] }, { toaster: 'reuse', cardboard: 'paper' }).correct, false);
});

test('retrying retains the useful choice and changing the other one earns no early points', () => {
  let state = transition(createState(), { type: 'CHOOSE_MISSION', id: box.id });
  for (const action of [
    { type: 'START_MISSION' }, ...box.clues.map(clue => ({ type: 'COLLECT_CLUE', id: clue.id })), { type: 'OPEN_PLAN' },
    { type: 'SET_PLAN', slotId: 'toaster', actionId: 'reuse' },
    { type: 'SET_PLAN', slotId: 'cardboard', actionId: 'ewaste' }, { type: 'CHECK_PLAN' }, { type: 'RETRY_PLAN' }
  ]) state = transition(state, action);
  assert.deepEqual(state.activeMission.plan, { toaster: 'reuse', cardboard: 'ewaste' });
  state = transition(state, { type: 'SET_PLAN', slotId: 'cardboard', actionId: 'paper' });
  assert.equal(planFeedback(box, state.activeMission).correct, true);
  assert.equal(progression(state).points, 0);
});

test('celebrations are deterministic, joyful and honest about actual or replay points', () => {
  const input = { kind: 'mission', missionId: box.id, points: 30, seed: 'first' };
  assert.deepEqual(celebrationCopy(input), celebrationCopy(input));
  assert.equal(celebrationCopy(input).pointsLine, '+30 Sparks added!');
  const headlines = new Set(Array.from({ length: 8 }, (_, seed) => celebrationCopy({ ...input, seed }).headline));
  assert.ok(headlines.size > 1);
  const replay = celebrationCopy({ ...input, replay: true, points: 0 });
  assert.match(replay.pointsLine, /No extra Sparks/);
  assert.doesNotMatch(replay.pointsLine, /\+0|\+30/);
  assert.equal(celebrationCopy({ ...input, replay: true, points: 10 }).pointsLine, '+10 Sparks added!');
  for (const points of [-5, 2.5, Infinity, '30']) {
    assert.doesNotMatch(celebrationCopy({ ...input, points }).pointsLine, /\+/, 'malformed amounts cannot invent a reward');
  }
  assert.match(celebrationCopy({ ...input, levelUp: true }).headline, /Level up/);
  assert.match(celebrationCopy({ conceptId: 'warning', points: 5 }).message, /chose to get help/);
});

test('reward preview separates story, new-idea and picture-question points', () => {
  const state = createState();
  assert.deepEqual(
    Object.fromEntries(Object.entries(rewardPreview(state, { missionId: box.id })).filter(([key]) => key.endsWith('Points'))),
    { missionPoints: 20, discoveryPoints: 10, reflectionPoints: 10, completionPoints: 30, totalPoints: 40 }
  );
  state.discoveries = ['reuse'];
  const partlyEarned = rewardPreview(state, { missionId: box.id });
  assert.equal(partlyEarned.completionPoints, 25);
  assert.equal(partlyEarned.discoveryPoints, 5);
  assert.equal(partlyEarned.totalPoints, 35);
});

test('completed stories and known ideas promise no duplicate points but keep first reflections available', () => {
  const state = createState();
  state.completed[box.id] = { assisted: true };
  state.discoveries = [...box.conceptIds];
  let preview = rewardPreview(state, { missionId: box.id });
  assert.equal(preview.replay, true);
  assert.equal(preview.completionPoints, 0);
  assert.equal(preview.reflectionPoints, 10);
  assert.match(preview.detail, /10 for the picture question/);
  state.reflections[box.id] = box.reflection.correctId;
  preview = rewardPreview(state, { missionId: box.id });
  assert.equal(preview.totalPoints, 0);
  assert.match(preview.detail, /earned these Sparks already/);
  assert.equal(rewardPreview(state, { conceptId: 'packaging' }).totalPoints, 0);
  assert.equal(rewardPreview(state, { conceptId: 'battery' }).totalPoints, 5);
  assert.equal(rewardPreview(state, { missionId: 'unknown' }).totalPoints, 0);
  assert.deepEqual(state.discoveries, box.conceptIds);
});

test('sorting previews promise exactly the new picture and idea credit the real answer will earn', () => {
  let state = transition(createState(), { type: 'START_SORT' });
  let knownIdeaPictures = 0;
  for (const id of state.sorting.itemIds) {
    const item = SORT_ITEMS.find(picture => picture.id === id);
    const before = structuredClone(state);
    const knownIdea = state.discoveries.includes(item.conceptId);
    const preview = rewardPreview(state, { sortItemId: id });
    assert.equal(preview.sortingPoints, 5);
    assert.equal(preview.discoveryPoints, knownIdea ? 0 : 5);
    assert.equal(preview.totalPoints, knownIdea ? 5 : 10);
    assert.match(preview.label, new RegExp(`\\+${preview.totalPoints} Sparks`));
    assert.match(preview.detail, /5 for this new picture/);
    if (knownIdea) {
      knownIdeaPictures += 1;
      assert.doesNotMatch(preview.detail, /new idea/);
    }
    assert.deepEqual(state, before, 'Showing an offer never records a picture or awards points');
    const earned = transition(state, { type: 'ANSWER_SORT', destinationId: item.answer });
    assert.equal(progression(earned).points - progression(state).points, preview.totalPoints);
    const replay = rewardPreview(earned, { sortItemId: id });
    assert.equal(replay.totalPoints, 0);
    assert.equal(replay.sortingPoints, 0);
    assert.equal(replay.discoveryPoints, 0);
    assert.equal(replay.replay, true);
    assert.match(replay.label, /round count/);
    assert.doesNotMatch(replay.label, /\+/);
    assert.match(replay.detail, /five-picture round/);
    state = transition(earned, { type: 'NEXT_SORT' });
  }
  assert.ok(knownIdeaPictures > 0, 'New pictures sharing an idea must preview five Sparks rather than zero');
  assert.equal(rewardPreview(state, { sortItemId: 'unreviewed-picture' }).totalPoints, 0);
});

test('a repeated sorting picture celebrates round progress without claiming new Sparks', () => {
  const copy = celebrationCopy({ kind: 'sorting', points: 0, replay: true });
  assert.match(copy.pointsLine, /round count went up/);
  assert.match(copy.pointsLine, /earned this picture/);
  assert.doesNotMatch(copy.pointsLine, /\+\d/);
});
