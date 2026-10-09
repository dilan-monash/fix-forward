/*
 * Gated SigLIP 2 browser candidate for adult appliance suggestions.
 *
 * Full release and the explicitly authorised I3 experimental preview are separate.
 * If it is enabled later, every runtime and model request stays same-origin,
 * image pixels remain in the browser, and the person must confirm a suggestion.
 * This helper never diagnoses a fault or decides whether an appliance is safe.
 */
import {
  APPLIANCE_CLASSES,
  friendlyRecognitionError,
  validatePhotoFile,
} from "./appliance-classifier.js?v=i3-photo-review-2";

export const SIGLIP_POLICY_URL = "/model/appliance-siglip/model_manifest.json";
export const TRANSFORMERS_JS_URL = "/vendor/transformers/transformers.min.js";
export const TRANSFORMERS_WASM_PATH = "/vendor/transformers/";
export const LOCAL_MODEL_PATH = "/model/appliance-siglip/upstream/";

// Build tests hash these exact vendored files. The browser trusts the deployed
// same-origin allowlist instead of downloading each large file twice to rehash it.
const RUNTIME_ASSETS = Object.freeze({
  transformers_js: Object.freeze({
    url: TRANSFORMERS_JS_URL,
    bytes: 888173,
    sha256: "aa5002b70e789798da263f5f99c62bd3e8fcd0c119258a493c40c180648365fa",
  }),
  ort_wasm_module: Object.freeze({
    url: "/vendor/transformers/ort-wasm-simd-threaded.jsep.mjs",
    bytes: 44484,
    sha256: "08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9",
  }),
  ort_wasm_binary: Object.freeze({
    url: "/vendor/transformers/ort-wasm-simd-threaded.jsep.wasm",
    bytes: 21596019,
    sha256: "c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39",
  }),
});

const MODEL_REPOSITORY = "siglip2-base-patch32-256";
const MODEL_SHA256 = "9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499";
const MODEL_BYTES = 69938403;
const MODEL_REVISION = "7efccb86b5b6601bfe9e14326e1c11b40b68d44c";
const BASE_MODEL = "google/siglip2-base-patch32-256";
const BASE_MODEL_REVISION = "94dffa8cb1179de3e03f091dbc3917e5d5a9ae84";
const MODEL_FILE_NAME = `vision_model.${MODEL_SHA256}`;
const MODEL_ASSET_FILE = `onnx/${MODEL_FILE_NAME}_q4.onnx`;
const TEXT_MANIFEST_URL = "/model/appliance-siglip/text-embeddings.json";
const TEXT_VECTORS_URL = "/model/appliance-siglip/text-embeddings.f32";
const TEXT_MANIFEST_SHA256 = "4b01be52acad78dae1783978e1bc191d50532dc63781a5cd7b96e24f3a390093";
const TEXT_VECTORS_SHA256 = "2e63f55601cf3f011bf13b3c347bd456111c1b8132f9d8164105fff0a29877f2";
const TEXT_ROWS = 29;
const TEXT_COLUMNS = 768;
const MAX_IMAGE_PIXELS = 30_000_000;

// These OOD labels are part of the frozen scoring schema. A changed order would
// pair the wrong label with a vector, so it is rejected before inference.
const OOD_LABELS = Object.freeze([
  "other_kitchen_appliance", "built_in_oven", "refrigerator", "washing_machine",
  "screen_device", "person_or_pet", "furniture", "vehicle", "nature", "other_object",
]);
const EXPECTED_LABELS = Object.freeze([
  ...APPLIANCE_CLASSES.map(({ slug }) => slug),
  ...OOD_LABELS,
]);
const V1_ENABLED_CLASSES = Object.freeze([
  "air_fryer", "blender", "coffee_machine", "fan", "hair_dryer", "kettle",
  "microwave", "mixer", "portable_ac", "portable_heater", "sandwich_press",
  "toaster", "vaccum_cleaner",
]);
const V2_CANDIDATE_ID = "fixforward-siglip2-class-threshold-candidate-v2";
const V2_ENABLED_CLASSES = Object.freeze([
  "air_fryer", "blender", "coffee_machine", "fan", "food_processor", "hair_dryer",
  "kettle", "microwave", "mixer", "portable_ac", "portable_heater", "rice_cooker",
  "sandwich_press", "shaver", "straightener", "toaster", "vaccum_cleaner",
]);
const V2_MANUAL_ONLY_CLASSES = Object.freeze(["dehumidifier", "steam_cleaner"]);

