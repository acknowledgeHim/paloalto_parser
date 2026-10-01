import { useEffect, useState } from 'react';
import { api, type Movie, type Photo } from '../api/client.js';
import { Slideshow } from '../components/Slideshow.js';
import { MovieMakerModal } from '../components/MovieMakerModal.js';
import { ConfirmButton } from '../components/ConfirmButton.js';

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

function MoviesSection({ photos }: { photos: Photo[] }) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [showMaker, setShowMaker] = useState(false);
  const [playing, setPlaying] = useState<Movie | null>(null);

  const load = () => {
    api.get<Movie[]>('/movies').then(setMovies).catch(console.error);
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
    await api.delete(`/movies/${id}`);
    load();
  };

  return (
    <section className="panel movie-maker__section">
      <div className="tasks-page__header">
        <button type="button" className="icon-button" aria-label="Make a movie" onClick={() => setShowMaker(true)}>+</button>
        <h2>Movies</h2>
      </div>
      <p className="hint">
        Turn a set of photos into a video slideshow with music from the library — never touches
        the original photos or music files, just creates a new video saved on this server.
      </p>

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
                  <ConfirmButton
                    label="✕"
                    ariaLabel={`Delete ${m.title}`}
                    confirmLabel={`Delete "${m.title}"?`}
                    onConfirm={() => remove(m.id)}
                    className="task-card__edit"
                  />
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
              {m.status === 'failed' && m.error && <p className="hint">{m.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {showMaker && (
        <MovieMakerModal
          photos={photos}
          onClose={() => setShowMaker(false)}
          onCreated={() => {
            setShowMaker(false);
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

      <MoviesSection photos={photos} />

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
