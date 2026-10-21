import { Router } from 'express';
import path from 'node:path';
import { listPhotos, listVisiblePhotos, hiddenPhotoPaths, getOrCreateThumbnail, photoIdFor, findPhotoById } from '../services/photos.js';
import { db } from '../db.js';
import { getPhotoDate } from '../services/photoDates.js';
import { mapWithConcurrency } from '../services/movieSelection.js';
import { config } from '../config.js';
import { getPhotoQuality } from '../services/photoAnalysis.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import fsSync from 'node:fs';
import { gzipSync } from 'node:zlib';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { autoSortOn, canWrite, fileOne, inboxDir, PICTURE_EXTS, registerInbox, sortInbox } from '../services/photoFiling.js';
import { photosChanged } from '../services/photos.js';
import { getSetting, setSetting } from '../db.js';
import { isParentRequest } from '../services/rewards.js';
import { getOriginalPhotoDate, photoDateSource } from '../services/photoDates.js';
import { getPhotoGps, mapOutlines, middleOf, placeLists, placeOf, placeEdit, savePlaceEdit } from '../services/photoPlaces.js';

export const photosRouter = Router();

photosRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const files = await listPhotos();
    const quality = getPhotoQuality();
    const hidden = hiddenPhotoPaths();
    res.json(
      files.map((f) => {
        const rel = path.relative(config.photosDir, f);
        return { id: photoIdFor(f), blurry: quality.get(rel)?.blurry ?? null, hidden: hidden.has(rel) };
      })
    );
  })
);

/** GET /details — every photo's folder/filename (relative to PHOTOS_DIR) and best-effort date
 *  taken, for sorting/filtering the movie maker's photo grid. Dates come from the same cache as
 *  date-range movie selections (services/photoDates.ts), so only the first call after a restart
 *  pays for reading EXIF, capped to a few reads at a time for the sake of an SMB share. */
photosRouter.get(
  '/details',
  asyncHandler(async (_req, res) => {
    const files = await listPhotos();
    const quality = getPhotoQuality();
    const hidden = hiddenPhotoPaths();
    const details = await mapWithConcurrency(files, 8, async (f) => {
      const rel = path.relative(config.photosDir, f);
      const q = quality.get(rel);
      return {
        id: photoIdFor(f),
        path: rel,
        taken_at: (await getPhotoDate(f)).toISOString(),
        // Duplicate/blur analysis (services/photoAnalysis.ts) — null/false until it's run.
        blurry: q?.blurry ?? null,
        dup_group: q?.dup_group ?? null,
        dup_best: q?.dup_best ?? false,
        hidden: hidden.has(rel),
        // 📍 Where it was taken (GPS from the photo, or set by hand) — services/photoPlaces.ts.
        ...placeOf(rel),
      };
    });
    res.json(details);
  })
);

/** GET /on-this-day — photos taken on today's month/day in earlier years, newest year first.
 *  Leaves out hidden photos — and their near-identical copies (photoAnalysis.ts duplicates), so
 *  hiding a picture also hides a second copy of it — and shows just one of each set of copies. */
