/**
 * Lightweight touch decoration for Quest. The caller has already handled the
 * real action: this controller cannot move game pieces, judge an answer, award
 * Sparks, speak, focus a control or save progress. No library or asset is fetched.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_PIECES = 10;
const MAX_RUNS = 3;
const WARNING = '.q-warning-object, .q-visual-clue--warning, [data-warning], [role="alert"]';
const SHAPES = Object.freeze({
  star: ['M20 2 25 14 38 15 28 24 31 38 20 31 9 38 12 24 2 15 15 14Z'],
  lens: ['M28 27 37 36', 'M29 17a12 12 0 1 1-24 0 12 12 0 0 1 24 0'],
  correct: ['M37 20a17 17 0 1 1-34 0 17 17 0 0 1 34 0', 'm11 20 6 6 12-13'],
  retry: ['M37 20a17 17 0 1 1-34 0 17 17 0 0 1 34 0', 'm14 14 12 12m0-12L14 26']
});

// Work in viewport coordinates, just like pointer clientX/clientY and drag hits.
// A captured rectangle may outlive its source during a render; bad geometry is
// ignored rather than placing an unexplained flash in the corner of the screen.
function pointOf(value) {
  let rect;
  try { rect = value?.getBoundingClientRect ? value.getBoundingClientRect() : value; }
  catch { return null; }
  const left = rect?.left ?? rect?.x;
  const top = rect?.top ?? rect?.y;
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  const width = Number.isFinite(rect.width) ? Math.max(0, rect.width) : 0;
  const height = Number.isFinite(rect.height) ? Math.max(0, rect.height) : 0;
  return { x: left + width / 2, y: top + height / 2 };
}

// Only an actual drawing is squished, never a card's words or the whole button.
// A warning picture and every paragraph remain still even if a caller passes one.
function safeArt(element) {
  if (!element?.isConnected || element.closest?.(`p, ${WARNING}`)) return null;
  const art = element.localName === 'svg' ? element : element.querySelector?.('svg');
  return art && !art.closest?.(WARNING) && !art.querySelector?.(WARNING) ? art : null;
}
function isStillContent(element) {
  return Boolean(element?.closest?.(`p, ${WARNING}`) || element?.querySelector?.(WARNING));
}

// A supplied item may be a real SVG from the current screen, never markup text.
// Copy only passive vector shapes and attributes: no IDs, scripts, event handlers,
// remote references, embedded HTML, media or inherited animation classes survive.
function copyArt(source) {
  if (source?.namespaceURI !== SVG_NS || source.localName !== 'svg' || isStillContent(source)) return null;
  if (source.querySelectorAll('*').length > 120) return null;
  const clone = source.cloneNode(true);
  const tags = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
  const attributes = new Set(['viewBox', 'd', 'points', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'transform']);
  for (const node of [clone, ...clone.querySelectorAll('*')]) {
    if (!tags.has(node.localName)) { node.remove(); continue; }
    for (const attribute of [...node.attributes]) {
      if (!attributes.has(attribute.name) || /url\s*\(|(?:https?|javascript|data):/i.test(attribute.value)) node.removeAttribute(attribute.name);
    }
  }
  return clone;
}

/** Each method starts a finite effect; timers and DOM are injectable for tests.
 * press uses client coordinates; clue uses the supplied clue picture/marker;
 * drop accepts elements or captured rectangles and an optional existing SVG.
 */
