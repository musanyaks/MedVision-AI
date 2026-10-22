"""
FastAPI microservice for automated medical image diagnosis.

Endpoints:
    GET  /health          - service health check
    POST /predict         - run pneumonia prediction on an uploaded chest X-ray
    POST /explain         - return Grad-CAM visualization as base64 PNG
    GET  /model/info      - model architecture summary
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import model as model_module

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up the model on startup so first inference is fast."""
    logger.info("Warming up ML model...")
    try:
        model_module.load_model()
        logger.info("Model ready.")
    except Exception as exc:
        logger.error(f"Model warm-up failed: {exc}")
        raise
    yield
    logger.info("Shutting down ML service.")


app = FastAPI(
    title="MedVision AI - Chest X-Ray Diagnostic Service",
    description="ML backend for automated pneumonia detection from chest X-rays.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictionResponse(BaseModel):
    label: str
    probability: float
    confidence: float
    classes: list[str]


class ExplanationResponse(BaseModel):
    heatmap_base64: str


class ModelInfoResponse(BaseModel):
    name: str
    input_shape: list
    total_params: int
    trainable_params: int
    non_trainable_params: int
    layers: list
    classes: list[str]
    source: str
    dataset: str
    preprocessing: dict


@app.get("/health")
def health():
    return {"status": "ok", "service": "ml", "model_loaded": model_module._model is not None}


@app.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        result = model_module.predict(image_bytes)
        return result
    except Exception as exc:
        logger.exception("Prediction failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/explain", response_model=ExplanationResponse)
async def explain(file: UploadFile = File(...), alpha: float = 0.4):
    try:
        image_bytes = await file.read()
        b64 = model_module.make_gradcam_heatmap(image_bytes, alpha=alpha)
        return {"heatmap_base64": b64}
    except Exception as exc:
        logger.exception("Grad-CAM failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/model/info", response_model=ModelInfoResponse)
def model_info():
    return model_module.get_model_info()


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("ML_SERVICE_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
