"""
ResNet18 + LSTM Anomaly Detection Model.

Architecture:
  - ResNet18 (pretrained on ImageNet, FC layer removed) → 512-d feature per frame
  - LSTM (hidden=512, layers=2) → temporal sequence modeling over 16-frame clips
  - FC head → 14-class output (13 UCF-Crime anomaly types + Normal)

This model is designed for the UCF-Crime dataset.
"""

import torch
import torch.nn as nn
from torchvision import models


class AnomalyClassifier(nn.Module):
    """
    ResNet18 + LSTM model for multi-class video anomaly detection.

    Input:  (batch, clip_length, 3, H, W) — batch of video clips
    Output: (batch, num_classes) — class logits
    """

    def __init__(self, num_classes=14, hidden_size=512, num_layers=2, dropout=0.3):
        super().__init__()

        # ── Spatial feature extractor: ResNet18 ──
        resnet = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        # Remove the final FC layer — output is 512-d feature vector
        self.feature_extractor = nn.Sequential(*list(resnet.children())[:-1])
        self.feature_dim = 512  # ResNet18 output dimension

        # Freeze early layers (optional — fine-tune later layers)
        for param in list(self.feature_extractor.parameters())[:30]:
            param.requires_grad = False

        # ── Temporal sequence model: LSTM ──
        self.lstm = nn.LSTM(
            input_size=self.feature_dim,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
        )

        # ── Classification head ──
        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(hidden_size, 256),
            nn.ReLU(),
            nn.Dropout(dropout / 2),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        """
        Args:
            x: (batch, clip_length, 3, H, W)
        Returns:
            logits: (batch, num_classes)
        """
        batch_size, clip_length, C, H, W = x.shape

        # Extract per-frame features using ResNet18
        # Reshape to (batch * clip_length, C, H, W) for batch processing
        x = x.view(batch_size * clip_length, C, H, W)
        features = self.feature_extractor(x)  # (batch * clip_length, 512, 1, 1)
        features = features.squeeze(-1).squeeze(-1)  # (batch * clip_length, 512)

        # Reshape back to (batch, clip_length, 512)
        features = features.view(batch_size, clip_length, self.feature_dim)

        # Run LSTM over the temporal sequence
        lstm_out, (h_n, c_n) = self.lstm(features)

        # Use the last hidden state for classification
        last_hidden = lstm_out[:, -1, :]  # (batch, hidden_size)

        # Classify
        logits = self.classifier(last_hidden)  # (batch, num_classes)
        return logits


def create_model(num_classes=14, device="cpu"):
    """Create and return the anomaly classifier model."""
    model = AnomalyClassifier(num_classes=num_classes)
    model = model.to(device)
    return model


def load_model(weights_path, num_classes=14, device="cpu"):
    """Load a trained model from weights file."""
    model = create_model(num_classes=num_classes, device=device)
    state_dict = torch.load(weights_path, map_location=device)
    model.load_state_dict(state_dict)
    model.eval()
    return model
