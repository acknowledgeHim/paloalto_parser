import { config } from '../../config.js';
import { MpdClient, mpdQuote } from './mpdClient.js';

// All 4 zone MPD instances point at the same MUSIC_LIBRARY_DIR, so any one of their databases is a
// perfectly good index to search/browse — we arbitrarily use zone 1's.
const indexClient = new MpdClient(config.music.mpdHost, config.music.mpdBasePort + 1);

export interface Track {
  file: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
}

function rowToTrack(row: Record<string, string>): Track {
  return {
    file: row.file,
    title: row.Title ?? row.file.split('/').pop() ?? row.file,
    artist: row.Artist ?? null,
    album: row.Album ?? null,
    duration: row.duration ? Number(row.duration) : row.Time ? Number(row.Time) : null,
  };
}

// The index MPD instance being unreachable (not yet set up, briefly restarting) should make library
// browsing come back empty, not take the whole dashboard down — every export here degrades gracefully.

export async function searchLibrary(query: string, limit = 100): Promise<Track[]> {
  try {
    // Legacy "search TAG NEEDLE" form: a case-insensitive substring match, here across every tag.
    const rows = await indexClient.commandList(`search any ${mpdQuote(query)}`, 'file');
    return rows.slice(0, limit).map(rowToTrack);
  } catch (err) {
    console.warn('[library] search failed:', (err as Error).message);
    return [];
  }
}

export async function listArtists(): Promise<string[]> {
  try {
    const lines = await indexClient.command('list artist');
    return lines.filter((l) => l.startsWith('Artist: ')).map((l) => l.slice('Artist: '.length));
  } catch (err) {
    console.warn('[library] listArtists failed:', (err as Error).message);
    return [];
  }
}

export async function listAlbumsByArtist(artist: string): Promise<string[]> {
  try {
    const lines = await indexClient.command(`list album artist ${mpdQuote(artist)}`);
    return lines.filter((l) => l.startsWith('Album: ')).map((l) => l.slice('Album: '.length));
  } catch (err) {
    console.warn('[library] listAlbumsByArtist failed:', (err as Error).message);
    return [];
  }
}

export async function listTracksByAlbum(artist: string, album: string): Promise<Track[]> {
  try {
    // Legacy "find TAG NEEDLE [TAG NEEDLE ...]" form ANDs the pairs together.
    const rows = await indexClient.commandList(`find artist ${mpdQuote(artist)} album ${mpdQuote(album)}`, 'file');
    return rows.map(rowToTrack);
  } catch (err) {
    console.warn('[library] listTracksByAlbum failed:', (err as Error).message);
    return [];
  }
}

/** Kick off a rescan of the music directory (call after adding new files) on every zone's database. */
export async function rescanAll(): Promise<void> {
  const clients = Array.from({ length: config.music.zoneCount }, (_, i) => new MpdClient(config.music.mpdHost, config.music.mpdBasePort + i + 1));
  await Promise.all(clients.map((c) => c.command('update').catch(() => {})));
}
