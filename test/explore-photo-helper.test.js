/** Exercise the optional Explore UI with invented files and cancellable model
 * doubles. No image model, upload, real camera or network is used in these tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountExplorePhotoHelper, explorePhotoValidation, readExplorePhotoPreview } from '../src/explore-photo-helper.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const ITEMS = [
  { slug: 'kettle', label: 'Kettle', worldId: 'kettle' },
  { slug: 'vacuum_cleaner', label: 'Vacuum cleaner', worldId: 'vacuum' },
  { slug: 'smartphone', label: 'Smartphone', worldId: 'smartphone' },
];

/** Test data URLs are invented local previews, not real personal pictures. */
async function fixture(t, dependencies = {}) {
  const dom = new JSDOM('<main id="helper"></main>', { url: 'http://localhost/' });
  const host = dom.window.document.querySelector('main');
  const calls = [], confirmed = [];
  let releases = 0;
  const helper = mountExplorePhotoHelper(host, {
    items: ITEMS,
    availability: async () => ({ available: true, experimental: true, downloadSizeMb: 92 }),
    classify: async (file, options) => { calls.push({ file, options }); return { accepted: true, requiresConfirmation: true, alternatives: [{ slug: 'kettle', label: 'Kettle' }] }; },
    onConfirm: item => confirmed.push(item),
    releaseModel: () => { releases++; },
    validateContent: async () => ({ width: 1, height: 1 }),
    readPreview: async () => 'data:image/jpeg;base64,ZmFrZQ==',
    errorMessage: () => 'This photo could not be checked. Choose another or use the items.',
    ...dependencies,
  });
  const query = selector => host.querySelector(selector);
  const click = selector => { const element = query(selector); assert.ok(element, selector); element.click(); };
  const photo = (name = 'private-photo.jpg', type = 'image/jpeg') => new dom.window.File(['invented pixels'], name, { type });
  const choose = async (file = photo()) => {
    const input = query('[data-explore-photo-input]');
    Object.defineProperty(input, 'files', { configurable: true, value: file ? [file] : [] });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await settle();
    return file;
  };
  // JSDOM does not implement native DataTransfer. This fixture models only the
  // public drag payload; it never assigns a real browser file or opens a URL.
  const drag = (type, { files = [], types = ['Files'], target = query('[data-explore-photo-dropzone]'), relatedTarget = null, url = '' } = {}) => {
    assert.ok(target, 'Photo drop target exists');
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      relatedTarget: { value: relatedTarget },
      dataTransfer: { value: { files, types, dropEffect: 'none', getData: format => format === 'text/uri-list' ? url : '' } },
    });
    target.dispatchEvent(event);
    return event;
  };
  const drop = async (files, options = {}) => { const event = drag('drop', { files, ...options }); await settle(); return event; };
  t.after(async () => { helper.dispose(); await settle(); dom.window.close(); });
  await settle();
  return { dom, host, helper, query, click, choose, photo, drag, drop, calls, confirmed, releases: () => releases };
}

test('photo selection only previews; Check runs inference and a separate confirmation selects the item', async t => {
  const f = await fixture(t);
  assert.equal(f.query('details').open, false);
  assert.equal(f.calls.length, 0);
  assert.match(f.query('[data-explore-photo-availability]').textContent, /92 MB/);
  const selected = await f.choose();
  assert.equal(f.calls.length, 0, 'Choosing a file must not silently trigger a model download');
  assert.equal(f.query('[data-explore-photo-preview]').src, 'data:image/jpeg;base64,ZmFrZQ==');
  f.click('[data-explore-photo-check]');
  await settle();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].file, selected);
  assert.equal(f.confirmed.length, 0);
  assert.doesNotMatch(f.host.textContent, /private-photo|confidence|\d+%/i);
  f.click('[data-explore-photo-confirm]');
  assert.equal(f.confirmed[0].worldId, 'kettle');
});

