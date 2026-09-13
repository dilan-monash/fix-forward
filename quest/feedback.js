/**
 * Plain-English feedback for the choices a child actually made. These helpers
 * only describe authored rules and earned progress; they never award Sparks,
 * change an attempt, or decide that a real appliance is safe to handle.
 */
import { MISSIONS, CONCEPTS, SORT_ITEMS } from './content.js';
import { progression } from './progression.js';

// Reject arrays and missing values before reading a plan or saved progress map.
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// Speaker names are shown with character art by the caller, rather than repeated.
const withoutSpeaker = text => String(text || '').replace(/^(?:Pip|Flo):\s*/u, '');

/** Give the two-item story an explanation about this item, not the other slot. */
function slotMessage(mission, slot, action, correct, compatibleElsewhere) {
  if (!action) return `Choose a picture for ${slot.label.toLowerCase()}.`;
  if (mission.id === 'moving-day-box') {
    if (slot.id === 'toaster') {
      if (correct) return 'The toaster works. Its checks are done, and Bea wants it. A new home fits!';
      return action.id === 'paper'
        ? 'The toaster is electrical, not cardboard. Bea wants this checked toaster. Try its other plan.'
        : 'The toaster works, its checks are done, and Bea wants it. It can have a new home.';
    }
    if (slot.id === 'cardboard') {
      if (correct) return 'The box is empty and clean cardboard. Our story puts it with paper recycling.';
      return action.id === 'reuse'
        ? 'Bea wants the toaster. Nobody needs this empty box. What is the box made of?'
        : 'This empty box has no electrical parts. It is clean cardboard. Try its own recycling plan.';
    }
  }
  // Some future stories may allow two complete plans. A mixture of those plans
  // must not receive two ticks merely because each choice appears somewhere.
  if (!correct && compatibleElsewhere) return 'That choice can fit another plan. These choices need to work together. Try this one again.';
  return withoutSpeaker(action.feedback) || (correct ? 'This choice fits the story clues.' : 'Look at the story clues, then try another picture.');
}

/**
 * Explain an attempt (or a plain slot-to-action plan) one item at a time.
 * Match one complete accepted plan. For a retry, use the variant with the most
 * matching slots; a tie uses authored order. This makes feedback deterministic
 * and preserves the largest useful part of the child's current plan.
 */
export function planFeedback(mission, attemptOrPlan = {}) {
  const slots = Array.isArray(mission?.slots) ? mission.slots : [];
  const actions = Array.isArray(mission?.allowedActions) ? mission.allowedActions : [];
  const plan = isRecord(attemptOrPlan?.plan) ? attemptOrPlan.plan : isRecord(attemptOrPlan) ? attemptOrPlan : {};
  const accepted = Array.isArray(mission?.acceptedPlans) ? mission.acceptedPlans : [];
  // Only whole, authored variants can provide correct answers. Invalid content
  // fails closed here as well as in content.js's build-time validator.
  const variants = accepted.map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => slots.length > 0 && isRecord(candidate)
      && Object.keys(candidate).length === slots.length
      && slots.every(slot => Object.hasOwn(candidate, slot.id) && actions.some(action => action.id === candidate[slot.id])));
  const ranked = variants.map(variant => ({ ...variant, matches: slots.filter(slot => plan[slot.id] === variant.candidate[slot.id]).length }))
    .sort((left, right) => right.matches - left.matches || left.index - right.index);
  const best = ranked[0];
  const complete = slots.length > 0 && slots.every(slot => Object.hasOwn(plan, slot.id) && actions.some(action => action.id === plan[slot.id]));
  const rows = slots.map(slot => {
    const chosen = actions.find(action => action.id === plan[slot.id]);
    const expected = actions.find(action => action.id === best?.candidate[slot.id]);
    const chosenCorrect = Boolean(chosen && expected && chosen.id === expected.id);
    const compatibleElsewhere = Boolean(chosen && variants.some(variant => variant.candidate[slot.id] === chosen.id));
    return {
      slotId: slot.id, label: slot.label, chosenActionId: chosen?.id ?? null,
      chosenAction: chosen ? { ...chosen } : null, expectedAction: expected ? { ...expected } : null,
      chosenCorrect, status: chosenCorrect ? 'correct' : chosen ? 'retry' : 'missing',
      message: slotMessage(mission, slot, chosen, chosenCorrect, compatibleElsewhere)
    };
  });
  const matchedCount = rows.filter(row => row.chosenCorrect).length;
  const correct = complete && Boolean(best) && matchedCount === slots.length;
  const mixed = matchedCount > 0 && matchedCount < slots.length;
  let summary = 'Look at the clues. Try another choice.';
  if (!slots.length) summary = 'Choose a story to make a plan.';
  else if (correct) summary = slots.length === 1 ? 'Your choice fits the clues!' : 'Both choices fit the clues!';
  else if (mixed) summary = complete ? 'One choice fits! Keep it. Try the other choice.' : 'One choice fits! Choose a plan for the other item.';
  else if (!complete) summary = 'Choose a picture for each item.';
  return {
    correct, complete, mixed, matchedCount, total: slots.length, summary,
    matchedVariantIndex: best?.index ?? null,
    matchedPlan: best ? Object.fromEntries(slots.map(slot => [slot.id, best.candidate[slot.id]])) : null,
    slots: rows
  };
}

