import { useEffect, useState } from 'react';
import { api, type Prize, type Task } from '../api/client.js';
import { formatHours } from './tasks.js';

/** A prize's emoji: its own, else 💲 for money, ⭐ for stars, 🎁 for anything else. */
export function prizeEmoji(prize: Pick<Prize, 'emoji' | 'reward_kind'>): string {
  if (prize.emoji) return prize.emoji;
  if (prize.reward_kind === 'money') return '💲';
  if (prize.reward_kind === 'stars') return '⭐';
  return '🎁';
}

/** What claiming it pays in, if anything: "+$10.00", "+20 ⭐". */
export function prizeRewardLabel(prize: Pick<Prize, 'reward_kind' | 'reward_amount'>): string | null {
  if (prize.reward_kind === 'money' && prize.reward_amount) return `+$${prize.reward_amount.toFixed(2)}`;
  if (prize.reward_kind === 'stars' && prize.reward_amount) return `+${prize.reward_amount} ⭐`;
  return null;
}

/** "4 h", "5×" — how much of a job a prize needs. */
export function amountLabel(amount: number, unit: 'hours' | 'times'): string {
  return unit === 'hours' ? `${formatHours(amount)} h` : `${amount}×`;
}

/** A chore/to-do reward's emoji: its own, else 💲 money, ⭐ stars, 🎁 anything else. */
export function taskRewardEmoji(task: Pick<Task, 'reward_type' | 'reward_emoji'>): string {
  return prizeEmoji({ emoji: task.reward_emoji ?? null, reward_kind: task.reward_type });
}

/** What a chore/to-do pays, for its badge: "$2.00", "3", "Movie time"; null if nothing. */
export function taskRewardText(task: Pick<Task, 'reward_type' | 'reward_amount' | 'reward_text'>): string | null {
  if (task.reward_type === 'money' && task.reward_amount) return `$${task.reward_amount.toFixed(2)}`;
  if (task.reward_type === 'stars' && task.reward_amount) return String(task.reward_amount);
  if (task.reward_type === 'custom' && task.reward_text) return task.reward_text;
  return null;
}

/**
 * The ids of every job that counts toward a prize box. Those are kept off the regular floor plan and
 * shown on the Prize Bank's own map instead. null until loaded. Reloads on a 'prizes-changed' event.
 */
export function usePrizeJobIds(): Set<string> | null {
  const [ids, setIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    const load = () =>
      api
        .get<Prize[]>('/prizes')
        .then((all) =>
          setIds(new Set(all.flatMap((p) => [...(p.requirements ?? []).map((r) => r.task_id), ...(p.task_id ? [p.task_id] : [])])))
        )
        .catch(() => setIds(new Set()));
    load();
    window.addEventListener('prizes-changed', load);
    return () => window.removeEventListener('prizes-changed', load);
  }, []);
  return ids;
}
