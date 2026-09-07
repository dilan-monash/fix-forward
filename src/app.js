import { loadPublicData } from "./data-service.js";
import {
  matchRecall,
  evaluateSafety,
  journeyDecision,
  compareCosts,
  getLocations,
  applicableSafetySigns
} from "./logic.js";
import { CATEGORY_CODE_BY_NAME, EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY, SAFETY_RULES } from "./data.js";
import { icons } from "./icons.js";

const app = document.querySelector("#app");
const main = document.querySelector("#main");
const progress = document.querySelector("#progress");
const progressShell = document.querySelector("#progress-shell");
const restartButton = document.querySelector("#restart-button");
const restartDialog = document.querySelector("#restart-dialog");
const sourcesDialog = document.querySelector("#sources-dialog");
const sourcesContent = document.querySelector("#sources-content");
const toast = document.querySelector("#toast");
const releaseLabel = document.querySelector("#release-label");

let publicData = null;
let loadGeneration = 0;
let internalHistoryReady = false;

const emptyState = () => ({
  screen: "landing",
  appliance: { family: "", category: "", categoryCode: "", brand: "", model: "" },
  recall: null,
  safety: {},
  safetyResult: null,
  decision: null,
  pathway: null,
  area: "",
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

function externalLink(url, label) {
  const safe = safeExternalUrl(url);
  return safe ? `<a href="${escapeAttr(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}<span class="sr-only"> (opens in a new tab)</span> ↗</a>` : "";
}

function setPhase(phase = null) {
  progressShell.hidden = !phase;
  const order = ["identify", "safety", "pathway", "cost"];
  const current = order.indexOf(phase);
  progress.querySelectorAll("li").forEach((item, index) => {
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
  const method = replace ? "replaceState" : "pushState";
  history[method]({ fixForward: true, screen }, "", url);
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

function dataStatusStrip() {
  if (!publicData) return "";
  const items = [
    ["Recall index", "recalls"],
    ["Repair evidence", "repairEvidence"],
    ["Melbourne services", "locations"]
  ];
  return `<div class="data-status" aria-label="Live public data status">${items.map(([label, key]) => `<span class="${availability(key) ? "ok" : "warn"}"><i aria-hidden="true"></i>${label}: ${availability(key) ? "available" : "limited"}</span>`).join("")}</div>`;
}

function renderLoading(message = "Connecting to FixForward’s public data…") {
  setPhase(null);
  app.innerHTML = `<section class="loading-screen" role="status" aria-live="polite"><div class="loader" aria-hidden="true"></div><p class="eyebrow">Preparing your assessment</p><h1>${escapeHtml(message)}</h1><p>Safety guidance is built into the application. Recall, repair-evidence and service data load independently so one unavailable source does not break the whole journey.</p></section>`;
}

async function reloadPublicData({ announce = false } = {}) {
  const generation = ++loadGeneration;
  renderLoading(announce ? "Retrying public data…" : "Connecting to FixForward’s public data…");
  try {
    const data = await loadPublicData();
    if (generation !== loadGeneration) return;
    publicData = data;
    releaseLabel.textContent = data.meta?.releaseVersion || "Iteration 1";
    renderSources();
    if (announce) showToast(Object.values(data.availability || {}).some(Boolean) ? "Public data refreshed." : "Public data is still limited.");
    renderScreen();
  } catch {
    publicData = { families: [], recalls: [], safetySigns: [], sources: [], repairEvidence: [], locations: [], availability: {} };
    renderScreen();
  }
}

function renderLanding() {
  state.screen = "landing";
  setPhase(null);
  const recallCount = availability("recalls") ? recalls().length : 0;
  app.innerHTML = `<section class="landing">
    <div class="landing-hero">
      <div class="hero-copy">
        <span class="kicker">A safer repair-or-replace decision</span>
        <h1>Before you throw it away, understand what the appliance is telling you.</h1>
        <p class="lede">FixForward brings recall screening, plain-language safety checks, repair evidence and Melbourne-focused next steps into one short journey.</p>
        <div class="button-row"><button class="button primary large" id="start-assessment" type="button">Start a 3–5 minute assessment ${icon("arrow")}</button><button class="button ghost" id="how-it-works" type="button">See how it works</button></div>
        <p class="privacy-inline">${icon("lock")} No account. No uploaded photos. Your appliance answers stay in this browser tab.</p>
        ${dataStatusStrip()}
      </div>
      <div class="hero-visual" aria-label="FixForward decision loop illustration">
        <div class="loop-core"><span>↻</span><strong>FixForward</strong><small>Understand → Act</small></div>
        <div class="orbit orbit-a"><b>1</b><span>Recall</span></div><div class="orbit orbit-b"><b>2</b><span>Safety</span></div><div class="orbit orbit-c"><b>3</b><span>Repair</span></div><div class="orbit orbit-d"><b>4</b><span>Recycle</span></div>
      </div>
    </div>

    <section class="landing-section" id="how-section">
      <div class="section-title"><p class="eyebrow">Identify → Educate → Action</p><h2>One journey, four decisions</h2><p>FixForward explains why each result appears instead of simply giving a red or green answer.</p></div>
      <div class="journey-cards">
        <article><span>01</span><h3>Identify the appliance</h3><p>Choose one of six supported families and a category. Add brand/model only if you know them.</p></article>
        <article><span>02</span><h3>Understand safety & recall</h3><p>We separate exact-model recall clues from general safety warning signs and explain uncertainty.</p></article>
        <article><span>03</span><h3>Choose the next action</h3><p>Explore professional assessment, community repair where appropriate, or responsible e-waste pathways.</p></article>
        <article><span>04</span><h3>Compare costs in context</h3><p>If the journey is not blocked by safety/recall concerns, compare a real repair quote with a replacement price.</p></article>
      </div>
    </section>

    <section class="impact-band">
      <div><p class="eyebrow">Why this matters</p><h2>Keeping repairable products in use can reduce premature e-waste.</h2></div>
      <p>FixForward does not tell you to repair at any cost. It helps you slow down the decision, check safety first and understand whether assessment, repair, replacement or recycling is the more responsible next step.</p>
    </section>

    <section class="trust-grid">
      <article>${icon("shield")}<h3>Safety-first</h3><p>Serious warning signs override cost comparison and community repair suggestions.</p></article>
      <article><span class="trust-icon">≠</span><h3>No false recall clearance</h3><p>A category-level or no-match result never means “not recalled.” The official ACCC source remains authoritative.</p></article>
      <article>${icon("lock")}<h3>Private by design</h3><p>FixForward does not intentionally store your appliance answers, safety responses, area search or quotes.</p></article>
    </section>

    <aside class="coverage-callout"><strong>Iteration 1 coverage</strong><p>Six appliance families and 19 categories are supported. The exact-model recall index is deliberately limited${availability("recalls") ? ` (${formatCount(recallCount)} reviewed recall product record${recallCount === 1 ? "" : "s"} currently loaded)` : " and currently unavailable"}. Always verify recalls through ACCC Product Safety.</p></aside>
  </section>`;
  app.querySelector("#start-assessment")?.addEventListener("click", () => navigate("identify"));
  app.querySelector("#how-it-works")?.addEventListener("click", () => app.querySelector("#how-section")?.scrollIntoView({ behavior: "smooth" }));
}

function renderIdentify() {
  setPhase("identify");
  const selectedFamily = families().find((family) => family.id === state.appliance.family);
  app.innerHTML = `<section class="screen narrow">
    ${renderBack("Back to overview")}
    <div class="step-heading"><p class="eyebrow">Step 1 · Identify</p><h1>What appliance are you checking?</h1><p>Choose the appliance family first. The category list stays locked until that choice is made.</p></div>
    <div class="family-grid">${families().map((family) => `<button class="choice-card ${state.appliance.family === family.id ? "selected" : ""}" type="button" data-family="${escapeAttr(family.id)}"><span class="choice-dot" aria-hidden="true"></span><strong>${escapeHtml(family.name)}</strong><small>${escapeHtml(family.hint)}</small></button>`).join("")}</div>
    <section class="category-panel ${selectedFamily ? "ready" : "locked"}" aria-labelledby="category-title">
      <div class="panel-head"><div><p class="mini-label">Appliance category</p><h2 id="category-title">${selectedFamily ? `Choose a ${escapeHtml(selectedFamily.name.toLowerCase())} appliance` : "Choose a family to unlock categories"}</h2></div><span class="status-pill">${selectedFamily ? "Ready" : "Locked"}</span></div>
      ${selectedFamily ? `<div class="category-grid">${[...selectedFamily.categories].sort((a,b)=>a.localeCompare(b)).map((category) => `<button class="category-button" type="button" data-category="${escapeAttr(category)}"><span>${escapeHtml(category)}</span>${icon("arrow")}</button>`).join("")}</div>` : `<div class="locked-placeholder">Select an appliance family above. This prevents accidental family/category combinations.</div>`}
    </section>
    <p class="privacy-inline">Your selection is not sent to the server.</p>
  </section>`;
  bindBack();
  app.querySelectorAll("[data-family]").forEach((button) => button.addEventListener("click", () => {
    state.appliance = { family: button.dataset.family, category: "", categoryCode: "", brand: "", model: "" };
    renderIdentify();
    app.querySelector(".category-panel")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }));
  app.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
    state.appliance.category = button.dataset.category;
    state.appliance.categoryCode = CATEGORY_CODE_BY_NAME[button.dataset.category] || "";
    state.recall = matchRecall(state.appliance, recalls(), availability("recalls"));
    navigate("recall");
  }));
}

function recallCoverageNote() {
  const count = availability("recalls") ? recalls().length : 0;
  return `<aside class="coverage-note"><strong>What this index can and cannot do</strong><p>${availability("recalls") ? `FixForward currently loaded ${formatCount(count)} reviewed recall product record${count === 1 ? "" : "s"}.` : "The FixForward recall index is currently unavailable."} This is not complete Australian recall coverage. A no-match result is not proof that your appliance is safe or not recalled.</p></aside>`;
}

function renderRecall() {
  setPhase("safety");
  if (!state.recall) state.recall = matchRecall(state.appliance, recalls(), availability("recalls"));
  const result = state.recall;
  const acccUrl = "https://www.productsafety.gov.au/recalls";
  let outcome = "";
  if (result.status === "unavailable") {
    outcome = `<div class="result-state amber"><span class="result-badge">Recall index unavailable</span><h2>We can still complete the safety screening.</h2><p>FixForward could not read its limited recall index. This does not mean there is no recall. Keep the warning visible and use the official ACCC search.</p>${externalLink(acccUrl, "Search official recalls")}</div>`;
  } else if (result.status === "possible") {
    const notice = safeExternalUrl(result.match.noticeUrl, ["productsafety.gov.au", "www.productsafety.gov.au"]);
    outcome = `<div class="result-state red"><span class="result-badge">Exact model identifier found</span><h2>This appliance may match a reviewed recall notice.</h2><p><strong>${escapeHtml(result.match.brand)} ${escapeHtml(result.match.productName || result.match.title)}</strong></p>${result.brandConflict ? `<div class="notice warning"><strong>Brand needs checking</strong>The model identifier matches, but the entered brand differs from the reviewed record. Check the official notice carefully.</div>` : ""}<p>FixForward cannot confirm product identity. Compare every model/serial detail on the official notice before acting.</p>${notice ? externalLink(notice, "Open the official ACCC notice") : externalLink(acccUrl, "Search official recalls")}</div>`;
  } else if (result.status === "none") {
    const near = result.near?.length ? `<div class="notice warning"><strong>Your model is very close to a reviewed identifier.</strong><p>We will not treat a partial/near match as a recall match. Re-check the model label and then use the official ACCC search.</p></div>` : "";
    outcome = `<div class="result-state blue"><span class="result-badge">No exact match in this limited index</span><h2>This is not a “not recalled” result.</h2><p>FixForward did not find the exact model identifier in the small reviewed index currently loaded.</p>${near}${externalLink(acccUrl, "Check the complete official recall search")}</div>`;
  } else {
    outcome = `<div class="result-state blue"><span class="result-badge">More detail can improve this screen</span><h2>A category cannot determine whether your appliance is recalled.</h2><p>${escapeHtml(state.appliance.category)} describes many different products. Add a brand/model if known, or continue and verify through ACCC.</p>${externalLink(acccUrl, "Search official recalls")}</div>`;
  }

  app.innerHTML = `<section class="screen narrow">
    ${renderBack("Back to appliance")}
    <div class="step-heading"><p class="eyebrow">Step 2 · Understand</p><h1>Recall screening for ${escapeHtml(state.appliance.category)}</h1><p>We separate product-specific clues from general safety warning signs.</p></div>
    ${outcome}
    ${recallCoverageNote()}
    <details class="model-details" ${state.appliance.brand || state.appliance.model ? "open" : ""}><summary>Know the model number? Improve this check (optional)</summary>
      <div class="form-grid"><label>Brand <input name="brand" maxlength="100" value="${escapeAttr(state.appliance.brand)}" autocomplete="off" placeholder="e.g. Mistral"></label><label>Model number <input name="model" maxlength="100" value="${escapeAttr(state.appliance.model)}" autocomplete="off" placeholder="e.g. BVC 160"><small>Spaces, hyphens and slashes are ignored. We require the complete model identifier for an exact match.</small></label></div>
      <div class="tip-card"><strong>Where can I find it?</strong><p>Look for a rating/product label on the base, back, underside, inside a battery compartment or near the power cord. Do not open the appliance to find it.</p></div>
      <button class="button secondary" id="recheck-model" type="button">Re-check recall index</button>
    </details>
    <div class="action-card"><div><p class="eyebrow">Next: safety screening</p><h2>Check only warning signs that are relevant to this appliance.</h2><p>The questions are tailored by category. Not every “Yes” answer means the same level of risk.</p></div><button class="button primary" id="continue-safety" type="button">Continue to safety screening ${icon("arrow")}</button></div>
  </section>`;
  bindBack();
  app.querySelector("#recheck-model")?.addEventListener("click", () => {
    state.appliance.brand = app.querySelector('[name="brand"]')?.value.trim() || "";
    state.appliance.model = app.querySelector('[name="model"]')?.value.trim() || "";
    state.recall = matchRecall(state.appliance, recalls(), availability("recalls"));
    renderRecall();
  });
  app.querySelector("#continue-safety")?.addEventListener("click", () => navigate("safety"));
}

function relevantSigns() { return applicableSafetySigns(state.appliance.category, safetySigns()); }

function renderSafety() {
  setPhase("safety");
  const signs = relevantSigns();
  const answered = signs.filter(([id]) => state.safety[id]).length;
  const rows = signs.map(([id, label], index) => {
    const rule = SAFETY_RULES[id];
    return `<fieldset class="question"><legend><span class="question-number">${index + 1}</span><span>${escapeHtml(label)}<small>${escapeHtml(rule?.explanation || "")}</small></span></legend><div class="segmented">${["yes","no","unsure"].map((value) => `<label><input type="radio" name="${escapeAttr(id)}" value="${value}" ${state.safety[id] === value ? "checked" : ""}><span>${value === "yes" ? "Yes" : value === "no" ? "No" : "Not sure"}</span></label>`).join("")}</div></fieldset>`;
  }).join("");
  app.innerHTML = `<section class="screen wide">
    ${renderBack("Back to recall screen")}
    <div class="step-heading"><p class="eyebrow">Step 2 · Understand</p><h1>What have you safely noticed?</h1><p>Do not touch, plug in or open the appliance just to answer. “Not sure” is always acceptable.</p></div>
    ${state.recall?.status === "unavailable" ? `<div class="notice warning sticky-note"><strong>Recall check unavailable</strong>This safety screen still works. You must separately verify the appliance through ACCC Product Safety.</div>` : ""}
    <div class="safety-meter"><div><strong>${answered} of ${signs.length} answered</strong><span>Tailored to ${escapeHtml(state.appliance.category)}</span></div><div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${signs.length}" aria-valuenow="${answered}"><span style="width:${signs.length ? (answered / signs.length) * 100 : 0}%"></span></div></div>
    <div class="question-list">${rows}</div>
    <div class="form-error" id="safety-error" role="alert"></div>
    <div class="sticky-action"><div><strong>Why these questions?</strong><span>Critical signs and caution signs follow different rules.</span></div><button class="button primary" id="view-guidance" type="button">View my guidance ${icon("arrow")}</button></div>
  </section>`;
  bindBack();
  app.querySelectorAll('input[type="radio"]').forEach((input) => input.addEventListener("change", () => {
    state.safety[input.name] = input.value;
    renderSafety();
  }));
  app.querySelector("#view-guidance")?.addEventListener("click", () => {
    const missing = signs.filter(([id]) => !state.safety[id]);
    if (missing.length) {
      const error = app.querySelector("#safety-error");
      error.textContent = `Answer the remaining ${missing.length} question${missing.length === 1 ? "" : "s"}, or choose “Not sure”.`;
      app.querySelector(`[name="${missing[0][0]}"]`)?.focus();
      return;
    }
    state.safetyResult = evaluateSafety(state.safety);
    state.decision = journeyDecision(state.recall?.status || "unavailable", state.safetyResult.status);
    navigate("guidance");
  });
}

function signLabel(id) { return safetySigns().find(([signId]) => signId === id)?.[1] || id; }

function renderGuidance() {
  setPhase("safety");
  if (!state.safetyResult) { navigate("safety", { replace: true }); return; }
  const r = state.safetyResult;
  const isHigh = r.status === "high";
  const isUncertain = r.status === "uncertain";
  const title = isHigh ? "Stop using the appliance and arrange appropriate assessment." : isUncertain ? "Pause before normal use and get the concern checked." : "No warning signs were reported in this screen.";
  const tone = isHigh ? "red" : isUncertain ? "amber" : "green";
  const reported = [...r.critical, ...r.caution, ...r.unsure];
  app.innerHTML = `<section class="screen narrow">
    ${renderBack("Back to safety questions")}
    <div class="result-state ${tone}"><span class="result-badge">${isHigh ? "Immediate safety concern" : isUncertain ? "Assessment recommended" : "Screening complete"}</span><h1>${title}</h1>
      <p>${isHigh ? "At least one critical warning sign was reported. Do not use a community Repair Café as the first destination for a hazardous appliance." : isUncertain ? "A caution sign or uncertainty was reported. This is not a diagnosis; professional assessment is the safer next step." : "This screen cannot prove that the appliance is electrically safe. It only records the warning signs you reported."}</p>
      ${reported.length ? `<ul class="reported-list">${reported.map((id) => `<li><strong>${escapeHtml(signLabel(id))}</strong><span>${escapeHtml(SAFETY_RULES[id]?.explanation || "")}</span></li>`).join("")}</ul>` : ""}
    </div>
    ${state.recall?.status === "possible" ? `<div class="notice danger"><strong>Possible recall still takes priority.</strong>Follow the official ACCC notice before making a repair, replacement or disposal decision.</div>` : ""}
    ${state.recall?.status === "unavailable" ? `<div class="notice warning"><strong>Recall status remains unknown.</strong>FixForward’s recall index was unavailable, so verify separately through ACCC Product Safety.</div>` : ""}
    <div class="action-card"><div><p class="eyebrow">Step 3 · Act</p><h2>Choose the next pathway that fits this result.</h2><p>FixForward will hide options that conflict with the safety outcome.</p></div><button class="button primary" id="to-pathways" type="button">Choose next action ${icon("arrow")}</button></div>
  </section>`;
  bindBack();
  app.querySelector("#to-pathways")?.addEventListener("click", () => navigate("pathway"));
}

function repairEvidencePanel() {
  if (!availability("repairEvidence")) return `<aside class="notice warning"><strong>Repair evidence is temporarily unavailable.</strong>The pathway remains usable, but FixForward will not substitute old fixture data.</aside>`;
  const evidenceCode = EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY[state.appliance.categoryCode];
  const evidence = repairEvidence().find((item) => item.categoryCode === evidenceCode);
  if (!evidence) return `<aside class="evidence-panel"><p class="eyebrow">Repair evidence</p><h3>Insufficient category-level evidence</h3><p>FixForward does not have a defensible repair-evidence mapping for this category yet. This absence should not be read as evidence that repair is impossible.</p></aside>`;
  const pct = evidence.sampleSize ? Math.round((evidence.fixedCount / evidence.sampleSize) * 100) : 0;
  const mappingApprox = evidence.categoryCode !== state.appliance.categoryCode;
  return `<aside class="evidence-panel"><div class="panel-head"><div><p class="eyebrow">Past community repair outcomes</p><h3>${escapeHtml(state.appliance.category)} evidence snapshot</h3></div><span class="status-pill neutral">Sample: ${formatCount(evidence.sampleSize)}</span></div>
    ${mappingApprox ? `<div class="notice warning"><strong>Broad evidence mapping</strong>This appliance uses a broader dataset category. It is contextual evidence, not a product-specific prediction.</div>` : ""}
    <p class="evidence-summary"><strong>${formatCount(evidence.fixedCount)} of ${formatCount(evidence.sampleSize)}</strong> recorded community repair attempts were fixed during the recorded event — about <strong>${pct}%</strong>. Another ${formatCount(evidence.repairableCount)} were considered repairable after further work.</p>
    <div class="metric-grid"><div><span>Fixed</span><strong>${formatCount(evidence.fixedCount)}</strong></div><div><span>Further work</span><strong>${formatCount(evidence.repairableCount)}</strong></div><div><span>End of life</span><strong>${formatCount(evidence.endOfLifeCount)}</strong></div><div><span>Unclassified</span><strong>${formatCount(evidence.unclassifiedCount)}</strong></div></div>
    <details><summary>View evidence details and limitations</summary><dl class="detail-list"><dt>Geography</dt><dd>${escapeHtml(evidence.geography === "AU" ? "Australia" : evidence.geography || "Not supplied")}</dd><dt>Representativeness</dt><dd>Not established. These are self-selected community repair records.</dd><dt>Limitations</dt><dd>${escapeHtml(evidence.limitation || "No limitation statement supplied")}</dd></dl></details>
  </aside>`;
}

function renderPathway() {
  setPhase("pathway");
  const status = state.safetyResult?.status || "clear";
  const hazardous = status === "high" || status === "uncertain";
  const possibleRecall = state.recall?.status === "possible";
  app.innerHTML = `<section class="screen wide">
    ${renderBack("Back to guidance")}
    <div class="step-heading"><p class="eyebrow">Step 3 · Act</p><h1>What would you like to do next?</h1><p>The options below change with your safety and recall result. Repair and recycling remain the focus; cost comes later where appropriate.</p></div>
    ${possibleRecall ? `<div class="notice danger"><strong>Recall pathway first.</strong>Use the official recall notice before arranging repair, replacement or disposal. The remedy may be provided by the supplier/manufacturer.</div>` : ""}
    ${hazardous ? `<div class="notice warning"><strong>Community Repair Cafés are hidden for this result.</strong>A hazardous or uncertain appliance should first go to an appropriately qualified professional or official safety pathway.</div>` : ""}
    <div class="path-grid">
      ${possibleRecall ? `<article class="path-card featured"><span class="path-icon">!</span><p class="mini-label">Priority</p><h2>Follow official recall guidance</h2><p>Verify the exact appliance identifiers and follow the remedy described by ACCC/product supplier.</p><button class="button primary" data-path="recall" type="button">Open recall pathway</button></article>` : ""}
      ${hazardous ? `<article class="path-card featured"><span class="path-icon">⚡</span><p class="mini-label">Safety first</p><h2>Professional safety assessment</h2><p>FixForward does not currently maintain a verified professional appliance-repair directory. We will show safe guidance rather than an unverified Repair Café.</p><button class="button primary" data-path="professional" type="button">See assessment guidance</button></article>` : `<article class="path-card"><span class="path-icon">🛠</span><p class="mini-label">Keep it in use</p><h2>Explore community repair</h2><p>See category-level repair evidence and search FixForward’s limited Melbourne Repair Café directory.</p><button class="button primary" data-path="repair" type="button">Explore repair</button></article>`}
      <article class="path-card"><span class="path-icon">♻</span><p class="mini-label">Responsible end-of-life</p><h2>Find an e-waste pathway</h2><p>Search Melbourne-focused disposal records. Always confirm appliance acceptance before travelling.</p><button class="button secondary" data-path="dispose" type="button">Explore recycling</button></article>
      ${!hazardous && !possibleRecall ? `<article class="path-card"><span class="path-icon">$</span><p class="mini-label">Financial context</p><h2>Compare a real repair quote</h2><p>Use this only after safety screening. FixForward does not invent a repair quote or claim a complete retail-price benchmark.</p><button class="button secondary" data-path="cost" type="button">Compare costs</button></article>` : ""}
    </div>
    ${!hazardous ? repairEvidencePanel() : ""}
  </section>`;
  bindBack();
  app.querySelectorAll("[data-path]").forEach((button) => button.addEventListener("click", () => {
    state.pathway = button.dataset.path;
    if (state.pathway === "cost") navigate("cost"); else navigate("location");
  }));
}

function renderLocation() {
  setPhase("pathway");
  const path = state.pathway;
  if (path === "recall") {
    const notice = state.recall?.match?.noticeUrl;
    app.innerHTML = `<section class="screen narrow">${renderBack("Back to pathways")}<div class="step-heading"><p class="eyebrow">Official recall pathway</p><h1>Verify before taking any other action.</h1><p>Compare the model, serial and other identifiers on the appliance with the official notice. FixForward is not the authoritative recall source.</p></div><div class="action-card"><div><h2>${escapeHtml(state.recall?.match?.title || "Possible recall notice")}</h2><p>If the product matches, follow the official remedy rather than treating ordinary repair/recycling as the first step.</p></div>${externalLink(notice || "https://www.productsafety.gov.au/recalls", "Open official ACCC guidance")}</div></section>`;
    bindBack(); return;
  }
  if (path === "professional") {
    app.innerHTML = `<section class="screen narrow">${renderBack("Back to pathways")}<div class="step-heading"><p class="eyebrow">Professional assessment</p><h1>Do not route a hazardous appliance to a community Repair Café.</h1><p>Keep the appliance unplugged where safe to do so, avoid further testing, and seek an appropriately qualified appliance technician/electrician or official safety guidance.</p></div><div class="notice warning"><strong>Directory limitation</strong>FixForward does not yet maintain a verified professional appliance-repair directory, so it will not pretend that an unverified community listing is a professional safety service.</div><div class="button-row">${externalLink("https://www.energysafe.vic.gov.au/", "Energy Safe Victoria guidance")} ${externalLink("https://www.productsafety.gov.au/recalls", "ACCC recall search")}</div></section>`;
    bindBack(); return;
  }

  const isRepair = path === "repair";
  const dataAvailable = availability("locations");
  const result = dataAvailable && state.area ? getLocations(state.area, isRepair ? "repair" : "dispose", locations()) : { matches: [], total: 0 };
  app.innerHTML = `<section class="screen narrow">
    ${renderBack("Back to pathways")}
    <div class="step-heading"><p class="eyebrow">${isRepair ? "Community repair" : "Responsible recycling"} · Melbourne</p><h1>${isRepair ? "Search this suburb or postcode" : "Find a relevant e-waste record"}</h1><p>This is a Melbourne-focused imported directory, not a live nearby-distance service. Results may be unverified; confirm details before visiting.</p></div>
    ${!dataAvailable ? `<div class="notice warning"><strong>Service directory unavailable.</strong>You can retry the public data without restarting your assessment.</div><button class="button secondary" id="retry-data" type="button">Retry public data</button>` : `<form id="area-form" class="search-box" novalidate><label for="area">Suburb or postcode</label><div><input id="area" name="area" maxlength="80" value="${escapeAttr(state.area)}" placeholder="e.g. Ascot Vale or 3032" autocomplete="postal-code"><button class="button primary" type="submit">Search</button></div><small>FixForward currently matches the suburb/postcode entered; it does not calculate nearest distance.</small></form>`}
    <div id="location-results" role="status" aria-live="polite" aria-atomic="true">${state.area && dataAvailable ? renderLocationResults(result, isRepair) : ""}</div>
  </section>`;
  bindBack();
  app.querySelector("#retry-data")?.addEventListener("click", async () => { await reloadPublicData({ announce: true }); renderLocation(); });
  app.querySelector("#area-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.area = app.querySelector("#area")?.value.trim() || "";
    renderLocation();
  });
}

function renderLocationResults(result, isRepair) {
  if (!result.matches.length) return `<div class="empty-state"><h2>No matching ${isRepair ? "Repair Café" : "e-waste"} record in this limited directory.</h2><p>Try another suburb/postcode or use the source directory. FixForward will not invent a nearby provider.</p></div>`;
  return `<div class="results-head"><strong>${formatCount(result.total)} matching record${result.total === 1 ? "" : "s"}</strong><span>Showing up to ${Math.min(8, result.total)}</span></div><div class="location-list">${result.matches.map((item) => `<article class="location-card"><div class="location-top"><div><p class="mini-label">${escapeHtml(item.type || (isRepair ? "Community repair" : "E-waste"))}</p><h3>${escapeHtml(item.name)}</h3></div><span class="verification ${item.verificationStatus === "verified" ? "verified" : "unverified"}">${escapeHtml(item.verificationStatus || "unverified")}</span></div><p>${escapeHtml([item.address, item.suburb, item.postcode].filter(Boolean).join(", "))}</p>${item.phone ? `<p><strong>Phone:</strong> ${escapeHtml(item.phone)}</p>` : ""}<p class="fine-print">${escapeHtml(item.verificationNote || "This record has not been independently verified. Contact the organiser/facility before visiting and confirm appliance acceptance.")}</p><div class="link-row">${item.url ? externalLink(item.url, "Provider/site details") : ""}${item.sourceUrl ? externalLink(item.sourceUrl, "Source dataset") : ""}</div></article>`).join("")}</div>${result.total > 8 ? `<p class="fine-print">More matches exist but are hidden in this Iteration 1 view. A future release should add pagination/nearest-distance sorting.</p>` : ""}`;
}

function renderCost() {
  setPhase("cost");
  const c = state.comparison;
  app.innerHTML = `<section class="screen narrow">
    ${renderBack("Back to pathways")}
    <div class="step-heading"><p class="eyebrow">Step 4 · Compare</p><h1>Put a real repair quote in context.</h1><p>FixForward will not generate a fake quote. In this build, replacement-market benchmarks are not sufficiently robust to automate the comparison, so a user-entered replacement price remains a clearly labelled fallback.</p></div>
    <div class="notice info"><strong>Why this is still limited</strong>A useful automatic market benchmark needs a larger, diverse, current retail sample. Until that evidence is loaded and governed, FixForward avoids presenting three hand-picked listings as a representative market price.</div>
    <form id="cost-form" class="cost-form" novalidate>
      <label>Repair quote (AUD)<span>From a technician/repairer if available</span><div class="money-input"><b>$</b><input name="repair" inputmode="decimal" maxlength="12" value="${escapeAttr(state.costs.repair)}" placeholder="e.g. 180" aria-describedby="repair-error"></div><small class="field-error" id="repair-error"></small></label>
      <label>Replacement price (AUD)<span>Use a comparable product you actually found</span><div class="money-input"><b>$</b><input name="replacement" inputmode="decimal" maxlength="12" value="${escapeAttr(state.costs.replacement)}" placeholder="e.g. 320" aria-describedby="replacement-error"></div><small class="field-error" id="replacement-error"></small></label>
      <button class="button primary" type="submit">Compare values</button>
    </form>
    ${c?.valid ? `<section class="comparison-card"><div><span>Repair</span><strong>${money(c.repair)}</strong></div><div><span>Replacement</span><strong>${money(c.replacement)}</strong></div><p>${c.lower === "equal" ? "The two entered values are equal." : `${c.lower === "repair" ? "Repair" : "Replacement"} is lower by ${money(c.difference)} based only on the values you entered.`}</p><div class="notice success"><strong>Cost is not the whole decision.</strong>Safety, recall remedy, repair feasibility, product condition and waste impact still matter.</div></section>` : ""}
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
  if (!publicData) { renderLoading(); return; }
  const screen = state.screen;
  if (screen === "landing") return renderLanding();
  if (screen === "identify") return renderIdentify();
  if (screen === "recall") return renderRecall();
  if (screen === "safety") return renderSafety();
  if (screen === "guidance") return renderGuidance();
  if (screen === "pathway") return renderPathway();
  if (screen === "location") return renderLocation();
  if (screen === "cost") return renderCost();
  return renderLanding();
}

function groupName(source) {
  const text = `${source.name || ""} ${source.use || ""}`.toLowerCase();
  if (text.includes("recall") || text.includes("accc")) return "Recall data";
  if (text.includes("energy safe") || text.includes("safety")) return "Safety guidance";
  if (text.includes("repair") && !text.includes("cafe")) return "Repair evidence";
  if (text.includes("cafe") || text.includes("location")) return "Repair locations";
  if (text.includes("waste") || text.includes("recycl")) return "Disposal locations";
  if (text.includes("price") || text.includes("retail")) return "Replacement-price evidence";
  return "Other sources";
}

function renderSources() {
  if (!publicData) return;
  const groups = {};
  sources().forEach((source) => { (groups[groupName(source)] ||= []).push(source); });
  sourcesContent.innerHTML = `<div class="privacy-box"><h3>Privacy in this build</h3><p>FixForward does not intentionally collect or store your appliance answers, safety responses, suburb/postcode search or cost values, and it does not use analytics cookies. The hosting provider may process standard technical access logs such as IP address, timestamp and requested path.</p></div>
    <div class="source-availability"><h3>Current data availability</h3>${["recalls","repairEvidence","locations"].map((key) => `<p><span class="status-dot ${availability(key) ? "ok" : "warn"}"></span><strong>${key === "recalls" ? "Recall index" : key === "repairEvidence" ? "Repair evidence" : "Service directory"}</strong> — ${availability(key) ? "available" : "unavailable/limited"}${publicData.errors?.[key] ? ` <small>${escapeHtml(publicData.errors[key])}</small>` : ""}</p>`).join("")}</div>
    ${Object.entries(groups).map(([group, items]) => `<details class="source-group"><summary>${escapeHtml(group)} <span>${items.length}</span></summary><ul class="source-list">${items.map((source) => `<li><strong>${escapeHtml(source.name)}</strong><p>${escapeHtml(source.use || source.limitations || "Public data source")}</p><small>${source.retrievalDate ? `Retrieved ${escapeHtml(source.retrievalDate)}` : ""}${source.version ? ` · Version ${escapeHtml(source.version)}` : ""}</small>${source.url ? externalLink(source.url, "Open source") : ""}</li>`).join("")}</ul></details>`).join("")}
    <div class="privacy-box"><h3>Important recall limitation</h3><p>FixForward’s exact-model recall index is a curated demonstration subset, not complete Australian recall coverage. Always verify through ACCC Product Safety.</p></div>`;
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
document.querySelector("#sources-button")?.addEventListener("click", () => { renderSources(); sourcesDialog.showModal(); });
document.querySelector("#close-sources")?.addEventListener("click", () => sourcesDialog.close());

window.addEventListener("popstate", (event) => {
  const screen = event.state?.fixForward ? event.state.screen : "landing";
  state.screen = screen || "landing";
  renderScreen();
  focusMain();
});

// Render immediately, before any network call, so a cold Render/Neon start never
// leaves the user staring at a blank page.
renderLoading();
if (!internalHistoryReady) {
  history.replaceState({ fixForward: true, screen: "landing" }, "", location.pathname + location.search);
  internalHistoryReady = true;
}
reloadPublicData();
