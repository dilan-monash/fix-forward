import { EXPLORE_ITEMS32 } from './support/explore-catalogue.js';
import { productIcon } from './explore-icons.js';
import { explorePhotoValidation, readExplorePhotoPreview } from './support/explore-photo-helper.js';
import { classifyExplorePhoto, exploreClassifierAvailability, friendlyExploreError, releaseExploreModelSession } from './support/explore-classifier.js';
import { validateSiglipPhotoContent } from './support/siglip-appliance-classifier.js?v=i3-photo-review-v4';
import { revealResult } from './result-reveal.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const cameraIcon = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M6 14h9l4-6h10l4 6h9v26H6z"/><circle cx="24" cy="26" r="9"/><path d="M36 19h1"/></svg>';
const arrow = '<span aria-hidden="true">↗</span>';

/** Routes resolve only to reviewed catalogue entries; unknown URLs cannot open
 * a different device through the legacy renderer’s default selection. */
export function resolveExploreRoute(route) {
  const params = route?.params instanceof URLSearchParams ? route.params
    : route?.searchParams instanceof URLSearchParams ? route.searchParams
      : route instanceof URLSearchParams ? route : new URLSearchParams(String(route || '').split('?')[1] || '');
  const id = params.get('appliance');
  const item = EXPLORE_ITEMS32.find(entry => entry.slug === id || entry.worldId === id) || null;
  return { item, invalid: Boolean(id && !item), mode: params.get('view') === 'world' ? 'world'
    : item ? (params.get('confirmed') === '1' ? 'detail' : 'confirm')
      : ['manual', 'photo'].includes(params.get('mode')) ? params.get('mode') : 'start', tab: params.get('tab') };
}

export function filterExploreItems(query = '', group = '') {
  const words = String(query).trim().toLowerCase().replace(/[_-]/g, ' ').split(/\s+/).filter(Boolean);
  return EXPLORE_ITEMS32.filter(item => (!group || item.group === group) && words.every(word => `${item.label} ${item.slug.replaceAll('_', ' ')} ${item.group}`.toLowerCase().includes(word)));
}

/** A permission error is an ordinary alternate path, never a request to change
 * browser settings or an excuse to pretend a camera frame was captured. */
export function cameraMessage(error) {
  if (['NotAllowedError', 'SecurityError'].includes(error?.name)) return 'Camera access was not allowed. You can upload a photo or choose a device instead.';
  if (error?.name === 'NotFoundError') return 'No camera was found. Upload a photo or choose a device instead.';
  if (error?.name === 'NotReadableError') return 'The camera is busy. Close the other camera app, or upload a photo instead.';
  return 'This browser could not start the camera. Use your camera app, upload a photo or choose a device instead.';
}

function roomArt() {
  return '<svg viewBox="0 0 280 150" fill="none" aria-hidden="true"><path d="m22 94 116-65 118 62-115 50Z" fill="#c6e9cc"/><path d="M22 94V37l116-25v17Z" fill="#e8f4e9"/><path d="M138 12v17l118 62V39Z" fill="#d5e9f6"/><path d="m71 77 48-26 52 27-48 27Z" fill="#d7ad7b"/><path d="M71 77v12l52 28v-12Zm100 1v12l-48 27v-12Z" fill="#b88b5b"/><path d="m86 62 5-30 29 8-4 29Z" fill="#4463d5"/><path d="m90 57 4-20 21 6-3 20Z" fill="#c3e6e9"/><path d="m134 64 2-15 16 7 2 18Z" fill="#fff7df"/><path d="m152 59 5 2v9l-4-1" stroke="#123b36" stroke-width="3"/><path d="m205 91 0-24" stroke="#628665" stroke-width="5"/><path d="M205 76c-23 0-17-19-4-12 0-20 18-18 13-4 17-1 16 17-9 16Z" fill="#87ba75"/><path d="m194 89 23 3-5 19-14-2Z" fill="#d8a582"/><path d="M62 53V30l24-6v16Z" fill="#fff"/><path d="m158 39 24 10v-15l-24-8Z" fill="#bde876"/></svg>';
}

