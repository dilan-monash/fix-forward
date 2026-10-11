/** Older links keep their appliance context, but practical help now lives in
 * Decide. Its identity and safety steps still precede repair/drop-off options. */
export function normaliseRoute(hash) {
  const route = String(hash || '#home').replace(/^#\/?/, '') || 'home';
  const end = route.indexOf('?');
  const name = end < 0 ? route : route.slice(0, end);
  return ['action', 'act'].includes(name) ? 'decide' + (end < 0 ? '' : route.slice(end)) : route;
}
