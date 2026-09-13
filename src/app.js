import { loadPublicData, getStaticSnapshot } from "./data-service.js";
import {
  matchRecall,
  evaluateSafety,
  journeyDecision,
  compareCosts,
  getLocations,
  getNearbyLocations,
  safetyPlanFor,
  locationHasCoordinates,
  validateBrand,
  validateModel,
  validateProblem,
  classifyProblem,
  findSuburbSuggestions,
  resolveAreaInput
} from "./logic.js";
import {
  CATEGORY_CODE_BY_NAME,
  EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY,
  SAFETY_RULES,
  SAFETY_HELP,
  GOALS,
  COST_CONTEXT_SOURCES
} from "./data.js";
import { SUBURB_POSTCODES } from "./suburb-index.js";
import { icons } from "./icons.js";
import { PRICE_SNAPSHOT } from "./price-snapshot.js";
import { loadPriceCatalogue, matchPriceExamples, problemQuestions } from "./price-catalogue.js";

const app = document.querySelector("#app");
const main = document.querySelector("#main");
const journeyShell = document.querySelector("#journey-shell");
const journeyProgress = document.querySelector("#journey-progress");
const restartButton = document.querySelector("#restart-button");
const restartDialog = document.querySelector("#restart-dialog");
const aboutDialog = document.querySelector("#about-dialog");
const aboutContent = document.querySelector("#about-content");
const toast = document.querySelector("#toast");
const releaseLabel = document.querySelector("#release-label");

let publicData = getStaticSnapshot();
let publicDataLoading = true;
let loadGeneration = 0;
let mapInstance = null;
let mapMarkers = new Map();
let leafletPromise = null;
let historyReady = false;
let journeyId = 0;
let geoGeneration = 0;
let priceCatalogue = { ...PRICE_SNAPSHOT, mode: "saved-copy" };
let priceRequest = null;
let renderedScreen = null;

const emptyState = () => ({
  screen: "landing",
  intent: "guide",
  appliance: { family: "", category: "", categoryCode: "", brand: "", model: "" },
  recall: null,
  safety: {},
  safetyResult: null,
  decision: null,
  pathway: null,
  serviceSafetyMode: "clear",
  safetyOptOut: false,
  area: "",
  areaSelection: null,
  areaSuggestions: [],
  areaActiveIndex: -1,
  userLocation: null,
  geoStatus: "idle",
  filters: { radiusKm: 10, providerType: "all" },
  costs: { repair: "", replacement: "" },
  selectedPrice: null,
  comparison: null,
  problem: "",
  problemContext: null,
  feeExamplesOpen: false,
  fromRepairHub: false,
  touched: false
});
let state = emptyState();

function icon(name) { return icons[name] || ""; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function escapeAttr(value) { return escapeHtml(value); }
function money(value) { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(value); }
function formatCount(value) { return new Intl.NumberFormat("en-AU").format(Number(value) || 0); }
function showToast(message) { toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2600); }
function scrollBehavior() { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"; }
function focusMain() { main?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: scrollBehavior() }); }
function focusElement(selector) { app.querySelector(selector)?.focus({ preventScroll: true }); }
function markTouched() { state.touched = true; }
function availability(name) { return publicData?.availability?.[name] === true; }
function families() { return publicData?.families || []; }
function recalls() { return publicData?.recalls || []; }
function safetySigns() { return publicData?.safetySigns || []; }
function sources() { return publicData?.sources || []; }
function repairEvidence() { return publicData?.repairEvidence || []; }
function locations() { return publicData?.locations || []; }

function safeExternalUrl(value, allowedHosts = null) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (allowedHosts && !allowedHosts.includes(url.hostname.toLowerCase())) return null;
    return url.href;
  } catch { return null; }
}

function externalLink(url, label, className = "") {
  const safe = safeExternalUrl(url);
  return safe ? `<a class="${escapeAttr(className)}" href="${escapeAttr(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}<span class="sr-only"> (opens in a new tab)</span> ↗</a>` : "";
}

function telephoneLink(phone) {
  const cleaned = String(phone || "").replace(/[^0-9+]/g, "");
  return cleaned ? `<a class="button secondary compact" href="tel:${escapeAttr(cleaned)}">Call</a>` : "";
}

function directionsLink(item) {
  if (!locationHasCoordinates(item)) return "";
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.latitude)},${encodeURIComponent(item.longitude)}`;
  return externalLink(url, "Directions", "button secondary compact");
}

function setStage(stage = null) {
  journeyShell.hidden = !stage;
  const order = ["appliance", "check", "options"];
  const current = order.indexOf(stage);
  journeyProgress.querySelectorAll("li").forEach((item, index) => {
    item.classList.toggle("active", index === current);
    item.classList.toggle("done", current >= 0 && index < current);
    if (index === current) item.setAttribute("aria-current", "step"); else item.removeAttribute("aria-current");
  });
}

function navigate(screen, { replace = false } = {}) {
  const fromScreen = state.screen;
  if (fromScreen === "services" && screen !== "services") { ++geoGeneration; if (state.geoStatus === "loading") state.geoStatus = "idle"; }
  state.screen = screen;
  markTouched();
  const url = new URL(location.href);
  url.hash = screen === "landing" ? "" : screen;
  history[replace ? "replaceState" : "pushState"]({ fixForward: true, screen, fromScreen, journeyId }, "", url);
  renderScreen();
  focusMain();
}

function back() {
  if (history.state?.fixForward) history.back();
  else navigate("landing", { replace: true });
}

function renderBack(label = "Back") {
  return `<button class="back-button" type="button" data-back>${icon("arrow")} ${escapeHtml(label)}</button>`;
}

function renderLoading(message = "Getting FixForward ready…") {
  setStage(null);
  app.innerHTML = `<section class="loading-screen" role="status" aria-live="polite">
    <div class="loader" aria-hidden="true"></div>
    <p class="eyebrow">One moment</p>
    <h1>${escapeHtml(message)}</h1>
    <p>We are loading the information used for safety notices, repair context and Melbourne service locations.</p>
  </section>`;
}

async function reloadPublicData({ announce = false, showLoading = false } = {}) {
  const generation = ++loadGeneration;
  publicDataLoading = true;
  if (showLoading) renderLoading(announce ? "Trying the public information again…" : "Getting FixForward ready…");
  try {
    const data = await loadPublicData();
    if (generation !== loadGeneration) return;
    publicData = data;
    publicDataLoading = false;
    // A fast user may have started the journey before a cold backend finished.
    // Re-check an earlier "unavailable" recall result as soon as real recall
    // data becomes available, rather than making the user restart.
    if (state.appliance.category) {
      const previousRecall = state.recall;
      state.recall = matchRecall(state.appliance, data.recalls || [], Boolean(data.availability?.recalls));
      if (!data.availability?.recalls && previousRecall?.status === "possible") state.recall = { ...previousRecall, refreshUnavailable: true };
      state.decision = null;
    }
    releaseLabel.textContent = data.meta?.releaseVersion || "FixForward prototype";
    renderAbout();
    if (announce) showToast(["recalls", "repairEvidence", "locations"].every((key) => data.availability?.[key]) ? "Information refreshed." : "Some information is still unavailable. Available parts have been refreshed.");
    // Landing has no form values. The service screen stores its search input in
    // state as the user types, so it can also refresh safely when cold data lands.
    if (["landing", "services", "results", "repair-hub", "cost", "check"].includes(state.screen) || showLoading) {
      const active = document.activeElement;
      const focusSelector = active?.id ? `#${active.id}` : active?.name ? `[name="${active.name}"]` : null;
      renderScreen();
      if (focusSelector) focusElement(focusSelector);
    }
  } catch {
    publicDataLoading = false;
    if (announce) showToast("We could not refresh the public information. You can still use the parts that do not need it.");
    if (showLoading || state.screen === "services") renderScreen();
  }
}

function goalCard(goal) {
  return `<article class="goal-card goal-${escapeAttr(goal.id)}">
    <span class="goal-icon" aria-hidden="true">${goal.icon}</span>
    <h2>${escapeHtml(goal.title)}</h2>
    <p>${escapeHtml(goal.description)}</p>
    <button class="goal-button" type="button" data-intent="${escapeAttr(goal.id)}">${escapeHtml(goal.cta)} ${icon("arrow")}</button>
  </article>`;
}

function renderLanding() {
  document.title = "Home | FixForward";
  setStage(null);
  app.innerHTML = `<section class="landing goal-first">
    <div class="hero-simple">
      <div class="hero-copy-simple">
        <p class="kicker">For Melbourne households with a faulty appliance</p>
        <h1>Something wrong with an appliance?</h1>
        <p class="lede">Choose what you need. FixForward asks only a few questions that matter for your appliance, then takes you straight to repair, cost comparison or recycling.</p>
        <div class="hero-quick-wrap" aria-label="Choose what you want to do">
          <p>What do you want to do?</p>
          <div class="hero-quick-actions">${GOALS.map((goal) => `<button type="button" data-intent="${escapeAttr(goal.id)}"><span aria-hidden="true">${goal.icon}</span><strong>${escapeHtml(goal.id === "guide" ? "Help me decide" : goal.id === "compare" ? "Compare costs" : goal.id === "recycle" ? "Recycle it" : "Repair it")}</strong></button>`).join("")}</div>
        </div>
        <div class="hero-reassurance"><span>${icon("shield")} Only relevant safety questions</span><span>${icon("lock")} No account needed</span><span>⏱ A few short questions</span></div>
      </div>
      <div class="hero-appliance-visual" aria-hidden="true">
        <div class="visual-ring ring-one"></div><div class="visual-ring ring-two"></div>
        <div class="visual-device">↻<small>fix forward</small></div>
        <span class="floating-chip chip-repair">🔧 Repair</span>
        <span class="floating-chip chip-cost">⚖ Compare</span>
        <span class="floating-chip chip-recycle">♻ Recycle</span>
      </div>
    </div>

    <section class="goal-section" aria-labelledby="goal-title">
      <div class="section-heading compact-heading">
        <p class="eyebrow">Choose your path</p>
        <h2 id="goal-title">Choose your next step.</h2>
        <p>You do not need technical knowledge. We explain each question, and “Not sure” is always an option.</p>
      </div>
      <div class="goal-grid">${GOALS.map(goalCard).join("")}</div>
      <p class="safety-promise">${icon("shield")} <strong>Repair, Compare and Recycle use a short 2–4 question check for most appliances.</strong> “I’m not sure” can ask a little more because it is designed to guide the decision.</p>
    </section>

    <section class="impact-simple" aria-label="Why this matters">
      <span aria-hidden="true">♻</span><div><p class="eyebrow">Why this matters</p><h2>Use it longer when that makes sense. Recycle it properly when it does not.</h2><p>FixForward helps you check repair before unnecessary replacement and find a responsible next step for an appliance that is finished.</p></div>
    </section>

    <section class="explain-strip">
      <article><span class="explain-icon">!</span><div><h3>What is a product recall?</h3><p>Sometimes a manufacturer or government asks people to stop using, repair or return a product because it may be unsafe. That is called a <strong>product recall</strong>.</p></div></article>
      <article><span class="explain-icon">?</span><div><h3>Not sure what a question means?</h3><p>Every safety question has a simple <strong>What does this mean?</strong> button with an example. You never need to switch on, open or test an appliance just to answer.</p></div></article>
      <article><span class="explain-icon">⌖</span><div><h3>Melbourne-focused help</h3><p>Where location information is available, you can use your current location or type a suburb/postcode. FixForward does not save your exact coordinates.</p></div></article>
    </section>

    <section class="trust-note">
      <div><p class="eyebrow">About your choices</p><h2>Information to help you decide.</h2></div>
      <p>FixForward does not invent a recall result, a service listing or a price. If you want to see where information came from, use “About the information”.</p>
    </section>
  </section>`;

  app.querySelectorAll("[data-intent]").forEach((button) => button.addEventListener("click", () => {
    state.intent = button.dataset.intent;
    state.pathway = button.dataset.intent === "recycle" ? "dispose" : button.dataset.intent;
    state.serviceSafetyMode = "clear";
    navigate("identify");
  }));
}

