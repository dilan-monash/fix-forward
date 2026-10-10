#!/usr/bin/env node
/** Offline Explore evaluation: turn reviewed photos into image embeddings using
 * the exact q4 encoder already shipped for Take action. No photo leaves this
 * computer, no adult policy is edited, and no model prediction chooses a split.
 * The caller supplies a pinned Transformers.js installation rather than letting
 * this script silently download a different model or runtime.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const args = {};
for (let index = 2; index < process.argv.length; index += 2) {
  if (!process.argv[index]?.startsWith('--') || process.argv[index + 1] === undefined) throw new Error('Use --name value arguments.');
  args[process.argv[index].slice(2)] = process.argv[index + 1];
}
for (const name of ['manifest', 'runtime-dir', 'output-dir']) if (!args[name]) throw new Error(`Missing --${name}.`);
const root = path.resolve(args['repo-root'] || '.');
const manifestPath = path.resolve(args.manifest);
const output = path.resolve(args['output-dir']);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// A completed extraction is evidence, not a mutable cache. Reuse its recorded
// hashes or choose a new output directory when the dataset/runtime changes.
for (const filename of ['features.f32', 'records.json', 'extraction.json']) {
  try { await fs.access(path.join(output, filename)); throw new Error('Extraction output already exists; choose a new output directory.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const manifestBytes = await fs.readFile(manifestPath);
const dataset = JSON.parse(manifestBytes);
if (!Array.isArray(dataset.samples) || !dataset.samples.length) throw new Error('A reviewed samples manifest is required.');
const rows = dataset.samples;

// A shared product, source photo or exact image hash cannot appear on both sides
// of calibration/holdout. This is a necessary check, not proof that different
// Internet photos never depict the same physical product.
const seenGroups = new Map(), seenHashes = new Map();
for (const row of rows) {
  if (!['calibration', 'holdout'].includes(row.split) || !row.source_group || !row.sha256 || !row.image_path) throw new Error('Incomplete split/provenance metadata.');
  for (const [seen, key] of [[seenGroups, row.source_group], [seenHashes, row.sha256]]) {
    if (seen.has(key) && seen.get(key) !== row.split) throw new Error(`Cross-split overlap: ${key}`);
    seen.set(key, row.split);
  }
}
const adultPolicy = JSON.parse(await fs.readFile(path.join(root, 'model/appliance-siglip/model_manifest.json')));
const encoder = adultPolicy.vision_model;
const modelPath = path.join(root, 'model/appliance-siglip/upstream', encoder.repository, encoder.file);
if (hash(await fs.readFile(modelPath)) !== encoder.sha256) throw new Error('The pinned q4 encoder bytes do not match.');
const runtimeDir = path.resolve(args['runtime-dir']);
const runtimePackage = JSON.parse(await fs.readFile(path.join(runtimeDir, 'package.json')));
if (runtimePackage.version !== '3.8.1') throw new Error('Use the evaluated Transformers.js 3.8.1 runtime.');
const { AutoProcessor, SiglipVisionModel, RawImage, env } = await import(pathToFileURL(path.join(runtimeDir, 'dist/transformers.node.mjs')));
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = false;
env.localModelPath = path.join(root, 'model/appliance-siglip/upstream').replaceAll('\\', '/') + '/';
const processor = await AutoProcessor.from_pretrained(encoder.repository, { local_files_only: true });
const model = await SiglipVisionModel.from_pretrained(encoder.repository, {
  local_files_only: true, dtype: 'q4', model_file_name: encoder.model_file_name,
});
const width = 768;
const features = new Float32Array(rows.length * width);
const batchSize = Number(args['batch-size'] || 2);
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 8) throw new Error('Batch size must be 1–8.');
const started = performance.now();
await fs.mkdir(output, { recursive: true });
try {
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const images = [];
    for (const row of batch) {
      const imagePath = path.resolve(path.dirname(manifestPath), row.image_path);
      if (hash(await fs.readFile(imagePath)) !== row.sha256) throw new Error(`Image changed: ${row.id}`);
      images.push(await RawImage.read(imagePath));
    }
    const { pooler_output: tensor } = await model(await processor(images));
    if (tensor.dims[0] !== batch.length || tensor.dims.at(-1) !== width) throw new Error('Unexpected encoder output shape.');
    for (let index = 0; index < batch.length; index++) {
      const vector = tensor.data.subarray(index * width, (index + 1) * width);
      const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
      if (!(norm > 0) || !Number.isFinite(norm)) throw new Error('Invalid image embedding.');
      features.set(Array.from(vector, value => value / norm), (start + index) * width);
    }
    console.log(`Explore image features: ${Math.min(start + batchSize, rows.length)}/${rows.length} (${Math.round((performance.now() - started) / 1000)}s)`);
  }
} finally {
  await model.dispose();
}
const featureBytes = Buffer.from(features.buffer);
const recordBytes = Buffer.from(JSON.stringify(rows, null, 2) + '\n');
await fs.writeFile(path.join(output, 'features.f32'), featureBytes);
await fs.writeFile(path.join(output, 'records.json'), recordBytes);
await fs.writeFile(path.join(output, 'extraction.json'), JSON.stringify({
  scope: 'Explore local development; not a population accuracy estimate',
  shape: [rows.length, width], normalized: true, dtype: 'float32-little-endian',
  manifest: manifestPath, manifest_sha256: hash(manifestBytes),
  encoder_sha256: encoder.sha256, features_sha256: hash(featureBytes),
  records_sha256: hash(recordBytes),
  runtime: runtimePackage.version, elapsed_seconds: (performance.now() - started) / 1000,
  split_labels_not_used_for_feature_extraction: true,
}, null, 2) + '\n');
console.log(`Saved Explore image embeddings to ${output}`);
