// QUEST SCREEN CONTROLLER: loaded by quest/index.html as a native browser module.
// Read content.js for the story facts, engine.js for allowed changes, and
// progression.js for rewards. This file turns those results into visible screens.
// A typical click follows bind -> dispatch -> transition -> persist -> render.
// There is no Quest API request here. See docs/DEVELOPER_HANDOVER.md for the full map.
import { MISSIONS, SORT_ITEMS, CONCEPTS, SOURCES, LOCATIONS } from './content.js';
import { createState, transition, suggestedMission, hydrateState } from './engine.js';
import { loadProgress, saveProgress, clearProgress } from './storage.js';
import { bindDrag } from './drag.js';
import { artwork, neighborhood, scene, passportStamp, rewardBurst, levelBadge } from './art.js';
import { progression, LEVELS, isReflectionCorrect } from './progression.js';
import { postcard, postcardFilename, validThemes, validStickers } from './postcard.js';
import { renderParentGuide } from './parent-guide.js';
import { createNavigation, NAVIGATION_KEY } from './navigation.js';
import { createNarration } from './narration.js';
import { createRewardFx } from './reward-fx.js';
import { createGameSounds } from './sounds.js';
import { sceneClues, pictureHelp as renderPictureHelp, sortingPictureHelp } from './picture-help.js';
import { planFeedback, celebrationCopy, rewardPreview } from './feedback.js';
import { STORY_LINES } from './story-audio.js';
import { createRewardVoice } from './reward-voice.js';

