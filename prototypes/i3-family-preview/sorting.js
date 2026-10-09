/**
 * Sorting Station: a short evidence-to-action game for a child and their family.
 * This preview uses fictional stories, never a judgement about a real appliance.
 * The parent application owns routing, saved learning and Sparks; this module
 * owns only the game screen and its pointer/keyboard interactions.
 */

const PATHS = [
  { id: 'share', title: 'Keep or share', short: 'Working and wanted', cue: 'Give it more use', colour: '#f4c45d' },
  { id: 'repair', title: 'Ask a repairer', short: 'A check may help', cue: 'Find out what is possible', colour: '#e99a7a' },
  { id: 'recycle', title: 'E-waste collection', short: 'Go with an adult', cue: 'Keep electronics out of the bin', colour: '#f2bb7d' },
];

// The answer comes from these supplied facts, not the way an object looks.
// Keeping this content separate from rendering makes the teaching rule reviewable.
const PRACTICE = {
  id: 'practice', title: 'A fan with a new friend', appliance: 'Fan', art: 'fan', answer: 'share',
  fact: 'This fan works. Your cousin needs one.',
  correct: 'Yes! A working fan can help someone else.',
  wrong: 'The fan works, and someone wants it. Try “Keep or share”.',
};

export const SORTING_SCENARIOS = Object.freeze([
  { id: 'fan-share', title: 'Still full of breeze', appliance: 'Fan', art: 'fan', answer: 'share',
    fact: 'This fan works. A neighbour would like it.',
    correct: 'It still works and has a new home. Using it for longer avoids waste.',
    wrong: 'Look at the clue: it works, and someone wants it. It can keep being useful.' },
  { id: 'kettle-repair', title: 'A second chance', appliance: 'Kettle', art: 'kettle', answer: 'repair',
    fact: 'A repairer checked this kettle. They can replace its broken switch.',
    correct: 'One broken part does not mean the whole kettle must be thrown away.',
    wrong: 'The repairer says the switch can be replaced. Which place can help?' },
  { id: 'toaster-recycle', title: 'An ending with a purpose', appliance: 'Toaster', art: 'toaster', answer: 'recycle',
    fact: 'A repairer checked this toaster. It cannot be repaired safely.',
    correct: 'An adult can take it to a place that accepts e-waste. Some materials can be recovered.',
    wrong: 'This story says it cannot be repaired safely. It needs an e-waste collection place, with an adult.' },
  { id: 'blender-check', title: 'We need one more clue', appliance: 'Blender', art: 'blender', answer: 'repair',
    fact: 'This blender stopped working. Nobody knows why yet.',
    correct: 'We do not know enough to throw it away. Ask an adult to arrange a check.',
    wrong: 'Stopped working does not tell us why. An adult can ask a repairer to check it.' },
]);

/** A small pure rule: only a matching evidence-based path completes the item. */
export function evaluateSortingChoice(scenario, path) {
  return { correct: scenario.answer === path, explanation: scenario.answer === path ? scenario.correct : scenario.wrong };
}

