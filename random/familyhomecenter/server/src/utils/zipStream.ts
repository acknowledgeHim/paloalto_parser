import fs from 'node:fs';
import type { Writable } from 'node:stream';

/**
 * A plain ZIP written straight to a response as it's read from disk — no temp file. Files are
 * "stored" (not squeezed again: videos and JPEGs are already compressed), with sizes and CRC after
 * each file (data descriptors). Keep each zip under 4 GB and 65,535 files (callers split into parts)
 * so every unzip tool — Windows, macOS, phones — opens it without ZIP64.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer, crc = 0): number {
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export const ZIP_PART_MAX_BYTES = 3.5 * 1024 ** 3;
export const ZIP_PART_MAX_FILES = 60_000;

export async function writeZip(out: Writable, files: Array<{ name: string; path: string; mtime?: Date }>, isClosed: () => boolean): Promise<void> {
  let offset = 0;
  const central: Buffer[] = [];
  const write = async (b: Buffer) => {
    offset += b.length;
    if (!out.write(b)) await new Promise<void>((r) => out.once('drain', () => r()));
  };
  for (const f of files) {
    if (isClosed()) return;
    const name = Buffer.from(f.name, 'utf8');
    const { time, date } = dosTime(f.mtime ?? new Date());
    const start = offset;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0808, 6); // sizes after the data; UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt16LE(name.length, 26);
    await write(Buffer.concat([local, name]));
    let crc = 0;
    let size = 0;
    for await (const chunk of fs.createReadStream(f.path, { highWaterMark: 1024 * 1024 })) {
      if (isClosed()) return;
      const b = chunk as Buffer;
      crc = crc32(b, crc);
      size += b.length;
      await write(b);
    }
    const desc = Buffer.alloc(16);
    desc.writeUInt32LE(0x08074b50, 0);
    desc.writeUInt32LE(crc, 4);
    desc.writeUInt32LE(size, 8);
    desc.writeUInt32LE(size, 12);
    await write(desc);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0808, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(size, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(start, 42);
    central.push(cd, name);
  }
  const cdStart = offset;
  const cdBuf = Buffer.concat(central);
  await write(cdBuf);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(cdStart, 16);
  await write(end);
}
