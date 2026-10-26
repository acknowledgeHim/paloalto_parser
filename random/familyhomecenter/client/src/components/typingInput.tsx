import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

/** ⌨️ Shared by the Typing page and its games (pages/TypingPage.tsx, components/TypingGames.tsx). */

export interface RoundResult {
  mode: 'lesson' | 'balloon' | 'race' | 'whack' | 'meteor' | 'tower' | 'snake' | 'story' | 'daily' | 'shop';
  level: number;
  wpm: number;
  accuracy: number;
  chars: number;
  seconds: number;
  score: number;
  passed: boolean;
}

export type Earned = { stars: number; reason: string | null };
/** Saves a finished round; answers with what it earned (or null when nobody's picked). */
export type SaveRound = (r: RoundResult) => Promise<Earned | null>;

/** An invisible box that keeps focus and turns key presses into onChar / onBack. Tap the play area
 *  to bring the on-screen keyboard up on a tablet. */
export function useTypeCatcher(onChar: (c: string) => void, onBack?: () => void, active = true) {
  const ref = useRef<HTMLInputElement>(null);
  const focus = () => ref.current?.focus({ preventScroll: true });
  useEffect(() => {
    if (active) focus();
  }, [active]);
  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      onBack?.();
    } else if (e.key.length === 1) {
      e.preventDefault();
      onChar(e.key);
    }
    // Anything else ('Unidentified' from a tablet keyboard) arrives through onInput.
  };
  const onInput = (e: React.FormEvent<HTMLInputElement>) => {
    const data = (e.nativeEvent as InputEvent).data;
    if (data) for (const c of data) onChar(c);
    e.currentTarget.value = '';
  };
  const input = (
    <input
      ref={ref}
      className="typing-catcher"
      aria-label="Type here"
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      onKeyDown={onKeyDown}
      onInput={onInput}
    />
  );
  return { input, focus };
}