/** Original, small SVG illustrations keep the game fast without image downloads. */
function applianceArt(type) {
  const shapes = {
    fan: `<path d="M104 168h32l7 30H97z" fill="#91c9e2"/><path d="M116 126h9v45h-9z" fill="#daeaf4"/><circle cx="120" cy="89" r="58" fill="#d9f0fb"/><circle cx="120" cy="89" r="48" fill="#fff9e9"/><g fill="#88c6df"><path d="M120 88c-26-42-48-18-39 0 6 12 23 13 39 0z"/><path d="M120 88c48-1 38-33 18-33-14 1-20 16-18 33z"/><path d="M120 88c-21 42 12 49 21 31 5-12-4-25-21-31z"/></g><circle cx="120" cy="89" r="12" fill="#f4c45d"/><path d="M106 195h28"/><circle cx="120" cy="182" r="3" fill="#061f57"/>`,
    kettle: `<path d="M169 81c47-12 43 64 6 62" fill="none" stroke-width="15"/><path d="M79 84 45 64l18 49 18 5" fill="#d7eaf8"/><path d="M82 65h81l18 98q0 25-24 25H84q-23 0-23-23z" fill="#91c9e2"/><path d="M81 66q37-34 82 0" fill="#fff9ed"/><path d="M101 42h41" stroke-width="11"/><rect x="105" y="87" width="31" height="70" rx="14" fill="#eaf7ff"/><path d="M114 108h13m-13 16h13m-13 16h13" stroke-width="2"/><rect x="173" y="150" width="13" height="22" rx="5" fill="#e99a7a"/><path d="M72 195h100" stroke-width="10"/>`,
    toaster: `<rect x="51" y="70" width="140" height="111" rx="29" fill="#9bcbe4"/><path d="M65 84q6-14 24-14h73q19 0 23 14" fill="#fff9ed"/><path d="M86 84h68" stroke-width="8"/><rect x="190" y="91" width="13" height="35" rx="4" fill="#e99a7a"/><circle cx="166" cy="152" r="11" fill="#f4c45d"/><path d="M68 181v15m105-15v15" stroke-width="9"/><path d="M71 103v45" stroke="#fff" stroke-width="6"/><path d="M201 165q16 0 15 27h12" fill="none" stroke-width="4"/><path d="M225 187v10m7-10v10" stroke-width="3"/>`,
    blender: `<path d="M157 52h15q27 0 26 28-2 24-27 24h-8" fill="none" stroke-width="10"/><path d="M72 42h99l-11 95H88z" fill="#d9f0fb"/><path d="M86 97h80l-6 40H88z" fill="#b5dbdc"/><rect x="69" y="35" width="105" height="15" rx="6" fill="#f4c45d"/><path d="M90 142h68l18 51H73z" fill="#91c9e2"/><rect x="92" y="132" width="65" height="14" rx="5" fill="#fff9ed"/><circle cx="125" cy="168" r="10" fill="#e99a7a"/><path d="M102 62h13m-12 16h12" stroke-width="3"/><path d="M83 196h81" stroke-width="7"/>`,
  };
  return `<svg viewBox="0 0 240 220" fill="none" stroke="#123967" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><ellipse cx="123" cy="205" rx="78" ry="8" fill="#123967" opacity=".08" stroke="none"/>${shapes[type] || shapes.kettle}</svg>`;
}

/** Each destination has both a picture and words: colour alone is never the key. */
function bayArt(id) {
  const drawing = {
    share: `<path d="M18 41 45 22l27 19v35H18z" fill="#ffe6a5"/><path d="M38 77V56h17v21" fill="#fff9eb"/><path d="M68 46q16-19 26-4 11 14-15 29-18-10-11-25z" fill="#e99a7a"/><path d="m17 42 28-21 29 21" fill="none"/>`,
    repair: `<path d="M20 43h68v37H20z" fill="#f5ba99"/><path d="M39 43V31h30v12M20 57h68" fill="none"/><path d="M48 52h14v14H48z" fill="#fff9eb"/><path d="m78 24-8 8-8-8 8-8q-20-3-16 18L38 51l9 8 18-18q20 4 13-17z" fill="#fff0c7"/>`,
    recycle: `<path d="M24 37h59l-5 47H30z" fill="#ffe0a7"/><path d="M20 37h67M35 27h38v10" fill="none"/><path d="m47 46-10 17h10m-10 0 1-8m26-8 10 17h-9m9 0-1-8M63 73H45l5-8m-5 8 7 3" fill="none" stroke-width="3.2"/><path d="M39 83v5m30-5v5"/>`,
  };
  return `<svg viewBox="0 0 108 100" fill="none" stroke="#15345f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawing[id]}</svg>`;
}

/**
 * Mount one game in the supplied host. A render replaces just this module's DOM.
 * Event listeners are attached to the stable host through one AbortController,
 * so navigating away can remove them without leaving hidden drag handlers alive.
 */
