import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";

// These fixtures exist only inside the test process. No live data, map tiles or
// device location are requested, and nothing is inserted into the database.
const pageHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
let appInstance = 0;
const settle = () => new Promise((resolve) => setImmediate(resolve));
async function waitUntil(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, "Expected the asynchronous journey update to complete");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await settle();
}

async function createJourney(t, { delayedData = false, delayedPrices = false, recalls = [], locations = [], prices = [], failedEndpoints = [], accessExpired = [], geolocation } = {}) {
  const scriptErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => scriptErrors.push(error));
  const dom = new JSDOM(pageHtml, {
    url: "https://fixforward.test/",
    pretendToBeVisual: true,
    virtualConsole
  });
  const { window } = dom;
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.matchMedia = () => ({ matches: true });
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  if (geolocation) Object.defineProperty(window.navigator, "geolocation", { value: geolocation });
  // Exercise the map-unavailable fallback without loading Leaflet or map tiles.
  const mapLoader = new window.MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.matches?.("script[data-fixforward-leaflet]")) node.dispatchEvent(new window.Event("error"));
      }
    }
  });
  mapLoader.observe(window.document.head, { childList: true });

  let release;
  const ready = delayedData ? new Promise((resolve) => { release = resolve; }) : Promise.resolve();
  let releasePrices;
  const pricesReady = delayedPrices ? new Promise((resolve) => { releasePrices = resolve; }) : Promise.resolve();
  const requests = [];
  const fakeFetch = async (url) => {
    await ready;
    const pathname = new URL(url, window.location).pathname;
    requests.push(pathname);
    if (pathname === "/api/replacement-prices") await pricesReady;
    const datasets = {
      "/api/recalls": { recalls },
      "/api/sources": { sources: [] },
      "/api/repair-evidence": { evidence: [] },
      "/api/locations": { locations },
      "/api/replacement-prices": { prices }
    };
    assert.ok(Object.hasOwn(datasets, pathname), `Unexpected network request: ${pathname}`);
    return {
      ok: !failedEndpoints.includes(pathname) && !accessExpired.includes(pathname),
      status: accessExpired.includes(pathname) ? 401 : failedEndpoints.includes(pathname) ? 503 : 200,
      json: async () => ({ ...datasets[pathname], meta: pathname === "/api/replacement-prices"
        ? { source: "reviewed-price-snapshot", currency: "AUD", releaseVersion: "test-only-fixture" }
        : { releaseVersion: "test-only-fixture" } })
    };
  };
  const suppliedGlobals = {
    window,
    document: window.document,
    location: window.location,
    history: window.history,
    navigator: window.navigator,
    fetch: fakeFetch
  };
  const originalGlobals = new Map();
  for (const [name, value] of Object.entries(suppliedGlobals)) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  t.after(async () => {
    release?.();
    releasePrices?.();
    await settle();
    mapLoader.disconnect();
    dom.window.close();
    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    assert.deepEqual(scriptErrors, [], "Journey must not cause uncaught DOM errors");
  });
  await import(`../src/app.js?dom-test=${++appInstance}`);
  await settle();

  const query = (selector) => window.document.querySelector(selector);
  const required = (selector) => {
    const element = query(selector);
    assert.ok(element, `Expected visible journey element: ${selector}`);
    return element;
  };
  const click = (selector) => required(selector).click();
  const fill = (selector, value) => {
    const input = required(selector);
    input.value = value;
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  const submit = (selector) => required(selector).dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const answer = (name, value) => {
    const input = required(`input[name="${name}"][value="${value}"]`);
    input.checked = true;
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  };
  const enterCheck = (intent, { brand = "", model = "" } = {}) => {
    click(`[data-intent="${intent}"]`);
    click('[data-family="heating-simple-cooking"]');
    click('[data-category="Kettle"]');
    fill('[name="brand"]', brand);
    fill('[name="model"]', model);
    click("#continue-check");
    required("#safety-form");
  };
  const answerCheck = (overrides = {}) => {
    const names = new Set([...window.document.querySelectorAll('#safety-form input[type="radio"]')].map((input) => input.name));
    assert.ok(names.size > 0, "The check must contain actual questions");
    for (const name of names) answer(name, overrides[name] || "no");
    submit("#safety-form");
  };
  const traverse = async (direction) => {
    let timer;
    const moved = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Browser ${direction} did not produce a history event`)), 2000);
      window.addEventListener("popstate", resolve, { once: true });
    });
    window.history[direction]();
    try { await moved; } finally { clearTimeout(timer); }
    await settle();
  };
  const restart = () => {
    click("#restart-button");
    assert.equal(required("#restart-dialog").open, true);
    click("#confirm-restart");
    required(".landing");
  };
  return { window, query, required, click, fill, submit, answer, enterCheck, answerCheck, traverse, restart, requests,
    loadData: async () => { release?.(); await settle(); },
    loadPrices: async () => { releasePrices?.(); await settle(); }
  };
}

test("DOM: home explains the choices before a separate appliance-selection screen", async (t) => {
  const journey = await createJourney(t);
  journey.required(".landing");
  assert.equal(journey.query("[data-family]"), null);
  journey.click('[data-intent="compare"]');
  assert.equal(journey.query(".landing"), null);
  journey.required("[data-family]");
  await journey.traverse("back");
  journey.required(".landing");
  assert.equal(journey.query("[data-family]"), null);
});

for (const intent of ["guide", "repair", "compare", "recycle"]) {
  test(`DOM: ${intent} users who answer Not sure can explore repair, comparison and recycling`, async (t) => {
    const journey = await createJourney(t);
    journey.enterCheck(intent);
    journey.answerCheck({ burning: "unsure" });
    journey.required(".caution-card");
    for (const action of ["repair", "compare", "dispose"]) journey.required(`.exploration-options [data-action="${action}"]`);
    journey.click('.exploration-options [data-action="compare"]');
    journey.required(".cost-screen");
    assert.equal(journey.query(".quick-check-pass"), null, "Exploring must not turn uncertainty into a passed check");
    journey.required(".service-caution-banner");
  });
}

test("DOM: a serious warning stays serious when the user cannot finish the check", async (t) => {
  const journey = await createJourney(t);
  journey.enterCheck("repair");
  journey.answer("burning", "yes");
  journey.click("#cannot-check");
  journey.required(".urgent-card");
  assert.match(journey.required(".urgent-card").textContent, /Stop using/i);
  assert.equal(journey.query('.exploration-options [data-action="repair"]'), null);
  assert.equal(journey.query(".cost-screen"), null);
});

test("DOM: entering a problem preserves the user's unsent repair and replacement prices", async (t) => {
  const journey = await createJourney(t);
  journey.enterCheck("compare");
  journey.answerCheck();
  journey.fill('[name="repair"]', "180.50");
  journey.fill('[name="replacement"]', "320");
  journey.fill("#problem", "The kettle turns off before the water boils.");
  journey.submit("#problem-form");
  assert.equal(journey.required('[name="repair"]').value, "180.50");
  assert.equal(journey.required('[name="replacement"]').value, "320");
  journey.submit("#cost-form");
  assert.match(journey.required(".comparison-result").textContent, /139\.50/);
});

test("DOM: restarting invalidates the old browser history and starts with empty details", async (t) => {
  const journey = await createJourney(t);
  journey.enterCheck("compare", { brand: "Test Brand", model: "TEST-42" });
  journey.answerCheck();
  journey.fill('[name="repair"]', "200");
  journey.restart();
  await journey.traverse("back");
  journey.required(".landing");
  assert.equal(journey.query("#safety-form"), null);
  assert.equal(journey.query(".cost-screen"), null);
  journey.click('[data-intent="compare"]');
  journey.click('[data-family="heating-simple-cooking"]');
  journey.click('[data-category="Kettle"]');
  assert.equal(journey.required('[name="brand"]').value, "");
  assert.equal(journey.required('[name="model"]').value, "");
});

test("DOM: browser Forward cannot bypass a newly reported serious warning", async (t) => {
  const journey = await createJourney(t);
  journey.enterCheck("compare");
  journey.answerCheck();
  journey.required(".cost-screen");
  await journey.traverse("back");
  journey.answer("burning", "yes");
  await journey.traverse("forward");
  journey.required(".urgent-card");
  assert.equal(journey.query(".cost-screen"), null);
});

test("DOM: a recall arriving after a fast user reaches costs interrupts ordinary planning", async (t) => {
  const journey = await createJourney(t, {
    delayedData: true,
    recalls: [{
      id: "test-only-recall", brand: "Test Brand", title: "Test kettle recall",
      categoryCodes: ["kettle"],
      identifiers: [{ type: "model", value: "TEST-42", normalizedValue: "TEST42" }],
      noticeUrl: "https://www.productsafety.gov.au/recalls/test-only"
    }]
  });
  journey.enterCheck("compare", { brand: "Test Brand", model: "TEST-42" });
  journey.answerCheck();
  journey.required(".cost-screen");
  await journey.loadData();
  journey.required(".recall-result-card");
  assert.equal(journey.query(".cost-screen"), null);
  assert.equal(journey.query('[data-action="repair"]'), null);
});

test("DOM: a late location response cannot reopen the journey after Start again", async (t) => {
  let returnPosition;
  const journey = await createJourney(t, {
    geolocation: { getCurrentPosition(success) { returnPosition = success; } }
  });
  journey.enterCheck("recycle");
  journey.answerCheck();
  journey.click("#use-location");
  assert.equal(typeof returnPosition, "function");
  journey.restart();
  returnPosition({ coords: { latitude: -37.81, longitude: 144.96, accuracy: 100 } });
  await settle();
  journey.required(".landing");
  assert.equal(journey.query(".services-screen"), null);
});

for (const [intent, destination] of [
  ["guide", ".options-screen"],
  ["repair", ".repair-hub-screen"],
  ["compare", ".cost-screen"],
  ["recycle", ".services-screen"]
]) {
  test(`DOM: a completed clear ${intent} check reaches the intended next screen`, async (t) => {
    const journey = await createJourney(t);
    journey.enterCheck(intent);
    journey.answerCheck();
    journey.required(destination);
    assert.equal(journey.query("#safety-form"), null);
    assert.equal(journey.required('[data-stage="options"]').getAttribute("aria-current"), "step");
  });
}

const mixedTestLocations = [
  { id: "test-cafe", name: "TEST ONLY Community Repair Event", providerType: "repair_cafe", pathway: "repair" },
  { id: "test-business", name: "TEST ONLY Appliance Repair Business", providerType: "repair_service", pathway: "repair" },
  { id: "test-electronics", name: "TEST ONLY Electronics Business", providerType: "electronics_repair", pathway: "repair" },
  { id: "test-recycling", name: "TEST ONLY Recycling Facility", providerType: "recycling", pathway: "dispose" }
].map((item) => ({ ...item, suburb: "Richmond", postcode: "3121", latitude: -37.82, longitude: 145.00 }));

test("DOM: uncertain repair lists businesses to contact and excludes community repair events", async (t) => {
  const journey = await createJourney(t, { locations: mixedTestLocations });
  journey.enterCheck("repair");
  journey.answerCheck({ burning: "unsure" });
  journey.click('.exploration-options [data-action="repair"]');
  journey.required(".services-screen");
  journey.fill("#area", "Richmond");
  journey.submit("#area-form");
  await settle();
  journey.required('[data-location-id="test-business"]');
  journey.required('[data-location-id="test-electronics"]');
  assert.equal(journey.query('[data-location-id="test-cafe"]'), null);
  assert.equal(journey.query('[data-location-id="test-recycling"]'), null);
  assert.equal(journey.query('#provider-filter option[value="repair_cafe"]'), null);
  assert.equal(journey.query('.wider-help a[href*="repaircafe.org"]'), null);
  assert.match(journey.required(".service-caution-banner").textContent, /advice first/i);
  assert.match(journey.required(".map-fallback").textContent, /map could not load/i);
});

test("DOM: suburb suggestions support arrows, Escape and Enter while keeping input focus", async (t) => {
  const journey = await createJourney(t);
  journey.enterCheck("recycle");
  journey.answerCheck();
  journey.fill("#area", "Rich");
  let input = journey.required("#area");
  input.focus();
  assert.equal(input.getAttribute("aria-expanded"), "true");
  input.dispatchEvent(new journey.window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  const activeId = input.getAttribute("aria-activedescendant");
  assert.equal(journey.required(`#${activeId}`).getAttribute("aria-selected"), "true");
  input.dispatchEvent(new journey.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  assert.equal(input.getAttribute("aria-expanded"), "false");
  assert.equal(journey.query("#area-suggestions"), null);
  journey.fill("#area", "Richmond");
  input.dispatchEvent(new journey.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  input = journey.required("#area");
  assert.match(input.value, /Richmond/);
  assert.match(journey.required(".selected-area").textContent, /Richmond/);
  assert.equal(journey.window.document.activeElement, input);
  assert.equal(input.getAttribute("aria-expanded"), "false");
});

test("DOM: denying device location leaves a usable postcode search with focused fallback", async (t) => {
  const journey = await createJourney(t, {
    geolocation: { getCurrentPosition(success, error) { error({ code: 1 }); } }
  });
  journey.enterCheck("recycle");
  journey.answerCheck();
  journey.click("#use-location");
  assert.match(journey.required(".geo-message").textContent, /suburb or postcode/i);
  assert.equal(journey.window.document.activeElement, journey.required("#area"));
  assert.equal(journey.required("#use-location").disabled, false);
  journey.fill("#area", "3121");
  journey.submit("#area-form");
  assert.match(journey.required(".selected-area").textContent, /3121/);
});

test("DOM: a free repair quote is valid and changing a price removes the old comparison", async (t) => {
  const journey = await createJourney(t);
  journey.enterCheck("compare");
  journey.answerCheck();
  journey.fill('[name="repair"]', "0");
  journey.fill('[name="replacement"]', "320");
  journey.submit("#cost-form");
  const result = journey.required(".comparison-result");
  assert.match(result.textContent, /320\.00/);
  assert.equal(journey.window.document.activeElement, result);
  journey.fill('[name="repair"]', "340");
  assert.equal(journey.query(".comparison-result"), null);
  journey.submit("#cost-form");
  assert.match(journey.required(".comparison-summary").textContent, /Replacement.*20\.00/s);
});

test("DOM: invalid replacement prices focus the field and keep the entered repair quote", async (t) => {
  const journey = await createJourney(t);
  journey.enterCheck("compare");
  journey.answerCheck();
  journey.fill('[name="repair"]', "180");
  journey.fill('[name="replacement"]', "0");
  journey.submit("#cost-form");
  const invalid = journey.required('[name="replacement"]');
  assert.equal(invalid.getAttribute("aria-invalid"), "true");
  assert.equal(journey.window.document.activeElement, invalid);
  assert.match(journey.required("#replacement-error").textContent, /more than/);
  assert.equal(journey.required('[name="repair"]').value, "180");
  journey.fill('[name="replacement"]', "320");
  assert.equal(invalid.getAttribute("aria-invalid"), "false");
  assert.equal(journey.required("#replacement-error").textContent, "");
});

test("DOM: editing a problem removes its obsolete generated summary", async (t) => {
  const journey = await createJourney(t);
  journey.enterCheck("compare");
  journey.answerCheck();
  journey.fill("#problem", "The kettle leaks water from its base.");
  journey.submit("#problem-form");
  journey.required("#problem-summary");
  journey.fill("#problem", "The kettle does not turn on.");
  assert.equal(journey.query("#problem-summary"), null);
});

test("DOM: an API outage keeps the static safety journey but never invents service results", async (t) => {
  const journey = await createJourney(t, {
    failedEndpoints: ["/api/recalls", "/api/sources", "/api/repair-evidence", "/api/locations"]
  });
  await waitUntil(() => journey.requests.filter((path) => path === "/api/locations").length === 2);
  journey.enterCheck("repair");
  assert.match(journey.required("#app").textContent, /recall.*unavailable|cannot.*recall|could not.*recall/i);
  journey.answerCheck();
  journey.click("#hub-find-repair");
  journey.required(".services-screen");
  journey.required("#retry-data");
  assert.match(journey.required(".notice.warning").textContent, /Service information is unavailable/i);
  assert.equal(journey.query(".service-card"), null);
  assert.equal(journey.query("#use-location"), null);
});

test("DOM: browser Forward cannot reuse guided results after the appliance changes", async (t) => {
  const journey = await createJourney(t);
  journey.enterCheck("guide");
  journey.answerCheck();
  journey.required(".options-screen");
  await journey.traverse("back");
  journey.required("#safety-form");
  await journey.traverse("back");
  journey.click('[data-category="Toaster"]');
  await journey.traverse("forward");
  journey.required("#safety-form");
  assert.equal(journey.window.document.querySelectorAll('#safety-form input:checked').length, 0);
  await journey.traverse("forward");
  journey.required("#safety-form");
  assert.equal(journey.query(".options-screen"), null);
  assert.equal(journey.query(".quick-check-pass"), null);
  assert.equal(journey.query('[data-action="repair"]'), null);
  journey.submit("#safety-form");
  assert.match(journey.required("#safety-error").textContent, /answer the remaining/i);
});

test("DOM: a manual suburb choice supersedes a pending device-location request", async (t) => {
  let returnPosition;
  const journey = await createJourney(t, {
    locations: mixedTestLocations,
    geolocation: { getCurrentPosition(success) { returnPosition = success; } }
  });
  journey.enterCheck("recycle");
  journey.answerCheck();
  journey.click("#use-location");
  assert.equal(typeof returnPosition, "function");
  assert.equal(journey.required("#use-location").disabled, true);
  journey.fill("#area", "Richmond");
  journey.submit("#area-form");
  const manualArea = journey.required("#area").value;
  assert.match(journey.required(".selected-area").textContent, /Richmond/);
  returnPosition({ coords: { latitude: -38.0, longitude: 145.4, accuracy: 100 } });
  await settle();
  assert.equal(journey.required("#area").value, manualArea);
  assert.match(journey.required(".selected-area").textContent, /Richmond/);
  assert.equal(journey.required("#use-location").disabled, false);
  journey.required('[data-location-id="test-recycling"]');
});

test("DOM: a recall outage during refresh replaces an earlier no-match status", async (t) => {
  const failedEndpoints = ["/api/locations"];
  const journey = await createJourney(t, { failedEndpoints });
  await waitUntil(() => journey.requests.filter((path) => path === "/api/locations").length === 2);
  journey.enterCheck("repair", { brand: "Test Brand", model: "TEST-42" });
  journey.answerCheck();
  journey.click("#hub-find-repair");
  assert.match(journey.required(".small-status").textContent, /did not find your exact model/i);
  failedEndpoints.push("/api/recalls");
  journey.click("#retry-data");
  await waitUntil(() => journey.query(".warning-status")?.textContent.match(/did not load|unavailable|could not/i));
  journey.required(".services-screen");
  const recallStatus = journey.required(".warning-status").textContent;
  assert.match(recallStatus, /did not load|unavailable|could not/i);
  assert.doesNotMatch(journey.required("#app").textContent, /did not find your exact model/i);
  assert.equal(journey.query(".service-card"), null);
  journey.required("#retry-data");
});

const priceFixture = (overrides = {}) => ({
  id: "test-only-kettle-price",
  categoryCode: "kettle",
  brand: "Test Brand",
  model: "TEST-42",
  productName: "TEST ONLY Kettle Price Example",
  retailer: "The Good Guys",
  priceAud: 125,
  currency: "AUD",
  sourceUrl: "https://www.thegoodguys.com.au/test-only-kettle-price",
  observedAt: new Date().toISOString().slice(0, 10),
  priceKind: "advertised",
  availability: "not-verified",
  notes: "Synthetic fixture. Never a real retailer offer.",
  ...overrides
});

test("DOM: a late price catalogue refresh preserves entered quotes and only loads on the cost path", async (t) => {
  const journey = await createJourney(t, { delayedPrices: true, prices: [priceFixture()] });
  assert.equal(journey.requests.includes("/api/replacement-prices"), false);
  journey.enterCheck("compare");
  assert.equal(journey.requests.includes("/api/replacement-prices"), false);
  journey.answerCheck();
  journey.fill('[name="repair"]', "85.50");
  journey.fill('[name="replacement"]', "140");
  journey.submit("#cost-form");
  await settle();
  assert.equal(journey.requests.filter((path) => path === "/api/replacement-prices").length, 1);
  await journey.loadPrices();
  assert.match(journey.required(".catalogue-status").textContent, /catalogue loaded/i);
  journey.required('[data-use-price="test-only-kettle-price"]');
  assert.equal(journey.required('[name="repair"]').value, "85.50");
  assert.equal(journey.required('[name="replacement"]').value, "140");
  assert.match(journey.required(".comparison-result").textContent, /54\.50/);
  assert.equal(journey.query("#selected-price-note"), null, "Loading prices must not select one for the user");
});

test("DOM: explicitly using a recorded price preserves the repair quote and names the source", async (t) => {
  const price = priceFixture();
  const journey = await createJourney(t, { prices: [price] });
  journey.enterCheck("compare", { brand: "Test Brand", model: "TEST-42" });
  journey.answerCheck();
  await settle();
  assert.equal(journey.required('[name="replacement"]').value, "", "A matched model must not auto-fill the replacement field");
  journey.fill('[name="repair"]', "80.50");
  journey.fill('[name="replacement"]', "300");
  journey.submit("#cost-form");
  journey.required(".comparison-result");
  journey.click('[data-use-price="test-only-kettle-price"]');
  assert.equal(journey.required('[name="replacement"]').value, "125");
  assert.equal(journey.required('[name="repair"]').value, "80.50");
  assert.equal(journey.query(".comparison-result"), null, "The previous comparison must not survive a changed price");
  assert.equal(journey.window.document.activeElement, journey.required('[name="replacement"]'));
  const note = journey.required("#selected-price-note").textContent;
  assert.match(note, /The Good Guys/);
  assert.match(note, /TEST ONLY Kettle Price Example/);
  assert.ok(note.includes(price.observedAt));
  assert.match(note, /not a repair or replacement recommendation/i);
  assert.equal(journey.required('.retail-price-card a').href, price.sourceUrl);
  journey.submit("#cost-form");
  assert.match(journey.required(".comparison-result").textContent, /44\.50/);
  journey.required("#selected-price-note");

  journey.fill('[name="repair"]', "90");
  journey.required("#selected-price-note");
  journey.fill('[name="replacement"]', "150");
  assert.equal(journey.query("#selected-price-note"), null, "An edited price must no longer be attributed to the retailer");
  assert.equal(journey.query(".comparison-result"), null);
  journey.submit("#cost-form");
  assert.match(journey.required(".comparison-result").textContent, /60\.00/);
  assert.equal(journey.query("#selected-price-note"), null);
});

for (const [description, details, expectedLabel] of [
  ["same complete brand and model", { brand: "Test Brand", model: "TEST-42" }, "Same brand and model"],
  ["a partial model", { brand: "Test Brand", model: "TEST-4" }, "Same brand · different model"],
  ["a different brand with the same model", { brand: "Other Brand", model: "TEST-42" }, "Same appliance type"],
  ["a model without a brand", { model: "TEST-42" }, "Same appliance type"]
]) {
  test(`DOM: retail matching labels ${description} accurately`, async (t) => {
    const journey = await createJourney(t, { prices: [priceFixture()] });
    journey.enterCheck("compare", details);
    journey.answerCheck();
    await settle();
    assert.equal(journey.required(".price-match-label").textContent, expectedLabel);
    const text = journey.required("#recorded-prices").textContent;
    if (expectedLabel === "Same brand and model") {
      assert.match(text, /found a recorded price for the brand and model/i);
    } else {
      assert.match(text, /No exact brand and model match/i);
      assert.doesNotMatch(text, /We found a recorded price for the brand and model/i);
    }
    assert.equal(journey.required('[name="replacement"]').value, "");
  });
}

test("DOM: an unavailable price API clearly labels the saved copy without claiming Neon readiness", async (t) => {
  const journey = await createJourney(t, { failedEndpoints: ["/api/replacement-prices"] });
  journey.enterCheck("compare");
  journey.answerCheck();
  journey.fill('[name="repair"]', "70");
  await settle();
  const status = journey.required(".catalogue-status").textContent;
  assert.match(status, /saved price catalogue/i);
  assert.match(status, /has not been verified/i);
  assert.doesNotMatch(status, /catalogue loaded|database connected|Neon.*connected/i);
  journey.required(".retail-price-card");
  assert.equal(journey.required('[name="repair"]').value, "70");
  assert.equal(journey.required('[name="replacement"]').value, "");
  assert.equal(journey.query("#selected-price-note"), null);
});

test("DOM: no price matches leaves a usable comparison and never substitutes another appliance type", async (t) => {
  const journey = await createJourney(t, {
    prices: [priceFixture({ id: "test-only-toaster-price", categoryCode: "toaster", productName: "TEST ONLY Unrelated Toaster" })]
  });
  journey.enterCheck("compare");
  journey.answerCheck();
  await settle();
  const catalogue = journey.required("#recorded-prices");
  assert.match(catalogue.textContent, /No recorded examples for this appliance type/i);
  assert.doesNotMatch(catalogue.textContent, /TEST ONLY Unrelated Toaster/);
  assert.equal(journey.query(".retail-price-card"), null);
  assert.equal(journey.query("[data-use-price]"), null);
  journey.fill('[name="repair"]', "40");
  journey.fill('[name="replacement"]', "65");
  journey.submit("#cost-form");
  assert.match(journey.required(".comparison-result").textContent, /25\.00/);
});

test("DOM: old or out-of-stock observations cannot be inserted as a replacement price", async (t) => {
  const oldDate = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10);
  const journey = await createJourney(t, {
    prices: [
      priceFixture({ id: "test-only-old-price", observedAt: oldDate }),
      priceFixture({ id: "test-only-out-of-stock", availability: "out-of-stock", model: "TEST-43", productName: "TEST ONLY Unavailable Kettle" })
    ]
  });
  journey.enterCheck("compare");
  journey.answerCheck();
  await settle();
  assert.equal(journey.window.document.querySelectorAll(".retail-price-card").length, 2);
  assert.match(journey.required("#recorded-prices").textContent, /older than 90 days/);
  assert.match(journey.required("#recorded-prices").textContent, /Recorded as out of stock/);
  assert.equal(journey.query("[data-use-price]"), null);
  assert.equal(journey.required('[name="replacement"]').value, "");
});

test("DOM: a late price response cannot reopen costs after a newly reported serious warning", async (t) => {
  const journey = await createJourney(t, { delayedPrices: true, prices: [priceFixture()] });
  journey.enterCheck("compare");
  journey.answerCheck();
  journey.required("#recorded-prices");
  await journey.traverse("back");
  journey.answer("burning", "yes");
  await journey.traverse("forward");
  journey.required(".urgent-card");
  await journey.loadPrices();
  journey.required(".urgent-card");
  assert.equal(journey.query(".cost-screen"), null);
  assert.equal(journey.query("#recorded-prices"), null);
  assert.equal(journey.query("[data-use-price]"), null);
});

test("DOM: browser titles follow the journey and confirmed Home clears the selected retail price", async (t) => {
  const journey = await createJourney(t, { prices: [priceFixture()] });
  assert.equal(journey.window.document.title, "Home | FixForward");
  journey.click('[data-intent="compare"]');
  assert.equal(journey.window.document.title, "Your appliance | FixForward");
  journey.click('[data-family="heating-simple-cooking"]');
  journey.click('[data-category="Kettle"]');
  journey.click("#continue-check");
  assert.equal(journey.window.document.title, "Quick safety check | FixForward");
  journey.answerCheck();
  await settle();
  assert.equal(journey.window.document.title, "Compare repair and replacement costs | FixForward");
  journey.fill('[name="repair"]', "70");
  journey.click('[data-use-price="test-only-kettle-price"]');
  journey.click("#home-button");
  assert.equal(journey.required("#restart-dialog").open, true);
  assert.equal(journey.window.document.title, "Compare repair and replacement costs | FixForward");
  journey.click("#confirm-restart");
  journey.required(".landing");
  assert.equal(journey.window.document.title, "Home | FixForward");
  journey.enterCheck("compare");
  journey.answerCheck();
  assert.equal(journey.required('[name="repair"]').value, "");
  assert.equal(journey.required('[name="replacement"]').value, "");
  assert.equal(journey.query("#selected-price-note"), null);
  journey.restart();
  assert.equal(journey.window.document.title, "Home | FixForward");
});

test("DOM: product suggestions support keyboard selection without guessing a model", async (t) => {
  const journey = await createJourney(t, { recalls: [{ id: "test-recall", categoryCodes: ["kettle"], brand: "Test Brand", identifiers: [{ type: "model", value: "FF-TEST-42" }] }] });
  journey.click('[data-intent="compare"]');
  journey.click('[data-family="heating-simple-cooking"]');
  journey.click('[data-category="Kettle"]');
  journey.fill('[name="brand"]', 'Test');
  const input = journey.required('[name="brand"]');
  const key = (element, value) => element.dispatchEvent(new journey.window.KeyboardEvent('keydown', {key:value, bubbles:true, cancelable:true}));
  key(input, 'ArrowDown');
  assert.equal(input.getAttribute('aria-activedescendant'), 'brand-option-0');
  key(input, 'Enter');
  assert.equal(input.value, 'Test Brand');
  assert.equal(journey.required('[name="model"]').value, '');
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  journey.click('[data-suggest="model"]');
  assert.match(journey.required('#model-suggestions').textContent, /FF-TEST-42/);
  journey.click('#model-option-0');
  assert.equal(journey.required('[name="model"]').value, 'FF-TEST-42');
  journey.click('#continue-check');
  assert.match(journey.required('.recall-alert').textContent, /may be affected/);
  const firstQuestion = journey.required('[data-question]');
  assert.ok(journey.required('.recall-alert').compareDocumentPosition(firstQuestion) & journey.window.Node.DOCUMENT_POSITION_FOLLOWING);
});

test("DOM: unknown manual identity remains usable and the check footer follows the questions", async (t) => {
  const journey = await createJourney(t);
  journey.enterCheck('guide', {brand:'My unlisted brand',model:'MY-123'});
  const firstQuestion = journey.required('[data-question]');
  assert.ok(firstQuestion.compareDocumentPosition(journey.required('.recall-mini')) & journey.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(firstQuestion.compareDocumentPosition(journey.required('.safety-footer')) & journey.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(journey.query('.sticky-action'), null);
  journey.answerCheck({heat:'yes'});
  assert.match(journey.required('.attention-card').textContent, /Ask a repairer/);
  assert.match(journey.required('.warning-explanation').textContent, /Unusual heat can have several causes/);
  journey.required('#caution-repair');
});

test("DOM: the kids activity supports retry, all three stories, finish, replay and returning home", async (t) => {
  const journey = await createJourney(t);
  const initialRequests = [...journey.requests];
  journey.click('#start-learning');
  journey.required('.learning-screen');
  journey.click('[data-learning-choice="secret"]');
  assert.match(journey.required('#learning-feedback').textContent, /grown-up needs to know/);
  assert.equal(journey.window.document.activeElement.id, 'learning-feedback');
  journey.click('[data-learning-action="retry"]');
  assert.equal(journey.window.document.activeElement.id, 'learning-focus');
  for (const choice of ['adult','repair','ewaste']) {
    journey.click(`[data-learning-choice="${choice}"]`);
    journey.click('[data-learning-action="next"]');
  }
  journey.required('.learning-finish');
  assert.equal(journey.window.document.activeElement.id, 'learning-focus');
  journey.click('[data-learning-action="replay"]');
  journey.required('[data-learning-choice="adult"]');
  journey.click('[data-learning-action="exit"]');
  journey.required('.landing');
  assert.deepEqual(journey.requests, initialRequests, 'Learning must not request services, photos or private answers');
  journey.enterCheck('repair');
  journey.answerCheck();
  journey.required('#hub-find-repair');
});

test("DOM: expired access has a recoverable route that keeps the current safety answers", async (t) => {
  const accessExpired = ['/api/recalls','/api/sources','/api/locations','/api/repair-evidence'];
  const journey = await createJourney(t, {accessExpired});
  journey.enterCheck('repair');
  journey.answer('burning', 'unsure');
  const accessLink = journey.required('a[href="/login"]');
  assert.equal(accessLink.target, '_blank');
  accessExpired.splice(0);
  journey.click('[data-refresh-access]');
  await settle();
  assert.equal(journey.query('a[href="/login"]'), null);
  assert.equal(journey.required('input[name="burning"][value="unsure"]').checked, true);
});
