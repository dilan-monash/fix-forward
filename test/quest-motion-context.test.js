// This screen policy is tested separately from CSS: narration changes without
// a route render, and an ending must never accidentally suppress its reward.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getMotionContext } from '../quest/motion-context.js';

test('clues and decisions stay quiet, with lively arrival and earned endings', () => {
  for (const step of ['explore', 'plan', 'feedback', 'retry']) assert.equal(getMotionContext({ view:'mission', step }), true, step);
  for (const step of ['intro', 'outcome', 'reward']) assert.equal(getMotionContext({ view:'mission', step }), false, step);
  for (const step of ['playing', 'feedback', 'retry']) assert.equal(getMotionContext({ view:'sorting', step }), true, step);
  for (const step of ['reward', 'complete']) assert.equal(getMotionContext({ view:'sorting', step }), false, step);
});

test('narration and open evidence take priority, including a deliberate reading pause', () => {
  for (const view of ['home', 'picker', 'mission', 'sorting', 'postcard']) {
    for (const narrationStatus of ['loading', 'speaking', 'paused']) {
      assert.equal(getMotionContext({ view, step:'reward', narrationStatus }), true, `${view}: ${narrationStatus}`);
    }
    assert.equal(getMotionContext({ view, step:'reward', pictureHelpOpen:true }), true, `${view}: visible evidence`);
  }
});

test('the Discovery Book remains still, while ending or stopping narration releases other screens', () => {
  for (const narrationStatus of ['idle', 'error', 'unavailable']) {
    assert.equal(getMotionContext({ view:'book', narrationStatus }), true);
    assert.equal(getMotionContext({ view:'home', narrationStatus }), false);
    assert.equal(getMotionContext({ view:'sorting', step:'reward', narrationStatus }), false);
  }
  assert.equal(getMotionContext(), false);
});

test('parent guidance is outside the child-only motion policy, without altering supplied state', () => {
  for (const view of ['grownups', 'parents']) {
    const context = Object.freeze({ view, step:'plan', narrationStatus:'speaking', pictureHelpOpen:true });
    assert.equal(getMotionContext(context), false);
    assert.equal(context.narrationStatus, 'speaking');
  }
});
