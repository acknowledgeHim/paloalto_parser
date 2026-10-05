import type { PhotoDetail } from '../api/client.js';
import { passesQualityFilter, type PhotoQualityFilter } from './photoDetails.js';

/** A section a template or "Add sections by day" starts a document with. */
export interface TemplateSection {
  heading: string;
  text: string;
  /** Shown as the text box's placeholder — a writing prompt, never saved into the document. */
  prompt?: string;
  columns: 1 | 2 | 3;
  photoIds: string[];
}

/** The local calendar day a photo was taken, as YYYY-MM-DD. */
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Up to `n` photos spread evenly across a time-ordered list (first and last included), so a day or
 *  month is represented start to finish rather than just its first few shots. */
function pickSpread<T>(items: T[], n: number): T[] {
  if (n <= 0 || items.length <= n) return items;
  if (n === 1) return [items[Math.floor(items.length / 2)]];
  return Array.from({ length: n }, (_, i) => items[Math.round((i * (items.length - 1)) / (n - 1))]);
}

const byDate = (a: PhotoDetail, b: PhotoDetail) => a.taken_at.localeCompare(b.taken_at);

/** A section per day that has photos between `start` and `end` (YYYY-MM-DD, inclusive), headed
 *  "Day 1 · Mon, Jul 1". `maxPerDay` 0 = all of them. */
export function sectionsByDay(
  photos: PhotoDetail[],
  start: string,
  end: string,
  maxPerDay: number,
  quality: PhotoQualityFilter
): TemplateSection[] {
  const days = new Map<string, PhotoDetail[]>();
  for (const p of photos.filter((p) => passesQualityFilter(p, quality)).sort(byDate)) {
    const day = localDay(p.taken_at);
    if (day < start || day > end) continue;
    days.set(day, [...(days.get(day) ?? []), p]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list], i) => ({
      heading: `Day ${i + 1} · ${new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`,
      text: '',
      prompt: 'What happened this day?',
      columns: 2 as const,
      photoIds: pickSpread(list, maxPerDay).map((p) => p.id),
    }));
}

/** A section per month of `year` that has photos, with up to `perMonth` spread across the month. */
export function yearInReview(photos: PhotoDetail[], year: number, perMonth: number, quality: PhotoQualityFilter): TemplateSection[] {
  const months = new Map<number, PhotoDetail[]>();
  for (const p of photos.filter((p) => passesQualityFilter(p, quality)).sort(byDate)) {
    const d = new Date(p.taken_at);
    if (d.getFullYear() !== year) continue;
    months.set(d.getMonth(), [...(months.get(d.getMonth()) ?? []), p]);
  }
  return [...months.entries()]
    .sort(([a], [b]) => a - b)
    .map(([month, list]) => ({
      heading: new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      text: '',
      prompt: 'Highlights from this month…',
      columns: 3 as const,
      photoIds: pickSpread(list, perMonth).map((p) => p.id),
    }));
}

/** The classic school-report outline, with a writing prompt in each section. */
export function schoolProject(): TemplateSection[] {
  return [
    { heading: 'Introduction', text: '', prompt: 'What is your project about, and why did you choose it?', columns: 1, photoIds: [] },
    { heading: 'What I did', text: '', prompt: 'Describe the steps you took. Add pictures of each step.', columns: 2, photoIds: [] },
    { heading: 'What I found out', text: '', prompt: 'What happened? What did you notice or measure?', columns: 2, photoIds: [] },
    { heading: 'Conclusion', text: '', prompt: 'What did you learn? What would you do differently next time?', columns: 1, photoIds: [] },
  ];
}
