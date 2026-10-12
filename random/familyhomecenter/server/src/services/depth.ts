import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';

/**
 * "How far away is each part of this photo" — for living photos' 3-D effect (livingPhoto.ts), so the
 * people, what's behind them, and the far background each move by their own amount, like a camera
 * gliding through the scene. Uses Depth Anything V2 Small (Apache-2.0), quantized to 27 MB, run with
 * onnxruntime on this machine: downloaded once, the first time a 3-D living photo is made — nothing
 * about the photo is ever sent anywhere.
 */

const MODEL = {
  file: 'depth_anything_v2_small_q.onnx',
  // Pinned to one revision, and checked: the file is only used if it's exactly the one tested.
  url: 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/4472b7362082ad9968fee890ca0f1e5aca36b93d/onnx/model_quantized.onnx',
  bytes: 27_258_801,
  sha256: 'fcf51f1b230362b28690bb9d1809bf0431f29cad20534e3f589bd7285547f20d',
};
/** The model's input size (a multiple of its 14px patches); its output is the same. */
const N = 518;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

const modelPath = () => path.join(config.dataDir, 'models', MODEL.file);

async function ensureModel(): Promise<void> {
  try {
    if ((await fs.stat(modelPath())).size === MODEL.bytes) return;
  } catch {
    // not downloaded yet
  }
  await fs.mkdir(path.dirname(modelPath()), { recursive: true });
  const resp = await fetch(MODEL.url, { signal: AbortSignal.timeout(300_000) });
  if (!resp.ok) throw new Error(`Couldn't download the depth model (HTTP ${resp.status})`);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length !== MODEL.bytes || crypto.createHash('sha256').update(buf).digest('hex') !== MODEL.sha256) {
    throw new Error("The depth model that downloaded isn't the expected file");
  }
  await fs.writeFile(`${modelPath()}.part`, buf);
  await fs.rename(`${modelPath()}.part`, modelPath());
}

type Session = import('onnxruntime-node').InferenceSession;
let session: Promise<{ ort: typeof import('onnxruntime-node'); session: Session }> | null = null;

function getSession() {
  if (!session) {
    session = (async () => {
      await ensureModel();
      process.env.ORT_DISABLE_TELEMETRY = '1';
      const mod = (await import('onnxruntime-node')) as typeof import('onnxruntime-node') & { default?: typeof import('onnxruntime-node') };
      const ort = mod.InferenceSession ? mod : mod.default!;
      return { ort, session: await ort.InferenceSession.create(modelPath(), { logSeverityLevel: 3, intraOpNumThreads: 2, interOpNumThreads: 1 }) };
    })();
    session.catch(() => {
      session = null;
    });
  }
  return session;
}

/**
 * A depth map of an RGB image (raw, width × height × 3): `width`/`height` = the map's own size,
 * values 0 (farthest) … 1 (nearest), softened a little so the 3-D motion doesn't tear at edges.
 */
export async function estimateDepth(
  rgb: Buffer,
  width: number,
  height: number,
  out: { width: number; height: number }
): Promise<Float32Array> {
  const { ort, session: s } = await getSession();
  const small = await sharp(rgb, { raw: { width, height, channels: 3 } }).resize(N, N, { fit: 'fill' }).raw().toBuffer();
  const input = new Float32Array(3 * N * N);
  for (let i = 0; i < N * N; i++) {
    for (let c = 0; c < 3; c++) input[c * N * N + i] = (small[i * 3 + c] / 255 - MEAN[c]) / STD[c];
  }
  const result = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, N, N]) });
  const raw = result[s.outputNames[0]].data as Float32Array;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of raw) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const bytes = Buffer.alloc(N * N);
  for (let i = 0; i < raw.length; i++) bytes[i] = Math.round(((raw[i] - lo) / (hi - lo || 1)) * 255);
  const map = await sharp(bytes, { raw: { width: N, height: N, channels: 1 } })
    .resize(out.width, out.height, { fit: 'fill' })
    .blur(Math.max(1, out.width / 400))
    .extractChannel(0)
    .raw()
    .toBuffer();
  const depth = new Float32Array(out.width * out.height);
  for (let i = 0; i < depth.length; i++) depth[i] = map[i] / 255;
  return depth;
}
