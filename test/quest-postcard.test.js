/**
 * Check local SVG keepsakes as XML, including embedded artwork, safe text/filenames
 * and distinct fixed designs. Engine/storage scenarios verify that only finished
 * stories keep a design and that unrelated personal fields are discarded.
 * Browser download clicks and object-URL cleanup are covered in quest-ui.test.js.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { MISSIONS } from '../quest/content.js';
import { postcard, postcardFilename, validThemes, validStickers } from '../quest/postcard.js';
import { createState, transition, hydrateState } from '../quest/engine.js';
import { saveProgress, loadProgress, STORAGE_KEY } from '../quest/storage.js';

// Parse as SVG/XML, not forgiving HTML, and return an explicit window cleanup hook.
function parse(svg) {
  const dom = new JSDOM(svg, { contentType: 'image/svg+xml' });
  return { document: dom.window.document, close: () => dom.window.close() };
}

// Earn a keepsake through real mission actions before testing its saved design options.
function finish(mission) {
  let state = createState();
  // Advance this fixture's state after each action; production transitions stay pure.
  const act = (type, fields = {}) => { state = transition(state, { type, ...fields }); };
  act('CHOOSE_MISSION', { id: mission.id });
  act('START_MISSION');
  // Meet the same complete-evidence gate as a child before earning a keepsake.
  for (const clue of mission.clues) act('COLLECT_CLUE', { id: clue.id });
  act('OPEN_PLAN');
  for (const [slotId, actionId] of Object.entries(mission.acceptedPlans[0])) act('SET_PLAN', { slotId, actionId });
  act('CHECK_PLAN');
  act('COMPLETE_MISSION');
  return state;
}

test('each completed story exports a self-contained, printable illustrated SVG with authored text', () => {
  for (const mission of MISSIONS) {
    const output = postcard(mission);
    const { document, close } = parse(output);
    try {
      const root = document.documentElement;
      assert.equal(root.localName, 'svg');
      assert.equal(root.namespaceURI, 'http://www.w3.org/2000/svg');
      assert.equal(root.getAttribute('viewBox'), '0 0 900 640');
      assert.equal(root.getAttribute('width'), '900');
      assert.equal(root.getAttribute('height'), '640');
      assert.equal(root.getAttribute('role'), 'img');
      assert.ok(document.querySelector('svg svg'), 'Existing local scene artwork is embedded as vector artwork');
      assert.ok(document.querySelector('desc').textContent.includes(mission.postcardLine || mission.outcome.title));
      assert.ok(root.textContent.includes('An on-screen adventure. Real appliances need adult help.'));
      assert.ok(root.textContent.includes('not a real appliance assessment'));
      assert.equal(document.querySelector('script,image,foreignObject,iframe,link,style'), null);
      assert.equal(document.querySelector('[href],[src],[onload],[onclick]'), null);
      assert.equal(/url\s*\(|@import|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(output), false);
    } finally { close(); }
  }
});

test('fixed theme and sticker choices produce distinct drawings without changing the story', () => {
  assert.deepEqual(validThemes, ['sunshine', 'starlight', 'mint']);
  assert.deepEqual(validStickers, ['star', 'leaf', 'spark']);
  const outputs = new Set();
  const backgrounds = new Set();
  const stickerShapes = new Set();
  for (const theme of validThemes) {
    for (const sticker of validStickers) {
      const output = postcard(MISSIONS[0], { theme, sticker });
      const { document, close } = parse(output);
      try {
        assert.equal(document.documentElement.getAttribute('data-postcard-palette'), theme);
        assert.equal(document.querySelector('[data-postcard-mark]').getAttribute('data-postcard-mark'), sticker);
        assert.ok(document.querySelector('desc').textContent.includes(MISSIONS[0].postcardLine || MISSIONS[0].outcome.title));
        backgrounds.add(document.querySelector('rect').getAttribute('fill'));
        const shape = document.querySelector('[data-postcard-mark] g').querySelector('path').getAttribute('d');
        stickerShapes.add(shape);
        outputs.add(output);
      } finally { close(); }
    }
  }
  assert.equal(outputs.size, 9);
  assert.equal(backgrounds.size, 3);
  assert.equal(stickerShapes.size, 3);
});

test('before/after postcard scenes differ clearly while keeping the same creative choices', () => {
  const mission = MISSIONS[0];
  const before = parse(postcard(mission, { before: true, theme: 'mint', sticker: 'leaf' }));
  const after = parse(postcard(mission, { before: false, theme: 'mint', sticker: 'leaf' }));
  try {
    assert.match(before.document.querySelector('desc').textContent, /scene before the choice/);
    assert.match(after.document.querySelector('desc').textContent, /scene after the story choice/);
    assert.notEqual(before.document.querySelector('svg svg').outerHTML, after.document.querySelector('svg svg').outerHTML);
    assert.equal(before.document.documentElement.getAttribute('data-postcard-palette'), 'mint');
    assert.equal(after.document.documentElement.getAttribute('data-postcard-palette'), 'mint');
    assert.ok(before.document.documentElement.textContent.includes('WHERE OUR STORY BEGAN'));
    assert.ok(after.document.documentElement.textContent.includes('A NEXT CHAPTER, CHOSEN BY YOU'));
  } finally { before.close(); after.close(); }
});

test('postcard description joins a punctuated authored line without adding a second period', () => {
  for (const postcardLine of ['A new chapter.', 'A new chapter!', 'A new chapter']) {
    const { document, close } = parse(postcard({ ...MISSIONS[0], postcardLine }));
    try {
      const description = document.querySelector('desc').textContent;
      const ending = postcardLine.endsWith('!') ? '!' : '.';
      assert.ok(description.startsWith(`A new chapter${ending} The fictional scene after`));
    } finally { close(); }
  }
});

test('SVG text is XML escaped; unsupported options and extra personal fields cannot add markup or data', () => {
  // These are deliberate test strings, not user data. Markup must remain visible text,
  // while fields outside the postcard's authored inputs must never enter the picture.
  const mission = {
    ...MISSIONS[0],
    title: 'Pip < Flo & "friends"',
    postcardLine: 'A new <image href="https://untrusted.test/pixel"/> & chapter\u0001',
    name: 'PRIVATE CHILD NAME', email: 'PRIVATE EMAIL', disclosure: 'PRIVATE STORY'
  };
  const output = postcard(mission, { theme: '<script/>', sticker: 'PRIVATE CHILD NAME', childName: 'PRIVATE CHILD NAME', note: 'PRIVATE STORY' });
  const { document, close } = parse(output);
  try {
    assert.equal(document.querySelector('image,script'), null);
    assert.equal(document.querySelector('title').textContent, 'Pip < Flo & "friends" — story postcard');
    assert.ok(document.querySelector('desc').textContent.includes('<image href="https://untrusted.test/pixel"/>'));
    assert.equal(output.includes('PRIVATE'), false);
    assert.equal(output.includes('\u0001'), false);
    assert.equal(document.documentElement.getAttribute('data-postcard-palette'), 'sunshine');
    assert.equal(document.querySelector('[data-postcard-mark]').getAttribute('data-postcard-mark'), 'star');
  } finally { close(); }
});

test('download names use bounded file-safe story IDs and cannot select another path', () => {
  assert.equal(postcardFilename(MISSIONS[0]), `fixforward-quest-${MISSIONS[0].id}.svg`);
  for (const id of ['../../private', 'C:\\private\\child', 'story.svg.exe', '<script>', 'x'.repeat(100), undefined]) {
    assert.equal(postcardFilename({ id }), 'fixforward-quest-story.svg');
  }
});

test('postcard design is earned-only, preserves the other choice and repeated actions are no-ops', () => {
  const mission = MISSIONS[0];
  const edit = { type: 'DESIGN_POSTCARD', id: mission.id, theme: 'starlight' };
  const fresh = createState();
  assert.deepEqual(fresh.postcards, {});
  assert.equal(transition(fresh, edit), fresh, 'An unfinished story cannot unlock its postcard');
  let state = finish(mission);
  state = transition(state, edit);
  assert.deepEqual(state.postcards[mission.id], { theme: 'starlight', sticker: 'star' });
  assert.equal(transition(state, edit), state);
  state = transition(state, { type: 'DESIGN_POSTCARD', id: mission.id, sticker: 'leaf' });
  assert.deepEqual(state.postcards[mission.id], { theme: 'starlight', sticker: 'leaf' });
  assert.equal(transition(state, { type: 'DESIGN_POSTCARD', id: mission.id, theme: 'PRIVATE CHILD NAME' }), state);
  assert.equal(transition(state, { type: 'DESIGN_POSTCARD', id: 'unknown', sticker: 'star' }), state);
  assert.equal(Object.keys(state.completed).length, 1);
});

test('version-one storage restores earned postcard choices and strips arbitrary or locked designs', () => {
  const mission = MISSIONS[0];
  let state = finish(mission);
  state = transition(state, { type: 'DESIGN_POSTCARD', id: mission.id, theme: 'mint', sticker: 'spark' });
  const entries = new Map();
  // A Map lets this test inspect the exact serialized save without browser storage.
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  state.postcards[mission.id].childName = 'PRIVATE CHILD NAME';
  state.postcards[MISSIONS[1].id] = { theme: 'starlight', sticker: 'leaf' };
  state.postcards['PRIVATE CHILD NAME'] = { theme: 'mint', sticker: 'star' };
  assert.equal(saveProgress(state, storage), true);
  assert.equal(storage.getItem(STORAGE_KEY).includes('PRIVATE'), false);
  const restored = loadProgress(storage).state;
  assert.deepEqual(restored.postcards, { [mission.id]: { theme: 'mint', sticker: 'spark' } });
  const legacy = { ...restored };
  delete legacy.postcards;
  assert.deepEqual(hydrateState(legacy).postcards, {});
  assert.deepEqual(hydrateState(legacy).completed, restored.completed);
  const malformed = { ...restored, postcards: { [mission.id]: { theme: 'PRIVATE THEME', sticker: 'PRIVATE STICKER', notes: 'PRIVATE CHILD NAME' } } };
  assert.deepEqual(hydrateState(malformed).postcards, { [mission.id]: { theme: 'sunshine', sticker: 'star' } });
});
