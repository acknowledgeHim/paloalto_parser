import { useEffect, useState, type FormEvent } from 'react';
import { api, type Photo, type Track, type LibraryStatus } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { LibraryBrowser } from './LibraryBrowser.js';

type SelectionMode = 'date-range' | 'name' | 'random' | 'manual';
type Selection =
  | { mode: 'manual'; photoIds: string[] }
  | { mode: 'random'; count: number }
  | { mode: 'date-range'; start: string; end: string }
  | { mode: 'name'; query: string };

interface Props {
  photos: Photo[];
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Renders a new slideshow video from a photo selection (manual pick, random N, or by date taken)
 * plus an optional track from the music library — read-only against both: a movie is always a
 * brand new file (server/src/services/movieRender.ts), nothing about the source photos/music is
 * ever deleted or modified to make one.
 */
export function MovieMakerModal({ photos, onClose, onCreated }: Props) {
  const { activeProfile } = useFamilyMembers();
  const [title, setTitle] = useState('');
  // Defaults to a filter, not the grid — with a large library (especially over a slower SMB
  // share) rendering every photo as a DOM node was enough to freeze the whole modal; the grid is
  // still available, just not what opens first.
  const [mode, setMode] = useState<SelectionMode>('date-range');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [randomCount, setRandomCount] = useState(10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [secondsPerPhoto, setSecondsPerPhoto] = useState(4);
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState<Track[]>([]);
  const [musicTrack, setMusicTrack] = useState<Track | null>(null);
  const [musicMode, setMusicMode] = useState<'search' | 'browse'>('search');
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // A big library (hundreds/thousands of photos, especially over a slower SMB share) rendering as
  // one giant DOM grid was enough to freeze the whole modal on a Pi-class browser — cap how many
  // show up at once and let "Show more" reveal the rest in batches instead.
  const [visibleCount, setVisibleCount] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const buildSelection = (): Selection => {
    if (mode === 'manual') return { mode: 'manual', photoIds: Array.from(selectedIds) };
    if (mode === 'random') return { mode: 'random', count: randomCount };
    if (mode === 'name') return { mode: 'name', query: nameQuery };
    return { mode: 'date-range', start: startDate, end: endDate };
  };

  // Whether there's enough picked to attempt a render — synchronous, so the submit button doesn't
  // stay stuck waiting on the (sometimes slow, over a network share) resolve-selection preview
  // below. The preview is purely informational; hitting Create always gets an authoritative answer
  // from the actual POST /movies call regardless of whether the preview has come back yet.
  const selectionValid =
    mode === 'manual' ? selectedIds.size > 0 :
    mode === 'random' ? randomCount > 0 :
    mode === 'name' ? nameQuery.trim() !== '' :
    Boolean(startDate && endDate);

  // Live "N photos match" preview — manual mode already knows its own count locally; the other
  // modes ask the server (resolve-selection doesn't create anything, just resolves the count).
  useEffect(() => {
    if (mode === 'manual') {
      setPreviewCount(selectedIds.size);
      setPreviewLoading(false);
      return;
    }
    if (!selectionValid) {
      setPreviewCount(null);
      setPreviewLoading(false);
      return;
    }
    // Debounced — 'name' fires per keystroke, and 'date-range' can fire twice in a row while
    // picking both ends; the resolve itself can also be slow over a network share, so avoid
    // piling up redundant requests while the user is still choosing.
    setPreviewLoading(true);
    const t = setTimeout(() => {
      api
        .post<{ count: number }>('/movies/resolve-selection', { selection: buildSelection() })
        .then((r) => setPreviewCount(r.count))
        .catch(() => setPreviewCount(null))
        .finally(() => setPreviewLoading(false));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedIds, randomCount, startDate, endDate, nameQuery, selectionValid]);

  useEffect(() => {
    api.get<LibraryStatus>('/music/library/status').then(setLibraryStatus).catch(() => setLibraryStatus({ connected: false, error: 'request failed' }));
  }, []);

  useEffect(() => {
    if (!musicQuery.trim()) {
      setMusicResults([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .get<Track[]>(`/music/library/search?q=${encodeURIComponent(musicQuery)}`)
        .then(setMusicResults)
        .catch(() => setMusicResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [musicQuery]);

  const toggleSelected = (id: string) => {
    setSelectedIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectionValid) return;
    setError(null);
    setCreating(true);
    try {
      await api.post('/movies', {
        title: title.trim(),
        selection: buildSelection(),
        seconds_per_photo: secondsPerPhoto,
        music_track: musicTrack?.file ?? null,
        created_by_id: activeProfile?.id ?? null,
      });
      onCreated();
    } catch (err) {
      setError((err as Error).message || 'Could not start that movie');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-panel task-form movie-maker" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Make a movie</h2>
        <input autoFocus placeholder="Title (e.g. Summer 2024)" value={title} onChange={(e) => setTitle(e.target.value)} />

        <div>
          <label className="member-form__label">Pick photos</label>
          <div className="task-form__row">
            <select value={mode} onChange={(e) => setMode(e.target.value as SelectionMode)}>
              <option value="date-range">By date taken</option>
              <option value="name">By folder or filename</option>
              <option value="random">Random</option>
              <option value="manual">Choose from the grid</option>
            </select>
          </div>
          {mode === 'random' && (
            <label className="member-form__label member-form__label--inline">
              How many
              <input type="number" min={1} value={randomCount} onChange={(e) => setRandomCount(Number(e.target.value) || 1)} />
            </label>
          )}
          {mode === 'date-range' && (
            <div className="task-form__row">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <span className="hint">to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}
          {mode === 'name' && (
            <>
              <input
                placeholder="e.g. Vacation, 2023, Christmas…"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
              />
              <p className="hint">Matches anywhere in the folder path or filename under PHOTOS_DIR.</p>
            </>
          )}
          {mode === 'manual' && (
            <>
              <div className="movie-maker__photo-grid">
                {photos.slice(0, visibleCount).map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`movie-maker__photo ${selectedIds.has(p.id) ? 'movie-maker__photo--selected' : ''}`}
                    onClick={() => toggleSelected(p.id)}
                  >
                    <img src={`/api/photos/${p.id}/image`} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
              {visibleCount < photos.length && (
                <button type="button" className="secondary" onClick={() => setVisibleCount((c) => c + 90)}>
                  Show more ({photos.length - visibleCount} left)
                </button>
              )}
            </>
          )}
          {mode !== 'manual' && selectionValid && previewLoading && previewCount === null && (
            <p className="hint">Checking how many photos match…</p>
          )}
          {previewCount !== null && (
            <p className="hint">{previewCount} photo{previewCount === 1 ? '' : 's'} {mode === 'manual' ? 'picked' : 'match'}.</p>
          )}
        </div>

        <label className="member-form__label member-form__label--inline">
          Seconds per photo
          <input
            type="number"
            min={1}
            step={0.5}
            value={secondsPerPhoto}
            onChange={(e) => setSecondsPerPhoto(Number(e.target.value) || 1)}
          />
        </label>

        <div>
          <label className="member-form__label">Music (optional)</label>
          {musicTrack ? (
            <div className="task-form__row">
              <span>{musicTrack.title}{musicTrack.artist ? ` — ${musicTrack.artist}` : ''}</span>
              <button type="button" className="secondary" onClick={() => setMusicTrack(null)}>Remove</button>
            </div>
          ) : (
            <>
              {libraryStatus && !libraryStatus.connected && (
                <p className="hint">
                  Can't reach the music library (MPD) right now{libraryStatus.error ? ` — ${libraryStatus.error}` : ''} —
                  see docs/MUSIC_SETUP.md.
                </p>
              )}
              <div className="task-form__row">
                <button type="button" className={musicMode === 'search' ? '' : 'secondary'} onClick={() => setMusicMode('search')}>Search</button>
                <button type="button" className={musicMode === 'browse' ? '' : 'secondary'} onClick={() => setMusicMode('browse')}>Browse</button>
              </div>
              {musicMode === 'search' && (
                <>
                  <input placeholder="Search the music library…" value={musicQuery} onChange={(e) => setMusicQuery(e.target.value)} />
                  {musicResults.length > 0 && (
                    <ul className="movie-maker__music-results">
                      {musicResults.slice(0, 8).map((t) => (
                        <li key={t.file}>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => {
                              setMusicTrack(t);
                              setMusicResults([]);
                              setMusicQuery('');
                            }}
                          >
                            {t.title}{t.artist ? ` — ${t.artist}` : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {musicMode === 'browse' && (
                <LibraryBrowser
                  renderActions={(t) => (
                    <button type="button" className="link-button" onClick={() => setMusicTrack(t)}>Use this</button>
                  )}
                />
              )}
            </>
          )}
          <p className="hint">Loops under the whole slideshow, whatever its own length.</p>
        </div>

        {error && <div className="settings-login__error">{error}</div>}
        <div className="task-form__row">
          <button type="submit" disabled={creating || !title.trim() || !selectionValid}>
            {creating ? 'Starting…' : 'Create movie'}
          </button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
        <p className="hint">
          Rendering happens in the background and can take a few minutes on a Pi — it'll show up
          below, and switch to "Watch" once it's ready.
        </p>
      </form>
    </div>
  );
}
