/** Scrapworks rules and screens. Engine tests pin each rule in the build brief;
 * DOM tests play real levels through tap and keyboard controls in jsdom. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  ITEMS, LEVELS, DESTINATIONS, HAZARD_MESSAGE, POINTS, evaluateChoice, createShift, currentItem,
  inspect, clearData, applyChoice, bestScore, starsFor, readSave, writeSave, recordStars, isUnlocked, SAVE_KEY,
} from './scrapworks-engine.js';
import { mountScrapworks, ART_NAMES } from './scrapworks.js';

const ready = { inspected: true, dataCleared: true, tokens: 9 };
const find = predicate => Object.values(ITEMS).find(predicate);
const memoryStorage = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };

/** Choose the best route for the current item, honouring a pre-planned repair set. */
function bestRoute(entry, repairSet) {
  if (entry.hazard) return 'hold';
  if (entry.condition === 'working') return 'reuse';
  if (entry.condition === 'end_of_life') return 'recycle';
  return repairSet.has(entry.id) ? 'repair' : 'recycle';
}
/** Brute-force the best repair subset so the knapsack is checked independently. */
function optimalRepairs(level) {
  const repairable = level.items.map(id => ITEMS[id]).filter(e => !e.hazard && e.condition === 'minor_fault');
  let best = { gain: -1, set: new Set() };
  for (let mask = 0; mask < 1 << repairable.length; mask++) {
    const chosen = repairable.filter((_, n) => mask & 1 << n);
    const cost = chosen.reduce((sum, e) => sum + e.repairCost, 0);
    const gain = chosen.reduce((sum, e) => sum + 2 + e.lifeBonus, 0);
    if (cost <= level.tokens && gain > best.gain) best = { gain, set: new Set(chosen.map(e => e.id)) };
  }
  return best.set;
}
function playLevel(levelId, chooseRoute) {
  const shift = createShift(levelId);
  while (currentItem(shift)) {
    const entry = currentItem(shift);
    inspect(shift); clearData(shift);
    const result = applyChoice(shift, chooseRoute(entry, shift));
    assert.ok(result.ok, `${entry.id}: ${result.message}`);
  }
  return shift;
}

test('content: 8 levels of 4–8 items, at least 20 distinct scenarios, valid fields and drawings', () => {
  assert.equal(LEVELS.length, 8);
  const used = LEVELS.flatMap(level => level.items);
  assert.equal(new Set(used).size, used.length, 'no scenario repeats');
  assert.ok(used.length >= 20);
  for (const level of LEVELS) assert.ok(level.items.length >= 4 && level.items.length <= 8, `level ${level.id}`);
  for (const entry of Object.values(ITEMS)) {
    for (const key of ['id', 'name', 'illustration', 'condition', 'hazard', 'personalData', 'repairCost', 'lifeBonus', 'explanation']) assert.ok(key in entry, `${entry.id}.${key}`);
    assert.ok(['working', 'minor_fault', 'end_of_life'].includes(entry.condition));
    assert.ok(ART_NAMES.includes(entry.illustration), entry.illustration);
    if (entry.condition === 'minor_fault') { assert.ok([1, 2].includes(entry.repairCost)); assert.ok(entry.lifeBonus >= 1 && entry.lifeBonus <= 3); }
  }
  // Levels 1–2 teach the basics only; hazards and data appear from level 3.
  for (const id of LEVELS[0].items.concat(LEVELS[1].items)) assert.ok(!ITEMS[id].hazard && !ITEMS[id].personalData, id);
  assert.ok(LEVELS[2].items.some(id => ITEMS[id].hazard) && LEVELS[2].items.some(id => ITEMS[id].personalData));
});

test('token budgets: levels 1–4 fund every repair; levels 5–8 force a choice', () => {
  for (const level of LEVELS) {
    const needed = level.items.map(id => ITEMS[id]).filter(e => !e.hazard && e.condition === 'minor_fault').reduce((sum, e) => sum + e.repairCost, 0);
    if (level.id <= 4) assert.ok(level.tokens >= needed, `level ${level.id}`);
    else assert.ok(level.tokens < needed, `level ${level.id} must be tight`);
  }
});

