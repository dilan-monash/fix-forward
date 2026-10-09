"""Evaluate a CLIP zero-shot baseline without changing the website model.

This research-only tool reads an explicitly supplied benchmark manifest. It is
useful for deciding whether a larger vision-language model is a worthwhile
teacher for dataset review; its results must not be described as production
accuracy and it never toggles the browser feature flag.
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path

import clip
import torch
from PIL import Image

from appliance_model_prompts import CLASS_PROMPTS, OOD_PROMPTS


def parse_args() -> argparse.Namespace:
    """Read explicit paths so the script never guesses at private photos."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--audited-summary", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--model", default="ViT-B/32")
    return parser.parse_args()


def crop_for_sample(sample: dict) -> Image.Image:
    """Decode the benchmark image and apply its reviewed context crop."""
    image = Image.open(sample["downloaded_jpeg"]).convert("RGB")
    crop = sample.get("expanded_crop_pixels")
    return image.crop(tuple(crop)) if crop else image


def prompt_features(model: torch.nn.Module, device: str) -> tuple[list[str], torch.Tensor]:
    """Encode fixed class and rejection prompts once for every image."""
    labels = [*CLASS_PROMPTS, *OOD_PROMPTS]
    prompts = [*CLASS_PROMPTS.values(), *OOD_PROMPTS.values()]
    tokens = clip.tokenize(prompts).to(device)
    with torch.inference_mode():
        features = model.encode_text(tokens).float()
        features /= features.norm(dim=-1, keepdim=True)
    return labels, features


def predict(model: torch.nn.Module, preprocess, image: Image.Image,
            text_features: torch.Tensor, labels: list[str], device: str) -> dict:
    """Return cosine similarities rather than treating a softmax as certainty."""
    started = time.perf_counter()
    tensor = preprocess(image).unsqueeze(0).to(device)
    with torch.inference_mode():
        image_features = model.encode_image(tensor).float()
        image_features /= image_features.norm(dim=-1, keepdim=True)
        scores = (image_features @ text_features.T).squeeze(0).cpu()
    elapsed_ms = (time.perf_counter() - started) * 1000
    ranked = torch.argsort(scores, descending=True).tolist()
    top = [{"label": labels[index], "score": float(scores[index])} for index in ranked[:5]]
    positive_ranked = [index for index in ranked if labels[index] in CLASS_PROMPTS]
    ood_ranked = [index for index in ranked if labels[index] in OOD_PROMPTS]
    positive = positive_ranked[0]
    runner_up = positive_ranked[1]
    ood = ood_ranked[0]
    return {
        "top_five": top,
        "top_positive": {"label": labels[positive], "score": float(scores[positive])},
        "top_ood": {"label": labels[ood], "score": float(scores[ood])},
        "positive_margin": float(scores[positive] - scores[runner_up]),
        "ood_margin": float(scores[positive] - scores[ood]),
        "inference_ms": elapsed_ms,
    }


def summarise(rows: list[dict], audited_ids: dict[str, str],
              audited_ood_ids: set[str]) -> dict:
    """Report raw and visually audited subsets; do not invent an accept gate."""
    positive = [row for row in rows if row["kind"] == "positive"]
    audited = [row for row in positive if row["image_id"] in audited_ids]
    ood = [row for row in rows if row["image_id"] in audited_ood_ids]

    def accuracy(items: list[dict]) -> dict:
        correct = sum(row["top_positive"]["label"] == row["expected"] for row in items)
        return {"n": len(items), "top1_correct": correct,
                "top1_accuracy": correct / len(items) if items else None}

    return {
        "raw_manifest_positives": accuracy(positive),
        "audited_operational_positives": accuracy(audited),
        "ood_top_level": {
            "n": len(ood),
            "top_prompt_was_ood": sum(row["top_five"][0]["label"] in OOD_PROMPTS for row in ood),
        },
        "timing_ms": {
            "median": statistics.median(row["inference_ms"] for row in rows),
            "p95": sorted(row["inference_ms"] for row in rows)[max(0, int(len(rows) * 0.95) - 1)],
        },
    }


def main() -> None:
    """Run the offline baseline and save enough evidence to reproduce it."""
    args = parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    audited_ids: dict[str, str] = {}
    audited_ood_ids: set[str] = set()
    if args.audited_summary:
        audit = json.loads(args.audited_summary.read_text(encoding="utf-8"))
        audited_ids = audit.get("audited_operational_positive_ids", {})
        audited_ood_ids = set(audit.get("audited_ood_ids", []))

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, preprocess = clip.load(args.model, device=device, jit=False)
    model.eval()
    labels, text_features = prompt_features(model, device)

    rows = []
    for sample in manifest["samples"]:
        result = predict(model, preprocess, crop_for_sample(sample), text_features, labels, device)
        rows.append({
            "image_id": sample["image_id"],
            "kind": sample["kind"],
            "expected": audited_ids.get(sample["image_id"], sample.get("expected")),
            "ood_class": sample.get("ood_class"),
            "source_url": sample.get("source_url", sample.get("url")),
            "license": sample.get("license") or sample.get("provenance", {}).get("License"),
            **result,
        })

    report = {
        "evaluation": "clip-zero-shot-teacher-baseline-v1",
        "scope": ("Research baseline on supplied cropped images. It is not a browser payload, "
                  "calibrated rejection model, or production accuracy claim."),
        "model": args.model,
        "device": device,
        "class_prompts": CLASS_PROMPTS,
        "ood_prompts": OOD_PROMPTS,
        "summary": summarise(rows, audited_ids, audited_ood_ids),
        "rows": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], indent=2))


if __name__ == "__main__":
    main()
