/*
 * Browser-local appliance recognition for the adult flow.
 * The image is decoded and classified in this tab; it is never sent to Flask.
 */

export const MODEL_URL = "/model/appliance-classifier/model.json";
export const MANIFEST_URL = "/model/appliance-classifier/model_manifest.json";
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_PHOTO_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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

let modelPromise;
let manifestPromise;

export function validatePhotoFile(file) {
  if (!file || typeof file !== "object") return { ok: false, error: "Choose an appliance photo first." };
  if (!SUPPORTED_PHOTO_TYPES.includes(file.type)) return { ok: false, error: "Use a JPG, PNG, or WebP image." };
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: "The selected image is empty or unreadable." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "The image must be 10 MB or smaller." };
  return { ok: true, error: "" };
}

function applianceForSlug(slug) {
  const index = APPLIANCE_CLASSES.findIndex(({ slug: candidate }) => candidate === slug);
  return index < 0 ? null : { ...APPLIANCE_CLASSES[index], index };
}

function requireTensorFlow() {
  if (!globalThis.tf?.loadGraphModel && !globalThis.tf?.loadLayersModel) {
    throw new Error("Photo recognition is unavailable right now. Choose the appliance manually.");
  }
  return globalThis.tf;
}

function loadModel() {
  const tf = requireTensorFlow();
  if (!modelPromise) {
    const load = tf.loadGraphModel || tf.loadLayersModel;
    modelPromise = load.call(tf, MODEL_URL).catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null);
  }
  return manifestPromise;
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The selected image format could not be decoded."));
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function classifyAppliancePhoto(file) {
  const validation = validatePhotoFile(file);
  if (!validation.ok) throw new Error(validation.error);
  const tf = requireTensorFlow();
  // CPU is slower, but avoids backend-specific operator differences across
  // browsers and keeps this safety-oriented suggestion deterministic.
  if (tf.findBackend?.("cpu")) await tf.setBackend("cpu");
  await tf.ready();
  const [model, image, manifest] = await Promise.all([loadModel(), readImage(file), loadManifest()]);
  const expected = APPLIANCE_CLASSES.map(({ slug }) => slug);
  if (manifest?.class_order && JSON.stringify(manifest.class_order) !== JSON.stringify(expected)) {
    throw new Error("The appliance model does not match this website.");
  }
  const calibration = manifest?.metrics?.calibration || {};
  const minConfidence = Number(calibration.min_confidence) || 0.72;
  const minMargin = Number(calibration.min_margin) || 0.12;
  const input = tf.browser.fromPixels(image, 3).resizeBilinear([224, 224], true).toFloat().expandDims(0);
  let output;
  try {
    output = model.predict(input);
    if (Array.isArray(output)) [output] = output;
    const scores = Array.from(await output.data());
    if (scores.length !== APPLIANCE_CLASSES.length) throw new Error("The appliance model returned an invalid result.");
    const top = scores.map((score, index) => ({ ...APPLIANCE_CLASSES[index], score: Number(score) }))
      .sort((left, right) => right.score - left.score).slice(0, 3);
    const margin = top[0].score - top[1].score;
    return {
      accepted: top[0].score >= minConfidence && margin >= minMargin,
      confidence: top[0].score,
      margin,
      alternatives: top,
      thresholds: { minConfidence, minMargin },
    };
  } finally {
    input.dispose();
    if (output && typeof output.dispose === "function") output.dispose();
  }
}

export function resetLoadedModelForTests() {
  modelPromise = null;
  manifestPromise = null;
}

export function friendlyRecognitionError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("_fusedhardswish") || message.includes("hard-swish")) {
    return "This browser cannot run the current model yet. Choose the appliance manually while we prepare a compatible model.";
  }
  if (message.includes("Failed to fetch") || message.includes("fetch")) {
    return "The appliance model could not be loaded. Refresh the page or choose the appliance manually.";
  }
  return message || "Photo recognition could not be completed. Choose the appliance manually.";
}

export { applianceForSlug };
