# Iteration 3: reproducible photo-recognition development benchmark

This benchmark tests how candidate models behave on familiar development
photos, controlled image degradation, and synthetic multiple-picture panels.
It does **not** establish release accuracy or turn a classifier into a detector.
No active model, thresholds, website policy, database, or production service is
changed by the generator.

## Generate the data locally

Run from the isolated Iteration 3 development checkout. Pillow is required.
The source root is the existing checkout containing earlier licensed images.
The output must be a **new** directory below `tmp/i3-vision-v4-data` in the
checkout containing this script; existing directories are refused.

```powershell
python scripts/prepare-appliance-v4-stress.py `
  --source-root C:\Users\sansk\Downloads\FixForward-Iteration-3-From-Iteration-2 `
  --output-dir tmp/i3-vision-v4-data/my-new-run
```

Add `--clear-only` for an initial untransformed subset. `--per-class` defaults
to 8 original source groups, `--ood-limit` to 32 agreed negative pictures,
and `--composites-per-split` to 8 panels of each size per source split.
Lower coverage is reported rather than filled with unverified query labels.

Outputs are `manifest.json`, `report.json`, `pixel-audit.json`, and the PNG
images referenced by `samples[].image_path`. Resolve each image path relative
to the manifest's parent directory. The source inputs and generator have
SHA-256 fingerprints. PNG bytes, selection order, transformations and panel
layouts are deterministic for the recorded Python/Pillow versions.

## Sources and visual audit

The generator uses the previously approved/structured-label positives in
`tmp/appliance-model-experiment-v3/selected-data-manifest.jsonl` and the
two-reviewer agreed assignments from the archived 2026-10-10 v3 diagnostic.
Original training-split pictures, uncertain reviews, rejected positive labels
and unsupported broad metadata mappings are not automatically accepted.
ABO's exact product types are explicitly mapped to catalogue labels; for
example `PERSONAL_CARE_APPLIANCE` alone cannot establish a shaver label.

Every selected image retains its source ID, licence, attribution, source URL,
original hash, known product/source group and original split. The script checks
hashes before generating derivatives and refuses source/split collisions.
Derivatives retain their parent's split. Composite components come from the
same split, and list **all** component source groups. Different internet photos
may still show the same product without a shared ID; source grouping does not
prove complete physical-product independence.

All 167 initially selected source pictures were viewed in contact sheets by
the `benchmark_preparation` agent, without inspecting new model predictions.
This is an AI-assisted image-only audit, not independent human ground truth.
The source IDs and exceptions are explicit in the generator. A new selection
does not inherit an audit of a picture that was never viewed.

That audit found a real metadata error: `abo-product:B07YPV9F3L` contains only
an AmazonBasics wordmark, although the dataset labels it as a vacuum cleaner.
The new benchmark corrects it to a negative and preserves `historical_expected`.
Another old negative, `commons-page-19117642`, contains an ambiguous kitchen
appliance and is excluded from strict negative scoring. Close-ups, packaging,
accessory kits, multiple appliances and fixed ceiling fans are retained in
separate challenge groups rather than silently becoming clear single photos.

## Completed local dataset

The final audited singles are at `tmp/i3-vision-v4-data/clear-v4/manifest.json`.
The full generated dataset is at `tmp/i3-vision-v4-data/stress-v3/manifest.json`.
Earlier `clear-v1`, `clear-v2`, `clear-v3`, `stress-v1` and `stress-v2` runs are
superseded development outputs. Do not mix their preliminary annotations with
the final audit.

| Component | Count | Meaning |
| --- | ---: | --- |
| Original pictures | 167 | 134 appliance-presence labels, 33 negative candidates after the logo correction |
| Strict clear positives | 97 | At least two reviewed clear pictures in every one of the 19 categories |
| Strict negative pictures | 32 | 31 reviewed OOD images plus the corrected logo-only picture |
| Positive challenge pictures | 37 | Partial views, packaging, multiple/context scenes, lighting and scope challenges |
| Uncertain negative | 1 | Retained for diagnosis, excluded from strict accuracy |
| Synthetic single-picture variants | 1,002 | Six deterministic variants of every original |
| Two-picture panels | 24 | Synthetic composites from clear source pictures in the same split |
| Three-picture panels | 24 | Synthetic composites from clear source pictures in the same split |
| Total generated test inputs | 1,217 | Correlated inputs, **not** 1,217 independent real photos |

Original source splits remain 49 `calibration`, 48 `model_selection` and 70
`opened_v3_review`; no original training rows are included. All three splits
are already-opened **development evidence**. Report them separately when a
candidate was selected or calibrated using those original splits.

