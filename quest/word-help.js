/**
 * Explain a hard word beside its sentence, without leaving the story or changing
 * progress. We edit text nodes with DOM methods, never interpolate a definition
 * into HTML. The original sentence text remains identical for recorded narration.
 */
const WORDS = Object.freeze({
  'qualified repairer': 'A person trained to check and repair these appliances.',
  'collection': 'Taking an item to a place that accepts it. Check which items the place takes.',
  'appliance': 'A machine used at home, like a fan, kettle or toaster.',
  'assessment': 'A trained person checks an item to find out what it needs.',
  'e-waste': 'Unwanted electrical things. They need a collection service that accepts them.',
  'recycle': 'Turn old materials into materials that can be used again.',
  'repair': 'Fix something so it can work again.',
  'reuse': 'Use something again instead of throwing it away.'
});
const terms = /\b(qualified repairer|collection|appliance|assessment|e-waste|recycle|repair|reuse)\b/gi;
// IDs connect each optional disclosure to its own meaning, including when more
// than one teaching paragraph appears on the same screen. This is not game state.
let nextNoteId = 0;

/** Add at most one link per distinct term in each teaching sentence. */
export function addWordHelp(root, { read = () => {} } = {}) {
  const document = root.ownerDocument;
  const sentences = root.querySelectorAll('[data-picture-help-text], .q-guide-dialogue p, .q-plan-result p, .q-full-clue p');
  sentences.forEach(sentence => {
    // A refreshed screen can run enhancement twice. Never enhance the definition
    // itself, even when its parent also matches a teaching-paragraph selector.
    if (sentence.closest('.q-inline-definition') || sentence.querySelector('[data-word]')) return;
    const seen = new Set();
    // Definitions are siblings, so Hear reads the exact authored sentence even
    // while help is open. Each sentence owns one reusable, initially hidden note.
    const note = document.createElement('aside');
    note.className = 'q-inline-definition'; note.hidden = true;
    do { note.id = `q-word-note-${++nextNoteId}`; } while (document.getElementById(note.id));
    note.setAttribute('role', 'note');
    note.setAttribute('aria-label', 'Word meaning');
    const meaning = document.createElement('p');
    const listen = document.createElement('button'); listen.type = 'button'; listen.textContent = 'Hear the meaning';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Back to the clue';
    let opener = null;
    note.append(meaning, listen, close);
    listen.onclick = () => read(meaning.textContent);
    close.onclick = () => { note.hidden = true; opener?.setAttribute('aria-expanded', 'false'); opener?.focus({ preventScroll: true }); };
    const walker = document.createTreeWalker(sentence, 4); // SHOW_TEXT, including text inside emphasis.
    const nodes = [];
    while (walker.nextNode()) if (!walker.currentNode.parentElement.closest('button,a')) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      let previous = 0;
      for (const match of node.textContent.matchAll(terms)) {
        const key = match[0].toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        fragment.append(document.createTextNode(node.textContent.slice(previous, match.index)));
        const control = document.createElement('button');
        control.type = 'button'; control.className = 'q-inline-word'; control.dataset.word = key;
        control.textContent = match[0]; control.setAttribute('aria-expanded', 'false');
        control.setAttribute('aria-controls', note.id);
        control.setAttribute('aria-label', `What does ${match[0]} mean?`);
        control.onclick = () => {
          const wasOpen = opener === control && !note.hidden;
          opener?.setAttribute('aria-expanded', 'false'); opener = control;
          meaning.textContent = `${match[0]}: ${WORDS[key]}`;
          note.hidden = wasOpen; control.setAttribute('aria-expanded', String(!wasOpen));
        };
        fragment.append(control); previous = match.index + match[0].length;
      }
      fragment.append(document.createTextNode(node.textContent.slice(previous)));
      node.replaceWith(fragment);
    }
    if (seen.size) sentence.after(note);
  });
}
