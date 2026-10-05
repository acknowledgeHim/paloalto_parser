import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

interface OnThisDayPhoto {
  id: string;
  year: number;
  taken_at: string;
}

/** Dashboard card: photos taken on today's date in earlier years. Renders nothing on days with
 *  none, so it only shows up when there's something to show. */
export function OnThisDay() {
  const [photos, setPhotos] = useState<OnThisDayPhoto[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);

  useEffect(() => {
    api.get<OnThisDayPhoto[]>('/photos/on-this-day').then(setPhotos).catch(() => setPhotos([]));
  }, []);

  if (photos.length === 0) return null;
  const thisYear = new Date().getFullYear();
  const ago = (year: number) => {
    const n = thisYear - year;
    return n === 1 ? '1 year ago' : `${n} years ago`;
  };

  return (
    <section className="panel on-this-day">
      <h2>📅 On this day</h2>
      <div className="on-this-day__strip">
        {photos.map((p, i) => (
          <button key={p.id} type="button" className="on-this-day__photo" onClick={() => setViewing(i)}>
            <img src={`/api/photos/${p.id}/image`} alt="" loading="lazy" />
            <span>{ago(p.year)}</span>
          </button>
        ))}
      </div>
      {viewing !== null && (
        <div className="photo-lightbox" onClick={() => setViewing(null)}>
          <img src={`/api/photos/${photos[viewing].id}/image`} alt="" />
          <div className="on-this-day__caption">{ago(photos[viewing].year)} · {photos[viewing].year}</div>
          <button className="photo-lightbox__close" onClick={(e) => { e.stopPropagation(); setViewing(null); }}>✕</button>
          {photos.length > 1 && (
            <>
              <button
                className="photo-lightbox__nav photo-lightbox__nav--prev"
                onClick={(e) => { e.stopPropagation(); setViewing((viewing - 1 + photos.length) % photos.length); }}
              >
                ‹
              </button>
              <button
                className="photo-lightbox__nav photo-lightbox__nav--next"
                onClick={(e) => { e.stopPropagation(); setViewing((viewing + 1) % photos.length); }}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