test('hazard precedence: Safety Hold only, even with personal data, faults or a working state', () => {
  const hazards = Object.values(ITEMS).filter(e => e.hazard);
  assert.ok(hazards.some(e => e.personalData) && hazards.some(e => e.condition === 'minor_fault'));
  for (const entry of hazards) {
    for (const dest of ['reuse', 'repair', 'recycle']) {
      const result = evaluateChoice(entry, dest, { inspected: true, dataCleared: false, tokens: 9 });
      assert.equal(result.ok, false); assert.equal(result.reason, 'hazard'); assert.equal(result.message, HAZARD_MESSAGE);
    }
    const hold = evaluateChoice(entry, 'hold', { inspected: true, dataCleared: false, tokens: 0 });
    assert.equal(hold.ok, true); assert.equal(hold.points, POINTS.safetyHold);
  }
  const shift = createShift(3); inspect(shift);
  assert.equal(currentItem(shift).id, 'swollen-phone');
  assert.equal(clearData(shift), false, 'hazards skip the data step');
});

test('data clearance pauses routing until the in-game adult step, which needs inspection first', () => {
  const shift = createShift(3);
  inspect(shift); assert.equal(applyChoice(shift, 'hold').ok, true); // past the hazard
  assert.equal(currentItem(shift).id, 'family-laptop');
  assert.equal(applyChoice(shift, 'reuse').reason, 'inspect');
  assert.equal(clearData(shift), false, 'cannot clear data before inspecting');
  inspect(shift);
  const before = { index: shift.index, tokens: shift.tokens, score: shift.score };
  assert.equal(applyChoice(shift, 'reuse').reason, 'data');
  assert.deepEqual({ index: shift.index, tokens: shift.tokens, score: shift.score }, before);
  assert.equal(clearData(shift), true);
  assert.equal(applyChoice(shift, 'reuse').points, 4);
});

test('condition rules: points for allowed routes and invalid routes rejected', () => {
  const working = find(e => !e.hazard && !e.personalData && e.condition === 'working');
  const fault = find(e => !e.hazard && !e.personalData && e.condition === 'minor_fault');
  const finished = find(e => !e.hazard && !e.personalData && e.condition === 'end_of_life');
  assert.equal(evaluateChoice(working, 'reuse', ready).points, 4);
  assert.equal(evaluateChoice(working, 'recycle', ready).points, 1);
  assert.equal(evaluateChoice(working, 'repair', ready).ok, false);
  assert.equal(evaluateChoice(fault, 'repair', ready).points, 3 + fault.lifeBonus);
  assert.equal(evaluateChoice(fault, 'repair', ready).cost, fault.repairCost);
  assert.equal(evaluateChoice(fault, 'recycle', ready).points, 1);
  assert.equal(evaluateChoice(fault, 'reuse', ready).ok, false);
  assert.equal(evaluateChoice(finished, 'recycle', ready).points, 3);
  for (const dest of ['reuse', 'repair']) assert.equal(evaluateChoice(finished, dest, ready).ok, false);
  for (const entry of [working, fault, finished]) assert.equal(evaluateChoice(entry, 'hold', ready).reason, 'no-hazard');
  for (const entry of Object.values(ITEMS)) assert.equal(evaluateChoice(entry, 'bin', ready).ok, false, 'the bin is never valid');
});

test('invalid choices never consume the item, tokens or score; the bin retries in place', () => {
  const shift = createShift(1); inspect(shift);
  const snapshot = () => JSON.stringify({ i: shift.index, t: shift.tokens, s: shift.score, r: shift.results.length });
  const before = snapshot();
  for (const dest of ['bin', 'repair', 'hold', 'nonsense']) assert.equal(applyChoice(shift, dest).ok, false);
  assert.equal(snapshot(), before);
  assert.equal(shift.inspected, true, 'clues stay revealed after a wrong try');
  assert.equal(applyChoice(shift, 'reuse').ok, true);
});