photosRouter.get(
  '/on-this-day',
  asyncHandler(async (_req, res) => {
    const hidden = hiddenPhotoPaths();
    const quality = getPhotoQuality();
    const rel = (abs: string) => path.relative(config.photosDir, abs);
    const hiddenGroups = new Set([...hidden].map((p) => quality.get(p)?.dup_group).filter((g) => g != null));
    const files = (await listPhotos()).filter((f) => {
      const group = quality.get(rel(f))?.dup_group;
      return !hidden.has(rel(f)) && !(group != null && hiddenGroups.has(group));
    });
    const now = new Date();
    const dated = await mapWithConcurrency(files, 8, async (f) => ({ f, date: await getPhotoDate(f) }));
    const today = dated.filter(({ date }) => date.getMonth() === now.getMonth() && date.getDate() === now.getDate() && date.getFullYear() < now.getFullYear());
    // One per set of copies: the best copy first, then everything else in date order.
    const seenGroups = new Set<unknown>();
    const matches = today
      .sort((a, b) => Number(quality.get(rel(b.f))?.dup_best ?? false) - Number(quality.get(rel(a.f))?.dup_best ?? false))
      .filter(({ f }) => {
        const group = quality.get(rel(f))?.dup_group;
        if (group == null) return true;
        if (seenGroups.has(group)) return false;
        seenGroups.add(group);
        return true;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 30)
      .map(({ f, date }) => ({ id: photoIdFor(f), year: date.getFullYear(), taken_at: date.toISOString() }));
    res.json(matches);
  })
);

/** GET /recent?days=7 — photos taken in the last few days (newest first, one of each set of
 *  copies, hidden ones left out) — for the 🎞️ weekly family recap. */
photosRouter.get(
  '/recent',
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 31);
    const since = Date.now() - days * 86400_000;
    const hidden = hiddenPhotoPaths();
    const quality = getPhotoQuality();
    const rel = (abs: string) => path.relative(config.photosDir, abs);
    const files = (await listPhotos()).filter((f) => !hidden.has(rel(f)) && !quality.get(rel(f))?.blurry);
    const dated = await mapWithConcurrency(files, 8, async (f) => ({ f, date: await getPhotoDate(f) }));
    const seen = new Set<unknown>();
    res.json(
      dated
        .filter(({ date }) => date.getTime() >= since && date.getTime() <= Date.now() + 86400_000)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .filter(({ f }) => {
          const g = quality.get(rel(f))?.dup_group;
          if (g == null) return true;
          if (seen.has(g)) return false;
          seen.add(g);
          return true;
        })
        .slice(0, 24)
        .map(({ f, date }) => ({ id: photoIdFor(f), taken_at: date.toISOString() }))
    );
  })
);

/** POST /hidden { add?: ids, remove?: ids } — hide or unhide photos. Only a note in the database;
 *  the files aren't touched. Open to everyone, like adding to an album. */
photosRouter.post(
  '/hidden',
  asyncHandler(async (req, res) => {
    const { add, remove } = req.body as { add?: unknown; remove?: unknown };
    const idToPath = new Map((await listPhotos()).map((abs) => [photoIdFor(abs), path.relative(config.photosDir, abs)]));
    const paths = (ids: unknown) =>
      (Array.isArray(ids) ? ids : []).map((id) => (typeof id === 'string' ? idToPath.get(id) : undefined)).filter((p): p is string => Boolean(p));
    const now = new Date().toISOString();
    const insert = db.prepare('INSERT OR IGNORE INTO hidden_photos (path, hidden_at) VALUES (?, ?)');
    const del = db.prepare('DELETE FROM hidden_photos WHERE path = ?');
    db.transaction(() => {
      for (const p of paths(add)) insert.run(p, now);
      for (const p of paths(remove)) del.run(p);
    })();
    res.json({ ok: true });
  })
);

// ---- 📍 Where it was taken ----

/** GET /places/lists — every country, and the US states, for the "set where it was taken" pickers. */
photosRouter.get('/places/lists', (_req, res) => {
  res.json(placeLists());
});

/** GET /places/outlines — country and US state borders for drawing the map (no outside map service). */
/** GET /places/progress — how far reading GPS from the photos has got (it runs in the background with the dates). */
photosRouter.get(
  '/places/progress',
  asyncHandler(async (_req, res) => {
    const files = await listPhotos();
    let read = 0;
    let withGps = 0;
    let placed = 0;
    let handSet = 0;
    for (const f of files) {
      const p = placeOf(path.relative(config.photosDir, f));
      if (p.gps_read) read++;
      if (p.lat != null) withGps++;
      if (p.country) placed++;
      if (p.place_source === 'set') handSet++;
    }
    res.json({ total: files.length, read, with_gps: withGps, placed, hand_set: handSet, no_location: files.length - placed });
  })
);

let outlinesGz: Buffer | null = null;
photosRouter.get('/places/outlines', (req, res) => {
  res.type('application/json').set('Cache-Control', 'public, max-age=86400').set('Vary', 'Accept-Encoding');
  if (!/\bgzip\b/.test(req.get('accept-encoding') ?? '')) return res.send(mapOutlines());
  outlinesGz ??= gzipSync(mapOutlines());
  res.set('Content-Encoding', 'gzip').send(outlinesGz);
});

