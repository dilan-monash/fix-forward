import { loadPublicData } from "./data-service.js";
import { validateAppliance, matchRecall, evaluateSafety, journeyDecision, compareCosts, getLocations } from "./logic.js";
import { CATEGORY_CODE_BY_NAME, EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY } from "./data.js";
import { icons } from "./icons.js";

const publicData = await loadPublicData();
const {
  families: FAMILIES,
  recalls: RECALLS,
  safetySigns: SAFETY_SIGNS,
  safetyGroups: SAFETY_GROUPS,
  sources: SOURCES,
  repairEvidence: REPAIR_EVIDENCE,
  locations: LOCATIONS,
  meta: META
} = publicData;

const app = document.querySelector("#app");
const progress = document.querySelector("#progress");
const restartButton = document.querySelector("#restart-button");
const sourcesDialog = document.querySelector("#sources-dialog");
const sourcesContent = document.querySelector("#sources-content");
const toast = document.querySelector("#toast");

const emptyState = () => ({
  screen: "identify",
  appliance: { family: "", category: "", categoryCode: "", brand: "", model: "" },
  recall: null,
  safety: {},
  safetyResult: null,
  decision: null,
  costs: { repair: "", replacement: "" },
  comparison: null,
  pathway: null,
  area: ""
});

let state = emptyState();
// The query switch remains useful for demonstrating the fail-closed state.
const backendRecallDataAvailable = publicData.availability?.recalls === true && publicData.mode === "backend";
let publicDataAvailable = backendRecallDataAvailable && !new URLSearchParams(location.search).has("mock-data-error");

function icon(name) { return icons[name] || ""; }
function money(value) { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value); }
function focusMain() { document.querySelector("#main")?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "smooth" }); }
function showToast(message) { toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2600); }
function formatCount(value) { return new Intl.NumberFormat("en-AU").format(Number(value) || 0); }

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function safeExternalUrl(value, allowedHosts = null) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (allowedHosts && !allowedHosts.includes(url.hostname.toLowerCase())) return null;
    return url.href;
  } catch {
    return null;
  }
}

function setPhase(phase) {
  const order = ["identify", "safety", "pathway", "cost"];
  const current = order.indexOf(phase);
  progress.querySelectorAll("li").forEach((item, index) => {
    item.classList.toggle("active", index === current);
    item.classList.toggle("done", index < current);
    if (index === current) item.setAttribute("aria-current", "step"); else item.removeAttribute("aria-current");
  });
}

function sourceLine(source = "ACCC Product Safety and Energy Safe Victoria") {
  return `<p class="source-line">Source: ${escapeHtml(source)} · Data retrieved ${escapeHtml(META.retrievalDate || "not available")} · ${escapeHtml(META.dataVersion || "version not supplied")}</p>`;
}

function recallBanner() {
  if (state.recall?.status !== "possible") return "";
  const noticeUrl = safeExternalUrl(state.recall.match.noticeUrl, ["productsafety.gov.au", "www.productsafety.gov.au"]);
  return `<aside class="recall-banner" role="alert">${icon("alert")}<div><strong>Strong possible recall match remains active</strong><p>${escapeHtml(state.recall.match.title)}. Verify every identifier on ${noticeUrl ? `<a href="${escapeAttribute(noticeUrl)}" target="_blank" rel="noopener noreferrer">the official ACCC notice</a>` : "the official ACCC recall search"}.</p></div></aside>`;
}