function intentHeading() {
  if (state.intent === "repair") return { eyebrow: "Repair", title: "What appliance needs help?", copy: "Tell us what it is. Brand and model are useful if you know them, but they are not required." };
  if (state.intent === "compare") return { eyebrow: "Compare costs", title: "What appliance are you comparing?", copy: "Tell us what it is, then we will take you straight to the cost tool after a short check." };
  if (state.intent === "recycle") return { eyebrow: "Recycle", title: "What appliance do you want to recycle?", copy: "Tell us what it is so we can show the right recycling path and any important handling warning." };
  return { eyebrow: "Help me decide", title: "What appliance is causing trouble?", copy: "Choose the closest match. We will ask a few relevant questions and guide you from there." };
}

function currentSafetyPlan() {
  return safetyPlanFor(state.appliance.category, state.intent, safetySigns());
}

function destinationAfterCheck() {
  if (state.intent === "repair") return "repair options";
  if (state.intent === "compare") return "cost comparison";
  if (state.intent === "recycle") return "recycling options";
  return "your options";
}

function renderIdentify() {
  setStage("appliance");
  const selectedFamily = families().find((family) => family.id === state.appliance.family);
  const heading = intentHeading();
  const checkCount = state.appliance.category ? currentSafetyPlan().length : 0;
  app.innerHTML = `<section class="screen wide-screen">
    ${renderBack("Back to choices")}
    <div class="step-heading friendly-heading"><p class="eyebrow">${heading.eyebrow}</p><h1>${heading.title}</h1><p>${heading.copy}</p></div>

    <div class="identify-layout">
      <section>
        <h2 class="form-section-title">1. Choose a group</h2>
        <div class="family-grid simple-family-grid">${families().map((family) => `<button class="choice-card ${state.appliance.family === family.id ? "selected" : ""}" type="button" aria-pressed="${state.appliance.family === family.id}" data-family="${escapeAttr(family.id)}"><span class="family-icon" aria-hidden="true">${escapeHtml(family.icon || "○")}</span><strong>${escapeHtml(family.name)}</strong><small>${escapeHtml(family.hint)}</small></button>`).join("")}</div>
      </section>

      <section class="category-panel ${selectedFamily ? "ready" : "locked"}" aria-labelledby="category-title">
        <h2 class="form-section-title" id="category-title">2. Choose your appliance</h2>
        ${selectedFamily ? `<div class="category-grid simple-category-grid">${selectedFamily.categories.map((category) => `<button class="category-button ${state.appliance.category === category ? "selected" : ""}" type="button" aria-pressed="${state.appliance.category === category}" data-category="${escapeAttr(category)}"><span>${escapeHtml(category)}</span><span aria-hidden="true">${state.appliance.category === category ? "✓" : "→"}</span></button>`).join("")}</div>` : `<div class="locked-placeholder">Choose a group above first.</div>`}
      </section>
    </div>

    ${state.appliance.category ? `<section class="product-details-card">
      <div><p class="eyebrow">Optional</p><h2>Do you know the brand or model?</h2><p>This can help us check safety notices and find recorded prices for the same model. It is okay if you do not know.</p></div>
      <div class="form-grid">
        <label>Brand<input name="brand" maxlength="60" value="${escapeAttr(state.appliance.brand)}" autocomplete="off" placeholder="e.g. Dyson, Breville, Mistral" aria-describedby="brand-error"><small class="field-hint">Optional · up to 60 characters</small><small class="field-error" id="brand-error"></small></label>
        <label>Model number<input name="model" maxlength="50" value="${escapeAttr(state.appliance.model)}" autocomplete="off" placeholder="e.g. BVC 160" aria-describedby="model-error"><small>Copy the model from the label if it is easy to reach. You can leave this blank.</small><small class="field-error" id="model-error"></small></label>
      </div>
      <details class="plain-details model-help"><summary>Where can I find the model number?</summary><div class="model-help-body"><div class="model-label-demo" role="img" aria-label="Example appliance rating label showing brand and model number"><span>APPLIANCE LABEL</span><strong>Brand: Example</strong><b>Model: ABC-123</b><small>230–240 V · 50 Hz</small></div><p>If it is safe and easy to see, look for a label on the outside, back or base, or check the manual or receipt. Do not move a hot or damaged appliance to find it. The model may be labelled <strong>Model</strong>, <strong>Model No.</strong> or <strong>M/N</strong>. <strong>Do not open the appliance or remove screws to find it.</strong></p></div></details>
      <div class="continue-row"><button class="button primary large" id="continue-check" type="button">Continue — ${checkCount} quick question${checkCount === 1 ? "" : "s"} ${icon("arrow")}</button><span>Then we take you to ${escapeHtml(destinationAfterCheck())}.</span></div>
    </section>` : ""}
  </section>`;

  bindBack();
  app.querySelectorAll('[name="brand"], [name="model"]').forEach((input) => input.addEventListener("input", (event) => {
    state.appliance[event.target.name] = event.target.value;
    if (state.selectedPrice) { state.costs.replacement = ""; state.selectedPrice = null; }
    state.safetyResult = null;
    state.decision = null;
    state.recall = null;
    state.comparison = null;
    state.problemContext = null;
  }));
  app.querySelectorAll("[data-family]").forEach((button) => button.addEventListener("click", () => {
    state.appliance = { family: button.dataset.family, category: "", categoryCode: "", brand: "", model: "" };
    state.safety = {};
    state.recall = null;
    state.safetyResult = null;
    state.decision = null;
    state.safetyOptOut = false;
    state.serviceSafetyMode = "clear";
    state.costs = { repair: "", replacement: "" };
    state.selectedPrice = null;
    state.comparison = null;
    state.problem = "";
    state.problemContext = null;
    state.area = "";
    state.areaSelection = null;
    state.areaSuggestions = [];
    state.areaActiveIndex = -1;
    state.userLocation = null;
    state.fromRepairHub = false;
    renderIdentify();
    focusElement("[data-category]");
    app.querySelector(".category-panel")?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  }));
  app.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
    state.appliance.category = button.dataset.category;
    state.appliance.categoryCode = CATEGORY_CODE_BY_NAME[button.dataset.category] || "";
    state.safety = {};
    state.recall = null;
    state.safetyResult = null;
    state.decision = null;
    state.safetyOptOut = false;
    state.serviceSafetyMode = "clear";
    state.costs = { repair: "", replacement: "" };
    state.selectedPrice = null;
    state.comparison = null;
    state.problem = "";
    state.problemContext = null;
    state.area = "";
    state.areaSelection = null;
    state.areaSuggestions = [];
    state.areaActiveIndex = -1;
    state.userLocation = null;
    state.fromRepairHub = false;
    renderIdentify();
    focusElement('[name="brand"]');
    app.querySelector(".product-details-card")?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  }));
  app.querySelector("#continue-check")?.addEventListener("click", () => {
    const brandInput = app.querySelector('[name="brand"]');
    const modelInput = app.querySelector('[name="model"]');
    const brandResult = validateBrand(brandInput?.value || "");
    const modelResult = validateModel(modelInput?.value || "");
    const validation = [["brand", brandInput, brandResult], ["model", modelInput, modelResult]];
    validation.forEach(([name, input, result]) => {
      const error = app.querySelector(`#${name}-error`);
      if (error) error.textContent = result.valid ? "" : result.message;
      input?.setAttribute("aria-invalid", String(!result.valid));
    });
    const firstInvalid = validation.find(([, , result]) => !result.valid);
    if (firstInvalid) { firstInvalid[1]?.focus(); return; }

    const nextBrand = brandResult.value;
    const nextModel = modelResult.value;
    const identityChanged = nextBrand !== state.appliance.brand || nextModel !== state.appliance.model;
    state.appliance.brand = nextBrand;
    state.appliance.model = nextModel;
    if (identityChanged) {
      state.comparison = null;
      state.problem = "";
      state.problemContext = null;
    }
    state.recall = matchRecall(state.appliance, recalls(), availability("recalls"));
    state.safetyOptOut = false;
    navigate("check");
  });
}

function recallMiniCard() {
  const result = state.recall || matchRecall(state.appliance, recalls(), availability("recalls"));
  state.recall = result;
  const acccUrl = "https://www.productsafety.gov.au/recalls";

  if (result.status === "possible") {
    const notice = safeExternalUrl(result.match?.noticeUrl, ["productsafety.gov.au", "www.productsafety.gov.au"]);
    return `<aside class="recall-mini recall-alert">
      <div class="recall-icon">!</div>
      <div><p class="mini-label">Important safety notice</p><h2>Your model may be affected by a product recall.</h2><p>We found a possible match for <strong>${escapeHtml(result.match?.brand)} ${escapeHtml(result.match?.productName || result.match?.title || "your model")}</strong>.</p>${result.brandConflict ? `<p class="inline-warning">The model matches, but the brand you typed is different. Check the official notice carefully.</p>` : ""}<p>FixForward cannot confirm that your exact appliance is affected. The official notice may also use serial numbers, dates or other details.</p><div class="link-row">${externalLink(notice || acccUrl, "See the official safety notice", "button danger compact")}</div></div>
    </aside>`;
  }

  if (result.status === "unavailable") {
    return `<aside class="recall-mini recall-neutral"><div class="recall-icon">i</div><div><p class="mini-label">Safety notice check</p><h2>We cannot check our recall information right now.</h2><p>You can still complete the safety questions below. For a complete check, use the official Australian recall search.</p>${externalLink(acccUrl, "Open official recall search")}</div></aside>`;
  }

  if (result.status === "none") {
    const near = result.near?.length ? `<p class="inline-warning">The model you typed is very close to one in our small reviewed list. Re-check the label before relying on it.</p>` : "";
    return `<aside class="recall-mini recall-neutral"><div class="recall-icon">✓</div><div><p class="mini-label">Safety notice check</p><h2>We did not find your exact model in our current list.</h2>${near}<p><strong>This does not prove there is no recall.</strong> Our list is limited, so the official search remains the complete place to check.</p><details class="plain-details"><summary>Why can’t FixForward just say “not recalled”?</summary><p>A product category or partial model match is not enough to clear a product. Different production dates, serial numbers and model variants can matter.</p>${externalLink(acccUrl, "Check the official recall search")}</details></div></aside>`;
  }

  return `<aside class="recall-mini recall-neutral"><div class="recall-icon">i</div><div><p class="mini-label">What is a product recall?</p><h2>We do not have enough model detail for a product-specific check.</h2><p>That is okay. A <strong>product recall</strong> is a safety notice asking people to stop using, repair or return a product. You can keep going and use the official search if you want to check your exact appliance.</p>${externalLink(acccUrl, "Open official recall search")}</div></aside>`;
}

function relevantSigns() { return currentSafetyPlan(); }

function safetyReasonCopy() {
  if (state.intent === "repair") return "Some warning signs mean a community repair event is not the right first stop. We only ask the checks that matter most for this appliance.";
  if (state.intent === "compare") return "A cost comparison should not encourage you to keep using an appliance that may need checking first. You can still explore costs if you are not sure about an answer.";
  if (state.intent === "recycle") return "A recently smoking appliance or damaged battery may need different handling. We ask only the most important checks before showing recycling places.";
  return "These questions help us avoid suggesting the wrong next step. We keep them specific to the appliance you selected.";
}

function safetyVisual(id) {
  const help = SAFETY_HELP[id] || {};
  return `<div class="safety-visual" role="img" aria-label="Simple visual for ${escapeAttr(help.question || id)}">
    <span class="safety-pictogram" aria-hidden="true">${escapeHtml(help.pictogram || "i")}</span>
    <div><small>${escapeHtml(state.appliance.category)}</small><strong>${escapeHtml(help.question || "Safety check")}</strong></div>
  </div>`;
}

