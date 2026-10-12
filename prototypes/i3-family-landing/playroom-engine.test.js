import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { GAMES, PLAYROOM_KEY, PLAYROOM_VERSION, MAX_GAME_ATTEMPTS, createGame, gameById, gameForState, currentLevel, attemptMove, advanceGame, hintGame, validateGame, loadGames, saveGames, summarizeGames, completedGameLevels } from './playroom-engine.js';
import { mountPlayroomParent } from './playroom-parent.js';
const now = '2026-10-11T10:00:00.000Z';
const make = (game = 'materials', id = 'playroom-test') => createGame(game, { id, now });
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
function solveLevel(state) { for (const piece of currentLevel(state).pieces) state = attemptMove(state, piece.id, piece.answer, { now }).state; return state; }
function finish(state) { while (state.status !== 'complete') state = advanceGame(solveLevel(state), { now }); return state; }

test('two distinct games define complete sorting/building and spatial care activities', () => {
  assert.deepEqual(GAMES.map(game => game.id), ['materials', 'care']);
  assert.deepEqual(gameById('materials').levels.map(level => level.id), ['recover', 'build', 'battery-stop', 'phone-choice']);
  assert.deepEqual(gameById('care').levels.map(level => level.room), ['desk', 'kitchen', 'family']);
  for (const game of GAMES) {
    assert.ok(game.learning && game.talkPrompt);
    assert.equal(game.levels.reduce((sum, level) => sum + level.pieces.length, 0), game.id === 'materials' ? 11 : 9);
    for (const level of game.levels) {
      assert.equal(new Set(level.pieces.map(piece => piece.id)).size, level.pieces.length);
      for (const piece of level.pieces) {
        assert.ok(level.targets.some(target => target.id === piece.answer));
        assert.ok(piece.correct && piece.wrong);
      }
    }
  }
  assert.equal(createGame('unknown'), null);
  assert.equal(gameById('unknown'), null);
});

test('each complete game earns bounded points and all of its levels', () => {
  for (const game of GAMES) {
    const state = finish(make(game.id));
    assert.equal(state.status, 'complete');
    const count = game.levels.reduce((sum, level) => sum + level.pieces.length, 0);
    assert.equal(state.points, count * 15);
    assert.equal(state.attempts.length, count);
    assert.deepEqual(completedGameLevels(state), game.levels.map(level => level.id));
    assert.deepEqual(validateGame(state), state);
    assert.equal(advanceGame(state), state);
    assert.equal(hintGame(state), state);
  }
});

test('a first correct move earns one reward and preserves the source state', () => {
  const original = make();
  const result = attemptMove(original, 'copper-wire', 'metals', { now });
  assert.equal(result.accepted, true);
  assert.equal(result.correct, true);
  assert.equal(result.points, 15);
  assert.equal(result.levelComplete, false);
  assert.equal(result.state.completed['copper-wire'], true);
  assert.deepEqual(original.completed, {});
  assert.deepEqual(original.attempts, []);
  const duplicate = attemptMove(result.state, 'copper-wire', 'metals', { now });
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.state.points, 15);
  assert.equal(duplicate.state.attempts.length, 1);
});

test('different choices explain the misconception and allow a full base reward after a retry', () => {
  let state = attemptMove(make(), 'copper-wire', 'glass', { now }).state;
  assert.equal(state.points, 0);
  assert.equal(state.attempts[0].targetLabel, 'Glass');
  assert.equal(state.attempts[0].expectedTargetLabel, 'Metals');
  assert.equal(state.attempts[0].text, gameById('materials').levels[0].pieces[0].wrong);
  const result = attemptMove(state, 'copper-wire', 'metals', { now });
  state = result.state;
  assert.equal(result.points, 10);
  assert.equal(state.attempts[1].attemptNumber, 2);
  assert.equal(state.attempts[1].firstTry, false);
});

test('unknown pieces, outside drops and early advancement do not create answers', () => {
  const state = make();
  assert.equal(attemptMove(state, 'missing', 'metals').accepted, false);
  assert.equal(attemptMove(state, 'copper-wire', null).state, state);
  assert.equal(attemptMove(state, 'copper-wire', 'not-a-zone').state, state);
  assert.equal(advanceGame(state), state);
  assert.deepEqual(state.attempts, []);
});