function renderIdentify(errors = {}) {
  state.screen = "identify";
  setPhase("identify");
  const selectedFamily = FAMILIES.find((family) => family.id === state.appliance.family);
  app.innerHTML = `<section class="screen">
    <div class="hero">
      <div>
        <p class="eyebrow">Broken appliance? Start here.</p>
        <h1>Safety first. Then a clearer next step.</h1>
        <p class="lede">Check for a possible official recall and immediate warning signs before privately comparing repair and replacement costs.</p>
      </div>
      <aside class="hero-panel">
        <strong>${icon("shield")} What FixForward does</strong>
        <ul><li>Takes about 5–10 minutes</li><li>No login, account or user profile</li><li>No upload, tracking or saved journey history</li><li>Does not diagnose faults or provide DIY instructions</li></ul>
      </aside>
    </div>
    <form id="appliance-form" novalidate>
      <div class="section-head"><div><p class="eyebrow">Step 1 of 4</p><h2>What type of appliance is it?</h2></div><p>Select one of the six supported families, then choose its category.</p></div>
      <div class="family-grid" role="radiogroup" aria-describedby="family-error">
        ${FAMILIES.map((family) => `<label class="choice-card"><input type="radio" name="family" value="${escapeAttribute(family.id)}" ${family.id === state.appliance.family ? "checked" : ""}><strong>${escapeHtml(family.name)}</strong><small>${escapeHtml(family.hint)}</small></label>`).join("")}
      </div>
      <p class="error" id="family-error">${escapeHtml(errors.family || "")}</p>
      <div class="form-panel">
        <label class="field"><span>Category <abbr title="required">*</abbr></span><select id="category" name="category" ${selectedFamily ? "" : "disabled"} aria-invalid="${Boolean(errors.category)}"><option value="">${selectedFamily ? "Choose a category" : "Choose a family first"}</option>${selectedFamily?.categories.map((category) => `<option ${category === state.appliance.category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("") || ""}</select><span class="error">${escapeHtml(errors.category || "")}</span></label>
        <div class="form-grid" style="margin-top:1rem">
          <label class="field"><span>Brand <small>(optional)</small></span><input name="brand" maxlength="100" autocomplete="off" placeholder="e.g. Mistral" value="${escapeAttribute(state.appliance.brand)}" aria-invalid="${Boolean(errors.brand)}"><span class="error">${escapeHtml(errors.brand || "")}</span></label>
          <label class="field"><span>Model number <small>(optional)</small></span><input name="model" maxlength="100" autocomplete="off" placeholder="e.g. BVC 160" value="${escapeAttribute(state.appliance.model)}" aria-invalid="${Boolean(errors.model)}"><span class="error">${escapeHtml(errors.model || "")}</span></label>
        </div>
        <div class="notice warning" style="margin-top:1rem"><strong>Why these details matter</strong>Family and category cannot identify a recalled product. An exact model can produce a strong possible match in FixForward's limited, manually reviewed index. Always verify the official notice.</div>
      </div>
      <div class="actions"><button class="button primary" type="submit">Check recall status ${icon("arrow")}</button><span class="source-line">Your entries stay in this browser tab and are not stored.</span></div>
    </form>
  </section>`;

  app.querySelectorAll('input[name="family"]').forEach((input) => input.addEventListener("change", () => {
    captureApplianceForm(); state.appliance.family = input.value; state.appliance.category = ""; state.appliance.categoryCode = ""; renderIdentify();
  }));
  app.querySelector("#appliance-form").addEventListener("submit", (event) => {
    event.preventDefault(); captureApplianceForm();
    const nextErrors = validateAppliance(state.appliance, FAMILIES);
    if (Object.keys(nextErrors).length) { renderIdentify(nextErrors); app.querySelector(".error:not(:empty)")?.scrollIntoView({ block: "center" }); return; }
    state.recall = matchRecall(state.appliance, RECALLS, publicDataAvailable);
    renderRecall(); focusMain();
  });
}

function captureApplianceForm() {
  const form = app.querySelector("#appliance-form");
  if (!form) return;
  const data = new FormData(form);
  const category = String(data.get("category") || "");
  state.appliance = {
    family: String(data.get("family") || state.appliance.family || ""),
    category,
    categoryCode: CATEGORY_CODE_BY_NAME[category] || "",
    brand: String(data.get("brand") || "").trim(),
    model: String(data.get("model") || "").trim()
  };
}

function renderRecall() {
  state.screen = "recall";
  setPhase("safety");
  const result = state.recall;
  let panel;
  if (result.status === "possible") {
    const noticeUrl = safeExternalUrl(result.match.noticeUrl, ["productsafety.gov.au", "www.productsafety.gov.au"]);
    const additionalMatches = result.matches.length > 1 ? `<p>${result.matches.length} notices share this identifier. Check every official notice; FixForward cannot select one for you.</p>` : "";
    panel = `<div class="notice warning" role="alert"><strong>Strong possible match — not a confirmed recall verdict</strong><p>${escapeHtml(result.match.title)}</p><p>Official publication date: ${escapeHtml(result.match.published || "not supplied")}</p><p>The entered model exactly matches a manually reviewed identifier in FixForward's limited index. Confirm the product description, affected dates, serial range and remedy on the official notice.</p>${additionalMatches}${noticeUrl ? `<a class="button secondary" href="${escapeAttribute(noticeUrl)}" target="_blank" rel="noopener noreferrer">Open official ACCC notice ${icon("arrow")}</a>` : ""}</div>`;
  } else if (result.status === "unavailable") {
    panel = `<div class="notice danger" role="alert"><strong>Recall data is temporarily unavailable</strong><p>FixForward cannot complete the indexed check. Use the official ACCC recall search before continuing.</p><a class="button secondary" href="https://www.productsafety.gov.au/recalls" target="_blank" rel="noopener">Search official recalls ${icon("arrow")}</a></div>`;
  } else if (result.status === "insufficient") {
    const candidateLinks = result.matches?.length
      ? `<p><strong>${result.matches.length} brand-level notice${result.matches.length === 1 ? "" : "s"} found.</strong> These are possible notices only; enter the exact model and check each official notice.</p><ul>${result.matches.slice(0, 5).map((candidate) => {
          const url = safeExternalUrl(candidate.noticeUrl, ["productsafety.gov.au", "www.productsafety.gov.au"]);
          return `<li>${url ? `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(candidate.title)}</a>` : escapeHtml(candidate.title)}</li>`;
        }).join("")}</ul>`
      : "";
    panel = `<div class="notice warning" role="status"><strong>More product information is needed</strong><p>${result.reason === "category-only" ? "A category such as Rice cooker describes many different products. It cannot show whether this appliance is recalled." : "Brand alone cannot identify an affected product. Add the exact model number from the appliance label."}</p>${candidateLinks}<a class="button secondary" href="https://www.productsafety.gov.au/recalls" target="_blank" rel="noopener noreferrer">Search official recalls ${icon("arrow")}</a></div>`;
  } else {
    panel = `<div class="notice success"><strong>No exact model match was found in FixForward's limited index</strong><p>This means “no match in the data checked,” not “this product is not recalled.” Search the official ACCC site and compare all identifying details.</p><a class="button secondary" href="https://www.productsafety.gov.au/recalls" target="_blank" rel="noopener noreferrer">Search official recalls ${icon("arrow")}</a></div>`;
  }
  app.innerHTML = `<section class="screen"><p class="eyebrow">Step 2 of 4 · Recall check</p><h1>Recall screening result</h1><p class="lede">FixForward narrows a limited index. Only the official recall notice can confirm whether your exact product is affected.</p><div style="margin-top:1.5rem">${panel}</div>${sourceLine("ACCC Product Safety recall index")}
    <div class="actions">${result.status === "unavailable" ? `<button class="button primary" id="restart-inline">Restart assessment</button>` : `<button class="button primary" id="continue-safety">Continue to safety questions ${icon("arrow")}</button>`}<button class="button secondary" id="edit-appliance">Edit appliance details</button></div></section>`;
  app.querySelector("#continue-safety")?.addEventListener("click", () => { renderSafety(); focusMain(); });
  app.querySelector("#edit-appliance").addEventListener("click", () => { renderIdentify(); focusMain(); });
  app.querySelector("#restart-inline")?.addEventListener("click", restart);
}

