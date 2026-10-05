import { useEffect, useMemo, useState } from 'react';
import { api, type PhotoDetail } from '../api/client.js';
import { fmtTakenDate, splitPhotoPath } from '../utils/photoDetails.js';

/** The same ways to pick photos as the movie maker, in the same order. */
type Mode = 'date-range' | 'name' | 'random' | 'manual';
type Sort = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

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

/**
 * A pop-over for picking a group of pictures, with the movie maker's options: by date taken (a
 * range), by folder or filename, random, or choose from the grid (sort, separate folder/filename
 * filters, select all shown, show only picked). Everything works off GET /photos/details, so the
 * date range uses the same "date taken" (EXIF, else file date) as the movie maker.
 */
export function PhotoPicker({ title, alreadyAdded, onAdd, onClose }: Props) {
  const [photos, setPhotos] = useState<PhotoDetail[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<Mode>('manual');
  // Date range / name / random
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [randomCount, setRandomCount] = useState(10);
  const [randomSeed, setRandomSeed] = useState(0); // bump to shuffle again
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

  const sorted = useMemo(() => {
    const list = [...(photos ?? [])];
    if (sort === 'date-desc') list.sort((a, b) => b.taken_at.localeCompare(a.taken_at));
    else if (sort === 'date-asc') list.sort((a, b) => a.taken_at.localeCompare(b.taken_at));
    else {
      list.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }));
      if (sort === 'name-desc') list.reverse();
    }
    return list;
  }, [photos, sort]);

  // What the date-range / name / random modes match (not counting ones already in the section).
  // Order follows the movie maker: date range oldest first, name in folder/filename order.
  const matches = useMemo(() => {
    const available = (photos ?? []).filter((p) => !alreadyAdded.has(p.id));
    if (mode === 'date-range') {
      if (!startDate || !endDate) return [];
      const start = new Date(`${startDate}T00:00:00`).getTime();
      const end = new Date(`${endDate}T23:59:59`).getTime();
      return available
        .filter((p) => {
          const t = new Date(p.taken_at).getTime();
          return t >= start && t <= end;
        })
        .sort((a, b) => a.taken_at.localeCompare(b.taken_at));
    }
    if (mode === 'name') {
      const q = nameQuery.trim().toLowerCase();
      if (!q) return [];
      return available
        .filter((p) => p.path.toLowerCase().includes(q))
        .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }));
    }
    if (mode === 'random') return sampleRandom(available, Math.max(1, randomCount));
    return [];
    // randomSeed: re-shuffles on "Shuffle again"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, alreadyAdded, mode, startDate, endDate, nameQuery, randomCount, randomSeed]);

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

  const folders = useMemo(
    () =>
      Array.from(new Set((photos ?? []).map((p) => splitPhotoPath(p.path).folder).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      ),
    [photos]
  );

  useEffect(() => setVisibleCount(PAGE_SIZE), [mode, sort, folderFilter, fileFilter, showPickedOnly, startDate, endDate, nameQuery, randomCount]);

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

  // Grid picks are added in the grid's sort order; the other modes in their match order.
  const toAdd = mode === 'manual' ? sorted.filter((p) => picked.has(p.id)).map((p) => p.id) : matches.map((p) => p.id);

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
        <span className="movie-maker__photo-date">{added ? 'Already added' : fmtTakenDate(p.taken_at)}</span>
      </button>
    );
  };

  const list = mode === 'manual' ? shown : matches;

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
            {mode === 'random' && (
              <div className="task-form__row">
                <label className="member-form__label member-form__label--inline">
                  How many
                  <input type="number" min={1} value={randomCount} onChange={(e) => setRandomCount(Number(e.target.value) || 1)} />
                </label>
                <button type="button" className="secondary" onClick={() => setRandomSeed((n) => n + 1)}>🔀 Shuffle again</button>
              </div>
            )}

            {mode === 'manual' && (
              <>
                <div className="task-form__row">
                  <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort photos">
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
                    Select all shown ({shown.length})
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

            {mode !== 'manual' && (
              <p className="hint">
                {mode === 'date-range' && (!startDate || !endDate)
                  ? 'Pick both dates.'
                  : mode === 'name' && !nameQuery.trim()
                    ? 'Type part of a folder or filename.'
                    : `${matches.length} photo${matches.length === 1 ? '' : 's'} match${matches.length === 1 ? 'es' : ''}${alreadyAdded.size ? ' (not counting ones already in this section)' : ''}.`}
              </p>
            )}

            {list.length > 0 && (
              <div className="movie-maker__photo-grid">{list.slice(0, visibleCount).map((p) => tile(p, mode === 'manual'))}</div>
            )}
            {mode === 'manual' && shown.length === 0 && <p className="hint">No photos match that filter.</p>}
            {visibleCount < list.length && (
              <button type="button" className="secondary" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Show more ({list.length - visibleCount} left)
              </button>
            )}
            {mode === 'manual' && <p className="hint">Picked photos are added in the order shown by the sort above.</p>}
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
