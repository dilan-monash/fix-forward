"""Shared architecture contract for appliance-model training and evaluation."""

from __future__ import annotations

from torch import nn
from torchvision import transforms
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

from appliance_model_prompts import CLASS_PROMPTS


SUPPORTED_LABELS = list(CLASS_PROMPTS)
UNKNOWN_LABEL = "unsupported_or_unknown"
MODEL_LABELS = [*SUPPORTED_LABELS, UNKNOWN_LABEL]


def transforms_for_training():
    """Return augmented training and deterministic validation transforms."""
    normalize = transforms.Normalize(
        mean=EfficientNet_B0_Weights.DEFAULT.transforms().mean,
        std=EfficientNet_B0_Weights.DEFAULT.transforms().std,
    )
    train = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.7, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.18, hue=0.04),
        transforms.RandomRotation(8),
        transforms.ToTensor(),
        normalize,
    ])
    validation = EfficientNet_B0_Weights.DEFAULT.transforms()
    return train, validation


def make_model(pretrained: bool = True) -> nn.Module:
    """Build the fixed 19-class-plus-unknown EfficientNet architecture."""
    weights = EfficientNet_B0_Weights.DEFAULT if pretrained else None
    model = efficientnet_b0(weights=weights)
    inputs = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(inputs, len(MODEL_LABELS))
    return model
