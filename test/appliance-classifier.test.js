// Contract tests use synthetic browser/model doubles, not trained-model accuracy
// evidence. Real microwave/noise fixtures and held-out evaluation remain required.
import test from "node:test";
import assert from "node:assert/strict";
import {
  APPLIANCE_CLASSES, MAX_PHOTO_BYTES, MODEL_URL, MANIFEST_URL,
  validatePhotoFile, applianceForSlug, classifierAvailability,
  classifyAppliancePhoto, friendlyRecognitionError, resetLoadedModelForTests,
} from "../src/appliance-classifier.js";

const photo = { type: "image/png", size: 1024 };

// An explicitly enabled test manifest exercises future suggestion handling.
// Production remains paused; these tests do not approve the current model.
function manifest(overrides = {}) {
  return {
    recognition_enabled: true,
    input_shape: [224, 224, 3],
    class_order: APPLIANCE_CLASSES.map(({ slug }) => slug),
    metrics: { calibration: { min_confidence: 0.68, blur_threshold: 0 } },
    ...overrides,
  };
}

function scores(top = 0.8) {
  return APPLIANCE_CLASSES.map((_, index) => index === 11 ? top : (1 - top) / 18);
}

// Restore globals after every test so failures cannot contaminate another case.
function replaceGlobals(t, values) {
  const originals = Object.fromEntries(Object.keys(values).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  resetLoadedModelForTests();
  t.after(() => {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    resetLoadedModelForTests();
  });
}

// Model doubles expose loading, inference and cleanup counts; no model is fetched.
function installRuntime(t, options = {}) {
  const calls = { fetch: 0, load: 0, predict: 0, tidy: 0, inputDisposed: 0, outputDisposed: 0, imageRead: 0 };
  const input = {
    resizeBilinear() { return this; },
    toFloat() { return this; },
    expandDims() { return this; },
    dispose() {
      calls.inputDisposed += 1;
      if (options.disposeError) throw new Error("SECRET INTERNAL CLEANUP ERROR");
    },
  };
  const output = {
    async data() {
      if (options.dataError) throw new Error("SECRET INTERNAL OUTPUT ERROR");
      return options.scores ?? scores();
    },
    dispose() { calls.outputDisposed += 1; },
  };
  const model = {
    predict() {
      calls.predict += 1;
      if (options.predictionError) throw new Error("SECRET INTERNAL PREDICT ERROR");
      if (options.outputArray === 1) return [output];
      if (options.outputArray === 2) return [output, { ...output }];
      if (options.outputMap) return { first: output, second: { ...output } };
      return output;
    },
  };
  const pixels = new Uint8ClampedArray(512 * 512 * 4);
  if (options.sharp) {
    for (let i = 0; i < 512 * 512; i += 1) {
      const value = (Math.floor(i / 512) + i % 512) % 2 ? 255 : 0;
      pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = value;
    }
  }
  replaceGlobals(t, {
    fetch: async (url) => {
      calls.fetch += 1;
      assert.equal(url, MANIFEST_URL);
      if (options.fetchError) throw new Error("SECRET INTERNAL FETCH ERROR");
      return { ok: true, json: async () => options.manifest ?? manifest() };
    },
    FileReader: class {
      readAsDataURL() {
        calls.imageRead += 1;
        if (options.imageError) return this.onerror();
        this.result = "data:image/png;base64,TEST";
        this.onload();
      }
    },
    Image: class {
      set src(value) {
        assert.match(value, /^data:image/);
        this.onload();
      }
    },
    document: {
      createElement(name) {
        assert.equal(name, "canvas");
        return { getContext: () => options.noContext ? null : {
          drawImage() {},
          getImageData: () => ({ data: pixels }),
        } };
      },
    },
    tf: {
      loadGraphModel: async (url) => {
        calls.load += 1;
        assert.equal(url, MODEL_URL);
        if (calls.load <= (options.loadFailures ?? 0)) throw new Error("SECRET MODEL PATH /private/model");
        return model;
      },
      ready: async () => {},
      tidy(fn) { calls.tidy += 1; return fn(); },
      browser: { fromPixels: () => input },
    },
  });
  return calls;
}

test("file checks reject missing, empty, unsupported and oversized images", () => {
  for (const file of [null, {}, { ...photo, type: "image/svg+xml" }, { ...photo, size: 0 },
    { ...photo, size: NaN }, { ...photo, size: MAX_PHOTO_BYTES + 1 }]) {
    assert.equal(validatePhotoFile(file).ok, false);
  }
  assert.equal(validatePhotoFile({ ...photo, size: MAX_PHOTO_BYTES }).ok, true);
  assert.equal(applianceForSlug("portable_heater").category, "Portable heater");
  assert.equal(applianceForSlug("unrecognised"), null);
});

for (const flag of [false, undefined]) {
  test("absent or disabled policy pauses before TensorFlow, decoding or weights: " + flag, async (t) => {
    const calls = installRuntime(t, { manifest: manifest({ recognition_enabled: flag }) });
    Object.defineProperty(globalThis, "tf", {
      configurable: true,
      get() { throw new Error("TensorFlow must not be accessed while paused"); },
    });
    const available = await classifierAvailability();
    assert.equal(available.enabled, false);
    assert.equal(available.reason, "recognition_paused");
    const result = await classifyAppliancePhoto(photo);
    assert.equal(result.accepted, false);
    assert.equal(result.requiresConfirmation, false);
    assert.equal(result.reason, "recognition_paused");
    assert.match(result.message, /Choose your appliance manually/);
    assert.equal(calls.imageRead, 0);
    assert.equal(calls.load, 0);
    assert.equal(calls.fetch, 1);
  });
}

const invalidManifests = [
  ["missing input shape", { input_shape: undefined }],
  ["wrong input shape", { input_shape: [128, 128, 3] }],
  ["wrong class order", { class_order: APPLIANCE_CLASSES.map(({ slug }) => slug).reverse() }],
  ["missing calibration", { metrics: {} }],
  ["string threshold", { metrics: { calibration: { min_confidence: "0.68", blur_threshold: 0 } } }],
  ["confidence over one", { metrics: { calibration: { min_confidence: 1.1, blur_threshold: 0 } } }],
  ["negative blur threshold", { metrics: { calibration: { min_confidence: 0.68, blur_threshold: -1 } } }],
  ["non-finite threshold", { metrics: { calibration: { min_confidence: 0.68, blur_threshold: Infinity } } }],
  ["nonboolean activation flag", { recognition_enabled: "true" }],
];
for (const [name, overrides] of invalidManifests) {
  test("invalid manifest fails closed: " + name, async (t) => {
    const calls = installRuntime(t, { manifest: manifest(overrides) });
    const result = await classifyAppliancePhoto(photo);
    assert.equal(result.accepted, false);
    assert.equal(result.reason, "invalid_manifest");
    assert.equal(calls.imageRead, 0);
    assert.equal(calls.load, 0);
  });
}

test("manifest network failure is friendly and does not download the model", async (t) => {
  const calls = installRuntime(t, { fetchError: true });
  const result = await classifyAppliancePhoto(photo);
  assert.equal(result.reason, "manifest_unavailable");
  assert.match(result.message, /manually/);
  assert.doesNotMatch(result.message, /SECRET|FETCH ERROR/);
  assert.equal(calls.load, 0);
});

test("an unavailable manifest can recover on a later attempt", async (t) => {
  installRuntime(t);
  let count = 0;
  globalThis.fetch = async () => ({ ok: ++count > 1, json: async () => manifest() });
  assert.equal((await classifierAvailability()).reason, "manifest_unavailable");
  assert.equal((await classifierAvailability()).enabled, true);
});

test("enabled invalid files fail before decoding or loading weights", async (t) => {
  const calls = installRuntime(t);
  await assert.rejects(classifyAppliancePhoto({ ...photo, size: 0 }), { code: "invalid_photo" });
  assert.equal(calls.imageRead, 0);
  assert.equal(calls.load, 0);
});

test("a well-formed high score is only an unconfirmed suggestion", async (t) => {
  const calls = installRuntime(t, { outputArray: 1 });
  const result = await classifyAppliancePhoto(photo);
  assert.equal(result.accepted, true);
  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.reason, "needs_confirmation");
  assert.equal(result.alternatives[0].category, "Portable heater");
  assert.equal(result.confidence, 0.8);
  assert.equal(calls.tidy, 1);
  assert.equal(calls.inputDisposed, 1);
  assert.equal(calls.outputDisposed, 1);
});

