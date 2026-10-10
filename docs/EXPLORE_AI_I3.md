# Explore photo recognition: first 16 items

Historical first-phase guide. The current all-32 candidate is described in
[EXPLORE_AI_I3_32.md](EXPLORE_AI_I3_32.md). Results below remain specific to v1.

This is a local Iteration 3 review. It adds a separate photo helper to Explore.
Take action keeps its approved 19-appliance policy, files and model vectors.
Nothing in this work changes Main, earlier iterations, Render settings or Neon.

## Run and review

From `E:\FixForward-I3-Explore-AI` in PowerShell:

```powershell
$env:FF_WORLD_PORT = '5580'
node prototypes/i3-world-preview/serve.mjs
```

Open `http://127.0.0.1:5580/prototypes/i3-world-preview/#explore`.
Expand **Try a photo**, drag one saved JPG/PNG/WebP into the photo box (or use
**Choose a photo**), then press **Check this photo**. The box highlights while a
file is over it. Website image links and multiple-file drops explain how to
choose a single saved photo; they do not trigger a remote image fetch.
The preview and processing status provide feedback. Confirm the suggested type
before its learning view changes. You can stop, remove the photo or choose an
item manually. Leaving Explore cancels stale work and releases its resources.
Dropping a replacement also cancels the previous preview/check. File-drop guards
prevent a missed drop from navigating away, and are removed when Explore closes.

The drag-and-drop follow-up passed 43 focused helper/Explore tests, including
six new regressions. The drop area was visually checked in Chrome; an actual OS
file drag was not automated. Recognition rules and model evidence are unchanged.

The first use loads approximately 92 MB of local inference assets. No image is
uploaded to an external AI service. This loopback review server has no database
connection; the adult operational-data tools explicitly report unavailability.

## Scope

The first 16 are kettle, toaster, fan, microwave, blender, rice cooker, air fryer,
coffee machine, mixer, vacuum cleaner, hair dryer, laptop, smartphone, tablet,
television and washing machine. The catalogue reserves 32 items, but the other
16 are not enabled for photo suggestions in this phase.

Twelve matching 3D lessons already exist. Smartphone, tablet, television and
washing machine show an explicit missing-3D message after confirmation. The
helper must never substitute a kettle or invent product parts, care or CO2 data.

## Explain the code in an interview

| User action | Code | What happens |
| --- | --- | --- |
| Open Explore | `prototypes/i3-world-preview/app.js` and `explore.js` | The shared router mounts the page and its optional photo helper. |
| Choose a photo | `src/explore-photo-helper.js` | The file is checked and previewed locally. Selection alone does not download the model or change the 3D item. |
| Press Check | `src/explore-classifier.js` | The separate Explore policy, text vectors and pinned image encoder produce category suggestions. |
| Confirm a suggestion | `explore-photo-helper.js` then `explore.js` | An explicit catalogue mapping chooses the existing 3D lesson or shows that its model is not yet available. |
| Change page or choose manually | Feature cleanup | Pending responses are invalidated; a late answer cannot replace the next page or choice. |

`src/explore-catalogue.js` is the source of truth for the 32-item plan, first
16 recognition candidates and their existing 3D IDs. It does not import or
modify Take action's appliance list.

## What model work means here

The frozen SigLIP2 image encoder is reused as an immutable asset. Explore has
new, separate text embeddings, competing unsupported categories, a separate
scoring policy and its own image evaluation. Generating text vectors and
calibrating rejection rules is not retraining the large image encoder's weights.
Recognition is a suggestion about type, never a diagnosis or product recall.

