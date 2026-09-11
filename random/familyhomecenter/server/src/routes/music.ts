import { Router } from 'express';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
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
import { searchLibrary, listArtists, listAlbumsByArtist, listTracksByAlbum, rescanAll } from '../services/music/library.js';
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
  res.json({ configured: spotify.isSpotifyConfigured(), connected: spotify.isSpotifyConnected() });
});
musicRouter.get('/spotify/auth-url', (_req, res) => {
  if (!spotify.isSpotifyConfigured()) return res.status(400).json({ error: 'Spotify client not configured in .env' });
  res.json({ url: spotify.getSpotifyAuthUrl() });
});
musicRouter.get(
  '/spotify/callback',
  asyncHandler(async (req, res) => {
    try {
      await spotify.handleSpotifyCallback(req.query.code as string);
      res.send('<html><body>Spotify connected — you can close this tab.</body></html>');
    } catch (err) {
      console.error(err);
      res.status(500).send('Failed to connect Spotify. Check server logs.');
    }
  })
);
musicRouter.get(
  '/spotify/devices',
  asyncHandler(async (_req, res) => {
    res.json(await spotify.listDevices());
  })
);
musicRouter.get(
  '/spotify/playback',
  asyncHandler(async (_req, res) => {
    res.json(await spotify.getCurrentPlayback());
  })
);
musicRouter.post(
  '/spotify/transfer',
  asyncHandler(async (req, res) => {
    await spotify.transferPlayback(req.body.deviceId, req.body.play !== false);
    res.status(204).end();
  })
);
musicRouter.get(
  '/spotify/search',
  asyncHandler(async (req, res) => {
    res.json(await spotify.search((req.query.q as string) || ''));
  })
);
musicRouter.get(
  '/spotify/playlists',
  asyncHandler(async (_req, res) => {
    res.json(await spotify.getUserPlaylists());
  })
);

// ---- Internal: librespot --onevent hook posts here (see scripts/librespot-event.sh) ----
musicRouter.post('/internal/spotify-event/:zoneId', (req, res) => {
  if (config.music.internalApiToken && req.header('x-internal-token') !== config.music.internalApiToken) {
    return res.status(403).end();
  }
  reportSpotifyEvent(Number(req.params.zoneId), req.body.event, req.body.meta ?? {});
  res.status(204).end();
});