function questionCard(id, index) {
  const help = SAFETY_HELP[id] || {};
  const answer = state.safety[id] || "";
  const helpId = `help-${id}`;
  return `<fieldset class="question-card" data-question="${escapeAttr(id)}">
    <legend class="sr-only">${escapeHtml(help.question || id)}</legend>
    <div class="question-title-row">
      <span class="question-number" aria-hidden="true">${index + 1}</span>
      <div><p class="mini-label">Question ${index + 1}</p><h2>${escapeHtml(help.question || id)}</h2></div>
      <button class="question-info" type="button" data-help-toggle="${escapeAttr(id)}" aria-expanded="false" aria-controls="${escapeAttr(helpId)}"><span aria-hidden="true">i</span><span>What does this mean?</span></button>
    </div>
    <div class="segmented large-segmented safety-answers">
      ${[["yes","Yes"],["no","No"],["unsure","Not sure"]].map(([value, text]) => `<label><input type="radio" name="${escapeAttr(id)}" value="${value}" ${answer === value ? "checked" : ""}><span>${text}</span></label>`).join("")}
    </div>
    <div class="question-help-panel" id="${escapeAttr(helpId)}" hidden>
      ${safetyVisual(id)}
      <div class="help-copy"><h3 tabindex="-1">${escapeHtml(help.title || "What does this mean?")}</h3><p>${escapeHtml(help.meaning || SAFETY_RULES[id]?.explanation || "")}</p><p class="help-example">${escapeHtml(help.example || "Only answer from what you already noticed.")}</p><div class="do-not-test"><strong>Do not test it just to answer.</strong><span>You do not need to switch it on, open it, touch damaged parts or remove screws.</span></div></div>
      <div class="help-resolve"><span>After reading this:</span><button type="button" class="text-choice" data-resolve-question="${escapeAttr(id)}" data-resolve-value="yes">Yes, I noticed this</button><button type="button" class="text-choice" data-resolve-question="${escapeAttr(id)}" data-resolve-value="no">No, I did not</button><button type="button" class="text-choice safer-choice" data-keep-unsure="${escapeAttr(id)}">I’m still not sure — keep this answer</button></div>
    </div>
  </fieldset>`;
}

function flaggedSafetyAnswers(signs = relevantSigns()) {
  return signs.filter(([id]) => ["yes", "unsure"].includes(state.safety[id]));
}

function currentSafetyResult() {
  const result = evaluateSafety(state.safety);
  if (!state.safetyOptOut) return result;
  return { ...result, status: result.status === "high" ? "high" : "uncertain", unsure: [...result.unsure, "unable-to-check"] };
}

function openPathway(action) {
  state.fromRepairHub = false;
  state.serviceSafetyMode = state.safetyResult?.status === "high" ? "high"
    : ["caution", "uncertain"].includes(state.safetyResult?.status) ? "caution" : "clear";
  state.pathway = action === "compare" ? "cost" : action;
  state.filters.providerType = "all";
  navigate(action === "compare" ? "cost" : "services");
}

function explorationOptions() {
  return `<section class="exploration-options" aria-labelledby="explore-title"><h2 id="explore-title">You can still explore your options.</h2><p>We cannot recommend repair or replacement while safety is unclear. These paths help you gather information. Get advice before using the appliance again.</p><div class="result-grid">
    ${resultActionCard("repair", "🔧", "Ask about repair", "Find repair businesses to contact. Ask whether they can assess your appliance and what an inspection costs.", "Explore repair options")}
    ${resultActionCard("compare", "⚖", "Repair or replace?", "See what to consider, look at service-fee examples, or compare a repair quote with a replacement price.", "Explore repair vs replacement")}
    ${resultActionCard("dispose", "♻", "Consider recycling", "Contact a recycling facility about safe handling before you move the appliance.", "Find recycling places to contact")}
  </div></section>`;
}

function bindExplorationOptions() {
  app.querySelectorAll(".exploration-options [data-action]").forEach((button) => button.addEventListener("click", () => openPathway(button.dataset.action)));
}

function updateSafetyFooter() {
  const signs = relevantSigns();
  const answered = signs.filter(([id]) => state.safety[id]).length;
  const footer = app.querySelector(".simple-sticky");
  if (!footer) return;
  const strong = footer.querySelector("strong");
  const copy = footer.querySelector("span");
  const button = footer.querySelector('button[type="submit"]');
  const hasCriticalYes = signs.some(([id]) => state.safety[id] === "yes" && SAFETY_RULES[id]?.severity === "critical");
  if (strong) strong.textContent = answered === signs.length ? "Quick check complete" : `${answered} of ${signs.length} answered`;
  if (copy) {
    copy.textContent = answered === signs.length
      ? `Continue to see the next step.`
      : hasCriticalYes
        ? "A serious warning is already recorded. Finish only the remaining questions you can answer from what you already know — do not test the appliance."
        : "Not sure is okay. Keep going with the remaining questions you can answer from what you already know.";
  }
  if (button) button.textContent = answered === signs.length ? "See my next step" : "Continue";
}

function finishSafetyCheck({ allowIncomplete = false } = {}) {
  const signs = relevantSigns();
  const missing = signs.filter(([id]) => !state.safety[id]);
  if (!allowIncomplete && missing.length) {
    const error = app.querySelector("#safety-error");
    if (error) error.textContent = `Please answer the remaining ${missing.length} question${missing.length === 1 ? "" : "s"}, or choose “I’m not able to check this safely”.`;
    app.querySelector(`[name="${missing[0][0]}"]`)?.focus();
    return;
  }

  state.safetyResult = currentSafetyResult();
  state.decision = journeyDecision(state.recall?.status || "insufficient", state.safetyResult.status);

  const blockedBySafety = ["high", "uncertain", "caution"].includes(state.safetyResult.status);
  const blockedByRecall = state.recall?.status === "possible";
  if (!blockedBySafety && !blockedByRecall) {
    state.serviceSafetyMode = "clear";
    if (state.intent === "repair") { state.pathway = "repair"; state.fromRepairHub = false; navigate("repair-hub"); return; }
    if (state.intent === "recycle") { state.pathway = "dispose"; navigate("services"); return; }
    if (state.intent === "compare") { state.pathway = "cost"; navigate("cost"); return; }
  }
  navigate("results");
}

function renderCheck() {
  setStage("check");
  const signs = relevantSigns();
  const noun = signs.length === 1 ? "question" : "questions";
  app.innerHTML = `<section class="screen narrow check-screen">
    ${renderBack("Back to appliance")}
    <div class="step-heading friendly-heading check-heading"><p class="eyebrow">Quick check · ${escapeHtml(state.appliance.category)}</p><h1>${signs.length} quick ${noun} before ${escapeHtml(destinationAfterCheck())}.</h1><p>${escapeHtml(safetyReasonCopy())}</p></div>

    <div class="check-rules"><span>✓ Answer from what you already noticed</span><span>✕ Do not switch it on or open it just to check</span></div>
    <button class="cant-check-button" id="cannot-check" type="button">I’m not able to check this safely</button>

    ${recallMiniCard()}

    <form id="safety-form" novalidate>
      <div class="question-list simple-questions">${signs.map(([id], index) => questionCard(id, index)).join("")}</div>
      <div class="form-error" id="safety-error" role="alert"></div>
      <div class="sticky-action simple-sticky"><div><strong>0 of ${signs.length} answered</strong><span>Answer only from what you already know. Use the info button if a question is unclear.</span></div><button class="button primary" type="submit">Continue</button></div>
    </form>
  </section>`;

  bindBack();
  app.querySelector("#cannot-check")?.addEventListener("click", () => {
    state.safetyOptOut = true;
    finishSafetyCheck({ allowIncomplete: true });
  });

  app.querySelectorAll("[data-help-toggle]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.helpToggle;
    const panel = app.querySelector(`#help-${id}`);
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (open) panel.querySelector("h3")?.focus?.();
  }));

  app.querySelectorAll('#safety-form input[type="radio"]').forEach((input) => input.addEventListener("change", (event) => {
    state.safetyOptOut = false;
    state.safetyResult = null;
    state.decision = null;
    state.safety[event.target.name] = event.target.value;
    const error = app.querySelector("#safety-error");
    if (error) error.textContent = "";
    if (event.target.value === "unsure") {
      const toggle = app.querySelector(`[data-help-toggle="${event.target.name}"]`);
      const panel = app.querySelector(`#help-${event.target.name}`);
      if (panel) panel.hidden = false;
      toggle?.setAttribute("aria-expanded", "true");
    }
    updateSafetyFooter();
  }));

  app.querySelectorAll("[data-resolve-question]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.resolveQuestion;
    const value = button.dataset.resolveValue;
    state.safetyOptOut = false;
    state.safetyResult = null;
    state.decision = null;
    const input = app.querySelector(`input[name="${id}"][value="${value}"]`);
    if (input) input.checked = true;
    state.safety[id] = value;
    const panel = app.querySelector(`#help-${id}`);
    const toggle = app.querySelector(`[data-help-toggle="${id}"]`);
    if (panel) panel.hidden = true;
    toggle?.setAttribute("aria-expanded", "false");
    updateSafetyFooter();
    input?.focus();
  }));

  app.querySelectorAll("[data-keep-unsure]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.keepUnsure;
    state.safetyOptOut = false;
    state.safetyResult = null;
    state.decision = null;
    state.safety[id] = "unsure";
    const input = app.querySelector(`input[name="${id}"][value="unsure"]`);
    if (input) input.checked = true;
    const panel = app.querySelector(`#help-${id}`);
    const toggle = app.querySelector(`[data-help-toggle="${id}"]`);
    if (panel) panel.hidden = true;
    toggle?.setAttribute("aria-expanded", "false");
    updateSafetyFooter();
    const next = relevantSigns().find(([questionId]) => !state.safety[questionId]);
    app.querySelector(`[name="${next?.[0] || id}"]`)?.focus();
  }));

  app.querySelector("#safety-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    finishSafetyCheck();
  });
  updateSafetyFooter();
}

function repairEvidenceForAppliance() {
  const mappedCode = EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY[state.appliance.categoryCode];
  if (!mappedCode) return null;
  return repairEvidence().find((item) => item.categoryCode === mappedCode) || null;
}

function repairEvidenceSummary() {
  if (!availability("repairEvidence")) return `<div class="evidence-empty"><span aria-hidden="true">↻</span><p><strong>Repair history is unavailable right now.</strong><br>${availability("locations") ? "You can still use the repair map and service listings." : "Contact a repair business or your manufacturer to ask about your appliance."}</p></div>`;
  const evidence = repairEvidenceForAppliance();
  if (!evidence || !evidence.sampleSize) return `<div class="evidence-empty"><span aria-hidden="true">↻</span><p><strong>We do not have enough repair history for this appliance type yet.</strong><br>This does not mean it cannot be repaired.</p></div>`;

  const sample = Number(evidence.sampleSize) || 0;
  const fixed = Math.max(0, Number(evidence.fixedCount) || 0);
  const repairable = Math.max(0, Number(evidence.repairableCount) || 0);
  const other = Math.max(0, sample - fixed - repairable);
  const pct = (value) => sample ? Math.round((value / sample) * 100) : 0;
  const fixedPct = pct(fixed);
  const repairablePct = pct(repairable);
  const otherPct = Math.max(0, 100 - fixedPct - repairablePct);
  const fixedWidth = sample ? (fixed / sample) * 100 : 0;
  const repairableWidth = sample ? (repairable / sample) * 100 : 0;
  const otherWidth = Math.max(0, 100 - fixedWidth - repairableWidth);
  const geography = evidence.geography === "AU" ? "Australian" : "global";
  const mapped = EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY[state.appliance.categoryCode] !== state.appliance.categoryCode;
  const continued = fixed + repairable;

  return `<div class="repair-evidence-visual">
    <div class="evidence-headline"><span class="evidence-big">${formatCount(fixed)}<small> of ${formatCount(sample)}</small></span><div><strong>were fixed during recorded community repair events</strong><p>Another ${formatCount(repairable)} were marked repairable after more work.</p></div></div>
    <div class="outcome-chart" role="img" aria-label="Of ${formatCount(sample)} recorded ${geography.toLowerCase()} community repair attempts, ${formatCount(fixed)} were fixed during the event, ${formatCount(repairable)} were marked repairable after more work, and ${formatCount(other)} had other recorded outcomes.">
      <div class="outcome-bar" aria-hidden="true"><span class="outcome-fixed" style="width:${fixedWidth.toFixed(2)}%"></span><span class="outcome-repairable" style="width:${repairableWidth.toFixed(2)}%"></span><span class="outcome-other" style="width:${otherWidth.toFixed(2)}%"></span></div>
      <div class="outcome-legend">
        <div><i class="legend-dot fixed-dot"></i><span><strong>${fixedPct}%</strong> Fixed at event</span><b>${formatCount(fixed)}</b></div>
        <div><i class="legend-dot repairable-dot"></i><span><strong>${repairablePct}%</strong> Repairable with more work</span><b>${formatCount(repairable)}</b></div>
        <div><i class="legend-dot other-dot"></i><span><strong>${otherPct}%</strong> Other recorded outcomes</span><b>${formatCount(other)}</b></div>
      </div>
    </div>
    <p class="evidence-takeaway"><strong>${formatCount(continued)} of ${formatCount(sample)}</strong> were either fixed during the event or recorded as repairable after more work. This is background history for similar appliances — not a prediction for yours.</p>
    <details class="plain-details evidence-details"><summary>How was this worked out?</summary><p>This uses community repair-event history for an appliance category, not your exact brand/model.${mapped ? " Your appliance is mapped to a broader repair category." : ""}</p><dl><dt>Records</dt><dd>${formatCount(sample)}</dd><dt>Area</dt><dd>${escapeHtml(geography)}</dd><dt>Source</dt><dd>Open Repair Alliance</dd></dl><p>${escapeHtml(evidence.limitation || "Community repair data is self-selected and may not represent all household repairs.")}</p></details>
  </div>`;
}

