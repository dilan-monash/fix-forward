#!/usr/bin/env node
/**
 * Run the exported appliance model against deterministic, non-appliance images.
 * These are real TensorFlow.js CPU predictions, not mocked scores. This diagnostic
 * bypasses the application's pause flag so developers can investigate the model;
 * it never enables recognition or edits weights. Synthetic rejection checks do
 * not measure accuracy on real appliances or reproduce an unavailable user photo.
 *
 * Install @tensorflow/tfjs@4.22.0 into a separate temporary directory, then run:
 * node scripts/evaluate-appliance-model.mjs --tfjs-dir <temporary-directory>
 *   --output docs/appliance-model-synthetic-evaluation.json
 * Use --model-dir <directory> to compare another exported artifact without
 * replacing the application's model files.
 * Add --assert-rejection to return exit code 2 if the previous gate would accept
 * any synthetic non-appliance. No application/server/database is started.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultModelDirectory = path.join(repository, 'model', 'appliance-classifier');
const sourceSize = 512;

/** Parse only the documented switches; an accidental path must not be ignored. */
function parseArguments(args) {
  const options = { assertRejection: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--assert-rejection') options.assertRejection = true;
    else if (argument === '--tfjs-dir' || argument === '--output' || argument === '--model-dir') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
      const key = argument === '--tfjs-dir' ? 'tfjsDirectory'
        : argument === '--model-dir' ? 'modelDirectory' : 'output';
      options[key] = path.resolve(value);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

/** Fingerprint the actual artifact bytes so a later run can identify changed weights. */
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Load local shards through TF.js's documented IOHandler, without a web server. */
async function loadLocalGraph(tf, modelDirectory) {
  const jsonBytes = await readFile(path.join(modelDirectory, 'model.json'));
  const description = JSON.parse(jsonBytes);
  const weightSpecs = [];
  const buffers = [];
  const artifacts = [{ file: 'model.json', sha256: sha256(jsonBytes) }];
  for (const group of description.weightsManifest) {
    weightSpecs.push(...group.weights);
    for (const shard of group.paths) {
      const shardPath = path.resolve(modelDirectory, shard);
      if (!shardPath.startsWith(`${modelDirectory}${path.sep}`)) {
        throw new Error('A weight shard path leaves the model directory.');
      }
      const bytes = await readFile(shardPath);
      buffers.push(bytes);
      artifacts.push({ file: shard, sha256: sha256(bytes) });
    }
  }
  const joined = Buffer.concat(buffers);
  const weightData = joined.buffer.slice(joined.byteOffset, joined.byteOffset + joined.byteLength);
  const model = await tf.loadGraphModel({
    load: async () => ({ ...description, weightSpecs, weightData }),
  });
  return { model, artifacts, description };
}

/** An integer generator makes every synthetic pixel repeatable across machines. */
function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0;
    return value >>> 24;
  };
}

/** Build RGB pixels, avoiding canvas, image decoders, external photos or personal data. */
function makePixels(pixelAt) {
  const pixels = new Uint8Array(sourceSize * sourceSize * 3);
  for (let y = 0; y < sourceSize; y += 1) {
    for (let x = 0; x < sourceSize; x += 1) {
      pixels.set(pixelAt(x, y), (y * sourceSize + x) * 3);
    }
  }
  return pixels;
}

/** Cover blank inputs and detailed patterns that can pass a sharpness-only filter. */
function syntheticFixtures() {
  const fixtures = [];
  for (const [name, colour] of [
    ['black', [0, 0, 0]], ['white', [255, 255, 255]], ['grey', [128, 128, 128]],
    ['red', [255, 0, 0]], ['green', [0, 255, 0]], ['blue', [0, 0, 255]],
  ]) fixtures.push({ name: `solid-${name}`, kind: 'blank', pixels: makePixels(() => colour) });
  for (const seed of [1, 7, 42, 2026, 3735928559]) {
    const next = seededRandom(seed);
    fixtures.push({ name: `rgb-noise-${seed}`, kind: 'noise', seed,
      pixels: makePixels(() => [next(), next(), next()]) });
  }
  for (const seed of [1, 42, 2026]) {
    const next = seededRandom(seed);
    fixtures.push({ name: `grey-noise-${seed}`, kind: 'noise', seed,
      pixels: makePixels(() => { const value = next(); return [value, value, value]; }) });
  }
  for (const cell of [1, 8, 32]) {
    fixtures.push({ name: `checkerboard-${cell}px`, kind: 'pattern', pixels: makePixels((x, y) => {
      const value = ((Math.floor(x / cell) + Math.floor(y / cell)) % 2) * 255;
      return [value, value, value];
    }) });
  }
  fixtures.push({ name: 'vertical-stripes-16px', kind: 'pattern', pixels: makePixels((x) => {
    const value = (Math.floor(x / 16) % 2) * 255;
    return [value, value, value];
  }) });
  fixtures.push({ name: 'rgb-gradient', kind: 'pattern', pixels: makePixels((x, y) => [
    Math.floor(x * 255 / (sourceSize - 1)), Math.floor(y * 255 / (sourceSize - 1)), 128,
  ]) });
  return fixtures;
}

