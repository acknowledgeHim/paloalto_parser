import type { Task } from '../api/client.js';

// Covers the common chores (sweeping 🧹, dishes 🍽️🥣, unloading the dishwasher 🍽️, making a bed
// 🛏️, cooking 🍳, wiping counters 🧽, cleaning a room 🛋️, cleaning the bathroom 🚽🚿🛁, feeding
// chickens 🐔/cats 🐱, taking out the garbage 🗑️, watering plants 💧) plus a general-purpose
// spread for everything else. Deliberately stuck to emoji from 2018 or earlier (Unicode 11 and
// below) — a handful of newer ones (toothbrush/potted plant/bucket/window) showed up as "tofu
// box" placeholders on a real device here, since an emoji font package installed before
// ~2019–2020 simply has no glyph for them yet; these are old enough to be safe everywhere.
export const TASK_ICON_PRESETS = [
  '🧹', '🧺', '🍽️', '🥣', '🧼', '🛏️', '🗑️', '🧽',
  '🧻', '🚽', '🚿', '🛁', '🐶', '🐱', '🐔', '🌱',
  '💧', '🛋️', '🚗', '📚', '🧦', '🔧', '🧸', '🎒',
  '🖥️', '🧃', '🍳', '🧴', '🚪', '⭐',
] as const;

/** This task's checkpoint icon, or a generic fallback by kind when it has none set. */
export function taskIcon(task: Pick<Task, 'icon' | 'kind'>): string {
  return task.icon || (task.kind === 'chore' ? '🧹' : '📝');
}
