import { loadPublicData } from "./data-service.js";
import {
  matchRecall,
  evaluateSafety,
  journeyDecision,
  compareCosts,
  getLocations,
  getNearbyLocations,
  applicableSafetySigns,
  locationHasCoordinates
} from "./logic.js";
import {
  CATEGORY_CODE_BY_NAME,
  EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY,
  SAFETY_RULES,
  GOALS
} from "./data.js";
import { icons } from "./icons.js";

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

let publicData = null;
let loadGeneration = 0;
let mapInstance = null;
let mapMarkers = new Map();
let leafletPromise = null;
let historyReady = false;

const emptyState = () => ({
  screen: "landing",
  intent: "guide",
  appliance: { family: "", category: "", categoryCode: "", brand: "", model: "" },
  recall: null,
  safety: {},
  safetyResult: null,
  decision: null,
  pathway: null,
  area: "",
  userLocation: null,
  geoStatus: "idle",
  filters: { radiusKm: 10, providerType: "all" },
  costs: { repair: "", replacement: "" },
  comparison: null,
  touched: false
});
let state = emptyState();

function icon(name) { return icons[name] || ""; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function escapeAttr(value) { return escapeHtml(value); }
function money(value) { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(value); }
function formatCount(value) { return new Intl.NumberFormat("en-AU").format(Number(value) || 0); }
function showToast(message) { toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2600); }
function focusMain() { main?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "smooth" }); }
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
  state.screen = screen;
  markTouched();
  const url = new URL(location.href);
  url.hash = screen === "landing" ? "" : screen;
  history[replace ? "replaceState" : "pushState"]({ fixForward: true, screen }, "", url);
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

