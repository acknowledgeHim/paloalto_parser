import { Router } from 'express';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getZones,
  renameZone,
  getGroups,
  setGroups,
  getZoneStatus,
  zoneTransport,
  reportSpotifyEvent,
  listZoneIds,
} from '../services/music/zoneManager.js';
import { searchLibrary, listArtists, listAlbumsByArtist, listTracksByAlbum, rescanAll, checkLibraryStatus } from '../services/music/library.js';
import * as spotify from '../services/music/spotify.js';

export const musicRouter = Router();

// ---- Zones & groups ----
musicRouter.get('/zones', (_req, res) => res.json(getZones()));

musicRouter.patch('/zones/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!listZoneIds().includes(id)) return res.status(404).json({ error: 'no such zone' });
  if (typeof req.body.name === 'string' && req.body.name.trim()) renameZone(id, req.body.name.trim());
  res.json(getZones().find((z) => z.id === id));
});

// getZoneStatus() already catches per-zone MPD errors internally and never rejects (see zoneManager.ts),
// but every handler here still goes through asyncHandler as a blanket safety net against future changes.
musicRouter.get(
  '/zones/:id/status',
  asyncHandler(async (req, res) => {
    res.json(await getZoneStatus(Number(req.params.id)));
  })
);

musicRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json(await Promise.all(listZoneIds().map(getZoneStatus)));
  })
);

musicRouter.get('/groups', (_req, res) => res.json(getGroups()));
musicRouter.put('/groups', (req, res) => {
  const groups = Array.isArray(req.body.groups) ? req.body.groups : [];
  res.json(setGroups(groups));
});

// ---- Transport (forwarded to every zone in the same group; zoneManager never rejects on a single
// unreachable zone, it logs and continues — see forGroup() in zoneManager.ts) ----
musicRouter.post(
  '/zones/:id/play',
  asyncHandler(async (req, res) => {
    await zoneTransport.play(Number(req.params.id));
    res.status(204).end();
  })
);
musicRouter.post(
  '/zones/:id/pause',
  asyncHandler(async (req, res) => {
    await zoneTransport.pause(Number(req.params.id));
    res.status(204).end();
  })
);
musicRouter.post(
  '/zones/:id/next',
  asyncHandler(async (req, res) => {
    await zoneTransport.next(Number(req.params.id));
    res.status(204).end();
  })
);
musicRouter.post(
  '/zones/:id/previous',
  asyncHandler(async (req, res) => {
    await zoneTransport.previous(Number(req.params.id));
    res.status(204).end();
  })
);
musicRouter.post(
  '/zones/:id/volume',
  asyncHandler(async (req, res) => {
    await zoneTransport.setVolume(Number(req.params.id), Number(req.body.percent));
    res.status(204).end();
  })
);
musicRouter.post(
  '/zones/:id/play-files',
  asyncHandler(async (req, res) => {
    const files = Array.isArray(req.body.files) ? req.body.files : [];
    await zoneTransport.playFiles(Number(req.params.id), files);
    res.status(204).end();
  })
);
musicRouter.post(
  '/zones/:id/queue',
  asyncHandler(async (req, res) => {
    await zoneTransport.addToQueue(Number(req.params.id), req.body.file);
    res.status(204).end();
  })
);
musicRouter.get(
  '/zones/:id/queue',
  asyncHandler(async (req, res) => {
    res.json(await zoneTransport.getQueue(Number(req.params.id)));
  })
);

// ---- Local library (library.ts degrades to empty results rather than throwing) ----
musicRouter.get(
  '/library/status',
  asyncHandler(async (_req, res) => {
    res.json(await checkLibraryStatus());
  })
);
musicRouter.get(
  '/library/search',
  asyncHandler(async (req, res) => {
    res.json(await searchLibrary((req.query.q as string) || ''));
  })
);
musicRouter.get(
  '/library/artists',
  asyncHandler(async (_req, res) => {
    res.json(await listArtists());
  })
);
musicRouter.get(
  '/library/artists/:artist/albums',
  asyncHandler(async (req, res) => {
    res.json(await listAlbumsByArtist(req.params.artist));
  })
);
musicRouter.get(
  '/library/artists/:artist/albums/:album/tracks',
  asyncHandler(async (req, res) => {
    res.json(await listTracksByAlbum(req.params.artist, req.params.album));
  })
);
musicRouter.post(
  '/library/rescan',
  asyncHandler(async (_req, res) => {
    await rescanAll();
    res.status(204).end();
  })
);

