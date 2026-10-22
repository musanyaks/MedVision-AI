import * as ort from "onnxruntime-node";
import sharp from "sharp";
import path from "path";

const MODEL_PATH =
  process.env.ONNX_MODEL_PATH || path.join(process.cwd(), "public/model/cxr_pneumonia.onnx");

const INPUT_RESIZE = 256;
const INPUT_CROP = 224;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const CLASSES = ["NORMAL", "PNEUMONIA"];

let session: ort.InferenceSession | null = null;

export async function loadModel(): Promise<ort.InferenceSession> {
  if (!session) {
    session = await ort.InferenceSession.create(MODEL_PATH);
  }
  return session;
}

/**
 * Preprocess a chest X-ray for the ResNet18 ONNX model:
 * - Convert to grayscale
 * - Resize to exactly INPUT_RESIZE × INPUT_RESIZE
 * - Center crop to INPUT_CROP × INPUT_CROP (guard for small inputs)
 * - Replicate single channel to 3 channels
 * - Normalize with ImageNet mean/std
 * - Return NCHW Float32 array
 */
export async function preprocessImage(imageBytes: Buffer): Promise<Float32Array> {
  // Ensure we have enough pixels to extract the crop region.
  const meta = await sharp(imageBytes).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  // Resize the image to exactly INPUT_RESIZE × INPUT_RESIZE so the center
  // crop is always valid, even for tiny uploads.
  const resized = await sharp(imageBytes)
    .grayscale()
    .resize(INPUT_RESIZE, INPUT_RESIZE, { fit: "fill" })
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = await sharp(resized.data, {
    raw: { width: resized.info.width, height: resized.info.height, channels: 1 },
  })
    .extract({
      left: Math.floor((resized.info.width - INPUT_CROP) / 2),
      top: Math.floor((resized.info.height - INPUT_CROP) / 2),
      width: INPUT_CROP,
      height: INPUT_CROP,
    })
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== INPUT_CROP || info.height !== INPUT_CROP || info.channels !== 1) {
    throw new Error(`Unexpected preprocessed image shape: ${JSON.stringify(info)}`);
  }

  const pixels = new Uint8Array(data);
  const total = INPUT_CROP * INPUT_CROP;
  const normalized = new Float32Array(3 * total);

  for (let i = 0; i < total; i++) {
    const v = pixels[i] / 255.0;
    // Replicate grayscale into 3 channels and normalize
    normalized[i] = (v - MEAN[0]) / STD[0];
    normalized[i + total] = (v - MEAN[1]) / STD[1];
    normalized[i + 2 * total] = (v - MEAN[2]) / STD[2];
  }

  return normalized;
}

export interface PredictionResult {
  label: string;
  probability: number;
  confidence: number;
  classes: string[];
}

export async function predict(imageBytes: Buffer): Promise<PredictionResult> {
  const sess = await loadModel();
  const tensorData = await preprocessImage(imageBytes);
  const inputTensor = new ort.Tensor("float32", tensorData, [1, 3, INPUT_CROP, INPUT_CROP]);

  const feeds: Record<string, ort.Tensor> = {};
  feeds[sess.inputNames[0]] = inputTensor;

  const results = await sess.run(feeds);
  const outputName = sess.outputNames[0];
  const logit = (results[outputName].data as Float32Array)[0];

  // Apply sigmoid to logit
  const probability = 1 / (1 + Math.exp(-logit));
  const labelIdx = probability >= 0.5 ? 1 : 0;
  const label = CLASSES[labelIdx];
  const confidence = labelIdx === 1 ? probability : 1 - probability;

  return {
    label,
    probability,
    confidence,
    classes: CLASSES,
  };
}

/**
 * Occlusion sensitivity map. Slide a grey patch over the image and record
 * how the pneumonia probability changes. Upsample back to the original
 * image dimensions and encode as base64 PNG.
 */
