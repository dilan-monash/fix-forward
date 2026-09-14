// Browser-history adapter for Quest. app.js supplies small screen snapshots and
// restores their presentation against current progress; this module never runs
// game actions, writes a save, or replaces earned discoveries with an old state.

// A separate key leaves any unrelated browser-history metadata intact.
export const NAVIGATION_KEY = 'fixforward.quest.navigation.v1';

// Accept the three Flask entry paths, without intercepting Back to another page.
function isQuestURL(url) {
  return ['/quest', '/quest/', '/quest/index.html'].includes(url.pathname);
}

// Copy only bounded JSON-shaped routes. DOM nodes, functions, cycles and overly
// large snapshots cannot become history entries or reach the restoration callback.
function copyRoute(value) {
  const seen = new Set();
  // Check nested values before JSON serialization so unsupported fields are not silently lost.
  function valid(item, depth = 0) {
    if (depth > 10) return false;
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return true;
    if (typeof item === 'number') return Number.isFinite(item);
    if (typeof item !== 'object' || seen.has(item)) return false;
    const prototype = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null) return false;
    seen.add(item);
    const values = Object.values(item);
    const result = values.length <= 128 && values.every(child => valid(child, depth + 1));
    seen.delete(item);
    return result;
  }
  try {
    if (!value || Array.isArray(value) || typeof value !== 'object' || !valid(value)) return null;
    const text = JSON.stringify(value);
    return text.length <= 16000 ? JSON.parse(text) : null;
  } catch { return null; }
}

// Compare JSON-shaped routes without depending on object-property insertion order.
function routeKey(value) {
  if (Array.isArray(value)) return `[${value.map(routeKey).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${routeKey(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

// Keep the explicit parent URL accurate while retaining other query values and hashes.
function defaultURL(route, currentURL) {
  const url = new URL(currentURL);
  if (route.view === 'grownups') url.searchParams.set('view', 'parents');
  else if (url.searchParams.get('view') === 'parents') url.searchParams.delete('view');
  return url;
}

/**
 * Connect an injectable browser host to presentation-only Quest history.
 * initialRoute is used for a fresh entry; a valid existing entry wins on reload.
 * normalizeRoute must validate authored IDs and exclude persistent reward data.
 * onRestore receives a copy on Back/Forward and must render using current progress.
 * Construction does not call onRestore: reconcile getRoute() after app setup.
 */
export function createNavigation({ host = globalThis.window, initialRoute = { view: 'home' }, onRestore = () => {}, normalizeRoute = route => route, urlForRoute = defaultURL } = {}) {
  let disposed = false;
  let restoring = false;
  let available = Boolean(host?.history?.pushState && host?.history?.replaceState && host?.addEventListener);

  // Give the app validator a detached value, then validate its result again.
  function normalize(value) {
    const copy = copyRoute(value);
    if (!copy) return null;
    try { return copyRoute(normalizeRoute(copy)); } catch { return null; }
  }

  // Read only this adapter's versioned entry; unrelated or obsolete entries are ignored.
  function storedRoute(value) {
    const entry = value?.[NAVIGATION_KEY];
    return entry?.version === 1 ? normalize(entry.route) : null;
  }

  let current = normalize(initialRoute) || { view: 'home' };
  try {
    if (isQuestURL(new URL(host.location.href))) current = storedRoute(host.history.state) || current;
  } catch { available = false; }

  // Update an existing entry or add one native entry. History failures leave the
  // already-rendered game usable and do not fall back to page loads or URL polling.
  function write(route, replace) {
    if (!available || disposed) return false;
    try {
      const currentURL = new URL(host.location.href);
      if (!isQuestURL(currentURL)) return false;
      const nextURL = new URL(urlForRoute(copyRoute(route), currentURL.href), currentURL);
      if (nextURL.origin !== currentURL.origin || !isQuestURL(nextURL)) return false;
      const previous = host.history.state;
      const entry = previous && typeof previous === 'object' && !Array.isArray(previous) ? { ...previous } : {};
      entry[NAVIGATION_KEY] = { version: 1, route: copyRoute(route) };
      host.history[replace ? 'replaceState' : 'pushState'](entry, '', `${nextURL.pathname}${nextURL.search}${nextURL.hash}`);
      return true;
    } catch { available = false; return false; }
  }

  // Record real navigation after rendering. Form choices can replace the current
  // snapshot; repeated renders must not add Back-button stops or erase Forward.
  function record(route, { replace = false } = {}) {
    if (disposed) return false;
    const next = normalize(route);
    if (!next) return false;
    // An explicit replacement also repairs the underlying entry after a validator
    // normalizes old history (for example, a route from before an adventure reset).
    if (routeKey(next) === routeKey(current)) return replace ? write(current, true) : false;
    current = next;
    return write(current, replace || restoring);
  }

  // Browser controls already moved the history cursor. Restore presentation only;
  // any corrective record inside the callback replaces this entry, never pushes.
  function onPopState(event) {
    if (disposed) return;
    try { if (!isQuestURL(new URL(host.location.href))) return; } catch { return; }
    const next = storedRoute(event.state);
    if (!next) return;
    current = next;
    restoring = true;
    try { onRestore(copyRoute(current), { source: 'popstate' }); }
    finally { restoring = false; }
  }

  // Return a detached route so UI mutation cannot rewrite the browser's snapshot.
  function getRoute() { return copyRoute(current); }

  // Release only our listener. Native Back/Forward and previously written entries remain usable.
  function dispose() {
    disposed = true;
    host?.removeEventListener?.('popstate', onPopState);
  }

  if (available) {
    host.addEventListener('popstate', onPopState);
    write(current, true);
  }
  return { record, getRoute, dispose, get supported() { return available; } };
}
