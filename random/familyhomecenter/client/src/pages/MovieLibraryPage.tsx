import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

/**
 * 🎬 Movies — every video on the movies share (/share/media/movies by default, so home videos filed
 * from the 📥 Inbox into takk/<YYYY> are here too). Search, sort, filter by folder and year, and
 * watch in the browser (skip around; it remembers where you stopped on this screen). Read-only:
 * nothing on the share is changed. Server: services/movieLibrary.ts.
 */
interface LibraryMovie {
  id: string;
  title: string;
  file: string;
  folder: string;
  rel_path: string;
  size: number;
  added_at: string;
  year: number | null;
  recorded_at: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  video_codec: string | null;
  playable: boolean;
}
interface Library {
  dir: string;
  location: string;
  movies: LibraryMovie[];
  error: string | null;
  scanned_at: string | null;
}

type SortKey = 'added' | 'title' | 'year' | 'length' | 'size' | 'folder';
const SORTS: Array<{ key: SortKey; label: string; desc: boolean }> = [
  { key: 'added', label: 'Newest added', desc: true },
  { key: 'title', label: 'Title A–Z', desc: false },
  { key: 'year', label: 'Year', desc: true },
  { key: 'length', label: 'Length', desc: true },
  { key: 'size', label: 'File size', desc: true },
  { key: 'folder', label: 'Folder', desc: false },
];
const PAGE = 120;
const PREFS = 'familyhomecenter.movieLibrary.prefs';
const RESUME = 'familyhomecenter.movieLibrary.resume';

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private window */
  }
}

