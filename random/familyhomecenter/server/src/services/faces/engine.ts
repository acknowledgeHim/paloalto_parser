import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { InferenceSession as InferenceSessionType } from 'onnxruntime-node';
import { config } from '../../config.js';

/**
 * Face detection + "faceprints", entirely on this machine — two small models from OpenCV's model
 * zoo, run with onnxruntime:
 *   - YuNet (MIT): finds faces and 5 landmarks (eyes, nose, mouth corners) in a 640x640 image.
 *   - SFace (Apache-2.0): turns a face, aligned to a standard 112x112 pose, into 128 numbers that
 *     are close together for the same person (cosine similarity).
 * The pre/post-processing mirrors OpenCV's own FaceDetectorYN / FaceRecognizerSF so the models
 * behave as their authors tuned them. Models are downloaded once, on first use, to data/models.
 */

const MODELS = {
  detector: {
    file: 'face_detection_yunet_2023mar.onnx',
    urls: [
      'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx',
      'https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx',
    ],
    bytes: 232_589,
  },
  recognizer: {
    file: 'face_recognition_sface_2021dec.onnx',
    urls: [
      'https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx',
      'https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx',
    ],
    bytes: 38_696_353,
  },
} as const;

const INPUT = 640; // YuNet's fixed input size
const STRIDES = [8, 16, 32];
const SCORE_THRESHOLD = 0.85;
const NMS_THRESHOLD = 0.3;
/** Faces smaller than this (in the detection image's pixels) are too small to recognize well. */
const MIN_FACE_PX = 24;
/** SFace's standard landmark positions in its 112x112 input (from OpenCV's face_recognize.cpp). */
const ALIGNED = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

const modelsDir = () => path.join(config.dataDir, 'models');

export function modelsPresent(): boolean {
  return Object.values(MODELS).every((m) => {
    try {
      return fs.statSync(path.join(modelsDir(), m.file)).size === m.bytes;
    } catch {
      return false;
    }
  });
}