test('hints are explicit, unpenalised support and recorded once per level', () => {
  const original = make();
  let state = hintGame(original, { now });
  assert.equal(original.hints.length, 0);
  assert.equal(state.hints[0].text, currentLevel(state).help);
  assert.equal(hintGame(state), state);
  const result = attemptMove(state, 'copper-wire', 'metals', { now });
  assert.equal(result.points, 10);
  assert.equal(result.state.attempts[0].hintUsed, true);
  assert.equal(result.state.attempts[0].firstTry, true);
  assert.deepEqual(validateGame(result.state), result.state);
});

test('all six sorted materials are needed before the building activity opens', () => {
  let state = make();
  const pieces = currentLevel(state).pieces;
  for (const piece of pieces.slice(0, 5)) state = attemptMove(state, piece.id, piece.answer, { now }).state;
  assert.equal(state.status, 'playing');
  assert.equal(advanceGame(state), state);
  state = attemptMove(state, pieces[5].id, pieces[5].answer, { now }).state;
  assert.equal(state.status, 'level-complete');
  assert.equal(hintGame(state), state);
  state = advanceGame(state, { now });
  assert.equal(currentLevel(state).id, 'build');
  assert.deepEqual(state.completed, {});
  assert.deepEqual(validateGame(state), state);
});

test('new-level hints and partially placed objects survive a storage round trip', () => {
  const store = storage();
  let state = advanceGame(solveLevel(make()), { now });
  state = attemptMove(state, 'copper', 'cable', { now }).state;
  state = hintGame(state, { now });
  state = attemptMove(state, 'aluminium', 'bench', { now }).state;
  assert.equal(saveGames(store, [state]), true);
  assert.deepEqual(loadGames(store), [state]);
  assert.equal(loadGames(store)[0].hints[0].beforeAttempt, 7);
});

test('validation reconstructs authored explanations, score and completion instead of trusting stored fields', () => {
  const valid = attemptMove(make(), 'copper-wire', 'metals', { now }).state;
  const tampered = structuredClone(valid);
  tampered.points = 99999;
  tampered.completed = { anything: true };
  tampered.attempts[0].text = '<script>not the shown explanation</script>';
  tampered.attempts[0].targetLabel = 'fake label';
  assert.deepEqual(validateGame(tampered), valid);
  assert.equal(validateGame({ ...valid, levelIndex: 1 }), null);
  assert.equal(validateGame({ ...valid, status: 'complete' }), null);
  assert.equal(validateGame({ ...valid, attempts: [...valid.attempts, ...valid.attempts] }), null);
  assert.equal(validateGame({ ...valid, attempts: [{ ...valid.attempts[0], gameId: 'care' }] }), null);
});

test('corrupt and unavailable storage cannot crash a game or touch other activities', () => {
  const store = storage();
  store.setItem('fixforward.pips-workshop.v1', 'earlier workshop record');
  saveGames(store, [make()]);
  assert.equal(store.getItem('fixforward.pips-workshop.v1'), 'earlier workshop record');
  for (const raw of ['{', 'null', '{}', '{"version":12,"sessions":[]}', JSON.stringify({ version: PLAYROOM_VERSION, sessions: [null, {}, { id: 'bad' }] })]) {
    store.setItem(PLAYROOM_KEY, raw);
    assert.deepEqual(loadGames(store), []);
  }
  assert.deepEqual(loadGames({ getItem() { throw new Error('blocked'); } }), []);
  assert.equal(saveGames({ setItem() { throw new Error('quota'); } }, [make()]), false);
});

test('bounded history contains at most twenty unique sessions and five hundred total moves', () => {
  const store = storage();
  saveGames(store, Array.from({ length: 25 }, (_, index) => make('materials', `game-${index}`)));
  assert.equal(loadGames(store).length, 20);
  assert.equal(loadGames(store)[0].id, 'game-5');
  const games = Array.from({ length: 20 }, (_, index) => {
    let state = make('materials', `long-${index}`);
    for (let i = 0; i < 30; i += 1) state = attemptMove(state, 'copper-wire', 'glass', { now }).state;
    return state;
  });
  saveGames(store, games);
  assert.equal(loadGames(store).length, 16);
  assert.ok(loadGames(store).reduce((sum, state) => sum + state.attempts.length, 0) <= MAX_GAME_ATTEMPTS);
  assert.equal(loadGames(store).at(-1).id, 'long-19');
});

