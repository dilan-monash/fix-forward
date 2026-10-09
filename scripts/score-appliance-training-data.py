"""Score collected image candidates with CLIP and build review sheets.

CLIP is used as a second opinion for prioritising manual review. It never turns
search results into ground truth by itself. Every output row retains the source
licence and keeps ``review_status=pending`` until a reviewer approves it.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import clip
import torch
from PIL import Image, ImageDraw, ImageFont

from appliance_model_prompts import CLASS_PROMPTS, OOD_PROMPTS


def parse_args() -> argparse.Namespace:
    """Read explicit input/output paths and a conservative CPU batch size."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--model", default="ViT-B/32")
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--sheet-items", type=int, default=40)
    return parser.parse_args()


def read_jsonl(path: Path) -> list[dict]:
    """Fail on malformed rows rather than silently dropping provenance."""
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def encode_prompts(model: torch.nn.Module, device: str) -> tuple[list[str], torch.Tensor]:
    """Create one normalized text vector for each supported and OOD prompt."""
    labels = [*CLASS_PROMPTS, *OOD_PROMPTS]
    tokens = clip.tokenize([*CLASS_PROMPTS.values(), *OOD_PROMPTS.values()]).to(device)
    with torch.inference_mode():
        features = model.encode_text(tokens).float()
        features /= features.norm(dim=-1, keepdim=True)
    return labels, features


def batches(items: list[dict], size: int):
    """Yield bounded batches so a CPU-only development laptop stays responsive."""
    for start in range(0, len(items), size):
        yield items[start:start + size]


def score_rows(rows: list[dict], model: torch.nn.Module, preprocess,
               labels: list[str], text_features: torch.Tensor,
               device: str, batch_size: int, model_name: str) -> list[dict]:
    """Attach transparent similarities and ranks; never auto-approve a label."""
    scored = []
    for number, group in enumerate(batches(rows, batch_size), start=1):
        tensors = []
        valid = []
        for row in group:
            try:
                with Image.open(row["local_path"]) as image:
                    tensors.append(preprocess(image.convert("RGB")))
                valid.append(row)
            except OSError:
                continue
        if not valid:
            continue
        batch = torch.stack(tensors).to(device)
        with torch.inference_mode():
            image_features = model.encode_image(batch).float()
            image_features /= image_features.norm(dim=-1, keepdim=True)
            similarities = (image_features @ text_features.T).cpu()

        for row, scores in zip(valid, similarities):
            ranked = torch.argsort(scores, descending=True).tolist()
            positive = [index for index in ranked if labels[index] in CLASS_PROMPTS]
            ood = [index for index in ranked if labels[index] in OOD_PROMPTS]
            best_positive, next_positive, best_ood = positive[0], positive[1], ood[0]
            expected_index = labels.index(row["candidate_label"]) if row["kind"] == "supported" else None
            expected_rank = positive.index(expected_index) + 1 if expected_index is not None else None
            expected_score = float(scores[expected_index]) if expected_index is not None else None
            # "Prioritise" means inspect this candidate first. It is deliberately
            # separate from the human-owned review_status field.
            if row["kind"] == "supported":
                teacher_priority = (
                    expected_rank <= 2 and expected_score >= float(scores[best_ood]) - 0.01
                )
            else:
                teacher_priority = float(scores[best_ood]) >= float(scores[best_positive]) - 0.01
            scored.append({
                **row,
                "teacher_model": f"CLIP {model_name}",
                "teacher_priority": teacher_priority,
                "expected_positive_rank": expected_rank,
                "expected_score": expected_score,
                "top_positive": {"label": labels[best_positive], "score": float(scores[best_positive])},
                "top_ood": {"label": labels[best_ood], "score": float(scores[best_ood])},
                "positive_margin": float(scores[best_positive] - scores[next_positive]),
                "ood_margin": float(scores[best_positive] - scores[best_ood]),
            })
        print(f"Scored {min(number * batch_size, len(rows))}/{len(rows)}", flush=True)
    return scored


def short_text(value: object, limit: int = 40) -> str:
    """Keep review-sheet labels readable and free of control characters."""
    cleaned = " ".join(str(value or "").split())
    return cleaned if len(cleaned) <= limit else cleaned[:limit - 1] + "…"


def make_sheet(rows: list[dict], destination: Path, heading: str) -> None:
    """Build an internal contact sheet so labels can be reviewed visually."""
    cell_width, image_height, text_height, columns = 220, 170, 55, 5
    rows_count = max(1, math.ceil(len(rows) / columns))
    sheet = Image.new("RGB", (cell_width * columns, 42 + (image_height + text_height) * rows_count), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((8, 12), heading, fill="black", font=font)
    for index, row in enumerate(rows):
        column, row_number = index % columns, index // columns
        left = column * cell_width
        top = 42 + row_number * (image_height + text_height)
        try:
            with Image.open(row["local_path"]) as opened:
                image = opened.convert("RGB")
                image.thumbnail((cell_width - 12, image_height - 8), Image.Resampling.LANCZOS)
            x = left + (cell_width - image.width) // 2
            y = top + (image_height - image.height) // 2
            sheet.paste(image, (x, y))
        except OSError:
            draw.rectangle((left + 8, top + 8, left + cell_width - 8, top + image_height - 8), outline="red")
        label = f"{index + 1}. {short_text(row.get('title'))}"
        score = row.get("expected_score")
        note = f"score {score:.3f} | top {row['top_positive']['label']}" if score is not None else f"top OOD {row['top_ood']['label']}"
        draw.text((left + 5, top + image_height + 4), label, fill="black", font=font)
        draw.text((left + 5, top + image_height + 22), short_text(note), fill="black", font=font)
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, quality=90)


def build_review_sheets(rows: list[dict], output_dir: Path, limit: int) -> None:
    """Rank supported candidates by expected similarity and OOD by its prompt."""
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in rows:
        grouped[(row["kind"], row["candidate_label"])].append(row)
    for (kind, label), group in grouped.items():
        if kind == "supported":
            ordered = sorted(group, key=lambda item: (not item["teacher_priority"], -(item["expected_score"] or -1)))
        else:
            ordered = sorted(group, key=lambda item: (not item["teacher_priority"], item["ood_margin"]))
        make_sheet(
            ordered[:limit], output_dir / "review-sheets" / f"{kind}-{label}.jpg",
            f"{kind}/{label} — search candidates; human approval still required",
        )


def main() -> None:
    """Score candidates, preserve evidence and render reviewable sheets."""
    args = parse_args()
    rows = read_jsonl(args.manifest)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, preprocess = clip.load(args.model, device=device, jit=False)
    model.eval()
    labels, text_features = encode_prompts(model, device)
    scored = score_rows(
        rows, model, preprocess, labels, text_features, device, args.batch_size,
        args.model,
    )
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output = args.output_dir / "scored-candidates.jsonl"
    output.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in scored),
        encoding="utf-8",
    )
    build_review_sheets(scored, args.output_dir, args.sheet_items)
    summary = {
        "model": args.model,
        "device": device,
        "input_records": len(rows),
        "scored_records": len(scored),
        "teacher_priority": sum(bool(row["teacher_priority"]) for row in scored),
        "warning": "Teacher priority is not human label approval.",
    }
    (args.output_dir / "scoring-summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
