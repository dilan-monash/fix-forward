// Retained three-story Appliance Detective activity used by the adult app's learning screen.
// This is separate from the newer /quest module and its Sparks, storage and eight missions.
// Authored story records contain picture type, choices, feedback and a discovery; they are not real product data.
// A separate, fictional learning journey: it never evaluates a real appliance.
const STORIES = [
  {
    name: "Spot a safer choice",
    title: "Pip has a damaged cable",
    story: "In this picture story, Sam notices a damaged cable on Pip the toaster. What should Sam do?",
    illustration: "toaster",
    choices: [
      { id: "secret", text: "Keep it a secret", feedback: "A grown-up needs to know. Sam can tell them and leave Pip alone." },
      { id: "adult", text: "Tell a grown-up and leave Pip alone", correct: true, feedback: "That is a safer choice. Sam stays away and tells a grown-up. Children do not need to touch, switch on or test an appliance." },
      { id: "guess", text: "Guess that Pip is safe", feedback: "A picture cannot tell us an appliance is safe. Sam can leave Pip alone and tell a grown-up instead." }
    ],
    discovery: "Tell a grown-up when something seems wrong."
  },
  {
    name: "Think about repair",
    title: "Can Flo have another chapter?",
    story: "In our next story, a grown-up says Flo the fan has stopped working. Which question could help them decide what to do?",
    illustration: "fan",
    choices: [
      { id: "repair", text: "Could a repairer help Flo?", correct: true, feedback: "Good question! A grown-up can ask a repairer whether repair is possible, safe and worth the cost. Sometimes repair helps an appliance last longer." },
      { id: "colour", text: "Which new fan has the best colour?", feedback: "Colour can wait. First, the grown-up could ask whether Flo can be repaired safely and at a sensible cost." },
      { id: "bin", text: "Does every broken appliance belong in a bin?", feedback: "Some appliances can be repaired. A grown-up can ask a repairer before deciding whether to replace Flo." }
    ],
    discovery: "A grown-up can ask about repair before replacing."
  },
  {
    name: "Find the next stop",
    title: "A new journey for Pip's materials",
    story: "A repairer has told the grown-up that Pip cannot be repaired. Where should the grown-up look next?",
    illustration: "recycle",
    choices: [
      { id: "rubbish", text: "The household rubbish bin", feedback: "Old electrical appliances need their own disposal plan. A grown-up can find an e-waste service and check that it accepts Pip." },
      { id: "recycling", text: "The household recycling bin", feedback: "An electrical appliance is different from bottles and cans. The grown-up needs to find an e-waste service that accepts Pip." },
      { id: "ewaste", text: "An e-waste service that accepts Pip", correct: true, feedback: "You found the next step! E-waste means old electrical products. A grown-up checks which service accepts this appliance and arranges safe handling." }
    ],
    discovery: "A grown-up checks where an old appliance is accepted."
  }
];

// Keep authored text safe when inserting it into the activity's HTML.
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

// Return an untouched first story with no answer and no completed ending.
export function createLearningState() {
  return { step: 0, choice: null, finished: false };
}

// Keep only a valid story index and answer; reject impossible completion combinations.
function validState(state) {
  if (!Number.isInteger(state?.step) || state.step < 0 || state.step >= STORIES.length) return createLearningState();
  const selected = STORIES[state.step].choices.find((choice) => choice.id === state.choice);
  return { step: state.step, choice: selected?.id || null, finished: state.finished === true && state.step === STORIES.length - 1 && selected?.correct === true };
}

// No progression until feedback has been read and a safer choice selected.
// Incorrect answers have unlimited retries, with no score or penalty.
// Apply one choose/retry/next/replay action and return the resulting story state.
// Unknown actions leave it unchanged; only a correct choice can advance.
export function transitionLearning(current, action) {
  const state = validState(current);
  const story = STORIES[state.step];
  const selected = story.choices.find((choice) => choice.id === state.choice);
  if (action?.type === "replay") return createLearningState();
  if (state.finished) return state;
  if (action?.type === "choose" && state.choice === null && story.choices.some((choice) => choice.id === action.choice)) {
    return { ...state, choice: action.choice };
  }
  if (action?.type === "retry" && selected && !selected.correct) return { ...state, choice: null };
  if (action?.type === "next" && selected?.correct) {
    return state.step === STORIES.length - 1 ? { ...state, finished: true } : { step: state.step + 1, choice: null, finished: false };
  }
  return state;
}

// Return the heading or feedback selector that should receive focus for this state.
export function learningFocusTarget(current) {
  const state = validState(current);
  return state.choice && !state.finished ? "#learning-feedback" : "#learning-focus";
}

