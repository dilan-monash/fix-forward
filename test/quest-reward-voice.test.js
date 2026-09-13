// These tests exercise mute choices, shared narration cleanup and packaged media.
// They use a fake speaker, so running the suite cannot play audio or use a network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REWARD_LINES, createRewardVoice, rewardVoiceLine } from '../quest/reward-voice.js';
import { storyAudioFor, STORY_LINES } from '../quest/story-audio.js';
import { createNarration } from '../quest/narration.js';

test('cheers start only on a successful requested action, and read the latest mute preference', () => {
  const spoken = [];
  let enabled = false;
  const voice = createRewardVoice({ speak: text => spoken.push(text), isEnabled: () => enabled });
  assert.deepEqual(spoken, [], 'constructing a controller must be quiet');
  assert.equal(voice.play({ kind: 'mission' }), false);
  enabled = true;
  assert.equal(voice.play({ kind: 'mission' }), true);
  assert.match(spoken[0], /Hooray/);
  enabled = false;
  assert.equal(voice.play({ kind: 'sorting' }), false);
  assert.equal(spoken.length, 1, 'Sound off cannot leave an enabled flag cached');
});

test('replay cheers never promise extra points, and unknown game actions remain silent', () => {
  for (const kind of ['sorting', 'mission', 'round']) {
    const line = rewardVoiceLine({ kind, replay: true });
    assert.match(line, /again/);
    assert.doesNotMatch(line, /Sparks|points|earned/);
  }
  assert.equal(rewardVoiceLine({ kind: 'not-a-success' }), null);
  assert.equal(rewardVoiceLine({ kind: '__proto__' }), null);
});

test('a stable activity seed varies the short phrase without storing score or progress', () => {
  assert.equal(rewardVoiceLine({ kind: 'clue', seed: 'fan' }), rewardVoiceLine({ kind: 'clue', seed: 'fan' }));
  assert.notEqual(rewardVoiceLine({ kind: 'clue', seed: 'a' }), rewardVoiceLine({ kind: 'clue', seed: 'b' }));
});

test('missing recordings and unavailable speakers fail quietly without a device-voice substitution', () => {
  let calls = 0;
  const missing = createRewardVoice({ speak: () => { calls += 1; }, isEnabled: () => true, findRecording: () => null });
  assert.equal(missing.play({ kind: 'sorting' }), false);
  assert.equal(calls, 0);
  assert.equal(createRewardVoice().play({ kind: 'mission' }), false);
  assert.equal(createRewardVoice({ speak: () => { throw new Error('No speaker'); }, isEnabled: () => true }).play(), false);
  assert.equal(createRewardVoice({ speak: () => false, isEnabled: () => true }).play(), false);
});

test('cheers use the same narration channel, replacing an old story and preserving Pause and Stop', () => {
  const players = [];
  class Audio {
    constructor(src) { this.src = src; this.pauseCount = 0; players.push(this); }
    play() { this.onplaying?.(); return Promise.resolve(); }
    pause() { this.pauseCount += 1; }
    removeAttribute() { this.src = ''; }
    load() {}
  }
  const narration = createNarration({ Audio, synth: null, Utterance: null });
  const voice = createRewardVoice({ speak: text => narration.speak(text), isEnabled: () => true });
  narration.speak(STORY_LINES.home);
  const oldEnd = players[0].onended;
  assert.equal(voice.play({ kind: 'mission' }), true);
  assert.equal(players.length, 2);
  assert.equal(players[0].pauseCount, 1, 'a cheer never overlaps the previous story');
  assert.equal(players[0].src, '', 'old recording resources are released');
  assert.equal(narration.getState().source, 'recording');
  oldEnd();
  assert.equal(narration.getState().status, 'speaking', 'late story completion cannot stop the cheer');
  narration.pause();
  assert.equal(narration.getState().canResume, true);
  narration.resume();
  assert.equal(players.length, 2, 'Resume uses the same cheer, rather than another player');
  narration.stop();
  assert.equal(players[1].src, '');
  assert.equal(narration.getState().status, 'idle');
});

test('all authored cheers have exact local recordings shorter than four seconds', () => {
  for (const text of Object.values(REWARD_LINES).flat()) {
    const recording = storyAudioFor(text);
    assert.ok(recording, `Missing recorded cheer: ${text}`);
    assert.match(recording.src, /^\/quest\/audio\/[a-f0-9]{16}\.mp3$/);
    assert.ok(recording.seconds > 0.5 && recording.seconds < 4, 'success feedback should be brief');
    const bytes = readFileSync(new URL(`../${recording.src.slice(1)}`, import.meta.url));
    assert.ok(bytes.length > 1000, 'a listed but empty clip must fail the build');
    assert.ok(bytes[0] === 0xff || bytes.toString('ascii', 0, 3) === 'ID3', 'the asset must be an MP3');
  }
});
