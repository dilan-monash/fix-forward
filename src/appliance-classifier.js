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
  if (!globalThis.tf?.loadLayersModel) {
    throw new Error("Photo recognition is unavailable right now. Choose the appliance manually.");
  }
  return globalThis.tf;
}

function loadModel() {
  const tf = requireTensorFlow();

  if (!modelPromise) {
    modelPromise = tf.loadGraphModel(MODEL_URL).catch((error) => {
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

function calculateBlurScore(image) {
  const size = 512;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", {
    willReadFrequently: true
  });

  if (!context) return null;

  context.drawImage(
    image,
    0,
    0,
    size,
    size
  );

  const imageData = context.getImageData(
    0,
    0,
    size,
    size
  );

  const pixels = imageData.data;
  const gray = new Float32Array(size * size);

  for (let i = 0; i < size * size; i += 1) {
    const offset = i * 4;

    gray[i] =
      0.299 * pixels[offset] +
      0.587 * pixels[offset + 1] +
      0.114 * pixels[offset + 2];
  }

  const values = [];

  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const index = y * size + x;

      const value =
        gray[index - size] +
        gray[index + size] +
        gray[index - 1] +
        gray[index + 1] -
        4 * gray[index];

      values.push(value);
    }
  }

  const mean =
    values.reduce((sum, value) => sum + value, 0) /
    values.length;

  const variance =
    values.reduce(
      (sum, value) =>
        sum + Math.pow(value - mean, 2),
      0
    ) / values.length;

  return variance;
}

export async function classifyAppliancePhoto(file) {
  const validation = validatePhotoFile(file);
  if (!validation.ok) throw new Error(validation.error);
  const tf = requireTensorFlow();
  // CPU is slower, but avoids backend-specific operator differences across
  // browsers and keeps this safety-oriented suggestion deterministic.
  if (tf.findBackend?.("cpu")) await tf.setBackend("cpu");
  await tf.ready();
  let model;
let image;
let manifest;

try {
  model = await loadModel();
} catch (error) {
  console.error("RAW MODEL LOAD ERROR:", error);
  console.error("ERROR NAME:", error?.name);
  console.error("ERROR MESSAGE:", error?.message);
  console.error("ERROR STACK:", error?.stack);
  console.error("ERROR CAUSE:", error?.cause);

  const details = error && typeof error === "object"
    ? Object.getOwnPropertyNames(error)
        .map((key) => `${key}=${String(error[key])}`)
        .join(" | ")
    : String(error);

  throw new Error(`MODEL LOAD FAILED: ${details}`);
}

try {
  image = await readImage(file);
} catch (error) {
  throw new Error(`IMAGE READ FAILED: ${error?.message || String(error)}`);
}

manifest = await loadManifest();
  const expected = APPLIANCE_CLASSES.map(({ slug }) => slug);
  if (manifest?.class_order && JSON.stringify(manifest.class_order) !== JSON.stringify(expected)) {
    throw new Error("The appliance model does not match this website.");
  }
  const calibration = manifest?.metrics?.calibration || {};

const minConfidence =
  Number(calibration.min_confidence) || 0.68;

const blurThreshold =
  Number(calibration.blur_threshold) || 57.233463287353516;

const blurScore = calculateBlurScore(image);

if (
  blurScore !== null &&
  blurThreshold > 0 &&
  blurScore < blurThreshold
) {
  return {
    accepted: false,
    confidence: 0,
    alternatives: [],
    reason: "blurry_or_unclear",
  };
}
  const input = tf.browser.fromPixels(image, 3).resizeBilinear([224, 224], false).toFloat().expandDims(0);
  let output;
  try {
     try {
      output = model.predict(input);
     } catch (error) {
     throw new Error(`PREDICTION FAILED: ${error?.message || String(error)}`);
  }
    if (Array.isArray(output)) [output] = output;
    const scores = Array.from(await output.data());
    if (scores.length !== APPLIANCE_CLASSES.length) throw new Error("The appliance model returned an invalid result.");
    const top = scores.map((score, index) => ({ ...APPLIANCE_CLASSES[index], score: Number(score) }))
      .sort((left, right) => right.score - left.score).slice(0, 3);
    return {
      accepted:
       top[0].score >= minConfidence &&
       blurScore >= blurThreshold,
      confidence: top[0].score,
      alternatives: top,
      thresholds: {
      minConfidence,
      blurThreshold,
    },
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
