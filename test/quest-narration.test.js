// Speech tests use an injected service: no operating-system voice, timer or
// network is involved. Delayed callbacks model browser cancellation races.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createNarration } from '../quest/narration.js';
import { normalizeStoryText, storyAudioFor, STORY_LINES } from '../quest/story-audio.js';
import { STORY_RECORDINGS } from '../quest/audio/story-manifest.js';
import { MISSIONS, SORT_ITEMS } from '../quest/content.js';
import { planFeedback } from '../quest/feedback.js';
import { REWARD_LINES } from '../quest/reward-voice.js';

// Capture the words and native callback properties assigned by the controller.
class Utterance {
  constructor(text) { this.text = text; }
}

// Model a speech service whose paused flag survives cancel, as it can in browsers.
function speechFixture(overrides = {}) {
  const utterances = [];
  const updates = [];
  const synth = {
    paused: false, cancels: 0, pauses: 0, resumes: 0,
    // These operations track what the browser would be asked to do.
    speak(utterance) { utterances.push(utterance); },
    cancel() { this.cancels += 1; },
    pause() { this.pauses += 1; this.paused = true; },
    resume() { this.resumes += 1; this.paused = false; },
    getVoices() { return []; },
    ...overrides
  };
  const controller = createNarration({ synth, Utterance, onChange: state => updates.push(state) });
  return { synth, utterances, updates, controller };
}

test('speech starts only on request and exposes Pause, Resume and Stop for the same message', () => {
  const { synth, utterances, controller } = speechFixture();
  assert.equal(utterances.length, 0);
  assert.equal(synth.cancels, 0);
  assert.equal(controller.getState().status, 'idle');
  assert.equal(controller.speak('A clue is useful.'), true);
  assert.equal(controller.getState().canPause, true);
  assert.equal(controller.getState().canStop, true);
  controller.pause();
  assert.equal(controller.getState().status, 'paused');
  assert.equal(controller.getState().canResume, true);
  controller.resume();
  assert.equal(controller.getState().status, 'speaking');
  assert.equal(utterances.length, 1, 'resume does not read the message again');
  controller.stop();
  assert.equal(controller.getState().status, 'idle');
  assert.equal(controller.getState().canStop, false);
});

test('old completion/error callbacks cannot stop a new reading or announce a stale failure', () => {
  const { utterances, updates, controller } = speechFixture();
  controller.speak('First scene');
  const oldEnd = utterances[0].onend;
  const oldError = utterances[0].onerror;
  controller.speak('Second scene');
  const count = updates.length;
  oldEnd();
  oldError({ error: 'network' });
  assert.equal(updates.length, count);
  assert.equal(controller.getState().status, 'speaking');
  utterances[1].onend();
  assert.equal(controller.getState().status, 'idle');
});

test('navigation stop invalidates late callbacks and new Hear recovers a paused speech queue', () => {
  const { synth, utterances, controller } = speechFixture();
  controller.speak('Old clue');
  const oldPause = utterances[0].onpause;
  controller.pause();
  controller.stop();
  oldPause();
  assert.equal(controller.getState().status, 'idle');
  controller.speak('New clue');
  assert.equal(synth.paused, false, 'a cancelled paused queue must not strand the new reading');
  assert.equal(controller.getState().status, 'speaking');
});

test('unavailable APIs and browser speech errors leave visible-word fallback and usable controls', () => {
  const unavailable = createNarration({ synth: null, Utterance: null });
  assert.equal(unavailable.speak('Visible words'), false);
  assert.equal(unavailable.getState().status, 'unavailable');
  assert.match(unavailable.getState().message, /still read/);
  const { utterances, controller } = speechFixture();
  controller.speak('Words');
  utterances[0].onerror({ error: 'voice-unavailable' });
  assert.equal(controller.getState().status, 'unavailable');
  controller.speak('Try again');
  utterances[1].onerror({ error: 'network' });
  assert.equal(controller.getState().status, 'error');
  assert.equal(controller.getState().canStop, false);
  controller.speak('One more try');
  assert.equal(controller.getState().status, 'speaking');
});

test('empty or late voice lists use browser default, then prefer local English on the next request', () => {
  const { synth, utterances, controller } = speechFixture();
  controller.speak('Default voice');
  assert.equal(utterances[0].voice, undefined);
  const local = { lang: 'en-AU', localService: true };
  synth.getVoices = () => [{ lang: 'en-AU', localService: false }, { lang: 'fr-FR', localService: true }, local];
  controller.speak('Local voice');
  assert.equal(utterances[1].voice, local);
  assert.equal(utterances[1].rate, .85);
});