// These values are the exact prediction-blind candidate-v2 policy. Keeping the
// map here makes a future manifest change fail closed if a class or decimal is
// added, removed or retuned after the locked evaluation.
const V2_CLASS_THRESHOLDS = Object.freeze({
  air_fryer: Object.freeze({ min_ood_margin: 0.0312, min_positive_margin: 0.0386 }),
  blender: Object.freeze({ min_ood_margin: 0.0215, min_positive_margin: 0.0362 }),
  coffee_machine: Object.freeze({ min_ood_margin: 0.0283, min_positive_margin: 0.0224 }),
  fan: Object.freeze({ min_ood_margin: 0.0226, min_positive_margin: 0.0349 }),
  food_processor: Object.freeze({ min_ood_margin: 0.0283, min_positive_margin: 0.0282 }),
  hair_dryer: Object.freeze({ min_ood_margin: 0.0093, min_positive_margin: 0.0055 }),
  kettle: Object.freeze({ min_ood_margin: 0.0323, min_positive_margin: 0.0256 }),
  microwave: Object.freeze({ min_ood_margin: 0.0044, min_positive_margin: 0.0408 }),
  mixer: Object.freeze({ min_ood_margin: 0.0324, min_positive_margin: 0.0111 }),
  portable_ac: Object.freeze({ min_ood_margin: 0.054, min_positive_margin: 0.0154 }),
  portable_heater: Object.freeze({ min_ood_margin: 0.0272, min_positive_margin: 0.0152 }),
  rice_cooker: Object.freeze({ min_ood_margin: 0.0099, min_positive_margin: 0.0068 }),
  sandwich_press: Object.freeze({ min_ood_margin: 0.0309, min_positive_margin: 0.0088 }),
  shaver: Object.freeze({ min_ood_margin: 0.0493, min_positive_margin: 0.0583 }),
  straightener: Object.freeze({ min_ood_margin: 0.0061, min_positive_margin: 0.0027 }),
  toaster: Object.freeze({ min_ood_margin: 0.0358, min_positive_margin: 0.0497 }),
  vaccum_cleaner: Object.freeze({ min_ood_margin: 0.0484, min_positive_margin: 0.0224 }),
});
// V3 keeps its frozen class thresholds. The preview does not claim that its
// failed/incomplete validation became a production release approval.
const V3_CANDIDATE_ID = "fixforward-siglip2-selective-class-threshold-candidate-v3";
const V3_ENABLED_CLASSES = Object.freeze([
  "air_fryer", "coffee_machine", "fan", "hair_dryer", "kettle", "microwave",
  "portable_ac", "portable_heater", "rice_cooker", "sandwich_press", "straightener",
]);
const V3_MANUAL_ONLY_CLASSES = Object.freeze([
  "blender", "food_processor", "mixer", "shaver", "toaster", "vaccum_cleaner",
  "dehumidifier", "steam_cleaner",
]);
const PREVIEW_HOSTS = new Set(["fix-forward-iteration-3-r4sh.onrender.com", "localhost", "127.0.0.1", "[::1]"]);

// Keep this preview scoped to I3 and loopback testing. The normal release flag
// stays false; the recognition switch still cancels a running preview remotely.
export function canRunSiglipPolicy(policy, hostname = globalThis.location?.hostname) {
  if (!policy?.recognition_enabled) return false;
  if (policy.candidate_id === V3_CANDIDATE_ID) {
    return policy.release_ready === false && policy.experimental_preview === true && PREVIEW_HOSTS.has(hostname);
  }
  return policy.release_ready === true;
}

const V2_ACCEPTANCE_RULE = "The top appliance label must be enabled and both thresholds for that winning label must pass. Never fall through to a lower-ranked enabled label.";
const V2_SCORE_NOTICE = "Cosine margins are internal rejection evidence, not a user-facing confidence percentage.";

