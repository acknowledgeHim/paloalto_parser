import type { BonusStatus } from '../utils/learning.js';

/**
 * 🎁 Today's learning bonus: max out the paying rounds in each subject the parent picked (e.g.
 * Spelling, Grammar and Math) and get extra tokens, once a day. Hidden when there's no bonus.
 */
export function BonusLine({ bonus }: { bonus: BonusStatus | undefined }) {
  if (!bonus || !bonus.tokens || !bonus.subjects.length) return null;
  if (bonus.paid_today !== null) return <p className="learning-bonus is-done">🎁 Today's bonus: +{bonus.paid_today} 💎 earned — great work!</p>;
  const left = bonus.subjects.filter((s) => !s.done).length;
  return (
    <p className="learning-bonus">
      🎁 Bonus +{bonus.tokens} 💎: earn all of today's tokens in{' '}
      {bonus.subjects.map((s, i) => (
        <span key={s.subject}>
          {i ? ', ' : ''}
          {s.done ? '✅' : '⬜'} {s.name}
        </span>
      ))}
      {left ? ` · ${left} to go` : ''}
    </p>
  );
}
