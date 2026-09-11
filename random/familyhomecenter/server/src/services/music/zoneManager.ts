import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { config } from '../../config.js';
import { MpdClient, mpdQuote } from './mpdClient.js';

export interface ZoneInfo {
  id: number;
  name: string;
  groupId: string | null;
}

export interface ZoneGroup {
  id: string;
  name: string;
  zoneIds: number[];
}

export type ZoneSource = 'local' | 'spotify' | 'none';

interface SpotifyZoneState {
  playing: boolean;
  track: string | null;
  artist: string | null;
  album: string | null;
  updatedAt: number;
}

const clients = new Map<number, MpdClient>();
// Populated by the librespot --onevent hook (see routes/music.ts internalSpotifyEvent) — not persisted,
// it's live playback state, not configuration.
const spotifyState = new Map<number, SpotifyZoneState>();

function clientFor(zoneId: number): MpdClient {
  let client = clients.get(zoneId);
  if (!client) {
    client = new MpdClient(config.music.mpdHost, config.music.mpdBasePort + zoneId);
    clients.set(zoneId, client);
  }
  return client;
}

export function listZoneIds(): number[] {
  return Array.from({ length: config.music.zoneCount }, (_, i) => i + 1);
}

export function getZones(): ZoneInfo[] {
  const rows = db.prepare('SELECT id, name FROM zones ORDER BY id').all() as Array<{ id: number; name: string }>;
  const groupByZone = new Map<number, string>();
  for (const group of getGroups()) {
    for (const zoneId of group.zoneIds) groupByZone.set(zoneId, group.id);
  }
  return rows
    .filter((r) => listZoneIds().includes(r.id))
    .map((r) => ({ id: r.id, name: r.name, groupId: groupByZone.get(r.id) ?? null }));
}

export function renameZone(id: number, name: string): void {
  db.prepare('UPDATE zones SET name = ? WHERE id = ?').run(name, id);
}

export function getGroups(): ZoneGroup[] {
  const rows = db.prepare('SELECT * FROM zone_groups').all() as Array<{ id: string; name: string; zone_ids: string }>;
  return rows.map((r) => ({ id: r.id, name: r.name, zoneIds: JSON.parse(r.zone_ids) }));
}

/** Replace all groups with the given set (simplest mental model for a touchscreen UI: one grouping at a time). */
export function setGroups(groups: Array<{ name: string; zoneIds: number[] }>): ZoneGroup[] {
  const insert = db.prepare('INSERT INTO zone_groups (id, name, zone_ids) VALUES (?, ?, ?)');
  const replaceAll = db.transaction((gs: Array<{ name: string; zoneIds: number[] }>) => {
    db.prepare('DELETE FROM zone_groups').run();
    for (const g of gs) {
      if (g.zoneIds.length < 2) continue; // a "group" of one zone is just... a zone
      insert.run(uuidv4(), g.name, JSON.stringify(g.zoneIds));
    }
  });
  replaceAll(groups);
  return getGroups();
}

/** All zone ids that should receive the same command as `zoneId` (its group, or just itself). */
export function groupMembers(zoneId: number): number[] {
  const group = getGroups().find((g) => g.zoneIds.includes(zoneId));
  return group ? group.zoneIds : [zoneId];
}

export interface ZoneStatus {
  zoneId: number;
  source: ZoneSource;
  state: 'play' | 'pause' | 'stop';
  volume: number;
  track: { title: string | null; artist: string | null; album: string | null } | null;
  elapsedSeconds: number | null;
  durationSeconds: number | null;
}