async function reloadPublicData({ announce = false } = {}) {
  const generation = ++loadGeneration;
  renderLoading(announce ? "Trying the public information again…" : "Getting FixForward ready…");
  try {
    const data = await loadPublicData();
    if (generation !== loadGeneration) return;
    publicData = data;
    releaseLabel.textContent = data.meta?.releaseVersion || "FixForward prototype";
    renderAbout();
    if (announce) showToast(Object.values(data.availability || {}).some(Boolean) ? "Information refreshed." : "Some information is still unavailable.");
    renderScreen();
  } catch {
    publicData = { families: [], recalls: [], safetySigns: [], sources: [], repairEvidence: [], locations: [], availability: {}, errors: {} };
    renderScreen();
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
  setStage(null);
  app.innerHTML = `<section class="landing goal-first">
    <div class="hero-simple">
      <div class="hero-copy-simple">
        <p class="kicker">For Melbourne households with a faulty appliance</p>
        <h1>Something wrong with an appliance?</h1>
        <p class="lede">Tell us what you want to do. We will do a quick safety check first, then help you repair it, compare costs or recycle it responsibly.</p>
        <div class="hero-reassurance"><span>${icon("shield")} Safety check first</span><span>${icon("lock")} No account needed</span><span>⏱ Quick to use</span></div>
      </div>
      <div class="hero-appliance-visual" aria-hidden="true">
        <div class="visual-ring ring-one"></div><div class="visual-ring ring-two"></div>
        <div class="visual-device">⚡<small>broken?</small></div>
        <span class="floating-chip chip-repair">🔧 Repair</span>
        <span class="floating-chip chip-cost">⚖ Compare</span>
        <span class="floating-chip chip-recycle">♻ Recycle</span>
      </div>
    </div>

    <section class="goal-section" aria-labelledby="goal-title">
      <div class="section-heading compact-heading">
        <p class="eyebrow">Start with what you need</p>
        <h2 id="goal-title">What would you like to do?</h2>
        <p>You do not need to understand recalls, repair data or electrical terms. FixForward explains anything important as you go.</p>
      </div>
      <div class="goal-grid">${GOALS.map(goalCard).join("")}</div>
      <p class="safety-promise">${icon("shield")} <strong>Every option includes a quick safety check.</strong> If something sounds unsafe or a product safety notice may apply, FixForward changes the next step.</p>
    </section>

    <section class="impact-simple" aria-label="Why this matters">
      <span aria-hidden="true">♻</span><div><p class="eyebrow">Why this matters</p><h2>Use it longer when that makes sense. Recycle it properly when it does not.</h2><p>FixForward helps you check repair before unnecessary replacement and find a responsible next step for an appliance that is finished.</p></div>
    </section>

    <section class="explain-strip">
      <article><span class="explain-icon">!</span><div><h3>What is a product recall?</h3><p>Sometimes a manufacturer or government asks people to stop using, repair or return a product because it may be unsafe. That is called a <strong>product recall</strong>.</p></div></article>
      <article><span class="explain-icon">↻</span><div><h3>Why check repair first?</h3><p>A broken appliance is not always finished. FixForward helps you understand repair options before you decide to replace it.</p></div></article>
      <article><span class="explain-icon">⌖</span><div><h3>Melbourne-focused help</h3><p>Where location information is available, you can use your current location or type a suburb/postcode. FixForward does not save your exact coordinates.</p></div></article>
    </section>

    <section class="trust-note">
      <div><p class="eyebrow">Simple on the surface, careful underneath</p><h2>We show the action first. The detailed evidence is there only when you want it.</h2></div>
      <p>FixForward does not claim that an appliance is definitely safe, does not invent a recall result, and does not make up a repair or replacement price. Detailed sources and limitations sit under “About the information”.</p>
    </section>
  </section>`;

  app.querySelectorAll("[data-intent]").forEach((button) => button.addEventListener("click", () => {
    state.intent = button.dataset.intent;
    state.pathway = button.dataset.intent === "recycle" ? "dispose" : button.dataset.intent;
    navigate("identify");
  }));
}

function intentHeading() {
  if (state.intent === "repair") return { eyebrow: "Repair", title: "What appliance needs help?", copy: "Tell us what it is. Brand and model are useful if you know them, but they are not required." };
  if (state.intent === "compare") return { eyebrow: "Compare costs", title: "What appliance are you comparing?", copy: "We will check important safety information before showing the cost comparison." };
  if (state.intent === "recycle") return { eyebrow: "Recycle", title: "What appliance do you want to recycle?", copy: "We will quickly check for safety or recall instructions before showing disposal options." };
  return { eyebrow: "Help me decide", title: "What appliance is causing trouble?", copy: "Choose the closest match. We will guide you from there." };
}

function renderIdentify() {
  setStage("appliance");
  const selectedFamily = families().find((family) => family.id === state.appliance.family);
  const heading = intentHeading();
  app.innerHTML = `<section class="screen wide-screen">
    ${renderBack("Back to choices")}
    <div class="step-heading friendly-heading"><p class="eyebrow">${heading.eyebrow}</p><h1>${heading.title}</h1><p>${heading.copy}</p></div>

    <div class="identify-layout">
      <section>
        <h2 class="form-section-title">1. Choose a group</h2>
        <div class="family-grid simple-family-grid">${families().map((family) => `<button class="choice-card ${state.appliance.family === family.id ? "selected" : ""}" type="button" data-family="${escapeAttr(family.id)}"><span class="family-icon" aria-hidden="true">${escapeHtml(family.icon || "○")}</span><strong>${escapeHtml(family.name)}</strong><small>${escapeHtml(family.hint)}</small></button>`).join("")}</div>
      </section>

      <section class="category-panel ${selectedFamily ? "ready" : "locked"}" aria-labelledby="category-title">
        <h2 class="form-section-title" id="category-title">2. Choose your appliance</h2>
        ${selectedFamily ? `<div class="category-grid simple-category-grid">${selectedFamily.categories.map((category) => `<button class="category-button ${state.appliance.category === category ? "selected" : ""}" type="button" data-category="${escapeAttr(category)}"><span>${escapeHtml(category)}</span><span aria-hidden="true">${state.appliance.category === category ? "✓" : "→"}</span></button>`).join("")}</div>` : `<div class="locked-placeholder">Choose a group above first.</div>`}
      </section>
    </div>

    ${state.appliance.category ? `<section class="product-details-card">
      <div><p class="eyebrow">Optional</p><h2>Do you know the brand or model?</h2><p>This can help us spot a possible product safety notice. It is okay if you do not know.</p></div>
      <div class="form-grid">
        <label>Brand<input name="brand" maxlength="100" value="${escapeAttr(state.appliance.brand)}" autocomplete="off" placeholder="e.g. Dyson, Breville, Mistral"></label>
        <label>Model number<input name="model" maxlength="100" value="${escapeAttr(state.appliance.model)}" autocomplete="off" placeholder="e.g. BVC 160"><small>Spaces, dashes and slashes are okay.</small></label>
      </div>
      <details class="plain-details"><summary>Where can I find the model number?</summary><p>Look for a sticker or rating label on the bottom, back, underside, inside a battery compartment or near the power cord. Do not open the appliance to find it.</p></details>
      <div class="continue-row"><button class="button primary large" id="continue-check" type="button">Quick safety check ${icon("arrow")}</button><span>Usually less than a minute.</span></div>
    </section>` : ""}
  </section>`;

  bindBack();
  app.querySelectorAll("[data-family]").forEach((button) => button.addEventListener("click", () => {
    state.appliance = { family: button.dataset.family, category: "", categoryCode: "", brand: "", model: "" };
    state.safety = {};
    state.recall = null;
    renderIdentify();
    app.querySelector(".category-panel")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }));
  app.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
    state.appliance.category = button.dataset.category;
    state.appliance.categoryCode = CATEGORY_CODE_BY_NAME[button.dataset.category] || "";
    state.safety = {};
    state.recall = null;
    renderIdentify();
    app.querySelector(".product-details-card")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }));
  app.querySelector("#continue-check")?.addEventListener("click", () => {
    state.appliance.brand = app.querySelector('[name="brand"]')?.value.trim() || "";
    state.appliance.model = app.querySelector('[name="model"]')?.value.trim() || "";
    state.recall = matchRecall(state.appliance, recalls(), availability("recalls"));
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

function relevantSigns() { return applicableSafetySigns(state.appliance.category, safetySigns()); }

function renderCheck() {
  setStage("check");
  const signs = relevantSigns();
  const answered = signs.filter(([id]) => state.safety[id]).length;
  app.innerHTML = `<section class="screen narrow check-screen">
    ${renderBack("Back to appliance")}
    <div class="step-heading friendly-heading"><p class="eyebrow">Quick safety check</p><h1>Before we show your options, a few quick questions.</h1><p>Only answer what you can safely see, smell or feel during normal use. <strong>Do not switch the appliance on just to test it.</strong></p></div>

    ${recallMiniCard()}

    <form id="safety-form" novalidate>
      <div class="question-list simple-questions">${signs.map(([id, label], index) => {
        const rule = SAFETY_RULES[id];
        return `<fieldset class="question-card">
          <legend><span class="question-number">${index + 1}</span><span>${escapeHtml(label)}</span></legend>
          <p class="question-help">${escapeHtml(rule?.explanation || "")}</p>
          <div class="segmented large-segmented">
            ${[["yes","Yes"],["no","No"],["unsure","Not sure"]].map(([value, text]) => `<label><input type="radio" name="${escapeAttr(id)}" value="${value}" ${state.safety[id] === value ? "checked" : ""}><span>${text}</span></label>`).join("")}
          </div>
        </fieldset>`;
      }).join("")}</div>
      <div class="form-error" id="safety-error" role="alert"></div>
      <div class="sticky-action simple-sticky"><div><strong>${answered} of ${signs.length} answered</strong><span>Answer each question to continue.</span></div><button class="button primary" type="submit">Show my options ${icon("arrow")}</button></div>
    </form>
  </section>`;

  bindBack();
  app.querySelectorAll('#safety-form input[type="radio"]').forEach((input) => input.addEventListener("change", (event) => {
    state.safety[event.target.name] = event.target.value;
    const count = relevantSigns().filter(([id]) => state.safety[id]).length;
    const text = app.querySelector(".simple-sticky strong");
    if (text) text.textContent = `${count} of ${relevantSigns().length} answered`;
  }));
  app.querySelector("#safety-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const missing = relevantSigns().filter(([id]) => !state.safety[id]);
    if (missing.length) {
      app.querySelector("#safety-error").textContent = `Please answer the remaining ${missing.length} question${missing.length === 1 ? "" : "s"}.`;
      app.querySelector(`[name="${missing[0][0]}"]`)?.focus();
      return;
    }
    state.safetyResult = evaluateSafety(state.safety);
    state.decision = journeyDecision(state.recall?.status || "insufficient", state.safetyResult.status);

    // Goal-first UX: if the safety/recall gate does not override the journey,
    // take the user straight to the thing they asked for on the landing page.
    // "Help me decide" intentionally keeps the options screen.
    const blockedBySafety = ["high", "uncertain"].includes(state.safetyResult.status);
    const blockedByRecall = state.recall?.status === "possible";
    if (!blockedBySafety && !blockedByRecall) {
      if (state.intent === "repair") { state.pathway = "repair"; navigate("services"); return; }
      if (state.intent === "recycle") { state.pathway = "dispose"; navigate("services"); return; }
      if (state.intent === "compare") { state.pathway = "cost"; navigate("cost"); return; }
    }
    navigate("results");
  });
}

function repairEvidenceForAppliance() {
  const mappedCode = EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY[state.appliance.categoryCode];
  if (!mappedCode) return null;
  return repairEvidence().find((item) => item.categoryCode === mappedCode) || null;
}

function repairEvidenceSummary() {
  if (!availability("repairEvidence")) return `<p class="soft-copy">Repair-history information is not available right now.</p>`;
  const evidence = repairEvidenceForAppliance();
  if (!evidence || !evidence.sampleSize) return `<p class="soft-copy">We do not have enough repair-history information for this appliance type yet.</p>`;
  const fixedPct = Math.round((evidence.fixedCount / evidence.sampleSize) * 100);
  const repairablePct = Math.round((evidence.repairableCount / evidence.sampleSize) * 100);
  const geography = evidence.geography === "AU" ? "Australian" : "global";
  const mapped = EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY[state.appliance.categoryCode] !== state.appliance.categoryCode;
  return `<div class="repair-snapshot">
    <div class="repair-number"><strong>${fixedPct}%</strong><span>fixed during recorded community repair events</span></div>
    <div class="repair-bar" aria-label="Repair outcome summary"><span class="bar-fixed" style="width:${Math.min(100, fixedPct)}%"></span><span class="bar-later" style="width:${Math.min(100 - fixedPct, repairablePct)}%"></span></div>
    <p><strong>${formatCount(evidence.fixedCount)} of ${formatCount(evidence.sampleSize)}</strong> recorded ${geography.toLowerCase()} repair attempts were fixed during the event. Another ${formatCount(evidence.repairableCount)} were considered repairable after more work.</p>
    <details class="plain-details evidence-details"><summary>How we got this number</summary><p>This is community repair-event history for a category, not a prediction for your exact appliance.${mapped ? " Your appliance is mapped to a broader repair category." : ""}</p><dl><dt>Records</dt><dd>${formatCount(evidence.sampleSize)}</dd><dt>Area</dt><dd>${escapeHtml(geography)}</dd><dt>Source</dt><dd>Open Repair Alliance</dd></dl><p>${escapeHtml(evidence.limitation || "Community repair data is self-selected and may not represent all household repairs.")}</p></details>
  </div>`;
}

function subtleRecallStatus() {
  if (state.recall?.status === "none") return `<div class="small-status"><span>✓</span><p><strong>No exact model match in our current recall list.</strong> This is not a guarantee that there is no recall. ${externalLink("https://www.productsafety.gov.au/recalls", "Check the official search")}</p></div>`;
  if (state.recall?.status === "insufficient") return `<div class="small-status"><span>i</span><p><strong>Product-specific recall check not completed.</strong> You can still use the official Australian recall search if you want to check the exact model.</p></div>`;
  if (state.recall?.status === "unavailable") return `<div class="small-status warning-status"><span>!</span><p><strong>Our recall information could not load.</strong> Use the official recall search for a complete check.</p></div>`;
  return "";
}

function resultActionCard(id, iconText, title, description, cta, featured = false) {
  return `<article class="result-action ${featured ? "featured" : ""}"><span class="result-action-icon" aria-hidden="true">${iconText}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><button class="button ${featured ? "primary" : "secondary"}" type="button" data-action="${escapeAttr(id)}">${escapeHtml(cta)} ${icon("arrow")}</button></article>`;
}

function renderResults() {
  setStage("options");
  const safety = state.safetyResult || evaluateSafety(state.safety);
  const decision = state.decision || journeyDecision(state.recall?.status || "insufficient", safety.status);
  state.safetyResult = safety;
  state.decision = decision;
  const possibleRecall = state.recall?.status === "possible";

  if (safety.status === "high") {
    app.innerHTML = `<section class="screen narrow result-screen">
      ${renderBack("Back to safety questions")}
      <div class="urgent-card"><span class="urgent-icon">!</span><p class="eyebrow">Serious safety warning</p><h1>Stop using this appliance for now.</h1><p>You told us about a warning sign that could be unsafe. Switch it off and unplug it <strong>only if it is safe to do so</strong>. Do not keep testing it.</p><div class="reported-simple">${safety.critical.map((id) => `<span>${escapeHtml(SAFETY_RULES[id]?.explanation || id)}</span>`).join("")}</div></div>
      ${possibleRecall ? `<div class="priority-card"><strong>A product recall may also apply.</strong><p>Check the official recall instructions before deciding to repair, replace or recycle it.</p>${externalLink(state.recall?.match?.noticeUrl || "https://www.productsafety.gov.au/recalls", "See official recall instructions", "button danger")}</div>` : ""}
      <div class="next-now"><h2>What should I do now?</h2><div class="next-steps"><article><span>1</span><div><strong>Do not use it again for now</strong><p>A serious warning sign needs a safer next step than a community repair event.</p></div></article><article><span>2</span><div><strong>Have it checked by an appropriate qualified person</strong><p>For electrical safety concerns, use professional advice rather than continuing to test the appliance yourself.</p></div></article></div><div class="button-row">${externalLink("https://www.energysafe.vic.gov.au/", "Energy Safe Victoria guidance", "button primary")}${externalLink("https://www.productsafety.gov.au/recalls", "Check recalls", "button secondary")}</div></div>
    </section>`;
    bindBack(); return;
  }

  if (safety.status === "uncertain") {
    app.innerHTML = `<section class="screen narrow result-screen">
      ${renderBack("Back to safety questions")}
      <div class="caution-card"><span class="urgent-icon">?</span><p class="eyebrow">Get it checked first</p><h1>We would not keep using this appliance yet.</h1><p>One of your answers suggests a possible problem or you were not sure. That does not mean the appliance is dangerous, but it is sensible to get it checked before relying on repair-cost or community repair options.</p></div>
      ${possibleRecall ? `<div class="priority-card"><strong>A product recall may also apply.</strong><p>Check the official recall instructions first.</p>${externalLink(state.recall?.match?.noticeUrl || "https://www.productsafety.gov.au/recalls", "See official recall instructions", "button danger")}</div>` : ""}
      <div class="button-row">${externalLink("https://www.energysafe.vic.gov.au/", "Electrical safety guidance", "button primary")}${externalLink("https://www.productsafety.gov.au/recalls", "Check recalls", "button secondary")}</div>
    </section>`;
    bindBack(); return;
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
      ${resultActionCard("compare", "⚖", "Compare costs", "Use a real repair quote and replacement price. Automatic trusted price matching is being prepared, without made-up estimates.", "Compare costs", featuredIntent === "compare")}
      ${resultActionCard("dispose", "♻", "Recycle it", "Find Melbourne-focused e-waste locations and see available places on a map.", "Find recycling", featuredIntent === "recycle")}
    </div>
    <section class="repair-context-card"><div><p class="eyebrow">Before you decide</p><h2>How repairable have similar appliances been?</h2></div>${repairEvidenceSummary()}</section>
  </section>`;

  bindBack();
  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "compare") { state.pathway = "cost"; navigate("cost"); return; }
    state.pathway = action === "dispose" ? "dispose" : "repair";
    navigate("services");
  }));
}

function providerOptions() {
  return [
    ["all", "All repair options"],
    ["repair_cafe", "Community Repair Cafés"],
    ["electronics_repair", "Electronics repair"],
    ["repair_service", "Repair services"],
    ["electronics_shop_repair", "Shops offering repair"]
  ];
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
  if (state.userLocation) return getNearbyLocations(state.userLocation, state.pathway, locations(), { radiusKm: state.filters.radiusKm, providerType: state.pathway === "repair" ? state.filters.providerType : "all", limit: 12 });
  if (state.area) return getLocations(state.area, state.pathway, locations(), 12);
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
  app.querySelector("#services-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function ensureLeaflet() {
  if (globalThis.L) return Promise.resolve(true);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve) => {
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

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "anonymous";
    script.dataset.fixforwardLeaflet = "true";
    script.onload = () => resolve(Boolean(globalThis.L));
    script.onerror = () => { leafletPromise = null; resolve(false); };
    document.head.append(script);
  });
  return leafletPromise;
}

async function renderMap(result) {
  destroyMap();
  const mapEl = app.querySelector("#services-map");
  if (!mapEl) return;
  mapEl.innerHTML = `<div class="map-fallback">Loading map…</div>`;
  const loaded = await ensureLeaflet();
  if (!loaded || !globalThis.L || !document.contains(mapEl)) {
    if (document.contains(mapEl)) mapEl.innerHTML = `<div class="map-fallback">The map could not load. The service list still works.</div>`;
    return;
  }
  const mappable = result.matches
    .map((item, resultIndex) => ({ item, resultIndex }))
    .filter(({ item }) => locationHasCoordinates(item));
  if (!mappable.length && !state.userLocation) {
    mapEl.innerHTML = `<div class="map-fallback">No map coordinates are available for these results yet.</div>`;
    return;
  }

  const defaultCentre = state.userLocation
    ? [state.userLocation.latitude, state.userLocation.longitude]
    : [mappable[0].item.latitude, mappable[0].item.longitude];
  mapInstance = globalThis.L.map(mapEl, { scrollWheelZoom: false }).setView(defaultCentre, state.userLocation ? 12 : 11);
  globalThis.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
  }).addTo(mapInstance);

  const bounds = [];
  if (state.userLocation) {
    const point = [state.userLocation.latitude, state.userLocation.longitude];
    bounds.push(point);
    globalThis.L.circleMarker(point, { radius: 9, weight: 3, color: "#0b3a32", fillColor: "#ffffff", fillOpacity: 1 }).addTo(mapInstance).bindPopup("Your approximate location");
  }

  mappable.forEach(({ item, resultIndex }) => {
    const point = [item.latitude, item.longitude];
    bounds.push(point);
    const marker = globalThis.L.marker(point).addTo(mapInstance).bindPopup(`<strong>${escapeHtml(resultIndex + 1)}. ${escapeHtml(item.name)}</strong><br>${escapeHtml([item.suburb, item.postcode].filter(Boolean).join(" "))}`);
    mapMarkers.set(String(item.id), marker);
    marker.on("click", () => {
      const card = serviceCardForId(item.id);
      app.querySelectorAll(".service-card.map-highlight").forEach((element) => element.classList.remove("map-highlight"));
      card?.classList.add("map-highlight");
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  if (bounds.length > 1) mapInstance.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
}

function renderServiceResults(result, isRepair) {
  if (result.mode === "empty") return `<div class="service-empty"><span>⌖</span><h2>Use your location or type a suburb to see options.</h2><p>Your exact coordinates are used in this browser to sort the service list and are not sent to FixForward's database.</p></div>`;
  if (!result.matches.length) {
    const context = result.mode === "nearby" ? `within ${state.filters.radiusKm} km` : `for ${escapeHtml(state.area)}`;
    return `<div class="service-empty"><span>⌖</span><h2>No matching place found ${context}.</h2><p>Try a wider distance, another suburb/postcode, or use the official wider-search option below. FixForward will not invent a provider.</p></div>`;
  }
  return `<div class="results-head"><strong>${formatCount(result.total)} option${result.total === 1 ? "" : "s"} found</strong><span>${result.mode === "nearby" ? `Nearest first · within ${state.filters.radiusKm} km` : "Results for the area you typed"}</span></div><div class="service-list">${result.matches.map((item, index) => renderServiceCard(item, isRepair, index)).join("")}</div>`;
}

function quickCheckPassedBanner() {
  return `<div class="quick-check-pass"><span aria-hidden="true">✓</span><div><strong>Quick check completed</strong><p>You did not report one of the serious warning signs in this check. This is not a guarantee that the appliance is safe.</p></div></div>`;
}

function renderServices() {
  setStage("options");
  const isRepair = state.pathway === "repair";
  const result = currentServiceResult();
  const dataAvailable = availability("locations");
  app.innerHTML = `<section class="screen services-screen">
    ${renderBack("Back to my options")}
    <div class="services-hero"><div><p class="eyebrow">${isRepair ? "Repair" : "Recycle"} · Melbourne</p><h1>${isRepair ? "Find repair options near you." : "Find places that take old electrical appliances near you."}</h1><p>${isRepair ? "See repair listings on a map, then call before visiting to check they can help with your appliance." : "These are often called e-waste or electrical-appliance recycling locations. Check that the place accepts your appliance before travelling."}</p></div><div class="privacy-location">${icon("lock")}<p><strong>FixForward does not save your exact coordinates.</strong><span>Nearby sorting is calculated in your browser. The map provider receives normal requests for the map area you view.</span></p></div></div>
    ${quickCheckPassedBanner()}
    ${subtleRecallStatus()}

    ${!dataAvailable ? `<div class="notice warning"><strong>Service information is unavailable right now.</strong><p>You can retry without restarting your journey.</p><button class="button secondary" id="retry-data" type="button">Try again</button></div>` : `<div class="locator-panel">
      <div class="location-actions">
        <button class="button primary location-button" id="use-location" type="button" ${state.geoStatus === "loading" ? "disabled" : ""}>⌖ ${state.geoStatus === "loading" ? "Finding your location…" : state.userLocation ? "Update my location" : "Use my current location"}</button>
        <span>or</span>
        <form id="area-form" class="inline-search" novalidate><label class="sr-only" for="area">Suburb or postcode</label><input id="area" name="area" maxlength="80" value="${escapeAttr(state.area)}" placeholder="Type suburb or postcode" autocomplete="postal-code"><button class="button secondary" type="submit">Search</button></form>
      </div>
      ${state.geoStatus === "denied" ? `<p class="geo-message">Location permission was not available. That is okay — type your suburb or postcode instead.</p>` : ""}
      ${state.userLocation ? `<div class="filter-row"><label>Distance<select id="radius-filter"><option value="5" ${state.filters.radiusKm === 5 ? "selected" : ""}>Within 5 km</option><option value="10" ${state.filters.radiusKm === 10 ? "selected" : ""}>Within 10 km</option><option value="25" ${state.filters.radiusKm === 25 ? "selected" : ""}>Within 25 km</option><option value="50" ${state.filters.radiusKm === 50 ? "selected" : ""}>Within 50 km</option></select></label>${isRepair ? `<label>Type<select id="provider-filter">${providerOptions().map(([value,label]) => `<option value="${value}" ${state.filters.providerType === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>` : ""}</div>` : ""}
    </div>`}

    <div class="map-and-list">
      <div class="map-column"><div id="services-map" class="services-map" aria-label="Map of service results"></div><p class="map-note">Map data © OpenStreetMap contributors. Distances are approximate straight-line distances, not driving distance. Loading the map sends ordinary map-tile requests for the area shown to OpenStreetMap.</p></div>
      <div id="location-results" class="results-column" role="status" aria-live="polite" aria-atomic="true">${dataAvailable ? renderServiceResults(result, isRepair) : ""}</div>
    </div>

    ${isRepair ? `<section class="repair-intel-after-map"><div class="section-heading compact-heading"><p class="eyebrow">Optional context</p><h2>Have similar appliances been repaired before?</h2><p>This is background information only. It does not tell us whether your exact appliance can be repaired.</p></div>${repairEvidenceSummary()}</section>` : ""}

    <section class="wider-help"><h2>Still not finding the right place?</h2><p>${isRepair ? "FixForward's repair directory may be incomplete. A community Repair Café may not be suitable for every appliance or fault." : "Facility acceptance changes. Confirm that the location accepts your appliance before travelling."}</p><div class="button-row">${isRepair ? externalLink("https://www.repaircafe.org/en/visit/", "Search wider Repair Café information", "button ghost") : externalLink("https://www.sustainability.vic.gov.au/recycling-and-reducing-waste-at-home/recycling-at-home/e-waste", "Victorian electrical-appliance recycling guidance", "button ghost")}</div></section>
  </section>`;

  bindBack();
  app.querySelector("#retry-data")?.addEventListener("click", async () => { await reloadPublicData({ announce: true }); state.screen = "services"; renderServices(); });
  app.querySelector("#use-location")?.addEventListener("click", requestUserLocation);
  app.querySelector("#area-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.area = app.querySelector("#area")?.value.trim() || "";
    state.userLocation = null;
    state.geoStatus = "idle";
    renderServices();
  });
  app.querySelector("#radius-filter")?.addEventListener("change", (event) => { state.filters.radiusKm = Number(event.target.value); renderServices(); });
  app.querySelector("#provider-filter")?.addEventListener("change", (event) => { state.filters.providerType = event.target.value; renderServices(); });
  app.querySelectorAll("[data-show-map]").forEach((button) => button.addEventListener("click", () => focusMapLocation(button.dataset.showMap)));
  renderMap(result);
}

function requestUserLocation() {
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
      state.userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMetres: position.coords.accuracy };
      state.area = "";
      state.geoStatus = "granted";
      renderServices();
      showToast("Nearby options updated.");
    },
    () => {
      state.userLocation = null;
      state.geoStatus = "denied";
      renderServices();
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}

function productMatchLevel() {
  if (state.appliance.brand && state.appliance.model) return { label: "Exact product requested", copy: `${state.appliance.brand} ${state.appliance.model}` };
  if (state.appliance.brand) return { label: "Brand-level request", copy: `${state.appliance.brand} ${state.appliance.category}` };
  return { label: "Appliance-type request", copy: state.appliance.category };
}

function renderCost() {
  setStage("options");
  const c = state.comparison;
  const match = productMatchLevel();
  app.innerHTML = `<section class="screen narrow cost-screen">
    ${renderBack("Back to my options")}
    <div class="step-heading friendly-heading"><p class="eyebrow">Compare costs</p><h1>Is repairing it worth comparing with replacement?</h1><p>FixForward should eventually do most of this work for you. For this prototype, we show the planned smart flow but only calculate with prices that are actually available.</p></div>
    ${quickCheckPassedBanner()}
    ${subtleRecallStatus()}

    <section class="smart-cost-card">
      <div class="smart-cost-head"><span class="beta-pill">Smart cost finder · prototype</span><h2>${escapeHtml(match.copy)}</h2><p>${escapeHtml(match.label)}</p></div>
      <div class="cost-flow"><div><span>1</span><strong>Find the closest product match</strong><p>Use the exact model when we can. If the spelling is slightly off, FixForward can suggest likely matches for you to confirm.</p></div><div><span>2</span><strong>Use real price information</strong><p>A dollar value must come from a genuine, dated source. Product-name matching never creates the price.</p></div><div><span>3</span><strong>Show a useful range</strong><p>You should see whether the number is model-specific, brand-level or only a broad appliance estimate.</p></div></div>
      <div class="not-connected"><span>!</span><div><strong>Automatic prices are not ready in this prototype yet.</strong><p>We do not have enough trustworthy repair and replacement prices for exact appliance models to give you a useful automatic range. FixForward shows “not enough price information” instead of guessing.</p></div></div>
    </section>

    <details class="manual-compare" ${c?.valid ? "open" : ""}><summary>I already have a repair quote and replacement price</summary><div class="manual-compare-body"><p>Use the two values you already know. FixForward only compares the upfront amounts — it does not tell you which choice is automatically better.</p>
      <form id="cost-form" class="cost-form" novalidate>
        <label>Repair quote (AUD)<span>From a repairer/technician if available</span><div class="money-input"><b>$</b><input name="repair" inputmode="decimal" maxlength="12" value="${escapeAttr(state.costs.repair)}" placeholder="e.g. 180" aria-describedby="repair-error"></div><small class="field-error" id="repair-error"></small></label>
        <label>Replacement price (AUD)<span>For a reasonably similar product you found</span><div class="money-input"><b>$</b><input name="replacement" inputmode="decimal" maxlength="12" value="${escapeAttr(state.costs.replacement)}" placeholder="e.g. 320" aria-describedby="replacement-error"></div><small class="field-error" id="replacement-error"></small></label>
        <button class="button primary" type="submit">Compare my values</button>
      </form>
      ${c?.valid ? `<section class="comparison-card"><div><span>Repair quote</span><strong>${money(c.repair)}</strong></div><div><span>Replacement price</span><strong>${money(c.replacement)}</strong></div><p>${c.lower === "equal" ? "The two upfront amounts are the same." : `${c.lower === "repair" ? "Repair" : "Replacement"} is ${money(c.difference)} lower based on the two amounts you entered.`}</p><div class="notice success"><strong>Price is only one part of the decision.</strong><p>Safety, recall instructions, whether repair is actually possible, the condition of the appliance and waste impact can also matter.</p></div></section>` : ""}
    </div></details>

    <section class="cost-next"><h2>What would make the automatic version trustworthy?</h2><div class="mini-check-grid"><span>✓ Enough current price observations</span><span>✓ More than one independent seller/source</span><span>✓ Similar product type/capacity</span><span>✓ Visible date and source</span><span>✓ Brand/model fallback clearly labelled</span><span>✓ No AI-generated prices</span></div></section>
  </section>`;
  bindBack();
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
  });
}

function bindBack() { app.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", back)); }

function renderScreen() {
  destroyMap();
  if (!publicData) { renderLoading(); return; }
  if (state.screen === "landing") return renderLanding();
  if (state.screen === "identify") return renderIdentify();
  if (state.screen === "check") return renderCheck();
  if (state.screen === "results") return renderResults();
  if (state.screen === "services") return renderServices();
  if (state.screen === "cost") return renderCost();
  return renderLanding();
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
  aboutContent.innerHTML = `<div class="about-intro"><h3>What a normal user needs to know</h3><p>FixForward combines several public-information sources so you do not have to visit each one yourself. We show the useful action first and keep the technical detail here.</p></div>
    <div class="privacy-box"><h3>Your privacy</h3><p>FixForward does not intentionally store your appliance choices, safety answers, cost values or exact device coordinates. If you choose “Use my current location”, nearby sorting is calculated in the browser from service coordinates already loaded. Your browser/operating system handles the location permission, and OpenStreetMap receives ordinary requests for the map area displayed. The hosting provider may still process normal technical access logs such as IP address, time and requested page.</p></div>
    <div class="source-availability"><h3>What is working right now</h3>${[["Product safety information","recalls"],["Repair history","repairEvidence"],["Melbourne service locations","locations"]].map(([label,key]) => `<p><span class="status-dot ${availability(key) ? "ok" : "warn"}"></span><strong>${label}</strong> — ${availability(key) ? "loaded" : "currently unavailable/limited"}</p>`).join("")}</div>
    ${Object.entries(groups).map(([group, items]) => `<details class="source-group"><summary>${escapeHtml(group)} <span>${items.length}</span></summary><ul class="source-list">${items.map((source) => `<li><strong>${escapeHtml(source.name)}</strong><p>${escapeHtml(source.use || source.limitations || "Public information source")}</p><small>${source.retrievalDate ? `Retrieved ${escapeHtml(source.retrievalDate)}` : ""}${source.version ? ` · Version ${escapeHtml(source.version)}` : ""}</small>${source.url ? externalLink(source.url, "Open original source") : ""}</li>`).join("")}</ul></details>`).join("")}
    <div class="privacy-box"><h3>Important limits</h3><p>FixForward currently has only a small product-specific recall list, so the official Australian recall search is still the complete place to check. Repair history describes similar appliance types, not your exact appliance. Service listings may be incomplete or out of date, so call/check before travelling. Automatic prices are not shown until enough trustworthy price information is connected.</p></div>`;
}

function doRestart() {
  state = emptyState();
  history.replaceState({ fixForward: true, screen: "landing" }, "", location.pathname + location.search);
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
  state.screen = event.state?.fixForward ? event.state.screen : "landing";
  renderScreen();
  focusMain();
});

// Show a useful loading state before any network request. A Render/Neon cold
// start must never look like a broken blank page.
renderLoading();
if (!historyReady) {
  history.replaceState({ fixForward: true, screen: "landing" }, "", location.pathname + location.search);
  historyReady = true;
}
reloadPublicData();
