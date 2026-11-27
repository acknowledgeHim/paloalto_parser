import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { config } from '../../config.js';
import { MpdClient, mpdQuote } from './mpdClient.js';
const clients = new Map();
// Populated by the librespot --onevent hook (see routes/music.ts internalSpotifyEvent) — not persisted,
// it's live playback state, not configuration.
const spotifyState = new Map();
function clientFor(zoneId) {
    let client = clients.get(zoneId);
    if (!client) {
        client = new MpdClient(config.music.mpdHost, config.music.mpdBasePort + zoneId);
        clients.set(zoneId, client);
    }
    return client;
}
export function listZoneIds() {
    return Array.from({ length: config.music.zoneCount }, (_, i) => i + 1);
}
export function getZones() {
    const rows = db.prepare('SELECT id, name FROM zones ORDER BY id').all();
    const groupByZone = new Map();
    for (const group of getGroups()) {
        for (const zoneId of group.zoneIds)
            groupByZone.set(zoneId, group.id);
    }
    return rows
        .filter((r) => listZoneIds().includes(r.id))
        .map((r) => ({ id: r.id, name: r.name, groupId: groupByZone.get(r.id) ?? null }));
}
export function renameZone(id, name) {
    db.prepare('UPDATE zones SET name = ? WHERE id = ?').run(name, id);
}
export function getGroups() {
    const rows = db.prepare('SELECT * FROM zone_groups').all();
    return rows.map((r) => ({ id: r.id, name: r.name, zoneIds: JSON.parse(r.zone_ids) }));
}
/** Replace all groups with the given set (simplest mental model for a touchscreen UI: one grouping at a time). */
export function setGroups(groups) {
    const insert = db.prepare('INSERT INTO zone_groups (id, name, zone_ids) VALUES (?, ?, ?)');
    const replaceAll = db.transaction((gs) => {
        db.prepare('DELETE FROM zone_groups').run();
        for (const g of gs) {
            if (g.zoneIds.length < 2)
                continue; // a "group" of one zone is just... a zone
            insert.run(uuidv4(), g.name, JSON.stringify(g.zoneIds));
        }
    });
    replaceAll(groups);
    return getGroups();
}
/** All zone ids that should receive the same command as `zoneId` (its group, or just itself). */
export function groupMembers(zoneId) {
    const group = getGroups().find((g) => g.zoneIds.includes(zoneId));
    return group ? group.zoneIds : [zoneId];
}
export async function getZoneStatus(zoneId) {
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
            state: status.state ?? 'stop',
            volume: Number(status.volume ?? 0),
            track: currentSong.file
                ? { title: currentSong.Title ?? currentSong.file, artist: currentSong.Artist ?? null, album: currentSong.Album ?? null }
                : null,
            elapsedSeconds: status.elapsed ? Number(status.elapsed) : null,
            durationSeconds: status.duration ? Number(status.duration) : null,
        };
    }
    catch (err) {
        console.warn(`[zoneManager] zone ${zoneId} MPD unreachable:`, err.message);
        return { zoneId, source: 'none', state: 'stop', volume: 0, track: null, elapsedSeconds: null, durationSeconds: null };
    }
}
/**
 * Run an MPD command on a zone and every zone grouped with it. One zone's MPD being briefly
 * unreachable (a rebooted zone, a wiring issue) must not fail the command for its groupmates —
 * each zone's outcome is caught and logged independently rather than propagated as a rejection.
 */
async function forGroup(zoneId, fn) {
    const results = await Promise.allSettled(groupMembers(zoneId).map((id) => fn(clientFor(id))));
    for (const [i, result] of results.entries()) {
        if (result.status === 'rejected') {
            const failedZoneId = groupMembers(zoneId)[i];
            console.warn(`[zoneManager] command failed for zone ${failedZoneId}:`, result.reason?.message ?? result.reason);
        }
    }
}
export const zoneTransport = {
    play: (zoneId) => forGroup(zoneId, (c) => c.command('play')),
    pause: (zoneId) => forGroup(zoneId, (c) => c.command('pause "1"')),
    next: (zoneId) => forGroup(zoneId, (c) => c.command('next')),
    previous: (zoneId) => forGroup(zoneId, (c) => c.command('previous')),
    setVolume: (zoneId, percent) => forGroup(zoneId, (c) => c.command(`setvol ${Math.max(0, Math.min(100, Math.round(percent)))}`)),
    /** Replace the queue with these files and start playing — used when picking an album/playlist for a zone (or group). */
    async playFiles(zoneId, files) {
        await forGroup(zoneId, async (c) => {
            await c.command('clear');
            for (const file of files)
                await c.command(`add ${mpdQuote(file)}`);
            await c.command('play');
        });
    },
    async addToQueue(zoneId, file) {
        await forGroup(zoneId, (c) => c.command(`add ${mpdQuote(file)}`));
    },
    async getQueue(zoneId) {
        try {
            const rows = await clientFor(zoneId).commandList('playlistinfo', 'file');
            return rows.map((r) => ({ file: r.file, title: r.Title ?? r.file, artist: r.Artist ?? null }));
        }
        catch (err) {
            console.warn(`[zoneManager] zone ${zoneId} queue unavailable:`, err.message);
            return [];
        }
    },
};
/** Called by the librespot --onevent hook (via an internal HTTP endpoint) to report Spotify Connect activity. */
export function reportSpotifyEvent(zoneId, event, meta) {
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
            .catch(() => { });
    }
}
