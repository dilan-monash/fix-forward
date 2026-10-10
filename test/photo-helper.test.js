// Behaviour tests for the photo UI only. Synthetic suggestions exercise consent,
// recovery and races; they do not measure the real model's classification quality.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { mountPhotoHelper } from "../src/photo-helper.js";

const settle = () => new Promise((resolve) => setImmediate(resolve));
const suggestion = {
  accepted: true, requiresConfirmation: true,
  alternatives: [{ slug: "portable_heater", category: "Portable heater" }],
};

// Each test owns a DOM and callbacks. No production model, server or database is used.
async function setup(t, options = {}) {
  const dom = new JSDOM('<main><div id="helper"></div><button id="manual">Manual picker</button></main>');
  const container = dom.window.document.querySelector("#helper");
  const confirmed = [];
  let manual = 0;
  let recognitions = 0;
  let releases = 0;
  const suppliedRecogniser = options.recognise || (async () => suggestion);
  const dispose = mountPhotoHelper(container, {
    availability: async () => ({ enabled: true }),
    recognise: async (...args) => { recognitions += 1; return suppliedRecogniser(...args); },
    onConfirm: (value) => confirmed.push(value),
    onChooseManually: () => { manual += 1; },
    releaseSession: async () => { releases += 1; },
    // Unit tests fake only preview decoding; a browser smoke check covers the
    // actual FileReader/image path without changing the selected appliance.
    createPreview: async () => "data:image/png;base64,dGVzdA==",
    ...options,
    // Keep the counter around custom recognisers as well.
    ...(options.recognise ? { recognise: async (...args) => {
      recognitions += 1;
      return options.recognise(...args);
    } } : {}),
  });
  t.after(() => { dispose(); dom.window.close(); });
  await settle();
  const query = (selector) => container.querySelector(selector);
  const choose = (file = { type: "image/png", size: 100 }, selector = "#appliance-photo") => {
    const input = query(selector);
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new dom.window.Event("change"));
  };
  return {
    container, query, choose, dispose, confirmed, dom,
    manual: () => manual, recognitions: () => recognitions, releases: () => releases,
  };
}

test("paused policy stays out of the manual journey and never invokes recognition", async (t) => {
  const ui = await setup(t, {
    availability: async () => ({ enabled: false, reason: "recognition_paused" }),
  });
  assert.equal(ui.query("input"), null);
  assert.equal(ui.container.hidden, true);
  assert.equal(ui.container.textContent, "");
  assert.equal(ui.container.dataset.photoHelperStatus, "recognition_paused");
  assert.equal(ui.recognitions(), 0);
  assert.deepEqual(ui.confirmed, []);
});

