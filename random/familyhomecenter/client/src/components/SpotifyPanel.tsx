import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../api/client.js';

/**
 * Music → Spotify (once a parent has connected it in Settings): pick where it plays ("Play on" —
 * the house zones, phones, TVs… anything showing in Spotify Connect), see and control what's
 * playing, play one of the account's playlists, or search for a song, album, artist or playlist.
 */

interface Img {
  url: string;
}
interface Device {
  id: string;
  name: string;
  type?: string;
  is_active: boolean;
  is_restricted?: boolean;
  volume_percent: number | null;
}
interface SpTrack {
  uri: string;
  name: string;
  duration_ms?: number;
  artists?: { name: string }[];
  album?: { name: string; images?: Img[] };
}
interface SpPlaylist {
  id: string;
  uri: string;
  name: string;
  images?: Img[] | null;
  owner?: { display_name?: string };
  tracks?: { total?: number };
  items?: { total?: number };
}
interface SpAlbum {
  uri: string;
  name: string;
  images?: Img[];
  artists?: { name: string }[];
}
interface SpArtist {
  uri: string;
  name: string;
  images?: Img[];
}
interface Playback {
  is_playing: boolean;
  device?: Device;
  item?: SpTrack | null;
  progress_ms?: number;
}
interface SearchResults {
  tracks?: { items: (SpTrack | null)[] };
  albums?: { items: (SpAlbum | null)[] };
  playlists?: { items: (SpPlaylist | null)[] };
  artists?: { items: (SpArtist | null)[] };
}

