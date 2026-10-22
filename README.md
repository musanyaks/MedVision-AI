# MedVision AI — Automated Chest X-Ray Pneumonia Diagnosis

A full-stack, production-ready web application for automated pneumonia detection from chest X-rays. Built with **Next.js 16 (App Router)**, **TypeScript**, **PostgreSQL** via **Drizzle ORM**, **ONNX Runtime**, **Sharp**, and **Recharts**.

> **Educational / research demo.** This is not an FDA/CE-approved medical device and must not be used as a substitute for professional radiological diagnosis.



## Table of contents

1. [What it does](#what-it-does)
2. [ML & data-science capabilities](#ml--data-science-capabilities)
3. [Architecture](#architecture)
4. [Tech stack](#tech-stack)
5. [Quick start](#quick-start)
6. [Environment variables](#environment-variables)
7. [API reference](#api-reference)
8. [Database schema](#database-schema)
9. [Model details](#model-details)
10. [Explainability](#explainability)
11. [Testing](#testing)
12. [Deployment notes](#deployment-notes)
13. [License & attribution](#license--attribution)

---

## What it does

MedVision AI lets clinicians, researchers, or students upload a frontal chest X-ray and receive:

- A binary prediction: **NORMAL** or **PNEUMONIA**
- A calibrated probability and confidence score
- An occlusion-sensitivity heatmap showing which regions most influenced the model
- Persistent records for auditability and analytics
- A data-science dashboard with class distribution, confidence trends, and model metrics

---

## ML & data-science capabilities

| Capability | Implementation |
|------------|----------------|
| Deep-learning inference | ResNet18 ONNX classifier, sigmoid output, CPU runtime |
| Preprocessing | Sharp (resize, crop, grayscale, normalize) |
| Explainability | Occlusion-sensitivity heatmap (base64 PNG) |
| Persistence | PostgreSQL + Drizzle ORM |
| Analytics | Recharts: pie, bar, and line charts; aggregate confidence; dataset distribution |
| Model metrics | Seeded accuracy, precision, recall, specificity, F1, AUROC |
| Audit trail | `/api/records` with patient metadata, timestamps, and notes |

---

## Architecture

```
┌─────────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│  Next.js pages  │──────▶  Next.js API routes  │──────▶  PostgreSQL    │
│  (React + TS)   │      │  /api/diagnose       │      │  (Drizzle ORM)  │
└─────────────────┘      │  /api/stats          │      └─────────────────┘
                         │  /api/records        │
                         │  /api/model/info     │
                         └──────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────┐
                         │  ONNX Runtime Node   │
                         │  cxr_pneumonia.onnx  │
                         └──────────────────────┘
```

---

## Tech stack

- **Framework:** Next.js 16.2.6 (App Router, React 19)
- **Language:** TypeScript 5.9
- **Styling:** Tailwind CSS 4
- **Database:** PostgreSQL 15+ via `pg`
- **ORM:** Drizzle ORM 0.45 + Drizzle Kit
- **ML runtime:** ONNX Runtime Node
- **Image processing:** Sharp
- **Charts:** Recharts
- **Icons:** Lucide React

---

## Quick start

### 1. Clone & install

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
ONNX_MODEL_PATH=./public/model/cxr_pneumonia.onnx
```

The ONNX model is already downloaded to `public/model/cxr_pneumonia.onnx`.

### 3. Provision the database

Ensure PostgreSQL is running, then apply the Drizzle schema:

```bash
npx drizzle-kit push
```

### 4. Seed analytics data

```bash
psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -c "
INSERT INTO dataset_stats (split, class_label, count) VALUES
('train', 'NORMAL', 1341),
('train', 'PNEUMONIA', 3875),
('val', 'NORMAL', 8),
('val', 'PNEUMONIA', 8),
('test', 'NORMAL', 234),
('test', 'PNEUMONIA', 390);

INSERT INTO model_metrics (metric_name, metric_value, split) VALUES
('accuracy', 0.973, 'test'),
('precision', 0.968, 'test'),
('recall', 0.991, 'test'),
('specificity', 0.924, 'test'),
('f1_score', 0.979, 'test'),
('auc_roc', 0.997, 'test');
"
```

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Production build

```bash
npm run build
npm start
```

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `ONNX_MODEL_PATH` | No | `./public/model/cxr_pneumonia.onnx` | Path to the ONNX classifier |

---

## API reference

### `GET /api/health`

Returns service and database status.

```json
{ "ok": true, "database": "ok", "onnx": "ready" }
```

### `POST /api/diagnose`

Upload a chest X-ray image.

**Form fields:**
- `file` (required) — JPEG/PNG image
- `patientName` (optional)
- `patientId` (optional)
- `notes` (optional)

**Response:**

```json
{
  "label": "PNEUMONIA",
  "probability": 0.9998,
  "confidence": 0.9998,
  "classes": ["NORMAL", "PNEUMONIA"],
  "heatmapBase64": "iVBORw0KGgo...",
  "recordId": 12
}
```

### `GET /api/records`

Returns the 200 most recent diagnoses.

### `GET /api/stats`

Returns aggregate analytics for the dashboard.

### `GET /api/model/info`

Returns model metadata: architecture, preprocessing, classes, and evaluation metrics.

---

## Database schema

Defined in `src/db/schema.ts`:

- **`diagnoses`** — stored predictions with probabilities, heatmaps, patient metadata, and timestamps.
- **`dataset_stats`** — class counts per train/val/test split.
- **`model_metrics`** — accuracy, precision, recall, specificity, F1, AUROC per split.

---

## Model details

| Property | Value |
|----------|-------|
| Name | MedTriage ResNet18 Pneumonia Detector |
| Format | ONNX |
| Input | `[1, 3, 224, 224]` float32 NCHW |
| Preprocessing | Grayscale → resize 256 → center-crop 224 → 3-channel replication → ImageNet normalization |
| Output | Sigmoid probability of pneumonia |
| Classes | `NORMAL`, `PNEUMONIA` |
| Test AUROC | 0.997 |
| Test accuracy | 0.973 |
| Sensitivity | 0.991 |
| Specificity | 0.924 |

Source: [Yaqi998/medtriage](https://github.com/Yaqi998/medtriage)

---

## Explainability

Because the deployed model is an ONNX graph, gradient-based methods such as Grad-CAM are not directly available. MedVision AI implements **occlusion sensitivity**:

1. A grey patch is slid across the 224×224 input.
2. The model is re-run for each patch position.
3. The absolute change in pneumonia probability is recorded per pixel.
4. The sensitivity map is color-coded (jet colormap) and overlaid on the cropped input X-ray.

Red regions indicate areas where occlusion most altered the model's decision.

---

## Testing

### Unit / integration-style checks

```bash
# Type generation
npx next typegen

# TypeScript
npm run typecheck

# Production build
npm run build
```

### Manual API tests

```bash
# Health
curl https://localhost:3000/api/health

# Diagnose a local image (heatmap is generated automatically)
curl -X POST -F "file=@xray.jpg" https://localhost:3000/api/diagnose

# Records
curl https://localhost:3000/api/records

# Stats
curl https://localhost:3000/api/stats
```

---

## Deployment notes

- **ONNX Runtime native binaries:** `onnxruntime-node` ships platform-specific native add-ons. Ensure the target platform matches the install environment, or run `npm install` on the deployment host.
- **Sharp libvips:** Sharp also requires native bindings. In containerized deployments, use the official `node:slim` base or install `libvips`.
- **Model file:** The ONNX model (~22 MB) lives in `public/model/`. In serverless environments, ensure the file is available at runtime and referenced correctly via `ONNX_MODEL_PATH`.
- **Database:** The app expects PostgreSQL. The health endpoint validates connectivity on every request.

---

## License & attribution

- Application code is provided as an educational full-stack demo.
- The underlying chest X-ray model and preprocessing logic are from [Yaqi998/medtriage](https://github.com/Yaqi998/medtriage) and the Kermany et al. *Chest X-Ray Images (Pneumonia)* dataset.
- Do not use this software for clinical diagnosis without regulatory approval and qualified medical oversight.
