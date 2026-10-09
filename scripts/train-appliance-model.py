"""Train an experimental appliance classifier with an explicit unknown class.

The script never overwrites the website model. It writes a checkpoint and
validation report to a caller-supplied development directory. Human-approved
labels are required by default; ``--allow-teacher-priority`` exists only for an
experimental baseline and its report is marked accordingly.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import platform
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw
from torch import nn
from torch.utils.data import ConcatDataset, DataLoader, Dataset, WeightedRandomSampler
from appliance_model_training import (
    MODEL_LABELS, SUPPORTED_LABELS, UNKNOWN_LABEL, make_model,
    transforms_for_training,
)


def parse_args() -> argparse.Namespace:
    """Keep every potentially expensive or weakly supervised choice explicit."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--allow-teacher-priority", action="store_true")
    parser.add_argument("--allow-dataset-labels", action="store_true")
    parser.add_argument("--seed", type=int, default=5120)
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--head-epochs", type=int, default=12)
    parser.add_argument("--fine-tune-epochs", type=int, default=2)
    parser.add_argument("--synthetic-ood", type=int, default=300)
    parser.add_argument("--minimum-release-confidence", type=float, default=0.60)
    parser.add_argument("--workers", type=int, default=0)
    return parser.parse_args()


def read_jsonl(path: Path) -> list[dict]:
    """Read complete provenance rows; malformed input should stop training."""
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def usable_row(row: dict, allow_teacher: bool, allow_dataset: bool) -> bool:
    """Enforce review and dataset-label boundaries explicitly.

    Human rejections are useful unknown examples and remain usable without a
    teacher flag. Structured-dataset labels are kept separate from human
    approval so reports cannot imply that a product catalogue was hand checked.
    """
    if row.get("review_status") == "approved":
        return True
    if row.get("review_status") == "rejected":
        return True
    if row.get("review_status") == "dataset_exact_label":
        return allow_dataset
    if not allow_teacher:
        return False
    # Explicitly rejected search matches are useful reject examples: food-only
    # shots, icons, instructions and unrelated scenes should not be classified.
    if row.get("kind") == "ood":
        # OOD queries are deliberately broad. Include all of them in this
        # experimental run so the unknown class is not limited by CLIP prompts.
        return True
    if not row.get("teacher_priority"):
        return False
    if row.get("kind") == "supported":
        # For pseudo-labelled experiments, require CLIP's top supported label to
        # agree with the search label and to beat its best OOD prompt.
        return (
            row.get("top_positive", {}).get("label") == row.get("candidate_label")
            and float(row.get("ood_margin", -1)) > 0
        )
    return False


def row_label(row: dict) -> str:
    """Map reviewed rejects and OOD queries to the explicit unknown target."""
    if row.get("review_status") == "rejected" or row.get("kind") == "ood":
        return UNKNOWN_LABEL
    return row["candidate_label"]


def image_dhash(path: str) -> str:
    """Return a small perceptual hash that groups re-encoded duplicate images."""
    with Image.open(path) as opened:
        grayscale = opened.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = np.asarray(grayscale, dtype=np.uint8).reshape(-1).tolist()
    bits = 0
    for row in range(8):
        for column in range(8):
            bits = (bits << 1) | (
                pixels[row * 9 + column] > pixels[row * 9 + column + 1]
            )
    return f"{bits:016x}"


def source_identity(row: dict) -> str:
    """Prefer the underlying product or landing page over API result IDs."""
    for key in ("source_item_id", "item_id", "landing_url", "original_url", "openverse_id"):
        if row.get(key):
            return f"{row.get('source', '')}|{key}|{row[key]}"
    return f"sha256|{row.get('sha256', '')}"


def asset_identity(row: dict) -> str:
    """Identify one source image even when it appears under two search terms."""
    for key in ("openverse_id", "image_id", "sha256"):
        if row.get(key):
            return f"{row.get('source', '')}|{key}|{row[key]}"
    return source_identity(row)