test('uncertain alternatives need a choice and use reviewed labels rather than raw model output', async t => {
  const f = await fixture(t, { classify: async () => ({ accepted: false, alternatives: [
    { slug: 'vacuum_cleaner', label: '<script>bad</script>' }, { slug: 'smartphone' },
    { slug: 'vacuum_cleaner' }, { slug: 'unsupported_future_item' },
  ] }) });
  await f.choose(); f.click('[data-explore-photo-check]'); await settle();
  assert.equal(f.host.querySelectorAll('input[name="explore-photo-choice"]').length, 2);
  assert.equal(f.query('[data-explore-photo-confirm]').disabled, true);
  assert.doesNotMatch(f.query('[data-explore-photo-results]').textContent, /bad|script|unsupported/);
  assert.doesNotMatch(f.query('[data-explore-photo-results]').textContent, /coming next/i);
  const choice = f.query('input[value="smartphone"]');
  choice.checked = true;
  choice.dispatchEvent(new f.dom.window.Event('change', { bubbles: true }));
  f.click('[data-explore-photo-confirm]');
  assert.equal(f.confirmed[0].slug, 'smartphone');
  assert.equal(f.confirmed[0].worldId, 'smartphone');
  assert.equal(f.query('[data-explore-photo-status]').textContent, 'Smartphone selected. Explore its parts in the 3D view.');
});

test('invalid, empty or oversized files never reach the model and remove a previous preview', async t => {
  const f = await fixture(t);
  await f.choose();
  await f.choose(f.photo('unknown.gif', 'image/gif'));
  assert.equal(f.query('[data-explore-photo-preview]').hasAttribute('src'), false);
  assert.equal(f.query('[data-explore-photo-check]').disabled, true);
  assert.match(explorePhotoValidation({ type: 'image/jpeg', size: 0 }), /empty/);
  assert.match(explorePhotoValidation({ type: 'image/jpeg', size: 11 * 1024 * 1024 }), /smaller than 10 MB/);
  assert.equal(explorePhotoValidation({ type: 'image/webp', size: 10 * 1024 * 1024 }), '');
  assert.equal(f.calls.length, 0);
});

test('replacing a photo aborts the first attempt and ignores its late result and progress', async t => {
  const pending = [];
  const f = await fixture(t, { classify: (file, options) => new Promise(resolve => pending.push({ file, options, resolve })) });
  await f.choose(); f.click('[data-explore-photo-check]');
  await f.choose(f.photo('new.jpg')); f.click('[data-explore-photo-check]');
  assert.equal(pending[0].options.signal.aborted, true);
  pending[0].options.onProgress({ stage: 'analysing' });
  pending[0].resolve({ accepted: true, alternatives: [{ slug: 'kettle' }] });
  await settle();
  assert.equal(f.query('[data-explore-photo-confirm]'), null);
  pending[1].resolve({ accepted: true, alternatives: [{ slug: 'vacuum_cleaner' }] });
  await settle();
  assert.match(f.query('[data-explore-photo-results]').textContent, /Vacuum cleaner/);
  assert.doesNotMatch(f.query('[data-explore-photo-results]').textContent, /Kettle/);
  assert.equal(f.query('[data-explore-photo-preview]').src, 'data:image/jpeg;base64,ZmFrZQ==');
});

test('manual cancellation keeps the photo reusable but ignores a late guess', async t => {
  let finish, abortSignal;
  const f = await fixture(t, { classify: (file, { signal }) => { abortSignal = signal; return new Promise(resolve => { finish = resolve; }); } });
  await f.choose(); f.click('[data-explore-photo-check]');
  f.helper.cancel({ message: 'Manual choice selected.' });
  assert.equal(abortSignal.aborted, true);
  finish({ accepted: true, alternatives: [{ slug: 'kettle' }] }); await settle();
  assert.equal(f.query('[data-explore-photo-confirm]'), null);
  assert.equal(f.query('[data-explore-photo-check]').disabled, false);
  assert.equal(f.query('[data-explore-photo-preview]').src, 'data:image/jpeg;base64,ZmFrZQ==');
  assert.equal(f.confirmed.length, 0);
});

