import type { Task } from '../api/client.js';

// Covers the common chores (sweeping 🧹, dishes 🍽️, making a bed 🛏️, cooking 🍳, wiping counters
// 🧽, cleaning a room 🪣, feeding chickens 🐔/cats 🐱, taking out the garbage 🗑️, watering plants
// 🪴) plus a general-purpose spread for everything else.
export const TASK_ICON_PRESETS = [
  '🧹', '🧺', '🍽️', '🛏️', '🗑️', '🧽', '🧻', '🪥',
  '🐶', '🐱', '🐔', '🌱', '🪴', '🪣', '🚗', '📚',
  '🧦', '🛁', '🔧', '🧸', '🎒', '🖥️', '🧃', '🍳',
  '🧴', '🪟', '⭐',
] as const;

/** This task's checkpoint icon, or a generic fallback by kind when it has none set. */
export function taskIcon(task: Pick<Task, 'icon' | 'kind'>): string {
  return task.icon || (task.kind === 'chore' ? '🧹' : '📝');
}
