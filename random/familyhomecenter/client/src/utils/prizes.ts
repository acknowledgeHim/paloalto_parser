import type { Prize } from '../api/client.js';
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
