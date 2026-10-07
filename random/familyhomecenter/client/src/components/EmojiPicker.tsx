import { useMemo, useState } from 'react';
import { EMOJI_CATEGORIES } from '../utils/emojiCatalog.js';

/**
 * An emoji choice (avatar, chore/to-do icon, Adventure Map start/end): the usual suggestions up
 * front, exactly as before, and "More emoji…" for the full catalog by category. Catalog emoji the
 * screen's font can't draw (they'd show as a blank box) are left out — so upgrading the Pi's emoji
 * font (docs/EMOJI_FONT.md) brings the newer ones in on its own. Only the emoji character itself is
 * stored, never an image.
 */
export function EmojiPicker({
  value,
  onPick,
  suggestions,
  before,
}: {
  value: string | null | undefined;
  /** Called with the tapped emoji — the caller decides whether tapping the current one clears it. */
  onPick: (emoji: string) => void;
  suggestions: readonly string[];
  /** Extra buttons ahead of the suggestions (e.g. a "default" choice). */
  before?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(EMOJI_CATEGORIES[0].id);
  // Something picked from the catalog stays in view up front, so you can see (and un-pick) it.
  const front = value && !suggestions.includes(value) ? [value, ...suggestions] : suggestions;
  const shown = useMemo(() => {
    if (!open) return [];
    const list = EMOJI_CATEGORIES.find((c) => c.id === category)?.emoji ?? [];
    return [...new Set(list)].filter(canDraw);
  }, [open, category]);

  const button = (em: string) => (
    <button
      key={em}
      type="button"
      className={`member-form__emoji ${value === em ? 'member-form__emoji--selected' : ''}`}
      onClick={() => onPick(em)}
    >
      {em}
    </button>
  );

  return (
    <div className="emoji-picker">
      <div className="member-form__swatches">
        {before}
        {front.map(button)}
      </div>
      <button type="button" className="link-button emoji-picker__more" onClick={() => setOpen((v) => !v)}>
        {open ? 'Fewer emoji ▴' : 'More emoji… ▾'}
      </button>
      {open && (
        <>
          <div className="emoji-picker__tabs">
            {EMOJI_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`emoji-picker__tab ${category === c.id ? 'emoji-picker__tab--active' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="member-form__swatches emoji-picker__grid">{shown.map(button)}</div>
        </>
      )}
    </div>
  );
}

// ---- Can this screen draw it? ----

const SIZE = 24;
const drawable = new Map<string, boolean>();
let probe: CanvasRenderingContext2D | null | undefined;
/** What a character the font doesn't have looks like (a "tofu" box, or nothing). */
let missing: Uint8ClampedArray | null = null;

function render(text: string): Uint8ClampedArray {
  probe!.clearRect(0, 0, SIZE, SIZE);
  probe!.fillText(text, 0, 0);
  return probe!.getImageData(0, 0, SIZE, SIZE).data;
}

/**
 * Draws the emoji on a tiny canvas and compares it with how a character that doesn't exist comes
 * out: the same picture (a blank "tofu" box) or nothing at all means this font can't draw it.
 * Remembered per emoji.
 */
function canDraw(emoji: string): boolean {
  const known = drawable.get(emoji);
  if (known !== undefined) return known;
  if (probe === undefined) {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    probe = c.getContext('2d', { willReadFrequently: true });
    if (probe) {
      probe.font = `${SIZE - 4}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      probe.textBaseline = 'top';
      probe.fillStyle = '#000';
      missing = render('\u{10FFFD}'); // a private-use character no font draws
    }
  }
  let ok = true; // can't check → show it
  if (probe && missing) {
    const px = render(emoji);
    let blank = true;
    let sameAsMissing = true;
    for (let i = 0; i < px.length; i++) {
      if (px[i] !== missing[i]) sameAsMissing = false;
      if ((i & 3) === 3 && px[i] > 0) blank = false;
      if (!sameAsMissing && !blank) break;
    }
    ok = !blank && !sameAsMissing;
  }
  drawable.set(emoji, ok);
  return ok;
}
