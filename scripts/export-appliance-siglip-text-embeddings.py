"""Export the fixed FixForward text prompts for browser-side SigLIP scoring.

The browser candidate loads only the quantized vision encoder.  These normalized
text vectors let it compare a photo with the reviewed appliance and out-of-domain
prompts without downloading the much larger text encoder.  The artifact remains
an experiment until its quantized browser path passes the documented release
gate; running this script never enables the website photo helper.
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

from appliance_model_prompts import CLASS_PROMPTS, OOD_PROMPTS


def parse_args() -> argparse.Namespace:
    """Keep the upstream model revision and output location explicit."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--model", default="google/siglip2-base-patch32-256")
    parser.add_argument(
        "--revision",
        default="94dffa8cb1179de3e03f091dbc3917e5d5a9ae84",
        help="Pinned upstream revision used to produce the text vectors.",
    )
    return parser.parse_args()


def sha256(path: Path) -> str:
    """Fingerprint the exact bytes a browser candidate would load."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    """Encode prompts once and write compact float32 vectors plus provenance."""
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    processor = AutoProcessor.from_pretrained(args.model, revision=args.revision)
    model = AutoModel.from_pretrained(args.model, revision=args.revision).eval()

    labels = [*CLASS_PROMPTS, *OOD_PROMPTS]
    prompts = [*CLASS_PROMPTS.values(), *OOD_PROMPTS.values()]
    text_inputs = processor(
        text=prompts,
        padding="max_length",
        return_tensors="pt",
    )
    with torch.inference_mode():
        vectors = model.get_text_features(**text_inputs)
        vectors = vectors / vectors.norm(dim=-1, keepdim=True)

    # Little-endian float32 is compact, deterministic and directly readable as
    # a Float32Array by all target browsers after an ordinary fetch.
    array = vectors.detach().cpu().numpy().astype("<f4", copy=False)
    vectors_path = args.output_dir / "text-embeddings.f32"
    vectors_path.write_bytes(array.tobytes(order="C"))
    manifest = {
        "artifact": "fixforward-siglip2-text-embeddings-v1",
        "release_ready": False,
        "scope": "Offline text vectors for the disabled browser-model candidate.",
        "model": args.model,
        "requested_revision": args.revision,
        "resolved_revision": getattr(model.config, "_commit_hash", None),
        "license": "Apache-2.0",
        "dtype": "float32-little-endian",
        "shape": list(array.shape),
        "labels": labels,
        "class_count": len(CLASS_PROMPTS),
        "prompts": prompts,
        "vectors_file": vectors_path.name,
        "vectors_sha256": sha256(vectors_path),
        "runtime": {
            "python": platform.python_version(),
            "torch": torch.__version__,
            "transformers": importlib.metadata.version("transformers"),
            "numpy": np.__version__,
        },
        "limitation": (
            "Similarity values are not confidence percentages. The user must "
            "confirm any future suggestion, and the photo cannot diagnose a fault."
        ),
    }
    manifest_path = args.output_dir / "text-embeddings.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "manifest": manifest_path.as_posix(),
        "vectors": vectors_path.as_posix(),
        "shape": manifest["shape"],
        "vectors_sha256": manifest["vectors_sha256"],
    }, indent=2))


if __name__ == "__main__":
    main()