test('repair tokens: spending, unaffordable repairs, recycle fallback and no negatives', () => {
  const shift = createShift(8); // 2 tokens
  const tablet = 'art-tablet';
  assert.equal(currentItem(shift).id, tablet);
  inspect(shift); clearData(shift);
  assert.equal(applyChoice(shift, 'repair').cost, 2);
  assert.equal(shift.tokens, 0);
  inspect(shift); // e-reader costs 1, but no tokens are left
  const denied = applyChoice(shift, 'repair');
  assert.equal(denied.reason, 'tokens');
  assert.equal(shift.tokens, 0);
  assert.equal(applyChoice(shift, 'recycle').points, 1);
  assert.ok(shift.tokens >= 0);
});

test('best score matches an independent brute force and is achievable for every level', () => {
  for (const level of LEVELS) {
    const plan = optimalRepairs(level);
    const shift = playLevel(level.id, entry => bestRoute(entry, plan));
    assert.equal(shift.score, bestScore(level.id), `level ${level.id}`);
    assert.equal(starsFor(shift.score, bestScore(level.id)), 3);
  }
  // Level 8: the flashy 2-token tablet repair is worse than two 1-token repairs.
  const greedy = playLevel(8, (entry, shift) => (entry.condition === 'minor_fault' && !entry.hazard && entry.repairCost <= shift.tokens ? 'repair' : bestRoute(entry, new Set())));
  assert.ok(greedy.score < bestScore(8));
});

test('star thresholds are 60%, 80% and 95% of the best score', () => {
  assert.equal(starsFor(59, 100), 0);
  assert.equal(starsFor(60, 100), 1);
  assert.equal(starsFor(79, 100), 1);
  assert.equal(starsFor(80, 100), 2);
  assert.equal(starsFor(94, 100), 2);
  assert.equal(starsFor(95, 100), 3);
  assert.equal(starsFor(100, 100), 3);
  assert.equal(starsFor(5, 0), 0);
});

test('saving keeps best stars, unlocks at one star and ignores malformed storage', () => {
  const storage = memoryStorage();
  const save = readSave(storage);
  assert.equal(isUnlocked(save, 1), true);
  assert.equal(isUnlocked(save, 2), false);
  recordStars(save, 1, 0); assert.equal(isUnlocked(save, 2), false);
  recordStars(save, 1, 2); recordStars(save, 1, 1);
  assert.equal(save.stars[1], 2, 'a weaker replay never lowers stars');
  assert.equal(isUnlocked(save, 2), true);
  writeSave(storage, save);
  assert.deepEqual(readSave(storage).stars, { 1: 2 });
  storage.setItem(SAVE_KEY, '{"stars":{"1":7,"2":"3","3":2}}');
  assert.deepEqual(readSave(storage).stars, { 3: 2 });
  storage.setItem(SAVE_KEY, 'not json');
  assert.deepEqual(readSave(storage).stars, {});
  assert.deepEqual(readSave({ getItem() { throw new Error('blocked'); } }).stars, {});
});

// ---- Screens ----
function setup(t, storage = memoryStorage()) {
  const dom = new JSDOM('<main></main><div id="announcement"></div>', { url: 'http://scrapworks.test/' });
  const host = dom.window.document.querySelector('main'), awards = [], learned = [];
  const cleanup = mountScrapworks(host, { storage, onAward: (...args) => awards.push(args), onLearn: item => learned.push(item) });
  t.after(() => { cleanup(); dom.window.close(); });
  const click = selector => { const node = host.querySelector(selector); assert.ok(node, selector); node.click(); };
  const key = k => dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true }));
  return { dom, host, storage, awards, learned, click, key, text: () => host.textContent };
}
/** Play the current level perfectly with taps. */
function tapThrough(ui, levelId) {
  const level = LEVELS[levelId - 1], plan = optimalRepairs(level);
  for (const id of level.items) {
    ui.click('[data-inspect]');
    if (ui.host.querySelector('[data-clear]')) ui.click('[data-clear]');
    ui.click(`[data-dest="${bestRoute(ITEMS[id], plan)}"]`);
    ui.click('[data-next]');
  }
}

test('map lists 8 shifts with only the first unlocked, plus a reset control', t => {
  const ui = setup(t);
  assert.match(ui.text(), /Scrapworks/);
  assert.equal(ui.host.querySelectorAll('[data-level]').length, 8);
  assert.equal(ui.host.querySelectorAll('[data-level]:disabled').length, 7);
  assert.ok(ui.host.querySelector('[data-reset]'));
  assert.match(ui.text(), /not real carbon/);
});