function renderSafety(errorMessage = "") {
  state.screen = "safety";
  setPhase("safety");
  const signNumber = new Map(SAFETY_SIGNS.map(([id], index) => [id, index + 1]));
  const signLabel = new Map(SAFETY_SIGNS);
  const answered = SAFETY_SIGNS.filter(([id]) => state.safety[id]).length;
  const percent = Math.round((answered / SAFETY_SIGNS.length) * 100);

  app.innerHTML = `<section class="screen">${recallBanner()}<p class="eyebrow">Step 2 of 4 · Safety check</p><h1>A quick check of 10 warning signs.</h1><p class="lede">Three short groups, usually under a minute. Answer only from what you can safely observe — do not open, dismantle or test the appliance.</p>
    <div class="notice danger" style="margin-top:1.2rem"><strong>Immediate danger?</strong>If there is smoke, fire or an active electrical hazard, move away, call 000 if needed, and do not touch the appliance. Unplug only if it is safe to do so.</div>
    <div class="safety-progress" aria-live="polite"><div><strong id="answered-count">${answered} of ${SAFETY_SIGNS.length} answered</strong><span id="time-remaining">${answered === SAFETY_SIGNS.length ? "Ready to view result" : "About 30–60 seconds"}</span></div><div class="progress-track" role="progressbar" aria-label="Safety questions answered" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${answered}"><span style="width:${percent}%"></span></div></div>
    <div id="safety-live" aria-live="assertive"></div>
    <form id="safety-form" novalidate><div class="safety-groups">${SAFETY_GROUPS.map((group) => {
      const groupAnswered = group.signIds.filter((id) => state.safety[id]).length;
      return `<section class="safety-group" data-safety-group="${group.id}"><div class="safety-group-head"><div><p class="mini-label">Group ${SAFETY_GROUPS.indexOf(group) + 1} of ${SAFETY_GROUPS.length}</p><h2>${group.title}</h2><p>${group.description}</p></div><div class="group-actions"><span data-group-count="${group.id}">${groupAnswered} of ${group.signIds.length} answered</span><button class="button compact" type="button" data-none-group="${group.id}">None of these signs</button></div></div><div class="question-list">${group.signIds.map((id) => `<fieldset class="question"><legend>${signNumber.get(id)}. ${signLabel.get(id)}</legend><div class="segmented">${[["yes","Yes"],["no","No"],["unsure","Not sure"]].map(([value,text]) => `<label><input type="radio" name="${id}" value="${value}" ${state.safety[id] === value ? "checked" : ""}><span>${text}</span></label>`).join("")}</div></fieldset>`).join("")}</div></section>`;
    }).join("")}</div><p class="error" id="safety-error">${errorMessage}</p><div class="actions"><button class="button primary" type="submit">View safety result ${icon("arrow")}</button></div></form>${sourceLine("Energy Safe Victoria and CFA Victoria guidance")}</section>`;

  app.querySelectorAll('#safety-form input[type="radio"]').forEach((input) => input.addEventListener("change", () => {
    state.safety[input.name] = input.value;
    updateSafetyProgress();
    showSafetyFeedback(input.name, input.value);
  }));

  app.querySelectorAll("[data-none-group]").forEach((button) => button.addEventListener("click", () => {
    const group = SAFETY_GROUPS.find(({ id }) => id === button.dataset.noneGroup);
    if (group.signIds.some((id) => state.safety[id] === "yes" || state.safety[id] === "unsure")) {
      document.querySelector("#safety-live").innerHTML = `<div class="notice warning"><strong>Individual warning response retained</strong>This group already contains Yes or Not sure. Change those answers individually before marking the whole group No.</div>`;
      return;
    }
    group.signIds.forEach((id) => {
      state.safety[id] = "no";
      const noInput = app.querySelector(`input[name="${id}"][value="no"]`);
      if (noInput) noInput.checked = true;
    });
    updateSafetyProgress();
    document.querySelector("#safety-live").innerHTML = `<div class="notice success"><strong>${group.title} completed</strong>All signs in this group were marked No. You can still change any individual answer.</div>`;
  }));

  app.querySelector("#safety-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const missing = SAFETY_SIGNS.filter(([id]) => !state.safety[id]);
    if (missing.length) { renderSafety(`Answer every question or use “None of these signs” for each group. ${missing.length} response${missing.length === 1 ? " is" : "s are"} still missing.`); app.querySelector("#safety-error").scrollIntoView({ block: "center" }); return; }
    completeSafetyAssessment();
  });
}

