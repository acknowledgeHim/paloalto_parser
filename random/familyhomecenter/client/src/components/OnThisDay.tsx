import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

interface OnThisDayPhoto {
  id: string;
  year: number;
  taken_at: string;
}

/** Dashboard card: photos taken on today's date in earlier years. Renders nothing on days with
 *  none, so it only shows up when there's something to show. Refreshes every few minutes and when
 *  the screen comes back into view — a kiosk can sit on the Dashboard all day, and a photo hidden
 *  elsewhere (or midnight) should show up here without a reload. 🙈 in the viewer hides one. */
export function OnThisDay() {
  const [photos, setPhotos] = useState<OnThisDayPhoto[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);

  const load = () => api.get<OnThisDayPhoto[]>('/photos/on-this-day').then(setPhotos).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60_000);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hide = async (id: string) => {
    const left = photos.filter((p) => p.id !== id);
    setPhotos(left);
    setViewing((v) => (v === null || left.length === 0 ? null : Math.min(v, left.length - 1)));
    await api.post('/photos/hidden', { add: [id] }).catch(() => {});
    load();
  };

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
          <button
            type="button"
            className="on-this-day__hide"
            title="Hide this photo — keeps it out of On this day, the slideshow, and the photo pickers (the file isn't touched)"
            onClick={(e) => { e.stopPropagation(); hide(photos[viewing].id); }}
          >
            🙈 Hide
          </button>
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