function subtleRecallStatus() {
  if (state.recall?.status === "none") return `<div class="small-status"><span>✓</span><p><strong>We did not find your exact model in FixForward’s current safety-notice list.</strong> That does not prove there is no recall. ${externalLink("https://www.productsafety.gov.au/recalls", "Check the official search")}</p></div>`;
  if (state.recall?.status === "insufficient") return `<div class="small-status"><span>i</span><p><strong>We could not check your exact model because we do not have enough model detail.</strong> That is okay — you can still use the official Australian recall search whenever you want.</p></div>`;
  if (state.recall?.status === "unavailable") return `<div class="small-status warning-status"><span>!</span><p><strong>FixForward’s safety-notice list did not load.</strong> ${externalLink("https://www.productsafety.gov.au/recalls", "Check the official recall search")} for your exact product.</p></div>`;
  return "";
}

function resultActionCard(id, iconText, title, description, cta, featured = false) {
  return `<article class="result-action ${featured ? "featured" : ""}"><span class="result-action-icon" aria-hidden="true">${iconText}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><button class="button ${featured ? "primary" : "secondary"}" type="button" data-action="${escapeAttr(id)}">${escapeHtml(cta)} ${icon("arrow")}</button></article>`;
}

function renderRepairHub() {
  setStage("options");
  state.pathway = "repair";
  app.innerHTML = `<section class="screen repair-hub-screen">
    ${renderBack(optionBackLabel())}
    <div class="result-hero repair-hub-hero"><div><p class="eyebrow">Repair · next step</p><h1>What would help you most now?</h1><p>Choose the practical next step. You can find a repair option nearby or look at the money side first.</p></div><div class="appliance-pill"><span>↻</span><div><small>Your appliance</small><strong>${escapeHtml([state.appliance.brand, state.appliance.model].filter(Boolean).join(" ") || state.appliance.category)}</strong><em>${escapeHtml(state.appliance.category)}</em></div></div></div>
    ${quickCheckPassedBanner()}
    ${subtleRecallStatus()}
    <div class="repair-hub-grid">
      <article class="repair-hub-card"><span class="result-action-icon" aria-hidden="true">⌖</span><p class="mini-label">Nearby help</p><h2>Find a repair option</h2><p>Use your current location or type a suburb/postcode. See the map, available phone details, directions and opening information inside FixForward.</p><button class="button primary" id="hub-find-repair" type="button">Find repair near me ${icon("arrow")}</button></article>
      <article class="repair-hub-card"><span class="result-action-icon" aria-hidden="true">$</span><p class="mini-label">Money side</p><h2>Compare repair and replacement costs</h2><p>See examples of inspection fees, or compare a repair quote with a replacement price you have found.</p><button class="button secondary" id="hub-cost" type="button">Explore repair vs replacement ${icon("arrow")}</button></article>
    </div>
    <section class="repair-hub-evidence"><div class="section-heading compact-heading"><p class="eyebrow">Background repair history</p><h2>Have similar appliances been repaired before?</h2><p>These past results are background information, not a prediction for your appliance.</p></div>${repairEvidenceSummary()}</section>
  </section>`;
  bindBack();
  app.querySelector("#hub-find-repair")?.addEventListener("click", () => { state.pathway = "repair"; state.fromRepairHub = true; navigate("services"); });
  app.querySelector("#hub-cost")?.addEventListener("click", () => { state.pathway = "cost"; state.fromRepairHub = true; navigate("cost"); });
}

function renderResults() {
  setStage("options");
  const safety = currentSafetyResult();
  const decision = journeyDecision(state.recall?.status || "insufficient", safety.status);
  state.safetyResult = safety;
  state.decision = decision;
  const possibleRecall = state.recall?.status === "possible";

  if (safety.status === "high") {
    const disposalPlan = !possibleRecall ? `<div class="hazard-disposal-card"><h2>Need to get rid of it?</h2><p>You can plan a recycling location, but <strong>do not transport it while it is hot, smoking, leaking or actively damaged.</strong> Contact the facility or an appropriate safety service before moving it.</p><button class="button secondary" id="high-recycle" type="button">Plan recycling / disposal ${icon("arrow")}</button></div>` : "";
    app.innerHTML = `<section class="screen narrow result-screen">
      ${renderBack("Back to safety questions")}
      <div class="urgent-card"><span class="urgent-icon">!</span><p class="eyebrow">Serious safety warning</p><h1>Stop using this appliance for now.</h1><p>You told us about a warning sign that could be unsafe. Switch it off and unplug it <strong>only if it is safe to do so</strong>. Do not keep testing it.</p><div class="reported-simple">${safety.critical.map((id) => `<span>${escapeHtml(SAFETY_HELP[id]?.question || SAFETY_RULES[id]?.explanation || id)}</span>`).join("")}</div></div>
      ${possibleRecall ? `<div class="priority-card"><strong>A product recall may also apply.</strong><p>Check the official recall instructions before deciding to repair, replace or recycle it.</p>${externalLink(state.recall?.match?.noticeUrl || "https://www.productsafety.gov.au/recalls", "See official recall instructions", "button danger")}</div>` : ""}
      <div class="next-now"><h2>What should I do now?</h2><div class="next-steps"><article><span>1</span><div><strong>Do not use it again for now</strong><p>A serious warning sign needs a safer next step than a community repair event.</p></div></article><article><span>2</span><div><strong>Have it checked by a qualified appliance repairer or electrician</strong><p>Tell them what you noticed. Do not keep switching the appliance on to test it yourself.</p></div></article></div><div class="button-row">${externalLink("https://www.energysafe.vic.gov.au/", "Energy Safe Victoria guidance", "button primary")}${externalLink("https://www.productsafety.gov.au/recalls", "Check recalls", "button secondary")}</div></div>
      ${disposalPlan}
    </section>`;
    bindBack();
    app.querySelector("#high-recycle")?.addEventListener("click", () => { state.pathway = "dispose"; state.serviceSafetyMode = "high"; state.fromRepairHub = false; navigate("services"); });
    return;
  }

  if (safety.status === "caution") {
    const cautionItems = safety.caution.map((id) => `<span>${escapeHtml(SAFETY_HELP[id]?.question || SAFETY_RULES[id]?.explanation || id)}</span>`).join("");
    app.innerHTML = `<section class="screen narrow result-screen">
      ${renderBack("Back to safety questions")}
      <div class="attention-card"><span class="urgent-icon">i</span><p class="eyebrow">Needs attention</p><h1>Arrange advice about the warning you noticed.</h1><p>You reported a warning such as unusual heat, repeated power trips or a new noise. That is different from smoke, shock or exposed wiring, but it still deserves assessment.</p><div class="reported-simple">${cautionItems}</div></div>
      ${possibleRecall ? `<div class="priority-card"><strong>A product recall may also apply.</strong><p>Check the official recall instructions first. The recall notice takes priority over ordinary cost or repair planning.</p>${externalLink(state.recall?.match?.noticeUrl || "https://www.productsafety.gov.au/recalls", "See official recall instructions", "button danger")}</div>` : `<div class="caution-actions"><h2>What can you do next?</h2><p>Do not use a community Repair Café as a substitute for checking a possible fault. You can still look at the money side or plan responsible recycling while arranging advice.</p><div class="button-row"><button class="button primary" id="caution-repair" type="button">Explore repair options</button><button class="button secondary" id="caution-cost" type="button">Compare repair and replacement costs</button><button class="button secondary" id="caution-recycle-plan" type="button">Plan recycling</button>${externalLink("https://www.energysafe.vic.gov.au/", "Electrical safety guidance", "button ghost")}</div></div>`}
    </section>`;
    bindBack();
    app.querySelector("#caution-repair")?.addEventListener("click", () => openPathway("repair"));
    app.querySelector("#caution-cost")?.addEventListener("click", () => { state.pathway = "cost"; state.fromRepairHub = false; navigate("cost"); });
    app.querySelector("#caution-recycle-plan")?.addEventListener("click", () => { state.pathway = "dispose"; state.serviceSafetyMode = "caution"; state.fromRepairHub = false; navigate("services"); });
    return;
  }

  if (safety.status === "uncertain") {
    const unsureCopy = state.safetyOptOut
      ? "That is okay. You chose not to inspect the appliance further. Because the quick check could not be completed, FixForward will use a cautious next step."
      : "You completed the short check, but one or more answers were ‘Not sure’. That does not mean something is definitely wrong, and it does not mean the appliance is safe. Do not test it again just to get a clearer answer.";
    app.innerHTML = `<section class="screen result-screen">
      ${renderBack("Back to quick check")}
      <div class="caution-card"><span class="urgent-icon">?</span><p class="eyebrow">Some uncertainty remains</p><h1>Get advice before using it again.</h1><p>${escapeHtml(unsureCopy)}</p></div>
      ${possibleRecall ? `<div class="priority-card"><strong>A product recall may also apply.</strong><p>Check the official recall instructions first.</p>${externalLink(state.recall?.match?.noticeUrl || "https://www.productsafety.gov.au/recalls", "See official recall instructions", "button danger")}</div>` : ""}
      ${possibleRecall ? "" : explorationOptions()}
      <div class="button-row">${externalLink("https://www.energysafe.vic.gov.au/", "Electrical safety guidance", "button primary")}${externalLink("https://www.productsafety.gov.au/recalls", "Check recalls", "button secondary")}</div>
    </section>`;
    bindBack();
    bindExplorationOptions();
    return;
  }

  if (possibleRecall) {
    app.innerHTML = `<section class="screen narrow result-screen">
      ${renderBack("Back to safety questions")}
      <div class="recall-result-card"><span class="urgent-icon">!</span><p class="eyebrow">Possible product recall</p><h1>Check the official notice before doing anything else.</h1><p>Your model may match a reviewed product safety notice. Even though you did not report an immediate warning sign, the official recall instructions take priority over ordinary repair, replacement or recycling choices.</p><p><strong>${escapeHtml(state.recall?.match?.brand)} ${escapeHtml(state.recall?.match?.productName || state.recall?.match?.title)}</strong></p>${externalLink(state.recall?.match?.noticeUrl || "https://www.productsafety.gov.au/recalls", "See what the official notice says", "button danger")}</div>
    </section>`;
    bindBack(); return;
  }

  const featuredIntent = state.intent === "guide" ? "repair" : state.intent;
  app.innerHTML = `<section class="screen result-screen options-screen">
    ${renderBack("Back to safety questions")}
    <div class="result-hero"><div><p class="eyebrow">Your options</p><h1>Here are the next steps for your ${escapeHtml(state.appliance.category.toLowerCase())}.</h1><p>You did not report one of the serious warning signs in our quick check. <strong>This is not a guarantee that the appliance is safe.</strong> Choose what you want to do next.</p></div><div class="appliance-pill"><span>↻</span><div><small>Your appliance</small><strong>${escapeHtml([state.appliance.brand, state.appliance.model].filter(Boolean).join(" ") || state.appliance.category)}</strong><em>${escapeHtml(state.appliance.category)}</em></div></div></div>
    ${subtleRecallStatus()}
    <div class="result-grid">
      ${resultActionCard("repair", "🔧", "Repair it", "See repair history for similar appliances and find repair options near you.", "Explore repair", featuredIntent === "repair")}
      ${resultActionCard("compare", "⚖", "Compare costs", "Compare a repair quote with a replacement price, or see what to ask before spending money.", "Compare costs", featuredIntent === "compare")}
      ${resultActionCard("dispose", "♻", "Recycle it", "Find Melbourne-focused e-waste locations and see available places on a map.", "Find recycling", featuredIntent === "recycle")}
    </div>
  </section>`;

  bindBack();
  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "compare") { state.pathway = "cost"; state.fromRepairHub = false; navigate("cost"); return; }
    if (action === "repair") { state.pathway = "repair"; state.fromRepairHub = false; navigate("repair-hub"); return; }
    state.pathway = "dispose";
    state.fromRepairHub = false;
    navigate("services");
  }));
}

