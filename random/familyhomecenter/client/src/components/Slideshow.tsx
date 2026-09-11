import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

interface Props {
  intervalSeconds: number;
  onExit: () => void;
}

/** Fullscreen family-photo screensaver, shown after the dashboard has been idle. Tap anywhere to exit. */
export function Slideshow({ intervalSeconds, onExit }: Props) {
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const next = () => {
      api
        .get<{ id: string }>('/photos/random')
        .then((p) => {
          if (cancelled) return;
          setFading(true);
          setTimeout(() => {
            setPhotoId(p.id);
            setFading(false);
          }, 400);
        })
        .catch(() => {
          /* no photos configured yet — clock-only screensaver is still fine */
        });
    };
    next();
    const interval = setInterval(next, intervalSeconds * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [intervalSeconds]);

  return (
    <div className="slideshow" onClick={onExit} onTouchStart={onExit}>
      {photoId && (
        <img
          className={`slideshow__image ${fading ? 'slideshow__image--fading' : ''}`}
          src={`/api/photos/${photoId}/image`}
          alt=""
        />
      )}
      <div className="slideshow__clock">
        {new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
      </div>
      {!photoId && <div className="slideshow__empty">Add photos to PHOTOS_DIR to see them here ✨</div>}
    </div>
  );
}
