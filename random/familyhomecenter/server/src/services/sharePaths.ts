import fsSync from 'node:fs';
import path from 'node:path';

/**
 * 🗂️ Turns a location on the SMB share — the way it looks on the NAS ("/share/media/movies",
 * "//nas/media/movies", "\\nas\media\movies", "smb://nas/media/movies") — into the folder on the Pi
 * where that share is mounted (from /proc/mounts, e.g. //nas/media on /mnt/media →
 * /mnt/media/movies). A folder that already exists on the Pi is used as it is.
 * QNAP-style "/share/<ShareName>/…" works too: the share name can be the first or second part.
 */

interface Mount {
  host: string;
  parts: string[]; // share name, then any sub-folder the mount starts at
  at: string;
}

function mounts(): Mount[] {
  try {
    return fsSync
      .readFileSync('/proc/mounts', 'utf8')
      .split('\n')
      .map((l) => l.split(' '))
      .filter((f) => f.length > 2 && /^(cifs|smb3?|smbfs)$/.test(f[2]))
      .map((f) => {
        const unesc = (s: string) => s.replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
        const src = unesc(f[0]).replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(Boolean);
        return { host: (src[0] ?? '').toLowerCase(), parts: src.slice(1).map((p) => p.toLowerCase()), at: unesc(f[1]) };
      })
      .filter((m) => m.parts.length > 0);
  } catch {
    return [];
  }
}

/** The share location split up: an optional host, then the folders. */
function split(loc: string): { host: string | null; parts: string[] } {
  let s = loc.trim().replace(/^smb:/i, '').replace(/\\/g, '/');
  let host: string | null = null;
  if (s.startsWith('//')) {
    const p = s.replace(/^\/+/, '').split('/');
    host = (p.shift() ?? '').toLowerCase();
    s = p.join('/');
  }
  return { host, parts: s.split('/').filter(Boolean) };
}

/** Where `loc` is on the Pi, and whether it was found through a mounted share. */
export function resolveShare(loc: string): { local: string; via: string | null } {
  if (!loc) return { local: loc, via: null };
  if (path.isAbsolute(loc) && !loc.startsWith('//') && fsSync.existsSync(loc)) return { local: loc, via: null };
  const { host, parts } = split(loc);
  const lower = parts.map((p) => p.toLowerCase());
  let best: { local: string; via: string; score: number } | null = null;
  // A NAS named in the location wins; a share mounted by IP (or another name) still matches by share name.
  for (const m of mounts()) {
    const sameHost = !host || m.host === host || m.host.startsWith(`${host}.`);
    // The share name may come first ("/media/movies") or after a "/share" prefix ("/share/media/movies").
    for (const skip of [0, 1]) {
      const rest = lower.slice(skip);
      if (rest.length < m.parts.length || !m.parts.every((p, i) => rest[i] === p)) continue;
      const score = m.parts.length * 2 + (skip === 0 ? 1 : 0) + (sameHost ? 100 : 0);
      if (!best || score > best.score) best = { local: path.join(m.at, ...parts.slice(skip + m.parts.length)), via: `//${m.host}/${m.parts.join('/')} on ${m.at}`, score };
    }
  }
  return best ? { local: best.local, via: best.via } : { local: loc, via: null };
}
