/* Explore-only photo suggestions. No Take action setting, label or scoring rule
 * is changed here. Both helpers may read the same immutable image encoder; this
 * helper owns its catalogue, text vectors, policy, session and confirmation rule.
 * Pixels stay in the browser. A photo suggests a learning topic, not product
 * identity, safety, repair instructions or a count of photographed objects.
 */
import { validatePhotoFile } from "./appliance-classifier.js?v=i3-photo-review-2";
import { validateSiglipPhotoContent } from "./siglip-appliance-classifier.js?v=i3-photo-review-v4";
import { EXPLORE_ACTIVE_ITEMS } from "./explore-catalogue.js?v=explore-ai-v2";

export const EXPLORE_POLICY_URL = "/model/explore-siglip/model_manifest.json";
// This reviewed experiment is enabled only on the I3 service and local previews.
// Main and the historical comparison sites cannot activate it by fetching a manifest.
const PREVIEW_HOSTS = new Set(["fix-forward-iteration-3-r4sh.onrender.com", "localhost", "127.0.0.1", "[::1]", "::1"]);
const POLICY_ID = "fixforward-explore-confirmation-preview-v2";
const MODEL_SHA = "9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499";
const MODEL_FILE = `vision_model.${MODEL_SHA}`;
const MODEL_ROOT = "/model/appliance-siglip/upstream/";
const RUNTIME_URL = "/vendor/transformers/transformers.min.js";
const TEXT_MANIFEST_SHA = "60c91d0d3ee7f2b8864b4a1a517907daf48e42bc9644beadbed17f59fe46f6f2";
const TEXT_VECTORS_SHA = "9e0cb396c21d7b40540aa3af20ca60322f4d4ec266db94a5722ba127463021d3";
const activeLabels = Object.freeze(EXPLORE_ACTIVE_ITEMS.map(item => item.slug));
const inactiveLabels = Object.freeze([]);
export const EXPLORE_SCORE_LABELS = Object.freeze([
  ...activeLabels, ...inactiveLabels, "computer_monitor", "keyboard_or_mouse",
  "remote_control", "battery_or_charger", "person_or_pet", "furniture",
  "vehicle", "nature", "food_or_book", "other_object",
]);

// All-32 calibration is a separate experiment. These values were frozen before
// v2 held-out predictions, using only its calibration partition. The .018 gap
// won a bounded .012/.018/.024 comparison; three choices still require review.
// A manifest alone cannot activate a silently retuned rule.
export const EXPLORE_FROZEN_ACCEPTANCE = Object.freeze({
  min_similarity: 0,
  min_ood_margin: 0.022335919226660474,
  max_choice_gap: 0.018,
  max_choices: 3,
});
const MESSAGES = Object.freeze({
  preview_only: "Photo suggestions are available in the Iteration 3 Explore preview. Choose an item below.",
  paused: "Explore photo suggestions are still being checked. Choose an item below.",
  unavailable: "Explore could not load photo suggestions. Choose an item below.",
  invalid_photo: "Choose a JPG, PNG or WebP photo up to 10 MB, or choose an item below.",
  invalid_content: "This file could not be read as a photo. Try another photo or choose an item below.",
  too_large: "Choose a photo under 30 megapixels, or choose an item below.",
  cancelled: "Photo check cancelled.",
  failed: "Explore could not check this photo. Try another photo or choose an item below.",
});
const fail = code => Object.assign(new Error(MESSAGES[code] || MESSAGES.failed), { code });
export const friendlyExploreError = error => MESSAGES[error?.code] || MESSAGES.failed;
const sameArray = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), value => value.toString(16).padStart(2, "0")).join("");
const uncertain = reason => ({ accepted: false, requiresConfirmation: true, alternatives: [], reason, objectCount: null });
const checkAbort = signal => { if (signal?.aborted) throw Object.assign(fail("cancelled"), { name: "AbortError" }); };

function validAcceptance(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === 4 &&
    ["min_similarity", "min_ood_margin", "max_choice_gap"].every(key =>
      Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1) && value.max_choices === 3;
}