test('route disposal clears photos, aborts inference, releases once and cannot overwrite the next page', async t => {
  const navigation = new AbortController();
  let finish, inferenceSignal;
  const f = await fixture(t, { signal: navigation.signal, classify: (file, { signal }) => { inferenceSignal = signal; return new Promise(resolve => { finish = resolve; }); } });
  await f.choose(); f.click('[data-explore-photo-check]');
  const preview = f.query('[data-explore-photo-preview]');
  navigation.abort();
  f.host.innerHTML = '<h1>The next page</h1>';
  finish({ accepted: true, alternatives: [{ slug: 'kettle' }] });
  await settle();
  f.helper.dispose();
  assert.equal(inferenceSignal.aborted, true);
  assert.equal(preview.hasAttribute('src'), false);
  assert.equal(f.releases(), 1);
  assert.equal(f.host.innerHTML, '<h1>The next page</h1>');
});

test('unavailable helper, rejected images and model errors keep a working manual route', async t => {
  let manual = 0;
  const unavailable = await fixture(t, { availability: async () => ({ available: false }), onManual: () => { manual++; } });
  await unavailable.choose();
  assert.equal(unavailable.query('[data-explore-photo-check]').disabled, true);
  unavailable.click('[data-explore-photo-manual]');
  assert.equal(manual, 1);
  const rejected = await fixture(t, { classify: async () => ({ accepted: false, alternatives: [] }) });
  await rejected.choose(); rejected.click('[data-explore-photo-check]'); await settle();
  assert.equal(rejected.query('[data-explore-photo-confirm]'), null);
  assert.match(rejected.query('[data-explore-photo-status]').textContent, /clearer photo/);
  const failed = await fixture(t, { classify: async () => { throw new Error('internal runtime details'); } });
  await failed.choose(); failed.click('[data-explore-photo-check]'); await settle();
  assert.match(failed.query('[data-explore-photo-status]').textContent, /could not be checked/);
  assert.doesNotMatch(failed.host.textContent, /internal runtime details/);
  assert.equal(failed.query('[data-explore-photo-check]').disabled, false);
});

test('a policy paused after availability removes suggestions and disables Check without blaming the photo', async t => {
  let paused = false, checks = 0, manual = 0;
  const f = await fixture(t, {
    classify: async () => {
      checks++;
      return paused ? { accepted: false, alternatives: [], reason: 'paused' }
        : { accepted: true, alternatives: [{ slug: 'kettle' }] };
    },
    onManual: () => { manual++; },
  });
  await f.choose(); f.click('[data-explore-photo-check]'); await settle();
  assert.ok(f.query('[data-explore-photo-confirm]'), 'An earlier enabled check can offer a suggestion');
  paused = true;
  f.click('[data-explore-photo-check]'); await settle();
  assert.equal(checks, 2);
  assert.equal(f.query('[data-explore-photo-check]').disabled, true);
  assert.equal(f.query('[data-explore-photo-confirm]'), null);
  assert.match(f.query('[data-explore-photo-status]').textContent, /suggestions are paused/i);
  assert.match(f.query('[data-explore-photo-availability]').textContent, /suggestions are paused/i);
  assert.doesNotMatch(f.host.textContent, /Try a clearer photo|Photo ready|Download starts only/i);
  assert.equal(f.query('[data-explore-photo-preview]').hasAttribute('src'), true, 'The valid local preview is preserved');
  f.click('[data-explore-photo-check]');
  assert.equal(checks, 2, 'A paused helper cannot keep launching checks');
  await f.drop([f.photo('new-photo.jpg')]);
  assert.equal(f.query('[data-explore-photo-check]').disabled, true, 'Replacing the photo must not override the policy pause');
  f.click('[data-explore-photo-manual]');
  assert.equal(manual, 1);
  assert.equal(f.confirmed.length, 0);
});

test('pending preview reads are cancelled and stale data cannot replace a new selected photo', async t => {
  const pending = [];
  const f = await fixture(t, { readPreview: (file, { signal }) => new Promise(resolve => pending.push({ signal, resolve })) });
  await f.choose();
  assert.equal(f.query('[data-explore-photo-check]').disabled, true);
  await f.choose(f.photo('replacement.jpg'));
  assert.equal(pending[0].signal.aborted, true);
  pending[0].resolve('data:image/jpeg;base64,b2xk'); await settle();
  assert.equal(f.query('[data-explore-photo-preview]').hasAttribute('src'), false);
  pending[1].resolve('data:image/jpeg;base64,bmV3'); await settle();
  assert.equal(f.query('[data-explore-photo-preview]').src, 'data:image/jpeg;base64,bmV3');
  assert.equal(f.query('[data-explore-photo-check]').disabled, false);
  f.click('[data-explore-photo-clear]');
  assert.equal(f.query('[data-explore-photo-preview]').hasAttribute('src'), false);
});

