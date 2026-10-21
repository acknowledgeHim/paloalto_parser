import { useEffect, useRef, useState } from 'react';
import { api, type Movie, type Photo, type PhotoDetail, type ScreensaverMovie } from '../api/client.js';
import { Slideshow } from '../components/Slideshow.js';
import { MovieMakerModal } from '../components/MovieMakerModal.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { DocumentEditorModal } from '../components/DocumentEditorModal.js';
import { AnimateMakerModal, AnimateSection } from '../components/AnimateSection.js';
import { fmtMadeOn, OwnedListControls, sortOwned, type OwnedSort } from '../components/OwnedListControls.js';
import { AlbumChecklist, FAVORITES_ID, useAlbums } from '../components/PhotoAlbums.js';
import { useSectionAccess } from '../state/SectionAccess.js';
import { Link, useSearchParams } from 'react-router-dom';
import { PhotoFaces } from '../components/PhotoFaces.js';
import type { Person } from '../api/client.js';
import { MemberAvatar, avatarChanged } from '../components/MemberAvatar.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { PhotoPlaceInfo } from '../components/PhotoPlaceInfo.js';
import { PhotoMap } from '../components/PhotoMap.js';

type PhotoTab = 'photos' | 'map' | 'movies' | 'documents' | 'animate';
/** The page's tabs; `access` = the Settings → Kids' access switch that shows it. */
const PHOTO_TABS: Array<{ id: PhotoTab; label: string; access: 'movies' | 'documents' }> = [
  { id: 'photos', label: '📷 Photos', access: 'movies' },
  { id: 'map', label: '🗺️ Map', access: 'movies' },
  { id: 'movies', label: '🎬 Movies', access: 'movies' },
  { id: 'animate', label: '✨ Animate', access: 'movies' },
  { id: 'documents', label: '📄 Documents', access: 'documents' },
];

/** The Person filter's "Nobody" choice (not a person id). */
const NOBODY = 'nobody';

