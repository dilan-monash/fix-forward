/**
 * Quest's game rules, without browser or storage work. app.js sends named actions
 * to transition() and renders the returned state; storage.js uses hydrateState()
 * to rebuild saved progress. Neither function changes its input object.
 *
 * Keep stable content IDs in state, not story text or point totals. The same
 * mission, concept and answer IDs connect content, saves and progression.js.
 * This is local game progress, not evidence about a real appliance or child.
 */
import { MISSIONS, SORT_ITEMS, CONCEPTS } from './content.js';
import { validThemes, validStickers } from './postcard-options.js';
import { isReflectionCorrect } from './progression.js';
// Let the UI check reflection feedback using the same rule as saved progress.
export { isReflectionCorrect } from './progression.js';

// Storage accepts this schema version; new optional fields receive defaults below.
export const STATE_VERSION = 1;
// These scene locations are the only places where earned decorations can be put.
export const DECORATION_SLOTS = ['home', 'studio', 'station'];
// Match sorting-card answers and the three destination controls in app.js.
export const DESTINATION_IDS = ['ewaste', 'paper', 'ask'];
// A view is a whole screen; a step is the current stage inside one mission.
const VIEWS = ['home', 'mission', 'sorting', 'book', 'creations', 'grownups'];
const STEPS = ['intro', 'explore', 'plan', 'feedback', 'outcome'];
// Resolve only authored missions; an unknown action or saved ID returns undefined.
const missionById = id => MISSIONS.find(mission => mission.id === id);
// Resolve a sorting ID back to its reviewed condition and answer.
const itemById = id => SORT_ITEMS.find(item => item.id === id);
// Saved maps must be objects; arrays and null cannot stand in for keyed progress.
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// Preserve the first occurrence while preventing duplicate discoveries or help IDs.
const unique = values => [...new Set(values)];
// Keep only known string IDs from a saved list and discard duplicates or free text.
const validIds = (values, ids) => Array.isArray(values) ? unique(values.filter(id => typeof id === 'string' && ids.includes(id))) : [];
// Keep the deterministic round seed finite and within the range used by START_SORT.
const boundedRound = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;

/** Return a fresh adventure with sensory feedback ready for the first game tap.
 * Browser audio still waits for a gesture; these defaults never start a speaker. */
export function createState() {
  return {
    version: STATE_VERSION, view: 'home', activeMission: null, completed: {}, discoveries: [],
    settings: { mode: 'guided', narration: true, sound: true, haptics: true, motion: 'full' },
    decorations: { home: null, studio: null, station: null }, postcards: {}, reflections: {}, sorting: null, sortRound: 0, practice: [], sortedItems: []
  };
}

/** Both play styles need every authored fact before planning. Guided reveals
 * them in order; Challenge lets children find them. Counting exact IDs prevents
 * duplicates or unrelated clues from unlocking a story's next step. */
export function canOpenPlan(state) {
  const active = state?.activeMission;
  const mission = missionById(active?.id);
  return Boolean(state?.view === 'mission' && active?.step === 'explore' && mission
    && Array.isArray(active.clueIds) && mission.clues.every(clue => active.clueIds.includes(clue.id)));
}

// Start or replay a known story without clearing previously earned discoveries.
function newMission(id) {
  return { id, step: 'intro', clueIds: [], plan: {}, assisted: false, feedback: null };
}

/** Return five unique authored card IDs; the same round number gives the same order. */
export function sortingRound(round = 0) {
  // Each round begins with three different decisions. A plain shuffle can produce
  // a first round of mostly packaging, encouraging silhouette-only guessing.
  let seed = ((boundedRound(round) ? round : 0) + 1) * 2654435761 >>> 0;
  const ids = SORT_ITEMS.map(item => item.id);
  // Shuffle a local array with the round's seed, so reloads need no clock or randomness.
  function shuffle(values) {
    for (let index = values.length - 1; index > 0; index -= 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const other = seed % (index + 1);
      [values[index], values[other]] = [values[other], values[index]];
    }
    return values;
  }
  shuffle(ids);
  const firstThree = shuffle(DESTINATION_IDS.map(answer => ids.find(id => itemById(id).answer === answer)));
  return [...firstThree, ...ids.filter(id => !firstThree.includes(id)).slice(0, 2)];
}