test('tutorial: inspect, the tempting bin, a retry and a scored reuse', t => {
  const ui = setup(t);
  ui.click('[data-level="1"]');
  assert.ok(ui.host.querySelector('[data-dest="bin"]'), 'bin appears once in the tutorial');
  assert.equal(ui.host.querySelectorAll('.sw-dest').length, 5);
  ui.click('[data-dest="reuse"]');
  assert.match(ui.text(), /Inspect the item first/);
  ui.click('[data-inspect]');
  assert.match(ui.text(), /Condition/);
  ui.click('[data-dest="bin"]');
  assert.match(ui.text(), /never go in a household bin/);
  assert.equal(ui.host.querySelector('[data-dest="bin"]'), null, 'shown only once');
  assert.match(ui.host.querySelector('.sw-hud').textContent, /Items left4/);
  ui.click('[data-dest="reuse"]');
  assert.match(ui.text(), /Reusing it keeps the whole device in use/);
  assert.match(ui.host.querySelector('.sw-score').textContent, /^4$/);
  assert.equal(ui.dom.window.document.activeElement, ui.host.querySelector('[data-next]'));
});

test('keyboard controls play an entire level without a pointer', t => {
  const ui = setup(t);
  ui.click('[data-level="1"]');
  const plan = optimalRepairs(LEVELS[0]);
  for (const id of LEVELS[0].items) {
    ui.key('i');
    ui.key(String(DESTINATIONS.indexOf(bestRoute(ITEMS[id], plan)) + 1));
    ui.key('n');
  }
  assert.match(ui.text(), /Perfect shift/);
});

test('a hazard blocks other routes with the stop message in the screen', t => {
  const storage = memoryStorage(); storage.setItem(SAVE_KEY, JSON.stringify({ stars: { 1: 3, 2: 3 } }));
  const ui = setup(t, storage);
  ui.click('[data-level="3"]');
  ui.click('[data-inspect]');
  assert.equal(ui.host.querySelector('[data-clear]'), null);
  ui.click('[data-dest="recycle"]');
  assert.match(ui.host.querySelector('.sw-feedback').textContent, /Stop—an adult or specialist must handle this/);
  ui.click('[data-dest="hold"]');
  assert.match(ui.text(), /\+3 points/);
});

test('finishing with stars saves, unlocks the next shift, restores the town and survives a remount', t => {
  const ui = setup(t);
  ui.click('[data-level="1"]');
  tapThrough(ui, 1);
  assert.match(ui.text(), /3 of 3 stars|Perfect shift/);
  assert.match(ui.text(), /restored the community garden/i);
  assert.equal(ui.host.querySelectorAll('.sw-town-part.is-restored').length, 1);
  assert.equal(ui.awards.length, 1); assert.equal(ui.learned.length, 1);
  assert.deepEqual(JSON.parse(ui.storage.getItem(SAVE_KEY)).stars, { 1: 3 });
  const again = setup(t, ui.storage); // simulates a page refresh
  assert.equal(again.host.querySelector('[data-level="2"]').disabled, false);
  assert.equal(again.host.querySelector('[data-level="3"]').disabled, true);
});

test('a low score earns 0 stars and offers Retry without unlocking', t => {
  const ui = setup(t);
  ui.click('[data-level="1"]');
  for (let n = 0; n < 4; n++) { ui.click('[data-inspect]'); ui.click('[data-dest="recycle"]'); ui.click('[data-next]'); }
  assert.match(ui.text(), /So close/);
  assert.equal(ui.host.querySelector('[data-level="2"]'), null, 'no next shift');
  ui.click('[data-retry]');
  assert.match(ui.host.querySelector('.sw-hud').textContent, /Score0/);
});

test('reset progress asks once, then clears saved stars', t => {
  const storage = memoryStorage(); storage.setItem(SAVE_KEY, JSON.stringify({ stars: { 1: 2 } }));
  const ui = setup(t, storage);
  ui.click('[data-reset]');
  ui.click('[data-reset-no]');
  assert.ok(storage.getItem(SAVE_KEY));
  ui.click('[data-reset]');
  ui.click('[data-reset-yes]');
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(ui.host.querySelectorAll('[data-level]:disabled').length, 7);
});