function updateSafetyProgress() {
  const answered = SAFETY_SIGNS.filter(([id]) => state.safety[id]).length;
  const count = app.querySelector("#answered-count");
  const time = app.querySelector("#time-remaining");
  const bar = app.querySelector(".progress-track");
  if (count) count.textContent = `${answered} of ${SAFETY_SIGNS.length} answered`;
  if (time) time.textContent = answered === SAFETY_SIGNS.length ? "Ready to view result" : "About 30–60 seconds";
  if (bar) { bar.setAttribute("aria-valuenow", String(answered)); bar.querySelector("span").style.width = `${Math.round((answered / SAFETY_SIGNS.length) * 100)}%`; }
  SAFETY_GROUPS.forEach((group) => {
    const groupCount = group.signIds.filter((id) => state.safety[id]).length;
    const label = app.querySelector(`[data-group-count="${group.id}"]`);
    if (label) label.textContent = `${groupCount} of ${group.signIds.length} answered${groupCount === group.signIds.length ? " ✓" : ""}`;
  });
}

function showSafetyFeedback(signId, value) {
  const root = app.querySelector("#safety-live");
  if (!root) return;
  if (value === "no") { root.innerHTML = ""; return; }
  const label = SAFETY_SIGNS.find(([id]) => id === signId)?.[1];
  const high = value === "yes";
  root.innerHTML = `<div class="notice ${high ? "danger" : "warning"}"><strong>${high ? "Potential high-risk warning reported" : "It is okay not to know"}</strong>${high ? `${label} may require immediate action. Stop using the appliance and unplug only if safe.` : "FixForward will treat this as uncertain and recommend professional assessment."}<div class="actions"><button class="button ${high ? "danger" : "secondary"}" type="button" id="early-guidance">View guidance now</button><a href="#safety-form">Continue reviewing signs</a></div></div>`;
  app.querySelector("#early-guidance").addEventListener("click", completeSafetyAssessment);
}

function completeSafetyAssessment() {
  state.safetyResult = evaluateSafety(state.safety);
  state.decision = journeyDecision(state.recall.status, state.safetyResult.status);
  renderSafetyResult();
  focusMain();
}

function reportedList(ids) {
  if (!ids?.length) return "";
  return `<ul class="reported">${ids.map((id) => `<li>${SAFETY_SIGNS.find(([signId]) => signId === id)?.[1]}</li>`).join("")}</ul>`;
}