test("enabled controls disclose first-use size and offer direct rear-camera capture", async (t) => {
  const ui = await setup(t);
  assert.match(ui.container.textContent, /First use downloads about 92 MB/);
  const camera = ui.query("#appliance-camera");
  const cameraButton = ui.query(".photo-camera-button");
  assert.equal(camera.getAttribute("capture"), "environment");
  assert.match(camera.getAttribute("accept"), /image\/jpeg/);
  assert.equal(cameraButton.getAttribute("role"), "button");
  assert.equal(cameraButton.getAttribute("tabindex"), "0");
  let cameraClicks = 0;
  camera.addEventListener("click", () => { cameraClicks += 1; });
  cameraButton.dispatchEvent(new ui.dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.equal(cameraClicks, 1);
  ui.choose(undefined, "#appliance-camera");
  await settle();
  assert.equal(ui.recognitions(), 1);
});

test("runtime progress is announced while a photo remains unconfirmed", async (t) => {
  let finish;
  const ui = await setup(t, { recognise: async (_file, { onProgress }) => {
    onProgress({ progress: 37.4 });
    return new Promise((resolve) => { finish = resolve; });
  } });
  ui.choose();
  await settle();
  assert.match(ui.query("#photo-detect-status").textContent, /37%/);
  assert.deepEqual(ui.confirmed, []);
  finish(suggestion);
  await settle();
});

test("even a strong suggestion requires one explicit confirmation and hides scores", async (t) => {
  const ui = await setup(t);
  ui.choose(); await settle();
  assert.deepEqual(ui.confirmed, []);
  assert.doesNotMatch(ui.container.textContent, /99%|Appliance identified/);
  const button = ui.query("#confirm-photo-appliance");
  assert.match(button.textContent, /select Portable heater/);
  button.click(); button.click();
  assert.equal(ui.confirmed.length, 1);
  assert.equal(ui.confirmed[0].category, "Portable heater");
});

test("rejecting a suggestion does not change the selected appliance", async (t) => {
  const ui = await setup(t);
  ui.choose(); await settle();
  ui.query("#reject-photo-appliance").click();
  assert.deepEqual(ui.confirmed, []);
  assert.equal(ui.manual(), 1);
  assert.equal(ui.query("#confirm-photo-appliance"), null);
});

test("an unknown recognition failure stays friendly and retry clears the old failure", async (t) => {
  let attempts = 0;
  const ui = await setup(t, { recognise: async () => {
    if (++attempts === 1) throw new Error("CLASSIFIER ERROR secret-path/model.bin stack/internal-op");
    return suggestion;
  } });
  ui.choose(); await settle();
  assert.doesNotMatch(ui.container.textContent, /CLASSIFIER ERROR|secret-path|stack\/internal/);
  assert.match(ui.container.textContent, /manually/i);
  ui.choose(); await settle();
  assert.ok(ui.query("#confirm-photo-appliance"));
  assert.match(ui.query("#photo-detect-status").textContent, /Check the suggestion/);
  assert.equal(ui.container.hasAttribute("aria-busy"), false);
});

test("an uncertain response cannot leave a stale confirmation available", async (t) => {
  let attempts = 0;
  const ui = await setup(t, { recognise: async () => ++attempts === 1 ? suggestion : { accepted: false } });
  ui.choose(); await settle();
  ui.choose(); await settle();
  assert.equal(ui.query("#confirm-photo-appliance"), null);
  assert.match(ui.container.textContent, /could not suggest/);
});

test("a late response cannot override choosing manually", async (t) => {
  let resolve;
  let signal;
  const ui = await setup(t, { recognise: (_file, options) => {
    signal = options.signal;
    return new Promise((done) => { resolve = done; });
  } });
  ui.choose(); await settle();
  ui.query("#photo-choose-manually").click();
  assert.equal(signal.aborted, true);
  resolve(suggestion); await settle();
  assert.equal(ui.query("#confirm-photo-appliance"), null);
  assert.deepEqual(ui.confirmed, []);
  assert.equal(ui.container.hasAttribute("aria-busy"), false);
});

test("a newer photo wins even when an older response arrives last", async (t) => {
  const pending = [];
  const signals = [];
  const ui = await setup(t, { recognise: (_file, options) => {
    signals.push(options.signal);
    return new Promise((resolve) => pending.push(resolve));
  } });
  ui.choose(); await settle();
  ui.choose(); await settle();
  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
  pending[1]({ ...suggestion, alternatives: [{ slug: "kettle", category: "Kettle" }] });
  await settle();
  pending[0](suggestion); await settle();
  assert.match(ui.query("#confirm-photo-appliance").textContent, /select Kettle/);
  ui.query("#confirm-photo-appliance").click();
  assert.equal(ui.confirmed[0].category, "Kettle");
});

test("leaving the screen makes late results inert", async (t) => {
  let resolve;
  let signal;
  const ui = await setup(t, { recognise: (_file, options) => {
    signal = options.signal;
    return new Promise((done) => { resolve = done; });
  } });
  ui.choose(); await settle();
  ui.dispose();
  assert.equal(signal.aborted, true);
  resolve(suggestion); await settle();
  assert.equal(ui.query("#confirm-photo-appliance"), null);
  assert.deepEqual(ui.confirmed, []);
});

test("disposing the photo screen requests model cleanup exactly once", async (t) => {
  const ui = await setup(t);
  ui.dispose();
  ui.dispose();
  await settle();
  assert.equal(ui.releases(), 1);
});

test("invalid files never invoke recognition or retain an earlier suggestion", async (t) => {
  const ui = await setup(t);
  ui.choose({ type: "text/plain", size: 100 }); await settle();
  assert.equal(ui.recognitions(), 0);
  assert.match(ui.container.textContent, /JPG, PNG/);
  assert.equal(ui.container.hasAttribute("aria-busy"), false);
});

test("availability and recognition errors do not expose arbitrary debug text", async (t) => {
  const ui = await setup(t, { recognise: async () => { throw new Error("SECRET_RAW_STACK"); } });
  ui.choose(); await settle();
  assert.doesNotMatch(ui.container.textContent, /SECRET_RAW_STACK/);
  assert.match(ui.container.textContent, /manually/i);
  const unavailable = await setup(t, { availability: async () => { throw new Error("INTERNAL_SECRET"); } });
  assert.equal(unavailable.query("input"), null);
  assert.equal(unavailable.container.hidden, true);
  assert.doesNotMatch(unavailable.container.textContent, /INTERNAL_SECRET/);
});

// Preview disclosure is visible before selecting a file; no model runs on entry.
test("experimental preview is labelled and leaves confirmation mandatory", async (t) => {
  const ui = await setup(t, { availability: async () => ({ enabled: true, experimental: true }) });
  assert.match(ui.container.textContent, /Experimental photo helper/);
  assert.match(ui.container.textContent, /cannot identify faults, check recalls or confirm safety/);
  assert.equal(ui.recognitions(), 0);
  ui.choose();
  await settle();
  assert.deepEqual(ui.confirmed, []);
  ui.query("#confirm-photo-appliance").click();
  assert.equal(ui.confirmed.length, 1);
  assert.match(ui.query("#photo-detect-status").textContent, /selected/);
});

test("selected photo shows its filename and thumbnail while recognition is running", async (t) => {
  let finish;
  const ui = await setup(t, { recognise: () => new Promise(resolve => { finish = resolve; }) });
  ui.choose({ type: "image/png", size: 100, name: "kitchen-fan.png" });
  await settle();
  const image = ui.query(".photo-selected-preview img");
  image.dispatchEvent(new ui.dom.window.Event("load"));
  assert.equal(image.hidden, false);
  assert.match(image.src, /^data:image\/png/);
  assert.equal(ui.query(".photo-file-name").textContent, "kitchen-fan.png");
  assert.equal(ui.query("#photo-detect-status").dataset.state, "busy");
  assert.equal(ui.container.hasAttribute("aria-busy"), false, "live feedback must not be silenced by a busy ancestor");
  finish(suggestion); await settle();
  assert.equal(ui.query("#photo-detect-status").dataset.state, "needs-confirmation");
  assert.equal(ui.query(".photo-progress").hidden, true);
  assert.deepEqual(ui.confirmed, []);
});

test("analysis replaces download percentage with a clear checking message", async (t) => {
  let progress;
  const ui = await setup(t, { recognise: (_file, options) => {
    progress = options.onProgress;
    return new Promise(() => {});
  } });
  ui.choose(); await settle();
  progress({ progress: 60 });
  assert.equal(ui.query(".photo-progress").value, 60);
  progress({ status: "analysing" });
  assert.match(ui.query(".photo-feedback-title").textContent, /Checking your photo/);
  assert.doesNotMatch(ui.query("#photo-detect-status").textContent, /60%/);
  assert.equal(ui.query(".photo-progress").hidden, true);
});

test("invalid image content has a distinct error and remains easy to replace", async (t) => {
  const ui = await setup(t, { recognise: async () => {
    throw Object.assign(new Error("internal"), { code: "invalid_image_content" });
  }, createPreview: async () => { throw new Error("decode failed"); } });
  ui.choose({ type: "image/png", size: 100, name: "broken.png" }); await settle();
  assert.equal(ui.query("#photo-detect-status").dataset.state, "error");
  assert.match(ui.query(".photo-feedback-title").textContent, /couldn’t read this photo/);
  assert.match(ui.query(".photo-feedback-message").textContent, /not a valid JPG, PNG or WebP/);
  assert.match(ui.query(".photo-preview-note").textContent, /Preview unavailable/);
  assert.equal(ui.query(".photo-selected-preview img").hasAttribute("src"), false);
  assert.equal(ui.query(".photo-progress").hidden, true);
  assert.ok(ui.query("#appliance-photo"));
});

test("replacing, clearing and disposing photos cannot restore an older preview", async (t) => {
  const pending = [];
  const ui = await setup(t, { createPreview: (_file, signal) => new Promise(resolve => pending.push({ resolve, signal })) });
  ui.choose({ type: "image/png", size: 100, name: "old.png" }); await settle();
  ui.choose({ type: "image/png", size: 100, name: "new.png" }); await settle();
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve("data:image/png;base64,bmV3"); await settle();
  pending[0].resolve("data:image/png;base64,b2xk"); await settle();
  assert.match(ui.query(".photo-selected-preview img").src, /bmV3$/);
  ui.query("#photo-choose-manually").click();
  assert.equal(ui.query("#photo-selected-preview").hidden, true);
  assert.equal(ui.query(".photo-selected-preview img"), null);
  ui.choose(); await settle();
  ui.dispose();
  assert.equal(pending[2].signal.aborted, true);
  pending[2].resolve("data:image/png;base64,bGF0ZQ=="); await settle();
  assert.equal(ui.query(".photo-selected-preview img"), null);
});

test("filenames are plain text and only one shared stylesheet is mounted", async (t) => {
  const ui = await setup(t);
  ui.choose({ type: "image/png", size: 100, name: '<img src=x onerror="alert(1)">.png' }); await settle();
  assert.equal(ui.query(".photo-file-name").children.length, 0);
  assert.match(ui.query(".photo-file-name").textContent, /<img/);
  const second = ui.dom.window.document.createElement("div");
  ui.dom.window.document.body.append(second);
  const dispose = mountPhotoHelper(second, { availability: async () => ({ enabled: true }), releaseSession: async () => {} });
  await settle();
  assert.equal(ui.dom.window.document.querySelectorAll("#photo-helper-styles").length, 1);
  dispose();
});
