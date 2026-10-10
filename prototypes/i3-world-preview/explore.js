import { CATALOGUE, GRID_FACTORS, SOURCES, findAppliance, calculateImpact } from './catalogue.js';
import { EXPLORE_ACTIVE_ITEMS } from '../../src/explore-catalogue.js';
import { mountExplorePhotoHelper } from '../../src/explore-photo-helper.js';

/** Only catalogue text and numeric values enter our templates. This helper also
 * escapes anything coming from a route, so URL text never becomes HTML. */
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

/** Keep finger targets apart in screen space, while preserving their true 3D
 * anchors for connector lines. A nearest-first ring search favours short lines.
 * This does not move model geometry or pretend the label is the part itself. */
export function layoutHotspots(points, width, height, gap = 48) {
  const padding = 25;
  const minY = Math.min(58, height / 4);
  const maxY = Math.max(minY, height - Math.min(95, height / 4));
  const placed = [];
  for (const point of points) {
    if (!point.visible || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) continue;
    const anchorX = point.x * width, anchorY = point.y * height;
    const clamp = (x, y) => ({ x: Math.max(padding, Math.min(width - padding, x)), y: Math.max(minY, Math.min(maxY, y)) });
    let candidate = clamp(anchorX, anchorY);
    const clear = value => placed.every(other => Math.hypot(value.x - other.pixelX, value.y - other.pixelY) >= gap);
    if (!clear(candidate)) {
      let found = false;
      for (let radius = gap / 2; radius <= Math.max(width, height) && !found; radius += gap / 2) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          const next = clamp(anchorX + Math.cos(angle) * radius, anchorY + Math.sin(angle) * radius);
          if (clear(next)) { candidate = next; found = true; break; }
        }
      }
    }
    placed.push({ ...point, anchorX, anchorY, pixelX: candidate.x, pixelY: candidate.y, x: candidate.x / width, y: candidate.y / height });
  }
  return placed;
}

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
    ricecooker: '<path d="M11 24h42v23a7 7 0 0 1-7 7H18a7 7 0 0 1-7-7V24Zm0 0c0-15 42-15 42 0M25 12V8h13v4M7 30H3v12h8m42-12h8v12h-8M20 57v3m24-3v3"/><rect x="24" y="35" width="15" height="10" rx="3"/>',
    airfryer: '<rect x="12" y="8" width="40" height="48" rx="12"/><path d="M15 31h34M26 21h12M24 39h16v8H24ZM22 60h21"/>',
    coffeemachine: '<path d="M13 8h35v47H13V8Zm4 20h27M18 50h25M25 30v6m11-6v6M23 39h16v10H23Z"/><path d="M48 13h9v29h-9M24 17h2m10 0h2M9 59h43"/>',
    mixer: '<path d="M17 12h26a8 8 0 0 1 0 16H17V12ZM19 28v26h28M14 54h37v5H14ZM34 28v10m-8 0h20c0 15-20 15-20 0Z"/><circle cx="23" cy="20" r="3"/>',
    smartphone: '<rect x="19" y="5" width="26" height="54" rx="5"/><path d="M27 10h10M28 53h8"/>',
    tablet: '<rect x="11" y="5" width="42" height="54" rx="4"/><path d="M17 12h30v36H17zM29 53h6"/>',
    television: '<rect x="5" y="11" width="54" height="35" rx="3"/><path d="M11 17h42v23H11zM23 46l-5 9M41 46l5 9"/>',
    washing_machine: '<rect x="10" y="5" width="44" height="54" rx="4"/><path d="M10 18h44M17 12h12M43 12h3"/><circle cx="32" cy="37" r="13"/><path d="M21 38c9-7 13 7 22 0"/>',
    // Each navigation drawing leads to its own semantic, interactive 3D model.
    refrigerator: '<rect x="15" y="4" width="34" height="54" rx="3"/><path d="M15 24h34M21 12v7m0 12v13M20 58v3m24-3v3"/>',
    food_processor: '<path d="M11 33h28v20H11zM15 30V15h25v17M14 12h29M29 12V5h8v7M40 17h9v12h-9M39 36l10 17H10"/><circle cx="23" cy="43" r="3"/><path d="M24 21h9m-5-6v14"/>',
    sandwich_press: '<path d="m11 29 6-15h30l7 15H11Zm0 5h43v13H11zM18 51h29M22 20h18M15 29v5m34-5v5M22 40h18"/>',
    portable_heater: '<rect x="11" y="9" width="42" height="45" rx="4"/><path d="M18 17v27m7-27v27m7-27v27m7-27v27m7-27v27M17 54v6m30-6v6"/>',
    portable_ac: '<rect x="12" y="7" width="36" height="49" rx="6"/><path d="M20 16h20m-20 6h20m-20 6h20M21 46h18M48 39h6c7 0 7-16 2-16M19 56v4m22-4v4"/>',
    dehumidifier: '<rect x="14" y="7" width="36" height="50" rx="7"/><path d="M23 14h18M20 23h24m-24 6h24M14 39h36"/><path d="M32 43c-9 10 9 10 0 0Z"/>',
    headphones: '<path d="M10 36V26a22 22 0 0 1 44 0v10M17 30v-4a15 15 0 0 1 30 0v4"/><rect x="7" y="31" width="12" height="23" rx="5"/><rect x="45" y="31" width="12" height="23" rx="5"/>',
    games_console: '<path d="M12 7h22v30H12zM17 13h12m-12 5h12M41 7h11v29H41z"/><path d="M20 39h24c5 0 9 14 6 18-3 4-9-7-13-7H27c-4 0-10 11-13 7-3-4 1-18 6-18Z"/><path d="M21 43v7m-4-3h8m13-3h1m5 3h1"/>',
    printer: '<path d="M17 22V6h30v16M17 45H8V22h48v23h-9M17 36h30v22H17V36ZM23 43h18m-18 7h18"/><circle cx="48" cy="29" r="1"/>',
    steam_cleaner: '<path d="M30 7h13v6H30zM35 13l-7 24m-6-2 15 4-5 13H18l4-17Zm-8 17h25l8 8H8l6-8Z"/><path d="M44 43c-5-5 5-7 0-12m8 16c-5-5 5-7 0-12"/>',
    clothes_dryer: '<rect x="10" y="5" width="44" height="54" rx="4"/><path d="M10 18h44M17 12h12M43 12h3"/><circle cx="32" cy="37" r="13"/><path d="M27 45c-5-5 5-7 0-14m9 14c-5-5 5-7 0-14"/>',
    straightener: '<path d="M15 9h8l14 41-7 3L15 9Zm33 0h-8L29 50l7 3L48 9ZM19 15l7 23m18-23-7 23M32 55v5"/><circle cx="32" cy="52" r="4"/>',
    shaver: '<rect x="18" y="7" width="28" height="17" rx="5"/><path d="M21 24v25a11 11 0 0 0 22 0V24M24 12v7m8-7v7m8-7v7"/><circle cx="32" cy="37" r="3"/>',
    electric_toothbrush: '<rect x="27" y="4" width="10" height="16" rx="3"/><path d="M37 7h5m-5 4h5m-5 4h5M30 20v10m5-10v10"/><rect x="25" y="30" width="15" height="30" rx="6"/><circle cx="32.5" cy="39" r="2"/>',
    cordless_drill: '<path d="M9 12h30l8 7v13H9V12ZM47 19h9v9h-9m9-5h6M22 32l-4 17h16l4-17M14 49h25v10H14V49ZM27 32v6h9"/><path d="M15 18h12m-12 6h12"/>',
    sewing_machine: '<path d="M9 12h36a8 8 0 0 1 8 8v29H12v-8h24V27H21v9H9V12ZM7 49h50v9H7zM13 36v5m20-29V5h7v7"/><circle cx="46" cy="23" r="4"/>',
  };
  return `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths[id] || '<rect x="13" y="13" width="38" height="38" rx="6"/><path d="M25 25a7 7 0 0 1 14 0c0 5-7 5-7 11M32 43v1"/>'}</svg>`;
}

