"""Apply explicit contact-sheet decisions to a scored candidate manifest.

Decision files use one-based contact-sheet positions. The ordering is rebuilt
with the same transparent rule as ``score-appliance-training-data.py``. Every
unmentioned candidate remains pending rather than being silently approved.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path


def parse_args() -> argparse.Namespace:
    """Require separate input, decisions and output files for auditability."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--decisions", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def read_jsonl(path: Path) -> list[dict]:
    """Read every non-empty row and preserve its provenance fields."""
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def file_sha256(path: Path) -> str:
    """Fingerprint the exact scored manifest to bind review decisions to it."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def row_id(row: dict) -> str:
    """Use the source's stable image ID, with its content hash as fallback."""
    value = row.get("openverse_id") or row.get("image_id") or row.get("sha256")
    if not value:
        raise SystemExit("A review row has no stable image identifier.")
    return str(value)


def contact_sheet_order(rows: list[dict], kind: str) -> list[dict]:
    """Mirror the scoring script's visual order exactly."""
    if kind == "supported":
        return sorted(rows, key=lambda item: (
            not item["teacher_priority"], -(item["expected_score"] or -1)
        ))
    return sorted(rows, key=lambda item: (
        not item["teacher_priority"], item["ood_margin"]
    ))


def main() -> None:
    """Apply approvals/rejections and emit a summary with no inferred labels."""
    args = parse_args()
    rows = read_jsonl(args.manifest)
    decisions = json.loads(args.decisions.read_text(encoding="utf-8"))
    manifest_sha256 = file_sha256(args.manifest)
    expected_hash = decisions.get("source_manifest_sha256")
    if expected_hash and expected_hash != manifest_sha256:
        raise SystemExit("Decision file does not match the scored manifest hash.")
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in rows:
        grouped[(row["kind"], row["candidate_label"])].append(row)

    changed = []
    resolved_groups = {}
    for key, review in decisions["groups"].items():
        kind, label = key.split("/", 1)
        ordered = contact_sheet_order(grouped[(kind, label)], kind)
        ids = {row_id(row): index for index, row in enumerate(ordered, start=1)}
        approved = {int(index) for index in review.get("approve", [])}
        rejected = {int(index) for index in review.get("reject", [])}
        approved.update(ids[value] for value in review.get("approve_ids", []) if value in ids)
        rejected.update(ids[value] for value in review.get("reject_ids", []) if value in ids)
        missing_ids = (
            set(review.get("approve_ids", [])) | set(review.get("reject_ids", []))
        ) - set(ids)
        if missing_ids:
            raise SystemExit(f"Decision IDs are missing from {key}: {sorted(missing_ids)}")
        if approved & rejected:
            raise SystemExit(f"Overlapping decisions for {key}")
        if approved | rejected and max(approved | rejected) > len(ordered):
            raise SystemExit(f"Decision index exceeds {key} sheet length")
        for index, row in enumerate(ordered, start=1):
            if index in approved:
                row["review_status"] = "approved"
            elif index in rejected:
                row["review_status"] = "rejected"
            else:
                continue
            row["review_source"] = decisions.get("review_source")
            row["review_note"] = review.get("note", "")
            changed.append({"group": key, "index": index,
                            "status": row["review_status"], "id": row_id(row)})
        resolved_groups[key] = {
            "approve_ids": [row_id(ordered[index - 1]) for index in sorted(approved)],
            "reject_ids": [row_id(ordered[index - 1]) for index in sorted(rejected)],
            "note": review.get("note", ""),
        }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8",
    )
    summary = {
        "source_manifest_sha256": manifest_sha256,
        "changed": len(changed),
        "approved": sum(item["status"] == "approved" for item in changed),
        "rejected": sum(item["status"] == "rejected" for item in changed),
        "changes": changed,
    }
    args.output.with_suffix(".summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    # This resolved file is safe to reuse after a rescore because it binds each
    # decision to a source image ID instead of a floating contact-sheet index.
    args.output.with_suffix(".resolved-decisions.json").write_text(
        json.dumps({
            "review_source": decisions.get("review_source"),
            "source_manifest_sha256": manifest_sha256,
            "groups": resolved_groups,
        }, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({key: summary[key] for key in ("changed", "approved", "rejected")}, indent=2))


if __name__ == "__main__":
    main()