/** GET /map — every (not hidden) photo we can put on the map: its GPS, or the middle of the
 *  country/state someone set for it (approx: true). */
photosRouter.get(
  '/map',
  asyncHandler(async (_req, res) => {
    const files = await listPhotos();
    const hidden = hiddenPhotoPaths();
    const out = [];
    for (const f of files) {
      const rel = path.relative(config.photosDir, f);
      if (hidden.has(rel)) continue;
      const p = placeOf(rel);
      if (p.place_source === 'set') {
        const m = middleOf(p.country, p.state);
        if (m) out.push({ id: photoIdFor(f), lat: m.lat, lon: m.lon, approx: true, country: p.country, state: p.state });
      } else if (p.lat != null && p.lon != null) {
        out.push({ id: photoIdFor(f), lat: p.lat, lon: p.lon, approx: false, country: p.country, state: p.state });
      }
    }
    res.json(out);
  })
);

/** GET /:id/place — where and when one photo was taken (and what was set by hand). */
photosRouter.get(
  '/:id/place',
  asyncHandler(async (req, res) => {
    const abs = await findPhotoById(req.params.id);
    if (!abs) return res.status(404).json({ error: 'not found' });
    await getPhotoGps(abs);
    const rel = path.relative(config.photosDir, abs);
    const e = placeEdit(rel);
    res.json({
      ...placeOf(rel),
      taken_at: (await getPhotoDate(abs)).toISOString(),
      photo_taken_at: (await getOriginalPhotoDate(abs)).toISOString(),
      date_from: photoDateSource(abs),
      updated_at: e?.updated_at ?? null,
      updated_by: e?.updated_by ?? null,
    });
  })
);

/**
 * PUT /:id/place { country_code, state, year, month, acting_member_id } — set where/when it was
 * taken when the photo doesn't say (or says wrong). Only kept in the database; the photo file is
 * never changed. Empty values go back to what the photo says.
 */
photosRouter.put(
  '/:id/place',
  asyncHandler(async (req, res) => {
    const abs = await findPhotoById(req.params.id);
    if (!abs) return res.status(404).json({ error: 'not found' });
    const rel = path.relative(config.photosDir, abs);
    const b = req.body ?? {};
    const lists = placeLists();
    const country = b.country_code ? lists.countries.find((c) => c.code === b.country_code) : null;
    if (b.country_code && !country) return res.status(400).json({ error: 'Pick a country from the list' });
    const state = b.state ? lists.states.find((s) => s.name === b.state || s.code === b.state) : null;
    if (b.state && (!state || country?.code !== 'US')) return res.status(400).json({ error: 'A state can only be set for the United States' });
    const year = b.year === '' || b.year == null ? null : Math.round(Number(b.year));
    if (year !== null && !(year >= 1826 && year <= new Date().getFullYear() + 1)) return res.status(400).json({ error: 'That year doesn\'t look right' });
    const month = b.month === '' || b.month == null ? null : Math.round(Number(b.month));
    if (month !== null && !(month >= 1 && month <= 12)) return res.status(400).json({ error: 'Month is 1–12' });
    savePlaceEdit({
      path: rel,
      country: country?.name ?? null,
      country_code: country?.code ?? null,
      state: state?.name ?? null,
      year,
      month: year ? month : null,
      updated_at: new Date().toISOString(),
      updated_by: typeof b.acting_member_id === 'string' ? b.acting_member_id : null,
    });
    res.json({ ...placeOf(rel), taken_at: (await getPhotoDate(abs)).toISOString(), photo_taken_at: (await getOriginalPhotoDate(abs)).toISOString(), date_from: photoDateSource(abs) });
  })
);

// ---- 📁 Where the photos come from (parents only): so a share can be set up again the same way ----

