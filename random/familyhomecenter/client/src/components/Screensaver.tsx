import { useEffect, useRef, useState } from 'react';
import { api, type ScreensaverMovie } from '../api/client.js';
import { Slideshow } from './Slideshow.js';
import { ScreensaverExtras } from './ScreensaverExtras.js';
import { RecapStory } from './RecapStory.js';

/** When the 🎞️ weekend recap last played, so it comes round every so often, not every time. */
let recapAt = 0;
const RECAP_EVERY_MS = 20 * 60_000;
const recapDue = () => [0, 6].includes(new Date().getDay()) && Date.now() - recapAt > RECAP_EVERY_MS;

/**
 * What shows when the dashboard goes idle: a movie a parent picked for the screensaver (Photos →
 * Movies → 📺 Screensaver), looping, or otherwise the usual photo slideshow. Tapping exits either.
 */
export function Screensaver({ intervalSeconds, onExit, recap = true }: { intervalSeconds: number; onExit: () => void; recap?: boolean }) {
  // On a weekend, "Our week" plays first (and again every 20 minutes), then the usual screensaver.
  const [recapping, setRecapping] = useState(() => recap && recapDue());
  useEffect(() => {
    if (!recap) return;
    const t = setInterval(() => recapDue() && setRecapping(true), 60_000);
    return () => clearInterval(t);
  }, [recap]);
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

  if (recapping) {
    return (
      <RecapStory
        fullScreen
        onExit={onExit}
        onDone={() => {
          recapAt = Date.now();
          setRecapping(false);
        }}
      />
    );
  }
  if (movie === undefined) return <div className="screensaver-movie" onClick={onExit} />;
  if (!movie) return <Slideshow intervalSeconds={intervalSeconds} onExit={onExit} />;
  return (
    <div className="screensaver-movie" onClick={onExit}>
      <video ref={videoRef} src={`/api/movies-media/${movie.file_name}`} loop playsInline muted={!movie.sound} />
      <ScreensaverExtras />
    </div>
  );
}
