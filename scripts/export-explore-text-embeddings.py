"""Export a separate, frozen Explore text catalogue using the cached SigLIP2 model.

This script changes no Take action artifact. It reads pinned, local-only model
bytes, encodes all 32 catalogue descriptions plus unrelated controls, and writes
new Explore vectors. Exporting vectors does not enable recognition or validate
image accuracy. Threshold selection and held-out evaluation are separate steps.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModel, AutoProcessor

MODEL = "google/siglip2-base-patch32-256"
REVISION = "94dffa8cb1179de3e03f091dbc3917e5d5a9ae84"
WEIGHTS_SHA256 = "7d241bb3becad218f211f480487f491df4f8c0a472ecf7afdec5615815a301f1"

# These descriptions were frozen in v1. V2 activates the remaining catalogue
# rows without changing a prompt or its row; only ten controls stay unsupported.
PHASE_ONE_PROMPTS = {
    "kettle": "a photo of an electric water kettle with its base",
    "toaster": "a photo of an electric bread toaster",
    "fan": "a photo of a portable electric room fan",
    "microwave": "a photo of a countertop microwave oven",
    "blender": "a photo of an electric kitchen blender with a blending jug",
    "rice_cooker": "a photo of an electric rice cooker appliance",
    "air_fryer": "a photo of an electric countertop air fryer appliance",
    "coffee_machine": "a photo of an electric coffee maker or espresso machine",
    "mixer": "a photo of an electric stand mixer or electric hand mixer",
    "vacuum_cleaner": "a photo of an electric vacuum cleaner",
    "hair_dryer": "a photo of a handheld electric hair dryer",
    "laptop": "a photo of a laptop computer with a screen and keyboard",
    "smartphone": "a photo of a smartphone or mobile phone",
    "tablet": "a photo of a tablet computer with a touchscreen",
    "television": "a photo of a television",
    "washing_machine": "a photo of a washing machine for laundry",
}
ADDITIONAL_PROMPTS = {
    "refrigerator": "a photo of a refrigerator",
    "food_processor": "a photo of an electric food processor with a bowl",
    "sandwich_press": "a photo of an electric sandwich press or panini maker",
    "portable_heater": "a photo of a portable electric room space heater",
    "portable_ac": "a photo of a portable air conditioner on wheels",
    "dehumidifier": "a photo of a portable electric room dehumidifier",
    "headphones": "a photo of headphones or wireless earbuds",
    "games_console": "a photo of a video game console",
    "printer": "a photo of a computer printer",
    "steam_cleaner": "a photo of an electric steam cleaner appliance",
    "clothes_dryer": "a photo of a tumble dryer for laundry",
    "straightener": "a photo of an electric hair straightener",
    "shaver": "a photo of an electric shaver or electric beard trimmer",
    "electric_toothbrush": "a photo of an electric toothbrush",
    "cordless_drill": "a photo of a cordless power drill",
    "sewing_machine": "a photo of an electric sewing machine",
}
CONTROL_PROMPTS = {
    "computer_monitor": "a photo of a desktop computer monitor",
    "keyboard_or_mouse": "a photo of a computer keyboard or mouse",
    "remote_control": "a photo of a television remote control",
    "battery_or_charger": "a photo of a battery or an electrical charger",
    "person_or_pet": "a photo of a person or pet",
    "furniture": "a photo of furniture or a room",
    "vehicle": "a photo of a car or another vehicle",
    "nature": "a photo of a flower, plant, or tree",
    "food_or_book": "a photo of food or a book",
    "other_object": "a photo of an unrelated household object",
}


def digest(file: Path) -> str:
    """Hash incrementally so verifying the text encoder needs little extra RAM."""
    result = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--local-model-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    # The local snapshot may be hard-linked from an existing E: cache. Neither
    # from_pretrained call can access the network or write into that source cache.
    if digest(args.local_model_dir / "model.safetensors") != WEIGHTS_SHA256:
        raise RuntimeError("The cached text encoder differs from the pinned revision.")
    torch.set_num_threads(2)
    processor = AutoProcessor.from_pretrained(args.local_model_dir, local_files_only=True)
    model = AutoModel.from_pretrained(args.local_model_dir, local_files_only=True).eval()
    active_prompts = {**PHASE_ONE_PROMPTS, **ADDITIONAL_PROMPTS}
    prompts_by_label = {**active_prompts, **CONTROL_PROMPTS}
    inputs = processor(text=list(prompts_by_label.values()), padding="max_length", return_tensors="pt")
    with torch.inference_mode():
        vectors = model.get_text_features(**inputs)
        vectors = vectors / vectors.norm(dim=-1, keepdim=True)
    array = vectors.detach().cpu().numpy().astype("<f4", copy=False)
    if array.shape != (42, 768) or not np.isfinite(array).all():
        raise RuntimeError("Unexpected Explore text-vector shape or values.")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    target = args.output_dir / "text-embeddings.f32"
    target.write_bytes(array.tobytes(order="C"))
    manifest = {
        "artifact": "fixforward-explore-siglip2-text-embeddings-v2",
        "scope": "Explore only; local experimental active32 of32; no photo-accuracy claim",
        "model": MODEL, "resolved_revision": REVISION,
        "source_weights_sha256": WEIGHTS_SHA256, "license": "Apache-2.0",
        "dtype": "float32-little-endian", "shape": list(array.shape),
        "active_count": 32, "catalogue_count": 32,
        "labels": list(prompts_by_label), "prompts": list(prompts_by_label.values()),
        "active_labels": list(active_prompts), "inactive_labels": [],
        "control_labels": list(CONTROL_PROMPTS),
        "vectors_file": target.name, "vectors_sha256": digest(target),
        "runtime": {"python": platform.python_version(), "torch": torch.__version__,
                    "transformers": importlib.metadata.version("transformers"), "numpy": np.__version__},
        "source": f"https://huggingface.co/{MODEL}/tree/{REVISION}",
        "limitations": ["Type similarities are not probabilities.",
                        "Alternative labels do not count photographed items.",
                        "A person must confirm any suggestion before starting a lesson."],
    }
    output = args.output_dir / "text-embeddings.json"
    output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": str(output), "manifest_sha256": digest(output),
                      "vectors_sha256": digest(target), "shape": list(array.shape)}))


if __name__ == "__main__":
    main()
