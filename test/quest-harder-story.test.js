/** Exercise the optional story as a real conditional plan, including its honest
 * unresolved ending and compatibility with an existing eight-story save. These
 * local tests check authored rules, never a real appliance or child diagnosis. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { MISSIONS, validateQuestContent } from '../quest/content.js';
import { createState, transition, hydrateState } from '../quest/engine.js';
import { planFeedback } from '../quest/feedback.js';
import { progression } from '../quest/progression.js';
import { renderAdventureTrail } from '../quest/adventure-world.js';
import { passportStamp } from '../quest/art.js';

const story = MISSIONS.find(mission => mission.id === 'fan-no-takers');
// Use production transitions; no test invents a completion or points field.
const act = (state, type, fields = {}) => transition(state, { type, ...fields });
function planReady(mission, state = createState()) {
  state = act(state, 'CHOOSE_MISSION', { id: mission.id });
  state = act(state, 'START_MISSION');
  for (const clue of mission.clues) state = act(state, 'COLLECT_CLUE', { id: clue.id });
  return act(state, 'OPEN_PLAN');
}
function place(state, plan) {
  for (const [slotId, actionId] of Object.entries(plan)) state = act(state, 'SET_PLAN', { slotId, actionId });
  return state;
}
function finish(mission, state = createState()) {
  state = act(place(planReady(mission, state), mission.acceptedPlans[0]), 'CHECK_PLAN');
  state = act(state, 'COMPLETE_MISSION');
  return act(state, 'CHECK_REFLECTION', { missionId: mission.id, answerId: mission.reflection.correctId });
}

test('the ninth story adds a willing-recipient dilemma without replacing earlier stories', () => {
  assert.deepEqual(MISSIONS.slice(0, 8).map(mission => mission.id), [
    'flo-next-home', 'quiet-fan', 'pip-damaged-cable', 'kettle-second-chance',
    'kettle-last-chapter', 'moving-day-box', 'bulging-gadget', 'mystery-glass-jug'
  ]);
  assert.equal(MISSIONS.at(-1), story);
  assert.equal(story.optional, true);
  assert.equal(story.difficulty, 'trickier');
  assert.equal(story.planKind, 'sequence');
  assert.deepEqual(validateQuestContent(), []);
  assert.match(story.clues.find(clue => clue.id === 'still-works').text, /fan works/);
  assert.match(story.clues.find(clue => clue.id === 'no-takers').text, /Both said no/);
  assert.match(story.clues.find(clue => clue.id === 'checks-pending').text, /qualified repairer/);
  assert.match(story.fictionalContext, /made-up story/);
  assert.match(story.outcome.text, /No new home is ready yet/);
  assert.match(story.outcome.text, /If nobody wants it/);
  assert.equal(story.outcome.scene, 'help', 'The ending must not draw a completed handover.');
  assert.doesNotMatch(story.outcome.text, /goes (?:in|to) (?:the )?bin|must be repaired/i);
});

test('the trickier chapter is optional and immediately playable without a score or age gate', () => {
  const selected = act(createState(), 'CHOOSE_MISSION', { id: story.id });
  assert.equal(selected.activeMission.id, story.id);
  assert.equal(selected.activeMission.step, 'intro');
  assert.deepEqual(selected.completed, {});
  const dom = JSDOM.fragment(renderAdventureTrail({ missions: MISSIONS }));
  const button = dom.querySelector(`[data-mission="${story.id}"]`);
  assert.ok(button);
  assert.equal(button.disabled, false);
  assert.match(button.textContent, /Trickier story/);
  assert.match(dom.querySelector('h2').textContent, /9 big stories/);
  assert.match(passportStamp(story.id), /THINK IT THROUGH/);
});

test('all three facts and both steps are required; reversed and partial plans cannot score', () => {
  let state = act(act(createState(), 'CHOOSE_MISSION', { id: story.id }), 'START_MISSION');
  for (const clue of story.clues.slice(0, 2)) state = act(state, 'COLLECT_CLUE', { id: clue.id });
  assert.equal(act(state, 'OPEN_PLAN'), state, 'The hopeful clue cannot skip missing checks.');
  state = act(act(state, 'COLLECT_CLUE', { id: story.clues[2].id }), 'OPEN_PLAN');
  state = place(state, { first: 'find-recipient' });
  assert.equal(act(state, 'CHECK_PLAN'), state, 'An unfinished conditional plan earns nothing.');
  for (const first of story.allowedActions) for (const then of story.allowedActions) {
    const plan = { first: first.id, then: then.id };
    const checked = act(place(planReady(story), plan), 'CHECK_PLAN');
    const accepted = first.id === 'find-recipient' && then.id === 'finish-checks';
    assert.equal(checked.activeMission.feedback.correct, accepted, JSON.stringify(plan));
    assert.equal(planFeedback(story, plan).correct, accepted);
    if (!accepted) {
      assert.equal(act(checked, 'COMPLETE_MISSION'), checked);
      assert.equal(progression(hydrateState(checked)).points, 0);
    }
  }
  const reversed = planFeedback(story, { first: 'finish-checks', then: 'find-recipient' });
  assert.equal(reversed.matchedCount, 0);
  assert.match(reversed.slots[0].message, /next, if someone says yes/);
  assert.match(reversed.slots[1].message, /Put this first/);
});

test('an existing eight-story save keeps every award; the optional chapter earns only its new story and reflection', () => {
  let original = createState();
  for (const mission of MISSIONS.slice(0, 8)) original = finish(mission, original);
  assert.equal(progression(original).points, 280);
  const restored = hydrateState(structuredClone(original));
  assert.deepEqual(restored.completed, original.completed);
  assert.deepEqual(restored.reflections, original.reflections);
  assert.equal(progression(restored).points, 280);
  const completed = finish(story, restored);
  assert.equal(progression(completed).points, 310, 'Known ideas cannot be awarded a second time.');
  assert.equal(Object.keys(completed.completed).length, 9);
  for (const mission of MISSIONS.slice(0, 8)) assert.deepEqual(completed.completed[mission.id], original.completed[mission.id]);
  for (let replay = 0; replay < 3; replay += 1) {
    const replayed = finish(story, hydrateState(structuredClone(completed)));
    assert.deepEqual(progression(replayed), progression(completed));
    assert.deepEqual(replayed.reflections, completed.reflections);
  }
});
