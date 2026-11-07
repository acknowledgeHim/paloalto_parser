import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
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
  original_rel: string | null;
  rotation: number;
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

/**
 * Will this browser play it? The file type has to be one browsers open, and the picture inside
 * has to be one this browser decodes — HEVC (iPhone video) only plays in Safari and on computers
 * with hardware for it, never on the Pi's Chromium. Not read yet (no codec) → assume it plays.
 */
const CODEC_TYPES: Record<string, string> = {
  h264: 'video/mp4; codecs="avc1.640028"',
  hevc: 'video/mp4; codecs="hvc1.1.6.L120.90"',
  vp9: 'video/webm; codecs="vp9"',
  vp8: 'video/webm; codecs="vp8"',
  av1: 'video/mp4; codecs="av01.0.08M.08"',
  mpeg4: 'video/mp4; codecs="mp4v.20.8"',
};
let probeEl: HTMLVideoElement | null = null;
function playsHere(m: LibraryMovie): boolean {
  if (!m.playable) return false;
  // H.264 plays in every browser (some answer "no" to an exact profile string while playing it fine).
  if (!m.video_codec || m.video_codec === 'h264') return true;
  const type = CODEC_TYPES[m.video_codec];
  if (!type) return false;
  probeEl ??= document.createElement('video');
  return probeEl.canPlayType(type) !== '';
}

/** What the browser said when a video didn't play. */
function mediaProblem(v: HTMLVideoElement): string {
  const e = v.error;
  if (!e) return 'it stopped';
  const why: Record<number, string> = {
    1: 'loading was stopped',
    2: "the Family Home Center couldn't send it (network / share problem)",
    3: "the browser couldn't decode the picture or sound",
    4: "the browser doesn't support this file (or the server couldn't open it)",
  };
  return `${why[e.code] ?? `error ${e.code}`}${e.message ? ` — ${e.message}` : ''}`;
}

export function MovieLibraryPage() {
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [lib, setLib] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const saved = readJson(PREFS, { sort: 'added' as SortKey, desc: true, folder: '', year: '', all: false });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>(saved.sort);
  const [desc, setDesc] = useState<boolean>(saved.desc);
  const [folder, setFolder] = useState<string>(saved.folder);
  const [year, setYear] = useState<string>(saved.year);
  // Only what plays in this browser, unless asked for the rest (they can only be downloaded).
  const [showAll, setShowAll] = useState<boolean>(!!saved.all);
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
  useEffect(() => writeJson(PREFS, { sort, desc, folder, year, all: showAll }), [sort, desc, folder, year, showAll]);
  useEffect(() => setShown(PAGE), [query, sort, desc, folder, year, showAll]);
  const movies = useMemo(() => (lib?.movies ?? []).filter((m) => showAll || playsHere(m)), [lib, showAll]);
  const hidden = (lib?.movies.length ?? 0) - (showAll ? (lib?.movies ?? []).filter(playsHere).length : movies.length);

  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of movies) counts.set(m.folder, (counts.get(m.folder) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [movies]);
  const years = useMemo(() => [...new Set(movies.map((m) => m.year).filter((y): y is number => y != null))].sort((a, b) => b - a), [movies]);

  const list = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    const out = movies.filter((m) => {
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
  }, [movies, query, sort, desc, folder, year]);

  const keepPlace = (id: string, t: number | null) =>
    setResume((r) => {
      const next = { ...r };
      if (t == null) delete next[id];
      else next[id] = t;
      writeJson(RESUME, next);
      return next;
    });
  const continuing = movies.filter((m) => resume[m.id] > 0);

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
            <input type="search" placeholder={`🔎 Search ${movies.length} movies…`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search movies" />
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
            {list.length === movies.length ? `${list.length} movies` : `${list.length} of ${movies.length} movies`} · from <code>{lib.location}</code>
          </p>
          {hidden > 0 && (
            <label className="privacy-toggle">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              <span>
                <strong>Also show {hidden} that don't play in this browser</strong>
                <span className="hint"> — they can be downloaded and watched in a video app (VLC){showAll ? '' : '. .mpg videos show up once their .mp4 copy is made.'}</span>
              </span>
            </label>
          )}
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

      {playing && (
        <Player
          key={playing.id}
          m={playing}
          startAt={resume[playing.id] ?? 0}
          onPlace={(t) => keepPlace(playing.id, t)}
          onClose={() => setPlaying(null)}
          onRotated={(rotation) => {
            setLib((l) => (l ? { ...l, movies: l.movies.map((x) => (x.id === playing.id ? { ...x, rotation } : x)) } : l));
            setPlaying((p) => (p ? { ...p, rotation } : p));
          }}
        />
      )}
    </div>
  );
}