function renderSafetyResult() {
  state.screen = "safety-result";
  setPhase(state.decision.allowNextSteps ? "pathway" : "safety");
  const high = state.safetyResult.status === "high";
  const uncertain = state.safetyResult.status === "uncertain";
  const possibleRecall = state.recall.status === "possible";
  let title = "No listed warning signs were reported";
  let lead = state.recall.status === "none"
    ? "No exact model match was found in FixForward's limited recall index. Neither result guarantees that the appliance is safe or recall-free."
    : "The recall screen remains inconclusive because there was not enough product information. This result does not confirm that the appliance is safe.";
  let iconClass = "";
  if (high) { title = possibleRecall ? "Stop using the appliance: recall and high-risk warning" : "Stop using the appliance"; lead = "A reported warning sign needs professional assessment. Unplug only when it is safe to do so."; iconClass = "danger"; }
  if (uncertain) { title = possibleRecall ? "Possible recall and uncertain safety status" : "Safety status is uncertain"; lead = "Because you selected “Not sure”, stop using the appliance until it has been professionally assessed."; iconClass = "warning"; }
  if (possibleRecall && !high && !uncertain) { title = "Possible recall match still requires action"; lead = "No listed warning signs were reported, but screening cannot rule out faults. Follow the official recall notice before any other pathway."; iconClass = "warning"; }
  const recallGuidanceUrl = possibleRecall
    ? safeExternalUrl(state.recall.match.noticeUrl, ["productsafety.gov.au", "www.productsafety.gov.au"]) || "https://www.productsafety.gov.au/recalls"
    : null;
  app.innerHTML = `<section class="screen">${recallBanner()}<div class="result-card"><div class="result-icon ${iconClass}">${icon(high || uncertain || possibleRecall ? "alert" : "shield")}</div><p class="eyebrow">Safety & recall result</p><h1>${title}</h1><p class="lede">${lead}</p>${reportedList(high ? state.safetyResult.yes : state.safetyResult.unsure)}
    ${!high && !uncertain && !possibleRecall ? `<div class="notice warning" style="margin-top:1.3rem"><strong>Important limitation</strong>No listed warning sign does not mean the appliance is safe or diagnosed. ${state.recall.status === "insufficient" ? "The recall screen also needs an exact model for a meaningful database match." : "A missing match only describes the limited data checked."}</div>` : ""}
    ${sourceLine()}<div class="actions">${possibleRecall ? `<a class="button danger" href="${escapeAttribute(recallGuidanceUrl)}" target="_blank" rel="noopener noreferrer">Follow official recall guidance ${icon("arrow")}</a>` : high || uncertain ? `<button class="button danger" id="to-professional">Explore professional assessment ${icon("arrow")}</button>` : `<button class="button primary" id="to-pathways">Choose next action ${icon("arrow")}</button>`}<button class="button secondary" id="restart-result">Restart</button></div></div></section>`;
  app.querySelector("#to-pathways")?.addEventListener("click", () => { renderPathChoices(); focusMain(); });
  app.querySelector("#to-professional")?.addEventListener("click", () => { state.pathway = "professional"; renderPathway(); focusMain(); });
  app.querySelector("#restart-result").addEventListener("click", restart);
}

function renderCost(errors = {}) {
  state.screen = "cost";
  setPhase("cost");
  app.innerHTML = `<section class="screen"><p class="eyebrow">Step 4 of 4 · Repair vs replacement</p><h1>Compare your own estimates.</h1><p class="lede">This shows the upfront difference only. It does not predict repair success or tell you which option is better.</p><form id="cost-form" class="form-panel" novalidate><div class="form-grid"><label class="field"><span>Repair quote (AUD) <abbr title="required">*</abbr></span><input name="repair" inputmode="decimal" autocomplete="off" placeholder="e.g. 180.00" value="${escapeAttribute(state.costs.repair)}" aria-invalid="${Boolean(errors.repair)}"><span class="error">${errors.repair || ""}</span></label><label class="field"><span>Estimated replacement price (AUD) <abbr title="required">*</abbr></span><input name="replacement" inputmode="decimal" autocomplete="off" placeholder="e.g. 320.00" value="${escapeAttribute(state.costs.replacement)}" aria-invalid="${Boolean(errors.replacement)}"><span class="error">${errors.replacement || ""}</span></label></div><div class="notice" style="margin-top:1rem"><strong>Private comparison</strong>These values are calculated in this tab. They are not sent to the server or saved in cookies or local storage.</div><div class="actions"><button class="button primary" type="submit">Calculate difference ${icon("arrow")}</button><button class="button secondary" type="button" id="back-to-pathways">Back to pathways</button></div></form></section>`;
  app.querySelector("#back-to-pathways").addEventListener("click", () => { renderPathChoices(); focusMain(); });
  app.querySelector("#cost-form").addEventListener("submit", (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); state.costs = { repair: String(data.get("repair") || "").trim(), replacement: String(data.get("replacement") || "").trim() };
    const comparison = compareCosts(state.costs.repair, state.costs.replacement);
    if (!comparison.valid) { renderCost(comparison.errors); app.querySelector(".error:not(:empty)")?.scrollIntoView({ block: "center" }); return; }
    state.comparison = comparison; renderComparison(); focusMain();
  });
}