test('a full session rejects extra moves with a useful restart message', () => {
  let state = make();
  for (let i = 0; i < MAX_GAME_ATTEMPTS; i += 1) state = attemptMove(state, 'copper-wire', 'glass', { now }).state;
  const result = attemptMove(state, 'copper-wire', 'metals', { now });
  assert.equal(result.accepted, false);
  assert.match(result.text, /Start a fresh game/);
  assert.equal(result.state.attempts.length, 500);
  assert.equal(result.state.points, 0);
});

test('summary separates exact mistakes, retries, hints and supported success without inventing mastery', () => {
  let state = attemptMove(make(), 'copper-wire', 'glass', { now }).state;
  state = hintGame(state, { now });
  state = attemptMove(state, 'copper-wire', 'metals', { now }).state;
  const report = summarizeGames([state]);
  assert.equal(report.wrongCount, 1);
  assert.equal(report.correctCount, 1);
  assert.equal(report.retryCount, 1);
  assert.equal(report.firstTryUnaidedCount, 0);
  assert.equal(report.hintCount, 1);
  assert.equal(report.totalPoints, 10);
  assert.equal(report.exactAttempts[0].pieceLabel, 'Curled orange wire');
  assert.equal(report.exactAttempts[0].itemRevealedName, 'Copper wire');
  assert.equal(report.exactAttempts[0].targetLabel, 'Glass');
  assert.equal(report.exactAttempts[0].expectedTargetLabel, 'Metals');
  assert.equal(report.exactHints[0].text, currentLevel(state).help);
  assert.equal(report.topics.length, 1);
  assert.equal(report.needsPractice[0].gameId, 'materials');
  assert.equal(summarizeGames([]).topics.length, 0);
  assert.equal(summarizeGames([hintGame(make(), { now })]).hintCount, 1);
});

test('authored activities keep adult, specialist and damaged-item boundaries', () => {
  const materials = gameById('materials'), care = gameById('care');
  assert.match(materials.levels[0].story, /pretend pieces.*Keep real devices closed/);
  assert.match(materials.levels[1].pieces[0].parentExplanation, /possible uses.*not a guarantee/);
  const warning = care.levels[1].pieces.find(piece => piece.id === 'cord-warning');
  assert.equal(warning.kind, 'warning');
  assert.equal(warning.answer, 'stop-adult');
  assert.match(warning.correct, /Leave the damaged item alone/);
  assert.match(care.levels[1].help, /adult follows the maker’s unplugging and cleaning instructions/);
});

function parentSetup(t, records = [], { removeFails = false, unavailable = false } = {}) {
  const dom = new JSDOM('<main></main>', { url: 'https://family.test/' });
  const win = dom.window, host = win.document.querySelector('main'), store = storage();
  saveGames(store, records);
  store.setItem('fixforward.pips-workshop.v1', 'keep earlier record');
  if (removeFails) store.removeItem = () => { throw new Error('denied'); };
  const navigations = [], exports = [], prints = [];
  win.print = () => prints.push([...host.querySelectorAll('.prp-group')].every(group => group.open));
  const cleanup = mountPlayroomParent(host, { storage: unavailable ? null : store, onNavigate: route => navigations.push(route), onExport: value => exports.push(value) });
  t.after(() => { cleanup(); win.close(); });
  return { win, host, store, navigations, exports, prints, cleanup, click(selector) { const element = host.querySelector(selector); assert.ok(element, selector); element.click(); } };
}

test('parent review exposes the exact choice, intended match, explanation and hint', t => {
  let state = attemptMove(make(), 'copper-wire', 'glass', { now }).state;
  state = hintGame(state, { now });
  state = attemptMove(state, 'copper-wire', 'metals', { now }).state;
  const ui = parentSetup(t, [state]);
  const first = ui.host.querySelector('.prp-evidence li');
  assert.match(first.textContent, /Copper wire/);
  assert.match(first.textContent, /Glass/);
  assert.match(first.textContent, /Metals/);
  assert.ok(first.textContent.includes(state.attempts[0].text));
  ui.click('[data-playroom-filter="hints"]');
  assert.ok(ui.host.querySelector('[data-playroom-evidence]').textContent.includes(state.hints[0].text));
  ui.click('a[href="#play?game=materials"]');
  assert.deepEqual(ui.navigations, ['#play?game=materials']);
});

