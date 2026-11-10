import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * ⛶ Full screen for a game: the browser's own full screen for that one element (the menus and the
 * rest of the page go away), and — where a browser doesn't allow it (iPhone Safari) — the game
 * just fills the window instead. Esc, or the button again, goes back. Leaving the game leaves full
 * screen too.
 */
type WebkitDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type WebkitEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const fullscreenElement = () => document.fullscreenElement ?? (document as WebkitDoc).webkitFullscreenElement ?? null;

export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [real, setReal] = useState(false);
  const [fake, setFake] = useState(false);

  useEffect(() => {
    const changed = () => {
      const on = fullscreenElement() !== null && fullscreenElement() === ref.current;
      setReal(on);
      if (on) setFake(false); // the real one arrived after all
    };
    document.addEventListener('fullscreenchange', changed);
    document.addEventListener('webkitfullscreenchange', changed);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      document.removeEventListener('webkitfullscreenchange', changed);
    };
  }, []);

  // Filling the window: no page scrolling underneath, and Esc goes back.
  useEffect(() => {
    if (!fake) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setFake(false);
    window.addEventListener('keydown', key);
    document.body.classList.add('game-full-lock');
    return () => {
      window.removeEventListener('keydown', key);
      document.body.classList.remove('game-full-lock');
    };
  }, [fake]);

  // Leaving the game: out of full screen.
  useEffect(
    () => () => {
      if (ref.current && fullscreenElement() === ref.current) void Promise.resolve((document.exitFullscreen ?? (document as WebkitDoc).webkitExitFullscreen)?.call(document)).catch(() => {});
    },
    []
  );

  const toggle = useCallback(async () => {
    const el = ref.current as WebkitEl | null;
    if (!el) return;
    if (fullscreenElement() === el) {
      await Promise.resolve((document.exitFullscreen ?? (document as WebkitDoc).webkitExitFullscreen)?.call(document)).catch(() => {});
      return;
    }
    if (fake) return setFake(false);
    const ask = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (ask) {
      // Some browsers never answer (or say no): if it hasn't gone full screen in a moment, fill the window.
      const asked = Promise.resolve(ask.call(el)).then(
        () => true,
        () => false
      );
      const ok = await Promise.race([asked, new Promise<boolean>((r) => setTimeout(() => r(false), 800))]);
      if (ok || fullscreenElement() === el) return;
    }
    setFake(true);
  }, [fake]);

  return { ref, full: real || fake, fake, toggle };
}

/** The ⛶ button (put `is-fake-full` on the game while `fake`, for filling the window). */
export function FullscreenButton({ full, toggle, className = '' }: { full: boolean; toggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`game-full-btn ${className}`}
      aria-pressed={full}
      title={full ? 'Back to the normal size (Esc)' : 'Fill the whole screen'}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {full ? '🗗 Exit full screen' : '⛶ Full screen'}
    </button>
  );
}
