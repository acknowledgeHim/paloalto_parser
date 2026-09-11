import { useEffect, useState } from 'react';
import { api, type Zone, type ZoneGroup, type ZoneStatus, type Track } from '../api/client.js';

function fmtTime(seconds: number | null): string {
  if (seconds === null) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MusicPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [statuses, setStatuses] = useState<Record<number, ZoneStatus>>({});
  const [groups, setGroups] = useState<ZoneGroup[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [targetZone, setTargetZone] = useState<number>(1);

  const [spotify, setSpotify] = useState<{ configured: boolean; connected: boolean }>({ configured: false, connected: false });

  const loadZones = () => {
    api.get<Zone[]>('/music/zones').then(setZones).catch(console.error);
    api.get<ZoneGroup[]>('/music/groups').then(setGroups).catch(console.error);
  };
  const loadStatuses = () => {
    api.get<ZoneStatus[]>('/music/status').then((list) => {
      const byId: Record<number, ZoneStatus> = {};
      for (const s of list) byId[s.zoneId] = s;
      setStatuses(byId);
    }).catch(console.error);
  };

  useEffect(() => {
    loadZones();
    loadStatuses();
    api.get<{ configured: boolean; connected: boolean }>('/music/spotify/status').then(setSpotify).catch(console.error);
    const interval = setInterval(loadStatuses, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupSelected = async () => {
    if (selected.size < 2) return;
    await api.put('/music/groups', { groups: [{ name: 'Group', zoneIds: Array.from(selected) }] });
    setSelected(new Set());
    loadZones();
  };
  const ungroupAll = async () => {
    await api.put('/music/groups', { groups: [] });
    loadZones();
  };

  const saveRename = async (id: number) => {
    if (renameValue.trim()) await api.patch(`/music/zones/${id}`, { name: renameValue.trim() });
    setRenamingId(null);
    loadZones();
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    setResults(await api.get<Track[]>(`/music/library/search?q=${encodeURIComponent(query)}`));
  };

  const playTrack = async (file: string) => {
    await api.post(`/music/zones/${targetZone}/play-files`, { files: [file] });
    loadStatuses();
  };
  const queueTrack = async (file: string) => {
    await api.post(`/music/zones/${targetZone}/queue`, { file });
  };

  return (
    <div className="music-page">
      <h1>Music</h1>

      <div className="music-page__zones">
        {zones.map((zone) => {
          const status = statuses[zone.id];
          const group = groups.find((g) => g.id === zone.groupId);
          return (
            <div key={zone.id} className="panel zone-card">
              <div className="zone-card__header">
                <input type="checkbox" checked={selected.has(zone.id)} onChange={() => toggleSelected(zone.id)} />
                {renamingId === zone.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => saveRename(zone.id)}
                    onKeyDown={(e) => e.key === 'Enter' && saveRename(zone.id)}
                  />
                ) : (
                  <h3 onClick={() => { setRenamingId(zone.id); setRenameValue(zone.name); }}>{zone.name}</h3>
                )}
                {group && <span className="badge">Grouped: {group.name}</span>}
              </div>

              <div className="zone-card__now-playing">
                {status?.track ? (
                  <>
                    <div className="zone-card__title">{status.track.title}</div>
                    <div className="zone-card__artist">{status.track.artist}</div>
                  </>
                ) : (
                  <div className="zone-card__title zone-card__title--empty">Nothing playing</div>
                )}
                <span className={`badge badge--source-${status?.source ?? 'none'}`}>{status?.source ?? 'off'}</span>
              </div>

              <div className="zone-card__transport">
                <button className="secondary" onClick={() => api.post(`/music/zones/${zone.id}/previous`).then(loadStatuses)}>⏮</button>
                <button onClick={() => api.post(`/music/zones/${zone.id}/${status?.state === 'play' ? 'pause' : 'play'}`).then(loadStatuses)}>
                  {status?.state === 'play' ? '⏸' : '▶'}
                </button>
                <button className="secondary" onClick={() => api.post(`/music/zones/${zone.id}/next`).then(loadStatuses)}>⏭</button>
              </div>

              <div className="zone-card__volume">
                <span>🔉</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={status?.volume ?? 0}
                  onChange={(e) => api.post(`/music/zones/${zone.id}/volume`, { percent: Number(e.target.value) })}
                />
                <span>{status?.volume ?? 0}%</span>
              </div>
              {status?.elapsedSeconds != null && (
                <div className="hint">{fmtTime(status.elapsedSeconds)} / {fmtTime(status.durationSeconds)}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="music-page__group-actions">
        <button className="secondary" onClick={groupSelected} disabled={selected.size < 2}>
          Play same music on selected zones
        </button>
        <button className="secondary" onClick={ungroupAll}>Ungroup all</button>
      </div>

      <section className="panel">
        <h2>Your music library</h2>
        <div className="task-form__row">
          <input placeholder="Search artist, album, or song" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()} />
          <button onClick={runSearch}>Search</button>
          <select value={targetZone} onChange={(e) => setTargetZone(Number(e.target.value))}>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        {results.length === 0 && <div className="empty-state">Search your local library — see docs/MUSIC_SETUP.md if this comes back empty.</div>}
        {results.map((t) => (
          <div key={t.file} className="library-row">
            <div>
              <div className="library-row__title">{t.title}</div>
              <div className="hint">{t.artist} {t.album ? `— ${t.album}` : ''}</div>
            </div>
            <div className="task-form__row">
              <button onClick={() => playTrack(t.file)}>Play</button>
              <button className="secondary" onClick={() => queueTrack(t.file)}>Queue</button>
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Spotify</h2>
        <p className="hint">
          Anyone can cast from their own Spotify app right now — open Spotify, tap the speaker/devices icon,
          and pick a zone (e.g. "Family Hub Zone 1"). No login needed here for that.
        </p>
        <p>
          In-dashboard Spotify control: {spotify.connected ? 'Connected ✅' : spotify.configured ? 'Not connected' : 'Not configured'}
          {spotify.configured && !spotify.connected && <span className="hint"> — connect it from Settings</span>}
        </p>
        {!spotify.configured && <p className="hint">See docs/SPOTIFY_SETUP.md to enable in-dashboard playback control (requires Spotify Premium).</p>}
      </section>
    </div>
  );
}