/** Compare every required slot with an authored answer, including two-item plans. */
export function isAcceptedPlan(mission, plan) {
  if (!mission || !isRecord(plan)) return false;
  return mission.acceptedPlans.some(accepted => mission.slots.every(slot => plan[slot.id] === accepted[slot.id]));
}

// Remember ideas that needed help for future suggestions; this is not a score penalty.
function markPractice(state, conceptIds) {
  return unique([...conceptIds, ...state.practice]);
}

// Copy the current state and mission together; optional extra fields hold new progress.
function updateMission(state, changes, extra = {}) {
  return { ...state, ...extra, activeMission: { ...state.activeMission, ...changes } };
}

// Resolve the current round position; a missing or completed round has no current card.
function currentSortItem(state) {
  return state.sorting ? itemById(state.sorting.itemIds[state.sorting.index]) : null;
}

/** Count successful cards once, separating answers made alone from those using help. */
export function sortingSummary(sorting) {
  const answers = Object.values(sorting?.answers || {});
  return { independent: answers.filter(answer => !answer.assisted).length, helped: answers.filter(answer => answer.assisted).length, total: answers.length };
}

/** Suggest unfinished practice, then other unfinished stories, then the next replay. */
export function suggestedMission(state) {
  const unfinished = MISSIONS.filter(mission => !Object.hasOwn(state.completed, mission.id));
  const matching = unfinished.find(mission => mission.id !== state.activeMission?.id && mission.conceptIds.some(id => state.practice.includes(id)));
  if (matching) return matching.id;
  if (unfinished.length) return unfinished[0].id;
  const current = MISSIONS.findIndex(mission => mission.id === state.activeMission?.id);
  return MISSIONS[(current + 1) % MISSIONS.length]?.id ?? null;
}

/**
 * Apply one { type, ...fields } action to valid state. Return a new state when an
 * allowed change occurs, or the same object for invalid, stale or repeated input.
 * Completion actions record unique IDs; progression.js derives their Spark value.
 * Rendering, narration and drag cleanup cannot award progress by themselves.
 */