const FIXED_MESSAGES = Object.freeze({
  recognition_paused: "Photo suggestions are still being checked. Choose your appliance manually below.",
  policy_unavailable: "Photo suggestions could not be loaded. Choose your appliance manually below.",
  invalid_policy: "Photo suggestions are unavailable for this version. Choose your appliance manually below.",
  runtime_unavailable: "This browser cannot run the photo helper. Choose your appliance manually below.",
  vectors_unavailable: "The photo helper could not load its labels. Choose your appliance manually below.",
  invalid_result: "The photo result could not be checked. Choose your appliance manually below.",
  request_cancelled: "Photo check cancelled.",
  invalid_image_content: "This file is not a valid JPG, PNG or WebP photo. Choose another photo or select your appliance manually.",
  excessive_image_dimensions: "This photo is too large to check safely. Choose a photo under 30 megapixels or select your appliance manually.",
  prediction_failed: "Photo recognition could not be completed. Choose your appliance manually below.",
});

let vectorCache;
let runtimePromise;
let modelCache;
let inferenceTail = Promise.resolve();

function fixedError(code) {
  const error = new Error(FIXED_MESSAGES[code] || FIXED_MESSAGES.prediction_failed);
  error.code = code;
  return error;
}

// Cancellation cannot interrupt an ONNX operation already running inside WASM,
// but these checkpoints prevent stale queued photos from starting expensive work
// and stop a completed stale result from reaching the page.
function assertNotAborted(signal) {
  if (!signal?.aborted) return;
  const error = fixedError("request_cancelled");
  error.name = "AbortError";
  throw error;
}

