"""Convert a selected split manifest into the common benchmark format.

This lets large offline teacher models use exactly the same calibration photos
as the compact student models. It never moves items between splits and writes a
separate audit mapping, so threshold selection remains distinct from external
Open Images and ABO tests.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    """Require the split name rather than silently defaulting to training."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--selected-manifest", required=True, type=Path)
    parser.add_argument("--split", required=True, choices=[
        "train", "model_selection", "calibration"
    ])
    parser.add_argument("--output-dir", required=True, type=Path)
    return parser.parse_args()


def stable_id(row: dict) -> str:
    """Use the original image identifier with content hash as fallback."""
    value = row.get("openverse_id") or row.get("image_id") or row.get("sha256")
    if not value:
        raise SystemExit("Selected row has no stable image identifier.")
    return str(value)


def main() -> None:
    """Write one benchmark manifest and its explicit operational audit."""
    args = parse_args()
    rows = [
        json.loads(line)
        for line in args.selected_manifest.read_text(encoding="utf-8").splitlines()
        if line
    ]
    selected = [row for row in rows if row["experiment_split"] == args.split]
    samples = []
    positives = {}
    ood_ids = []
    rejected_supported_challenges = {}
    for row in selected:
        image_id = stable_id(row)
        positive = (
            row.get("kind") == "supported"
            and row.get("review_status") != "rejected"
        )
        # A supported-search result can be rejected because it is an
        # illustration, package or close crop. That training-quality decision
        # does not prove the subject is outside the supported appliance set, so
        # keep it as a separate challenge instead of contaminating OOD labels.
        supported_challenge = (
            row.get("kind") == "supported"
            and row.get("review_status") == "rejected"
        )
        expected = row.get("candidate_label") if positive or supported_challenge else None
        samples.append({
            "image_id": image_id,
            "kind": (
                "positive" if positive
                else "supported_challenge" if supported_challenge
                else "ood"
            ),
            "expected": expected,
            "ood_class": (
                row.get("candidate_label")
                if row.get("kind") == "ood"
                else None
            ),
            "downloaded_jpeg": row["local_path"],
            "source_url": row.get("landing_url") or row.get("url"),
            "license": row.get("license"),
        })
        if positive:
            positives[image_id] = expected
        elif supported_challenge:
            rejected_supported_challenges[image_id] = expected
        else:
            ood_ids.append(image_id)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "benchmark": f"fixforward-{args.split}-threshold-data-v1",
        "selection": (
            "Copied without relabelling from the group-safe selected data manifest; "
            "supported rejects remain challenge rows rather than semantic OOD."
        ),
        "samples": samples,
    }
    audit = {
        "audited_operational_positive_ids": positives,
        "audited_ood_ids": ood_ids,
        "rejected_supported_challenge_ids": rejected_supported_challenges,
    }
    (args.output_dir / "sample-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    (args.output_dir / "audited-summary.json").write_text(
        json.dumps(audit, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "split": args.split,
        "positive": len(positives),
        "ood": len(ood_ids),
        "supported_challenge": len(rejected_supported_challenges),
    }, indent=2))


if __name__ == "__main__":
    main()