// Short celebrations praise the child's thinking. They do not claim a real
// item was repaired, recycled, or made safe by finishing a fictional game.
const JOY_LINES = Object.freeze({
  mission: ['You gave this story a new ending!', 'Clues connected. Story solved!', 'Look what your thinking did!', 'A bright idea. A brand-new chapter!'],
  sorting: ['Aha! You found the clue!', 'That choice clicks!', 'Picture matched. Great thinking!', 'You looked, you thought, you got it!'],
  reflection: ['You spotted what mattered!', 'That clue made the difference!', 'You can tell us why. Brilliant!', 'You joined the dots!'],
  round: ['Five stories, lots of smart thinking!', 'Round complete. Look what you learned!', 'Your clue-finding powers are growing!']
});
const IDEA_LINES = Object.freeze({
  reuse: 'You spotted a chance for another home.',
  assessment: 'You noticed what we still need to know.',
  warning: 'You spotted a warning and chose to get help.',
  repair: 'You used the repairer\'s clue. The repair can be planned.',
  collection: 'You remembered to ask the collection place first.',
  packaging: 'You gave the item and its box their own plans.',
  battery: 'You paused for the warning and chose to get help.',
  uncertainty: 'Saying “we need to ask” was a helpful choice.'
});

/** Stable variation: revisits do not change a message midway through rendering. */
function copyIndex(value, length) {
  let hash = 0;
  for (const character of String(value ?? '')) hash = (Math.imul(hash, 31) + character.codePointAt(0)) >>> 0;
  return hash % length;
}

/**
 * Describe only the actual points supplied by the transition's before/after
 * calculation. A replay may still earn a first reflection, so positive points
 * remain accurate even when replay=true. Zero points never become a fake prize.
 */
export function celebrationCopy({ kind = 'mission', missionId = '', conceptId = '', points = 0, replay = false, levelUp = false, seed = '' } = {}) {
  const lines = JOY_LINES[kind] || JOY_LINES.mission;
  const earned = Number.isSafeInteger(points) && points > 0 ? points : 0;
  const idea = conceptId || MISSIONS.find(mission => mission.id === missionId)?.conceptIds?.[0];
  const headline = levelUp ? 'Level up! Look how far you have come!' : lines[copyIndex(`${kind}:${missionId}:${conceptId}:${seed}`, lines.length)];
  const message = IDEA_LINES[idea] || (kind === 'round' ? 'You used each card\'s clues to choose its next step.' : 'You used the clues to choose what happens next.');
  const pointsLine = earned
    ? `+${earned} ${earned === 1 ? 'Spark' : 'Sparks'} added!`
    : kind === 'sorting' ? 'Great practice! Your round count went up. You earned this picture’s Sparks already.'
      : kind === 'round' ? 'Five pictures sorted! Your earned Sparks are in the top bar.'
        : replay ? 'Story replayed! You keep your Sparks. No extra Sparks this time.' : 'You keep your Sparks. This idea is already in your book.';
  return { headline, message, pointsLine };
}