test('parent game filters and exports retain separate game evidence', t => {
  const materials = attemptMove(make(), 'copper-wire', 'metals', { now }).state;
  const care = attemptMove(make('care', 'care-test'), 'drink', 'away-tray', { now }).state;
  const ui = parentSetup(t, [materials, care]);
  const select = ui.host.querySelector('[data-playroom-game]');
  select.value = 'care';
  select.dispatchEvent(new ui.win.Event('change', { bubbles: true }));
  assert.match(ui.host.querySelector('[data-playroom-evidence]').textContent, /Open drink/);
  assert.doesNotMatch(ui.host.querySelector('[data-playroom-evidence]').textContent, /Copper wire/);
  ui.click('[data-prp-action="export"]');
  assert.equal(ui.exports.length, 1);
  assert.equal(ui.exports[0].sessionCount, 1);
  assert.equal(ui.exports[0].exactAttempts[0].gameId, 'care');
  ui.click('[data-prp-action="print"]');
  assert.deepEqual(ui.prints, [true]);
  assert.equal(ui.host.querySelector('.prp-group').open, false);
});

test('parent clear requires confirmation and removes only the new games key', t => {
  const ui = parentSetup(t, [make()]);
  ui.click('[data-prp-action="confirm-clear"]');
  assert.equal(loadGames(ui.store).length, 1, 'Hidden confirmation cannot clear anything');
  ui.click('[data-prp-action="ask-clear"]');
  ui.click('[data-prp-action="cancel-clear"]');
  assert.equal(loadGames(ui.store).length, 1);
  ui.click('[data-prp-action="ask-clear"]');
  ui.click('[data-prp-action="confirm-clear"]');
  assert.deepEqual(loadGames(ui.store), []);
  assert.equal(ui.store.getItem('fixforward.pips-workshop.v1'), 'keep earlier record');
  assert.match(ui.host.querySelector('[data-playroom-notice]').textContent, /have been cleared/);
});

test('parent clear failure leaves records visible and explains the problem', t => {
  const ui = parentSetup(t, [make()], { removeFails: true });
  ui.click('[data-prp-action="ask-clear"]');
  ui.click('[data-prp-action="confirm-clear"]');
  assert.equal(loadGames(ui.store).length, 1);
  assert.equal(ui.host.querySelector('[data-playroom-clear-error]').hidden, false);
  assert.match(ui.host.querySelector('[data-playroom-clear-error]').textContent, /have been kept/);
});

test('parent empty/unavailable states do not invent records and cleanup removes action listeners', t => {
  const ui = parentSetup(t, [], { unavailable: true });
  assert.match(ui.host.textContent, /storage is unavailable/);
  assert.equal(ui.host.querySelector('[data-prp-action="export"]').disabled, true);
  assert.equal(ui.host.querySelectorAll('.prp-group').length, 0);
  ui.cleanup();
  ui.click('[data-prp-action="print"]');
  assert.deepEqual(ui.prints, []);
});

test('new materials rounds balance six clues across three groups without naming their materials first', () => {
  const state = make();
  assert.equal(state.contentVersion, 2);
  assert.equal(make('care').contentVersion, 1);
  assert.equal(currentLevel(state).pieces.length, 6);
  assert.deepEqual(currentLevel(state).pieces.map(piece => piece.id), ['copper-wire', 'aluminium-frame', 'screen-glass', 'camera-lens', 'plastic-shell', 'plastic-button']);
  for (const target of currentLevel(state).targets) assert.equal(currentLevel(state).pieces.filter(piece => piece.answer === target.id).length, 2);
  for (const piece of currentLevel(state).pieces) {
    assert.doesNotMatch(piece.label, /copper|aluminium|glass|plastic|metal/i);
    assert.ok(piece.revealedLabel);
    assert.notEqual(piece.label, piece.revealedLabel);
  }
});

