import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * What a picture/video file really is, from its first bytes. Uploads from an iPhone Shortcut can
 * come with a name and no extension ("IMG_1234"), or as a JPEG still called .heic, so the name the
 * file is filed under gets the right extension.
 */
const FAMILY: Record<string, string[]> = {
  '.jpg': ['.jpg', '.jpeg'],
  '.heic': ['.heic', '.heif'],
  '.png': ['.png'],
  '.gif': ['.gif'],
  '.webp': ['.webp'],
  '.mov': ['.mov', '.qt'],
  '.mp4': ['.mp4', '.m4v'],
};

export async function sniffExt(file: string): Promise<string | null> {
  const fh = await fs.open(file, 'r');
  try {
    const b = Buffer.alloc(16);
    await fh.read(b, 0, 16, 0);
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
    if (b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return '.png';
    if (b.subarray(0, 4).toString('latin1') === 'GIF8') return '.gif';
    if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return '.webp';
    if (b.subarray(4, 8).toString('latin1') === 'ftyp') {
      const brand = b.subarray(8, 12).toString('latin1').toLowerCase();
      if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return '.heic';
      if (brand === 'qt  ') return '.mov';
      return '.mp4'; // isom, mp41, mp42, avc1, m4v, 3gp…
    }
    // Old QuickTime files can start with another atom (wide/mdat/moov) before any ftyp.
    if (['wide', 'mdat', 'moov', 'free', 'skip'].includes(b.subarray(4, 8).toString('latin1'))) return '.mov';
    return null;
  } finally {
    await fh.close();
  }
}

/** The name with the extension that matches what the file is (kept as it is if it already fits). */
export function fixName(name: string, real: string | null): string {
  if (!real) return name;
  const ext = path.extname(name).toLowerCase();
  if (FAMILY[real]?.includes(ext)) return name;
  const known = Object.values(FAMILY).some((f) => f.includes(ext));
  return `${known ? name.slice(0, -ext.length) : name}${real}`;
}
