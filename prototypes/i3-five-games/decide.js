/** Help with my appliance. One page takes a parent from "it's broken" to a
 * real next step in three steps:
 *   1. Name the appliance: tap its picture, or let the on-device photo helper
 *      (the I3 SigLIP model) suggest one for the adult to confirm.
 *   2. Answer a short safety check from what they have already noticed.
 *   3. See the options: a recall check, repair help and e-waste drop-offs on a
 *      map, and a repair-or-replace cost comparison.
 * The options keep Iteration 2's rules and meaning: a serious warning or a
 * possible recall comes first, and repair, cost and recycling open only when
 * those rules allow. "Teach as you go" tips sit beside each step so a child
 * can follow along; the adult can hide them.
 *
 * Everything typed stays in this mounted page (only the tips preference is
 * remembered). Reference records are read-only GET requests; prices come from
 * the reviewed, dated catalogue. Nothing here certifies that an appliance is safe. */
import { FAMILIES, SAFETY_SIGNS, SAFETY_HELP, SAFETY_RULES, CATEGORY_CODE_BY_NAME, EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY, COST_CONTEXT_SOURCES } from '../../src/data.js';
import { safetyPlanFor, evaluateSafety, journeyDecision, compareCosts, matchRecall, findSuburbSuggestions, resolveAreaInput, getNearbyLocations, locationHasCoordinates, validateBrand, validateModel } from '../../src/logic.js';
import { loadPublicData, getStaticSnapshot } from '../../src/data-service.js';
import { PRICE_SNAPSHOT } from '../../src/price-snapshot.js';
import { automaticCostContext, loadPriceCatalogue, matchPriceExamples } from '../../src/price-catalogue.js';
import { productSuggestions } from '../../src/product-suggestions.js';
import { SUBURB_POSTCODES } from '../../src/suburb-index.js';
import { mountPhotoHelper } from './support/photo-helper.js';

const RECALL_SOURCE = 'https://www.productsafety.gov.au/recalls';
const RECALL_HOSTS = ['productsafety.gov.au', 'www.productsafety.gov.au'];
const ENERGY_SAFE = 'https://www.energysafe.vic.gov.au/';
const REPAIR_CAFE = 'https://www.repaircafe.org/en/visit/';
const EWASTE_GUIDE = 'https://www.sustainability.vic.gov.au/recycling-and-reducing-waste-at-home/recycling-at-home/e-waste';
// The same pinned map library and integrity hashes as Iteration 2. The I3
// security policy allows only this unpkg copy and OpenStreetMap tiles.
const LEAFLET = {
  css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', cssHash: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
  js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', jsHash: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
};
const TIPS_KEY = 'fixforward-decide-tips';
const LAPTOP = 'Laptop';
const CATEGORIES = [...FAMILIES.flatMap(family => family.categories), LAPTOP];
const QUALIFIED_REPAIR = ['electronics_repair', 'electronics_shop_repair', 'repair_service'];
// Short filter names for the picture grid. The three kitchen families share one.
const GROUPS = [
  ['all', 'All', CATEGORIES],
  ['kitchen', 'Kitchen', FAMILIES.filter(family => ['heating-simple-cooking', 'motorised-kitchen', 'complex-kitchen'].includes(family.id)).flatMap(family => family.categories)],
  ['cleaning', 'Cleaning', FAMILIES.find(family => family.id === 'cleaning').categories],
  ['care', 'Personal care', FAMILIES.find(family => family.id === 'personal-care').categories],
  ['air', 'Heating & cooling', FAMILIES.find(family => family.id === 'air-treatment').categories],
  ['electronics', 'Electronics', [LAPTOP]],
];
// 3D Explore ids, so a route like decide?appliance=ricecooker opens the same
// item and the end of the page can link back to the matching 3D model.
const WORLD_ITEMS = {
  kettle: 'Kettle', fan: 'Fan', toaster: 'Toaster', blender: 'Blender', microwave: 'Microwave',
  vacuum: 'Vacuum cleaner', hairdryer: 'Hair dryer', laptop: LAPTOP, ricecooker: 'Rice cooker',
  airfryer: 'Air fryer', coffeemachine: 'Coffee machine', mixer: 'Mixer',
};
const PROVIDER_LABELS = {
  repair_cafe: 'Community Repair Café', electronics_repair: 'Electronics repair', electronics_shop_repair: 'Shop offering repair',
  repair_service: 'Repair service', transfer_station: 'Transfer station', e_waste_reprocessor: 'E-waste recycler',
};

const ICONS = {
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  repair: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  scale: '<path d="M12 3v17M7 21h10M4 7h16M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
  recycle: '<path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-2.7L7.2 9.5M11 19h8.2a1.8 1.8 0 0 0 1.6-2.7l-1.3-2.1"/><path d="m14 16-3 3 3 3M8.3 13.6 7.2 9.5l-4.1 1.1M9.3 5.8l1.1-1.9A1.8 1.8 0 0 1 12 3a1.8 1.8 0 0 1 1.5.9l4 6.8M13.4 9.6l4.1 1.1 1.1-4.1"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  cross: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.3h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  route: '<path d="m3 11 18-8-8 18-2-8z"/>',
  locate: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  spark: '<path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  game: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3m-1.5-1.5h3M15.5 12h.01M18 14h.01"/>',
  cube: '<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
};
// Simple line pictures for the appliance grid, drawn to read at 40px.
const ART = {
  'Kettle': '<path d="M5.5 20 7.5 9h8l2 11z"/><path d="M8.5 9q3-4.5 6 0"/><path d="M15.8 11.5c4.2 0 4.2 6 .6 6"/><path d="M7.3 12.5 3.5 9.5"/><path d="M4.5 20.5h14"/>',
  'Toaster': '<rect x="3" y="9" width="17" height="10" rx="3.5"/><path d="M7 9V5.5h4V9M12.5 9V5.5h4V9"/><path d="M20 12.5h1.8M6 19v1.5M17 19v1.5"/>',
  'Sandwich press': '<rect x="3" y="14" width="18" height="5" rx="2"/><path d="M4 13.5 18.5 8.5a1.5 1.5 0 0 1 2 1.4V12"/><path d="M18.5 8.5 21 7M7 16.5h10"/>',
  'Rice cooker': '<path d="M4 11h16v5.5a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 16.5z"/><path d="M3.5 11a8.5 5 0 0 1 17 0"/><circle cx="12" cy="5.2" r="1.2"/><path d="M10 15.5h4"/>',
  'Blender': '<path d="M7 3h10l-1.6 11H8.6z"/><path d="M10 3v3M17 6h2"/><rect x="6" y="14" width="12" height="7" rx="2.2"/><circle cx="12" cy="17.5" r="1.2"/>',
  'Food processor': '<rect x="4" y="15" width="16" height="6" rx="2"/><path d="M5.5 15V8.5h13V15"/><path d="M14 8.5V3.5h3v5"/><path d="M8.5 12h7"/>',
  'Mixer': '<path d="M4 20.5h16M5.5 20.5V6.5a3 3 0 0 1 3-3h7a3.5 3.5 0 0 1 0 7H10"/><path d="M12.5 10.5v3"/><path d="M8.5 14h11l-1.4 5h-8.2z"/>',
  'Air fryer': '<path d="M6.5 3h11A2.5 2.5 0 0 1 20 5.5V18a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5.5A2.5 2.5 0 0 1 6.5 3z"/><path d="M4 12.5h16M10 16.5h4"/><circle cx="12" cy="7.8" r="2"/>',
  'Coffee machine': '<path d="M5 3h14v18H5zM5 7h14"/><path d="M9.5 7v2.5h5V7"/><path d="M9 14h5.5v2.5a2.5 2.5 0 0 1-2.5 2.5h-.5A2.5 2.5 0 0 1 9 16.5zM14.5 15h1.5"/>',
  'Microwave': '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><rect x="5" y="7.5" width="10" height="9" rx="1.5"/><path d="M18 8.5v.01M18 11.5v.01M17.5 15h1"/>',
  'Steam cleaner': '<path d="M4 18h14.5l-1.8-7H9a5 5 0 0 0-5 5z"/><path d="M12 11V7.5h5l1.5 3.5"/><path d="M8 7c-1-1.2 1-1.8 0-3.5M11 6.5c-1-1.2 1-1.8 0-3.5"/><path d="M6 21h11"/>',
  'Vacuum cleaner': '<path d="M3 16a5 5 0 0 1 10 0v3.5H3z"/><path d="M13 15c5 0 6.5-3.5 6.5-7.5V4h2"/><circle cx="5.5" cy="20.5" r="1"/><circle cx="10.5" cy="20.5" r="1"/>',
  'Hair dryer': '<path d="M3 6.5h9.5a4.5 4.5 0 0 1 0 9H3z"/><path d="M3 9v4M9.5 15.5 8 21.5h3.5l1.5-6"/><path d="M18.5 8.5h3M19 12h2.5"/>',
  'Shaver': '<path d="M8 3.5h8l-1 6.5v9a3 3 0 0 1-6 0v-9z"/><path d="M10 3.5v2.5M12 3.5v2.5M14 3.5v2.5M8.6 7.5h6.8"/><circle cx="12" cy="13.5" r="1.3"/>',
  'Straightener': '<path d="M7.5 3h3l-.5 12h-2zM13.5 3h3l-.5 12h-2z"/><path d="M8.5 15l-.5 6.5h8l-.5-6.5"/><path d="M12 15v6.5"/>',
  'Dehumidifier': '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8.5 6.5h7M8.5 9h7"/><path d="M12 12.5c-1.6 2.2-2.2 3.2-2.2 4a2.2 2.2 0 0 0 4.4 0c0-.8-.6-1.8-2.2-4z"/>',
  'Fan': '<circle cx="12" cy="10" r="7"/><circle cx="12" cy="10" r="1.2"/><path d="M12 8.8C11 6 12 4.6 13.6 5.2c1.4.6.6 2.6-1.6 3.6M13.2 10.4c2.6 1 3 2.8 1.6 3.6-1.3.8-2.4-.8-2.8-2.6M10.8 10.6c-2.3 1.4-4 .6-3.7-1 .3-1.4 2.4-1.4 3.7-.2"/><path d="M12 17v4M8 21h8"/>',
  'Portable air conditioner': '<rect x="6" y="3" width="11" height="18" rx="2.2"/><path d="M8.5 6.5h6M8.5 8.8h6"/><path d="M17 15c3 0 4.5 1.8 4.5 5"/><path d="M11.5 12.5v5M9.3 13.7l4.4 2.6M13.7 13.7l-4.4 2.6"/>',
  'Portable heater': '<rect x="3.5" y="4" width="17" height="14" rx="2.5"/><path d="M8 7.5v7M12 7.5v7M16 7.5v7"/><path d="M6.5 18v3M17.5 18v3"/>',
  [LAPTOP]: '<rect x="4.5" y="4" width="15" height="10.5" rx="1.5"/><path d="M2 18.5h20l-2-4H4z"/><path d="M10.5 16.5h3"/>',
};
// One picture per safety question; words carry the meaning, the picture helps.
const SAFETY_ART = {
  burning: '<path d="M12 3c1.3 3 4.8 5.2 4.8 9.6A4.8 4.8 0 0 1 7.2 13c0-2.2 1-3.6 2.3-4.6 0 2 .9 3.2 2.1 3.4-.6-2.9-.4-5.9.4-8.8z"/><path d="M5 20.5h14"/>',
  electrical: '<path d="M13.5 2.5 5 14h6.5l-1 7.5L19 10h-6.5z"/>',
  plug: '<path d="M9 2.5v5M15 2.5v5M6 7.5h12v3.8a6 6 0 0 1-12 0z"/><path d="M12 17.3v4.2"/>',
  power: '<path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.5a8 8 0 0 1 0 11"/>',
  heat: '<path d="M14 14.6V5a2 2 0 0 0-4 0v9.6a4 4 0 1 0 4 0z"/><path d="M12 9v6.5"/><path d="M18 5.5h2.5M18 9h2.5"/>',
  water: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/><path d="M9.2 14.5a3 3 0 0 0 2.8 2.8"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="2.2"/><path d="M21 10.5v3"/><path d="M7 12h3l-1 2.5M12.5 9.5l-1.5 2.5"/>',
};

