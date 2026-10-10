/* These tests check schema, isolation and lifecycle using synthetic tensors.
 * They do not claim real-photo accuracy; the separate calibration report does.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  EXPLORE_FROZEN_ACCEPTANCE, EXPLORE_SCORE_LABELS, validateExplorePolicy,
  scoreExploreSimilarities, exploreClassifierAvailability, classifyExplorePhoto,
  friendlyExploreError, resetExploreClassifierForTests, releaseExploreModelSession,
} from "../src/explore-classifier.js";
import { EXPLORE_ITEMS32, EXPLORE_ACTIVE_ITEMS16, EXPLORE_ACTIVE_ITEMS } from "../src/explore-catalogue.js";
import { CATALOGUE } from "../prototypes/i3-world-preview/catalogue.js";

const bytes = async name => readFile(new URL(`../model/explore-siglip/${name}`, import.meta.url));
const policy = JSON.parse(await bytes("model_manifest.json"));
const metadataBytes = await bytes("text-embeddings.json"), vectorBytes = await bytes("text-embeddings.f32");
const metadata = JSON.parse(metadataBytes);
const arrayBuffer = buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const vectors = new Float32Array(arrayBuffer(vectorBytes));
const clone = value => JSON.parse(JSON.stringify(value));
const validPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const photo = () => ({ type: "image/png", size: validPng.length, arrayBuffer: async () => arrayBuffer(validPng) });
const candidate = { acceptance: { min_similarity: .1, min_ood_margin: .02, max_choice_gap: .01, max_choices: 3 } };
const scoresFor = slug => {
  const scores = Array(42).fill(-.1);
  scores[EXPLORE_SCORE_LABELS.indexOf(slug)] = .3;
  return scores;
};

test("Explore v2 has 32 ordered active types and preserves the historical first16", () => {
  assert.equal(EXPLORE_ITEMS32.length, 32);
  assert.equal(new Set(EXPLORE_ITEMS32.map(item => item.slug)).size, 32);
  assert.equal(EXPLORE_ACTIVE_ITEMS16.length, 16);
  assert.equal(EXPLORE_ACTIVE_ITEMS.length, 32);
  assert.deepEqual(EXPLORE_ACTIVE_ITEMS.map(item => item.slug), metadata.active_labels);
  assert.deepEqual(EXPLORE_ACTIVE_ITEMS16.map(item => item.slug), metadata.active_labels.slice(0,16));
  assert.equal(EXPLORE_ACTIVE_ITEMS16.find(item => item.slug === "vacuum_cleaner").worldId, "vacuum");
  assert.equal(EXPLORE_ACTIVE_ITEMS16.find(item => item.slug === "smartphone").worldId, "smartphone");
  assert.ok(Object.isFrozen(EXPLORE_ITEMS32) && EXPLORE_ITEMS32.every(Object.isFrozen));
  assert.ok(Object.isFrozen(EXPLORE_ACTIVE_ITEMS));
});

test("every confirmed Explore suggestion has its own 3D lesson rather than a coming-next fallback", () => {
  const lessonIds = new Set(CATALOGUE.map(item => item.id));
  for (const item of EXPLORE_ACTIVE_ITEMS) {
    assert.equal(typeof item.worldId, "string", item.slug);
    assert.ok(lessonIds.has(item.worldId), `${item.slug} resolves to ${item.worldId}`);
  }
  assert.equal(new Set(EXPLORE_ACTIVE_ITEMS.map(item => item.worldId)).size, 32);
});

test("new Explore vector bytes, shape and full competitive label order are pinned", () => {
  assert.deepEqual(metadata.labels, EXPLORE_SCORE_LABELS);
  assert.deepEqual(metadata.shape, [42, 768]);
  assert.equal(vectorBytes.length, 42 * 768 * 4);
  assert.equal(createHash("sha256").update(metadataBytes).digest("hex"), policy.text_embeddings.manifest_sha256);
  assert.equal(createHash("sha256").update(vectorBytes).digest("hex"), policy.text_embeddings.vectors_sha256);
  assert.equal(policy.vision_model.sha256, "9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499");
});

test("every active type may be suggested, always requiring confirmation", () => {
  for (const item of EXPLORE_ACTIVE_ITEMS) {
    const result = scoreExploreSimilarities(scoresFor(item.slug), metadata, candidate);
    assert.deepEqual(result.alternatives, [{ slug: item.slug, label: item.label }]);
    assert.equal(result.accepted, true);
    assert.equal(result.requiresConfirmation, true);
    assert.equal(result.objectCount, null);
  }
});

test("all ten unrelated controls compete and cannot become a false catalogue match", () => {
  assert.equal(metadata.inactive_labels.length, 0);
  assert.equal(metadata.control_labels.length, 10);
  for (const slug of metadata.control_labels) {
    const scores = scoresFor("kettle"); scores[EXPLORE_SCORE_LABELS.indexOf(slug)] = .4;
    const result = scoreExploreSimilarities(scores, metadata, candidate);
    assert.equal(result.accepted, false, slug);
    assert.deepEqual(result.alternatives, []);
  }
});

test("weak photos reject; close supported types are alternatives, never an item count", () => {
  assert.equal(scoreExploreSimilarities(Array(42).fill(.01), metadata, candidate).accepted, false);
  const scores = scoresFor("tablet"); scores[EXPLORE_SCORE_LABELS.indexOf("smartphone")] = .295;
  const result = scoreExploreSimilarities(scores, metadata, candidate);
  assert.deepEqual(result.alternatives.map(item => item.slug), ["tablet", "smartphone"]);
  assert.equal(result.reason, "similar_types"); assert.equal(result.objectCount, null);
  assert.equal(Object.hasOwn(result.alternatives[0], "similarity"), false);
});

test("wrong vector order, nonfinite scores and invalid acceptance fail closed", () => {
  for (const scores of [Array(29).fill(.2), Array(42).fill(NaN), Array(42).fill(Infinity), Array(42).fill(2)]) {
    assert.equal(scoreExploreSimilarities(scores, metadata, candidate).reason, "invalid_result");
  }
  assert.equal(scoreExploreSimilarities(scoresFor("fan"), { ...metadata, labels: [...metadata.labels].reverse() }, candidate).accepted, false);
  assert.equal(scoreExploreSimilarities(scoresFor("fan"), { ...metadata, active_count: 16 }, candidate).reason, "invalid_result");
  assert.equal(scoreExploreSimilarities(scoresFor("fan"), metadata, { acceptance: { ...candidate.acceptance, max_choices: 16 } }).accepted, false);
});

test("policy pins Explore scope and separate asset paths while keeping general release false", () => {
  assert.equal(validateExplorePolicy(clone(policy)).release_ready, false);
  for (const edit of [
    { policy_version: 1 }, { candidate_id: "fixforward-explore-confirmation-preview-v1" },
    { release_ready: true }, { scope: "public" }, { scope: "localhost_only" },
    { active_labels: [...policy.active_labels].reverse() },
    { requires_user_confirmation: false },
    { text_embeddings: { ...policy.text_embeddings, vectors_url: "/model/appliance-siglip/text-embeddings.f32" } },
    { runtime: { ...policy.runtime, module_url: "https://cdn.example/runtime.js" } },
    { vision_model: { ...policy.vision_model, sha256: "0".repeat(64) } },
  ]) assert.throws(() => validateExplorePolicy({ ...clone(policy), ...edit }), /could not load/i);
});

test("all32 calibration cannot be replaced using the historical v1 rule", () => {
  const historical = { min_similarity: 0.0977325007197083, min_ood_margin: 0.00424680611670025,
    max_choice_gap: 0.012, max_choices: 3 };
  assert.throws(() => validateExplorePolicy({ ...clone(policy), recognition_enabled: true,
    acceptance: historical }), /could not load/i);
  assert.equal(policy.recognition_enabled, true);
  assert.deepEqual(policy.acceptance, EXPLORE_FROZEN_ACCEPTANCE);
  assert.equal(policy.validation.calibration_frozen_before_holdout, true);
});

test("Main, historical versions and unapproved hosts cannot read a photo or load the runtime", async () => {
  for (const hostname of ["fixforward.me", "fix-forward-main.onrender.com", "fix-forward-iteration-1.onrender.com",
    "fix-forward-iteration-2.onrender.com", "fix-forward-iteration-3.onrender.com", "example.com",
    "fix-forward-iteration-3-r4sh.onrender.com.example.com"]) {
    let calls = 0;
    const fetcher = async () => { calls++; throw new Error("private debug"); };
    assert.equal((await exploreClassifierAvailability({ fetcher, hostname })).available, false);
    await assert.rejects(classifyExplorePhoto(photo(), { fetcher, hostname }), error => error.code === "preview_only");
    assert.equal(calls, 0);
  }
});

test("the exact I3 service and loopbacks can read the enabled review policy", async () => {
  const fetcher = async () => ({ ok: true, json: async () => clone(policy) });
  for (const hostname of ["fix-forward-iteration-3-r4sh.onrender.com", "localhost", "127.0.0.1", "[::1]", "::1"]) {
    const result = await exploreClassifierAvailability({ fetcher, hostname });
    assert.equal(result.available, true, hostname);
    assert.equal(result.experimental, true);
  }
});

test("availability re-reads its own no-store kill switch and hides raw errors", async () => {
  const requests = [];
  const fetcher = async (url, options) => { requests.push([url, options]); return { ok: true, json: async () => ({ ...clone(policy), recognition_enabled: false }) }; };
  for (let i = 0; i < 2; i++) assert.equal((await exploreClassifierAvailability({ fetcher, hostname: "localhost" })).available, false);
  assert.ok(requests.every(([url, options]) => url === "/model/explore-siglip/model_manifest.json" && options.cache === "no-store"));
  assert.equal(friendlyExploreError(new Error("secret internal path")), "Explore could not check this photo. Try another photo or choose an item below.");
});

function harness({ label = "laptop", currentPolicy = () => clone(policy) } = {}) {
  const counts = { imports: 0, models: 0, reads: 0, disposed: 0 };
  const fetcher = async (url, options) => {
    assert.equal(options.cache, "no-store");
    if (url.endsWith("model_manifest.json")) { counts.reads++; return { ok: true, json: async () => currentPolicy(counts.reads) }; }
    if (url.endsWith("text-embeddings.json")) return { ok: true, arrayBuffer: async () => arrayBuffer(metadataBytes) };
    if (url.endsWith("text-embeddings.f32")) return { ok: true, arrayBuffer: async () => arrayBuffer(vectorBytes) };
    throw new Error("Unexpected request");
  };
  const row = EXPLORE_SCORE_LABELS.indexOf(label), embedding = vectors.slice(row * 768, (row + 1) * 768);
  embedding[767] += .25; // Synthetic, non-perfect self-match stays inside cosine bounds.
  const model = async () => { counts.models++; return { pooler_output: { dims: [1, 768], data: embedding } }; };
  model.dispose = async () => { counts.disposed++; };
  const runtime = { env: { backends: { onnx: { wasm: {} } } },
    AutoProcessor: { from_pretrained: async () => async () => ({}) },
    SiglipVisionModel: { from_pretrained: async () => model }, RawImage: { read: async () => ({}) } };
  return { counts, runtime, options: { fetcher, hostname: "localhost", importer: async () => { counts.imports++; return runtime; } } };
}

test("a paused policy never inspects a photo or imports the model", async () => {
  resetExploreClassifierForTests();
  const h = harness({ currentPolicy: () => ({ ...clone(policy), recognition_enabled: false }) });
  const result = await classifyExplorePhoto({ type: "image/png", size: 50, arrayBuffer: () => { throw new Error("must not read"); } }, h.options);
  assert.equal(result.reason, "paused"); assert.equal(h.counts.imports, 0);
});

// These integration checks exercise the enabled I3 review policy;
// they must not silently skip lifecycle protection after calibration is frozen.
test("enabled Explore runs its own scores and cleanup without an adult confirmation", async () => {
  resetExploreClassifierForTests(); const h = harness();
  const result = await classifyExplorePhoto(photo(), { ...h.options, hostname: "fix-forward-iteration-3-r4sh.onrender.com" });
  assert.equal(result.accepted, true); assert.equal(result.requiresConfirmation, true);
  assert.equal(result.alternatives[0].slug, "laptop"); assert.equal(result.objectCount, null);
  assert.equal(h.runtime.env.allowRemoteModels, false);
  await releaseExploreModelSession(); assert.equal(h.counts.disposed, 1);
});

test("revocation during inference suppresses the completed Explore suggestion", async () => {
  resetExploreClassifierForTests();
  const h = harness({ currentPolicy: reads => ({ ...clone(policy), recognition_enabled: reads === 1 }) });
  const result = await classifyExplorePhoto(photo(), h.options);
  assert.equal(result.accepted, false); assert.equal(result.reason, "paused");
  assert.equal(h.counts.models, 1); assert.equal(h.counts.reads, 2);
});

test("cancellation and invalid files prevent a late Explore result", async () => {
  resetExploreClassifierForTests(); const h = harness();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(classifyExplorePhoto(photo(), { ...h.options, signal: controller.signal }), error => error.name === "AbortError");
  await assert.rejects(classifyExplorePhoto({ type: "image/png", size: 4, arrayBuffer: async () => new ArrayBuffer(4) }, h.options), error => error.code === "invalid_content");
  assert.equal(h.counts.imports, 0);
});
