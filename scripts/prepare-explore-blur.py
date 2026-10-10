"""Create a repeat-condition blur check, never additional independent photos.

The original holdout identities and licences are preserved. No classifier result
is consulted, and the frozen policy must not be tuned against these derivatives.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument("--manifest", type=Path, required=True)
parser.add_argument("--output-dir", type=Path, required=True)
args = parser.parse_args()
source_bytes = args.manifest.read_bytes()
source = json.loads(source_bytes)
# Refuse overwrite so a new run cannot silently replace previously scored pixels.
args.output_dir.mkdir(parents=True, exist_ok=False)
image_dir = args.output_dir / "images"
image_dir.mkdir()
samples = []
for row in source["samples"]:
    if row["split"] != "holdout":
        continue
    source_path = args.manifest.parent / row["image_path"]
    if hashlib.sha256(source_path.read_bytes()).hexdigest() != row["sha256"]:
        raise ValueError(f"Source photo changed: {row['id']}")
    with Image.open(source_path) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        image = image.filter(ImageFilter.GaussianBlur(radius=2.5))
        output = image_dir / f"{row['id']}.png"
        image.save(output, format="PNG")
    sample = dict(row)
    sample.update({
        "id": row["id"] + "-blur-2p5",
        "original_id": row["id"],
        "original_sha256": row["sha256"],
        "image_path": output.relative_to(args.output_dir).as_posix(),
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "condition": "Gaussian radius 2.5 after max-side 512px; same holdout source identity",
    })
    samples.append(sample)
manifest = {
    "dataset_id": "explore-repeat-condition-blur-v1",
    "source_manifest_sha256": hashlib.sha256(source_bytes).hexdigest(),
    "limitation": "Synthetic corruption of previously tested identities; not new independent test images.",
    "samples": samples,
}
(args.output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(f"Created {len(samples)} blur derivatives; no thresholds changed.")
