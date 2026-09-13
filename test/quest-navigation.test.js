// Exercise native history semantics using a small browser fixture: Back/Forward
// move an existing cursor, rather than calling the application's navigation API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigation, NAVIGATION_KEY } from '../quest/navigation.js';

// Model the browser's history stack, including an outside page before Quest.
function browserFixture(url = '/quest', state = null) {
  const entries = [{ url: new URL('https://example.test/adult'), state: null }, { url: new URL(url, 'https://example.test'), state }];
  const listeners = new Set();
  let position = 1;
  let writes = 0;
  // Browser history clones state so later caller edits cannot mutate old entries.
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const host = {
    get location() { return entries[position].url; },
    history: {
      get state() { return clone(entries[position].state); },
      // A real push discards Forward entries only after a new navigation.
      pushState(value, unused, path) {
        writes += 1;
        entries.splice(position + 1);
        entries.push({ state: clone(value), url: new URL(path, entries[position].url) });
        position += 1;
      },
      // Initial setup and screen reconciliation replace only the current entry.
      replaceState(value, unused, path) {
        writes += 1;
        entries[position] = { state: clone(value), url: new URL(path, entries[position].url) };
      }
    },
    addEventListener(type, handler) { if (type === 'popstate') listeners.add(handler); },
    removeEventListener(type, handler) { if (type === 'popstate') listeners.delete(handler); }
  };
  // Toolbar, keyboard and mouse Back all produce this same browser popstate event.
  function move(delta) {
    position = Math.max(0, Math.min(entries.length - 1, position + delta));
    for (const handler of listeners) handler({ state: clone(entries[position].state) });
  }
  return { host, entries, move, get writes() { return writes; }, get position() { return position; }, get listenerCount() { return listeners.size; } };
}

test('real Back/Forward traverses Quest screens, then leaves Quest without a sentinel trap', () => {
  const browser = browserFixture();
  const restored = [];
  const navigation = createNavigation({ host: browser.host, initialRoute: { view: 'home' }, onRestore: route => restored.push(route) });
  assert.equal(browser.entries.length, 2, 'initial setup must replace rather than push');
  navigation.record({ view: 'picker', place: 'studio' });
  navigation.record({ view: 'mission', id: 'fan-mystery', step: 'intro' });
  browser.move(-1);
  assert.deepEqual(restored.at(-1), { view: 'picker', place: 'studio' });
  browser.move(1);
  assert.equal(restored.at(-1).step, 'intro');
  browser.move(-1);
  browser.move(-1);
  assert.equal(restored.at(-1).view, 'home');
  const count = restored.length;
  browser.move(-1);
  assert.equal(browser.host.location.pathname, '/adult');
  assert.equal(restored.length, count, 'outside-page navigation is not intercepted');
  assert.equal(browser.entries.length, 4);
});

test('parent deep link, leaving parents, reload and Forward keep the matching URL and screen', () => {
  const browser = browserFixture('/quest/?view=parents&review=yes#top', { unrelated: 'keep' });
  const navigation = createNavigation({ host: browser.host, initialRoute: { view: 'grownups' } });
  assert.equal(browser.host.history.state.unrelated, 'keep');
  navigation.record({ view: 'home' });
  assert.equal(browser.host.location.search, '?review=yes');
  assert.equal(browser.host.location.hash, '#top');
  browser.move(-1);
  assert.equal(navigation.getRoute().view, 'grownups');
  assert.equal(browser.host.location.searchParams.get('view'), 'parents');
  navigation.dispose();
  let duringSetup = 0;
  const reloaded = createNavigation({ host: browser.host, initialRoute: { view: 'home' }, onRestore: () => { duringSetup += 1; } });
  assert.equal(reloaded.getRoute().view, 'grownups');
  assert.equal(duringSetup, 0, 'app setup must finish before route restoration is rendered');
  browser.move(1);
  assert.equal(reloaded.getRoute().view, 'home');
  assert.equal(duringSetup, 1);
});

test('edits replace a route, identical renders do not add entries, and Forward survives restoration', () => {
  const browser = browserFixture();
  let navigation;
  navigation = createNavigation({ host: browser.host, initialRoute: { view: 'home' }, onRestore: route => navigation.record({ ...route, reconciled: true }) });
  navigation.record({ view: 'mission', id: 'fan', step: 'plan' });
  navigation.record({ step: 'plan', id: 'fan', view: 'mission' });
  assert.equal(browser.entries.length, 3);
  navigation.record({ view: 'mission', id: 'fan', step: 'plan', choice: 'ask' }, { replace: true });
  assert.equal(browser.entries.length, 3);
  navigation.record({ view: 'book' });
  browser.move(-1);
  assert.equal(navigation.getRoute().reconciled, true);
  assert.equal(browser.entries.length, 4);
  browser.move(1);
  assert.equal(navigation.getRoute().view, 'book');
});

