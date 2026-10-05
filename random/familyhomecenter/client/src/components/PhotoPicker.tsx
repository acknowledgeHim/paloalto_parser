import { useEffect, useMemo, useState } from 'react';
import { api, type PhotoDetail } from '../api/client.js';
import { fmtTakenDate, splitPhotoPath } from '../utils/photoDetails.js';

type Sort = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

const PAGE_SIZE = 90;

interface Props {
  title: string;
  /** Already in the section — shown as such and not picked again. */
  alreadyAdded: Set<string>;
  /** Picked photo ids, in the grid's current sort order. */
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}

/**
 * A pop-over photo grid for picking a group of pictures — same sort (date taken, folder/filename),
 * separate folder and filename filters, and select-all-shown as the movie maker's grid. Picks are
 * returned in the grid's sort order, so e.g. "oldest first" adds them chronologically.
 */
export function PhotoPicker({ title, alreadyAdded, onAdd, onClose }: Props) {
  const [photos, setPhotos] = useState<PhotoDetail[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [sort, setSort] = useState<Sort>('date-asc');
  const [folderFilter, setFolderFilter] = useState('');
  const [fileFilter, setFileFilter] = useState('');
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

  const shown = useMemo(() => {
    const folderQ = folderFilter.trim().toLowerCase();
    const fileQ = fileFilter.trim().toLowerCase();
    return sorted.filter((p) => {
      const { folder, file } = splitPhotoPath(p.path);
      return (!folderQ || folder.toLowerCase().includes(folderQ)) && (!fileQ || file.toLowerCase().includes(fileQ));
    });
  }, [sorted, folderFilter, fileFilter]);

  const folders = useMemo(
    () =>
      Array.from(new Set((photos ?? []).map((p) => splitPhotoPath(p.path).folder).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      ),
    [photos]
  );

  useEffect(() => setVisibleCount(PAGE_SIZE), [sort, folderFilter, fileFilter]);

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

  const add = () => onAdd(sorted.filter((p) => picked.has(p.id)).map((p) => p.id));

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
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort photos">
                <option value="date-asc">Date taken (oldest first)</option>
                <option value="date-desc">Date taken (newest first)</option>
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
                Clear
              </button>
            </div>
            <div className="movie-maker__photo-grid">
              {shown.slice(0, visibleCount).map((p) => {
                const added = alreadyAdded.has(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    title={p.path}
                    disabled={added}
                    className={`movie-maker__photo ${picked.has(p.id) ? 'movie-maker__photo--selected' : ''} ${added ? 'photo-picker__photo--added' : ''}`}
                    onClick={() => toggle(p.id)}
                  >
                    <img src={`/api/photos/${p.id}/image`} alt="" loading="lazy" />
                    <span className="movie-maker__photo-date">{added ? 'Already added' : fmtTakenDate(p.taken_at)}</span>
                  </button>
                );
              })}
            </div>
            {shown.length === 0 && <p className="hint">No photos match that filter.</p>}
            {visibleCount < shown.length && (
              <button type="button" className="secondary" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Show more ({shown.length - visibleCount} left)
              </button>
            )}
          </>
        )}
        <div className="task-form__row">
          <button type="button" onClick={add} disabled={picked.size === 0}>
            Add {picked.size || ''} picture{picked.size === 1 ? '' : 's'}
          </button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