test('real content validation rejects spoofed and excessive-dimension photos before preview reading or decoding', async t => {
  let reads = 0;
  const f = await fixture(t, {
    validateContent: undefined, errorMessage: undefined,
    readPreview: async () => { reads++; return 'data:image/png;base64,cGl4ZWxz'; },
  });
  // Only the PNG header is enlarged: file bytes remain tiny, exercising the
  // decode-memory limit independently of the separate 10 MB file-size limit.
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nXkAAAAASUVORK5CYII=', 'base64'));
  const dimensions = new DataView(png.buffer);
  dimensions.setUint32(16, 6000); dimensions.setUint32(20, 6000);
  const fileFromBytes = (bytes, type) => ({ type, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer });
  await f.choose(fileFromBytes(png, 'image/png'));
  assert.match(f.query('[data-explore-photo-status]').textContent, /30 megapixels/);
  await f.choose(fileFromBytes(Uint8Array.from([1, 2, 3, 4]), 'image/jpeg'));
  assert.match(f.query('[data-explore-photo-status]').textContent, /could not be read as a photo/);
  let headerReads = 0;
  await f.choose({ type: 'image/png', size: 11 * 1024 * 1024, arrayBuffer: async () => { headerReads++; return png.buffer; } });
  assert.match(f.query('[data-explore-photo-status]').textContent, /smaller than 10 MB/);
  assert.equal(headerReads, 0, 'The byte-size limit applies even before header inspection');
  assert.equal(reads, 0, 'No rejected file reaches the FileReader preview');
  assert.equal(f.query('[data-explore-photo-preview]').hasAttribute('src'), false, 'No rejected file reaches the image decoder');
  assert.equal(f.query('[data-explore-photo-preview]').closest('figure').hidden, true);
  assert.equal(f.query('[data-explore-photo-check]').disabled, true);
  assert.equal(f.calls.length, 0);
});

test('late content validation cannot read an old photo or overwrite a newer preview', async t => {
  const pending = [], reads = [];
  const f = await fixture(t, {
    validateContent: (file, { signal }) => new Promise((resolve, reject) => pending.push({ file, signal, resolve, reject })),
    readPreview: async file => { reads.push(file); return 'data:image/jpeg;base64,bmV3'; },
  });
  await f.choose(f.photo('old.jpg'));
  const current = await f.choose(f.photo('current.jpg'));
  assert.equal(pending[0].signal.aborted, true);
  assert.equal(f.query('[data-explore-photo-check]').disabled, true);
  pending[0].resolve(); await settle();
  assert.equal(reads.length, 0, 'Finishing old header validation must not start a preview read');
  pending[1].resolve(); await settle();
  assert.deepEqual(reads, [current]);
  assert.equal(f.query('[data-explore-photo-preview]').src, 'data:image/jpeg;base64,bmV3');
  assert.equal(f.query('[data-explore-photo-check]').disabled, false);
  await f.choose(f.photo('late-invalid.jpg'));
  await f.choose(f.photo('latest.jpg'));
  pending[3].resolve(); await settle();
  const readyMessage = f.query('[data-explore-photo-status]').textContent;
  pending[2].reject(new Error('old header failure')); await settle();
  assert.equal(f.query('[data-explore-photo-status]').textContent, readyMessage);
  assert.equal(f.query('[data-explore-photo-check]').disabled, false);
});

