# Appliance recognition evidence: review policy v4

This policy was developed and measured as a local experiment. On 10 October
2026, the user tested the single-photo preview and explicitly approved deploying
that flow to Iteration 3. The deployment manifest separately authorises that
experimental preview; `releaseReady` stays false because these measurements do
not establish general accuracy. The pure scorer neither runs a model nor uploads
a photo, changes a category, counts objects or decides product safety. Multi-item
detection remains local and is not included in this release.

## Why clear photos were rejected

The previous preview explicitly blocked eight classes: blender, food processor,
mixer, shaver, toaster, vacuum cleaner, dehumidifier and steam cleaner. The
underlying SigLIP2 model still ranked those classes, but the UI could not offer
them. On 97 clear, pixel-reviewed development photos, its first label was correct
91 times and its first three labels included the correct type 96 times. The old
policy offered only 51 correct suggestions. These are small, previously opened
development samples, not a population accuracy estimate.

Data quality also mattered. A previous semantic audit found that 70 purported
unknown calibration images actually comprised 48 unrelated images, 14 supported
appliance challenges and eight uncertain images. Both apparent false accepts
under that audit's old threshold were real supported appliances. The new visual
audit additionally found a catalogue image labelled vacuum cleaner containing
only an AmazonBasics logo. Metadata is not enough to label training images.

## What the local policy does

`src/appliance-review-policy.js` exports `reviewApplianceScores(scores, labels)`.
It takes the exact existing 29 cosine similarities: 19 appliance rows followed
by ten unrelated-content prompts. It rejects a 20-class supervised-head tensor,
invalid values or a different row order. It checks an absolute similarity floor
and the margin above unrelated content, then offers a clear winner or up to
three genuinely close alternatives. No score is a confidence percentage.

Every result requires explicit user confirmation. Alternative labels describe
one photographed region; two choices must never be presented as two detected
appliances. The `objectCount` field is deliberately null. A real detector and
spatial duplicate removal are needed before the UI can count photographed items.

All 19 category IDs are available in this local policy. The existing internal
spelling `vaccum_cleaner` is preserved for compatibility with the recall form.

## Derivation and separate development check

Thresholds were fitted only on 69 strictly reviewed clear photos from the old
model-selection/calibration splits and 49 reviewed unrelated examples. A grid
of observed-score midpoints maximised useful coverage with zero accepted
unrelated examples. Ties chose the smaller absolute floor, then the smaller
unrelated-content margin. The ambiguity gap was the largest top-to-correct
score gap among accepted derivation positives, plus a numerical tolerance.

The frozen parameters are recorded with source identities and hashes in
`docs/appliance-review-v4-evidence.json`. The later `opened_v3_review` rows did
not choose these parameters. They remain previously opened development evidence.

| Cohort | Positive photos | Correct type offered | Wrong choice sets | Unrelated images offered |
| --- | ---: | ---: | ---: | ---: |
| Parameter derivation | 69 | 64 | 0 | 0 / 49 |
| Separate opened-v3 development | 28 | 24 | 1 | 1 / 31 |

Across all 97 clear development positives, the policy offered 89 results: 88
included the correct type and one offered food processor for an air fryer.
Most results had one choice (83); six had two; none needed three. The additional
unrelated-image mistake and the wrong air-fryer result are reasons to limit this
to the authorised I3 experimental preview, gather fresh images and validate again
before broad release. Dehumidifier
evidence remains particularly weak: only two of four raw first choices matched.

Five newly collected and pixel-reviewed images were then scored after the policy
freeze without tuning: one toaster, one food processor, one mixer and two shavers.
The raw first label was correct for all five. The policy offered three correct
results and rejected the mixer and one shaver. Five examples cannot establish
accuracy across 19 categories, and this check contained no unrelated images.

The rejected mixer ranked first at similarity 0.131641, but the generic
`other_object` prompt scored 0.119498: its margin 0.012143 was below the frozen
0.017378 floor. The rejected shaver scored 0.090837 (below the absolute floor)
and lost to `other_object` at 0.107521. These failures were retained; the thresholds
and negative prompts were not changed after inspecting these new photos.

## Frozen blur and resolution checks

The same 97 strict positive originals and 32 reviewed unrelated originals were
also scored under three synthetic corruptions. These are repeated conditions on
the same identities, not hundreds of new independent test photographs. Mild and
moderate Gaussian blur use radii 1 and 2.5 on a 512-pixel image; the low-resolution
condition reduces the longest side to 96 pixels. No threshold was refitted.

| Condition | Original policy: correct offers / 97 | Local v4: correct choice sets / 97 |
| --- | ---: | ---: |
| Clear | 51 | 88 |
| Mild blur | 48 | 85 |
| Moderate blur | 42 | 82 |
| 96-pixel image | 40 | 82 |

The v4 policy also offered one wrong positive choice set and one unrelated image
in every condition. The original policy accepted no unrelated images here. The
local policy improves useful coverage while introducing a measured trade-off;
it must not be presented as reliably solving arbitrary blur. Full features and
per-image results are in `E:/FixForward-Vision-V4-Experiment/blur-eval` to avoid
filling the system drive. Compact counts and failures are in the evidence JSON.

## Supervised-head experiment

`scripts/experiment-appliance-v4-head.mjs` extracts normalized features with the
exact shipped q4 model and Transformers.js 3.8.1, with remote models disabled.
It checks image/model hashes and keeps original source groups and splits.
`scripts/fit-appliance-v4-head.py` fits a balanced ridge classifier on training
rows, selects regularization on model selection, and calibrates rejection on
calibration. Independent pixel exclusions are recorded without deleting rows.

All 987 source images were processed locally. The head matched the original
raw supported-class accuracy (76/80 model-selection photos and 75/82 calibration
photos), while its rejection rule reduced useful coverage. Its weights were
not integrated. Unknown-label noise, scarce classes and existing training-image
licensing limitations are retained in its report.

Research artifacts are under ignored `tmp/v4-head` and `tmp/v4-head-clear`.
Automated policy tests verify tensor order, all 19 categories, rejection, close
alternatives, immutability and confirmation. They do not measure image accuracy.

Five visually reviewed whole-object crops from synthetic two/three-appliance
panels were also classified correctly after OWLv2 region proposals. Duplicate
partial crops can still receive labels. This is a useful pipeline smoke check,
not evidence of robust counting in real kitchens or blurry photographs.