function renderComparison() {
  state.screen = "comparison";
  setPhase("cost");
  const c = state.comparison;
  const summary = c.lower === "equal" ? "Both options have the same upfront cost." : `${c.lower === "repair" ? "Repair" : "Replacement"} has the lower upfront cost by ${money(c.difference)}.`;
  app.innerHTML = `<section class="screen"><p class="eyebrow">Step 4 complete · Your comparison</p><h1>${summary}</h1><p class="lede">Lower upfront cost is not automatically the better choice. You decide whether to repair or replace based on this information and your own priorities.</p><div class="compare-grid"><div class="price-card ${c.lower === "repair" ? "lower" : ""}"><span>Repair quote</span><strong class="price">${money(c.repair)}</strong>${c.lower === "repair" ? "<span class=\"mini-label\">Lower upfront cost</span>" : ""}</div><div class="price-card ${c.lower === "replacement" ? "lower" : ""}"><span>Replacement estimate</span><strong class="price">${money(c.replacement)}</strong>${c.lower === "replacement" ? "<span class=\"mini-label\">Lower upfront cost</span>" : ""}</div></div><div class="formula"><strong>How this was calculated</strong><p>${money(Math.max(c.repair, c.replacement))} − ${money(Math.min(c.repair, c.replacement))} = <strong>${money(c.difference)}</strong>. This uses only the prices you entered.</p></div><p class="source-line">No cost-per-year figure is shown because approved, reliable lifespan data is not available for this Iteration 1 comparison.</p>${sourceLine("User-entered estimates; no external cost data")}<div class="actions"><button class="button secondary" id="edit-cost">Edit costs</button><button class="button primary" id="finish-comparison">Finish and clear assessment</button></div></section>`;
  app.querySelector("#finish-comparison").addEventListener("click", restart);
  app.querySelector("#edit-cost").addEventListener("click", () => { renderCost(); focusMain(); });
}

function renderPathChoices() {
  state.screen = "path-choices";
  setPhase("pathway");
  app.innerHTML = `<section class="screen"><p class="eyebrow">Step 3 of 4 · Repair and disposal pathways</p><h1>Choose the next action that fits you.</h1><p class="lede">These are pathways, not recommendations or guarantees. Disposal is never required unless you choose it.</p><div class="path-grid"><article class="path-card"><p class="mini-label">Explore repair</p><h3>Repair options and evidence</h3><p>Review category-level evidence, find current service-search options and obtain a repair quote.</p><button class="button secondary" data-path="repair">Explore repair ${icon("arrow")}</button></article><article class="path-card"><p class="mini-label">Already considering repair?</p><h3>Compare costs</h3><p>If you already have a repair quote, continue to compare it with a replacement estimate.</p><button class="button secondary" data-path="compare">Compare costs ${icon("arrow")}</button></article><article class="path-card"><p class="mini-label">Dispose responsibly</p><h3>Responsible disposal</h3><p>Find official e-waste guidance. Never place e-waste in general rubbish or household recycling.</p><button class="button secondary" data-path="dispose">Explore disposal ${icon("arrow")}</button></article></div></section>`;
  app.querySelectorAll("[data-path]").forEach((button) => button.addEventListener("click", () => {
    state.pathway = button.dataset.path;
    if (state.pathway === "compare") renderQuoteCheck(); else renderPathway();
    focusMain();
  }));
}

function renderQuoteCheck() {
  state.screen = "quote-check";
  setPhase("pathway");
  app.innerHTML = `<section class="screen"><p class="eyebrow">Step 3 of 4 · Before comparing</p><h1>Do you already have a repair quote?</h1><p class="lede">A repair quote is required for a direct repair-versus-replacement comparison.</p><div class="path-grid two"><article class="path-card"><p class="mini-label">Yes</p><h3>I have a repair quote</h3><p>Continue to enter the quote and your estimated replacement price.</p><button class="button primary" id="has-quote">Continue to cost comparison ${icon("arrow")}</button></article><article class="path-card"><p class="mini-label">No</p><h3>I need to obtain a quote</h3><p>Explore repair evidence and current service-search options first.</p><button class="button secondary" id="needs-quote">Explore repair options ${icon("arrow")}</button></article></div><div class="actions"><button class="text-button" id="quote-back">Back to pathways</button></div></section>`;
  app.querySelector("#has-quote").addEventListener("click", () => { renderCost(); focusMain(); });
  app.querySelector("#needs-quote").addEventListener("click", () => { state.pathway = "repair"; renderPathway(); focusMain(); });
  app.querySelector("#quote-back").addEventListener("click", () => { renderPathChoices(); focusMain(); });
}

