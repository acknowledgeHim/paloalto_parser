import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api, type Movie, type Person, type PhotoAlbum, type PhotoDetail, type Track, type LibraryStatus } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { LibraryBrowser } from './LibraryBrowser.js';
import { fmtTakenDate, NO_QUALITY_FILTER, passesQualityFilter, splitPhotoPath, type PhotoQualityFilter } from '../utils/photoDetails.js';
import { PhotoQualityOptions, PhotoQualityTags } from './PhotoQualityOptions.js';

type SelectionMode = 'date-range' | 'name' | 'album' | 'person' | 'random' | 'manual';
type GridSort = 'movie' | 'album' | 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';
type Selection = (
  | { mode: 'manual'; photoIds: string[] }
  | { mode: 'random'; count: number }
  | { mode: 'date-range'; start: string; end: string }
  | { mode: 'name'; query: string }
) & { excludeBlurry?: boolean; excludeDuplicates?: boolean };

/** Mirrors server/src/services/movieRender.ts — with music, the video runs this long past the last
 *  photo while the music fades out. */
const MUSIC_TAIL_SECONDS = 4;
/** Mirrors TITLE_CARD_SECONDS in server/src/services/movieRender.ts. */
const TITLE_CARD_SECONDS = 4;

type Transition = 'cut' | 'crossfade';
type Motion = 'none' | 'kenburns';

function fmtDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

const GRID_PAGE_SIZE = 90;

/** The local calendar day (YYYY-MM-DD) a photo was taken — what "By date taken" compares against,
 *  same as the server's date-range selection. */
function localDayOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** GET /movies/:id/source — what an existing movie was made from. */
interface MovieSource {
  title: string;
  seconds_per_photo: number;
  photo_ids: string[];
  missing_photos: number;
  tracks: Array<{ file: string; title: string; artist: string | null; duration: number | null }>;
  style: { transition: Transition; motion: Motion; title_card: boolean; subtitle: string };
  /** photo id → caption */
  captions: Record<string, string>;
}

/** The whole form, as auto-saved to a draft (server/src/routes/movies.ts's /drafts). */
interface DraftState {
  title: string;
  mode: SelectionMode;
  selectedIds: string[];
  randomCount: number;
  startDate: string;
  endDate: string;
  nameQuery: string;
  secondsPerPhoto: number;
  musicTracks: Track[];
  movieOrder: string[];
  missingPhotos: number;
  gridSort: GridSort;
  // Added later — optional so older drafts still load.
  albumId?: string;
  quality?: PhotoQualityFilter;
  transition?: Transition;
  motion?: Motion;
  titleCard?: boolean;
  subtitle?: string;
  captions?: Record<string, string>;
}

const AUTOSAVE_MS = 30_000;

