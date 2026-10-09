"""Shared architecture contract for the lightweight supported-photo gate."""

from __future__ import annotations

from torch import nn
from torchvision import transforms
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small


def gate_transforms():
    """Return robust training and deterministic evaluation transforms."""
    normalize = transforms.Normalize(
        mean=MobileNet_V3_Small_Weights.DEFAULT.transforms().mean,
        std=MobileNet_V3_Small_Weights.DEFAULT.transforms().std,
    )
    training = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.65, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.18),
        transforms.RandomRotation(7),
        transforms.ToTensor(),
        normalize,
    ])
    return training, MobileNet_V3_Small_Weights.DEFAULT.transforms()


def make_ood_gate(pretrained: bool = True) -> nn.Module:
    """Build a compact binary gate: supported appliance versus unknown."""
    weights = MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
    model = mobilenet_v3_small(weights=weights)
    inputs = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(inputs, 1)
    return model
