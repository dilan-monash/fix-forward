/* Tests for the disabled browser candidate's policy, schema and local loader. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canRunSiglipPolicy,
  classifyWithSiglipCandidate,
  releaseSiglipModelSession,
  resetSiglipCandidateForTests,
  siglipClassifierAvailability,
  suggestionFromSiglipScores,
  validateSiglipPolicy,
  validateSiglipPhotoContent,
  validateSiglipTextManifest,
} from "../src/siglip-appliance-classifier.js";

const shippedPolicy = JSON.parse(await readFile(
  new URL("../model/appliance-siglip/model_manifest.json", import.meta.url), "utf8",
));
const candidateV3 = JSON.parse(await readFile(
  new URL("../model/appliance-siglip/candidate-v3-policy.json", import.meta.url), "utf8",
));
const candidateV2 = JSON.parse(await readFile(
  new URL("../model/appliance-siglip/candidate-v2-policy.json", import.meta.url), "utf8",
));
const failedV1Policy = JSON.parse(await readFile(
  new URL("../model/appliance-siglip/evaluated-policy-v1.json", import.meta.url), "utf8",
));
const shippedTextManifest = JSON.parse(await readFile(
  new URL("../model/appliance-siglip/text-embeddings.json", import.meta.url), "utf8",
));
const textManifestBytes = await readFile(new URL("../model/appliance-siglip/text-embeddings.json", import.meta.url));
const textVectorBytes = await readFile(new URL("../model/appliance-siglip/text-embeddings.f32", import.meta.url));

const clone = (value) => JSON.parse(JSON.stringify(value));
const arrayBuffer = (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const validPngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function binaryFile(bytes, type) {
  const content = Buffer.from(bytes);
  return { type, size: content.length, arrayBuffer: async () => arrayBuffer(content) };
}

function pngFile({ type = "image/png", width, height } = {}) {
  const bytes = Buffer.from(validPngBytes);
  if (width !== undefined) bytes.writeUInt32BE(width, 16);
  if (height !== undefined) bytes.writeUInt32BE(height, 20);
  return binaryFile(bytes, type);
}

function jpegHeaderFile() {
  return binaryFile([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9,
  ], "image/jpeg");
}

function webpHeaderFile() {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(22, 4);
  bytes.write("WEBPVP8X", 8, "ascii");
  bytes.writeUInt32LE(10, 16);
  return binaryFile(bytes, "image/webp");
}

function policy(overrides = {}) {
  const value = clone(shippedPolicy);
  for (const [key, replacement] of Object.entries(overrides)) {
    value[key] = replacement && typeof replacement === "object" && !Array.isArray(replacement)
      ? { ...value[key], ...replacement }
      : replacement;
  }
  return value;
}

// The first frozen candidate remains useful regression evidence even though
// the shipped disabled manifest now records the later candidate-v2 result.
function v1Policy(overrides = {}) {
  const value = clone(failedV1Policy);
  for (const [key, replacement] of Object.entries(overrides)) {
    value[key] = replacement && typeof replacement === "object" && !Array.isArray(replacement)
      ? { ...value[key], ...replacement }
      : replacement;
  }
  return value;
}

// Candidate v2 is not the browser manifest. This helper combines its frozen
// decision fields with the already pinned local-runtime fields for unit tests.
function v2Policy(overrides = {}) {
  const value = clone(shippedPolicy);
  Object.assign(value, {
    candidate_id: candidateV2.candidate_id,
    policy_version: candidateV2.policy_version,
    release_ready: candidateV2.release_ready,
    recognition_enabled: candidateV2.recognition_enabled,
    enabled_classes: clone(candidateV2.enabled_classes),
    manual_only_classes: clone(candidateV2.manual_only_classes),
    acceptance: clone(candidateV2.acceptance),
  });
  for (const [key, replacement] of Object.entries(overrides)) {
    value[key] = replacement && typeof replacement === "object" && !Array.isArray(replacement)
      ? { ...value[key], ...replacement }
      : replacement;
  }
  return value;
}

function vectors() {
  return {
    rows: 4,
    columns: 2,
    classCount: 3,
    labels: ["fan", "kettle", "toaster", "other_object"],
  };
}

test("shipped I3 preview pins v3 thresholds and exact same-origin assets", () => {
  const value = validateSiglipPolicy(policy());
  assert.equal(value.release_ready, false);
  assert.equal(value.recognition_enabled, true);
  assert.equal(value.experimental_preview, true);
  assert.deepEqual(value.acceptance.class_thresholds, candidateV3.acceptance.class_thresholds);
  assert.deepEqual(value.enabled_classes, candidateV3.enabled_classes);
  assert.deepEqual(value.manual_only_classes, candidateV3.manual_only_classes);
  assert.equal(value.runtime.module_url, "/vendor/transformers/transformers.min.js");
  assert.equal(value.runtime.wasm_threads, 1);
  assert.deepEqual(value.runtime.assets, {
    transformers_js: {
      url: "/vendor/transformers/transformers.min.js", bytes: 888173,
      sha256: "aa5002b70e789798da263f5f99c62bd3e8fcd0c119258a493c40c180648365fa",
    },
    ort_wasm_module: {
      url: "/vendor/transformers/ort-wasm-simd-threaded.jsep.mjs", bytes: 44484,
      sha256: "08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9",
    },
    ort_wasm_binary: {
      url: "/vendor/transformers/ort-wasm-simd-threaded.jsep.wasm", bytes: 21596019,
      sha256: "c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39",
    },
  });
  assert.match(value.vision_model.file, /^onnx\/vision_model\.[a-f0-9]{64}_q4\.onnx$/);
});

test("failed v1 evidence remains readable only while both release flags stay off", () => {
  assert.doesNotThrow(() => validateSiglipPolicy(v1Policy()));
  assert.throws(() => validateSiglipPolicy(v1Policy({ release_ready: true })), /unavailable/i);
  assert.throws(() => validateSiglipPolicy(v1Policy({ recognition_enabled: true })), /unavailable/i);
});

test("v2 accepts only the exact candidate class surface and per-class threshold map", () => {
  const value = validateSiglipPolicy(v2Policy());
  assert.equal(value.enabled_classes.length, 17);
  assert.deepEqual(value.enabled_classes, candidateV2.enabled_classes);
  assert.deepEqual(value.manual_only_classes, ["dehumidifier", "steam_cleaner"]);
  assert.deepEqual(value.acceptance.class_thresholds, candidateV2.acceptance.class_thresholds);

  const changedThreshold = v2Policy();
  changedThreshold.acceptance.class_thresholds.fan.min_ood_margin += 0.0001;
  assert.throws(() => validateSiglipPolicy(changedThreshold), /unavailable/i);

  const missingThreshold = v2Policy();
  delete missingThreshold.acceptance.class_thresholds.rice_cooker;
  assert.throws(() => validateSiglipPolicy(missingThreshold), /unavailable/i);

  const extraThreshold = v2Policy();
  extraThreshold.acceptance.class_thresholds.dehumidifier = {
    min_ood_margin: 0,
    min_positive_margin: 0,
  };
  assert.throws(() => validateSiglipPolicy(extraThreshold), /unavailable/i);

  const genericFallback = v2Policy();
  genericFallback.acceptance.min_ood_margin = 0;
  genericFallback.acceptance.min_positive_margin = 0;
  assert.throws(() => validateSiglipPolicy(genericFallback), /unavailable/i);

  const changedClassSurface = v2Policy({
    enabled_classes: [...candidateV2.enabled_classes].reverse(),
  });
  assert.throws(() => validateSiglipPolicy(changedClassSurface), /unavailable/i);
  assert.throws(() => validateSiglipPolicy(v2Policy({ candidate_id: "retuned-v2" })), /unavailable/i);
});

test("policy rejects remote paths, unknown enabled classes and duplicate slugs", () => {
  assert.throws(() => validateSiglipPolicy(policy({
    runtime: { module_url: "https://cdn.example/runtime.js" },
  })), /unavailable/i);
  assert.throws(() => validateSiglipPolicy(policy({
    vision_model: { repository: "remote/model" },
  })), /unavailable/i);
  assert.throws(() => validateSiglipPolicy(policy({ enabled_classes: ["fan", "not_a_class"] })), /unavailable/i);
  assert.throws(() => validateSiglipPolicy(policy({ enabled_classes: ["fan", "fan"] })), /unavailable/i);
  const wrongRuntimeHash = policy();
  wrongRuntimeHash.runtime.assets.ort_wasm_binary.sha256 = "0".repeat(64);
  assert.throws(() => validateSiglipPolicy(wrongRuntimeHash), /unavailable/i);
  const wrongRuntimeSize = policy();
  wrongRuntimeSize.runtime.assets.transformers_js.bytes += 1;
  assert.throws(() => validateSiglipPolicy(wrongRuntimeSize), /unavailable/i);
});

test("text manifest needs the exact frozen label order, dimensions and revision", () => {
  assert.equal(validateSiglipTextManifest(clone(shippedTextManifest), policy()).class_count, 19);
  const reordered = clone(shippedTextManifest);
  [reordered.labels[0], reordered.labels[1]] = [reordered.labels[1], reordered.labels[0]];
  assert.throws(() => validateSiglipTextManifest(reordered, policy()), /labels|unavailable/i);
  assert.throws(() => validateSiglipTextManifest({ ...clone(shippedTextManifest), shape: [29, 512] }, policy()), /labels|unavailable/i);
  assert.throws(() => validateSiglipTextManifest({ ...clone(shippedTextManifest), resolved_revision: "changed" }, policy()), /labels|unavailable/i);
});

test("two-margin rule accepts only a separated and enabled appliance result", () => {
  const result = suggestionFromSiglipScores([0.20, 0.17, 0.10, 0.12], vectors(), v1Policy({
    enabled_classes: ["fan", "kettle", "toaster"],
    acceptance: { min_ood_margin: 0.05, min_positive_margin: 0.02 },
  }));
  assert.equal(result.accepted, true);
  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.alternatives[0].slug, "fan");
  assert.deepEqual(result.margins, { ood: 0.08000000000000002, positive: 0.03 });
});

test("v2 applies the winning class's own thresholds", () => {
  const fan = suggestionFromSiglipScores([0.20, 0.17, 0.10, 0.16], vectors(), v2Policy());
  assert.equal(fan.alternatives[0].slug, "fan");
  assert.equal(fan.accepted, false); // 0.03 is below fan's 0.0349 positive margin.

  const kettle = suggestionFromSiglipScores([0.17, 0.20, 0.10, 0.16], vectors(), v2Policy());
  assert.equal(kettle.alternatives[0].slug, "kettle");
  assert.equal(kettle.accepted, true); // Same margins pass kettle's 0.0323/0.0256 pair.
});

test("v2 rejects a manual-only winner without falling through or using generic margins", () => {
  const manualOnlyVectors = {
    rows: 4,
    columns: 2,
    classCount: 3,
    labels: ["dehumidifier", "fan", "kettle", "other_object"],
  };
  const result = suggestionFromSiglipScores(
    [0.40, 0.39, 0.10, 0.05], manualOnlyVectors, v2Policy(),
  );
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "class_disabled");
  assert.equal(result.alternatives[0].slug, "dehumidifier");
  assert.equal(result.alternatives[1].slug, "fan");

  const incomplete = v2Policy();
  delete incomplete.acceptance.class_thresholds.fan;
  incomplete.acceptance.min_ood_margin = 0;
  incomplete.acceptance.min_positive_margin = 0;
  assert.throws(
    () => suggestionFromSiglipScores([0.40, 0.20, 0.10, 0.05], vectors(), incomplete),
    /unavailable/i,
  );
});

test("a high-margin disabled winner is rejected without choosing the next class", () => {
  const result = suggestionFromSiglipScores([0.40, 0.18, 0.10, 0.05], vectors(), policy({
    enabled_classes: ["kettle", "toaster"],
  }));
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "class_disabled");
  assert.equal(result.alternatives[0].slug, "fan");
});

test("OOD competition rejects a result even when one appliance ranks first", () => {
  const result = suggestionFromSiglipScores([0.20, 0.10, 0.09, 0.18], vectors(), policy({
    enabled_classes: ["fan", "kettle", "toaster"],
  }));
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "uncertain");
});

test("a close second appliance rejects an ambiguous category", () => {
  const result = suggestionFromSiglipScores([0.20, 0.195, 0.09, 0.10], vectors(), policy({
    enabled_classes: ["fan", "kettle", "toaster"],
  }));
  assert.equal(result.accepted, false);
  assert.ok(result.margins.positive < 0.01);
});

test("availability re-reads the policy with no-store on every check", async () => {
  resetSiglipCandidateForTests();
  const options = [];
  let calls = 0;
  const fetcher = async (_url, requestOptions) => {
    calls += 1;
    options.push(requestOptions);
    return { ok: true, json: async () => v2Policy({ recognition_enabled: calls === 2 }) };
  };
  assert.equal((await siglipClassifierAvailability(fetcher)).enabled, false);
  assert.equal((await siglipClassifierAvailability(fetcher)).enabled, false); // release_ready is still false
  assert.equal(calls, 2);
  assert.ok(options.every((item) => item.cache === "no-store"));
});

test("disabled policy reports manual fallback and never imports a model", async () => {
  resetSiglipCandidateForTests();
  let imported = false;
  const fetcher = async () => ({ ok: true, json: async () => policy() });
  const availability = await siglipClassifierAvailability(fetcher);
  assert.deepEqual(availability, {
    enabled: false,
    reason: "recognition_paused",
    message: "Photo suggestions are still being checked. Choose your appliance manually below.",
  });
  const result = await classifyWithSiglipCandidate(
    { type: "image/jpeg", size: 100 },
    { fetcher, importer: async () => { imported = true; return {}; } },
  );
  assert.equal(result.reason, "recognition_paused");
  assert.equal(imported, false);
});

test("content validation reads JPEG, PNG and WebP header dimensions before inference", async () => {
  assert.deepEqual(await validateSiglipPhotoContent(pngFile()), {
    format: "image/png", width: 1, height: 1, pixels: 1,
  });
  assert.deepEqual(await validateSiglipPhotoContent(jpegHeaderFile()), {
    format: "image/jpeg", width: 1, height: 1, pixels: 1,
  });
  assert.deepEqual(await validateSiglipPhotoContent(webpHeaderFile()), {
    format: "image/webp", width: 1, height: 1, pixels: 1,
  });
  await assert.rejects(
    () => validateSiglipPhotoContent(binaryFile(Buffer.from("not an image"), "image/png")),
    /not a valid JPG, PNG or WebP/i,
  );
});

test("spoofed MIME and extreme dimensions fail before runtime or model assets", async () => {
  resetSiglipCandidateForTests();
  const enabled = v2Policy({ release_ready: true, recognition_enabled: true });
  const fetched = [];
  let imported = false;
  const fetcher = async (url) => {
    fetched.push(url);
    if (url.endsWith("model_manifest.json")) return { ok: true, json: async () => enabled };
    throw new Error(`Asset fetch happened too early: ${url}`);
  };
  const options = { fetcher, importer: async () => { imported = true; return {}; } };
  await assert.rejects(
    () => classifyWithSiglipCandidate(pngFile({ type: "image/jpeg" }), options),
    /not a valid JPG, PNG or WebP/i,
  );
  await assert.rejects(
    () => classifyWithSiglipCandidate(pngFile({ width: 10000, height: 4000 }), options),
    /under 30 megapixels/i,
  );
  assert.equal(imported, false);
  assert.deepEqual(fetched, [
    "/model/appliance-siglip/model_manifest.json",
    "/model/appliance-siglip/model_manifest.json",
  ]);
});

test("enabled loader uses local-only single-thread settings and content-addressed model name", async () => {
  resetSiglipCandidateForTests();
  const enabled = policy();
  const fetcher = async (url) => {
    if (url.endsWith("model_manifest.json")) return { ok: true, json: async () => enabled };
    if (url.endsWith("text-embeddings.json")) return { ok: true, arrayBuffer: async () => arrayBuffer(textManifestBytes) };
    if (url.endsWith("text-embeddings.f32")) return { ok: true, arrayBuffer: async () => arrayBuffer(textVectorBytes) };
    throw new Error(`Unexpected URL: ${url}`);
  };
  const calls = [];
  const env = { backends: { onnx: { wasm: {} } } };
  const runtime = {
    env,
    AutoProcessor: { from_pretrained: async (...args) => {
      calls.push(["processor", ...args]);
      return async () => ({});
    } },
    SiglipVisionModel: { from_pretrained: async (...args) => {
      calls.push(["model", ...args]);
      return async () => ({ pooler_output: { dims: [1, 1], data: new Float32Array([1]) } });
    } },
    RawImage: { read: async () => ({}) },
  };
  let importedUrl;
  await assert.rejects(() => classifyWithSiglipCandidate(
    pngFile(),
    { fetcher, hostname: "localhost", importer: async (url) => { importedUrl = url; return runtime; } },
  ), /checked/i);
  assert.equal(importedUrl, "/vendor/transformers/transformers.min.js");
  assert.equal(env.allowRemoteModels, false);
  assert.equal(env.allowLocalModels, true);
  assert.equal(env.localModelPath, "/model/appliance-siglip/upstream/");
  assert.deepEqual(env.backends.onnx.wasm, {
    wasmPaths: "/vendor/transformers/", numThreads: 1, proxy: false,
  });
  assert.equal(calls[0][2].local_files_only, true);
  assert.equal(calls[1][2].local_files_only, true);
  assert.equal(calls[1][2].model_file_name, enabled.vision_model.model_file_name);
});

test("a release flag revoked during inference suppresses the completed suggestion", async () => {
  resetSiglipCandidateForTests();
  const enabled = v2Policy({ release_ready: true, recognition_enabled: true });
  const disabled = v2Policy({ release_ready: false, recognition_enabled: false });
  let policyReads = 0;
  const fetcher = async (url) => {
    if (url.endsWith("model_manifest.json")) {
      policyReads += 1;
      return { ok: true, json: async () => policyReads === 1 ? enabled : disabled };
    }
    if (url.endsWith("text-embeddings.json")) return { ok: true, arrayBuffer: async () => arrayBuffer(textManifestBytes) };
    if (url.endsWith("text-embeddings.f32")) return { ok: true, arrayBuffer: async () => arrayBuffer(textVectorBytes) };
    throw new Error(`Unexpected URL: ${url}`);
  };
  let modelCalls = 0;
  const runtime = {
    env: { backends: { onnx: { wasm: {} } } },
    AutoProcessor: { from_pretrained: async () => async () => ({}) },
    SiglipVisionModel: { from_pretrained: async () => async () => {
      modelCalls += 1;
      return { pooler_output: { dims: [1, 768], data: new Float32Array(768).fill(1) } };
    } },
    RawImage: { read: async () => ({}) },
  };
  const result = await classifyWithSiglipCandidate(pngFile(), {
    fetcher, importer: async () => runtime,
  });
  assert.equal(modelCalls, 1);
  assert.equal(policyReads, 2);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "recognition_paused");
});

test("cleanup requested during the first policy fetch waits for a later model load", async () => {
  resetSiglipCandidateForTests();
  const enabled = v2Policy({ release_ready: true, recognition_enabled: true });
  let resolvePolicy;
  const fetcher = async (url) => {
    if (url.endsWith("model_manifest.json")) {
      return new Promise((resolve) => { resolvePolicy = () => resolve({ ok: true, json: async () => enabled }); });
    }
    if (url.endsWith("text-embeddings.json")) return { ok: true, arrayBuffer: async () => arrayBuffer(textManifestBytes) };
    if (url.endsWith("text-embeddings.f32")) return { ok: true, arrayBuffer: async () => arrayBuffer(textVectorBytes) };
    throw new Error(`Unexpected URL: ${url}`);
  };
  let disposals = 0;
  const runtime = {
    env: { backends: { onnx: { wasm: {} } } },
    AutoProcessor: { from_pretrained: async () => async () => ({}) },
    SiglipVisionModel: { from_pretrained: async () => {
      const model = async () => ({ pooler_output: { dims: [1, 1], data: new Float32Array([1]) } });
      model.dispose = async () => { disposals += 1; };
      return model;
    } },
    RawImage: { read: async () => ({}) },
  };
  const inference = classifyWithSiglipCandidate(pngFile(), { fetcher, importer: async () => runtime });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof resolvePolicy, "function");
  const cleanup = releaseSiglipModelSession();
  resolvePolicy();
  const [inferenceResult, cleanupResult] = await Promise.allSettled([inference, cleanup]);
  assert.equal(inferenceResult.status, "rejected");
  assert.equal(cleanupResult.status, "fulfilled");
  assert.equal(disposals, 1);
});

test("enabled inference is serialized so two large model calls cannot overlap", async () => {
  resetSiglipCandidateForTests();
  const enabled = v2Policy({ release_ready: true, recognition_enabled: true });
  const fetcher = async (url) => {
    if (url.endsWith("model_manifest.json")) return { ok: true, json: async () => enabled };
    if (url.endsWith("text-embeddings.json")) return { ok: true, arrayBuffer: async () => arrayBuffer(textManifestBytes) };
    if (url.endsWith("text-embeddings.f32")) return { ok: true, arrayBuffer: async () => arrayBuffer(textVectorBytes) };
    throw new Error(`Unexpected URL: ${url}`);
  };
  let active = 0;
  let maximumActive = 0;
  let modelCalls = 0;
  let modelLoads = 0;
  let disposals = 0;
  let releaseFirst;
  let announceFirst;
  const firstStarted = new Promise((resolve) => { announceFirst = resolve; });
  const runtime = {
    env: { backends: { onnx: { wasm: {} } } },
    AutoProcessor: { from_pretrained: async () => async () => ({}) },
    SiglipVisionModel: { from_pretrained: async () => {
      modelLoads += 1;
      const model = async () => {
        modelCalls += 1;
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        if (modelCalls === 1) {
          announceFirst();
          await new Promise((resolve) => { releaseFirst = resolve; });
        }
        active -= 1;
        return { pooler_output: { dims: [1, 1], data: new Float32Array([1]) } };
      };
      model.dispose = async () => { disposals += 1; };
      return model;
    } },
    RawImage: { read: async () => ({}) },
  };
  const options = { fetcher, importer: async () => runtime };
  const first = classifyWithSiglipCandidate(pngFile(), options);
  await firstStarted;
  const cleanup = releaseSiglipModelSession();
  const second = classifyWithSiglipCandidate(pngFile(), options);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(modelCalls, 1);
  assert.equal(disposals, 0);
  releaseFirst();
  const [firstResult, cleanupResult, secondResult] = await Promise.allSettled([first, cleanup, second]);
  assert.equal(firstResult.status, "rejected");
  assert.equal(cleanupResult.status, "fulfilled");
  assert.equal(secondResult.status, "rejected");
  assert.equal(modelCalls, 2);
  assert.equal(modelLoads, 2);
  assert.equal(disposals, 1);
  assert.equal(maximumActive, 1);
});

// A preview is deliberately scoped; copying its manifest to Main cannot enable it.
test("experimental preview runs only on I3/loopback and obeys the kill switch", async () => {
  for (const host of ["fix-forward-iteration-3-r4sh.onrender.com", "localhost", "127.0.0.1"]) {
    const status = await siglipClassifierAvailability(async () => ({ ok: true, json: async () => policy() }), { hostname: host });
    assert.equal(status.enabled, true);
    assert.equal(status.experimental, true);
  }
  for (const host of ["fixforward.me", "fix-forward-main.onrender.com", "fix-forward-iteration-2.onrender.com", "example.com", undefined]) {
    assert.equal(canRunSiglipPolicy(policy(), host), false);
  }
  assert.equal(canRunSiglipPolicy(policy({ recognition_enabled: false }), "localhost"), false);
  assert.throws(() => validateSiglipPolicy(policy({ release_ready: true })), /unavailable/i);
  const changed = policy();
  changed.acceptance.class_thresholds.fan.min_positive_margin = 0;
  assert.throws(() => validateSiglipPolicy(changed), /unavailable/i);
});

test("a preview on Main never imports the runtime or inspects photo pixels", async () => {
  resetSiglipCandidateForTests();
  let imported = false;
  const result = await classifyWithSiglipCandidate({ type: "image/png", size: 100 }, {
    hostname: "fixforward.me",
    fetcher: async () => ({ ok: true, json: async () => policy() }),
    importer: async () => { imported = true; throw new Error("must not load"); },
  });
  assert.equal(result.reason, "recognition_paused");
  assert.equal(imported, false);
});
