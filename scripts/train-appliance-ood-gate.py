"""Train a compact binary gate for supported versus unknown photographs.

The 19-way classifier answers "which appliance?". This separate gate answers
the earlier question "is this clear photo plausibly one of our supported
appliances?". Keeping the questions separate helps reject sharp but unsupported
objects such as televisions and countertop ovens. It consumes the exact split
manifest emitted by ``train-appliance-model.py`` so products and re-encoded
duplicates cannot cross evaluation boundaries.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw
from torch import nn
from torch.utils.data import ConcatDataset, DataLoader, Dataset, WeightedRandomSampler

from appliance_ood_gate import gate_transforms, make_ood_gate


def parse_args() -> argparse.Namespace:
    """Require the provenance-bearing split manifest and an isolated output."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--split-manifest", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--seed", type=int, default=5120)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--head-epochs", type=int, default=8)
    parser.add_argument("--fine-tune-epochs", type=int, default=4)
    parser.add_argument("--synthetic-unknown", type=int, default=200)
    parser.add_argument("--workers", type=int, default=0)
    return parser.parse_args()


def file_sha256(path: Path) -> str:
    """Fingerprint the exact inputs and checkpoint."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_supported(row: dict) -> int:
    """Map reviewed supported rows to one; rejects and OOD rows to zero."""
    return int(row.get("kind") == "supported" and row.get("review_status") != "rejected")


class PhotoRows(Dataset):
    """Read selected images lazily and return binary labels plus stable IDs."""

    def __init__(self, rows: list[dict], transform) -> None:
        self.rows = rows
        self.transform = transform

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        with Image.open(row["local_path"]) as opened:
            image = opened.convert("RGB")
        identity = row.get("openverse_id") or row.get("image_id") or row.get("sha256")
        return self.transform(image), float(is_supported(row)), str(identity)


class SyntheticUnknown(Dataset):
    """Add blanks, noise, gradients and grids as obvious non-photo inputs."""

    def __init__(self, count: int, transform, seed: int) -> None:
        self.count, self.transform, self.seed = count, transform, seed

    def __len__(self) -> int:
        return self.count

    def __getitem__(self, index: int):
        rng = np.random.default_rng(self.seed + index)
        size = 256
        mode = index % 4
        if mode == 0:
            array = np.full((size, size, 3), rng.integers(0, 256, 3), np.uint8)
        elif mode == 1:
            array = rng.integers(0, 256, (size, size, 3), np.uint8)
        elif mode == 2:
            cell = int(rng.choice([1, 4, 8, 16]))
            grid = ((np.indices((size, size)).sum(0) // cell) % 2 * 255).astype(np.uint8)
            array = np.repeat(grid[:, :, None], 3, axis=2)
        else:
            image = Image.new("RGB", (size, size), tuple(int(v) for v in rng.integers(0, 256, 3)))
            draw = ImageDraw.Draw(image)
            for _ in range(25):
                points = [int(v) for v in rng.integers(0, size, 4)]
                box = (min(points[0], points[2]), min(points[1], points[3]),
                       max(points[0], points[2]), max(points[1], points[3]))
                draw.rectangle(box, fill=tuple(int(v) for v in rng.integers(0, 256, 3)))
            return self.transform(image), 0.0, f"synthetic-{index}"
        return self.transform(Image.fromarray(array)), 0.0, f"synthetic-{index}"


def balanced_loader(dataset: ConcatDataset, rows: list[dict], synthetic: int,
                    batch_size: int, workers: int) -> DataLoader:
    """Sample supported and unknown examples equally during training."""
    labels = [is_supported(row) for row in rows] + [0] * synthetic
    counts = Counter(labels)
    weights = [0.5 / counts[label] for label in labels]
    sampler = WeightedRandomSampler(weights, num_samples=len(weights), replacement=True)
    return DataLoader(dataset, batch_size=batch_size, sampler=sampler,
                      num_workers=workers)


def set_trainable(model: nn.Module, fine_tune: bool) -> None:
    """Fit the head first and then the final visual blocks at a small rate."""
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    if fine_tune:
        for block in list(model.features.children())[-3:]:
            for parameter in block.parameters():
                parameter.requires_grad = True
    for parameter in model.classifier.parameters():
        parameter.requires_grad = True


def infer(model: nn.Module, loader: DataLoader, device: str) -> list[dict]:
    """Return supported probabilities for calibration and audit."""
    model.eval()
    output = []
    with torch.inference_mode():
        for images, labels, identities in loader:
            probabilities = torch.sigmoid(model(images.to(device)).squeeze(1)).cpu()
            for probability, actual, identity in zip(probabilities, labels, identities):
                output.append({"id": identity, "actual": int(actual),
                               "supported_probability": float(probability)})
    return output


def selection_score(rows: list[dict]) -> float:
    """Use balanced accuracy so a large unknown set cannot dominate selection."""
    positive = [row for row in rows if row["actual"] == 1]
    negative = [row for row in rows if row["actual"] == 0]
    tpr = sum(row["supported_probability"] >= 0.5 for row in positive) / max(1, len(positive))
    tnr = sum(row["supported_probability"] < 0.5 for row in negative) / max(1, len(negative))
    return (tpr + tnr) / 2


def calibrate(rows: list[dict]) -> dict:
    """Choose the broadest gate with at least 95% precision and <=3% OOD FAR."""
    candidates = []
    for threshold in np.arange(0.50, 0.991, 0.01):
        accepted = [row for row in rows if row["supported_probability"] >= threshold]
        positives = [row for row in rows if row["actual"] == 1]
        negatives = [row for row in rows if row["actual"] == 0]
        correct = [row for row in accepted if row["actual"] == 1]
        false = [row for row in accepted if row["actual"] == 0]
        metrics = {
            "min_supported_probability": round(float(threshold), 4),
            "accepted": len(accepted),
            "precision": len(correct) / len(accepted) if accepted else 1.0,
            "positive_coverage": len(correct) / len(positives) if positives else 0.0,
            "ood_false_accept_rate": len(false) / len(negatives) if negatives else 0.0,
        }
        metrics["passes_development_gate"] = (
            metrics["precision"] >= 0.95
            and metrics["ood_false_accept_rate"] <= 0.03
            and metrics["accepted"] > 0
        )
        candidates.append(metrics)
    passing = [row for row in candidates if row["passes_development_gate"]]
    if passing:
        return max(passing, key=lambda row: (row["positive_coverage"], row["accepted"]))
    return max(candidates, key=lambda row: (
        row["precision"] - row["ood_false_accept_rate"], row["positive_coverage"]
    ))


def main() -> None:
    """Train, select and calibrate without touching browser model assets."""
    args = parse_args()
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    rows = [json.loads(line) for line in args.split_manifest.read_text(encoding="utf-8").splitlines() if line]
    split_rows = {
        split: [row for row in rows if row["experiment_split"] == split]
        for split in ("train", "model_selection", "calibration")
    }
    train_transform, evaluation_transform = gate_transforms()
    train_data = ConcatDataset([
        PhotoRows(split_rows["train"], train_transform),
        SyntheticUnknown(args.synthetic_unknown, train_transform, args.seed),
    ])
    train_loader = balanced_loader(
        train_data, split_rows["train"], args.synthetic_unknown,
        args.batch_size, args.workers,
    )
    selection_loader = DataLoader(PhotoRows(
        split_rows["model_selection"], evaluation_transform
    ), batch_size=args.batch_size, shuffle=False, num_workers=args.workers)
    calibration_loader = DataLoader(PhotoRows(
        split_rows["calibration"], evaluation_transform
    ), batch_size=args.batch_size, shuffle=False, num_workers=args.workers)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = make_ood_gate(pretrained=True).to(device)
    loss_function = nn.BCEWithLogitsLoss()
    best_state, best_score, history = None, -1.0, []
    epoch = 0
    for fine_tune, count, learning_rate in (
        (False, args.head_epochs, 1e-3),
        (True, args.fine_tune_epochs, 2e-5),
    ):
        set_trainable(model, fine_tune)
        optimizer = torch.optim.AdamW(
            (value for value in model.parameters() if value.requires_grad),
            lr=learning_rate, weight_decay=1e-4,
        )
        for _ in range(count):
            epoch += 1
            model.train()
            total_loss, total = 0.0, 0
            for images, labels, _ in train_loader:
                images, labels = images.to(device), labels.float().to(device)
                optimizer.zero_grad(set_to_none=True)
                logits = model(images).squeeze(1)
                loss = loss_function(logits, labels)
                loss.backward()
                optimizer.step()
                total_loss += float(loss.detach()) * len(labels)
                total += len(labels)
            selection = infer(model, selection_loader, device)
            score = selection_score(selection)
            record = {"epoch": epoch, "fine_tune": fine_tune,
                      "loss": total_loss / max(1, total),
                      "selection_balanced_accuracy": score}
            history.append(record)
            print(json.dumps(record), flush=True)
            if score > best_score:
                best_score = score
                best_state = {
                    key: value.detach().cpu().clone()
                    for key, value in model.state_dict().items()
                }
    if best_state is None:
        raise SystemExit("No training epoch ran.")
    model.load_state_dict(best_state)
    selection = infer(model, selection_loader, device)
    calibration_rows = infer(model, calibration_loader, device)
    calibration = calibrate(calibration_rows)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    checkpoint = args.output_dir / "mobilenet-v3-small-ood-gate.pt"
    torch.save({
        "architecture": "mobilenet_v3_small_binary_gate",
        "pretrained_weights": "MobileNet_V3_Small_Weights.DEFAULT",
        "state_dict": best_state,
        "calibration": calibration,
    }, checkpoint)
    report = {
        "experiment": "mobilenet-v3-small-supported-photo-gate-v1",
        "release_ready": False,
        "split_manifest": args.split_manifest.as_posix(),
        "split_manifest_sha256": file_sha256(args.split_manifest),
        "checkpoint": checkpoint.as_posix(),
        "checkpoint_sha256": file_sha256(checkpoint),
        "device": device,
        "history": history,
        "selection_predictions": selection,
        "calibration_predictions": calibration_rows,
        "calibration": calibration,
    }
    (args.output_dir / "ood-gate-training-report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(calibration, indent=2))


if __name__ == "__main__":
    main()