test('short child feedback and precise parent explanations are saved as distinct evidence', () => {
  const definition = gameById('materials');
  assert.ok(definition.childLearning && definition.childTalkPrompt);
  for (const level of definition.levels) {
    for (const piece of level.pieces) {
      assert.ok(piece.correct.split(/\s+/).length <= 12);
      assert.ok(piece.wrong.split(/\s+/).length <= 12);
      assert.ok(piece.parentExplanation.length > piece.correct.length);
    }
  }
  const result = attemptMove(make(), 'copper-wire', 'glass', { now });
  const saved = result.state.attempts[0];
  assert.equal(result.text, saved.text);
  assert.equal(saved.contentVersion, 2);
  assert.equal(saved.itemRevealedName, 'Copper wire');
  assert.equal(saved.parentExplanation, definition.levels[0].pieces[0].parentExplanation);
  assert.notEqual(saved.parentExplanation, saved.text);
  assert.deepEqual(validateGame(result.state), result.state);
});

test('battery and whole-phone stages explain wrong routes and keep scoring after useful corrections', () => {
  let state = advanceGame(solveLevel(make()), { now });
  state = advanceGame(solveLevel(state), { now });
  assert.equal(currentLevel(state).id, 'battery-stop');
  const batteryLevel = currentLevel(state);
  assert.match(batteryLevel.story, /loose, undamaged battery.*Move only the picture/);
  assert.match(batteryLevel.pieces[0].parentExplanation, /Damaged, swollen or leaking batteries need specialist advice/);
  for (const wrong of ['factory', 'rubbish']) {
    const result = attemptMove(state, 'battery-picture', wrong, { now });
    state = result.state;
    assert.equal(result.correct, false);
    assert.equal(result.points, 0);
    assert.match(result.text, /own collection/);
  }
  let result = attemptMove(state, 'battery-picture', 'battery-dropoff', { now });
  assert.equal(result.points, 10);
  assert.match(result.text, /fires in bins/);
  state = advanceGame(result.state, { now });
  assert.equal(currentLevel(state).id, 'phone-choice');
  assert.match(currentLevel(state).story, /cannot fix this phone.*adult cleared its data.*battery stays inside/);
  assert.match(currentLevel(state).pieces[0].parentExplanation, /qualified repairer.*unrepairable/);
  assert.match(currentLevel(state).pieces[0].parentExplanation, /service accepts it/);
  result = attemptMove(state, 'old-phone', 'rubbish', { now });
  assert.equal(result.correct, false);
  assert.match(result.text, /useful materials are lost/);
  result = attemptMove(result.state, 'old-phone', 'ewaste-dropoff', { now });
  state = advanceGame(result.state, { now });
  assert.equal(state.status, 'complete');
  assert.equal(state.points, 155);
  assert.equal(state.attempts.length, 14);
  assert.deepEqual(completedGameLevels(state), ['recover', 'build', 'battery-stop', 'phone-choice']);
});

function oldFormat(state) {
  const old = structuredClone(state);
  delete old.contentVersion;
  for (const attempt of old.attempts) { delete attempt.contentVersion; delete attempt.parentExplanation; delete attempt.itemRevealedName; }
  for (const hint of old.hints) delete hint.contentVersion;
  return old;
}

test('pre-version completed records retain their nine moves, 135 points and exact original feedback', () => {
  const store = storage();
  const old = oldFormat(finish(createGame('materials', { id: 'old-complete', now, contentVersion: 1 })));
  store.setItem(PLAYROOM_KEY, JSON.stringify({ version: PLAYROOM_VERSION, sessions: [old] }));
  const [loaded] = loadGames(store);
  assert.equal(loaded.contentVersion, 1);
  assert.equal(loaded.status, 'complete');
  assert.equal(loaded.points, 135);
  assert.equal(loaded.attempts.length, 9);
  for (let index = 0; index < old.attempts.length; index += 1) {
    for (const [key, value] of Object.entries(old.attempts[index])) assert.deepEqual(loaded.attempts[index][key], value, `Earlier move ${index} preserves ${key}`);
  }
  assert.ok(loaded.attempts.some(attempt => attempt.pieceId === 'steel-screw'));
  assert.ok(loaded.attempts.some(attempt => attempt.pieceId === 'circuit-gold'));
  assert.equal(loaded.attempts[0].text, 'Copper is a metal. Specialists can recover useful metals from some discarded electronics.');
  const report = summarizeGames([loaded]);
  assert.equal(report.sessions[0].earlierRound, true);
  assert.match(report.sessions[0].versionLabel, /Earlier round.*Version 1/);
  assert.deepEqual(report.topics.map(topic => topic.levelId), ['recover', 'build']);
  assert.equal(report.topics[0].levelTitle, 'Catch the useful materials');
});

