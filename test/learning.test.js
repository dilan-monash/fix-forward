import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createLearningState, transitionLearning, renderLearning, learningFocusTarget } from "../src/learning.js";

test("learning requires a safer choice, allows retries and never mutates its input", () => {
  const initial = Object.freeze(createLearningState());
  assert.deepEqual(transitionLearning(initial, { type: "next" }), initial);
  assert.deepEqual(transitionLearning(initial, { type: "choose", choice: "missing" }), initial);
  const wrong = transitionLearning(initial, { type: "choose", choice: "secret" });
  assert.equal(wrong.choice, "secret");
  assert.deepEqual(initial, createLearningState());
  assert.deepEqual(transitionLearning(wrong, { type: "next" }), wrong);
  assert.deepEqual(transitionLearning(wrong, { type: "choose", choice: "adult" }), wrong);
  assert.deepEqual(transitionLearning(wrong, { type: "retry" }), initial);
});

test("all three discoveries are required before completion and replay resets them", () => {
  let state = createLearningState();
  for (const [step, choice] of ["adult", "repair", "ewaste"].entries()) {
    state = transitionLearning(state, { type: "choose", choice });
    assert.equal(state.step, step);
    assert.equal(state.finished, false);
    state = transitionLearning(state, { type: "next" });
  }
  assert.equal(state.finished, true);
  assert.deepEqual(transitionLearning(state, { type: "next" }), state);
  assert.match(renderLearning(state), /Three discoveries to share/);
  assert.match(renderLearning(state), /3 of 3 discoveries/);
  assert.deepEqual(transitionLearning(state, { type: "replay" }), createLearningState());
});

test("learning renders accessible choices, useful feedback and a clear focus destination", () => {
  const initial = createLearningState();
  const first = new JSDOM(renderLearning(initial)).window.document;
  assert.equal(first.querySelectorAll("[data-learning-action='choose']").length, 3);
  assert.equal(first.querySelector(learningFocusTarget(initial)).textContent, "Pip has a damaged cable");
  assert.match(first.querySelector(".learning-boundary").textContent, /No real appliance is needed/);
  const wrong = transitionLearning(initial, { type: "choose", choice: "secret" });
  const feedback = new JSDOM(renderLearning(wrong)).window.document;
  assert.equal(feedback.querySelectorAll("[data-learning-action='choose']:disabled").length, 3);
  assert.equal(feedback.querySelector(learningFocusTarget(wrong)).getAttribute("tabindex"), "-1");
  assert.match(feedback.querySelector("[role='status']").textContent, /tell them and leave Pip alone/);
  assert.ok(feedback.querySelector("[data-learning-action='retry']"));
  assert.ok(feedback.querySelector("[data-learning-action='exit']"));
});

test("invalid history state cannot inject markup or skip to a completion screen", () => {
  assert.equal(renderLearning({ step: -1, choice: '<script>alert(1)</script>', finished: true }), renderLearning(createLearningState()));
  assert.doesNotMatch(renderLearning({ step: 2, choice: '<img src=x onerror=alert(1)>', finished: true }), /<img|Three discoveries to share/);
  assert.deepEqual(transitionLearning(null, { type: "next" }), createLearningState());
});
