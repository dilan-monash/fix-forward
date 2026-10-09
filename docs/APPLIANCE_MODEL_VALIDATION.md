# Appliance recognition: local candidate validation

Checked locally on 9 October 2026. The adult photo helper remains unavailable:
`model/appliance-siglip/model_manifest.json` keeps both `release_ready: false`
and `recognition_enabled: false`. The manual appliance picker is the release
path. No result below authorizes enabling recognition, making a public accuracy
claim or diagnosing an appliance, fault, recall or safety condition.

## Why the old MobileNet export was retired

The earlier TensorFlow.js MobileNet export failed a deterministic random-noise
diagnostic. `scripts/evaluate-appliance-model.mjs` ran the real graph in
TensorFlow.js 4.22.0 on generated pixels. Three non-appliance fixtures passed
the old score-and-blur acceptance rule, including seeded grayscale noise and two
checkerboards. That is a counterexample to the old rejection rule, not a
real-world error-rate estimate. The complete report is
`docs/appliance-model-synthetic-evaluation.json` (SHA-256
`32ca502dd3bc0efe07f6e8a1714579f701024aefb0aae050a29b8bb125b91f66`).

## Current local SigLIP 2 candidate

The replacement work uses the pinned q4 vision export of
`google/siglip2-base-patch32-256` through `@huggingface/transformers` 3.8.1 and
ONNX Runtime Web. The model, processor configuration, generated text embeddings,
JavaScript runtime and WASM files are self-hosted at same-origin paths. Remote
model loading is disabled. The first-use runtime, model, configuration and text
assets total 92,560,078 bytes, about 92.5 MB. They are requested only after a
person chooses a photo and only when both release flags are enabled; the current
false flags prevent that download and inference.

Photos stay in the browser and are not posted to Flask. Even if a later candidate
passes every release step, an accepted appliance type is only a suggestion. The
person must explicitly confirm it before the form changes. The score uses cosine
margins for rejection; it is not a user-facing confidence percentage.

The pinned vision file is
`model/appliance-siglip/upstream/siglip2-base-patch32-256/onnx/vision_model.9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499_q4.onnx`
(69,938,403 bytes; SHA-256
`9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499`).
The text manifest is `model/appliance-siglip/text-embeddings.json` (SHA-256
`4b01be52acad78dae1783978e1bc191d50532dc63781a5cd7b96e24f3a390093`),
and its float32 vectors are `model/appliance-siglip/text-embeddings.f32`
(SHA-256
`2e63f55601cf3f011bf13b3c347bd456111c1b8132f9d8164105fff0a29877f2`).

## Frozen gate results

Both evaluations ran locally in Node with the pinned browser runtime, q4 model,
text artifacts and acceptance code. This establishes local Node parity for those
artifacts. It does not prove performance, memory use or compatibility in a
physical tablet or browser.

| Candidate | Locked evidence | Result |
|---|---|---|
| v1, one shared margin rule | 37 enabled-class positives, 95 audited true-OOD photos from 21 source groups and 11 manual-only-class photos | Failed. It accepted 10 of 37 enabled-class photos: 9 of those 10 suggestions were correct, giving 27.027% coverage, and one portable heater was wrongly accepted as a fan. It accepted no audited true-OOD or manual-only-class photo. |
| v2, frozen per-class margins | 81 operational positives covering all 17 enabled classes, plus 143 audited true-OOD photos from 38 source groups | Failed the whole pre-registered gate. It accepted 43, all correct, for 53.086% coverage; it had zero wrong accepts and zero true-OOD accepts. The cohort contained no manual-only positives, so its zero manual-only accepts is a count rather than a measured rejection rate. |

Candidate v2 passed the aggregate sample, coverage and zero-wrong/OOD checks.
The whole gate nevertheless failed because every enabled class was required to
have at least one accepted-correct example. Six classes had zero:
`blender`, `food_processor`, `mixer`, `shaver`, `toaster` and
`vaccum_cleaner`. The frozen failure action is to keep the entire photo helper
disabled; removing those classes after opening the result cannot turn v2 into a
passing release candidate.

## Evidence artifact register

The following SHA-256 values identify the current checked-in evidence files:

| Artifact | SHA-256 |
|---|---|
| `model/appliance-siglip/fresh-heldout-evaluation.json` | `158fa60ea27193ae9562ecdcf005d30f173c1c036dbeaee31466d299d3f1f73b` |
| `model/appliance-siglip/fresh-heldout-gate-decision.json` | `e88388156e6cb8bff4b6e384deb6250f5466f8558fb73c6c1c2672fb8f33baed` |
| `model/appliance-siglip/candidate-v2-policy.json` | `01366d51bfc23354969918f868d7874b4fab83bffdae318b2397da4e72b83d04` |
| `model/appliance-siglip/pre-registered-release-gate-v2.json` | `224cbf43589f8799edd6973ccd3b7f913612648da241631bd22e71f704dae841` |
| `model/appliance-siglip/candidate-v2-fresh-test-manifest.json` | `d18a7f56d8bc74b8af3a2b0a3eb41f59159478bacf6622048966b3ae99ea98b2` |
| `model/appliance-siglip/candidate-v2-fresh-ground-truth-lock.json` | `c9e3b30051f0283ea71701fe9bf0557d3ef1b01ddfbaf44121267c6858a4a835` |
| `model/appliance-siglip/candidate-v2-fresh-predictions.json` | `2a1e198f20ba587e68bc37dbc75ca8f6497e2d31c8c1b1d403b2fea3445e2b59` |
| `model/appliance-siglip/candidate-v2-fresh-audit-summary.json` | `9802d5528eb1ab62fd70f0a8bd5368edf78455d6f38e51882304a20f941c3f78` |
| `model/appliance-siglip/candidate-v2-fresh-gate-decision.json` | `28bd3f6b9a1fe4a386aeb1861dc776bb5bc98b9e0911b13bc7b81a7e2def41ee` |

The candidate-v3 policy and pre-registered gate are incomplete future work. No
new untouched v3 cohort result is recorded, it is not wired into the browser,
and it is not release evidence.

## Evidence boundaries

- These are selectively accepted suggestions on locked local cohorts, not a
  population accuracy estimate and not a public claim about household photos.
- Zero observed false accepts does not establish a zero false-accept rate.
- Node execution does not establish browser download time, memory pressure,
  decode behavior, accessibility or physical-tablet performance.
- The validation images are licensed benchmark material and were not used to
  fine-tune the upstream SigLIP 2 weights. FixForward authored the prompts, text
  vectors, rejection policies, evaluation scripts and confirmation-first UI.
- A future candidate needs a new untouched, prediction-blind cohort and must
  pass its frozen whole-candidate gate before a separate browser and physical
  device review. Passing an offline gate alone would still not authorize a
  deployment or a public accuracy claim.