def deduplicate_assets(rows: list[dict]) -> list[dict]:
    """Resolve repeated source images before their labels can conflict.

    A reviewed or exact positive wins over a duplicate row explicitly rejected
    from another search query. Conflicting positive labels still stop training.
    Repeated unknown rows are represented once.
    """
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[asset_identity(row)].append(row)
    selected = []
    for identity, group in grouped.items():
        positives = [row for row in group if row_label(row) != UNKNOWN_LABEL]
        positive_labels = {row_label(row) for row in positives}
        if len(positive_labels) > 1:
            raise SystemExit(
                f"One source image has conflicting positive labels {sorted(positive_labels)}: {identity}"
            )
        if positives:
            # Keep all views only when they are genuinely distinct manifest
            # rows; the same asset ID normally reduces to one record here.
            selected.append(sorted(
                positives,
                key=lambda row: (row.get("review_status") != "approved", row.get("sha256", "")),
            )[0])
        else:
            selected.append(sorted(group, key=lambda row: row.get("sha256", ""))[0])
    return selected


def add_split_groups(rows: list[dict]) -> list[dict]:
    """Bind products and visually identical re-encodes to one split group.

    If a perceptual duplicate appears with conflicting targets, training stops
    instead of allowing the same pixels to teach two different answers.
    """
    by_dhash_and_label: dict[tuple[str, str], list[dict]] = defaultdict(list)
    prepared = []
    for row in deduplicate_assets(rows):
        enriched = {**row, "perceptual_dhash": image_dhash(row["local_path"])}
        prepared.append(enriched)
        by_dhash_and_label[(
            enriched["perceptual_dhash"], row_label(enriched)
        )].append(enriched)
    duplicate_groups = {
        key for key, group in by_dhash_and_label.items() if len(group) > 1
    }
    for row in prepared:
        duplicate_key = (row["perceptual_dhash"], row_label(row))
        if duplicate_key in duplicate_groups:
            row["split_group"] = (
                f"dhash|{row_label(row)}|{row['perceptual_dhash']}"
            )
        else:
            row["split_group"] = source_identity(row)
    return prepared


def split_rows(rows: list[dict], allow_teacher: bool,
               allow_dataset: bool) -> tuple[list[dict], list[dict], list[dict]]:
    """Create group-safe train, model-selection and calibration splits.

    Thresholds are calibrated on a third split rather than the data used to
    choose the best epoch. Each target needs at least three independent groups.
    """
    selected = add_split_groups([
        row for row in rows
        if usable_row(row, allow_teacher, allow_dataset)
    ])
    labels_by_group: dict[str, set[str]] = defaultdict(set)
    for row in selected:
        labels_by_group[row["split_group"]].add(row_label(row))
    conflicting = {
        group: labels for group, labels in labels_by_group.items() if len(labels) > 1
    }
    if conflicting:
        example = next(iter(conflicting.items()))
        raise SystemExit(f"A source group has conflicting labels: {example}")

    grouped: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for row in selected:
        grouped[row_label(row)][row["split_group"]].append(row)
    outputs = {"train": [], "selection": [], "calibration": []}
    for label, groups in grouped.items():
        ordered_groups = sorted(
            groups,
            key=lambda value: hashlib.sha256(value.encode("utf-8")).hexdigest(),
        )
        if len(ordered_groups) < 3:
            raise SystemExit(
                f"Need three independent source groups for {label}; found {len(ordered_groups)}."
            )
        # Use two calibration products once a class has enough independent
        # groups. One lucky photo must not certify a category by itself.
        calibration_count = max(
            2 if len(ordered_groups) >= 5 else 1,
            round(len(ordered_groups) * 0.15),
        )
        selection_count = max(1, round(len(ordered_groups) * 0.15))
        # Always leave at least one model-selection and two training groups
        # whenever the class has five or more independent products.
        minimum_train = 2 if len(ordered_groups) >= 5 else 1
        calibration_count = min(
            calibration_count,
            len(ordered_groups) - selection_count - minimum_train,
        )
        calibration_groups = set(ordered_groups[:calibration_count])
        selection_groups = set(ordered_groups[
            calibration_count:calibration_count + selection_count
        ])
        for group_id in ordered_groups:
            destination = (
                "calibration" if group_id in calibration_groups
                else "selection" if group_id in selection_groups
                else "train"
            )
            outputs[destination].extend(groups[group_id])
    return outputs["train"], outputs["selection"], outputs["calibration"]