const DEVICE_KEY = 'familyhomecenter.spotify.device';
const TAB_KEY = 'familyhomecenter.spotify.tab';
const artistNames = (t?: { artists?: { name: string }[] }) => (t?.artists ?? []).map((a) => a.name).join(', ');
const smallImage = (imgs?: Img[] | null) => (imgs?.length ? imgs[imgs.length - 1].url : undefined);
const deviceIcon = (type?: string) =>
  ({ Computer: '💻', Smartphone: '📱', Speaker: '🔊', TV: '📺', CastAudio: '🔊', CastVideo: '📺', Tablet: '📱', AVR: '📻' })[type ?? ''] ?? '🔊';
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // just not remembered
  }
};
const recall = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export function SpotifyPanel() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [deviceId, setDeviceIdState] = useState<string>(() => recall(DEVICE_KEY) ?? '');
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTabState] = useState<'playlists' | 'search'>(() => (recall(TAB_KEY) === 'search' ? 'search' : 'playlists'));
  const [volume, setVolume] = useState<number | null>(null);
  const volumeTimer = useRef<number | null>(null);

  const setDeviceId = (id: string) => {
    setDeviceIdState(id);
    remember(DEVICE_KEY, id);
  };
  const setTab = (t: 'playlists' | 'search') => {
    setTabState(t);
    remember(TAB_KEY, t);
  };

  const loadDevices = useCallback(() => {
    api
      .get<Device[]>('/music/spotify/devices')
      .then((list) => {
        setDevices(list);
        // Nothing picked (or the picked one is gone): go with whatever Spotify is playing on.
        setDeviceIdState((cur) => (cur && list.some((d) => d.id === cur) ? cur : list.find((d) => d.is_active)?.id ?? cur));
      })
      .catch((err) => setError((err as Error).message));
  }, []);
  const loadPlayback = useCallback(() => {
    api
      .get<Playback | null>('/music/spotify/playback')
      .then((p) => {
        setPlayback(p);
        if (volumeTimer.current === null) setVolume(p?.device?.volume_percent ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadDevices();
    loadPlayback();
    const t = window.setInterval(loadPlayback, 5000);
    return () => window.clearInterval(t);
  }, [loadDevices, loadPlayback]);

  /** Run a Spotify action, show Spotify's complaint if it has one, and refresh what's playing. */
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    }
    window.setTimeout(loadPlayback, 600);
  };
  const target = () => (deviceId ? { deviceId } : {});
  const playThis = (body: { contextUri?: string; uris?: string[]; offsetUri?: string }) =>
    run(() => api.post('/music/spotify/play', { ...target(), ...body }));
  const queueThis = (uri: string) => run(() => api.post('/music/spotify/queue', { ...target(), uri }));

  const picked = devices?.find((d) => d.id === deviceId);
  const playingElsewhere = playback?.device && deviceId && playback.device.id !== deviceId;
  const controlDevice = playback?.device?.id ? { deviceId: playback.device.id } : target();

  const changeVolume = (v: number) => {
    setVolume(v);
    if (volumeTimer.current !== null) window.clearTimeout(volumeTimer.current);
    volumeTimer.current = window.setTimeout(() => {
      volumeTimer.current = null;
      void run(() => api.post('/music/spotify/volume', { ...controlDevice, percent: v }));
    }, 300);
  };

  return (
    <div className="spotify">
      <div className="spotify__where">
        <label>
          <span className="spotify__label">🔊 Play on</span>
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            <option value="">{devices === null ? 'Loading…' : devices.length ? 'Wherever Spotify is playing' : 'No speakers found'}</option>
            {devices?.map((d) => (
              <option key={d.id} value={d.id} disabled={d.is_restricted}>
                {deviceIcon(d.type)} {d.name}
                {d.is_active ? ' — playing now' : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="secondary" onClick={loadDevices} aria-label="Refresh speakers" title="Refresh speakers">
          ↻
        </button>
        {playingElsewhere && picked && (
          <button type="button" className="secondary" onClick={() => run(() => api.post('/music/spotify/transfer', { deviceId, play: true }))}>
            Move what's playing to {picked.name}
          </button>
        )}
      </div>
      {devices !== null && devices.length === 0 && (
        <p className="hint">
          Spotify only lists speakers that are switched on and logged in — open Spotify on a phone or
          start a house zone, then tap ↻.
        </p>
      )}

      {error && <div className="settings-login__error spotify__error">{error}</div>}

      {playback?.item && (
        <div className="spotify__now">
          {smallImage(playback.item.album?.images) && <img src={smallImage(playback.item.album?.images)} alt="" />}
          <div className="spotify__now-text">
            <strong>{playback.item.name}</strong>
            <span className="hint">{artistNames(playback.item)}</span>
            {playback.device && (
              <span className="hint">
                {deviceIcon(playback.device.type)} on {playback.device.name}
              </span>
            )}
          </div>
          <div className="spotify__transport">
            <button type="button" className="secondary" aria-label="Previous" onClick={() => run(() => api.post('/music/spotify/previous', controlDevice))}>
              ⏮
            </button>
            <button
              type="button"
              aria-label={playback.is_playing ? 'Pause' : 'Play'}
              onClick={() => run(() => api.post(`/music/spotify/${playback.is_playing ? 'pause' : 'play'}`, controlDevice))}
            >
              {playback.is_playing ? '⏸' : '▶'}
            </button>
            <button type="button" className="secondary" aria-label="Next" onClick={() => run(() => api.post('/music/spotify/next', controlDevice))}>
              ⏭
            </button>
          </div>
          {volume !== null && (
            <label className="spotify__volume">
              🔉
              <input type="range" min={0} max={100} value={volume} onChange={(e) => changeVolume(Number(e.target.value))} aria-label="Volume" />
              <span className="hint">{volume}%</span>
            </label>
          )}
        </div>
      )}

      <div className="spotify__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'playlists'} className={tab === 'playlists' ? '' : 'secondary'} onClick={() => setTab('playlists')}>
          📃 Playlists
        </button>
        <button type="button" role="tab" aria-selected={tab === 'search'} className={tab === 'search' ? '' : 'secondary'} onClick={() => setTab('search')}>
          🔎 Search
        </button>
      </div>

      {tab === 'playlists' && <Playlists onPlay={playThis} onQueue={queueThis} />}
      {tab === 'search' && <Search onPlay={playThis} onQueue={queueThis} />}
    </div>
  );
}

type PlayFn = (body: { contextUri?: string; uris?: string[]; offsetUri?: string }) => void;

function TrackRow({ track, onPlay, onQueue }: { track: SpTrack; onPlay: () => void; onQueue: () => void }) {
  return (
    <div className="spotify__row">
      {smallImage(track.album?.images) ? <img src={smallImage(track.album?.images)} alt="" /> : <span className="spotify__noimg">🎵</span>}
      <div className="spotify__row-text">
        <span>{track.name}</span>
        <span className="hint">
          {artistNames(track)}
          {track.album?.name ? ` · ${track.album.name}` : ''}
        </span>
      </div>
      <button type="button" aria-label={`Play ${track.name}`} onClick={onPlay}>
        ▶
      </button>
      <button type="button" className="secondary" aria-label={`Add ${track.name} to the queue`} title="Play after this song" onClick={onQueue}>
        ＋
      </button>
    </div>
  );
}

function Playlists({ onPlay, onQueue }: { onPlay: PlayFn; onQueue: (uri: string) => void }) {
  const [lists, setLists] = useState<SpPlaylist[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Record<string, SpTrack[] | 'error'>>({});

  useEffect(() => {
    api
      .get<SpPlaylist[]>('/music/spotify/playlists')
      .then(setLists)
      .catch((err) => setError((err as Error).message));
  }, []);

  const toggle = (p: SpPlaylist) => {
    if (openId === p.id) return setOpenId(null);
    setOpenId(p.id);
    if (tracks[p.id]) return;
    api
      .get<{ items?: { track?: SpTrack | null; item?: SpTrack | null }[] }>(`/music/spotify/playlists/${p.id}/tracks`)
      .then((r) =>
        setTracks((t) => ({
          ...t,
          [p.id]: (r.items ?? []).map((it) => it.track ?? it.item ?? null).filter((x): x is SpTrack => !!x?.uri && x.uri.startsWith('spotify:track:')),
        })),
      )
      .catch(() => setTracks((t) => ({ ...t, [p.id]: 'error' })));
  };

  if (error) return <div className="settings-login__error">{error}</div>;
  if (lists === null) return <p className="hint">Loading playlists…</p>;
  if (lists.length === 0) return <p className="empty-state">No playlists on this Spotify account yet.</p>;
  const shown = lists.filter((p) => !filter.trim() || p.name.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <div className="spotify__list">
      {lists.length > 8 && <input placeholder="Find a playlist…" value={filter} onChange={(e) => setFilter(e.target.value)} />}
      {shown.map((p) => {
        const count = p.tracks?.total ?? p.items?.total;
        const open = openId === p.id;
        const list = tracks[p.id];
        return (
          <div key={p.id} className="spotify__playlist">
            <div className="spotify__row">
              {smallImage(p.images) ? <img src={smallImage(p.images)} alt="" /> : <span className="spotify__noimg">📃</span>}
              <button type="button" className="link-button spotify__row-text" onClick={() => toggle(p)} aria-expanded={open}>
                <span>{p.name}</span>
                <span className="hint">
                  {count != null ? `${count} songs` : ''}
                  {p.owner?.display_name ? ` · ${p.owner.display_name}` : ''} · {open ? '▲ hide songs' : '▼ songs'}
                </span>
              </button>
              <button type="button" aria-label={`Play ${p.name}`} onClick={() => onPlay({ contextUri: p.uri })}>
                ▶
              </button>
            </div>
            {open && (
              <div className="spotify__tracks">
                {list === undefined && <p className="hint">Loading songs…</p>}
                {list === 'error' && <p className="hint">Spotify won't list this playlist's songs here — ▶ still plays it.</p>}
                {Array.isArray(list) && list.length === 0 && <p className="hint">No songs.</p>}
                {Array.isArray(list) &&
                  list.map((t, i) => (
                    <TrackRow key={`${t.uri}-${i}`} track={t} onPlay={() => onPlay({ contextUri: p.uri, offsetUri: t.uri })} onQueue={() => onQueue(t.uri)} />
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Search({ onPlay, onQueue }: { onPlay: PlayFn; onQueue: (uri: string) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await api.get<SearchResults>(`/music/spotify/search?q=${encodeURIComponent(q.trim())}`));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tracks = (results?.tracks?.items ?? []).filter((x): x is SpTrack => !!x);
  const albums = (results?.albums?.items ?? []).filter((x): x is SpAlbum => !!x);
  const playlists = (results?.playlists?.items ?? []).filter((x): x is SpPlaylist => !!x);
  const artists = (results?.artists?.items ?? []).filter((x): x is SpArtist => !!x);
  const nothing = results && !tracks.length && !albums.length && !playlists.length && !artists.length;

  return (
    <div className="spotify__list">
      <form className="spotify__search" onSubmit={go}>
        <input placeholder="Song, artist, album or playlist" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" disabled={busy || !q.trim()}>
          {busy ? '…' : 'Search'}
        </button>
      </form>
      {error && <div className="settings-login__error">{error}</div>}
      {nothing && <p className="empty-state">Nothing found for "{q}".</p>}
      {tracks.length > 0 && <h3>Songs</h3>}
      {tracks.map((t) => (
        <TrackRow key={t.uri} track={t} onPlay={() => onPlay({ uris: [t.uri] })} onQueue={() => onQueue(t.uri)} />
      ))}
      {artists.length > 0 && <h3>Artists</h3>}
      {artists.map((a) => (
        <div key={a.uri} className="spotify__row">
          {smallImage(a.images) ? <img src={smallImage(a.images)} alt="" className="spotify__round" /> : <span className="spotify__noimg">🎤</span>}
          <div className="spotify__row-text">
            <span>{a.name}</span>
            <span className="hint">Plays their top songs</span>
          </div>
          <button type="button" aria-label={`Play ${a.name}`} onClick={() => onPlay({ contextUri: a.uri })}>
            ▶
          </button>
        </div>
      ))}
      {albums.length > 0 && <h3>Albums</h3>}
      {albums.map((a) => (
        <div key={a.uri} className="spotify__row">
          {smallImage(a.images) ? <img src={smallImage(a.images)} alt="" /> : <span className="spotify__noimg">💿</span>}
          <div className="spotify__row-text">
            <span>{a.name}</span>
            <span className="hint">{artistNames(a)}</span>
          </div>
          <button type="button" aria-label={`Play ${a.name}`} onClick={() => onPlay({ contextUri: a.uri })}>
            ▶
          </button>
        </div>
      ))}
      {playlists.length > 0 && <h3>Playlists</h3>}
      {playlists.map((p) => (
        <div key={p.uri} className="spotify__row">
          {smallImage(p.images) ? <img src={smallImage(p.images)} alt="" /> : <span className="spotify__noimg">📃</span>}
          <div className="spotify__row-text">
            <span>{p.name}</span>
            <span className="hint">{p.owner?.display_name}</span>
          </div>
          <button type="button" aria-label={`Play ${p.name}`} onClick={() => onPlay({ contextUri: p.uri })}>
            ▶
          </button>
        </div>
      ))}
    </div>
  );
}