Strict clear coverage per class is air fryer 4, blender 5, coffee machine 5,
dehumidifier 4, fan 6, food processor 3, hair dryer 6, kettle 6, microwave 8,
mixer 5, portable AC 6, portable heater 8, rice cooker 5, sandwich press 2,
shaver 4, steam cleaner 2, straightener 3, toaster 8 and vacuum cleaner 7.
These small counts cannot support a high-accuracy claim for every category.
The historical API spelling `vaccum_cleaner` remains unchanged.

## Score the right task

`variant: "clear"` means **untransformed**, not necessarily clear or isolated.
For strict untransformed classification, require both `variant === "clear"`
and `pixel_audit.strict_classification_eligible === true`. Positive singles
have `evaluation_bucket: "clear_single"`; strict negatives have
`"reviewed_ood"` or `"label_error_logo"`. Report challenge buckets separately.

For robustness, compare a derivative against its own original, by class and
source split. The transformations are Gaussian blur at radii equivalent to
1.0/2.5 pixels at a 512-pixel long edge, downsize to 192/96 pixels then resize
back, and brightness factors 0.60/1.35. These do not recreate every natural
blur, lighting, cropping or occlusion failure.

Panels carry expected source-picture labels and exact paste rectangles named
`panel_bounds_xyxy`. These rectangles include source background and possible
accessories: **they are not annotated appliance boxes**. The manifest therefore
sets `verified_appliance_instance_count` to `null`. Use panels for an exploratory
check of whether multiple relevant labels can be proposed. Do not calculate
object-detection mAP or claim real-scene counting accuracy from them. Real
two/three-appliance household pictures need full instance annotation first.

## Verification completed

- The original 167-picture preparation produced identical image and manifest
  bytes in two independent output directories before the later audit update.
- The final script compiles; existing output-directory writes are refused.
- All 1,217 final image hashes were checked against their manifest.
- Every derivative and panel retained its component source split and groups.
- Every panel has distinct labels, reviewed clear source pictures, and valid
  in-bounds paste rectangles. No training-split originals entered the output.

The generator does not run inference, choose model thresholds after observing
predictions, or declare any model to have passed a release gate.

## Bounded collection of new photos

A separate attempt to collect two new clear photos for each of the nine
reported problem categories examined **49 newly downloaded candidates** from
Wikimedia Commons. Searches returned many unsuitable results: vacuum bags and
historical machinery, Blender software images, food-only air-fryer pictures,
manual kitchen tools, packaging and adverts. Those query labels were not
treated as correct appliance labels. API/image rate limits interrupted the
collection, so the requested 18 suitable photographs were **not** obtained.

Five newly approved whole-appliance photos are frozen in
`tmp/i3-vision-v4-data/fresh-reviewed-v1/manifest.json`: one toaster, one food
processor, one mixer and two shavers. No new clear vacuum, steam-cleaner,
blender, air-fryer or dehumidifier photo was approved in that bounded run.
The two collector manifests retain candidate metadata and retrieval failures
under `fresh-candidates-v1` and `fresh-candidates-v2`.

The new photo manifest records source pages, original/download URLs, creators,
licences, attribution notices, exact hashes and a UTC freeze time. The five
source IDs were checked against the recorded prior source registry; images
were compared with 3,974 prior images using a 64-bit difference hash. The
nearest distances were 11, 15, 15, 16 and 9 bits, all above the duplicate-review
trigger of 4. This supports source independence; it cannot rule out every
alternate view of the same physical product.

The image-only reviewer did not inspect new model predictions when choosing
these pictures. The labels are an AI-assisted review, not independent human
gold labels. Run only the already-frozen candidate on this diagnostic set;
do not retune with its predictions and call the same pictures held-out proof.
Five photos across four categories are insufficient for an accuracy claim.

## Enlarged-image audit correction

The earlier contact sheet description for `commons-page-52030445` / `P092.jpg`
mistook a closed patio umbrella for a pedestal fan. Enlarged inspection shows
one portable air conditioner beside an umbrella. The generator note is now
corrected; frozen manifests are retained as historical records. This challenge
image was already excluded from the strict 97-positive benchmark, so no scoring
denominator changed. It must not be used as a two-appliance counting example.

Three existing natural development photos were inspected at full resolution
before multi-item inference: `P040.jpg` has two rice cookers; `P055.jpg` has two
blenders; `P005.jpg` has two air fryers, one partly occluded by a price card.
Reflections and appliances pictured on packaging are not additional objects.
The cropped oven in `P005.jpg` is outside the supported categories. These are
opened development images, not fresh held-out tests.