function renderPathway() {
  state.screen = "pathway";
  setPhase("pathway");
  const professional = state.pathway === "professional";
  const title = professional ? "Seek professional assessment before using it again." : state.pathway === "dispose" ? "Find a responsible e-waste pathway." : "Explore a professional repair pathway.";
  const lead = professional ? "A high-risk or uncertain response needs professional assessment. A community Repair Café is not the primary option for a hazardous appliance." : state.pathway === "dispose" ? "Enter a suburb or postcode manually. Confirm that the facility accepts your appliance before visiting." : "Enter a suburb or postcode manually. Contact a provider before travelling; the source has not been independently verified by FixForward.";
  const repairEvidence = selectedRepairEvidence();
  app.innerHTML = `<section class="screen">${recallBanner()}<p class="eyebrow">${professional ? "Professional assessment" : state.pathway === "dispose" ? "Responsible disposal" : "Explore repair options"}</p><h1>${title}</h1><p class="lede">${lead}</p>${professional ? `<div class="notice danger" style="margin-top:1rem"><strong>Stop using the appliance</strong>Unplug only if safe. Do not open it or attempt an internal repair.</div>` : ""}<form id="location-form" class="form-panel"><label class="field"><span>Suburb or postcode</span><input id="area" name="area" autocomplete="postal-code" maxlength="80" placeholder="e.g. Brunswick or 3056" value="${escapeAttribute(state.area)}"><small>Filtering happens in this browser. Your search is not sent to the server.</small></label><div class="actions"><button class="button secondary" type="submit">Search locations</button></div><div id="location-results"></div></form>${!professional && state.pathway === "repair" ? renderRepairEvidence(repairEvidence) : ""}<div class="actions">${!professional && state.pathway === "repair" ? `<button class="button primary" id="quote-obtained">I have a repair quote ${icon("arrow")}</button>` : ""}<button class="button secondary" id="back-paths">${professional ? "Restart assessment" : "Back to pathways"}</button></div>${sourceLine(state.pathway === "dispose" ? "Victorian e-waste guidance" : "Open Repair Alliance and current service directories")}</section>`;
  app.querySelector("#location-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.area = String(new FormData(event.currentTarget).get("area") || "").trim();
    renderLocationResults();
  });
  app.querySelector("#back-paths").addEventListener("click", () => professional ? restart() : (renderPathChoices(), focusMain()));
  app.querySelector("#quote-obtained")?.addEventListener("click", () => { renderCost(); focusMain(); });
  renderLocationResults();
}

function selectedRepairEvidence() {
  const evidenceCode = EVIDENCE_CATEGORY_CODE_BY_UI_CATEGORY[state.appliance.categoryCode];
  if (!evidenceCode) return null;
  return REPAIR_EVIDENCE.find((item) => item.categoryCode === evidenceCode) || null;
}

