import fsSync from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
function mounts() {
    try {
        return fsSync
            .readFileSync('/proc/mounts', 'utf8')
            .split('\n')
            .map((l) => l.split(' '))
            .filter((f) => f.length > 2 && /^(cifs|smb3?|smbfs)$/.test(f[2]))
            .map((f) => {
            const unesc = (s) => s.replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
            const src = unesc(f[0]).replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(Boolean);
            return { host: (src[0] ?? '').toLowerCase(), parts: src.slice(1).map((p) => p.toLowerCase()), at: unesc(f[1]) };
        })
            .filter((m) => m.parts.length > 0);
    }
    catch {
        return [];
    }
}
/** The share location split up: an optional host, then the folders. */
function split(loc) {
    let s = loc.trim().replace(/^smb:/i, '').replace(/\\/g, '/');
    let host = null;
    if (s.startsWith('//')) {
        const p = s.replace(/^\/+/, '').split('/');
        host = (p.shift() ?? '').toLowerCase();
        s = p.join('/');
    }
    return { host, parts: s.split('/').filter(Boolean) };
}
/** Where `loc` is on the Pi, and whether it was found through a mounted share. */
export function resolveShare(loc) {
    if (!loc)
        return { local: loc, via: null };
    if (path.isAbsolute(loc) && !loc.startsWith('//') && fsSync.existsSync(loc))
        return { local: loc, via: null };
    const { host, parts } = split(loc);
    const lower = parts.map((p) => p.toLowerCase());
    let best = null;
    // A NAS named in the location wins; a share mounted by IP (or another name) still matches by share name.
    for (const m of mounts()) {
        const sameHost = !host || m.host === host || m.host.startsWith(`${host}.`);
        // The share name may come first ("/media/movies") or after a "/share" prefix ("/share/media/movies").
        for (const skip of [0, 1]) {
            const rest = lower.slice(skip);
            if (rest.length < m.parts.length || !m.parts.every((p, i) => rest[i] === p))
                continue;
            const score = m.parts.length * 2 + (skip === 0 ? 1 : 0) + (sameHost ? 100 : 0);
            if (!best || score > best.score)
                best = { local: path.join(m.at, ...parts.slice(skip + m.parts.length)), via: `//${m.host}/${m.parts.join('/')} on ${m.at}`, score };
        }
    }
    return best ? { local: best.local, via: best.via } : { local: loc, via: null };
}
/** The mounted share (from /proc/mounts, any type) that `dir` is inside, if any. */
export function mountFor(dir) {
    try {
        const unesc = (s) => s.replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
        const all = fsSync
            .readFileSync('/proc/mounts', 'utf8')
            .split('\n')
            .map((l) => l.split(' '))
            .filter((f) => f.length > 3)
            .map((f) => ({ source: unesc(f[0]), at: unesc(f[1]), fstype: f[2], options: f[3] }))
            .filter((m) => m.at !== '/' && (dir === m.at || dir.startsWith(m.at.endsWith('/') ? m.at : `${m.at}/`)));
        return all.sort((a, b) => b.at.length - a.at.length)[0] ?? null;
    }
    catch {
        return null;
    }
}
/**
 * Why the server can't read `dir` (null when it can) — in words a parent can act on. The server
 * runs as its own user (usually pi), so a folder that `ls` shows for root or another user can
 * still be closed to it.
 */
export async function folderProblem(dir) {
    const user = (() => {
        try {
            return os.userInfo().username;
        }
        catch {
            return `uid ${process.getuid?.() ?? '?'}`;
        }
    })();
    try {
        await fsp.readdir(dir);
        return null;
    }
    catch (e) {
        const code = e.code;
        const m = mountFor(dir);
        const how = m ? ` (${m.source} is mounted on ${m.at}, ${m.fstype})` : '';
        if (code === 'ENOENT') {
            return `${dir} doesn't exist for the Family Home Center${how}. Check the spelling (it's case-sensitive), and that it's a folder on the Pi itself — not a path on the NAS or another computer.`;
        }
        if (code === 'EACCES' || code === 'EPERM') {
            const uidOpt = m && /(^|,)uid=/.test(m.options) ? '' : ` Add uid=${user},gid=${user} to the mount's options in /etc/fstab, then remount.`;
            return `The Family Home Center runs as "${user}" and isn't allowed to read ${dir}${how}.${uidOpt} Test it with: sudo -u ${user} ls ${dir}`;
        }
        if (code === 'ENOTDIR')
            return `${dir} is a file, not a folder.`;
        if (code === 'EHOSTDOWN' || code === 'EHOSTUNREACH' || code === 'ETIMEDOUT' || code === 'EIO' || code === 'ESTALE' || code === 'ENODEV') {
            return `The share at ${dir} isn't answering (${code})${how} — is the NAS on? Try: sudo umount -l ${m?.at ?? dir} && sudo mount -a`;
        }
        return `Can't read ${dir}: ${e.message}${how}`;
    }
}