interface Props {
  /** Set to edit an existing movie (pre-filled from what it was made from) instead of making a new one. */
  editing?: Movie;
  /** Resume this auto-saved draft instead of starting fresh / from the movie's saved source. */
  draftId?: string;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Renders a new slideshow video from a photo selection (manual pick, random N, or by date taken)
 * plus optional tracks from the music library, played back to back — read-only against both: a movie is always a
 * brand new file (server/src/services/movieRender.ts), nothing about the source photos/music is
 * ever deleted or modified to make one.
 */
export function MovieMakerModal({ editing, draftId: initialDraftId, onClose, onCreated }: Props) {
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
  const [albumId, setAlbumId] = useState('');
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [quality, setQuality] = useState<PhotoQualityFilter>(NO_QUALITY_FILTER);
  // "From an album" is the photo grid narrowed to one album — pick some or Select all.
  const [albumPhotoIds, setAlbumPhotoIds] = useState<string[] | null>(null);
  // "With a person" (face recognition): the grid narrowed to photos with them in it.
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState('');
  const [personPhotoIds, setPersonPhotoIds] = useState<string[] | null>(null);
  const [secondsPerPhoto, setSecondsPerPhoto] = useState(4);
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState<Track[]>([]);
  const [musicTracks, setMusicTracks] = useState<Track[]>([]);
  const [musicMode, setMusicMode] = useState<'search' | 'browse'>('search');
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // A big library (hundreds/thousands of photos, especially over a slower SMB share) rendering as
  // one giant DOM grid was enough to freeze the whole modal on a Pi-class browser — cap how many
  // show up at once and let "Show more" reveal the rest in batches instead.
  const [visibleCount, setVisibleCount] = useState(GRID_PAGE_SIZE);
  // The grid's own photo list, with folder/filename and date taken so it can be sorted and
  // filtered — only fetched once the grid is actually opened, since the first fetch after a
  // restart may need to read dates for the whole library.
  const [gridPhotos, setGridPhotos] = useState<PhotoDetail[] | null>(null);
  const [gridError, setGridError] = useState(false);
  const [gridSort, setGridSort] = useState<GridSort>('date-desc');
  const [folderFilter, setFolderFilter] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Editing: the movie's own photo order, which the grid's "Movie order" sort follows (so an
  // unchanged movie re-renders in the same order), and how many of its photos are gone now.
  const [movieOrder, setMovieOrder] = useState<string[]>([]);
  // Optional style — all off by default (plain cuts, no title card, no captions).
  const [transition, setTransition] = useState<Transition>('cut');
  const [motion, setMotion] = useState<Motion>('none');
  const [titleCard, setTitleCard] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [showCaptions, setShowCaptions] = useState(false);
  const [missingPhotos, setMissingPhotos] = useState(0);
  const [sourceLoading, setSourceLoading] = useState(Boolean(editing || initialDraftId));

  // ---- Auto-save ----
  // Every AUTOSAVE_MS (if anything changed), and once more on the way out — Cancel, or the whole
  // app unmounting when the screensaver kicks in — so a half-built movie is never lost. The draft
  // is deleted once the movie is actually created/updated.
  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const applyState = (st: DraftState) => {
    setTitle(st.title);
    setMode(st.mode);
    setSelectedIds(new Set(st.selectedIds));
    setRandomCount(st.randomCount);
    setStartDate(st.startDate);
    setEndDate(st.endDate);
    setNameQuery(st.nameQuery);
    setSecondsPerPhoto(st.secondsPerPhoto);
    setMusicTracks(st.musicTracks);
    setMovieOrder(st.movieOrder);
    setMissingPhotos(st.missingPhotos);
    setTransition(st.transition ?? 'cut');
    setMotion(st.motion ?? 'none');
    setTitleCard(st.titleCard ?? false);
    setSubtitle(st.subtitle ?? '');
    setCaptions(st.captions ?? {});
    setGridSort(st.gridSort);
    setAlbumId(st.albumId ?? '');
    setQuality(st.quality ?? NO_QUALITY_FILTER);
  };

  const loadSource = (movie: Movie) => {
    setSourceLoading(true);
    api
      .get<MovieSource>(`/movies/${movie.id}/source`)
      .then((src) => {
        setTitle(src.title);
        setSecondsPerPhoto(src.seconds_per_photo);
        setMusicTracks(src.tracks.map((t) => ({ ...t, album: null })));
        setMode('manual');
        setSelectedIds(new Set(src.photo_ids));
        setMovieOrder(src.photo_ids);
        setMissingPhotos(src.missing_photos);
        setGridSort('movie');
        setTransition(src.style.transition);
        setMotion(src.style.motion);
        setTitleCard(src.style.title_card);
        setSubtitle(src.style.subtitle);
        setCaptions(src.captions);
      })
      .catch((err) => setError(`Couldn't load this movie's photos and songs: ${(err as Error).message}`))
      .finally(() => setSourceLoading(false));
  };

  useEffect(() => {
    if (initialDraftId) {
      api
        .get<{ state: DraftState; updated_at: string }>(`/movies/drafts/${initialDraftId}`)
        .then((d) => {
          applyState(d.state);
          setDraftSavedAt(d.updated_at);
        })
        .catch(() => {
          // Draft vanished (finished on another screen?) — fall back to a normal start.
          setDraftId(null);
          if (editing) return loadSource(editing);
        })
        .finally(() => setSourceLoading(false));
    } else if (editing) {
      loadSource(editing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every mode but Random picks photos on the grid: "Choose from the grid" shows everything, and
  // By date taken / By folder or filename / From an album narrow it down — then pick some, or
  // Select all. (Random still picks for you, on the server.)
  const gridMode = mode !== 'random';
  // Whether the narrowing mode has what it needs to show anything yet.
  const gridReady =
    mode === 'manual' ||
    (mode === 'album' && Boolean(albumId)) ||
    (mode === 'person' && Boolean(personId)) ||
    (mode === 'date-range' && Boolean(startDate && endDate)) ||
    (mode === 'name' && nameQuery.trim() !== '');

  useEffect(() => {
    api.get<Person[]>('/faces/people').then(setPeople).catch(() => setPeople([]));
  }, []);
  useEffect(() => {
    setPersonPhotoIds(null);
    if (!personId) return;
    api.get<string[]>(`/faces/people/${personId}/photos`).then(setPersonPhotoIds).catch(() => setPersonPhotoIds([]));
  }, [personId]);

  useEffect(() => {
    setAlbumPhotoIds(null);
    if (!albumId) return;
    api.get<string[]>(`/albums/${albumId}/photos`).then(setAlbumPhotoIds).catch(() => setAlbumPhotoIds([]));
  }, [albumId]);

  // Each way of picking starts in its natural order (still re-sortable): an album in the order its
  // photos were added, a date range oldest first, a folder/filename search by folder and name.
  useEffect(() => {
    if (mode === 'album' && albumId) setGridSort('album');
    else if (mode === 'date-range' || mode === 'person') setGridSort('date-asc');
    else if (mode === 'name') setGridSort('name-asc');
    else if (mode === 'manual' && gridSort === 'album') setGridSort(editing ? 'movie' : 'date-desc');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, albumId]);

  useEffect(() => {
    if (!gridMode || gridPhotos) return;
    setGridError(false);
    api.get<PhotoDetail[]>('/photos/details').then(setGridPhotos).catch(() => setGridError(true));
  }, [gridMode, gridPhotos]);

  const sortedGridPhotos = useMemo(() => {
    if (!gridPhotos) return [];
    const sorted = [...gridPhotos];
    if (gridSort === 'album') {
      const position = new Map((albumPhotoIds ?? []).map((id, i) => [id, i]));
      sorted.sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity) || b.taken_at.localeCompare(a.taken_at));
    } else if (gridSort === 'movie') {
      // The movie's photos first, in the order they play; everything else after, newest first —
      // so anything newly picked plays after the original photos.
      const position = new Map(movieOrder.map((id, i) => [id, i]));
      sorted.sort((a, b) => {
        const pa = position.get(a.id);
        const pb = position.get(b.id);
        if (pa !== undefined && pb !== undefined) return pa - pb;
        if (pa !== undefined) return -1;
        if (pb !== undefined) return 1;
        return b.taken_at.localeCompare(a.taken_at);
      });
    } else if (gridSort === 'date-desc') sorted.sort((a, b) => b.taken_at.localeCompare(a.taken_at));
    else if (gridSort === 'date-asc') sorted.sort((a, b) => a.taken_at.localeCompare(b.taken_at));
    else {
      sorted.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }));
      if (gridSort === 'name-desc') sorted.reverse();
    }
    return sorted;
  }, [gridPhotos, gridSort, movieOrder, albumPhotoIds]);

  // Folder and filename are matched separately — a camera's numbered filenames (IMG_20261234…)
  // would otherwise turn a folder search like "2026" into a pile of unrelated photos.
  const shownGridPhotos = useMemo(() => {
    const folderQ = folderFilter.trim().toLowerCase();
    const fileQ = fileFilter.trim().toLowerCase();
    const inAlbum = mode === 'album' ? new Set(albumPhotoIds ?? []) : mode === 'person' ? new Set(personPhotoIds ?? []) : null;
    const nameQ = nameQuery.trim().toLowerCase();
    if (!gridReady) return [];
    return sortedGridPhotos.filter((p) => {
      if (inAlbum && !inAlbum.has(p.id)) return false;
      if (mode === 'date-range') {
        const day = localDayOf(p.taken_at);
        if (day < startDate || day > endDate) return false;
      }
      if (mode === 'name' && !p.path.toLowerCase().includes(nameQ)) return false;
      const { folder, file } = splitPhotoPath(p.path);
      return (
        (!folderQ || folder.toLowerCase().includes(folderQ)) &&
        (!fileQ || file.toLowerCase().includes(fileQ)) &&
        (!showSelectedOnly || selectedIds.has(p.id)) &&
        // Hidden photos stay out of the picker — unless already in the movie being edited.
        (!p.hidden || selectedIds.has(p.id)) &&
        passesQualityFilter(p, quality)
      );
    });
  }, [sortedGridPhotos, folderFilter, fileFilter, showSelectedOnly, selectedIds, quality, mode, albumPhotoIds, personPhotoIds, gridReady, startDate, endDate, nameQuery]);

  // Every distinct folder, offered as suggestions in the folder filter box.
  const gridFolders = useMemo(
    () =>
      Array.from(new Set((gridPhotos ?? []).map((p) => splitPhotoPath(p.path).folder).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      ),
    [gridPhotos]
  );

  // Back to the first page whenever what's shown changes, so a new sort/filter starts at the top.
  useEffect(() => setVisibleCount(GRID_PAGE_SIZE), [gridSort, folderFilter, fileFilter, showSelectedOnly, quality]);

  useEffect(() => {
    api.get<PhotoAlbum[]>('/albums').then(setAlbums).catch(() => setAlbums([]));
  }, []);

  const selectAllShown = () =>
    setSelectedIds((ids) => {
      const next = new Set(ids);
      shownGridPhotos.forEach((p) => next.add(p.id));
      return next;
    });

  const draftState: DraftState = {
    title,
    mode,
    selectedIds: [...selectedIds],
    randomCount,
    startDate,
    endDate,
    nameQuery,
    secondsPerPhoto,
    musicTracks,
    movieOrder,
    missingPhotos,
    gridSort,
    transition,
    motion,
    titleCard,
    subtitle,
    captions,
    albumId,
    quality,
  };
  const draftJson = JSON.stringify(draftState);
  // Only new movies auto-save — edits to an existing one are saved deliberately with Update (or
  // dropped with Cancel). And a new movie isn't worth a draft until something's been entered.
  const worthSaving = Boolean(
    (!editing || initialDraftId) &&
      (title.trim() || selectedIds.size || musicTracks.length || startDate || endDate || nameQuery.trim())
  );

  // The interval/unmount handlers below outlive any one render, so they read the latest form
  // through refs. lastSavedJson starts as whatever the form first loaded as, so just opening (or
  // opening to edit, unchanged) never creates a draft.
  const latest = useRef({ draftJson, draftState, worthSaving, title, draftId });
  latest.current = { draftJson, draftState, worthSaving, title, draftId };
  const lastSavedJson = useRef<string | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    if (!sourceLoading && lastSavedJson.current === null) lastSavedJson.current = draftJson;
  }, [sourceLoading, draftJson]);