class ImageRows(Dataset):
    """Decode reviewed files lazily so training does not keep all pixels in RAM."""

    def __init__(self, rows: list[dict], transform) -> None:
        self.rows = rows
        self.transform = transform

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        with Image.open(row["local_path"]) as opened:
            image = opened.convert("RGB")
        identity = (
            row.get("openverse_id") or row.get("image_id")
            or row.get("sha256") or row["split_group"]
        )
        return self.transform(image), MODEL_LABELS.index(row_label(row)), identity


class SyntheticUnknown(Dataset):
    """Generate repeatable blanks, noise, grids and gradients as obvious OOD."""

    def __init__(self, count: int, transform, seed: int) -> None:
        self.count = count
        self.transform = transform
        self.seed = seed

    def __len__(self) -> int:
        return self.count

    def __getitem__(self, index: int):
        rng = np.random.default_rng(self.seed + index)
        size = 256
        mode = index % 5
        if mode == 0:
            array = np.full((size, size, 3), rng.integers(0, 256, size=3), dtype=np.uint8)
        elif mode == 1:
            array = rng.integers(0, 256, size=(size, size, 3), dtype=np.uint8)
        elif mode == 2:
            cell = int(rng.choice([1, 4, 8, 16, 32]))
            grid = ((np.indices((size, size)).sum(axis=0) // cell) % 2 * 255).astype(np.uint8)
            array = np.repeat(grid[:, :, None], 3, axis=2)
        elif mode == 3:
            x = np.linspace(0, 255, size, dtype=np.uint8)
            x_grid, y_grid = np.meshgrid(x, x)
            array = np.stack((x_grid, y_grid, np.full((size, size), 128, np.uint8)), axis=2)
        else:
            image = Image.new("RGB", (size, size), tuple(int(v) for v in rng.integers(0, 256, size=3)))
            draw = ImageDraw.Draw(image)
            for _ in range(30):
                x1, y1, x2, y2 = (int(v) for v in rng.integers(0, size, size=4))
                points = (min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2))
                colour = tuple(int(v) for v in rng.integers(0, 256, size=3))
                draw.rectangle(points, fill=colour)
            return self.transform(image), MODEL_LABELS.index(UNKNOWN_LABEL), f"synthetic-{index}"
        return self.transform(Image.fromarray(array)), MODEL_LABELS.index(UNKNOWN_LABEL), f"synthetic-{index}"


def class_counts(dataset: Dataset) -> Counter:
    """Count targets without decoding images, including synthetic unknowns."""
    counts: Counter = Counter()
    if isinstance(dataset, ConcatDataset):
        for child in dataset.datasets:
            counts.update(class_counts(child))
    elif isinstance(dataset, ImageRows):
        for row in dataset.rows:
            counts[MODEL_LABELS.index(row_label(row))] += 1
    elif isinstance(dataset, SyntheticUnknown):
        counts[MODEL_LABELS.index(UNKNOWN_LABEL)] += len(dataset)
    return counts


def training_loader(dataset: Dataset, batch_size: int, workers: int) -> DataLoader:
    """Balance rare appliance labels without duplicating files on disk."""
    counts = class_counts(dataset)
    sample_weights = []
    for child in dataset.datasets if isinstance(dataset, ConcatDataset) else [dataset]:
        if isinstance(child, ImageRows):
            for row in child.rows:
                label_index = MODEL_LABELS.index(row_label(row))
                # Unknown examples occupy 30% of sampled training items; the
                # remaining 70% is balanced across the 19 supported classes.
                class_probability = 0.30 if label_index == MODEL_LABELS.index(UNKNOWN_LABEL) else 0.70 / len(SUPPORTED_LABELS)
                sample_weights.append(class_probability / max(1, counts[label_index]))
        else:
            unknown_index = MODEL_LABELS.index(UNKNOWN_LABEL)
            sample_weights.extend([0.30 / max(1, counts[unknown_index])] * len(child))
    sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)
    return DataLoader(dataset, batch_size=batch_size, sampler=sampler,
                      num_workers=workers, pin_memory=False)


