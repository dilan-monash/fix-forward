#!/usr/bin/env node
/** Measure the Explore-only scorer on recorded q4 image features.
 * Calibration reads only its named partition. A separate evaluate command uses
 * the frozen policy unchanged, so holdout answers cannot choose the thresholds.
 * These small development cohorts do not establish population accuracy.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { scoreExploreSimilarities } from '../src/explore-classifier.js';

const args = {};
for (let index = 2; index < process.argv.length; index += 2) {
  if (!process.argv[index]?.startsWith('--') || process.argv[index + 1] === undefined) throw new Error('Use --name value arguments.');
  args[process.argv[index].slice(2)] = process.argv[index + 1];
}
for (const name of ['features-dir', 'output']) if (!args[name]) throw new Error(`Missing --${name}.`);
const mode = args.mode || 'evaluate';
if (!['calibrate', 'evaluate'].includes(mode)) throw new Error('Use calibrate or evaluate.');
// The original narrow gap rejected legitimate near-neighbours after expanding
// the catalogue. Compare only this bounded calibration-only set; never choose
// the gap using held-out answers, and never show more than three choices.
const choiceGap = Number(args['choice-gap'] || 0.012);
if (![0.012, 0.018, 0.024].includes(choiceGap)) throw new Error('Use a predefined choice gap: .012, .018 or .024.');
// Evidence is append-only: choose a new filename/version instead of replacing a
// report after its predictions have informed a later development decision.
try { await fs.access(path.resolve(args.output)); throw new Error('Evidence output already exists; choose a new report path.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const split = mode === 'calibrate' ? 'calibration' : (args.split || 'holdout');
if (!['calibration', 'holdout'].includes(split)) throw new Error('Invalid partition.');
const root = path.resolve(args['repo-root'] || '.');
const featureRoot = path.resolve(args['features-dir']);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const extraction = await readJson(path.join(featureRoot, 'extraction.json'));
const recordBytes = await fs.readFile(path.join(featureRoot, 'records.json'));
const records = JSON.parse(recordBytes);
if (hash(recordBytes) !== extraction.records_sha256) throw new Error('Image identities or evaluation partitions changed.');
const featureBytes = await fs.readFile(path.join(featureRoot, 'features.f32'));
if (hash(featureBytes) !== extraction.features_sha256) throw new Error('Image features changed.');
const textPath = path.join(root, 'model/explore-siglip/text-embeddings.json');
const textBytes = await fs.readFile(textPath);
const text = JSON.parse(textBytes);
const vectorBytes = await fs.readFile(path.join(root, 'model/explore-siglip/text-embeddings.f32'));
if (hash(vectorBytes) !== text.vectors_sha256) throw new Error('Text vectors changed.');
const floats = bytes => new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const features = floats(featureBytes), vectors = floats(vectorBytes);
const width = text.shape[1];
if (extraction.shape[0] !== records.length || extraction.shape[1] !== width || features.length !== records.length * width) throw new Error('Feature shape mismatch.');
const activeLabels = text.labels.slice(0, text.active_count);
if (text.active_count !== 32 || text.labels.length !== 42 || vectors.length !== text.labels.length * width) throw new Error('Unexpected Explore catalogue/vector shape.');

// Compute category scores only for the requested partition. The image-feature
// extractor itself has no labels or thresholds that can learn from this output.
const rows = records.flatMap((row, index) => {
  if (row.split !== split) return [];
  const image = features.subarray(index * width, (index + 1) * width);
  const scores = text.labels.map((_, offset) => {
    let dot = 0;
    for (let column = 0; column < width; column++) dot += image[column] * vectors[offset * width + column];
    return Math.max(-1, Math.min(1, dot));
  });
  const strongest = Math.max(...scores.slice(0, text.active_count));
  const competitor = Math.max(...scores.slice(text.active_count));
  return [{ ...row, scores, strongest, margin: strongest - competitor }];
});
if (!rows.length) throw new Error('The selected partition is empty.');

/** Keep useful correct suggestions, wrong suggestions and rejection separate.
 * A choice set containing the expected category is useful but is not top-1
 * accuracy; the interface still requires the person to choose explicitly. */
function evaluate(policy, includeRecords = false) {
  const totals = { supported: 0, correct_offers: 0, wrong_offers: 0, rejected_supported: 0, negative: 0, negative_offers: 0, extra_choices: 0, raw_top1_correct: 0 };
  const perClass = {}, results = [];
  for (const row of rows) {
    const result = scoreExploreSimilarities(row.scores, text, policy);
    const choices = result.alternatives.map(item => item.slug);
    const expected = row.slug;
    const supported = row.kind === 'supported' && activeLabels.includes(expected);
    const correct = supported && choices.includes(expected);
    const rawTop = activeLabels[row.scores.slice(0, text.active_count).indexOf(row.strongest)];
    if (supported) {
      totals.supported++;
      const count = perClass[expected] ||= { total: 0, correct_offers: 0, wrong_offers: 0, rejected: 0, raw_top1_correct: 0 };
      count.total++;
      if (rawTop === expected) { totals.raw_top1_correct++; count.raw_top1_correct++; }
      if (correct) { totals.correct_offers++; count.correct_offers++; }
      else if (result.accepted) { totals.wrong_offers++; count.wrong_offers++; }
      else { totals.rejected_supported++; count.rejected++; }
    } else {
      totals.negative++;
      if (result.accepted) totals.negative_offers++;
    }
    totals.extra_choices += Math.max(0, choices.length - 1);
    if (includeRecords) results.push({ id: row.id, source_group: row.source_group, kind: row.kind, expected, reused_development: row.reused_development, accepted: result.accepted, choices, correct, reason: result.reason, raw_top1: rawTop, strongest: row.strongest, margin: row.margin });
  }
  return { totals, per_class: perClass, ...(includeRecords ? { results } : {}) };
}

