import { useEffect, useState } from 'react';
import { api, type Photo } from '../api/client.js';
import { Slideshow } from '../components/Slideshow.js';

export function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [slideshowOn, setSlideshowOn] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<Photo[]>('/photos').then(setPhotos).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

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

      {loading && <div className="empty-state">Loading photos…</div>}
      {!loading && photos.length === 0 && (
        <div className="empty-state">
          No photos found yet — add some to PHOTOS_DIR (a local folder or SMB share, see
          docs/PHOTOS_SETUP.md) and tap Refresh.
        </div>
      )}

      <div className="photos-page__grid">
        {photos.map((p, i) => (
          <button key={p.id} className="photos-page__thumb" onClick={() => setViewingIndex(i)}>
            <img src={`/api/photos/${p.id}/image`} alt="" loading="lazy" />
          </button>
        ))}
      </div>

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
