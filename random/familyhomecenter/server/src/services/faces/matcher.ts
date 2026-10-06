/**
 * Fast "how much does each face look like each named person" — the heavy part of suggestions.
 *
 * Every face's faceprint is kept in one block of memory, and for each named person we keep every
 * face's best similarity to any of their confirmed faces (and which one it was). That's kept up to
 * date incrementally: confirming faces only compares against the newly confirmed ones, newly
 * scanned photos only compare their own faces, and taking a face away from someone only redoes the
 * faces whose best match it was. The comparisons run in a tiny WebAssembly routine using the CPU's
 * vector (SIMD) instructions — several times faster than plain JavaScript (with a plain-JavaScript
 * fallback that gives the same results). Work is done in slices that yield to the event loop, so
 * the rest of the app stays responsive while a big library is first matched.
 */

const D = 128; // floats per faceprint
const ROW = D * 4; // bytes per faceprint
const SLICE = 4096; // faces per slice of work between yields

/**
 * maxdots(a, n, b, m, outBest, outArg): for each of n faceprints at byte offset a, the highest dot
 * product with any of the m faceprints at b, and its position — written as f32 / i32 arrays.
 * Compiled from a ~40-line WebAssembly text file (f32x4 multiply-adds); kept inline so nothing is
 * downloaded or built on the Pi.
 */
const MAXDOTS_WASM =
  'AGFzbQEAAAABCgFgBn9/f39/fwADAgEABQMBAAEHEQIDbWVtAgAHbWF4ZG90cwAACssCAcgCBAZ/AnsCfQF/AkADQCAGIAFPDQEgACAGQQl0aiELQwAAAMAhD0F/IRBBACEHIAIhCgJAA0AgByADTw0BIAshCf0MAAAAAAAAAAAAAAAAAAAAACEM/QwAAAAAAAAAAAAAAAAAAAAAIQ1BACEIA0AgDCAJ/QAEACAK/QAEAP3mAf3kASEMIA0gCf0ABBAgCv0ABBD95gH95AEhDSAMIAn9AAQgIAr9AAQg/eYB/eQBIQwgDSAJ/QAEMCAK/QAEMP3mAf3kASENIAlBwABqIQkgCkHAAGohCiAIQQFqIQggCEEISQ0ACyAMIA395AEhDCAM/R8AIAz9HwGSIAz9HwIgDP0fA5KSIQ4gDiAPXgRAIA4hDyAHIRALIAdBAWohBwwACwsgBCAGQQJ0aiAPOAIAIAUgBkECdGogEDYCACAGQQFqIQYMAAsLCw==';

type MaxDots = (a: number, n: number, b: number, m: number, outBest: number, outArg: number) => void;

let memory: WebAssembly.Memory;
let maxdots: MaxDots;

try {
  const instance = new WebAssembly.Instance(new WebAssembly.Module(Buffer.from(MAXDOTS_WASM, 'base64')));
  memory = instance.exports.mem as WebAssembly.Memory;
  maxdots = instance.exports.maxdots as MaxDots;
} catch {
  // No WebAssembly SIMD (very old Node): the same thing in plain JavaScript, on the same memory.
  memory = new WebAssembly.Memory({ initial: 1 });
  maxdots = (a, n, b, m, outBest, outArg) => {
    const f = new Float32Array(memory.buffer);
    const best = new Float32Array(memory.buffer, outBest, n);
    const arg = new Int32Array(memory.buffer, outArg, n);
    for (let i = 0; i < n; i++) {
      const ao = a / 4 + i * D;
      let top = -2;
      let at = -1;
      for (let j = 0; j < m; j++) {
        const bo = b / 4 + j * D;
        let s = 0;
        for (let k = 0; k < D; k++) s += f[ao + k] * f[bo + k];
        if (s > top) {
          top = s;
          at = j;
        }
      }
      best[i] = top;
      arg[i] = at;
    }
  };
}

const yieldToEventLoop = () => new Promise<void>((resolve) => setImmediate(resolve));

// ---- Faceprint store: faceprint i lives at byte i * ROW; scratch space follows the last one ----

let capacity = 0; // faceprints the reserved area can hold
let count = 0;
const indexOf = new Map<number, number>(); // face id → position

function ensureMemory(bytes: number): void {
  const have = memory.buffer.byteLength;
  if (bytes > have) memory.grow(Math.ceil((bytes - have) / 65536));
}

/** Adds faceprints (in id order, each once). */
export function addFaceprints(rows: Array<{ id: number; vector: Float32Array }>): void {
  if (count + rows.length > capacity) {
    capacity = Math.max(count + rows.length, Math.ceil(capacity * 1.5), 1024);
    ensureMemory(capacity * ROW);
  }
  const f = new Float32Array(memory.buffer);
  for (const r of rows) {
    if (indexOf.has(r.id)) continue;
    f.set(r.vector.subarray(0, D), count * D);
    indexOf.set(r.id, count++);
  }
}

export function faceIndex(faceId: number): number | undefined {
  return indexOf.get(faceId);
}

export function faceprintCount(): number {
  return count;
}

/** A face's faceprint (a copy — memory can move when it grows). */
export function faceprintOf(faceId: number): Float32Array | undefined {
  const i = indexOf.get(faceId);
  return i === undefined ? undefined : new Float32Array(memory.buffer, i * ROW, D).slice();
}