test('navigation during header validation prevents later preview reads and DOM updates', async t => {
  let finish, validationSignal, reads = 0;
  const f = await fixture(t, {
    validateContent: (file, { signal }) => { validationSignal = signal; return new Promise(resolve => { finish = resolve; }); },
    readPreview: async () => { reads++; return 'data:image/jpeg;base64,b2xk'; },
  });
  await f.choose();
  f.helper.dispose();
  f.host.innerHTML = '<h1>The next page</h1>';
  finish(); await settle();
  assert.equal(validationSignal.aborted, true);
  assert.equal(reads, 0);
  assert.equal(f.host.innerHTML, '<h1>The next page</h1>');
});

test('a decode failure removes the broken preview and keeps manual selection available', async t => {
  let manual = 0;
  const f = await fixture(t, { errorMessage: undefined, onManual: () => { manual++; } });
  await f.choose();
  const preview = f.query('[data-explore-photo-preview]');
  preview.dispatchEvent(new f.dom.window.Event('error'));
  assert.equal(preview.hasAttribute('src'), false);
  assert.equal(preview.closest('figure').hidden, true);
  assert.equal(f.query('[data-explore-photo-check]').disabled, true);
  assert.match(f.query('[data-explore-photo-status]').textContent, /could not be read as a photo/);
  f.click('[data-explore-photo-manual]');
  assert.equal(manual, 1);
});

test('the real browser reader uses CSP-compatible data URLs and supports immediate abort', async () => {
  const dom = new JSDOM('');
  const file = new dom.window.File(['invented'], 'local.png', { type: 'image/png' });
  const preview = await readExplorePhotoPreview(file, { Reader: dom.window.FileReader });
  assert.match(preview, /^data:image\/png;base64,/);
  const controller = new AbortController();
  const reading = readExplorePhotoPreview(file, { Reader: dom.window.FileReader, signal: controller.signal });
  controller.abort();
  await assert.rejects(reading, { name: 'AbortError' });
  dom.window.close();
});

test('dropping one local photo previews it but waits for Check and confirmation', async t => {
  const validated = [];
  const f = await fixture(t, { validateContent: async file => { validated.push(file); } });
  const selected = f.photo('dropped.jpg');
  // During a native drag, browsers may expose Files without exposing bytes yet.
  const over = f.drag('dragover');
  assert.equal(over.defaultPrevented, true);
  const dropped = await f.drop([selected]);
  assert.equal(dropped.defaultPrevented, true, 'Dropping a file must not navigate away');
  assert.deepEqual(validated, [selected]);
  assert.equal(f.query('[data-explore-photo-preview]').src, 'data:image/jpeg;base64,ZmFrZQ==');
  assert.equal(f.query('[data-explore-photo-check]').disabled, false);
  assert.equal(f.calls.length, 0, 'A drop must not automatically download or run the model');
  f.click('[data-explore-photo-check]'); await settle();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].file, selected);
  assert.equal(f.confirmed.length, 0);
  f.click('[data-explore-photo-confirm]');
  assert.equal(f.confirmed[0].slug, 'kettle');
});

test('multiple files and image URLs clear the old preview without reading or checking a new photo', async t => {
  const reads = [];
  const f = await fixture(t, { readPreview: async file => { reads.push(file); return 'data:image/jpeg;base64,ZmFrZQ=='; } });
  for (const invalidDrop of [
    () => f.drop([f.photo('one.jpg'), f.photo('two.jpg')]),
    () => f.drop([], { types: ['text/uri-list', 'text/html'], url: 'https://example.invalid/private-photo.jpg' }),
  ]) {
    await f.choose();
    const readCount = reads.length;
    const dropped = await invalidDrop();
    assert.equal(dropped.defaultPrevented, true);
    assert.equal(reads.length, readCount, 'Invalid drops must not read any new photo');
    assert.equal(f.query('[data-explore-photo-preview]').hasAttribute('src'), false);
    assert.equal(f.query('[data-explore-photo-check]').disabled, true);
    assert.match(f.query('[data-explore-photo-status]').textContent, /one|single|choose|save|download|local/i);
    assert.doesNotMatch(f.host.textContent, /example\.invalid|private-photo/);
  }
  assert.equal(f.calls.length, 0);
});

