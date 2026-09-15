/** Home-trail regressions: pictures must preserve real story actions and saved
 * stamps. These DOM tests do not fetch assets, change a save, or simulate layout;
 * phone/tablet spacing is also reviewed in the integrated browser by app.js. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { MISSIONS } from '../quest/content.js';
import { renderAdventureTrail } from '../quest/adventure-world.js';

// Parse a component independently, with no network or browser side effects.
const render = options => JSDOM.fragment(renderAdventureTrail({ missions: MISSIONS, ...options }));

test('all nine illustrated chapters stay available in authored order without locks', () => {
  const dom = render({ suggestedId: MISSIONS[0].id });
  const buttons = [...dom.querySelectorAll('button')];
  assert.equal(buttons.length, MISSIONS.length);
  assert.deepEqual(buttons.map(button => button.dataset.mission), MISSIONS.map(item => item.id));
  assert.equal(dom.querySelectorAll('.q-island-story-art>svg').length, MISSIONS.length);
  assert.equal(dom.querySelector('[disabled], [aria-disabled="true"], input, a'), null);
  assert.equal(dom.querySelectorAll('.is-suggested').length, 1);
  assert.equal(dom.querySelector('.is-suggested [data-mission]').dataset.mission, MISSIONS[0].id);
  assert.match(dom.querySelector('.q-adventure-progress').textContent, /0 \/ 9/);
  assert.equal(dom.querySelector('meter').value, 0);
  assert.equal(dom.querySelector('meter').max, MISSIONS.length);
});

test('earned chapters replay their story and count guided and independent completions equally', () => {
  const completed = { [MISSIONS[0].id]: { assisted: true }, [MISSIONS[3].id]: { assisted: false } };
  const before = structuredClone(completed);
  const dom = render({ completed, suggestedId: MISSIONS[0].id });
  assert.deepEqual([...dom.querySelectorAll('.is-earned [data-mission]')].map(button => button.dataset.mission), [MISSIONS[0].id, MISSIONS[3].id]);
  assert.equal(dom.querySelectorAll('[data-mission]').length, MISSIONS.length);
  assert.equal(dom.querySelector('[data-postcard]'), null, 'The story trail never changes into an unrelated editor.');
  assert.equal(dom.querySelectorAll('.is-earned').length, 2);
  assert.equal(dom.querySelector('.is-suggested'), null);
  assert.equal(dom.querySelector('meter').value, 2);
  assert.match(dom.querySelector('.is-earned [data-mission]').textContent, /Replay story/);
  assert.match(dom.querySelector('.is-earned [data-mission]').getAttribute('aria-label'), /Replay/);
  assert.deepEqual(completed, before, 'rendering never changes progress');
});

test('all collected stamps celebrate completion and still replay every story', () => {
  const completed = Object.fromEntries(MISSIONS.map(item => [item.id, { assisted: false }]));
  const dom = render({ completed });
  assert.equal(dom.querySelectorAll('[data-postcard]').length, 0);
  assert.equal(dom.querySelectorAll('[data-mission]').length, MISSIONS.length);
  assert.equal(dom.querySelector('meter').value, MISSIONS.length);
  assert.match(dom.querySelector('h2').textContent, /Look how far/);
  assert.equal(dom.querySelectorAll('.q-island-earned-star').length, MISSIONS.length);
});

test('unknown, inherited or malformed completion data cannot invent stamps', () => {
  const inherited = { [MISSIONS[0].id]: { assisted: false } };
  const completed = Object.assign(Object.create(inherited), {
    [MISSIONS[1].id]: true, [MISSIONS[2].id]: {}, [MISSIONS[3].id]: { assisted: 'yes' },
    'unknown-story': { assisted: false }, [MISSIONS[4].id]: { assisted: false }
  });
  const dom = render({ completed });
  assert.equal(dom.querySelector('meter').value, 1);
  assert.deepEqual([...dom.querySelectorAll('.is-earned [data-mission]')].map(button => button.dataset.mission), [MISSIONS[4].id]);
  for (const bad of [null, false, 'completed']) assert.equal(render({ completed: bad }).querySelector('meter').value, 0);
});

test('duplicate and unknown input missions cannot inflate the trail or insert markup', () => {
  const title = '<img src=x onerror="alert(1)"> & "Clue"';
  const missions = [{ ...MISSIONS[0], title }, MISSIONS[0], null, { id: '__proto__' }, { id: '<script>bad</script>' }, MISSIONS[1]];
  const before = structuredClone(missions);
  const dom = render({ missions });
  assert.equal(dom.querySelectorAll('button').length, 2);
  assert.equal(dom.querySelector('img, script, [onerror], [onclick]'), null);
  assert.equal(dom.querySelector('button').getAttribute('aria-label'), `Explore ${title}`);
  assert.equal(dom.querySelector('meter').max, 2);
  assert.deepEqual(missions, before);
  assert.equal(renderAdventureTrail(), '');
  assert.equal(renderAdventureTrail({ missions: 'bad' }), '');
});

test('decorations stay inaccessible and warning art keeps its static marker', () => {
  const dom = render();
  for (const svg of dom.querySelectorAll('svg')) {
    assert.equal(svg.getAttribute('aria-hidden'), 'true');
    assert.equal(svg.getAttribute('focusable'), 'false');
  }
  assert.equal(dom.querySelectorAll('.q-adventure-route').length, 2);
  assert.equal(dom.querySelectorAll('.q-adventure-cloud').length, 2);
  assert.equal(dom.querySelector('[data-mission="pip-damaged-cable"]').querySelectorAll('.q-warning-object').length, 1);
  assert.equal(dom.querySelector('[data-mission="bulging-gadget"]').querySelectorAll('.q-warning-object').length, 1);
  assert.equal(dom.querySelectorAll('.q-guide-character').length, 0, 'story objects are never substituted with animated working guides');
  assert.equal(dom.querySelector('[id], image, iframe, audio, video, canvas'), null);
});
