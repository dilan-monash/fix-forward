// This review shows observed choices from the two new games. It neither labels
// a child's ability nor reads, clears or changes the earlier workshop record.
import { GAMES, PLAYROOM_KEY, loadGames, summarizeGames } from './playroom-engine.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = value => new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const plural = (count, singular, multiple = `${singular}s`) => `${count} ${count === 1 ? singular : multiple}`;

export function mountPlayroomParent(host, options = {}) {
  const win = host.ownerDocument.defaultView, doc = host.ownerDocument;
  const controller = new win.AbortController();
  let storage, readable = true;
  try { storage = Object.hasOwn(options, 'storage') ? options.storage : win.localStorage; if (!storage) readable = false; else storage.getItem(PLAYROOM_KEY); } catch { storage = null; readable = false; }
  let sessions = loadGames(storage), gameFilter = 'all', evidenceFilter = 'all', notice = '';
  const navigate = value => typeof options.onNavigate === 'function' ? options.onNavigate(value) : (win.location.hash = value);
  const summary = () => summarizeGames(gameFilter === 'all' ? sessions : sessions.filter(session => session.gameId === gameFilter));

  function evidence(report) {
    if (evidenceFilter === 'hints') return report.exactHints.length ? `<ol class="prp-evidence">${report.exactHints.map(hint => `<li><span class="prp-tag">Hint requested</span><h3>${escape(hint.gameTitle)} · ${escape(hint.levelTitle)}</h3><p>${escape(hint.text)}</p><small>${escape(date(hint.sessionStartedAt))} · ${escape(hint.versionLabel)}</small></li>`).join('')}</ol>` : '<p class="prp-empty">No hints were requested in this view.</p>';
    const attempts = report.exactAttempts.filter(attempt => evidenceFilter !== 'retry' || !attempt.correct || attempt.hintUsed);
    if (!attempts.length) return `<p class="prp-empty">${evidenceFilter === 'retry' ? 'No different choices or hint-supported moves in this view. Ask your child to explain a favourite move.' : 'No moves recorded yet. Play together, then return to explore the choices.'}</p>`;
    const groups = new Map();
    for (const attempt of attempts) { const key = `${attempt.gameId}:${attempt.contentVersion}:${attempt.levelId}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(attempt); }
    return [...groups.values()].map(group => `<details class="prp-group"${evidenceFilter === 'retry' ? ' open' : ''}><summary><strong>${escape(group[0].gameTitle)} · ${escape(group[0].levelTitle)}</strong><span>${plural(group.length, 'move')} shown · ${escape(group[0].versionLabel)}</span></summary><ol class="prp-evidence">${group.map(attempt => `<li><div class="prp-evidence-heading"><h3>${escape(attempt.pieceLabel)}</h3><span class="prp-tag${attempt.correct ? '' : ' retry'}">${attempt.correct ? attempt.firstTry && !attempt.hintUsed ? 'First try, without a hint' : 'Matched after support or practice' : 'A different choice'}</span></div><p class="prp-context">${escape(attempt.instruction)}</p>${attempt.itemRevealedName !== attempt.pieceLabel ? `<p class="prp-context">Item in this story: <strong>${escape(attempt.itemRevealedName)}</strong></p>` : ''}<dl class="prp-choices"><div><dt>Choice made · try ${attempt.attemptNumber}</dt><dd>${escape(attempt.targetLabel)}</dd></div><div><dt>Match for this story</dt><dd>${escape(attempt.expectedTargetLabel)}</dd></div></dl><p><strong>Feedback shown to the child:</strong> ${escape(attempt.text)}</p>${attempt.parentExplanation && attempt.parentExplanation !== attempt.text ? `<p class="prp-parent-explanation"><strong>For the grown-up:</strong> ${escape(attempt.parentExplanation)}</p>` : ''}${attempt.hintUsed ? '<p class="prp-supported">A hint was requested before this move.</p>' : ''}<small>${escape(date(attempt.sessionStartedAt))} · ${attempt.points} Sparks · ${escape(attempt.versionLabel)}</small></li>`).join('')}</ol></details>`).join('');
  }

  function drawEvidence() {
    const report = summary();
    host.querySelector('[data-playroom-evidence]').innerHTML = evidence(report);
    host.querySelectorAll('[data-playroom-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.playroomFilter === evidenceFilter)));
    host.querySelector('[data-playroom-status]').textContent = evidenceFilter === 'hints' ? `${plural(report.hintCount, 'hint')} in this view.` : `${plural(report.attemptCount, 'move')} recorded; ${plural(report.wrongCount, 'different choice')}.`;
  }

  function draw() {
    const report = summary(), all = summarizeGames(sessions);
    host.innerHTML = `<section class="playroom-parent">
      <a class="prp-back" href="#learn" data-prp-route>← Learn together</a><a class="prp-back" href="#parents?view=clue-lab" data-prp-route>Clue Lab discoveries →</a>
      <header class="prp-hero"><p class="prp-eyebrow">For the grown-up beside them</p><h1>See the thinking<br>behind the play.</h1><p>Explore choices from Materials Rescue and Care Crew. Find one idea to talk through, then try it together.</p><p class="prp-privacy">Saved in this browser, without names or accounts. People sharing this browser can see these records. They do not sync to another device.</p></header>
      ${!readable ? '<p class="prp-alert" role="status">Browser storage is unavailable. Saved game records cannot be read here.</p>' : ''}
      <div class="prp-toolbar"><label>Games in this view<select data-playroom-game aria-label="Choose a game to review"><option value="all">Both games</option>${GAMES.map(game => `<option value="${game.id}"${gameFilter === game.id ? ' selected' : ''}>${escape(game.title)}</option>`).join('')}</select></label><div class="prp-tools"><button type="button" data-prp-action="export"${all.sessionCount ? '' : ' disabled'}>Save a copy</button><button type="button" data-prp-action="print">Print this view</button></div></div>
      <p class="prp-alert" data-playroom-notice role="status"${notice ? '' : ' hidden'}>${escape(notice)}</p>
      <div class="prp-stats"><div><strong>${report.totalPoints}</strong><span>Sparks earned</span></div><div><strong>${report.correctCount}</strong><span>${report.correctCount === 1 ? 'Useful match' : 'Useful matches'}</span></div><div><strong>${report.firstTryUnaidedCount}</strong><span>${report.firstTryUnaidedCount === 1 ? 'First try' : 'First tries'} without a hint</span></div><div><strong>${report.hintCount}</strong><span>${report.hintCount === 1 ? 'Hint' : 'Hints'} explored</span></div></div>
      <p class="prp-reading-note">${plural(report.retryCount, 'retry', 'retries')} across ${plural(report.sessionCount, 'playthrough')}. A different choice may mean experimenting or an accidental drop. These records are conversation starters, not a diagnosis or school grade.</p>
      <section class="prp-section"><h2>A useful conversation</h2>${report.topics.length ? `<div class="prp-topics">${report.topics.map(topic => `<article><p class="prp-eyebrow">${escape(topic.gameTitle)} · ${escape(topic.levelTitle)} · ${escape(topic.versionLabel)}</p><h3>${escape(topic.topic)}</h3><p>${plural(topic.wrongCount, 'different choice')} · ${plural(topic.hintCount, 'hint')} requested</p><blockquote>“${escape(topic.talkPrompt)}”</blockquote><p>${escape(topic.learning)}</p><a href="#play?game=${topic.gameId}" data-prp-route>Play this game together →</a></article>`).join('')}</div>` : `<div class="prp-empty"><h3>Your first discovery starts with play.</h3><p>Choose a game together. Moves, explanations and hints will appear here.</p><div class="prp-tools">${GAMES.map(game => `<a href="#play?game=${game.id}" data-prp-route>Play ${escape(game.title)} →</a>`).join('')}</div></div>`}</section>
      <section class="prp-section"><h2>What actually happened</h2><p>See the item, choice, expected match and the exact explanation shown.</p><fieldset class="prp-filters"><legend>Show learning moments</legend><button type="button" data-playroom-filter="all" aria-pressed="${evidenceFilter === 'all'}">All choices</button><button type="button" data-playroom-filter="retry" aria-pressed="${evidenceFilter === 'retry'}">Try together</button><button type="button" data-playroom-filter="hints" aria-pressed="${evidenceFilter === 'hints'}">Hints used</button></fieldset><p class="prp-context" data-playroom-status role="status" aria-live="polite"></p><div data-playroom-evidence></div></section>
      <section class="prp-section prp-records"><h2>Saved playthroughs</h2><p>Up to 20 playthroughs and 500 moves in total are kept for these two games. Older whole playthroughs are removed as needed.</p><ul>${all.sessions.map(session => `<li><strong>${escape(session.gameTitle)}</strong><span>${escape(date(session.startedAt))} · ${session.status === 'complete' ? 'Completed' : 'In progress'} · ${session.points} Sparks · ${escape(session.versionLabel)}</span></li>`).join('')}</ul><button type="button" data-prp-action="ask-clear"${all.sessionCount ? '' : ' disabled'}>Clear these two games’ records</button><div class="prp-confirm" data-playroom-confirm hidden role="group" aria-labelledby="prp-clear-title"><h3 id="prp-clear-title">Clear these saved game records?</h3><p>This removes Materials Rescue and Care Crew choices, hints and Sparks from this browser. The earlier workshop record is kept. Save a copy first if needed.</p><div class="prp-tools"><button type="button" data-prp-action="confirm-clear">Yes, clear these records</button><button type="button" data-prp-action="cancel-clear">Keep the records</button></div><p data-playroom-clear-error role="alert" hidden></p></div></section>
      <aside class="prp-footnote"><h2>Bring the idea home with an adult</h2><p>These games use pretend items and illustrated materials. Keep real electronics closed. Adults follow the maker’s care instructions and check suitable e-waste or battery collection services.</p><a href="#parents" data-prp-route>See Pip’s earlier workshop record →</a></aside>
    </section>`;
    drawEvidence();
  }

  host.addEventListener('change', event => {
    if (!event.target.matches('[data-playroom-game]')) return;
    gameFilter = GAMES.some(game => game.id === event.target.value) ? event.target.value : 'all'; draw();
    host.querySelector('[data-playroom-game]').focus({ preventScroll: true });
  }, { signal: controller.signal });
  host.addEventListener('click', event => {
    const route = event.target.closest('[data-prp-route]');
    if (route) { event.preventDefault(); navigate(route.getAttribute('href')); return; }
    const filter = event.target.closest('[data-playroom-filter]');
    if (filter) { evidenceFilter = filter.dataset.playroomFilter; drawEvidence(); return; }
    const button = event.target.closest('[data-prp-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.prpAction;
    if (action === 'ask-clear') { host.querySelector('[data-playroom-confirm]').hidden = false; host.querySelector('[data-prp-action="cancel-clear"]').focus({ preventScroll: true }); }
    if (action === 'cancel-clear') { host.querySelector('[data-playroom-confirm]').hidden = true; host.querySelector('[data-prp-action="ask-clear"]').focus({ preventScroll: true }); }
    if (action === 'confirm-clear' && !host.querySelector('[data-playroom-confirm]').hidden) {
      try { if (!storage?.removeItem) throw new Error('Storage unavailable'); storage.removeItem(PLAYROOM_KEY); sessions = []; notice = 'The two games’ records have been cleared.'; draw(); }
      catch { const error = host.querySelector('[data-playroom-clear-error]'); error.hidden = false; error.textContent = 'The browser could not clear these records. They have been kept.'; }
    }
    if (action === 'export') {
      try {
        const payload = { title: 'FixForward new games learning review', exportedAt: new Date().toISOString(), ...summary() };
        if (typeof options.onExport === 'function') options.onExport(payload);
        else { const url = win.URL.createObjectURL(new win.Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const link = doc.createElement('a'); link.href = url; link.download = 'fixforward-game-learning.json'; link.click(); win.setTimeout(() => win.URL.revokeObjectURL(url), 1000); }
      } catch { notice = 'A copy could not be saved in this browser. Try printing this view instead.'; draw(); }
    }
    if (action === 'print') {
      const groups = [...host.querySelectorAll('.prp-group')], states = groups.map(group => group.open);
      groups.forEach(group => { group.open = true; });
      try { win.print(); } finally { groups.forEach((group, index) => { group.open = states[index]; }); }
    }
  }, { signal: controller.signal });
  draw();
  return () => controller.abort();
}
