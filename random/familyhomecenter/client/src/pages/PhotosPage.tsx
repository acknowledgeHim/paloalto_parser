import { useEffect, useState } from 'react';
import { api, type Movie, type Photo } from '../api/client.js';
import { Slideshow } from '../components/Slideshow.js';
import { MovieMakerModal } from '../components/MovieMakerModal.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

/** Mirrors server/src/services/movieRender.ts — a movie with music runs 4s past its last photo. */
function fmtMovieLength(m: Movie): string {
  const total = Math.round(m.photo_count * m.seconds_per_photo + (m.music_tracks.length > 0 ? 4 : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** The saved file is named after the movie's title rather than its internal id — minus characters
 *  that aren't allowed in filenames on Windows/macOS. */
function movieDownloadName(m: Movie): string {
  const safe = m.title.replace(/[\\/:*?"<>|]+/g, '').trim();
  return `${safe || 'movie'}.mp4`;
}

/** GET /movies/drafts — an auto-saved, unfinished movie maker form. */
interface MovieDraft {
  id: string;
  movie_id: string | null;
  created_by_id: string | null;
  title: string;
  updated_at: string;
  photo_count: number;
  track_count: number;
}

function fmtSavedAt(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

function MoviesSection() {
  const { members, activeProfile } = useFamilyMembers();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [showMaker, setShowMaker] = useState(false);
  const [editing, setEditing] = useState<Movie | null>(null);
  const [drafts, setDrafts] = useState<MovieDraft[]>([]);
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Movie | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Whoever made a movie, or a parent, can edit/delete it — what's picked in the profile switcher
  // decides which buttons show; the server enforces it for real once passwords are set up (see
  // canManageMovie in server/src/routes/movies.ts).
  const noParentYet = members.every((m) => m.is_parent !== 1);
  const canManage = (m: Movie) => {
    if (activeProfile?.is_parent === 1) return true;
    if (m.created_by_id) return activeProfile?.id === m.created_by_id;
    return noParentYet;
  };
  const creatorName = (m: Pick<Movie, 'created_by_id'>) => members.find((x) => x.id === m.created_by_id)?.name ?? null;
  // Your own drafts (or nobody's); a parent sees everyone's.
  const visibleDrafts = drafts.filter(
    (d) => activeProfile?.is_parent === 1 || !d.created_by_id || d.created_by_id === activeProfile?.id
  );
  const draftForMovie = (movieId: string) => drafts.find((d) => d.movie_id === movieId);

  const openDraft = (d: MovieDraft) => {
    const movie = d.movie_id ? movies.find((m) => m.id === d.movie_id) : undefined;
    setResumeDraftId(d.id);
    setEditing(movie ?? null);
    if (!movie) setShowMaker(true);
  };
  const removeDraft = async (id: string) => {
    setActionError(null);
    try {
      await api.delete(`/movies/drafts/${id}`);
    } catch (err) {
      setActionError((err as Error).message);
    }
    load();
  };
  const closeMaker = () => {
    setShowMaker(false);
    setEditing(null);
    setResumeDraftId(null);
    // The closing form's last auto-save is sent on its way out — give it a moment to land.
    setTimeout(load, 500);
  };

  const load = () => {
    api.get<Movie[]>('/movies').then(setMovies).catch(console.error);
    api.get<MovieDraft[]>('/movies/drafts').then(setDrafts).catch(console.error);
  };
  useEffect(load, []);

  // Poll while anything's still rendering — ffmpeg on a Pi can take a couple minutes. Frequent
  // enough that the progress bar below visibly moves, not just "is it stuck or not" guessing.
  useEffect(() => {
    if (!movies.some((m) => m.status === 'rendering')) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [movies]);

  const remove = async (id: string) => {
    setActionError(null);
    try {
      await api.delete(`/movies/${id}`);
    } catch (err) {
      setActionError((err as Error).message);
    }
    load();
  };

  return (
    <section className="panel movie-maker__section">
      <div className="tasks-page__header">
        <button
          type="button"
          className="icon-button"
          aria-label="Make a movie"
          onClick={() => {
            setResumeDraftId(null);
            setShowMaker(true);
          }}
        >
          +
        </button>
        <h2>Movies</h2>
      </div>
      <p className="hint">
        Turn a set of photos into a video slideshow with music from the library — never touches
        the original photos or music files, just creates a new video saved on this server.
      </p>

      {actionError && <div className="settings-login__error">{actionError}</div>}
      {visibleDrafts.length > 0 && (
        <ul className="movie-maker__draft-list">
          {visibleDrafts.map((d) => {
            const movie = d.movie_id ? movies.find((m) => m.id === d.movie_id) : undefined;
            return (
              <li key={d.id}>
                <div className="movie-maker__movie-info">
                  <span className="movie-maker__movie-title">
                    📝 {movie ? `Unsaved changes to "${movie.title}"` : d.title || 'Untitled movie'}
                  </span>
                  <span className="hint">
                    Unfinished · {d.photo_count} photo{d.photo_count === 1 ? '' : 's'} picked · {d.track_count} song
                    {d.track_count === 1 ? '' : 's'} · saved {fmtSavedAt(d.updated_at)}
                    {creatorName(d) && ` · ${creatorName(d)}`}
                  </span>
                </div>
                <div className="task-form__row">
                  <button type="button" onClick={() => openDraft(d)} disabled={movie?.status === 'rendering'}>Continue</button>
                  <ConfirmButton
                    label="✕"
                    ariaLabel={`Discard draft ${d.title}`}
                    confirmLabel="Discard this draft?"
                    onConfirm={() => removeDraft(d.id)}
                    className="task-card__edit"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {movies.length === 0 && <div className="empty-state">No movies yet — make one above.</div>}
      {movies.length > 0 && (
        <ul className="movie-maker__movie-list">
          {movies.map((m) => (
            <li key={m.id}>
              <div className="movie-maker__movie-row">
                <div className="movie-maker__movie-info">
                  <span className="movie-maker__movie-title">{m.title}</span>
                  <span className="hint">
                    {m.photo_count} photo{m.photo_count === 1 ? '' : 's'}
                    {' · '}{fmtMovieLength(m)}
                    {m.music_tracks.length > 0
                      ? ` · ${m.music_tracks.length} song${m.music_tracks.length === 1 ? '' : 's'}`
                      : ''}
                    {creatorName(m) && ` · by ${creatorName(m)}`}
                    {m.status === 'failed' && ' · Failed'}
                  </span>
                </div>
                <div className="task-form__row">
                  {m.status === 'ready' && (
                    <button type="button" className="secondary" onClick={() => setPlaying(m)}>▶ Watch</button>
                  )}
                  {m.status === 'ready' && (
                    <a
                      className="movie-maker__download"
                      href={`/api/movies-media/${m.file_name}`}
                      download={movieDownloadName(m)}
                    >
                      ⬇ Download
                    </a>
                  )}
                  {canManage(m) && m.has_source && m.status !== 'rendering' && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        // Pick up any unsaved changes to this movie rather than starting a second set.
                        setResumeDraftId(draftForMovie(m.id)?.id ?? null);
                        setEditing(m);
                      }}
                    >
                      ✎ Edit
                    </button>
                  )}
                  {canManage(m) && (
                    <ConfirmButton
                      label="✕"
                      ariaLabel={`Delete ${m.title}`}
                      confirmLabel={`Delete "${m.title}"?`}
                      onConfirm={() => remove(m.id)}
                      className="task-card__edit"
                    />
                  )}
                </div>
              </div>
              {m.status === 'rendering' && (
                <div className="movie-maker__movie-progress">
                  <div className="progress-bar">
                    <div className="progress-bar__fill" style={{ width: `${m.progress_percent ?? 0}%` }} />
                  </div>
                  <span className="hint">Rendering… {Math.round(m.progress_percent ?? 0)}%</span>
                </div>
              )}
              {m.error && (m.status === 'failed' || m.status === 'ready') && <p className="hint">{m.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {(showMaker || editing) && (
        <MovieMakerModal
          editing={editing ?? undefined}
          draftId={resumeDraftId ?? undefined}
          onClose={closeMaker}
          onCreated={() => {
            setShowMaker(false);
            setEditing(null);
            setResumeDraftId(null);
            load();
          }}
        />
      )}

      {playing && (
        <div className="modal-overlay" onClick={() => setPlaying(null)}>
          <div className="modal-panel movie-maker__player" onClick={(e) => e.stopPropagation()}>
            <h2>{playing.title}</h2>
            <video className="movie-maker__video" src={`/api/movies-media/${playing.file_name}`} controls autoPlay />
            <button type="button" className="secondary" onClick={() => setPlaying(null)}>Close</button>
          </div>
        </div>
      )}
    </section>
  );
}

const PAGE_SIZE = 120;

export function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [slideshowOn, setSlideshowOn] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = () => {
    setLoading(true);
    api.get<Photo[]>('/photos').then(setPhotos).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);
  // Reset paging whenever the underlying photo list changes size (refresh, new photos added) so
  // stale indexes from a previous library size don't leave the grid showing fewer than PAGE_SIZE.
  useEffect(() => setVisibleCount(PAGE_SIZE), [photos.length]);

  if (slideshowOn) {
    return <Slideshow intervalSeconds={12} onExit={() => setSlideshowOn(false)} />;
  }

  return (
    <div className="photos-page">
      <div className="photos-page__toolbar">
        <h1>Photos</h1>
        <div className="task-form__row">
          <button className="secondary" onClick={load}>Refresh</button>
          <button onClick={() => setSlideshowOn(true)} disabled={photos.length === 0}>▶ Start slideshow</button>
        </div>
      </div>

      <MoviesSection />

      {loading && <div className="empty-state">Loading photos…</div>}
      {!loading && photos.length === 0 && (
        <div className="empty-state">
          No photos found yet — add some to PHOTOS_DIR (a local folder or SMB share, see
          docs/PHOTOS_SETUP.md) and tap Refresh.
        </div>
      )}

      <div className="photos-page__grid">
        {photos.slice(0, visibleCount).map((p, i) => (
          <button key={p.id} className="photos-page__thumb" onClick={() => setViewingIndex(i)}>
            <img src={`/api/photos/${p.id}/image`} alt="" loading="lazy" />
          </button>
        ))}
      </div>

      {visibleCount < photos.length && (
        <button className="secondary" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
          Show more ({photos.length - visibleCount} left)
        </button>
      )}

      {viewingIndex !== null && (
        <div className="photo-lightbox" onClick={() => setViewingIndex(null)}>
          <img src={`/api/photos/${photos[viewingIndex].id}/image`} alt="" />
          <button
            className="photo-lightbox__close"
            onClick={(e) => { e.stopPropagation(); setViewingIndex(null); }}
          >
            ✕
          </button>
          <button
            className="photo-lightbox__nav photo-lightbox__nav--prev"
            onClick={(e) => { e.stopPropagation(); setViewingIndex((viewingIndex - 1 + photos.length) % photos.length); }}
          >
            ‹
          </button>
          <button
            className="photo-lightbox__nav photo-lightbox__nav--next"
            onClick={(e) => { e.stopPropagation(); setViewingIndex((viewingIndex + 1) % photos.length); }}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