/**
 * Best match among `memberIds` for faces [from, to) — or for the listed face positions — calling
 * back with (position, best similarity, member id) for each.
 */
async function bestAmong(
  memberIds: number[],
  faces: { from: number; to: number } | number[],
  each: (i: number, sim: number, memberId: number) => void
): Promise<void> {
  const members = memberIds.filter((id) => indexOf.has(id));
  if (!members.length) return;
  const total = Array.isArray(faces) ? faces.length : faces.to - faces.from;
  for (let start = 0; start < total; start += SLICE) {
    const n = Math.min(SLICE, total - start);
    // Scratch, after the faceprints: members | gathered faces (for a list) | best | arg.
    const b = capacity * ROW;
    const gathered = b + members.length * ROW;
    const outBest = gathered + (Array.isArray(faces) ? n * ROW : 0);
    const outArg = outBest + n * 4;
    ensureMemory(outArg + n * 4);
    const bytes = new Uint8Array(memory.buffer);
    members.forEach((id, j) => bytes.copyWithin(b + j * ROW, indexOf.get(id)! * ROW, indexOf.get(id)! * ROW + ROW));
    let a: number;
    if (Array.isArray(faces)) {
      for (let k = 0; k < n; k++) bytes.copyWithin(gathered + k * ROW, faces[start + k] * ROW, faces[start + k] * ROW + ROW);
      a = gathered;
    } else {
      a = (faces.from + start) * ROW;
    }
    maxdots(a, n, b, members.length, outBest, outArg);
    const best = new Float32Array(memory.buffer, outBest, n);
    const arg = new Int32Array(memory.buffer, outArg, n);
    for (let k = 0; k < n; k++) {
      const i = Array.isArray(faces) ? faces[start + k] : faces.from + start + k;
      each(i, best[k], members[arg[k]]);
    }
    if (start + SLICE < total) await yieldToEventLoop();
  }
}

/**
 * Similarities within a set of faces, a row at a time: rowFor(k) = face k's similarity to each of
 * them (in the given order). The set is copied together once; each row is one fast pass.
 */
export function similarityRows(faceIds: number[]): (k: number) => Float32Array {
  const ids = faceIds.filter((id) => indexOf.has(id));
  if (ids.length !== faceIds.length) throw new Error('unknown face');
  const n = ids.length;
  const pool = capacity * ROW;
  const outBest = pool + n * ROW;
  const outArg = outBest + n * 4;
  ensureMemory(outArg + n * 4);
  const bytes = new Uint8Array(memory.buffer);
  ids.forEach((id, k) => bytes.copyWithin(pool + k * ROW, indexOf.get(id)! * ROW, indexOf.get(id)! * ROW + ROW));
  return (k) => {
    maxdots(pool, n, pool + k * ROW, 1, outBest, outArg);
    return new Float32Array(memory.buffer, outBest, n).slice();
  };
}

// ---- Per-person columns ----

interface Column {
  members: Set<number>;
  best: Float32Array; // by face position; -2 = no comparison yet
  bestMember: Int32Array; // which confirmed face gave it
  upTo: number; // positions [0, upTo) are filled in
}

const columns = new Map<string, Column>();

function grow(col: Column): void {
  if (col.best.length >= capacity) return;
  const best = new Float32Array(capacity).fill(-2);
  const bestMember = new Int32Array(capacity).fill(-1);
  best.set(col.best.subarray(0, col.upTo));
  bestMember.set(col.bestMember.subarray(0, col.upTo));
  col.best = best;
  col.bestMember = bestMember;
}

/** Brings one person's column up to date with their current confirmed faces; returns it. */
export async function personColumn(personId: string, memberIds: number[]): Promise<Float32Array> {
  let col = columns.get(personId);
  if (!col) {
    col = { members: new Set(), best: new Float32Array(0), bestMember: new Int32Array(0), upTo: 0 };
    columns.set(personId, col);
  }
  grow(col);
  const c = col;
  const members = new Set(memberIds);
  const removed = [...c.members].filter((m) => !members.has(m));
  const added = memberIds.filter((m) => !c.members.has(m));
  const set = (i: number, sim: number, memberId: number) => {
    c.best[i] = sim;
    c.bestMember[i] = memberId;
  };
  if (removed.length) {
    // Only faces whose best match was a removed face can change.
    const gone = new Set(removed);
    const redo: number[] = [];
    for (let i = 0; i < c.upTo; i++) {
      if (gone.has(c.bestMember[i])) {
        c.best[i] = -2;
        c.bestMember[i] = -1;
        redo.push(i);
      }
    }
    await bestAmong(memberIds, redo, set);
  }
  if (added.length) {
    await bestAmong(added, { from: 0, to: c.upTo }, (i, sim, m) => {
      if (sim > c.best[i]) set(i, sim, m);
    });
  }
  const n = count;
  if (n > c.upTo) {
    c.best.fill(-2, c.upTo, n);
    await bestAmong(memberIds, { from: c.upTo, to: n }, set);
  }
  c.upTo = n;
  c.members = members;
  return c.best;
}

export function forgetPeopleExcept(keep: Set<string>): void {
  for (const id of columns.keys()) if (!keep.has(id)) columns.delete(id);
}
