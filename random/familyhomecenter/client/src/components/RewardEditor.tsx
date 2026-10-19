import { useState } from 'react';
import { EmojiPicker } from './EmojiPicker.js';
import { prizeEmoji } from '../utils/prizes.js';

export type RewardType = 'stars' | 'money' | 'custom';

export interface RewardValue {
  type: RewardType;
  amount: number;
  /** What they earn, for a custom reward ("Movie time"). */
  text: string;
  /** null = the default by type (💲 / ⭐ / 🎁). */
  emoji: string | null;
}

const REWARD_EMOJI = ['💲', '💵', '⭐', '🎁', '🎬', '🍿', '👫', '🚗', '🎮', '🍕', '🍦', '🏊', '🎳', '🛍️', '📱', '🏆'];

/**
 * What a chore/to-do pays: stars, money, or something typed in ("Movie time", "Friend time",
 * "Special trip") — plus its emoji (tap the emoji to change it).
 */
export function RewardEditor({ value, onChange }: { value: RewardValue; onChange: (v: RewardValue) => void }) {
  const [picking, setPicking] = useState(false);
  const set = (patch: Partial<RewardValue>) => onChange({ ...value, ...patch });
  const fallback = prizeEmoji({ emoji: null, reward_kind: value.type });
  return (
    <div className="reward-editor">
      <div className="task-form__row reward-editor__row">
        <button
          type="button"
          className="reward-editor__emoji secondary"
          onClick={() => setPicking(!picking)}
          aria-label="Change the reward's emoji"
          title="Change the emoji"
        >
          {value.emoji ?? fallback}
        </button>
        <select value={value.type} onChange={(e) => set({ type: e.target.value as RewardType })}>
          <option value="stars">Stars</option>
          <option value="money">Money</option>
          <option value="custom">Something else (type it in)</option>
        </select>
        {value.type === 'custom' ? (
          <input
            placeholder="e.g. Movie time, Friend time, Special trip"
            value={value.text}
            maxLength={80}
            onChange={(e) => set({ text: e.target.value })}
          />
        ) : (
          <input
            type="number"
            min={value.type === 'stars' ? 1 : 0.01}
            step={value.type === 'stars' ? 1 : 0.01}
            value={value.amount}
            onChange={(e) => set({ amount: Number(e.target.value) || 0 })}
            aria-label={value.type === 'stars' ? 'Stars' : 'Dollars'}
          />
        )}
      </div>
      {picking && (
        <EmojiPicker
          value={value.emoji}
          suggestions={REWARD_EMOJI.filter((e) => e !== fallback)}
          onPick={(em) => {
            set({ emoji: value.emoji === em ? null : em });
            setPicking(false);
          }}
          before={
            <button
              type="button"
              className={`member-form__emoji ${value.emoji === null ? 'member-form__emoji--selected' : ''}`}
              onClick={() => {
                set({ emoji: null });
                setPicking(false);
              }}
              aria-label="Use the default emoji"
              title="Default"
            >
              {fallback}
            </button>
          }
        />
      )}
    </div>
  );
}