test("low scores remain uncertain", async (t) => {
  installRuntime(t, { scores: scores(0.4) });
  const result = await classifyAppliancePhoto(photo);
  assert.equal(result.accepted, false);
  assert.equal(result.requiresConfirmation, false);
  assert.equal(result.reason, "uncertain");
});

const invalidOutputs = [
  ["wrong class count", [0.8, 0.2]],
  ["NaN", scores().with(0, NaN)],
  ["Infinity", scores().with(0, Infinity)],
  ["negative score", scores().with(0, -0.1)],
  ["score above one", scores().with(11, 1.01)],
  ["string score", scores().with(11, "0.8")],
  ["not normalised", Array(19).fill(0.1)],
  ["zero total", Array(19).fill(0)],
];
for (const [name, values] of invalidOutputs) {
  test("invalid prediction is rejected and tensors are disposed: " + name, async (t) => {
    const calls = installRuntime(t, { scores: values });
    await assert.rejects(classifyAppliancePhoto(photo), { code: "invalid_result" });
    assert.equal(calls.inputDisposed, 1);
    assert.equal(calls.outputDisposed, 1);
  });
}

test("unexpected multi-output model fails closed and disposes every output", async (t) => {
  const calls = installRuntime(t, { outputArray: 2 });
  await assert.rejects(classifyAppliancePhoto(photo), { code: "invalid_result" });
  assert.equal(calls.inputDisposed, 1);
  assert.equal(calls.outputDisposed, 2);
});