test('unfinished old rounds retain prior choices and can be stored beside new rounds without migration loss', () => {
  const store = storage();
  let old = createGame('materials', { id: 'old-partial', now, contentVersion: 1 });
  old = attemptMove(old, 'steel-screw', 'metals', { now }).state;
  old = attemptMove(old, 'circuit-gold', 'glass', { now }).state;
  old = hintGame(old, { now });
  const raw = oldFormat(old);
  store.setItem(PLAYROOM_KEY, JSON.stringify({ version: PLAYROOM_VERSION, sessions: [raw] }));
  let [loaded] = loadGames(store);
  assert.equal(gameForState(loaded).contentVersion, 1);
  assert.ok(currentLevel(loaded).pieces.some(piece => piece.id === 'circuit-gold'));
  assert.equal(loaded.points, 15);
  assert.deepEqual(loaded.attempts.map(attempt => attempt.text), raw.attempts.map(attempt => attempt.text));
  assert.equal(loaded.hints[0].text, raw.hints[0].text);
  loaded = attemptMove(loaded, 'circuit-gold', 'metals', { now }).state;
  assert.equal(loaded.points, 25);
  const modern = attemptMove(make('materials', 'new-round'), 'camera-lens', 'glass', { now }).state;
  assert.equal(saveGames(store, [loaded, modern]), true);
  const records = loadGames(store);
  assert.deepEqual(records.map(record => record.contentVersion), [1, 2]);
  assert.deepEqual(records.map(record => record.id), ['old-partial', 'new-round']);
  const report = summarizeGames(records);
  assert.equal(report.topics.length, 2, 'Shared level IDs remain separate version-specific learning evidence');
  assert.deepEqual(report.topics.map(topic => topic.contentVersion), [1, 2]);
  assert.equal(report.topics[0].attemptCount, 3);
  assert.equal(report.topics[1].attemptCount, 1);
});

test('unsupported content versions are rejected instead of replaying against the newest answers', () => {
  assert.equal(createGame('materials', { contentVersion: 99 }), null);
  assert.equal(createGame('care', { contentVersion: 2 }), null);
  assert.equal(gameForState({ gameId: 'materials', contentVersion: 99 }), null);
  assert.equal(validateGame({ ...make(), contentVersion: 99 }), null);
  assert.equal(validateGame({ ...make('care'), contentVersion: 2 }), null);
  assert.equal(gameForState({ gameId: 'care' }).contentVersion, 1);
});

test('parent review labels earlier rounds and separates child feedback from adult teaching context', t => {
  const old = oldFormat(attemptMove(createGame('materials', { id: 'old-parent', now, contentVersion: 1 }), 'copper-wire', 'glass', { now }).state);
  const modern = attemptMove(make('materials', 'new-parent'), 'copper-wire', 'glass', { now }).state;
  const ui = parentSetup(t, [old, modern]);
  const groups = [...ui.host.querySelectorAll('.prp-group')];
  assert.equal(groups.length, 2);
  assert.match(groups[0].querySelector('summary').textContent, /Earlier round.*Version 1/);
  assert.match(groups[1].querySelector('summary').textContent, /Version 2/);
  assert.ok(groups[0].textContent.includes(old.attempts[0].text));
  assert.ok(groups[1].textContent.includes(modern.attempts[0].text));
  assert.ok(groups[1].querySelector('.prp-parent-explanation').textContent.includes(modern.attempts[0].parentExplanation));
  assert.match(groups[1].textContent, /Curled orange wire/);
  assert.match(groups[1].textContent, /Item in this story: Copper wire/);
  assert.equal(groups[0].querySelector('.prp-parent-explanation'), null, 'Old feedback is retained without inventing new teaching context');
  ui.click('[data-prp-action="export"]');
  assert.deepEqual(ui.exports[0].sessions.map(record => record.contentVersion), [1, 2]);
});