/** The recognition catalogue and current 3D catalogue use different stable IDs.
 * Only this reviewed mapping joins them; an unsupported item must never fall
 * through findAppliance() and silently become its default kettle. */
function exploreItemFor(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[ _-]+/g, '');
  return EXPLORE_ACTIVE_ITEMS.find(item => [item.slug, item.worldId, item.label].filter(Boolean).some(name => String(name).toLowerCase().replace(/[ _-]+/g, '') === key));
}

/** Native groups keep the larger list quick to scan without a custom dropdown.
 * The original catalogue order and identifiers remain unchanged for the model. */
const exploreGroups = [...new Set(EXPLORE_ACTIVE_ITEMS.map(item => item.group))];
function productOptions(selectedValue) {
  return exploreGroups.map(group => `<optgroup label="${escape(group)}">${EXPLORE_ACTIVE_ITEMS.filter(item => item.group === group).map(item => {
    const value = item.worldId || item.slug;
    return `<option value="${value}"${selectedValue === value ? ' selected' : ''}>${escape(item.label)}</option>`;
  }).join('')}</optgroup>`).join('');
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
  const initialItem = exploreItemFor(params.get('appliance'));
  let appliance = findAppliance(initialItem?.worldId || params.get('appliance'));
  let activeTab = ['parts', 'care', 'impact'].includes(params.get('tab')) ? params.get('tab') : 'parts';
  let selectedPart = appliance.parts[0].id;
  let expanded = false;
  let rotating = false;
  let showingRoom = false;
  let disposed = false;
  let world;
  let worldLoading = false;
  let worldDisposed = false;
  let photoHelper;
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
    photoHelper?.dispose();
    options.signal?.removeEventListener('abort', cleanup);
    if (world && !worldDisposed) { worldDisposed = true; world.dispose(); }
  }
  if (options.signal?.aborted) { cleanup(); return cleanup; }
  options.signal?.addEventListener('abort', cleanup, { once: true });

  host.innerHTML = `<section class="explore-page page-width" aria-labelledby="explore-title">
    <header class="explore-heading"><div><p class="eyebrow">FF LENS / EXPLORE TO UNDERSTAND</p><h1 id="explore-title">Every object has more to it.</h1><p>Choose from ${EXPLORE_ACTIVE_ITEMS.length} familiar items. Explore ${CATALOGUE.length} of them in 3D to discover parts, care and everyday energy use.</p></div><div class="explore-heading-actions"><label class="explore-product-picker">Choose an item <span>${EXPLORE_ACTIVE_ITEMS.length} items · ${CATALOGUE.length} available in 3D</span><select data-product-picker>${productOptions(appliance.id)}</select></label><a class="explore-help-link" href="#action?kind=repair&appliance=${encodeURIComponent(appliance.category)}">Have a faulty appliance? <span aria-hidden="true">↗</span></a></div></header>
    <div class="explore-photo-slot" data-explore-photo-helper></div>
    <div class="explore-workspace">
      <div class="explore-stage-column">
        <div class="explore-stage" aria-label="Interactive appliance world">
          <div class="explore-stage-top"><span class="explore-stage-badge">LIVE 3D WORLD</span><span class="explore-room-label">${escape(appliance.room)} / ${escape(appliance.name)}</span></div>
          <canvas class="explore-canvas" aria-label="3D ${escape(appliance.name)}. Drag to rotate, pinch to zoom. Parts can also be selected in the adjacent panel." tabindex="0"></canvas>
          <div class="explore-hotspots" aria-label="Parts on the 3D model"></div>
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
        <div class="explore-appliance-heading"><p class="eyebrow">MEET YOUR EVERYDAY</p><h2 id="appliance-title" tabindex="-1">${escape(appliance.name)}</h2><p class="explore-device-summary">${escape(appliance.summary)}</p></div>
        <div class="explore-tabs" role="tablist" aria-label="Explore this appliance">${['parts', 'care', 'impact'].map(tab => `<button type="button" role="tab" id="tab-${tab}" data-tab="${tab}" aria-selected="${tab === activeTab}" aria-controls="explore-panel" tabindex="${tab === activeTab ? 0 : -1}">${{ parts: 'Parts', care: 'Care', impact: 'CO₂e impact' }[tab]}</button>`).join('')}</div>
        <div id="explore-panel" class="explore-panel" role="tabpanel" aria-labelledby="tab-${activeTab}" tabindex="0"></div>
      </aside>
    </div>
    <section class="explore-catalogue" aria-labelledby="catalogue-title"><div class="explore-section-heading"><h2 id="catalogue-title">Pick something familiar.</h2><span>Choose directly. No photo needed.</span></div><div class="explore-catalogue-tools"><label>Show items <select data-product-group aria-controls="explore-product-cards"><option value="all">All groups</option>${exploreGroups.map(group => `<option value="${escape(group)}">${escape(group)}</option>`).join('')}</select></label><p data-product-count role="status">${EXPLORE_ACTIVE_ITEMS.length} items</p></div><div class="explore-product-list" id="explore-product-cards">${EXPLORE_ACTIVE_ITEMS.map(item => { const model = CATALOGUE.find(product => product.id === item.worldId); const value = item.worldId || item.slug; return `<button type="button" class="explore-product" data-product="${value}" data-product-group-name="${escape(item.group)}" aria-pressed="${value === (appliance.id)}" style="--product-colour:${model?.colour || '#507769'}"><span class="explore-product-art">${productIcon(value)}</span><span>${escape(item.label)}</span><small>${escape(model.room)}</small></button>`; }).join('')}</div></section>
    <section class="explore-to-action" aria-labelledby="explore-action-title"><div><p class="eyebrow">FROM UNDERSTANDING TO DOING</p><h2 id="explore-action-title">Make your next step a good one.</h2><p>A question for the family: <strong class="explore-family-question">${escape(appliance.question)}</strong></p></div><div class="explore-action-links"></div></section>
  </section>`;

  const panel = host.querySelector('#explore-panel');
  const canvas = host.querySelector('canvas');
  const stage = host.querySelector('.explore-stage');
  const groupPicker = host.querySelector('[data-product-group]');
  /** Filtering only hides cards; it never changes a lesson or starts recognition.
   * Native selects and hidden buttons keep keyboard and touch behaviour simple. */
  function filterProducts() {
    let visible = 0;
    host.querySelectorAll('[data-product]').forEach(button => {
      button.hidden = groupPicker.value !== 'all' && button.dataset.productGroupName !== groupPicker.value;
      if (!button.hidden) visible++;
    });
    host.querySelector('[data-product-count]').textContent = `${visible} items${groupPicker.value === 'all' ? '' : ` · ${groupPicker.value}`}`;
  }
  groupPicker.addEventListener('change', filterProducts, { signal: controller.signal });
  // Photo results never invoke this callback until the visitor confirms. Manual
  // selection stays available even if availability checks or model loading fail.
  photoHelper = mountExplorePhotoHelper(host.querySelector('[data-explore-photo-helper]'), {
    ...options.photoHelperOptions,
    signal: controller.signal,
    onConfirm: item => {
      chooseAppliance(item.slug, false, true);
      // Confirmation removes its own button; give keyboard users a named focus
      // target and bring the chosen lesson into view without animated scrolling.
      host.querySelector('#appliance-title').focus({ preventScroll: true });
      host.querySelector('.explore-workspace').scrollIntoView?.({ block: 'start', behavior: 'auto' });
    },
    onManual: () => host.querySelector('[data-product-picker]').focus(),
  });

  /** Numbered targets sit on the real projected 3D part positions. They use the
   * same part IDs and click handler as the text list, making tapping discoverable. */
  function renderHotspots() {
    const layer = host.querySelector('.explore-hotspots');
    // Selecting the same appliance should preserve current projections. The
    // renderer only emits changed coordinates, so replacing these would hide them.
    if (layer.dataset.appliance === appliance.id) return;
    layer.dataset.appliance = appliance.id;
    layer.innerHTML = `<svg class="explore-hotspot-connectors" aria-hidden="true"><path fill="none"/></svg>` + appliance.parts.map((part, index) => `<button type="button" data-part="${part.id}" aria-label="Part ${index + 1}: ${escape(part.name)}" aria-pressed="${selectedPart === part.id}" hidden><span>${index + 1}</span></button>`).join('');
  }

  /** Three.js projects each part into normalized canvas coordinates. Updating
   * positions never redraws the canvas or replaces a currently focused button.
   * Empty projections hide targets for the room overview and real camera AR. */
  function placeHotspots(projections = []) {
    if (disposed) return;
    const width = canvas.clientWidth || 640, height = canvas.clientHeight || 480;
    const positions = layoutHotspots(projections, width, height);
    const points = new Map(positions.map(point => [point.partId, point]));
    const connectors = host.querySelector('.explore-hotspot-connectors');
    connectors.setAttribute('viewBox', `0 0 ${width} ${height}`);
    connectors.querySelector('path').setAttribute('d', positions.filter(point => Math.hypot(point.anchorX - point.pixelX, point.anchorY - point.pixelY) > 3).map(point => `M${point.anchorX},${point.anchorY}L${point.pixelX},${point.pixelY}`).join(' '));
    host.querySelectorAll('.explore-hotspots [data-part]').forEach(button => {
      const point = points.get(button.dataset.part);
      const visible = point?.visible && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
      button.hidden = !visible;
      if (visible) { button.style.left = `${point.x * 100}%`; button.style.top = `${point.y * 100}%`; }
      button.setAttribute('aria-pressed', String(button.dataset.part === selectedPart));
    });
  }

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
    host.querySelectorAll('.explore-hotspots [data-part]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.part === selectedPart)));
  }

  /** Mesh IDs are the shared key: a real mesh hit and these keyboard/touch
   * buttons open the same part. The current explanation is always visible. */
  function renderParts() {
    const part = appliance.parts.find(item => item.id === selectedPart) || appliance.parts[0];
    panel.innerHTML = `<p class="explore-panel-intro">Choose a part on the model or below.</p><div class="explore-part-list" aria-label="Parts of the ${escape(appliance.name)}">${appliance.parts.map((item, index) => `<button type="button" data-part="${item.id}" aria-pressed="${item.id === selectedPart}"><span>${String(index + 1).padStart(2, '0')}</span>${escape(item.name)}${viewedParts.has(`${appliance.id}:${item.id}`) ? '<i aria-label="Explored">✓</i>' : ''}</button>`).join('')}</div><div class="explore-part-detail" role="status"><p class="eyebrow">${escape(part.name)}</p><h3>${escape(part.job)}</h3><p>${escape(part.material)}</p>${part.impact || part.care ? `<dl class="explore-part-context">${part.impact ? `<div><dt>Our planet</dt><dd>${escape(part.impact)}</dd></div>` : ''}${part.care ? `<div><dt>Care connection</dt><dd>${escape(part.care)}</dd></div>` : ''}</dl>` : ''}</div><p class="explore-model-note">A simplified learning model, not your exact appliance. Explore inside here; keep real electrical enclosures closed.</p><details class="explore-question"${challengeAnswered ? ' open' : ''}><summary>Make a connection <span aria-hidden="true">+</span></summary><p>${escape(appliance.challenge.question)}</p><div class="explore-answers">${appliance.challenge.choices.map((choice, index) => `<button type="button" data-answer="${index}"${challengeAnswered ? ' disabled' : ''}>${escape(choice)}</button>`).join('')}</div><p class="explore-answer-feedback" role="status">${challengeAnswered ? `✓ ${escape(appliance.challenge.explanation)}` : ''}</p></details>`;
  }

  /** Maintenance is practical adult-led care, never an instruction to take
   * apart real electronics. The child contribution is observation and discussion. */
  function renderCare() {
    panel.innerHTML = `<p class="explore-panel-intro">Look after what you own. Start with your model’s manual.</p><ol class="explore-care-list">${appliance.care.map(([title, detail], index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><div><h3>${escape(title)}</h3><p>${escape(detail)}</p></div></li>`).join('')}</ol><div class="explore-care-boundary"><strong>For adults. Children explore the digital model.</strong><p>If there is damage, smoke, sparks or a burning smell, stop using the appliance and get appropriate help.</p></div><a class="explore-source-link" href="${SOURCES.safety}" target="_blank" rel="noopener noreferrer">Electrical safety guidance · Energy Safe Victoria ↗</a><a class="explore-care-next" href="#action?kind=repair&appliance=${encodeURIComponent(appliance.category)}">Something isn’t working? Find a next step →</a>`;
    if (appliance.careSource) {
      // These examples explain why model-specific instructions matter. They do
      // not pretend our generic geometry is that manufacturer's exact product.
      const reference = host.ownerDocument.createElement('p');
      reference.className = 'explore-care-reference';
      reference.innerHTML = `<a class="explore-source-link" href="${escape(appliance.careSource.url)}" target="_blank" rel="noopener noreferrer">${escape(appliance.careSource.label)} ↗</a><small>Use the instructions for your exact model.</small>`;
      panel.querySelector('.explore-care-next').before(reference);
    }
  }

  /** The impact form exposes every assumption. Its example can teach both
   * audiences without claiming that a generic 3D object has a measured footprint. */
  function renderImpact() {
    const values = valuesForProduct();
    // Charging and continuously cycling appliances must not imply power is constant while used.
    const powerLabel = appliance.energyMode === 'continuous-average' ? 'Average power' : appliance.energyMode === 'charging' ? 'Charging power' : 'Power';
    const timeLabel = appliance.energyMode === 'continuous-average' ? 'Daily plugged-in time' : appliance.energyMode === 'charging' ? 'Daily charging time' : 'Daily active time';
    panel.innerHTML = `<p class="explore-panel-intro">See how electricity use adds up.</p><div class="explore-impact-result" aria-live="polite"><span>ESTIMATED ELECTRICITY EMISSIONS</span><strong data-impact-result></strong><small data-impact-energy></small><div class="explore-energy-line" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><p class="explore-example-label">Editable example, not a measurement of your ${escape(appliance.name.toLowerCase())}.</p><form class="explore-impact-form" novalidate><div class="explore-input-grid"><label>${powerLabel} <span>watts (W)</span><input name="watts" type="number" min="0" max="10000" step="1" inputmode="decimal" value="${escape(values.watts)}"></label><label>${timeLabel} <span>minutes</span><input name="minutes" type="number" min="0" max="1440" step="0.1" inputmode="decimal" value="${escape(values.minutes)}"></label><label>For how long? <span>days</span><input name="days" type="number" min="0" max="366" step="1" inputmode="numeric" value="${escape(values.days)}"></label><label>Electricity grid <select name="region">${Object.entries(GRID_FACTORS).map(([id, info]) => `<option value="${id}"${id === values.region ? ' selected' : ''}>${info.label}</option>`).join('')}<option value="custom"${values.region === 'custom' ? ' selected' : ''}>Custom factor</option></select></label></div><details class="explore-calculation-details"><summary>Assumptions & calculation</summary><label>Grid factor <span>kg CO₂e per kWh</span><input name="factor" type="number" min="0" max="5" step="0.01" inputmode="decimal" value="${escape(values.factor)}"></label><p>Watts ÷ 1,000 × minutes ÷ 60 × days = kWh.<br>kWh × grid factor = kg CO₂e.</p><p>Default: DCCEEW 2026, Table 1, scope 2. Editing the factor makes this a custom scenario.</p><a class="explore-source-link" href="${SOURCES.grid}" target="_blank" rel="noopener noreferrer">Read the source · Australian Government ↗</a></details><p data-impact-error class="explore-impact-error" role="status"></p></form><div class="explore-impact-tip"><span aria-hidden="true">↗</span><p>${escape(appliance.energyTip)}</p></div><p class="explore-impact-limits"><strong>One part of the picture.</strong> CO₂e combines greenhouse gases into a common measure. This estimates grid electricity generation only. It excludes making, transporting and disposing of the appliance, upstream fuel and network losses. Actual use varies; no saving is claimed.</p><a class="explore-source-link" href="${SOURCES.energy}" target="_blank" rel="noopener noreferrer">Explore household energy habits ↗</a>`;
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
  function chooseAppliance(id, fromWorld = false, fromPhoto = false) {
    if (disposed) return;
    const item = exploreItemFor(id);
    if (!item) return;
    // A photo or the top picker can choose an item outside the current card
    // group. Reveal its selected card rather than leaving it hidden by a filter.
    if (groupPicker.value !== 'all' && groupPicker.value !== item.group) {
      groupPicker.value = 'all';
      filterProducts();
    }
    if (!fromPhoto) photoHelper?.cancel({ message: 'Manual choice selected. You can check a photo whenever you like.' });
    appliance = findAppliance(item.worldId);
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
    renderHotspots();
    renderPanel();
    renderActionLinks();
    playSound('tap');
    if (!world && !worldLoading) void startWorld();
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

  /** The prominent selector reaches the complete catalogue without scrolling to
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

  renderHotspots();
  renderPanel();
  renderActionLinks();

  /** Lazy-load WebGL only on this route. Failure leaves all accessible learning,
   * care, carbon calculation and adult links working with an honest message. */
  async function startWorld() {
    if (disposed || world || worldLoading) return;
    worldLoading = true;
    try {
    const createWorld = options.worldFactory || (await import('./world-engine.js')).createWorld;
    if (disposed) return cleanup;
    world = await createWorld(canvas, {
      mode: 'explore', appliance: appliance.id,
      onSelectAppliance: id => chooseAppliance(id, true),
      onSelectPart: ({ applianceId, partId }) => { if (appliance.id !== applianceId) chooseAppliance(applianceId, true); choosePart(partId, true); },
      onPartProjection: placeHotspots,
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
  } finally {
    worldLoading = false;
  }
  }
  // Every catalogue route has geometry; the same lazy engine serves all 32.
  await startWorld();

  /** Release GPU resources, animation frames and every DOM listener when the
   * shared shell navigates away. Revisiting Explore starts one fresh scene. */
  return cleanup;
}