export function friendlySiglipError(error) {
  return FIXED_MESSAGES[error?.code] || friendlyRecognitionError(error);
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isSameOriginAsset(value, expected) {
  return typeof value === "string" && value === expected && value.startsWith("/") && !value.startsWith("//");
}

function matchesPinnedAsset(actual, expected) {
  return actual && typeof actual === "object" &&
    isSameOriginAsset(actual.url, expected.url) &&
    actual.bytes === expected.bytes &&
    actual.sha256 === expected.sha256 && isSha256(actual.sha256);
}

function hasExactKeys(value, expectedKeys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    equalArray(Object.keys(value), expectedKeys);
}

function matchesPinnedThresholds(classThresholds, enabledClasses = V2_ENABLED_CLASSES) {
  if (!hasExactKeys(classThresholds, enabledClasses)) return false;
  return enabledClasses.every((slug) => {
    const actual = classThresholds[slug];
    const expected = V2_CLASS_THRESHOLDS[slug];
    return hasExactKeys(actual, ["min_ood_margin", "min_positive_margin"]) &&
      actual.min_ood_margin === expected.min_ood_margin &&
      actual.min_positive_margin === expected.min_positive_margin;
  });
}

function matchesVersionedAcceptance(policy, acceptance, enabledClasses) {
  if (!acceptance || typeof acceptance !== "object" || Array.isArray(acceptance)) return false;
  if (policy.policy_version === 1) {
    // Version 1 is retained only as disabled failed-test evidence. It must not
    // become runnable by changing its two release flags.
    return policy.release_ready === false && policy.recognition_enabled === false &&
      equalArray(enabledClasses, V1_ENABLED_CLASSES) &&
      acceptance?.min_ood_margin === 0.035 &&
      acceptance?.min_positive_margin === 0.01 &&
      !Object.hasOwn(acceptance, "class_thresholds");
  }
  if (policy.policy_version !== 2) return false;
  const manualOnlyClasses = policy.manual_only_classes;
  if (!Array.isArray(manualOnlyClasses)) return false;
  const allClasses = new Set([...enabledClasses, ...manualOnlyClasses]);
  const preview = policy.candidate_id === V3_CANDIDATE_ID;
  const expectedEnabled = preview ? V3_ENABLED_CLASSES : V2_ENABLED_CLASSES;
  const expectedManual = preview ? V3_MANUAL_ONLY_CLASSES : V2_MANUAL_ONLY_CLASSES;
  return (preview
    ? policy.release_ready === false && policy.experimental_preview === true
    : policy.candidate_id === V2_CANDIDATE_ID) &&
    equalArray(enabledClasses, expectedEnabled) &&
    equalArray(manualOnlyClasses, expectedManual) &&
    allClasses.size === APPLIANCE_CLASSES.length &&
    APPLIANCE_CLASSES.every(({ slug }) => allClasses.has(slug)) &&
    acceptance?.rule === (preview ? V2_ACCEPTANCE_RULE.replace("both thresholds", "both frozen thresholds") : V2_ACCEPTANCE_RULE) &&
    acceptance?.comparison === "greater_than_or_equal" &&
    acceptance?.score_notice === V2_SCORE_NOTICE &&
    !Object.hasOwn(acceptance, "min_ood_margin") &&
    !Object.hasOwn(acceptance, "min_positive_margin") &&
    matchesPinnedThresholds(acceptance?.class_thresholds, expectedEnabled);
}

// The manifest is a release gate and an asset allowlist, not merely metadata.
// Exact local paths prevent a changed policy from reintroducing remote downloads.
export function validateSiglipPolicy(policy) {
  const acceptance = policy?.acceptance;
  const runtime = policy?.runtime;
  const vision = policy?.vision_model;
  const text = policy?.text_embeddings;
  const enabledClasses = policy?.enabled_classes;
  const knownSlugs = new Set(APPLIANCE_CLASSES.map(({ slug }) => slug));
  const valid = policy && typeof policy === "object" &&
    (policy.policy_version === 1 || policy.policy_version === 2) &&
    policy.photo_processing === "browser-local" &&
    policy.requires_user_confirmation === true &&
    typeof policy.release_ready === "boolean" &&
    typeof policy.recognition_enabled === "boolean" &&
    Array.isArray(enabledClasses) &&
    new Set(enabledClasses).size === enabledClasses.length &&
    enabledClasses.every((slug) => typeof slug === "string" && knownSlugs.has(slug)) &&
    matchesVersionedAcceptance(policy, acceptance, enabledClasses) &&
    runtime?.library === "@huggingface/transformers" &&
    runtime.version === "3.8.1" &&
    isSameOriginAsset(runtime.module_url, TRANSFORMERS_JS_URL) &&
    isSameOriginAsset(runtime.wasm_path, TRANSFORMERS_WASM_PATH) &&
    isSameOriginAsset(runtime.local_model_path, LOCAL_MODEL_PATH) &&
    runtime.wasm_threads === 1 &&
    matchesPinnedAsset(runtime.assets?.transformers_js, RUNTIME_ASSETS.transformers_js) &&
    matchesPinnedAsset(runtime.assets?.ort_wasm_module, RUNTIME_ASSETS.ort_wasm_module) &&
    matchesPinnedAsset(runtime.assets?.ort_wasm_binary, RUNTIME_ASSETS.ort_wasm_binary) &&
    vision?.repository === MODEL_REPOSITORY &&
    vision.revision === MODEL_REVISION &&
    vision.model_file_name === MODEL_FILE_NAME &&
    vision.file === MODEL_ASSET_FILE &&
    vision.dtype === "q4" &&
    vision.bytes === MODEL_BYTES &&
    vision.sha256 === MODEL_SHA256 && isSha256(vision.sha256) &&
    vision.base_model === BASE_MODEL &&
    vision.base_model_revision === BASE_MODEL_REVISION &&
    vision.file === `onnx/${vision.model_file_name}_${vision.dtype}.onnx` &&
    isSameOriginAsset(text?.manifest_url, TEXT_MANIFEST_URL) &&
    isSameOriginAsset(text?.vectors_url, TEXT_VECTORS_URL) &&
    text.manifest_sha256 === TEXT_MANIFEST_SHA256 && isSha256(text.manifest_sha256) &&
    text.vectors_sha256 === TEXT_VECTORS_SHA256 && isSha256(text.vectors_sha256) &&
    typeof acceptance?.score_notice === "string" && acceptance.score_notice.length > 0;
  if (!valid) throw fixedError("invalid_policy");
  return policy;
}

// Always re-read the small release policy with no-store. Turning a flag off on
// the server must take effect without a stale in-memory or HTTP cached response.
async function loadPolicy(fetcher = fetch) {
  try {
    const response = await fetcher(SIGLIP_POLICY_URL, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw fixedError("policy_unavailable");
    return validateSiglipPolicy(await response.json());
  } catch (error) {
    throw error?.code ? error : fixedError("policy_unavailable");
  }
}

export async function siglipClassifierAvailability(fetcher = fetch, { hostname = globalThis.location?.hostname } = {}) {
  try {
    const policy = await loadPolicy(fetcher);
    const enabled = canRunSiglipPolicy(policy, hostname);
    return {
      enabled,
      ...(enabled && policy.experimental_preview ? { experimental: true } : {}),
      reason: enabled ? "" : "recognition_paused",
      message: enabled ? "" : FIXED_MESSAGES.recognition_paused,
    };
  } catch (error) {
    return {
      enabled: false,
      reason: error?.code || "policy_unavailable",
      message: friendlySiglipError(error),
    };
  }
}

async function digestHex(buffer) {
  if (!globalThis.crypto?.subtle) throw fixedError("runtime_unavailable");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function assertLittleEndian() {
  const bytes = new Uint8Array(new Uint16Array([1]).buffer);
  if (bytes[0] !== 1) throw fixedError("runtime_unavailable");
}

function equalArray(left, right) {
  return Array.isArray(left) && left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function readUint32BigEndian(bytes, offset) {
  return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function readUint32LittleEndian(bytes, offset) {
  return (bytes[offset] + (bytes[offset + 1] << 8) +
    (bytes[offset + 2] << 16) + (bytes[offset + 3] * 0x1000000)) >>> 0;
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function pngDimensions(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 45 || !signature.every((value, index) => bytes[index] === value)) return null;
  let offset = 8;
  let dimensions;
  let sawImageData = false;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BigEndian(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (end > bytes.length) return null;
    if (!dimensions) {
      if (type !== "IHDR" || length !== 13) return null;
      dimensions = {
        format: "image/png",
        width: readUint32BigEndian(bytes, offset + 8),
        height: readUint32BigEndian(bytes, offset + 12),
      };
    }
    if (type === "IDAT") sawImageData = true;
    if (type === "IEND") return length === 0 && sawImageData ? dimensions : null;
    offset = end;
  }
  return null;
}

function jpegDimensions(bytes) {
  if (bytes.length < 11 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    if (startOfFrame.has(marker)) {
      if (length < 8) return null;
      return {
        format: "image/jpeg",
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
      };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes) {
  if (bytes.length < 25 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  const containerBytes = readUint32LittleEndian(bytes, 4) + 8;
  const chunkSize = readUint32LittleEndian(bytes, 16);
  if (containerBytes > bytes.length || 20 + chunkSize > containerBytes) return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X" && chunkSize >= 10 && bytes.length >= 30) {
    return {
      format: "image/webp",
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }
  if (chunk === "VP8 " && chunkSize >= 10 && bytes.length >= 30 &&
      bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      format: "image/webp",
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  if (chunk === "VP8L" && chunkSize >= 5 && bytes.length >= 25 && bytes[20] === 0x2f) {
    const packed = readUint32LittleEndian(bytes, 21);
    return {
      format: "image/webp",
      width: 1 + (packed & 0x3fff),
      height: 1 + ((packed >>> 14) & 0x3fff),
    };
  }
  return null;
}

// Inspect the actual bytes before importing the 92 MB runtime. Browser MIME is
// user-controlled metadata, while header dimensions bound decode-time memory.
export async function validateSiglipPhotoContent(file) {
  if (typeof file?.arrayBuffer !== "function") throw fixedError("invalid_image_content");
  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw fixedError("invalid_image_content");
  }
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== file.size) {
    throw fixedError("invalid_image_content");
  }
  const bytes = new Uint8Array(buffer);
  const dimensions = pngDimensions(bytes) || jpegDimensions(bytes) || webpDimensions(bytes);
  if (!dimensions || dimensions.format !== file.type ||
      !Number.isSafeInteger(dimensions.width) || dimensions.width <= 0 ||
      !Number.isSafeInteger(dimensions.height) || dimensions.height <= 0) {
    throw fixedError("invalid_image_content");
  }
  if (dimensions.width > MAX_IMAGE_PIXELS / dimensions.height) {
    throw fixedError("excessive_image_dimensions");
  }
  return { ...dimensions, pixels: dimensions.width * dimensions.height };
}

// Validate every field that determines how text rows map to appliance classes.
// This catches a validly hashed but incompatible export before it can be scored.
export function validateSiglipTextManifest(manifest, policy) {
  const valid = manifest && typeof manifest === "object" &&
    manifest.artifact === "fixforward-siglip2-text-embeddings-v1" &&
    manifest.model === policy.vision_model.base_model &&
    manifest.resolved_revision === policy.vision_model.base_model_revision &&
    manifest.dtype === "float32-little-endian" &&
    equalArray(manifest.shape, [TEXT_ROWS, TEXT_COLUMNS]) &&
    manifest.class_count === APPLIANCE_CLASSES.length &&
    equalArray(manifest.labels, EXPECTED_LABELS) &&
    Array.isArray(manifest.prompts) && manifest.prompts.length === TEXT_ROWS &&
    manifest.prompts.every((prompt) => typeof prompt === "string" && prompt.trim().length > 0) &&
    manifest.vectors_file === "text-embeddings.f32" &&
    manifest.vectors_sha256 === policy.text_embeddings.vectors_sha256;
  if (!valid) throw fixedError("vectors_unavailable");
  return manifest;
}

function assertUnitTextVectors(data, rows, columns) {
  for (let row = 0; row < rows; row += 1) {
    let squaredNorm = 0;
    const offset = row * columns;
    for (let column = 0; column < columns; column += 1) {
      const value = data[offset + column];
      if (!Number.isFinite(value)) throw fixedError("vectors_unavailable");
      squaredNorm += value * value;
    }
    // Exported SigLIP text embeddings are unit normalised for cosine scoring.
    if (Math.abs(Math.sqrt(squaredNorm) - 1) > 0.001) throw fixedError("vectors_unavailable");
  }
}

async function loadTextVectors(policy, fetcher = fetch) {
  const cacheKey = [
    policy.text_embeddings.manifest_sha256,
    policy.text_embeddings.vectors_sha256,
    policy.vision_model.base_model_revision,
  ].join(":");
  if (vectorCache?.key !== cacheKey) {
    const promise = (async () => {
      const fetchOptions = { cache: "no-store", credentials: "same-origin" };
      const [manifestResponse, vectorsResponse] = await Promise.all([
        fetcher(policy.text_embeddings.manifest_url, fetchOptions),
        fetcher(policy.text_embeddings.vectors_url, fetchOptions),
      ]);
      if (!manifestResponse.ok || !vectorsResponse.ok) throw fixedError("vectors_unavailable");
      const [manifestBuffer, vectorsBuffer] = await Promise.all([
        manifestResponse.arrayBuffer(), vectorsResponse.arrayBuffer(),
      ]);
      const [manifestDigest, vectorsDigest] = await Promise.all([
        digestHex(manifestBuffer), digestHex(vectorsBuffer),
      ]);
      if (manifestDigest !== policy.text_embeddings.manifest_sha256 ||
          vectorsDigest !== policy.text_embeddings.vectors_sha256) {
        throw fixedError("vectors_unavailable");
      }
      let manifest;
      try {
        manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBuffer));
      } catch {
        throw fixedError("vectors_unavailable");
      }
      validateSiglipTextManifest(manifest, policy);
      const [rows, columns] = manifest.shape;
      if (vectorsBuffer.byteLength !== rows * columns * Float32Array.BYTES_PER_ELEMENT) {
        throw fixedError("vectors_unavailable");
      }
      assertLittleEndian();
      const data = new Float32Array(vectorsBuffer);
      assertUnitTextVectors(data, rows, columns);
      return { labels: manifest.labels, classCount: manifest.class_count, rows, columns, data };
    })().catch((error) => {
      if (vectorCache?.key === cacheKey) vectorCache = null;
      throw error?.code ? error : fixedError("vectors_unavailable");
    });
    vectorCache = { key: cacheKey, promise };
  }
  return vectorCache.promise;
}

async function loadRuntime(importer = (url) => import(url)) {
  if (!runtimePromise) {
    runtimePromise = importer(TRANSFORMERS_JS_URL).then((runtime) => {
      if (!runtime?.env || !runtime?.AutoProcessor || !runtime?.SiglipVisionModel || !runtime?.RawImage) {
        throw fixedError("runtime_unavailable");
      }
      // Disable every remote-model path before any from_pretrained call. One
      // WASM thread avoids SharedArrayBuffer/cross-origin-isolation requirements.
      runtime.env.allowRemoteModels = false;
      runtime.env.allowLocalModels = true;
      runtime.env.localModelPath = LOCAL_MODEL_PATH;
      runtime.env.useBrowserCache = true;
      const wasm = runtime.env.backends?.onnx?.wasm;
      if (!wasm) throw fixedError("runtime_unavailable");
      wasm.wasmPaths = TRANSFORMERS_WASM_PATH;
      wasm.numThreads = 1;
      wasm.proxy = false;
      return runtime;
    }).catch((error) => {
      runtimePromise = null;
      throw error?.code ? error : fixedError("runtime_unavailable");
    });
  }
  return runtimePromise;
}

async function loadVisionModel(runtime, policy, onProgress) {
  const cacheKey = `${policy.vision_model.repository}:${policy.vision_model.file}:${policy.vision_model.sha256}`;
  if (modelCache?.key !== cacheKey) {
    // model_file_name is a local content-addressed base. Transformers.js adds
    // the evaluated `_q4.onnx` suffix selected by dtype; remote fallback is off.
    const common = {
      local_files_only: true,
      progress_callback: onProgress,
    };
    const promise = Promise.all([
      runtime.AutoProcessor.from_pretrained(policy.vision_model.repository, common),
      runtime.SiglipVisionModel.from_pretrained(policy.vision_model.repository, {
        ...common,
        dtype: policy.vision_model.dtype,
        model_file_name: policy.vision_model.model_file_name,
      }),
    ]).then(([processor, model]) => ({ processor, model })).catch((error) => {
      if (modelCache?.key === cacheKey) modelCache = null;
      throw error?.code ? error : fixedError("runtime_unavailable");
    });
    modelCache = { key: cacheKey, promise };
  }
  return modelCache.promise;
}

function cosineScores(imageVector, vectors) {
  if (!imageVector || imageVector.length !== vectors.columns) throw fixedError("invalid_result");
  let squaredNorm = 0;
  for (const value of imageVector) {
    if (!Number.isFinite(value)) throw fixedError("invalid_result");
    squaredNorm += value * value;
  }
  const norm = Math.sqrt(squaredNorm);
  if (!Number.isFinite(norm) || norm === 0) throw fixedError("invalid_result");
  return Array.from({ length: vectors.rows }, (_, row) => {
    let dot = 0;
    const offset = row * vectors.columns;
    for (let column = 0; column < vectors.columns; column += 1) {
      dot += (imageVector[column] / norm) * vectors.data[offset + column];
    }
    return dot;
  });
}

// Pure scoring is exported so tests can prove the two-margin rejection rule
// without downloading a model or pretending synthetic vectors test accuracy.
export function suggestionFromSiglipScores(scores, vectors, policy) {
  if (!Array.isArray(scores) || scores.length !== vectors.rows ||
      scores.some((value) => !Number.isFinite(value))) {
    throw fixedError("invalid_result");
  }
  const ranked = scores.map((score, index) => ({ score, index, label: vectors.labels[index] }))
    .sort((left, right) => right.score - left.score);
  const positives = ranked.filter(({ index }) => index < vectors.classCount);
  const ood = ranked.filter(({ index }) => index >= vectors.classCount);
  if (positives.length < 2 || ood.length < 1) throw fixedError("invalid_result");
  const oodMargin = positives[0].score - ood[0].score;
  const positiveMargin = positives[0].score - positives[1].score;
  // Score all supported prompts, then gate the actual winner. Never replace a
  // disabled winner with a lower-ranked enabled class because that mislabels it.
  const winner = positives[0].label;
  const classEnabled = policy.enabled_classes.includes(winner);
  let passesMargins = false;
  if (classEnabled) {
    // Version 2 deliberately has no generic fallback. The winning enabled class
    // must have its own frozen pair, while disabled/manual-only winners stop here.
    const thresholds = policy.policy_version === 2
      ? policy.acceptance?.class_thresholds?.[winner]
      : policy.acceptance;
    if (!thresholds || !Number.isFinite(thresholds.min_ood_margin) ||
        !Number.isFinite(thresholds.min_positive_margin)) {
      throw fixedError("invalid_policy");
    }
    passesMargins = oodMargin >= thresholds.min_ood_margin &&
      positiveMargin >= thresholds.min_positive_margin;
  }
  const accepted = passesMargins && classEnabled;
  const alternatives = positives.slice(0, 3).map(({ label, score }) => {
    const appliance = APPLIANCE_CLASSES.find(({ slug }) => slug === label);
    if (!appliance) throw fixedError("invalid_result");
    return { ...appliance, similarity: score };
  });
  return {
    accepted,
    requiresConfirmation: accepted,
    alternatives,
    reason: accepted ? "needs_confirmation" : classEnabled ? "uncertain" : "class_disabled",
    margins: { ood: oodMargin, positive: positiveMargin },
    scoreNotice: policy.acceptance.score_notice,
  };
}

function serializeInference(task) {
  const run = inferenceTail.then(task, task);
  // Keep the queue usable after one failed inference while preserving the
  // caller's rejection on `run`.
  inferenceTail = run.catch(() => undefined);
  return run;
}

// Release the cached ONNX session only after every already-queued inference has
// finished. A later request will build a fresh session instead of racing a dispose.
export function releaseSiglipModelSession() {
  return serializeInference(async () => {
    const cached = modelCache;
    if (!cached) return;
    modelCache = null;
    try {
      const { model } = await cached.promise;
      if (typeof model?.dispose === "function") await model.dispose();
    } catch {
      // Cleanup is best-effort and runs after the screen is gone. It must not
      // surface model internals or make the ordinary manual journey fail.
    }
  });
}

export async function classifyWithSiglipCandidate(file, {
  fetcher = fetch,
  importer,
  onProgress = () => {},
  signal,
  hostname = globalThis.location?.hostname,
} = {}) {
  const validation = validatePhotoFile(file);
  if (!validation.ok) throw fixedError("prediction_failed");
  // Queue before the first asynchronous policy fetch. Cleanup requested by a
  // route change is then guaranteed to run after this request, even if the
  // request is still inspecting the file or loading its first model session.
  return serializeInference(async () => {
    try {
      assertNotAborted(signal);
      const policy = await loadPolicy(fetcher);
      assertNotAborted(signal);
      if (!canRunSiglipPolicy(policy, hostname)) {
        return { accepted: false, requiresConfirmation: false, alternatives: [], reason: "recognition_paused", message: FIXED_MESSAGES.recognition_paused };
      }
      // Reject spoofed or decode-bomb-like files before importing the runtime,
      // fetching vectors or constructing a model session.
      await validateSiglipPhotoContent(file);
      assertNotAborted(signal);
      const [vectors, runtime] = await Promise.all([
        loadTextVectors(policy, fetcher),
        loadRuntime(importer),
      ]);
      assertNotAborted(signal);
      const { processor, model } = await loadVisionModel(runtime, policy, (event) => {
        if (!signal?.aborted) onProgress(event);
      });
      assertNotAborted(signal);
      const image = await runtime.RawImage.read(file);
      assertNotAborted(signal);
      const output = await model(await processor(image));
      assertNotAborted(signal);
      const tensor = output?.pooler_output;
      if (tensor?.dims?.[0] !== 1 || tensor.dims.at(-1) !== vectors.columns) {
        throw fixedError("invalid_result");
      }
      // Re-read the no-store kill switch after a potentially long first model
      // load. A policy revoked during download or inference cannot show a result.
      const latestPolicy = await loadPolicy(fetcher);
      assertNotAborted(signal);
      if (!canRunSiglipPolicy(latestPolicy, hostname)) {
        return { accepted: false, requiresConfirmation: false, alternatives: [], reason: "recognition_paused", message: FIXED_MESSAGES.recognition_paused };
      }
      return suggestionFromSiglipScores(cosineScores(tensor.data, vectors), vectors, policy);
    } catch (error) {
      if (error?.code) throw error;
      throw fixedError("prediction_failed");
    }
  });
}

export function resetSiglipCandidateForTests() {
  vectorCache = null;
  runtimePromise = null;
  modelCache = null;
  inferenceTail = Promise.resolve();
}
