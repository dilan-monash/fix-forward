"""Evaluate an Apache-2.0 SigLIP 2 zero-shot teacher on a supplied benchmark.

This offline research script does not change the website model. It tests whether
a stronger vision-language teacher can improve category coverage enough to
justify a later, separately measured browser prototype. General ImageNet scores
are never substituted for FixForward appliance evidence.
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path

import torch
from PIL import Image
from transformers import AutoModel, AutoProcessor

from appliance_model_prompts import CLASS_PROMPTS, OOD_PROMPTS


def parse_args() -> argparse.Namespace:
    """Require explicit benchmark paths and keep the model revision visible."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--audited-summary", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--model", default="google/siglip2-base-patch32-256")
    parser.add_argument("--revision", default="main")
    parser.add_argument("--batch-size", type=int, default=8)
    return parser.parse_args()


def crop_for_sample(sample: dict) -> Image.Image:
    """Use the reviewed Open Images crop or the complete catalogue photo."""
    image = Image.open(sample["downloaded_jpeg"]).convert("RGB")
    crop = sample.get("expanded_crop_pixels")
    return image.crop(tuple(crop)) if crop else image


def batches(items: list[dict], size: int):
    """Keep CPU memory bounded while evaluating a large research model."""
    for start in range(0, len(items), size):
        yield items[start:start + size]


def main() -> None:
    """Run normalized image/text similarity and write auditable predictions."""
    args = parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    audit = json.loads(args.audited_summary.read_text(encoding="utf-8"))
    audited_ids = audit["audited_operational_positive_ids"]
    audited_ood_ids = set(audit["audited_ood_ids"])
    device = "cuda" if torch.cuda.is_available() else "cpu"
    processor = AutoProcessor.from_pretrained(args.model, revision=args.revision)
    model = AutoModel.from_pretrained(args.model, revision=args.revision)
    model.to(device).eval()

    labels = [*CLASS_PROMPTS, *OOD_PROMPTS]
    prompts = [*CLASS_PROMPTS.values(), *OOD_PROMPTS.values()]
    text_inputs = processor(
        text=prompts, padding="max_length", return_tensors="pt"
    ).to(device)
    with torch.inference_mode():
        text_features = model.get_text_features(**text_inputs)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)

    rows = []
    for group in batches(manifest["samples"], args.batch_size):
        images = [crop_for_sample(sample) for sample in group]
        image_inputs = processor(images=images, return_tensors="pt").to(device)
        started = time.perf_counter()
        with torch.inference_mode():
            image_features = model.get_image_features(**image_inputs)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            similarities = (image_features @ text_features.T).cpu()
        per_image_ms = (time.perf_counter() - started) * 1000 / len(group)
        for sample, scores in zip(group, similarities):
            ranked = torch.argsort(scores, descending=True).tolist()
            positive = [index for index in ranked if labels[index] in CLASS_PROMPTS]
            ood = [index for index in ranked if labels[index] in OOD_PROMPTS]
            rows.append({
                "image_id": sample["image_id"],
                "kind": sample["kind"],
                "expected": audited_ids.get(sample["image_id"], sample.get("expected")),
                "ood_class": sample.get("ood_class"),
                "top_five": [
                    {"label": labels[index], "score": float(scores[index])}
                    for index in ranked[:5]
                ],
                "top_positive": {
                    "label": labels[positive[0]], "score": float(scores[positive[0]])
                },
                "top_ood": {"label": labels[ood[0]], "score": float(scores[ood[0]])},
                "positive_margin": float(scores[positive[0]] - scores[positive[1]]),
                "ood_margin": float(scores[positive[0]] - scores[ood[0]]),
                "inference_ms": per_image_ms,
            })

    positives = [row for row in rows if row["image_id"] in audited_ids]
    ood_rows = [row for row in rows if row["image_id"] in audited_ood_ids]
    summary = {
        "audited_operational_positives": {
            "n": len(positives),
            "top1_correct": sum(
                row["top_positive"]["label"] == row["expected"] for row in positives
            ),
            "top1_accuracy": sum(
                row["top_positive"]["label"] == row["expected"] for row in positives
            ) / len(positives),
        },
        "ood_top_level": {
            "n": len(ood_rows),
            "top_prompt_was_ood": sum(
                row["top_five"][0]["label"] in OOD_PROMPTS for row in ood_rows
            ),
        },
        "timing_ms": {
            "median": statistics.median(row["inference_ms"] for row in rows),
            "p95": sorted(row["inference_ms"] for row in rows)[
                max(0, int(len(rows) * 0.95) - 1)
            ],
        },
    }
    report = {
        "evaluation": "siglip2-zero-shot-teacher-baseline-v1",
        "release_ready": False,
        "scope": "Offline teacher benchmark; no browser bundle or calibrated release claim.",
        "model": args.model,
        "requested_revision": args.revision,
        "resolved_revision": getattr(model.config, "_commit_hash", None),
        "device": device,
        "class_prompts": CLASS_PROMPTS,
        "ood_prompts": OOD_PROMPTS,
        "summary": summary,
        "rows": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
