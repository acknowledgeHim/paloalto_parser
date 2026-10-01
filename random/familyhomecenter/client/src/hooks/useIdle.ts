import { useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel'] as const;

/** Whether any <video> on the page is currently playing — e.g. a movie from Photos → Movies, which
 *  someone is watching without touching the screen. */
function isVideoPlaying(): boolean {
  return Array.from(document.querySelectorAll('video')).some((v) => !v.paused && !v.ended);
}

/** True once the user hasn't interacted (touch/mouse/keyboard) for `timeoutMs`. A playing video
 *  counts as activity: the idle check is pushed back until it's paused or finished, so the
 *  screensaver never comes up over (and unmounts) a movie mid-watch. */
export function useIdle(timeoutMs: number): boolean {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const reset = () => {
      setIdle(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(check, timeoutMs);
    };
    const check = () => {
      if (isVideoPlaying()) timer.current = setTimeout(check, timeoutMs);
      else setIdle(true);
    };
    reset();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [timeoutMs]);

  return idle;
}