// Return a local SVG picture for a fictional toaster, fan or recycling story.
function illustration(kind) {
  const toaster = `<rect x="70" y="70" width="180" height="120" rx="32" fill="#b6e9f4"/><path d="M96 72V60h128v12" fill="none"/><path d="M93 190v10m135-10v10M232 113h20v27h-20"/><circle cx="129" cy="123" r="6" fill="#061f57"/><circle cx="183" cy="123" r="6" fill="#061f57"/><path d="M143 145q13 12 26 0" fill="none"/>`;
  const scene = kind === "fan"
    ? `<path d="M147 162v37h-36q-10 0-10 13h118q0-13-10-13h-36v-37" fill="#d1e5fa"/><circle cx="160" cy="100" r="76" fill="#d1e5fa"/><circle cx="160" cy="100" r="64" fill="#fff"/><path d="M160 100q-39-18-17-43t28 12zm0 0q32-29 43 2t-19 22zm0 0q8 42-25 32t-6-33z" fill="#77c9df"/><circle cx="160" cy="100" r="13" fill="#ffd773"/>`
    : kind === "recycle"
      ? `${toaster}<circle cx="259" cy="63" r="37" fill="#e2f3cf"/><path d="M243 65a17 17 0 0 1 29-13m-1-9 2 12-12-1M275 62a17 17 0 0 1-28 15m-1 9-2-12 12 1" fill="none"/>`
      : `${toaster}<path d="M250 167h15q18 0 18 15v13m0 15v9" fill="none"/><path d="m277 199 11-4m-11 13 11-4" stroke="#a44918"/><circle cx="61" cy="60" r="25" fill="#ffe5ad"/><path d="M61 46v16m0 9v1"/>`;
  return `<svg class="learning-illustration" aria-hidden="true" viewBox="0 0 320 240" fill="none" stroke="#061f57" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="160" cy="222" rx="105" ry="10" fill="#dcecf4" stroke="none"/>${scene}</svg>`;
}

// Count correct story steps and return the labelled discovery indicator.
function progress(state) {
  const answered = STORIES[state.step].choices.find((choice) => choice.id === state.choice)?.correct === true;
  const count = state.finished ? STORIES.length : state.step + Number(answered);
  return `<div class="learning-progress"><p>${count} of ${STORIES.length} discoveries</p><ol aria-label="Your picture stories">${STORIES.map((story, index) => `<li class="${index < count ? "is-done" : ""}"${index === state.step && !state.finished ? ' aria-current="step"' : ""}><span aria-hidden="true">${index < count ? "✓" : index + 1}</span>${escapeHtml(story.name)}${index < count ? '<span class="sr-only"> completed</span>' : ""}</li>`).join("")}</ol></div>`;
}

// Return the complete activity HTML from validated state; app.js attaches its button handlers.
export function renderLearning(current) {
  const state = validState(current);
  const story = STORIES[state.step];
  const selected = story.choices.find((choice) => choice.id === state.choice);
  return `<section class="screen narrow learning-screen" aria-label="Appliance detectives learning activity">
    <button type="button" class="back-button" data-learning-action="exit">Back to home</button>
    <header class="learning-heading"><p class="eyebrow">Play together with a grown-up</p><h1>Appliance detectives</h1><p>Three picture stories. Make a choice, discover why, and try again whenever you like.</p></header>
    <p class="learning-boundary">This game stays on the screen. No real appliance is needed. Grown-ups arrange help for real appliance problems.</p>
    ${progress(state)}
    ${state.finished ? `<div class="learning-finish">
      <span class="learning-finish-mark" aria-hidden="true">★</span><h2 id="learning-focus" tabindex="-1">Three discoveries to share!</h2>
      <p>You finished the picture stories. Tell your grown-up one thing you learned.</p>
      <ul>${STORIES.map((item) => `<li>${escapeHtml(item.discovery)}</li>`).join("")}</ul>
      <p class="learning-discuss">Talk together: why might a family ask about repair before replacing something?</p>
      <div class="button-row"><button type="button" class="button primary" data-learning-action="replay">Play again</button><button type="button" class="button secondary" data-learning-action="exit">Finish and go home</button></div>
    </div>` : `<article class="learning-story">
      <div class="learning-picture">${illustration(story.illustration)}<p aria-hidden="true">${state.step === 1 ? "Meet Flo" : "Meet Pip"}</p></div>
      <div class="learning-story-content"><p class="eyebrow">Picture story ${state.step + 1} of ${STORIES.length}</p><h2 id="learning-focus" tabindex="-1">${escapeHtml(story.title)}</h2><p id="learning-story-text">${escapeHtml(story.story)}</p>
        <div class="learning-choices" role="group" aria-label="Choose an answer" aria-describedby="learning-story-text">${story.choices.map((choice, index) => `<button type="button" class="learning-choice${state.choice === choice.id ? " is-selected" : ""}" data-learning-action="choose" data-learning-choice="${escapeHtml(choice.id)}" aria-pressed="${state.choice === choice.id}"${selected ? " disabled" : ""}><span aria-hidden="true">${String.fromCharCode(65 + index)}</span>${escapeHtml(choice.text)}</button>`).join("")}</div>
      </div>
      ${selected ? `<div class="learning-feedback${selected.correct ? " is-correct" : ""}" id="learning-feedback" tabindex="-1" role="status"><h3>${selected.correct ? "Discovery unlocked" : "Let's think it through"}</h3><p>${escapeHtml(selected.feedback)}</p><button type="button" class="button primary" data-learning-action="${selected.correct ? "next" : "retry"}">${selected.correct ? (state.step === STORIES.length - 1 ? "See my discoveries" : "Next picture story") : "Try another choice"}</button></div>` : ""}
    </article>`}
  </section>`;
}