// Kid-friendly words for the adult to say, and one question to ask, per step.
// The tips explain ideas only; real appliances stay with the adult.
const TEACH = {
  identify: { say: 'Every appliance has a label, like a name tag. It shows the brand and the model, which helps us check if the maker has warned people about it.', ask: 'Can you help find the brand name? Just look — a grown-up moves the appliance.' },
  check: { say: 'Electricity and heat can hurt. Smoke, sparks, a burning smell or a broken cord all mean STOP, and a grown-up gets help.', ask: 'Which clue would tell us to stop using something straight away?' },
  recall: { say: 'A recall is when the company that made something says: “We found a problem with this model. Please stop using it and we’ll fix it, swap it or give your money back.”', ask: 'Why do you think companies tell people when something has a problem?' },
  repair: { say: 'Fixing something keeps its metal and plastic in use, so fewer new things have to be made. That’s the circular economy.', ask: 'What else at home could be fixed instead of thrown away?' },
  cost: { say: 'The cheapest price today isn’t the whole story. Repairing also keeps materials in use and keeps something we already know.', ask: 'If fixing costs a bit more than buying new, what else might matter?' },
  recycle: { say: 'Old appliances have metals like copper and aluminium inside that can be made into new things. They never go in the home bin — some have batteries that can start fires in rubbish trucks.', ask: 'What’s the difference between the home bin and an e-waste drop-off?' },
  high: { say: 'When something might be dangerous, the safest thing is to step away and let a grown-up get expert help. That’s being responsible, not giving up.', ask: 'Who could we ask for help with something electrical?' },
};

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const money = value => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
const count = value => new Intl.NumberFormat('en-AU').format(Number(value) || 0);
const svg = (paths, cls = 'dc-icon') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
const icon = (name, cls) => svg(ICONS[name], cls);
const art = category => svg(ART[category] || ICONS.question, 'dc-art');
const article = word => /^[aeiou]/i.test(word) ? 'an' : 'a';
const lower = category => category === LAPTOP ? 'laptop' : category.toLowerCase();
// Only http(s) links leave the page; recall notices must come from the official site.
function safeUrl(value, hosts) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if (hosts && !hosts.includes(url.hostname)) return '';
    return url.href;
  } catch { return ''; }
}
function outLink(url, label, cls = 'dc-link', hosts) {
  const checked = safeUrl(url, hosts);
  return checked ? `<a class="${cls}" href="${escape(checked)}" target="_blank" rel="noopener noreferrer">${escape(label)}<span class="sr-only"> (opens in a new tab)</span>${icon('external', 'dc-icon dc-icon-sm')}</a>` : '';
}

// The laptop is in the 3D collection but not the reviewed lists: keep its
// identity and ask about its battery instead of borrowing another appliance.
export function planFor(category) {
  if (category === LAPTOP) return ['burning', 'electrical', 'battery', 'plug', 'power'].map(id => SAFETY_SIGNS.find(sign => sign[0] === id));
  return safetyPlanFor(category, 'guide', SAFETY_SIGNS);
}

function readParams(route) {
  if (route instanceof URLSearchParams) return route;
  return new URLSearchParams(String(route || '').split('?')[1] || '');
}

// Load the pinned map library once per document. After eight seconds or an
// error it resolves false, and the list of places keeps working on its own.
function ensureLeaflet(view) {
  if (view.L) return Promise.resolve(true);
  if (view.__dcLeaflet) return view.__dcLeaflet;
  const document = view.document;
  view.__dcLeaflet = new Promise(resolve => {
    let settled = false;
    const finish = ok => {
      if (settled) return; settled = true; view.clearTimeout(timer);
      if (!ok) { view.__dcLeaflet = null; document.querySelector('script[data-dc-leaflet]')?.remove(); }
      resolve(ok);
    };
    const timer = view.setTimeout(() => finish(false), 8000);
    if (!document.querySelector('link[data-dc-leaflet]')) {
      const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: LEAFLET.css, integrity: LEAFLET.cssHash, crossOrigin: 'anonymous' });
      css.dataset.dcLeaflet = 'true'; document.head.append(css);
    }
    const script = Object.assign(document.createElement('script'), { src: LEAFLET.js, integrity: LEAFLET.jsHash, crossOrigin: 'anonymous' });
    script.dataset.dcLeaflet = 'true';
    script.onload = () => finish(Boolean(view.L));
    script.onerror = () => finish(false);
    document.head.append(script);
  });
  return view.__dcLeaflet;
}

/** Mount the page. The router owns navigation between pages; this function owns
 * its steps (with browser Back between them), listeners, data requests, the photo
 * helper and the map, and returns one cleanup that stops all of them.
 * `services` lets tests replace data loading, the photo helper, the map loader
 * and geolocation without network access. */