export function mountSorting(host, { onNavigate = () => {}, onLearn = () => {}, onAward = () => {}, playSound = () => {} } = {}) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const state = { phase: 'practice', index: 0, solved: false, selected: false, touched: false, feedback: '', tone: '', reward: '', transferWrong: false };
  let drag = null;
  let ghost = null;
  let suppressClick = false;

  const current = () => state.phase === 'practice' ? PRACTICE : SORTING_SCENARIOS[state.index];

  // All screen changes retain a focus target. This matters for keyboard users
  // and avoids leaving focus on a Next button that no longer exists.
  function focusWithin(selector) {
    host.querySelector(selector)?.focus({ preventScroll: true });
  }

  function render() {
    if (state.phase === 'done') return renderFinish();
    if (state.phase === 'transfer') return renderTransfer();
    const item = current();
    const practice = state.phase === 'practice';
    host.innerHTML = `<section class="sorting-page" aria-labelledby="sorting-title">
      <header class="sorting-heading"><div><p class="eyebrow">SORTING STATION</p><h1 id="sorting-title">Give things a next chapter.</h1></div><span class="sorting-count">${practice ? 'One together first' : `${state.index + 1} of ${SORTING_SCENARIOS.length}`}</span></header>
      <div class="sorting-instruction"><span class="sorting-step-dot">${practice ? '1' : '✦'}</span><p>${practice ? '<strong>Try one with us.</strong> Move the fan to “Keep or share”.' : '<strong>Read the clue.</strong> Where should this one go?'}</p><span class="sorting-help">Drag the picture · or tap, then tap a place</span></div>
      <div class="sorting-playfield${state.touched ? '' : ' sorting-first-touch'}${state.solved ? ' is-solved' : ''}">
        <div class="sorting-item-zone"><div class="sorting-orbit" aria-hidden="true"></div><button class="sorting-item${state.selected ? ' is-picked' : ''}" data-sort-item type="button" aria-pressed="${state.selected}" aria-label="${item.appliance}. Drag to a place, or select and then choose a place." ${state.solved ? 'disabled' : ''}>${applianceArt(item.art)}<span class="sorting-pick-cue" aria-hidden="true">${state.solved ? '✓' : state.selected ? 'Now choose a place ↓' : 'Move me ↗'}</span></button></div>
        <div class="sorting-story"><p class="sorting-story-kicker">${practice ? 'PRACTICE · NO POINTS' : 'THE STORY CLUE'}</p><h2>${item.title}</h2><p class="sorting-fact">${item.fact}</p><div class="sorting-evidence"><span aria-hidden="true">⌕</span> Use the clue, not just the picture.</div></div>
      </div>
      <div class="sorting-bays" role="group" aria-label="Choose the next place for the ${item.appliance.toLowerCase()}">${PATHS.map(path => `<button type="button" data-sort-path="${path.id}" class="sorting-bay${state.solved && item.answer === path.id ? ' is-correct' : ''}" ${state.solved ? 'disabled' : ''}><span class="sorting-bay-picture">${bayArt(path.id)}</span><span class="sorting-bay-copy"><strong>${path.title}</strong><span>${path.short}</span></span>${state.solved && item.answer === path.id ? '<span class="sorting-bay-check" aria-hidden="true">✓</span>' : ''}</button>`).join('')}</div>
      <div class="sorting-feedback ${state.tone ? `is-${state.tone}` : ''}" role="status" aria-live="polite" aria-atomic="true"><span class="sorting-feedback-icon" aria-hidden="true">${state.tone === 'correct' ? '✓' : state.tone === 'retry' ? '↶' : '✧'}</span><div><strong>${state.tone === 'correct' ? `${state.reward || 'Good thinking!'}` : state.tone === 'retry' ? 'Have another go.' : 'Your clue is the key.'}</strong><p>${state.feedback || 'Every item has a story. Choose what fits this one.'}</p></div>${state.solved ? `<button class="button primary sorting-next" type="button" data-sort-next>${practice ? 'Let’s play' : state.index === SORTING_SCENARIOS.length - 1 ? 'One last puzzle' : 'Next item'} <span aria-hidden="true">→</span></button>` : ''}</div>
      <p class="sorting-safety">Pretend appliances, real thinking. For real items, ask an adult. Never open or test an appliance yourself.</p>
    </section>`;
  }

  /**
   * A drop, tap destination or keyboard activation all call this same function.
   * Incorrect answers do not advance, deduct points, or require a Try Again
   * button: the child can immediately pick up the unchanged item again.
   */
  function choose(path) {
    if (state.solved || !['practice', 'play'].includes(state.phase)) return;
    const item = current();
    const result = evaluateSortingChoice(item, path);
    state.touched = true;
    state.selected = false;
    state.feedback = result.explanation;
    state.tone = result.correct ? 'correct' : 'retry';
    state.solved = result.correct;
    if (result.correct) {
      playSound('success');
      if (state.phase === 'play') {
        // Persist the reason learned, not merely a count of successful drops.
        onLearn({ id: `sorting:${item.id}`, title: item.title, detail: item.correct, appliance: item.appliance, pathway: item.answer });
        const awarded = onAward(`sorting:${item.id}`, 10, host.querySelector('.sorting-item'));
        state.reward = awarded === false ? 'You remembered the clue!' : 'Good thinking! +10 sparks';
      }
    } else {
      playSound('retry');
    }
    render();
    // A wrong answer returns focus to the item; successful play points toward
    // the explicit next step. Both targets remain next to the visible feedback.
    focusWithin(result.correct ? '[data-sort-next]' : '[data-sort-item]');
  }

  function next() {
    if (!state.solved) return;
    if (state.phase === 'practice') state.phase = 'play';
    else if (state.index < SORTING_SCENARIOS.length - 1) state.index += 1;
    else state.phase = 'transfer';
    Object.assign(state, { solved: false, selected: false, feedback: '', tone: '', reward: '' });
    render();
    focusWithin(state.phase === 'transfer' ? '[data-sort-transfer]' : '[data-sort-item]');
  }

  function renderTransfer() {
    host.innerHTML = `<section class="sorting-page sorting-transfer" aria-labelledby="sorting-title"><header class="sorting-heading"><div><p class="eyebrow">ONE LAST PUZZLE</p><h1 id="sorting-title">A new item. Same good thinking.</h1></div><span class="sorting-count">Show what you learned</span></header><div class="sorting-transfer-art" aria-hidden="true"><svg viewBox="0 0 230 170" fill="none" stroke="#123967" stroke-width="4" stroke-linejoin="round"><ellipse cx="111" cy="153" rx="80" ry="9" fill="#e2edf4" stroke="none"/><path d="M108 76v69m-34 0h74"/><path d="M72 25h76l23 65H50z" fill="#f4c45d"/><path d="M133 90v23"/><circle cx="133" cy="118" r="4" fill="#e99a7a"/><circle cx="185" cy="39" r="22" fill="#eaf5fc" stroke="none"/><text x="178" y="48" fill="#123967" stroke="none" font-family="sans-serif" font-size="27">?</text></svg></div><h2>A lamp will not turn on.</h2><p class="sorting-transfer-fact">We do not know why. What should we do first?</p><div class="sorting-transfer-choices"><button type="button" class="sorting-transfer-choice" data-sort-transfer="ask"><span aria-hidden="true">⌕</span><strong>Ask an adult to arrange a check</strong></button><button type="button" class="sorting-transfer-choice" data-sort-transfer="throw"><span aria-hidden="true">↗</span><strong>Throw it away straight away</strong></button></div><div class="sorting-feedback ${state.transferWrong ? 'is-retry' : ''}" role="status" aria-live="polite"><span class="sorting-feedback-icon" aria-hidden="true">${state.transferWrong ? '↶' : '✧'}</span><div><strong>${state.transferWrong ? 'We need one more clue.' : 'No new words to remember.'}</strong><p>${state.transferWrong ? 'Not working does not mean it cannot be repaired. Choose again.' : 'Think about what we know — and what we still need to find out.'}</p></div></div><p class="sorting-safety">This is a pretend puzzle. Leave real appliance checks to an adult and a qualified repairer.</p></section>`;
  }

  function renderFinish() {
    host.innerHTML = `<section class="sorting-page sorting-finish" aria-labelledby="sorting-title"><div class="sorting-finish-medal" aria-hidden="true">✦</div><p class="eyebrow">YOU FOUND THE REASON</p><h1 id="sorting-title">More than a good sorter.<br>A good thinker.</h1><p class="sorting-finish-intro">You looked at the clues before choosing.<br>Now try that thinking together at home.</p><div class="sorting-learning-cards"><div>${bayArt('share')}<strong>Working + wanted?</strong><p>Give it more use.</p></div><div>${bayArt('repair')}<strong>Broken or not sure?</strong><p>Ask about a check.</p></div><div>${bayArt('recycle')}<strong>Cannot be repaired safely?</strong><p>Find e-waste collection.</p></div></div><div class="sorting-family-step"><span class="sorting-family-icon" aria-hidden="true">↗</span><div><p class="eyebrow">TAKE THE NEXT STEP TOGETHER</p><h2>“Can we ask before we throw it away?”</h2><p>An adult can look for a repairer. You can explain why a check comes first.</p></div><button type="button" class="button primary" data-sort-navigate="services?kind=repair&appliance=Kettle">Find help with an adult <span aria-hidden="true">→</span></button></div><div class="sorting-finish-actions"><button type="button" class="button secondary" data-sort-navigate="lens">Explore an appliance</button><button type="button" class="sorting-text-button" data-sort-replay>Play the stories again</button></div></section>`;
  }

  /** Route all ordinary button presses through one event listener. */
  host.addEventListener('click', event => {
    if (suppressClick) return;
    const button = event.target.closest('button');
    if (!button || !host.contains(button)) return;
    if (button.hasAttribute('data-sort-item')) {
      state.selected = !state.selected;
      state.touched = true;
      playSound('tap');
      render();
      focusWithin('[data-sort-item]');
    } else if (button.dataset.sortPath) choose(button.dataset.sortPath);
    else if (button.hasAttribute('data-sort-next')) next();
    else if (button.dataset.sortNavigate) onNavigate(button.dataset.sortNavigate);
    else if (button.dataset.sortTransfer) {
      if (button.dataset.sortTransfer === 'ask') {
        onLearn({ id: 'sorting:transfer', title: 'A check before a choice', detail: 'Not working does not tell us whether an item can be repaired. Ask an adult to arrange a check.', appliance: 'Lamp', pathway: 'repair' });
        onAward('sorting:transfer', 10, button);
        playSound('success');
        state.phase = 'done';
        render();
        focusWithin('[data-sort-navigate]');
      } else {
        state.transferWrong = true;
        playSound('retry');
        render();
        focusWithin('[data-sort-transfer="ask"]');
      }
    } else if (button.hasAttribute('data-sort-replay')) {
      Object.assign(state, { phase: 'play', index: 0, solved: false, selected: false, feedback: '', tone: '', reward: '', transferWrong: false });
      render();
      focusWithin('[data-sort-item]');
    }
  }, options);

  /**
   * Pointer Events work with a mouse, pen, and a tablet finger. Only the SVG is
   * copied into a floating drag image; the story card and its text stay still.
   * We do not use HTML drag-and-drop, which is inconsistent on touch screens.
   */
  host.addEventListener('pointerdown', event => {
    const item = event.target.closest('[data-sort-item]');
    if (!item || item.disabled || event.button !== 0 || !event.isPrimary) return;
    state.touched = true;
    host.querySelector('.sorting-first-touch')?.classList.remove('sorting-first-touch');
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, item, moving: false };
    item.setPointerCapture(event.pointerId);
  }, options);

  host.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moving && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8) return;
    if (!drag.moving) {
      drag.moving = true;
      ghost = document.createElement('div');
      ghost.className = 'sorting-drag-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.innerHTML = drag.item.querySelector('svg').outerHTML;
      document.body.append(ghost);
      drag.item.classList.add('is-dragging');
      playSound('tap');
    }
    event.preventDefault();
    ghost.style.left = `${event.clientX}px`;
    ghost.style.top = `${event.clientY}px`;
    const bay = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-sort-path]');
    host.querySelectorAll('[data-sort-path]').forEach(node => node.classList.toggle('is-over', node === bay));
  }, { ...options, passive: false });

  function stopDrag(event, cancelled = false) {
    if (!drag || event.pointerId !== drag.id) return;
    const wasMoving = drag.moving;
    const bay = wasMoving && !cancelled ? document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-sort-path]') : null;
    drag.item.classList.remove('is-dragging');
    if (drag.item.hasPointerCapture(event.pointerId)) drag.item.releasePointerCapture(event.pointerId);
    drag = null;
    ghost?.remove();
    ghost = null;
    host.querySelectorAll('.is-over').forEach(node => node.classList.remove('is-over'));
    if (wasMoving) {
      // A browser may send a click after pointerup. Ignore that synthetic click
      // so a successful drop cannot accidentally activate the next screen.
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      if (bay && host.contains(bay)) choose(bay.dataset.sortPath);
    }
  }

  host.addEventListener('pointerup', event => stopDrag(event), options);
  host.addEventListener('pointercancel', event => stopDrag(event, true), options);
  render();

  // The parent calls this on navigation. No audio or animation continues after
  // the screen is gone, and the next mount starts with a clean pointer state.
  return () => { controller.abort(); ghost?.remove(); drag = null; };
}