export function transition(state, action) {
  if (!action || typeof action.type !== 'string') return state;
  const active = state.activeMission;
  const mission = missionById(active?.id);
  const sorting = state.sorting;
  const missionOnly = ['START_MISSION', 'COLLECT_CLUE', 'OPEN_PLAN', 'EXPLORE_AGAIN', 'SET_PLAN', 'REMOVE_PLAN', 'CHECK_PLAN', 'RETRY_PLAN', 'COMPLETE_MISSION'];
  // Ignore delayed mission controls after navigation, even if a mission is saved.
  if (missionOnly.includes(action.type) && state.view !== 'mission') return state;
  switch (action.type) {
    case 'NAVIGATE':
      // Keep unfinished work when changing screens, but do not open an empty activity.
      if (!VIEWS.includes(action.view) || (action.view === 'mission' && !active) || (action.view === 'sorting' && !sorting)) return state;
      return state.view === action.view ? state : { ...state, view: action.view };
    case 'CHOOSE_MISSION':
      // Choosing a story starts its introduction; earned records remain untouched.
      return missionById(action.id) ? { ...state, view: 'mission', activeMission: newMission(action.id) } : state;
    case 'REPLAY_MISSION':
      // Only reset this attempt, so replaying cannot duplicate the completion record.
      return mission ? { ...state, view: 'mission', activeMission: newMission(mission.id) } : state;
    case 'START_MISSION':
      return active?.step === 'intro' ? updateMission(state, { step: 'explore' }) : state;
    case 'COLLECT_CLUE':
      // A clue belongs to this story and is recorded once, even if reopened later.
      if (!mission || !['explore', 'plan'].includes(active.step) || !mission.clues.some(clue => clue.id === action.id) || active.clueIds.includes(action.id)) return state;
      return updateMission(state, { clueIds: [...active.clueIds, action.id] });
    case 'OPEN_PLAN':
      // The visible next-step control and the rule engine share this same gate.
      return canOpenPlan(state) ? updateMission(state, { step: 'plan' }) : state;
    case 'EXPLORE_AGAIN':
      // A wrong answer can return to clues without losing the plan or help history.
      return active?.step === 'plan' || (active?.step === 'feedback' && !active.feedback?.correct)
        ? updateMission(state, { step: 'explore', feedback: null }) : state;
    case 'SET_PLAN':
      // Tap and drag share this action, so both must use authored slots and choices.
      if (!mission || active.step !== 'plan' || !mission.slots.some(slot => slot.id === action.slotId) || !mission.allowedActions.some(item => item.id === action.actionId) || active.plan[action.slotId] === action.actionId) return state;
      return updateMission(state, { plan: { ...active.plan, [action.slotId]: action.actionId } });
    case 'REMOVE_PLAN': {
      // Copy before removing a tile so earlier state snapshots remain usable.
      if (!mission || active.step !== 'plan' || !Object.hasOwn(active.plan, action.slotId)) return state;
      const plan = { ...active.plan };
      delete plan[action.slotId];
      return updateMission(state, { plan });
    }
    case 'CHECK_PLAN': {
      // Check only full plans. Pick feedback from a mismatched slot when available.
      if (!mission || active.step !== 'plan' || !mission.slots.every(slot => Object.hasOwn(active.plan, slot.id))) return state;
      const correct = isAcceptedPlan(mission, active.plan);
      const incorrectSlot = mission.slots.find(slot => !mission.acceptedPlans.some(plan => plan[slot.id] === active.plan[slot.id]));
      const actionId = active.plan[incorrectSlot?.id ?? mission.slots[0].id];
      return updateMission(state, { step: 'feedback', feedback: { correct, actionId }, assisted: active.assisted || !correct }, correct ? {} : { practice: markPractice(state, mission.conceptIds) });
    }
    case 'RETRY_PLAN':
      // Retrying clears only feedback; the child can adjust the existing plan.
      return active?.step === 'feedback' && !active.feedback?.correct ? updateMission(state, { step: 'plan', feedback: null }) : state;
    case 'COMPLETE_MISSION': {
      // Recheck the answer instead of trusting a UI success message. Store a story
      // once and preserve its first assistance result when it is replayed later.
      if (!mission || active.step !== 'feedback' || !active.feedback?.correct || !isAcceptedPlan(mission, active.plan)) return state;
      const completed = Object.hasOwn(state.completed, mission.id) ? state.completed : { ...state.completed, [mission.id]: { assisted: active.assisted } };
      return updateMission(state, { step: 'outcome' }, { completed, discoveries: unique([...state.discoveries, ...mission.conceptIds]) });
    }
    case 'CHECK_REFLECTION': {
      // Reflection credit requires a finished story and its authored correct option.
      // Wrong-answer feedback stays in app.js so retries do not create saved penalties.
      const reflectedMission = missionById(action.missionId);
      if (!reflectedMission || !Object.hasOwn(state.completed, reflectedMission.id)
        || !isReflectionCorrect(reflectedMission, action.answerId)
        || state.reflections?.[reflectedMission.id] === action.answerId) return state;
      return { ...state, reflections: { ...state.reflections, [reflectedMission.id]: action.answerId } };
    }
    case 'HINT': {
      // Help is remembered once for the current attempt/card and never costs Sparks.
      if (state.view === 'mission' && mission && ['explore', 'plan'].includes(active.step)) {
        if (active.assisted) return state;
        return updateMission(state, { assisted: true }, { practice: markPractice(state, mission.conceptIds) });
      }
      const item = currentSortItem(state);
      if (state.view !== 'sorting' || !item || sorting.status !== 'playing' || sorting.assistedIds.includes(item.id)) return state;
      return { ...state, practice: markPractice(state, [item.conceptId]), sorting: { ...sorting, assistedIds: [...sorting.assistedIds, item.id] } };
    }
    case 'SET_SETTING': {
      // Sound, story voice and touch feedback are independent choices. Muting
      // the speaker does not remove gentle touch feedback in a quiet room.
      // The current requested design always animates its graphics. Motion is no
      // longer a switchable setting; stale controls cannot change that policy.
      const allowed = { mode: ['guided', 'challenge'], narration: [true, false], sound: [true, false], haptics: [true, false] };
      if (!Object.hasOwn(allowed, action.key) || !allowed[action.key].includes(action.value) || state.settings[action.key] === action.value) return state;
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };
    }
    case 'PLACE_DECORATION': {
      // Allow an earned decoration or null to clear a slot; no arbitrary asset IDs.
      if (!DECORATION_SLOTS.includes(action.slotId)) return state;
      const concept = CONCEPTS.find(item => item.id === action.conceptId && state.discoveries.includes(item.id));
      const earned = CONCEPTS.filter(item => state.discoveries.includes(item.id)).map(item => item.decoration);
      const decoration = action.decorationId === null ? null : concept?.decoration ?? action.decorationId;
      if ((decoration !== null && !earned.includes(decoration)) || state.decorations[action.slotId] === decoration) return state;
      return { ...state, decorations: { ...state.decorations, [action.slotId]: decoration } };
    }
    case 'DESIGN_POSTCARD': {
      // Only finished stories have keepsakes. Partial edits retain the other choice,
      // and the shared option lists keep arbitrary text out of saved designs.
      if (!missionById(action.id) || !Object.hasOwn(state.completed, action.id)) return state;
      const previous = state.postcards?.[action.id] || { theme: 'sunshine', sticker: 'star' };
      if ((action.theme !== undefined && !validThemes.includes(action.theme)) || (action.sticker !== undefined && !validStickers.includes(action.sticker))) return state;
      const design = { theme: action.theme ?? previous.theme, sticker: action.sticker ?? previous.sticker };
      if (design.theme === previous.theme && design.sticker === previous.sticker) return state;
      return { ...state, postcards: { ...state.postcards, [action.id]: design } };
    }
    case 'START_SORT': {
      // Ignore a repeated start on an active board. app.js resumes a saved board
      // with NAVIGATE; a deliberate new round advances this bounded seed counter.
      if (state.view === 'sorting' && sorting?.status !== 'complete' && sorting) return state;
      const round = state.sortRound;
      return { ...state, view: 'sorting', sortRound: (round + 1) % 1000001, sorting: { round, itemIds: sortingRound(round), index: 0, status: 'playing', assistedIds: [], answers: {}, feedback: null } };
    }
    case 'ANSWER_SORT': {
      // Only a valid destination for the current unanswered card can submit a choice.
      // Wrong attempts add help history; a later success records one answer and idea.
      const item = currentSortItem(state);
      if (state.view !== 'sorting' || !item || sorting.status !== 'playing' || !DESTINATION_IDS.includes(action.destinationId) || Object.hasOwn(sorting.answers, item.id)) return state;
      const correct = action.destinationId === item.answer;
      const assisted = sorting.assistedIds.includes(item.id);
      return {
        ...state,
        discoveries: correct ? unique([...state.discoveries, item.conceptId]) : state.discoveries,
        // Each different picture earns its own mastery reward, even when its
        // idea was learned in another story. Replays still count in this round.
        sortedItems: correct ? unique([...(state.sortedItems || []), item.id]) : (state.sortedItems || []),
        practice: correct ? state.practice : markPractice(state, [item.conceptId]),
        sorting: {
          ...sorting, status: 'feedback', feedback: { correct, destinationId: action.destinationId },
          assistedIds: !correct ? unique([...sorting.assistedIds, item.id]) : sorting.assistedIds,
          answers: correct ? { ...sorting.answers, [item.id]: { assisted } } : sorting.answers
        }
      };
    }
    case 'RETRY_SORT':
      // Keep the same card and help history until its answer has been resolved.
      return state.view === 'sorting' && sorting?.status === 'feedback' && !sorting.feedback?.correct ? { ...state, sorting: { ...sorting, status: 'playing', feedback: null } } : state;
    case 'NEXT_SORT':
      // Success must be acknowledged before moving on; the fifth card ends the round.
      if (state.view !== 'sorting' || sorting?.status !== 'feedback' || !sorting.feedback?.correct) return state;
      return { ...state, sorting: { ...sorting, index: sorting.index + 1, status: sorting.index + 1 === sorting.itemIds.length ? 'complete' : 'playing', feedback: null } };
    default:
      return state;
  }
}