let policy;
if (mode === 'calibrate') {
  // Candidate boundaries come only from calibration observations. Requiring no
  // wrong choice sets or negative offers on this partition avoids trading away
  // rejection simply to make a large apparent recognition percentage.
  const boundaries = values => [...new Set([0, ...values.filter(value => value >= 0).map(value => value + 1e-7)])].sort((a, b) => a - b);
  const floors = boundaries(rows.map(row => row.strongest));
  const margins = boundaries(rows.map(row => row.margin));
  // Category ranking and the alternative gap do not change across this grid.
  // Compute them once, then vary only rejection. The winning report is still
  // recomputed through the production scorer below, catching any disagreement.
  const baseline = { acceptance: { min_similarity: 0, min_ood_margin: 0, max_choice_gap: choiceGap, max_choices: 3 } };
  const prepared = rows.map(row => {
    const result = scoreExploreSimilarities(row.scores, text, baseline);
    const supported = row.kind === 'supported' && activeLabels.includes(row.slug);
    return { ...row, possible: result.accepted, supported,
      correct: supported && result.alternatives.some(item => item.slug === row.slug),
      extras: Math.max(0, result.alternatives.length - 1) };
  });
  function calibrationTotals(minimum, margin) {
    const totals = { correct_offers: 0, wrong_offers: 0, negative_offers: 0, extra_choices: 0 };
    for (const row of prepared) {
      if (!row.possible || row.strongest < minimum || row.margin < margin) continue;
      totals.extra_choices += row.extras;
      if (!row.supported) totals.negative_offers++;
      else if (row.correct) totals.correct_offers++;
      else totals.wrong_offers++;
    }
    return totals;
  }
  let winner;
  for (const min_similarity of floors) for (const min_ood_margin of margins) {
    const candidate = { acceptance: { min_similarity, min_ood_margin, max_choice_gap: choiceGap, max_choices: 3 } };
    const totals = calibrationTotals(min_similarity, min_ood_margin);
    if (totals.wrong_offers || totals.negative_offers) continue;
    if (!winner || totals.correct_offers > winner.totals.correct_offers ||
      (totals.correct_offers === winner.totals.correct_offers && totals.extra_choices < winner.totals.extra_choices) ||
      (totals.correct_offers === winner.totals.correct_offers && totals.extra_choices === winner.totals.extra_choices && min_similarity + min_ood_margin < winner.policy.acceptance.min_similarity + winner.policy.acceptance.min_ood_margin)) {
      winner = { policy: candidate, totals };
    }
  }
  if (!winner?.totals.correct_offers) throw new Error('No useful zero-error calibration rule found; do not enable this candidate.');
  policy = winner.policy;
  const checked = evaluate(policy).totals;
  if (Object.entries(winner.totals).some(([key, value]) => checked[key] !== value)) throw new Error('Calibration grid differs from production scorer.');
} else {
  if (!args.policy) throw new Error('Evaluation requires --policy with already frozen acceptance values.');
  policy = await readJson(path.resolve(args.policy));
  // A rule calibrated for another candidate or image cohort cannot silently
  // become this candidate's frozen evaluation rule.
  if (policy.mode !== 'calibrate' || policy.active_count !== text.active_count ||
      policy.text_manifest_sha256 !== hash(textBytes) || policy.text_vectors_sha256 !== hash(vectorBytes) ||
      policy.source_manifest_sha256 !== extraction.manifest_sha256 || policy.features_sha256 !== extraction.features_sha256) {
    throw new Error('The frozen calibration report does not match this dataset and model.');
  }
}
const report = {
  purpose: 'Explore local development evidence; limited reviewed images, not population accuracy',
  mode, split, acceptance: policy.acceptance,
  active_count: text.active_count, active_labels: activeLabels,
  source_manifest_sha256: extraction.manifest_sha256,
  features_sha256: extraction.features_sha256,
  model_sha256: extraction.encoder_sha256,
  text_manifest_sha256: hash(textBytes), text_vectors_sha256: hash(vectorBytes),
  selection: mode === 'calibrate' ? `Maximise correct offered choice sets with zero observed wrong/negative offers; ${choiceGap} ambiguity gap and at most three choices; use calibration only. Bounded gap trials: .012, .018, .024.` : 'Frozen acceptance values; no refitting from this partition.',
  ...evaluate(policy, true),
};
await fs.mkdir(path.dirname(path.resolve(args.output)), { recursive: true });
await fs.writeFile(path.resolve(args.output), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ mode, split, acceptance: report.acceptance, totals: report.totals, per_class: report.per_class, output: path.resolve(args.output) }, null, 2));