def set_trainable(model: nn.Module, fine_tune: bool) -> None:
    """Train the head first, then only the final feature blocks at low LR."""
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    if fine_tune:
        for block in list(model.features.children())[-2:]:
            for parameter in block.parameters():
                parameter.requires_grad = True
    for parameter in model.classifier.parameters():
        parameter.requires_grad = True


def run_epoch(model: nn.Module, loader: DataLoader, optimizer,
              loss_function, device: str) -> float:
    """Run one training epoch and return sample-weighted loss."""
    model.train()
    total_loss = 0.0
    total = 0
    for images, labels, _ in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad(set_to_none=True)
        logits = model(images)
        loss = loss_function(logits, labels)
        loss.backward()
        optimizer.step()
        total_loss += float(loss.detach()) * len(labels)
        total += len(labels)
    return total_loss / max(1, total)


def infer(model: nn.Module, loader: DataLoader, device: str) -> list[dict]:
    """Collect validation probabilities needed for transparent calibration."""
    model.eval()
    rows = []
    with torch.inference_mode():
        for images, labels, identities in loader:
            probabilities = torch.softmax(model(images.to(device)), dim=1).cpu()
            top = torch.topk(probabilities, 2, dim=1)
            for index in range(len(labels)):
                rows.append({
                    "id": identities[index],
                    "actual": int(labels[index]),
                    "predicted": int(top.indices[index, 0]),
                    "confidence": float(top.values[index, 0]),
                    "margin": float(top.values[index, 0] - top.values[index, 1]),
                })
    return rows


def threshold_metrics(rows: list[dict], confidence: float, margin: float) -> dict:
    """Measure one threshold pair, including evidence for every class."""
    unknown = MODEL_LABELS.index(UNKNOWN_LABEL)
    accepted = [row for row in rows if row["predicted"] != unknown
                and row["confidence"] >= confidence and row["margin"] >= margin]
    correct = [row for row in accepted if row["predicted"] == row["actual"]]
    ood = [row for row in rows if row["actual"] == unknown]
    ood_false = [row for row in accepted if row["actual"] == unknown]
    positives = [row for row in rows if row["actual"] != unknown]
    per_class = {}
    for label in SUPPORTED_LABELS:
        label_index = MODEL_LABELS.index(label)
        examples = [row for row in positives if row["actual"] == label_index]
        label_accepted = [row for row in accepted if row["actual"] == label_index]
        label_correct = [row for row in label_accepted if row["predicted"] == label_index]
        per_class[label] = {
            "n": len(examples),
            "accepted": len(label_accepted),
            "coverage": len(label_accepted) / len(examples) if examples else 0,
            "accepted_accuracy": (
                len(label_correct) / len(label_accepted) if label_accepted else None
            ),
        }
    class_passes = sum(
        item["n"] >= 2 and item["accepted"] >= 1
        and item["accepted_accuracy"] is not None
        and item["accepted_accuracy"] >= 0.90
        for item in per_class.values()
    )
    metrics = {
        "min_confidence": round(float(confidence), 4),
        "min_margin": round(float(margin), 4),
        "accepted": len(accepted),
        "accepted_accuracy": len(correct) / len(accepted) if accepted else 1.0,
        "positive_coverage": len([row for row in accepted if row["actual"] != unknown]) / len(positives) if positives else 0,
        "ood_false_accept_rate": len(ood_false) / len(ood) if ood else 0,
        "per_class": per_class,
        "classes_passing": class_passes,
        "classes_required": len(SUPPORTED_LABELS),
    }
    metrics["passes_development_gate"] = (
        metrics["accepted_accuracy"] >= 0.95
        and metrics["ood_false_accept_rate"] <= 0.03
        and class_passes == len(SUPPORTED_LABELS)
    )
    return metrics