/** Rebuild one saved attempt from known IDs and move impossible steps back to work. */
function hydrateMission(raw, completed) {
  if (!isRecord(raw)) return null;
  const mission = missionById(raw.id);
  if (!mission) return null;
  const active = newMission(mission.id);
  active.clueIds = validIds(raw.clueIds, mission.clues.map(clue => clue.id));
  active.assisted = raw.assisted === true;
  // Ignore unknown slots/actions instead of carrying untrusted saved properties along.
  if (isRecord(raw.plan)) {
    for (const slot of mission.slots) {
      if (mission.allowedActions.some(action => action.id === raw.plan[slot.id])) active.plan[slot.id] = raw.plan[slot.id];
    }
  }
  // Later screens need evidence and a complete plan; a partial save must remain playable.
  active.step = STEPS.includes(raw.step) ? raw.step : 'intro';
  if (['plan', 'feedback', 'outcome'].includes(active.step) && !active.clueIds.length) active.step = 'explore';
  if (['feedback', 'outcome'].includes(active.step)) {
    if (!mission.slots.every(slot => active.plan[slot.id])) active.step = 'plan';
    else {
      // Recompute feedback from the authored answer rather than saved success flags.
      const correct = isAcceptedPlan(mission, active.plan);
      const incorrectSlot = mission.slots.find(slot => !mission.acceptedPlans.some(plan => plan[slot.id] === active.plan[slot.id]));
      active.feedback = { correct, actionId: active.plan[incorrectSlot?.id ?? mission.slots[0].id] };
      if (!correct) active.assisted = true;
      if (active.step === 'outcome' && (!correct || !Object.hasOwn(completed, mission.id))) active.step = 'feedback';
    }
  }
  return active;
}