export function mountDecide(host, { route = 'decide', signal, services = {} } = {}) {
  const document = host.ownerDocument;
  const view = document.defaultView;
  const controller = new view.AbortController();
  const requestFetch = (url, options = {}) => {
    const combined = new view.AbortController();
    const signals = [controller.signal, options.signal].filter(Boolean);
    const abort = () => combined.abort();
    signals.forEach(item => item.aborted ? abort() : item.addEventListener('abort', abort, { once: true }));
    return view.fetch(url, { ...options, signal: combined.signal });
  };
  const deps = {
    loadData: () => loadPublicData({}, requestFetch),
    loadPrices: () => loadPriceCatalogue(PRICE_SNAPSHOT, { fetchImpl: requestFetch }),
    mountPhoto: mountPhotoHelper,
    loadMap: () => ensureLeaflet(view),
    geolocation: view.navigator?.geolocation,
    ...services,
  };
  let storage = null;
  try { storage = view.localStorage; } catch { /* Private browsing may block storage; tips then default to on. */ }
  const reducedMotion = Boolean(view.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const params = readParams(route);
  const requested = (params.get('appliance') || '').trim().toLowerCase();
  // A URL is untrusted input. Object prototype names are not catalogue items.
  const routeCategory = (Object.hasOwn(WORLD_ITEMS, requested) ? WORLD_ITEMS[requested] : '')
    || CATEGORIES.find(item => item.toLowerCase() === requested) || '';
  let tipsOn = true;
  try { tipsOn = storage?.getItem(TIPS_KEY) !== 'off'; } catch { /* keep the default */ }

  const fresh = () => ({
    step: 'identify', group: 'all', category: routeCategory, fromPhoto: false, brand: '', model: '',
    answers: {}, optOut: false, tab: '', centre: null, areaText: '', geo: 'idle', radius: 10,
    costs: { repair: '', replacement: '' }, selectedPrice: null, comparison: null, checklist: {},
  });
  let state = fresh();
  let data = getStaticSnapshot();
  let dataLoading = true;
  let prices = { ...PRICE_SNAPSHOT, mode: 'saved-copy' };
  let disposed = false;
  let disposePhoto = () => {};
  let photoWatch = null;
  let map = null;
  let markers = new Map();
  let geoRequest = 0;
  let mapRequest = 0;

  function cleanup() {
    if (disposed) return;
    disposed = true;
    controller.abort();
    disposePhoto(); photoWatch?.disconnect();
    destroyMap();
    signal?.removeEventListener('abort', cleanup);
  }
  if (signal?.aborted) { cleanup(); return cleanup; }
  signal?.addEventListener('abort', cleanup, { once: true });
  const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: controller.signal });

  const code = () => CATEGORY_CODE_BY_NAME[state.category] || '';
  const appliance = () => ({ category: state.category, categoryCode: code(), brand: state.brand, model: state.model });
  const scrollTo = (node, block = 'start') => node?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block });

  // ---------- Outcome rules (Iteration 2 meaning, unchanged) ----------
  function recallResult() {
    if (!code()) return { status: 'outside' };
    if (dataLoading) return { status: 'loading' };
    return matchRecall(appliance(), data.recalls, data.availability.recalls);
  }
  // "I can't check this safely" keeps a reported serious warning; otherwise
  // the result is uncertain, never clear.
  function outcome() {
    const base = evaluateSafety(state.answers);
    const safety = state.optOut ? { ...base, status: base.status === 'high' ? 'high' : 'uncertain' } : base;
    const recall = recallResult();
    const decision = journeyDecision(recall.status, safety.status);
    const tabs = recall.status === 'possible' ? [] : safety.status === 'high' ? ['recycle'] : ['repair', 'cost', 'recycle'];
    return { safety, recall, decision, tabs, cautious: safety.status !== 'clear' };
  }

  // ---------- Shared pieces ----------
  function teach(key) {
    const tip = TEACH[key];
    return `<aside class="dc-teach" data-teach aria-label="Teaching tip for your child"><div><p class="dc-teach-kicker">${icon('chat', 'dc-icon dc-icon-sm')} Teach as you go</p><p><strong>Say:</strong> ${escape(tip.say)}</p><p><strong>Ask:</strong> ${escape(tip.ask)}</p></div></aside>`;
  }
  function bubble() {
    if (state.step === 'identify') return state.category ? `A ${lower(state.category)}! Let’s find out what it needs.` : 'Choose the appliance you need help with.';
    if (state.step === 'check') return 'Let’s look for warning clues — eyes only, no touching!';
    const result = outcome();
    if (result.safety.status === 'high') return 'Uh-oh. Let’s step back and let a grown-up get help.';
    if (result.recall.status === 'possible') return 'The maker may want this one back. Let’s read their notice.';
    if (result.safety.status !== 'clear') return 'Let’s ask an expert before we use it again.';
    return 'Good news! Let’s give it a second chapter.';
  }
  function heroMarkup() {
    const chips = [['shield', 'Recall check'], ['repair', 'Repair help nearby'], ['scale', 'Repair or replace costs'], ['recycle', 'E-waste drop-off']];
    return `<header class="dc-hero">
      <div class="dc-hero-copy"><p class="dc-kicker">Help with my appliance</p>
        <h1>Broken or unwanted?<br><span>Find the next step together.</span></h1>
        <p class="dc-lead">Everything you need to decide, in one place. It takes about 3 minutes.</p>
        <ul class="dc-can">${chips.map(([name, label], index) => `<li style="--dc-i:${index}">${icon(name)}${label}</li>`).join('')}</ul>
        <label class="dc-tips-toggle"><input type="checkbox" id="dc-tips"${tipsOn ? ' checked' : ''}><span class="dc-switch" aria-hidden="true"></span><span>Show teaching tips for my child</span></label>
      </div>
      <div class="dc-hero-art" aria-hidden="true"><span class="dc-orbit dc-orbit-0">${icon('shield')}</span><span class="dc-orbit dc-orbit-1">${icon('repair')}</span><span class="dc-orbit dc-orbit-2">${icon('recycle')}</span><span class="dc-orbit dc-orbit-3">${icon('scale')}</span><span class="dc-device-symbol">${art('Kettle')}</span><p class="dc-bubble" data-bubble>${escape(bubble())}</p></div>
    </header>`;
  }

  function progressMarkup() {
    const steps = [['identify', 'Your appliance'], ['check', 'Safety check'], ['options', 'Your options']];
    const current = steps.findIndex(([id]) => id === state.step);
    return `<nav class="dc-progress" aria-label="Your progress" style="--dc-progress:${current / 2}"><ol>${steps.map(([id, label], index) => {
      const done = index < current;
      const inner = `<span class="dc-dot">${done ? icon('check') : index + 1}</span><span class="dc-progress-label"><small>Step ${index + 1}</small>${label}</span>`;
      return `<li class="${done ? 'is-done' : ''}"${index === current ? ' aria-current="step"' : ''}>${done ? `<button type="button" data-back-step="${id}" aria-label="Back to step ${index + 1}: ${label}">${inner}</button>` : `<span class="dc-progress-item">${inner}</span>`}</li>`;
    }).join('')}</ol></nav>`;
  }

  // ---------- Step 1: identify ----------
  function tilesMarkup() {
    const visible = GROUPS.find(([id]) => id === state.group)[2];
    return CATEGORIES.map((category, index) => `<button type="button" class="dc-tile${state.category === category ? ' is-picked' : ''}" data-tile="${escape(category)}" aria-pressed="${state.category === category}"${visible.includes(category) ? '' : ' hidden'} style="--dc-i:${index}"><span class="dc-tile-art">${art(category)}</span><span class="dc-tile-name">${escape(category)}</span><span class="dc-tile-check" aria-hidden="true">${icon('check')}</span></button>`).join('');
  }

  function detailsMarkup() {
    if (!state.category) return '';
    const questions = planFor(state.category).length;
    return `<form class="dc-details" id="dc-details" novalidate aria-labelledby="dc-details-title">
      <div class="dc-chosen"><span class="dc-chosen-art">${art(state.category)}</span><div><small>Your appliance</small><strong id="dc-details-title" tabindex="-1">${escape(state.category)}</strong>${state.fromPhoto ? `<em>${icon('spark', 'dc-icon dc-icon-sm')} Suggested by your photo, confirmed by you</em>` : ''}</div><button type="button" class="dc-text-btn" data-change-item>Change</button></div>
      ${state.category === LAPTOP ? `<p class="dc-note">${icon('info')}<span>Laptops aren’t in our reviewed recall or price records yet. We’ll still do the safety check and help you find repair help or a drop-off.</span></p>` : ''}
      <div class="dc-details-head"><h3>Do you know the brand or model? <span class="dc-optional">Optional</span></h3><p>It’s okay if you don’t. With the model number we can check recall records for your exact model and look for recorded prices.</p></div>
      <div class="dc-fields">
        <label class="dc-field" for="dc-brand">Brand<input id="dc-brand" name="brand" maxlength="60" autocomplete="off" list="dc-brands" value="${escape(state.brand)}" placeholder="e.g. Breville" aria-describedby="dc-brand-error"><datalist id="dc-brands"></datalist><span class="dc-error" id="dc-brand-error" role="alert"></span></label>
        <label class="dc-field" for="dc-model">Model number<input id="dc-model" name="model" maxlength="50" autocomplete="off" list="dc-models" value="${escape(state.model)}" placeholder="From the label" aria-describedby="dc-model-error"><datalist id="dc-models"></datalist><span class="dc-error" id="dc-model-error" role="alert"></span></label>
      </div>
      <details class="dc-label-help"><summary>${icon('tag')} Where is the model number?</summary><div class="dc-label-body"><div class="dc-label-demo" role="img" aria-label="Example appliance label showing the brand and model number"><span>APPLIANCE LABEL</span><strong>Brand: Example</strong><b>Model: ABC-123</b><small>230–240 V ~ 50 Hz</small></div><p>Look for a sticker on the back or base, or check the manual or receipt. It may say <strong>Model</strong>, <strong>Model No.</strong> or <strong>M/N</strong>. Don’t open the appliance, and don’t move it if it’s hot or damaged.</p></div></details>
      <div class="dc-actions"><button class="dc-btn dc-btn-go" type="submit">Next: ${questions} quick safety questions ${icon('arrow')}</button></div>
    </form>`;
  }

  function identifyMarkup() {
    return `<section class="dc-step" aria-labelledby="dc-step-title">
      <div class="dc-step-head"><p class="dc-kicker">Step 1 of 3</p><h2 id="dc-step-title" tabindex="-1">Which appliance needs help?</h2><p>Take a photo or tap its picture. You don’t need to know what’s wrong with it.</p></div>
      <div class="dc-identify" data-identify>
        <div class="dc-photo-col"><p class="dc-ai-badge">${icon('spark')} On-device AI · your photo stays on this device</p><div class="dc-photo" data-photo></div></div>
        <div class="dc-pick"><h3 class="dc-pick-title" data-pick-title>Tap your appliance</h3>
          <div class="dc-chips" role="group" aria-label="Show appliances by type">${GROUPS.map(([id, label]) => `<button type="button" class="dc-chip" data-group="${id}" aria-pressed="${state.group === id}">${label}</button>`).join('')}</div>
          <div class="dc-tiles" data-tiles>${tilesMarkup()}</div></div>
      </div>
      <div data-details-host>${detailsMarkup()}</div>
      ${teach('identify')}
    </section>`;
  }

  // ---------- Step 2: safety check ----------
  function questionMarkup([id, fallback], index, total) {
    const help = SAFETY_HELP[id] || {};
    const answer = state.answers[id] || '';
    return `<fieldset class="dc-q" data-question="${id}" data-answer="${answer}" data-severity="${SAFETY_RULES[id]?.severity || 'caution'}">
      <legend><span class="dc-q-art">${svg(SAFETY_ART[id] || ICONS.question, 'dc-icon')}</span><span class="dc-q-text"><small>Question ${index + 1} of ${total}</small>${escape(help.question || fallback)}</span></legend>
      <div class="dc-answers">${[['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']].map(([value, label]) => `<label class="dc-answer dc-answer-${value}"><input type="radio" name="q-${id}" value="${value}"${answer === value ? ' checked' : ''}><span>${label}</span></label>`).join('')}</div>
      <details class="dc-q-help"><summary>${icon('question', 'dc-icon dc-icon-sm')} ${escape(help.title || 'What does this mean?')}</summary><p>${escape(help.meaning || SAFETY_RULES[id]?.explanation || '')}</p><p class="dc-small">${escape(help.example || 'Only answer from what you already noticed.')}</p></details>
    </fieldset>`;
  }

  function checkMarkup() {
    const plan = planFor(state.category);
    const result = outcome();
    const identity = [state.brand, state.model].filter(Boolean).join(' ');
    return `<section class="dc-step" aria-labelledby="dc-step-title">
      <div class="dc-step-head dc-step-head-row"><div><p class="dc-kicker">Step 2 of 3</p><h2 id="dc-step-title" tabindex="-1">Quick safety check</h2><p>${plan.length} short questions about your ${escape(lower(state.category))}. Answer only from what you’ve already noticed.</p></div><span class="dc-item-pill">${art(state.category)}<span><strong>${escape(state.category)}</strong>${identity ? `<small>${escape(identity)}</small>` : ''}</span></span></div>
      <ul class="dc-rules"><li class="is-do">${icon('check')}Answer from what you’ve already seen, heard or smelled.</li><li class="is-dont">${icon('cross')}Don’t switch it on, open it or touch damaged parts to check.</li></ul>
      ${result.recall.status === 'possible' ? recallMarkup(result.recall) : ''}
      <form id="dc-safety" novalidate>
        <div class="dc-questions">${plan.map((sign, index) => questionMarkup(sign, index, plan.length)).join('')}</div>
        <div class="dc-alert" data-immediate role="alert" hidden></div>
        <p class="dc-error" id="dc-safety-error" role="alert"></p>
        <div class="dc-check-bar"><p class="dc-count" data-count role="status" aria-live="polite"></p><button type="button" class="dc-text-btn" data-cant>I can’t check this safely</button><button class="dc-btn dc-btn-go" type="submit">See our options ${icon('arrow')}</button></div>
      </form>
      ${teach('check')}
      <button type="button" class="dc-text-btn dc-back" data-back-step="identify">${icon('back')} Change appliance</button>
    </section>`;
  }

  // ---------- Step 3: options ----------
  function recallMarkup(recall) {
    const meta = data.datasetMeta?.recalls || {};
    const source = data.availability.recalls ? `<p class="dc-source">Source: ACCC Product Safety. ${escape(meta.limitation || 'Limited reviewed records; not a complete live register.')}</p>` : '';
    const official = (label = 'Open the official recall search', cls = 'dc-btn dc-btn-soft') => outLink(RECALL_SOURCE, label, cls);
    const card = (tone, symbol, title, body, extra = '') => `<section class="dc-recall is-${tone}" aria-labelledby="dc-recall-title"><span class="dc-recall-icon">${icon(symbol)}</span><div><p class="dc-kicker">Recall check</p><h3 id="dc-recall-title">${title}</h3>${body}${extra}</div></section>`;
    if (recall.status === 'loading') return card('loading', 'shield', 'Checking our recall records…', '<p>This usually takes a moment. You can keep reading.</p>');
    if (recall.status === 'outside') return card('neutral', 'shield', `Check the official recall search for your ${escape(lower(state.category))}.`, '<p>Our reviewed recall records don’t cover this item, so we haven’t checked it.</p>', `<div class="dc-row">${official()}</div>`);
    if (recall.status === 'unavailable') return card('neutral', 'shield', 'We can’t check our recall records right now.', '<p>Use the official Australian recall search with the brand and model from the label.</p>', `<div class="dc-row">${official()}</div>`);
    if (recall.status === 'insufficient') return card('neutral', 'tag', 'Add the model number for a recall check.', '<p>A brand or appliance type alone can’t tell us whether your item is affected. A <strong>product recall</strong> is an official notice asking people to stop using, repair or return a product.</p>', `<div class="dc-row"><button type="button" class="dc-btn dc-btn-soft" data-add-model>${icon('tag')} Add the model number</button>${official('Official recall search', 'dc-link')}</div>${source}`);
    if (recall.status === 'none') return card('clear', 'shield', 'Your exact model isn’t in our recall list.', `${recall.near?.length ? '<p class="dc-warn-line">The model you typed is very close to one in our list. Check the label again before relying on this.</p>' : ''}<p><strong>This doesn’t prove there’s no recall.</strong> Our list is small and recent, so check the official search too.</p>`, `<div class="dc-row">${official('Check the official recall search')}</div>${source}`);
    const match = recall.match || {};
    const notice = safeUrl(match.noticeUrl, RECALL_HOSTS) || RECALL_SOURCE;
    return card('warning', 'alert', 'Your model may be affected by a product recall.', `<p>We found a possible match: <strong>${escape([match.brand, match.productName || match.title].filter(Boolean).join(' '))}</strong>.</p>${recall.brandConflict ? '<p class="dc-warn-line">The model matches, but the brand you typed is different. Check the official notice carefully.</p>' : ''}<p>FixForward can’t confirm that your exact appliance is affected. The official notice may also use serial numbers, dates or other details.</p>`, `<div class="dc-row">${outLink(notice, 'Read the official notice', 'dc-btn dc-btn-danger')}</div>${source}`);
  }

  function verdictMarkup(result) {
    const { safety, recall } = result;
    const status = safety.status;
    const recallFirst = recall.status === 'possible';
    const reported = (ids, tone) => ids.length ? `<ul class="dc-reported is-${tone}">${ids.map(id => `<li>${svg(SAFETY_ART[id] || ICONS.alert, 'dc-icon')}<span><strong>${escape(SAFETY_HELP[id]?.question || id)}</strong>${escape(SAFETY_RULES[id]?.explanation || '')}</span></li>`).join('')}</ul>` : '';
    const copy = {
      high: ['Serious safety warning', 'Stop using this appliance for now.', '<p>You told us about a warning sign that could be unsafe. Switch it off and unplug it <strong>only if it’s safe to do so</strong>. Don’t keep testing it.</p>'],
      caution: ['Your next step', 'Ask a repairer to check it before using it again.', '<p>Contact the manufacturer or a qualified appliance repairer. Explain what happened and ask whether they can assess this model and what an inspection costs.</p><p class="dc-small">Your answers help us suggest a next step. They don’t identify the fault.</p>'],
      uncertain: ['Some uncertainty remains', 'Get advice before using it again.', state.optOut
        ? '<p>That’s okay. You chose not to check further, so we’ll suggest a cautious next step.</p>'
        : '<p>One or more answers were “Not sure”. That doesn’t mean something is definitely wrong, and it doesn’t mean the appliance is safe. Don’t test it again just to get a clearer answer.</p>'],
      clear: recallFirst ? ['Possible product recall', 'Check the official notice before doing anything else.', '<p>Your model may match a reviewed product safety notice. Even with no warning sign reported, the official recall instructions come before ordinary repair, replacement or recycling.</p>']
        : ['Your options', 'No warning signs reported. Here’s what you can do next.', '<p>You didn’t report any of the warning signs in our quick check. <strong>This isn’t a guarantee that the appliance is safe.</strong></p>'],
    }[status];
    const tone = status === 'high' || recallFirst ? 'warning' : status === 'clear' ? 'clear' : 'caution';
    const symbol = tone === 'warning' ? 'alert' : tone === 'clear' ? 'check' : 'info';
    const facts = [['Checked', state.category], ['Warning signs', safety.critical.length ? `${safety.critical.length} serious` : safety.caution.length ? `${safety.caution.length} to check` : safety.unsure.length || state.optOut ? 'Not sure' : 'None reported'], ['Important', 'Not a safety certificate']];
    return `<section class="dc-verdict is-${tone}" aria-labelledby="dc-step-title">
      <div class="dc-verdict-top"><span class="dc-verdict-icon">${icon(symbol)}</span><div><p class="dc-kicker">Step 3 of 3 · ${copy[0]}</p><h2 id="dc-step-title" tabindex="-1">${copy[1]}</h2>${copy[2]}</div></div>
      ${status === 'high' ? reported(safety.critical, 'high') : status === 'caution' ? reported(safety.caution, 'caution') : ''}
      <dl class="dc-facts">${facts.map(([term, value]) => `<div><dt>${term}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>
    </section>`;
  }

  function nowStepsMarkup() {
    return `<section class="dc-now" aria-labelledby="dc-now-title"><h3 id="dc-now-title">What should we do now?</h3><ol>
      <li><span>1</span><div><strong>Don’t use it again for now</strong><p>A serious warning sign needs a safer next step than a community repair event.</p></div></li>
      <li><span>2</span><div><strong>Have it checked by a qualified appliance repairer or electrician</strong><p>Tell them what you noticed. Don’t keep switching it on to test it yourself.</p></div></li>
    </ol><div class="dc-row">${outLink(ENERGY_SAFE, 'Energy Safe Victoria guidance', 'dc-btn dc-btn-go')}${outLink(RECALL_SOURCE, 'Check recalls', 'dc-btn dc-btn-soft')}</div></section>`;
  }

  function tabsMarkup(result) {
    if (!result.tabs.length) return '';
    if (!result.tabs.includes(state.tab)) state.tab = result.tabs[0];
    const labels = {
      repair: result.cautious ? ['repair', 'Ask about repair', 'Qualified advice first'] : ['repair', 'Repair it', 'Help near you'],
      cost: ['scale', result.cautious ? 'Repair or replace?' : 'Compare costs', 'Repair vs new'],
      recycle: result.safety.status === 'high' ? ['recycle', 'Plan disposal', 'Don’t move it yet'] : ['recycle', 'Recycle it', 'E-waste drop-off'],
    };
    return `<section class="dc-choices" aria-labelledby="dc-choices-title"><h3 id="dc-choices-title" class="dc-choices-title">${result.safety.status === 'high' ? 'Need to get rid of it?' : result.cautious ? 'You can still explore your options' : 'Choose a next step'}</h3>
      ${result.cautious && result.safety.status !== 'high' ? '<p class="dc-choices-note">We can’t recommend repair or replacement while safety is unclear. These help you gather information — get advice before using the appliance again.</p>' : ''}
      <div class="dc-tabs" role="tablist" aria-label="Next-step options">${result.tabs.map(id => `<button type="button" role="tab" id="dc-tab-${id}" class="dc-tab dc-tab-${id}" data-tab="${id}" aria-controls="dc-panel" aria-selected="${state.tab === id}" tabindex="${state.tab === id ? 0 : -1}">${icon(labels[id][0])}<span><strong>${labels[id][1]}</strong><small>${labels[id][2]}</small></span></button>`).join('')}</div>
      <div class="dc-panel" id="dc-panel" role="tabpanel" aria-labelledby="dc-tab-${state.tab}" data-panel>${panelMarkup(result)}</div>
    </section>`;
  }

  function momentMarkup() {
    const worldId = Object.keys(WORLD_ITEMS).find(key => WORLD_ITEMS[key] === state.category);
    return `<section class="dc-moment" data-teach><span class="dc-moment-symbol" aria-hidden="true">${icon('game')}</span><div><p class="dc-kicker">Turn it into a learning moment</p><h3>Practise the same choice together.</h3><p>In Fix-it Station your child drags appliances to repair, reuse or recycling — the same thinking you just used.</p>
      <div class="dc-row"><a class="dc-btn dc-btn-go" href="#learn?game=fix-it">${icon('game')} Play Fix-it Station</a>${worldId ? `<a class="dc-btn dc-btn-soft" href="#explore?appliance=${worldId}">${icon('cube')} See inside ${article(lower(state.category))} ${escape(lower(state.category))} in 3D</a>` : ''}</div></div></section>`;
  }

  function optionsMarkup() {
    const result = outcome();
    const recallBlocks = result.recall.status === 'possible';
    return `<div class="dc-step dc-options">
      ${verdictMarkup(result)}
      ${result.safety.status === 'high' ? nowStepsMarkup() : ''}
      <div class="dc-recall-wrap">${recallMarkup(result.recall)}${result.safety.status === 'high' ? '' : teach('recall')}</div>
      ${result.safety.status === 'high' ? teach('high') : ''}
      ${recallBlocks ? '<p class="dc-paused">Repair, cost and recycling choices are paused until you’ve read the official recall instructions.</p>' : tabsMarkup(result)}
      ${momentMarkup()}
      <div class="dc-end"><button type="button" class="dc-btn dc-btn-soft" data-back-step="check">${icon('back')} Review my answers</button><button type="button" class="dc-text-btn" data-restart>Start again with another appliance</button><p>Information and budgeting help only. You choose the next step.</p></div>
    </div>`;
  }

  // ---------- Option panels ----------
  function bannerMarkup(tone, title, text) {
    return `<div class="dc-banner is-${tone}">${icon(tone === 'clear' ? 'check' : 'alert')}<div><strong>${title}</strong><p>${text}</p></div></div>`;
  }

  function panelMarkup(result) {
    if (state.tab === 'cost') return costMarkup(result);
    if (state.tab === 'recycle') return placesPanelMarkup('recycle', result);
    return placesPanelMarkup('repair', result);
  }

  function repairRows(result) {
    return data.locations.filter(row => row?.pathway === 'repair' && (!result.cautious || QUALIFIED_REPAIR.includes(row.providerType)));
  }

  function placesPanelMarkup(kind, result) {
    const repair = kind === 'repair';
    const item = escape(lower(state.category));
    const banner = repair
      ? result.cautious
        ? bannerMarkup('caution', 'Ask a qualified repairer for advice first.', 'Safety is still unclear. Ask whether they can assess this appliance before anyone uses it. Community Repair Cafés aren’t included on this path.')
        : bannerMarkup('clear', 'Quick check done.', 'You didn’t report a serious warning sign. This isn’t a guarantee that the appliance is safe.')
      : result.safety.status === 'high'
        ? bannerMarkup('warning', 'Don’t transport it while it’s hot, smoking, leaking or actively damaged.', 'You reported a serious warning sign. Use this list for planning only, and contact the facility or an appropriate safety service before moving it.')
        : result.cautious
          ? bannerMarkup('caution', 'Contact the facility before moving it.', 'Tell them what you noticed. If it’s hot, smoking, leaking or actively damaged, don’t transport it until you have safety advice.')
          : '';
    const intro = repair
      ? result.cautious
        ? '<h3>Ask a qualified repairer first</h3><p>Contact the manufacturer, the shop you bought it from, or a qualified appliance repairer.</p>'
        : `<h3>Find repair help near you</h3><p>Repair Cafés are community events where volunteers help people fix things. Call or check their website before you go, to make sure they can help with your ${item}.</p>`
      : `<h3>Find an e-waste drop-off near you</h3><p>These are recorded recycling and transfer stations. Contact them to check they accept your ${item} before you travel.</p>`;
    // The records may hold no qualified repair businesses. Say so plainly
    // rather than showing an empty search that looks like "nothing nearby".
    const noQualified = repair && result.cautious && !dataLoading && data.availability.locations && !repairRows(result).length;
    const finder = noQualified
      ? `<div class="dc-empty">${icon('repair')}<div><strong>Our records only list community Repair Cafés for repair.</strong><p>They aren’t the right first stop when a fault may need checking. Contact the manufacturer, the shop you bought it from, or a qualified appliance repairer, and ask whether they can assess it.</p><div class="dc-row">${outLink(ENERGY_SAFE, 'Electrical safety guidance', 'dc-btn dc-btn-soft')}</div></div></div>`
      : finderMarkup(kind);
    const ask = repair ? `<div class="dc-ask">${icon('chat')}<div><strong>Before you call, have ready:</strong><p>The brand, the model and what you noticed. Ask whether they work on this type of appliance, whether there’s an assessment fee, and when they could look at it.</p></div></div>` : '';
    const directory = repair
      ? result.cautious ? '' : `<div class="dc-finder-card">${icon('repair')}<div><h4>Repair Café directory</h4><p>Find more community repair events and ask what the volunteers can work on. A suspected electrical fault needs qualified advice.</p>${outLink(REPAIR_CAFE, 'Open the Repair Café directory', 'dc-btn dc-btn-soft')}</div></div>`
      : `<div class="dc-finder-card">${icon('recycle')}<div><h4>Victorian e-waste guidance</h4><p>In Victoria, e-waste doesn’t go in household rubbish or recycling bins. The guide explains your options, including your council’s drop-off points.</p>${outLink(EWASTE_GUIDE, 'Open the e-waste guide', 'dc-btn dc-btn-soft')}</div></div>`;
    const checklist = repair ? '' : `<div class="dc-checklist"><h4>Before you go</h4><p class="dc-small">Tick what you’ve checked together. This is a plan, not a record of a visit.</p>${[['accepts', `The place accepts our ${item}.`], ['hours', 'We checked opening times, bookings and any fee.'], ['travel', 'We know how we’ll get it there safely.']].map(([id, label]) => `<label><input type="checkbox" data-check="${id}"${state.checklist[id] ? ' checked' : ''}><span>${label}</span></label>`).join('')}<p class="dc-check-status" data-check-status role="status">${checkStatus()}</p></div>`;
    return `<div class="dc-panel-inner">${banner}<div class="dc-panel-head">${intro}</div>${finder}${ask}${repair && !result.cautious ? historyMarkup() : ''}${directory}${checklist}${teach(repair ? 'repair' : 'recycle')}</div>`;
  }

  function checkStatus() {
    const done = Object.values(state.checklist).filter(Boolean).length;
    return done === 3 ? 'Your plan is ready. You decide when to go.' : `${done} of 3 checked`;
  }

  function finderMarkup(kind) {
    const centre = state.centre;
    return `<div class="dc-finder" data-finder="${kind}">
      <div class="dc-finder-controls">
        <button type="button" class="dc-btn dc-btn-soft dc-locate" data-locate${state.geo === 'loading' ? ' disabled' : ''}>${icon('locate')} ${state.geo === 'loading' ? 'Finding you…' : centre?.user ? 'Update my location' : 'Use my location'}</button>
        <span class="dc-or">or</span>
        <form class="dc-area" id="dc-area-form" role="search" novalidate><label class="sr-only" for="dc-area">Suburb or postcode</label><div class="dc-area-row">${icon('search')}<input id="dc-area" name="area" maxlength="50" autocomplete="off" value="${escape(state.areaText)}" placeholder="Suburb or postcode, e.g. Clayton" aria-describedby="dc-area-error" aria-controls="dc-area-options"><button type="submit" class="dc-btn dc-btn-go">Search</button></div><div id="dc-area-options" class="dc-area-options" data-area-options></div><p class="dc-error" id="dc-area-error" role="alert"></p></form>
        <label class="dc-radius" for="dc-radius">Within<select id="dc-radius">${[5, 10, 25, 50].map(km => `<option value="${km}"${state.radius === km ? ' selected' : ''}>${km} km</option>`).join('')}</select></label>
      </div>
      ${state.geo === 'denied' ? '<p class="dc-small">Location wasn’t available. That’s okay — type your suburb or postcode instead.</p>' : ''}
      <p class="dc-small dc-privacy">${icon('lock', 'dc-icon dc-icon-sm')} Your location is only used on this device to sort places. It isn’t saved.</p>
      <div class="dc-results" data-results>${resultsMarkup(kind)}</div>
    </div>`;
  }

  function searchResult(kind) {
    if (dataLoading) return { mode: 'loading' };
    if (!data.availability.locations) return { mode: 'unavailable' };
    if (!state.centre) return { mode: 'empty' };
    if (state.centre.unlocated) return { mode: 'unlocated' };
    const rows = kind === 'repair' ? repairRows(outcome()) : data.locations;
    return getNearbyLocations(state.centre, kind === 'repair' ? 'repair' : 'dispose', rows, { radiusKm: state.radius, limit: 8 });
  }

  function resultsMarkup(kind) {
    const result = searchResult(kind);
    const finder = kind === 'repair' ? outLink(REPAIR_CAFE, 'Search the Repair Café directory', 'dc-link') : outLink(EWASTE_GUIDE, 'Use the Victorian e-waste guide', 'dc-link');
    const message = (title, text) => `<div class="dc-places-empty" role="status">${icon('pin')}<div><strong>${title}</strong><p>${text}</p>${finder}</div></div>`;
    if (result.mode === 'loading') return message('Loading the place records…', 'Your search will be ready in a moment.');
    if (result.mode === 'unavailable') return message('Place records are unavailable right now.', 'We haven’t searched or confirmed any places. You can still use the official finder.');
    if (result.mode === 'empty') return `<div class="dc-places-empty is-prompt">${icon('pin')}<div><strong>Where are you?</strong><p>Use your location or type a Melbourne suburb or postcode to see places on a map.</p></div></div>`;
    if (result.mode === 'unlocated') return message(`We couldn’t place postcode ${escape(state.centre.postcode)} on our map.`, 'No distances were calculated. Try a nearby suburb name, or use the official finder.');
    if (!result.matches.length) return message(`No recorded places within ${state.radius} km of ${escape(state.centre.label)}.`, 'Try a wider distance. This doesn’t mean there’s nothing nearby — our records have limited coverage.');
    return `<div class="dc-map" data-map aria-label="Map of the places listed"></div>
      <div class="dc-places" role="status" aria-live="polite"><p class="dc-places-head"><strong>${count(result.total)} place${result.total === 1 ? '' : 's'} within ${state.radius} km</strong><span>Nearest to ${escape(state.centre.label)}</span></p>
      <ol class="dc-place-list">${result.matches.map((place, index) => placeMarkup(place, index, kind)).join('')}</ol>
      <p class="dc-small">Map data © OpenStreetMap contributors. Distances are straight-line estimates — use Directions for the real route.</p></div>`;
  }

  function placeMarkup(place, index, kind) {
    // Some records already include the suburb and postcode in the street address.
    const street = String(place.address || '');
    const address = [street, ...[place.suburb, place.postcode].filter(part => part && !street.toLowerCase().includes(String(part).toLowerCase()))].filter(Boolean).join(', ');
    const phone = String(place.phone || '').replace(/[^0-9+]/g, '');
    const directions = locationHasCoordinates(place) ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.latitude)},${encodeURIComponent(place.longitude)}` : '';
    return `<li class="dc-place" data-place="${escape(place.id)}" style="--dc-i:${index}">
      <span class="dc-place-num" aria-hidden="true">${index + 1}</span>
      <div class="dc-place-body"><p class="dc-place-type">${escape(PROVIDER_LABELS[place.providerType] || place.type || (kind === 'repair' ? 'Repair option' : 'Recycling place'))} · about ${Number(place.distanceKm).toFixed(1)} km</p>
        <h4>${escape(place.name)}</h4><p>${escape(address || 'Address not recorded')}</p>${place.openingHours ? `<p class="dc-small">${icon('clock', 'dc-icon dc-icon-sm')} ${escape(place.openingHours)}</p>` : ''}
        <div class="dc-place-actions">${locationHasCoordinates(place) ? `<button type="button" class="dc-mini" data-show="${escape(place.id)}">${icon('pin', 'dc-icon dc-icon-sm')} Map</button>` : ''}${directions ? outLink(directions, 'Directions', 'dc-mini') : ''}${phone ? `<a class="dc-mini" href="tel:${escape(phone)}">${icon('phone', 'dc-icon dc-icon-sm')} Call</a>` : ''}${outLink(place.url, 'Website', 'dc-mini')}</div>
        <details class="dc-place-about"><summary>About this listing</summary><p>${escape(place.verificationNote || 'FixForward hasn’t checked this place. Contact them before visiting.')}</p><p>Information date: ${escape(place.sourceRetrievedAt || 'not supplied')}</p>${outLink(place.sourceUrl, 'Where this came from', 'dc-link')}</details>
      </div></li>`;
  }

  // Background history for similar appliances, never a prediction for this one.
  function historyMarkup() {
    if (dataLoading || !data.availability.repairEvidence) return '';
    const mapped = EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY[code()];
    const evidence = mapped ? data.repairEvidence.find(row => row.categoryCode === mapped) : null;
    if (!evidence?.sampleSize) return `<div class="dc-history is-empty"><h4>Have similar appliances been fixed before?</h4><p>We don’t have enough repair history for this type yet. That doesn’t mean it can’t be repaired.</p></div>`;
    const sample = Number(evidence.sampleSize) || 0;
    const fixed = Math.max(0, Number(evidence.fixedCount) || 0);
    const repairable = Math.max(0, Number(evidence.repairableCount) || 0);
    const other = Math.max(0, sample - fixed - repairable);
    const width = value => sample ? (value / sample * 100).toFixed(2) : 0;
    const pct = value => sample ? Math.round(value / sample * 100) : 0;
    const area = evidence.geography === 'AU' ? 'Australian' : 'global';
    return `<div class="dc-history"><h4>Have similar appliances been fixed before?</h4>
      <p class="dc-history-big"><strong>${count(fixed)}</strong> of ${count(sample)} were fixed at recorded community repair events. Another ${count(repairable)} were repairable with more work.</p>
      <div class="dc-history-bar" role="img" aria-label="Of ${count(sample)} recorded ${area} community repair attempts, ${count(fixed)} were fixed at the event, ${count(repairable)} were repairable with more work and ${count(other)} had other outcomes."><span class="is-fixed" style="--w:${width(fixed)}%"></span><span class="is-more" style="--w:${width(repairable)}%"></span><span class="is-other" style="--w:${width(other)}%"></span></div>
      <ul class="dc-history-key"><li><i class="is-fixed"></i>${pct(fixed)}% fixed at the event</li><li><i class="is-more"></i>${pct(repairable)}% repairable with more work</li><li><i class="is-other"></i>${Math.max(0, 100 - pct(fixed) - pct(repairable))}% other outcomes</li></ul>
      <details class="dc-q-help"><summary>How was this worked out?</summary><p>Open Repair Alliance community repair history for this kind of appliance (${escape(area)} records), not your exact brand or model. It’s background, not a prediction for yours.</p><p>${escape(evidence.limitation || 'Community repair data is self-selected and may not represent all household repairs.')}</p></details></div>`;
  }

  function repairFees() {
    return Array.isArray(prices.repairFees) && prices.repairFees.length ? prices.repairFees
      : COST_CONTEXT_SOURCES.flatMap(item => item.secondaryAmount ? [item, { ...item, id: `${item.id}-labour-cap`, label: 'Published labour cap including call-out', amount: item.secondaryAmount }] : [item]);
  }

  function costMarkup(result) {
    const banner = result.safety.status === 'uncertain'
      ? bannerMarkup('caution', 'Explore costs while you arrange safety advice.', 'We can’t recommend repair or replacement while safety is unclear. A lower price doesn’t mean the appliance is safe to use.')
      : result.safety.status === 'caution'
        ? bannerMarkup('caution', 'You reported something that needs attention.', 'Use these figures for planning, but don’t let a lower price be a reason to keep using an appliance that should be checked.')
        : '';
    const auto = automaticCostContext(prices.prices, prices.repairFees, appliance());
    const range = (min, max) => min === max ? money(min) : `${money(min)}–${money(max)}`;
    const autoCard = auto.available
      ? `<div class="dc-auto"><p class="dc-kicker">Starting figures we found</p><div class="dc-auto-grid"><div class="is-repair">${icon('repair')}<span>Repair service fees</span><strong>${range(auto.repairMin, auto.repairMax)}</strong><small>Published inspection, call-out or labour-limit examples. Parts and extra work may cost more.</small></div><div class="is-new">${icon('tag')}<span>Replacement prices</span><strong>${range(auto.replacementMin, auto.replacementMax)}</strong><small>${auto.replacementRows.length} recorded ${auto.match === 'exact' ? 'same-model' : auto.match === 'brand' ? 'same-brand' : 'same-type'} ${auto.replacementRows.length === 1 ? 'price' : 'prices'} before delivery. Check today’s price.</small></div></div><p class="dc-small">These cover different things, so we don’t call either one cheaper. For a real comparison, use a quote below.</p></div>`
      : `<div class="dc-auto is-empty"><p class="dc-kicker">Starting figures</p><p>We don’t have both a recorded replacement price and a service-fee example for this appliance yet. You can still compare your own figures below.</p></div>`;
    const c = state.comparison;
    const largest = c?.valid ? Math.max(c.repair, c.replacement) || 1 : 1;
    const comparison = c?.valid ? `<div class="dc-compare-result" tabindex="-1" data-compare-result><h4>${c.lower === 'equal' ? 'The two upfront prices are the same.' : `${c.lower === 'repair' ? 'Repair' : 'Replacing it'} is <span>${money(c.difference)}</span> lower upfront.`}</h4>
      <div class="dc-bars" role="img" aria-label="Repair quote ${money(c.repair)}. Replacement price ${money(c.replacement)}."><div><span>Repair</span><i class="is-repair" style="--w:${(c.repair / largest * 100).toFixed(2)}%"></i><strong>${money(c.repair)}</strong></div><div><span>Replace</span><i class="is-new" style="--w:${(c.replacement / largest * 100).toFixed(2)}%"></i><strong>${money(c.replacement)}</strong></div></div>
      <p><strong>Price is only one part of the decision.</strong> Safety, recall instructions, whether repair is possible, the appliance’s condition and waste impact can also matter.</p></div>` : '';
    const rows = matchPriceExamples(prices.prices, appliance());
    const status = prices.mode === 'database' ? 'Price records loaded. Prices are dated observations, not live offers.' : prices.mode === 'unavailable' ? 'The price records are unavailable. You can still enter a price you found.' : 'Showing the saved price records. Check today’s price with the retailer.';
    const usable = row => !row.stale && !row.offerExpired && row.availability !== 'out-of-stock';
    const priceCards = rows.length ? `<ul class="dc-price-list">${rows.map(row => `<li class="dc-price"><span class="dc-price-match">${row.match === 'exact' ? 'Same brand and model' : row.match === 'brand' ? 'Same brand' : 'Same type'}</span><h5>${escape(row.productName)}</h5><p class="dc-small">${escape(row.brand)} · Model ${escape(row.model)}</p><strong class="dc-price-amount">${money(row.priceAud)}</strong><p class="dc-small">${escape(row.retailer)} · reviewed ${escape(row.observedAt)}${row.stale ? ' · older than 90 days' : ''}${row.offerExpired ? ' · offer ended' : ''}${row.availability === 'out-of-stock' ? ' · out of stock' : ''}</p><div class="dc-row">${usable(row) ? `<button type="button" class="dc-mini" data-use-price="${escape(row.id)}">Use ${money(row.priceAud)}<span class="sr-only"> for ${escape(row.productName)}</span></button>` : ''}${outLink(row.sourceUrl, 'Retailer page', 'dc-link')}</div></li>`).join('')}</ul>` : `<p class="dc-empty-line">No recorded replacement prices for this appliance yet. Enter a price you found for something similar.</p>`;
    return `<div class="dc-panel-inner">${banner}
      <div class="dc-panel-head"><h3>Repair or replace: compare the cost</h3><p>Put a repair quote next to a replacement price. No guessed repair prices and no invented savings.</p></div>
      ${autoCard}
      <form class="dc-cost-form" id="dc-cost-form" novalidate><h4>Already have prices? Compare them</h4>
        <div class="dc-fields"><label class="dc-field" for="dc-repair">Repair quote<span class="dc-money"><b>$</b><input id="dc-repair" name="repair" inputmode="decimal" maxlength="24" value="${escape(state.costs.repair)}" placeholder="e.g. 180" aria-describedby="dc-repair-hint dc-repair-error"></span><small id="dc-repair-hint">From a repairer, with parts and labour. Use 0 only for a confirmed free repair.</small><span class="dc-error" id="dc-repair-error"></span></label>
        <label class="dc-field" for="dc-replacement">Replacement price<span class="dc-money"><b>$</b><input id="dc-replacement" name="replacement" inputmode="decimal" maxlength="24" value="${escape(state.costs.replacement)}" placeholder="e.g. 320" aria-describedby="dc-replacement-hint dc-replacement-error"></span><small id="dc-replacement-hint">For a similar item you found. Include delivery if you’d pay it.</small><span class="dc-error" id="dc-replacement-error"></span></label></div>
        ${state.selectedPrice ? `<p class="dc-note" data-price-note>${icon('tag')}<span>Using a recorded ${escape(state.selectedPrice.retailer)} price for ${escape(state.selectedPrice.productName)}, reviewed ${escape(state.selectedPrice.observedAt)}. Check today’s price and add any delivery or installation.</span></p>` : ''}
        <button type="submit" class="dc-btn dc-btn-go">Compare these prices ${icon('arrow')}</button>
        <div data-compare>${comparison}</div>
      </form>
      <div class="dc-prices"><h4>Replacement price ideas</h4><p class="dc-small" role="status">${status} A small reference sample, not a market-wide comparison or a recommendation to replace it.</p>${priceCards}</div>
      <details class="dc-fees"><summary>${icon('repair')} See repair service-fee examples</summary><p class="dc-small">Published examples of inspection or call-out fees — not a quote for your appliance. Ask the repairer for the full cost, including parts, labour and delivery.</p><ul>${repairFees().map(fee => `<li><strong>${money(fee.amount)}</strong><span>${escape(fee.provider)} · ${escape(fee.label)}</span><small>${escape(fee.note)} Checked ${escape(fee.retrieved)}.</small>${outLink(fee.url, 'Provider pricing', 'dc-link')}</li>`).join('')}</ul></details>
      ${teach('cost')}
    </div>`;
  }

  // ---------- Rendering ----------
  function render() {
    if (disposed) return;
    disposePhoto(); disposePhoto = () => {}; photoWatch?.disconnect(); photoWatch = null;
    destroyMap();
    const body = state.step === 'identify' ? identifyMarkup() : state.step === 'check' ? checkMarkup() : optionsMarkup();
    host.innerHTML = `<div class="dc-page${tipsOn ? '' : ' tips-off'}${reducedMotion ? ' is-still' : ''}" data-step="${state.step}">${heroMarkup()}${progressMarkup()}<div class="dc-stage" data-stage>${body}</div></div>`;
    if (state.step === 'identify') afterIdentify();
    if (state.step === 'check') updateCheck();
    if (state.step === 'options') afterPanel();
  }

  function setStep(step, { push = true } = {}) {
    state.step = step;
    if (push) { try { view.history.pushState({ ...(view.history.state || {}), dcStep: step }, '', view.location.href); } catch { /* history may be unavailable in embeds */ } }
    render();
    const title = host.querySelector('#dc-step-title');
    title?.focus({ preventScroll: true });
    scrollTo(host.querySelector('.dc-progress'));
  }

  function afterIdentify() {
    const container = host.querySelector('[data-photo]');
    const grid = host.querySelector('[data-identify]');
    // The helper shows itself only when its model policy allows this site.
    // Without it, the picture grid takes the full width.
    const sync = () => {
      const shown = !container.hidden && container.childElementCount > 0;
      grid.classList.toggle('has-photo', shown);
      host.querySelector('[data-pick-title]').textContent = shown ? 'Or tap your appliance' : 'Tap your appliance';
      // The photo helper reveals each result; this observer only updates layout.
    };
    try {
      disposePhoto = deps.mountPhoto(container, {
        onConfirm(item) {
          const category = item?.category || item?.label;
          if (CATEGORIES.includes(category)) choose(category, { fromPhoto: true });
        },
        onChooseManually() { host.querySelector('.dc-tile')?.focus(); },
      }) || (() => {});
    } catch { container.hidden = true; }
    photoWatch = new view.MutationObserver(sync);
    photoWatch.observe(container, { attributes: true, attributeFilter: ['hidden', 'data-photo-helper-status'], childList: true });
    sync();
    updateSuggestions();
  }

  function choose(category, { fromPhoto = false } = {}) {
    // A deliberate manual pick supersedes even a pending photo of the same type.
    if (!fromPhoto) disposePhoto.cancel?.();
    if (state.category !== category) {
      // A new appliance starts a new check: old answers, quotes and searches no longer apply.
      Object.assign(state, { answers: {}, optOut: false, brand: '', model: '', costs: { repair: '', replacement: '' }, selectedPrice: null, comparison: null, checklist: {}, tab: '' });
    }
    state.category = category; state.fromPhoto = fromPhoto;
    host.querySelectorAll('[data-tile]').forEach(tile => {
      const picked = tile.dataset.tile === category;
      tile.classList.toggle('is-picked', picked); tile.setAttribute('aria-pressed', String(picked));
    });
    host.querySelector('[data-details-host]').innerHTML = detailsMarkup();
    const bubbleNode = host.querySelector('[data-bubble]');
    if (bubbleNode) bubbleNode.textContent = bubble();
    updateSuggestions();
    const details = host.querySelector('#dc-details');
    scrollTo(details, 'center');
    host.querySelector('#dc-details-title')?.focus({ preventScroll: true });
  }

  function updateSuggestions() {
    const brands = host.querySelector('#dc-brands'), models = host.querySelector('#dc-models');
    if (!brands || !models) return;
    const found = productSuggestions(appliance(), prices.prices, data.recalls);
    brands.innerHTML = found.brands.map(brand => `<option value="${escape(brand)}"></option>`).join('');
    models.innerHTML = found.models.map(model => `<option value="${escape(model.model)}" label="${escape(model.source)}"></option>`).join('');
  }

  function submitDetails() {
    const fields = { brand: [host.querySelector('#dc-brand'), validateBrand], model: [host.querySelector('#dc-model'), validateModel] };
    let firstBad = null;
    for (const [name, [input, validate]] of Object.entries(fields)) {
      const checked = validate(input.value);
      host.querySelector(`#dc-${name}-error`).textContent = checked.valid ? '' : checked.message;
      input.setAttribute('aria-invalid', String(!checked.valid));
      if (checked.valid) state[name] = checked.value; else firstBad ||= input;
    }
    if (firstBad) { firstBad.focus(); return; }
    setStep('check');
  }

  function updateCheck() {
    const plan = planFor(state.category);
    const answered = plan.filter(([id]) => state.answers[id]).length;
    const result = evaluateSafety(state.answers);
    const warning = host.querySelector('[data-immediate]');
    if (warning) {
      warning.hidden = result.status !== 'high';
      warning.innerHTML = result.status === 'high' ? `${icon('alert')}<p><strong>Stop using this appliance for now.</strong> A serious warning needs attention even if other questions are unanswered. Switch it off and unplug it only if it’s safe. Don’t keep testing it.</p>` : '';
    }
    const counter = host.querySelector('[data-count]');
    if (counter) counter.innerHTML = `<span class="dc-meter" aria-hidden="true"><i style="--w:${plan.length ? answered / plan.length * 100 : 0}%"></i></span>${answered === plan.length ? 'All answered' : `${answered} of ${plan.length} answered`}`;
  }

  function finishCheck() {
    const plan = planFor(state.category);
    const missing = plan.filter(([id]) => !state.answers[id]);
    host.querySelectorAll('[data-question]').forEach(node => node.removeAttribute('aria-invalid'));
    if (missing.length) {
      host.querySelector('#dc-safety-error').textContent = `Answer ${missing.length === 1 ? 'the last question' : `the ${missing.length} remaining questions`}, or choose “Not sure”. You don’t need to investigate.`;
      missing.forEach(([id]) => host.querySelector(`[data-question="${id}"]`)?.setAttribute('aria-invalid', 'true'));
      host.querySelector(`[name="q-${missing[0][0]}"]`)?.focus();
      return;
    }
    state.optOut = false; state.tab = '';
    setStep('options');
  }

  function cantCheck() {
    // Keep any reported danger. Unanswered questions become "Not sure" rather
    // than silently counting as "No".
    for (const [id] of planFor(state.category)) if (!state.answers[id]) state.answers[id] = 'unsure';
    state.optOut = true; state.tab = '';
    setStep('options');
  }

  function refreshPanel({ focusResults = false } = {}) {
    const panel = host.querySelector('[data-panel]');
    if (!panel) return;
    destroyMap();
    panel.innerHTML = panelMarkup(outcome());
    afterPanel();
    if (focusResults) scrollTo(host.querySelector('[data-results]'), 'start');
  }

  function refreshResults() {
    const results = host.querySelector('[data-results]');
    if (!results) { refreshPanel(); return; }
    destroyMap();
    results.innerHTML = resultsMarkup(host.querySelector('[data-finder]').dataset.finder);
    afterPanel();
  }

  function afterPanel() {
    const kind = host.querySelector('[data-finder]')?.dataset.finder;
    if (kind && host.querySelector('[data-map]')) void drawMap(kind);
  }

  // ---------- Map ----------
  function destroyMap() {
    ++mapRequest;
    try { map?.remove(); } catch { /* an already-detached map has nothing to remove */ }
    map = null; markers = new Map();
  }

  async function drawMap(kind) {
    const element = host.querySelector('[data-map]');
    const result = searchResult(kind);
    const request = ++mapRequest;
    const mappable = (result.matches || []).filter(locationHasCoordinates);
    if (!element) return;
    if (!mappable.length) { element.hidden = true; return; }
    element.innerHTML = '<p class="dc-map-note">Loading the map…</p>';
    let ok = false;
    try { ok = await deps.loadMap(); } catch { ok = false; }
    if (disposed || request !== mapRequest || !host.contains(element)) return;
    const L = view.L;
    if (!ok || !L) { element.innerHTML = '<p class="dc-map-note">The map couldn’t load. The list still works.</p>'; return; }
    element.replaceChildren();
    const centre = [state.centre.latitude, state.centre.longitude];
    map = L.map(element, { scrollWheelZoom: false }).setView(centre, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' }).addTo(map);
    L.circleMarker(centre, { radius: 9, weight: 3, color: '#16283c', fillColor: '#ffffff', fillOpacity: 1 }).addTo(map).bindPopup(state.centre.user ? 'Your approximate location' : `Your area: ${escape(state.centre.label)}`);
    const bounds = [centre];
    result.matches.forEach((place, index) => {
      if (!locationHasCoordinates(place)) return;
      const point = [place.latitude, place.longitude];
      bounds.push(point);
      const pin = L.divIcon({ className: `dc-pin dc-pin-${kind}`, html: `<span style="--dc-i:${index}"><b>${index + 1}</b></span>`, iconSize: [34, 42], iconAnchor: [17, 40], popupAnchor: [0, -36] });
      const marker = L.marker(point, { icon: pin, title: place.name, alt: `${index + 1}. ${place.name}` }).addTo(map).bindPopup(`<strong>${index + 1}. ${escape(place.name)}</strong><br>${escape([place.suburb, place.postcode].filter(Boolean).join(' '))}`);
      marker.on('click', () => highlight(place.id, true));
      markers.set(String(place.id), marker);
    });
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }

  function highlight(id, fromMap = false) {
    host.querySelectorAll('.dc-place.is-lit').forEach(node => node.classList.remove('is-lit'));
    const card = [...host.querySelectorAll('[data-place]')].find(node => node.dataset.place === String(id));
    card?.classList.add('is-lit');
    if (fromMap) scrollTo(card, 'nearest');
  }

  function showOnMap(id) {
    const marker = markers.get(String(id));
    highlight(id);
    if (!marker || !map) return;
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14), { animate: !reducedMotion });
    marker.openPopup();
    scrollTo(host.querySelector('[data-map]'), 'center');
  }

  // ---------- Location ----------
  function areaChoices(rows, prompt) {
    const box = host.querySelector('[data-area-options]');
    if (!box) return;
    box.innerHTML = rows.length ? `<p>${escape(prompt)}</p><div role="group" aria-label="Area suggestions">${rows.map(row => `<button type="button" class="dc-mini" data-area="${escape(`${row.postcode} — ${row.suburb}`)}">${escape(row.suburb)} <span>${escape(row.postcode)}</span></button>`).join('')}</div>` : '';
  }

  function useArea(area) {
    state.centre = area; state.geo = state.geo === 'loading' ? 'idle' : state.geo; ++geoRequest;
    refreshPanel({ focusResults: true });
  }

  function searchArea() {
    const input = host.querySelector('#dc-area');
    const error = host.querySelector('#dc-area-error');
    const text = input.value.trim();
    state.areaText = input.value;
    const isPostcode = /^\d{4}$/.test(text);
    const exact = isPostcode ? SUBURB_POSTCODES.filter(row => String(row.postcode) === text) : [];
    // A postcode can cover several suburbs. Ask, rather than averaging them
    // into a point that isn't anybody's place.
    if (exact.length > 1) { areaChoices(exact, `Which suburb in ${text}?`); error.textContent = 'Choose your suburb to continue.'; host.querySelector('[data-area]')?.focus(); return; }
    if (isPostcode && !exact.length) { useArea({ label: `postcode ${text}`, postcode: text, unlocated: true }); return; }
    const resolved = resolveAreaInput(text, SUBURB_POSTCODES);
    if (!resolved.valid) {
      const suggestions = findSuburbSuggestions(text, SUBURB_POSTCODES);
      areaChoices(suggestions, 'Did you mean one of these?');
      error.textContent = suggestions.length ? 'Choose your suburb from the suggestions.' : resolved.reason === 'not-found' ? 'This area isn’t in our Melbourne list. Try its four-digit postcode or a nearby suburb.' : resolved.message;
      input.setAttribute('aria-invalid', 'true'); input.focus(); return;
    }
    useArea(resolved);
  }

  function locate() {
    const request = ++geoRequest;
    if (!deps.geolocation) { state.geo = 'denied'; refreshPanel(); return; }
    state.geo = 'loading'; refreshPanel();
    deps.geolocation.getCurrentPosition(position => {
      if (disposed || request !== geoRequest) return;
      state.geo = 'granted'; state.areaText = '';
      state.centre = { latitude: position.coords.latitude, longitude: position.coords.longitude, label: 'your location', user: true };
      refreshPanel({ focusResults: true });
    }, () => {
      if (disposed || request !== geoRequest) return;
      state.geo = 'denied'; refreshPanel();
      host.querySelector('#dc-area')?.focus();
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  // ---------- Costs ----------
  function compare() {
    const repair = host.querySelector('#dc-repair'), replacement = host.querySelector('#dc-replacement');
    state.costs = { repair: repair.value.trim(), replacement: replacement.value.trim() };
    const result = compareCosts(state.costs.repair, state.costs.replacement);
    state.comparison = result;
    for (const [name, input] of [['repair', repair], ['replacement', replacement]]) {
      const message = result.errors?.[name] || '';
      host.querySelector(`#dc-${name}-error`).textContent = message;
      input.setAttribute('aria-invalid', String(Boolean(message)));
    }
    if (!result.valid) { host.querySelector('#dc-cost-form [aria-invalid="true"]')?.focus(); return; }
    refreshPanel();
    const shown = host.querySelector('[data-compare-result]');
    shown?.focus({ preventScroll: true }); scrollTo(shown, 'center');
  }

  function usePrice(id) {
    const row = matchPriceExamples(prices.prices, appliance()).find(item => item.id === id);
    if (!row || row.stale || row.offerExpired || row.availability === 'out-of-stock') return;
    state.costs.replacement = String(row.priceAud); state.selectedPrice = row; state.comparison = null;
    refreshPanel();
    const input = host.querySelector('#dc-replacement');
    input?.focus({ preventScroll: true }); scrollTo(input, 'center');
  }

  // ---------- Events (one delegated set, removed by cleanup) ----------
  listen(host, 'click', event => {
    const target = event.target.closest('button, a');
    if (!target || !host.contains(target)) return;
    const ds = target.dataset;
    if (ds.tile) choose(ds.tile);
    else if (ds.group) {
      state.group = ds.group;
      host.querySelectorAll('[data-group]').forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.group === state.group)));
      const visible = GROUPS.find(([id]) => id === state.group)[2];
      host.querySelectorAll('[data-tile]').forEach(tile => { tile.hidden = !visible.includes(tile.dataset.tile); });
    } else if ('changeItem' in ds) { scrollTo(host.querySelector('[data-identify]')); host.querySelector('.dc-tile.is-picked, .dc-tile')?.focus({ preventScroll: true }); }
    else if (ds.backStep) setStep(ds.backStep);
    else if ('cant' in ds) cantCheck();
    else if ('restart' in ds) { state = { ...fresh(), category: '' }; setStep('identify'); }
    else if ('addModel' in ds) { setStep('identify'); host.querySelector('#dc-model')?.focus({ preventScroll: true }); scrollTo(host.querySelector('#dc-model'), 'center'); }
    else if (ds.tab) selectTab(ds.tab);
    else if ('locate' in ds) locate();
    else if (ds.area) {
      const resolved = resolveAreaInput(ds.area, SUBURB_POSTCODES);
      if (resolved.valid) { state.areaText = ds.area; useArea(resolved); }
    } else if (ds.show) showOnMap(ds.show);
    else if (ds.usePrice) usePrice(ds.usePrice);
  });

  function selectTab(id) {
    if (state.tab === id) return;
    state.tab = id;
    host.querySelectorAll('[data-tab]').forEach(tab => { const on = tab.dataset.tab === id; tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1; });
    host.querySelector('[data-panel]')?.setAttribute('aria-labelledby', `dc-tab-${id}`);
    refreshPanel();
  }

  listen(host, 'keydown', event => {
    const tab = event.target.closest?.('[role="tab"]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...host.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault(); tabs[next].focus(); selectTab(tabs[next].dataset.tab);
  });

  listen(host, 'submit', event => {
    event.preventDefault();
    if (event.target.id === 'dc-details') submitDetails();
    else if (event.target.id === 'dc-safety') finishCheck();
    else if (event.target.id === 'dc-area-form') searchArea();
    else if (event.target.id === 'dc-cost-form') compare();
  });

  listen(host, 'change', event => {
    const input = event.target;
    if (input.id === 'dc-tips') {
      tipsOn = input.checked;
      host.querySelector('.dc-page')?.classList.toggle('tips-off', !tipsOn);
      try { storage?.setItem(TIPS_KEY, tipsOn ? 'on' : 'off'); } catch { /* the choice still applies to this page */ }
    } else if (input.name?.startsWith('q-')) {
      const id = input.name.slice(2);
      state.answers[id] = input.value; state.optOut = false;
      const card = input.closest('[data-question]');
      card.dataset.answer = input.value; card.removeAttribute('aria-invalid');
      host.querySelector('#dc-safety-error').textContent = '';
      // "Not sure" opens the explanation, which may help the next answer.
      if (input.value === 'unsure') card.querySelector('details')?.setAttribute('open', '');
      updateCheck();
    } else if (input.id === 'dc-radius') { state.radius = Number(input.value); refreshResults(); }
    else if (input.dataset.check) {
      state.checklist[input.dataset.check] = input.checked;
      const status = host.querySelector('[data-check-status]');
      if (status) status.textContent = checkStatus();
    }
  });

  listen(host, 'input', event => {
    const input = event.target;
    if (input.id === 'dc-brand' || input.id === 'dc-model') {
      state[input.name] = input.value;
      input.removeAttribute('aria-invalid'); host.querySelector(`#dc-${input.name}-error`).textContent = '';
      updateSuggestions();
    } else if (input.id === 'dc-area') {
      state.areaText = input.value;
      input.removeAttribute('aria-invalid'); host.querySelector('#dc-area-error').textContent = '';
      areaChoices(findSuburbSuggestions(input.value, SUBURB_POSTCODES, 6), 'Choose your area');
    } else if (input.id === 'dc-repair' || input.id === 'dc-replacement') {
      state.costs[input.name] = input.value; state.comparison = null;
      // An edited amount is the adult's own figure, not the recorded price any more.
      if (input.name === 'replacement' && state.selectedPrice) { state.selectedPrice = null; host.querySelector('[data-price-note]')?.remove(); }
      input.removeAttribute('aria-invalid'); host.querySelector(`#dc-${input.name}-error`).textContent = '';
      const shown = host.querySelector('[data-compare]'); if (shown) shown.innerHTML = '';
    }
  });

  // Browser Back moves between steps of this page. Each step has its own entry
  // with the same address, so the router does not remount the page.
  listen(view, 'popstate', event => {
    let step = event.state?.dcStep;
    if (!step || disposed) return;
    if (step !== 'identify' && !state.category) step = 'identify';
    if (step === 'options' && planFor(state.category).some(([id]) => !state.answers[id])) step = 'check';
    setStep(step, { push: false });
  });

  // ---------- Data ----------
  async function loadData() {
    try { data = await deps.loadData(); } catch { data = getStaticSnapshot(); }
    if (disposed) return;
    dataLoading = false;
    updateSuggestions();
    // A recall found after the check opened changes the advice, so redraw that
    // step. On the options step the recall card and place lists also depend on
    // these records. Focus returns to the same control afterwards.
    if (state.step === 'check' && recallResult().status !== 'possible') return;
    if (state.step === 'identify') return;
    const focused = document.activeElement?.id;
    render();
    if (focused) host.querySelector(`#${focused}`)?.focus({ preventScroll: true });
  }
  async function loadPrices() {
    try { prices = await deps.loadPrices(); } catch { /* keep the saved copy */ }
    if (disposed) return;
    updateSuggestions();
    if (state.step === 'options' && state.tab === 'cost') refreshPanel();
  }

  try { view.history.replaceState({ ...(view.history.state || {}), dcStep: 'identify' }, '', view.location.href); } catch { /* history may be unavailable */ }
  render();
  void loadData();
  void loadPrices();
  return cleanup;
}
