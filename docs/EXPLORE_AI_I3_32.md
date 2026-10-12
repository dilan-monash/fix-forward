# Explore photo recognition: all 32 items

This is the second Explore recognition candidate, now enabled for the reviewed Iteration 3 service and loopback previews. It extends the first
16-item review in `EXPLORE_AI_I3.md`; that earlier candidate's accuracy evidence
does not describe this expanded classifier. Take action still owns its separate
19-appliance catalogue, policy and text vectors.

## Iteration 3 release scope

The user approved publishing the current preview on 10 October 2026. The helper
permits `fix-forward-iteration-3-r4sh.onrender.com` and loopback hosts only. Main,
Iteration 1, Iteration 2 and the forwarding static site cannot run this helper.
Its policy uses `scope: iteration_3_preview`; `experimental: true` and
`release_ready: false` remain deliberate because this is a limited evaluated
review release, not a claim of general accuracy. Frozen scores, thresholds and
model bytes remain unchanged. Every suggestion still needs confirmation.

Flask serves only the three approved Explore policy/text files behind the normal
access gate. Text metadata and vectors are hash-checked in Flask and the browser.
Git attributes preserve those bytes across Windows and Render. No photo is sent
to a server, no database writes are added, and Take action remains limited to19.

## Run locally

Open PowerShell in `E:\FixForward-I3-Explore-AI`:

```powershell
$env:FF_WORLD_PORT = '5580'
node prototypes/i3-world-preview/serve.mjs
```

Open `http://127.0.0.1:5580/prototypes/i3-world-preview/#explore`. Expand
**Try a photo**, drop one saved JPG/PNG/WebP into the box or use **Choose a
photo**, then press **Check this photo**. Confirm the suggested item to continue.
The first check loads about 92 MB of local model/runtime files. Photo pixels stay
in the browser. Manual choices work without recognition or a model download.

## Categories and learning views

| Group | Explore recognition candidates |
| --- | --- |
| Kitchen | Kettle, toaster, microwave, refrigerator, rice cooker, air fryer, blender, food processor, mixer, coffee machine, sandwich press |
| Living room | Television, fan, portable heater, portable air conditioner, dehumidifier |
| Study & play | Laptop, tablet, smartphone, headphones, games console, printer |
| Care & cleaning | Vacuum cleaner, steam cleaner, washing machine, clothes dryer, hair dryer, hair straightener, shaver, electric toothbrush |
| Workshop | Cordless drill, sewing machine |

All 32 recognition categories now have their own interactive 3D model, matching
part explanations, care guidance and editable electricity CO2e examples. Explicit
photo confirmation opens the matching lesson; predictions never select one automatically.
See [3D model provenance and content sources](EXPLORE_3D_SOURCES.md).

The picker has five native option groups. The card grid offers the same five
group filters, allowing the full catalogue without forcing every card into the
initial decision. Small SVG icons are navigation pictures, not substitute 3D.

## How the code connects

| File | Responsibility |
| --- | --- |
| `src/explore-catalogue.js` | Stable 32-category IDs, display groups and honest mappings to existing 3D IDs. The historical first-16 export is preserved for comparison only. |
| `src/explore-photo-helper.js` | Native picker and drag/drop share validation, local preview and cancellation; an explicit Check starts inference, and an explicit confirmation selects a lesson. |
| `src/explore-classifier.js` | Loads only the pinned local assets, compares 32 candidate types with ten unrelated controls, and applies the new frozen rejection policy. |
| `model/explore-siglip/` | Explore v2 metadata, separate text-vector catalogue and release gate. |
| `prototypes/i3-world-preview/explore.js` | Groups cards/options and opens the matching real learning view after a manual choice or photo confirmation. |
| `scripts/prepare-explore32-data.py` | Collects source-attributed candidate photos and freezes the visually reviewed dataset before calibration/evaluation. |
| `scripts/evaluate-explore-policy.mjs` | Uses only calibration rows to select thresholds; applies them unchanged to evaluation rows and refuses to overwrite evidence. |

The immutable pretrained SigLIP2 image encoder is shared as a static asset.
Explore v1 already included text descriptions of the future 16 categories as
unsupported competitors. V2 promotes those rows to recognition candidates;
their vector bytes remain the same. The acceptance policy and evaluation must
be rebuilt because the set of valid answers has doubled. This is not image-
encoder weight retraining and does not improve itself when a visitor adds a photo.

## Evidence boundaries

All v1 reports and raw research images are preserved. Exact previous model/UI
files and hashes were also copied under ignored `tmp/explore-ai32/phase1-*-snapshot`.
The new data has its own manifest and source review. Reused first-16 photos stay
labelled as development data; the new split is not a fresh independent benchmark.