export function fmtLength(s: number | null): string {
  if (s == null) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}:${sec.toString().padStart(2, '0')}`;
}
const fmtSize = (n: number) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : `${Math.round(n / 1024 ** 2)} MB`);
const quality = (m: LibraryMovie) => {
  const h = Math.min(m.width ?? 0, m.height ?? 0) || m.height || 0;
  if (!h) return null;
  return h >= 2000 ? '4K' : h >= 1000 ? '1080p' : h >= 700 ? '720p' : 'SD';
};
const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function MovieLibraryPage() {
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [lib, setLib] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const saved = readJson(PREFS, { sort: 'added' as SortKey, desc: true, folder: '', year: '' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>(saved.sort);
  const [desc, setDesc] = useState<boolean>(saved.desc);
  const [folder, setFolder] = useState<string>(saved.folder);
  const [year, setYear] = useState<string>(saved.year);
  const [shown, setShown] = useState(PAGE);
  const [playing, setPlaying] = useState<LibraryMovie | null>(null);
  const [resume, setResume] = useState<Record<string, number>>(() => readJson(RESUME, {}));

  const load = (refresh = false) => {
    setRefreshing(refresh);
    return api
      .get<Library>(`/movie-library${refresh ? '?refresh=1' : ''}`)
      .then((l) => {
        setLib(l);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setRefreshing(false));
  };
  useEffect(() => {
    void load();
    // Lengths and sizes fill in over a few minutes the first time — look again now and then.
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => writeJson(PREFS, { sort, desc, folder, year }), [sort, desc, folder, year]);
  useEffect(() => setShown(PAGE), [query, sort, desc, folder, year]);

  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of lib?.movies ?? []) counts.set(m.folder, (counts.get(m.folder) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [lib]);
  const years = useMemo(() => [...new Set((lib?.movies ?? []).map((m) => m.year).filter((y): y is number => y != null))].sort((a, b) => b - a), [lib]);

  const list = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    const out = (lib?.movies ?? []).filter((m) => {
      if (folder !== '' && m.folder !== folder) return false;
      if (year && String(m.year ?? '') !== year) return false;
      if (!words.length) return true;
      const hay = plain(`${m.title} ${m.rel_path} ${m.year ?? ''}`);
      return words.every((w) => hay.includes(w));
    });
    const val = (m: LibraryMovie): number | string => {
      switch (sort) {
        case 'added':
          return m.added_at;
        case 'title':
          return plain(m.title);
        case 'year':
          return m.year ?? -1;
        case 'length':
          return m.duration ?? -1;
        case 'size':
          return m.size;
        case 'folder':
          return plain(m.rel_path);
      }
    };
    out.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return (desc ? -c : c) || plain(a.title).localeCompare(plain(b.title));
    });
    return out;
  }, [lib, query, sort, desc, folder, year]);

  const keepPlace = (id: string, t: number | null) =>
    setResume((r) => {
      const next = { ...r };
      if (t == null) delete next[id];
      else next[id] = t;
      writeJson(RESUME, next);
      return next;
    });
  const continuing = (lib?.movies ?? []).filter((m) => resume[m.id] > 0);

  return (
    <div className="movie-library">
      <div className="movie-library__head">
        <h1>🎬 Movies</h1>
        <button type="button" className="secondary" disabled={refreshing} onClick={() => void load(true)} title="Look at the share again">
          {refreshing ? 'Looking…' : '🔄'}
        </button>
      </div>
      {error && <div className="settings-login__error">{error}</div>}
      {lib?.error && (
        <div className="settings-login__error">
          {lib.error}
          {isParent && <> — change the folder in <Link to="/settings">⚙️ Settings → 🎬 Movies</Link>.</>}
        </div>
      )}
      {!lib && !error && <p>Loading…</p>}

      {lib && (
        <>
          <div className="movie-library__tools">
            <input type="search" placeholder={`🔎 Search ${lib.movies.length} movies…`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search movies" />
            <select value={sort} onChange={(e) => {
              const s = SORTS.find((x) => x.key === e.target.value)!;
              setSort(s.key);
              setDesc(s.desc);
            }} aria-label="Sort by">
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <button type="button" className="secondary" onClick={() => setDesc(!desc)} title={desc ? 'Highest / newest first' : 'Lowest / oldest first'} aria-label="Flip the order">
              {desc ? '↓' : '↑'}
            </button>
            {years.length > 0 && (
              <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
                <option value="">Any year</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>
          {folders.length > 1 && (
            <div className="movie-library__folders">
              <button type="button" className={folder === '' ? '' : 'secondary'} onClick={() => setFolder('')}>All</button>
              {folders.map(([f, n]) => (
                <button key={f || '(top)'} type="button" className={folder === f ? '' : 'secondary'} onClick={() => setFolder(folder === f ? '' : f)}>
                  📁 {f || 'Not in a folder'} <span className="hint">{n}</span>
                </button>
              ))}
            </div>
          )}

          {continuing.length > 0 && !query && (
            <section>
              <h3>▶ Keep watching</h3>
              <div className="movie-library__grid">
                {continuing.slice(0, 6).map((m) => <MovieCard key={m.id} m={m} at={resume[m.id]} onPlay={() => setPlaying(m)} />)}
              </div>
            </section>
          )}

          <p className="hint">
            {list.length === lib.movies.length ? `${list.length} movies` : `${list.length} of ${lib.movies.length} movies`} · from <code>{lib.location}</code>
          </p>
          {lib.movies.length === 0 && !lib.error && <p className="empty-state">No videos in that folder yet.</p>}
          <div className="movie-library__grid">
            {list.slice(0, shown).map((m) => <MovieCard key={m.id} m={m} at={resume[m.id]} onPlay={() => setPlaying(m)} />)}
          </div>
          {list.length > shown && (
            <div className="task-form__row">
              <button type="button" className="secondary" onClick={() => setShown(shown + PAGE)}>Show more ({list.length - shown} left)</button>
            </div>
          )}
          {isParent && (
            <p className="hint">
              📁 Movies folder: <code>{lib.location}</code> — change it in <Link to="/settings">⚙️ Settings → 🎬 Movies</Link>.
            </p>
          )}
        </>
      )}

      {playing && <Player m={playing} startAt={resume[playing.id] ?? 0} onPlace={(t) => keepPlace(playing.id, t)} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function MovieCard({ m, at, onPlay }: { m: LibraryMovie; at?: number; onPlay: () => void }) {
  const [poster, setPoster] = useState(true);
  const q = quality(m);
  return (
    <button type="button" className="movie-card" onClick={onPlay} title={m.rel_path}>
      <div className="movie-card__poster">
        {poster ? <img src={`/api/movie-library/${m.id}/poster`} alt="" loading="lazy" onError={() => setPoster(false)} /> : <span>🎬</span>}
        {m.duration != null && <span className="movie-card__len">{fmtLength(m.duration)}</span>}
        {at && m.duration ? <span className="movie-card__progress" style={{ width: `${Math.min(100, (at / m.duration) * 100)}%` }} /> : null}
      </div>
      <div className="movie-card__title">{m.title}</div>
      <div className="hint">
        {[m.year, q, m.folder, !m.playable ? '⬇ download to watch' : null].filter(Boolean).join(' · ')}
      </div>
    </button>
  );
}

function Player({ m, startAt, onPlace, onClose }: { m: LibraryMovie; startAt: number; onPlace: (t: number | null) => void; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const last = useRef(0);
  const src = `/api/movie-library/${m.id}/stream`;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const save = () => {
    const v = ref.current;
    if (!v || !v.duration) return;
    // Near the start or the end: nothing to come back to.
    onPlace(v.currentTime < 30 || v.duration - v.currentTime < 60 ? null : v.currentTime);
  };
  return (
    <div className="modal-overlay" onClick={() => { save(); onClose(); }}>
      <div className="modal-panel panel movie-player" onClick={(e) => e.stopPropagation()}>
        <div className="movie-library__head">
          <h2>{m.title}{m.year ? ` (${m.year})` : ''}</h2>
          <button type="button" className="secondary" onClick={() => { save(); onClose(); }} aria-label="Close">✕</button>
        </div>
        {failed || !m.playable ? (
          <p className="settings-login__error">
            This kind of video ({m.file.split('.').pop()?.toUpperCase()}{m.video_codec ? `, ${m.video_codec}` : ''}) doesn't play in this browser. Download it and open it in a video app (VLC
            plays everything).
          </p>
        ) : (
          <video
            ref={ref}
            src={src}
            controls
            autoPlay
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              if (startAt > 0 && startAt < e.currentTarget.duration - 5) e.currentTarget.currentTime = startAt;
            }}
            onTimeUpdate={(e) => {
              if (Math.abs(e.currentTarget.currentTime - last.current) > 15) {
                last.current = e.currentTarget.currentTime;
                save();
              }
            }}
            onPause={save}
            onEnded={() => onPlace(null)}
            onError={() => setFailed(true)}
          />
        )}
        <p className="hint">
          {[fmtLength(m.duration), quality(m), fmtSize(m.size), m.recorded_at ? `recorded ${new Date(m.recorded_at).toLocaleDateString()}` : null].filter(Boolean).join(' · ')}
          <br />
          <code>{m.rel_path}</code> · <a href={`${src}?download=1`}>⬇ Download</a>
        </p>
      </div>
    </div>
  );
}

