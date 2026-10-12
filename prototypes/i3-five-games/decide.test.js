/** Help with my appliance: drive the real page with synthetic records, a fake
 * photo helper and no network. These checks verify the safety and recall rules,
 * routing and calculations — not any real appliance, recall or place. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountDecide, planFor } from './decide.js';
import { mountPhotoHelper } from './support/photo-helper.js';
import { getStaticSnapshot } from '../../src/data-service.js';
import { SUBURB_POSTCODES } from '../../src/suburb-index.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const CLAYTON = { latitude: -37.918, longitude: 145.12 };

// Records shaped like the API reply, all marked available unless told otherwise.
function records({ recalls = [], locations = [], repairEvidence = [], available = true } = {}) {
  const base = getStaticSnapshot();
  if (!available) return base;
  return { ...base, recalls, locations, repairEvidence, availability: { recalls: true, sources: true, repairEvidence: true, locations: true },
    datasetMeta: { ...base.datasetMeta, recalls: { limitation: 'Synthetic fixture limits.' } } };
}
const place = (id, pathway, providerType, offset = 0) => ({ id, pathway, providerType, name: `Synthetic ${id}`, address: '1 Test Street', suburb: 'Clayton', postcode: '3168',
  latitude: CLAYTON.latitude + offset, longitude: CLAYTON.longitude + offset, sourceRetrievedAt: 'Synthetic fixture', url: 'https://example.test/place' });
const PRICES = { mode: 'database', repairFees: [], prices: [{ id: 'synthetic-kettle', categoryCode: 'kettle', brand: 'Fixture', model: 'K1', productName: 'Synthetic kettle', currency: 'AUD', priceAud: 80,
  priceKind: 'advertised', availability: 'in-stock', observedAt: new Date().toISOString().slice(0, 10), retailer: 'The Good Guys', sourceUrl: 'https://www.thegoodguys.com.au/synthetic-kettle' }] };

async function setup(t, { route = 'decide', data = records(), prices = PRICES, storage, photoMount } = {}) {
  const dom = new JSDOM('<!doctype html><main id="host"></main>', { url: 'http://decide.test/#decide' });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  if (storage) Object.defineProperty(dom.window, 'localStorage', { configurable: true, value: storage });
  const host = dom.window.document.querySelector('#host');
  const photo = { mounts: [], disposed: 0 };
  let resolveData;
  const dataReady = new Promise(resolve => { resolveData = resolve; });
  const services = {
    loadData: async () => { await dataReady; return data; },
    loadPrices: async () => prices,
    mountPhoto: photoMount || ((container, handlers) => { photo.mounts.push(handlers); container.hidden = true; return () => { photo.disposed += 1; }; }),
    loadMap: async () => false,
  };
  const cleanup = mountDecide(host, { route, services });
  resolveData(); await settle(); await settle();
  t.after(() => { cleanup(); dom.window.close(); });
  const query = selector => host.querySelector(selector);
  const ui = { dom, host, photo, cleanup, query, text: selector => query(selector)?.textContent.replace(/\s+/g, ' ').trim() || '' };
  ui.click = selector => { const node = query(selector); assert.ok(node, `${selector} should exist`); node.click(); };
  ui.submit = selector => query(selector).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  ui.type = (selector, value) => { const node = query(selector); node.value = value; node.dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  ui.answer = (id, value) => { const input = query(`[name="q-${id}"][value="${value}"]`); assert.ok(input, `${id} question should be present`); input.checked = true; input.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
  ui.answerAll = (value = 'no', except = {}) => { for (const node of host.querySelectorAll('[data-question]')) ui.answer(node.dataset.question, except[node.dataset.question] || value); };
  ui.start = (category, { brand = '', model = '' } = {}) => { ui.click(`[data-tile="${category}"]`); if (brand) ui.type('#dc-brand', brand); if (model) ui.type('#dc-model', model); ui.submit('#dc-details'); };
  ui.toOptions = (category, answers = {}, identity) => { ui.start(category, identity); ui.answerAll('no', answers); ui.submit('#dc-safety'); };
  ui.tabs = () => [...host.querySelectorAll('[data-tab]')].map(node => node.dataset.tab);
  return ui;
}

test('step one offers the photo helper and a picture for every appliance, with hideable tips', async t => {
  const saved = new Map();
  const ui = await setup(t, { storage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } });
  assert.equal(ui.host.querySelectorAll('[data-tile]').length, 20);
  assert.equal(ui.photo.mounts.length, 1, 'the on-device photo helper is mounted on step one');
  assert.match(ui.text('.dc-hero h1'), /broken or unwanted/i);
  assert.ok(ui.query('[data-teach]'));
  const tips = ui.query('#dc-tips');
  tips.checked = false; tips.dispatchEvent(new ui.dom.window.Event('change', { bubbles: true }));
  assert.ok(ui.query('.dc-page').classList.contains('tips-off'));
  assert.equal(saved.get('fixforward-decide-tips'), 'off');
  ui.click('[data-group="cleaning"]');
  assert.deepEqual([...ui.host.querySelectorAll('[data-tile]:not([hidden])')].map(node => node.dataset.tile), ['Steam cleaner', 'Vacuum cleaner']);
});

test('a confirmed photo suggestion picks the same tile; an unknown label changes nothing', async t => {
  const ui = await setup(t);
  ui.photo.mounts[0].onConfirm({ slug: 'unknown', category: 'Robot', label: 'Robot' });
  assert.equal(ui.query('.dc-tile.is-picked'), null);
  ui.photo.mounts[0].onConfirm({ slug: 'kettle', category: 'Kettle', label: 'Kettle' });
  assert.equal(ui.query('.dc-tile.is-picked').dataset.tile, 'Kettle');
  assert.equal(ui.query('[data-tile="Kettle"]').getAttribute('aria-pressed'), 'true');
  assert.match(ui.text('.dc-chosen'), /suggested by your photo, confirmed by you/i);
});

test('a 3D route keeps its identity; an unknown name is never replaced with another appliance', async t => {
  const rice = await setup(t, { route: 'decide?appliance=ricecooker' });
  assert.match(rice.text('.dc-chosen strong'), /^Rice cooker$/);
  const unknown = await setup(t, { route: 'decide?appliance=Unknown%20widget' });
  assert.equal(unknown.query('.dc-tile.is-picked'), null);
  assert.equal(unknown.query('#dc-details'), null);
});

test('brand and model are validated, and each appliance gets its own safety questions', async t => {
  const ui = await setup(t);
  ui.click('[data-tile="Rice cooker"]');
  ui.type('#dc-brand', '!!!'); ui.submit('#dc-details');
  assert.match(ui.text('#dc-brand-error'), /letter/i);
  assert.equal(ui.query('#dc-safety'), null);
  ui.type('#dc-brand', 'Fixture'); ui.submit('#dc-details');
  assert.ok(ui.query('[data-question="water"]'));
  assert.equal(ui.query('[data-question="battery"]'), null);
  assert.match(ui.text('.dc-item-pill'), /Rice cooker.*Fixture/);
  assert.deepEqual(planFor('Laptop').map(([id]) => id), ['burning', 'electrical', 'battery', 'plug', 'power']);
});

test('missing answers cannot reach the options; a serious Yes warns at once and leaves only disposal planning', async t => {
  const ui = await setup(t, { data: records({ locations: [place('drop', 'dispose', 'transfer_station')] }) });
  ui.start('Toaster');
  ui.submit('#dc-safety');
  assert.match(ui.text('#dc-safety-error'), /remaining questions/i);
  assert.equal(ui.query('[data-question="burning"]').getAttribute('aria-invalid'), 'true');
  assert.equal(ui.query('.dc-verdict'), null);
  ui.answer('burning', 'yes');
  assert.equal(ui.query('[data-immediate]').hidden, false);
  assert.match(ui.text('[data-immediate]'), /stop using this appliance/i);
  ui.answerAll('no', { burning: 'yes' }); ui.submit('#dc-safety');
  assert.match(ui.text('#dc-step-title'), /stop using this appliance for now/i);
  assert.deepEqual(ui.tabs(), ['recycle']);
  assert.equal(ui.query('#dc-cost-form'), null);
  assert.match(ui.text('[data-panel]'), /don’t transport it while it’s hot, smoking, leaking/i);
  assert.ok(ui.query('a[href="https://www.energysafe.vic.gov.au/"]'));
  assert.doesNotMatch(ui.text('.dc-options'), /no warning signs reported/i);
});

test('a possible recall comes before every ordinary option', async t => {
  const ui = await setup(t, { data: records({ recalls: [{ id: 'synthetic', categoryCodes: ['vacuum-cleaner'], brand: 'Fixture', productName: 'Synthetic vacuum',
    identifiers: [{ type: 'model', value: 'TEST-123', normalizedValue: 'TEST123' }], noticeUrl: 'https://www.productsafety.gov.au/recalls/synthetic-fixture' }] }) });
  ui.toOptions('Vacuum cleaner', {}, { brand: 'Fixture', model: 'TEST-123' });
  assert.match(ui.text('#dc-step-title'), /check the official notice before doing anything else/i);
  assert.match(ui.text('.dc-recall'), /may be affected by a product recall/i);
  assert.ok(ui.query('.dc-recall a[href="https://www.productsafety.gov.au/recalls/synthetic-fixture"]'));
  assert.deepEqual(ui.tabs(), []);
  assert.match(ui.text('.dc-paused'), /paused/i);
});

test('no model number and no exact match never read as “not recalled”', async t => {
  const noModel = await setup(t);
  noModel.toOptions('Kettle');
  assert.match(noModel.text('.dc-recall'), /add the model number/i);
  const noMatch = await setup(t);
  noMatch.toOptions('Kettle', {}, { brand: 'Fixture', model: 'ABSENT-1' });
  assert.match(noMatch.text('.dc-recall'), /doesn’t prove there’s no recall/i);
  assert.match(noMatch.text('.dc-verdict'), /isn’t a guarantee that the appliance is safe/i);
});

test('“Not sure” stays cautious: Repair Cafés are left out and qualified help is suggested', async t => {
  const cafesOnly = await setup(t, { data: records({ locations: [place('cafe', 'repair', 'repair_cafe')] }) });
  cafesOnly.toOptions('Kettle', { burning: 'unsure' });
  assert.match(cafesOnly.text('#dc-step-title'), /get advice before using it again/i);
  assert.deepEqual(cafesOnly.tabs(), ['repair', 'cost', 'recycle']);
  assert.match(cafesOnly.text('[data-panel]'), /our records only list community repair cafés/i);
  assert.equal(cafesOnly.query('.dc-place'), null);

  const mixed = await setup(t, { data: records({ locations: [place('cafe', 'repair', 'repair_cafe'), place('pro', 'repair', 'electronics_repair', .002)] }) });
  mixed.toOptions('Kettle', { heat: 'yes' });
  assert.match(mixed.text('#dc-step-title'), /ask a repairer to check it/i);
  mixed.type('#dc-area', '3168 — Clayton'); mixed.submit('#dc-area-form');
  assert.deepEqual([...mixed.host.querySelectorAll('.dc-place h4')].map(node => node.textContent), ['Synthetic pro']);
});

test('“I can’t check this safely” keeps a reported danger and never becomes clear', async t => {
  const danger = await setup(t);
  danger.start('Kettle'); danger.answer('burning', 'yes'); danger.click('[data-cant]');
  assert.match(danger.text('#dc-step-title'), /stop using/i);
  const unknown = await setup(t);
  unknown.start('Kettle'); unknown.click('[data-cant]');
  assert.match(unknown.text('#dc-step-title'), /get advice before using it again/i);
  assert.match(unknown.text('.dc-verdict'), /chose not to check further/i);
});

test('clear answers open repair, cost and recycling, with places from the records near the chosen suburb', async t => {
  const ui = await setup(t, { data: records({ locations: [place('cafe', 'repair', 'repair_cafe'), place('far', 'repair', 'repair_cafe', 1), place('drop', 'dispose', 'transfer_station', .003)],
    repairEvidence: [{ categoryCode: 'kettle', sampleSize: 10, fixedCount: 4, repairableCount: 2, geography: 'AU' }] }) });
  ui.toOptions('Kettle');
  assert.match(ui.text('#dc-step-title'), /no warning signs reported/i);
  assert.deepEqual(ui.tabs(), ['repair', 'cost', 'recycle']);
  assert.match(ui.text('.dc-history'), /4 of 10/);
  ui.type('#dc-area', 'Clayt');
  assert.ok(ui.query('[data-area="3168 — Clayton"]'), 'suburb suggestions are tappable buttons');
  ui.click('[data-area="3168 — Clayton"]');
  assert.deepEqual([...ui.host.querySelectorAll('.dc-place h4')].map(node => node.textContent), ['Synthetic cafe'], 'a place 100 km away is not listed within 10 km');
  assert.match(ui.text('.dc-place'), /1 Test Street, Clayton, 3168/);
  ui.click('[data-tab="recycle"]');
  assert.equal(ui.query('[data-tab="recycle"]').getAttribute('aria-selected'), 'true');
  assert.deepEqual([...ui.host.querySelectorAll('.dc-place h4')].map(node => node.textContent), ['Synthetic drop'], 'the chosen area carries across');
  const box = ui.query('[data-check="accepts"]'); box.checked = true; box.dispatchEvent(new ui.dom.window.Event('change', { bubbles: true }));
  assert.match(ui.text('[data-check-status]'), /1 of 3 checked/);
});

test('a postcode covering several suburbs asks which one instead of guessing', async t => {
  const counts = new Map();
  for (const row of SUBURB_POSTCODES) counts.set(String(row.postcode), (counts.get(String(row.postcode)) || 0) + 1);
  const shared = [...counts].find(([, total]) => total > 1)[0];
  const ui = await setup(t, { data: records({ locations: [place('cafe', 'repair', 'repair_cafe')] }) });
  ui.toOptions('Kettle');
  ui.type('#dc-area', shared); ui.submit('#dc-area-form');
  assert.match(ui.text('#dc-area-error'), /choose your suburb/i);
  assert.ok(ui.host.querySelectorAll('[data-area]').length > 1);
  assert.equal(ui.query('.dc-place'), null);
});

test('cost comparison uses only entered figures and dated recorded prices', async t => {
  const ui = await setup(t);
  ui.toOptions('Kettle');
  ui.click('[data-tab="cost"]');
  ui.type('#dc-repair', 'abc'); ui.type('#dc-replacement', '10'); ui.submit('#dc-cost-form');
  assert.notEqual(ui.text('#dc-repair-error'), '');
  assert.equal(ui.query('[data-compare-result]'), null);
  ui.type('#dc-repair', '0'); ui.submit('#dc-cost-form');
  assert.match(ui.text('[data-compare-result]'), /repair is \$10\.00 lower upfront/i);
  assert.match(ui.text('[data-compare-result]'), /price is only one part of the decision/i);
  ui.click('[data-use-price="synthetic-kettle"]');
  assert.equal(ui.query('#dc-replacement').value, '80');
  assert.match(ui.text('[data-price-note]'), /recorded The Good Guys price/);
  ui.type('#dc-replacement', '95');
  assert.equal(ui.query('[data-price-note]'), null, 'an edited amount is the adult’s own figure');
});

test('unavailable records stay unavailable, with official sources offered', async t => {
  const ui = await setup(t, { data: records({ available: false }) });
  ui.toOptions('Kettle', {}, { brand: 'Fixture', model: 'K1' });
  assert.match(ui.text('.dc-recall'), /can’t check our recall records right now/i);
  assert.ok(ui.query('.dc-recall a[href="https://www.productsafety.gov.au/recalls"]'));
  ui.type('#dc-area', '3168 — Clayton'); ui.submit('#dc-area-form');
  assert.match(ui.text('[data-results]'), /place records are unavailable/i);
  assert.equal(ui.query('.dc-place'), null);
});

test('browser Back returns to the previous step with the answers kept', async t => {
  const ui = await setup(t);
  ui.toOptions('Kettle');
  ui.dom.window.dispatchEvent(new ui.dom.window.PopStateEvent('popstate', { state: { dcStep: 'check' } }));
  assert.match(ui.text('#dc-step-title'), /quick safety check/i);
  assert.equal(ui.host.querySelectorAll('[data-question] input:checked').length, planFor('Kettle').length);
  ui.dom.window.dispatchEvent(new ui.dom.window.PopStateEvent('popstate', { state: { dcStep: 'identify' } }));
  assert.equal(ui.query('.dc-tile.is-picked').dataset.tile, 'Kettle');
});

test('changing the appliance clears the old answers and figures', async t => {
  const ui = await setup(t);
  ui.toOptions('Kettle', { heat: 'yes' });
  ui.click('[data-back-step="identify"]');
  ui.click('[data-tile="Fan"]'); ui.submit('#dc-details');
  assert.equal(ui.host.querySelectorAll('[data-question] input:checked').length, 0);
});

test('cleanup stops listeners, disposes the photo helper and ignores late data', async t => {
  const dom = new JSDOM('<!doctype html><main id="host"></main>', { url: 'http://decide.test/#decide' });
  t.after(() => dom.window.close());
  const host = dom.window.document.querySelector('#host');
  let release; let disposed = 0;
  const cleanup = mountDecide(host, { services: { loadData: () => new Promise(resolve => { release = resolve; }), loadPrices: async () => PRICES, loadMap: async () => false,
    mountPhoto: () => () => { disposed += 1; } } });
  cleanup();
  assert.equal(disposed, 1);
  host.querySelector('[data-tile="Kettle"]').click();
  assert.equal(host.querySelector('#dc-details'), null, 'detached controls do nothing');
  release(records()); await settle();
  assert.equal(host.querySelector('.dc-recall'), null);
});

for (const category of ['Kettle', 'Fan']) test(`manual ${category} selection cancels an old photo and keeps brand input focus`, async t => {
  let completeRecognition, recognitionSignal;
  const ui = await setup(t, { route: 'decide?appliance=Kettle', photoMount: (container, handlers) => mountPhotoHelper(container, {
    ...handlers, availability: async () => ({ enabled: true }), releaseSession: async () => {},
    createPreview: async () => 'data:image/png;base64,dGVzdA==',
    recognise: (_file, options) => { recognitionSignal = options.signal; return new Promise(resolve => { completeRecognition = resolve; }); },
  }) });
  const input = ui.query('#appliance-photo');
  Object.defineProperty(input, 'files', { value: [{ type: 'image/png', size: 100 }], configurable: true });
  input.dispatchEvent(new ui.dom.window.Event('change')); await settle();
  ui.click(`[data-tile="${category}"]`); ui.query('#dc-brand').focus(); ui.type('#dc-brand', 'Fixture');
  assert.equal(recognitionSignal.aborted, true);
  completeRecognition({ accepted: true, requiresConfirmation: true, alternatives: [{ slug: 'toaster', category: 'Toaster' }] }); await settle();
  assert.equal(ui.query('.dc-tile.is-picked').dataset.tile, category);
  assert.equal(ui.query('#photo-result-title'), null); assert.equal(ui.query('#photo-selected-preview img'), null);
  assert.equal(ui.dom.window.document.activeElement, ui.query('#dc-brand')); assert.equal(ui.query('#dc-brand').value, 'Fixture');
});