export function createTouchFx({
  document = globalThis.document,
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: unschedule = globalThis.clearTimeout
} = {}) {
  const runs = new Set();
  let disposed = false;

  // Cancel first, then detach. A late native finish/timer callback cannot touch
  // a newer run or leave a pressed transform on a reused control.
  function clear(run) {
    if (!run || run.closed) return;
    run.closed = true;
    runs.delete(run);
    if (run.timer !== null) unschedule(run.timer);
    for (const animation of run.animations) {
      animation.onfinish = null;
      try { animation.cancel(); } catch { /* An already-finished effect is harmless. */ }
    }
    run.animations.clear();
    run.layer.remove();
  }
  function cancel() { for (const run of [...runs]) clear(run); }

  // The bound applies across rapid taps, not just one effect. Old decorations
  // make room for a new gesture, so ten pieces and thirteen animations are the
  // maximum at any moment. None can survive its sub-900ms cleanup deadline.
  function begin(kind, pieces) {
    if (disposed || !document?.body || typeof document.body.animate !== 'function') return null;
    let total = [...runs].reduce((sum, run) => sum + run.pieces, 0);
    while (runs.size >= MAX_RUNS || total + pieces > MAX_PIECES) {
      const oldest = runs.values().next().value;
      if (!oldest) break;
      total -= oldest.pieces;
      clear(oldest);
    }
    const layer = document.createElement('div');
    layer.className = 'q-touch-fx'; layer.dataset.effect = kind;
    layer.setAttribute('aria-hidden', 'true');
    // Keep the input boundary safe even before this component's stylesheet loads.
    Object.assign(layer.style, { position: 'fixed', inset: '0', overflow: 'hidden', pointerEvents: 'none', zIndex: '990' });
    document.body.append(layer);
    const run = { layer, pieces, animations: new Set(), timer: null, closed: false };
    runs.add(run);
    return run;
  }
  function animate(run, element, frames, options) {
    try {
      const animation = element.animate(frames, { fill: 'both', ...options });
      run.animations.add(animation);
      animation.finished?.catch?.(() => {});
      return animation;
    } catch { return null; /* Rejected particles keep their base opacity of zero. */ }
  }
  function finish(run, lifetime) {
    if (!run.animations.size) { clear(run); return false; }
    run.timer = schedule(() => clear(run), lifetime);
    return true;
  }
  function visible(point) {
    const width = document.defaultView?.innerWidth || 1024;
    const height = document.defaultView?.innerHeight || 768;
    return { x: Math.max(6, Math.min(width - 6, point.x)), y: Math.max(6, Math.min(height - 6, point.y)) };
  }

  // Every temporary piece starts invisible. WAAPI paints it only after accepting
  // the effect; a missing or failing animation can never leave a static badge.
  function piece(run, kind, point, size = 40, existing = null) {
    const node = existing || (kind === 'ring' ? document.createElement('span') : document.createElementNS(SVG_NS, 'svg'));
    node.setAttribute('class', `q-touch-fx__piece q-touch-fx__${kind}`);
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('focusable', 'false');
    if (node.namespaceURI === SVG_NS) {
      if (!existing) node.setAttribute('viewBox', '0 0 40 40');
      node.setAttribute('width', String(size)); node.setAttribute('height', String(size));
      if (!existing) for (const data of SHAPES[kind] || []) {
        const path = document.createElementNS(SVG_NS, 'path'); path.setAttribute('d', data); node.append(path);
      }
    }
    Object.assign(node.style, { position: 'absolute', left: `${point.x - size / 2}px`, top: `${point.y - size / 2}px`, width: `${size}px`, height: `${size}px`, opacity: '0', pointerEvents: 'none' });
    run.layer.append(node);
    return node;
  }
  function squish(run, art, kind = 'press') {
    if (!art) return;
    const transforms = kind === 'retry'
      ? ['translateX(0) rotate(0deg)', 'translateX(-6px) rotate(-4deg)', 'translateX(5px) rotate(3deg)', 'translateX(0) rotate(0deg)']
      : ['scale(1)', 'scale(1.09,.87)', 'scale(.96,1.05)', 'scale(1)'];
    animate(run, art, transforms.map(transform => ({ transform })), { duration: kind === 'retry' ? 320 : 240, easing: 'ease-out', fill: 'none' });
  }
  function stars(run, point, count, radius, duration) {
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2 - Math.PI / 2;
      const star = piece(run, 'star', point, 12 + (index % 2) * 5);
      animate(run, star, [
        { transform: 'translate(0,0) scale(.2) rotate(0deg)', opacity: 0 },
        { transform: `translate(${Math.cos(angle) * radius * .6}px,${Math.sin(angle) * radius * .6}px) scale(1.15) rotate(20deg)`, opacity: 1, offset: .36 },
        { transform: `translate(${Math.cos(angle) * radius}px,${Math.sin(angle) * radius}px) scale(.45) rotate(55deg)`, opacity: 0 }
      ], { duration, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  }

  /** A small ripple begins where the finger/mouse actually pressed. Keyboard
   * activation omits coordinates and uses the control centre, without focus work. */
  function press({ element, x, y, pointerType = '' } = {}) {
    if (!element?.isConnected || isStillContent(element)) return false;
    const raw = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : pointOf(element);
    if (!raw) return false;
    const run = begin('press', 3);
    if (!run) return false;
    const point = visible(raw);
    run.layer.dataset.pointer = ['touch', 'pen', 'mouse'].includes(pointerType) ? pointerType : 'keyboard';
    const ring = piece(run, 'ring', point, pointerType === 'touch' ? 52 : 42);
    animate(run, ring, [{ transform: 'scale(.35)', opacity: .85 }, { transform: 'scale(1.65)', opacity: 0 }], { duration: 360, easing: 'ease-out' });
    stars(run, point, 2, 36, 360);
    squish(run, safeArt(element));
    return finish(run, 420);
  }

  /** A lens-ring and four small stars acknowledge finding a clue. The sentence,
   * warning evidence and game progress stay exactly as the controller rendered. */
  function clue({ element } = {}) {
    if (!element?.isConnected || isStillContent(element)) return false;
    const raw = pointOf(element);
    if (!raw) return false;
    const run = begin('clue', 5);
    if (!run) return false;
    const point = visible(raw);
    const lens = piece(run, 'lens', point, 72);
    animate(run, lens, [
      { transform: 'scale(.6) rotate(-18deg)', opacity: 0 },
      { transform: 'scale(1.08) rotate(4deg)', opacity: 1, offset: .25 },
      { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: .58 },
      { transform: 'scale(1.25) rotate(6deg)', opacity: 0 }
    ], { duration: 660, easing: 'ease-out' });
    stars(run, point, 4, 58, 640);
    squish(run, safeArt(element));
    return finish(run, 720);
  }

  /** Show the supplied result at a destination. An optional small item copy can
   * arrive or spring back; the actual product, target text and answer never move. */
  function drop({ origin = null, target = null, correct = false, artwork = null } = {}) {
    if (target?.nodeType && (isStillContent(target) || !target.isConnected)) return false;
    const raw = pointOf(target);
    if (!raw) return false;
    const clone = copyArt(artwork);
    const run = begin(correct ? 'drop-correct' : 'drop-retry', (correct ? 4 : 1) + (clone ? 1 : 0));
    if (!run) return false;
    const point = visible(raw);
    const start = visible(pointOf(origin) || { x: point.x, y: point.y - 48 });
    const stamp = piece(run, correct ? 'correct' : 'retry', point, 62);
    animate(run, stamp, [
      { transform: 'scale(1.65) rotate(-12deg)', opacity: 0 },
      { transform: 'scale(.9) rotate(3deg)', opacity: 1, offset: .2 },
      { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: .58 },
      { transform: 'scale(1.05) translateY(-6px)', opacity: 0 }
    ], { duration: 760, easing: 'ease-out' });
    if (clone) {
      const item = piece(run, 'item', start, 62, clone);
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      animate(run, item, correct ? [
        { transform: 'translate(0,0) scale(.85)', opacity: .8 },
        { transform: `translate(${dx}px,${dy - 18}px) scale(1.08)`, opacity: 1, offset: .55 },
        { transform: `translate(${dx}px,${dy}px) scale(.65)`, opacity: 0 }
      ] : [
        { transform: `translate(${dx}px,${dy}px) scale(.9)`, opacity: .85 },
        { transform: `translate(${dx * .55}px,${dy * .55 - 24}px) scale(1) rotate(-5deg)`, opacity: .9, offset: .45 },
        { transform: 'translate(0,0) scale(.8)', opacity: 0 }
      ], { duration: correct ? 450 : 560, easing: 'cubic-bezier(.2,.75,.3,1)' });
    }
    if (correct) stars(run, point, 3, 54, 650);
    else squish(run, safeArt(target), 'retry');
    return finish(run, 820);
  }

  function dispose() { cancel(); disposed = true; }
  return { press, clue, drop, cancel, dispose };
}
