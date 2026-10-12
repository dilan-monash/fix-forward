/** Optional Explore-only photo UI. Photos stay in this tab; only an explicit
 * confirmation can select a learning item. This never diagnoses an appliance.
 * Dependencies are injectable so tests exercise cancellation without a model. */
import { EXPLORE_ACTIVE_ITEMS } from './explore-catalogue.js';
import { classifyExplorePhoto, exploreClassifierAvailability, friendlyExploreError, releaseExploreModelSession } from './explore-classifier.js';
import { validateSiglipPhotoContent } from './siglip-appliance-classifier.js?v=i3-photo-review-v4';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

/** Validation runs before previewing or reading a file. Its name is never sent to
 * a server or put into HTML, and an invalid replacement cannot reuse old results. */
export function explorePhotoValidation(file) {
  if (!file) return 'Choose a photo first.';
  if (!PHOTO_TYPES.has(file.type)) return 'Choose a JPG, PNG or WebP photo.';
  if (!Number.isFinite(file.size) || file.size <= 0) return 'This photo is empty. Choose another photo.';
  if (file.size > MAX_PHOTO_BYTES) return 'Choose a photo smaller than 10 MB.';
  return '';
}

/** Read locally as a data URL, matching the application's existing image CSP.
 * The reader is cancelled on replacement/navigation; no blob: allowance or
 * network upload is needed to display a temporary preview. */
export function readExplorePhotoPreview(file, { signal, Reader = globalThis.FileReader } = {}) {
  return new Promise((resolve, reject) => {
    const aborted = () => Object.assign(new Error('Photo preview stopped.'), { name: 'AbortError' });
    if (signal?.aborted) { reject(aborted()); return; }
    if (!Reader) { reject(new Error('Photo preview is unavailable.')); return; }
    const reader = new Reader();
    const detach = () => signal?.removeEventListener('abort', stop);
    const stop = () => { reader.abort(); detach(); reject(aborted()); };
    reader.onload = () => { detach(); resolve(String(reader.result || '')); };
    reader.onerror = () => { detach(); reject(new Error('Photo preview could not be read.')); };
    reader.onabort = () => { detach(); reject(aborted()); };
    signal?.addEventListener('abort', stop, { once: true });
    try { reader.readAsDataURL(file); }
    catch { detach(); reject(new Error('Photo preview could not be read.')); }
  });
}

/** Mount synchronously so the rest of Explore remains usable while availability
 * is checked. The returned controls let navigation and manual choices cancel a
 * pending model response; request numbers also discard late, non-abortable work. */