function providerOptions() {
  const options = [
    ["all", "All repair options"],
    ["repair_cafe", "Community Repair Cafés"],
    ["electronics_repair", "Electronics repair"],
    ["repair_service", "Repair services"],
    ["electronics_shop_repair", "Shops offering repair"]
  ];
  return state.serviceSafetyMode === "clear" ? options : options.filter(([id]) => id !== "repair_cafe");
}

function friendlyProviderType(item, isRepair) {
  if (!isRepair) return item.type || "Electrical-appliance recycling location";
  const labels = {
    repair_cafe: "Community repair event (Repair Café)",
    electronics_repair: "Electronics repair",
    electronics_shop_repair: "Shop offering repair",
    repair_service: "Repair service",
    electronics_shop: "Electronics shop"
  };
  return labels[item.providerType] || item.type || "Repair option";
}

function renderServiceCard(item, isRepair, index) {
  const locationText = [item.address, item.suburb, item.postcode].filter(Boolean).join(", ");
  const distance = Number.isFinite(item.distanceKm) ? `${item.distanceKm < 10 ? item.distanceKm.toFixed(1) : Math.round(item.distanceKm)} km away` : "";
  const callBefore = isRepair ? "Call before visiting to make sure they can help with your appliance." : "Check before travelling to confirm this facility accepts your appliance.";
  return `<article class="service-card" data-location-id="${escapeAttr(item.id)}">
    <div class="service-card-head"><span class="map-number">${index + 1}</span><div><p class="mini-label">${escapeHtml(friendlyProviderType(item, isRepair))}${distance ? ` · ${escapeHtml(distance)}` : ""}</p><h3>${escapeHtml(item.name)}</h3></div></div>
    <div class="service-facts">
      <p><span aria-hidden="true">⌖</span><strong>${escapeHtml(locationText || "Address not listed")}</strong></p>
      ${item.phone ? `<p><span aria-hidden="true">☎</span><strong>${escapeHtml(item.phone)}</strong></p>` : ""}
      ${item.openingHours ? `<p><span aria-hidden="true">◷</span><strong>${escapeHtml(item.openingHours)}</strong></p>` : ""}
    </div>
    <p class="call-before">${callBefore}</p>
    <div class="service-actions">${locationHasCoordinates(item) ? `<button class="button ghost compact" type="button" data-show-map="${escapeAttr(item.id)}">Show on map</button>` : ""}${telephoneLink(item.phone)}${directionsLink(item)}${item.url ? externalLink(item.url, "Website", "button ghost compact") : ""}</div>
    <details class="plain-details source-detail"><summary>About this listing</summary><p>${escapeHtml(item.verificationNote || "FixForward has not independently checked this place. Contact the organisation before visiting.")}</p>${item.sourceRetrievedAt ? `<p><strong>Information date:</strong> ${escapeHtml(item.sourceRetrievedAt)}</p>` : ""}${item.sourceUrl ? externalLink(item.sourceUrl, "See where this information came from") : ""}</details>
  </article>`;
}

function currentServiceResult() {
  if (!availability("locations")) return { matches: [], total: 0, mode: "unavailable" };
  const availableLocations = state.pathway === "repair" && state.serviceSafetyMode !== "clear"
    ? locations().filter((item) => ["electronics_repair", "repair_service", "electronics_shop_repair"].includes(item.providerType))
    : locations();
  const providerType = state.pathway === "repair" ? state.filters.providerType : "all";
  if (state.userLocation) return getNearbyLocations(state.userLocation, state.pathway, availableLocations, { radiusKm: state.filters.radiusKm, providerType, limit: 12 });
  if (state.areaSelection) return getNearbyLocations(state.areaSelection, state.pathway, availableLocations, { radiusKm: state.filters.radiusKm, providerType, limit: 12 });
  if (state.area) return getLocations(state.area, state.pathway, availableLocations, 12);
  return { matches: [], total: 0, mode: "empty" };
}

function destroyMap() {
  if (mapInstance) { mapInstance.remove(); mapInstance = null; }
  mapMarkers = new Map();
}

function serviceCardForId(id) {
  return Array.from(app.querySelectorAll("[data-location-id]")).find((card) => card.dataset.locationId === String(id)) || null;
}

function focusMapLocation(id) {
  const marker = mapMarkers.get(String(id));
  if (!marker || !mapInstance) {
    showToast("The map is still getting ready.");
    return;
  }
  const point = marker.getLatLng();
  mapInstance.setView(point, Math.max(mapInstance.getZoom(), 14), { animate: true });
  marker.openPopup();
  const card = serviceCardForId(id);
  app.querySelectorAll(".service-card.map-highlight").forEach((item) => item.classList.remove("map-highlight"));
  card?.classList.add("map-highlight");
  app.querySelector("#services-map")?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
}

function ensureLeaflet() {
  if (globalThis.L) return Promise.resolve(true);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!value) {
        leafletPromise = null;
        document.querySelector('script[data-fixforward-leaflet]')?.remove();
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), 8000);

    const existingCss = document.querySelector('link[data-fixforward-leaflet]');
    if (!existingCss) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      css.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      css.crossOrigin = "anonymous";
      css.dataset.fixforwardLeaflet = "true";
      document.head.append(css);
    }

    const existingScript = document.querySelector('script[data-fixforward-leaflet]');
    if (existingScript) {
      existingScript.addEventListener("load", () => finish(Boolean(globalThis.L)), { once: true });
      existingScript.addEventListener("error", () => finish(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "anonymous";
    script.dataset.fixforwardLeaflet = "true";
    script.onload = () => finish(Boolean(globalThis.L));
    script.onerror = () => finish(false);
    document.head.append(script);
  });
  return leafletPromise;
}

async function renderMap(result) {
  destroyMap();
  const mapEl = app.querySelector("#services-map");
  if (!mapEl) return;
  if (result.mode === "unavailable") {
    mapEl.innerHTML = `<div class="map-fallback">The map will appear when service information is available.</div>`;
    return;
  }
  if (result.mode === "empty") {
    mapEl.innerHTML = `<div class="map-fallback">Use your location or search a suburb to show places on the map.</div>`;
    return;
  }
  if (!result.matches.length) {
    mapEl.innerHTML = `<div class="map-fallback">There are no matching places to show on the map for this search.</div>`;
    return;
  }
  const mappable = result.matches
    .map((item, resultIndex) => ({ item, resultIndex }))
    .filter(({ item }) => locationHasCoordinates(item));
  if (!mappable.length) {
    mapEl.innerHTML = `<div class="map-fallback">These results do not have map coordinates yet. The service list still works.</div>`;
    return;
  }
  mapEl.innerHTML = `<div class="map-fallback">Loading map…</div>`;
  const loaded = await ensureLeaflet();
  if (!loaded || !globalThis.L || !document.contains(mapEl)) {
    if (document.contains(mapEl)) mapEl.innerHTML = `<div class="map-fallback">The map could not load. The service list still works.</div>`;
    return;
  }

  const defaultCentre = state.userLocation
    ? [state.userLocation.latitude, state.userLocation.longitude]
    : state.areaSelection
      ? [state.areaSelection.latitude, state.areaSelection.longitude]
      : [mappable[0].item.latitude, mappable[0].item.longitude];
  mapEl.replaceChildren();
  mapInstance = globalThis.L.map(mapEl, { scrollWheelZoom: false }).setView(defaultCentre, (state.userLocation || state.areaSelection) ? 12 : 11);
  globalThis.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
  }).addTo(mapInstance);

  const bounds = [];
  if (state.userLocation) {
    const point = [state.userLocation.latitude, state.userLocation.longitude];
    bounds.push(point);
    globalThis.L.circleMarker(point, { radius: 9, weight: 3, color: "#061f57", fillColor: "#ffffff", fillOpacity: 1 }).addTo(mapInstance).bindPopup("Your approximate location");
  } else if (state.areaSelection) {
    const point = [state.areaSelection.latitude, state.areaSelection.longitude];
    bounds.push(point);
    globalThis.L.circleMarker(point, { radius: 8, weight: 3, color: "#061f57", fillColor: "#ffffff", fillOpacity: 1 }).addTo(mapInstance).bindPopup(`Selected area: ${escapeHtml(state.areaSelection.label)}`);
  }

  mappable.forEach(({ item, resultIndex }) => {
    const point = [item.latitude, item.longitude];
    bounds.push(point);
    const marker = globalThis.L.marker(point, { title: item.name, alt: `${resultIndex + 1}. ${item.name}` }).addTo(mapInstance).bindPopup(`<strong>${escapeHtml(resultIndex + 1)}. ${escapeHtml(item.name)}</strong><br>${escapeHtml([item.suburb, item.postcode].filter(Boolean).join(" "))}`);
    mapMarkers.set(String(item.id), marker);
    marker.on("click", () => {
      const card = serviceCardForId(item.id);
      app.querySelectorAll(".service-card.map-highlight").forEach((element) => element.classList.remove("map-highlight"));
      card?.classList.add("map-highlight");
      card?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
    });
  });

  if (bounds.length > 1) mapInstance.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
}

function renderServiceResults(result, isRepair) {
  if (result.mode === "empty") return `<div class="service-empty"><span>⌖</span><h2>Use your location or type a suburb to see options.</h2><p>If you choose current location, it is used in this browser to sort nearby places and is not saved to FixForward's database.</p></div>`;
  if (!result.matches.length) {
    const context = result.mode === "nearby"
      ? state.areaSelection
        ? `within ${state.filters.radiusKm} km of ${escapeHtml(state.areaSelection.label)}`
        : `within ${state.filters.radiusKm} km of your location`
      : `for ${escapeHtml(state.area)}`;
    return `<div class="service-empty"><span>⌖</span><h2>No matching place found ${context}.</h2><p>Try a wider distance, another suburb/postcode, or use the official wider-search option below. FixForward will not invent a provider.</p></div>`;
  }
  const context = result.mode === "nearby"
    ? state.areaSelection
      ? `Nearest to ${escapeHtml(state.areaSelection.label)} · within ${state.filters.radiusKm} km`
      : `Nearest first · within ${state.filters.radiusKm} km`
    : "Results for the area you typed";
  return `<div class="results-head"><strong>${formatCount(result.total)} option${result.total === 1 ? "" : "s"} found</strong><span>${context}</span></div><div class="service-list">${result.matches.map((item, index) => renderServiceCard(item, isRepair, index)).join("")}</div>`;
}

function quickCheckPassedBanner() {
  return `<div class="quick-check-pass"><span aria-hidden="true">✓</span><div><strong>Quick check completed</strong><p>You did not report one of the serious warning signs in this check. This is not a guarantee that the appliance is safe.</p></div></div>`;
}

