# SigLIP 2 browser-candidate notice

This directory contains an experimental, browser-local appliance suggestion
candidate. It does not diagnose faults, decide whether an appliance is safe, or
replace the adult's confirmation.

## Upstream model

- Base model: `google/siglip2-base-patch32-256`
- Base revision: `94dffa8cb1179de3e03f091dbc3917e5d5a9ae84`
- Browser conversion: `onnx-community/siglip2-base-patch32-256-ONNX`
- Conversion revision: `7efccb86b5b6601bfe9e14326e1c11b40b68d44c`
- License declared by both model repositories: Apache-2.0
- Quantized vision file SHA-256:
  `9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499`

The content-addressed local filename lets automated checks prove that the file
served by this checkout is the same q4 artifact evaluated by FixForward. The
browser runtime, model and processor configuration are served from the same
origin; a selected photo is processed in the browser and is not posted to the
FixForward server.

FixForward did not fine-tune the upstream model weights. Its authored work here
is the fixed prompt set, exported text vectors, two-margin rejection policy,
evaluation scripts, validation evidence and confirmation-first interface.

## Runtime

The local runtime is `@huggingface/transformers` 3.8.1 under Apache-2.0. Its
license is stored at `vendor/transformers/LICENSE.txt`. The ONNX Runtime Web WASM
files are distributed by that package. Exact runtime hashes and file sizes are
recorded in `model_manifest.json` and checked by the repository tests.

Evaluation-image licenses and attribution remain in their source manifests.
Those images are validation material; they were not used to train the upstream
SigLIP 2 weights.
