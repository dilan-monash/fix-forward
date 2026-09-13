// Storytelling is recorded once during development. A child's browser downloads
// only the short MP3 it needs, never a speech model or a paid voice service.
import { STORY_RECORDINGS } from './audio/story-manifest.js';

// Keep these invitations visible wherever they are played. They are intentionally
// short and conversational; safety facts remain exactly as authored in content.js.
export const STORY_LINES = Object.freeze({
  home: "Hello, teammate! Pip the toaster and Flo the fan have a story for you. Look for a clue. Choose what happens next. Ready? Let's go!",
  sorting: "Welcome to Sorting Station! Look at the picture and its story. Touch the item, then choose a place. You can drag it there, too. Take your time. A good question is a good move!",
  win: "You did it! That little clue made a big difference. Your clever thinking helped the story move forward!",
  retry: "Hmm, that clue tells us something different. Let's have another look. You can try again, and you keep your Sparks!",
  pictures: "Let's look closer. Each picture shows a fact from this story. The words tell you what it means. Which fact helps your choice?",
  planCheck: 'Does your plan fit the clue?',
  clueInvitation: 'A good clue can change the whole story. What did you spot?',
  // These are original fictional character lines spoken by the same synthetic
  // narrator. They do not imitate a named performer or clone anyone's voice.
  pipHello: "Pip here! I'm your toaster teammate. Little name, big ideas! Shall we find a clue together?",
  floHello: "Hello, I'm Flo the fan! Go with Flo, and follow the clues. I wonder what we'll discover today!",
});

// Normalize typography and whitespace only. Never fuzzy-match words: a recording
// with different safety facts must not be substituted after the content is edited.
export function normalizeStoryText(text) {
  return typeof text === 'string' ? text.normalize('NFC').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim() : '';
}
const recordingsByText = new Map(STORY_RECORDINGS.map(recording => [normalizeStoryText(recording.text), recording]));

// A missing exact recording returns null so narration.js can use the device's
// voice for new/dynamic text. No network request is made by this lookup.
export function storyAudioFor(text) {
  return recordingsByText.get(normalizeStoryText(text)) || null;
}