/** Recover a five-card round without skipping unfinished cards or inventing answers. */
function hydrateSorting(raw) {
  if (!isRecord(raw) || !boundedRound(raw.round)) return null;
  // Preserve legitimate earlier round orders when the selector improves. The
  // cards themselves remain reviewed records; unknown and duplicate IDs fail.
  if (!Array.isArray(raw.itemIds) || raw.itemIds.length !== 5 || new Set(raw.itemIds).size !== 5 || raw.itemIds.some(id => !itemById(id))) return null;
  const itemIds = [...raw.itemIds];
  if (!Number.isInteger(raw.index) || raw.index < 0 || raw.index > itemIds.length) return null;
  const answers = {};
  const assistedIds = validIds(raw.assistedIds, itemIds);
  // Only accept answers at or before the saved position and reconcile their help flags.
  if (isRecord(raw.answers)) {
    for (const id of itemIds.slice(0, Math.min(raw.index + 1, itemIds.length))) {
      if (isRecord(raw.answers[id]) && typeof raw.answers[id].assisted === 'boolean') {
        const assisted = raw.answers[id].assisted || assistedIds.includes(id);
        answers[id] = { assisted };
        if (assisted && !assistedIds.includes(id)) assistedIds.push(id);
      }
    }
  }
  // Gaps cannot skip a card after a corrupt or partially written save.
  const firstUnanswered = itemIds.findIndex(id => !Object.hasOwn(answers, id));
  const index = Math.min(raw.index, firstUnanswered === -1 ? itemIds.length : firstUnanswered);
  for (const id of itemIds.slice(index + 1)) delete answers[id];
  let status = index === itemIds.length ? 'complete' : 'playing';
  let feedback = null;
  const item = itemById(itemIds[index]);
  // Derive successful feedback from a recorded answer. A saved wrong destination
  // can restore retry feedback, but cannot manufacture a correct answer record.
  if (item && Object.hasOwn(answers, item.id)) {
    status = 'feedback';
    feedback = { correct: true, destinationId: item.answer };
  } else if (item && raw.status === 'feedback' && isRecord(raw.feedback) && DESTINATION_IDS.includes(raw.feedback.destinationId) && raw.feedback.destinationId !== item.answer) {
    status = 'feedback';
    feedback = { correct: false, destinationId: raw.feedback.destinationId };
    if (!assistedIds.includes(item.id)) assistedIds.push(item.id);
  }
  return { round: raw.round, itemIds, index, status, assistedIds, answers, feedback };
}