/** Pure evaluation rule: callers may test calibration candidates without running
 * a browser model. The application separately requires the pinned frozen policy.
 */
export function scoreExploreSimilarities(scores, textManifest, policy) {
  if ((!Array.isArray(scores) && !ArrayBuffer.isView(scores)) || scores.length !== 42 ||
      Array.from(scores).some(value => !Number.isFinite(value) || value < -1 || value > 1) ||
      !sameArray(textManifest?.labels, EXPLORE_SCORE_LABELS) || textManifest.active_count !== 32 ||
      !validAcceptance(policy?.acceptance)) return uncertain("invalid_result");
  const ranked = activeLabels.map((slug, index) => ({ slug, score: scores[index] }))
    .sort((a, b) => b.score - a.score || activeLabels.indexOf(a.slug) - activeLabels.indexOf(b.slug));
  const competing = Math.max(...Array.from(scores).slice(32));
  const { min_similarity, min_ood_margin, max_choice_gap, max_choices } = policy.acceptance;
  if (ranked[0].score < min_similarity || ranked[0].score - competing < min_ood_margin) return uncertain("not_sure");
  const alternatives = ranked.slice(0, max_choices).filter(item => ranked[0].score - item.score <= max_choice_gap)
    .map(({ slug }) => ({ slug, label: EXPLORE_ACTIVE_ITEMS.find(item => item.slug === slug).label }));
  return { accepted: true, requiresConfirmation: true, alternatives,
    reason: alternatives.length > 1 ? "similar_types" : "needs_confirmation", objectCount: null };
}

/** Metadata is an allowlist and a kill switch, not permission to load arbitrary
 * models. A valid paused policy is readable while calibration is in progress.
 */
export function validateExplorePolicy(policy) {
  const vision = policy?.vision_model, text = policy?.text_embeddings, runtime = policy?.runtime;
  const frozenMatches = EXPLORE_FROZEN_ACCEPTANCE && validAcceptance(policy?.acceptance) &&
    Object.entries(EXPLORE_FROZEN_ACCEPTANCE).every(([key, value]) => policy.acceptance[key] === value);
  if (!policy || policy.candidate_id !== POLICY_ID || policy.policy_version !== 2 ||
       policy.release_ready !== false || policy.experimental !== true || policy.scope !== "iteration_3_preview" ||
      policy.requires_user_confirmation !== true || policy.photo_scope !== "single_item" ||
      typeof policy.recognition_enabled !== "boolean" ||
      !sameArray(policy.active_labels, activeLabels) || !sameArray(policy.inactive_labels, inactiveLabels) ||
      (policy.recognition_enabled ? !frozenMatches : policy.acceptance !== null && !frozenMatches) ||
      vision?.repository !== "siglip2-base-patch32-256" || vision.sha256 !== MODEL_SHA ||
      vision.file !== `onnx/${MODEL_FILE}_q4.onnx` || vision.model_file_name !== MODEL_FILE ||
      vision.dtype !== "q4" || vision.bytes !== 69938403 ||
      vision.revision !== "7efccb86b5b6601bfe9e14326e1c11b40b68d44c" ||
      vision.base_model !== "google/siglip2-base-patch32-256" ||
      vision.base_model_revision !== "94dffa8cb1179de3e03f091dbc3917e5d5a9ae84" ||
      runtime?.library !== "@huggingface/transformers" || runtime.version !== "3.8.1" ||
      runtime.module_url !== RUNTIME_URL || runtime.local_model_path !== MODEL_ROOT ||
      runtime.wasm_path !== "/vendor/transformers/" || runtime.wasm_threads !== 1 ||
      text?.manifest_url !== "/model/explore-siglip/text-embeddings.json" ||
      text.vectors_url !== "/model/explore-siglip/text-embeddings.f32" ||
      text.manifest_sha256 !== TEXT_MANIFEST_SHA || text.vectors_sha256 !== TEXT_VECTORS_SHA ||
      text.vectors_bytes !== 42 * 768 * 4) throw fail("unavailable");
  return policy;
}

