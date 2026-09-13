/**
 * Read-only reward calculations shared by the game UI and engine. Sparks and
 * levels are derived from unique authored progress IDs, never separately saved.
 * Help and retries have no penalty; replaying a story cannot earn its points twice.
 * These rewards describe on-device play, not environmental impact or an assessment.
 */
import { MISSIONS, CONCEPTS } from './content.js';

// Fixed values for one finished story, one new idea and one correct story reflection.
export const SPARK_VALUES = Object.freeze({ mission: 20, discovery: 5, reflection: 10 });
// Thresholds must stay in ascending order; the UI displays these same names and levels.
export const LEVELS = Object.freeze([
  Object.freeze({ level: 1, threshold: 0, title: 'Clue Scout' }),
  Object.freeze({ level: 2, threshold: 60, title: 'Story Solver' }),
  Object.freeze({ level: 3, threshold: 140, title: 'Next-Chapter Maker' }),
  Object.freeze({ level: 4, threshold: 240, title: 'Quest Guide' })
]);
// Reject arrays/null where callers are expected to supply progress maps.
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Match an answer ID to an authored reflection option; unknown/missing input is false. */
export function isReflectionCorrect(mission, answerId) {
  const reflection = mission?.reflection;
  return typeof answerId === 'string' && typeof reflection?.correctId === 'string'
    && answerId === reflection.correctId && Array.isArray(reflection.options)
    && reflection.options.some(option => option?.id === answerId);
}

/**
 * Read state and return totals, the current level, and progress toward the next.
 * nextThreshold is null at the final level, where the meter remains full.
 * The breakdown contains point values, not counts of completed activities.
 */
export function progression(state) {
  const completed = isRecord(state?.completed) ? state.completed : {};
  const reflections = isRecord(state?.reflections) ? state.reflections : {};
  // Count known, well-shaped records only, even if the caller bypassed save hydration.
  const finished = MISSIONS.filter(mission => Object.hasOwn(completed, mission.id)
    && isRecord(completed[mission.id]) && typeof completed[mission.id].assisted === 'boolean');
  const discoveries = new Set(Array.isArray(state?.discoveries)
    ? state.discoveries.filter(id => CONCEPTS.some(concept => concept.id === id)) : []);
  const reflected = finished.filter(mission => Object.hasOwn(reflections, mission.id)
    && isReflectionCorrect(mission, reflections[mission.id]));
  // Assistance changes neither the value of a story nor its discovery. Replays
  // and repeated correct answers cannot create a second authored ID to count.
  const breakdown = {
    missions: finished.length * SPARK_VALUES.mission,
    discoveries: discoveries.size * SPARK_VALUES.discovery,
    reflections: reflected.length * SPARK_VALUES.reflection
  };
  const points = breakdown.missions + breakdown.discoveries + breakdown.reflections;
  const current = LEVELS.findLast(level => points >= level.threshold);
  // Levels are numbered from one, so the current level number indexes the next entry.
  const next = LEVELS[current.level];
  // Measure this level's interval rather than presenting total points as a percentage.
  const percent = next ? Math.max(0, Math.min(100, Math.round((points - current.threshold) / (next.threshold - current.threshold) * 100))) : 100;
  return {
    points, level: current.level, title: current.title,
    nextThreshold: next?.threshold ?? null,
    pointsRemaining: next ? next.threshold - points : 0,
    percent, withinLevelPercent: percent, breakdown
  };
}