  const saveDraft = async (onTheWayOut = false) => {
    const cur = latest.current;
    if (lastSavedJson.current === null || cur.draftJson === lastSavedJson.current || !cur.worthSaving) return;
    const body = {
      movie_id: editing?.id ?? null,
      created_by_id: activeProfile?.id ?? null,
      title: cur.title,
      state: cur.draftState,
    };
    lastSavedJson.current = cur.draftJson;
    if (onTheWayOut) {
      // keepalive lets the request finish even though this component (or the page) is going away.
      fetch(cur.draftId ? `/api/movies/drafts/${cur.draftId}` : '/api/movies/drafts', {
        method: cur.draftId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
      return;
    }
    try {
      let saved: { id: string; updated_at: string };
      try {
        saved = cur.draftId
          ? await api.put<{ id: string; updated_at: string }>(`/movies/drafts/${cur.draftId}`, body)
          : await api.post<{ id: string; updated_at: string }>('/movies/drafts', body);
      } catch (err) {
        if (!cur.draftId) throw err;
        // Draft was removed elsewhere — start a new one.
        saved = await api.post<{ id: string; updated_at: string }>('/movies/drafts', body);
      }
      setDraftId(saved.id);
      latest.current.draftId = saved.id;
      setDraftSavedAt(saved.updated_at);
    } catch {
      lastSavedJson.current = null; // try again next tick
    }
  };

  useEffect(() => {
    const t = setInterval(() => saveDraft(), AUTOSAVE_MS);
    const flush = () => {
      if (!finished.current) saveDraft(true);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      clearInterval(t);
      window.removeEventListener('pagehide', flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const discardDraft = async () => {
    const id = latest.current.draftId;
    if (id) await api.delete(`/movies/drafts/${id}`).catch(() => {});
    setDraftId(null);
    latest.current.draftId = null;
    setDraftSavedAt(null);
  };

  /** Editing with a draft open: throw the unsaved changes away and reload the saved movie. */
  const startOver = async () => {
    if (!editing) return;
    await discardDraft();
    lastSavedJson.current = null;
    loadSource(editing);
  };

  // Grid picks that the blurry/duplicate options would leave out are dropped too, so the options
  // mean the same thing in every mode.
  const pickedGridIds = sortedGridPhotos.filter((p) => selectedIds.has(p.id) && passesQualityFilter(p, quality)).map((p) => p.id);

  const buildSelection = (): Selection => {
    // Picked photos play in the grid's current sort order (not the order they were tapped), so
    // e.g. "Date taken (oldest first)" makes a chronological movie.
    // Grid and album picks both go to the server as the exact photos picked. (Picks made in other
    // albums, or the full grid, stay picked — so one movie can mix albums.)
    if (gridMode) return { mode: 'manual', photoIds: gridPhotos ? pickedGridIds : [...selectedIds] };
    const flags = { excludeBlurry: quality.excludeBlurry, excludeDuplicates: quality.excludeDuplicates };
    if (mode === 'random') return { mode: 'random', count: randomCount, ...flags };
    if (mode === 'name') return { mode: 'name', query: nameQuery, ...flags };
    return { mode: 'date-range', start: startDate, end: endDate, ...flags };
  };

  // Whether there's enough picked to attempt a render — synchronous, so the submit button doesn't
  // stay stuck waiting on the (sometimes slow, over a network share) resolve-selection preview
  // below. The preview is purely informational; hitting Create always gets an authoritative answer
  // from the actual POST /movies call regardless of whether the preview has come back yet.
  const selectionValid =
    gridMode ? selectedIds.size > 0 :
    mode === 'random' ? randomCount > 0 :
    mode === 'name' ? nameQuery.trim() !== '' :
    Boolean(startDate && endDate);

  // Live "N photos match" preview — manual mode already knows its own count locally; the other
  // modes ask the server (resolve-selection doesn't create anything, just resolves the count).
  useEffect(() => {
    if (gridMode) {
      setPreviewCount(gridPhotos ? pickedGridIds.length : selectedIds.size);
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
  }, [mode, selectedIds, randomCount, startDate, endDate, nameQuery, albumId, quality, gridPhotos, gridSort, selectionValid]);

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

  const addTrack = (t: Track) => setMusicTracks((tracks) => [...tracks, t]);
  const removeTrack = (index: number) => setMusicTracks((tracks) => tracks.filter((_, i) => i !== index));
  const moveTrack = (index: number, delta: number) =>
    setMusicTracks((tracks) => {
      const target = index + delta;
      if (target < 0 || target >= tracks.length) return tracks;
      const next = [...tracks];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  // Running totals so it's easy to add just enough music to cover the whole slideshow. The movie's
  // length is only known once the photo count is (manual/preview); a track with no duration in
  // the library index just can't be counted.
  const titleSeconds = titleCard ? TITLE_CARD_SECONDS : 0;
  const movieSeconds =
    previewCount !== null && previewCount > 0
      ? titleSeconds + previewCount * secondsPerPhoto + (musicTracks.length > 0 ? MUSIC_TAIL_SECONDS : 0)
      : null;
  const musicSeconds = musicTracks.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  const unknownDurationCount = musicTracks.filter((t) => t.duration == null).length;
  // Remaining once the music would be added — the 4s tail only applies once there's music at all.
  const musicShortBy =
    previewCount !== null && previewCount > 0
      ? titleSeconds + previewCount * secondsPerPhoto + MUSIC_TAIL_SECONDS - musicSeconds
      : null;
  // "Fit photos to the music": the seconds per photo that makes the photos (plus title card and
  // closing fade) last as long as the songs. Only when every song's length is known.
  const fittedSeconds =
    previewCount && musicTracks.length > 0 && unknownDurationCount === 0
      ? Math.max(1, Math.round(((musicSeconds - MUSIC_TAIL_SECONDS - titleSeconds) / previewCount) * 10) / 10)
      : null;

  const toggleSelected = (id: string) => {
    setSelectedIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Creates a new movie, or — editing, unless `asNew` — re-renders the existing one in place. */
  const save = async (asNew: boolean) => {
    if (!title.trim() || !selectionValid) return;
    setError(null);
    setCreating(true);
    const payload = {
      title: title.trim(),
      selection: buildSelection(),
      seconds_per_photo: secondsPerPhoto,
      music_tracks: musicTracks.map((t) => t.file),
      music_track_details: musicTracks.map((t) => ({ file: t.file, title: t.title, artist: t.artist, duration: t.duration })),
      style: { transition, motion, title_card: titleCard, subtitle },
      // Only captions for photos actually in the movie (the server matches them up by photo id).
      captions: Object.fromEntries(Object.entries(captions).filter(([id, c]) => c.trim() && selectedIds.has(id))),
      created_by_id: activeProfile?.id ?? null,
    };
    try {
      if (editing && !asNew) await api.put(`/movies/${editing.id}`, payload);
      else await api.post('/movies', payload);
      finished.current = true;
      await discardDraft();
      onCreated();
    } catch (err) {
      setError((err as Error).message || 'Could not start that movie');
    } finally {
      setCreating(false);
    }
  };

  // Updating while some of the movie's photos can't be found (photo share offline, folder moved)
  // asks first: the new video will be made without them. The server keeps them in the movie's saved
  // list either way, so they come back on a later Update once they're findable again.
  const [confirmingMissing, setConfirmingMissing] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (editing && missingPhotos > 0 && !confirmingMissing) {
      setConfirmingMissing(true);
      return;
    }
    setConfirmingMissing(false);
    save(false);
  };

  return (
    // No close-on-backdrop-click here (unlike most modals in this app) — this form takes real
    // effort to fill in (picking a mode, dates, searching/browsing for music), so an accidental
    // outside click shouldn't be able to discard all of that. Cancel below is the only way out.
    <div className="modal-overlay">
      <form className="modal-panel task-form movie-maker" onSubmit={submit}>
        <h2>{editing ? 'Edit movie' : 'Make a movie'}</h2>
        {sourceLoading && <p className="hint">Loading…</p>}
        {initialDraftId && !sourceLoading && draftId && (
          <p className="hint movie-maker__draft-note">
            Picked up where you left off{draftSavedAt ? ` (saved ${new Date(draftSavedAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })})` : ''}.
            {editing && (
              <>
                {' '}
                <button type="button" className="link-button" onClick={startOver}>Start over from the saved movie</button>
              </>
            )}
          </p>
        )}
        {editing && missingPhotos > 0 && (
          <div className="internet-page__notice">
            ⚠️ {missingPhotos} of this movie's photo{missingPhotos === 1 ? " can't" : "s can't"} be found right now —
            is the photo share offline, or was a folder moved? {missingPhotos === 1 ? "It's" : "They're"} still
            saved with the movie, just not shown here.
          </div>
        )}
        <input autoFocus placeholder="Title (e.g. Summer 2024)" value={title} onChange={(e) => setTitle(e.target.value)} />

        <section className="movie-maker__section movie-maker__section--photos">
          <h3 className="movie-maker__section-title">📷 Pick photos</h3>
          <div className="task-form__row">
            <select value={mode} onChange={(e) => setMode(e.target.value as SelectionMode)}>
              <option value="date-range">By date taken</option>
              <option value="name">By folder or filename</option>
              <option value="album">From an album</option>
              {people.length > 0 && <option value="person">With a person</option>}
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
          {mode === 'album' && (
            <select value={albumId} onChange={(e) => setAlbumId(e.target.value)} aria-label="Album">
              <option value="">Pick an album…</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>{a.is_favorites ? '⭐ ' : ''}{a.name} ({a.count})</option>
              ))}
            </select>
          )}
          {mode === 'person' && (
            <select value={personId} onChange={(e) => setPersonId(e.target.value)} aria-label="Person">
              <option value="">Pick a person…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.photo_count})</option>
              ))}
            </select>
          )}
          <PhotoQualityOptions value={quality} onChange={setQuality} />
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
          {gridMode && !gridReady && (
            <p className="hint">
              {mode === 'date-range'
                ? 'Pick both dates to see the photos taken then.'
                : mode === 'name'
                  ? 'Type part of a folder or filename to see the matching photos.'
                  : mode === 'person'
                    ? 'Pick a person to see the photos they’re in.'
                    : 'Pick an album to see its photos.'}
            </p>
          )}
          {gridMode && gridReady && (
            <>
              {(!gridPhotos || (mode === 'album' && !albumPhotoIds) || (mode === 'person' && !personPhotoIds)) && !gridError && <p className="hint">Loading photos…</p>}
              {gridError && (
                <p className="hint">
                  Couldn't load the photo list.{' '}
                  <button type="button" className="link-button" onClick={() => { setGridError(false); setGridPhotos(null); api.get<PhotoDetail[]>('/photos/details').then(setGridPhotos).catch(() => setGridError(true)); }}>
                    Try again
                  </button>
                </p>
              )}
              {gridPhotos && (
                <>
                  <div className="task-form__row">
                    <select value={gridSort} onChange={(e) => setGridSort(e.target.value as GridSort)} aria-label="Sort photos">
                      {editing && <option value="movie">Movie order</option>}
                      {mode === 'album' && <option value="album">Album order</option>}
                      <option value="date-desc">Date taken (newest first)</option>
                      <option value="date-asc">Date taken (oldest first)</option>
                      <option value="name-asc">Folder / filename (A–Z)</option>
                      <option value="name-desc">Folder / filename (Z–A)</option>
                    </select>
                  </div>
                  <div className="task-form__row">
                    <input
                      placeholder="Folder contains…"
                      list="movie-maker-folders"
                      value={folderFilter}
                      onChange={(e) => setFolderFilter(e.target.value)}
                      aria-label="Filter by folder"
                    />
                    <datalist id="movie-maker-folders">
                      {gridFolders.map((f) => <option key={f} value={f} />)}
                    </datalist>
                    <input
                      placeholder="Filename contains…"
                      value={fileFilter}
                      onChange={(e) => setFileFilter(e.target.value)}
                      aria-label="Filter by filename"
                    />
                  </div>
                  <div className="task-form__row">
                    <button type="button" className="secondary" onClick={selectAllShown} disabled={shownGridPhotos.length === 0}>
                      Select all shown ({shownGridPhotos.length})
                    </button>
                    <button type="button" className="secondary" onClick={() => setSelectedIds(new Set())} disabled={selectedIds.size === 0}>
                      Clear selection
                    </button>
                    <label className="member-form__label member-form__label--inline">
                      <input type="checkbox" checked={showSelectedOnly} onChange={(e) => setShowSelectedOnly(e.target.checked)} />
                      Show only picked
                    </label>
                  </div>
                  <div className="movie-maker__photo-grid">
                    {shownGridPhotos.slice(0, visibleCount).map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        title={p.path}
                        className={`movie-maker__photo ${selectedIds.has(p.id) ? 'movie-maker__photo--selected' : ''}`}
                        onClick={() => toggleSelected(p.id)}
                      >
                        <img src={`/api/photos/${p.id}/image`} alt="" loading="lazy" />
                        <PhotoQualityTags p={p} />
                        <span className="movie-maker__photo-date">{fmtTakenDate(p.taken_at)}</span>
                      </button>
                    ))}
                  </div>
                  {shownGridPhotos.length === 0 && <p className="hint">No photos match that filter.</p>}
                  {visibleCount < shownGridPhotos.length && (
                    <button type="button" className="secondary" onClick={() => setVisibleCount((c) => c + GRID_PAGE_SIZE)}>
                      Show more ({shownGridPhotos.length - visibleCount} left)
                    </button>
                  )}
                  <p className="hint">Picked photos play in the order shown by the sort above.</p>
                </>
              )}
            </>
          )}
          {!gridMode && selectionValid && previewLoading && previewCount === null && (
            <p className="hint">Checking how many photos match…</p>
          )}
          {previewCount !== null && (
            <p className="hint">{previewCount} photo{previewCount === 1 ? '' : 's'} {gridMode ? 'picked' : 'match'}.</p>
          )}
        </section>

