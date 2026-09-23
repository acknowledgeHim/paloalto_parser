// Fun visual presets for a person's Family Board progress bars — each is just a CSS gradient
// (or pattern) applied to the bar's fill, no images/assets needed.
export const PROGRESS_STYLES = [
  { id: 'solid', label: 'Solid', fill: null }, // null = use the person's own color, plain
  { id: 'rainbow', label: 'Rainbow', fill: 'linear-gradient(90deg, #ff5f6d, #ffc371, #f9f871, #4ade80, #38bdf8, #a78bfa)' },
  { id: 'ocean', label: 'Ocean', fill: 'linear-gradient(90deg, #0f2027, #2c5364, #38bdf8)' },
  { id: 'sunset', label: 'Sunset', fill: 'linear-gradient(90deg, #f97316, #ec4899, #a855f7)' },
  { id: 'candy', label: 'Candy', fill: 'linear-gradient(90deg, #f472b6, #fb7185, #fda4af)' },
  { id: 'stripes', label: 'Stripes', fill: 'repeating-linear-gradient(45deg, #38bdf8, #38bdf8 10px, #0ea5e9 10px, #0ea5e9 20px)' },
  { id: 'gold', label: 'Gold', fill: 'linear-gradient(90deg, #fbbf24, #f59e0b, #d97706)' },
  { id: 'mint', label: 'Mint', fill: 'linear-gradient(90deg, #34d399, #10b981, #059669)' },
  { id: 'berry', label: 'Berry', fill: 'linear-gradient(90deg, #86198f, #c026d3, #e879f9)' },
  { id: 'forest', label: 'Forest', fill: 'linear-gradient(90deg, #14532d, #16a34a, #4ade80)' },
  { id: 'lava', label: 'Lava', fill: 'linear-gradient(90deg, #7f1d1d, #dc2626, #f97316)' },
  { id: 'sky', label: 'Sky', fill: 'linear-gradient(90deg, #0284c7, #38bdf8, #bae6fd)' },
  { id: 'lavender', label: 'Lavender', fill: 'linear-gradient(90deg, #7c3aed, #a78bfa, #ede9fe)' },
  { id: 'slate', label: 'Slate', fill: 'linear-gradient(90deg, #334155, #64748b, #94a3b8)' },
  { id: 'dots', label: 'Dots', fill: 'repeating-radial-gradient(circle at 8px 8px, #ffffff80 0, #ffffff80 3px, transparent 4px, transparent 16px), #6366f1' },
] as const;

export type ProgressStyleId = (typeof PROGRESS_STYLES)[number]['id'];

export function progressFillFor(styleId: string | null | undefined, fallbackColor: string): string {
  const style = PROGRESS_STYLES.find((s) => s.id === styleId);
  return style?.fill ?? fallbackColor;
}
