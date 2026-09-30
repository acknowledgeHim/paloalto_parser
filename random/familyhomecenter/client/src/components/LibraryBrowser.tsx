import { useEffect, useState, type ReactNode } from 'react';
import { api, type Track } from '../api/client.js';

interface Props {
  /** Renders the action(s) for one track row (e.g. Play/Queue buttons, or a single "Use this" pick button). */
  renderActions: (track: Track) => ReactNode;
}

/**
 * Artist -> album -> tracks drill-down over the music library, as an alternative to text search —
 * useful when search comes back empty and you're not sure if that's "no matches" or the library
 * index being unreachable. Read-only against the library either way.
 */
export function LibraryBrowser({ renderActions }: Props) {
  const [artists, setArtists] = useState<string[] | null>(null);
  const [artist, setArtist] = useState<string | null>(null);
  const [albums, setAlbums] = useState<string[] | null>(null);
  const [album, setAlbum] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<string[]>('/music/library/artists').then(setArtists).catch(() => setArtists([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!artist) { setAlbums(null); setAlbum(null); return; }
    setLoading(true);
    api
      .get<string[]>(`/music/library/artists/${encodeURIComponent(artist)}/albums`)
      .then(setAlbums)
      .catch(() => setAlbums([]))
      .finally(() => setLoading(false));
  }, [artist]);

  useEffect(() => {
    if (!artist || !album) { setTracks(null); return; }
    setLoading(true);
    api
      .get<Track[]>(`/music/library/artists/${encodeURIComponent(artist)}/albums/${encodeURIComponent(album)}/tracks`)
      .then(setTracks)
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, [artist, album]);

  if (album && tracks) {
    return (
      <div className="library-browser">
        <button type="button" className="link-button" onClick={() => setAlbum(null)}>‹ {album}</button>
        {loading && <div className="hint">Loading…</div>}
        {tracks.length === 0 && !loading && <div className="hint">No tracks found in this album.</div>}
        <ul className="library-browser__list">
          {tracks.map((t) => (
            <li key={t.file} className="library-row">
              <div className="library-row__title">{t.title}</div>
              {renderActions(t)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (artist && albums) {
    return (
      <div className="library-browser">
        <button type="button" className="link-button" onClick={() => setArtist(null)}>‹ {artist}</button>
        {loading && <div className="hint">Loading…</div>}
        {albums.length === 0 && !loading && <div className="hint">No albums found for this artist.</div>}
        <ul className="library-browser__list">
          {albums.map((a) => (
            <li key={a}>
              <button type="button" className="link-button" onClick={() => setAlbum(a)}>{a}</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="library-browser">
      {loading && <div className="hint">Loading artists…</div>}
      {artists && artists.length === 0 && !loading && (
        <div className="hint">No artists found — the library index may be empty or unreachable.</div>
      )}
      {artists && artists.length > 0 && (
        <ul className="library-browser__list">
          {artists.map((a) => (
            <li key={a}>
              <button type="button" className="link-button" onClick={() => setArtist(a)}>{a}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
