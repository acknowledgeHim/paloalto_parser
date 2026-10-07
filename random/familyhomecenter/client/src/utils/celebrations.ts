import { api, type Task } from '../api/client.js';
import { isTaskDoneFor } from './tasks.js';

/**
 * The "all done!" celebrations: a few seconds of full-screen animation when someone checks off the
 * last of their chores for the day (or the last of their to-dos). Each person picks one for chores
 * and one for to-dos (FamilyMemberFormModal); drawn on a canvas by components/Celebration.tsx — no
 * video files to ship, works offline on the Pi.
 */
export const CELEBRATIONS = [
  { id: 'confetti', label: '🎊 Confetti' },
  { id: 'fireworks', label: '🎆 Fireworks' },
  { id: 'balloons', label: '🎈 Balloons' },
  { id: 'rocket', label: '🚀 Rocket launch' },
  { id: 'unicorn', label: '🦄 Unicorn rainbow' },
  { id: 'dino', label: '🦖 Dino stomp' },
  { id: 'dance', label: '🕺 Dance party' },
  { id: 'trophy', label: '🏆 Trophy' },
  { id: 'none', label: 'None' },
] as const;

export const DEFAULT_CELEBRATION = 'confetti';

export type CelebrationId = Exclude<(typeof CELEBRATIONS)[number]['id'], 'none'>;

export interface CelebrateDetail {
  celebration: CelebrationId;
  name: string;
  kind: 'chore' | 'todo';
}

const EVENT = 'fhc:celebrate';

/** What a stored setting means: null → the default, 'none' / unknown → nothing. */
export function celebrationFor(setting: string | null | undefined): CelebrationId | null {
  const id = setting ?? DEFAULT_CELEBRATION;
  return CELEBRATIONS.some((c) => c.id === id) && id !== 'none' ? (id as CelebrationId) : null;
}

/** Plays one now (the preview button, or after the last task). Shown by <CelebrationHost/>. */
export function celebrate(detail: CelebrateDetail): void {
  window.dispatchEvent(new CustomEvent<CelebrateDetail>(EVENT, { detail }));
}

export function onCelebrate(fn: (d: CelebrateDetail) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<CelebrateDetail>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/**
 * Called right after someone checks something off: if that was the last of their chores (or
 * to-dos) for today, play their celebration. Looks at today's list fresh from the server, so it's
 * right whichever page the tick came from.
 */
export async function celebrateIfAllDone(
  member: { id: string; name: string; chore_celebration: string | null; todo_celebration: string | null },
  kind: 'chore' | 'todo'
): Promise<void> {
  const celebration = celebrationFor(kind === 'chore' ? member.chore_celebration : member.todo_celebration);
  if (!celebration) return;
  const tasks = await api.get<Task[]>('/tasks');
  const mine = tasks.filter((t) => t.kind === kind && t.assignee_ids.includes(member.id));
  if (mine.length && mine.every((t) => isTaskDoneFor(t, member.id))) celebrate({ celebration, name: member.name, kind });
}