async function readPolicy(fetcher) {
  const response = await fetcher(EXPLORE_POLICY_URL, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw fail("unavailable");
  return validateExplorePolicy(await response.json());
}

export async function exploreClassifierAvailability({ fetcher = fetch, hostname = globalThis.location?.hostname } = {}) {
  const base = { available: false, experimental: true, downloadSizeMb: 92 };
  if (!PREVIEW_HOSTS.has(hostname)) return { ...base, reason: "preview_only", message: MESSAGES.preview_only };
  try {
    const policy = await readPolicy(fetcher);
    return policy.recognition_enabled ? { ...base, available: true, reason: "", message: "" }
      : { ...base, reason: "paused", message: MESSAGES.paused };
  } catch { return { ...base, reason: "unavailable", message: MESSAGES.unavailable }; }
}

let vectorsCache, runtimePromise, sessionPromise;
let queue = Promise.resolve();
const serialize = task => { const run = queue.then(task, task); queue = run.catch(() => undefined); return run; };

async function loadVectors(policy, fetcher) {
  const key = `${policy.text_embeddings.manifest_sha256}:${policy.text_embeddings.vectors_sha256}`;
  if (vectorsCache?.key !== key) {
    const promise = (async () => {
      const responses = await Promise.all([policy.text_embeddings.manifest_url, policy.text_embeddings.vectors_url]
        .map(url => fetcher(url, { cache: "no-store", credentials: "same-origin" })));
      if (responses.some(response => !response.ok)) throw fail("unavailable");
      const [metadataBytes, vectorBytes] = await Promise.all(responses.map(response => response.arrayBuffer()));
      if (await digest(metadataBytes) !== TEXT_MANIFEST_SHA || await digest(vectorBytes) !== TEXT_VECTORS_SHA ||
          vectorBytes.byteLength !== 42 * 768 * 4) throw fail("unavailable");
      const metadata = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(metadataBytes));
      if (metadata.artifact !== "fixforward-explore-siglip2-text-embeddings-v2" ||
          !sameArray(metadata.labels, EXPLORE_SCORE_LABELS) || !sameArray(metadata.shape, [42, 768]) ||
          metadata.active_count !== 32 || metadata.catalogue_count !== 32 ||
          metadata.dtype !== "float32-little-endian" || metadata.model !== policy.vision_model.base_model ||
          metadata.resolved_revision !== policy.vision_model.base_model_revision ||
          new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) throw fail("unavailable");
      const values = new Float32Array(vectorBytes);
      for (let row = 0; row < 42; row++) {
        const slice = values.subarray(row * 768, (row + 1) * 768);
        const norm = Math.sqrt(slice.reduce((sum, value) => sum + value * value, 0));
        if (!Number.isFinite(norm) || Math.abs(norm - 1) > .001) throw fail("unavailable");
      }
      return { metadata, values };
    })().catch(error => { if (vectorsCache?.key === key) vectorsCache = undefined; throw error; });
    vectorsCache = { key, promise };
  }
  return vectorsCache.promise;
}

async function loadRuntime(importer) {
  if (!runtimePromise) runtimePromise = importer(RUNTIME_URL).then(runtime => {
    if (!runtime.env || !runtime.AutoProcessor || !runtime.SiglipVisionModel || !runtime.RawImage) throw fail("unavailable");
    runtime.env.allowRemoteModels = false;
    runtime.env.allowLocalModels = true;
    runtime.env.localModelPath = MODEL_ROOT;
    runtime.env.useBrowserCache = false;
    const wasm = runtime.env.backends?.onnx?.wasm;
    if (!wasm) throw fail("unavailable");
    Object.assign(wasm, { wasmPaths: "/vendor/transformers/", numThreads: 1, proxy: false });
    return runtime;
  }).catch(error => { runtimePromise = undefined; throw error; });
  return runtimePromise;
}

const policyIdentity = policy => JSON.stringify([policy.candidate_id, policy.acceptance, policy.active_labels,
  policy.inactive_labels, policy.vision_model.sha256, policy.text_embeddings]);

