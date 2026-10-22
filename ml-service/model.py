"""
Medical image diagnostic model wrapper.

This module loads a pre-trained MobileNetV2-based binary classifier for
chest X-ray pneumonia detection and exposes inference + Grad-CAM
explainability helpers. It is a reproduction of the
standard transfer-learning pipeline used in the literature:

* MobileNetV2 backbone pretrained on ImageNet (frozen)
* GlobalAveragePooling2D
* Dropout + Dense(128) + Dropout + Dense(1, sigmoid)
* Input: 224x224 RGB, rescaled to [0, 1]
"""

import os
import io
import base64
import logging
from typing import Tuple

import numpy as np
import cv2
import tensorflow as tf
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

logger = logging.getLogger(__name__)

# Reproducible configuration
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

# Model globals (lazy-loaded)
_model: tf.keras.Model | None = None
_base_model: tf.keras.Model | None = None
_last_conv_layer_name = "out_relu"  # activation after final Conv_1 in MobileNetV2
_img_size = (224, 224)
_classes = ["NORMAL", "PNEUMONIA"]


def _find_model_path() -> str:
    """Locate the serialized model on disk, downloading from Hugging Face if needed."""
    candidates = [
        os.environ.get("MODEL_PATH"),
        os.path.join(os.path.dirname(__file__), "models", "best_chest_xray_model.h5"),
        os.path.join(os.path.dirname(__file__), "..", "models", "best_chest_xray_model.h5"),
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path

    # Download from Hugging Face
    logger.info("Downloading pre-trained model from Hugging Face...")
    from huggingface_hub import hf_hub_download

    target_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(target_dir, exist_ok=True)
    path = hf_hub_download(
        repo_id="ayushirathour/chest-xray-pneumonia-detection",
        filename="best_chest_xray_model.h5",
        local_dir=target_dir,
    )
    return path


def load_model() -> Tuple[tf.keras.Model, tf.keras.Model]:
    """Load the classifier and return (model, base_model)."""
    global _model, _base_model
    if _model is None:
        path = _find_model_path()
        logger.info(f"Loading model from {path}")
        _model = tf.keras.models.load_model(path)
        _base_model = _model.layers[0]
    return _model, _base_model


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Decode image bytes and convert to the model's expected input tensor."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(_img_size)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)  # (1, 224, 224, 3)


def predict(image_bytes: bytes) -> dict:
    """Run inference and return label, confidence, and raw probability."""
    model, _ = load_model()
    tensor = preprocess_image(image_bytes)
    prob = float(model.predict(tensor, verbose=0)[0][0])
    label_idx = 1 if prob >= 0.5 else 0
    label = _classes[label_idx]
    confidence = prob if label_idx == 1 else 1 - prob
    return {
        "label": label,
        "probability": prob,
        "confidence": float(confidence),
        "classes": _classes,
    }


def make_gradcam_heatmap(image_bytes: bytes, alpha: float = 0.4) -> str:
    """Generate a Grad-CAM overlay and return it as a base64 PNG string."""
    model, base_model = load_model()
    tensor = preprocess_image(image_bytes)

    # Reconstruct the classifier head by forwarding the last conv activation
    # through the layers that sit on top of the frozen MobileNetV2 backbone.
    last_conv_layer = base_model.get_layer(_last_conv_layer_name)
    x = last_conv_layer.output
    for layer in model.layers[1:]:  # layers after the backbone
        x = layer(x)

    grad_model = tf.keras.models.Model(
        inputs=base_model.input,
        outputs=[last_conv_layer.output, x],
    )

    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_model(tensor)
        loss = predictions[:, 0]

    grads = tape.gradient(loss, conv_outputs)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    conv_outputs = conv_outputs[0]
    heatmap = tf.reduce_sum(tf.multiply(pooled_grads, conv_outputs), axis=-1)
    heatmap = np.maximum(heatmap, 0) / (np.max(heatmap) + 1e-10)

    # Resize heatmap to original image size
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(_img_size)
    img_array = np.array(img)

    heatmap_resized = cv2.resize(heatmap, (_img_size[1], _img_size[0]))
    heatmap_uint8 = np.uint8(255 * heatmap_resized)
    heatmap_color = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
    heatmap_color = cv2.cvtColor(heatmap_color, cv2.COLOR_BGR2RGB)

    overlay = heatmap_color * alpha + img_array * (1 - alpha)
    overlay = np.uint8(np.clip(overlay, 0, 255))

    fig, axes = plt.subplots(1, 3, figsize=(12, 4))
    axes[0].imshow(img_array)
    axes[0].set_title("Original X-Ray")
    axes[0].axis("off")

    axes[1].imshow(heatmap_resized, cmap="jet")
    axes[1].set_title("Grad-CAM Heatmap")
    axes[1].axis("off")

    axes[2].imshow(overlay)
    axes[2].set_title("Overlay")
    axes[2].axis("off")

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight", dpi=120)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def get_model_info() -> dict:
    """Return architecture summary for documentation."""
    model, _ = load_model()
    layers = []
    for layer in model.layers:
        layers.append({
            "name": layer.name,
            "type": layer.__class__.__name__,
            "output_shape": str(layer.output.shape),
            "params": int(layer.count_params()),
        })
    return {
        "name": "MobileNetV2 Pneumonia Detector",
        "input_shape": list(model.input.shape),
        "total_params": int(model.count_params()),
        "trainable_params": int(sum(tf.size(w).numpy() for w in model.trainable_weights)),
        "non_trainable_params": int(sum(tf.size(w).numpy() for w in model.non_trainable_weights)),
        "layers": layers,
        "classes": _classes,
        "source": "https://huggingface.co/ayushirathour/chest-xray-pneumonia-detection",
        "dataset": "Kermany et al. Chest X-Ray Images (Pneumonia) - 5,856 pediatric images",
        "preprocessing": {
            "resize": list(_img_size),
            "normalize": "divided by 255",
            "channels": "RGB",
        },
    }
