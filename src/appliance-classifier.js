/*
 * Browser-local appliance suggestions for the adult flow.
 * Scores are not proof of identity or safety. Suggestions need confirmation;
 * unapproved models stay paused even when TensorFlow is available.
 */
export const MODEL_URL = "/model/appliance-classifier/model.json";
export const MANIFEST_URL = "/model/appliance-classifier/model_manifest.json";
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_PHOTO_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);

// Preserve exported class order: changing it would relabel the model outputs.
export const APPLIANCE_CLASSES = Object.freeze([
  ["air_fryer", "Air fryer"], ["blender", "Blender"], ["coffee_machine", "Coffee machine"],
  ["dehumidifier", "Dehumidifier"], ["fan", "Fan"], ["food_processor", "Food processor"],
  ["hair_dryer", "Hair dryer"], ["kettle", "Kettle"], ["microwave", "Microwave"],
  ["mixer", "Mixer"], ["portable_ac", "Portable air conditioner"],
  ["portable_heater", "Portable heater"], ["rice_cooker", "Rice cooker"],
  ["sandwich_press", "Sandwich press"], ["shaver", "Shaver"],
  ["steam_cleaner", "Steam cleaner"], ["straightener", "Straightener"],
  ["toaster", "Toaster"], ["vaccum_cleaner", "Vacuum cleaner"],
].map(([slug, label]) => Object.freeze({ slug, label, category: label })));

const MESSAGES = Object.freeze({
  recognition_paused: "Photo suggestions are paused while we check their accuracy. Choose your appliance manually below.",
  manifest_unavailable: "Photo suggestions could not be loaded. Choose your appliance manually below.",
  invalid_manifest: "Photo suggestions are unavailable for this version. Choose your appliance manually below.",
  runtime_unavailable: "This browser cannot run the current model yet. Choose your appliance manually below.",
  model_unavailable: "The appliance model could not be loaded. Choose your appliance manually below.",
  image_unreadable: "This image could not be read. Try another photo or choose your appliance manually below.",
  image_quality_unavailable: "This photo could not be checked. Choose your appliance manually below.",
  invalid_result: "The photo result could not be checked. Choose your appliance manually below.",
  prediction_failed: "Photo recognition could not be completed. Choose your appliance manually below.",
  invalid_photo: "Choose a JPG, PNG or WebP image up to 10 MB, or choose your appliance manually below.",
});
let modelPromise;
let manifestPromise;

// Only fixed messages leave this module; raw exceptions can contain internal paths.
function recognitionError(code) {
  const error = new Error(MESSAGES[code] || MESSAGES.prediction_failed);
  error.code = code;
  return error;
}

// An unknown exception must never turn into user-facing debugging information.
export function friendlyRecognitionError(error) {
  return Object.hasOwn(MESSAGES, error?.code) ? MESSAGES[error.code] : MESSAGES.prediction_failed;
}

// Reject empty, unsupported or oversized uploads before image decoding.
export function validatePhotoFile(file) {
  if (!file || typeof file !== "object") return { ok: false, error: "Choose an appliance photo first." };
  if (!SUPPORTED_PHOTO_TYPES.includes(file.type)) return { ok: false, error: "Use a JPG, PNG, or WebP image." };
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: "The selected image is empty or unreadable." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "The image must be 10 MB or smaller." };
  return { ok: true, error: "" };
}

// Translate a trained label into the adult site's category vocabulary.
export function applianceForSlug(slug) {
  const index = APPLIANCE_CLASSES.findIndex(({ slug: candidate }) => candidate === slug);
  return index < 0 ? null : { ...APPLIANCE_CLASSES[index], index };
}

// Do not replace missing metadata with guessed thresholds. A missing activation
// flag defaults to paused; malformed labels, shapes or thresholds cannot run.
function validateManifest(manifest) {
  const calibration = manifest?.metrics?.calibration;
  const expected = APPLIANCE_CLASSES.map(({ slug }) => slug);
  if (!manifest || typeof manifest !== "object" ||
      JSON.stringify(manifest.input_shape) !== JSON.stringify([224, 224, 3]) ||
      JSON.stringify(manifest.class_order) !== JSON.stringify(expected) ||
      !Number.isFinite(calibration?.min_confidence) || calibration.min_confidence <= 0 || calibration.min_confidence > 1 ||
      !Number.isFinite(calibration?.blur_threshold) || calibration.blur_threshold < 0 ||
      (manifest.recognition_enabled !== undefined && typeof manifest.recognition_enabled !== "boolean")) {
    throw recognitionError("invalid_manifest");
  }
  return manifest;
}

// Load only the small policy manifest first. A paused model never downloads weights.
function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      let manifest;
      try {
        const response = await fetch(MANIFEST_URL, { credentials: "same-origin", headers: { Accept: "application/json" } });
        if (!response.ok) throw recognitionError("manifest_unavailable");
        manifest = await response.json();
      } catch {
        throw recognitionError("manifest_unavailable");
      }
      return validateManifest(manifest);
    })().catch((error) => {
      manifestPromise = null; // Permit recovery on the next attempt.
      throw error;
    });
  }
  return manifestPromise;
}

// The UI can check policy without requiring TensorFlow or reading a photo.
export async function classifierAvailability() {
  try {
    const manifest = await loadManifest();
    const enabled = manifest.recognition_enabled === true;
    return { enabled, reason: enabled ? "" : "recognition_paused", message: enabled ? "" : MESSAGES.recognition_paused };
  } catch (error) {
    return { enabled: false, reason: error.code || "manifest_unavailable", message: friendlyRecognitionError(error) };
  }
}