function mountFor(dir: string) {
  let real = dir;
  try {
    real = fsSync.realpathSync(dir);
  } catch {
    /* not there right now */
  }
  let best: { source: string; mount_point: string; fstype: string; options: string } | null = null;
  try {
    for (const line of fsSync.readFileSync('/proc/mounts', 'utf8').split('\n')) {
      const [source, mp, fstype, options] = line.split(' ');
      if (!mp) continue;
      const point = mp.replace(/\\040/g, ' ');
      if ((real === point || real.startsWith(point.endsWith('/') ? point : `${point}/`)) && (!best || point.length > best.mount_point.length)) {
        best = { source: source.replace(/\\040/g, ' '), mount_point: point, fstype, options };
      }
    }
  } catch {
    /* not Linux */
  }
  return { real, mount: best };
}
// Never pass a password on.
const scrub = (opts: string) => opts.split(',').filter((o) => !/^(password|pass|password2)=/i.test(o)).join(',');

/** GET /source — PHOTOS_DIR, the share it's mounted from (if any), its /etc/fstab line, and the saved notes. */
photosRouter.get('/source', (req, res) => {
  if (!isParentRequest(req, req.query.acting_member_id)) return res.status(403).json({ error: 'For parents only' });
  const { real, mount } = mountFor(config.photosDir);
  const network = Boolean(mount && /^(cifs|smb3?|nfs4?)$/.test(mount.fstype));
  let fstab: string | null = null;
  if (mount) {
    try {
      fstab =
        fsSync
          .readFileSync('/etc/fstab', 'utf8')
          .split('\n')
          .find((l) => !l.trim().startsWith('#') && l.split(/\s+/)[1] === mount.mount_point) ?? null;
    } catch {
      /* unreadable */
    }
  }
  let saved = null;
  try {
    saved = JSON.parse(getSetting('photo_source_notes') || 'null');
  } catch {
    /* none */
  }
  res.json({
    photos_dir: config.photosDir,
    real_path: real,
    network,
    mount: mount ? { ...mount, options: scrub(mount.options) } : null,
    fstab: fstab ? scrub(fstab) : null,
    credentials_file: mount?.options.match(/(?:^|,)(?:credentials|cred)=([^,]+)/)?.[1] ?? fstab?.match(/(?:credentials|cred)=([^,\s]+)/)?.[1] ?? null,
    saved,
  });
});

/** PUT /source { share, mount_point, options, username, credentials_file, notes } — the parents' own notes (never a password). */
photosRouter.put('/source', (req, res) => {
  if (!isParentRequest(req, req.body?.acting_member_id)) return res.status(403).json({ error: 'For parents only' });
  const b = req.body ?? {};
  const str = (v: unknown, n = 500) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const notes = {
    share: str(b.share),
    mount_point: str(b.mount_point),
    options: scrub(str(b.options, 1000)),
    username: str(b.username, 200),
    credentials_file: str(b.credentials_file),
    notes: str(b.notes, 4000),
    saved_at: new Date().toISOString(),
    saved_by: typeof b.acting_member_id === 'string' ? b.acting_member_id : null,
  };
  setSetting('photo_source_notes', JSON.stringify(notes));
  res.json(notes);
});

// ---- 📤 Add photos / 📥 Inbox: filed into <YEAR>/<Month> ----

/**
 * POST /upload (the picture as the body; headers x-filename, x-last-modified, x-acting-member) —
 * one photo from 📤 Add photos. Saved into the Inbox first, then filed straight away.
 */