test("unexpected output maps are rejected and their tensors are released", async (t) => {
  const calls = installRuntime(t, { outputMap: true });
  await assert.rejects(classifyAppliancePhoto(photo), { code: "invalid_result" });
  assert.equal(calls.inputDisposed, 1);
  assert.equal(calls.outputDisposed, 2);
});

test("cleanup failure stays friendly and still releases other tensors", async (t) => {
  const calls = installRuntime(t, { disposeError: true });
  await assert.rejects(classifyAppliancePhoto(photo), (error) => {
    assert.equal(error.code, "prediction_failed");
    assert.doesNotMatch(error.message, /SECRET|INTERNAL/);
    return true;
  });
  assert.equal(calls.outputDisposed, 1);
});

for (const option of ["predictionError", "dataError"]) {
  test("runtime failure has no raw details and cleans up tensors: " + option, async (t) => {
    const calls = installRuntime(t, { [option]: true });
    await assert.rejects(classifyAppliancePhoto(photo), (error) => {
      assert.equal(error.code, "prediction_failed");
      assert.doesNotMatch(error.message, /SECRET|INTERNAL/);
      return true;
    });
    assert.equal(calls.inputDisposed, 1);
    assert.equal(calls.outputDisposed, option === "dataError" ? 1 : 0);
  });
}

test("failed model loading is sanitised and can recover", async (t) => {
  const calls = installRuntime(t, { loadFailures: 1 });
  await assert.rejects(classifyAppliancePhoto(photo), (error) => {
    assert.equal(error.code, "model_unavailable");
    assert.doesNotMatch(error.message, /SECRET|private|MODEL PATH/);
    return true;
  });
  assert.equal((await classifyAppliancePhoto(photo)).requiresConfirmation, true);
  assert.equal(calls.load, 2);
});

test("image decode failure leaves manual selection available", async (t) => {
  const calls = installRuntime(t, { imageError: true });
  await assert.rejects(classifyAppliancePhoto(photo), { code: "image_unreadable" });
  assert.equal(calls.load, 0);
});

test("missing canvas support cannot silently bypass image quality checks", async (t) => {
  const calls = installRuntime(t, { noContext: true });
  await assert.rejects(classifyAppliancePhoto(photo), { code: "image_quality_unavailable" });
  assert.equal(calls.load, 0);
});

test("blurry image is declined before model loading", async (t) => {
  const calls = installRuntime(t, { manifest: manifest({
    metrics: { calibration: { min_confidence: 0.68, blur_threshold: 57.233 } },
  }) });
  assert.equal((await classifyAppliancePhoto(photo)).reason, "blurry_or_unclear");
  assert.equal(calls.load, 0);
});

test("sharp texture is not claimed to be rejected by a blur threshold", async (t) => {
  // Deliberately documents the limit: only the paused policy protects users from
  // the unvalidated model. A sharp pattern plus a high mock score can still pass.
  installRuntime(t, { sharp: true, manifest: manifest({
    metrics: { calibration: { min_confidence: 0.68, blur_threshold: 57.233 } },
  }) });
  const result = await classifyAppliancePhoto(photo);
  assert.equal(result.reason, "needs_confirmation");
  assert.equal(result.requiresConfirmation, true);
});

test("friendly errors never reflect arbitrary internal messages", () => {
  for (const error of [new Error("SECRET path stack MODEL LOAD FAILED"), "SECRET",
    { code: "__proto__", message: "SECRET" }, { code: "unknown", message: "SECRET" }, null]) {
    assert.match(friendlyRecognitionError(error), /manually/);
    assert.doesNotMatch(friendlyRecognitionError(error), /SECRET|stack|MODEL LOAD/);
  }
  assert.match(friendlyRecognitionError({ code: "recognition_paused" }), /paused/);
});