function serviceSafetyBanner() {
  if (state.pathway === "repair" && state.serviceSafetyMode !== "clear") {
    return `<div class="service-caution-banner"><span aria-hidden="true">!</span><div><strong>Contact a repair business for advice first.</strong><p>Safety is still unclear. These listings are places to ask about an assessment, not a recommendation to repair or use the appliance. Ask whether they are qualified to assess it. Community Repair Cafés are not included on this path.</p></div></div>`;
  }
  if (state.serviceSafetyMode === "high") {
    return `<div class="service-danger-banner"><span aria-hidden="true">!</span><div><strong>Do not transport it while it is hot, smoking, leaking or actively damaged.</strong><p>You reported a serious warning sign. These recycling results are for planning only. Contact the facility or an appropriate safety service before moving the appliance.</p></div></div>`;
  }
  if (state.serviceSafetyMode === "caution") {
    return `<div class="service-caution-banner"><span aria-hidden="true">!</span><div><strong>Contact the facility before moving this appliance.</strong><p>A warning or uncertainty was reported. Tell the facility what you noticed. If the appliance is hot, smoking, leaking or actively damaged, do not transport it until you have appropriate safety advice.</p></div></div>`;
  }
  return quickCheckPassedBanner();
}

function optionBackLabel() {
  const previous = history.state?.fromScreen;
  if (previous === "cost") return "Back to cost comparison";
  if (previous === "repair-hub") return "Back to repair options";
  if (previous === "results") return "Back to my options";
  if (state.serviceSafetyMode === "high" || state.serviceSafetyMode === "caution") return "Back to safety guidance";
  if (state.fromRepairHub) return "Back to repair options";
  return state.intent === "guide" ? "Back to my options" : "Back to quick check";
}

function areaSuggestionsHtml() {
  if (!state.areaSuggestions.length) return "";
  return `<div id="area-suggestions" class="area-suggestions" role="listbox" aria-label="Matching Melbourne suburbs and postcodes">${state.areaSuggestions.map((item, index) => `<button type="button" class="area-option ${index === state.areaActiveIndex ? "active" : ""}" role="option" id="area-option-${index}" aria-selected="${index === state.areaActiveIndex}" data-area-index="${index}"><strong>${escapeHtml(item.postcode)}</strong><span>${escapeHtml(item.suburb)}</span></button>`).join("")}</div>`;
}

function refreshAreaSuggestions(value) {
  ++geoGeneration;
  if (state.geoStatus === "loading") state.geoStatus = "idle";
  state.area = String(value || "").slice(0, 50);
  state.areaSelection = null;
  state.areaSuggestions = findSuburbSuggestions(state.area, SUBURB_POSTCODES, 8);
  state.areaActiveIndex = state.areaSuggestions.length ? 0 : -1;
  const input = app.querySelector("#area");
  const box = app.querySelector("#area-suggestions-wrap");
  if (input) {
    input.setAttribute("aria-expanded", String(state.areaSuggestions.length > 0));
    input.setAttribute("aria-activedescendant", state.areaActiveIndex >= 0 ? `area-option-${state.areaActiveIndex}` : "");
  }
  if (box) box.innerHTML = areaSuggestionsHtml();
  bindAreaSuggestionClicks();
}

function bindAreaSuggestionClicks() {
  app.querySelectorAll("[data-area-index]").forEach((button) => button.addEventListener("click", () => chooseAreaSuggestion(Number(button.dataset.areaIndex))));
}

function chooseAreaSuggestion(index) {
  const item = state.areaSuggestions[index];
  if (!item) return;
  ++geoGeneration;
  state.area = item.label;
  state.areaSelection = { latitude: Number(item.latitude), longitude: Number(item.longitude), postcode: String(item.postcode), suburb: item.suburb, label: item.label };
  state.areaSuggestions = [];
  state.areaActiveIndex = -1;
  state.userLocation = null;
  state.geoStatus = "idle";
  renderServices();
  focusElement("#area");
}

function submitAreaSearch() {
  const input = app.querySelector("#area");
  const value = input?.value.trim() || "";
  const resolved = resolveAreaInput(value, SUBURB_POSTCODES);
  const error = app.querySelector("#area-error");
  if (!resolved.valid) {
    state.area = value.slice(0, 50);
    state.areaSelection = null;
    if (error) error.textContent = resolved.message;
    input?.setAttribute("aria-invalid", "true");
    input?.focus();
    refreshAreaSuggestions(state.area);
    return;
  }
  ++geoGeneration;
  state.area = resolved.label;
  state.areaSelection = resolved;
  state.areaSuggestions = [];
  state.areaActiveIndex = -1;
  state.userLocation = null;
  state.geoStatus = "idle";
  renderServices();
  focusElement("#area");
}