photosRouter.post(
  '/upload',
  express.raw({ type: () => true, limit: '300mb' }),
  asyncHandler(async (req, res) => {
    const name = path.basename(decodeURIComponent(String(req.get('x-filename') ?? ''))).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 200) || 'photo.jpg';
    if (!PICTURE_EXTS.has(path.extname(name).toLowerCase())) return res.status(400).json({ error: `${name}: only pictures (JPG, PNG, HEIC, WebP, GIF)` });
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length < 100) return res.status(400).json({ error: `${name}: empty file` });
    if (!(await canWrite())) return res.status(503).json({ error: "The Family Home Center can't write to the photos folder (check the share allows writing)" });
    const inbox = inboxDir();
    await fsSync.promises.mkdir(inbox, { recursive: true });
    registerInbox();
    // A dot name while it's written, so the Inbox sorter leaves it alone.
    const tmp = path.join(inbox, `.upload-${uuidv4()}${path.extname(name).toLowerCase()}`);
    await fsSync.promises.writeFile(tmp, body);
    const hint = Number(req.get('x-last-modified')) || null;
    const by = String(req.get('x-acting-member') ?? '') || null;
    const r = await fileOne(tmp, 'upload', by, hint, name);
    if (r.result === 'error') {
      // Leave it in the Inbox under its own name — the sorter tries again.
      await fsSync.promises.rename(tmp, path.join(inbox, name)).catch(() => {});
      return res.status(500).json(r);
    }
    if (r.result === 'filed') photosChanged();
    res.json(r);
  })
);

/** GET /inbox — the Inbox, the auto-sort switch, whether the share can be written, and the latest filings (parents). */
photosRouter.get(
  '/inbox',
  asyncHandler(async (req, res) => {
    if (!isParentRequest(req, req.query.acting_member_id)) return res.status(403).json({ error: 'For parents only' });
    const dir = inboxDir();
    let waiting = 0;
    let other = 0;
    try {
      for (const it of await fsSync.promises.readdir(dir, { withFileTypes: true })) {
        if (!it.isFile() || it.name.startsWith('.')) continue;
        if (PICTURE_EXTS.has(path.extname(it.name).toLowerCase())) waiting++;
        else other++;
      }
    } catch {
      /* no Inbox yet */
    }
    res.json({
      inbox_dir: dir,
      exists: fsSync.existsSync(dir),
      auto: autoSortOn(),
      writable: await canWrite(),
      waiting,
      other,
      recent: db.prepare('SELECT * FROM photo_filings ORDER BY at DESC LIMIT 30').all(),
      totals: db.prepare("SELECT result, COUNT(*) AS n FROM photo_filings GROUP BY result").all(),
    });
  })
);

/** PATCH /inbox { auto, inbox_dir } (parents). */
photosRouter.patch('/inbox', (req, res) => {
  if (!isParentRequest(req, req.body?.acting_member_id)) return res.status(403).json({ error: 'For parents only' });
  if (req.body?.auto !== undefined) setSetting('photo_inbox_auto', req.body.auto ? '' : 'off');
  if (typeof req.body?.inbox_dir === 'string') {
    const d = req.body.inbox_dir.trim();
    if (d && !path.isAbsolute(d)) return res.status(400).json({ error: 'Use a full path, e.g. /mnt/family-photos/Inbox' });
    setSetting('photo_inbox_dir', d);
    registerInbox();
  }
  res.json({ ok: true });
});

/** POST /inbox/sort-now (parents) — file what's in the Inbox right away (makes the Inbox if it isn't there). */
photosRouter.post(
  '/inbox/sort-now',
  asyncHandler(async (req, res) => {
    if (!isParentRequest(req, req.body?.acting_member_id)) return res.status(403).json({ error: 'For parents only' });
    if (!(await canWrite())) return res.status(503).json({ error: "Can't write to the photos folder — check the share allows writing" });
    res.json(await sortInbox(typeof req.body?.acting_member_id === 'string' ? req.body.acting_member_id : null));
  })
);

photosRouter.get(
  '/random',
  asyncHandler(async (_req, res) => {
    // The slideshow/screensaver — hidden photos never come up.
    const files = await listVisiblePhotos();
    if (files.length === 0) return res.status(404).json({ error: 'no photos found' });
    const pick = files[Math.floor(Math.random() * files.length)];
    res.json({ id: photoIdFor(pick) });
  })
);

photosRouter.get(
  '/:id/image',
  asyncHandler(async (req, res) => {
    const absolutePath = await findPhotoById(req.params.id);
    if (!absolutePath) return res.status(404).end();
    try {
      const thumbPath = await getOrCreateThumbnail(absolutePath);
      res.sendFile(thumbPath);
    } catch (err) {
      console.error('[photos] failed to serve image', err);
      res.status(500).end();
    }
  })
);