        <section className="movie-maker__section movie-maker__section--length">
          <h3 className="movie-maker__section-title">⏱️ Length</h3>
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
          {movieSeconds !== null && (
            <p className="hint movie-maker__length">
              Movie length: <strong>{fmtDuration(movieSeconds)}</strong>
              {' '}({titleCard ? `${TITLE_CARD_SECONDS}s title + ` : ''}{previewCount} × {secondsPerPhoto}s{musicTracks.length > 0 ? ` + ${MUSIC_TAIL_SECONDS}s fade-out` : ''})
            </p>
          )}
          {fittedSeconds !== null && Math.abs(fittedSeconds - secondsPerPhoto) >= 0.1 && (
            <button type="button" className="secondary movie-maker__fit" onClick={() => setSecondsPerPhoto(fittedSeconds)}>
              ♫ Fit photos to the music ({fittedSeconds}s each)
            </button>
          )}
        </section>

        <section className="movie-maker__section movie-maker__section--style">
          <h3 className="movie-maker__section-title">🎨 Style <span className="hint">(optional)</span></h3>
          <div className="task-form__row">
            <label className="member-form__label member-form__label--inline">
              Between photos
              <select value={transition} onChange={(e) => setTransition(e.target.value as Transition)}>
                <option value="cut">Straight cut</option>
                <option value="crossfade">Crossfade</option>
              </select>
            </label>
            <label className="member-form__label member-form__label--inline">
              Motion
              <select value={motion} onChange={(e) => setMotion(e.target.value as Motion)}>
                <option value="none">None (still photos)</option>
                <option value="kenburns">Slow pan &amp; zoom</option>
              </select>
            </label>
          </div>
          {motion === 'kenburns' && <p className="hint">Pan &amp; zoom takes noticeably longer to render on a Pi.</p>}
          <label className="member-form__label member-form__label--inline movie-maker__check">
            <input type="checkbox" checked={titleCard} onChange={(e) => setTitleCard(e.target.checked)} />
            Opening title card (shows the title for {TITLE_CARD_SECONDS}s)
          </label>
          {titleCard && (
            <input placeholder="Subtitle under the title (optional, e.g. July 2026)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          )}
          {gridMode ? (
            selectedIds.size > 0 && (
              <button type="button" className="secondary" onClick={() => setShowCaptions((v) => !v)}>
                ✎ Captions ({Object.entries(captions).filter(([id, c]) => c.trim() && selectedIds.has(id)).length} of {selectedIds.size})
              </button>
            )
          ) : (
            <p className="hint">To caption photos, pick them with "Choose from the grid" or "From an album" (or caption them later with Edit).</p>
          )}
          {gridMode && showCaptions && (
            <div className="movie-maker__captions">
              {(gridPhotos ? pickedGridIds : [...selectedIds]).map((id, i) => (
                <div key={id} className="movie-maker__caption-row">
                  <span className="movie-maker__caption-n">{i + 1}</span>
                  <img src={`/api/photos/${id}/image`} alt="" loading="lazy" />
                  <input
                    placeholder="Caption (optional)"
                    value={captions[id] ?? ''}
                    maxLength={200}
                    onChange={(e) => setCaptions((cur) => ({ ...cur, [id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="movie-maker__section movie-maker__section--music">
          <h3 className="movie-maker__section-title">🎵 Music <span className="hint">(optional)</span></h3>
          {musicTracks.length > 0 && (
            <>
              <ol className="movie-maker__track-list">
                {musicTracks.map((t, i) => (
                  <li key={`${t.file}-${i}`}>
                    <span className="movie-maker__track-name">
                      {t.title}{t.artist ? ` — ${t.artist}` : ''}
                    </span>
                    <span className="hint">{t.duration != null ? fmtDuration(t.duration) : '?:??'}</span>
                    <button type="button" className="secondary" disabled={i === 0} aria-label="Move up" onClick={() => moveTrack(i, -1)}>↑</button>
                    <button type="button" className="secondary" disabled={i === musicTracks.length - 1} aria-label="Move down" onClick={() => moveTrack(i, 1)}>↓</button>
                    <button type="button" className="secondary" aria-label="Remove" onClick={() => removeTrack(i)}>✕</button>
                  </li>
                ))}
              </ol>
              <p className="hint movie-maker__length">
                Music total: <strong>{fmtDuration(musicSeconds)}</strong>
                {unknownDurationCount > 0 && ` (+ ${unknownDurationCount} track${unknownDurationCount === 1 ? '' : 's'} of unknown length)`}
                {movieSeconds !== null && <> of {fmtDuration(movieSeconds)}</>}
                {musicShortBy !== null && (
                  musicShortBy > 0
                    ? <> — add about <strong>{fmtDuration(musicShortBy)}</strong> more to cover the whole movie, or it'll loop back to the first track.</>
                    : <> — enough to cover the whole movie ✓</>
                )}
              </p>
            </>
          )}
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
                          addTrack(t);
                          setMusicResults([]);
                          setMusicQuery('');
                        }}
                      >
                        + {t.title}{t.artist ? ` — ${t.artist}` : ''}{t.duration != null ? ` (${fmtDuration(t.duration)})` : ''}
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
                <button type="button" className="link-button" onClick={() => addTrack(t)}>
                  + Add{t.duration != null ? ` (${fmtDuration(t.duration)})` : ''}
                </button>
              )}
            />
          )}
          <p className="hint">
            Tracks play in order. The video ends {MUSIC_TAIL_SECONDS}s after the last photo, with the
            music fading out over the last 10 seconds — anything left over is cut.
          </p>
        </section>

        {error && <div className="settings-login__error">{error}</div>}
        {confirmingMissing && (
          <div className="movie-maker__missing-confirm">
            <p>
              <strong>
                {missingPhotos} photo{missingPhotos === 1 ? ' is' : 's are'} missing right now, so the updated video
                will be made without {missingPhotos === 1 ? 'it' : 'them'}.
              </strong>{' '}
              {missingPhotos === 1 ? 'It stays' : 'They stay'} saved with the movie — once the photos are back,
              Edit → Update again puts {missingPhotos === 1 ? 'it' : 'them'} back in. If the share is just down,
              it's usually better to wait.
            </p>
            <div className="task-form__row">
              <button type="submit" className="secondary">Update anyway</button>
              <button type="button" onClick={() => setConfirmingMissing(false)}>Wait — don't update</button>
            </div>
          </div>
        )}
        <div className="task-form__row">
          <button type="submit" disabled={creating || sourceLoading || !title.trim() || !selectionValid}>
            {creating ? 'Starting…' : editing ? 'Update movie' : 'Create movie'}
          </button>
          {editing && (
            <button
              type="button"
              className="secondary"
              disabled={creating || sourceLoading || !title.trim() || !selectionValid}
              onClick={() => save(true)}
            >
              Save as new movie
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>{draftId || (worthSaving && !editing) ? 'Close' : 'Cancel'}</button>
          {draftId && (
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                finished.current = true;
                await discardDraft();
                onClose();
              }}
            >
              Discard draft
            </button>
          )}
        </div>
        {(!editing || draftId) && <p className="hint">
          {draftSavedAt
            ? `Draft auto-saved ${new Date(draftSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} — Close keeps it; continue it any time from the Movies list.`
            : 'Your work auto-saves as a draft every 30 seconds.'}
        </p>}
        <p className="hint">
          Rendering happens in the background and can take a few minutes on a Pi — it'll show up
          below, and switch to "Watch" once it's ready.
          {editing && ' Updating keeps the current version watchable until the new one is done.'}
        </p>
      </form>
    </div>
  );
}