function renderRepairEvidence(evidence) {
  if (!publicData.availability?.repairEvidence) {
    return `<section class="evidence-panel" aria-labelledby="repair-evidence-title"><p class="eyebrow">Category-level context</p><h2 id="repair-evidence-title">Repair evidence</h2><div class="notice warning"><strong>Repair evidence is unavailable</strong>FixForward will not substitute a demo statistic while the public-data API is unavailable.</div></section>`;
  }
  if (!evidence) {
    return `<section class="evidence-panel" aria-labelledby="repair-evidence-title"><p class="eyebrow">Category-level context</p><h2 id="repair-evidence-title">Repair evidence for ${escapeHtml(state.appliance.category)}</h2><div class="notice warning"><strong>Insufficient category-level evidence</strong>No defensible Iteration 1 repair benchmark is mapped to this appliance category. This does not mean the appliance cannot be repaired; obtain a professional quote for the individual appliance.</div></section>`;
  }
  const outcomes = [
    ["Fixed", evidence.fixedCount],
    ["Repairable after further work", evidence.repairableCount],
    ["End of life", evidence.endOfLifeCount],
    ["Unclassified", evidence.unclassifiedCount]
  ];
  const outcomeMarkup = `<div class="evidence-metrics">${outcomes.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${formatCount(value)}</dd></div>`).join("")}</div>`;
  const barrierMarkup = evidence.barriers?.length
    ? `<ol class="barrier-list">${evidence.barriers.slice(0, 5).map((barrier) => `<li><span>${escapeHtml(barrier.name)}</span><strong>${formatCount(barrier.occurrenceCount)} recorded events</strong></li>`).join("")}</ol>`
    : `<p class="empty-evidence">No category-specific repair barriers are available in the current dataset.</p>`;
  return `<section class="evidence-panel" aria-labelledby="repair-evidence-title"><p class="eyebrow">Category-level context</p><h2 id="repair-evidence-title">Repair evidence for ${escapeHtml(state.appliance.category)}</h2><p>Historical community repair evidence can provide context, but it cannot predict the outcome or price for this appliance.</p><div class="notice success"><strong>Historical category evidence available</strong>These are past event counts, not percentages, a personal score or a recommendation.</div><div class="evidence-section"><h3>Past repair outcomes</h3><p class="source-line">Raw event counts only — not percentages or a personal prediction.</p><dl>${outcomeMarkup}</dl></div><div class="evidence-section"><h3>Common repair barriers</h3>${barrierMarkup}</div><div class="evidence-section"><h3>Evidence coverage</h3><dl class="evidence-coverage"><dt>Evidence category</dt><dd>${escapeHtml(evidence.category)}</dd><dt>Sample size</dt><dd>${formatCount(evidence.sampleSize)} records</dd><dt>Geography</dt><dd>${escapeHtml(evidence.geography || "Not available")}</dd><dt>Confidence</dt><dd>${escapeHtml(evidence.confidenceLevel || "Not assessed")}</dd><dt>Source</dt><dd>Open Repair Alliance category aggregate</dd><dt>Limitations</dt><dd>${escapeHtml(evidence.limitation || "No limitation statement supplied.")}</dd></dl></div></section>`;
}

function renderLocationResults() {
  const root = app.querySelector("#location-results");
  if (!root) return;
  if (!state.area) { root.innerHTML = `<p class="source-line">Enter a suburb or postcode to search the downloaded public directory.</p>`; return; }
  const pathway = state.pathway === "dispose" ? "dispose" : "repair";
  if (!publicData.availability?.locations) {
    const href = pathway === "dispose" ? "https://www.sustainability.vic.gov.au/recycling-and-reducing-waste-at-home/recycling-at-home/e-waste" : "https://www.repaircafe.org/en/visit/";
    root.innerHTML = `<div class="notice warning" style="margin-top:1rem"><strong>Location data is unavailable</strong>No cached provider results are shown.<div class="actions"><a class="button secondary" href="${href}" target="_blank" rel="noopener noreferrer">Open wider directory ${icon("arrow")}</a></div></div>`;
    return;
  }
  const matches = getLocations(state.area, pathway, LOCATIONS);
  if (!matches.length) {
    const href = pathway === "dispose" ? "https://www.sustainability.vic.gov.au/recycling-and-reducing-waste-at-home/recycling-at-home/e-waste" : "https://www.repaircafe.org/en/visit/";
    root.innerHTML = `<div class="notice warning" style="margin-top:1rem"><strong>No matching local service in this limited dataset</strong>Use the wider official/current search. FixForward will not display an unverified provider.<div class="actions"><a class="button secondary" href="${href}" target="_blank" rel="noopener">Open wider search ${icon("arrow")}</a></div></div>`; return;
  }
  root.innerHTML = `<div class="location-list">${matches.map((location) => {
    const providerUrl = safeExternalUrl(location.url || location.sourceUrl);
    return `<article class="location-card"><p class="mini-label">${escapeHtml(location.type)} · ${escapeHtml(location.verificationStatus || "unverified")}</p><h3>${escapeHtml(location.name)}</h3><p>${escapeHtml(location.address)}</p><p>${escapeHtml(location.suburb)} ${escapeHtml(location.postcode)}</p>${location.phone ? `<p><strong>Phone:</strong> ${escapeHtml(location.phone)}</p>` : ""}<p><strong>Before you go:</strong> This directory record is unverified. Contact the provider and confirm appliance acceptance.</p>${providerUrl ? `<a href="${escapeAttribute(providerUrl)}" target="_blank" rel="noopener noreferrer">Open source listing ${icon("arrow")}</a>` : ""}</article>`;
  }).join("")}</div><div class="notice warning" style="margin-top:1rem"><strong>Directory limitation</strong>These imported records have not been independently verified by FixForward and may be incomplete or out of date.</div>`;
}

function escapeAttribute(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function restart() {
  state = emptyState(); history.replaceState(null, "", location.pathname); publicDataAvailable = backendRecallDataAvailable; renderIdentify(); focusMain(); showToast("Assessment cleared. No answers were saved.");
}

function renderSources() {
  const mode = publicData.mode === "backend" ? "Connected read-only public-data API" : publicData.mode === "fallback" ? "Public-data API unavailable; safety-only fallback" : "Static development mode";
  sourcesContent.innerHTML = `<p>FixForward does not require login and does not create or store a user profile. Appliance details, safety answers, area searches and cost values stay in page memory only. It uses no analytics, cookies, localStorage, camera, microphone or device location.</p><p><strong>Current data mode:</strong> ${escapeHtml(mode)}</p><ul class="source-list">${SOURCES.map((source) => {
    const url = safeExternalUrl(source.url);
    const detail = source.use || [source.licence, source.version, source.retrievalDate, source.limitations].filter(Boolean).join(" · ");
    return `<li>${url ? `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(source.name)}</strong></a>` : `<strong>${escapeHtml(source.name)}</strong>`}<small>${escapeHtml(detail)}</small></li>`;
  }).join("")}</ul><p class="source-line">Release ${escapeHtml(META.releaseVersion)} · Data version ${escapeHtml(META.dataVersion)} · Retrieved ${escapeHtml(META.retrievalDate)}</p>`;
}

restartButton.addEventListener("click", restart);
document.querySelector("#sources-button").addEventListener("click", () => { renderSources(); sourcesDialog.showModal(); });
document.querySelector("#close-sources").addEventListener("click", () => sourcesDialog.close());
sourcesDialog.addEventListener("click", (event) => { if (event.target === sourcesDialog) sourcesDialog.close(); });
document.querySelectorAll("[data-icon]").forEach((node) => { node.innerHTML = icon(node.dataset.icon); });

renderIdentify();
