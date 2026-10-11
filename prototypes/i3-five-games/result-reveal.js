/** Bring a completed photo response into view without choosing an answer.
 * Wait one frame for the result and finished controls to settle. A cancelled
 * request or removed screen must never move focus on the replacement page. */
export function revealResult(target, { signal, isCurrent = () => true } = {}) {
  const doc = target?.ownerDocument, view = doc?.defaultView;
  if (!view || signal?.aborted || !isCurrent()) return () => {};
  let cancelled = false, frame;
  const cancel = () => {
    cancelled = true;
    if (frame !== undefined) view.cancelAnimationFrame?.(frame);
    signal?.removeEventListener('abort', cancel);
  };
  signal?.addEventListener('abort', cancel, { once: true });
  const reveal = () => {
    frame = undefined;
    signal?.removeEventListener('abort', cancel);
    if (cancelled || signal?.aborted || !isCurrent() || !target.isConnected || target.closest('[hidden]')) return;

    const header = doc.querySelector('.ff-header');
    const headerPosition = header && view.getComputedStyle(header).position;
    const headerBottom = header && ['fixed', 'sticky'].includes(headerPosition)
      ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    const scroller = doc.scrollingElement || doc.documentElement;
    const existingPadding = Number.parseFloat(view.getComputedStyle(scroller).scrollPaddingTop) || 0;
    target.style.scrollMarginTop = `${Math.max(0, Math.ceil(headerBottom + 20 - existingPadding))}px`;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });

    // Respect both the operating-system preference and the site's motion switch.
    // Explicit auto scrolling avoids animating a result for reduced-motion users.
    const reduced = view.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      || doc.body.classList.contains('ff-paused');
    const restore = [];
    if (reduced) {
      // Auto normally inherits a scroller's CSS behaviour. Temporarily neutralise
      // legacy smooth-scroll styles as well, including the document scroller.
      for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (view.getComputedStyle(ancestor).scrollBehavior !== 'smooth') continue;
        restore.push([ancestor, ancestor.style.getPropertyValue('scroll-behavior'), ancestor.style.getPropertyPriority('scroll-behavior')]);
        ancestor.style.setProperty('scroll-behavior', 'auto', 'important');
      }
    }
    try { target.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start', inline: 'nearest' }); }
    finally { restore.forEach(([element, value, priority]) => { if (value) element.style.setProperty('scroll-behavior', value, priority); else element.style.removeProperty('scroll-behavior'); }); }
  };
  if (view.requestAnimationFrame) frame = view.requestAnimationFrame(reveal);
  else queueMicrotask(reveal);
  return cancel;
}
