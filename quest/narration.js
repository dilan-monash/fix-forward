// Recorded storytelling first, device speech for words without an exact recording.
// Both paths share visible Pause/Resume/Stop controls and navigation cleanup.
// No microphone, model download, voice account, or child data is used at runtime.
// app.js supplies the visible words and renders onChange snapshots; this module
// controls audio only and never reads or changes a child's score or progress.
import { storyAudioFor } from './story-audio.js';

const UNAVAILABLE = 'The voice is not available here. You can still read the words.';
const FAILED = 'The voice could not read that. The words are still here.';

/** Create a speech controller with injectable browser APIs and an optional UI listener. */
export function createNarration({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, Audio = globalThis.Audio, findRecording = storyAudioFor, onChange = () => {} } = {}) {
  const speechAvailable = Boolean(synth && typeof synth.speak === 'function' && typeof synth.cancel === 'function' && typeof Utterance === 'function');
  const audioAvailable = typeof Audio === 'function';
  const available = speechAvailable || audioAvailable;
  let status = available ? 'idle' : 'unavailable';
  let message = available ? '' : UNAVAILABLE;
  let active = null;
  let source = null;
  let intent = 'speaking';
  let generation = 0;
  let mediaRequest = 0;
  let disposed = false;

  // Return a fresh UI snapshot; Pause needs both pause and resume to avoid stranding speech.
  function getState() {
    const canControl = source === 'recording' ? typeof active?.pause === 'function' && typeof active?.play === 'function' : typeof synth?.pause === 'function' && typeof synth?.resume === 'function';
    return { status, message, source, canPause: Boolean(active && status === 'speaking' && canControl), canResume: Boolean(active && status === 'paused' && canControl), canStop: Boolean(active && ['speaking', 'paused'].includes(status)) };
  }

  // Notify controls without letting a removed or failing UI listener break speech cleanup.
  function update(nextStatus, nextMessage = '') {
    status = nextStatus;
    message = nextMessage;
    if (!disposed) { try { onChange(getState()); } catch { /* Speech remains independently controllable. */ } }
  }

  // Invalidate callbacks before cancelling: some browsers dispatch cancellation synchronously.
  function cancelActive() {
    generation += 1;
    mediaRequest += 1;
    const previous = active;
    const previousSource = source;
    if (active) for (const name of ['onstart', 'onend', 'onerror', 'onpause', 'onresume', 'onplaying', 'onended']) active[name] = null;
    active = null;
    source = null;
    intent = 'speaking';
    // Release a cancelled recording before changing pages. Removing src prevents
    // a late media download from continuing after the user presses Stop.
    if (previousSource === 'recording') {
      try { previous.pause(); previous.removeAttribute?.('src'); previous.load?.(); } catch { /* Media cleanup cannot block a game action. */ }
    }
    try { synth?.cancel?.(); } catch { /* An unavailable speech service must not block navigation. */ }
  }

  // Prefer an English voice on the device. An empty/late voice list still permits
  // the browser default; speak() reports actual service failures through onerror.
  function preferredVoice() {
    let voices = [];
    try { voices = synth.getVoices?.() || []; } catch { return null; }
    if (!Array.isArray(voices)) return null;
    return voices.find(voice => voice.lang === 'en-AU' && voice.localService)
      || voices.find(voice => /^en(?:-|$)/i.test(voice.lang || '') && voice.localService)
      || voices.find(voice => /^en(?:-|$)/i.test(voice.lang || '')) || null;
  }

  // Start only explicitly supplied visible words. Replacing speech stops its old
  // callbacks from changing the new message's controls or announcing stale errors.
  function speak(text, { useRecording = true } = {}) {
    if (disposed) return false;
    cancelActive();
    if (!available) { update('unavailable', UNAVAILABLE); return false; }
    if (typeof text !== 'string' || !text.trim()) { update('idle'); return false; }
    const ticket = generation;
    // Matching is exact after whitespace/quote normalization. If an author edits
    // a fact, an outdated recording can never silently read the previous answer.
    let recording = null;
    try { if (useRecording && audioAvailable) recording = findRecording(text); } catch { /* A missing manifest must leave device speech usable. */ }
    if (recording?.src) return speakRecording(text, recording, ticket);
    if (!speechAvailable) { update('unavailable', UNAVAILABLE); return false; }
    try {
      // Cancelling a paused queue does not unpause it in every browser. Resume
      // only after cancellation and only for this explicit new reading request.
      if (synth.paused === true && typeof synth.resume === 'function') synth.resume();
      const utterance = new Utterance(text.trim());
      active = utterance;
      source = 'device';
      utterance.lang = 'en-AU';
      utterance.rate = .85;
      const voice = preferredVoice();
      if (voice) utterance.voice = voice;
      // Test the ticket as well as identity: stopped events can arrive after a new utterance begins.
      const isCurrent = () => !disposed && generation === ticket && active === utterance;
      utterance.onstart = () => { if (isCurrent() && intent === 'speaking') update('speaking'); };
      utterance.onpause = () => { if (isCurrent() && intent === 'paused') update('paused', 'Reading paused.'); };
      utterance.onresume = () => { if (isCurrent() && intent === 'speaking') update('speaking'); };
      utterance.onend = () => { if (isCurrent()) { active = null; source = null; update('idle'); } };
      utterance.onerror = event => {
        if (!isCurrent()) return;
        active = null;
        source = null;
        const reason = event?.error;
        // Our own Stop already invalidates its callbacks. A current cancellation
        // therefore came from the speech service and needs a visible retry message.
        if (['canceled', 'interrupted'].includes(reason)) update('error', 'The voice stopped. Tap Hear it to try again.');
        else if (['voice-unavailable', 'language-unavailable', 'synthesis-unavailable'].includes(reason)) update('unavailable', UNAVAILABLE);
        else update('error', FAILED);
      };
      update('speaking');
      // A UI listener can navigate away during its update; do not start speech after that stop.
      if (!isCurrent()) return false;
      synth.speak(utterance);
      return true;
    } catch {
      if (generation === ticket) { cancelActive(); update('error', FAILED); }
      return false;
    }
  }

  // Play one small same-origin MP3 from the explicit Hear request. Promise and
  // event callbacks share a ticket, so late failures cannot resurrect old audio.
  function speakRecording(text, recording, ticket) {
    let audio;
    try { audio = new Audio(recording.src); } catch { return speak(text, { useRecording: false }); }
    active = audio;
    source = 'recording';
    audio.preload = 'none';
    const isCurrent = () => !disposed && generation === ticket && active === audio;
    const failed = error => {
      if (!isCurrent()) return;
      // An autoplay rejection needs another user gesture. It must not start a
      // different voice later without a tap, especially after Pause or Stop.
      if (error?.name === 'NotAllowedError' || intent === 'paused') {
        cancelActive(); update('error', 'Tap Hear it to start the story voice.');
      } else if (speechAvailable) {
        speak(text, { useRecording: false });
      } else {
        cancelActive(); update('error', FAILED);
      }
    };
    audio.onplaying = () => {
      if (!isCurrent()) return;
      if (intent === 'paused') { try { audio.pause(); } catch { /* Keep the pause intent. */ } }
      else update('speaking');
    };
    audio.onpause = () => {
      if (!isCurrent() || audio.ended === true) return;
      // A tablet can pause media during an interruption outside our own button.
      // Trust the actual paused flag, so a delayed old pause event cannot undo
      // a newer Resume. An interrupted story should offer Resume, not appear to play.
      if (intent !== 'paused' && audio.paused === true) { intent = 'paused'; mediaRequest += 1; }
      if (intent === 'paused') update('paused', 'Story paused.');
    };
    audio.onended = () => { if (isCurrent()) { active = null; source = null; update('idle'); } };
    audio.onerror = failed;
    const requestBeforeNotice = mediaRequest;
    update('speaking');
    if (!isCurrent()) return false;
    // A UI listener may pause or even resume during its state notification.
    // Respect that newer instruction instead of starting a second play request.
    if (intent === 'paused' || mediaRequest !== requestBeforeNotice) return true;
    try {
      const request = ++mediaRequest;
      const pending = audio.play();
      pending?.then?.(() => { if (isCurrent() && mediaRequest === request && intent === 'paused') { try { audio.pause(); } catch (error) { failed(error); } } }, error => { if (mediaRequest === request) failed(error); });
      return true;
    } catch (error) { failed(error); return false; }
  }

  // Pause the current message without losing its position; unavailable controls stay disabled.
  function pause() {
    if (disposed || !getState().canPause) return false;
    const ticket = generation;
    const reading = active;
    intent = 'paused';
    try {
      if (source === 'recording') {
        // Pausing while a clip loads rejects its old play() promise in browsers.
        // Invalidate that request first so an intentional Pause remains resumable.
        mediaRequest += 1;
        active.pause();
      }
      else synth.pause();
      // A native call may finish or cancel the reading synchronously.
      if (generation !== ticket || active !== reading || disposed) return false;
      update('paused', source === 'recording' ? 'Story paused.' : 'Reading paused.');
      return true;
    } catch {
      if (generation === ticket) { cancelActive(); update('error', FAILED); }
      return false;
    }
  }

  // Continue the same paused message instead of starting a second utterance.
  function resume() {
    if (disposed || !getState().canResume) return false;
    const ticket = generation;
    const reading = active;
    intent = 'speaking';
    try {
      if (source === 'recording') {
        // Resume the same media element and playhead. A failed resume leaves a
        // visible retry message; it never creates a second recording.
        const request = ++mediaRequest;
        const pending = active.play();
        pending?.then?.(() => { if (generation === ticket && active === reading && mediaRequest === request && intent === 'paused') { try { reading.pause(); } catch { cancelActive(); update('error', FAILED); } } }, () => {
          if (generation === ticket && active === reading && mediaRequest === request && !disposed) { cancelActive(); update('error', 'Tap Hear it to start the story voice.'); }
        });
      } else synth.resume();
      if (generation !== ticket || active !== reading || disposed) return false;
      update('speaking');
      return true;
    } catch {
      if (generation === ticket) { cancelActive(); update('error', FAILED); }
      return false;
    }
  }

  // Stop is safe during navigation, a modal close, or a settings change.
  function stop() {
    if (disposed) return false;
    cancelActive();
    update(available ? 'idle' : 'unavailable', available ? '' : UNAVAILABLE);
    return true;
  }

  // Dispose cancels quietly and prevents all later callbacks or method calls from restarting speech.
  function dispose() {
    disposed = true;
    cancelActive();
    status = 'idle';
    message = '';
  }

  return { speak, pause, resume, stop, getState, dispose };
}
