/**
 * When a picked photo/video was taken, read on the phone before uploading — so 📤 Add photos'
 * "only between these dates" doesn't send what it'll skip anyway. Small and dependency-free:
 *  - Pictures (JPEG, HEIC, PNG, WebP): the EXIF dates are plain text ("2025:08:14 17:22:01") near
 *    the start of the file; the earliest one is when it was taken (later ones are edits).
 *  - Videos (.mov / .mp4): an iPhone's "com.apple.quicktime.creationdate" (local time with its
 *    zone), else the movie header (mvhd) creation time.
 * Null when it can't tell — the server then decides (it checks the same dates).
 */

const EXIF_DATE = /((?:19|20)\d\d):([01]\d):([0-3]\d) ([0-2]\d):([0-5]\d):([0-5]\d)/g;
const APPLE_DATE = /((?:19|20)\d\d-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d(?:[+-]\d\d:?\d\d|Z))/;

const text = (buf: ArrayBuffer) => {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
};

async function pictureDate(f: File): Promise<Date | null> {
  const s = text(await f.slice(0, 512 * 1024).arrayBuffer());
  let best: Date | null = null;
  for (const m of s.matchAll(EXIF_DATE)) {
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    if (Number.isNaN(d.getTime()) || +m[2] < 1 || +m[2] > 12) continue;
    if (!best || d < best) best = d;
  }
  return best;
}

async function videoDate(f: File): Promise<Date | null> {
  // Walk the top-level boxes (only their 8–16 byte headers) to find moov, wherever it is.
  let pos = 0;
  for (let n = 0; n < 200 && pos + 8 <= f.size; n++) {
    const h = new DataView(await f.slice(pos, pos + 16).arrayBuffer());
    let size = h.getUint32(0);
    const type = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7));
    if (size === 1) size = Number(h.getBigUint64(8));
    else if (size === 0) size = f.size - pos;
    if (size < 8) return null;
    if (type === 'moov') {
      if (size > 50 * 1024 * 1024) return null;
      const buf = await f.slice(pos, pos + size).arrayBuffer();
      const s = text(buf);
      const apple = s.indexOf('com.apple.quicktime.creationdate');
      if (apple >= 0) {
        // The value sits in the metadata list after the keys; look for the first ISO date after it.
        const m = s.slice(apple).match(APPLE_DATE);
        const d = m ? new Date(m[1].replace(/([+-]\d\d)(\d\d)$/, '$1:$2')) : null;
        if (d && !Number.isNaN(d.getTime())) return d;
      }
      const at = s.indexOf('mvhd');
      if (at < 4) return null;
      const v = new DataView(buf, at + 4);
      const secs = v.getUint8(0) === 1 ? Number(v.getBigUint64(4)) : v.getUint32(4);
      if (!secs) return null;
      const d = new Date(Date.UTC(1904, 0, 1) + secs * 1000);
      return d.getFullYear() > 1970 ? d : null;
    }
    pos += size;
  }
  return null;
}

export async function mediaDate(f: File): Promise<Date | null> {
  try {
    const isVideo = f.type.startsWith('video/') || /\.(mov|mp4|m4v|qt)$/i.test(f.name);
    return isVideo ? await videoDate(f) : await pictureDate(f);
  } catch {
    return null;
  }
}