test('missing Pause/Resume methods do not strand speech, and service exceptions are recoverable', () => {
  const simple = speechFixture({ pause: undefined, resume: undefined });
  simple.controller.speak('Words');
  assert.equal(simple.controller.getState().canPause, false);
  assert.equal(simple.controller.pause(), false);
  assert.equal(simple.controller.getState().canStop, true);
  const broken = speechFixture({ speak() { throw new Error('service unavailable'); } });
  assert.equal(broken.controller.speak('Words'), false);
  assert.equal(broken.controller.getState().status, 'error');
  const brokenPause = speechFixture({ pause() { throw new Error('cannot pause'); } });
  brokenPause.controller.speak('Words');
  assert.equal(brokenPause.controller.pause(), false);
  assert.equal(brokenPause.controller.getState().status, 'error');
});

test('synchronous end while pausing stays ended and delayed pause cannot override a newer Resume', () => {
  const first = speechFixture();
  first.controller.speak('Nearly finished');
  first.synth.pause = () => first.utterances[0].onend();
  first.controller.pause();
  assert.equal(first.controller.getState().status, 'idle');
  const second = speechFixture();
  second.controller.speak('Longer words');
  second.controller.pause();
  second.controller.resume();
  second.utterances[0].onpause();
  assert.equal(second.controller.getState().status, 'speaking');
});

test('UI-triggered cancellation cannot queue speech afterwards, and disposal is final', () => {
  const fixture = speechFixture();
  let controller;
  controller = createNarration({ synth: fixture.synth, Utterance, onChange: state => { if (state.status === 'speaking') controller.stop(); } });
  controller.speak('Cancelled during UI update');
  assert.equal(fixture.utterances.length, 0);
  const normal = speechFixture();
  normal.controller.speak('Words');
  const end = normal.utterances[0].onend;
  const count = normal.updates.length;
  normal.controller.dispose();
  end();
  assert.equal(normal.updates.length, count);
  assert.equal(normal.controller.speak('Cannot restart'), false);
  assert.equal(normal.controller.getState().status, 'idle');
});

test('unexpected cancellation of the current reading shows retry feedback, while intentional Stop stays quiet', () => {
  const { utterances, updates, controller } = speechFixture();
  for (const error of ['canceled', 'interrupted']) {
    controller.speak('A fact to hear');
    utterances.at(-1).onerror({ error });
    assert.equal(controller.getState().status, 'error');
    assert.equal(controller.getState().message, 'The voice stopped. Tap Hear it to try again.');
    assert.equal(controller.getState().canPause, false);
    assert.equal(controller.getState().canResume, false);
    assert.equal(controller.getState().canStop, false);
  }
  controller.speak('An intentional stop');
  const cancelledCallback = utterances.at(-1).onerror;
  controller.stop();
  const count = updates.length;
  cancelledCallback({ error: 'canceled' });
  assert.equal(updates.length, count);
  assert.equal(controller.getState().status, 'idle');
  assert.equal(controller.getState().message, '');
});

// An injected media element exercises real playback races without playing sounds
// in the test runner. Resolve/reject let a test mimic delayed browser play promises.
function recordingFixture() {
  const media = [];
  class Audio {
    constructor(src) { this.src = src; this.currentTime = 0; this.plays = 0; this.pauses = 0; this.loads = 0; this.paused = true; media.push(this); }
    play() { this.plays += 1; this.paused = false; return new Promise((resolve, reject) => { this.resolvePlay = resolve; this.rejectPlay = reject; }); }
    pause() { this.pauses += 1; this.paused = true; this.onpause?.(); }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() { this.loads += 1; }
  }
  const device = speechFixture();
  const controller = createNarration({ synth: device.synth, Utterance, Audio, findRecording: text => text === 'A recorded story.' ? { src: '/quest/audio/example.mp3' } : null });
  return { media, controller, device, Audio };
}

test('recorded storytelling starts only on request and resumes the same playhead', async () => {
  const { media, controller, device } = recordingFixture();
  assert.equal(media.length, 0, 'construction must not fetch or play a clip');
  assert.equal(controller.speak('A recorded story.'), true);
  assert.equal(controller.getState().source, 'recording');
  assert.equal(media[0].preload, 'none');
  assert.equal(device.utterances.length, 0);
  media[0].currentTime = 2.1;
  controller.pause();
  assert.equal(controller.getState().status, 'paused');
  media[0].resolvePlay();
  await Promise.resolve();
  assert.equal(controller.getState().status, 'paused', 'a late play resolution respects Pause');
  controller.resume();
  assert.equal(media.length, 1);
  assert.equal(media[0].currentTime, 2.1);
  assert.equal(controller.getState().canPause, true);
  media[0].onended();
  assert.equal(controller.getState().status, 'idle');
});