The official architecture supports matching images to category text; see the
[SigLIP2 documentation](https://huggingface.co/docs/transformers/model_doc/siglip2).
Local source comments explain the integration and boundaries.

## Evidence workflow

Licensed images are recorded with source, licence, hash, visual review and
calibration/holdout assignment. Reused development images remain labelled as
such; a new split does not make previously opened images independent evidence.
Images of the remaining catalogue items and unrelated objects check rejection.

`scripts/extract-explore-features.mjs` extracts the exact q4 image features
without sending photos anywhere. Its output records model and dataset hashes
and checks for overlapping source identities across splits. Evaluation results
belong with the frozen policy; favourable examples alone do not establish
accuracy on arbitrary user photos or multiple appliances.

## Recorded checks (10 October 2026)

The rules were frozen using only the calibration partition. The following
offline results use that same rule, with no changes after opening holdout:

| Evaluation condition | Supported photos | Correct offered choice sets | Wrong choice sets | Rejected supported photos | Negative photos offered |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original held-out partition | 64 | 59 | 0 | 5 | 0 of 16 |
| Same photos, resized to 512 px and Gaussian blur radius 2.5 | 64 | 53 | 1 | 10 | 0 of 16 |

The blur set reuses the same identities; it is not 80 extra independent photos.
One blurred hair dryer was offered as mixer/blender/kettle. Do not claim blur
robustness. The original partition's hair dryers, fans, tablets and washing
machines also include rejections. Correct choice sets may contain alternatives;
these counts are not top-1 accuracy or a percentage for arbitrary user photos.

Evidence files: `explore-ai-calibration-v1.json`, `explore-ai-holdout-v1.json`,
`explore-ai-blur-v1.json`, and the source metadata snapshot in this directory.

The full `npm.cmd run check` completed with 545 passing tests. After the final
preview header/dimension guard, the focused Explore/model/helper suite passed
50 tests (including four added guard regressions). The five relevant backend
route/access/release test files passed 57 tests. No backend source was changed.

The actual Chrome model smoke run on the first calibration photo per item gave
10 correct choice sets, no wrong choice sets and six rejections. Node rejected
five of those same photos. A rice-cooker photo was additionally rejected in
Chrome; Node had offered three alternatives. Transformers.js uses different
image-resize implementations in browser and Node, so offline counts are not
substitutes for browser evidence.

The subsequent **actual Chrome run on all 80 held-out samples** produced 58
correct offered choice sets, zero wrong choice sets and six rejections among
64 supported photos. All 16 negative controls were rejected (12 real photos and
four synthetic images). See `explore-ai-browser-holdout-v1.json` for every case.
Every active category had at least two correct suggestions in this small run.
The six rejections were one fan, two hair dryers, one tablet and two washing
machines. These are the same limited development identities used offline;
running them in a second runtime does not make a new independent benchmark.

The local UI was opened in Chrome and manual item changes verified. Choosing a
smartphone hid the kettle model and showed the missing-3D message; switching
back restored the kettle. Browser console errors were absent in the model run.
The extension blocked automated file-chooser selection despite previous user
permission attempts, so an actual chooser-to-preview flow was not claimed as
browser-verified. Unit tests cover preview/validation/confirmation/cancellation.
Physical-tablet interaction is also unverified. Source review confirms wrapping
controls and at least 44 px touch targets; it is not a substitute for device use.
The real-model browser test uses explicit public same-origin fixtures and does
not simulate model responses or insert files into the page's upload control.

To run the optional browser evidence harness, first prepare its ignored fixture:

```powershell
python scripts/prepare-explore-browser-fixture.py --manifest tmp/explore-ai/dataset/manifest.json --split holdout --output tmp/explore-ai/browser-samples.json
$env:FF_EXPLORE_TEST_MODE = '1'
$env:FF_WORLD_PORT = '5580'
node prototypes/i3-world-preview/serve.mjs
```

Open `http://127.0.0.1:5580/__explore-test/` and click **Check all 80 sample
photos**. The model runs sequentially in the browser using the same application
classifier. The page's evidence report records all results. The preview server
serves only three explicit harness files, only with that environment flag;
Flask does not expose these routes or research fixtures.

No release or deployment is authorised by this document. The local preview is
for the user's image review before any later publishing decision.