/**
 * Preview the points still available, using progression.js's real calculation.
 * A story earns 20 once, each new idea earns 5 once, and its first correct
 * picture reflection earns 10. Existing ideas and completed replays are free
 * to enjoy again, but their previously earned points are never promised twice.
 */
export function rewardPreview(state = {}, { missionId, conceptId, sortItemId } = {}) {
  const before = progression(state);
  const mission = MISSIONS.find(item => item.id === missionId);
  const discoveries = Array.isArray(state?.discoveries) ? state.discoveries : [];
  if (!mission) {
    // Sorting uses the authored picture's idea, not a caller-supplied shortcut.
    // Preview exactly what ANSWER_SORT will record: picture credit plus any new idea.
    const picture = SORT_ITEMS.find(item => item.id === sortItemId);
    if (picture) {
      const after = progression({ ...state, sortedItems: [...(state.sortedItems || []), picture.id], discoveries: [...discoveries, picture.conceptId] });
      const points = after.points - before.points;
      const sortingPoints = after.breakdown.sorting - before.breakdown.sorting;
      const discoveryPoints = after.breakdown.discoveries - before.breakdown.discoveries;
      return { missionPoints: 0, sortingPoints, discoveryPoints, reflectionPoints: 0, completionPoints: points, totalPoints: points, replay: points === 0,
        label: points ? `Solve this picture: +${points} Sparks` : 'Practice picture: grow your round count',
        detail: points ? `${sortingPoints ? '5 for this new picture. ' : ''}${discoveryPoints ? '5 more for a new idea.' : ''}`.trim()
          : 'You earned this picture’s Sparks already. It still counts toward your five-picture round.' };
    }
    const known = CONCEPTS.some(concept => concept.id === conceptId);
    const after = known ? progression({ ...state, discoveries: [...discoveries, conceptId] }) : before;
    const points = after.points - before.points;
    return {
      missionPoints: 0, discoveryPoints: points, reflectionPoints: 0, completionPoints: points,
      totalPoints: points, replay: known && points === 0,
      label: points ? `Find this new idea: +${points} Sparks` : known ? 'Practise this idea again' : 'Choose a story or picture',
      detail: points ? 'Sparks arrive when your choice fits the clues.' : known ? 'This idea is already in your book. You keep your Sparks.' : ''
    };
  }
  const completed = isRecord(state?.completed) ? state.completed : {};
  const existing = completed[mission.id];
  const replay = isRecord(existing) && typeof existing.assisted === 'boolean';
  const finished = {
    ...state, completed: { ...completed, [mission.id]: replay ? existing : { assisted: false } },
    discoveries: [...discoveries, ...mission.conceptIds]
  };
  const after = progression(finished);
  const reflected = progression({ ...finished, reflections: { ...(isRecord(state?.reflections) ? state.reflections : {}), [mission.id]: mission.reflection.correctId } });
  const missionPoints = after.breakdown.missions - before.breakdown.missions;
  const discoveryPoints = after.breakdown.discoveries - before.breakdown.discoveries;
  const reflectionPoints = reflected.points - after.points;
  const completionPoints = after.points - before.points;
  const parts = [];
  if (missionPoints) parts.push(`${missionPoints} for finishing the story`);
  if (discoveryPoints) parts.push(`${discoveryPoints} for new ideas`);
  if (reflectionPoints) parts.push(`${reflectionPoints} for the picture question`);
  return {
    missionPoints, discoveryPoints, reflectionPoints, completionPoints,
    totalPoints: completionPoints + reflectionPoints, replay,
    label: completionPoints ? `Finish this story: +${completionPoints} Sparks` : 'Play this story again',
    detail: parts.length ? `${parts.join(' + ')}.` : 'You earned these Sparks already. Enjoy another go!'
  };
}
