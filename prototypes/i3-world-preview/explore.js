import { CATALOGUE, GRID_FACTORS, SOURCES, findAppliance, calculateImpact } from './catalogue.js';

/** Only catalogue text and numeric values enter our templates. This helper also
 * escapes anything coming from a route, so URL text never becomes HTML. */
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

/** Small flat catalogue icons are navigation aids. The large interactive viewport
 * is a real WebGL scene provided by world-engine.js, not these decorative icons. */
export function productIcon(id) {
  const paths = {
    kettle: '<path d="M16 25h23l4 25H12l4-25Zm4-6h15m-18 6-5-9-6 3 7 13m28-4h4a8 8 0 0 1 0 16h-3"/><path d="M12 55h34"/>',
    fan: '<circle cx="30" cy="24" r="19"/><path d="M25 45v11h10V45M16 58h28"/><path d="M30 24c-14 0-11-13-4-13 8 0 4 13 4 13Zm0 0c5-12 16-5 13 1-3 7-13-1-13-1Zm0 0c7 10-5 17-9 12-5-6 9-12 9-12Z"/>',
    toaster: '<rect x="9" y="22" width="43" height="30" rx="7"/><path d="M17 22v-7h25v7M17 55h27M44 33v9m-5-5h10"/>',
    blender: '<path d="m18 12 3 25h20l3-25H18ZM17 9h28M22 39h18l7 17H15l7-17ZM44 17h6v14h-8"/><circle cx="31" cy="49" r="3"/>',
    microwave: '<rect x="6" y="15" width="49" height="34" rx="4"/><rect x="11" y="20" width="31" height="24" rx="2"/><path d="M48 23h2m-2 6h2m-2 7h2M11 53h38"/>',
    vacuum: '<rect x="8" y="31" width="25" height="23" rx="9"/><path d="M23 31V19c0-13 21-13 21 0v24m-6 10 6-10 8 10H38Z"/><circle cx="15" cy="54" r="4"/>',
    hairdryer: '<path d="M14 16h26l9 8-9 9H14a8 8 0 0 1 0-17Zm6 17-2 23h10l4-23M49 20h8v9h-8"/><path d="M12 21v8m5-8v8"/>',
    laptop: '<rect x="12" y="11" width="39" height="29" rx="3"/><path d="M12 40 4 51h55l-8-11M23 47h17"/>',
  };
  return `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths[id] || paths.kettle}</svg>`;
}

/** Read route formats used by the shared shell without coupling to its router. */
function routeParams(route) {
  if (route?.params instanceof URLSearchParams) return route.params;
  if (route?.searchParams instanceof URLSearchParams) return route.searchParams;
  if (route instanceof URLSearchParams) return route;
  return new URLSearchParams(String(typeof route === 'string' ? route : location.hash).split('?')[1] || '');
}

/** Mount a complete explore screen. UI state lives here; geometry/camera state
 * lives in world-engine.js. Both a mesh tap and an accessible part button call
 * choosePart(), which keeps the selected 3D highlight and explanation in sync.
 * worldFactory is an optional dependency for tests, never an alternate live UI. */
