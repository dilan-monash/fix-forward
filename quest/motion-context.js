// Motion is a response to play, not a competing task while a child reads or
// reasons. This helper describes the current screen; it never changes the
// child's saved settings, sound preference, answers, score or navigation.
const READING_STATUSES = new Set(['speaking', 'paused', 'loading']);
const THINKING_STEPS = new Set(['explore', 'plan', 'feedback', 'retry']);

/** Return whether decorative movement should be quiet on this screen.
 * app.js passes the rendered view (including picker/postcard overlays), the
 * active mission step or sorting status, and the current narration status.
 * Correct-answer feedback can use step="reward": rewards and actual dragging
 * remain animated, while feedback that asks a child to reconsider stays still.
 * Pausing narration deliberately keeps the screen quiet until Stop or finish.
 */
export function getMotionContext({ view = 'home', step = '', narrationStatus = 'idle', pictureHelpOpen = false } = {}) {
  // Parent information is outside this child-only presentation policy.
  if (view === 'grownups' || view === 'parents') return false;
  if (pictureHelpOpen || READING_STATUSES.has(narrationStatus)) return true;
  if (view === 'book') return true;
  if (view === 'mission') return THINKING_STEPS.has(step);
  if (view === 'sorting') return ['playing', 'feedback', 'retry'].includes(step);
  return false;
}
