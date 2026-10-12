# Explore AI photo dataset: first 16 items

This local dataset supports the separate Explore recognizer. It does not alter
Take action's 19-class model, retrain any image-encoder weights, or establish a
production accuracy claim. Prepared on 10 October 2026.

## What was collected and checked

The frozen collection has **157 real source photographs plus four deliberately
synthetic rejection controls**:

| Purpose | Calibration | Held-out partition | Total |
|---|---:|---:|---:|
| Supported item photos | 64 | 64 | 128 |
| Unsupported appliance photos | 8 | 6 | 14 |
| Unrelated household photos | 9 | 6 | 15 |
| Synthetic black/gray/white/seeded-noise controls | 0 | 4 | 4 |

There are eight supported photos for each of kettle, toaster, fan, microwave,
blender, rice cooker, air fryer, coffee machine, mixer, vacuum cleaner, hair dryer,
laptop, smartphone, tablet, television and washing machine. Each item has four
calibration and four held-out photos. Unsupported controls include food
processors, portable heaters, dehumidifiers, shavers, sandwich presses and a
portable air conditioner. Unrelated controls include bags, shoes, bottles,
dishware, chairs and soft toys.

Of the real source photos, **115 were already in earlier development collections**
and **42 were newly collected** for this work. Those 42 comprise eight examples
of each of the five newly introduced device classes plus two air fryers. The
previously used photos remain development evidence, even in this dataset's
held-out partition. Their upstream pool had previously used model-assisted
selection; the present sample selection did not consult Explore predictions.

The assistant visually inspected contact sheets for 387 candidates, excluding
irrelevant search hits, screenshots/illustrations, insufficient whole-object
views and redundant examples. This was **AI-assisted visual review, not
independent human annotation**. The frozen manifest's historical method string
`manual contact-sheet pixel review` means explicit image-by-image assistant
inspection, not a human labeller. It has deliberately not been edited after
inference began, so the captured manifest hash remains reproducible.

No Explore prediction scores were viewed before the selection and split were
frozen. Exact source identities are isolated across splits. Two obvious ABO
colour-variant product families were additionally grouped together. All image
hashes were verified, with no byte-identical duplicate images. Similar poses,
shared brands, unrecognised source relatives and the image encoder's original
pretraining data can still overlap; this is not a fully independent benchmark.

## Where the evidence is

- Frozen manifest: `tmp/explore-ai/dataset/manifest.json`
- SHA-256: `6ccced93afdb1a3d7983fdeb314c789da1b2df7be487b0131673d33ba3749f87`
- Metadata-only review snapshot: `docs/explore-ai-dataset-sources-v1.json`
- Candidate audit decisions: `tmp/explore-ai/dataset/visual-review.json`
- Source API snapshots: `tmp/explore-ai/dataset/sources/`
- Pixel review sheets: `tmp/explore-ai/dataset/contact-sheets/`
- Images: `tmp/explore-ai/dataset/images/`
- Preparation script: `scripts/prepare-explore-ai-data.py`

The `samples` array records `id`, `slug`, `kind`, `split`, `image_path`, `sha256`,
`source_group`, source URLs, licence/attribution and `reused_development` status.
`image_path` is relative to the directory containing the manifest. `slug` is null
for controls; `label` describes their source category rather than an active
Explore output. Model scoring should read only the calibration partition while
choosing thresholds, freeze the policy, then open the held-out partition once.

Raw images and full API snapshots stay local under ignored `tmp/`. They must not
be added to the application's deployed assets. The source-control metadata snapshot
contains provenance and hashes only; no image pixels, account data or secrets.

## Licences and attribution

Sources retain per-file licences and links in the metadata. Openverse is a
discovery index, not the photographer or licensor; the source page and credited
creator remain authoritative. Newly downloaded thumbnails were resized as needed,
EXIF-oriented, converted to RGB and encoded as JPEG for bounded local evaluation.
Previously collected ABO/Openverse images were copied unchanged.

- [Amazon Berkeley Objects](https://amazon-berkeley-objects.s3.amazonaws.com/index.html)
  supplies 46 photographs under CC BY 4.0. Image credit: **Amazon.com**. Dataset
  construction credit: Matthieu Guillaumin, Thomas Dideriksen, Kenan Deng,
  Himanshu Arora, Arnab Dhua, Xi (Brian) Zhang, Tomas Yago-Vicente, Jasmine Collins,
  Shubham Goel and Jitendra Malik. These are catalogue photographs, not generated
  synthetic benchmark images.
- [Openverse API](https://api.openverse.org/v1/images/) provided per-file source,
  creator and licence metadata for Wikimedia Commons, Flickr, StockSnap,
  Museums Victoria and Rawpixel photos. Per-file links are in the snapshot.
- [Wikimedia Commons API](https://commons.wikimedia.org/w/api.php) supplied nine
  supplemental photos and their explicit licence metadata. CC BY, CC BY-SA,
  CC0 and public-domain markings are retained individually.

The four synthetic controls are project-authored arrays: solid black, gray,
white and deterministic random RGB pixels (seed 20261010). They test rejection
of non-photographs and must never inflate the real-photo accuracy denominator.

## Reproducing preparation

Use an E: drive checkout and Python with Pillow and requests. The script's `OLD`
constant identifies the read-only earlier collection; update it if moving
machines. It never modifies that collection or connects to a database.

```powershell
python scripts/prepare-explore-ai-data.py collect
# Inspect the new contact sheets, then record acceptance/rejection decisions.
python scripts/prepare-explore-ai-data.py finalize
```

Public search results can change, so repeating collection is a **new dataset
version**, not regeneration of the frozen byte-identical benchmark. Use the
frozen manifest/source URLs and recorded hashes when auditing this version.
Do not rerun `finalize` over the frozen manifest after viewing held-out results.

This small convenience sample overrepresents catalogue images and older devices,
especially televisions. It does not prove robustness to blur, occlusion,
multiple items, unusual devices, all demographics or every real home. Those need
separately reported tests and future human review.