function MovieCard({ m, at, onPlay }: { m: LibraryMovie; at?: number; onPlay: () => void }) {
  const [poster, setPoster] = useState(true);
  const q = quality(m);
  return (
    <button type="button" className="movie-card" onClick={onPlay} title={m.rel_path}>
      <div className="movie-card__poster">
        {poster ? (
          <img
            src={`/api/movie-library/${m.id}/poster`}
            alt=""
            loading="lazy"
            className={m.rotation ? `movie-card__img--r${m.rotation}` : undefined}
            onError={() => setPoster(false)}
          />
        ) : (
          <span>🎬</span>
        )}
        {m.duration != null && <span className="movie-card__len">{fmtLength(m.duration)}</span>}
        {at && m.duration ? <span className="movie-card__progress" style={{ width: `${Math.min(100, (at / m.duration) * 100)}%` }} /> : null}
      </div>
      <div className="movie-card__title">{m.title}</div>
      <div className="hint">
        {[m.year, q, m.folder, !playsHere(m) ? (/\.(mpg|mpeg)$/i.test(m.file) && !m.original_rel ? '.mp4 copy being made' : '⬇ download to watch') : null].filter(Boolean).join(' · ')}
      </div>
    </button>
  );
}

function Player({
  m,
  startAt,
  onPlace,
  onClose,
  onRotated,
}: {
  m: LibraryMovie;
  startAt: number;
  onPlace: (t: number | null) => void;
  onClose: () => void;
  onRotated: (degrees: number) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [rotErr, setRotErr] = useState<string | null>(null);
  const rotate = (by: number) => {
    const degrees = (((m.rotation + by) % 360) + 360) % 360;
    onRotated(degrees);
    setRotErr(null);
    api.put(`/movie-library/${m.id}/rotation`, { degrees }).catch((e) => setRotErr((e as Error).message));
  };
  const [failed, setFailed] = useState<string | null>(null);
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
          <div className="movie-player__actions">
            <button type="button" className="secondary" onClick={() => rotate(-90)} title="Turn left (for a video recorded sideways)" aria-label="Turn left">↺</button>
            <button type="button" className="secondary" onClick={() => rotate(90)} title="Turn right (for a video recorded sideways)" aria-label="Turn right">↻</button>
            <button type="button" className="secondary" onClick={() => { save(); onClose(); }} aria-label="Close">✕</button>
          </div>
        </div>
        {rotErr && <p className="settings-login__error">Couldn't save the turn: {rotErr}</p>}
        {failed || !playsHere(m) ? (
          <p className="settings-login__error">
            {failed ? (
              <>
                It didn't play: {failed} ({m.file.split('.').pop()?.toUpperCase()}
                {m.video_codec ? `, ${m.video_codec}` : ''}).{' '}
                <button type="button" className="secondary" onClick={() => setFailed(null)}>
                  ↻ Try again
                </button>
              </>
            ) : (
              <>
                This kind of video ({m.file.split('.').pop()?.toUpperCase()}
                {m.video_codec ? `, ${m.video_codec}` : ''}) doesn't play in this browser.
              </>
            )}{' '}
            Download it and open it in a video app (VLC plays everything).
          </p>
        ) : (
          <Stage rotation={m.rotation} video={ref}>
          <video
            ref={ref}
            src={src}
            controls={!m.rotation}
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
            onError={(e) => setFailed(mediaProblem(e.currentTarget))}
          />
          </Stage>
        )}
        <p className="hint">
          {[fmtLength(m.duration), quality(m), fmtSize(m.size), m.recorded_at ? `recorded ${new Date(m.recorded_at).toLocaleDateString()}` : null].filter(Boolean).join(' · ')}
          <br />
          {m.rotation ? <>🔄 Shown turned {m.rotation === 180 ? 'upside down' : m.rotation === 90 ? 'right' : 'left'} — the file itself isn't changed.<br /></> : null}
          <code>{m.rel_path}</code> · <a href={`${src}?download=1`}>⬇ Download</a>
          {/\.(mov|qt)$/i.test(m.file) && <> · <a href={`/api/movie-library/${m.id}/mp4`}>⬇ Download as .mp4</a></>}
          {m.original_rel && <> · <a href={`${src}?original=1&download=1`}>⬇ Original ({m.original_rel.split('.').pop()?.toUpperCase()})</a></>}
        </p>
      </div>
    </div>
  );
}


const clock = (t: number) => {
  if (!Number.isFinite(t)) return '0:00';
  const h = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  return h ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
};

/**
 * 🔄 A video shown turned (for one recorded sideways). The browser's own controls would turn with
 * the picture, so a turned video gets a simple control bar of its own that stays upright, and
 * full screen shows the whole (turned) stage. Not turned → the video as it is, with its own controls.
 */
function Stage({ rotation, video, children }: { rotation: number; video: React.RefObject<HTMLVideoElement>; children: React.ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [, tick] = useState(0);
  useEffect(() => {
    const el = stage.current;
    if (!el || !rotation) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [rotation]);
  useEffect(() => {
    const v = video.current;
    if (!v || !rotation) return;
    const up = () => tick((n) => n + 1);
    const evs = ['timeupdate', 'play', 'pause', 'volumechange', 'durationchange', 'loadedmetadata'];
    evs.forEach((e) => v.addEventListener(e, up));
    return () => evs.forEach((e) => v.removeEventListener(e, up));
  }, [rotation, video]);
  const side = rotation === 90 || rotation === 270;
  const v = video.current;
  // Always the same elements (only their look changes), so turning doesn't restart the video.
  const style: React.CSSProperties | undefined = !rotation
    ? undefined
    : side
      ? { width: box.h, height: box.w, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }
      : { width: box.w, height: box.h, transform: `translate(-50%, -50%) rotate(${rotation}deg)` };
  const full = () => {
    const el = stage.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => {});
  };
  return (
    <div className={rotation ? 'movie-player__turned' : undefined}>
      <div
        ref={stage}
        className={rotation ? 'movie-player__stage' : undefined}
        onClick={rotation ? () => (v?.paused ? void v.play() : v?.pause()) : undefined}
        onDoubleClick={rotation ? full : undefined}
      >
        <div className={rotation ? 'movie-player__rot' : undefined} style={style}>
          {children}
        </div>
      </div>
      {!!rotation && <div className="movie-player__bar">
        <button type="button" className="secondary" onClick={() => (v?.paused ? void v.play() : v?.pause())} aria-label={v?.paused ? 'Play' : 'Pause'}>
          {v?.paused ?? true ? '▶' : '⏸'}
        </button>
        <span className="hint">{clock(v?.currentTime ?? 0)}</span>
        <input
          type="range"
          min={0}
          max={v?.duration || 0}
          step={1}
          value={v?.currentTime ?? 0}
          onChange={(e) => v && (v.currentTime = Number(e.target.value))}
          aria-label="Position"
        />
        <span className="hint">{clock(v?.duration ?? 0)}</span>
        <button type="button" className="secondary" onClick={() => v && (v.muted = !v.muted)} aria-label={v?.muted ? 'Sound on' : 'Sound off'}>
          {v?.muted ? '🔇' : '🔊'}
        </button>
        {document.fullscreenEnabled && (
          <button type="button" className="secondary" onClick={full} aria-label="Full screen">
            ⛶
          </button>
        )}
      </div>}
    </div>
  );
}
