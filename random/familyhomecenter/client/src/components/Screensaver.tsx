import { useEffect, useRef, useState } from 'react';
import { api, type ScreensaverMovie } from '../api/client.js';
import { Slideshow } from './Slideshow.js';

/**
 * What shows when the dashboard goes idle: a movie a parent picked for the screensaver (Photos →
 * Movies → 📺 Screensaver), looping, or otherwise the usual photo slideshow. Tapping exits either.
 */
export function Screensaver({ intervalSeconds, onExit }: { intervalSeconds: number; onExit: () => void }) {
  // undefined = still asking; null = no screensaver movie right now.
  const [movie, setMovie] = useState<ScreensaverMovie | null | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    api.get<ScreensaverMovie | null>('/movies/screensaver').then(setMovie).catch(() => setMovie(null));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !movie) return;
    video.muted = !movie.sound;
    // Browsers often refuse to start a video *with sound* that the user didn't just tap to play —
    // fall back to playing it silently rather than showing a frozen frame.
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
  }, [movie]);

  if (movie === undefined) return <div className="screensaver-movie" onClick={onExit} />;
  if (!movie) return <Slideshow intervalSeconds={intervalSeconds} onExit={onExit} />;
  return (
    <div className="screensaver-movie" onClick={onExit}>
      <video ref={videoRef} src={`/api/movies-media/${movie.file_name}`} loop playsInline muted={!movie.sound} />
    </div>
  );
}
