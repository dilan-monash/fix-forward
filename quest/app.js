// QUEST SCREEN CONTROLLER: loaded by quest/index.html as a native browser module.
// Read content.js for the story facts, engine.js for allowed changes, and
// progression.js for rewards. This file turns those results into visible screens.
// A typical click follows bind -> dispatch -> transition -> persist -> render.
// There is no Quest API request here. See docs/DEVELOPER_HANDOVER.md for the full map.
import { MISSIONS, SORT_ITEMS, CONCEPTS, SOURCES, LOCATIONS } from './content.js';
import { createState, transition, suggestedMission } from './engine.js';
import { loadProgress, saveProgress, clearProgress } from './storage.js';
import { bindDrag } from './drag.js';
import { artwork, neighborhood, scene, passportStamp, rewardBurst, levelBadge } from './art.js';
import { progression, LEVELS, isReflectionCorrect } from './progression.js';
import { postcard, postcardFilename, validThemes, validStickers } from './postcard.js';

// Stable elements come from quest/index.html. The main render replaces #quest-app
// contents; modal() updates the separate dialog body.
const app = document.querySelector('#quest-app');
const main = document.querySelector('#quest-main');
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
let speechMessage = '';
let postcardId = null;
let storyBefore = false;
let downloadUrl = null;
let lastReward = null;
let reflectionHint = null;
const greetingCounts = { pip: 0, flo: 0 };
// Treat inserted text as text, not executable HTML. attr uses the same escaping for attributes.
const escape = (text) => String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const attr = escape;
const soundIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor" fill-opacity=".18"/><path d="M17 8q4 4 0 8m3-11q7 7 0 14"/></svg>';
// Small read-only lookups translate saved IDs into authored records and readable labels.
const mission = () => MISSIONS.find(item => item.id === state.activeMission?.id);
const concept = id => CONCEPTS.find(item => item.id === id);
const locationTitle = id => LOCATIONS.find(item => item.id === id)?.title || 'Our neighbourhood';
// Either the child setting or the operating system can request less movement.
const reduced = () => state.settings.motion === 'reduce' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Shared markup helper: text and data are trusted templates assembled by callers.
const button = (text, data, style = 'primary') => `<button class="q-button ${style}" ${data}>${text}</button>`;
// Put a short update in the polite live region so a screen reader hears feedback.
function announce(text) { announceNode.textContent = text; }
// Cancel an old spoken message before a new screen or message replaces it.
function stopReading() { window.speechSynthesis?.cancel(); }
// Release pointer listeners and temporary drag pictures before their screen disappears.
function cleanDrag() { dragCleanups.forEach(clean => clean()); dragCleanups = []; }
// Release the temporary in-memory SVG download URL; it is not a hosted file.
function cleanDownload() { if (downloadUrl) window.URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
// Try saving the approved state. Storage failure changes the notice, not the ability to play.
function persist() { if (!saveProgress(state)) storageAvailable = false; }
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
  const next = transition(state, action);
  if (next === state) return false;
  const newScene = next.view !== state.view || next.activeMission?.step !== state.activeMission?.step || next.activeMission?.id !== state.activeMission?.id || next.sorting?.index !== state.sorting?.index;
  if (action.type === 'CHOOSE_MISSION' || action.type === 'COMPLETE_MISSION' || action.type === 'REPLAY_MISSION') storyBefore = false;
  const nextProgress = progression(next);
  lastReward = nextProgress.points > previousProgress.points ? { amount: nextProgress.points - previousProgress.points, levelUp: nextProgress.level > previousProgress.level, level: nextProgress.level, title: nextProgress.title } : null;
  if (newScene) reflectionHint = null;
  state = next;
  persist();
  stopReading();
  render(newScene ? (action.type === 'COMPLETE_MISSION' ? 'q-story-reveal' : 'q-play-enter') : '');
  if (focusTarget) focus(focusTarget);
  if (speak && state.settings.narration) readScene();
  return true;
}
// Change the persistent top-level view and clear temporary panels/selections.
// Finishing a dialog or switching screens must not leave speech, drag or download resources behind.
function navigate(view) {
  picker = null; postcardId = null; selectedAction = null; selectedDecoration = null; openClueList = false; lastReward = null; reflectionHint = null;
  cleanDownload();
  closeDialog();
  stopReading();
  if (!dispatch({ type: 'NAVIGATE', view })) { render(); focus(); }
  window.scrollTo({ top: 0, behavior: 'auto' });
}
// Open a native dialog from trusted app-generated markup and remember who opened it.
// The heading is escaped; callers must escape any data inserted into the body.
function modal(title, body, returnTarget = document.activeElement) {
  dialogReturn = returnTarget;
  dialogBody.innerHTML = `<p class="q-eyebrow">A closer look</p><h2 id="q-dialog-title" tabindex="-1">${escape(title)}</h2>${body}`;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('#q-dialog-title').focus();
}
// Close the panel and return focus to its opener if that element still exists.
function closeDialog() {
  stopReading();
  if (dialog.open) dialog.close();
  if (dialogReturn?.isConnected) dialogReturn.focus({ preventScroll: true });
  dialogReturn = null;
}
// Ask the browser to read the supplied words, preferring a local English voice.
// A browser may use an online voice; unavailable speech leaves the visible words usable.
function speakText(text) {
  stopReading();
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    speechMessage = 'The voice is not available here. You can still read the words.';
    announce(speechMessage); return;
  }
  const utterance = new window.SpeechSynthesisUtterance(text || 'Let’s find a clue.');
  utterance.lang = 'en-AU'; utterance.rate = .85;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(voice => voice.lang === 'en-AU' && voice.localService) || voices.find(voice => voice.lang.startsWith('en') && voice.localService);
  if (preferred) utterance.voice = preferred;
  utterance.onerror = () => announce('The voice could not read that. The words are still here.');
  window.speechSynthesis.speak(utterance);
}
// Choose the most relevant visible text, prioritising an open dialog over the page.
function readScene() {
  const reading = app.querySelector('.q-feedback') || app.querySelector('.q-reflection') || app.querySelector('.q-plan-instruction') || app.querySelector('.q-sort-object') || app.querySelector('[data-read]');
  const text = dialog.open ? dialogBody.innerText : reading?.innerText || app.querySelector('h1')?.textContent;
  speakText(text);
}
// Return shared button markup; bind() attaches the context-specific speech action.
function listenButton(text = 'Hear it', extra = '') {
  return `<button class="q-listen" data-hear ${extra}><span aria-hidden="true">${soundIcon}</span>${text}</button>`;
}
// Build the level badge and progress meter from derived rewards, not a stored score.
function renderHud() {
  const progress = progression(state);
  return `<div class="q-player-strip" aria-label="Your Quest progress"><button class="q-level-chip" data-level-info aria-label="Level ${progress.level}: ${escape(progress.title)}. ${progress.points} Sparks. See rewards."><span>${levelBadge(progress.level)}</span><span><small>LEVEL ${progress.level}</small><strong>${escape(progress.title)}</strong></span></button><div class="q-spark-meter"><div><b><span aria-hidden="true">✦</span> ${progress.points} <span>Sparks</span></b><small>${progress.nextThreshold ? `${progress.pointsRemaining} to Level ${progress.level+1}` : 'All four level badges earned'}</small></div><div class="q-spark-track" role="progressbar" aria-label="Progress to your next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress.percent)}"><span style="width:${progress.percent}%"></span></div></div><button class="q-hud-listen" data-hear aria-label="Read this screen aloud"><span aria-hidden="true">${soundIcon}</span><span>Hear it</span></button></div>`;
}
// Show only the most recent increase in Sparks; no increase means no reward banner.
function renderReward() {
  if (!lastReward) return '';
  return `<div class="q-reward-strip q-reward-enter ${lastReward.levelUp ? 'q-level-up' : ''}" role="status"><span>${lastReward.levelUp ? levelBadge(lastReward.level) : rewardBurst({kind:'points'})}</span><div><strong>${lastReward.levelUp ? `Level ${lastReward.level}! ${escape(lastReward.title)}` : `+${lastReward.amount} Sparks!`}</strong><p>${lastReward.levelUp ? `You earned ${lastReward.amount} Sparks. A new badge is yours.` : 'A new discovery for your adventure.'}</p></div></div>`;
}
// Explain the four badges and repeat-safe reward rules in a read-only panel.
function levelInfo() {
  const progress = progression(state);
  modal('Your Spark adventure', `<p>Collect Sparks as you learn. Every level brings a new badge.</p><div class="q-level-trail">${LEVELS.map(level => `<div class="${progress.level >= level.level ? 'earned' : ''}">${levelBadge(level.level)}<strong>Level ${level.level}</strong><span>${escape(level.title)}</span></div>`).join('')}</div><ul class="q-spark-rules"><li>Finish a new story: <strong>20 Sparks</strong></li><li>Find a new idea: <strong>5 Sparks</strong></li><li>Answer a story’s picture question: <strong>10 Sparks</strong></li></ul><p>Hints are free. Trying again is free. You keep your Sparks.</p><p class="q-small-note">Each discovery earns Sparks once. You can play every story at any level.</p>${button('Let’s play', 'data-close-clue')}`);
  dialogBody.querySelector('[data-close-clue]').onclick = closeDialog;
}
// Provide a small vocabulary panel with its own read-aloud and close controls.
function wordHelp() {
  modal('Little words, big ideas', `<dl class="q-word-list"><div><dt>Reuse</dt><dd>Use something again. It may go to a new home.</dd></div><div><dt>Repair</dt><dd>Fix something that is broken. A repairer does this.</dd></div><div><dt>Recycle</dt><dd>Turn old materials into materials we can use again.</dd></div><div><dt>E-waste</dt><dd>Old electrical things that need a special collection service.</dd></div><div><dt>A qualified repairer</dt><dd>A person trained to check and repair these appliances.</dd></div></dl>${listenButton('Read these words')}${button('Got it', 'data-close-clue')}`);
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
    <div class="q-home-intro" data-read><p class="q-eyebrow"><span aria-hidden="true">✦</span> Small clues. Big plot twists.</p><h1 tabindex="-1" data-focus>Help Pip and Flo find a <em>next chapter.</em></h1><p class="q-hero-invitation">Find clues. Help your friends.<br>Make their world a little brighter.</p>
      <div class="q-start-actions">${state.activeMission && state.activeMission.step !== 'outcome' ? button('Continue your adventure <span aria-hidden="true">→</span>', 'data-continue') : button(`${done ? 'Continue your adventure' : 'Start a mission'} <span aria-hidden="true">→</span>`, 'data-picker')}${state.activeMission ? button('Choose a different mission', 'data-picker', 'quiet') : ''}${state.sorting && state.sorting.status !== 'complete' ? button('Continue sorting', 'data-nav="sorting"', 'secondary') : ''}</div>
      <p class="q-boundary">Your adventure stays on screen. Real appliances need adult help.</p>
    </div>
    <div class="q-world-wrap"><div class="q-world" aria-label="Three places in our illustrated neighbourhood">${neighborhood({ unlocked: state.discoveries, decorations: state.decorations })}${placeButtons()}<span class="q-world-caption">Pick a place. Find its story.</span></div><div class="q-world-greetings"><div class="q-greeting-friends">${['pip','flo'].map(id => `<button data-greet="${id}" aria-label="Say hello to ${id === 'pip' ? 'Pip' : 'Flo'}">${artwork(id)}<span>${id === 'pip' ? 'Pip' : 'Flo'}</span></button>`).join('')}</div><p class="q-world-dialogue" role="status">Tap Pip or Flo.<br>They have something to tell you!</p></div></div>
    <div class="q-play-doors" aria-label="Choose a game"><button data-picker><span>${artwork('flo')}</span><div><small>LOOK · CHOOSE · DISCOVER</small><strong>Story quests</strong><p>Help a friend. Earn a stamp.</p></div><b aria-hidden="true">→</b></button><button data-sort-start><span>${artwork('cardboard')}</span><div><small>TAP · MOVE · MATCH</small><strong>Sorting game</strong><p>Find a home for each picture.</p></div><b aria-hidden="true">→</b></button><button data-nav="book"><span>${artwork('flowers')}</span><div><small>COLLECT · MAKE · KEEP</small><strong>My creations</strong><p>Make your world look like you.</p></div><b aria-hidden="true">→</b></button></div><div class="q-home-bottom"><div class="q-mode" role="group" aria-label="Choose your play style"><span>How shall we explore?</span><button data-mode="guided" aria-pressed="${state.settings.mode === 'guided'}">Guided <small>Clues stay in sight</small></button><button data-mode="challenge" aria-pressed="${state.settings.mode === 'challenge'}">Challenge <small>Find the clues</small></button></div><button class="q-suggestion" data-mission="${attr(suggested.id)}"><span class="q-eyebrow">${state.practice.length ? 'Your next plot twist?' : 'A story to start with'}</span><strong>${escape(suggested.title)} <span aria-hidden="true">→</span></strong><small>The choice is yours.</small></button></div>
    ${renderPassport()}
  </section>`;
}
// Filter authored missions by the temporary character/place selection and return their buttons.
function renderPicker() {
  const options = MISSIONS.filter(item => (!picker.character || item.character === picker.character) && (!picker.place || item.locationId === picker.place));
  return `<section class="q-page q-picker"><button class="q-back" data-nav="home">← Back to the neighbourhood</button><p class="q-eyebrow">Every clue starts a story</p><h1 data-focus tabindex="-1">Who shall we help?</h1><p>Choose a friend, then a mission.</p><div class="q-character-choices">${['pip', 'flo'].map(id => `<button data-character="${id}" aria-pressed="${picker.character === id}">${artwork(id)}<strong>${id === 'pip' ? 'Pip' : 'Flo'}</strong><span>${id === 'pip' ? 'Big heart. Bright ideas.' : 'A friend full of questions.'}</span></button>`).join('')}</div>
      <div class="q-picker-tools"><span>${picker.place ? escape(locationTitle(picker.place)) : 'All around our neighbourhood'}</span><button class="q-back" data-all-missions>Show all stories</button></div>
      <div class="q-mission-list">${options.map((item, index) => `<button class="q-mission-row" data-mission="${attr(item.id)}"><span class="q-mission-thumb">${artwork(item.artworkId)}</span><span><small>${escape(locationTitle(item.locationId))} · ${item.difficulty === 'challenge' || item.slots.length > 1 ? 'Connect the clues' : 'A next-step story'}</small><strong>${escape(item.title)}</strong><span>${escape(item.childSummary || item.fictionalContext)}</span></span><b aria-label="${state.completed[item.id] ? 'Explored' : 'Open story'}">${state.completed[item.id] ? '✓' : '→'}</b></button>`).join('') || '<p>Try another friend, or show all stories.</p>'}</div>
      ${picker.place === 'station' || !picker.place ? `<div class="q-collection-invite"><span>${artwork('cardboard')}</span><div><p class="q-eyebrow">A hands-on picture activity</p><h2>Sort at Collection Station</h2><p>Five picture cards. Three places to choose.</p>${button('Play sorting →', 'data-sort-start')}</div></div>` : ''}
    </section>`;
}
// Translate the internal mission step into the four visible progress labels.
function missionProgress(active) {
  const stage = ['intro', 'explore', 'plan', 'feedback', 'outcome'].indexOf(active.step);
  return `<ol class="q-step-track" aria-label="Mission steps">${['Meet', 'Find clues', 'Make a plan', 'See what happens'].map((label, i) => `<li ${i === Math.min(stage, 3) ? 'aria-current="step"' : ''}><span>${i < stage ? '✓' : i + 1}</span>${label}</li>`).join('')}</ol>`;
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
// Select the introduction, exploration, plan, feedback or outcome markup from activeMission.step.
// The engine decides whether a step is allowed; this function shows that decision.
function renderMission() {
  const item = mission(); const active = state.activeMission;
  if (!item || !active) return renderHome();
  const final = active.step === 'outcome';
  const feedback = active.step === 'feedback';
  const correct = feedback && active.feedback?.correct;
  const stage = active.step;
  return `<section class="q-page q-mission q-stage-${stage} ${final ? 'q-resolved' : ''}"><div class="q-mission-top"><button class="q-back" data-nav="home">← Mission map</button><span>${escape(locationTitle(item.locationId))}</span>${item.cooperative ? '<button class="q-back" data-companion>Secret envelope ✉</button>' : ''}</div>${missionProgress(active)}
    <div class="q-story-heading" data-read><p class="q-eyebrow">${final ? 'You changed the story' : `${item.character === 'flo' ? 'Flo' : 'Pip'} has a mystery for you`}</p><h1 data-focus tabindex="-1">${escape(final ? item.outcome.title : item.title)}</h1><p>${escape(final ? item.outcome.text : item.fictionalContext)}</p></div>
    ${guideBubble(item, active)}
    ${final ? `<div class="q-projector-controls"><span><b aria-hidden="true">▶</b> Your story projector</span><div role="group" aria-label="Compare your story before and after"><button data-story-view="before" aria-pressed="${storyBefore}">Before your choice</button><button data-story-view="after" aria-pressed="${!storyBefore}">The next chapter</button><button data-play-ending aria-label="Play the story ending again">▶ Play ending</button></div></div>` : ''}
    <div class="q-mission-scene ${stage === 'plan' || feedback ? 'q-scene-small' : ''}" data-story-scene>${scene(item.locationId, item.artworkId, final && !storyBefore ? item.outcome.scene : null)}${stage === 'explore' ? clueButtons(item, active, true) : ''}<span class="q-scene-tag">${final ? (storyBefore ? 'Where our story started' : 'What your choice changed') : 'Inside our picture story'}</span></div>
    ${stage === 'intro' ? `<div class="q-mission-intro"><div class="q-touch-how"><span aria-hidden="true">☝</span><p><strong>Tap a clue. Pick a plan.</strong><br>You can hear the words, too.</p></div>${button('Look for clues →', 'data-start-mission')}${item.cooperative ? button('Open the secret envelope', 'data-evidence', 'secondary') : ''}</div>` : ''}
    ${stage === 'explore' ? `<div class="q-explore-controls">${cluePocket(item, active)}<div>${state.settings.mode === 'challenge' ? button(openClueList ? 'Hide clue list' : 'Show clue list', 'data-clue-list', 'quiet') : ''}<div class="q-clue-list" ${state.settings.mode === 'challenge' && !openClueList ? 'hidden' : ''}>${clueButtons(item, active)}</div></div><div class="q-step-actions">${button('A little hint', 'data-hint', 'quiet')}${button('Make a plan →', 'data-open-plan' + (active.clueIds.length ? '' : ' disabled'))}</div></div>` : ''}
    ${stage === 'plan' ? `<div class="q-plan-desk">${cluePocket(item, active)}${renderPlan(item, active)}</div>` : ''}
    ${feedback ? `<section class="q-feedback ${correct ? 'correct' : 'retry'}" data-read><div class="q-feedback-mark" aria-hidden="true">${correct ? '✦' : '?'}</div><div><h2 tabindex="-1" data-feedback-focus>${correct ? 'That plan fits the clues.' : 'A plot twist. Let’s look again.'}</h2><p>${escape(correct ? 'Your next chapter is ready. Let’s see it unfold.' : feedbackText(item, active))}</p>${button(correct ? 'See the next chapter →' : 'Try my plan again', correct ? 'data-complete' : 'data-retry')}${!correct ? button('Revisit the clues', 'data-revisit-clues', 'quiet') : ''}</div></section>` : ''}
    ${final ? `<div class="q-outcome">${renderReward()}<div class="q-unlocked"><div class="q-earned-story-stamp q-stamp-earned">${passportStamp(item.id)}</div><div><p class="q-eyebrow">One story. Your stamp.</p><h2>${escape(item.conceptIds.map(id => concept(id)?.title).filter(Boolean).join(' + '))}</h2><p>${escape(item.postcardLine || 'A next chapter worth keeping.')}</p></div></div>${renderReflection(item)}<div class="q-creative-invite"><div><h2>Make a postcard of your story.</h2><p>Pick its colours. Add your mark. Keep your creation.</p></div>${button('Create my story postcard ✦', `data-postcard="${attr(item.id)}"`)}</div><div class="q-step-actions">${button('Choose another mission →', 'data-picker')}${button('Open my Discovery Book', 'data-nav="book"', 'secondary')}${button('Finish for now', 'data-nav="home"', 'quiet')}</div><p class="q-small-note">${active.assisted ? 'You followed a clue and found your way. That’s exploring.' : 'You connected the clues yourself.'} ${button('Play this story again', 'data-replay', 'text')}</p></div>` : ''}
  </section>`;
}

// Choose the authored explanation for the checked plan, including a helpful wrong-choice response.
function feedbackText(item, active) {
  const chosen = active.feedback?.actionId || Object.values(active.plan).find(id => !item.acceptedPlans.some(plan => Object.values(plan).includes(id)));
  return item.allowedActions.find(action => action.id === chosen)?.feedback || item.helpText;
}
// Draw action pictures and named plan spaces. One-space plans can be selected with one tap.
// Drag handles are an optional second way to fill those same spaces.
function renderPlan(item, active) {
  const single = item.slots.length === 1;
  return `<section class="q-plan-section ${single ? 'q-single-plan' : ''}"><div class="q-plan-instruction" data-read><h2 tabindex="-1" data-plan-focus>What should happen next?</h2><p>${single ? 'Tap a picture to choose your plan.' : 'Tap a picture. Then tap where it belongs.'}</p><p class="q-selection" role="status">${selectedAction ? `Your choice: ${escape(item.allowedActions.find(action => action.id === selectedAction)?.label)}${single ? '' : '. Tap a space below.'}` : 'Use the clues to help you choose.'}</p></div>
    <div class="q-plan-layout"><div class="q-action-bank" aria-label="Actions to choose">${item.allowedActions.map(action => `<div class="q-action-tile ${selectedAction === action.id || Object.values(active.plan).includes(action.id) ? 'selected' : ''}"><button data-action-select="${attr(action.id)}" aria-pressed="${selectedAction === action.id || Object.values(active.plan).includes(action.id)}"><span class="q-action-art">${artwork(action.artworkId || item.artworkId)}</span><strong>${escape(action.label)}</strong>${Object.values(active.plan).includes(action.id) ? '<span class="q-choice-tick" aria-hidden="true">✓</span>' : ''}</button><button class="q-drag-handle" data-action-drag="${attr(action.id)}" aria-label="Drag action: ${attr(action.label)}"><span aria-hidden="true">⠿</span><small>Move</small></button></div>`).join('')}</div>
    <div class="q-plan-slots">${item.slots.map((slot, index) => { const action = item.allowedActions.find(action => action.id === active.plan[slot.id]); return `<div class="q-slot-wrap"><span>${index + 1}. ${escape(slot.label)}</span><button class="q-plan-slot ${action ? 'filled' : ''}" data-plan-slot="${attr(slot.id)}" aria-label="${attr(slot.label)}: ${attr(action?.label || 'empty, choose an action first')}"><span aria-hidden="true">${action ? '✓' : '+'}</span>${escape(action?.label || 'Your plan goes here')}</button>${action ? `<button class="q-back" data-remove-slot="${attr(slot.id)}">Change my choice</button>` : ''}</div>`; }).join('')}</div></div>
    <div class="q-step-actions">${button('A little hint', 'data-hint', 'quiet')}${button('See what happens →', 'data-check-plan' + (item.slots.every(slot => active.plan[slot.id]) ? '' : ' disabled'))}</div></section>`;
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
    return `<section class="q-page q-sort-finish"><p class="q-eyebrow">Collection Station</p><h1 data-focus tabindex="-1">Five thoughtful choices.</h1><div class="q-finish-art">${neighborhood({ unlocked: state.discoveries, decorations: state.decorations })}</div><p>You found a next step for five pictures. Nice thinking!</p><div class="q-run-reflection"><span><b>${independent}</b> on your own</span><span><b>${answers.length - independent}</b> with a clue</span></div><p>Clues are for everyone. Which one helped you?</p><div class="q-step-actions">${button('Try another five cards →', 'data-sort-start')}${button('My Discovery Book', 'data-nav="book"', 'secondary')}${button('Finish for now', 'data-nav="home"', 'quiet')}</div></section>`;
  }
  if (!item) return renderHome();
  const feedback = run.status === 'feedback'; const correct = feedback && run.feedback?.correct;
  return `<section class="q-page q-sort"><div class="q-mission-top"><button class="q-back" data-nav="home">← Neighbourhood</button><span>Picture ${run.index + 1} of 5</span><span class="q-sort-ticket" aria-label="Untimed picture challenge">Think it through ✦</span></div><div class="q-sort-heading"><p class="q-eyebrow">Collection Station</p><h1 data-focus tabindex="-1">Where does this picture go?</h1><p class="q-sort-rule">These pictures are ready for collection. <strong>A warning or a missing clue? Pause and ask.</strong></p></div>
    <div class="q-sort-board"><div class="q-sort-round-track" aria-label="Picture ${run.index + 1} of 5">${Array.from({length:5}, (_,i) => `<span class="${i < run.index || (i === run.index && correct) ? 'done' : i === run.index ? 'current' : ''}">${i < run.index || (i === run.index && correct) ? '✓' : i+1}</span>`).join('')}</div><article class="q-sort-object ${correct ? 'placed' : ''}" data-read><div class="q-sort-art">${artwork(item.artworkId)}<span class="q-card-number">${run.index + 1}/5</span></div><div class="q-sort-object-copy"><h2>${escape(item.title)}</h2><p>${escape(item.condition)}</p>${!feedback ? `<button class="q-drag-handle q-lift" data-sort-drag aria-label="Pick up ${attr(item.title)}"><span aria-hidden="true">⠿</span> Move</button>` : ''}</div></article>
    <p class="q-sort-instruction">${feedback ? 'Your picture, your next step.' : 'Tap a place below. Or hold “Move” and drag.'}</p>
    <div class="q-destinations" aria-label="Choose a place">${destinations.map(destination => `<button class="q-destination dest-${destination.id} ${correct && run.feedback.destinationId === destination.id ? 'q-accepted' : ''}" data-destination="${destination.id}" ${feedback ? 'disabled' : ''}><span class="q-destination-drawing" aria-hidden="true">${destination.id === 'ewaste' ? '<svg viewBox="0 0 90 65"><path d="M10 55V26L45 8l35 18v29H10Z" fill="#d7e9dd"/><path d="M20 55V30h50v25M36 55V37h18v18"/><path d="M8 26 45 7l37 19"/><path d="m38 20 5-6 5 6m0-6h-5v9"/></svg>' : destination.id === 'paper' ? artwork('cardboard') : '<svg viewBox="0 0 90 65"><path d="M12 7h66v43H43L29 60V50H12Z" fill="#f8d39c"/><path d="M36 23q1-12 14-9t3 16l-8 5v5M45 44v2"/></svg>'}</span><strong>${escape(destination.title)}</strong><small>${escape(destination.short)}</small>${correct && run.feedback.destinationId === destination.id ? `<span class="q-placed-picture" aria-hidden="true">${artwork(item.artworkId)}</span>` : ''}${correct && run.feedback.destinationId === destination.id ? '<b class="q-destination-tick">✓ Placed</b>' : ''}</button>`).join('')}</div></div>
    ${feedback ? `${renderReward()}<section class="q-feedback ${correct ? 'correct' : 'retry'}" data-read><span class="q-feedback-mark" aria-hidden="true">${correct ? '✓' : '?'}</span><div><h2 data-feedback-focus tabindex="-1">${correct ? 'That fits this picture.' : 'Let’s use a clue.'}</h2><p>${escape(correct ? item.explanation : item.clue)}</p>${button(correct ? (run.index === 4 ? 'Finish this round →' : 'Next picture →') : 'Try another place', correct ? 'data-sort-next' : 'data-sort-retry')}</div></section>` : `<div class="q-sort-help">${button('Show me a clue', 'data-hint', 'quiet')}<p id="q-drag-message" role="status"></p></div>`}
  </section>`;
}
// Build the discovery collection and decoration choices from earned concept IDs.
function renderBook() {
  const earned = CONCEPTS.filter(item => state.discoveries.includes(item.id));
  return `<section class="q-page q-book"><button class="q-back" data-nav="home">← Neighbourhood</button><p class="q-eyebrow">A book of little discoveries</p><h1 data-focus tabindex="-1">Look what you’ve found.</h1><p>Your stamps, your stories, your corner of the world.</p>${renderPassport()}
    ${earned.length ? `<div class="q-book-pages">${earned.map(item => `<article class="q-discovery"><div>${artwork(item.artworkId)}</div><section><p class="q-eyebrow">Discovered</p><h2>${escape(item.title)}</h2><p>${escape(item.text)}</p></section></article>`).join('')}</div>` : `<div class="q-book-empty">${artwork('pip', { expression: 'thinking' })}<h2>Your first page is waiting.</h2><p>Explore a mission or a sorting round to find an idea for your book.</p>${button('Choose a mission →', 'data-picker')}</div>`}
    ${earned.length ? `<section class="q-decorating"><p class="q-eyebrow">Make this place your own</p><h2>A little garden? A splash of colour?</h2><p>Choose a decoration, then choose a place. You can move it whenever you like.</p><div class="q-decoration-picks">${[...new Set(earned.map(item => item.decoration))].map(id => `<div class="q-decoration-tile"><button data-decoration="${attr(id)}" aria-pressed="${selectedDecoration === id}">${artwork(id)}<span>${escape(id)}</span></button><button class="q-drag-handle" data-decoration-drag="${attr(id)}" aria-label="Drag ${attr(id)} decoration">⠿</button></div>`).join('')}</div><div class="q-decor-world">${neighborhood({ unlocked: state.discoveries, decorations: state.decorations })}</div><div class="q-decoration-slots">${LOCATIONS.map(place => `<button data-decoration-slot="${attr(place.id)}"><strong>${escape(place.title)}</strong><span>${escape(state.decorations[place.id] || 'An open space')}</span><small>${selectedDecoration ? `Place ${escape(selectedDecoration)} here` : 'Choose a decoration first'}</small></button>`).join('')}</div><p class="q-small-note">Make this little world look like yours.</p></section>` : ''}
  </section>`;
}
// Build the optional parent explanation, source links and relevant discussion prompt.
// The historic internal name grownups means the parent guide, not a separate child audience.
function renderGrownups() {
  const item = mission();
  const progress = progression(state);
  return `<section class="q-page q-grownups q-parent-guide"><button class="q-back" data-nav="home">← Back to Quest</button><div class="q-parent-hero"><div><p class="q-eyebrow">For parents and curious families</p><h1 data-focus tabindex="-1">Little choices.<br>Thoughtful next steps.</h1><p class="q-grownup-lede">FixForward Quest helps children aged 7–12 explore what can happen to things we no longer use. Pip and Flo turn repair, reuse and recycling into short picture adventures.</p><div class="q-step-actions">${button('Let’s play Quest →', 'data-nav="home"')}<a class="q-button secondary" href="/" target="_blank" rel="noopener">Help with a real appliance ↗<span class="q-sr"> (opens in a new tab)</span></a></div></div><div class="q-parent-picture">${neighborhood({unlocked:state.discoveries,decorations:state.decorations})}</div></div>
    <section class="q-parent-why"><p class="q-eyebrow">Why this website?</p><h2>“Throw it away” is only one possible ending.</h2><p>Children can practise noticing a clue, asking a useful question and choosing a next step. A working item may find another home. A repair needs the right person and evidence. A warning means pause and get help. The story supplies the facts, so children can reason without handling real appliances.</p></section>
    <section class="q-parent-learning"><h2>What children practise</h2><div class="q-parent-goals"><article>${artwork('fan')}<h3>Look before deciding</h3><p>The same fan appears in different stories. Its clues change the answer.</p></article><article>${artwork('evidence')}<h3>Explain a choice</h3><p>A short picture question asks which clue mattered.</p></article><article>${artwork('cardboard')}<h3>Give things different paths</h3><p>A toaster and its clean box may need different next steps.</p></article><article>${artwork('flo')}<h3>Ask when unsure</h3><p>Missing information is a reason to ask for help.</p></article></div></section>
    <section class="q-grownup-feature"><div>${artwork(item?.character || 'pip')}</div><div><p class="q-eyebrow">A small way to join in</p><h2>${item ? escape(item.title) : 'Let your child lead'}</h2><p>${escape(item?.learningGoal || 'Ask about the clue, then give your child time to decide. A hint is always available.')}</p><blockquote>“${escape(item?.discussionPrompt || 'What did you spot that helped you choose?')}”</blockquote>${state.activeMission && state.activeMission.step !== 'outcome' ? button('Return to this story', 'data-continue', 'secondary') : button('Choose a story', 'data-picker', 'secondary')}${state.sorting && state.sorting.status !== 'complete' ? button('Return to sorting', 'data-nav="sorting"', 'secondary') : ''}</div></section>
    <section class="q-parent-pair"><div><h2>Made for different readers</h2><p>Large picture choices work with taps. Dragging is optional. Guided mode keeps clue labels visible; Challenge mode invites more searching. Both have hints, a word guide and optional read aloud.</p><p>Start with one story. Let your child replay, create a postcard or finish. There is no countdown.</p>${button('Reading and movement settings', 'data-settings', 'secondary')}</div><div><h2>What do Sparks mean?</h2><p>Sparks celebrate finishing stories, finding ideas and connecting clues. Four level badges mark progress. Hints and retries earn the same rewards. Repeating the same discovery does not add more points.</p><p>Sparks are game progress, not a test score, ability rating or measure of real waste saved.</p><p class="q-parent-progress">On this browser: <strong>${Object.keys(state.completed).length} of 8 stories</strong> explored · <strong>${progress.points} Sparks</strong></p></div></section>
    <section class="q-grownup-section"><h2>Fictional stories. Clear real-world boundaries.</h2><p>The appliances, reports and people in Quest are made-up teaching stories. A picture cannot diagnose a fault, confirm safety or clear a recall. Children are never asked to touch, test, open, repair or transport a real appliance or damaged battery.</p><p>Adults make real appliance decisions. Use FixForward’s household guide and enter the real product’s details there. Quest never turns story answers into facts about your appliance.</p>${document.querySelector('[name="quest-review-fixture"]') ? '<p class="q-review-note">This local preview uses invented adult test records. They are not real service or recall results. <a href="/test-fixture-info" target="_blank" rel="noopener">About the review data</a>.</p>' : ''}</section>
    <section class="q-grownup-section"><h2>What stays private?</h2><p>Quest saves story progress, Sparks-related discoveries, designs and settings in this browser. It asks for no names, dates of birth, photographs, contact details or locations. It sends no child scores, player names or analytics.</p><p>${storageAvailable ? 'Clearing browser data can remove saved progress.' : 'This browser is blocking saving. Play still works for this visit.'} Reset my adventure clears Quest’s saved progress. The adult journey is separate.</p><p>Read aloud uses browser speech. Voices may use an online service. Words stay visible if speech is unavailable. First access still needs the local server or hosted site; offline play is not promised.</p></section>
    <section class="q-grownup-section"><h2>Where do the learning rules come from?</h2><p>Electrical-safety and waste-service sources support the general rules. Sorting uses the stated Merri-bek, Victoria context for clean paper and cardboard. Adults still need to check whether a service accepts a particular electrical item.</p><div class="q-source-list">${SOURCES.map(source => `<details><summary>${escape(source.title)}</summary><p>${escape(source.rule || '')}</p><p>${escape(source.publisher)} · ${escape(source.jurisdiction || 'Design guidance')} · Checked ${escape(source.checkedAt || 'See source register')}</p><a href="${attr(source.url)}" target="_blank" rel="noopener">Read the source ↗</a></details>`).join('')}</div></section>
    <section class="q-grownup-section"><h2>A learning experience we can keep improving</h2><p>The design gives children choices, feedback and room to create. We have not yet measured learning outcomes or tested this version with child participants. Observing where children pause, ask for help or explain a clue will guide the next changes.</p>${button('Back to Quest →', 'data-nav="home"')}</section>
  </section>`;
}

// Render a completed story with its saved theme/sticker and the export control.
function renderPostcard() {
  const item = MISSIONS.find(value => value.id === postcardId);
  if (!item || !Object.hasOwn(state.completed, item.id)) { postcardId = null; return renderBook(); }
  const design = state.postcards?.[item.id] || { theme: 'sunshine', sticker: 'star' };
  return `<section class="q-page q-postcard-studio"><button class="q-back" data-nav="book">← My discoveries</button><p class="q-eyebrow">The next-chapter studio</p><h1 data-focus tabindex="-1">Your story. Your signature style.</h1><p>Turn <strong>${escape(item.title)}</strong> into a little piece of art.</p><div class="q-postcard-layout"><div class="q-postcard-preview" data-postcard-preview aria-label="Your designed story postcard">${postcard(item, design)}</div><div class="q-postcard-tools"><fieldset><legend>Set the mood</legend><div class="q-palette-choices">${validThemes.map(theme => `<button class="theme-${theme}" data-postcard-theme="${theme}" aria-pressed="${design.theme === theme}"><span aria-hidden="true"></span>${escape(theme)}</button>`).join('')}</div></fieldset><fieldset><legend>Leave your mark</legend><div class="q-sticker-choices">${validStickers.map(sticker => `<button data-postcard-sticker="${sticker}" aria-pressed="${design.sticker === sticker}"><b aria-hidden="true">${{star:'★',leaf:'<svg viewBox="0 0 32 32" width="30" height="30" style="width:30px;height:30px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M7 24C1 10 14 4 27 4c0 14-5 25-20 20Z" fill="currentColor" fill-opacity=".18"/><path d="M5 28 22 10m-9 10-1-7m6 2 6-1"/></svg>',spark:'✦'}[sticker]}</b>${escape(sticker)}</button>`).join('')}</div></fieldset><p class="q-small-note">${storageAvailable ? 'Your design stays in your Discovery Book.' : 'Your design stays here during this visit.'}</p>${button('Save my postcard ↓', 'data-save-postcard')}<p class="q-small-note" id="q-download-message" role="status">Saves a picture to this device.</p>${button('Back to my Discovery Book', 'data-nav="book"', 'quiet')}</div></div></section>`;
}
// Replace the current game markup, update the title/count/motion setting, then reattach handlers.
// Because innerHTML replaces elements, old drag listeners must be removed first.
// Rendering and animation replay do not change completed stories or rewards.
function render(effect = '') {
  cleanDrag();
  announceNode.textContent = '';
  document.documentElement.dataset.motion = reduced() ? 'reduce' : 'full';
  app.className = effect;
  app.innerHTML = (state.view === 'grownups' && !picker && !postcardId ? '' : renderHud()) + (postcardId ? renderPostcard() : picker ? renderPicker() : ({ home: renderHome, mission: renderMission, sorting: renderSorting, book: renderBook, grownups: renderGrownups }[state.view] || renderHome)());
  document.querySelector('#book-count').textContent = String(state.discoveries.length);
  document.title = `${postcardId ? 'My story postcard' : picker ? 'Choose a mission' : state.view === 'mission' ? mission()?.title || 'Adventure' : state.view === 'book' ? 'Discovery Book' : state.view === 'sorting' ? 'Collection Station' : state.view === 'grownups' ? 'About this adventure' : 'Help Pip and Flo'} | FixForward Quest`;
  document.querySelector('#read-aloud').setAttribute('aria-pressed', String(state.settings.narration));
  bind();
}
// Open the designer only for a completed mission; preserve the chosen story in a temporary ID.
function openPostcard(id) {
  if (!Object.hasOwn(state.completed, id)) return;
  stopReading(); cleanDownload(); picker = null; postcardId = id;
  state = transition(state, { type: 'NAVIGATE', view: 'book' }); persist();
  render('q-play-enter'); focus(); window.scrollTo({ top: 0, behavior: 'auto' });
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
// Cycle through the tapped character's authored greetings without changing progress.
function greet(id) {
  const lines = { pip: ['I have a story. You get to choose the ending!', 'Can you find a clue I missed?', 'Tap a place on the map. Let’s go!'], flo: ['Hello, teammate! Ready to find a clue?', 'A good question can change my story.', 'I wonder what happens next. You choose!'] };
  if (!lines[id]) return;
  const message = lines[id][greetingCounts[id]++ % lines[id].length];
  const bubble = app.querySelector('.q-world-dialogue'); bubble.textContent = `${id === 'pip' ? 'Pip' : 'Flo'}: ${message}`;
  const friends = app.querySelector('.q-greeting-friends'); friends.classList.remove('q-play-enter');
  // Replacing only the tapped guide starts one finite greeting, without moving the map.
  const guide = friends.querySelector(`[data-greet="${id}"]`); guide.innerHTML = `${artwork(id, { expression: 'success' })}<span>${id === 'pip' ? 'Pip' : 'Flo'}</span>`;
  guide.className = 'q-play-enter';
}

// Open a temporary mission chooser, optionally limited to a neighbourhood place.
function openPicker(place = null) { stopReading(); cleanDownload(); postcardId = null; picker = { place, character: null }; render('q-play-enter'); focus(); window.scrollTo({ top: 0, behavior: 'auto' }); }
// Record a valid clue through the engine, then show its picture and exact authored explanation.
// A fresh clue gets a visual reveal; collecting a clue alone does not add Sparks.
function clue(id) {
  const item = mission(); const entry = item?.clues.find(value => value.id === id);
  if (!entry) return;
  const fresh = !state.activeMission.clueIds.includes(id);
  dispatch({ type: 'COLLECT_CLUE', id }, { focusTarget: null, speak: false });
  modal(entry.title, `<div class="q-clue-reveal ${fresh ? 'q-reward-enter' : ''}"><div class="q-clue-art">${artwork(entry.artworkId)}</div>${fresh ? `<span class="q-clue-spark">${rewardBurst({kind:'clue'})}</span>` : ''}</div><p class="q-clue-text">${escape(entry.text)}</p><div class="q-clue-dialog-actions">${listenButton('Hear this clue')}${button('Keep exploring', 'data-close-clue')}</div>`, app.querySelector(`[data-clue="${id}"]`));
  dialogBody.querySelector('[data-close-clue]').onclick = closeDialog;
  dialogBody.querySelector('[data-hear]').onclick = () => speakText(`${entry.title}. ${entry.text}`);
  if (state.settings.narration) speakText(`${entry.title}. ${entry.text}`);
}

// Record that help was used and show the current story/card hint. Help never deducts Sparks.
function hint() {
  dispatch({ type: 'HINT' }, { focusTarget: null, speak: false });
  const run = state.sorting;
  const text = state.view === 'sorting' ? SORT_ITEMS.find(item => item.id === run?.itemIds[run.index])?.clue : mission()?.helpText;
  modal('A useful clue', `<p>${escape(text)}</p>${button('I’ll give it a try', 'data-close-clue')}`, app.querySelector('[data-hint]'));
  dialogBody.querySelector('[data-close-clue]').onclick = closeDialog;
  if (state.settings.narration) readScene();
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
  modal('Your adventure, your way', `<div class="q-settings"><label>Play style<select id="q-mode"><option value="guided" ${state.settings.mode === 'guided' ? 'selected' : ''}>Guided — clues stay visible</option><option value="challenge" ${state.settings.mode === 'challenge' ? 'selected' : ''}>Challenge — discover the clues</option></select></label><label>Movement<select id="q-motion"><option value="auto" ${state.settings.motion === 'auto' ? 'selected' : ''}>Follow my device</option><option value="reduce" ${state.settings.motion === 'reduce' ? 'selected' : ''}>Less movement</option></select></label><label class="q-check"><input id="q-narration" type="checkbox" ${state.settings.narration ? 'checked' : ''}> Read story steps aloud</label>${window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? '<p class="q-small-note">Your device asks for less movement. Quest follows that setting.</p>' : ''}<p>Voices depend on your browser and may use an online service. You can always read the text instead.</p><p>${storageAvailable ? 'Your discoveries are saved in this browser.' : 'Saving is blocked here. You can still play during this visit.'}</p><button class="q-button secondary" id="q-reset">Reset my adventure</button><p class="q-small-note">Reset clears your stories, Sparks, postcards and decorations.</p></div>`);
  for (const [id, key] of [['q-mode', 'mode'], ['q-motion', 'motion'], ['q-narration', 'narration']]) dialogBody.querySelector(`#${id}`).onchange = event => {
    dispatch({ type: 'SET_SETTING', key, value: key === 'narration' ? event.target.checked : event.target.value }, { focusTarget: null, speak: false });
    if (key === 'narration' && state.settings.narration) readScene();
  };
  dialogBody.querySelector('#q-reset').onclick = () => {
    modal('Start a new adventure?', `<p>This clears your stories, Sparks, postcards and decorations in this browser. The other FixForward tab stays as it is.</p><div class="q-step-actions">${button('Keep my adventure', 'id="q-keep"', 'secondary')}${button('Yes, reset my adventure', 'id="q-confirm-reset"')}</div>`);
    dialogBody.querySelector('#q-keep').onclick = closeDialog;
    dialogBody.querySelector('#q-confirm-reset').onclick = () => { stopReading(); cleanDrag(); clearProgress(); state = createState(); picker = null; selectedAction = null; selectedDecoration = null; postcardId = null; storyBefore = false; lastReward = null; reflectionHint = null; cleanDownload(); closeDialog(); render('q-play-enter'); focus(); announce('Your new adventure is ready.'); };
  };
}
// Adapt the generic pointer helper to this screen and remember its cleanup callback.
// Targets are read when needed so scrolling/resizing cannot reuse stale drop positions.
function drag(handle, targets, onDrop, source = handle.parentElement) {
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
  app.querySelectorAll('[data-hear]').forEach(el => el.onclick = () => {
    const context = el.closest('.q-reflection') || el.closest('.q-guide-dialogue');
    speakText(context ? (context.classList.contains('q-guide-dialogue') ? `${mission()?.fictionalContext || ''} ${guideLine(mission(), state.activeMission)}` : context.innerText) : (app.querySelector('.q-sort-object')?.innerText || app.querySelector('[data-read]')?.innerText || app.querySelector('h1')?.textContent));
  });
  app.querySelectorAll('[data-word-help]').forEach(el => el.onclick = wordHelp);
  app.querySelectorAll('[data-level-info]').forEach(el => el.onclick = levelInfo);
  app.querySelector('[data-play-ending]')?.addEventListener('click', () => { storyBefore = false; lastReward = null; stopReading(); render('q-story-reveal'); focus('[data-play-ending]'); });
//   Wrong reflection choices show temporary help only; correct choices pass engine validation.
  app.querySelectorAll('[data-reflection]').forEach(el => el.onclick = () => {
    const item = mission();
    if (!item || !state.completed[item.id]) return;
    if (isReflectionCorrect(item, el.dataset.reflection)) { reflectionHint = null; dispatch({type:'CHECK_REFLECTION', missionId:item.id, answerId:el.dataset.reflection}, {focusTarget:'[data-reflection-focus]'}); }
    else { reflectionHint = item.id; lastReward = null; render(); focus('[data-reflection-focus]'); announce('Here’s a clue. You can try again.'); }
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
  app.querySelectorAll('[data-character]').forEach(el => el.onclick = () => { picker.character = el.dataset.character; render(); focus(`[data-character="${picker.character}"]`); });
  app.querySelector('[data-all-missions]')?.addEventListener('click', () => { picker = { character: null, place: null }; render(); focus(); });
  app.querySelectorAll('[data-mission]').forEach(el => el.onclick = () => { picker = null; postcardId = null; selectedAction = null; openClueList = false; dispatch({ type: 'CHOOSE_MISSION', id: el.dataset.mission }); window.scrollTo({ top: 0, behavior: 'auto' }); });
  app.querySelectorAll('[data-continue]').forEach(el => el.onclick = () => navigate('mission'));
  app.querySelectorAll('[data-mode]').forEach(el => el.onclick = () => dispatch({ type: 'SET_SETTING', key: 'mode', value: el.dataset.mode }, { focusTarget: `[data-mode="${el.dataset.mode}"]`, speak: false }));
  app.querySelector('[data-start-mission]')?.addEventListener('click', () => dispatch({ type: 'START_MISSION' }));
  app.querySelectorAll('[data-clue]').forEach(el => el.onclick = () => clue(el.dataset.clue));
  app.querySelector('[data-clue-list]')?.addEventListener('click', () => { openClueList = !openClueList; render(); focus('[data-clue-list]'); });
  app.querySelector('[data-open-plan]')?.addEventListener('click', () => dispatch({ type: 'OPEN_PLAN' }, { focusTarget: '[data-plan-focus]' }));
//   A single slot is filled immediately. Multiple slots ask which item receives the selected action.
  app.querySelectorAll('[data-action-select]').forEach(el => el.onclick = () => { selectedAction = el.dataset.actionSelect; const item = mission(); if (item?.slots.length === 1) dispatch({ type:'SET_PLAN', slotId:item.slots[0].id, actionId:selectedAction }, {focusTarget:`[data-action-select="${selectedAction}"]`, speak:false}); else { render(); focus(`[data-action-select="${selectedAction}"]`); } });
  app.querySelectorAll('[data-plan-slot]').forEach(el => el.onclick = () => { if (selectedAction) { dispatch({ type: 'SET_PLAN', slotId: el.dataset.planSlot, actionId: selectedAction }, { focusTarget: `[data-plan-slot="${el.dataset.planSlot}"]`, speak: false }); announce('Action added to your plan.'); } else announce('Choose an action first, then choose this space.'); });
  app.querySelectorAll('[data-remove-slot]').forEach(el => el.onclick = () => dispatch({ type: 'REMOVE_PLAN', slotId: el.dataset.removeSlot }, { focusTarget: `[data-plan-slot="${el.dataset.removeSlot}"]`, speak: false }));
  app.querySelectorAll('[data-action-drag]').forEach(el => drag(el, () => [...app.querySelectorAll('[data-plan-slot]')].map(slot => ({ id: slot.dataset.planSlot, element: slot })), slotId => { selectedAction = null; dispatch({ type: 'SET_PLAN', slotId, actionId: el.dataset.actionDrag }, { focusTarget: `[data-plan-slot="${slotId}"]`, speak: false }); }));
  for (const [selector, type, target] of [['data-check-plan', 'CHECK_PLAN', '[data-feedback-focus]'], ['data-retry', 'RETRY_PLAN', '[data-plan-focus]'], ['data-complete', 'COMPLETE_MISSION', '[data-focus]'], ['data-replay', 'REPLAY_MISSION', '[data-focus]']]) app.querySelector(`[${selector}]`)?.addEventListener('click', () => { selectedAction = null; dispatch({ type }, { focusTarget: target }); });
  app.querySelector('[data-revisit-clues]')?.addEventListener('click', () => dispatch({ type: 'EXPLORE_AGAIN' }));
  app.querySelectorAll('[data-sort-start]').forEach(el => el.onclick = () => { picker = null; if (state.sorting && state.sorting.status !== 'complete') navigate('sorting'); else if (!dispatch({ type: 'START_SORT' })) { render(); focus(); } window.scrollTo({ top: 0, behavior: 'auto' }); });
//   Both a destination button and a successful drop use this one answer path.
  const answerSort = destinationId => dispatch({ type: 'ANSWER_SORT', destinationId }, { focusTarget: '[data-feedback-focus]' });
  app.querySelectorAll('[data-destination]').forEach(el => el.onclick = () => answerSort(el.dataset.destination));
  const sortHandle = app.querySelector('[data-sort-drag]');
  if (sortHandle) drag(sortHandle, () => [...app.querySelectorAll('[data-destination]')].map(el => ({ id: el.dataset.destination, element: el })), answerSort, app.querySelector('.q-sort-object'));
  app.querySelector('[data-sort-next]')?.addEventListener('click', () => dispatch({ type: 'NEXT_SORT' }));
  app.querySelector('[data-sort-retry]')?.addEventListener('click', () => dispatch({ type: 'RETRY_SORT' }));
  app.querySelectorAll('[data-hint]').forEach(el => el.onclick = hint);
  app.querySelectorAll('[data-companion], [data-evidence]').forEach(el => el.onclick = companion);
  app.querySelectorAll('[data-settings]').forEach(el => el.onclick = settings);
  app.querySelectorAll('[data-decoration]').forEach(el => el.onclick = () => { selectedDecoration = el.dataset.decoration; render(); focus(`[data-decoration="${selectedDecoration}"]`); announce(`Choose a place for your ${selectedDecoration}.`); });
  app.querySelectorAll('[data-decoration-slot]').forEach(el => el.onclick = () => { if (selectedDecoration) dispatch({ type: 'PLACE_DECORATION', slotId: el.dataset.decorationSlot, decorationId: selectedDecoration }, { focusTarget: `[data-decoration-slot="${el.dataset.decorationSlot}"]`, speak: false }); else announce('Choose a decoration first.'); });
  app.querySelectorAll('[data-decoration-drag]').forEach(el => drag(el, () => [...app.querySelectorAll('[data-decoration-slot]')].map(slot => ({ id: slot.dataset.decorationSlot, element: slot })), slotId => { selectedDecoration = null; dispatch({ type: 'PLACE_DECORATION', slotId, decorationId: el.dataset.decorationDrag }, { focusTarget: `[data-decoration-slot="${slotId}"]`, speak: false }); }));
}

// The header/footer survive render(), so attach their handlers once at startup.
document.querySelectorAll('.q-header [data-nav], .q-footer [data-nav]').forEach(el => el.onclick = () => navigate(el.dataset.nav));
document.querySelector('#q-dialog-close').onclick = () => { stopReading(); closeDialog(); };
dialog.addEventListener('cancel', () => { stopReading(); });
document.querySelector('#quest-settings').onclick = settings;
document.querySelector('#read-aloud').onclick = readScene;
// Release temporary browser resources when leaving the page; saved progress remains.
window.addEventListener('pagehide', () => { stopReading(); cleanDrag(); cleanDownload(); });
const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
media?.addEventListener?.('change', () => { document.documentElement.dataset.motion = reduced() ? 'reduce' : 'full'; });
// The explicit parent URL changes only the initial view, without rewriting the child save.
if (new URLSearchParams(window.location.search).get('view') === 'parents') state = { ...state, view:'grownups' };
render('q-play-enter');
if (restored.status === 'invalid') announce('We could not read the saved adventure. A new adventure is ready.');