export function mountExplorePhotoHelper(host, {
  onConfirm = () => {}, onManual = () => {}, signal,
  items = EXPLORE_ACTIVE_ITEMS,
  classify = classifyExplorePhoto,
  availability = exploreClassifierAvailability,
  errorMessage = friendlyExploreError,
  releaseModel = releaseExploreModelSession,
  validateContent = validateSiglipPhotoContent,
  readPreview,
} = {}) {
  const view = host.ownerDocument.defaultView;
  const lifecycle = new view.AbortController();
  let disposed = false, requestId = 0, request, previewRequest, file = null, previewReady = false;
  let available = false, availabilityFinished = false, busy = false;
  let alternatives = [], selectedSlug = '';
  const bySlug = new Map(items.map(item => [item.slug, item]));
  const previewFile = readPreview || ((photo, { signal }) => readExplorePhotoPreview(photo, { signal, Reader: view.FileReader }));

  host.innerHTML = `<details class="explore-photo-helper">
    <summary><span class="explore-photo-mark" aria-hidden="true">◎</span><span><strong>Try a photo</strong><small>Optional help choosing an item</small></span><span class="explore-photo-chevron" aria-hidden="true">+</span></summary>
    <div class="explore-photo-body">
      <p class="explore-photo-intro">Not sure what to pick? Show one item clearly. We will suggest a type for you to confirm.</p>
      <p class="explore-photo-boundary">Your photo stays in this browser tab. This suggests an item type; it cannot check damage, safety, a brand or a model.</p>
      <div class="explore-photo-dropzone" data-explore-photo-dropzone role="group" aria-label="Photo drop area" aria-describedby="explore-photo-file-note">
        <svg class="explore-photo-drop-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="4" y="5" width="24" height="22" rx="4"/><circle cx="12" cy="12" r="2"/><path d="m5 24 8-8 5 5 4-4 5 5"/></svg>
        <div class="explore-photo-drop-copy"><strong data-explore-photo-drop-title>Drag a photo here</strong><span>or choose one from your device</span></div>
        <label class="explore-photo-upload">Choose a photo<input type="file" data-explore-photo-input accept="image/jpeg,image/png,image/webp" aria-label="Choose a photo for Explore" aria-describedby="explore-photo-file-note"></label>
      </div>
      <div class="explore-photo-controls"><button type="button" data-explore-photo-check disabled>Check this photo</button><button type="button" data-explore-photo-cancel hidden>Stop checking</button><button type="button" data-explore-photo-clear hidden>Remove photo</button></div>
      <p id="explore-photo-file-note" class="explore-photo-note">JPG, PNG or WebP · up to 10 MB. A clear photo of one whole item works best.</p>
      <p class="explore-photo-download" data-explore-photo-availability>Checking photo-helper availability…</p>
      <div class="explore-photo-work"><figure class="explore-photo-preview" hidden><img data-explore-photo-preview alt="Your selected photo"/><figcaption>Only in this tab</figcaption></figure><div class="explore-photo-response"><p class="explore-photo-status" data-explore-photo-status role="status" aria-live="polite">You can also choose any item using the cards below.</p><progress data-explore-photo-progress aria-label="Preparing the photo helper" hidden></progress><div data-explore-photo-results></div></div></div>
      <details class="explore-photo-support"><summary>Which items can it suggest?</summary><p>${items.map(item => escape(item.label)).join(' · ')}.</p><p>Each item opens a 3D model with parts, care tips and an electricity-impact example.</p></details>
      <button class="explore-photo-manual" type="button" data-explore-photo-manual>Choose from the items instead</button>
    </div></details>`;

  const input = host.querySelector('[data-explore-photo-input]');
  const dropzone = host.querySelector('[data-explore-photo-dropzone]');
  const dropTitle = host.querySelector('[data-explore-photo-drop-title]');
  let dragDepth = 0;
  const check = host.querySelector('[data-explore-photo-check]');
  const cancelButton = host.querySelector('[data-explore-photo-cancel]');
  const clearButton = host.querySelector('[data-explore-photo-clear]');
  const status = host.querySelector('[data-explore-photo-status]');
  const preview = host.querySelector('[data-explore-photo-preview]');
  const progress = host.querySelector('[data-explore-photo-progress]');
  const resultHost = host.querySelector('[data-explore-photo-results]');

  /** This small state update leaves the file input and keyboard focus in place. */
  function controls() {
    if (disposed) return;
    check.disabled = !available || !file || !previewReady || busy;
    cancelButton.hidden = !busy;
    clearButton.hidden = !file;
    progress.hidden = !busy;
    host.querySelector('.explore-photo-response').setAttribute('aria-busy', String(busy));
  }

  /** Clearing a result is not clearing the photo; a cancelled attempt may be
   * tried again. A token change prevents any old response repopulating choices. */
  function cancel({ message = '', clearPhoto = false } = {}) {
    clearDrag();
    requestId++;
    request?.abort();
    previewRequest?.abort();
    previewRequest = null;
    request = null;
    busy = false;
    alternatives = [];
    selectedSlug = '';
    if (disposed) return;
    resultHost.replaceChildren();
    if (clearPhoto) {
      file = null;
      input.value = '';
      previewReady = false;
      preview.removeAttribute('src');
      preview.closest('figure').hidden = true;
    }
    if (message) status.textContent = message;
    controls();
  }

  /** Keep untrusted model output behind the reviewed catalogue. Alternative
   * labels are possibilities for one item, never a count of objects detected. */
  function showResult(result) {
    // A policy can be paused after this page checked availability. This is not
    // a problem with the photo: remove suggestions and disable further checks
    // until a fresh page mount verifies availability again. Manual choices stay.
    if (result?.reason === 'paused') {
      available = false;
      availabilityFinished = true;
      alternatives = [];
      selectedSlug = '';
      resultHost.replaceChildren();
      status.textContent = 'Photo suggestions are paused while the helper is being checked. Choose an item below.';
      host.querySelector('[data-explore-photo-availability]').textContent = 'Photo suggestions are paused. The manual item picker and cards still work.';
      controls();
      return;
    }
    const seen = new Set();
    alternatives = (Array.isArray(result?.alternatives) ? result.alternatives : [])
      .map(candidate => bySlug.get(candidate?.slug))
      .filter(item => item && !seen.has(item.slug) && seen.add(item.slug)).slice(0, 3);
    selectedSlug = result?.accepted && alternatives.length ? alternatives[0].slug : '';
    status.textContent = alternatives.length
      ? result?.accepted ? 'Does this look like your item? Confirm it before the view changes.' : 'I am not sure. These are possible types. Choose the one that fits, or use the item cards.'
      : 'I could not make a useful suggestion. Try a clearer photo, or choose an item below.';
    if (!alternatives.length) return;
    // Every reviewed Explore category now has its own model; confirmation still
    // happens explicitly so a suggestion never changes the learning scene by itself.
    resultHost.innerHTML = `<fieldset class="explore-photo-choices"><legend>Which type matches your item?</legend>${alternatives.map(item => `<label><input type="radio" name="explore-photo-choice" value="${escape(item.slug)}"${item.slug === selectedSlug ? ' checked' : ''}/><span>${escape(item.label)}</span></label>`).join('')}</fieldset><button class="explore-photo-confirm" data-explore-photo-confirm type="button"${selectedSlug ? '' : ' disabled'}>Confirm this item</button><p class="explore-photo-note">A suggestion can be wrong. You are choosing what to explore.</p>`;
  }

  /** Picker and drop share one validation/preview path. Neither selection method
   * starts inference; replacing a photo cancels the earlier read and result. */
  async function selectPhoto(nextFile) {
    if (disposed) return;
    cancel({ clearPhoto: true });
    const issue = explorePhotoValidation(nextFile);
    if (issue) { status.textContent = issue; return; }
    const token = requestId;
    previewRequest = new view.AbortController();
    file = nextFile;
    status.textContent = 'Opening your photo in this tab…';
    controls();
    try {
      const previewSignal = previewRequest.signal;
      // The MIME label is not proof of image content. Check the actual header and
      // 30-megapixel limit before FileReader or <img> can decode a large image.
      // Header inspection cannot be interrupted, so also discard its late result.
      await validateContent(nextFile, { signal: previewSignal });
      if (disposed || token !== requestId || previewSignal.aborted) return;
      const dataUrl = await previewFile(nextFile, { signal: previewSignal });
      if (disposed || token !== requestId) return;
      if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(dataUrl)) throw new Error('Unsupported preview.');
      preview.src = dataUrl;
      previewReady = true;
      preview.closest('figure').hidden = false;
      status.textContent = available ? 'Photo ready. Choose “Check this photo” when you are ready.' : availabilityFinished ? 'Photo ready, but suggestions are unavailable here. Choose an item below.' : 'Photo ready. Checking whether suggestions are available…';
    } catch (error) {
      if (disposed || token !== requestId) return;
      cancel({ clearPhoto: true, message: errorMessage({
        code: error?.code === 'excessive_image_dimensions' ? 'too_large' : 'invalid_content',
      }) });
    }
    if (!disposed && token === requestId) { previewRequest = null; controls(); }
  }

  input.addEventListener('change', () => selectPhoto(input.files?.[0]), { signal: lifecycle.signal });

  /** File lists are hidden until drop in some browsers, so inspect the transfer
   * types while hovering. Text/URL drags are never fetched as remote images. */
  const isFileDrag = event => Array.from(event.dataTransfer?.types || []).includes('Files')
    || Array.from(event.dataTransfer?.items || []).some(item => item.kind === 'file')
    || Boolean(event.dataTransfer?.files?.length);

  function clearDrag() {
    dragDepth = 0;
    dropzone.classList.remove('is-dragover');
    dropTitle.textContent = 'Drag a photo here';
  }
  // A depth counter keeps the highlight steady when crossing the icon, text or
  // Choose button inside the same drop area instead of flickering on each child.
  dropzone.addEventListener('dragenter', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth++;
    dropzone.classList.add('is-dragover');
    dropTitle.textContent = 'Release to add your photo';
  }, { signal: lifecycle.signal });
  dropzone.addEventListener('dragover', event => {
    // Also stop a URL/image-link drop from navigating away from the lesson.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = isFileDrag(event) ? 'copy' : 'none';
  }, { signal: lifecycle.signal });
  dropzone.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) clearDrag();
  }, { signal: lifecycle.signal });
  dropzone.addEventListener('drop', event => {
    event.preventDefault();
    event.stopPropagation();
    clearDrag();
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length !== 1) {
      cancel({ clearPhoto: true, message: files.length > 1
        ? 'Drop one photo at a time. Choose a single photo to check.'
        : 'Drop a saved photo file here. For a picture on a website, save it first, then choose the photo.' });
      return;
    }
    void selectPhoto(files[0]);
  }, { signal: lifecycle.signal });

  // A missed file drop must not replace the app with a browser image tab. These
  // guards exist only while Explore is mounted and leave non-file drags alone.
  view.addEventListener('dragover', event => {
    if (isFileDrag(event)) event.preventDefault();
  }, { signal: lifecycle.signal });
  view.addEventListener('drop', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    clearDrag();
    host.querySelector('.explore-photo-helper').open = true;
    status.textContent = 'Drop your photo inside the photo box, or choose it from your device.';
  }, { signal: lifecycle.signal });
  view.addEventListener('dragend', clearDrag, { signal: lifecycle.signal });
  view.addEventListener('blur', clearDrag, { signal: lifecycle.signal });

  // A valid header can still contain damaged pixels. Hide an undecodable image
  // and invalidate any pending suggestion instead of leaving a broken preview.
  preview.addEventListener('error', () => {
    if (!disposed && preview.hasAttribute('src')) {
      cancel({ clearPhoto: true, message: errorMessage({ code: 'invalid_content' }) });
    }
  }, { signal: lifecycle.signal });

  /** Model downloads start only after the explicit Check button. Both abort and
   * the captured request number protect manual selection, replacement and Back. */
  check.addEventListener('click', async () => {
    if (disposed || !available || !file || !previewReady || busy) return;
    cancel();
    const token = requestId;
    request = new view.AbortController();
    busy = true;
    status.textContent = 'Preparing the photo helper. You can stop or choose an item manually at any time.';
    progress.removeAttribute('value');
    controls();
    try {
      const result = await classify(file, { signal: request.signal, onProgress: update => {
        if (disposed || token !== requestId) return;
        status.textContent = update?.stage === 'analysing' ? 'Looking for a possible item type…' : 'Preparing the photo helper. The first download may take a little while.';
        if (update?.stage === 'loading' && Number.isFinite(update.progress)) {
          progress.max = 100;
          progress.value = Math.max(0, Math.min(100, update.progress));
        } else progress.removeAttribute('value');
      } });
      if (disposed || token !== requestId) return;
      showResult(result);
    } catch (error) {
      if (disposed || token !== requestId) return;
      status.textContent = error?.name === 'AbortError' ? 'Photo check stopped. Your manual choices are still available.' : errorMessage(error);
    } finally {
      if (!disposed && token === requestId) { busy = false; request = null; controls(); }
    }
  }, { signal: lifecycle.signal });

  resultHost.addEventListener('change', event => {
    if (!event.target.matches('input[name="explore-photo-choice"]')) return;
    selectedSlug = alternatives.some(item => item.slug === event.target.value) ? event.target.value : '';
    resultHost.querySelector('[data-explore-photo-confirm]').disabled = !selectedSlug;
  }, { signal: lifecycle.signal });
  resultHost.addEventListener('click', event => {
    if (!event.target.closest('[data-explore-photo-confirm]')) return;
    const item = alternatives.find(candidate => candidate.slug === selectedSlug);
    if (!item || disposed) return;
    // Capture the reviewed item before clearing choices; this is the only place
    // the helper requests a scene change, and it requires an actual button press.
    cancel();
    onConfirm(item);
    if (!disposed) status.textContent = `${item.label} selected. Explore its parts in the 3D view.`;
  }, { signal: lifecycle.signal });
  cancelButton.addEventListener('click', () => cancel({ message: 'Photo check stopped. You can try again or choose an item below.' }), { signal: lifecycle.signal });
  clearButton.addEventListener('click', () => cancel({ clearPhoto: true, message: 'Photo removed from this tab. Choose another photo or use the item cards.' }), { signal: lifecycle.signal });
  host.querySelector('[data-explore-photo-manual]').addEventListener('click', () => {
    cancel({ message: 'Choose the item you want to explore. No photo is needed.' });
    onManual();
  }, { signal: lifecycle.signal });

  /** Manifest availability is asynchronous but does not read the photo. UI stays
   * usable on network failure; no rejected promise leaks into the shell. */
  Promise.resolve().then(() => availability()).then(info => {
    if (disposed) return;
    available = info?.available === true;
    availabilityFinished = true;
    const amount = Number.isFinite(info?.downloadSizeMb) ? Math.ceil(info.downloadSizeMb) : 92;
    host.querySelector('[data-explore-photo-availability]').textContent = available
      ? `Experimental photo suggestions. First use downloads about ${amount} MB of model files. Your photo is not uploaded. Download starts only when you choose “Check this photo”.`
      : 'Photo suggestions are not available here yet. The manual item picker and cards still work.';
    if (file && previewReady && available && !busy) status.textContent = 'Photo ready. Choose “Check this photo” when you are ready.';
    controls();
  }).catch(() => {
    if (disposed) return;
    availabilityFinished = true;
    host.querySelector('[data-explore-photo-availability]').textContent = 'The photo helper could not be prepared. You can still choose an item manually.';
    controls();
  });

  /** Navigation invalidates callbacks immediately and releases model resources
   * after in-flight inference finishes. Photo data URLs never survive disposal. */
  function dispose() {
    if (disposed) return;
    cancel({ clearPhoto: true });
    disposed = true;
    lifecycle.abort();
    signal?.removeEventListener('abort', dispose);
    Promise.resolve().then(() => releaseModel()).catch(() => {});
  }
  if (signal?.aborted) dispose();
  else signal?.addEventListener('abort', dispose, { once: true });
  return { dispose, cancel };
}
