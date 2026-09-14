/**
 * Pointer interaction shared by plan tiles and sorting cards. This module only
 * reports a real drop target; app.js decides which engine action that means.
 * The handle may be a large touch button, while ghostSource is only the product
 * illustration. Keeping these separate leaves the item's words in place.
 * A drag, cancellation or visual ghost is never progress on its own. Native tap
 * buttons remain the alternative for children who do not want to drag.
 */
/**
 * Return the first target ID under a client point, or null off-board.
 * Read current DOM rectangles so scrolling or layout changes do not use stale bounds.
 * Tests may supply rect directly; both forms use viewport, not page, coordinates.
 */
export function hitTest(clientX, clientY, targets) {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  for (const target of targets || []) {
    const rect = target.rect ?? target.element?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return target.id;
  }
  return null;
}

/**
 * Bind one handle and return a cleanup function for navigation/re-rendering.
 * targets() supplies current destinations; callbacks report lift, hover, drop
 * or cancellation. Only the handle disables touch scrolling, not the whole page.
 */
export function bindDrag(handle, { targets, onDrop, onCancel = () => {}, onLift = () => {}, onHover = () => {}, ghostSource = handle } = {}) {
  const document = handle.ownerDocument;
  const window = document.defaultView;
  const originalTouchAction = handle.style.touchAction;
  handle.style.touchAction = 'none';
  let current = null;
  let disposed = false;
  let suppressClick = false;

  // Release this pointer if still captured; browsers may release it first on cancel.
  function removeCapture(drag) {
    try {
      if (handle.hasPointerCapture?.(drag.pointerId)) handle.releasePointerCapture(drag.pointerId);
    } catch { /* A cancelled pointer may already have lost capture. */ }
  }

  // One exit path removes visuals/capture before callbacks can re-render the screen.
  // Only an on-target pointer release after movement is allowed to call onDrop.
  function finish(reason, event) {
    if (!current) return;
    const drag = current;
    // Clear first: releasing capture can synchronously send lostpointercapture again.
    current = null;
    const targetId = reason === 'drop' && drag.lifted ? hitTest(event.clientX, event.clientY, targets()) : null;
    drag.ghost?.remove();
    // Restore the original picture before the app renders feedback. Its layout and
    // instruction card never move, including when a finger misses every place.
    drag.source?.classList.remove('q-drag-source');
    handle.classList.remove('q-dragging');
    removeCapture(drag);
    onHover(null);
    if (drag.lifted) suppressClick = true;
    if (targetId !== null) onDrop(targetId);
    else if (drag.lifted) onCancel(reason === 'drop' ? 'off-target' : reason);
  }

  // Follow only the active pointer and lift a visual copy once a tap becomes a drag.
  function update(event) {
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    // Small finger movement should still count as the handle's ordinary tap action.
    if (!current.lifted && Math.hypot(dx, dy) < 6) return;
    if (!current.lifted) {
      current.lifted = true;
      const source = (typeof ghostSource === 'function' ? ghostSource() : ghostSource) || handle;
      const bounds = source.getBoundingClientRect();
      const ghost = source.cloneNode(true);
      // The copy must not duplicate DOM IDs, receive focus or be read as a second item.
      ghost.removeAttribute('id');
      ghost.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('inert', '');
      // Older tablet browsers may not implement inert. Explicitly remove every
      // copy from keyboard navigation too, even if a future artwork contains a link.
      for (const element of [ghost, ...ghost.querySelectorAll('*')]) {
        element.removeAttribute('autofocus');
        if (element.matches('a[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable], audio[controls], video[controls]')) element.setAttribute('tabindex', '-1');
        if (element.hasAttribute('contenteditable')) element.setAttribute('contenteditable', 'false');
      }
      ghost.setAttribute('focusable', 'false');
      ghost.classList.add('q-drag-ghost', 'q-drag-object-ghost');
      // A direct picture grab keeps the child's exact grip point. The separate
      // Move button can sit beside the picture, so lift that picture under the
      // finger instead of leaving it offset from the highlighted destination.
      const grabbedArtwork = current.startX >= bounds.left && current.startX <= bounds.left + bounds.width
        && current.startY >= bounds.top && current.startY <= bounds.top + bounds.height;
      const left = grabbedArtwork ? bounds.left : current.startX - bounds.width / 2;
      const top = grabbedArtwork ? bounds.top : current.startY - bounds.height / 2;
      Object.assign(ghost.style, { position: 'fixed', left: `${left}px`, top: `${top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, margin: '0', pointerEvents: 'none', zIndex: '9999', transition: 'none' });
      document.body.append(ghost);
      current.ghost = ghost;
      current.source = source;
      source.classList.add('q-drag-source');
      handle.classList.add('q-dragging');
      onLift();
    }
    event.preventDefault();
    current.ghost.style.transform = `translate(${dx}px, ${dy}px)`;
    onHover(hitTest(event.clientX, event.clientY, targets()));
  }

  // Start at most one primary pointer; a second finger cannot take over this drag.
  function down(event) {
    if (disposed || current || event.button !== 0 || event.isPrimary === false || handle.disabled) return;
    suppressClick = false;
    current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, lifted: false, ghost: null };
    try { handle.setPointerCapture?.(event.pointerId); } catch { /* Document listeners also support browsers without capture. */ }
  }
  // A different pointer releasing does not finish the child's active drag.
  function up(event) { if (current?.pointerId === event.pointerId) finish('drop', event); }
  // Window events cancel any drag; pointer events must match, including a valid ID of 0.
  function cancel(event) { if (event?.pointerId === undefined || current?.pointerId === event.pointerId) finish('cancel', event); }
  // A resized board requires a fresh drag instead of accepting uncertain geometry.
  function resize() { finish('resize'); }
  // Escape gives a keyboard-accessible way to abandon a lifted tile.
  function keydown(event) { if (event.key === 'Escape' && current) { event.preventDefault(); finish('cancel'); } }
  // Suppress the browser's follow-up pointer click, but retain keyboard clicks (detail 0).
  function click(event) {
    // A real drag must not also trigger the handle's tap alternative.
    if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); }
    suppressClick = false;
  }
  handle.addEventListener('pointerdown', down);
  handle.addEventListener('lostpointercapture', cancel);
  handle.addEventListener('click', click, true);
  // Document listeners finish a drag outside the handle; non-passive moves may stop
  // scrolling only once this handle's active pointer has crossed the drag threshold.
  document.addEventListener('pointermove', update, { passive: false });
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', cancel);
  document.addEventListener('keydown', keydown);
  window.addEventListener('resize', resize);
  window.addEventListener('blur', cancel);
  window.addEventListener('pagehide', cancel);
  // Calling cleanup twice is safe. Restore the original handle and remove every
  // listener, so leaving the screen cannot later submit a stale drop or keep a ghost.
  return () => {
    if (disposed) return;
    disposed = true;
    finish('navigation');
    handle.style.touchAction = originalTouchAction;
    handle.removeEventListener('pointerdown', down);
    handle.removeEventListener('lostpointercapture', cancel);
    handle.removeEventListener('click', click, true);
    document.removeEventListener('pointermove', update);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', cancel);
    document.removeEventListener('keydown', keydown);
    window.removeEventListener('resize', resize);
    window.removeEventListener('blur', cancel);
    window.removeEventListener('pagehide', cancel);
  };
}