/** Mirrors server/src/services/movieRender.ts — a movie with music runs 4s past its last photo. */
function movieLengthSeconds(m: Movie): number {
  return Math.round((m.style?.title_card ? 4 : 0) + m.photo_count * m.seconds_per_photo + (m.music_tracks.length > 0 ? 4 : 0));
}
function fmtMovieLength(m: Movie): string {
  const total = movieLengthSeconds(m);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** "Crossfade · Pan & zoom · Title card" — just the options that are on. */
function fmtMovieStyle(m: Movie): string {
  const parts: string[] = [];
  if (m.style?.transition === 'crossfade') parts.push('Crossfade');
  if (m.style?.motion === 'kenburns') parts.push('Pan & zoom');
  if (m.style?.title_card) parts.push('Title card');
  return parts.join(' · ');
}

function fmtUntil(iso: string | null): string {
  if (!iso) return 'until turned off';
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? 'through tonight'
    : `through ${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;
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

/**
 * Whoever made something (a movie, a document), or a parent, can edit/delete it — what's picked in
 * the profile switcher decides which buttons show; the server enforces it for real once passwords
 * are set up (canManageOwnedItem in server/src/services/auth.ts).
 */
function useCanManageOwned(): (item: { created_by_id: string | null }) => boolean {
  const { members, activeProfile } = useFamilyMembers();
  const noParentYet = members.every((m) => m.is_parent !== 1);
  return (item) => {
    if (activeProfile?.is_parent === 1) return true;
    if (item.created_by_id) return activeProfile?.id === item.created_by_id;
    return noParentYet;
  };
}

/** GET /photo-documents */
interface PhotoDocumentSummary {
  id: string;
  title: string;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  section_count: number;
  photo_count: number;
}

function DocumentsSection() {
  const { members } = useFamilyMembers();
  const canManage = useCanManageOwned();
  const [docs, setDocs] = useState<PhotoDocumentSummary[]>([]);
  const [sort, setSort] = useState<OwnedSort>('newest');
  const [owner, setOwner] = useState('');
  const docGroups = sortOwned(docs, { sort, owner, members, length: (d) => d.photo_count });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    api.get<PhotoDocumentSummary[]>('/photo-documents').then(setDocs).catch(console.error);
  };
  useEffect(load, []);

  const remove = async (id: string) => {
    setActionError(null);
    try {
      await api.delete(`/photo-documents/${id}`);
    } catch (err) {
      setActionError((err as Error).message);
    }
    load();
  };

  const creatorName = (d: PhotoDocumentSummary) => members.find((m) => m.id === d.created_by_id)?.name ?? null;

  // Downloads go through fetch rather than a plain link: building (and for PDF, converting) takes a
  // few seconds, so this shows "Preparing…", and a failure (e.g. no LibreOffice for PDF) shows as a
  // message here instead of the browser navigating to an error page.
  const [preparing, setPreparing] = useState<string | null>(null); // `${id}:${format}`
  const download = async (d: PhotoDocumentSummary, format: 'docx' | 'pdf') => {
    setActionError(null);
    setPreparing(`${d.id}:${format}`);
    try {
      const resp = await fetch(`/api/photo-documents/${d.id}/download${format === 'pdf' ? '?format=pdf' : ''}`);
      if (!resp.ok) throw new Error((await resp.text()) || `Download failed (${resp.status})`);
      const url = URL.createObjectURL(await resp.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${d.title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'document'}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setPreparing(null);
    }
  };
  const close = () => {
    setCreating(false);
    setEditingId(null);
  };

  return (
    <section className="panel movie-maker__section">
      <div className="tasks-page__header">
        <button type="button" className="icon-button" aria-label="Make a document" onClick={() => setCreating(true)}>+</button>
        <h2>Documents</h2>
      </div>
      <p className="hint">
        Put pictures into a Word document — give it a title, group pictures into sections with your
        own writing and captions, then download it. Never touches the original photos.
      </p>
      {actionError && <div className="settings-login__error">{actionError}</div>}
      {docs.length === 0 && <div className="empty-state">No documents yet — make one above.</div>}
      {docs.length > 0 && (
        <OwnedListControls
          sort={sort}
          onSort={setSort}
          owner={owner}
          onOwner={setOwner}
          members={members}
          lengthLabel={['Most pictures', 'Fewest pictures']}
          count={docGroups.reduce((n, g) => n + g.items.length, 0)}
          noun="document"
        />
      )}
      {docGroups.map((g) => (
        <div key={g.label ?? 'all'} className="owned-group">
          {g.label && <h3 className="owned-group__label">{g.label} <span className="hint">({g.items.length})</span></h3>}
        <ul className="movie-maker__movie-list">
          {g.items.map((d) => (
            <li key={d.id}>
              <div className="movie-maker__movie-row">
                <div className="movie-maker__movie-info">
                  <span className="movie-maker__movie-title">📄 {d.title}</span>
                  <span className="owned-meta">
                    <span>🖼️ {d.photo_count} picture{d.photo_count === 1 ? '' : 's'}</span>
                    <span>📑 {d.section_count} section{d.section_count === 1 ? '' : 's'}</span>
                    <span>📅 {fmtMadeOn(d.created_at)}</span>
                    {d.updated_at.slice(0, 10) !== d.created_at.slice(0, 10) && <span>✎ {fmtMadeOn(d.updated_at)}</span>}
                    <span>👤 {creatorName(d) ?? 'Nobody in particular'}</span>
                  </span>
                </div>
                <div className="task-form__row">
                  <button type="button" className="secondary" disabled={preparing !== null} onClick={() => download(d, 'docx')}>
                    {preparing === `${d.id}:docx` ? 'Preparing…' : '⬇ Word'}
                  </button>
                  <button type="button" className="secondary" disabled={preparing !== null} onClick={() => download(d, 'pdf')}>
                    {preparing === `${d.id}:pdf` ? 'Preparing…' : '⬇ PDF'}
                  </button>
                  {canManage(d) && (
                    <button type="button" className="secondary" onClick={() => setEditingId(d.id)}>✎ Edit</button>
                  )}
                  {canManage(d) && (
                    <ConfirmButton
                      label="✕"
                      ariaLabel={`Delete ${d.title}`}
                      confirmLabel={`Delete "${d.title}"?`}
                      onConfirm={() => remove(d.id)}
                      className="task-card__edit"
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        </div>
      ))}
      {(creating || editingId) && (
        <DocumentEditorModal
          documentId={editingId ?? undefined}
          onClose={close}
          onSaved={() => {
            close();
            load();
          }}
        />
      )}
    </section>
  );
}

function MoviesSection() {
  const { members, activeProfile } = useFamilyMembers();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [sort, setSort] = useState<OwnedSort>('newest');
  const [owner, setOwner] = useState('');
  const [showMaker, setShowMaker] = useState(false);
  const [editing, setEditing] = useState<Movie | null>(null);
  const [drafts, setDrafts] = useState<MovieDraft[]>([]);
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Movie | null>(null);
  const [screensaver, setScreensaver] = useState<ScreensaverMovie | null>(null);
  const [screensaverMenu, setScreensaverMenu] = useState<string | null>(null); // movie id
  const [screensaverSound, setScreensaverSound] = useState(false);
  const [changingOwner, setChangingOwner] = useState<string | null>(null); // movie id
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = useCanManageOwned();
  const creatorName = (m: Pick<Movie, 'created_by_id'>) => members.find((x) => x.id === m.created_by_id)?.name ?? null;
  const movieGroups = sortOwned(movies, { sort, owner, members, length: movieLengthSeconds });
  // Your own drafts (or nobody's); a parent sees everyone's.
  const visibleDrafts = drafts.filter(
    (d) => activeProfile?.is_parent === 1 || !d.created_by_id || d.created_by_id === activeProfile?.id
  );

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
  // Putting a movie on the screensaver is a parent-only call (the server enforces it via the same
  // gate as Settings); with no parent set up yet, anyone can, like the rest of the app.
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const setOnScreensaver = async (movieId: string, days: 1 | 7 | null) => {
    setActionError(null);
    try {
      await api.put('/movies/screensaver', { movie_id: movieId, days, sound: screensaverSound });
      setScreensaverMenu(null);
    } catch (err) {
      setActionError((err as Error).message);
    }
    load();
  };
  const changeOwner = async (movieId: string, ownerId: string) => {
    setActionError(null);
    try {
      await api.patch(`/movies/${movieId}/owner`, { created_by_id: ownerId || null });
      setChangingOwner(null);
    } catch (err) {
      setActionError((err as Error).message);
    }
    load();
  };

  const stopScreensaver = async () => {
    setActionError(null);
    try {
      await api.delete('/movies/screensaver');
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
    // Living photos have their own tab (✨ Animate).
    api.get<Movie[]>('/movies').then((all) => setMovies(all.filter((m) => !m.living))).catch(console.error);
    api.get<MovieDraft[]>('/movies/drafts').then(setDrafts).catch(console.error);
    api.get<ScreensaverMovie | null>('/movies/screensaver').then(setScreensaver).catch(() => setScreensaver(null));
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
        <OwnedListControls
          sort={sort}
          onSort={setSort}
          owner={owner}
          onOwner={setOwner}
          members={members}
          lengthLabel={['Longest', 'Shortest']}
          count={movieGroups.reduce((n, g) => n + g.items.length, 0)}
          noun="movie"
        />
      )}
      {movieGroups.map((g) => (
        <div key={g.label ?? 'all'} className="owned-group">
          {g.label && <h3 className="owned-group__label">{g.label} <span className="hint">({g.items.length})</span></h3>}
        <ul className="movie-maker__movie-list">
          {g.items.map((m) => (
            <li key={m.id}>
              <div className="movie-maker__movie-row">
                <div className="movie-maker__movie-info">
                  <span className="movie-maker__movie-title">🎬 {m.title}</span>
                  <span className="owned-meta">
                    <span>⏱️ {fmtMovieLength(m)}</span>
                    <span>📅 {fmtMadeOn(m.created_at)}</span>
                    <span>👤 {creatorName(m) ?? 'Nobody in particular'}</span>
                    <span>📷 {m.photo_count} photo{m.photo_count === 1 ? '' : 's'}</span>
                    {m.music_tracks.length > 0 && <span>🎵 {m.music_tracks.length} song{m.music_tracks.length === 1 ? '' : 's'}</span>}
                    {m.status === 'failed' && <span className="internet-page__bad">Failed</span>}
                  </span>
                  {fmtMovieStyle(m) && <span className="hint">{fmtMovieStyle(m)}</span>}
                  {screensaver?.movie_id === m.id && (
                    <span className="movie-maker__screensaver-badge">
                      📺 On the screensaver {fmtUntil(screensaver.until)}{screensaver.sound ? ' (with sound)' : ''}
                      {isParent && (
                        <button type="button" className="link-button" onClick={stopScreensaver}>Stop</button>
                      )}
                    </span>
                  )}
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
                  {isParent && (
                    <button type="button" className="secondary" onClick={() => setChangingOwner(changingOwner === m.id ? null : m.id)}>
                      👤 Owner
                    </button>
                  )}
                  {isParent && m.status === 'ready' && screensaver?.movie_id !== m.id && (
                    <button type="button" className="secondary" onClick={() => setScreensaverMenu(screensaverMenu === m.id ? null : m.id)}>
                      📺 Screensaver
                    </button>
                  )}
                  {canManage(m) && m.has_source && m.status !== 'rendering' && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        // Edits don't auto-save (any older draft of edits stays listed above to continue).
                        setResumeDraftId(null);
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
              {changingOwner === m.id && (
                <div className="movie-maker__screensaver-menu">
                  <label className="member-form__label member-form__label--inline">
                    Belongs to
                    <select defaultValue={m.created_by_id ?? ''} onChange={(e) => changeOwner(m.id, e.target.value)}>
                      <option value="">Nobody in particular (parents only)</option>
                      {members.map((x) => (
                        <option key={x.id} value={x.id}>{x.name}</option>
                      ))}
                    </select>
                  </label>
                  <span className="hint">They'll be able to edit and delete it; parents always can.</span>
                  <button type="button" className="secondary" onClick={() => setChangingOwner(null)}>Done</button>
                </div>
              )}
              {screensaverMenu === m.id && (
                <div className="movie-maker__screensaver-menu">
                  <span>Play "{m.title}" as the screensaver:</span>
                  <button type="button" onClick={() => setOnScreensaver(m.id, 1)}>Today</button>
                  <button type="button" onClick={() => setOnScreensaver(m.id, 7)}>For a week</button>
                  <button type="button" onClick={() => setOnScreensaver(m.id, null)}>Until I turn it off</button>
                  <label className="movie-maker__check">
                    <input type="checkbox" checked={screensaverSound} onChange={(e) => setScreensaverSound(e.target.checked)} />
                    With sound
                  </label>
                  <button type="button" className="secondary" onClick={() => setScreensaverMenu(null)}>Cancel</button>
                </div>
              )}
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
        </div>
      ))}

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
  const { members, activeProfile, refresh: refreshMembers } = useFamilyMembers();
  const { canSee } = useSectionAccess();
  const canManage = useCanManageOwned();
  const albumsApi = useAlbums();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  // The photo open in the viewer, by id (not position): filing it into an album or hiding it can
  // take it out of the filtered list, and it should stay put until you move on. viewPos remembers
  // where it was, so › goes to whatever slid into its place.
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewPos = useRef(0);
  const [slideshowOn, setSlideshowOn] = useState(false);
  // The ✨ button on a photo in the viewer: make a living photo from it.
  const [animating, setAnimating] = useState<string | null>(null);
  // The 🙂 button on a photo in the viewer: make it the avatar of whoever's using the screen.
  const [avatarPanel, setAvatarPanel] = useState<null | 'ask' | 'saving' | { done: string } | { error: string }>(null);
  useEffect(() => setAvatarPanel(null), [viewingId]);
  // Dates/paths for sorting — loaded after the (quicker) plain photo list.
  const [details, setDetails] = useState<Map<string, PhotoDetail> | null>(null);
  const [detailsFailed, setDetailsFailed] = useState(false);
  const [sortBy, setSortBy] = useState<'library' | 'date-desc' | 'date-asc' | 'name' | 'country' | 'state'>('library');
  // 📍 Where: '' = anywhere, 'none' = no location, 'c:<country>' or 's:<US state>'.
  const [where, setWhere] = useState('');
  const [albumStatus, setAlbumStatus] = useState<'all' | 'none' | 'some'>('all');
  const [showHidden, setShowHidden] = useState(false);
  // People (face recognition): the filter can come from the People page's "See their photos" link.
  const [searchParams, setSearchParams] = useSearchParams();
  // Photos · Movies · Documents · Animate — in the address (?tab=) so Back and links keep it.
  // 🗺️ Map is part of Photos itself (anyone who sees Photos sees it).
  const tabs = PHOTO_TABS.filter((t) => t.id === 'photos' || t.id === 'map' || canSee(t.access));
  const tab = tabs.find((t) => t.id === searchParams.get('tab'))?.id ?? 'photos';
  const setTab = (id: PhotoTab) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'photos') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next);
  };
  const personFilter = searchParams.get('person') ?? '';
  const [people, setPeople] = useState<Person[]>([]);
  const [personPhotoIds, setPersonPhotoIds] = useState<Set<string> | null>(null);
  const [personFailed, setPersonFailed] = useState(false);
  const loadPeople = () => api.get<Person[]>('/faces/people').then(setPeople).catch(() => setPeople([]));
  useEffect(() => {
    loadPeople();
  }, []);
  useEffect(() => {
    setPersonPhotoIds(null);
    setPersonFailed(false);
    if (!personFilter) return;
    // 'nobody' = photos with no one named or tagged in them yet.
    const url = personFilter === NOBODY ? '/faces/nobody-photos' : `/faces/people/${personFilter}/photos`;
    let stale = false;
    api
      .get<string[]>(url)
      .then((ids) => !stale && setPersonPhotoIds(new Set(ids)))
      .catch(() => !stale && setPersonFailed(true));
    return () => {
      stale = true;
    };
  }, [personFilter, people]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // '' = all photos; otherwise an album id.
  const [albumFilter, setAlbumFilter] = useState('');
  const [albumPhotoIds, setAlbumPhotoIds] = useState<string[]>([]);
  const [excludeBlurry, setExcludeBlurry] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [albumPanel, setAlbumPanel] = useState<'viewer' | 'selection' | null>(null);
  const [newAlbumName, setNewAlbumName] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [albumError, setAlbumError] = useState<string | null>(null);

  // Dates/filenames for sorting — can take a while on a big library the first time (the server reads
  // each photo's date once), so the sort can be picked straight away and applies when they arrive.
  const loadDetails = () => {
    setDetailsFailed(false);
    api
      .get<PhotoDetail[]>('/photos/details')
      .then((d) => setDetails(new Map(d.map((p) => [p.id, p]))))
      .catch(() => setDetailsFailed(true));
  };
  const load = () => {
    setLoading(true);
    api.get<Photo[]>('/photos').then(setPhotos).catch(console.error).finally(() => setLoading(false));
    loadDetails();
    albumsApi.reload();
  };

  useEffect(load, []);

  useEffect(() => {
    if (!albumFilter) return;
    api.get<string[]>(`/albums/${albumFilter}/photos`).then(setAlbumPhotoIds).catch(() => setAlbumPhotoIds([]));
    // Album contents change as photos are added/removed — memberships is the signal.
  }, [albumFilter, albumsApi.memberships]);

  const inAnyAlbum = (id: string) => (albumsApi.memberships[id] ?? []).length > 0;
  const visible = (() => {
    let list = photos;
    if (albumFilter) {
      const byId = new Map(photos.map((p) => [p.id, p]));
      list = albumPhotoIds.map((id) => byId.get(id)).filter((p): p is Photo => Boolean(p));
    }
    if (!showHidden) list = list.filter((p) => !p.hidden);
    if (personFilter) list = personPhotoIds ? list.filter((p) => personPhotoIds.has(p.id)) : [];
    if (excludeBlurry) list = list.filter((p) => !p.blurry);
    if (albumStatus === 'none') list = list.filter((p) => !inAnyAlbum(p.id));
    if (albumStatus === 'some') list = list.filter((p) => inAnyAlbum(p.id));
    if (where) {
      // Needs the details (where each photo was taken) — nothing shows until they're in.
      const d = (p: Photo) => details?.get(p.id);
      list = !details
        ? []
        : where === 'none'
          ? list.filter((p) => !d(p)?.country)
          : where.startsWith('s:')
            ? list.filter((p) => d(p)?.state === where.slice(2))
            : list.filter((p) => d(p)?.country === where.slice(2));
    }
    if (sortBy !== 'library' && details) {
      const d = (p: Photo) => details.get(p.id);
      const byDate = (a: Photo, b: Photo) => (d(b)?.taken_at ?? '').localeCompare(d(a)?.taken_at ?? '');
      list = [...list].sort((a, b) => {
        if (sortBy === 'name') return (d(a)?.path ?? '').localeCompare(d(b)?.path ?? '', undefined, { numeric: true, sensitivity: 'base' });
        if (sortBy === 'country' || sortBy === 'state') {
          // A–Z by country (then state), photos with no location last; newest first within a place.
          const key = (p: Photo) => {
            const x = d(p);
            if (!x?.country) return '\uffff';
            return sortBy === 'state' ? `${x.state ?? '\uffee'}|${x.country}` : `${x.country}|${x.state ?? ''}`;
          };
          return key(a).localeCompare(key(b)) || byDate(a, b);
        }
        const cmp = (d(a)?.taken_at ?? '').localeCompare(d(b)?.taken_at ?? '');
        return sortBy === 'date-asc' ? cmp : -cmp;
      });
    }
    return list;
  })();

  const hide = async (ids: string[], hidden: boolean) => {
    setPhotos((cur) => cur.map((p) => (ids.includes(p.id) ? { ...p, hidden } : p)));
    await api.post('/photos/hidden', hidden ? { add: ids } : { remove: ids });
  };

  // Reset paging whenever what's shown changes size (refresh, new photos, another album) so stale
  // indexes don't leave the grid showing fewer than PAGE_SIZE.
  useEffect(() => setVisibleCount(PAGE_SIZE), [albumFilter, albumStatus, sortBy, showHidden, excludeBlurry, personFilter, where]);

  // 📍 The places the photos were taken, with how many — for the Where filter.
  const placeCounts = (() => {
    if (!details) return null;
    const countries = new Map<string, number>();
    const states = new Map<string, number>();
    let none = 0;
    for (const p of photos) {
      if (p.hidden && !showHidden) continue;
      const x = details.get(p.id);
      if (!x?.country) {
        none++;
        continue;
      }
      countries.set(x.country, (countries.get(x.country) ?? 0) + 1);
      if (x.state) states.set(x.state, (states.get(x.state) ?? 0) + 1);
    }
    const az = (m: Map<string, number>) => [...m].sort((a, b) => a[0].localeCompare(b[0]));
    return { countries: az(countries), states: az(states), none };
  })();
  const showWhere = (w: { country: string | null; state: string | null }) => {
    setWhere(w.state ? `s:${w.state}` : w.country ? `c:${w.country}` : '');
    setTab('photos');
  };

  const activeAlbum = albumsApi.albums.find((a) => a.id === albumFilter);
  const viewing = viewingId ? photos.find((p) => p.id === viewingId) : undefined;
  const viewingIndexNow = viewing ? visible.findIndex((p) => p.id === viewing.id) : -1;
  if (viewingIndexNow >= 0) viewPos.current = viewingIndexNow;
  /** ‹ / ›: from the photo's spot in the list — or, if it just left the list (filed or hidden),
   *  from where it was, so › lands on the photo that took its place. */
  const step = (delta: number) => {
    if (visible.length === 0) return setViewingId(null);
    const from = viewingIndexNow >= 0 ? viewingIndexNow : viewPos.current - (delta > 0 ? 1 : 0);
    const next = (((from + delta) % visible.length) + visible.length) % visible.length;
    viewPos.current = next;
    setViewingId(visible[next].id);
  };
  const closeViewer = () => {
    setViewingId(null);
    setAlbumPanel(null);
  };

  const toggleSelected = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    setAlbumPanel(null);
  };

  const albumAction = async (fn: () => Promise<unknown>) => {
    setAlbumError(null);
    try {
      await fn();
    } catch (err) {
      setAlbumError((err as Error).message);
    }
  };

  if (slideshowOn) {
    return <Slideshow intervalSeconds={12} onExit={() => setSlideshowOn(false)} />;
  }

  return (
    <div className="photos-page">
      <div className="photos-page__toolbar">
        <h1>Photos</h1>
        {tab === 'photos' && (
          <div className="task-form__row">
            <Link to="/photos/people" className="movie-maker__download">👥 People</Link>
            <button className="secondary" onClick={load}>Refresh</button>
            <button onClick={() => setSlideshowOn(true)} disabled={photos.length === 0}>▶ Start slideshow</button>
          </div>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="photos-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`photos-tabs__tab photos-tabs__tab--${t.id} ${tab === t.id ? 'photos-tabs__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Movies and Documents each have their own switch in Settings → Kids' access. */}
      {tab === 'map' && (
        <PhotoMap
          onOpen={(id) => setViewingId(id)}
          onShowPlace={showWhere}
          noPlaceCount={placeCounts?.none ?? null}
          onShowNoPlace={() => {
            setWhere('none');
            setTab('photos');
          }}
        />
      )}
      {tab === 'movies' && <MoviesSection />}
      {tab === 'documents' && <DocumentsSection />}
      {tab === 'animate' && <AnimateSection />}

      {tab === 'photos' && (
      <>

      {/* Albums — kept only in the app's database; the photos themselves never move. */}
      <div className="photo-albums-bar">
        <button type="button" className={albumFilter === '' ? '' : 'secondary'} onClick={() => setAlbumFilter('')}>
          All photos ({photos.length})
        </button>
        {albumsApi.albums.map((a) => (
          <button key={a.id} type="button" className={albumFilter === a.id ? '' : 'secondary'} onClick={() => setAlbumFilter(a.id)}>
            {a.is_favorites ? '⭐ ' : '📁 '}
            {a.name} ({a.count})
          </button>
        ))}
        {newAlbumName === null ? (
          <button type="button" className="secondary" onClick={() => setNewAlbumName('')}>＋ New album</button>
        ) : (
          <form
            className="photo-albums-bar__new"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newAlbumName.trim()) return;
              albumAction(async () => {
                const album = await albumsApi.create(newAlbumName.trim());
                setNewAlbumName(null);
                setAlbumFilter(album.id);
              });
            }}
          >
            <input autoFocus placeholder="Album name" value={newAlbumName} onChange={(e) => setNewAlbumName(e.target.value)} />
            <button type="submit" disabled={!newAlbumName.trim()}>Create</button>
            <button type="button" className="secondary" onClick={() => setNewAlbumName(null)}>Cancel</button>
          </form>
        )}
      </div>
      {activeAlbum && !activeAlbum.is_favorites && canManage(activeAlbum) && (
        <div className="photo-albums-bar photo-albums-bar__manage">
          {renaming === null ? (
            <button type="button" className="link-button" onClick={() => setRenaming(activeAlbum.name)}>Rename album</button>
          ) : (
            <form
              className="photo-albums-bar__new"
              onSubmit={(e) => {
                e.preventDefault();
                albumAction(async () => {
                  await api.patch(`/albums/${activeAlbum.id}`, { name: renaming });
                  setRenaming(null);
                  await albumsApi.reload();
                });
              }}
            >
              <input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} />
              <button type="submit" disabled={!renaming.trim()}>Save</button>
              <button type="button" className="secondary" onClick={() => setRenaming(null)}>Cancel</button>
            </form>
          )}
          <ConfirmButton
            label="Delete album"
            confirmLabel={`Delete the "${activeAlbum.name}" album? (The photos stay.)`}
            onConfirm={() =>
              albumAction(async () => {
                await api.delete(`/albums/${activeAlbum.id}`);
                setAlbumFilter('');
                await albumsApi.reload();
              })
            }
          />
          {activeAlbum.created_by_id && (
            <span className="hint">Made by {members.find((m) => m.id === activeAlbum.created_by_id)?.name ?? 'someone'}</span>
          )}
        </div>
      )}
      {albumError && <div className="settings-login__error">{albumError}</div>}

      <div className="photos-page__grid-tools">
        <label className="member-form__label member-form__label--inline">
          Sort
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="library">Library order</option>
            <option value="date-desc">Date taken (newest first)</option>
            <option value="date-asc">Date taken (oldest first)</option>
            <option value="name">Folder / filename</option>
            <option value="country">📍 Country (A–Z)</option>
            <option value="state">📍 State (A–Z)</option>
          </select>
        </label>
        <label className="member-form__label member-form__label--inline">
          📍 Where
          <select value={where} onChange={(e) => setWhere(e.target.value)}>
            <option value="">Anywhere</option>
            <option value="none">No location set{placeCounts ? ` (${placeCounts.none})` : ''}</option>
            {placeCounts && placeCounts.countries.length > 0 && (
              <optgroup label="Country">
                {placeCounts.countries.map(([c, n]) => (
                  <option key={c} value={`c:${c}`}>
                    {c} ({n})
                  </option>
                ))}
              </optgroup>
            )}
            {placeCounts && placeCounts.states.length > 0 && (
              <optgroup label="US state">
                {placeCounts.states.map(([st, n]) => (
                  <option key={st} value={`s:${st}`}>
                    {st} ({n})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        {where && !details && <span className="hint">Reading where photos were taken…</span>}
        {sortBy !== 'library' && !details && !detailsFailed && <span className="hint">Reading photo dates… sorts as soon as they're in.</span>}
        {sortBy !== 'library' && detailsFailed && (
          <span className="hint">
            Couldn't read photo dates. <button type="button" className="link-button" onClick={loadDetails}>Try again</button>
          </span>
        )}
        <label className="member-form__label member-form__label--inline">
          Albums
          <select value={albumStatus} onChange={(e) => setAlbumStatus(e.target.value as typeof albumStatus)}>
            <option value="all">All photos</option>
            <option value="none">Not in any album</option>
            <option value="some">In an album</option>
          </select>
        </label>
        {people.length > 0 && (
          <label className="member-form__label member-form__label--inline">
            Person
            <select
              value={personFilter}
              onChange={(e) => setSearchParams(e.target.value ? { person: e.target.value } : {})}
            >
              <option value="">Anyone</option>
              <option value={NOBODY}>Nobody (no one named or tagged)</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.photo_count})</option>
              ))}
            </select>
          </label>
        )}
        <label className="member-form__label member-form__label--inline photos-page__check">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Show hidden photos ({photos.filter((p) => p.hidden).length})
        </label>
        <label className="member-form__label member-form__label--inline">
          Blurry photos
          <select value={excludeBlurry ? 'exclude' : 'include'} onChange={(e) => setExcludeBlurry(e.target.value === 'exclude')}>
            <option value="include">Include</option>
            <option value="exclude">Exclude</option>
          </select>
        </label>
        {!selecting ? (
          <button type="button" className="secondary" onClick={() => setSelecting(true)} disabled={visible.length === 0}>
            ☑ Select photos
          </button>
        ) : (
          <div className="photos-page__selection">
            <strong>{selected.size} selected</strong>
            <button type="button" className="secondary" onClick={() => setSelected(new Set(visible.map((p) => p.id)))}>Select all</button>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => albumAction(() => albumsApi.add(FAVORITES_ID, [...selected]))}
            >
              ⭐ Favorite
            </button>
            <button type="button" className="secondary" disabled={selected.size === 0} onClick={() => setAlbumPanel(albumPanel === 'selection' ? null : 'selection')}>
              📁 Albums…
            </button>
            <button
              type="button"
              className="secondary"
              disabled={selected.size === 0}
              onClick={() => albumAction(async () => {
                await hide([...selected], true);
                setSelected(new Set());
              })}
            >
              🙈 Hide
            </button>
            {showHidden && (
              <button
                type="button"
                className="secondary"
                disabled={selected.size === 0}
                onClick={() => albumAction(async () => {
                  await hide([...selected], false);
                  setSelected(new Set());
                })}
              >
                👁 Unhide
              </button>
            )}
            {activeAlbum && (
              <button
                type="button"
                className="secondary"
                disabled={selected.size === 0}
                onClick={() => albumAction(async () => {
                  await albumsApi.remove(activeAlbum.id, [...selected]);
                  setSelected(new Set());
                })}
              >
                Remove from {activeAlbum.is_favorites ? 'Favorites' : `"${activeAlbum.name}"`}
              </button>
            )}
            <button type="button" className="secondary" onClick={stopSelecting}>Done</button>
          </div>
        )}
      </div>
      {selecting && albumPanel === 'selection' && selected.size > 0 && (
        <AlbumChecklist albumsApi={albumsApi} photoIds={[...selected]} onDone={() => setAlbumPanel(null)} />
      )}

      {loading && <div className="empty-state">Loading photos…</div>}
      {!loading && photos.length === 0 && (
        <div className="empty-state">
          No photos found yet — add some to PHOTOS_DIR (a local folder or SMB share, see
          docs/PHOTOS_SETUP.md) and tap Refresh.
        </div>
      )}
      {!loading && photos.length > 0 && personFilter && personFailed && (
        <div className="empty-state">
          Couldn't load that Person filter — the server may need restarting after an update.{' '}
          <button type="button" className="link-button" onClick={() => setPeople((cur) => [...cur])}>
            Try again
          </button>
        </div>
      )}
      {!loading && photos.length > 0 && personFilter && !personFailed && !personPhotoIds && (
        <div className="empty-state">Finding those photos…</div>
      )}
      {!loading && photos.length > 0 && visible.length === 0 && !(personFilter && (personFailed || !personPhotoIds)) && (
        <div className="empty-state">{albumFilter ? 'No photos in this album yet — select some from All photos and add them.' : 'No photos to show.'}</div>
      )}

      <div className="photos-page__grid">
        {visible.slice(0, visibleCount).map((p, i) => (
          <button
            key={p.id}
            className={`photos-page__thumb ${selecting && selected.has(p.id) ? 'photos-page__thumb--selected' : ''} ${p.hidden ? 'photos-page__thumb--hidden' : ''}`}
            onClick={() => {
              if (selecting) return toggleSelected(p.id);
              viewPos.current = i;
              setViewingId(p.id);
            }}
          >
            <img src={`/api/photos/${p.id}/image`} alt="" loading="lazy" />
            {albumsApi.isIn(p.id, FAVORITES_ID) && <span className="photos-page__star">⭐</span>}
            {p.blurry && <span className="photos-page__blurry">Possibly blurry</span>}
            {p.hidden && <span className="photos-page__hidden-tag">🙈 Hidden</span>}
          </button>
        ))}
      </div>

      {visibleCount < visible.length && (
        <button className="secondary" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
          Show more ({visible.length - visibleCount} left)
        </button>
      )}

      </>
      )}

      {animating && (
        <AnimateMakerModal
          photoId={animating}
          onClose={() => setAnimating(null)}
          onMade={() => {
            setAnimating(null);
            closeViewer();
            setTab('animate');
          }}
        />
      )}

      {viewing && !animating && (
        <div className="photo-lightbox" onClick={closeViewer}>
          <img src={`/api/photos/${viewing.id}/image`} alt="" />
          <div className="photo-lightbox__actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="photo-lightbox__action"
              aria-label={albumsApi.isIn(viewing.id, FAVORITES_ID) ? 'Remove from Favorites' : 'Add to Favorites'}
              onClick={() =>
                albumAction(() =>
                  albumsApi.isIn(viewing.id, FAVORITES_ID) ? albumsApi.remove(FAVORITES_ID, [viewing.id]) : albumsApi.add(FAVORITES_ID, [viewing.id])
                )
              }
            >
              {albumsApi.isIn(viewing.id, FAVORITES_ID) ? '★' : '☆'}
            </button>
            <button type="button" className="photo-lightbox__action" aria-label="Albums" onClick={() => { setAvatarPanel(null); setAlbumPanel(albumPanel === 'viewer' ? null : 'viewer'); }}>
              📁
            </button>
            {canSee('movies') && (
              <button type="button" className="photo-lightbox__action" aria-label="Make a living photo" title="Bring this photo to life" onClick={() => setAnimating(viewing.id)}>
                ✨
              </button>
            )}
            <button
              type="button"
              className="photo-lightbox__action"
              aria-label={viewing.hidden ? 'Unhide' : 'Hide'}
              title={viewing.hidden ? 'Unhide' : 'Hide this photo'}
              onClick={() =>
                albumAction(async () => {
                  const nowHidden = !viewing.hidden;
                  await hide([viewing.id], nowHidden);
                  // Hiding means you're done with it — move on (unless hidden ones are showing).
                  if (nowHidden && !showHidden) step(1);
                })
              }
            >
              {viewing.hidden ? '👁' : '🙈'}
            </button>
            {activeProfile && (
              <button
                type="button"
                className="photo-lightbox__action"
                aria-label="Make this my avatar"
                title={`Make this ${activeProfile.name}'s avatar`}
                onClick={() => {
                  setAlbumPanel(null);
                  setAvatarPanel(avatarPanel ? null : 'ask');
                }}
              >
                🙂
              </button>
            )}
            {activeProfile && avatarPanel && (
              <div className="album-checklist photo-avatar-panel">
                {avatarPanel === 'ask' || avatarPanel === 'saving' ? (
                  <>
                    <div className="photo-avatar-panel__who">
                      <MemberAvatar member={activeProfile} size={48} />
                      <span>Make this photo <b>{activeProfile.name}</b>'s avatar?</span>
                    </div>
                    <span className="hint">It's cropped to {activeProfile.name}'s face if they're named in it, otherwise the biggest face.</span>
                    <div className="photo-avatar-panel__buttons">
                      <button
                        type="button"
                        disabled={avatarPanel === 'saving'}
                        onClick={async () => {
                          setAvatarPanel('saving');
                          try {
                            const r = await api.post<{ cropped_to: 'yours' | 'biggest' | 'middle' }>(`/family-members/${activeProfile.id}/avatar-from-photo`, {
                              photo_id: viewing.id,
                            });
                            avatarChanged(activeProfile.id);
                            await refreshMembers();
                            setAvatarPanel({
                              done:
                                r.cropped_to === 'yours'
                                  ? `Done — cropped to ${activeProfile.name}'s face.`
                                  : r.cropped_to === 'biggest'
                                    ? 'Done — cropped to the biggest face. (Name your face in People and it picks yours.)'
                                    : 'Done — no face found, so it used the middle of the photo.',
                            });
                          } catch (err) {
                            setAvatarPanel({ error: (err as Error).message });
                          }
                        }}
                      >
                        {avatarPanel === 'saving' ? 'Saving…' : 'Yes, use it'}
                      </button>
                      <button type="button" className="secondary" onClick={() => setAvatarPanel(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="photo-avatar-panel__who">
                      {'done' in avatarPanel && <MemberAvatar member={activeProfile} size={48} />}
                      <span className={'error' in avatarPanel ? 'internet-page__bad' : ''}>
                        {'done' in avatarPanel ? avatarPanel.done : `Couldn't change the avatar: ${avatarPanel.error}`}
                      </span>
                    </div>
                    <div className="photo-avatar-panel__buttons">
                      <button type="button" className="secondary" onClick={() => setAvatarPanel(null)}>OK</button>
                    </div>
                  </>
                )}
              </div>
            )}
            {albumPanel === 'viewer' && <AlbumChecklist albumsApi={albumsApi} photoIds={[viewing.id]} onDone={() => setAlbumPanel(null)} />}
          </div>
          {viewing.hidden && <div className="photo-lightbox__badge">🙈 Hidden</div>}
          <PhotoPlaceInfo
            photoId={viewing.id}
            onChanged={(p) =>
              setDetails((m) => {
                if (!m) return m;
                const cur = m.get(viewing.id);
                if (!cur) return m;
                return new Map(m).set(viewing.id, { ...cur, ...p, taken_at: p.taken_at });
              })
            }
          />
          <PhotoFaces photoId={viewing.id} people={people} onChange={loadPeople} />
          <button className="photo-lightbox__close" onClick={(e) => { e.stopPropagation(); closeViewer(); }}>
            ✕
          </button>
          <button className="photo-lightbox__nav photo-lightbox__nav--prev" onClick={(e) => { e.stopPropagation(); step(-1); }}>
            ‹
          </button>
          <button className="photo-lightbox__nav photo-lightbox__nav--next" onClick={(e) => { e.stopPropagation(); step(1); }}>
            ›
          </button>
        </div>
      )}
    </div>
  );
}