/** Optional dependencies enable lifecycle tests without downloading a model.
 * Browser callers normally supply only signal and an onProgress callback.
 */
export function classifyExplorePhoto(file, {
  signal, onProgress = () => {}, fetcher = fetch, importer = url => import(url),
  hostname = globalThis.location?.hostname,
} = {}) {
  if (!PREVIEW_HOSTS.has(hostname)) return Promise.reject(fail("preview_only"));
  if (!validatePhotoFile(file).ok) return Promise.reject(fail("invalid_photo"));
  return serialize(async () => {
    try {
      checkAbort(signal);
      const policy = await readPolicy(fetcher);
      checkAbort(signal);
      if (!policy.recognition_enabled) return uncertain("paused");
      const identity = policyIdentity(policy);
      try { await validateSiglipPhotoContent(file); }
      catch (error) { throw fail(error?.code === "excessive_image_dimensions" ? "too_large" : "invalid_content"); }
      checkAbort(signal);
      const [vectors, runtime] = await Promise.all([loadVectors(policy, fetcher), loadRuntime(importer)]);
      checkAbort(signal);
      const progress = event => {
        if (signal?.aborted) return;
        const percentage = Number(event?.progress);
        onProgress({ stage: "loading", message: "Getting Explore ready. Your photo stays on this device.",
          ...(Number.isFinite(percentage) ? { progress: Math.max(0, Math.min(100, percentage)) } : {}) });
      };
      if (!sessionPromise) sessionPromise = Promise.all([
        runtime.AutoProcessor.from_pretrained(policy.vision_model.repository, { local_files_only: true, progress_callback: progress }),
        runtime.SiglipVisionModel.from_pretrained(policy.vision_model.repository, { local_files_only: true,
          dtype: "q4", model_file_name: MODEL_FILE, progress_callback: progress }),
      ]).then(([processor, model]) => ({ processor, model })).catch(error => { sessionPromise = undefined; throw error; });
      const { processor, model } = await sessionPromise;
      checkAbort(signal);
      onProgress({ stage: "analysing", message: "Looking for a learning topic in your photo." });
      const image = await runtime.RawImage.read(file);
      checkAbort(signal);
      const tensor = (await model(await processor(image)))?.pooler_output;
      checkAbort(signal);
      if (tensor?.dims?.[0] !== 1 || tensor.dims.at(-1) !== 768 || tensor.data?.length !== 768 ||
          Array.from(tensor.data).some(value => !Number.isFinite(value))) throw fail("failed");
      const latest = await readPolicy(fetcher);
      checkAbort(signal);
      if (!latest.recognition_enabled || policyIdentity(latest) !== identity) return uncertain("paused");
      const norm = Math.sqrt(Array.from(tensor.data).reduce((sum, value) => sum + value * value, 0));
      if (!(norm > 0) || !Number.isFinite(norm)) throw fail("failed");
      const scores = Array.from({ length: 42 }, (_, row) => {
        let sum = 0;
        for (let column = 0; column < 768; column++) sum += tensor.data[column] / norm * vectors.values[row * 768 + column];
        return sum;
      });
      const result = scoreExploreSimilarities(scores, vectors.metadata, policy);
      if (result.reason === "invalid_result") throw fail("failed");
      return result;
    } catch (error) { throw Object.hasOwn(MESSAGES, error?.code) ? error : fail("failed"); }
  });
}

/** Disposal waits for running inference; stale UI is stopped immediately by its
 * AbortSignal. No Take action session is touched by this Explore-only cleanup.
 */
export function releaseExploreModelSession() {
  return serialize(async () => {
    const pending = sessionPromise;
    sessionPromise = undefined;
    if (pending) { try { await (await pending).model.dispose?.(); } catch { /* Failed loads need no cleanup. */ } }
  });
}

export function resetExploreClassifierForTests() {
  vectorsCache = undefined; runtimePromise = undefined; sessionPromise = undefined; queue = Promise.resolve();
}
