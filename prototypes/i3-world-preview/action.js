// Action centre: adult owners get practical tools without entering a children's game.
// This file renders only its host. It never changes the existing app, deployment or database.
// Click -> route -> mountAction -> form event -> pure matching -> visible evidence is the flow.
import { FAMILIES, CATEGORY_CODE_BY_NAME } from '../../src/data.js';
import { loadPublicData, getStaticSnapshot } from '../../src/data-service.js';
import { matchRecall, findSuburbSuggestions, resolveAreaInput, getNearbyLocations } from '../../src/logic.js';
import { productSuggestions } from '../../src/product-suggestions.js';
import { SUBURB_POSTCODES } from '../../src/suburb-index.js';
import { PRICE_SNAPSHOT } from '../../src/price-snapshot.js';
import { mountPhotoHelper } from '../../src/photo-helper.js';

const RECALL_SOURCE = 'https://www.productsafety.gov.au/recalls';
const RECYCLE_SOURCE = 'https://www.environment.vic.gov.au/household-waste-recycling/ewaste';
const REPAIR_SOURCE = 'https://www.repaircafe.org/en/visit/';
const CATEGORIES = FAMILIES.flatMap((family) => family.categories);
// The world includes items outside our existing reference dataset. Preserve them by
// name and disclose coverage, instead of changing a laptop into a kettle silently.
const WORLD_ITEMS = {
  kettle: 'Kettle', fan: 'Fan', toaster: 'Toaster', blender: 'Blender', microwave: 'Microwave',
  vacuum: 'Vacuum cleaner', hairdryer: 'Hair dryer', laptop: 'Laptop',
  ricecooker: 'Rice cooker', airfryer: 'Air fryer', coffeemachine: 'Coffee machine', mixer: 'Mixer',
};
const PLAN_KEY = 'fixforward-world-adult-plan-v1';
// The adult's unfinished identity/location form lives only in this tab's memory.
// The separate optional planner saves only its task, item name and date.
const draft = { category: 'Kettle', brand: '', model: '', area: '' };

// Plans contain a task, item and date only. They never claim a repair was completed,
// calculate carbon savings, store a postcode or persist the brand/model fields.
export function readActionPlan(storage) {
  try {
    const value = JSON.parse(storage?.getItem(PLAN_KEY) || 'null');
    if (!value || typeof value.appliance !== 'string' || typeof value.task !== 'string') return null;
    if (!['manual', 'recall', 'repair', 'recycle', 'reuse'].includes(value.task)) return null;
    return { appliance: value.appliance.slice(0, 60), task: value.task, date: /^\d{4}-\d{2}-\d{2}$/.test(value.date || '') ? value.date : '' };
  } catch { return null; }
}

// Local saving is optional. A blocked/full browser store leaves the planning form usable.
export function saveActionPlan(storage, plan) {
  try {
    if (!storage || typeof plan?.appliance !== 'string' || !['manual', 'recall', 'repair', 'recycle', 'reuse'].includes(plan.task)) return false;
    storage.setItem(PLAN_KEY, JSON.stringify({ appliance: plan.appliance.slice(0, 60), task: plan.task, date: /^\d{4}-\d{2}-\d{2}$/.test(plan.date || '') ? plan.date : '' }));
    return true;
  } catch { return false; }
}

// Escape both entered text and dataset text before inserting HTML. URL checks are separate.
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeUrl = (value, officialOnly = false) => {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if (officialOnly && !['productsafety.gov.au', 'www.productsafety.gov.au'].includes(url.hostname)) return '';
    return url.href;
  } catch { return ''; }
};
const link = (url, label, className = 'button secondary') => {
  const checked = safeUrl(url);
  return checked ? `<a class="${className}" href="${escape(checked)}" target="_blank" rel="noopener noreferrer">${escape(label)} <span aria-hidden="true">↗</span></a>` : '';
};