// Stable elements come from quest/index.html. The main render replaces #quest-app
// contents; modal() updates the separate dialog body.
const app = document.querySelector('#quest-app');
const main = document.querySelector('#quest-main');
const hud = document.querySelector('#q-game-hud');
const dialog = document.querySelector('#q-dialog');
const dialogBody = document.querySelector('#q-dialog-body');
const announceNode = document.querySelector('#q-announcement');
// Restore a validated browser save once at startup. The engine supplies safe defaults.
const restored = loadProgress();
let state = restored.state;
// A fresh game link opens play. The parent guide has its own explicit URL.
if (state.view === 'grownups') state = { ...state, view: 'home' };
let storageAvailable = restored.status !== 'unavailable';
// Temporary display state below is intentionally not persisted: open panels, selected
// pictures, greeting counts and celebration banners are not learning records.
let dragCleanups = [];
let selectedAction = null;
let selectedDecoration = null;
let picker = null;
let openClueList = false;
let dialogReturn = null;
let dialogReturnSelector = null;
let postcardId = null;
let storyBefore = false;
let downloadUrl = null;
let lastReward = null;
let reflectionHint = null;
// Picture focus and a picked-up card are local presentation, not earned progress.
let pictureView = null;
let sortPicked = false;
let checkedPlan = null;
// Celebrations belong to this screen visit, never to the saved score or history.
let celebration = false;
let audioRequested = false;
let spokenWords = '';
let navigation = null;
let historyEpoch = Number.isSafeInteger(window.history?.state?.[NAVIGATION_KEY]?.route?.epoch) ? window.history.state[NAVIGATION_KEY].route.epoch : 0;
let demoTimer = null;
// Visual timers never own progress. A navigation settles the display immediately.
let hudFrame = null;
let feedbackTimer = null;
let hudAnimations = [];
let pendingHudProgress = null;
let touchRings = new Set();
const narration = createNarration({ synth: window.speechSynthesis, Utterance: window.SpeechSynthesisUtterance, Audio: window.Audio, onChange: updateAudio });
const sounds = createGameSounds({ AudioContext: window.AudioContext || window.webkitAudioContext, enabled: state.settings.sound, onChange: updateSound });
const rewardFx = createRewardFx({ document, reducedMotion: () => reduced() });
// Short recorded cheers share the story player's Pause/Stop and mute settings.
// If recorded media is unavailable, keep ordinary reading controls as the fallback.
const rewardVoice = createRewardVoice({ speak: speakText, isEnabled: () => Boolean(window.Audio) && (state.settings.sound || state.settings.narration) });
// Treat inserted text as text, not executable HTML. attr uses the same escaping for attributes.
const escape = (text) => String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const attr = escape;
const soundIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor" fill-opacity=".18"/><path d="M17 8q4 4 0 8m3-11q7 7 0 14"/></svg>';
// Small read-only lookups translate saved IDs into authored records and readable labels.
const mission = () => MISSIONS.find(item => item.id === state.activeMission?.id);
const concept = id => CONCEPTS.find(item => item.id === id);
const locationTitle = id => LOCATIONS.find(item => item.id === id)?.title || 'Adventure map';
// Follow the device by default. A deliberate Game animations choice can opt in;
// Less movement always keeps the same learning and rewards without flying art.
const reduced = () => state.settings.motion === 'reduce' || (state.settings.motion !== 'full' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
// Shared markup helper: text and data are trusted templates assembled by callers.
const button = (text, data, style = 'primary') => `<button class="q-button ${style}" ${data}>${text}</button>`;
// Put a short update in the polite live region so a screen reader hears feedback.
function announce(text) { announceNode.textContent = text; }
// Sound is an independent preference. Its button reports availability without
// claiming that an operating-system volume setting can be checked by this game.
function updateSound(status = sounds.getState()) {
  document.querySelectorAll('[data-game-sound]').forEach(control => {
    control.dataset.soundState = status.status;
    control.setAttribute('aria-pressed', String(status.enabled));
    control.querySelector('[data-sound-label]').textContent = status.enabled ? 'Sound on' : 'Sound off';
    control.title = status.status === 'locked' ? 'Sound is on. Tap a game button to start it.' : status.message;
  });
}
// This click is the explicit sound choice and browser audio-unlock gesture.
// Browser rejection leaves the game working and reports that sound is unavailable.
function toggleSound() {
  const enabled = !state.settings.sound;
  dispatch({ type: 'SET_SETTING', key: 'sound', value: enabled }, { focusTarget: null, speak: false });
  sounds.enable(enabled, { gesture: enabled }).then(() => {
    updateSound();
    if (enabled && state.settings.sound && !audioRequested) sounds.play('tap');
    announce(sounds.getState().message || (enabled ? 'Game sounds on.' : 'Game sounds off.'));
  });
  hud.querySelector('[data-game-sound]')?.focus({ preventScroll: true });
}
// One visible control pauses decorative motion or explicitly turns it back on.
// A fresh save still follows the device preference; choosing On is an opt-in.
function toggleMotion(forceOn = false) {
  // The home invitation always means On, even if the device preference changed
  // while it was visible. Ordinary HUD clicks toggle the current effective state.
  const enabled = forceOn === true || reduced();
  dispatch({ type: 'SET_SETTING', key: 'motion', value: enabled ? 'full' : 'reduce' }, { focusTarget: null, speak: false });
  announce(enabled ? 'Game animations on. Pip and Flo are ready!' : 'Animations paused. Your game and Sparks stay the same.');
  hud.querySelector('[data-game-motion]')?.focus({ preventScroll: true });
}
// Cancel decoration-only work on a new screen. Engine progress has already been
// saved, so interrupting a flying star cannot lose or duplicate its reward.
function clearGameEffects() {
  rewardFx.cancel();
  if (hudFrame !== null) window.cancelAnimationFrame?.(hudFrame);
  if (feedbackTimer !== null) window.clearTimeout(feedbackTimer);
  hudFrame = null; feedbackTimer = null; pendingHudProgress = null;
  hudAnimations.forEach(animation => { try { animation.cancel(); } catch { /* An old WebView may already have removed the effect. */ } }); hudAnimations = [];
  document.querySelector('[data-game-feedback]')?.remove();
  touchRings.forEach(ring => ring.remove()); touchRings.clear();
}
// Give an immediate, brief response in the visible play area. Detailed learning
// feedback remains on the page; this toast adds no score and takes no focus.
function showGameFeedback(correct, label) {
  document.querySelector('[data-game-feedback]')?.remove();
  if (feedbackTimer !== null) window.clearTimeout(feedbackTimer);
  const note = document.createElement('div');
  note.className = `q-game-feedback ${correct ? 'q-game-feedback--yes' : 'q-game-feedback--retry'}`;
  note.dataset.gameFeedback = ''; note.setAttribute('aria-hidden', 'true');
  const mark = document.createElement('b'); mark.textContent = correct ? '✓' : '×';
  const text = document.createElement('strong'); text.textContent = label;
  note.append(mark, text); document.body.append(note);
  feedbackTimer = window.setTimeout(() => { note.remove(); feedbackTimer = null; }, 1150);
}
// The destination HUD is outside the game render. These handlers are rebound only
// when its content changes, while the HUD container remains in the sticky frame.
function updateHud(progress = progression(state)) {
  hud.hidden = state.view === 'grownups' && !picker && !postcardId;
  hud.innerHTML = hud.hidden ? '' : renderHud(progress);
  hud.querySelector('[data-level-info]')?.addEventListener('click', levelInfo);
  hud.querySelector('[data-hear]')?.addEventListener('click', readScene);
  hud.querySelector('[data-game-sound]')?.addEventListener('click', toggleSound);
  hud.querySelector('[data-game-settings]')?.addEventListener('click', settings);
  hud.querySelector('[data-game-motion]')?.addEventListener('click', toggleMotion);
  updateSound();
  measureChrome();
}
// The header can wrap on a tablet or at large text sizes. Measure its real height
// so focus scrolling and feedback stay below the visible score bar.
function measureChrome() {
  const height = document.querySelector('.q-game-chrome')?.getBoundingClientRect().height;
  if (height) document.documentElement.style.setProperty('--q-chrome-height', `${Math.ceil(height)}px`);
}
// Arrival updates the accessible total immediately, then decorates that true
// total with a short count-up and meter fill. Neither animation changes state.
function collectSparks(previous, current) {
  pendingHudProgress = null;
  updateHud(current);
  const value = hud.querySelector('[data-spark-value]');
  const bar = hud.querySelector('[data-spark-bar]');
  if (!value || reduced() || typeof value.animate !== 'function' || !window.requestAnimationFrame) return;
  const fromWidth = previous.level === current.level ? previous.percent : 0;
  try {
    hudAnimations.push(bar.animate([{ width: `${fromWidth}%` }, { width: `${current.percent}%` }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' }));
    hudAnimations.push(hud.querySelector('[data-spark-target]').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' }));
  } catch {
    // Some tablet WebViews expose animate() but reject an effect. The true total
    // is already visible; decoration failure must never interrupt the game.
    return;
  }
  // The real value remains available to assistive technology during visual counting.
  const counting = document.createElement('span'); counting.setAttribute('aria-hidden', 'true');
  counting.textContent = String(previous.points); value.classList.add('q-sr'); value.after(counting);
  let started = null;
  const tick = time => {
    if (!counting.isConnected) return;
    started ??= time;
    const fraction = Math.min(1, (time - started) / 420);
    counting.textContent = String(Math.round(previous.points + (current.points - previous.points) * (1 - (1 - fraction) ** 3)));
    if (fraction < 1) hudFrame = window.requestAnimationFrame(tick);
    else { counting.remove(); value.classList.remove('q-sr'); hudFrame = null; }
  };
  hudFrame = window.requestAnimationFrame(tick);
}
// Cancel an old spoken message before a new screen or message replaces it.
function stopReading() { audioRequested = false; narration.stop(); }
// Update only the audio toolbar, so speech callbacks never rebuild a game or steal focus.
// A second toolbar lives inside the native dialog because background controls are inert there.
function updateAudio(status = narration.getState()) {
  const focusedDock = document.activeElement?.closest?.('[data-audio-dock]');
  document.querySelectorAll('[data-audio-dock]').forEach(dock => {
    dock.hidden = !audioRequested || !['speaking', 'paused', 'error', 'unavailable'].includes(status.status);
    dock.dataset.voiceSource = status.source || 'none';
    dock.querySelector('[data-audio-status]').textContent = status.status === 'paused' ? 'Voice paused' : status.status === 'speaking' ? status.source === 'recording' ? 'Story voice playing' : 'Device voice reading' : status.message;
    const transcript = dock.querySelector('[data-audio-transcript]');
    if (transcript) transcript.textContent = spokenWords;
    const pause = dock.querySelector('[data-audio-pause]');
    pause.hidden = !status.canPause;
    dock.querySelector('[data-audio-resume]').hidden = !status.canResume;
    dock.querySelector('[data-audio-stop]').hidden = !status.canStop;
  });
  // Natural completion can hide the currently focused Pause/Stop button. Return
  // focus to a visible reading control instead of leaving keyboard users stranded.
  if (focusedDock?.hidden) (dialog.open ? dialog.querySelector('#q-dialog-close') : document.querySelector('#read-aloud')).focus();
  if (audioRequested && (status.status === 'error' || status.status === 'unavailable')) announce(status.message);
}
// Bind both persistent audio toolbars once. Resuming does not restart the sentence.
function bindAudio() {
  // Some browsers finish speaking during pause/resume. Focus only a control that
  // remains available, otherwise return to the initiating reading area.
  const focusAudio = (control, next) => {
    const target = control.parentElement.querySelector(next);
    if (!target.hidden && !target.closest('[data-audio-dock]').hidden) target.focus();
    else (dialog.open ? dialog.querySelector('#q-dialog-close') : document.querySelector('#read-aloud')).focus();
  };
  document.querySelectorAll('[data-audio-pause]').forEach(control => { control.onclick = () => { narration.pause(); focusAudio(control, '[data-audio-resume]'); }; });
  document.querySelectorAll('[data-audio-resume]').forEach(control => { control.onclick = () => { narration.resume(); focusAudio(control, '[data-audio-pause]'); }; });
  document.querySelectorAll('[data-audio-stop]').forEach(control => { control.onclick = () => { narration.stop(); (dialog.open ? dialog.querySelector('#q-dialog-close') : document.querySelector('#read-aloud')).focus(); }; });
}
// Release pointer listeners and temporary drag pictures before their screen disappears.
function cleanDrag() { dragCleanups.forEach(clean => clean()); dragCleanups = []; }
// Release the temporary in-memory SVG download URL; it is not a hosted file.
function cleanDownload() { if (downloadUrl) window.URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
// A parent preview has one short replay delay. Leaving its page cancels that delay.
function cleanDemo() { if (demoTimer !== null) window.clearTimeout(demoTimer); demoTimer = null; }
// Try saving the approved state. Storage failure changes the notice, not the ability to play.
function persist() { if (!saveProgress(state)) storageAvailable = false; }
// History contains the current page/attempt only. Earned stories, Sparks, designs
// and settings stay in the latest state and are never restored from an old page.
function currentRoute() {
  return { epoch: historyEpoch, view: state.view, picker, postcardId,
    activeMission: state.view === 'mission' ? state.activeMission : null,
    sorting: null };
}
// Validate history as carefully as a browser save. An old pre-reset entry opens
// the map rather than resurrecting a cleared adventure; unknown IDs are discarded.
function normalizeRoute(route) {
  if (route.epoch !== historyEpoch) return { epoch: historyEpoch, view: 'home', picker: null, postcardId: null, activeMission: null, sorting: null };
  let attempt = route.activeMission || state.activeMission;
  // Returning to an earlier story step cannot undo facts seen or help received.
  if (attempt && attempt.id === state.activeMission?.id) attempt = { ...attempt,
    clueIds: [...new Set([...(Array.isArray(attempt.clueIds) ? attempt.clueIds : []), ...state.activeMission.clueIds])],
    assisted: Boolean(attempt.assisted || state.activeMission.assisted) };
  // Sorting is one activity page. Its latest round is the source of truth when
  // returning from another screen, so old history cannot erase answered cards.
  const validated = hydrateState({ ...state, view: route.view, activeMission: attempt, sorting: state.sorting });
  return { epoch: historyEpoch, view: validated.view,
    picker: route.picker && typeof route.picker === 'object' ? { place: LOCATIONS.some(place => place.id === route.picker.place) ? route.picker.place : null, character: ['pip', 'flo'].includes(route.picker.character) ? route.picker.character : null } : null,
    postcardId: MISSIONS.some(item => item.id === route.postcardId) && Object.hasOwn(state.completed, route.postcardId) ? route.postcardId : null,
    activeMission: validated.view === 'mission' ? validated.activeMission : null,
    sorting: null };
}
// Replacing selection changes avoids a Back entry for every tap or drag.
function rememberRoute(replace = false) { navigation?.record(currentRoute(), { replace }); }
// Native Back/Forward uses the same renderer, cancels old speech, and never calls
// completion actions. The newest earned progress is retained even on earlier steps.
function restoreRoute(route, { moveFocus = true } = {}) {
  const target = normalizeRoute(route);
  closeDialog(); cleanDownload();
  picker = target.picker; postcardId = target.postcardId;
  selectedAction = null; selectedDecoration = null; openClueList = false;
  reflectionHint = null; lastReward = null; celebration = false; storyBefore = false; pictureView = null; sortPicked = false; checkedPlan = null;
  state = hydrateState({ ...state, view: target.view, activeMission: target.activeMission || state.activeMission, sorting: target.sorting || state.sorting });
  render('q-play-enter');
  // Canonicalize this same entry after reset or validation. Otherwise reloading
  // an old entry could re-adopt its obsolete reset epoch and story snapshot.
  rememberRoute(true);
  if (moveFocus) { focus(); window.scrollTo({ top: 0, behavior: 'auto' }); }
}
// Move keyboard focus to the new task, falling back to the main area.
// Respect reduced motion when bringing that task into view.
function focus(selector = '[data-focus]') {
  const target = app.querySelector(selector) || main;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
}
// Send an action object, such as { type: 'START_MISSION' }, to the rule engine.
// An unchanged state means the action was rejected or already handled: return false.
// Otherwise save the new state, redraw, and restore focus/narration; return true.
// Reward art displays the calculated difference and never awards points itself.
function dispatch(action, { focusTarget = '[data-focus]', speak = true } = {}) {
  const previousProgress = progression(state);
  // Capture geometry before render replaces the chosen picture or button.
  const source = action.type === 'ANSWER_SORT' ? app.querySelector('.q-sort-picture > svg') : document.activeElement;
  const rewardOrigin = source?.getBoundingClientRect?.();
  const next = transition(state, action);
  if (next === state) return false;
  const newScene = next.view !== state.view || next.activeMission?.step !== state.activeMission?.step || next.activeMission?.id !== state.activeMission?.id || next.sorting?.index !== state.sorting?.index;
  if (newScene) { pictureView = null; sortPicked = false; }
  if (action.type === 'ANSWER_SORT' || action.type === 'RETRY_SORT') sortPicked = false;
  if (action.type === 'CHECK_PLAN') checkedPlan = planFeedback(mission(), next.activeMission);
  else if (action.type !== 'RETRY_PLAN' && action.type !== 'SET_PLAN' && action.type !== 'REMOVE_PLAN' && action.type !== 'HINT' && action.type !== 'COLLECT_CLUE' && action.type !== 'SET_SETTING') checkedPlan = null;
  if (action.type === 'CHOOSE_MISSION' || action.type === 'COMPLETE_MISSION' || action.type === 'REPLAY_MISSION') storyBefore = false;
  const nextProgress = progression(next);
  lastReward = nextProgress.points > previousProgress.points ? { amount: nextProgress.points - previousProgress.points, levelUp: nextProgress.level > previousProgress.level, level: nextProgress.level, title: nextProgress.title } : null;
  if (newScene) reflectionHint = null;
  celebration = action.type === 'COMPLETE_MISSION' || (action.type === 'ANSWER_SORT' && next.sorting?.feedback?.correct) || (action.type === 'NEXT_SORT' && next.sorting?.status === 'complete') || (action.type === 'CHECK_REFLECTION' && next !== state);
  state = next;
  persist();
  stopReading();
  render(newScene ? (action.type === 'COMPLETE_MISSION' ? 'q-story-reveal' : 'q-play-enter') : '', { fromProgress: lastReward ? previousProgress : null });
  // Steps create Back destinations; selections and help update the current step instead.
  rememberRoute(['ANSWER_SORT', 'RETRY_SORT', 'NEXT_SORT'].includes(action.type) || !newScene);
  if (focusTarget) focus(focusTarget);
  let cheerSpoken = false;
  if (celebration) {
    const amount = nextProgress.points - previousProgress.points;
    const levelUp = nextProgress.level > previousProgress.level;
    const kind = action.type === 'ANSWER_SORT' ? 'sorting' : action.type === 'NEXT_SORT' ? 'round' : action.type === 'CHECK_REFLECTION' ? 'reflection' : 'mission';
    const card = SORT_ITEMS.find(item => item.id === next.sorting?.itemIds[next.sorting.index]);
    const joy = celebrationCopy({ kind, missionId: next.activeMission?.id, conceptId: kind === 'sorting' ? card?.conceptId : '', points: amount, levelUp, replay: amount === 0, seed: card?.id || action.type });
    rewardFx.play({ points: amount, origin: rewardOrigin, target: hud.querySelector('[data-spark-target]'), levelUp,
      label: joy.headline,
      onArrive: () => { collectSparks(previousProgress, nextProgress); if (!audioRequested) sounds.play(levelUp ? 'level' : 'tap'); } });
    if (!state.settings.narration) sounds.play('win');
    announce(`${joy.headline} ${joy.pointsLine} ${nextProgress.points} Sparks in your score bar.`);
    // The short cheer owns this moment. Automatic full-screen narration must
    // not immediately interrupt it; Hear it remains available for the story.
    cheerSpoken = rewardVoice.play({ kind, replay: amount === 0 && kind !== 'round', seed: `${card?.id || next.activeMission?.id}:${next.sorting?.round || 0}` });
  } else if (action.type === 'CHECK_PLAN' || action.type === 'ANSWER_SORT') {
    const correct = action.type === 'CHECK_PLAN' ? next.activeMission?.feedback?.correct : next.sorting?.feedback?.correct;
    showGameFeedback(Boolean(correct), correct ? 'Your plan works!' : 'Not yet. Try again!');
    if (!state.settings.narration) sounds.play(correct ? 'win' : 'retry');
    if (correct && action.type === 'CHECK_PLAN') cheerSpoken = rewardVoice.play({ kind: 'plan', seed: next.activeMission?.id });
  }
  if (speak && state.settings.narration && !cheerSpoken) readScene();
  return true;
}
// Change the persistent top-level view and clear temporary panels/selections.
// Finishing a dialog or switching screens must not leave speech, drag or download resources behind.
function navigate(view) {
  sounds.stop();
  picker = null; postcardId = null; selectedAction = null; selectedDecoration = null; openClueList = false; lastReward = null; reflectionHint = null;
  cleanDownload();
  closeDialog();
  stopReading();
  if (!dispatch({ type: 'NAVIGATE', view })) { render(); focus(); rememberRoute(); }
  window.scrollTo({ top: 0, behavior: 'auto' });
}
// Open a native dialog from trusted app-generated markup and remember who opened it.
// The heading is escaped; callers must escape any data inserted into the body.
function modal(title, body, returnTarget = document.activeElement) {
  // A settings change rebuilds HUD buttons while this dialog remains open. Keep
  // the opener's semantic selector so Close can focus its current replacement.
  dialogReturnSelector = returnTarget?.closest?.('#q-game-hud')
    ? ['data-game-settings', 'data-level-info', 'data-game-sound', 'data-hear'].filter(name => returnTarget.hasAttribute(name)).map(name => `#q-game-hud [${name}]`)[0] || null
    : null;
  stopReading(); sounds.stop(); cleanDemo(); clearGameEffects(); updateHud();
  dialogReturn = returnTarget;
  dialogBody.innerHTML = `<p class="q-eyebrow">A closer look</p><h2 id="q-dialog-title" tabindex="-1">${escape(title)}</h2>${body}`;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('#q-dialog-title').focus();
}
// Close the panel and return focus to its opener if that element still exists.
function closeDialog() {
  stopReading();
  if (dialog.open) dialog.close();
  const opener = (dialogReturnSelector && document.querySelector(dialogReturnSelector)) || dialogReturn;
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  dialogReturn = null; dialogReturnSelector = null;
}
// Play a packaged recording when its transcript matches these exact words;
// otherwise narration.js selects an available device voice for the current text.
// A browser may use an online voice; unavailable speech leaves the visible words usable.
function speakText(text) {
  sounds.stop();
  audioRequested = true;
  spokenWords = text || 'Look at the pictures. What do you notice?';
  narration.speak(spokenWords);
}
// Hear the authored story, not a scrape of button labels and score numbers.
// Exact transcripts select packaged neural clips; edited/dynamic words use the
// device voice. The audio dock always lets the child see the words being spoken.
function readScene() {
  const item = mission();
  const active = state.activeMission;
  const card = SORT_ITEMS.find(entry => entry.id === state.sorting?.itemIds[state.sorting.index]);
  if (!dialog.open) {
    const fact = app.querySelector('[data-picture-help-text]');
    if (fact) { speakText(fact.textContent); return; }
    if (state.view === 'sorting' && card) { speakText(state.sorting.feedback ? state.sorting.feedback.correct ? card.explanation : card.clue : card.condition); return; }
    if (state.view === 'mission' && item && !picker && !postcardId) {
      speakText(active.step === 'intro' ? `${item.fictionalContext} ${item.guideLines.intro}` : active.step === 'outcome' ? item.outcome.text : active.step === 'feedback' && !active.feedback?.correct ? feedbackText(item, active) : guideLine(item, active)); return;
    }
    if (state.view === 'home' && !picker) { speakText(STORY_LINES.home); return; }
  }
  const reading = app.querySelector('.q-feedback') || app.querySelector('.q-reflection') || app.querySelector('.q-plan-instruction') || app.querySelector('.q-sort-object') || app.querySelector('[data-read]');
  const text = dialog.open ? dialogBody.innerText : reading?.innerText || app.querySelector('h1')?.textContent;
  speakText(text);
}
// Return shared button markup; bind() attaches the context-specific speech action.
function listenButton(text = 'Hear it', extra = '') {
  return `<button class="q-listen" data-hear ${extra}><span aria-hidden="true">${soundIcon}</span>${text}</button>`;
}
// Build the level badge and progress meter from derived rewards, not a stored score.
function renderHud(progress = progression(state)) {
  return `<div class="q-player-strip" aria-label="Your Quest progress"><button class="q-level-chip" data-level-info aria-label="Level ${progress.level}: ${escape(progress.title)}. ${progress.points} Sparks. See rewards."><span>${levelBadge(progress.level)}</span><span><small>LEVEL ${progress.level}</small><strong>${escape(progress.title)}</strong></span></button><div class="q-spark-meter"><div><b data-spark-target><span aria-hidden="true">✦</span> <span data-spark-value>${progress.points}</span> <span>Sparks</span></b><small>${progress.nextThreshold ? `${progress.pointsRemaining} to Level ${progress.level+1}` : 'All four level badges earned'}</small></div><div class="q-spark-track" role="progressbar" aria-label="Progress to your next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress.percent)}"><span data-spark-bar style="width:${progress.percent}%"></span></div></div><div class="q-hud-tools"><button class="q-game-sound" data-game-sound aria-pressed="${state.settings.sound}"><span aria-hidden="true">♫</span><span data-sound-label>${state.settings.sound ? 'Sound on' : 'Sound off'}</span></button><button class="q-motion-control" data-game-motion aria-pressed="${!reduced()}"><span aria-hidden="true">✦</span><span>Animations ${reduced() ? 'off' : 'on'}</span></button><button class="q-hud-listen" data-hear aria-label="Read this screen aloud"><span aria-hidden="true">${soundIcon}</span><span>Hear it</span></button><button class="q-game-settings" data-game-settings aria-label="Game settings" title="Game settings"><span aria-hidden="true">⚙</span></button></div></div>${renderActivityProgress()}`;
}
// Keep the current goal next to the score, even when a child scrolls to a picture.
// Replaying always advances this round, while each different picture earns Sparks once.
function renderActivityProgress() {
  const stamps = `${Object.keys(state.completed).length} / ${MISSIONS.length} story stamps`;
  if (state.view === 'sorting' && state.sorting) return `<div class="q-round-hud" role="status"><strong>${Object.keys(state.sorting.answers).length} / 5 sorted</strong><span>${state.sortedItems.length} / ${SORT_ITEMS.length} different pictures</span></div>`;
  const item = mission();
  if (state.view === 'mission' && item && !picker && state.activeMission.step === 'explore') return `<div class="q-round-hud" role="status"><strong>${state.activeMission.clueIds.length} / ${item.clues.length} clues found</strong><span>${stamps}</span></div>`;
  return `<div class="q-round-hud" role="status"><strong>${stamps}</strong><span>Every story is open. Pick your next adventure!</span></div>`;
}
// Show only the most recent increase in Sparks; no increase means no reward banner.
function renderCelebration() {
  return celebration ? `<div class="q-win-celebration q-reward-enter q-sr" aria-hidden="true">${rewardBurst({ kind: 'win' })}</div>` : '';
}
// Show the actual newly earned Sparks alongside the separate finite win animation.
function renderReward() {
  if (!lastReward) return '';
  return `<div class="q-reward-strip q-reward-enter q-sr ${lastReward.levelUp ? 'q-level-up' : ''}" role="status"><span>${lastReward.levelUp ? levelBadge(lastReward.level) : rewardBurst({kind:'points'})}</span><div><strong>${lastReward.levelUp ? `Level ${lastReward.level}! ${escape(lastReward.title)}` : `+${lastReward.amount} Sparks!`}</strong><p>${lastReward.levelUp ? `You earned ${lastReward.amount} Sparks. A new badge is yours.` : 'A new discovery for your adventure.'}</p></div></div>`;
}
// Explain the four badges and repeat-safe reward rules in a read-only panel.
function levelInfo() {
  const progress = progression(state);
  modal('Your Spark adventure', `<p>Collect Sparks as you learn. Every level brings a new badge.</p><div class="q-level-trail">${LEVELS.map(level => `<div class="${progress.level >= level.level ? 'earned' : ''}">${levelBadge(level.level)}<strong>Level ${level.level}</strong><span>${escape(level.title)}</span></div>`).join('')}</div><ul class="q-spark-rules"><li>Finish a new story: <strong>20 Sparks</strong></li><li>Sort a different picture: <strong>5 Sparks</strong></li><li>Find a new idea: <strong>5 Sparks</strong></li><li>Answer a story’s picture question: <strong>10 Sparks</strong></li></ul><p>Hints are free. Trying again is free. You keep your Sparks.</p><p class="q-small-note">Each picture and discovery earns Sparks once. Repeat pictures still fill your round. You can play every story at any level.</p>${button('Let’s play', 'data-close-clue')}`);
  dialogBody.querySelector('[data-close-clue]').onclick = closeDialog;
}
// Provide a small vocabulary panel with its own read-aloud and close controls.
function wordHelp() {
  modal('Little words, big ideas', `<dl class="q-word-list"><div><dt>A clue</dt><dd>A fact that helps you choose, like a note saying a fan works.</dd></div><div><dt>A report</dt><dd>A note about a check. It tells us what the trained repairer found.</dd></div><div><dt>Reuse</dt><dd>Use something again. It may go to a new home.</dd></div><div><dt>Repair</dt><dd>Fix something that is broken. A repairer does this.</dd></div><div><dt>Recycle</dt><dd>Turn old materials into materials we can use again.</dd></div><div><dt>E-waste</dt><dd>Old electrical things that need a special collection service.</dd></div><div><dt>A qualified repairer</dt><dd>A person trained to check and repair these appliances.</dd></div></dl>${listenButton('Read these words')}${button('Got it', 'data-close-clue')}`);
  dialogBody.querySelector('[data-hear]').onclick = readScene;
  dialogBody.querySelector('[data-close-clue]').onclick = closeDialog;
}

// Link the three illustrated buildings to mission-picker filters using stable location IDs.
function placeButtons() {
  return LOCATIONS.map(item => `<button class="q-map-place place-${attr(item.id)}" data-place="${attr(item.id)}"><span>${escape(item.title)}</span><b aria-hidden="true">↗</b></button>`).join('');
}
const stampTitles = ['A new home', 'A quiet mystery', 'A warning clue', 'A second chance', 'The next stop', 'Two different paths', 'Pause the plan', 'A missing answer'];
// Show each authored story as an available mission or an earned postcard entry.
function renderPassport() {
  return `<section class="q-passport" aria-label="Your story passport"><div class="q-passport-heading"><div><p class="q-eyebrow">Your story passport</p><h2>Eight stories. Your next chapters.</h2></div><p>Find a story. Keep its stamp. Make it yours.</p></div><div class="q-passport-stamps">${MISSIONS.map((item, index) => {
    const earned = Object.hasOwn(state.completed, item.id);
    return `<button class="q-passport-story ${earned ? 'earned' : ''}" ${earned ? `data-postcard="${attr(item.id)}"` : `data-mission="${attr(item.id)}"`} aria-label="${earned ? 'Design a postcard for' : 'Explore'} ${attr(item.title)}"><span class="q-passport-art">${passportStamp(item.id)}</span><strong>${escape(stampTitles[index] || item.title)}</strong><small>${earned ? 'Stamp collected · Create ↗' : 'Find this story →'}</small></button>`;
  }).join('')}</div></section>`;
}
// Build the child start/resume screen, neighbourhood and three game choices.
// Saved state controls resume buttons; all stories remain available at every level.
function renderHome() {
  const done = Object.keys(state.completed).length;
  const suggested = MISSIONS.find(item => item.id === suggestedMission(state)) || MISSIONS[0];
  return `<section class="q-home q-adventure-cover">
    <div class="q-home-intro" data-read><p class="q-eyebrow"><span aria-hidden="true">✦</span> Small choices. Big adventures.</p><h1 tabindex="-1" data-focus>You choose <em>what happens next.</em></h1><p class="q-hero-invitation">Meet Pip the toaster and Flo the fan.<br>Look at pictures. Choose a plan. See your story change.</p>
      <div class="q-start-actions">${state.activeMission && state.activeMission.step !== 'outcome' ? button('Continue your adventure <span aria-hidden="true">→</span>', 'data-continue') : button(`${done ? 'Continue your adventure' : 'Start a mission'} <span aria-hidden="true">→</span>`, 'data-picker')}${state.activeMission ? button('Choose a different mission', 'data-picker', 'quiet') : ''}${state.sorting && state.sorting.status !== 'complete' ? button('Continue sorting', 'data-nav="sorting"', 'secondary') : ''}</div>
      ${!state.settings.sound ? '<button class="q-sound-invite" data-enable-game-sound><span aria-hidden="true">♫</span> Turn on game sounds <small>Cheers and little chimes as you play</small></button>' : ''}${state.settings.motion === 'auto' && reduced() ? '<button class="q-motion-invite" data-enable-game-motion><span aria-hidden="true">✦</span> Make Pip and Flo move <small>Turn on game animations</small></button>' : ''}<p class="q-boundary">Your adventure stays on screen. Real appliances need adult help.</p>
    </div>
    <div class="q-play-doors" aria-label="Choose a game"><button data-picker><span>${artwork('flo')}</span><div><small>LOOK · CHOOSE · DISCOVER</small><strong>Story quests</strong><p>Help a friend. Earn a stamp.</p></div><b aria-hidden="true">→</b></button><button data-sort-start><span>${artwork('cardboard')}</span><div><small>TAP · MOVE · MATCH</small><strong>Sorting game</strong><p>Find a home for each picture.</p></div><b aria-hidden="true">→</b></button><button data-nav="creations"><span>${artwork('flowers')}</span><div><small>COLLECT · MAKE · KEEP</small><strong>My creations</strong><p>Make your world look like you.</p></div><b aria-hidden="true">→</b></button></div>
    <div class="q-world-wrap"><div class="q-world" aria-label="Three places on the adventure map">${neighborhood({ unlocked: state.discoveries, decorations: state.decorations })}${placeButtons()}<span class="q-world-caption">Pick a place. Find its story.</span></div><div class="q-world-greetings"><div class="q-greeting-friends">${['pip','flo'].map(id => `<button data-greet="${id}" aria-label="Say hello to ${id === 'pip' ? 'Pip' : 'Flo'}">${artwork(id)}<span>${id === 'pip' ? 'Pip' : 'Flo'}</span></button>`).join('')}</div><p class="q-world-dialogue" role="status">Pip the toaster. Flo the fan.<br>Tap a friend to say hello!</p></div></div>
    <div class="q-home-bottom"><div class="q-mode" role="group" aria-label="Choose your play style"><span>How shall we explore?</span><button data-mode="guided" aria-pressed="${state.settings.mode === 'guided'}">Guided <small>Picture facts stay visible</small></button><button data-mode="challenge" aria-pressed="${state.settings.mode === 'challenge'}">Challenge <small>Search for picture facts</small></button></div><button class="q-suggestion" data-mission="${attr(suggested.id)}"><span class="q-eyebrow">${state.practice.length ? 'Your next plot twist?' : 'A story to start with'}</span><strong>${escape(suggested.title)} <span aria-hidden="true">→</span></strong><small>The choice is yours.</small></button></div>
    ${renderPassport()}
  </section>`;
}
// Filter authored missions by the temporary character/place selection and return their buttons.
function renderPicker() {
  const options = MISSIONS.filter(item => (!picker.character || item.character === picker.character) && (!picker.place || item.locationId === picker.place));
  return `<section class="q-page q-picker"><button class="q-back" data-nav="home">← Back to the adventure map</button><p class="q-eyebrow">Every clue starts a story</p><h1 data-focus tabindex="-1">Who shall we help?</h1><p>Choose a friend, then a mission.</p><div class="q-character-choices">${['pip', 'flo'].map(id => `<button data-character="${id}" aria-pressed="${picker.character === id}">${artwork(id)}<strong>${id === 'pip' ? 'Pip' : 'Flo'}</strong><span>${id === 'pip' ? 'Pip the toaster' : 'Flo the fan'}</span></button>`).join('')}</div>
      <div class="q-picker-tools"><span>${picker.place ? escape(locationTitle(picker.place)) : 'All around the adventure map'}</span><button class="q-back" data-all-missions>Show all stories</button></div>
      <div class="q-mission-list">${options.map((item, index) => `<button class="q-mission-row" data-mission="${attr(item.id)}"><span class="q-mission-thumb">${artwork(item.artworkId)}</span><span><small>${escape(locationTitle(item.locationId))} · ${item.difficulty === 'challenge' || item.slots.length > 1 ? 'Connect the clues' : 'A next-step story'}</small><strong>${escape(item.title)}</strong><span>${escape(item.childSummary || item.fictionalContext)}</span></span><b aria-label="${state.completed[item.id] ? 'Explored' : 'Open story'}">${state.completed[item.id] ? '✓' : '→'}</b></button>`).join('') || '<p>Try another friend, or show all stories.</p>'}</div>
      ${picker.place === 'station' || !picker.place ? `<div class="q-collection-invite"><span>${artwork('cardboard')}</span><div><p class="q-eyebrow">A hands-on picture activity</p><h2>Sort at Sorting Station</h2><p>Five picture cards. Three places to choose.</p>${button('Play sorting →', 'data-sort-start')}</div></div>` : ''}
    </section>`;
}
// Translate the internal mission step into the four visible progress labels.
function missionProgress(active) {
  const stage = ['intro', 'explore', 'plan', 'feedback', 'outcome'].indexOf(active.step);
  return `<ol class="q-step-track" aria-label="Mission steps">${['Meet', 'Look at facts', 'Make a plan', 'See what happens'].map((label, i) => `<li ${i === Math.min(stage, 3) ? 'aria-current="step"' : ''}><span>${i < stage ? '✓' : i + 1}</span>${label}</li>`).join('')}</ol>`;
}
// Create either positioned scene hotspots or a plain clue list from the same clue IDs.
// Guided mode reveals labels; both versions dispatch the same discovery action.
function clueButtons(item, active, hotspot = false) {
  return item.clues.map((clue, index) => `<button class="${hotspot ? 'q-hotspot' : 'q-clue-list-button'} ${active.clueIds.includes(clue.id) ? 'found' : ''}" data-clue="${attr(clue.id)}" ${hotspot ? `style="--x:${Number(clue.x) || 30 + index * 20}%;--y:${Number(clue.y) || 45}%"` : ''} aria-label="Clue ${index + 1}: ${attr(clue.title)}${active.clueIds.includes(clue.id) ? ', discovered' : ''}"><b>${active.clueIds.includes(clue.id) ? '✓' : index + 1}</b>${!hotspot || state.settings.mode === 'guided' ? `<span>${escape(clue.title)}</span>` : '<span class="q-sr">Find this clue</span>'}</button>`).join('');
}
// Choose the character sentence for the current step, including retry and selected-plan help.
function guideLine(item, active) {
  const key = active.step === 'feedback' ? (active.feedback?.correct ? 'success' : 'retry') : active.step;
  if (active.step === 'plan' && selectedAction) return 'Does your plan fit the clue?';
  return item.guideLines?.[key] || 'A good clue can change the whole story. What did you spot?';
}
// Pair the story sentence with a character expression, narration and vocabulary controls.
function guideBubble(item, active) {
  const happy = active.step === 'outcome' || active.feedback?.correct;
  return `<aside class="q-guide-dialogue" aria-label="${item.character === 'pip' ? 'Pip' : 'Flo'} says"><div class="q-guide-portrait">${artwork(item.character, { expression: happy ? 'success' : ['explore','plan'].includes(active.step) ? 'thinking' : 'happy' })}</div><div><b>${item.character === 'pip' ? 'Pip' : 'Flo'}</b><p>${escape(guideLine(item, active))}</p></div><div class="q-guide-tools">${listenButton('Hear the story')}<button class="q-word-help" data-word-help>Word help</button></div></aside>`;
}
// Show the optional two-picture evidence question, retry hint or saved correct explanation.
// The event handler asks the engine to save a correct answer; this renderer does not score it.
function renderReflection(item) {
  if (!item.reflection) return '';
  const done = Boolean(state.reflections?.[item.id]);
  return `<section class="q-reflection ${done ? 'answered' : ''}" aria-label="A picture question about your story"><div class="q-reflection-heading"><div><p class="q-eyebrow">${done ? 'You connected the clues' : 'One more little discovery · +10 Sparks'}</p><h2 data-reflection-focus tabindex="-1">${escape(done ? 'You spotted the reason!' : item.reflection.prompt)}</h2></div>${listenButton('Hear the question')}</div>${done ? `<p>${escape(item.reflection.explanation)}</p>` : `<div class="q-reflection-options">${item.reflection.options.map(option => `<button data-reflection="${attr(option.id)}"><span>${artwork(option.artworkId)}</span><strong>${escape(option.label)}</strong></button>`).join('')}</div>${reflectionHint === item.id ? `<p class="q-reflection-hint" role="status">Here’s a clue: ${escape(item.reflection.explanation)} Try again.</p>` : '<p class="q-small-note">Tap a picture. You can try again.</p>'}`}</section>`;
}

// Display which authored clues were collected without inventing evidence for unopened clues.
function cluePocket(item, active) {
  return `<section class="q-clue-pocket" aria-label="Your clue pocket"><div><span aria-hidden="true">⌕</span><strong>Your clue pocket</strong><small>${active.clueIds.length}/${item.clues.length} found</small></div><div class="q-pocket-pieces">${item.clues.map((entry, index) => active.clueIds.includes(entry.id) ? `<button data-clue="${attr(entry.id)}" aria-label="Reopen clue: ${attr(entry.title)}"><b aria-hidden="true">✓</b>${escape(entry.shortLabel || entry.title)}</button>` : `<span class="q-pocket-empty" aria-label="Clue ${index+1} not found">? <small>Clue ${index+1}</small></span>`).join('')}</div></section>`;
}
// Keep a compact memory aid beside the answer choices. The full, exact facts
// expand beside the same scene; only facts actually inspected receive a tick.
function factRecap(item) {
  return `<div class="q-fact-recap"><div>${item.clues.map((entry, index) => `<span>${state.activeMission.clueIds.includes(entry.id) ? '✓' : index + 1} ${escape(entry.shortLabel || entry.title)}</span>`).join('')}</div><button class="q-button quiet" data-show-facts>Look at the picture clues</button></div>`;
}
function showFacts() {
  const item = mission();
  if (!item) return;
  pictureView = { missionId: item.id, clueId: item.clues[0]?.id, returnSelector: '[data-show-facts]' };
  stopReading(); render(); focus('[data-picture-help-focus]');
}
// Mark only facts that were actually shown on the Guided explore screen, then
// request the same engine plan transition used by Challenge mode's found clues.
function openPlan() {
  if (state.settings.mode === 'guided' && state.activeMission?.step === 'explore') {
    const item = mission();
    const shown = pictureView?.missionId === item.id ? pictureView.clueId : item.clues[0]?.id;
    state = transition(state, { type: 'COLLECT_CLUE', id: shown });
    rememberRoute(true);
  }
  dispatch({ type: 'OPEN_PLAN' }, { focusTarget: '[data-plan-focus]' });
}
// Select the introduction, exploration, plan, feedback or outcome markup from activeMission.step.
// The engine decides whether a step is allowed; this function shows that decision.
function renderMission() {
  const item = mission(); const active = state.activeMission;
  if (!item || !active) return renderHome();
  const final = active.step === 'outcome';
  const feedback = active.step === 'feedback';
  const correct = feedback && active.feedback?.correct;
  const stage = active.step;
  const clueId = pictureView?.missionId === item.id ? pictureView.clueId : item.clues[0]?.id;
  const pictureOpen = pictureView?.missionId === item.id;
  const result = feedback ? planFeedback(item, active) : null;
  const preview = rewardPreview(state, { missionId: item.id });
  return `<section class="q-page q-mission q-stage-${stage} ${final ? 'q-resolved' : ''} ${pictureOpen ? 'q-has-picture-help' : ''}"><div class="q-mission-top"><button class="q-back" data-nav="home">← Adventure map</button><span>${escape(locationTitle(item.locationId))}</span>${item.cooperative ? '<button class="q-back" data-companion>Secret envelope ✉</button>' : ''}</div>${missionProgress(active)}
    <div class="q-story-heading" data-read><p class="q-eyebrow">${final ? 'You changed the story' : `${item.character === 'flo' ? 'Flo' : 'Pip'} has a mystery for you`}</p><h1 data-focus tabindex="-1">${escape(final ? item.outcome.title : item.title)}</h1><p>${escape(final ? item.outcome.text : stage === 'intro' ? item.fictionalContext : '')}</p></div>
    ${guideBubble(item, active)}
    ${final ? `<div class="q-projector-controls"><span><b aria-hidden="true">▶</b> Your story projector</span><div role="group" aria-label="Compare your story before and after"><button data-story-view="before" aria-pressed="${storyBefore}">Before your choice</button><button data-story-view="after" aria-pressed="${!storyBefore}">The next chapter</button><button data-play-ending aria-label="Play the story ending again">▶ Play ending</button></div></div>` : ''}
    <div class="q-mission-scene ${stage === 'plan' || feedback ? 'q-scene-small' : ''}" data-story-scene>${scene(item.locationId, item.artworkId, final && !storyBefore ? item.outcome.scene : null)}${stage === 'explore' && state.settings.mode === 'challenge' ? clueButtons(item, active, true) : stage === 'explore' || pictureOpen ? sceneClues(item, clueId) : ''}<span class="q-scene-tag">${final ? (storyBefore ? 'Where our story started' : 'What your choice changed') : stage === 'intro' ? 'Meet the friend in our picture story' : 'Our picture story · Look for a numbered clue'}</span></div>
    ${stage === 'intro' ? `<div class="q-mission-intro"><div class="q-touch-how"><span aria-hidden="true">☝</span><p><strong>First, find the clues.</strong><br>Then tap a number to see what its picture tells us.</p></div><div class="q-points-preview"><b>✦ ${escape(preview.label)}</b><small>${preview.reflectionPoints ? `Then +${preview.reflectionPoints} for the picture question. ` : ''}Hints and retries are free.</small></div>${button('Find the clues →', 'data-start-mission')}${item.cooperative ? button('Open the secret envelope', 'data-evidence', 'secondary') : ''}</div>` : ''}
    ${stage === 'explore' ? `<div class="q-explore-controls">${state.settings.mode === 'guided' || pictureOpen ? renderPictureHelp(item, clueId, { close: pictureView?.returnSelector === '[data-hint]', closeLabel: 'Back to clues' }) : ''}${state.settings.mode === 'challenge' ? `${cluePocket(item, active)}<div>${button(openClueList ? 'Hide fact list' : 'Show fact list', 'data-clue-list', 'quiet')}<div class="q-clue-list" ${!openClueList ? 'hidden' : ''}>${clueButtons(item, active)}</div></div>` : ''}<div class="q-step-actions">${button('Help me choose', 'data-hint', 'quiet')}${button('Make a plan →', 'data-open-plan' + (state.settings.mode === 'guided' || active.clueIds.length ? '' : ' disabled'))}</div></div>` : ''}
    ${stage === 'plan' ? `<div class="q-plan-desk">${pictureOpen ? renderPictureHelp(item, clueId, { close: true }) : state.settings.mode === 'guided' ? factRecap(item) : cluePocket(item, active)}${renderPlan(item, active)}</div>` : ''}
    ${feedback ? `<section class="q-feedback q-plan-feedback ${correct ? 'correct' : 'retry'}" data-read><div class="q-feedback-mark" aria-hidden="true">${correct ? '✦' : result.mixed ? '✓' : '×'}</div><div><h2 tabindex="-1" data-feedback-focus>${escape(correct ? 'Your clues unlocked the next chapter!' : result.summary)}</h2>${renderChoiceResults(result)}<p class="q-points-preview">${correct ? escape(preview.completionPoints ? `See your ending to collect ${preview.completionPoints} Sparks.` : 'Enjoy your ending again. You keep your Sparks.') : 'Trying again is free. Your Sparks stay with you.'}</p>${button(correct ? 'See the next chapter →' : 'Try again', correct ? 'data-complete' : 'data-retry')}${!correct ? button('Revisit the clues', 'data-revisit-clues', 'quiet') : ''}</div></section>` : ''}
    ${final ? `<div class="q-outcome">${renderCelebration()}${renderReward()}<div class="q-unlocked"><div class="q-earned-story-stamp q-stamp-earned">${passportStamp(item.id)}</div><div><p class="q-eyebrow">One story. Your stamp.</p><h2>${escape(item.conceptIds.map(id => concept(id)?.title).filter(Boolean).join(' + '))}</h2><p>${escape(item.postcardLine || 'A next chapter worth keeping.')}</p></div></div>${renderReflection(item)}<div class="q-creative-invite"><div><h2>Make a postcard of your story.</h2><p>Pick its colours. Add your mark. Keep your creation.</p></div>${button('Create my story postcard ✦', `data-postcard="${attr(item.id)}"`)}</div><div class="q-step-actions">${button('Choose another mission →', 'data-picker')}${button('Open my Discovery Book', 'data-nav="book"', 'secondary')}${button('Finish for now', 'data-nav="home"', 'quiet')}</div><p class="q-small-note">${active.assisted ? 'You followed a clue and found your way. That’s exploring.' : 'You connected the clues yourself.'} ${button('Play this story again', 'data-replay', 'text')}</p></div>` : ''}
  </section>`;
}

// Choose the authored explanation for the checked plan, including a helpful wrong-choice response.
function feedbackText(item, active) {
  if (item.slots.length > 1) {
    const result = planFeedback(item, active);
    return `${result.summary} ${result.slots.map(row => `${row.label}. ${row.message}`).join(' ')}`;
  }
  const chosen = active.feedback?.actionId || Object.values(active.plan).find(id => !item.acceptedPlans.some(plan => Object.values(plan).includes(id)));
  return item.allowedActions.find(action => action.id === chosen)?.feedback || item.helpText;
}
// Each object gets its own result. A good answer for the toaster must never
// accidentally mark the box correct, or erase the good choice on a retry.
function renderChoiceResults(result) {
  return `<div class="q-plan-results">${result.slots.map(row => `<article class="q-plan-result ${row.chosenCorrect ? 'correct' : 'retry'}" data-plan-result="${attr(row.slotId)}"><span class="q-plan-result-picture">${artwork(row.chosenAction?.artworkId || 'paper')}</span><div><h3>${escape(row.label)}</h3><b><span aria-hidden="true">${row.chosenCorrect ? '✓' : '×'}</span> ${row.chosenCorrect ? 'This choice fits!' : 'Try a different choice'}</b><p class="q-plan-result-choice">Your choice: ${escape(row.chosenAction?.label || 'No choice yet')}</p><p>${escape(row.message)}</p></div></article>`).join('')}</div>`;
}
// Draw action pictures and named plan spaces. One-space plans can be selected with one tap.
// Drag handles are an optional second way to fill those same spaces.
function renderPlan(item, active) {
  const single = item.slots.length === 1;
  return `<section class="q-plan-section ${single ? 'q-single-plan' : ''}"><div class="q-plan-instruction" data-read><h2 tabindex="-1" data-plan-focus>What should happen next?</h2><p>${single ? 'Tap a picture to choose your plan.' : 'Tap a picture. Then tap where it belongs.'}</p><p class="q-selection" role="status">${selectedAction ? `Your choice: ${escape(item.allowedActions.find(action => action.id === selectedAction)?.label)}${single ? '' : '. Tap a space below.'}` : 'Use the clues to help you choose.'}</p></div>
    <div class="q-plan-layout"><div class="q-action-bank" aria-label="Actions to choose">${item.allowedActions.map(action => `<div class="q-action-tile ${selectedAction === action.id || Object.values(active.plan).includes(action.id) ? 'selected' : ''}"><button data-action-select="${attr(action.id)}" aria-pressed="${selectedAction === action.id || Object.values(active.plan).includes(action.id)}"><span class="q-action-art">${artwork(action.artworkId || item.artworkId)}</span><strong>${escape(action.label)}</strong>${Object.values(active.plan).includes(action.id) ? '<span class="q-choice-tick">Chosen</span>' : ''}</button><button class="q-drag-handle" data-action-drag="${attr(action.id)}" aria-label="Drag action: ${attr(action.label)}"><span aria-hidden="true">⠿</span><small>Move</small></button></div>`).join('')}</div>
    <div class="q-plan-slots">${item.slots.map((slot, index) => { const action = item.allowedActions.find(action => action.id === active.plan[slot.id]); const prior = checkedPlan?.slots.find(row => row.slotId === slot.id && row.chosenActionId === action?.id); return `<div class="q-slot-wrap ${prior?.chosenCorrect ? 'q-kept-choice' : ''}">${prior ? `<small class="q-slot-review">${prior.chosenCorrect ? '✓ Keep this choice' : 'Try another picture for this item'}</small>` : ''}<span>${index + 1}. ${escape(slot.label)}</span><button class="q-plan-slot ${action ? 'filled' : ''}" data-plan-slot="${attr(slot.id)}" aria-label="${attr(slot.label)}: ${attr(action?.label || 'empty, choose an action first')}"><span aria-hidden="true">${prior?.chosenCorrect ? '✓' : action ? '●' : '+'}</span>${escape(action?.label || 'Your plan goes here')}</button>${action ? `<button class="q-back" data-remove-slot="${attr(slot.id)}">Change my choice</button>` : ''}</div>`; }).join('')}</div></div>
    <div class="q-step-actions">${button('Help me choose', 'data-hint', 'quiet')}${button('See what happens →', 'data-check-plan' + (item.slots.every(slot => active.plan[slot.id]) ? '' : ' disabled'))}</div></section>`;
}

const destinations = [
  { id: 'ewaste', title: 'Electrical things', short: 'Special collection', art: 'station' },
  { id: 'paper', title: 'Paper & cardboard', short: 'Clean and empty', art: 'paper' },
  { id: 'ask', title: 'Pause & ask', short: 'A warning or a missing clue', art: 'flo' }
];
// Show the current five-card round, its destinations, feedback and final helped/independent count.
// Picture condition text determines the answer; the object shape alone is insufficient.
function renderSorting() {
  const run = state.sorting;
  if (!run) return renderHome();
  const item = SORT_ITEMS.find(card => card.id === run.itemIds[run.index]);
  if (run.status === 'complete') {
    const answers = Object.values(run.answers);
    const independent = answers.filter(answer => !answer.assisted).length;
    // Offer an unfinished chapter after the round without locking any other story.
    const nextStory = MISSIONS.find(story => !Object.hasOwn(state.completed, story.id));
    return `<section class="q-page q-sort-finish"><p class="q-eyebrow">Sorting Station</p><h1 data-focus tabindex="-1">Five thoughtful choices.</h1>${renderCelebration()}<div class="q-finish-art">${neighborhood({ unlocked: state.discoveries, decorations: state.decorations })}</div><p>You found a next step for five pictures. Nice thinking!</p><div class="q-run-reflection"><span><b>${independent}</b> on your own</span><span><b>${answers.length - independent}</b> with a clue</span></div><p>Clues are for everyone. Which one helped you?</p>${nextStory ? `<p>Your next adventure: <strong>${escape(nextStory.title)}</strong></p>` : '<p>All eight story stamps are yours. What a journey!</p>'}<div class="q-step-actions">${nextStory ? button('Try a story mission →', `data-mission="${attr(nextStory.id)}"`) : ''}${button('Try another five cards →', 'data-sort-start', 'secondary')}${button('My Discovery Book', 'data-nav="book"', 'secondary')}${button('Finish for now', 'data-nav="home"', 'quiet')}</div></section>`;
  }
  if (!item) return renderHome();
  const feedback = run.status === 'feedback'; const correct = feedback && run.feedback?.correct;
  const preview = rewardPreview(state, { sortItemId: item.id });
  const joy = celebrationCopy({ kind: 'sorting', conceptId: item.conceptId, points: lastReward?.amount || 0, seed: item.id });
  return `<section class="q-page q-sort"><div class="q-mission-top"><button class="q-back" data-nav="home">← Adventure map</button><span>Picture ${run.index + 1} of 5</span><span class="q-sort-ticket" aria-label="Untimed picture challenge">Think it through ✦</span></div><div class="q-sort-heading"><p class="q-eyebrow">Sorting Station</p><h1 data-focus tabindex="-1">Where does this picture go?</h1><p class="q-sort-rule">These pictures are ready for collection. <strong>A warning or a missing clue? Pause and ask.</strong></p></div>
    <div class="q-sort-board"><div class="q-sort-round-track" aria-label="Picture ${run.index + 1} of 5">${Array.from({length:5}, (_,i) => `<span class="${i < run.index || (i === run.index && correct) ? 'done' : i === run.index ? 'current' : ''}">${i < run.index || (i === run.index && correct) ? '✓' : i+1}</span>`).join('')}</div><article class="q-sort-object ${correct ? 'placed' : ''} ${sortPicked ? 'q-picked-object' : ''}" data-read><button class="q-sort-art q-sort-picture" data-sort-picture aria-label="Move ${attr(item.title)} picture" aria-pressed="${sortPicked}" ${feedback ? 'disabled' : ''}>${artwork(item.artworkId)}<span class="q-card-number">${run.index + 1}/5</span></button><div class="q-sort-object-copy"><h2>${escape(item.title)}</h2><p>${escape(item.condition)}</p>${!feedback ? `<p class="q-sort-point-note">✦ ${escape(preview.label)}</p>` : ''}${!feedback ? `<button class="q-drag-handle q-lift" data-sort-drag aria-label="Pick up ${attr(item.title)}"><span aria-hidden="true">⠿</span> Move</button>` : ''}</div></article>
    <p class="q-sort-instruction">${feedback ? (correct ? 'You found a place that fits.' : 'Read the help, then press Try again.') : 'Drag the picture to a place. Or tap the picture, then a place.'}</p>
    <div class="q-destinations" aria-label="Choose a place">${destinations.map(destination => `<button class="q-destination dest-${destination.id} ${feedback && run.feedback.destinationId === destination.id ? (correct ? 'q-accepted' : 'q-sort-retry') : ''}" data-destination="${destination.id}" ${feedback ? 'disabled' : ''}><span class="q-destination-drawing" aria-hidden="true">${destination.id === 'ewaste' ? '<svg viewBox="0 0 90 65"><path d="M10 55V26L45 8l35 18v29H10Z" fill="#d7e9dd"/><path d="M20 55V30h50v25M36 55V37h18v18"/><path d="M8 26 45 7l37 19"/><path d="m38 20 5-6 5 6m0-6h-5v9"/></svg>' : destination.id === 'paper' ? artwork('cardboard') : '<svg viewBox="0 0 90 65"><path d="M12 7h66v43H43L29 60V50H12Z" fill="#f8d39c"/><path d="M36 23q1-12 14-9t3 16l-8 5v5M45 44v2"/></svg>'}</span>${feedback && !correct && run.feedback.destinationId === destination.id ? '<span class="q-destination-cross" aria-label="Try again">×</span>' : ''}<strong>${escape(destination.title)}</strong><small>${escape(destination.short)}</small>${correct && run.feedback.destinationId === destination.id ? `<span class="q-placed-picture" aria-hidden="true">${artwork(item.artworkId)}</span>` : ''}${correct && run.feedback.destinationId === destination.id ? '<b class="q-destination-tick">✓ Placed</b>' : ''}</button>`).join('')}</div></div>
    ${feedback ? `${renderReward()}<section class="q-feedback ${correct ? 'correct' : 'retry'}" data-read>${correct ? renderCelebration() : ''}<span class="q-feedback-mark" aria-hidden="true">${correct ? '✓' : '×'}</span><div><h2 data-feedback-focus tabindex="-1">${correct ? escape(joy.headline) : 'Not this place. Try again.'}</h2><p>${escape(correct ? item.explanation : item.clue)}</p>${correct ? `<p class="q-earned-note">${escape(joy.pointsLine)}</p>` : ''}${button(correct ? (run.index === 4 ? 'Finish this round →' : 'Next picture →') : 'Try again', correct ? 'data-sort-next' : 'data-sort-retry')}</div></section>` : `${pictureView?.sortId === item.id ? sortingPictureHelp(item) : ''}<div class="q-sort-help">${button('Help me choose', 'data-hint', 'quiet')}<p id="q-drag-message" role="status"></p></div>`}
  </section>`;
}
// Build the discovery collection and decoration choices from earned concept IDs.
function renderBook() {
  const earned = CONCEPTS.filter(item => state.discoveries.includes(item.id));
  return `<section class="q-page q-book"><button class="q-back" data-nav="home">← Adventure map</button><p class="q-eyebrow">My Discovery Book</p><h1 data-focus tabindex="-1">Ideas I can use again.</h1><p>Each page explains something you learned while playing.</p>
    ${earned.length ? `<div class="q-book-pages">${earned.map(item => `<article class="q-discovery"><div>${artwork(item.artworkId)}</div><section><p class="q-eyebrow">Discovered</p><h2>${escape(item.title)}</h2><p>${escape(item.text)}</p></section></article>`).join('')}</div>` : `<div class="q-book-empty">${artwork('pip', { expression: 'thinking' })}<h2>Your first page is waiting.</h2><p>Play a story or sort pictures to find your first idea.</p>${button('Choose a story →', 'data-picker')}</div>`}
    <div class="q-step-actions">${button('My creations →', 'data-nav="creations"', 'secondary')}${button('Back to the map', 'data-nav="home"', 'quiet')}</div></section>`;
}
// Keep making separate from solving: selecting a saved design does not start its
// story again. Every postcard belongs to a finished story and exports on this device.
function renderCreations() {
  const earned = CONCEPTS.filter(item => state.discoveries.includes(item.id));
  const finished = MISSIONS.filter(item => Object.hasOwn(state.completed, item.id));
  return `<section class="q-page q-creations-studio"><button class="q-back" data-nav="home">← Adventure map</button><p class="q-eyebrow">My creations</p><h1 data-focus tabindex="-1">Make something that's yours.</h1><p>Design a postcard. Decorate your map. There are no right or wrong colours here.</p>
    <section class="q-created-postcards"><h2>My story postcards</h2><p>Pick a finished story to change its colours and sticker, then save a picture.</p>${finished.length ? `<div class="q-creation-grid">${finished.map(item => `<button class="q-creation-card" data-postcard="${attr(item.id)}"><span>${postcard(item, state.postcards?.[item.id])}</span><strong>${escape(item.title)}</strong><small>Open my design →</small></button>`).join('')}</div>` : `<div class="q-creation-empty">${artwork('pip', {expression:'thinking'})}<p>Finish one story to unlock its postcard.</p>${button('Choose my first story →', 'data-picker')}</div>`}</section>
    ${earned.length ? `<section class="q-decorating"><p class="q-eyebrow">Make this place your own</p><h2>A little garden? A splash of colour?</h2><p>Choose a decoration, then choose a place. You can move it whenever you like.</p><div class="q-decoration-picks">${[...new Set(earned.map(item => item.decoration))].map(id => `<div class="q-decoration-tile"><button data-decoration="${attr(id)}" aria-pressed="${selectedDecoration === id}">${artwork(id)}<span>${escape(id)}</span></button><button class="q-drag-handle" data-decoration-drag="${attr(id)}" aria-label="Drag ${attr(id)} decoration">⠿</button></div>`).join('')}</div><div class="q-decor-world">${neighborhood({ unlocked: state.discoveries, decorations: state.decorations })}</div><div class="q-decoration-slots">${LOCATIONS.map(place => `<button data-decoration-slot="${attr(place.id)}"><strong>${escape(place.title)}</strong><span>${escape(state.decorations[place.id] || 'An open space')}</span><small>${selectedDecoration ? `Place ${escape(selectedDecoration)} here` : 'Choose a decoration first'}</small></button>`).join('')}</div><p class="q-small-note">Make this little world look like yours.</p></section>` : ''}
    ${!earned.length ? '<section class="q-creation-empty"><h2>My map decorations</h2><p>Find an idea in a story or sorting game to unlock your first decoration.</p></section>' : ''}
    <div class="q-step-actions">${button('Read my Discovery Book', 'data-nav="book"', 'secondary')}${button('Back to the map', 'data-nav="home"', 'quiet')}</div></section>`;
}

// Build the optional parent explanation, source links and relevant discussion prompt.
// The historic internal name grownups means the parent guide, not a separate child audience.
function renderGrownups() {
  return renderParentGuide({ activeMission: mission(), canContinueMission: Boolean(state.activeMission && state.activeMission.step !== 'outcome'), canContinueSorting: Boolean(state.sorting && state.sorting.status !== 'complete'), storageAvailable, reviewFixture: Boolean(document.querySelector('[name="quest-review-fixture"]')), escape });
}


// Render a completed story with its saved theme/sticker and the export control.
function renderPostcard() {
  const item = MISSIONS.find(value => value.id === postcardId);
  if (!item || !Object.hasOwn(state.completed, item.id)) { postcardId = null; return renderBook(); }
  const design = state.postcards?.[item.id] || { theme: 'sunshine', sticker: 'star' };
  return `<section class="q-page q-postcard-studio"><button class="q-back" data-nav="creations">← My creations</button><p class="q-eyebrow">The next-chapter studio</p><h1 data-focus tabindex="-1">Your story. Your signature style.</h1><p>Turn <strong>${escape(item.title)}</strong> into a little piece of art.</p><div class="q-postcard-layout"><div class="q-postcard-preview" data-postcard-preview aria-label="Your designed story postcard">${postcard(item, design)}</div><div class="q-postcard-tools"><fieldset><legend>Set the mood</legend><div class="q-palette-choices">${validThemes.map(theme => `<button class="theme-${theme}" data-postcard-theme="${theme}" aria-pressed="${design.theme === theme}"><span aria-hidden="true"></span>${escape(theme)}</button>`).join('')}</div></fieldset><fieldset><legend>Leave your mark</legend><div class="q-sticker-choices">${validStickers.map(sticker => `<button data-postcard-sticker="${sticker}" aria-pressed="${design.sticker === sticker}"><b aria-hidden="true">${{star:'★',leaf:'<svg viewBox="0 0 32 32" width="30" height="30" style="width:30px;height:30px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M7 24C1 10 14 4 27 4c0 14-5 25-20 20Z" fill="currentColor" fill-opacity=".18"/><path d="M5 28 22 10m-9 10-1-7m6 2 6-1"/></svg>',spark:'✦'}[sticker]}</b>${escape(sticker)}</button>`).join('')}</div></fieldset><p class="q-small-note">${storageAvailable ? 'Your design stays in My creations.' : 'Your design stays here during this visit.'}</p>${button('Save my postcard ↓', 'data-save-postcard')}<p class="q-small-note" id="q-download-message" role="status">Saves a picture to this device.</p>${button('Back to My creations', 'data-nav="creations"', 'quiet')}</div></div></section>`;
}
// Replace the current game markup, update the title/count/motion setting, then reattach handlers.
// Because innerHTML replaces elements, old drag listeners must be removed first.
// Rendering and animation replay do not change completed stories or rewards.
function render(effect = '', { fromProgress = null } = {}) {
  clearGameEffects();
  pendingHudProgress = fromProgress;
  cleanDemo();
  cleanDrag();
  announceNode.textContent = '';
  document.documentElement.dataset.motion = reduced() ? 'reduce' : 'full';
  app.className = effect;
  updateHud(fromProgress || progression(state));
  document.body.dataset.questView = picker ? 'picker' : postcardId ? 'postcard' : state.view;
  app.innerHTML = (postcardId ? renderPostcard() : picker ? renderPicker() : ({ home: renderHome, mission: renderMission, sorting: renderSorting, book: renderBook, creations: renderCreations, grownups: renderGrownups }[state.view] || renderHome)());
  document.querySelector('#book-count').textContent = String(state.discoveries.length);
  document.title = `${postcardId ? 'My story postcard' : picker ? 'Choose a mission' : state.view === 'mission' ? mission()?.title || 'Adventure' : state.view === 'book' ? 'Discovery Book' : state.view === 'creations' ? 'My creations' : state.view === 'sorting' ? 'Sorting Station' : state.view === 'grownups' ? 'About this adventure' : 'Help Pip and Flo'} | FixForward Quest`;
  bind();
  updateAudio();
}
// Open the designer only for a completed mission; preserve the chosen story in a temporary ID.
function openPostcard(id) {
  if (!Object.hasOwn(state.completed, id)) return;
  stopReading(); cleanDownload(); picker = null; postcardId = id;
  state = transition(state, { type: 'NAVIGATE', view: 'creations' }); persist();
  render('q-play-enter'); rememberRoute(); focus(); window.scrollTo({ top: 0, behavior: 'auto' });
}
// Generate a self-contained SVG and ask the browser to download it using a temporary Blob URL.
// No upload occurs. The status says the download started, not that a file was verified on disk.
function savePostcard() {
  const item = MISSIONS.find(value => value.id === postcardId);
  if (!item || !Object.hasOwn(state.completed, item.id)) return;
  const message = app.querySelector('#q-download-message');
  if (!window.URL?.createObjectURL) { message.textContent = 'Picture saving is unavailable here. You can still create your design.'; return; }
  cleanDownload();
  const picture = postcard(item, state.postcards?.[item.id]);
  downloadUrl = window.URL.createObjectURL(new window.Blob([picture], { type: 'image/svg+xml;charset=utf-8' }));
  const link = document.createElement('a'); link.href = downloadUrl; link.download = postcardFilename(item); link.hidden = true;
  document.body.append(link); link.click(); link.remove();
  message.textContent = 'Postcard download started. Check your browser’s downloads.';
}
// An explicit hello tap introduces each memorable name through the same visible
// words and recorded narrator. It changes no progress and never starts on arrival.
function greet(id) {
  const message = id === 'pip' ? STORY_LINES.pipHello : id === 'flo' ? STORY_LINES.floHello : null;
  if (!message) return;
  const bubble = app.querySelector('.q-world-dialogue'); bubble.textContent = message;
  const friends = app.querySelector('.q-greeting-friends'); friends.classList.remove('q-play-enter');
  // Replacing only the tapped guide gives it one finite greeting, without moving the map.
  const guide = friends.querySelector(`[data-greet="${id}"]`); guide.innerHTML = `${artwork(id, { expression: 'success' })}<span>${id === 'pip' ? 'Pip' : 'Flo'}</span>`;
  guide.className = 'q-play-enter';
  speakText(message);
}

// Open a temporary mission chooser, optionally limited to a neighbourhood place.
function openPicker(place = null) { stopReading(); cleanDownload(); postcardId = null; picker = { place, character: null }; render('q-play-enter'); rememberRoute(); focus(); window.scrollTo({ top: 0, behavior: 'auto' }); }
// Record a valid clue, then highlight it in the same story scene. The larger
// picture and exact words explain the evidence; a clue alone does not add Sparks.
function clue(id) {
  const item = mission(); const entry = item?.clues.find(value => value.id === id);
  if (!entry) return;
  pictureView = { missionId: item.id, clueId: id, returnSelector: pictureView?.returnSelector || (state.settings.mode === 'challenge' ? `[data-clue="${id}"]` : '[data-show-facts]') };
  const found = dispatch({ type: 'COLLECT_CLUE', id }, { focusTarget: null, speak: false });
  if (!found) { stopReading(); render(); }
  focus('[data-picture-help-focus]');
  if (state.settings.narration) speakText(entry.text);
  else if (found) rewardVoice.play({ kind: 'clue', seed: id });
  if (found) showGameFeedback(true, 'Aha! You found the clue!');
}

// Record that help was used and show the current story/card hint. Help never deducts Sparks.
function hint() {
  dispatch({ type: 'HINT' }, { focusTarget: null, speak: false });
  const run = state.sorting;
  const item = mission();
  pictureView = state.view === 'sorting' ? { sortId: run?.itemIds[run.index], returnSelector: '[data-hint]' }
    : { missionId: item?.id, clueId: item?.clues[0]?.id, returnSelector: '[data-hint]' };
  stopReading(); render(); focus('[data-picture-help-focus]');
  if (state.settings.narration) speakText(app.querySelector('[data-picture-help-text]')?.textContent);
}
// Close the optional picture expansion without clearing answers or leaving play.
function closePictureHelp() {
  const returnSelector = pictureView?.returnSelector || '[data-show-facts]';
  pictureView = null; stopReading(); render(); focus(returnSelector);
}
// Touching the actual picture offers the same tap-to-place alternative as Move.
// This is only a visual selection: the rule engine waits for a destination/drop.
function pickSortPicture() {
  sortPicked = true;
  app.querySelector('.q-sort-object')?.classList.add('q-picked-object');
  app.querySelector('[data-sort-picture]')?.setAttribute('aria-pressed', 'true');
  const instruction = app.querySelector('.q-sort-instruction');
  if (instruction) instruction.textContent = 'Picture picked! Tap the place you choose, or drag the picture there.';
  announce('Picture picked. Tap a place to put it there.');
}
// Open the optional story envelope and discussion prompt; solo play remains possible.
// From sorting, this opens the parent guide instead of inventing an appliance report.
function companion() {
  const item = mission();
  if (state.view === 'sorting') { navigate('grownups'); return; }
  const evidence = item?.cooperative;
  const report = evidence ? item.clues.find(entry => entry.id === 'repair-report') : null;
  modal(evidence?.title || 'Play together', `<p>${escape(evidence?.text || item?.fictionalContext || '')}</p>${report ? `<h3>${escape(report.title)}</h3><p>${escape(report.text)}</p>` : ''}<blockquote>${escape(evidence?.prompt || item?.discussionPrompt || 'What clue makes you think that?')}</blockquote><p class="q-small-note">The envelope is yours to open. Read it solo or team up with someone.</p>${button('Back to my mission', 'data-close-clue')}`, app.querySelector('[data-companion]') || app.querySelector('[data-evidence]'));
  dialogBody.querySelector('[data-close-clue]').onclick = closeDialog;
}
// Wire the saved play/read/motion preferences and an explicit reset confirmation.
// Reset clears only Quest progress and temporary UI state, not the adult journey.
function settings() {
  modal('Your adventure, your way', `<div class="q-settings"><label>Play style<select id="q-mode"><option value="guided" ${state.settings.mode === 'guided' ? 'selected' : ''}>Guided — picture facts stay visible</option><option value="challenge" ${state.settings.mode === 'challenge' ? 'selected' : ''}>Challenge — discover the clues</option></select></label><label>Movement<select id="q-motion"><option value="auto" ${state.settings.motion === 'auto' ? 'selected' : ''}>Follow my device</option><option value="full" ${state.settings.motion === 'full' ? 'selected' : ''}>Game animations</option><option value="reduce" ${state.settings.motion === 'reduce' ? 'selected' : ''}>Less movement</option></select></label><label class="q-check"><input id="q-narration" type="checkbox" ${state.settings.narration ? 'checked' : ''}> Read story steps aloud</label>${window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? '<p class="q-small-note">Your device asks for less movement. Follow my device keeps that choice. Game animations switches on flying stars and moving pictures.</p>' : ''}<p>Our story voice is made with AI. Other words may use your device voice, which can need an online service. Story words, Pause, Resume and Stop stay available while listening.</p><p>${storageAvailable ? 'Your discoveries are saved in this browser.' : 'Saving is blocked here. You can still play during this visit.'}</p><button class="q-button secondary" id="q-reset">Reset my adventure</button><p class="q-small-note">Reset clears your stories, Sparks, postcards and decorations.</p></div>`);
  for (const [id, key] of [['q-mode', 'mode'], ['q-motion', 'motion'], ['q-narration', 'narration']]) dialogBody.querySelector(`#${id}`).onchange = event => {
    dispatch({ type: 'SET_SETTING', key, value: key === 'narration' ? event.target.checked : event.target.value }, { focusTarget: null, speak: false });
    if (key === 'narration' && state.settings.narration) readScene();
  };
  dialogBody.querySelector('#q-reset').onclick = () => {
    modal('Start a new adventure?', `<p>This clears your stories, Sparks, postcards and decorations in this browser. The other FixForward tab stays as it is.</p><div class="q-step-actions">${button('Keep my adventure', 'id="q-keep"', 'secondary')}${button('Yes, reset my adventure', 'id="q-confirm-reset"')}</div>`);
    dialogBody.querySelector('#q-keep').onclick = closeDialog;
    dialogBody.querySelector('#q-confirm-reset').onclick = () => { stopReading(); if (!clearProgress()) { announce('This browser could not clear saved progress. Your adventure is still here.'); dialogBody.querySelector('#q-confirm-reset').textContent = 'Could not reset. Try again'; return; } historyEpoch += 1; state = createState(); sounds.enable(false); picker = null; selectedAction = null; selectedDecoration = null; postcardId = null; storyBefore = false; lastReward = null; reflectionHint = null; cleanDownload(); closeDialog(); render('q-play-enter'); focus(); rememberRoute(true); announce('Your new adventure is ready.'); };
  };
}
// Adapt the generic pointer helper to this screen and remember its cleanup callback.
// Targets are read when needed so scrolling/resizing cannot reuse stale drop positions.
function drag(handle, targets, onDrop, source) {
  dragCleanups.push(bindDrag(handle, {
    targets, onDrop, ghostSource: source,
    onHover: id => targets().forEach(target => target.element.classList.toggle('q-drag-over', target.id === id)),
    onLift: () => announce('Picture picked up. Move to a labelled place, or cancel and use the tap buttons.'),
    onCancel: () => { const message = app.querySelector('#q-drag-message'); if (message) message.textContent = 'No answer recorded. Try again, or tap a place.'; announce('Returned to the start. No answer recorded.'); }
  }));
}
// Connect data-* attributes on newly rendered controls to actions.
// Presentation-only interactions redraw locally; progress changes go through dispatch().
// Taps, keyboard-activated buttons and successful drags share the same rule-engine actions.
function bind() {
  app.querySelectorAll('[data-picture-clue]').forEach(control => { control.onclick = () => clue(control.dataset.pictureClue); });
  app.querySelectorAll('[data-hear-picture]').forEach(control => { control.onclick = () => speakText(mission()?.clues.find(entry => entry.id === control.dataset.hearPicture)?.text); });
  app.querySelector('[data-hear-sort-clue]')?.addEventListener('click', () => speakText(SORT_ITEMS.find(entry => entry.id === state.sorting?.itemIds[state.sorting.index])?.clue));
  app.querySelectorAll('[data-close-picture-help]').forEach(control => { control.onclick = closePictureHelp; });
  app.querySelector('[data-show-facts]')?.addEventListener('click', showFacts);
  app.querySelector('[data-enable-game-sound]')?.addEventListener('click', toggleSound);
  app.querySelector('[data-enable-game-motion]')?.addEventListener('click', () => toggleMotion(true));
  app.querySelector('[data-parent-demo]')?.addEventListener('click', event => {
    const control = event.currentTarget;
    const demo = control.closest('.q-parent-demo');
    cleanDemo(); stopReading();
    // This authored preview changes pictures only. It never answers a mission,
    // records a discovery, or changes the child's saved score.
    const showEnding = () => {
      if (!demo.isConnected) return;
      demo.dataset.parentDemoStage = 'after';
      demo.classList.add('q-story-reveal');
      control.textContent = 'Watch again';
      control.setAttribute('aria-pressed', 'true');
      announce('Story preview: the checked fan has a new home.');
      demoTimer = null;
    };
    if (demo.dataset.parentDemoStage === 'after') {
      demo.dataset.parentDemoStage = 'before'; demo.classList.remove('q-story-reveal');
      control.textContent = 'See the story change'; control.setAttribute('aria-pressed', 'false');
      // With reduced motion, each press simply selects a still before/after frame.
      if (!reduced()) demoTimer = window.setTimeout(showEnding, 650);
    } else showEnding();
  });
  app.querySelectorAll('[data-hear]').forEach(el => el.onclick = () => {
    // Read the selected fact itself rather than falling back to the story heading.
    if (el.dataset.hearFact) { speakText(mission()?.clues.find(entry => entry.id === el.dataset.hearFact)?.text); return; }
    const context = el.closest('.q-reflection') || el.closest('.q-guide-dialogue');
    if (context?.classList.contains('q-guide-dialogue')) { speakText(state.activeMission.step === 'intro' ? `${mission().fictionalContext} ${guideLine(mission(), state.activeMission)}` : guideLine(mission(), state.activeMission)); return; }
    if (context?.classList.contains('q-reflection')) { speakText(state.reflections[mission().id] ? mission().reflection.explanation : mission().reflection.prompt); return; }
    readScene();
  });
  app.querySelectorAll('[data-word-help]').forEach(el => el.onclick = wordHelp);
  app.querySelectorAll('[data-level-info]').forEach(el => el.onclick = levelInfo);
  app.querySelector('[data-play-ending]')?.addEventListener('click', () => { storyBefore = false; lastReward = null; stopReading(); render('q-story-reveal'); focus('[data-play-ending]'); });
//   Wrong reflection choices show temporary help only; correct choices pass engine validation.
  app.querySelectorAll('[data-reflection]').forEach(el => el.onclick = () => {
    const item = mission();
    if (!item || !state.completed[item.id]) return;
    if (isReflectionCorrect(item, el.dataset.reflection)) { reflectionHint = null; dispatch({type:'CHECK_REFLECTION', missionId:item.id, answerId:el.dataset.reflection}, {focusTarget:'[data-reflection-focus]'}); }
    else { reflectionHint = item.id; lastReward = null; render(); showGameFeedback(false, 'Try the other picture!'); if (!audioRequested) sounds.play('retry'); focus('[data-reflection-focus]'); announce('Here’s a clue. You can try again.'); }
  });
  app.querySelectorAll('[data-greet]').forEach(el => el.onclick = () => greet(el.dataset.greet));
  app.querySelectorAll('[data-postcard]').forEach(el => el.onclick = () => openPostcard(el.dataset.postcard));
  app.querySelectorAll('[data-story-view]').forEach(el => el.onclick = () => {
    storyBefore = el.dataset.storyView === 'before'; lastReward = null; stopReading(); render(storyBefore ? '' : 'q-story-reveal');
    focus(`[data-story-view="${el.dataset.storyView}"]`);
    announce(storyBefore ? 'The picture before your choice.' : 'The next chapter your choice made possible.');
  });
  for (const [attribute, key] of [['data-postcard-theme','theme'], ['data-postcard-sticker','sticker']]) app.querySelectorAll(`[${attribute}]`).forEach(el => el.onclick = () => dispatch({ type: 'DESIGN_POSTCARD', id: postcardId, [key]: el.getAttribute(attribute) }, { focusTarget: `[${attribute}="${el.getAttribute(attribute)}"]`, speak: false }));
  app.querySelector('[data-save-postcard]')?.addEventListener('click', savePostcard);
  app.querySelectorAll('[data-nav]').forEach(el => el.onclick = () => navigate(el.dataset.nav));
  app.querySelectorAll('[data-picker]').forEach(el => el.onclick = () => openPicker());
  app.querySelectorAll('[data-place]').forEach(el => el.onclick = () => openPicker(el.dataset.place));
  app.querySelectorAll('[data-character]').forEach(el => el.onclick = () => { picker.character = el.dataset.character; render('q-play-enter'); rememberRoute(true); focus(`[data-character="${picker.character}"]`); });
  app.querySelector('[data-all-missions]')?.addEventListener('click', () => { picker = { character: null, place: null }; render(); rememberRoute(true); focus(); });
  app.querySelectorAll('[data-mission]').forEach(el => el.onclick = () => { picker = null; postcardId = null; selectedAction = null; openClueList = false; dispatch({ type: 'CHOOSE_MISSION', id: el.dataset.mission }); window.scrollTo({ top: 0, behavior: 'auto' }); });
  app.querySelectorAll('[data-continue]').forEach(el => el.onclick = () => navigate('mission'));
  app.querySelectorAll('[data-mode]').forEach(el => el.onclick = () => dispatch({ type: 'SET_SETTING', key: 'mode', value: el.dataset.mode }, { focusTarget: `[data-mode="${el.dataset.mode}"]`, speak: false }));
  app.querySelector('[data-start-mission]')?.addEventListener('click', () => dispatch({ type: 'START_MISSION' }));
  app.querySelectorAll('[data-clue]').forEach(el => el.onclick = () => clue(el.dataset.clue));
  app.querySelector('[data-clue-list]')?.addEventListener('click', () => { openClueList = !openClueList; render(); focus('[data-clue-list]'); });
  app.querySelector('[data-open-plan]')?.addEventListener('click', openPlan);
//   A single slot is filled immediately. Multiple slots ask which item receives the selected action.
  app.querySelectorAll('[data-action-select]').forEach(el => el.onclick = () => { selectedAction = el.dataset.actionSelect; const item = mission(); if (item?.slots.length === 1) dispatch({ type:'SET_PLAN', slotId:item.slots[0].id, actionId:selectedAction }, {focusTarget:`[data-action-select="${selectedAction}"]`, speak:false}); else { render(); focus(`[data-action-select="${selectedAction}"]`); } });
  app.querySelectorAll('[data-plan-slot]').forEach(el => el.onclick = () => { if (selectedAction) { dispatch({ type: 'SET_PLAN', slotId: el.dataset.planSlot, actionId: selectedAction }, { focusTarget: `[data-plan-slot="${el.dataset.planSlot}"]`, speak: false }); announce('Action added to your plan.'); } else announce('Choose an action first, then choose this space.'); });
  app.querySelectorAll('[data-remove-slot]').forEach(el => el.onclick = () => dispatch({ type: 'REMOVE_PLAN', slotId: el.dataset.removeSlot }, { focusTarget: `[data-plan-slot="${el.dataset.removeSlot}"]`, speak: false }));
  app.querySelectorAll('[data-action-drag]').forEach(el => drag(el, () => [...app.querySelectorAll('[data-plan-slot]')].map(slot => ({ id: slot.dataset.planSlot, element: slot })), slotId => { selectedAction = null; dispatch({ type: 'SET_PLAN', slotId, actionId: el.dataset.actionDrag }, { focusTarget: `[data-plan-slot="${slotId}"]`, speak: false }); }, el.closest('.q-action-tile').querySelector('.q-action-art')));
  for (const [selector, type, target] of [['data-check-plan', 'CHECK_PLAN', '[data-feedback-focus]'], ['data-retry', 'RETRY_PLAN', '[data-plan-focus]'], ['data-complete', 'COMPLETE_MISSION', '[data-focus]'], ['data-replay', 'REPLAY_MISSION', '[data-focus]']]) app.querySelector(`[${selector}]`)?.addEventListener('click', () => { selectedAction = null; dispatch({ type }, { focusTarget: target }); });
  app.querySelector('[data-revisit-clues]')?.addEventListener('click', () => dispatch({ type: 'EXPLORE_AGAIN' }));
  app.querySelectorAll('[data-sort-start]').forEach(el => el.onclick = () => { picker = null; if (state.sorting && state.sorting.status !== 'complete') navigate('sorting'); else if (!dispatch({ type: 'START_SORT' })) { render(); focus(); } window.scrollTo({ top: 0, behavior: 'auto' }); });
//   Both a destination button and a successful drop use this one answer path.
  const answerSort = destinationId => dispatch({ type: 'ANSWER_SORT', destinationId }, { focusTarget: '[data-feedback-focus]' });
  app.querySelectorAll('[data-destination]').forEach(el => el.onclick = () => answerSort(el.dataset.destination));
  const sortHandle = app.querySelector('[data-sort-drag]');
  const pictureHandle = app.querySelector('[data-sort-picture]:not(:disabled)');
  for (const handle of [sortHandle, pictureHandle].filter(Boolean)) {
    handle.onclick = pickSortPicture;
    drag(handle, () => [...app.querySelectorAll('[data-destination]')].map(el => ({ id: el.dataset.destination, element: el })), answerSort, app.querySelector('.q-sort-picture > svg'));
  }
  app.querySelector('[data-sort-next]')?.addEventListener('click', () => dispatch({ type: 'NEXT_SORT' }));
  app.querySelector('[data-sort-retry]')?.addEventListener('click', () => dispatch({ type: 'RETRY_SORT' }));
  app.querySelectorAll('[data-hint]').forEach(el => el.onclick = hint);
  app.querySelectorAll('[data-companion], [data-evidence]').forEach(el => el.onclick = companion);
  app.querySelectorAll('[data-settings]').forEach(el => el.onclick = settings);
  app.querySelectorAll('[data-decoration]').forEach(el => el.onclick = () => { selectedDecoration = el.dataset.decoration; render(); focus(`[data-decoration="${selectedDecoration}"]`); announce(`Choose a place for your ${selectedDecoration}.`); });
  app.querySelectorAll('[data-decoration-slot]').forEach(el => el.onclick = () => { if (selectedDecoration) dispatch({ type: 'PLACE_DECORATION', slotId: el.dataset.decorationSlot, decorationId: selectedDecoration }, { focusTarget: `[data-decoration-slot="${el.dataset.decorationSlot}"]`, speak: false }); else announce('Choose a decoration first.'); });
  app.querySelectorAll('[data-decoration-drag]').forEach(el => drag(el, () => [...app.querySelectorAll('[data-decoration-slot]')].map(slot => ({ id: slot.dataset.decorationSlot, element: slot })), slotId => { selectedDecoration = null; dispatch({ type: 'PLACE_DECORATION', slotId, decorationId: el.dataset.decorationDrag }, { focusTarget: `[data-decoration-slot="${slotId}"]`, speak: false }); }, el.closest('.q-decoration-tile').querySelector('[data-decoration] > svg')));
}

// A saved sound preference still needs a real browser gesture after reloading.
// Unlock on pointer/keyboard activation, without queueing sounds for later playback.
function unlockGameAudio(event) {
  if (event.isTrusted && state.settings.sound) void sounds.unlock();
}
// A tiny ring makes a finger press visible on glass. It is decorative, has no
// haptic permission requirement, and is omitted when less movement is requested.
function showTouch(event) {
  if (!event.isTrusted || event.pointerType === 'mouse' || reduced() || !event.target.closest?.('button')) return;
  const ring = document.createElement('span'); ring.className = 'q-tap-ring';
  ring.setAttribute('aria-hidden', 'true'); ring.style.left = `${event.clientX}px`; ring.style.top = `${event.clientY}px`;
  ring.addEventListener('animationend', () => { ring.remove(); touchRings.delete(ring); }, { once: true });
  touchRings.add(ring); document.body.append(ring);
}
document.addEventListener('pointerdown', event => { unlockGameAudio(event); showTouch(event); }, { passive: true });
document.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') unlockGameAudio(event); });
// Play the press in capture phase, so a success/retry chime can replace it after
// the game checks the answer. Narration and its controls always take priority.
document.addEventListener('click', event => {
  const control = event.target.closest?.('button');
  if (!event.isTrusted || !control || control.disabled || audioRequested || control.matches('[data-game-sound],[data-enable-game-sound],[data-hear],#read-aloud') || control.closest('[data-audio-dock]')) return;
  sounds.play('tap');
}, true);
const chromeObserver = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(measureChrome) : null;
chromeObserver?.observe(document.querySelector('.q-game-chrome'));
window.addEventListener('resize', measureChrome);

// The header/footer survive render(), so attach their handlers once at startup.
document.querySelectorAll('.q-header [data-nav], .q-footer [data-nav]').forEach(el => el.onclick = () => navigate(el.dataset.nav));
document.querySelector('#q-dialog-close').onclick = () => { stopReading(); closeDialog(); };
dialog.addEventListener('cancel', () => { stopReading(); });
document.querySelector('#quest-settings').onclick = settings;
document.querySelector('#read-aloud').onclick = readScene;
// Release temporary browser resources when leaving the page; saved progress remains.
window.addEventListener('pagehide', event => { stopReading(); sounds.stop(); clearGameEffects(); cleanDrag(); cleanDownload(); cleanDemo(); if (!event.persisted) { navigation?.dispose(); narration.dispose(); sounds.dispose(); rewardFx.destroy(); chromeObserver?.disconnect(); } });
// A browser may cache the whole page when leaving Quest. Reattach cleaned drag
// listeners on return, without replaying a celebration or any completion action.
window.addEventListener('pageshow', event => { if (event.persisted) { celebration = false; lastReward = null; render(); } });
const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
media?.addEventListener?.('change', () => { document.documentElement.dataset.motion = reduced() ? 'reduce' : 'full'; if (reduced()) clearGameEffects(); updateHud(); });
// The explicit parent URL changes only the initial view, without rewriting the child save.
bindAudio();
if (new URLSearchParams(window.location.search).get('view') === 'parents') state = { ...state, view: 'grownups' };
navigation = createNavigation({ initialRoute: currentRoute(), normalizeRoute, onRestore: restoreRoute });
restoreRoute(navigation.getRoute(), { moveFocus: false });
// Keep recovery visible after the first renderer clears its normal live region.
if (restored.status === 'invalid') announce('We could not read the saved adventure. A new adventure is ready.');