export async function getZoneStatus(zoneId: number): Promise<ZoneStatus> {
  const client = clientFor(zoneId);
  const spotify = spotifyState.get(zoneId);

  try {
    const [status, currentSong] = await Promise.all([
      client.commandObject('status'),
      client.commandObject('currentsong'),
    ]);
    const mpdPlaying = status.state === 'play';

    // Spotify (via librespot) and local MPD share the same physical output; whichever reported
    // activity most recently "owns" the zone's now-playing display.
    if (spotify?.playing && (!mpdPlaying || (Date.now() - spotify.updatedAt < 5000))) {
      return {
        zoneId,
        source: 'spotify',
        state: 'play',
        volume: Number(status.volume ?? 0),
        track: { title: spotify.track, artist: spotify.artist, album: spotify.album },
        elapsedSeconds: null,
        durationSeconds: null,
      };
    }

    return {
      zoneId,
      source: currentSong.file ? 'local' : 'none',
      state: (status.state as 'play' | 'pause' | 'stop') ?? 'stop',
      volume: Number(status.volume ?? 0),
      track: currentSong.file
        ? { title: currentSong.Title ?? currentSong.file, artist: currentSong.Artist ?? null, album: currentSong.Album ?? null }
        : null,
      elapsedSeconds: status.elapsed ? Number(status.elapsed) : null,
      durationSeconds: status.duration ? Number(status.duration) : null,
    };
  } catch (err) {
    console.warn(`[zoneManager] zone ${zoneId} MPD unreachable:`, (err as Error).message);
    return { zoneId, source: 'none', state: 'stop', volume: 0, track: null, elapsedSeconds: null, durationSeconds: null };
  }
}

/**
 * Run an MPD command on a zone and every zone grouped with it. One zone's MPD being briefly
 * unreachable (a rebooted zone, a wiring issue) must not fail the command for its groupmates —
 * each zone's outcome is caught and logged independently rather than propagated as a rejection.
 */
async function forGroup(zoneId: number, fn: (client: MpdClient) => Promise<unknown>): Promise<void> {
  const results = await Promise.allSettled(groupMembers(zoneId).map((id) => fn(clientFor(id))));
  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      const failedZoneId = groupMembers(zoneId)[i];
      console.warn(`[zoneManager] command failed for zone ${failedZoneId}:`, result.reason?.message ?? result.reason);
    }
  }
}

export const zoneTransport = {
  play: (zoneId: number) => forGroup(zoneId, (c) => c.command('play')),
  pause: (zoneId: number) => forGroup(zoneId, (c) => c.command('pause "1"')),
  next: (zoneId: number) => forGroup(zoneId, (c) => c.command('next')),
  previous: (zoneId: number) => forGroup(zoneId, (c) => c.command('previous')),
  setVolume: (zoneId: number, percent: number) =>
    forGroup(zoneId, (c) => c.command(`setvol ${Math.max(0, Math.min(100, Math.round(percent)))}`)),

  /** Replace the queue with these files and start playing — used when picking an album/playlist for a zone (or group). */
  async playFiles(zoneId: number, files: string[]): Promise<void> {
    await forGroup(zoneId, async (c) => {
      await c.command('clear');
      for (const file of files) await c.command(`add ${mpdQuote(file)}`);
      await c.command('play');
    });
  },

  async addToQueue(zoneId: number, file: string): Promise<void> {
    await forGroup(zoneId, (c) => c.command(`add ${mpdQuote(file)}`));
  },

  async getQueue(zoneId: number): Promise<Array<{ file: string; title: string; artist: string | null }>> {
    try {
      const rows = await clientFor(zoneId).commandList('playlistinfo', 'file');
      return rows.map((r) => ({ file: r.file, title: r.Title ?? r.file, artist: r.Artist ?? null }));
    } catch (err) {
      console.warn(`[zoneManager] zone ${zoneId} queue unavailable:`, (err as Error).message);
      return [];
    }
  },
};

/** Called by the librespot --onevent hook (via an internal HTTP endpoint) to report Spotify Connect activity. */
export function reportSpotifyEvent(zoneId: number, event: string, meta: Record<string, string>): void {
  const playing = event === 'playing' || event === 'started' || event === 'changed';
  spotifyState.set(zoneId, {
    playing,
    track: meta.NAME ?? null,
    artist: meta.ARTISTS ?? null,
    album: meta.ALBUM ?? null,
    updatedAt: Date.now(),
  });
  // Avoid two audio sources fighting over the same physical zone: pause local playback when Spotify takes over.
  if (playing) {
    clientFor(zoneId)
      .command('pause "1"')
      .catch(() => {});
  }
}
