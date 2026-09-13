/**
 * Review the authored content contract: linked IDs, supported answers, meaningful
 * uncertainty, short child-facing copy and evidence-based reflection choices.
 * These checks read local records only. They do not re-verify source websites or
 * substitute for a qualified safety/content review or usability work with children.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { MISSIONS, SORT_ITEMS, CONCEPTS, LOCATIONS, SOURCES, validateQuestContent } from "../quest/content.js";

test("all eight authored missions and twelve sorting cards have reviewable complete paths", () => {
  assert.equal(MISSIONS.length, 8);
  assert.equal(SORT_ITEMS.length, 12);
  assert.equal(LOCATIONS.length, 3);
  assert.equal(CONCEPTS.length, 8);
  assert.deepEqual(validateQuestContent(), []);
  for (const mission of MISSIONS) {
    assert.ok(mission.fictionalContext && mission.artworkId && mission.discussionPrompt, mission.id);
    const correct = new Set(mission.acceptedPlans.flatMap((plan) => Object.values(plan)));
    assert.ok(mission.allowedActions.some((action) => !correct.has(action.id)), `${mission.id}: needs a meaningful retry choice`);
    assert.deepEqual(mission.feedbackByAction, Object.fromEntries(mission.allowedActions.map((action) => [action.id, action.feedback])));
    for (const clue of mission.clues) {
      assert.ok(clue.text && clue.title && clue.x >= 0 && clue.x <= 100 && clue.y >= 0 && clue.y <= 100, mission.id);
      assert.ok(clue.shortLabel && clue.shortLabel.split(/\s+/).length <= 3, `${mission.id}: clue pocket label`);
    }
    assert.deepEqual(Object.keys(mission.guideLines).sort(), ["explore", "intro", "outcome", "plan", "retry", "success"]);
    assert.ok(Object.values(mission.guideLines).every((line) => line.length > 0 && line.length <= 140), `${mission.id}: concise guide lines`);
    assert.ok(mission.postcardLine && mission.postcardLine.length <= 100, `${mission.id}: postcard closure`);
    assert.ok(mission.learningGoal && mission.childSummary.split(/\s+/).length <= 12, `${mission.id}: clear parent goal and short child overview`);
    assert.ok(mission.allowedActions.every((action) => action.artworkId), `${mission.id}: picture-supported plan choices`);
  }
});

test("the source validator rejects unreviewed content, dangling plans and design-only answers", () => {
  // Change one part of an otherwise valid mission per case, so a failing validator
  // check points to a specific authoring risk without altering the shared story bank.
  const cases = [
    { ...MISSIONS[0], contentReviewStatus: "draft" },
    { ...MISSIONS[0], sourceIds: ["unknown-source"] },
    { ...MISSIONS[0], sourceIds: ["unicef-ritec", "w3c-dragging"] },
    { ...MISSIONS[0], acceptedPlans: [{ next: "unreviewed-action" }] },
    { ...MISSIONS[0], acceptedPlans: [{ inventedSlot: "handover" }] },
    { ...MISSIONS[0], acceptedPlans: [] },
    { ...MISSIONS[0], clues: undefined },
    { ...MISSIONS[0], guideLines: { intro: "A story starts here." } },
    { ...MISSIONS[0], clues: MISSIONS[0].clues.map((clue) => ({ ...clue, shortLabel: "An unnecessarily long clue pocket label" })) },
    { ...MISSIONS[0], learningGoal: "" },
    { ...MISSIONS[0], childSummary: "This overview has far too many words to serve as a short child summary." },
    { ...MISSIONS[0], reflection: undefined },
    { ...MISSIONS[0], reflection: { ...MISSIONS[0].reflection, options: [MISSIONS[0].reflection.options[0]] } },
    { ...MISSIONS[0], reflection: { ...MISSIONS[0].reflection, options: [MISSIONS[0].reflection.options[0], MISSIONS[0].reflection.options[0]] } },
    { ...MISSIONS[0], reflection: { ...MISSIONS[0].reflection, correctId: "not-a-picture-choice" } },
    { ...MISSIONS[0], reflection: { ...MISSIONS[0].reflection, options: MISSIONS[0].reflection.options.map((option) => ({ ...option, artworkId: "" })) } },
  ];
  for (const mission of cases) assert.ok(validateQuestContent({ missions: [mission] }).length > 0);
  assert.ok(validateQuestContent({ sources: SOURCES.map((source, index) => index ? source : { ...source, checkedAt: null }) }).length > 0);
});

test("fixed collection answers depend on reviewed conditions and uncertainty stays unresolved", () => {
  const definitePaper = SORT_ITEMS.filter((item) => item.answer === "paper");
  assert.equal(definitePaper.length, 4);
  assert.ok(definitePaper.every((item) => item.sourceIds.includes("merri-paper")));
  assert.deepEqual(new Set(definitePaper.map((item) => item.artworkId)), new Set(["cardboard", "paper", "newspaper"]));
  for (const item of SORT_ITEMS.filter((item) => item.answer === "ewaste")) {
    assert.match(item.condition, /qualified repairer/i);
    assert.match(item.condition, /check/i);
    assert.match(item.condition, /(?:not|won't).*repaired.*used again/i);
    assert.match(item.condition, /collection/i);
    assert.match(item.explanation, /accept/);
  }
  for (const item of SORT_ITEMS.filter((item) => item.answer === "ask")) assert.match(item.condition, /warning|missing/i);
  assert.match(SORT_ITEMS.find((item) => item.id === "shaver-ready").condition, /no warning signs/i);
  assert.equal(SORT_ITEMS.find((item) => item.id === "jug-unknown").answer, "ask");
  assert.equal(SORT_ITEMS.find((item) => item.id === "shaver-warning").answer, "ask");
  assert.equal(SORT_ITEMS.find((item) => item.id === "toaster-unknown").answer, "ask");
  assert.equal(SORT_ITEMS.find((item) => item.id === "fan-unassessed").answer, "ask");
});

test("identical appliance silhouettes have deliberately different evidence and next steps", () => {
  for (const artwork of ["fan", "toaster"]) {
    const items = SORT_ITEMS.filter((item) => item.artworkId === artwork);
    assert.deepEqual(new Set(items.map((item) => item.answer)), new Set(["ewaste", "ask"]));
    assert.equal(new Set(items.map((item) => item.condition)).size, items.length);
  }
  const kettles = MISSIONS.filter((mission) => mission.variantGroup === "kettle-conditions");
  assert.deepEqual(new Set(kettles.map((mission) => mission.outcome.scene)), new Set(["repair", "collection"]));
});

test("moving-day plans separate item streams and the optional companion has solo access", () => {
  const moving = MISSIONS.find((mission) => mission.id === "moving-day-box");
  assert.deepEqual(moving.slots.map((slot) => slot.id), ["toaster", "cardboard"]);
  assert.deepEqual(moving.acceptedPlans, [{ toaster: "reuse", cardboard: "paper" }]);
  const cooperative = MISSIONS.filter((mission) => mission.cooperative);
  assert.ok(cooperative.length >= 1);
  for (const mission of cooperative) assert.match(mission.cooperative.text, /solo.*yourself/i);
});

test("child content never requests real electrical handling or invents impact and cost claims", () => {
  const text = JSON.stringify([MISSIONS, SORT_ITEMS, CONCEPTS]);
  assert.doesNotMatch(text, /\b(?:unplug|switch on|test the (?:fan|toaster|kettle)|clean the (?:fan|toaster|kettle)|open the (?:fan|toaster|shaver))\b/i);
  assert.doesNotMatch(text, /(?:\$\s*\d|\d+\s*(?:kg|kilograms|tonnes|litres|CO2)|not recalled|guaranteed safe|time runs out)/i);
  const warning = MISSIONS.find((mission) => mission.id === "bulging-gadget");
  assert.equal(warning.outcome.scene, "help");
  assert.match(warning.outcome.text, /official (?:advice|guidance)/);
  for (const id of ["pip-damaged-cable", "bulging-gadget", "mystery-glass-jug"]) {
    const mission = MISSIONS.find((entry) => entry.id === id);
    const acceptedActionId = mission.acceptedPlans[0].next;
    const acceptedAction = mission.allowedActions.find((action) => action.id === acceptedActionId);
    assert.match(acceptedAction.label, /trusted adult/i, `${id}: clear route to adult help`);
  }
});

test("two-picture reflections revisit the evidence that changed each story's plan", () => {
  const correctClues = {
    "flo-next-home": /checks done.*Bea wanted Flo/i,
    "quiet-fan": /report was empty/i,
    "pip-damaged-cable": /cable was damaged/i,
    "kettle-second-chance": /repair was possible/i,
    "kettle-last-chapter": /service had not answered/i,
    "moving-day-box": /toaster and clean cardboard/i,
    "bulging-gadget": /battery was bulging/i,
    "mystery-glass-jug": /list named bottles and jars/i,
  };
  const pictureIds = new Set(["paper", "fan", "person", "toaster-damaged", "kettle", "boxed-toaster", "cardboard", "shaver", "battery-shaver", "glass-jug"]);
  for (const mission of MISSIONS) {
    const { reflection } = mission;
    assert.equal(reflection.options.length, 2, mission.id);
    assert.equal(new Set(reflection.options.map((option) => option.id)).size, 2, mission.id);
    assert.equal(new Set(reflection.options.map((option) => option.label)).size, 2, mission.id);
    assert.ok(reflection.options.every((option) => pictureIds.has(option.artworkId)), `${mission.id}: existing local pictures`);
    const correct = reflection.options.find((option) => option.id === reflection.correctId);
    assert.match(correct.label, correctClues[mission.id], `${mission.id}: evidence-specific answer`);
    assert.ok(reflection.prompt && reflection.explanation, `${mission.id}: question and helpful reason`);
  }
  const kettle = MISSIONS.find((mission) => mission.id === "kettle-second-chance");
  assert.match(kettle.reflection.explanation, /does not mean Kiki is fixed/);
  const warning = MISSIONS.find((mission) => mission.id === "bulging-gadget");
  assert.match(warning.reflection.explanation, /leave it alone.*trusted adult.*official advice/i);
  const glass = MISSIONS.find((mission) => mission.id === "mystery-glass-jug");
  assert.match(glass.reflection.explanation, /needs to ask about this exact kind/i);
});

test("child-facing explanations use short sentences without technical decision jargon", () => {
  const fields = [];
  for (const mission of MISSIONS) {
    fields.push(mission.childSummary, mission.fictionalContext, ...Object.values(mission.guideLines), mission.postcardLine,
      ...mission.clues.map((clue) => clue.text), ...mission.allowedActions.flatMap((action) => [action.label, action.feedback]),
      mission.outcome.text, mission.helpText, mission.discussionPrompt, mission.reflection.prompt,
      ...mission.reflection.options.map((option) => option.label), mission.reflection.explanation);
    if (mission.cooperative) fields.push(mission.cooperative.text, mission.cooperative.prompt);
  }
  fields.push(...CONCEPTS.map((concept) => concept.text), ...SORT_ITEMS.flatMap((item) => [item.condition, item.clue, item.explanation]));
  for (const text of fields) {
    assert.doesNotMatch(text, /\b(?:diagnosis|assessment|handover|destination|acceptance)\b/i);
    for (const sentence of text.replace(/^(?:Pip|Flo):\s*/, "").split(/[.!?]+\s*/).filter(Boolean)) {
      assert.ok(sentence.trim().split(/\s+/).length <= 12, `Sentence needs shortening: ${sentence}`);
    }
  }
});
