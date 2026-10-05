import { useEffect, useMemo, useState } from 'react';
import { api, type PhotoAlbum, type PhotoDetail } from '../api/client.js';
import { fmtTakenDate, NO_QUALITY_FILTER, passesQualityFilter, splitPhotoPath, type PhotoQualityFilter } from '../utils/photoDetails.js';
import { PhotoQualityOptions, PhotoQualityTags } from './PhotoQualityOptions.js';

/** The same ways to pick photos as the movie maker, in the same order. */
type Mode = 'date-range' | 'name' | 'album' | 'random' | 'manual';
type Sort = 'album' | 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

const PAGE_SIZE = 90;

interface Props {
  title: string;
  /** Already in the section — shown as such and not picked again. */
  alreadyAdded: Set<string>;
  /** Picked photo ids, in the order they should be added. */
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}

/** Fisher-Yates — same unbiased shuffle the movie maker's random pick uses server-side. */
function sampleRandom<T>(items: T[], n: number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

/** The local calendar day (YYYY-MM-DD) a photo was taken. */
function localDayOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * A pop-over for picking a group of pictures, with the movie maker's options. Every way but Random
 * shows photos on a grid to pick from: "Choose from the grid" shows everything, while By date taken,
 * By folder or filename, and From an album narrow it down first — then tap the ones you want or
 * Select all, with the same sort, folder/filename filters, Show only picked, and blurry/duplicate
 * options throughout. Random picks for you (Shuffle again for another set). Everything works off
 * GET /photos/details, so "date taken" matches the movie maker's (EXIF, else file date).
 */
export function PhotoPicker({ title, alreadyAdded, onAdd, onClose }: Props) {
  const [photos, setPhotos] = useState<PhotoDetail[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<Mode>('manual');
  // Narrowing (date range / name / album) and random
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [randomCount, setRandomCount] = useState(10);
  const [randomSeed, setRandomSeed] = useState(0); // bump to shuffle again
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [albumId, setAlbumId] = useState('');
  const [albumPhotoIds, setAlbumPhotoIds] = useState<string[] | null>(null);
  const [quality, setQuality] = useState<PhotoQualityFilter>(NO_QUALITY_FILTER);
  // Grid
  const [sort, setSort] = useState<Sort>('date-desc');
  const [folderFilter, setFolderFilter] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [showPickedOnly, setShowPickedOnly] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = () => {
    setLoadError(false);
    api.get<PhotoDetail[]>('/photos/details').then(setPhotos).catch(() => setLoadError(true));
  };
  useEffect(load, []);
  useEffect(() => {
    api.get<PhotoAlbum[]>('/albums').then(setAlbums).catch(() => setAlbums([]));
  }, []);
  useEffect(() => {
    setAlbumPhotoIds(null);
    if (!albumId) return;
    api.get<string[]>(`/albums/${albumId}/photos`).then(setAlbumPhotoIds).catch(() => setAlbumPhotoIds([]));
  }, [albumId]);

  const gridMode = mode !== 'random';
  // Whether a narrowing mode has what it needs to show anything yet.
  const ready =
    mode === 'manual' ||
    mode === 'random' ||
    (mode === 'album' && Boolean(albumId) && albumPhotoIds !== null) ||
    (mode === 'date-range' && Boolean(startDate && endDate)) ||
    (mode === 'name' && nameQuery.trim() !== '');

  // Each way of picking starts in its natural order (still re-sortable).
  useEffect(() => {
    if (mode === 'album') setSort('album');
    else if (mode === 'date-range') setSort('date-asc');
    else if (mode === 'name') setSort('name-asc');
    else if (sort === 'album') setSort('date-desc');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // The blurry/duplicate options apply to every way of picking.
  const usable = useMemo(() => (photos ?? []).filter((p) => passesQualityFilter(p, quality)), [photos, quality]);

  /** What the current mode narrows the library down to (before the grid's own filters). */
  const narrowed = useMemo(() => {
    if (!ready) return [];
    if (mode === 'date-range') {
      return usable.filter((p) => {
        const day = localDayOf(p.taken_at);
        return day >= startDate && day <= endDate;
      });
    }
    if (mode === 'name') {
      const q = nameQuery.trim().toLowerCase();
      return usable.filter((p) => p.path.toLowerCase().includes(q));
    }
    if (mode === 'album') {
      const inAlbum = new Set(albumPhotoIds ?? []);
      return usable.filter((p) => inAlbum.has(p.id));
    }
    return usable;
  }, [usable, ready, mode, startDate, endDate, nameQuery, albumPhotoIds]);

  const sorted = useMemo(() => {
    const list = [...narrowed];
    if (sort === 'album') {
      const position = new Map((albumPhotoIds ?? []).map((id, i) => [id, i]));
      list.sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity));
    } else if (sort === 'date-desc') list.sort((a, b) => b.taken_at.localeCompare(a.taken_at));
    else if (sort === 'date-asc') list.sort((a, b) => a.taken_at.localeCompare(b.taken_at));
    else {
      list.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }));
      if (sort === 'name-desc') list.reverse();
    }
    return list;
  }, [narrowed, sort, albumPhotoIds]);

  const shown = useMemo(() => {
    const folderQ = folderFilter.trim().toLowerCase();
    const fileQ = fileFilter.trim().toLowerCase();
    return sorted.filter((p) => {
      const { folder, file } = splitPhotoPath(p.path);
      return (
        (!folderQ || folder.toLowerCase().includes(folderQ)) &&
        (!fileQ || file.toLowerCase().includes(fileQ)) &&
        (!showPickedOnly || picked.has(p.id))
      );
    });
  }, [sorted, folderFilter, fileFilter, showPickedOnly, picked]);

  // Random: a fresh sample (not counting ones already in the section).
  const randomPick = useMemo(
    () => (mode === 'random' ? sampleRandom(usable.filter((p) => !alreadyAdded.has(p.id)), Math.max(1, randomCount)) : []),
    // randomSeed: re-shuffles on "Shuffle again"
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, usable, alreadyAdded, randomCount, randomSeed]
  );

  const folders = useMemo(
    () =>
      Array.from(new Set((photos ?? []).map((p) => splitPhotoPath(p.path).folder).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      ),
    [photos]
  );

  useEffect(
    () => setVisibleCount(PAGE_SIZE),
    [mode, sort, folderFilter, fileFilter, showPickedOnly, startDate, endDate, nameQuery, randomCount, albumId, quality]
  );

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAllShown = () =>
    setPicked((cur) => {
      const next = new Set(cur);
      shown.forEach((p) => {
        if (!alreadyAdded.has(p.id)) next.add(p.id);
      });
      return next;
    });

  // Grid picks are added in the current sort order (then any picked under another mode or album
  // before switching, oldest first — so one group can mix them). Random adds its sample.
  const toAdd = useMemo(() => {
    if (!gridMode) return randomPick.map((p) => p.id);
    const order = new Map(sorted.map((p, i) => [p.id, i]));
    return (photos ?? [])
      .filter((p) => picked.has(p.id) && passesQualityFilter(p, quality))
      .sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) || a.taken_at.localeCompare(b.taken_at))
      .map((p) => p.id);
  }, [gridMode, randomPick, sorted, photos, picked, quality]);

  const tile = (p: PhotoDetail, interactive: boolean) => {
    const added = alreadyAdded.has(p.id);
    return (
      <button
        type="button"
        key={p.id}
        title={p.path}
        disabled={added || !interactive}
        className={`movie-maker__photo ${interactive && picked.has(p.id) ? 'movie-maker__photo--selected' : ''} ${added ? 'photo-picker__photo--added' : ''} ${interactive ? '' : 'photo-picker__photo--preview'}`}
        onClick={() => toggle(p.id)}
      >
        <img src={`/api/photos/${p.id}/image`} alt="" loading="lazy" />
        <PhotoQualityTags p={p} />
        <span className="movie-maker__photo-date">{added ? 'Already added' : fmtTakenDate(p.taken_at)}</span>
      </button>
    );
  };

  const list = gridMode ? shown : randomPick;

  return (
    <div className="modal-overlay photo-picker__overlay">
      <div className="modal-panel task-form movie-maker photo-picker">
        <h2>{title}</h2>
        {!photos && !loadError && <p className="hint">Loading photos…</p>}
        {loadError && (
          <p className="hint">
            Couldn't load the photo list. <button type="button" className="link-button" onClick={load}>Try again</button>
          </p>
        )}
        {photos && (
          <>
            <div className="task-form__row">
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="How to pick photos">
                <option value="date-range">By date taken</option>
                <option value="name">By folder or filename</option>
                <option value="album">From an album</option>
                <option value="random">Random</option>
                <option value="manual">Choose from the grid</option>
              </select>
            </div>

            {mode === 'date-range' && (
              <div className="task-form__row">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="From" />
                <span className="hint">to</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="To" />
              </div>
            )}
            {mode === 'name' && (
              <>
                <input placeholder="e.g. Vacation, 2023, Christmas…" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
                <p className="hint">Matches anywhere in the folder path or filename under PHOTOS_DIR.</p>
              </>
            )}
            {mode === 'album' && (
              <select value={albumId} onChange={(e) => setAlbumId(e.target.value)} aria-label="Album">
                <option value="">Pick an album…</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>{a.is_favorites ? '⭐ ' : ''}{a.name} ({a.count})</option>
                ))}
              </select>
            )}
            {mode === 'random' && (
              <div className="task-form__row">
                <label className="member-form__label member-form__label--inline">
                  How many
                  <input type="number" min={1} value={randomCount} onChange={(e) => setRandomCount(Number(e.target.value) || 1)} />
                </label>
                <button type="button" className="secondary" onClick={() => setRandomSeed((n) => n + 1)}>🔀 Shuffle again</button>
              </div>
            )}

            <PhotoQualityOptions value={quality} onChange={setQuality} />

            {!ready && (
              <p className="hint">
                {mode === 'date-range'
                  ? 'Pick both dates to see the photos taken then.'
                  : mode === 'name'
                    ? 'Type part of a folder or filename to see the matching photos.'
                    : 'Pick an album to see its photos.'}
              </p>
            )}

            {gridMode && ready && (
              <>
                <div className="task-form__row">
                  <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort photos">
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
                    list="photo-picker-folders"
                    value={folderFilter}
                    onChange={(e) => setFolderFilter(e.target.value)}
                    aria-label="Filter by folder"
                  />
                  <datalist id="photo-picker-folders">
                    {folders.map((f) => <option key={f} value={f} />)}
                  </datalist>
                  <input
                    placeholder="Filename contains…"
                    value={fileFilter}
                    onChange={(e) => setFileFilter(e.target.value)}
                    aria-label="Filter by filename"
                  />
                </div>
                <div className="task-form__row">
                  <button type="button" className="secondary" onClick={selectAllShown} disabled={shown.length === 0}>
                    Select all shown ({shown.filter((p) => !alreadyAdded.has(p.id)).length})
                  </button>
                  <button type="button" className="secondary" onClick={() => setPicked(new Set())} disabled={picked.size === 0}>
                    Clear selection
                  </button>
                  <label className="member-form__label member-form__label--inline">
                    <input type="checkbox" checked={showPickedOnly} onChange={(e) => setShowPickedOnly(e.target.checked)} />
                    Show only picked
                  </label>
                </div>
              </>
            )}

            {mode === 'random' && (
              <p className="hint">
                {randomPick.length} random photo{randomPick.length === 1 ? '' : 's'}
                {alreadyAdded.size ? ' (not counting ones already in this section)' : ''}.
              </p>
            )}

            {ready && list.length > 0 && (
              <div className="movie-maker__photo-grid">{list.slice(0, visibleCount).map((p) => tile(p, gridMode))}</div>
            )}
            {gridMode && ready && shown.length === 0 && <p className="hint">No photos match.</p>}
            {ready && visibleCount < list.length && (
              <button type="button" className="secondary" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Show more ({list.length - visibleCount} left)
              </button>
            )}
            {gridMode && picked.size > 0 && (
              <p className="hint">{picked.size} picked — added in the order shown by the sort above.</p>
            )}
          </>
        )}
        <div className="task-form__row">
          <button type="button" onClick={() => onAdd(toAdd)} disabled={toAdd.length === 0}>
            Add {toAdd.length || ''} picture{toAdd.length === 1 ? '' : 's'}
          </button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
