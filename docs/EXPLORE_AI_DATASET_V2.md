# Explore 32-item image evidence, version 2

This is a small, source-grouped calibration and evaluation collection for the
separate **Explore** recognizer. It does not train image-model weights, measure
general real-world accuracy, or alter Take action's 19-appliance collection.
All work is local in `E:\FixForward-I3-Explore-AI`; no deployment is implied.

The immutable manifest is `tmp/explore-ai32/dataset/manifest.json`. Its exact
metadata-only copy is [explore-ai32-dataset-sources-v2.json](explore-ai32-dataset-sources-v2.json).
Both have SHA-256:

`ac70b21e9a64f9058562190355133701d03266e91f01dba305d9ab40e7eaae67`

## What is included

There are **274 samples: 244 supported-device photographs, 26 real unrelated
photographs, and four explicitly synthetic rejection controls**. These are
development/evaluation samples, not a new independent benchmark.

| Sample group | Calibration | Holdout | Total |
| --- | ---: | ---: | ---: |
| Supported devices | 124 | 120 | 244 |
| Real unrelated objects/electronics | 15 | 11 | 26 |
| Black, gray, white, seeded-noise controls | 0 | 4 | 4 |
| All samples | 139 | 135 | 274 |

The first 16 categories retain their original eight photographs and 4/4
partition: kettle, toaster, fan, microwave, blender, rice cooker, air fryer,
coffee machine, mixer, vacuum cleaner, hair dryer, laptop, smartphone, tablet,
television, and washing machine. All 128 were previously opened during v1
development. They must never be described as fresh independent validation.

| Added category | Calibration | Holdout | Total |
| --- | ---: | ---: | ---: |
| Refrigerator | 4 | 4 | 8 |
| Food processor | 4 | 4 | 8 |
| Sandwich press | 4 | 4 | 8 |
| Portable heater | 4 | 4 | 8 |
| Portable air conditioner | 4 | 4 | 8 |
| Dehumidifier | 4 | 4 | 8 |
| Headphones | 4 | 4 | 8 |
| Games console | 4 | 4 | 8 |
| Printer | 2 | 1 | 3 |
| Steam cleaner | 2 | 1 | 3 |
| Clothes dryer | 4 | 3 | 7 |
| Hair straightener | 4 | 4 | 8 |
| Electric shaver | 4 | 4 | 8 |
| Electric toothbrush | 4 | 4 | 8 |
| Cordless drill | 4 | 4 | 8 |
| Sewing machine | 4 | 3 | 7 |

Twenty-eight categories have eight photographs. Four have documented shortfalls:
printer and steam cleaner each have three; clothes dryer and sewing machine each
have seven. In particular, one held-out steam-cleaner or printer image cannot
support a category-accuracy claim. Repeated angles, incorrect labels, unlicensed
photos, drawings, and replacement parts were not used merely to fill quotas.

Of the 270 real photographs, **196 are reused development sources and 74 are newly
collected sources**. The added 16 classes contain 53 reused and 63 newly collected
photos. The additional 11 electronic negatives are newly collected. Downloading
an old source again does not make it unseen; matching old original URLs is checked.

The 26 real negatives include the original 15 unrelated photos plus three desktop
monitors, four remote controls, and four computer mice. One monitor is a damaged
CRT; this is a recognition rejection check, not a safety assessment. The four
synthetic images are also reused and are never counted as real photographs.

## Review and separation

Selection used source descriptions, licence metadata, actual contact-sheet
pixels, and selected full-size photographs. **Review was performed by AI
assistants, not independent human annotators.** No Explore-32 prediction or score
was consulted when selecting or rejecting a sample. Parent evaluation must freeze
the recognition policy using calibration evidence before inspecting holdout
results. Once outputs have been opened, the holdout becomes used evidence for
future revisions.

`image_path` is relative to the manifest directory. `slug` is the expected class
for supported devices and `null` for rejection controls. `sha256` identifies the
exact decoded/resized local image bytes; `source_group` keeps photographs of the
same physical/source family together. `original_url`, `source_url`, creator,
licence, licence URL and source asset ID retain attribution/provenance. Each
selected row carries its visual-review note and reuse flag.

The freeze checks every image hash, unique IDs/bytes, valid partitions, source
families and original-image URLs across partitions, source/licence evidence, and
at least one calibration and holdout sample per class. Original v1 partitions
stay unchanged. Recognisable food-processor colour variants are grouped together.
Some prior blender and mixer photos also share a family within one partition.

This does not prove that all web near-duplicates or undisclosed product-family
relationships were discovered. Console examples largely share a photographer
and isolated-background style. Dryer examples include commercial machines;
some dehumidifiers are commercial. Toothbrush examples include a travel kit with
detached heads. Several appliances are photographed in use. These limitations
belong alongside any evaluation numbers.

## Sources, attribution and reproducibility

New images came from Wikimedia Commons file records via the official
[MediaWiki image-information API](https://www.mediawiki.org/wiki/API:Imageinfo).
Each accepted file's page URL and CC BY, CC BY-SA, CC0 or public-domain evidence
are in the metadata snapshot. Attribution fields can contain source-provided
HTML: treat them as data and escape them if ever displayed in a website.

Reused files come from the prior project collection, including Wikimedia,
Flickr, StockSnap, Museums Victoria, Rawpixel and
[Amazon Berkeley Objects](https://amazon-berkeley-objects.s3.amazonaws.com/index.html).
ABO images retain Amazon.com attribution and CC BY 4.0 source metadata. See the
[v1 dataset document](EXPLORE_AI_DATASET.md) for its original collection provenance
and fuller ABO attribution. Existing images and public API metadata were reused;
no private account, production database or paid image source was accessed.

Preparation code is [prepare-explore32-data.py](../scripts/prepare-explore32-data.py).
Its `collect` stage copies v1/old licensed candidates and queries Commons;
`supplements` recreates the bounded extra searches. Review decisions are then
recorded explicitly before `freeze`. The script refuses every stage once a
frozen manifest exists. For new experiments, create a new dataset version rather
than overwriting v2. Network search results can change: exact accepted evidence
is identified by the frozen source metadata and SHA-256 values, not current
search ranking or titles alone.

Local audit artifacts are retained in the ignored dataset folder:

- `candidates.json` and `candidates/`: raw candidate metadata and selected controls.
- `visual-review.json`: accepted/rejected IDs with reasons and family overrides.
- `ui-class-visual-review.json`: headphones, consoles, printers and sewing review.
- `electronic-controls-root-review.json`: monitor, remote and mouse review.
- `sources/steam-extra-review.json`: bounded steam search receipts and licence gaps.
- `contact-sheets/`: labelled images used for direct pixel review.
- `sources/`: public API source snapshots.
- `images/`: exact local samples; these are not committed to Git.

The old dataset manifest remains unchanged at SHA-256
`6ccced93afdb1a3d7983fdeb314c789da1b2df7be487b0131673d33ba3749f87`.
Model scores, calibration decisions and browser results belong in separate
evaluation reports; this document makes no inference-performance claim.