def calibrate(rows: list[dict], minimum_confidence: float) -> dict:
    """Choose thresholds on calibration data, with per-class evidence floors."""
    candidates = []
    for confidence in np.arange(minimum_confidence, 0.96, 0.05):
        for margin in np.arange(0.05, 0.41, 0.05):
            candidates.append(threshold_metrics(rows, confidence, margin))
    passing = [item for item in candidates if item["passes_development_gate"]]
    if passing:
        return max(passing, key=lambda item: (item["positive_coverage"], item["accepted"]))
    return max(candidates, key=lambda item: (
        item["classes_passing"],
        item["accepted_accuracy"] - item["ood_false_accept_rate"],
        item["positive_coverage"],
    ))


def file_sha256(path: Path) -> str:
    """Fingerprint an input or artifact without loading it all into memory."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def package_versions() -> dict[str, str]:
    """Record the local runtime used for an experimental result."""
    versions = {"python": platform.python_version(), "platform": platform.platform()}
    for package in ("torch", "torchvision", "numpy", "Pillow"):
        try:
            versions[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            versions[package] = "not-installed"
    return versions


def write_selected_manifest(output: Path, splits: dict[str, list[dict]]) -> str:
    """Preserve selected IDs, splits, licences and attribution for audit."""
    rows = []
    for split, items in splits.items():
        for row in items:
            rows.append({**row, "experiment_split": split})
    rows.sort(key=lambda item: (item["experiment_split"], row_label(item), item["split_group"], item.get("sha256", "")))
    output.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8",
    )
    return file_sha256(output)


def main() -> None:
    """Train the experimental artifact and preserve its validation boundary."""
    args = parse_args()
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    rows = read_jsonl(args.manifest)
    train_rows, selection_rows, calibration_rows = split_rows(
        rows, args.allow_teacher_priority, args.allow_dataset_labels
    )
    counts = Counter(
        row_label(row)
        for row in [*train_rows, *selection_rows, *calibration_rows]
    )
    missing = [label for label in SUPPORTED_LABELS if counts[label] < 3]
    if missing:
        raise SystemExit(
            f"Not enough independent reviewed candidates for: {', '.join(missing)}"
        )

    train_transform, validation_transform = transforms_for_training()
    real_train = ImageRows(train_rows, train_transform)
    train_dataset = ConcatDataset([
        real_train,
        SyntheticUnknown(args.synthetic_ood, train_transform, args.seed),
    ])
    selection_dataset = ImageRows(selection_rows, validation_transform)
    calibration_dataset = ImageRows(calibration_rows, validation_transform)
    train_loader = training_loader(train_dataset, args.batch_size, args.workers)
    selection_loader = DataLoader(
        selection_dataset, batch_size=args.batch_size, shuffle=False,
        num_workers=args.workers,
    )
    calibration_loader = DataLoader(
        calibration_dataset, batch_size=args.batch_size, shuffle=False,
        num_workers=args.workers,
    )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = make_model(pretrained=True).to(device)
    loss_function = nn.CrossEntropyLoss(label_smoothing=0.05)
    history = []
    best_state = None
    best_accuracy = -1.0

    phases = [(False, args.head_epochs, 1e-3), (True, args.fine_tune_epochs, 2e-5)]
    epoch_number = 0
    for fine_tune, epochs, learning_rate in phases:
        if epochs <= 0:
            continue
        set_trainable(model, fine_tune)
        optimizer = torch.optim.AdamW(
            (parameter for parameter in model.parameters() if parameter.requires_grad),
            lr=learning_rate, weight_decay=1e-4,
        )
        for _ in range(epochs):
            epoch_number += 1
            loss = run_epoch(model, train_loader, optimizer, loss_function, device)
            selection = infer(model, selection_loader, device)
            accuracy = sum(row["predicted"] == row["actual"] for row in selection) / max(1, len(selection))
            history.append({"epoch": epoch_number, "fine_tune": fine_tune,
                            "loss": loss, "selection_accuracy": accuracy})
            print(json.dumps(history[-1]), flush=True)
            if accuracy > best_accuracy:
                best_accuracy = accuracy
                best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}

    if best_state is None:
        raise SystemExit("No training epoch ran.")
    model.load_state_dict(best_state)
    selection = infer(model, selection_loader, device)
    calibration_predictions = infer(model, calibration_loader, device)
    calibration = calibrate(
        calibration_predictions, args.minimum_release_confidence
    )
    args.output_dir.mkdir(parents=True, exist_ok=True)
    checkpoint = args.output_dir / "efficientnet-b0-unknown.pt"
    torch.save({
        "architecture": "efficientnet_b0",
        "pretrained_weights": "torchvision EfficientNet_B0_Weights.DEFAULT",
        "labels": MODEL_LABELS,
        "state_dict": best_state,
        "input": {"shape": [1, 3, 224, 224], "normalization": "ImageNet"},
        "calibration": calibration,
    }, checkpoint)
    split_manifest = args.output_dir / "selected-data-manifest.jsonl"
    split_manifest_sha256 = write_selected_manifest(
        split_manifest,
        {
            "train": train_rows,
            "model_selection": selection_rows,
            "calibration": calibration_rows,
        },
    )
    licence_counts = Counter(
        str(row.get("license") or "unspecified").lower()
        for row in [*train_rows, *selection_rows, *calibration_rows]
    )
    split_group_counts = {
        name: len({row["split_group"] for row in values})
        for name, values in {
            "train": train_rows,
            "model_selection": selection_rows,
            "calibration": calibration_rows,
        }.items()
    }
    report = {
        "experiment": "efficientnet-b0-explicit-unknown-v3",
        "training_labels": {
            "human_reviewed": True,
            "teacher_priority_allowed": args.allow_teacher_priority,
            "structured_dataset_labels_allowed": args.allow_dataset_labels,
        },
        "release_ready": False,
        "release_blocker": "An independent, domain-valid phone/tablet test set has not passed.",
        "distribution_blocker": (
            "Selected data includes CC BY-SA images; licence treatment for distributed model weights has not been approved."
            if any("by-sa" in name and count for name, count in licence_counts.items())
            else None
        ),
        "device": device,
        "runtime_versions": package_versions(),
        "labels": MODEL_LABELS,
        "selected_counts": counts,
        "selected_licence_counts": licence_counts,
        "source_manifest": args.manifest.as_posix(),
        "source_manifest_sha256": file_sha256(args.manifest),
        "selected_manifest": split_manifest.as_posix(),
        "selected_manifest_sha256": split_manifest_sha256,
        "train_rows": len(train_rows),
        "selection_rows": len(selection_rows),
        "calibration_rows": len(calibration_rows),
        "split_group_counts": split_group_counts,
        "synthetic_train_ood": args.synthetic_ood,
        "history": history,
        "validation_calibration": calibration,
        "selection_predictions": selection,
        "calibration_predictions": calibration_predictions,
        "checkpoint": checkpoint.as_posix(),
        "checkpoint_sha256": file_sha256(checkpoint),
    }
    (args.output_dir / "training-report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({key: report[key] for key in (
        "training_labels", "train_rows", "selection_rows", "calibration_rows",
        "validation_calibration", "checkpoint"
    )}, indent=2))


if __name__ == "__main__":
    main()