function renderServices() {
  destroyMap();
  setStage("options");
  const isRepair = state.pathway === "repair";
  const result = currentServiceResult();
  const dataAvailable = availability("locations");
  const hasSearchCentre = Boolean(state.userLocation || state.areaSelection);
  app.innerHTML = `<section class="screen services-screen">
    ${renderBack(optionBackLabel())}
    <div class="services-hero"><div><p class="eyebrow">${isRepair ? "Repair" : "Recycle"} · Melbourne</p><h1>${isRepair ? "Find repair options near you." : "Find places that take old electrical appliances near you."}</h1><p>${isRepair ? "See repair listings on a map, then call before visiting to check they can help with your appliance." : "These are often called e-waste or electrical-appliance recycling locations. Check that the place accepts your appliance before travelling."}</p><div class="appliance-inline"><span aria-hidden="true">↻</span><strong>${escapeHtml(state.appliance.category)}</strong>${state.appliance.brand || state.appliance.model ? `<small>${escapeHtml([state.appliance.brand, state.appliance.model].filter(Boolean).join(" "))}</small>` : ""}</div></div><div class="privacy-location">${icon("lock")}<p><strong>Your location is optional.</strong><span>Use it to sort nearby results, or type a suburb/postcode instead. FixForward does not save your exact coordinates.</span></p></div></div>
    ${serviceSafetyBanner()}
    ${subtleRecallStatus()}

    ${!dataAvailable ? `<div class="notice warning"><strong>${publicDataLoading ? "Service information is still loading…" : "Service information is unavailable right now."}</strong><p>${publicDataLoading ? "You can stay on this page. It will update automatically when the service list is ready." : "You can retry without restarting your journey."}</p>${publicDataLoading ? "" : `<button class="button secondary" id="retry-data" type="button">Try again</button>`}</div>` : `<div class="locator-panel">
      <div class="location-actions">
        <button class="button primary location-button" id="use-location" type="button" ${state.geoStatus === "loading" ? "disabled" : ""}>⌖ ${state.geoStatus === "loading" ? "Finding your location…" : state.userLocation ? "Update my location" : "Use my current location"}</button>
        <span>or</span>
        <form id="area-form" class="inline-search area-combobox" novalidate>
          <label class="sr-only" for="area">Suburb or postcode</label>
          <div class="area-input-wrap">
            <input id="area" name="area" maxlength="50" value="${escapeAttr(state.area)}" placeholder="Start typing, e.g. 312 or Richmond" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="${state.areaSuggestions.length > 0}" aria-controls="area-suggestions" aria-activedescendant="${state.areaActiveIndex >= 0 ? `area-option-${state.areaActiveIndex}` : ""}" aria-describedby="area-error">
            <div id="area-suggestions-wrap">${areaSuggestionsHtml()}</div>
            <small id="area-error" class="field-error" role="alert"></small>
          </div>
          <button class="button secondary" type="submit">Search</button>
        </form>
      </div>
      ${state.geoStatus === "denied" ? `<p class="geo-message">Location permission was not available. That is okay — type your suburb or postcode instead.</p>` : ""}
      ${state.areaSelection ? `<p class="selected-area"><strong>Using:</strong> ${escapeHtml(state.areaSelection.label)} <span>· nearby results, not exact-address tracking</span></p>` : ""}
      ${hasSearchCentre ? `<div class="filter-row"><label>Distance<select id="radius-filter"><option value="5" ${state.filters.radiusKm === 5 ? "selected" : ""}>Within 5 km</option><option value="10" ${state.filters.radiusKm === 10 ? "selected" : ""}>Within 10 km</option><option value="25" ${state.filters.radiusKm === 25 ? "selected" : ""}>Within 25 km</option><option value="50" ${state.filters.radiusKm === 50 ? "selected" : ""}>Within 50 km</option></select></label>${isRepair ? `<label>Type<select id="provider-filter">${providerOptions().map(([value,label]) => `<option value="${value}" ${state.filters.providerType === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>` : ""}</div>` : ""}
    </div>`}

    <div class="map-and-list">
      <div class="map-column"><div id="services-map" class="services-map" aria-label="Map of service results"></div><p class="map-note">Map data © OpenStreetMap contributors. Distances are approximate straight-line distances. Use Directions for the actual route.</p></div>
      <div id="location-results" class="results-column" role="status" aria-live="polite" aria-atomic="true">${dataAvailable ? renderServiceResults(result, isRepair) : ""}</div>
    </div>

    ${isRepair ? `<section class="repair-intel-after-map"><div class="section-heading compact-heading"><p class="eyebrow">Repair history</p><h2>What happened with similar appliances?</h2><p>See the repair history after the practical service options. It gives context, not a prediction for your exact appliance.</p></div>${repairEvidenceSummary()}</section>` : ""}

    <section class="wider-help"><h2>Still not finding the right place?</h2><p>${isRepair ? "The directory may be incomplete. You can also contact your manufacturer or retailer to ask about an appropriate repair service." : "Facility acceptance changes. Confirm that the location accepts your appliance before travelling."}</p><div class="button-row">${isRepair ? state.serviceSafetyMode === "clear" ? externalLink("https://www.repaircafe.org/en/visit/", "Search wider Repair Café information", "button ghost") : externalLink("https://www.energysafe.vic.gov.au/", "Electrical safety guidance", "button ghost") : externalLink("https://www.sustainability.vic.gov.au/recycling-and-reducing-waste-at-home/recycling-at-home/e-waste", "Victorian electrical-appliance recycling guidance", "button ghost")}</div></section>
  </section>`;

  bindBack();
  bindAreaSuggestionClicks();
  app.querySelector("#retry-data")?.addEventListener("click", async () => {
    await reloadPublicData({ announce: true });
    if (state.screen === "services") focusElement(availability("locations") ? "#area" : "#retry-data");
  });
  app.querySelector("#use-location")?.addEventListener("click", requestUserLocation);
  const areaInput = app.querySelector("#area");
  areaInput?.addEventListener("input", (event) => {
    const error = app.querySelector("#area-error");
    if (error) error.textContent = "";
    event.target.setAttribute("aria-invalid", "false");
    refreshAreaSuggestions(event.target.value);
  });
  areaInput?.addEventListener("keydown", (event) => {
    if (!state.areaSuggestions.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      state.areaActiveIndex = (state.areaActiveIndex + delta + state.areaSuggestions.length) % state.areaSuggestions.length;
      const box = app.querySelector("#area-suggestions-wrap");
      if (box) box.innerHTML = areaSuggestionsHtml();
      areaInput.setAttribute("aria-activedescendant", `area-option-${state.areaActiveIndex}`);
      bindAreaSuggestionClicks();
    } else if (event.key === "Enter" && state.areaActiveIndex >= 0) {
      event.preventDefault();
      chooseAreaSuggestion(state.areaActiveIndex);
    } else if (event.key === "Escape") {
      state.areaSuggestions = [];
      state.areaActiveIndex = -1;
      const box = app.querySelector("#area-suggestions-wrap");
      if (box) box.innerHTML = "";
      areaInput.setAttribute("aria-expanded", "false");
      areaInput.setAttribute("aria-activedescendant", "");
    }
  });
  app.querySelector("#area-form")?.addEventListener("submit", (event) => { event.preventDefault(); submitAreaSearch(); });
  app.querySelector("#radius-filter")?.addEventListener("change", (event) => { state.filters.radiusKm = Number(event.target.value); renderServices(); focusElement("#radius-filter"); });
  app.querySelector("#provider-filter")?.addEventListener("change", (event) => { state.filters.providerType = event.target.value; renderServices(); focusElement("#provider-filter"); });
  app.querySelectorAll("[data-show-map]").forEach((button) => button.addEventListener("click", () => focusMapLocation(button.dataset.showMap)));
  renderMap(result);
}

function requestUserLocation() {
  const generation = ++geoGeneration;
  const activeJourney = journeyId;
  const isCurrent = () => generation === geoGeneration && activeJourney === journeyId && state.screen === "services";
  if (!navigator.geolocation) {
    state.geoStatus = "denied";
    showToast("This browser cannot provide location. Type a suburb instead.");
    renderServices();
    return;
  }
  state.geoStatus = "loading";
  renderServices();
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (!isCurrent()) return;
      state.userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMetres: position.coords.accuracy };
      state.area = "";
      state.areaSelection = null;
      state.areaSuggestions = [];
      state.areaActiveIndex = -1;
      state.geoStatus = "granted";
      renderServices();
      focusElement("#use-location");
      showToast("Nearby options updated.");
    },
    () => {
      if (!isCurrent()) return;
      state.userLocation = null;
      state.geoStatus = "denied";
      renderServices();
      focusElement("#area");
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}

function productMatchLevel() {
  if (state.appliance.brand && state.appliance.model) return { label: "Exact product requested", copy: `${state.appliance.brand} ${state.appliance.model}` };
  if (state.appliance.brand) return { label: "Brand-level request", copy: `${state.appliance.brand} ${state.appliance.category}` };
  return { label: "Appliance-type request", copy: state.appliance.category };
}

function costSafetyBanner() {
  if (state.safetyResult?.status === "uncertain") {
    return `<div class="service-caution-banner"><span aria-hidden="true">?</span><div><strong>Explore costs while you arrange safety advice.</strong><p>We cannot recommend repair or replacement while safety is unclear. A lower price does not mean the appliance is safe to use.</p></div></div>`;
  }
  if (state.safetyResult?.status === "caution") {
    return `<div class="service-caution-banner"><span aria-hidden="true">!</span><div><strong>You reported something that needs attention.</strong><p>You can use cost information for planning, but do not use a lower price as a reason to keep using an appliance that should be checked.</p></div></div>`;
  }
  return quickCheckPassedBanner();
}

function costContextResultHtml() {
  const identity = [state.appliance.brand, state.appliance.model].filter(Boolean).join(" ");
  const identityNote = state.appliance.brand && state.appliance.model
    ? `<strong>Brand + model supplied:</strong> ${escapeHtml(identity)}. FixForward has not verified a model-specific repair price, so the figures below remain provider service-fee examples.`
    : state.appliance.brand
      ? `<strong>Brand supplied:</strong> ${escapeHtml(state.appliance.brand)}. The figures below are not brand-specific quotes.`
      : `<strong>Appliance type only:</strong> ${escapeHtml(state.appliance.category)}. The figures below are not product-specific quotes.`;
  const cards = COST_CONTEXT_SOURCES.map((item) => `<article class="price-source-card"><p class="mini-label">Published service-fee example</p><h3>${escapeHtml(item.provider)}</h3><p class="price-context-amount">${money(item.amount)}${item.secondaryAmount ? `<small> · labour cap ${money(item.secondaryAmount)}</small>` : ""}</p><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.note)}</p><small>Checked ${escapeHtml(item.retrieved)} · confirm before booking</small>${externalLink(item.url, "See provider pricing", "text-link")}</article>`).join("");
  return `<section class="cost-context-result" tabindex="-1" aria-live="polite">
    <div class="context-summary"><p class="eyebrow">About these examples</p><h2>Inspection-fee examples — not your repair quote</h2><p>${identityNote}</p>${state.problemContext ? `<div id="problem-summary"><p>Your description: <strong>${escapeHtml(state.problemContext.label)}</strong>. This is a summary, not a diagnosis or a personalised price.</p><p><strong>Useful details for a repairer:</strong> ${escapeHtml(problemQuestions(state.problemContext.code))}</p><p>Describe only what you have already noticed. Do not switch it on or open it to investigate.</p></div>` : ""}<p>These general examples may not apply to your appliance. Confirm the current fee and appliance coverage with the provider.</p></div>
    <div class="price-source-grid">${cards}</div>
  </section>`;
}

function recordedPricesHtml() {
  const rows = matchPriceExamples(priceCatalogue.prices, state.appliance);
  const exact = rows.some((row) => row.match === "exact");
  const identity = [state.appliance.brand, state.appliance.model].filter(Boolean).join(" ");
  const matchNote = exact ? `We found a recorded price for the brand and model you entered. Check the variant and specifications on the retailer page.`
    : state.appliance.model ? `No exact brand and model match is recorded for ${identity || "your appliance"}. These are examples of the same appliance type; specifications may differ.`
      : `These are ${state.appliance.category.toLowerCase()} examples. Compare capacity, features and size with what your household needs.`;
  const status = priceCatalogue.mode === "database" ? "Price catalogue loaded. Prices remain dated observations, not live offers."
    : priceCatalogue.mode === "unavailable" ? "The price catalogue is unavailable. You can still enter a price you found."
      : "Showing the saved price catalogue. Current pricing has not been verified; check with the retailer.";
  return `<div class="retail-catalogue-heading"><p class="eyebrow">Replacement price ideas · AUD</p><h2>Recorded retail examples</h2><p>${escapeHtml(matchNote)}</p></div>
    <p class="catalogue-status" role="status">${status}</p>
    <p class="small-copy">A small reference sample, not a market-wide comparison or a recommendation to replace your appliance. Prices can change; delivery and installation may cost extra. Stock is not confirmed.</p>
    ${rows.length ? `<div class="retail-price-grid">${rows.map((row) => `<article class="retail-price-card"><span class="price-match-label">${row.match === "exact" ? "Same brand and model" : row.match === "brand" ? "Same brand · different model" : "Same appliance type"}</span><h3>${escapeHtml(row.productName)}</h3><p class="retail-model">${escapeHtml(row.brand)} · Model ${escapeHtml(row.model)}</p><p class="price-context-amount">${money(row.priceAud)} <small>AUD</small></p><p>${escapeHtml(row.retailer)}<br><small>Source reviewed ${escapeHtml(row.observedAt)}${row.stale ? " · older than 90 days" : ""}</small></p>${row.notes ? `<details class="plain-details price-record-details"><summary>Price details and limitations</summary><p class="small-copy">${escapeHtml(row.notes)}</p></details>` : ""}${row.availability === "out-of-stock" ? `<p class="field-error">Recorded as out of stock.</p>` : ""}<div class="retail-card-actions">${externalLink(row.sourceUrl, "Check retailer price", "text-link")}${!row.stale && row.availability !== "out-of-stock" ? `<button class="button secondary" type="button" data-use-price="${escapeAttr(row.id)}">Use ${money(row.priceAud)} in comparison<span class="sr-only"> for ${escapeHtml(row.productName)}</span></button>` : `<p class="small-copy">Check a current price before comparing.</p>`}</div></article>`).join("")}</div>` : `<div class="notice"><strong>No recorded examples for this appliance type yet.</strong><p>Enter a price from a retailer for a similar size and type. We will not substitute an unrelated appliance.</p></div>`}`;
}

function refreshRecordedPrices() {
  if (priceRequest) return;
  priceRequest = loadPriceCatalogue(PRICE_SNAPSHOT).then((catalogue) => {
    priceCatalogue = catalogue;
    const section = app.querySelector("#recorded-prices");
    if (state.screen === "cost" && section) section.innerHTML = recordedPricesHtml();
  });
}

function renderCost() {
  setStage("options");
  const c = state.comparison;
  const match = productMatchLevel();
  const maxCost = c?.valid ? Math.max(c.repair, c.replacement) : 0;
  const repairWidth = c?.valid && maxCost ? (c.repair / maxCost) * 100 : 0;
  const replacementWidth = c?.valid && maxCost ? (c.replacement / maxCost) * 100 : 0;
  const canShowRepairFinder = state.safetyResult?.status !== "high" && state.recall?.status !== "possible";
  app.innerHTML = `<section class="screen narrow cost-screen">
    ${renderBack(optionBackLabel())}
    <div class="step-heading friendly-heading"><p class="eyebrow">Compare costs</p><h1>Start with what you know.</h1><p>Compare your repair quote with a replacement price. If you need a starting point, explore recorded retail prices and inspection-fee examples below.</p></div>
    ${costSafetyBanner()}
    ${subtleRecallStatus()}

    <details class="smart-cost-card" ${state.feeExamplesOpen ? "open" : ""}><summary>See inspection-fee examples (optional)</summary>
      <div class="smart-cost-head"><span class="beta-pill">Repair fees explained</span><h2>${escapeHtml(match.copy)}</h2><p>Optional: describe the problem to prepare useful details for a repairer. The fee examples are general and do not change with your description.</p></div>
      <form id="problem-form" class="cost-context-form" novalidate>
        <label for="problem">What is the appliance doing? (optional)</label>
        <textarea id="problem" name="problem" class="problem-input" minlength="5" maxlength="300" rows="4" aria-describedby="problem-hint problem-error" placeholder="e.g. It turns on but loses suction after a few minutes.">${escapeHtml(state.problem)}</textarea>
        <div class="field-meta"><small id="problem-hint">5–300 characters. Do not open or switch the appliance on again just to describe it.</small><small id="problem-count">${String(state.problem || "").length}/300</small></div>
        <small class="field-error" id="problem-error" role="alert"></small>
        <button class="button primary" type="submit">Add a problem summary ${icon("arrow")}</button>
      </form>
      ${costContextResultHtml()}
      <details class="plain-details"><summary>Are these fees a quote for my appliance?</summary><p>No. These are published examples of inspection or call-out fees. The same examples appear for different appliances. Contact a repairer to check whether they handle yours and ask for the full cost, including parts, labour and delivery.</p></details>
    </details>

    <section class="manual-cost-card"><div class="manual-cost-head"><p class="eyebrow">Already have real prices?</p><h2>Compare your repair quote with a replacement price</h2><p>Enter the amounts you already have, including any extra fees. These values stay in this browser tab and are not saved by FixForward.</p><details class="plain-details"><summary>I do not have a quote or replacement price yet</summary><p>For repair, ask about the inspection fee, parts, labour and delivery before agreeing to work. For replacement, compare a similar size and type, including delivery. You can check fee examples below or find repair contacts at the end of this page.</p><p>Before paying, check with your retailer or manufacturer whether they can help. You do not have to decide today.</p></details></div>
      <form id="cost-form" class="cost-form" novalidate>
        <label>Repair quote (AUD)<span>From a repairer. Enter 0 if the repair is confirmed free.</span><div class="money-input"><b>$</b><input name="repair" inputmode="decimal" maxlength="24" value="${escapeAttr(state.costs.repair)}" placeholder="e.g. 180" aria-describedby="repair-error"></div><small class="field-error" id="repair-error"></small></label>
        <label>Replacement price (AUD)<span>For a reasonably similar replacement you found</span><div class="money-input"><b>$</b><input name="replacement" inputmode="decimal" maxlength="24" value="${escapeAttr(state.costs.replacement)}" placeholder="e.g. 320" aria-describedby="replacement-error"></div><small class="field-error" id="replacement-error"></small></label>
        <button class="button secondary" type="submit">Compare these prices</button>
      </form>
      ${state.selectedPrice ? `<p id="selected-price-note" class="selected-price-note">Using a recorded ${escapeHtml(state.selectedPrice.retailer)} price for ${escapeHtml(state.selectedPrice.productName)}, reviewed ${escapeHtml(state.selectedPrice.observedAt)}. Check current pricing and add any delivery or installation costs. This is not a repair or replacement recommendation.</p>` : ""}
      ${c?.valid ? `<section class="comparison-result" tabindex="-1" aria-live="polite"><div class="comparison-summary"><p>${c.lower === "equal" ? "The two upfront prices are the same." : `<strong>${c.lower === "repair" ? "Repair" : "Replacement"}</strong> is <strong>${money(c.difference)}</strong> lower using the two prices you entered.`}</p></div><div class="cost-bars" role="img" aria-label="Repair quote ${money(c.repair)}. Replacement price ${money(c.replacement)}."><div><span>Repair</span><div class="cost-track"><i style="width:${repairWidth.toFixed(2)}%"></i></div><strong>${money(c.repair)}</strong></div><div><span>Replacement</span><div class="cost-track"><i style="width:${replacementWidth.toFixed(2)}%"></i></div><strong>${money(c.replacement)}</strong></div></div><div class="notice success"><strong>Price is only one part of the decision.</strong><p>Safety, recall instructions, whether repair is possible, the condition of the appliance and waste impact can also matter.</p></div></section>` : ""}
    </section>

    <section class="cost-next-actions"><h2>What would you like to do next?</h2><div class="button-row">${canShowRepairFinder ? `<button class="button primary" id="cost-find-repair" type="button">Find repair options</button>` : ""}<button class="button secondary" id="cost-find-recycle" type="button">Find recycling options</button></div></section>
  </section>`;
  app.querySelector(".smart-cost-card")?.addEventListener("toggle", (event) => { state.feeExamplesOpen = event.target.open; });
  const manualCard = app.querySelector(".manual-cost-card");
  app.querySelector(".smart-cost-card")?.before(manualCard);
  manualCard.insertAdjacentHTML("afterend", `<section id="recorded-prices" class="retail-catalogue" aria-label="Recorded retail examples">${recordedPricesHtml()}</section>`);
  app.querySelector("#recorded-prices")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-use-price]");
    if (!button) return;
    const row = matchPriceExamples(priceCatalogue.prices, state.appliance).find((item) => item.id === button.dataset.usePrice);
    if (!row || row.stale || row.availability === "out-of-stock") return;
    state.costs.replacement = String(row.priceAud);
    state.selectedPrice = row;
    state.comparison = null;
    renderCost();
    focusElement('[name="replacement"]');
    showToast("Recorded price added. Check extra costs before comparing.");
  });
  refreshRecordedPrices();
  bindBack();
  app.querySelectorAll('#cost-form input').forEach((input) => input.addEventListener("input", (event) => {
    state.costs[event.target.name] = event.target.value;
    if (event.target.name === "replacement") { state.selectedPrice = null; app.querySelector("#selected-price-note")?.remove(); }
    state.comparison = null;
    app.querySelector(".comparison-result")?.remove();
    app.querySelector(`#${event.target.name}-error`).textContent = "";
    event.target.setAttribute("aria-invalid", "false");
  }));
  const problemInput = app.querySelector("#problem");
  problemInput?.addEventListener("input", (event) => {
    state.problem = event.target.value.slice(0, 300);
    state.problemContext = null;
    app.querySelector("#problem-summary")?.remove();
    const count = app.querySelector("#problem-count");
    if (count) count.textContent = `${state.problem.length}/300`;
    app.querySelector("#problem-error").textContent = "";
    event.target.setAttribute("aria-invalid", "false");
  });
  app.querySelector("#problem-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.feeExamplesOpen = true;
    if (!problemInput?.value.trim()) { state.problemContext = null; renderCost(); focusElement(".cost-context-result"); return; }
    const result = validateProblem(problemInput?.value || "");
    if (!result.valid) {
      app.querySelector("#problem-error").textContent = result.message;
      problemInput?.setAttribute("aria-invalid", "true");
      problemInput?.focus();
      return;
    }
    state.problem = result.value;
    state.problemContext = classifyProblem(result.value);
    renderCost();
    focusElement(".cost-context-result");
  });
  app.querySelector("#cost-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.costs.repair = app.querySelector('[name="repair"]')?.value.trim() || "";
    state.costs.replacement = app.querySelector('[name="replacement"]')?.value.trim() || "";
    const result = compareCosts(state.costs.repair, state.costs.replacement);
    state.comparison = result;
    if (!result.valid) {
      ["repair", "replacement"].forEach((name) => {
        const input = app.querySelector(`[name="${name}"]`);
        const message = result.errors[name] || "";
        app.querySelector(`#${name}-error`).textContent = message;
        input?.setAttribute("aria-invalid", message ? "true" : "false");
      });
      app.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    renderCost();
    focusElement(".comparison-result");
  });
  app.querySelector("#cost-find-repair")?.addEventListener("click", () => openPathway("repair"));
  app.querySelector("#cost-find-recycle")?.addEventListener("click", () => openPathway("dispose"));
}