/** Match the previous browser gate's 512px grayscale Laplacian variance calculation. */
function previousBlurScore(pixels) {
  const grey = new Float32Array(sourceSize * sourceSize);
  for (let index = 0; index < grey.length; index += 1) {
    grey[index] = 0.299 * pixels[index * 3] + 0.587 * pixels[index * 3 + 1] + 0.114 * pixels[index * 3 + 2];
  }
  const values = new Float64Array((sourceSize - 2) ** 2);
  let position = 0;
  let total = 0;
  for (let y = 1; y < sourceSize - 1; y += 1) {
    for (let x = 1; x < sourceSize - 1; x += 1) {
      const index = y * sourceSize + x;
      const value = grey[index - sourceSize] + grey[index + sourceSize]
        + grey[index - 1] + grey[index + 1] - 4 * grey[index];
      values[position++] = value;
      total += value;
    }
  }
  const mean = total / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

/** Inspect embedded preprocessing without modifying it or adding a second rescale. */
async function graphPreprocessing(model, description) {
  const constants = [];
  for (const node of description.modelTopology.node) {
    if (node.op === 'Const' && node.name.includes('/rescaling_')) {
      const tensor = model.weights[node.name]?.[0];
      constants.push({ name: node.name, values: tensor ? Array.from(await tensor.data()) : null });
    }
  }
  return { input: model.inputs, output: model.outputs, embedded_rescaling_constants: constants };
}

/** Run the shipped graph even for blanks; report the previous blur gate separately. */
async function evaluateFixture(tf, model, fixture, labels, thresholds) {
  const input = tf.tidy(() => tf.tensor3d(fixture.pixels, [sourceSize, sourceSize, 3], 'int32')
    .resizeBilinear([224, 224], false).toFloat().expandDims(0));
  let outputs;
  try {
    outputs = model.predict(input);
    const tensors = Array.isArray(outputs) ? outputs : [outputs];
    if (tensors.length !== 1) throw new Error('Expected one output tensor.');
    const scores = Array.from(await tensors[0].data());
    if (scores.length !== labels.length || scores.some((score) => !Number.isFinite(score))) {
      throw new Error('The exported model returned invalid scores.');
    }
    const top = scores.map((score, index) => ({ label: labels[index], score }))
      .sort((left, right) => right.score - left.score).slice(0, 3);
    const blur = previousBlurScore(fixture.pixels);
    return {
      name: fixture.name, kind: fixture.kind, ...(fixture.seed === undefined ? {} : { seed: fixture.seed }),
      pixels_sha256: sha256(fixture.pixels), top_three: top,
      score_sum: scores.reduce((sum, score) => sum + score, 0),
      previous_blur_score: blur,
      previous_confidence_gate_pass: top[0].score >= thresholds.min_confidence,
      previous_blur_gate_pass: blur >= thresholds.blur_threshold,
      previous_gate_would_accept: top[0].score >= thresholds.min_confidence && blur >= thresholds.blur_threshold,
    };
  } finally {
    input.dispose();
    if (outputs) tf.dispose(outputs);
  }
}

/** Keep runtime dependencies outside the app and emit an evidence-bounded report. */
async function main() {
  const options = parseArguments(process.argv.slice(2));
  const modelDirectory = options.modelDirectory || defaultModelDirectory;
  const require = options.tfjsDirectory
    ? createRequire(path.join(options.tfjsDirectory, 'package.json')) : createRequire(import.meta.url);
  let tf;
  try { tf = require('@tensorflow/tfjs'); }
  catch { throw new Error('Install @tensorflow/tfjs@4.22.0 outside this repository and pass --tfjs-dir <directory>.'); }
  if (tf.version.tfjs !== '4.22.0') throw new Error(`Expected TensorFlow.js 4.22.0; found ${tf.version.tfjs}.`);
  await tf.setBackend('cpu');
  await tf.ready();
  const manifest = JSON.parse(await readFile(path.join(modelDirectory, 'model_manifest.json'), 'utf8'));
  const labelsFile = JSON.parse(await readFile(path.join(modelDirectory, 'labels.json'), 'utf8'));
  const labels = manifest.class_order;
  if (JSON.stringify(labels) !== JSON.stringify(Object.values(labelsFile))) {
    throw new Error('The manifest and labels.json class order differ.');
  }
  const { model, artifacts, description } = await loadLocalGraph(tf, modelDirectory);
  try {
    const results = [];
    for (const fixture of syntheticFixtures()) {
      results.push(await evaluateFixture(tf, model, fixture, labels, manifest.metrics.calibration));
    }
    const unexpected = results.filter((result) => result.previous_gate_would_accept);
    const report = {
      evaluation: 'synthetic-non-appliance-rejection-v1',
      scope: 'Real exported-graph inference on deterministic generated pixels only; not real-world accuracy, an OOD benchmark, or validation of the reported microwave photo.',
      runtime: { tensorflow_js: tf.version.tfjs, backend: tf.getBackend() },
      model_directory: modelDirectory,
      preprocessing: '512x512 RGB bytes [0,255]; TF.js bilinear resize to 224x224 with alignCorners=false; float32 batch. No external normalization; graph contains rescaling.',
      graph: await graphPreprocessing(model, description), artifacts,
      thresholds_from_manifest: manifest.metrics.calibration,
      deployment_policy: { recognition_enabled: manifest.recognition_enabled ?? null, validation_status: manifest.validation_status ?? null },
      fixture_count: results.length,
      previous_gate_false_accept_count: unexpected.length,
      previous_gate_false_accept_fixtures: unexpected.map((result) => result.name),
      interpretation: unexpected.length
        ? 'The prior confidence-plus-blur rule accepts some images containing no appliance. Keep recognition paused pending representative held-out and rejection validation; these cases do not establish the cause.'
        : 'No synthetic fixture passed the prior gate. This limited result does not establish real-world accuracy or justify enabling recognition.',
      results,
    };
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (options.output) {
      await writeFile(options.output, json, 'utf8');
      console.log(`Evaluated ${results.length} synthetic fixtures; ${unexpected.length} would pass the previous gate. Report: ${options.output}`);
    } else process.stdout.write(json);
    if (options.assertRejection && unexpected.length) process.exitCode = 2;
  } finally { model.dispose(); }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