test('stopping a recording cancels download and stale callbacks cannot restart or replace it', async () => {
  const { media, controller, device } = recordingFixture();
  controller.speak('A recorded story.');
  const oldError = media[0].onerror;
  const oldEnd = media[0].onended;
  const oldPlaying = media[0].onplaying;
  controller.stop();
  assert.equal(media[0].src, '');
  assert.equal(media[0].loads, 1);
  controller.speak('A new device reading.');
  oldError(); oldEnd(); oldPlaying();
  media[0].rejectPlay(new Error('late download failure'));
  await Promise.resolve();
  assert.equal(controller.getState().source, 'device');
  assert.equal(device.utterances.length, 1);
});

test('Pause during loading ignores its aborted play promise and Resume ignores the older request', async () => {
  const { media, controller, device } = recordingFixture();
  controller.speak('A recorded story.');
  const rejectedInitialPlay = media[0].rejectPlay;
  controller.pause();
  rejectedInitialPlay({ name: 'AbortError' });
  await Promise.resolve();
  assert.equal(controller.getState().status, 'paused');
  assert.equal(controller.getState().canResume, true);
  controller.resume();
  const rejectedResume = media[0].rejectPlay;
  controller.pause();
  controller.resume();
  rejectedResume({ name: 'AbortError' });
  await Promise.resolve();
  assert.equal(controller.getState().status, 'speaking');
  assert.equal(controller.getState().source, 'recording');
  assert.equal(device.utterances.length, 0);
  assert.equal(media.length, 1, 'Pause and Resume keep one clip');
});

test('a UI listener can cancel a recording before play begins', () => {
  const fixture = recordingFixture();
  let controller;
  controller = createNarration({ Audio: fixture.Audio, findRecording: () => ({ src: '/quest/audio/example.mp3' }), onChange: state => { if (state.status === 'speaking') controller.stop(); } });
  controller.speak('An immediately closed scene');
  assert.equal(fixture.media[0].plays, 0);
  assert.equal(fixture.media[0].src, '');
  assert.equal(controller.getState().status, 'idle');
});

test('tablet media interruptions offer Resume and stale pause events do not undo it', () => {
  const { media, controller } = recordingFixture();
  controller.speak('A recorded story.');
  const audio = media[0];
  audio.paused = true;
  audio.onpause();
  assert.equal(controller.getState().status, 'paused');
  assert.equal(controller.getState().canResume, true);
  controller.resume();
  audio.onpause();
  assert.equal(controller.getState().status, 'speaking', 'the actual media state disproves a delayed old pause event');
});

test('a UI listener can pause before playback starts and Resume starts it exactly once', () => {
  const fixture = recordingFixture();
  let controller;
  let pauseOnce = true;
  controller = createNarration({ Audio: fixture.Audio, findRecording: () => ({ src: '/quest/audio/example.mp3' }), onChange: state => {
    if (pauseOnce && state.status === 'speaking') { pauseOnce = false; controller.pause(); }
  } });
  assert.equal(controller.speak('A loading story'), true);
  assert.equal(fixture.media[0].plays, 0);
  assert.equal(controller.getState().status, 'paused');
  controller.resume();
  assert.equal(fixture.media[0].plays, 1);
  assert.equal(controller.getState().status, 'speaking');
});

test('a missing clip falls back to exact device words once, but autoplay rejection asks for a tap', async () => {
  const normal = recordingFixture();
  normal.controller.speak('A recorded story.');
  normal.media[0].onerror(new Error('missing audio file'));
  assert.equal(normal.device.utterances[0].text, 'A recorded story.');
  assert.equal(normal.controller.getState().source, 'device');
  normal.media[0].rejectPlay(new Error('same request also rejected'));
  await Promise.resolve();
  assert.equal(normal.device.utterances.length, 1, 'event plus rejection cannot queue duplicate fallback');
  const blocked = recordingFixture();
  blocked.controller.speak('A recorded story.');
  blocked.media[0].rejectPlay({ name: 'NotAllowedError' });
  await Promise.resolve();
  assert.equal(blocked.device.utterances.length, 0);
  assert.equal(blocked.controller.getState().status, 'error');
  assert.match(blocked.controller.getState().message, /Tap Hear/);
});

test('a paused or disposed recording cannot unexpectedly fall back to another voice', async () => {
  const paused = recordingFixture();
  paused.controller.speak('A recorded story.');
  paused.controller.pause();
  paused.media[0].onerror(new Error('download failed while paused'));
  assert.equal(paused.device.utterances.length, 0);
  assert.equal(paused.controller.getState().status, 'error');
  const disposed = recordingFixture();
  disposed.controller.speak('A recorded story.');
  disposed.controller.dispose();
  disposed.media[0].rejectPlay(new Error('download failed after navigation'));
  await Promise.resolve();
  assert.equal(disposed.device.utterances.length, 0);
  assert.equal(disposed.controller.speak('A recorded story.'), false);
});