/**
 * Return a valid state from a parsed save, starting with current defaults. Read only
 * named fields and authored IDs; never spread raw saved data into application state.
 * This handles old/malformed local data, not tamper-proof or server-verified scoring.
 */
export function hydrateState(raw) {
  const state = createState();
  if (!isRecord(raw) || raw.version !== STATE_VERSION) return state;
  // Completion records anchor earned reflections, postcards and mission outcomes.
  if (isRecord(raw.completed)) {
    for (const mission of MISSIONS) {
      if (Object.hasOwn(raw.completed, mission.id) && isRecord(raw.completed[mission.id]) && typeof raw.completed[mission.id].assisted === 'boolean') state.completed[mission.id] = { assisted: raw.completed[mission.id].assisted };
    }
  }
  // Older version-1 saves have no reflection map; missing entries simply stay empty.
  if (isRecord(raw.reflections)) {
    for (const mission of MISSIONS) {
      if (Object.hasOwn(state.completed, mission.id) && Object.hasOwn(raw.reflections, mission.id)
        && isReflectionCorrect(mission, raw.reflections[mission.id])) state.reflections[mission.id] = raw.reflections[mission.id];
    }
  }
  // Keep earned designs only and replace unrecognised choices with fixed defaults.
  if (isRecord(raw.postcards)) {
    for (const mission of MISSIONS) {
      const design = raw.postcards[mission.id];
      if (!Object.hasOwn(state.completed, mission.id) || !isRecord(design)) continue;
      state.postcards[mission.id] = {
        theme: validThemes.includes(design.theme) ? design.theme : 'sunshine',
        sticker: validStickers.includes(design.sticker) ? design.sticker : 'star'
      };
    }
  }
  const conceptIds = CONCEPTS.map(concept => concept.id);
  // Reconcile ideas implied by completed stories with the separately saved collection.
  state.discoveries = unique([
    ...validIds(raw.discoveries, conceptIds),
    ...MISSIONS.filter(mission => Object.hasOwn(state.completed, mission.id)).flatMap(mission => mission.conceptIds)
  ]);
  state.practice = validIds(raw.practice, conceptIds);
  if (isRecord(raw.settings)) {
    state.settings.mode = raw.settings.mode === 'challenge' ? 'challenge' : 'guided';
    // Keep a child's explicit off choices. Missing or malformed older fields
    // inherit the new first-run defaults, still subject to browser gesture rules.
    for (const key of ['narration', 'sound', 'haptics']) {
      if (typeof raw.settings[key] === 'boolean') state.settings[key] = raw.settings[key];
    }
    // Keep createState's fixed full motion for this requested design. Older
    // auto/reduce saves retain every valid story, point and picture below;
    // changing presentation never resets the child's adventure.
  }
  state.activeMission = hydrateMission(raw.activeMission, state.completed);
  state.sorting = hydrateSorting(raw.sorting);
  // Keep known picture IDs across rounds. Older saves can recover credit from
  // their last valid board; never infer a solved picture from a concept alone.
  state.sortedItems = unique([
    ...validIds(raw.sortedItems, SORT_ITEMS.map(item => item.id)),
    ...Object.keys(state.sorting?.answers || {})
  ]);
  // A usable saved board supplies a safe next seed if the counter itself is damaged.
  state.sortRound = boundedRound(raw.sortRound) ? raw.sortRound : state.sorting ? (state.sorting.round + 1) % 1000001 : 0;
  if (state.sorting) state.discoveries = unique([...state.discoveries, ...Object.keys(state.sorting.answers).map(id => itemById(id).conceptId)]);
  // Recompute earned choices after recovering mission and sorting discoveries.
  if (isRecord(raw.decorations)) {
    const earned = CONCEPTS.filter(concept => state.discoveries.includes(concept.id)).map(concept => concept.decoration);
    for (const slot of DECORATION_SLOTS) state.decorations[slot] = earned.includes(raw.decorations[slot]) ? raw.decorations[slot] : null;
  }
  state.view = VIEWS.includes(raw.view) ? raw.view : 'home';
  // A removed or invalid activity must fall back to home instead of an empty screen.
  if ((state.view === 'mission' && !state.activeMission) || (state.view === 'sorting' && !state.sorting)) state.view = 'home';
  return state;
}