/** Downloads whichever model isn't here yet (trying a mirror if the first source fails). */
export async function ensureModels(): Promise<void> {
  await fsp.mkdir(modelsDir(), { recursive: true });
  for (const m of Object.values(MODELS)) {
    const dest = path.join(modelsDir(), m.file);
    try {
      if ((await fsp.stat(dest)).size === m.bytes) continue;
    } catch {
      // not downloaded yet
    }
    let lastError: unknown = null;
    for (const url of m.urls) {
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(300_000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = Buffer.from(await resp.arrayBuffer());
        if (buf.length !== m.bytes) throw new Error(`unexpected size ${buf.length}`);
        await fsp.writeFile(`${dest}.part`, buf);
        await fsp.rename(`${dest}.part`, dest);
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (lastError) throw new Error(`Couldn't download the face model ${m.file}: ${(lastError as Error).message}`);
  }
}

/** onnxruntime-node is CommonJS; depending on how it's loaded, its API is the module itself or its
 *  `default`. Imported lazily — it's a big native module, only needed once faces are turned on. */
async function loadOrt(): Promise<typeof import('onnxruntime-node')> {
  // ONNX Runtime (1.2x+) includes Microsoft usage telemetry that tries to reach
  // mobile.events.data.microsoft.com. Switched off with its own documented setting, set here
  // before the library loads so it can't depend on anyone remembering it (scripts/
  // familyhomecenter.service sets it too). Verified: with this set, the server makes no internet
  // connections or lookups at all while scanning faces.
  process.env.ORT_DISABLE_TELEMETRY = '1';
  const mod = (await import('onnxruntime-node')) as typeof import('onnxruntime-node') & { default?: typeof import('onnxruntime-node') };
  return mod.InferenceSession ? mod : mod.default!;
}

let sessions: Promise<{ detector: InferenceSessionType; recognizer: InferenceSessionType }> | null = null;

async function getSessions() {
  if (!sessions) {
    sessions = (async () => {
      await ensureModels();
      const ort = await loadOrt();
      // Two threads: leave the rest of a Pi's CPU for everything else the dashboard is doing.
      const opts = { logSeverityLevel: 3 as const, intraOpNumThreads: 2, interOpNumThreads: 1 };
      return {
        detector: await ort.InferenceSession.create(path.join(modelsDir(), MODELS.detector.file), opts),
        recognizer: await ort.InferenceSession.create(path.join(modelsDir(), MODELS.recognizer.file), opts),
      };
    })();
    sessions.catch(() => {
      sessions = null;
    });
  }
  return sessions;
}

export interface DetectedFace {
  /** Box as fractions (0–1) of the (upright) image's width/height. */
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  /** 128 numbers, unit length — compare with cosineSimilarity. */
  embedding: Float32Array;
}

interface RawFace {
  box: [number, number, number, number]; // x1, y1, w, h in detection pixels
  landmarks: number[]; // 10 values: x,y × 5
  score: number;
}

function iou(a: RawFace['box'], b: RawFace['box']): number {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[0] + a[2], b[0] + b[2]);
  const y2 = Math.min(a[1] + a[3], b[1] + b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a[2] * a[3] + b[2] * b[3] - inter || 1);
}

/** YuNet's raw outputs → faces (OpenCV FaceDetectorYN::postProcess, then NMS). */
function decode(outputs: Record<string, { data: unknown }>): RawFace[] {
  const faces: RawFace[] = [];
  for (const stride of STRIDES) {
    const cols = INPUT / stride;
    const rows = INPUT / stride;
    const cls = outputs[`cls_${stride}`].data as Float32Array;
    const obj = outputs[`obj_${stride}`].data as Float32Array;
    const bbox = outputs[`bbox_${stride}`].data as Float32Array;
    const kps = outputs[`kps_${stride}`].data as Float32Array;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const score = Math.sqrt(Math.min(Math.max(cls[i], 0), 1) * Math.min(Math.max(obj[i], 0), 1));
        if (score < SCORE_THRESHOLD) continue;
        const cx = (c + bbox[i * 4]) * stride;
        const cy = (r + bbox[i * 4 + 1]) * stride;
        const w = Math.exp(bbox[i * 4 + 2]) * stride;
        const h = Math.exp(bbox[i * 4 + 3]) * stride;
        const landmarks: number[] = [];
        for (let n = 0; n < 5; n++) landmarks.push((kps[i * 10 + 2 * n] + c) * stride, (kps[i * 10 + 2 * n + 1] + r) * stride);
        faces.push({ box: [cx - w / 2, cy - h / 2, w, h], landmarks, score });
      }
    }
  }
  faces.sort((a, b) => b.score - a.score);
  const kept: RawFace[] = [];
  for (const f of faces) if (kept.every((k) => iou(k.box, f.box) <= NMS_THRESHOLD)) kept.push(f);
  return kept;
}

/** Least-squares similarity transform (rotation + uniform scale + shift) taking `src` points onto
 *  `dst` — what OpenCV's alignCrop estimates from the 5 landmarks. Returns [a, b, tx, ty] for
 *  x' = a·x − b·y + tx, y' = b·x + a·y + ty. */
function similarity(src: number[][], dst: number[][]): [number, number, number, number] {
  const n = src.length;
  const ms = [src.reduce((s, p) => s + p[0], 0) / n, src.reduce((s, p) => s + p[1], 0) / n];
  const md = [dst.reduce((s, p) => s + p[0], 0) / n, dst.reduce((s, p) => s + p[1], 0) / n];
  let num1 = 0;
  let num2 = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const px = src[i][0] - ms[0];
    const py = src[i][1] - ms[1];
    const qx = dst[i][0] - md[0];
    const qy = dst[i][1] - md[1];
    num1 += px * qx + py * qy;
    num2 += px * qy - py * qx;
    den += px * px + py * py;
  }
  const a = num1 / den;
  const b = num2 / den;
  return [a, b, md[0] - (a * ms[0] - b * ms[1]), md[1] - (b * ms[0] + a * ms[1])];
}