test('the caller validates IDs and keeps progress outside detached screen snapshots', () => {
  const browser = browserFixture();
  const progress = { completed: { fan: { assisted: false } }, discoveries: ['assessment'] };
  const navigation = createNavigation({
    host: browser.host,
    initialRoute: { view: 'home' },
    normalizeRoute: route => ['home', 'book'].includes(route.view) ? { view: route.view } : null,
    onRestore: route => { route.view = 'mutated-by-ui'; }
  });
  assert.equal(navigation.record({ view: 'unknown', completed: {} }), false);
  navigation.record({ view: 'book', completed: {}, arbitraryText: 'discarded' });
  assert.deepEqual(browser.host.history.state[NAVIGATION_KEY].route, { view: 'book' });
  browser.move(-1);
  assert.deepEqual(navigation.getRoute(), { view: 'home' });
  assert.deepEqual(progress, { completed: { fan: { assisted: false } }, discoveries: ['assessment'] });
  const exposed = navigation.getRoute();
  exposed.view = 'mutated';
  assert.equal(navigation.getRoute().view, 'home');
});

test('malformed, cyclic, oversized and foreign routes cannot reach restoration', () => {
  const browser = browserFixture('/quest', { [NAVIGATION_KEY]: { version: 99, route: { view: 'bad' } } });
  let restores = 0;
  const navigation = createNavigation({ host: browser.host, initialRoute: { view: 'home' }, onRestore: () => { restores += 1; } });
  assert.equal(navigation.getRoute().view, 'home');
  const cyclic = { view: 'home' }; cyclic.self = cyclic;
  for (const invalid of [cyclic, { text: 'x'.repeat(16001) }, { view: () => 'home' }, { index: Infinity }, []]) assert.equal(navigation.record(invalid), false);
  browser.host.history.pushState({ anotherApp: true }, '', '/quest');
  browser.move(0);
  assert.equal(restores, 0);
  assert.equal(navigation.getRoute().view, 'home');
});

test('missing or blocked history falls back to usable in-memory navigation', () => {
  const fallback = createNavigation({ host: {}, initialRoute: { view: 'home' } });
  assert.equal(fallback.supported, false);
  assert.equal(fallback.record({ view: 'book' }), false);
  assert.equal(fallback.getRoute().view, 'book');
  const browser = browserFixture();
  browser.host.history.replaceState = () => { throw new Error('blocked history'); };
  const blocked = createNavigation({ host: browser.host });
  assert.equal(blocked.supported, false);
  blocked.record({ view: 'grownups' });
  assert.equal(blocked.getRoute().view, 'grownups');
  blocked.dispose();
  assert.equal(browser.listenerCount, 0);
});

test('unsafe URL overrides cannot navigate elsewhere and disposal removes only our listener', () => {
  const browser = browserFixture();
  const navigation = createNavigation({ host: browser.host, urlForRoute: () => 'https://elsewhere.test/' });
  assert.equal(navigation.record({ view: 'book' }), false);
  assert.equal(browser.host.location.pathname, '/quest');
  navigation.dispose();
  assert.equal(browser.listenerCount, 0);
  assert.equal(navigation.record({ view: 'home' }), false);
});

test('explicit replacement canonicalizes a pre-reset entry even when its normalized route is equal', () => {
  const browser = browserFixture();
  let epoch = 0;
  let navigation;
  const normalizeRoute = route => route.epoch === epoch ? route : { epoch, view: 'home' };
  navigation = createNavigation({ host: browser.host, initialRoute: { epoch, view: 'home' }, normalizeRoute, onRestore: route => navigation.record(route, { replace: true }) });
  navigation.record({ epoch, view: 'mission', id: 'old-story' });
  navigation.record({ epoch, view: 'book' });
  epoch = 1;
  navigation.record({ epoch, view: 'home' }, { replace: true });
  browser.move(-1);
  assert.deepEqual(browser.host.history.state[NAVIGATION_KEY].route, { epoch: 1, view: 'home' });
  assert.equal(browser.entries.length, 4, 'canonicalization must preserve Forward entries');
  navigation.dispose();
  const reloaded = createNavigation({ host: browser.host, initialRoute: { epoch, view: 'home' }, normalizeRoute });
  assert.deepEqual(reloaded.getRoute(), { epoch: 1, view: 'home' });
});
