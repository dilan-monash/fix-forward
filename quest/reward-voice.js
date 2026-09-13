// Tiny, authored cheers give a successful move a voice without reading the whole
// screen. These exact words have packaged recordings, made locally with Kokoro.
// No model, microphone or paid speech service runs in a child's browser.
import { storyAudioFor } from './story-audio.js';

// Praise noticing and thinking rather than speed or being the "smartest" child.
// Replays have their own cheer: spoken feedback never promises unearned Sparks.
export const REWARD_LINES = Object.freeze({
  clue: Object.freeze([
    'Aha! You found the clue. Great detective!',
    'You spotted it! That clue can help your choice.'
  ]),
  sorting: Object.freeze([
    'Hooray! You found its place. Great thinking!',
    'You did it! You used the clue. Nicely done!'
  ]),
  mission: Object.freeze([
    'Hooray! You did it! What a great thinker!',
    'Amazing thinking! You helped the story find its ending!'
  ]),
  reflection: Object.freeze(['You found the clue that mattered! Great thinking!']),
  round: Object.freeze(['Hooray! Sorting mission complete. Give yourself a cheer!']),
  plan: Object.freeze(["That plan fits the clues! You're ready for the next step."]),
  replay: Object.freeze(['You did it again! Your clever thinking is getting stronger!'])
});

// A stable seed (for example the card ID plus completed-round number) varies the
// short cheer across activities without storing another counter or touching XP.
export function rewardVoiceLine({ kind = 'mission', replay = false, seed = '' } = {}) {
  const selected = replay ? 'replay' : kind;
  if (!Object.hasOwn(REWARD_LINES, selected)) return null;
  const lines = REWARD_LINES[selected];
  let variation = 0;
  for (const character of String(seed)) variation = (variation * 31 + character.codePointAt(0)) >>> 0;
  return lines[variation % lines.length];
}

/**
 * Reuse app.js's speakText channel, so a cheer replaces previous speech and uses
 * the same visible transcript, Pause, Resume and Stop controls. There is no second
 * audio player or delayed queue that could speak after navigation or Sound off.
 * The caller invokes play directly from a successful user action, never render().
 */
export function createRewardVoice({ speak, isEnabled = () => false, findRecording = storyAudioFor } = {}) {
  function play(options = {}) {
    try {
      // Read the preference on every action: muting cannot leave a stale enabled
      // flag behind. Missing media stays silent rather than switching to a robot
      // voice or retrying later without the child's next deliberate action.
      if (typeof speak !== 'function' || !isEnabled()) return false;
      const text = rewardVoiceLine(options);
      if (!text || !findRecording(text)?.src) return false;
      return speak(text) !== false;
    } catch { return false; /* An unavailable voice must never prevent a win. */ }
  }
  return { play };
}