/** Warps the face into SFace's 112x112 pose (bilinear sampling) and returns it as SFace's input:
 *  RGB, 0–255, channel-first — matching OpenCV's blobFromImage(swapRB=true) on the BGR crop. */
function alignedInput(rgb: Buffer, width: number, height: number, landmarks: number[][]): Float32Array {
  const [a, b, tx, ty] = similarity(landmarks, ALIGNED);
  const det = a * a + b * b;
  const out = new Float32Array(3 * 112 * 112);
  for (let v = 0; v < 112; v++) {
    for (let u = 0; u < 112; u++) {
      // Inverse of the similarity transform: where in the source this output pixel comes from.
      const dx = u - tx;
      const dy = v - ty;
      const x = (a * dx + b * dy) / det;
      const y = (-b * dx + a * dy) / det;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      for (let ch = 0; ch < 3; ch++) {
        const px = (xx: number, yy: number) =>
          xx < 0 || yy < 0 || xx >= width || yy >= height ? 0 : rgb[(yy * width + xx) * 3 + ch];
        const value =
          px(x0, y0) * (1 - fx) * (1 - fy) + px(x0 + 1, y0) * fx * (1 - fy) + px(x0, y0 + 1) * (1 - fx) * fy + px(x0 + 1, y0 + 1) * fx * fy;
        out[ch * 112 * 112 + v * 112 + u] = value;
      }
    }
  }
  return out;
}

function normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

/** For unit-length faceprints: 1 = identical, ~0 = unrelated. SFace's authors use 0.363 as the
 *  "same person" line. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Finds the faces in an (already upright) image file and computes each one's faceprint. Uses the
 * image as given — callers pass the photo's cached thumbnail, which is EXIF-rotated and modest in
 * size, so this is quick and never touches the original.
 */
export async function detectFaces(imagePath: string): Promise<DetectedFace[]> {
  const { detector, recognizer } = await getSessions();
  const ort = await loadOrt();

  // The full image as raw RGB (for aligning faces) …
  const { data: rgb, info } = await sharp(imagePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // … and a 640x640 copy for the detector: scaled to fit, padded at the right/bottom, BGR.
  const scale = INPUT / Math.max(width, height);
  const { data: small, info: smallInfo } = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .resize(Math.round(width * scale), Math.round(height * scale))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const input = new Float32Array(3 * INPUT * INPUT);
  for (let y = 0; y < smallInfo.height; y++) {
    for (let x = 0; x < smallInfo.width; x++) {
      const s = (y * smallInfo.width + x) * 3;
      const d = y * INPUT + x;
      input[d] = small[s + 2]; // B
      input[INPUT * INPUT + d] = small[s + 1]; // G
      input[2 * INPUT * INPUT + d] = small[s]; // R
    }
  }
  const raw = decode(await detector.run({ input: new ort.Tensor('float32', input, [1, 3, INPUT, INPUT]) }));

  const faces: DetectedFace[] = [];
  for (const f of raw) {
    if (Math.min(f.box[2], f.box[3]) < MIN_FACE_PX) continue;
    const landmarks = [0, 1, 2, 3, 4].map((n) => [f.landmarks[n * 2] / scale, f.landmarks[n * 2 + 1] / scale]);
    const aligned = alignedInput(rgb, width, height, landmarks);
    const out = await recognizer.run({ data: new ort.Tensor('float32', aligned, [1, 3, 112, 112]) });
    const embedding = normalize(out.fc1.data as Float32Array);
    const [x1, y1, w, h] = f.box.map((v) => v / scale);
    faces.push({
      x: Math.max(0, x1 / width),
      y: Math.max(0, y1 / height),
      w: Math.min(1, w / width),
      h: Math.min(1, h / height),
      score: f.score,
      embedding,
    });
  }
  return faces;
}