function bindBack() { app.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", back)); }

function renderScreen() {
  destroyMap();
  if (["check", "results", "repair-hub", "services", "cost"].includes(state.screen) && !state.appliance.category) state.screen = "landing";
  if (["results", "repair-hub", "services", "cost"].includes(state.screen) && !state.safetyOptOut && !relevantSigns().every(([id]) => Boolean(state.safety[id]))) {
    state.safetyResult = null;
    state.decision = null;
    state.screen = "check";
  }
  if (["repair-hub", "services", "cost"].includes(state.screen)) {
    // Browser Forward and delayed API data must respect the latest check.
    if (!state.safetyResult && (state.safetyOptOut || relevantSigns().every(([id]) => Boolean(state.safety[id])))) state.safetyResult = currentSafetyResult();
    if (!state.safetyResult) state.screen = "check";
    else {
      const status = currentSafetyResult().status;
      state.safetyResult = currentSafetyResult();
      state.decision = journeyDecision(state.recall?.status || "insufficient", status);
      const allowedDisposal = state.screen === "services" && state.pathway === "dispose" && state.recall?.status !== "possible";
      if (state.recall?.status === "possible" || (status === "high" && !allowedDisposal) || (state.screen === "repair-hub" && status !== "clear")) state.screen = "results";
      state.serviceSafetyMode = status === "high" ? "high" : ["uncertain", "caution"].includes(status) ? "caution" : "clear";
    }
  }
  if (history.state?.screen !== state.screen) {
    const url = new URL(location.href);
    url.hash = state.screen === "landing" ? "" : state.screen;
    history.replaceState({ ...history.state, fixForward: true, screen: state.screen, journeyId }, "", url);
  }
  const titles = { landing: "Home", identify: "Your appliance", check: "Quick safety check", results: "Your options", "repair-hub": "Repair options", services: state.pathway === "dispose" ? "Find recycling services" : "Find repair services", cost: "Compare repair and replacement costs" };
  document.title = `${titles[state.screen] || "Your options"} | FixForward`;
  if (!publicData) { renderLoading(); return; }
  const renderers = { landing: renderLanding, identify: renderIdentify, check: renderCheck, results: renderResults, "repair-hub": renderRepairHub, services: renderServices, cost: renderCost };
  (renderers[state.screen] || renderLanding)();
  // Animate navigation once, never a background refresh or an answer edit.
  // Safety warnings stay still and immediately readable.
  const changedScreen = renderedScreen !== state.screen;
  renderedScreen = state.screen;
  if (changedScreen && !app.querySelector(".urgent-card, .recall-result-card, .attention-card, .caution-card, .priority-card, .service-danger-banner")) {
    app.firstElementChild?.classList.add("screen-enter");
  }
}

function groupName(source) {
  const text = `${source.name || ""} ${source.use || ""} ${source.limitations || ""}`.toLowerCase();
  if (text.includes("recall") || text.includes("accc")) return "Product safety notices";
  if (text.includes("energy safe") || text.includes("safety")) return "Electrical safety";
  if (text.includes("repair") && !text.includes("location") && !text.includes("cafe")) return "Repair history";
  if (text.includes("cafe") || text.includes("location") || text.includes("openstreetmap")) return "Repair locations & map";
  if (text.includes("waste") || text.includes("recycl")) return "Recycling";
  if (text.includes("price") || text.includes("retail")) return "Prices";
  return "Other information";
}

function renderAbout() {
  if (!publicData) return;
  const groups = {};
  sources().forEach((source) => { (groups[groupName(source)] ||= []).push(source); });
  groups["Recorded retail prices"] = (priceCatalogue.prices || []).map((row) => ({
    name: `${row.retailer}: ${row.productName} (${row.model})`,
    limitations: `${money(row.priceAud)} AUD. ${row.notes || "Recorded price; confirm current pricing and stock."}`,
    retrievalDate: row.observedAt, url: row.sourceUrl
  }));
  groups["Inspection-fee examples"] = COST_CONTEXT_SOURCES.map((row) => ({
    name: row.provider, limitations: `${row.label}: ${money(row.amount)}. ${row.note}`,
    retrievalDate: row.retrieved, url: row.url
  }));
  aboutContent.innerHTML = `<div class="about-intro"><h3>How FixForward helps</h3><p>FixForward brings together safety notices, repair information and local service listings to help you decide what to do next.</p></div>
    <div class="privacy-box"><h3>Your privacy</h3><p>A temporary access cookie keeps this browser unlocked for up to four hours. It contains no appliance answers. Use Lock website to end access.</p><p>FixForward does not intentionally store your appliance choices, safety answers, cost values or exact device coordinates. If you choose “Use my current location”, nearby sorting is calculated in the browser from service coordinates already loaded. Your browser/operating system handles the location permission, and OpenStreetMap receives ordinary requests for the map area displayed. The hosting provider may still process normal technical access logs such as IP address, time and requested page.</p></div>
    <div class="source-availability"><h3>What is working right now</h3>${[["Product safety information","recalls"],["Repair history","repairEvidence"],["Melbourne service locations","locations"]].map(([label,key]) => `<p><span class="status-dot ${availability(key) ? "ok" : "warn"}"></span><strong>${label}</strong> — ${availability(key) ? "loaded" : "currently unavailable/limited"}</p>`).join("")}</div>
    ${Object.entries(groups).map(([group, items]) => `<details class="source-group"><summary>${escapeHtml(group)} <span>${items.length}</span></summary><ul class="source-list">${items.map((source) => `<li><strong>${escapeHtml(source.name)}</strong><p>${escapeHtml(source.use || source.limitations || "Public information source")}</p><small>${source.retrievalDate ? `Retrieved ${escapeHtml(source.retrievalDate)}` : ""}${source.version ? ` · Version ${escapeHtml(source.version)}` : ""}</small>${source.url ? externalLink(source.url, "Open original source") : ""}</li>`).join("")}</ul></details>`).join("")}
    <div class="privacy-box"><h3>Important limits</h3><p>FixForward currently has only a small product-specific recall list, so the official Australian recall search is still the complete place to check. Repair history describes similar appliance types, not your exact appliance. Service listings may be incomplete or out of date, so call/check before travelling. Recorded retail prices include a model, source and review date. An exact match needs both the brand and model; other examples may differ in size and features. These are dated observations, not live offers or a repair quote. Service-fee examples stay separate from your own repair quote.</p></div>`;
}

function doRestart() {
  ++journeyId;
  ++geoGeneration;
  destroyMap();
  state = emptyState();
  history.replaceState({ fixForward: true, screen: "landing", journeyId }, "", location.pathname + location.search);
  restartDialog.close();
  renderLanding();
  focusMain();
}

restartButton.addEventListener("click", () => state.touched && state.screen !== "landing" ? restartDialog.showModal() : doRestart());
document.querySelector("#home-button")?.addEventListener("click", () => state.touched && state.screen !== "landing" ? restartDialog.showModal() : navigate("landing", { replace: true }));
document.querySelector("#confirm-restart")?.addEventListener("click", doRestart);
document.querySelectorAll("[data-close-restart]").forEach((button) => button.addEventListener("click", () => restartDialog.close()));
document.querySelector("#about-button")?.addEventListener("click", () => { renderAbout(); aboutDialog.showModal(); });
document.querySelector("#close-about")?.addEventListener("click", () => aboutDialog.close());

window.addEventListener("popstate", (event) => {
  ++geoGeneration;
  if (state.geoStatus === "loading") state.geoStatus = "idle";
  state.screen = event.state?.fixForward && event.state.journeyId === journeyId ? event.state.screen : "landing";
  renderScreen();
  focusMain();
});

// Render the useful static landing experience immediately. Public datasets load
// in the background, so a Render/Neon cold start never blocks the first screen.
releaseLabel.textContent = publicData.meta?.releaseVersion || "FixForward prototype";
if (!historyReady) {
  history.replaceState({ fixForward: true, screen: "landing", journeyId }, "", location.pathname + location.search);
  historyReady = true;
}
renderLanding();
reloadPublicData({ showLoading: false });