// The exported assets are a graph model, not a layers model.
function requireTensorFlow() {
  const tf = globalThis.tf;
  if (typeof tf?.loadGraphModel !== "function" || typeof tf?.tidy !== "function" ||
      typeof tf?.browser?.fromPixels !== "function" || typeof tf?.ready !== "function") {
    throw recognitionError("runtime_unavailable");
  }
  return tf;
}

// Reuse successfully loaded weights; a failed download remains retryable.
function loadModel(tf) {
  if (!modelPromise) {
    modelPromise = Promise.resolve().then(() => tf.loadGraphModel(MODEL_URL)).catch(() => {
      modelPromise = null;
      throw recognitionError("model_unavailable");
    });
  }
  return modelPromise;
}

// Decode locally; neither the photo nor its pixels are sent to Flask.
function readImage(file) {
  return new Promise((resolve, reject) => {
    const fail = () => reject(recognitionError("image_unreadable"));
    try {
      const reader = new FileReader();
      reader.onerror = fail;
      reader.onload = () => {
        try {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = fail;
          image.src = String(reader.result);
        } catch { fail(); }
      };
      reader.readAsDataURL(file);
    } catch { fail(); }
  });
}

// Sharpness is NOT an appliance detector: random noise can pass this check.
// Keep the model paused until separate accuracy and non-appliance evaluation.
function calculateBlurScore(image) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw recognitionError("image_quality_unavailable");
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  const gray = new Float32Array(size * size);
  for (let i = 0; i < gray.length; i += 1) {
    gray[i] = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
  }
  let sum = 0;
  let squaredSum = 0;
  let count = 0;
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const index = y * size + x;
      const value = gray[index - size] + gray[index + size] + gray[index - 1] + gray[index + 1] - 4 * gray[index];
      sum += value;
      squaredSum += value * value;
      count += 1;
    }
  }
  return Math.max(0, squaredSum / count - (sum / count) ** 2);
}

// Reject corrupt output instead of converting it into a category by coercion.
function validateScores(scores) {
  if (scores.length !== APPLIANCE_CLASSES.length ||
      scores.some((score) => !Number.isFinite(score) || score < 0 || score > 1) ||
      Math.abs(scores.reduce((sum, score) => sum + score, 0) - 1) > 0.001) {
    throw recognitionError("invalid_result");
  }
}

// A shared empty result keeps every unavailable path out of confirmation UI.
function noSuggestion(reason, message = "") {
  return { accepted: false, requiresConfirmation: false, confidence: 0, alternatives: [], reason, message };
}

// Dispose every returned tensor, including unexpected multi-output containers.
// Report cleanup failures with the same fixed message as other runtime failures.
function disposeTensors(input, output) {
  const seen = new Set();
  let failed = false;
  const visit = (value) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (typeof value.dispose === "function") {
      try { value.dispose(); } catch { failed = true; }
    } else {
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(input);
  visit(output);
  if (failed) throw recognitionError("prediction_failed");
}

// "accepted" only means suitable to SHOW for review. It never confirms identity.
// The UI must wait for the user to confirm before changing their chosen appliance.
export async function classifyAppliancePhoto(file) {
  const availability = await classifierAvailability();
  if (!availability.enabled) return noSuggestion(availability.reason, availability.message);
  const validation = validatePhotoFile(file);
  if (!validation.ok) throw recognitionError("invalid_photo");
  const manifest = await loadManifest();
  const { min_confidence: minConfidence, blur_threshold: blurThreshold } = manifest.metrics.calibration;
  const image = await readImage(file);
  let blurScore;
  try { blurScore = calculateBlurScore(image); }
  catch { throw recognitionError("image_quality_unavailable"); }
  if (!Number.isFinite(blurScore)) throw recognitionError("image_quality_unavailable");
  if (blurScore < blurThreshold) return noSuggestion("blurry_or_unclear");

  const tf = requireTensorFlow();
  try {
    if (tf.findBackend?.("cpu")) await tf.setBackend("cpu");
    await tf.ready();
  } catch { throw recognitionError("runtime_unavailable"); }
  const model = await loadModel(tf);
  let input;
  let output;
  try {
    // The graph rescales pixels internally. tidy releases resize/cast intermediates.
    input = tf.tidy(() => tf.browser.fromPixels(image, 3).resizeBilinear([224, 224], false).toFloat().expandDims(0));
    output = model.predict(input);
    const tensor = Array.isArray(output) && output.length === 1 ? output[0] : output;
    if (typeof tensor?.data !== "function") throw recognitionError("invalid_result");
    const scores = Array.from(await tensor.data());
    validateScores(scores);
    const alternatives = scores.map((score, index) => ({ ...APPLIANCE_CLASSES[index], score }))
      .sort((left, right) => right.score - left.score).slice(0, 3);
    const accepted = alternatives[0].score >= minConfidence;
    return { accepted, requiresConfirmation: accepted, confidence: alternatives[0].score,
      alternatives, reason: accepted ? "needs_confirmation" : "uncertain",
      thresholds: { minConfidence, blurThreshold } };
  } catch (error) {
    if (error?.code === "invalid_result") throw error;
    throw recognitionError("prediction_failed");
  } finally {
    // Cleanup runs for successful predictions and failed output validation alike.
    disposeTensors(input, output);
  }
}

// Tests replace browser APIs and must not inherit the previous model or policy.
export function resetLoadedModelForTests() {
  modelPromise = null;
  manifestPromise = null;
}
