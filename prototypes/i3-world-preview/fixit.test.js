/** Fix-it Station rules and screens. Engine tests pin the stories, the waste
 * ladder, scoring and the grown-ups' record; screen tests use a stand-in 3D scene,
 * so a "drop" is exactly what a real drag reports. The real Three.js workshop is
 * checked in a browser separately. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { STATIONS, BINS, TARGETS, CARDS, STORIES, ROUNDS, judge, createRound, currentStory, drop, isRoundDone, starsFor, readSave, writeSave, recordRound, recordHistory, roundSummary, learningRecord, SAVE_KEY, cardById } from './fixit-engine.js';
import { MODEL_PARTS } from './models.js';
import { WASTE_PARTS } from './waste-models.js';
import { mountFixit } from './fixit.js';

const memoryStorage = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };
const seen = (extra = {}) => { const storage = memoryStorage(); storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, stars: {}, cards: [], intro: true, ...extra })); return storage; };

test('stories: distinct scenarios over 4 rounds, each using a real 3D model part, a real place and a real card', () => {
  const used = ROUNDS.flatMap(round => round.stories);
  assert.equal(new Set(used).size, used.length);
  assert.equal(used.length, Object.keys(STORIES).length);
  assert.ok(used.length >= 24);
  for (const item of Object.values(STORIES)) {
    const parts = MODEL_PARTS[item.model] || WASTE_PARTS[item.model];
    assert.ok(parts, `${item.id}: model ${item.model}`);
    assert.ok(parts.includes(item.part), `${item.id}: part ${item.part}`);
    assert.ok(TARGETS.some(t => t.id === item.answer), item.id);
    assert.ok(cardById(item.card), `${item.id}: card ${item.card}`);
    assert.ok(item.clues.length >= 1 && item.why);
    for (const id of Object.keys(item.misses)) assert.ok(TARGETS.some(t => t.id === id) && id !== item.answer, `${item.id}: miss ${id}`);
  }
  // Round 1 introduces each workshop station once; Bin day uses all three bins.
  assert.deepEqual(ROUNDS[0].stories.map(id => STORIES[id].answer).sort(), ['adult', 'ewaste', 'repair', 'reuse']);
  for (const bin of BINS) assert.ok(ROUNDS[1].stories.some(id => STORIES[id].answer === bin.id), `Bin day uses ${bin.id}`);
  // Later rounds mix every workshop station with everyday waste.
  for (const round of ROUNDS.slice(2)) {
    for (const station of STATIONS) assert.ok(round.stories.some(id => STORIES[id].answer === station.id), `round ${round.id} has ${station.id}`);
    assert.ok(round.stories.some(id => !STORIES[id].electrical), `round ${round.id} has an everyday item`);
  }
  assert.equal(new Set(TARGETS.map(t => t.key)).size, 7);
});

test('the waste ladder: danger means an adult, electrical things never go in home bins, and the rubbish bin is right for true rubbish', () => {
  for (const item of Object.values(STORIES)) {
    if (item.tone === 'danger') assert.equal(item.answer, 'adult', item.id);
    if (!item.electrical) continue;
    for (const bin of BINS) {
      const result = judge(item, bin.id);
      assert.equal(result.ok, false); assert.equal(result.reason, 'bin'); assert.equal(result.card, 'never-bin');
    }
  }
  assert.equal(judge(STORIES['laptop-battery'], 'adult').ok, true);
  assert.equal(judge(STORIES['aa-battery'], 'recycle').reason, 'bin', 'batteries never go in recycling');
  assert.equal(judge(STORIES['broken-mug'], 'bin').ok, true);
  assert.equal(judge(STORIES['banana-peel'], 'compost').ok, true);
  assert.equal(judge(STORIES['drink-can'], 'recycle').ok, true);
  const miss = judge(STORIES['broken-mug'], 'recycle');
  assert.equal(miss.reason, 'wrong'); assert.match(miss.text, /glass/, 'a common mistake gets its own explanation');
  assert.match(judge(STORIES['banana-peel'], 'bin').text, /landfill/);
});

test('wrong drops keep the item, give a clue-based hint and cost the first-try star', () => {
  const round = createRound(1);
  const first = currentStory(round);
  const wrong = STATIONS.find(s => s.id !== first.answer).id;
  const miss = drop(round, wrong);
  assert.equal(miss.ok, false); assert.equal(miss.reason, 'wrong');
  assert.equal(currentStory(round).id, first.id);
  assert.doesNotMatch(miss.text, new RegExp(TARGETS.find(s => s.id === first.answer).name, 'i'), 'hint does not give the answer away');
  const hit = drop(round, first.answer);
  assert.equal(hit.ok, true); assert.equal(hit.firstTry, false); assert.equal(round.firstTry, 0);
  assert.notEqual(currentStory(round).id, first.id);
});

test('putting an electrical thing in a home bin unlocks "Never in home bins" once, so mistakes still teach', () => {
  const round = createRound(1);
  const result = drop(round, 'bin');
  assert.equal(result.unlocked, 'never-bin');
  assert.equal(drop(round, 'recycle').unlocked, null);
  assert.ok(round.binTried);
});

test('stars: 3 for every first try, 2 for most, and at least 1 for finishing', () => {
  assert.equal(starsFor(4, 4), 3); assert.equal(starsFor(3, 4), 2); assert.equal(starsFor(4, 6), 2); assert.equal(starsFor(1, 6), 1); assert.equal(starsFor(0, 6), 1); assert.equal(starsFor(0, 0), 0);
});

test('a perfect round unlocks its cards; saving keeps best stars, migrates old saves and ignores bad data', () => {
  const round = createRound(1);
  while (!isRoundDone(round)) drop(round, currentStory(round).answer);
  assert.equal(round.firstTry, 4);
  assert.deepEqual(round.cards.sort(), ['batteries', 'materials', 'repair-cafe', 'reuse']);
  const storage = memoryStorage(), save = readSave(storage);
  assert.deepEqual(recordRound(save, round), { stars: 3, first: true });
  writeSave(storage, save);
  const weaker = createRound(1); drop(weaker, 'bin'); while (!isRoundDone(weaker)) drop(weaker, currentStory(weaker).answer);
  recordRound(save, weaker);
  assert.equal(save.stars[1], 3, 'a weaker replay never lowers stars');
  assert.ok(save.cards.includes('never-bin'));
  storage.setItem(SAVE_KEY, '{"stars":{"1":9,"2":2},"cards":["reuse","made-up"]}');
  assert.deepEqual(readSave(storage), { stars: { 2: 2 }, cards: ['reuse'], intro: false, history: [] });
  // Version 1 had three rounds; its rounds 2 and 3 are now rounds 3 and 4.
  storage.setItem(SAVE_KEY, '{"version":1,"stars":{"1":3,"2":2,"3":1},"cards":[]}');
  assert.deepEqual(readSave(storage).stars, { 1: 3, 3: 2, 4: 1 });
  storage.setItem(SAVE_KEY, '{oops'); assert.deepEqual(readSave(storage), { stars: {}, cards: [], intro: false, history: [] });
});

test('the learning record keeps every choice in order and lists items that needed more tries', () => {
  const round = createRound(2);
  drop(round, 'bin'); drop(round, 'recycle'); drop(round, 'compost'); // banana peel: try 3
  drop(round, 'recycle'); // drink can: first try
  assert.deepEqual(roundSummary(round), [
    { story: 'banana-peel', tries: ['bin', 'recycle', 'compost'], solved: true },
    { story: 'drink-can', tries: ['recycle'], solved: true },
  ]);
  const save = { stars: {}, cards: [], intro: true, history: [] };
  recordHistory(save, round, { finished: false, at: '2026-10-11T09:00:00.000Z' });
  const record = learningRecord(save.history);
  assert.equal(record.rounds, 1); assert.equal(record.sorted, 2); assert.equal(record.firstTries, 1); assert.equal(record.retried, 1);
  assert.deepEqual(record.talk.map(item => item.story), ['banana-peel']);
  // It survives saving and drops anything that doesn't match a real story or place.
  const storage = memoryStorage(); writeSave(storage, save);
  const raw = JSON.parse(storage.getItem(SAVE_KEY)); raw.history.push({ roundId: 9, at: 'x', items: [] }); raw.history[0].items.push({ story: 'nope', tries: ['bin'] }); raw.history[0].items[0].tries.push('moon');
  storage.setItem(SAVE_KEY, JSON.stringify(raw));
  assert.deepEqual(readSave(storage).history, save.history);
});

// ---- Screens with a stand-in 3D scene ----
function fakeScene(log) {
  return async (canvas, callbacks) => {
    log.callbacks = callbacks;
    callbacks.onLayout({ targets: Object.fromEntries(TARGETS.map((s, n) => [s.id, { label: { x: 100 + n * 90, y: 40 } }])), item: { x: 300, y: 320 } });
    return {
      showItem: async item => log.push(['show', item.id]),
      accept: async (id, { onLand } = {}) => { log.push(['accept', id]); onLand?.(); },
      reject: async id => log.push(['reject', id]),
      preview: id => log.push(['preview', id]),
      resetStations: () => {}, setVisible: () => {},
      dispose: () => log.push(['dispose']),
    };
  };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
// Focus moving to a station button lights it up (a preview); skip those when checking moves.
const lastMove = log => log.filter(entry => entry[0] !== 'preview').at(-1);
async function setup(t, { storage = seen(), createScene, log = [] } = {}) {
  const dom = new JSDOM('<main></main><div id="announcement"></div>', { url: 'http://fixit.test/', pretendToBeVisual: true });
  const host = dom.window.document.querySelector('main'), awards = [], learned = [];
  const cleanup = mountFixit(host, { storage, createScene: createScene || fakeScene(log), reducedMotion: true, onAward: (...a) => awards.push(a), onLearn: l => learned.push(l) });
  t.after(() => { cleanup(); dom.window.close(); });
  const click = async selector => { const node = host.querySelector(selector); assert.ok(node, selector); node.click(); await flush(); await flush(); };
  const key = async k => { dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true })); await flush(); await flush(); };
  return { dom, host, storage, awards, learned, log, click, key, text: () => host.textContent };
}

test('first visit opens a 3-step how-to-play intro; Skip remembers it, and "Let’s play!" starts round 1', async t => {
  const storage = memoryStorage();
  const ui = await setup(t, { storage });
  const intro = () => ui.host.querySelector('.fx-intro');
  assert.ok(intro(), 'intro shows on the first visit');
  assert.equal(intro().getAttribute('role'), 'dialog');
  assert.match(intro().textContent, /Look at the clues/);
  assert.equal(intro().querySelectorAll('[data-intro-dot]').length, 3);
  await ui.click('[data-intro-next]');
  assert.match(intro().textContent, /Drag it to the right place/);
  await ui.key('ArrowRight');
  assert.match(intro().textContent, /Win stars and cards/);
  await ui.click('[data-intro-play]');
  assert.equal(intro(), null);
  assert.ok(ui.host.querySelector('.fx-play[data-round-id="1"]'), 'Let’s play starts the first round');
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).intro, true);
  await ui.click('[data-to-hub]');
  assert.equal(intro(), null, 'the intro does not come back by itself');
  await ui.click('[data-howto]');
  assert.ok(intro(), 'How to play reopens it');
  await ui.click('[data-intro-skip]');
  assert.equal(intro(), null);
});

test('start screen explains the game, the stations, the Bin corner and the grown-ups’ record', async t => {
  const ui = await setup(t);
  assert.match(ui.text(), /Pip’s Fix-it Workshop/);
  assert.equal(ui.host.querySelector('.fx-intro'), null, 'no intro once it has been seen');
  assert.equal(ui.host.querySelectorAll('.fx-round').length, 4);
  assert.equal(ui.host.querySelectorAll('.fx-round:disabled').length, 0);
  for (const s of TARGETS) assert.match(ui.text(), new RegExp(s.name));
  assert.match(ui.text(), /last choice/);
  assert.ok(ui.host.querySelector('[data-parents]'));
  assert.ok(ui.host.querySelector('[data-music][aria-pressed]') && ui.host.querySelector('[data-sound][aria-pressed]'));
});

test('a 3D drop goes through the same rules: wrong shows ✗ on the workshop, right shows ✓, praise and a bouncing Next', async t => {
  const ui = await setup(t);
  await ui.click('[data-round="1"]');
  assert.deepEqual(ui.log[0], ['show', 'fan-works']);
  assert.match(ui.text(), /Breezy the fan/);
  assert.equal(ui.host.querySelectorAll('.fx-clue').length, 3);
  // Labels follow the 3D layout, bins included.
  assert.equal(ui.host.querySelector('[data-label="reuse"]').style.left, '190px');
  assert.ok(ui.host.querySelector('[data-label="compost"]'));
  ui.log.callbacks.onDrop('repair'); await flush(); await flush();
  assert.deepEqual(lastMove(ui.log), ['reject', 'repair']);
  const feedback = ui.host.querySelector('[data-feedback]');
  assert.ok(ui.host.querySelector('[data-canvas-wrap]').contains(feedback), 'feedback sits on the workshop, not below it');
  assert.match(feedback.className, /is-retry/);
  assert.match(feedback.textContent, /look at the clues/i);
  assert.ok(feedback.querySelector('.fx-badge-no'));
  assert.equal(ui.host.querySelector('.fx-guide .fx-pip').dataset.mood, 'oops');
  ui.log.callbacks.onDrop('reuse'); await flush(); await flush();
  assert.deepEqual(lastMove(ui.log), ['accept', 'reuse']);
  assert.match(feedback.className, /is-ok/);
  assert.match(feedback.textContent, /A new home!/);
  assert.match(feedback.textContent, /New Discovery card/);
  assert.equal(ui.host.querySelector('.fx-guide .fx-pip').dataset.mood, 'cheer');
  assert.equal(ui.host.querySelector('[data-first]').textContent, '0', 'the earlier wrong try costs the first-try star');
  const nextButton = feedback.querySelector('[data-next]');
  assert.ok(nextButton && nextButton.classList.contains('fx-btn-go'), 'Next is the bouncing button inside the workshop');
  assert.equal(ui.learned[0].id, 'fixit:card:reuse');
});

test('an electrical thing in any home bin bounces back with a lesson and its own card', async t => {
  const ui = await setup(t);
  await ui.click('[data-round="1"]');
  ui.log.callbacks.onDrop('recycle'); await flush(); await flush();
  assert.deepEqual(lastMove(ui.log), ['reject', 'recycle']);
  assert.match(ui.text(), /Not the recycling bin!/);
  assert.match(ui.text(), /Never in home bins/);
  assert.match(ui.host.querySelector('[data-pip]').textContent, /never go in home bins/);
});

test('Bin day: everyday things go in the right kerbside bin, with keys 5–7', async t => {
  const ui = await setup(t);
  await ui.click('[data-round="2"]');
  assert.match(ui.text(), /Nana the banana peel/);
  await ui.key('7'); // rubbish: wrong for food
  assert.match(ui.host.querySelector('[data-feedback]').textContent, /landfill/);
  await ui.key('6'); // food & garden
  assert.match(ui.host.querySelector('[data-feedback]').textContent, /Food for the soil!/);
  await ui.key('n');
  assert.match(ui.text(), /Fizz the drink can/);
  await ui.key('5');
  assert.match(ui.host.querySelector('[data-feedback]').textContent, /recycling loop/);
});

test('buttons and number keys play a whole round, then the report shows how each item went', async t => {
  const ui = await setup(t);
  await ui.click('[data-round="1"]');
  const stories = ROUNDS[0].stories;
  await ui.key(STATIONS.find(s => s.id !== STORIES[stories[0]].answer).key); // one wrong try first
  for (const id of stories) {
    await ui.key(TARGETS.find(s => s.id === STORIES[id].answer).key);
    await ui.key('n');
  }
  assert.match(ui.text(), /Workshop sorted!/);
  assert.match(ui.text(), /3\s*of 4 sorted on the first try/);
  assert.match(ui.text(), /Talk together/);
  const rows = ui.host.querySelectorAll('.fx-howitwent > ol > li');
  assert.equal(rows.length, 4);
  assert.match(rows[0].textContent, /Got it on try 2/);
  assert.match(rows[1].textContent, /First try!/);
  assert.equal(ui.host.querySelectorAll('.fx-report-cards .fx-card').length, 4);
  const saved = JSON.parse(ui.storage.getItem(SAVE_KEY));
  assert.deepEqual(saved.stars, { 1: 2 });
  assert.equal(saved.history[0].items[0].tries.length, 2);
  assert.equal(ui.awards.length, 1);
  assert.ok(ui.log.some(entry => entry[0] === 'dispose'), '3D scene is released after the round');
});

test('grown-ups see what was chosen, in order, and how many tries it took', async t => {
  const ui = await setup(t);
  await ui.click('[data-parents]');
  assert.match(ui.text(), /Nothing recorded yet/);
  await ui.click('[data-to-hub]');
  await ui.click('[data-round="2"]');
  await ui.key('7'); await ui.key('5'); await ui.key('6'); // banana peel on try 3
  await ui.click('[data-to-hub]'); // leaving part-way still keeps the tries
  await ui.click('[data-parents]');
  assert.match(ui.text(), /What your child sorted/);
  assert.match(ui.text(), /Saved only in this browser/);
  const talk = ui.host.querySelector('.fx-talk-card');
  assert.match(talk.textContent, /Nana the banana peel/);
  assert.match(talk.textContent, /Got it on try 3/);
  assert.deepEqual([...talk.querySelectorAll('.fx-path-step')].map(step => step.className.match(/fx-tone-(\w+)/)[1]), ['bin', 'recycle', 'compost']);
  assert.match(talk.textContent, /Try asking/);
  assert.match(ui.host.querySelector('.fx-history-entry').textContent, /Left part-way/);
  await ui.click('[data-ask-clear]');
  await ui.click('[data-clear]');
  assert.match(ui.text(), /Nothing recorded yet/);
  assert.deepEqual(JSON.parse(ui.storage.getItem(SAVE_KEY)).history, []);
});

test('choices are locked while an item is flying, so double taps cannot skip stories', async t => {
  let release;
  const log = [];
  const slow = async (canvas, callbacks) => { log.callbacks = callbacks; return { showItem: async () => {}, accept: () => new Promise(r => { release = r; }), reject: async () => {}, preview: () => {}, setVisible: () => {}, resetStations: () => {}, dispose: () => {} }; };
  const ui = await setup(t, { createScene: slow, log });
  await ui.click('[data-round="1"]');
  await ui.key('2');
  assert.equal(ui.host.querySelector('[data-station="repair"]').disabled, true);
  await ui.key('1');
  assert.match(ui.host.querySelector('[data-progress]').textContent, /Item 2 of 4|Item 1 of 4/);
  assert.equal(ui.host.querySelector('[data-next]'), null);
  release(); await flush(); await flush();
  assert.ok(ui.host.querySelector('[data-next]'));
});

test('without WebGL the game falls back to a playable 2D view', async t => {
  const ui = await setup(t, { createScene: async () => { throw new Error('no webgl'); } });
  await ui.click('[data-round="3"]');
  assert.ok(ui.host.querySelector('[data-canvas-wrap]').classList.contains('is-2d'));
  assert.match(ui.text(), /3D isn’t available/);
  assert.ok(ui.host.querySelector('.fx-item-icon svg'));
  await ui.click(`[data-station="${STORIES['blender-unwanted'].answer}"]`);
  assert.match(ui.host.querySelector('[data-feedback]').textContent, /A new home!/);
});

test('place labels teach what each station and bin is for, and the book shows found and hidden cards', async t => {
  const ui = await setup(t, { storage: seen({ cards: ['repair-cafe'] }) });
  await ui.click('[data-round="1"]');
  await ui.click('[data-label="repair"]');
  assert.match(ui.host.querySelector('[data-station-info]').textContent, /volunteers help people fix/);
  await ui.click('[data-info-close]');
  assert.equal(ui.host.querySelector('[data-station-info]').hidden, true);
  await ui.click('[data-label="compost"]');
  assert.match(ui.host.querySelector('[data-station-info]').textContent, /compost/);
  await ui.click('[data-to-hub]');
  await ui.click('[data-book]');
  assert.equal(ui.host.querySelectorAll('.fx-card.is-found').length, 1);
  assert.equal(ui.host.querySelectorAll('.fx-card.is-locked').length, CARDS.length - 1);
});

test('sound and music are made on the device: no audio files or network calls, and the 3D view loads lazily', async () => {
  const read = name => readFile(new URL(`./${name}`, import.meta.url), 'utf8');
  const [scene, ui, sound, party, waste] = await Promise.all(['fixit-3d.js', 'fixit.js', 'fixit-sound.js', 'fixit-party.js', 'waste-models.js'].map(read));
  assert.match(scene, /from '\.\/models\.js'/);
  assert.match(scene, /from '\.\/waste-models\.js'/);
  for (const source of [scene, ui, party, waste]) assert.doesNotMatch(source, /AudioContext|new Audio|fetch\(|XMLHttpRequest/);
  assert.match(sound, /AudioContext/);
  assert.doesNotMatch(sound, /new Audio|fetch\(|XMLHttpRequest|\.mp3|\.wav|\.ogg/);
  assert.doesNotMatch(ui, /from '\.\/fixit-3d\.js'/, '3D loads lazily, only when a round starts');
});