// A fresh mount owns listeners and network cancellation. Disposing during navigation prevents
// a slow API reply or AI suggestion from changing the newly opened page.
export function mountAction(host, { route = 'action?kind=recall', onNavigate = () => {}, onLearn = () => {}, onAward = () => {}, playSound = () => {} } = {}) {
  const [, query = ''] = String(route).replace(/^#?\/?/, '').split('?');
  const params = new URLSearchParams(query);
  const supplied = (params.get('appliance') || '').trim().slice(0, 60);
  const requested = (Object.hasOwn(WORLD_ITEMS, supplied.toLowerCase()) ? WORLD_ITEMS[supplied.toLowerCase()] : '') || CATEGORIES.find((name) => name.toLowerCase() === supplied.toLowerCase()) || supplied;
  if (requested && requested !== draft.category) { draft.category = requested; draft.brand = ''; draft.model = ''; }
  const kind = ['recall', 'repair', 'recycle', 'reuse'].includes(params.get('kind')) ? params.get('kind') : 'recall';
  const services = ['repair', 'recycle'].includes(kind);
  const isReuse = kind === 'reuse';
  const isRepair = kind === 'repair';
  const lifecycle = new host.ownerDocument.defaultView.AbortController();
  let storage = null;
  try { storage = host.ownerDocument.defaultView.localStorage; } catch { /* Private browsing may disable storage. */ }
  let disposed = false;
  let disposePhoto = () => {};
  let data = getStaticSnapshot();
  let loading = true;
  let checkedRecall = false;
  let searchedArea = null;
  const listen = (node, event, callback) => node?.addEventListener(event, callback, { signal: lifecycle.signal });
  const go = (destination) => { playSound('tap'); onNavigate(destination); };
  const queryFor = () => `appliance=${encodeURIComponent(draft.category)}`;
  const exploreRoute = () => `explore?appliance=${encodeURIComponent(Object.keys(WORLD_ITEMS).find(key => WORLD_ITEMS[key] === draft.category) || draft.category)}`;

  // Adults can move directly between tasks. The selected item crosses the bridge
  // back to the same 3D object, so learning and action form one connected journey.
  const familyBridge = () => `<aside class="action-family-bridge"><div class="action-bridge-symbol" aria-hidden="true">↗</div><div><p class="action-eyebrow">Same item. A bigger picture.</p><h2>Understand what you are keeping in use.</h2><p>Explore the <strong data-selected-appliance>${escape(draft.category)}</strong> in 3D: its parts, everyday care and electricity impact. Useful on your own, even better as a family conversation.</p></div><button class="button secondary" type="button" data-family-lens>Explore this item <span aria-hidden="true">↗</span></button></aside>`;
  const options = () => `${!CATEGORIES.includes(draft.category) ? `<optgroup label="Your selected item"><option selected>${escape(draft.category)}</option></optgroup>` : ''}${FAMILIES.map((family) => `<optgroup label="${escape(family.name)}">${family.categories.map((name) => `<option${name === draft.category ? ' selected' : ''}>${escape(name)}</option>`).join('')}</optgroup>`).join('')}`;

  function render() {
    host.innerHTML = `<section class="action-view">
      <header class="action-heading"><div><p class="action-eyebrow">THE ACTION CENTRE</p><h1>A better next step<br>for things you own.</h1><p>Check a recall, find help nearby, or plan a longer life for your appliance. Start with what you need.</p></div><div class="action-heading-aside"><span class="action-status-dot"></span><span>For appliance owners<br><strong>Practical by design.</strong></span></div></header>
      <nav class="action-pathways" aria-label="Appliance actions">${[['recall','01','Check a recall'],['repair','02','Find repair'],['recycle','03','Recycle well'],['reuse','04','Pass it on']].map(([key,number,label]) => `<button type="button" data-action-kind="${key}" ${key === kind ? 'aria-current="page"' : ''}><span>${number}</span>${label}<i aria-hidden="true">↗</i></button>`).join('')}</nav>
      ${params.get('from') === 'learn' ? '<div class="action-learning-handoff"><span aria-hidden="true">✦</span><p><strong>From learning to a real next step.</strong> Explore options together. An adult handles the real-world next step.</p></div>' : ''}
      ${isReuse ? reuseMarkup() : services ? servicesMarkup() : recallMarkup()}
      ${plannerMarkup()}
      ${familyBridge()}
    </section>`;
    host.querySelectorAll('[data-action-kind]').forEach(button => listen(button, 'click', () => go(`action?kind=${button.dataset.actionKind}&${queryFor()}`)));
    listen(host.querySelector('[data-family-lens]'), 'click', () => go(exploreRoute()));
    if (isReuse) bindReuse(); else if (services) bindServices(); else bindRecall();
    bindPlanner();
  }

  // This is a small, useful personal commitment, not a booking/reminder service.
  // Date and task stay in this browser only; we never invent a completed impact.
  function plannerMarkup() {
    const saved = readActionPlan(storage);
    const relevant = saved?.appliance === draft.category ? saved : null;
    return `<section class="action-personal-plan" aria-labelledby="action-plan-heading"><div><p class="action-eyebrow">FROM AN OPTION TO A PLAN</p><h2 id="action-plan-heading">Make the next step yours.</h2><p>One small action for your <strong data-selected-appliance>${escape(draft.category)}</strong>. Keep it here so you can pick up where you left off.</p><div class="action-plan-proof"><span aria-hidden="true">↗</span><p>A plan is a starting point.<br><strong>You decide when to act.</strong></p></div></div><form id="action-save-plan" data-appliance="${escape(draft.category)}"><label class="action-field">My next step<select name="task">${[['manual','Find the care guide for my exact model'],['recall','Confirm my model in the official recall search'],['repair','Ask a repairer about this item'],['recycle','Confirm a drop-off accepts this item'],['reuse','Ask someone whether this item is useful to them']].map(([value,label]) => `<option value="${value}"${(relevant?.task || kind) === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label><label class="action-field">A date to aim for <span class="action-optional">optional</span><input type="date" name="date" value="${escape(relevant?.date || '')}"></label><div class="action-plan-buttons"><button class="button primary" type="submit">Save my next step <span aria-hidden="true">↗</span></button><button class="action-text-link" type="button" data-delete-plan${relevant ? '' : ' hidden'}>Remove saved plan</button></div><p class="action-small" role="status" data-plan-status>${relevant ? 'Your next step is saved on this browser.' : 'Saved on this browser only. No email, notification or booking.'}</p></form></section>`;
  }

  // A failed save is visible. Clearing is explicit and affects only this preview's
  // one plan, never an existing Quest save or the adult's appliance identity.
  function bindPlanner() {
    const form = host.querySelector('#action-save-plan');
    listen(form, 'submit', event => {
      event.preventDefault();
      const saved = saveActionPlan(storage, { appliance: draft.category, task: form.elements.task.value, date: form.elements.date.value });
      host.querySelector('[data-plan-status]').textContent = saved ? 'Your next step is saved on this browser. Return here whenever you are ready.' : 'This browser could not save the plan. You can still use the choices above.';
      host.querySelector('[data-delete-plan]').hidden = !saved;
      playSound('tap');
    });
    listen(host.querySelector('[data-delete-plan]'), 'click', () => {
      try { storage?.removeItem(PLAN_KEY); host.querySelector('[data-plan-status]').textContent = 'Saved plan removed. Choose another next step whenever you like.'; host.querySelector('[data-delete-plan]').hidden = true; }
      catch { host.querySelector('[data-plan-status]').textContent = 'This browser could not remove the saved plan.'; }
    });
  }

  // Reuse is its own pathway. A working story item is not evidence about the
  // household's real appliance, so an adult answers these checks separately.
  function reuseMarkup() {
    return `<div class="action-main-grid"><section class="action-panel" aria-labelledby="reuse-plan-heading">
      <div class="action-panel-heading"><div><p class="action-eyebrow">PASS IT ON</p><h2 id="reuse-plan-heading">A useful item needs a willing home.</h2><p class="muted">Check what you know before offering it.</p></div></div>
      <label class="action-field">Appliance<select id="action-category">${options()}</select></label>
      <label class="action-field">Is it already known to work, with no known damage?<select id="action-reuse-condition"><option value="">Choose what you know</option><option value="yes">Yes, it is already known to work</option><option value="no">No, there is a problem or damage</option><option value="unsure">I’m not sure</option></select></label>
      <p class="action-small">Do not switch on or test a suspect item for this question.</p>
      <div class="action-reuse-warning" role="status" hidden></div>
      <div class="action-plan action-reuse-checks"><h3>Before anyone takes it home</h3>
        <p>Keep your checks practical. Nothing is donated or booked by this page.</p>
        <label><input type="checkbox" id="action-reuse-recall"> I checked the official recall information and any instructions.</label>
        ${link(RECALL_SOURCE, 'Open official recall search', 'action-text-link')}
        <label><input type="checkbox" id="action-reuse-acceptance"> The person or organisation has confirmed they want and can accept this exact item.</label>
        <label><input type="checkbox" id="action-reuse-handover"> I will arrange the handover and include the item’s instructions if available.</label>
      </div><p class="action-reuse-status" role="status">Start with what you already know about the item.</p>
    </section><aside class="action-side-note"><p class="eyebrow">Ask before you offer</p><h2>“Would this be useful to you?”</h2><p>Start with someone you know, or ask a local organisation which electrical items it accepts. Some do not accept electrical items at all.</p><div class="action-note-rule"></div><p>If nobody wants it yet, keep looking for a suitable home. Do not leave it at a donation point without agreement.</p><button type="button" class="action-text-link" data-reuse-recall>Check the item’s recall details →</button></aside></div>`;
  }

  // A plan becomes ready only after the adult supplies every answer. This does
  // not claim that a handover happened or award carbon savings/game points.
  function bindReuse() {
    const condition = host.querySelector('#action-reuse-condition');
    const updatePlan = () => {
      const warning = host.querySelector('.action-reuse-warning');
      const uncertain = ['no', 'unsure'].includes(condition.value);
      warning.hidden = !uncertain;
      warning.innerHTML = uncertain ? '<strong>Pause before passing it on.</strong><p>Arrange qualified advice about the problem or uncertainty first. Follow any product recall instructions.</p><button type="button" class="button secondary" data-reuse-repair>Find repair options</button>' : '';
      listen(warning.querySelector('[data-reuse-repair]'), 'click', () => go(`action?kind=repair&${queryFor()}`));
      const inputs = [...host.querySelectorAll('.action-reuse-checks input')];
      const complete = condition.value === 'yes' && inputs.every((input) => input.checked);
      host.querySelector('.action-reuse-status').textContent = complete ? 'Your handover plan is ready. You decide when to take the next step.' : uncertain ? 'Keep the item with the adult while the next step is checked.' : 'Check the recall, ask the recipient, then plan the handover.';
    };
    listen(host.querySelector('#action-category'), 'change', (event) => {
      draft.category = event.target.value; condition.value = '';
      host.querySelectorAll('.action-reuse-checks input').forEach((input) => { input.checked = false; });
      updateSelectedItem(); updatePlan();
    });
    listen(condition, 'change', updatePlan);
    host.querySelectorAll('.action-reuse-checks input').forEach((input) => listen(input, 'change', updatePlan));
    listen(host.querySelector('[data-reuse-recall]'), 'click', () => go(`action?kind=recall&${queryFor()}`));
  }

  // Identity fields are optional except category. Suggestions never overwrite an unknown brand/model.
  function recallMarkup() {
    return `<div class="action-main-grid"><form class="action-panel" id="action-recall-form">
      <div class="action-panel-heading"><div><p class="action-eyebrow">RECALL CHECK</p><h2>Start with your appliance label.</h2><p class="muted">Brand and model help distinguish your item from a similar one.</p></div></div>
      <div class="action-photo-mount"></div>
      <label class="action-field">Appliance<select name="category" id="action-category">${options()}</select></label>
      <p class="action-coverage" data-coverage-note${CATEGORIES.includes(draft.category) ? ' hidden' : ''}>${escape(draft.category)} is outside our reviewed recall categories. Keep the item selected and use the official recall search for its exact model.</p>
      <div class="action-field-row"><label class="action-field">Brand <span class="action-optional">if known</span><input name="brand" id="action-brand" value="${escape(draft.brand)}" list="action-brands" maxlength="60" autocomplete="off" placeholder="e.g. Breville"><datalist id="action-brands"></datalist></label>
      <label class="action-field">Model number <span class="action-optional">if known</span><input name="model" id="action-model" value="${escape(draft.model)}" list="action-models" maxlength="50" autocomplete="off" placeholder="From the appliance label"><datalist id="action-models"></datalist></label></div>
      <p class="action-small">Type your own details or choose a suggestion. A suggested model is not a recall result.</p>
      <details class="action-details"><summary>Where is the model number?</summary><p>Check the packaging, manual or label when accessible. Do not move a hot, damaged or connected appliance to look for it. It may say “Model”, “Model No.” or “Type”.</p></details>
      <details class="action-details"><summary>About photo suggestions</summary><p>Our optional photo helper suggests an appliance type only. It cannot read brand or model numbers, find a fault, or confirm a recall.</p><p>Photo suggestions are currently paused while accuracy is checked. The form works without them.</p></details>
      <button type="submit" class="button primary action-submit">Check recall records <span aria-hidden="true">→</span></button>
      <p class="action-small" data-data-status role="status">Checking record availability…</p>
    </form><aside class="action-side-note"><p class="eyebrow">Why check first?</p><h2>The next step may already be set out.</h2><p>A recall notice explains the issue and what the supplier asks owners to do.</p><div class="action-note-rule"></div><p><strong>A clear result takes the right details.</strong></p><p>We search a limited collection of reviewed notices. The official notice is the place to confirm models, dates and instructions.</p>${link(RECALL_SOURCE, 'Open official recall search', 'action-text-link')}</aside></div>
      <section id="action-recall-result" class="action-result" aria-live="polite" aria-atomic="false"></section>`;
  }

  // This is the existing AI integration: policy check -> optional local inference -> user confirmation
  // -> category field. The model never fills brand/model and never calls recall matching on its own.
  function bindRecall() {
    const form = host.querySelector('#action-recall-form');
    const sync = () => {
      draft.category = form.elements.category.value;
      draft.brand = form.elements.brand.value;
      draft.model = form.elements.model.value;
      updateIdentitySuggestions();
      updateSelectedItem();
      const coverage = host.querySelector('[data-coverage-note]');
      coverage.hidden = CATEGORIES.includes(draft.category);
      coverage.textContent = `${draft.category} is outside our reviewed recall categories. Keep the item selected and use the official recall search for its exact model.`;
    };
    // Editing identity invalidates the displayed check immediately. A result for
    // the old model must never sit under a newly entered model as if it applied.
    const identityChanged = () => {
      sync(); checkedRecall = false;
      host.querySelector('#action-recall-result')?.replaceChildren();
    };
    listen(form, 'input', identityChanged);
    listen(form, 'change', identityChanged);
    listen(form, 'submit', (event) => {
      event.preventDefault(); sync(); checkedRecall = true; playSound('tap'); showRecall();
      host.querySelector('#action-recall-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    disposePhoto = mountPhotoHelper(host.querySelector('.action-photo-mount'), {
      onConfirm(suggestion) {
        const name = suggestion?.category || suggestion?.label;
        if (CATEGORIES.includes(name)) { form.elements.category.value = name; identityChanged(); }
      },
      onChooseManually() { form.elements.category.focus(); },
    });
    updateIdentitySuggestions();
  }

  // Use already reviewed product identities for assistance, never their prices or a guessed model.
  function updateIdentitySuggestions() {
    const suggestions = productSuggestions({ ...draft, categoryCode: CATEGORY_CODE_BY_NAME[draft.category] }, PRICE_SNAPSHOT.prices, data.recalls);
    const brands = host.querySelector('#action-brands');
    const models = host.querySelector('#action-models');
    if (brands) brands.innerHTML = suggestions.brands.map((brand) => `<option value="${escape(brand)}"></option>`).join('');
    if (models) models.innerHTML = suggestions.models.map((model) => `<option value="${escape(model.model)}" label="${escape(model.source)}"></option>`).join('');
  }

  // The matching helper treats missing data, missing identifiers, possible matches and no limited
  // match as four distinct states. None of them is a certification that an appliance is safe.
  function showRecall() {
    const resultHost = host.querySelector('#action-recall-result');
    if (!resultHost || !checkedRecall) return;
    // Out-of-scope items must never fall through to an empty category search,
    // because that could be mistaken for evidence that no recall exists.
    if (!CATEGORIES.includes(draft.category)) {
      resultHost.innerHTML = `<div class="action-result-box"><p class="action-eyebrow">YOUR SELECTED ITEM</p><h2>Check ${escape(draft.category)} in the official register.</h2><p>Our reviewed categories do not cover this item. We have not checked its recall status, and your appliance has not been replaced with a different type.</p><p class="action-identity-pill">${escape([draft.category, draft.brand, draft.model].filter(Boolean).join(' · '))}</p>${link(RECALL_SOURCE, 'Open the official recall search', 'button primary')}</div>`;
      return;
    }
    if (loading) { resultHost.innerHTML = '<div class="action-result-box"><h2>Getting the records…</h2><p>Your details are kept here while we check availability.</p></div>'; return; }
    const result = matchRecall({ ...draft, categoryCode: CATEGORY_CODE_BY_NAME[draft.category] }, data.recalls, data.availability.recalls);
    const copy = {
      unavailable: ['Records are unavailable here', 'We cannot check this appliance right now. Use the official recall search and enter the details from your label.'],
      insufficient: ['A little more detail will help', draft.model ? 'Confirm the details on your label and the official notices below.' : 'Add the model number if you can. An appliance type or brand alone cannot tell us whether your item is affected.'],
      possible: ['A possible recall needs your attention', 'Check the affected models and instructions in the official notice before arranging ordinary repair or recycling.'],
      none: ['No exact match in the records checked', 'This limited search does not prove that there is no recall or that the appliance is safe. Check the official recall search too.'],
    }[result.status];
    const records = result.matches || [];
    resultHost.innerHTML = `<div class="action-result-box ${result.status === 'possible' ? 'action-result-caution' : ''}"><p class="eyebrow">Your recall check</p><h2>${copy[0]}</h2><p>${copy[1]}</p>
      <p class="action-identity-pill">${escape([draft.category, draft.brand, draft.model].filter(Boolean).join(' · '))}</p>
      ${result.brandConflict ? '<p><strong>The entered brand differs from the notice.</strong> Recheck the label; the model number still produced a possible match.</p>' : ''}
      ${records.length ? `<p>${result.status === 'possible' ? 'Matching identifier in a reviewed notice:' : 'Category or brand notices to inspect — not confirmed matches:'}</p><div class="action-notices">${records.slice(0, 4).map((record) => `<article><h3>${escape(record.title || record.productName)}</h3><p>${escape(record.brand || '')}</p>${link(safeUrl(record.noticeUrl, true), 'Read official notice', 'action-text-link')}</article>`).join('')}</div>` : ''}
      ${result.near?.length ? '<p>Some recorded identifiers have a similar spelling. Recheck your label; similar spelling is not an exact match.</p>' : ''}
      <div class="action-actions">${link(RECALL_SOURCE, 'Check the official recall search', 'button primary')}
      ${result.status === 'unavailable' ? '<button type="button" class="button secondary" data-retry-records>Try records again</button>' : ''}</div>
      <p class="action-small">${data.availability.recalls ? `Source: ACCC Product Safety. Retrieved: ${escape(data.datasetMeta.recalls?.retrievalDate || 'date not supplied')}. ${escape(data.datasetMeta.recalls?.limitation || 'Limited reviewed records; not a complete live register.')}` : 'No recall decision has been made. Your entries stay in this browser tab.'}</p></div>`;
    listen(resultHost.querySelector('[data-retry-records]'), 'click', () => { loading = true; showRecall(); load(); });
  }

  function servicesMarkup() {
    return `<div class="action-main-grid"><form class="action-panel" id="action-services-form">
      <div class="action-panel-heading"><div><p class="action-eyebrow">${isRepair ? 'FIND REPAIR' : 'RECYCLE WELL'}</p><h2>${isRepair ? 'Find the right people for your item.' : 'Give materials a better next life.'}</h2><p class="muted">Search by suburb. Confirm acceptance before travelling.</p></div></div>
      <label class="action-field">Appliance<select name="category" id="action-category">${options()}</select></label>
      <label class="action-field">Melbourne suburb or postcode<input name="area" id="action-area" value="${escape(draft.area)}" maxlength="50" autocomplete="off" placeholder="e.g. Clayton or 3168" aria-describedby="action-area-help action-area-error" aria-controls="action-area-options"></label>
      <div id="action-area-options" class="action-area-options" aria-live="polite"></div>
      <p class="action-small" id="action-area-help">No street address needed. Your search stays in this tab.</p><p id="action-area-error" class="action-field-error" role="alert"></p>
      <button class="button primary action-submit" type="submit">Find ${isRepair ? 'repair options' : 'recycling options'} <span aria-hidden="true">→</span></button>
      <p class="action-small" data-data-status role="status">Checking listing availability…</p>
    </form><aside class="action-side-note"><p class="action-eyebrow">A USEFUL QUESTION TO ASK</p><h2>${isRepair ? '“Can you assess this model?”' : '“Do you accept this exact item?”'}</h2><p>${isRepair ? 'Have the brand, model and a description of the problem ready. Ask about assessment fees, appointment times and whether the repairer works on this type of appliance.' : 'Tell the collection point what you have. Ask about opening hours, fees and any preparation they require before you travel.'}</p><div class="action-note-rule"></div><p>Suspect a recall? The official notice may specify a return or remedy through the supplier.</p><button class="action-text-link" type="button" data-check-recall>Check a product recall <span aria-hidden="true">→</span></button></aside></div>
      <section id="action-service-result" class="action-result" aria-live="polite" aria-atomic="false"></section>`;
  }

  // Suburb matching uses the existing local ABS-derived index. No geolocation permission, child
  // street address, external keystroke lookup or invented geographic distance is involved.
  function bindServices() {
    const form = host.querySelector('#action-services-form');
    const areaOptions = host.querySelector('#action-area-options');
    // Suggestions are visible buttons, so touch users and screen-reader users do
    // not have to discover a browser-specific datalist popup to choose an area.
    const showAreas = (rows, prompt = 'Choose your area') => {
      areaOptions.innerHTML = rows.length ? `<p>${escape(prompt)}</p><div role="group" aria-label="Area suggestions">${rows.map((area) => `<button class="action-area-option" type="button" data-area-choice="${escape(`${area.postcode} — ${area.suburb}`)}">${escape(area.suburb)} <span>${escape(area.postcode)}</span></button>`).join('')}</div>` : '';
    };
    const completeSearch = (area) => {
      searchedArea = area; areaOptions.replaceChildren();
      form.elements.area.removeAttribute('aria-invalid');
      host.querySelector('#action-area-error').textContent = '';
      playSound('tap'); showServices();
      host.querySelector('#action-service-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    listen(form.elements.area, 'input', () => {
      draft.area = form.elements.area.value;
      // A different area invalidates the previous list and visit checklist.
      searchedArea = null;
      host.querySelector('#action-service-result')?.replaceChildren();
      form.elements.area.removeAttribute('aria-invalid');
      host.querySelector('#action-area-error').textContent = '';
      showAreas(findSuburbSuggestions(draft.area, SUBURB_POSTCODES));
    });
    listen(areaOptions, 'click', (event) => {
      const button = event.target.closest('[data-area-choice]');
      if (!button) return;
      const chosen = button.dataset.areaChoice;
      const resolved = resolveAreaInput(chosen, SUBURB_POSTCODES);
      if (!resolved.valid) return;
      draft.area = chosen; form.elements.area.value = chosen; completeSearch(resolved);
    });
    listen(form.elements.category, 'change', () => { draft.category = form.elements.category.value; updateSelectedItem(); if (searchedArea) showServices(); });
    listen(form, 'submit', (event) => {
      event.preventDefault(); draft.area = form.elements.area.value; draft.category = form.elements.category.value;
      const areaText = draft.area.trim();
      const isPostcode = /^\d{4}$/.test(areaText);
      const exactAreas = isPostcode ? SUBURB_POSTCODES.filter((area) => String(area.postcode) === areaText) : [];
      // A postcode may cover several suburbs. Let the person choose instead of
      // averaging suburb coordinates and presenting the average as their place.
      if (exactAreas.length > 1) {
        showAreas(exactAreas, `Which suburb in ${areaText}?`);
        host.querySelector('#action-area-error').textContent = 'Choose one of the suburb buttons to continue.';
        areaOptions.querySelector('button')?.focus(); return;
      }
      // The project index has gaps (including 3000). Keep a complete typed code
      // useful for official finders, but never invent coordinates or nearby results.
      if (isPostcode && exactAreas.length === 0) {
        completeSearch({ label: `Postcode entered: ${areaText}`, postcode: areaText, unlocated: true }); return;
      }
      const resolved = resolveAreaInput(draft.area, SUBURB_POSTCODES);
      if (!resolved.valid) {
        const suggestions = findSuburbSuggestions(draft.area, SUBURB_POSTCODES);
        showAreas(suggestions);
        host.querySelector('#action-area-error').textContent = suggestions.length ? 'Choose your suburb from the suggestion buttons.' : resolved.reason === 'not-found' ? 'This area is not in our local index. Try its four-digit postcode to continue with an official finder.' : resolved.message;
        form.elements.area.setAttribute('aria-invalid', 'true'); form.elements.area.focus(); return;
      }
      completeSearch(resolved);
    });
    listen(host.querySelector('[data-check-recall]'), 'click', () => go(`action?kind=recall&${queryFor()}`));
  }

  // Read-only location results remain candidates: distance is from a suburb centre, never a
  // verified trip distance or a promise that this provider accepts the selected appliance.
  function showServices() {
    const target = host.querySelector('#action-service-result');
    if (!target || !searchedArea) return;
    if (loading) { target.innerHTML = '<div class="action-result-box"><h2>Looking for the listing records…</h2><p>Your selected area is ready.</p></div>'; return; }
    const relevant = isRepair ? data.locations.filter((row) => ['electronics_repair', 'electronics_shop_repair', 'repair_service'].includes(row.providerType)) : data.locations;
    const nearby = getNearbyLocations(searchedArea, isRepair ? 'repair' : 'dispose', relevant, { radiusKm: 20, limit: 6 });
    const available = data.availability.locations && !searchedArea.unlocated;
    target.innerHTML = `<div class="action-result-box"><p class="eyebrow">${escape(draft.category)} · ${escape(searchedArea.label)}</p><h2>${available ? (nearby.matches.length ? 'Places to contact before visiting' : 'No recorded options within 20 km') : 'Use a current finder for this area'}</h2>
      <p>${searchedArea.unlocated ? 'This postcode is not in our local coordinate index. We have not calculated nearby places or distances. Enter the postcode in the official finder below to check your area.' : available ? 'These are public-data candidates. Confirm appliance acceptance, opening times and any fees directly.' : 'Our listing records are unavailable right now. We have not searched or confirmed nearby places. Continue with the source below.'}</p>
      ${available && !nearby.matches.length ? '<p>This does not mean there are no services nearby. Our records have limited coverage.</p>' : ''}
      <div class="action-location-grid">${available ? nearby.matches.map(locationCard).join('') : ''}</div>
      <div class="action-finder-card"><span class="action-finder-icon" aria-hidden="true">${isRepair ? '↻' : '♲'}</span><div><h3>${isRepair ? 'Repair Café directory' : 'Victorian e-waste guidance & finders'}</h3><p>${isRepair ? 'For community repair events, check the directory and ask what the volunteers can work on. Suspected electrical faults need qualified advice.' : 'Use the Victorian Government’s guide to find electrical recycling and your council’s local options.'}</p>${link(isRepair ? REPAIR_SOURCE : RECYCLE_SOURCE, isRepair ? 'Open Repair Café directory' : 'Find a suitable drop-off', 'button secondary')}</div></div>
      <div class="action-plan"><h3>Your visit checklist</h3><p>Tick what you have checked together. This is a plan, not a record of a completed repair or recycling visit.</p>
      <label><input type="checkbox"> I checked that the place accepts our ${escape(draft.category.toLowerCase())}.</label>
      <label><input type="checkbox"> I checked opening times, bookings and any fee.</label>
      <label><input type="checkbox"> I know how I will arrange the visit.</label><p class="action-plan-status" role="status"></p></div>
      <p class="action-small">Area lookup: project’s ABS-derived Melbourne suburb index. ${available ? 'Distances shown are straight-line estimates from that area’s centre.' : 'No distance or shop results are being simulated.'}</p></div>`;
    target.querySelectorAll('.action-plan input').forEach((input) => listen(input, 'change', () => {
      const checked = target.querySelectorAll('.action-plan input:checked').length;
      target.querySelector('.action-plan-status').textContent = checked === 3 ? 'Your plan is ready. You decide when to take the next step.' : `${checked} of 3 details checked`;
      playSound('tap');
    }));
  }

  // Keep the selected-item bridge and saved plan in step with category edits
  // without rebuilding the form or losing focus and entered information.
  function updateSelectedItem() {
    host.querySelectorAll('[data-selected-appliance]').forEach(node => { node.textContent = draft.category; });
    // A saved task belongs to one item. Changing category updates the planner
    // without losing the currently focused appliance field or listing results.
    const form = host.querySelector('#action-save-plan');
    if (form && form.dataset.appliance !== draft.category) {
      const saved = readActionPlan(storage);
      const relevant = saved?.appliance === draft.category ? saved : null;
      form.dataset.appliance = draft.category;
      form.elements.task.value = relevant?.task || kind;
      form.elements.date.value = relevant?.date || '';
      host.querySelector('[data-delete-plan]').hidden = !relevant;
      host.querySelector('[data-plan-status]').textContent = relevant ? 'Your next step is saved on this browser.' : 'Saved on this browser only. No email, notification or booking.';
    }
  }

  function locationCard(item) {
    const address = [item.address, item.suburb, item.postcode].filter(Boolean).join(', ');
    return `<article class="action-location"><p class="eyebrow">About ${Number(item.distanceKm).toFixed(1)} km from area centre</p><h3>${escape(item.name)}</h3><p>${escape(address || 'Address not recorded')}</p>${item.phone ? `<p>Phone: ${escape(item.phone)}</p>` : ''}${link(item.url, 'Provider website', 'action-text-link')}
      <details class="action-details"><summary>Source & limits</summary><p>${escape(item.verificationNote || 'Acceptance has not been independently confirmed. Contact this provider before visiting.')}</p><p>Information date: ${escape(item.sourceRetrievedAt || 'not supplied')}</p>${link(item.sourceUrl, 'View source', 'action-text-link')}</details></article>`;
  }

  // The same-origin adapter performs GET reads only. Flask returns actual reviewed
  // records; the optional loopback design server returns explicit unavailable flags.
  // Preserve the established adapter deadline so a cold database read has time to finish.
  async function load() {
    const requestFetch = (url, options = {}) => {
      const combined = new AbortController();
      const signals = [lifecycle.signal, options.signal].filter(Boolean);
      const abort = () => combined.abort();
      signals.forEach((signal) => signal.aborted ? abort() : signal.addEventListener('abort', abort, { once: true }));
      return fetch(url, { ...options, signal: combined.signal }).finally(() => signals.forEach((signal) => signal.removeEventListener('abort', abort)));
    };
    try { data = await loadPublicData({}, requestFetch); }
    catch { data = getStaticSnapshot(); }
    if (disposed) return;
    loading = false;
    const status = host.querySelector('[data-data-status]');
    if (status) status.textContent = data.availability[services ? 'locations' : 'recalls'] ? 'Reference records loaded. Source details accompany results.' : 'Reference records are unavailable here. Official sources remain available.';
    if (services) showServices(); else { updateIdentitySuggestions(); showRecall(); }
  }

  render();
  // The handover plan uses no listing or recall result, so opening reuse needs no API request.
  if (isReuse) loading = false; else void load();
  return () => { disposed = true; lifecycle.abort(); disposePhoto(); };
}