test('a dropped unsupported file uses the picker validation and cannot retain the old preview', async t => {
  let validations = 0;
  const f = await fixture(t, { validateContent: async () => { validations++; } });
  await f.choose();
  const badFile = f.photo('not-supported.gif', 'image/gif');
  await f.drop([badFile]);
  assert.equal(f.query('[data-explore-photo-status]').textContent, explorePhotoValidation(badFile));
  assert.equal(validations, 1, 'Unsupported MIME must fail before content inspection');
  assert.equal(f.query('[data-explore-photo-preview]').hasAttribute('src'), false);
  assert.equal(f.query('[data-explore-photo-check]').disabled, true);
  assert.equal(f.calls.length, 0);
});

test('dropping a replacement aborts an old check and ignores its late result and progress', async t => {
  const pending = [];
  const f = await fixture(t, { classify: (file, options) => new Promise(resolve => pending.push({ file, options, resolve })) });
  await f.choose(); f.click('[data-explore-photo-check]');
  const replacement = f.photo('replacement-drop.jpg');
  await f.drop([replacement]);
  assert.equal(pending[0].options.signal.aborted, true);
  const readyMessage = f.query('[data-explore-photo-status]').textContent;
  pending[0].options.onProgress({ stage: 'analysing' });
  pending[0].resolve({ accepted: true, alternatives: [{ slug: 'kettle' }] }); await settle();
  assert.equal(f.query('[data-explore-photo-status]').textContent, readyMessage);
  assert.equal(f.query('[data-explore-photo-confirm]'), null);
  assert.equal(pending.length, 1, 'The replacement drop still needs an explicit Check');
  f.click('[data-explore-photo-check]');
  assert.equal(pending[1].file, replacement);
  pending[1].resolve({ accepted: true, alternatives: [{ slug: 'vacuum_cleaner' }] }); await settle();
  assert.match(f.query('[data-explore-photo-results]').textContent, /Vacuum cleaner/);
  assert.doesNotMatch(f.query('[data-explore-photo-results]').textContent, /Kettle/);
});

test('the file-drop highlight survives movement between nested children and clears on leaving', async t => {
  const f = await fixture(t);
  const zone = f.query('[data-explore-photo-dropzone]');
  assert.ok(zone);
  const child = zone.firstElementChild;
  assert.ok(child, 'The drop area has nested visible content');
  f.drag('dragenter', { types: ['text/plain'] });
  assert.equal(zone.classList.contains('is-dragover'), false);
  f.drag('dragenter');
  assert.equal(zone.classList.contains('is-dragover'), true);
  f.drag('dragenter', { target: child, relatedTarget: zone });
  f.drag('dragleave', { target: zone, relatedTarget: child });
  assert.equal(zone.classList.contains('is-dragover'), true, 'Crossing a nested label must not flicker the highlight');
  f.drag('dragleave', { target: child, relatedTarget: f.dom.window.document.body });
  assert.equal(zone.classList.contains('is-dragover'), false);
  f.drag('dragenter');
  await f.drop([f.photo()]);
  assert.equal(zone.classList.contains('is-dragover'), false, 'A completed drop must clear highlighting');
});

test('navigation removes window file-drop guards and leaves detached drop targets inert', async t => {
  let reads = 0;
  const f = await fixture(t, { readPreview: async () => { reads++; return 'data:image/jpeg;base64,ZmFrZQ=='; } });
  const zone = f.query('[data-explore-photo-dropzone]');
  assert.ok(zone);
  for (const type of ['dragover', 'drop']) {
    assert.equal(f.drag(type, { target: f.dom.window }).defaultPrevented, true, `${type} is guarded while Explore is mounted`);
  }
  f.helper.dispose();
  f.host.innerHTML = '<h1>The next page</h1>';
  for (const type of ['dragover', 'drop']) {
    assert.equal(f.drag(type, { target: f.dom.window }).defaultPrevented, false, `${type} is no longer intercepted after navigation`);
  }
  f.drag('dragenter', { target: zone });
  f.drag('drop', { target: zone, files: [f.photo()] }); await settle();
  assert.equal(zone.classList.contains('is-dragover'), false);
  assert.equal(reads, 0);
  assert.equal(f.calls.length, 0);
  assert.equal(f.host.innerHTML, '<h1>The next page</h1>');
});
