// Check intent and failure handling without a physical motor or browser access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHaptics } from '../quest/haptics.js';

test('only requested touch feedback reaches a supported device, with brief distinct pulses', () => {
  const requests = [];
  const navigator = { maxTouchPoints: 5, vibrate(pattern) { assert.equal(this, navigator); requests.push(pattern); return true; } };
  const haptics = createHaptics({ navigator });
  assert.deepEqual(requests, [], 'constructing the controller never vibrates');
  for (const pointerType of ['mouse', 'pen', undefined, 'keyboard']) assert.equal(haptics.play('lift', { pointerType }), false);
  assert.equal(haptics.play('unknown', { pointerType: 'touch' }), false);
  for (const kind of ['lift', 'correct', 'retry']) assert.equal(haptics.play(kind, { pointerType: 'touch' }), true);
  assert.deepEqual(requests, [[8], [10, 35, 14], [8, 45, 8]]);
  assert.ok(requests.every(pattern => pattern.filter((_, index) => index % 2 === 0).reduce((sum, value) => sum + value, 0) < 30));
  haptics.stop();
  assert.equal(requests.at(-1), 0);
});

test('the latest Touch feedback choice is separate from sound, and disposal cannot restart a pulse', () => {
  const requests = [];
  const settings = { sound: false, haptics: true };
  const haptics = createHaptics({ navigator: { maxTouchPoints: 1, vibrate: value => { requests.push(value); return true; } }, isEnabled: () => settings.haptics });
  assert.equal(haptics.play('correct', { pointerType: 'touch' }), true, 'quiet-room play can still feel touch feedback');
  settings.haptics = false;
  haptics.stop();
  assert.equal(haptics.play('lift', { pointerType: 'touch' }), false);
  assert.equal(requests.length, 2);
  settings.haptics = true;
  haptics.dispose();
  assert.equal(haptics.play('correct', { pointerType: 'touch' }), false);
  assert.equal(requests.length, 2);
});

test('missing APIs, non-touch devices, denied requests and exceptions leave the game usable', () => {
  for (const navigator of [null, {}, { maxTouchPoints: 0, vibrate() { throw new Error('must not call'); } }, { maxTouchPoints: 1, vibrate: () => false }, { maxTouchPoints: 1, vibrate() { throw new Error('blocked'); } }]) {
    const haptics = createHaptics({ navigator });
    assert.equal(haptics.play('retry', { pointerType: 'touch' }), false);
    assert.doesNotThrow(() => haptics.stop());
    assert.doesNotThrow(() => haptics.dispose());
  }
});
