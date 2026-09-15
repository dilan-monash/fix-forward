/** Exercise invitations through real story progress, including help, replay
 * and reload. Onboarding must never become a hidden difficulty or score change. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS } from '../quest/content.js';
import { createState, transition, hydrateState, canOfferChallenge } from '../quest/engine.js';
import { progression } from '../quest/progression.js';

// Solve an authored story using the production transition rules, optionally help.
function finish(state, mission, assisted = false) {
  state = transition(state, { type: 'CHOOSE_MISSION', id: mission.id });
  state = transition(state, { type: 'START_MISSION' });
  for (const clue of mission.clues) state = transition(state, { type: 'COLLECT_CLUE', id: clue.id });
  if (assisted) state = transition(state, { type: 'HINT' });
  state = transition(state, { type: 'OPEN_PLAN' });
  for (const [slotId, actionId] of Object.entries(mission.acceptedPlans[0])) state = transition(state, { type: 'SET_PLAN', slotId, actionId });
  state = transition(state, { type: 'CHECK_PLAN' });
  return transition(state, { type: 'COMPLETE_MISSION' });
}

test('two distinct independent stories unlock an invitation without changing difficulty', () => {
  let state = createState();
  assert.equal(canOfferChallenge(state), false);
  assert.equal(transition(state, { type: 'ACCEPT_CHALLENGE' }), state);
  assert.equal(transition(state, { type: 'CHALLENGE_OFFER_DISMISSED' }), state);
  state = finish(state, MISSIONS[0]);
  assert.equal(canOfferChallenge(state), false);
  state = finish(state, MISSIONS[0]);
  assert.equal(canOfferChallenge(state), false, 'replaying one story is not two different stories');
  state = finish(state, MISSIONS[1], true);
  assert.equal(canOfferChallenge(state), false, 'a helped story still earns rewards but cannot trigger the invitation');
  state = finish(state, MISSIONS[2]);
  assert.equal(canOfferChallenge(state), true);
  assert.equal(state.settings.mode, 'guided', 'eligibility never switches the mode');
  assert.equal(canOfferChallenge(hydrateState(state)), true);
});

test('keeping guided play is permanent across reloads and more completed stories', () => {
  const eligible = finish(finish(createState(), MISSIONS[0]), MISSIONS[1]);
  const dismissed = transition(eligible, { type: 'CHALLENGE_OFFER_DISMISSED' });
  assert.equal(dismissed.settings.mode, 'guided');
  assert.equal(dismissed.onboarding.challengeChoice, 'dismissed');
  assert.equal(canOfferChallenge(dismissed), false);
  assert.deepEqual(progression(dismissed), progression(eligible));
  const restored = finish(hydrateState(dismissed), MISSIONS[2]);
  assert.equal(canOfferChallenge(restored), false);
  assert.equal(transition(restored, { type: 'ACCEPT_CHALLENGE' }), restored, 'a stale offer button cannot reverse the recorded choice');
});

test('accepting is explicit and Settings remains a way to change either play style', () => {
  const eligible = finish(finish(createState(), MISSIONS[0]), MISSIONS[1]);
  const accepted = transition(eligible, { type: 'ACCEPT_CHALLENGE' });
  assert.equal(accepted.settings.mode, 'challenge');
  assert.equal(accepted.onboarding.challengeChoice, 'accepted');
  assert.equal(canOfferChallenge(accepted), false);
  assert.deepEqual(progression(accepted), progression(eligible));
  const back = transition(hydrateState(accepted), { type: 'SET_SETTING', key: 'mode', value: 'guided' });
  assert.equal(back.settings.mode, 'guided');
  assert.equal(canOfferChallenge(back), false);
  const direct = transition(eligible, { type: 'SET_SETTING', key: 'mode', value: 'challenge' });
  assert.equal(canOfferChallenge(transition(direct, { type: 'SET_SETTING', key: 'mode', value: 'guided' })), false);
});

test('old and malformed saves preserve earned progress without trusting onboarding data', () => {
  const old = finish(finish(createState(), MISSIONS[0]), MISSIONS[1]);
  delete old.onboarding;
  const restored = hydrateState(old);
  assert.deepEqual(progression(restored), progression(old));
  assert.deepEqual(restored.onboarding, { challengeChoice: null, sortingDemoSeen: false });
  assert.equal(canOfferChallenge(restored), true);
  for (const onboarding of [null, [], { challengeChoice: 'anything', sortingDemoSeen: 'true', arbitrary: 'no' }]) {
    assert.deepEqual(hydrateState({ ...old, onboarding }).onboarding, { challengeChoice: null, sortingDemoSeen: false });
  }
  const legacyChallenge = hydrateState({ ...old, settings: { ...old.settings, mode: 'challenge' } });
  assert.equal(legacyChallenge.onboarding.challengeChoice, 'accepted');
  assert.equal(canOfferChallenge({ ...createState(), completed: { invented: { assisted: false }, extra: { assisted: false } } }), false);
});

test('seeing or skipping the sorting demo cannot answer a card or earn progress', () => {
  const home = createState();
  assert.equal(transition(home, { type: 'SORT_DEMO_SEEN' }), home);
  const sorting = transition(home, { type: 'START_SORT' });
  const seen = transition(sorting, { type: 'SORT_DEMO_SEEN' });
  assert.equal(seen.onboarding.sortingDemoSeen, true);
  assert.equal(seen.sorting, sorting.sorting, 'the full round is untouched');
  assert.deepEqual(progression(seen), progression(sorting));
  assert.equal(transition(seen, { type: 'SORT_DEMO_SEEN' }), seen);
  const restored = hydrateState(seen);
  assert.equal(restored.onboarding.sortingDemoSeen, true);
  assert.deepEqual(restored.sorting.answers, {});
});