export async function generateOcclusionHeatmap(
  imageBytes: Buffer,
  patchSize = 48,
  stride = 32
): Promise<string> {
  const sess = await loadModel();
  const baseTensor = await preprocessImage(imageBytes);
  const total = INPUT_CROP * INPUT_CROP;

  async function inferOccluded(occluded: Float32Array): Promise<number> {
    const inputTensor = new ort.Tensor("float32", occluded, [1, 3, INPUT_CROP, INPUT_CROP]);
    const feeds: Record<string, ort.Tensor> = {};
    feeds[sess.inputNames[0]] = inputTensor;
    const results = await sess.run(feeds);
    const logit = (results[sess.outputNames[0]].data as Float32Array)[0];
    return 1 / (1 + Math.exp(-logit));
  }

  const baseProb = await inferOccluded(baseTensor);
  const sensitivity = new Float32Array(total).fill(0);
  const counts = new Float32Array(total).fill(0);

  for (let y = 0; y <= INPUT_CROP - patchSize; y += stride) {
    for (let x = 0; x <= INPUT_CROP - patchSize; x += stride) {
      const occluded = new Float32Array(baseTensor);
      for (let py = 0; py < patchSize; py++) {
        for (let px = 0; px < patchSize; px++) {
          const idx = (y + py) * INPUT_CROP + (x + px);
          // Grey patch value = ImageNet mean in normalized space = 0
          occluded[idx] = 0;
          occluded[idx + total] = 0;
          occluded[idx + 2 * total] = 0;
        }
      }
      const prob = await inferOccluded(occluded);
      const diff = Math.abs(prob - baseProb);
      for (let py = 0; py < patchSize; py++) {
        for (let px = 0; px < patchSize; px++) {
          const idx = (y + py) * INPUT_CROP + (x + px);
          sensitivity[idx] += diff;
          counts[idx] += 1;
        }
      }
    }
  }

  // Normalize sensitivity map
  let maxVal = 0;
  for (let i = 0; i < total; i++) {
    if (counts[i] > 0) sensitivity[i] /= counts[i];
    if (sensitivity[i] > maxVal) maxVal = sensitivity[i];
  }
  if (maxVal > 0) {
    for (let i = 0; i < total; i++) sensitivity[i] /= maxVal;
  }

  // Build RGB heatmap overlay on cropped input image
  const originalMeta = await sharp(imageBytes)
    .grayscale()
    .resize(INPUT_RESIZE, INPUT_RESIZE, { fit: "fill" })
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const original = await sharp(originalMeta.data, {
    raw: {
      width: originalMeta.info.width,
      height: originalMeta.info.height,
      channels: 1,
    },
  })
    .extract({
      left: Math.floor((originalMeta.info.width - INPUT_CROP) / 2),
      top: Math.floor((originalMeta.info.height - INPUT_CROP) / 2),
      width: INPUT_CROP,
      height: INPUT_CROP,
    })
    .toColourspace("b-w")
    .raw()
    .toBuffer();

  const overlay = Buffer.alloc(3 * total);
  for (let i = 0; i < total; i++) {
    const heat = sensitivity[i];
    const v = original[i];
    // Jet-like coloring: low=blue, high=red
    const r = Math.min(255, Math.max(0, Math.round(heat * 255)));
    const b = Math.min(255, Math.max(0, Math.round((1 - heat) * 255)));
    const g = Math.min(255, Math.max(0, Math.round(heat * (1 - heat) * 4 * 255)));
    const alpha = 0.4;
    overlay[3 * i] = Math.round((1 - alpha) * v + alpha * r);
    overlay[3 * i + 1] = Math.round((1 - alpha) * v + alpha * g);
    overlay[3 * i + 2] = Math.round((1 - alpha) * v + alpha * b);
  }

  const png = await sharp(overlay, {
    raw: { width: INPUT_CROP, height: INPUT_CROP, channels: 3 },
  })
    .png()
    .toBuffer();

  return png.toString("base64");
}

export function getModelInfo() {
  return {
    name: "MedTriage ResNet18 Pneumonia Detector",
    format: "ONNX",
    path: MODEL_PATH,
    input_shape: [1, 3, INPUT_CROP, INPUT_CROP],
    preprocessing: {
      resize: INPUT_RESIZE,
      crop: INPUT_CROP,
      color: "grayscale",
      channels: 3,
      mean: MEAN,
      std: STD,
      layout: "NCHW",
    },
    classes: CLASSES,
    source: "https://github.com/Yaqi998/medtriage",
    dataset:
      "Kermany et al. Chest X-Ray Images (Pneumonia) - paediatric frontal chest X-rays",
    evaluation: {
      auroc: 0.997,
      accuracy: 0.973,
      sensitivity: 0.991,
      specificity: 0.924,
      n_images: 873,
    },
  };
}