Source licence records and image hashes are retained. Actual contact-sheet pixel
review excludes drawings, parts-only shots and obvious duplicate photo families.
This is assistant review, not independent human annotation. Electronic negatives
include monitors, remotes and mice, alongside unrelated objects and synthetic
controls. Synthetic controls never inflate real-photo accuracy denominators.

Local evidence records calibration, unchanged-policy evaluation and actual
Chrome results separately. Suggestions may contain alternatives; a correct
choice set is not necessarily a correct top-ranked choice. Blur, occlusion and
multiple objects require separate tests; this helper does not count objects or
identify a fault, brand, exact model, recall or repair method.

### Frozen development cohort and calibration

The versioned [dataset record](EXPLORE_AI_DATASET_V2.md) has 244 supported
photos, 26 real unrelated photos and four synthetic controls. There are 74 newly
sourced real photos; 196 are reused development photos. This is calibration and
development evaluation, not independent certification of accuracy. Steam cleaners
and printers have only three source families each; dryers and sewing machines
have seven. Every category has both a calibration and reserved evaluation row.

The original 0.012 ambiguity gap forced an excessively strict rejection rule:
57/124 calibration photos received a correct choice set. Two bounded alternatives
were evaluated on calibration data only. Gaps of 0.018 and 0.024 both offered the
correct type for 109/124 photos, with no wrong choice sets or offers on the 15
calibration negatives. The selected 0.018 gap produced fewer extra alternatives
(27 versus 32). It accommodates visually similar pairs such as a mixer and food
processor, while still limiting the interface to three explicit choices.

All three reports are preserved, including the unsuccessful narrow-gap trial.
The [selected calibration report](explore-ai32-calibration-v2.json) is pinned in
the classifier and model manifest before reserved evaluation predictions are
opened. No held-out answer chooses these thresholds. The image encoder and text
vectors have not been retrained.

### Reserved evaluation and known mistakes

The [Node evaluation](explore-ai32-holdout-v2.json), with the selected rule
unchanged, offered the correct category in 114/120 supported photos. Three
photos received wrong choice sets and three were declined. All 11 real negative
photos and four synthetic controls were declined. Raw top-ranked correctness
was also 114/120, but those are different sets of photos: a correct alternative
does not imply the highest-ranked suggestion was correct.

Wrong sets were a hair dryer suggested as kitchen mixing equipment, a
dehumidifier suggested as other large box-shaped appliances, and a clothes dryer
suggested as a washing machine. These observations were retained, not removed
from the denominator or used to retune the frozen rule. Confirmation and manual
choice remain necessary. This candidate is available for local review, not
approved for public release. Blur and multiple-item reliability are not
established by this test.

The [actual Chrome run](explore-ai32-browser-holdout-v2.json) checked all 135
reserved samples through the real browser classifier. It offered the correct
category in 116/120 appliance photos, gave two wrong choice sets, and declined
two supported photos. All 15 rejection controls were declined. The dehumidifier
and dryer errors remained; Chrome included the hair dryer among its choices and
accepted the tablet. Node and Chrome use different image-processing/runtime
paths, so their observed results are reported separately rather than pooled.
No acceptance values changed between these runs. The browser harness does not
exercise the operating system's file chooser; picker/drop/preview/confirmation
behavior is covered by the separate UI tests.

### Local verification

- `npm.cmd run check`: 557 tests passed, none skipped.
- Explore page plus photo-helper tests: 46 passed, including the 32-category
  picker, all 20 missing-model states, drag/drop cancellation and paused feedback.
- Explore classifier tests: 14 passed, none skipped (also included in npm check).
- Relevant Flask app, Quest, access, world-route and release tests: 57 passed.
- Script syntax checks and `git diff --check` passed.
- Actual Chrome: grouped catalogue selection, a new-item missing-model state,
  enabled photo panel and the 135-photo model run verified.

Take action's classifier files, model directory and backend have no diff. This
preview adds no device-counting, completed 3D lessons or public deployment.

## Optional browser evaluation

Prepare public test fixtures from the frozen dataset, then opt in to the three
local harness URLs. No arbitrary local-file or dataset-directory route is served.

```powershell
python scripts/prepare-explore-browser-fixture.py --manifest tmp/explore-ai32/dataset/manifest.json --split holdout --output tmp/explore-ai32/browser-samples.json
$env:FF_EXPLORE_TEST_MODE = '1'
$env:FF_WORLD_PORT = '5580'
node prototypes/i3-world-preview/serve.mjs
```

Open `http://127.0.0.1:5580/__explore-test/`. The button runs the real application
classifier over the complete selected partition. Exported evidence records the
candidate, text manifest hash, acceptance values and every offered choice set.
The research fixture URLs are local-only and are not Flask deployment routes.

This work has no Git push, Render deployment, Main promotion, shared database
write or change to the approved Take action classifier.
