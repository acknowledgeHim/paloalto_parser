import { v4 as uuidv4 } from 'uuid';
import { db, getSetting } from '../db.js';

/**
 * 💎 Tokens: the app's own currency (typing, chores set to pay tokens, swapping ⭐ stars), spent on
 * 👕 Dress up and 🎮 Games. Every change is written to token_log.
 */
export function addTokens(memberId: string, delta: number, reason: string, byMemberId: string | null = null) {
  const n = Math.round(delta);
  if (!n) return;
  db.prepare('UPDATE family_members SET token_balance = token_balance + ? WHERE id = ?').run(n, memberId);
  db.prepare('INSERT INTO token_log (id, family_member_id, delta, reason, by_member_id, at) VALUES (?, ?, ?, ?, ?, ?)').run(
    uuidv4(),
    memberId,
    n,
    reason.slice(0, 200),
    byMemberId,
    new Date().toISOString()
  );
}

export function tokenBalance(memberId: string): number {
  return (db.prepare('SELECT token_balance AS n FROM family_members WHERE id = ?').get(memberId) as { n: number } | undefined)?.n ?? 0;
}

/** How many tokens one ⭐ star swaps for (0 = swapping is off). */
export function tokensPerStar(): number {
  const v = Number(getSetting('tokens_per_star', '1'));
  return Number.isFinite(v) && v >= 0 ? Math.min(100, Math.round(v)) : 1;
}
