import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
// 📲 Phone apps — install files for the family's own phone apps (e.g. 📱 SMB Sync in
// random/smbsync_app), kept on the Pi so phones on the home Wi-Fi install them from here.
// Files live in data/apps/<app>/ as <app>-<platform>-<timestamp>.<ext>; the newest one is offered.
// Older ones are never removed (a parent can roll back by hand). See docs/PHONE_APPS.md.
export const appsRouter = Router();
const APPS = [
    {
        id: 'smbsync',
        name: 'SMB Sync',
        icon: '📱',
        description: 'Copy or move photos, videos and files from your phone to a folder on a network share (SMB) — pick by date, type or name.',
        releaseTag: 'smbsync-latest',
        assets: { android: 'smbsync.apk', ios: 'smbsync-unsigned.ipa' },
    },
];
const EXT = { android: '.apk', ios: '.ipa' };
const MIME = {
    // This type is what makes an Android browser offer "Install" once it's downloaded.
    android: 'application/vnd.android.package-archive',
    ios: 'application/octet-stream',
};
/** owner/repo whose releases the builds are on — APPS_GITHUB_REPO in .env overrides it. */
const githubRepo = () => process.env.APPS_GITHUB_REPO?.trim() || 'acknowledgeHim/paloalto_parser';
const appsDir = path.join(config.dataDir, 'apps');
const appDir = (id) => path.join(appsDir, id);
function findApp(id) {
    return APPS.find((a) => a.id === id);
}
function isPlatform(p) {
    return p === 'android' || p === 'ios';
}
/** Newest stored file for an app + platform, or null. */
function newest(app, platform) {
    const dir = appDir(app.id);
    let names;
    try {
        names = fs.readdirSync(dir);
    }
    catch {
        return null;
    }
    const prefix = `${app.id}-${platform}-`;
    const files = names.filter((n) => n.startsWith(prefix) && n.endsWith(EXT[platform])).sort(); // timestamp in the name
    const file = files.at(-1);
    if (!file)
        return null;
    const full = path.join(dir, file);
    const st = fs.statSync(full);
    let meta = { source: 'upload', savedAt: st.mtime.toISOString() };
    try {
        meta = { ...meta, ...JSON.parse(fs.readFileSync(`${full}.json`, 'utf8')) };
    }
    catch {
        /* no sidecar — fine */
    }
    return { file, size: st.size, savedAt: meta.savedAt, source: meta.source, remoteUpdatedAt: meta.remoteUpdatedAt };
}
function stamp() {
    return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15); // 20261107-143005
}
/** Writes to a dot-name first, then renames, so a half-written file is never offered. */
async function store(app, platform, data, meta) {
    const dir = appDir(app.id);
    await fs.promises.mkdir(dir, { recursive: true });
    const name = `${app.id}-${platform}-${stamp()}${EXT[platform]}`;
    const tmp = path.join(dir, `.${name}.part`);
    await fs.promises.writeFile(tmp, data);
    await fs.promises.writeFile(path.join(dir, `${name}.json`), JSON.stringify(meta, null, 2));
    await fs.promises.rename(tmp, path.join(dir, name));
    return newest(app, platform);
}
function looksRight(platform, data) {
    // Both .apk and .ipa are zip files: "PK\x03\x04".
    return data.length > 1000 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04 && !!platform;
}
/** GET / — the apps and what the Pi has for each phone. */
appsRouter.get('/', (_req, res) => {
    res.json({
        repo: githubRepo(),
        apps: APPS.map((a) => ({
            id: a.id,
            name: a.name,
            icon: a.icon,
            description: a.description,
            releaseUrl: `https://github.com/${githubRepo()}/releases/tag/${a.releaseTag}`,
            android: newest(a, 'android'),
            ios: newest(a, 'ios'),
        })),
    });
});
/** GET /:id/:platform/download — the newest install file. */
appsRouter.get('/:id/:platform/download', (req, res) => {
    const app = findApp(req.params.id);
    const platform = req.params.platform;
    if (!app || !isPlatform(platform))
        return res.status(404).json({ error: 'No such app' });
    const s = newest(app, platform);
    if (!s)
        return res.status(404).json({ error: `No ${platform === 'android' ? 'Android' : 'iPhone'} file on the Pi yet` });
    res.setHeader('Content-Type', MIME[platform]);
    res.setHeader('Cache-Control', 'no-store');
    res.download(path.join(appDir(app.id), s.file), app.assets[platform], { headers: { 'Content-Type': MIME[platform] } });
});
/**
 * POST /:id/fetch — a parent: copy the latest build from the app's GitHub release onto the Pi
 * (both phones). Skips a file whose build is the same as the one already here.
 */
appsRouter.post('/:id/fetch', requireAdmin, asyncHandler(async (req, res) => {
    const app = findApp(req.params.id);
    if (!app)
        return res.status(404).json({ error: 'No such app' });
    const api = `https://api.github.com/repos/${githubRepo()}/releases/tags/${app.releaseTag}`;
    let release;
    try {
        const r = await fetch(api, {
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'familyhomecenter' },
            signal: AbortSignal.timeout(15_000),
        });
        if (r.status === 404) {
            return res.status(404).json({
                error: `GitHub has no "${app.releaseTag}" release yet — the build hasn't run. See docs/PHONE_APPS.md, or upload the file here instead.`,
            });
        }
        if (!r.ok)
            return res.status(502).json({ error: `GitHub answered ${r.status}` });
        release = (await r.json());
    }
    catch (e) {
        return res.status(502).json({ error: `Couldn't reach GitHub: ${e.message}` });
    }
    const results = { android: 'not in the release', ios: 'not in the release' };
    for (const platform of ['android', 'ios']) {
        const asset = release.assets?.find((a) => a.name === app.assets[platform]);
        if (!asset)
            continue;
        const have = newest(app, platform);
        if (have?.remoteUpdatedAt === asset.updated_at) {
            results[platform] = 'already up to date';
            continue;
        }
        try {
            const dl = await fetch(asset.browser_download_url, {
                headers: { 'User-Agent': 'familyhomecenter' },
                signal: AbortSignal.timeout(10 * 60_000),
            });
            if (!dl.ok)
                throw new Error(`download answered ${dl.status}`);
            const data = Buffer.from(await dl.arrayBuffer());
            if (data.length !== asset.size)
                throw new Error(`got ${data.length} bytes, expected ${asset.size}`);
            if (!looksRight(platform, data))
                throw new Error("that isn't an app file");
            await store(app, platform, data, {
                source: 'github',
                remoteUpdatedAt: asset.updated_at,
                savedAt: new Date().toISOString(),
            });
            results[platform] = 'downloaded';
        }
        catch (e) {
            results[platform] = `failed: ${e.message}`;
        }
    }
    res.json({ results, android: newest(app, 'android'), ios: newest(app, 'ios') });
}));
/** POST /:id/:platform/upload (the .apk / .ipa as the body) — a parent puts a file on the Pi by hand. */
appsRouter.post('/:id/:platform/upload', requireAdmin, express.raw({ type: () => true, limit: '400mb' }), asyncHandler(async (req, res) => {
    const app = findApp(req.params.id);
    const platform = req.params.platform;
    if (!app || !isPlatform(platform))
        return res.status(404).json({ error: 'No such app' });
    const data = req.body;
    if (!Buffer.isBuffer(data) || !looksRight(platform, data)) {
        return res.status(400).json({ error: `That doesn't look like an ${EXT[platform]} file` });
    }
    const s = await store(app, platform, data, { source: 'upload', savedAt: new Date().toISOString() });
    res.json(s);
}));