test('recorded speech works without device synthesis and unrecorded words remain visible', () => {
  const fixture = recordingFixture();
  const controller = createNarration({ synth: null, Utterance: null, Audio: fixture.Audio, findRecording: text => text === 'Recorded' ? { src: '/quest/audio/example.mp3' } : null });
  assert.equal(controller.speak('Recorded'), true);
  assert.equal(controller.getState().canPause, true);
  controller.stop();
  assert.equal(controller.speak('No clip exists for these words'), false);
  assert.equal(controller.getState().status, 'unavailable');
  assert.match(controller.getState().message, /still read/);
});

test('recorded text lookup normalizes typography without fuzzy-matching different facts', () => {
  assert.equal(normalizeStoryText('  Let’s\n look!  '), "Let's look!");
  assert.equal(normalizeStoryText(null), '');
  assert.equal(storyAudioFor('This is a made-up fact which has no recording.'), null);
  const greeting = storyAudioFor(STORY_LINES.home);
  assert.ok(greeting, 'the authored greeting has a generated recording');
  assert.match(greeting.src, /^\/quest\/audio\/[a-f0-9]{16}\.mp3$/);
  assert.equal(storyAudioFor(STORY_LINES.home.replace('toaster', 'kettle')), null, 'changing even one meaningful word invalidates the recording');
});

test('every packaged story recording is a valid MP3 linked to exact current authored words', async () => {
  // Build the permitted transcript bank independently from the manifest. This
  // catches stale safety facts if content changes without regenerating audio.
  const texts = [...Object.values(STORY_LINES), ...Object.values(REWARD_LINES).flat()];
  for (const mission of MISSIONS) {
    texts.push(`${mission.fictionalContext} ${mission.guideLines.intro}`, ...Object.values(mission.guideLines), ...mission.clues.map(clue => clue.text), mission.reflection.prompt, mission.reflection.explanation, mission.outcome.text, mission.helpText, ...mission.allowedActions.map(action => action.feedback));
    if (mission.slots.length === 2) for (const first of mission.allowedActions) for (const second of mission.allowedActions) {
      const result = planFeedback(mission, { [mission.slots[0].id]: first.id, [mission.slots[1].id]: second.id });
      if (!result.correct) texts.push(`${result.summary} ${result.slots.map(row => `${row.label}. ${row.message}`).join(' ')}`);
    }
  }
  for (const item of SORT_ITEMS) texts.push(item.condition, item.clue, item.explanation);
  const currentWords = new Set(texts.map(normalizeStoryText));
  const seen = new Set();
  for (const recording of STORY_RECORDINGS) {
    const text = normalizeStoryText(recording.text);
    assert.ok(currentWords.has(text), `stale or unreviewed transcript: ${recording.id}`);
    assert.equal(recording.id, createHash('sha256').update(text).digest('hex').slice(0, 16));
    assert.equal(seen.has(text), false, 'identical words must not ship duplicate recordings');
    seen.add(text);
    assert.equal(recording.src, `/quest/audio/${recording.id}.mp3`);
    const bytes = await fs.readFile(new URL(`../quest/audio/${recording.id}.mp3`, import.meta.url));
    assert.ok(bytes.length > 4000 && bytes.length < 300000, 'clips are short, nonempty tablet-sized files');
    // Our encoder writes MPEG-2 Layer III frames at 24 kHz and 64 kbps, without
    // an ID3 prefix. Parse every frame rather than trusting the .mp3 extension.
    let offset = 0;
    let frames = 0;
    while (offset < bytes.length) {
      assert.equal(bytes[offset], 0xff, `invalid MP3 sync: ${recording.id}`);
      assert.equal(bytes[offset + 1] & 0xfe, 0xf2, 'MPEG-2 Layer III');
      assert.equal(bytes[offset + 2] >> 4, 8, '64 kbps');
      assert.equal((bytes[offset + 2] >> 2) & 3, 1, '24 kHz');
      offset += 192 + ((bytes[offset + 2] >> 1) & 1);
      frames += 1;
    }
    assert.equal(offset, bytes.length, 'no partial or corrupt trailing frame');
    assert.ok(Math.abs(frames * 576 / 24000 - recording.seconds) < 0.2, 'encoded duration matches the generated waveform');
  }
  // The shipped bank covers every fixed story line, not just whichever clips
  // happened to finish generation. New authored words need reviewed audio too.
  assert.deepEqual([...currentWords].filter(text => !seen.has(text)), [], 'regenerate the story pack for missing authored transcripts');
});