// ---- Spotify OAuth + Web API control (these genuinely throw when not connected/configured —
// asyncHandler turns that into a 500 via the global error handler instead of crashing the process) ----
musicRouter.get('/spotify/status', (_req, res) => {
  // redirect_uri isn't a secret — Settings shows it so it can be matched in Spotify's dashboard.
  res.json({ configured: spotify.isSpotifyConfigured(), connected: spotify.isSpotifyConnected(), redirect_uri: config.spotify.redirectUri });
});
// Gated: connecting a Spotify account is configuration, not everyday playback (which stays open below).
musicRouter.get('/spotify/auth-url', requireAdmin, (_req, res) => {
  if (!spotify.isSpotifyConfigured()) return res.status(400).json({ error: 'Spotify client not configured in .env' });
  res.json({ url: spotify.getSpotifyAuthUrl() });
});
musicRouter.get(
  '/spotify/callback',
  asyncHandler(async (req, res) => {
    const page = (msg: string) =>
      `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>` +
      `<body style="font-family:sans-serif;padding:24px;max-width:600px">${msg}<p><a href="/#/settings">← Back to Settings</a></p></body></html>`;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    // Spotify sends ?error=access_denied when someone taps Cancel on its consent screen.
    if (req.query.error) return res.status(400).send(page(`<h2>Spotify wasn't connected</h2><p>Spotify said: <b>${esc(String(req.query.error))}</b></p>`));
    if (!req.query.code) return res.status(400).send(page('<h2>Spotify wasn\'t connected</h2><p>No code came back from Spotify — start again from Settings → Spotify → Connect.</p>'));
    try {
      await spotify.handleSpotifyCallback(req.query.code as string);
      res.send(page('<h2>✅ Spotify connected</h2><p>You can close this tab.</p>'));
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .send(page(`<h2>Spotify wasn't connected</h2><p>${esc((err as Error).message)}</p><p>"Invalid redirect URI" means SPOTIFY_REDIRECT_URI in .env doesn't exactly match a Redirect URI in your Spotify app's settings.</p>`));
    }
  })
);
// Everyday Spotify control is open to everyone, like the zones above. A Spotify refusal ("no active
// device", "Premium required") goes back as { error } with Spotify's words, not a bare 500.
const spotifyRoute =
  (run: (req: import('express').Request) => Promise<unknown>) =>
  async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    try {
      const out = await run(req);
      if (out === undefined) res.status(204).end();
      else res.json(out);
    } catch (err) {
      if (err instanceof spotify.SpotifyError) return res.status(err.status >= 500 ? 502 : 400).json({ error: err.message });
      if ((err as Error).message === 'Spotify not connected') return res.status(400).json({ error: 'Spotify isn’t connected — Settings → Spotify → Connect' });
      next(err);
    }
  };
const deviceOf = (req: import('express').Request) => (typeof req.body?.deviceId === 'string' && req.body.deviceId) || undefined;

musicRouter.get('/spotify/devices', spotifyRoute(() => spotify.listDevices()));
musicRouter.get('/spotify/playback', spotifyRoute(async () => (await spotify.getCurrentPlayback()) ?? null));
musicRouter.post(
  '/spotify/transfer',
  spotifyRoute(async (req) => {
    await spotify.transferPlayback(req.body.deviceId, req.body.play !== false);
  }),
);
musicRouter.get('/spotify/search', spotifyRoute(async (req) => (await spotify.search((req.query.q as string) || '')) ?? {}));
musicRouter.get('/spotify/playlists', spotifyRoute(() => spotify.getUserPlaylists()));
musicRouter.get('/spotify/playlists/:id/tracks', spotifyRoute((req) => spotify.getPlaylistTracks(req.params.id)));
/** { deviceId?, contextUri?, uris?, offsetUri? } — nothing but deviceId = resume there. */
musicRouter.post(
  '/spotify/play',
  spotifyRoute(async (req) => {
    const { contextUri, uris, offsetUri } = req.body ?? {};
    await spotify.play(deviceOf(req), contextUri || undefined, Array.isArray(uris) ? uris : undefined, offsetUri || undefined);
  }),
);
musicRouter.post('/spotify/pause', spotifyRoute(async (req) => void (await spotify.pause(deviceOf(req)))));
musicRouter.post('/spotify/next', spotifyRoute(async (req) => void (await spotify.next(deviceOf(req)))));
musicRouter.post('/spotify/previous', spotifyRoute(async (req) => void (await spotify.previous(deviceOf(req)))));
musicRouter.post('/spotify/volume', spotifyRoute(async (req) => void (await spotify.setVolume(deviceOf(req), Number(req.body.percent)))));
musicRouter.post('/spotify/queue', spotifyRoute(async (req) => void (await spotify.addToQueue(String(req.body.uri), deviceOf(req)))));

// ---- Internal: librespot --onevent hook posts here (see scripts/librespot-event.sh) ----
musicRouter.post('/internal/spotify-event/:zoneId', (req, res) => {
  if (config.music.internalApiToken && req.header('x-internal-token') !== config.music.internalApiToken) {
    return res.status(403).end();
  }
  reportSpotifyEvent(Number(req.params.zoneId), req.body.event, req.body.meta ?? {});
  res.status(204).end();
});