export async function mountExplore(host, options = {}) {
  const { onNavigate = () => {}, onLearn = () => {}, onAward = () => {}, playSound = () => {} } = options;
  const params = routeParams(options.route);
  let appliance = findAppliance(params.get('appliance'));
  let activeTab = ['parts', 'care', 'impact'].includes(params.get('tab')) ? params.get('tab') : 'parts';
  let selectedPart = appliance.parts[0].id;
  let expanded = false;
  let rotating = false;
  let showingRoom = false;
  let disposed = false;
  let world;
  let worldDisposed = false;
  let challengeAnswered = false;
  const viewedParts = new Set();
  const Controller = host.ownerDocument.defaultView.AbortController;
  const controller = new Controller();
  const impactValues = new Map();

  /** Navigation can happen before Three.js or its AR capability check finishes.
   * The shell aborts this signal immediately, preventing a late mount from
   * writing into the next page or leaking a renderer on an abandoned canvas. */
  function cleanup() {
    disposed = true;
    controller.abort();
    options.signal?.removeEventListener('abort', cleanup);
    if (world && !worldDisposed) { worldDisposed = true; world.dispose(); }
  }
  if (options.signal?.aborted) { cleanup(); return cleanup; }
  options.signal?.addEventListener('abort', cleanup, { once: true });

  host.innerHTML = `<section class="explore-page page-width" aria-labelledby="explore-title">
    <header class="explore-heading"><div><p class="eyebrow">FF LENS / EXPLORE TO UNDERSTAND</p><h1 id="explore-title">Every object has more to it.</h1><p>Look inside in 3D. Discover how it works, how to care for it and what comes next.</p></div><div class="explore-heading-actions"><label class="explore-product-picker">Choose an appliance <span>8 objects to explore</span><select data-product-picker>${CATALOGUE.map(item => `<option value="${item.id}"${item.id === appliance.id ? ' selected' : ''}>${escape(item.name)}</option>`).join('')}</select></label><a class="explore-help-link" href="#action?kind=repair&appliance=${encodeURIComponent(appliance.category)}">Have a faulty appliance? <span aria-hidden="true">↗</span></a></div></header>
    <div class="explore-workspace">
      <div class="explore-stage-column">
        <div class="explore-stage" aria-label="Interactive appliance world">
          <div class="explore-stage-top"><span class="explore-stage-badge">LIVE 3D WORLD</span><span class="explore-room-label">${escape(appliance.room)} / ${escape(appliance.name)}</span></div>
          <canvas class="explore-canvas" aria-label="3D ${escape(appliance.name)}. Drag to rotate, pinch to zoom. Parts can also be selected in the adjacent panel." tabindex="0"></canvas>
          <div class="explore-start-hint"><span class="explore-drag-symbol" aria-hidden="true">↔</span><span>Drag to look around.<br><strong>Tap a part to discover it.</strong></span></div>
          <div class="explore-stage-tools" aria-label="3D view controls">
            <button type="button" data-world="room" title="See the whole room" aria-pressed="false">⌂ <span>Room view</span></button>
            <button type="button" data-world="explode" aria-pressed="false">↗↙ <span>Separate parts</span></button>
            <button type="button" data-world="rotate" aria-pressed="false">⟳ <span>Rotate</span></button>
            <button type="button" data-world="reset">↺ <span>Reset view</span></button>
          </div>
          <div class="explore-world-status" role="status">Preparing your 3D world…</div>
        </div>
        <div class="explore-ar-row"><div><span class="explore-ar-icon" aria-hidden="true">⌗</span><span><strong>Bring it into your space</strong><small>Camera AR on supported phones and tablets.</small></span></div><button class="explore-ar-button" type="button" data-world="ar" aria-describedby="ar-support-status">View in my room <span aria-hidden="true">↗</span></button></div>
        <p id="ar-support-status" class="explore-ar-status">Checking this device for camera AR…</p>
      </div>
      <aside class="explore-inspector" aria-labelledby="appliance-title">
        <div class="explore-appliance-heading"><p class="eyebrow">MEET YOUR EVERYDAY</p><h2 id="appliance-title">${escape(appliance.name)}</h2><p class="explore-device-summary">${escape(appliance.summary)}</p></div>
        <div class="explore-tabs" role="tablist" aria-label="Explore this appliance">${['parts', 'care', 'impact'].map(tab => `<button type="button" role="tab" id="tab-${tab}" data-tab="${tab}" aria-selected="${tab === activeTab}" aria-controls="explore-panel" tabindex="${tab === activeTab ? 0 : -1}">${{ parts: 'Parts', care: 'Care', impact: 'CO₂e impact' }[tab]}</button>`).join('')}</div>
        <div id="explore-panel" class="explore-panel" role="tabpanel" aria-labelledby="tab-${activeTab}" tabindex="0"></div>
      </aside>
    </div>
    <section class="explore-catalogue" aria-labelledby="catalogue-title"><div class="explore-section-heading"><h2 id="catalogue-title">Pick something familiar.</h2><span>8 objects. New things to notice.</span></div><div class="explore-product-list">${CATALOGUE.map(item => `<button type="button" class="explore-product" data-product="${item.id}" aria-pressed="${item.id === appliance.id}" style="--product-colour:${item.colour}"><span class="explore-product-art">${productIcon(item.id)}</span><span>${escape(item.name)}</span><small>${escape(item.room)}</small></button>`).join('')}</div></section>
    <section class="explore-to-action" aria-labelledby="explore-action-title"><div><p class="eyebrow">FROM UNDERSTANDING TO DOING</p><h2 id="explore-action-title">Make your next step a good one.</h2><p>A question for the family: <strong class="explore-family-question">${escape(appliance.question)}</strong></p></div><div class="explore-action-links"></div></section>
  </section>`;

  const panel = host.querySelector('#explore-panel');
  const canvas = host.querySelector('canvas');
  const stage = host.querySelector('.explore-stage');

  /** Keep overview and focused-product labels consistent. Product selection is
   * available directly at the top; no walking navigation is required. */
  function updateViewControls() {
    host.querySelector('[data-world="room"]').setAttribute('aria-pressed', String(showingRoom));
    canvas.setAttribute('aria-label', `3D ${appliance.name}. Drag to rotate, pinch to zoom. Parts can also be selected in the adjacent panel.`);
    host.querySelector('.explore-room-label').textContent = showingRoom ? 'The everyday room / overview' : `${appliance.room} / ${appliance.name}`;
    if (world) host.querySelector('.explore-world-status').textContent = showingRoom ? 'Tap an appliance to explore it.' : 'Drag to look around. Tap a part to discover it.';
  }

  /** Preserve edited scenario inputs per appliance when switching tabs/devices. */
  function valuesForProduct() {
    if (!impactValues.has(appliance.id)) impactValues.set(appliance.id, { watts: appliance.watts, minutes: appliance.minutes, days: 30, region: 'VIC', factor: GRID_FACTORS.VIC.factor });
    return impactValues.get(appliance.id);
  }

  /** A single renderer changes only the inspector, never recreating the WebGL
   * canvas, so tabs and calculation edits do not reset the camera or reload 3D. */
  function renderPanel() {
    panel.setAttribute('aria-labelledby', `tab-${activeTab}`);
    host.querySelectorAll('[data-tab]').forEach(button => {
      const current = button.dataset.tab === activeTab;
      button.setAttribute('aria-selected', String(current));
      button.tabIndex = current ? 0 : -1;
    });
    if (activeTab === 'parts') renderParts();
    if (activeTab === 'care') renderCare();
    if (activeTab === 'impact') renderImpact();
  }

  /** Mesh IDs are the shared key: a real mesh hit and these keyboard/touch
   * buttons open the same part. The current explanation is always visible. */
  function renderParts() {
    const part = appliance.parts.find(item => item.id === selectedPart) || appliance.parts[0];
    panel.innerHTML = `<p class="explore-panel-intro">Choose a part on the model or below.</p><div class="explore-part-list" aria-label="Parts of the ${escape(appliance.name)}">${appliance.parts.map((item, index) => `<button type="button" data-part="${item.id}" aria-pressed="${item.id === selectedPart}"><span>${String(index + 1).padStart(2, '0')}</span>${escape(item.name)}${viewedParts.has(`${appliance.id}:${item.id}`) ? '<i aria-label="Explored">✓</i>' : ''}</button>`).join('')}</div><div class="explore-part-detail" role="status"><p class="eyebrow">${escape(part.name)}</p><h3>${escape(part.job)}</h3><p>${escape(part.material)}</p></div><p class="explore-model-note">A simplified learning model, not your exact appliance. Explore inside here; keep real electrical enclosures closed.</p><details class="explore-question"${challengeAnswered ? ' open' : ''}><summary>Make a connection <span aria-hidden="true">+</span></summary><p>${escape(appliance.challenge.question)}</p><div class="explore-answers">${appliance.challenge.choices.map((choice, index) => `<button type="button" data-answer="${index}"${challengeAnswered ? ' disabled' : ''}>${escape(choice)}</button>`).join('')}</div><p class="explore-answer-feedback" role="status">${challengeAnswered ? `✓ ${escape(appliance.challenge.explanation)}` : ''}</p></details>`;
  }

  /** Maintenance is practical adult-led care, never an instruction to take
   * apart real electronics. The child contribution is observation and discussion. */
  function renderCare() {
    panel.innerHTML = `<p class="explore-panel-intro">Look after what you own. Start with your model’s manual.</p><ol class="explore-care-list">${appliance.care.map(([title, detail], index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><div><h3>${escape(title)}</h3><p>${escape(detail)}</p></div></li>`).join('')}</ol><div class="explore-care-boundary"><strong>For adults. Children explore the digital model.</strong><p>If there is damage, smoke, sparks or a burning smell, stop using the appliance and get appropriate help.</p></div><a class="explore-source-link" href="${SOURCES.safety}" target="_blank" rel="noopener noreferrer">Electrical safety guidance · Energy Safe Victoria ↗</a><a class="explore-care-next" href="#action?kind=repair&appliance=${encodeURIComponent(appliance.category)}">Something isn’t working? Find a next step →</a>`;
  }

  /** The impact form exposes every assumption. Its example can teach both
   * audiences without claiming that a generic 3D object has a measured footprint. */
  function renderImpact() {
    const values = valuesForProduct();
    panel.innerHTML = `<p class="explore-panel-intro">See how electricity use adds up.</p><div class="explore-impact-result" aria-live="polite"><span>ESTIMATED ELECTRICITY EMISSIONS</span><strong data-impact-result></strong><small data-impact-energy></small><div class="explore-energy-line" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><p class="explore-example-label">Editable example, not a measurement of your ${escape(appliance.name.toLowerCase())}.</p><form class="explore-impact-form" novalidate><div class="explore-input-grid"><label>Power <span>watts (W)</span><input name="watts" type="number" min="0" max="10000" step="1" inputmode="decimal" value="${escape(values.watts)}"></label><label>Daily active time <span>minutes</span><input name="minutes" type="number" min="0" max="1440" step="0.1" inputmode="decimal" value="${escape(values.minutes)}"></label><label>For how long? <span>days</span><input name="days" type="number" min="0" max="366" step="1" inputmode="numeric" value="${escape(values.days)}"></label><label>Electricity grid <select name="region">${Object.entries(GRID_FACTORS).map(([id, info]) => `<option value="${id}"${id === values.region ? ' selected' : ''}>${info.label}</option>`).join('')}<option value="custom"${values.region === 'custom' ? ' selected' : ''}>Custom factor</option></select></label></div><details class="explore-calculation-details"><summary>Assumptions & calculation</summary><label>Grid factor <span>kg CO₂e per kWh</span><input name="factor" type="number" min="0" max="5" step="0.01" inputmode="decimal" value="${escape(values.factor)}"></label><p>Watts ÷ 1,000 × minutes ÷ 60 × days = kWh.<br>kWh × grid factor = kg CO₂e.</p><p>Default: DCCEEW 2026, Table 1, scope 2. Editing the factor makes this a custom scenario.</p><a class="explore-source-link" href="${SOURCES.grid}" target="_blank" rel="noopener noreferrer">Read the source · Australian Government ↗</a></details><p data-impact-error class="explore-impact-error" role="status"></p></form><div class="explore-impact-tip"><span aria-hidden="true">↗</span><p>${escape(appliance.energyTip)}</p></div><p class="explore-impact-limits"><strong>One part of the picture.</strong> CO₂e combines greenhouse gases into a common measure. This estimates grid electricity generation only. It excludes making, transporting and disposing of the appliance, upstream fuel and network losses. Actual use varies; no saving is claimed.</p><a class="explore-source-link" href="${SOURCES.energy}" target="_blank" rel="noopener noreferrer">Explore household energy habits ↗</a>`;
    updateImpact();
  }

  /** Update just the result, leaving focus and partially typed values intact.
   * Blank, negative or out-of-range input gets an explanation instead of NaN/0. */
  function updateImpact() {
    const values = valuesForProduct();
    const result = calculateImpact(values);
    const number = panel.querySelector('[data-impact-result]');
    if (!number) return;
    number.textContent = result ? `${new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 }).format(result.kgCO2e)} kg CO₂e` : '—';
    panel.querySelector('[data-impact-energy]').textContent = result ? `${new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 }).format(result.kwh)} kWh over ${values.days} days` : 'Enter valid values to estimate';
    panel.querySelector('[data-impact-error]').textContent = result ? '' : 'Use 0–10,000 W, 0–1,440 minutes per day, 0–366 days and a factor from 0–5.';
    panel.querySelector('.explore-energy-line').style.setProperty('--energy-fill', `${Math.min(100, (result?.kgCO2e || 0) / 100 * 100)}%`);
  }

  /** Carry the same appliance into the adult pathway so learning has a useful
   * next step. No location or personal appliance identifier is stored here. */
  function renderActionLinks() {
    host.querySelector('.explore-action-links').innerHTML = `<a href="#action?kind=recall&appliance=${encodeURIComponent(appliance.category)}"><span>01</span>Check a recall <b aria-hidden="true">↗</b></a><a href="#action?kind=repair&appliance=${encodeURIComponent(appliance.category)}"><span>02</span>Find repair help <b aria-hidden="true">↗</b></a><a href="#action?kind=recycle&appliance=${encodeURIComponent(appliance.category)}"><span>03</span>Find a recycling route <b aria-hidden="true">↗</b></a>`;
  }

  /** The 3D engine calls this after a room object is selected; the product strip
   * calls it too. Camera and textual context stay attached to one object. */
  function chooseAppliance(id, fromWorld = false) {
    if (disposed) return;
    appliance = findAppliance(id);
    selectedPart = appliance.parts[0].id;
    challengeAnswered = false;
    expanded = false;
    showingRoom = false;
    if (!fromWorld) world?.setAppliance(appliance.id);
    world?.setExploded(false);
    world?.setSelectedPart(selectedPart);
    host.querySelector('#appliance-title').textContent = appliance.name;
    host.querySelector('.explore-device-summary').textContent = appliance.summary;
    host.querySelector('.explore-room-label').textContent = `${appliance.room} / ${appliance.name}`;
    host.querySelector('.explore-family-question').textContent = appliance.question;
    host.querySelector('.explore-help-link').href = `#action?kind=repair&appliance=${encodeURIComponent(appliance.category)}`;
    canvas.setAttribute('aria-label', `3D ${appliance.name}. Drag to rotate, pinch to zoom. Parts can also be selected in the adjacent panel.`);
    host.querySelectorAll('[data-product]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.product === appliance.id)));
    host.querySelector('[data-product-picker]').value = appliance.id;
    host.querySelector('[data-world="explode"]').setAttribute('aria-pressed', 'false');
    updateViewControls();
    renderPanel();
    renderActionLinks();
    playSound('tap');
  }

  /** Object selection is feedback, not a quiz. We show a clear highlighted part,
   * tick the visited part and leave the explanation still while it is read. */
  function choosePart(id, fromWorld = false) {
    if (disposed) return;
    if (!appliance.parts.some(part => part.id === id)) return;
    if (showingRoom) {
      // A keyboard user can choose a part without first finding its room object.
      world?.setAppliance(appliance.id);
      showingRoom = false;
      updateViewControls();
    }
    selectedPart = id;
    viewedParts.add(`${appliance.id}:${id}`);
    if (!fromWorld) world?.setSelectedPart(id);
    activeTab = 'parts';
    renderPanel();
    host.querySelector('.explore-start-hint').classList.add('is-dismissed');
    playSound('tap');
  }

  /** Device support comes from the real WebXR feature query, not user-agent
   * guesses. Unsupported devices keep the complete 3D/learning experience. */
  function handleWorldStatus(status) {
    if (disposed) return;
    const message = typeof status === 'string' ? status : status.message;
    const type = status.type;
    if (type?.startsWith('ar-')) {
      host.querySelector('#ar-support-status').textContent = message || '';
      if (type === 'ar-searching' || type === 'ar-placed') playSound('tap');
      if (type === 'ar-ended') { showingRoom = false; updateViewControls(); }
      // Unsupported AR is a device capability note beside the AR button, not
      // a technical error pasted over the otherwise fully working 3D model.
      return;
    }
    host.querySelector('.explore-world-status').textContent = message || '';
    if (type === 'ready') stage.classList.add('is-ready');
    if (type === 'room-overview') { showingRoom = true; updateViewControls(); }
    if (type === 'error') stage.classList.add('has-error');
  }

  /** Delegate all actions through one listener so route disposal can remove
   * everything at once. No anonymous listeners survive a route change. */
  host.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button || !host.contains(button)) return;
    if (button.dataset.product) return chooseAppliance(button.dataset.product);
    if (button.dataset.part) return choosePart(button.dataset.part);
    if (button.dataset.tab) { activeTab = button.dataset.tab; renderPanel(); playSound('tap'); return; }
    if (button.hasAttribute('data-answer')) {
      const correct = Number(button.dataset.answer) === appliance.challenge.correct;
      const feedback = host.querySelector('.explore-answer-feedback');
      feedback.textContent = `${correct ? '✓ Good connection. ' : 'Try another choice. '}${appliance.challenge.explanation}`;
      feedback.classList.toggle('is-correct', correct);
      playSound(correct ? 'correct' : 'wrong');
      if (correct && !challengeAnswered) {
        challengeAnswered = true;
        host.querySelectorAll('[data-answer]').forEach(item => { item.disabled = true; });
        onLearn({ id: `world-${appliance.id}`, title: `${appliance.name}: one useful connection`, detail: appliance.challenge.explanation, appliance: appliance.category, pathway: 'repair' });
        onAward(`world-${appliance.id}`, 10, button);
      }
      return;
    }
    const action = button.dataset.world;
    if (!action) return;
    if (!world) { handleWorldStatus({ type: 'loading', message: 'The 3D view is still loading. You can explore the parts and care panel now.' }); return; }
    if (action === 'room') {
      showingRoom = true;
      world.setExploded(false);
      expanded = false;
      world.showRoom?.();
      host.querySelector('[data-world="explode"]').setAttribute('aria-pressed', String(expanded));
      updateViewControls();
    }
    if (action === 'explode') {
      showingRoom = false;
      updateViewControls();
      expanded = !expanded;
      world.setAppliance(appliance.id);
      world.setExploded(expanded);
      button.setAttribute('aria-pressed', String(expanded));
    }
    if (action === 'rotate') { rotating = !rotating; world.setRotation(rotating); button.setAttribute('aria-pressed', String(rotating)); }
    if (action === 'reset') { showingRoom = false; world.resetView(); updateViewControls(); }
    if (action === 'ar') {
      if (!world.isARSupported) {
        host.querySelector('#ar-support-status').textContent = 'Camera AR needs a browser and device that support WebXR immersive AR, with camera permission. On this device, explore by dragging the 3D model.';
        return;
      }
      showingRoom = false;
      expanded = false;
      world.setAppliance(appliance.id);
      host.querySelector('[data-world="explode"]').setAttribute('aria-pressed', 'false');
      updateViewControls();
      try { await world.enterAR(); }
      catch { handleWorldStatus({ type: 'ar-unavailable', message: 'AR did not start. Check camera permission and device support. The 3D world is still available.' }); }
    }
    if (action !== 'ar') playSound('tap');
  }, { signal: controller.signal });

  /** The prominent selector reaches all eight products without scrolling to
   * the catalogue cards. Both navigation methods share the same state handler. */
  host.querySelector('[data-product-picker]').addEventListener('change', event => {
    chooseAppliance(event.target.value);
  }, { signal: controller.signal });

  /** Accessible tab pattern: arrow keys move and activate tabs, while all part
   * selection and viewport tools remain normal keyboard-operable buttons. */
  host.querySelector('.explore-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...host.querySelectorAll('[data-tab]')];
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    activeTab = tabs[next].dataset.tab;
    renderPanel();
    tabs[next].focus();
  }, { signal: controller.signal });

  /** Input edits recalculate immediately without submitting a form or losing
   * focus. Choosing a grid resets its factor; changing factor marks it custom. */
  panel.addEventListener('input', event => {
    const input = event.target;
    if (!input.name || activeTab !== 'impact') return;
    const values = valuesForProduct();
    if (input.name === 'region') {
      values.region = input.value;
      if (GRID_FACTORS[input.value]) {
        values.factor = GRID_FACTORS[input.value].factor;
        panel.querySelector('[name="factor"]').value = values.factor;
      }
    } else {
      values[input.name] = input.value;
      if (input.name === 'factor') { values.region = 'custom'; panel.querySelector('[name="region"]').value = 'custom'; }
    }
    updateImpact();
  }, { signal: controller.signal });
  panel.addEventListener('submit', event => event.preventDefault(), { signal: controller.signal });

  renderPanel();
  renderActionLinks();

  /** Lazy-load WebGL only on this route. Failure leaves all accessible learning,
   * care, carbon calculation and adult links working with an honest message. */
  try {
    const createWorld = options.worldFactory || (await import('./world-engine.js')).createWorld;
    if (disposed) return cleanup;
    world = await createWorld(canvas, {
      mode: 'explore', appliance: appliance.id,
      onSelectAppliance: id => chooseAppliance(id, true),
      onSelectPart: ({ applianceId, partId }) => { if (appliance.id !== applianceId) chooseAppliance(applianceId, true); choosePart(partId, true); },
      onStatus: handleWorldStatus,
    });
    if (disposed) { cleanup(); return cleanup; }
    // A visitor may choose another catalogue item while WebXR support is being
    // checked. Synchronise the finished renderer with the latest visible choice.
    world.setAppliance(appliance.id);
    world.setSelectedPart?.(selectedPart);
    stage.classList.add('is-ready');
    host.querySelector('#ar-support-status').textContent = world.isARSupported ? 'AR is available. Choose “View in my room” to start with your permission.' : 'Camera AR is not available on this browser. The interactive 3D world works here.';
  } catch {
    if (disposed) return cleanup;
    handleWorldStatus({ type: 'error', message: 'This browser could not start the 3D view. Try a WebGL-capable browser. Parts, care and impact are available beside it.' });
    host.querySelector('#ar-support-status').textContent = 'AR is unavailable because this browser could not start the 3D renderer.';
  }

  /** Release GPU resources, animation frames and every DOM listener when the
   * shared shell navigates away. Revisiting Explore starts one fresh scene. */
  return cleanup;
}