function stepHeader(title, intro, step = '', back = 'start') {
  return `<header class="fgx-heading"><button class="fgx-back" type="button" data-explore-back="${back}"><span aria-hidden="true">←</span> Back to ${back === 'manual' ? 'devices' : 'Explore'}</button>${step ? `<p class="fgx-eyebrow">${step}</p>` : ''}<h1 tabindex="-1">${title}</h1><p>${intro}</p></header>`;
}

/** The outer screen mounts synchronously. Camera, photo checks and WebGL each
 * have a lifetime token so a late response cannot reopen a screen after Back. */
export function mountExplore(host, options = {}) {
  const view = host.ownerDocument.defaultView;
  const lifecycle = new view.AbortController();
  const route = resolveExploreRoute(options.route || view.location.hash);
  const services = { classify: classifyExplorePhoto, availability: exploreClassifierAvailability,
    validateContent: validateSiglipPhotoContent, errorMessage: friendlyExploreError,
    readPreview: (file, settings) => readExplorePhotoPreview(file, { ...settings, Reader: view.FileReader }),
    releaseModel: releaseExploreModelSession, ...options.photoServices };
  const media = options.mediaDevices || view.navigator.mediaDevices;
  let disposed = false, screen = route.mode, screenId = 0, requestId = 0, cameraId = 0;
  let stream, file, preview = '', selected = route.item, lastMode = 'manual', request, childCleanup, childAbort;
  let available = false, busy = false, photoReady = false, checkingAvailability = false;
  const navigate = path => {
    // Internal Back/choice screens can live under an existing detail URL. A
    // second confirmation of that same device still needs to reopen its lesson,
    // because browsers do not emit hashchange for an unchanged hash.
    if (String(path).replace(/^#\/?/, '') === view.location.hash.replace(/^#\/?/, '')) {
      const next = resolveExploreRoute(path); selected = next.item; show(next.mode); return;
    }
    stopWork(); if (options.onNavigate) options.onNavigate(path); else view.location.hash = path;
  };
  const listen = (node, type, fn) => node?.addEventListener(type, fn, { signal: lifecycle.signal });

  function stopCamera() {
    cameraId++;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    const video = host.querySelector('[data-photo-video]');
    if (video) video.srcObject = null;
  }
  function stopWork() {
    requestId++; request?.abort(); request = null; busy = false;
    stopCamera(); childAbort?.abort(); childAbort = null; childCleanup?.(); childCleanup = null;
  }
  function releasePhoto() { file = null; preview = ''; photoReady = false; Promise.resolve(services.releaseModel()).catch(() => {}); }
  function cleanup() {
    if (disposed) return;
    disposed = true; screenId++; stopWork(); releasePhoto(); lifecycle.abort();
    options.signal?.removeEventListener('abort', cleanup);
  }
  if (options.signal?.aborted) { cleanup(); return cleanup; }
  options.signal?.addEventListener('abort', cleanup, { once: true });

  function focusHeading() { host.querySelector('.fgx-heading h1')?.focus(); }
  function status(message) { const node = host.querySelector('[data-photo-status]'); if (node) node.textContent = message; }
  function controls() {
    const check = host.querySelector('[data-photo-check]');
    if (!check) return;
    check.disabled = !available || !photoReady || busy;
    host.querySelector('[data-photo-stop]').hidden = !busy;
    host.querySelector('[data-photo-clear]').hidden = !file;
    host.querySelector('[data-photo-progress]').hidden = !busy;
    host.querySelector('[data-photo-results]').setAttribute('aria-busy', String(busy));
    host.querySelector('[data-photo-camera]').disabled = busy;
  }

  function renderStart() {
    host.innerHTML = `<section class="fg-explore fgx-start"><header class="fgx-heading"><p class="fgx-eyebrow">EXPLORE / EVERYDAY DISCOVERIES</p><h1 tabindex="-1">A familiar device.<br><em>A whole new discovery.</em></h1><p>Pick something you use every day. Look around it in 3D, meet its parts and discover how to care for it.</p></header>${route.invalid ? '<p class="fgx-notice" role="status">That device is not in our collection. Choose one below to get started.</p>' : ''}<div class="fgx-entry-grid"><button type="button" class="fgx-entry fgx-entry-photo" data-explore-mode="photo"><span class="fgx-entry-art fgx-camera-art">${cameraIcon}<span class="fgx-mini-device">${productIcon('kettle')}</span><span class="fgx-scan-corner"></span></span><span class="fgx-card-index">01 / SHOW US</span><strong>Use a photo</strong><span>Take or upload a picture.<br>Confirm a suggested device together.</span><span class="fgx-card-link">Try a photo ${arrow}</span></button><button type="button" class="fgx-entry fgx-entry-manual" data-explore-mode="manual"><span class="fgx-entry-art fgx-device-art"><span>${productIcon('laptop')}</span><span>${productIcon('fan')}</span><span>${productIcon('toaster')}</span></span><span class="fgx-card-index">02 / PICK ONE</span><strong>Choose a device</strong><span>Find a familiar favourite from<br>our 32-device collection.</span><span class="fgx-card-link">See the devices ${arrow}</span></button></div><button class="fgx-world-card" data-explore-world type="button"><span class="fgx-world-art">${roomArt()}</span><span><span class="fgx-eyebrow">WONDER WHAT'S IN THE ROOM?</span><strong>Explore the 3D world</strong><span>Rotate the room. Tap a device. Follow your curiosity.</span></span>${arrow}</button><p class="fgx-together-note">Made for curious children and their grown-ups. Real devices stay whole — the exploring happens on screen.</p></section>`;
  }

  function renderManual() {
    host.innerHTML = `<section class="fg-explore">${stepHeader('What will you discover?', 'Choose a device to explore its parts, care and everyday energy use.', 'STEP 1 / CHOOSE A DEVICE')}<div class="fgx-searchbar"><label class="fgx-search"><span>Find a device</span><input type="search" data-device-search placeholder="Try kettle, headphones or hair dryer" autocomplete="off"/></label><label class="fgx-group"><span>Room or activity</span><select data-device-group><option value="">All devices</option>${[...new Set(EXPLORE_ITEMS32.map(item => item.group))].map(group => `<option>${escape(group)}</option>`).join('')}</select></label></div><p class="fgx-count" data-device-count role="status" aria-live="polite"></p><div class="fgx-device-grid" data-device-grid></div><button type="button" class="fgx-text-link" data-explore-mode="photo">Prefer to use a photo? ${arrow}</button></section>`;
    updateGrid();
  }
  function updateGrid() {
    const items = filterExploreItems(host.querySelector('[data-device-search]').value, host.querySelector('[data-device-group]').value);
    host.querySelector('[data-device-count]').textContent = `${items.length} ${items.length === 1 ? 'device' : 'devices'} to discover`;
    host.querySelector('[data-device-grid]').innerHTML = items.length ? items.map(item => `<button type="button" class="fgx-device" data-device="${item.slug}"><span class="fgx-device-icon">${productIcon(item.worldId)}</span><strong>${escape(item.label)}</strong><span>${escape(item.group)}</span></button>`).join('') : '<div class="fgx-empty"><strong>No device found yet.</strong><p>Try a shorter name or choose “All devices”.</p><button type="button" class="fgx-button" data-clear-search>Show all devices</button></div>';
  }

  function renderConfirm() {
    if (!selected) { show('manual'); return; }
    host.innerHTML = `<section class="fg-explore fgx-confirm">${stepHeader('Is this your device?', 'Take a moment to check before your discovery begins.', 'STEP 2 / CHECK TOGETHER', lastMode)}<div class="fgx-confirm-card">${preview ? `<figure class="fgx-confirm-photo"><img src="${escape(preview)}" alt="Your selected photo"/><figcaption>Your photo · only in this tab</figcaption></figure>` : ''}<div class="fgx-confirm-device"><span class="fgx-confirm-icon">${productIcon(selected.worldId)}</span><p class="fgx-eyebrow">${escape(selected.group)}</p><h2>${escape(selected.label)}</h2><p>You’ll explore an illustrated ${escape(selected.label.toLowerCase())}, with its parts and care tips.</p><button type="button" class="fgx-button fgx-primary" data-device-confirm>Yes, explore this device ${arrow}</button><button type="button" class="fgx-text-link" data-confirm-back>Choose another device</button></div></div><p class="fgx-together-note">This is a learning model. A photo cannot check damage, safety, a brand or a model.</p></section>`;
  }

  function renderPhoto() {
    available = false;
    host.innerHTML = `<section class="fg-explore fgx-photo">${stepHeader('Start with a photo.', 'Show one whole device clearly. We’ll suggest a type for you to check together.', 'STEP 1 / USE A PHOTO')}<div class="fgx-photo-layout"><div class="fgx-photo-surface"><div class="fgx-photo-placeholder" data-photo-placeholder>${cameraIcon}<strong>One device. A clear view.</strong><span>Keep the whole item in the picture.</span></div><figure class="fgx-photo-preview" data-photo-preview hidden><img alt="Your selected photo"/><figcaption>Only in this browser tab</figcaption></figure><div class="fgx-camera" data-photo-camera-view hidden><video data-photo-video autoplay muted playsinline aria-label="Camera preview"></video><div class="fgx-camera-actions"><button type="button" class="fgx-button fgx-primary" data-photo-capture disabled>Take this photo</button><button type="button" class="fgx-button" data-photo-camera-cancel>Close camera</button></div></div></div><div class="fgx-photo-panel"><p class="fgx-eyebrow">YOUR WAY TO EXPLORE</p><h2>Show it. Check it. Discover it.</h2><p>Try a photo suggestion, or choose from the full device collection anytime.</p><div class="fgx-photo-actions"><button type="button" class="fgx-button fgx-primary" data-photo-camera>${cameraIcon} Take photo</button><label class="fgx-button fgx-upload">Upload photo<input type="file" data-photo-upload accept="image/jpeg,image/png,image/webp" aria-label="Upload a device photo"/></label></div><label class="fgx-camera-app">Use your device’s camera app<input type="file" data-photo-native capture="environment" accept="image/jpeg,image/png,image/webp" aria-label="Use your camera app to take a device photo"/></label><p class="fgx-file-note">JPG, PNG or WebP · up to 10 MB</p><div class="fgx-photo-check-actions"><button type="button" class="fgx-button fgx-primary" data-photo-check disabled>Check this photo ${arrow}</button><button type="button" class="fgx-button" data-photo-stop hidden>Stop checking</button><button type="button" class="fgx-text-link" data-photo-clear hidden>Remove photo</button></div><p class="fgx-photo-status" data-photo-status role="status" aria-live="polite">Your photo stays in this tab. You choose whether to check it.</p><progress data-photo-progress aria-label="Checking your device photo" hidden></progress><p class="fgx-availability" data-photo-availability>Checking photo suggestions…</p><button class="fgx-text-link" type="button" data-explore-mode="manual">Choose a device instead ${arrow}</button></div></div><div class="fgx-photo-results" data-photo-results></div><p class="fgx-together-note">Photo suggestions identify a type of device, not damage or safety. Always confirm the suggestion before exploring.</p></section>`;
    const id = screenId;
    checkingAvailability = true;
    Promise.resolve().then(() => services.availability()).then(result => {
      if (disposed || screenId !== id) return;
      available = Boolean(result.available);
      host.querySelector('[data-photo-availability]').textContent = available ? 'Optional AI photo helper · the first check loads about 92 MB of model files. Your photo is processed here in your browser.' : (result.message || 'Photo suggestions are unavailable. You can still choose any device.');
    }).catch(() => { if (!disposed && screenId === id) { available = false; host.querySelector('[data-photo-availability]').textContent = 'Photo suggestions could not load. Choose a device instead, or try again later.'; } })
      .finally(() => { if (!disposed && screenId === id) { checkingAvailability = false; controls(); } });
    if (preview) showPreview();
  }
  function showPreview() {
    const figure = host.querySelector('[data-photo-preview]');
    if (!figure) return;
    figure.hidden = !preview;
    if (preview) figure.querySelector('img').src = preview;
    else figure.querySelector('img').removeAttribute('src');
    host.querySelector('[data-photo-placeholder]').hidden = Boolean(preview);
    controls();
  }

  async function choosePhoto(nextFile) {
    stopCamera(); request?.abort(); const id = ++requestId, page = screenId;
    request = new view.AbortController(); file = null; preview = ''; photoReady = false; busy = false; selected = null;
    host.querySelector('[data-photo-camera-view]').hidden = true;
    host.querySelector('[data-photo-results]').innerHTML = '';
    showPreview();
    const invalid = explorePhotoValidation(nextFile);
    if (invalid) {
      status(invalid); controls();
      revealResult(host.querySelector('[data-photo-status]'), { signal: request.signal, isCurrent: () => !disposed && id === requestId && page === screenId });
      return;
    }
    status('Preparing your photo…');
    try {
      await services.validateContent(nextFile);
      if (disposed || id !== requestId || page !== screenId) return;
      const data = await services.readPreview(nextFile, { signal: request.signal });
      if (disposed || id !== requestId || page !== screenId) return;
      if (!/^data:image\/(jpeg|png|webp);base64,[a-z\d+/=]+$/i.test(data)) throw new Error('Invalid preview');
      file = nextFile; preview = data; photoReady = true;
      showPreview(); status('Ready. Check this photo when you’re happy with it.');
    } catch (error) {
      if (disposed || id !== requestId || page !== screenId || error?.name === 'AbortError') return;
      status(error?.code === 'excessive_image_dimensions' ? 'Choose a photo under 30 megapixels.' : 'This file could not be read as a photo. Try a different JPG, PNG or WebP.');
      revealResult(host.querySelector('[data-photo-status]'), { signal: request.signal, isCurrent: () => !disposed && id === requestId && page === screenId });
    }
    controls();
  }

  async function startCamera() {
    requestId++; request?.abort();
    stopCamera(); const id = cameraId, page = screenId;
    status('Waiting for camera permission…');
    try {
      if (!media?.getUserMedia) throw new Error('Camera unavailable');
      const next = await media.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (disposed || id !== cameraId || screenId !== page) { next.getTracks().forEach(track => track.stop()); return; }
      stream = next;
      const video = host.querySelector('[data-photo-video]');
      video.srcObject = stream;
      host.querySelector('[data-photo-camera-view]').hidden = false;
      host.querySelector('[data-photo-placeholder]').hidden = true;
      host.querySelector('[data-photo-preview]').hidden = true;
      const ready = () => { if (!disposed && page === screenId && id === cameraId) host.querySelector('[data-photo-capture]').disabled = !(video.videoWidth && video.videoHeight); };
      listen(video, 'loadedmetadata', ready); listen(video, 'canplay', ready); ready();
      await video.play();
      if (disposed || id !== cameraId || screenId !== page) return;
      status('Frame one whole device, then choose “Take this photo”.');
    } catch (error) {
      if (disposed || id !== cameraId || screenId !== page) return;
      stopCamera(); host.querySelector('[data-photo-camera-view]').hidden = true; showPreview(); status(cameraMessage(error));
    }
  }

  async function capturePhoto() {
    const page = screenId, id = cameraId, video = host.querySelector('[data-photo-video]');
    if (!stream || !video?.videoWidth || !video.videoHeight) return;
    host.querySelector('[data-photo-capture]').disabled = true;
    try {
      let captured;
      if (options.captureFrame) captured = await options.captureFrame(video);
      else {
        const canvas = host.ownerDocument.createElement('canvas');
        const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
        if (!blob) throw new Error('No photo');
        captured = new view.File([blob], 'device-photo.jpg', { type: 'image/jpeg' });
      }
      if (disposed || id !== cameraId || page !== screenId) return;
      await choosePhoto(captured);
    } catch { if (!disposed && id === cameraId && page === screenId) { status('The photo could not be taken. Try again or upload a photo.'); host.querySelector('[data-photo-capture]').disabled = false; } }
  }

  async function checkPhoto() {
    if (!available || !file || !photoReady || busy || checkingAvailability) return;
    stopCamera(); request?.abort(); request = new view.AbortController();
    const id = ++requestId, page = screenId;
    busy = true; selected = null; host.querySelector('[data-photo-results]').innerHTML = '';
    status('Getting the photo helper ready…'); controls();
    try {
      const result = await services.classify(file, { signal: request.signal, onProgress: progress => {
        if (disposed || id !== requestId || page !== screenId) return;
        status(progress?.stage === 'analysing' ? 'Looking for a familiar device…' : 'Loading the photo helper. The first check can take a moment…');
      } });
      if (disposed || id !== requestId || page !== screenId) return;
      const suggestions = [...new Set((result?.alternatives || []).map(item => item?.slug))].map(slug => EXPLORE_ITEMS32.find(item => item.slug === slug)).filter(Boolean).slice(0, 3);
      if (suggestions.length) {
        status('Check the suggestion. Which device matches your photo?');
        host.querySelector('[data-photo-results]').innerHTML = `<h2 tabindex="-1">Does one of these look right?</h2><p>A suggestion is a starting point. You make the choice.</p><div class="fgx-suggestion-grid">${suggestions.map(item => `<button type="button" class="fgx-device" data-photo-suggestion="${item.slug}"><span class="fgx-device-icon">${productIcon(item.worldId)}</span><strong>${escape(item.label)}</strong><span>Check this device ${arrow}</span></button>`).join('')}</div><button type="button" class="fgx-text-link" data-explore-mode="manual">None of these? Choose from all 32 devices</button>`;
        revealResult(host.querySelector('[data-photo-results] h2'), { signal: request.signal, isCurrent: () => !disposed && id === requestId && page === screenId });
      } else {
        status(result?.reason === 'paused' ? 'Photo suggestions are paused. Choose a device instead.' : 'We’re not sure what is in this photo. Try a clearer photo of one whole device, or choose it from the collection.');
        if (result?.reason === 'paused') available = false;
        revealResult(host.querySelector('[data-photo-status]'), { signal: request.signal, isCurrent: () => !disposed && id === requestId && page === screenId });
      }
    } catch (error) {
      if (!disposed && id === requestId && page === screenId && error?.name !== 'AbortError') {
        status(services.errorMessage(error));
        revealResult(host.querySelector('[data-photo-status]'), { signal: request.signal, isCurrent: () => !disposed && id === requestId && page === screenId });
      }
    }
    finally { if (!disposed && id === requestId && page === screenId) { busy = false; controls(); } }
  }

  async function renderDetail(world = false) {
    const item = selected || EXPLORE_ITEMS32[0], page = screenId;
    host.innerHTML = `<section class="fg-explore fgx-detail">${stepHeader(world ? 'A room full of discoveries.' : 'Look a little closer.', world ? 'Rotate the room and choose a device to see what makes it work.' : 'Look around in 3D. Explore its parts, care and everyday impact.', 'EXPLORE / YOUR EVERYDAY DISCOVERIES')}<div class="fgx-detail-shortcuts"><button type="button" class="fgx-button" data-explore-mode="manual">Choose another device</button>${world ? '' : '<button type="button" class="fgx-button" data-explore-world>Explore the 3D world ↗</button>'}</div><div data-explore-detail></div></section>`;
    childAbort = new view.AbortController();
    try {
      const mount = options.detailMount || (await import('./reference/explore.js')).mountExplore;
      if (disposed || page !== screenId) return;
      const params = new URLSearchParams({ appliance: item.worldId });
      if (['parts', 'care', 'impact'].includes(route.tab)) params.set('tab', route.tab);
      const pending = mount(host.querySelector('[data-explore-detail]'), { route: { params }, signal: childAbort.signal, onNavigate: navigate,
        onLearn: options.onLearn, onAward: options.onAward, worldFactory: options.worldFactory, playSound: () => {}, photoHelperOptions: options.photoHelperOptions });
      // These legacy nodes remain mounted because the renderer updates them.
      // Hiding them removes duplicate pickers and the excluded camera-AR flow.
      host.querySelectorAll('.explore-heading,.explore-photo-slot,.explore-catalogue,.explore-ar-row,.explore-ar-status').forEach(node => { node.hidden = true; });
      const result = await pending;
      if (disposed || page !== screenId) { result?.(); return; }
      childCleanup = result;
      if (world) host.querySelector('[data-world="room"]')?.click();
    } catch { if (!disposed && page === screenId) host.querySelector('[data-explore-detail]').innerHTML = '<div class="fgx-empty" role="status"><h2>The 3D lesson could not load.</h2><p>Please choose a device again to retry.</p><button class="fgx-button" type="button" data-explore-mode="manual">Choose a device</button></div>'; }
  }

  function show(next, focus = true) {
    stopWork(); screenId++; screen = next;
    if (!['photo', 'confirm'].includes(next)) releasePhoto();
    if (next === 'start') { selected = null; renderStart(); }
    if (next === 'manual') { selected = null; renderManual(); }
    if (next === 'photo') renderPhoto();
    if (next === 'confirm') renderConfirm();
    if (['detail', 'world'].includes(next)) renderDetail(next === 'world');
    if (focus) focusHeading();
  }

  listen(host, 'click', event => {
    const button = event.target.closest('button');
    if (!button || !host.contains(button) || button.disabled) return;
    if (button.hasAttribute('data-explore-mode')) { show(button.dataset.exploreMode); return; }
    if (button.hasAttribute('data-explore-back')) { show(button.dataset.exploreBack); return; }
    if (button.hasAttribute('data-explore-world')) { navigate('#explore?view=world'); return; }
    if (button.hasAttribute('data-device') || button.hasAttribute('data-photo-suggestion')) {
      selected = EXPLORE_ITEMS32.find(item => item.slug === (button.dataset.device || button.dataset.photoSuggestion));
      lastMode = screen; show('confirm'); return;
    }
    if (button.hasAttribute('data-device-confirm') && selected) { navigate(`#explore?appliance=${encodeURIComponent(selected.worldId)}&confirmed=1`); return; }
    if (button.hasAttribute('data-confirm-back')) { show(lastMode); return; }
    if (button.hasAttribute('data-clear-search')) { host.querySelector('[data-device-search]').value = ''; host.querySelector('[data-device-group]').value = ''; updateGrid(); host.querySelector('[data-device-search]').focus(); }
    if (button.hasAttribute('data-photo-camera')) startCamera();
    if (button.hasAttribute('data-photo-capture')) capturePhoto();
    if (button.hasAttribute('data-photo-camera-cancel')) { stopCamera(); host.querySelector('[data-photo-camera-view]').hidden = true; showPreview(); status('Camera closed. Upload a photo or choose a device anytime.'); }
    if (button.hasAttribute('data-photo-check')) checkPhoto();
    if (button.hasAttribute('data-photo-stop')) { requestId++; request?.abort(); busy = false; status('Photo check stopped. You can try again or choose a device.'); controls(); }
    if (button.hasAttribute('data-photo-clear')) { requestId++; request?.abort(); stopCamera(); busy = false; releasePhoto(); host.querySelector('[data-photo-camera-view]').hidden = true; host.querySelector('[data-photo-results]').innerHTML = ''; showPreview(); status('Photo removed. Take or upload another, or choose a device.'); }
  });
  listen(host, 'input', event => { if (event.target.matches('[data-device-search]')) updateGrid(); });
  listen(host, 'change', event => {
    if (event.target.matches('[data-device-group]')) updateGrid();
    if (event.target.matches('[data-photo-upload],[data-photo-native]')) { const nextFile = event.target.files?.[0]; event.target.value = ''; if (nextFile) choosePhoto(nextFile); }
  });
  show(screen, false);
  return cleanup;
}
