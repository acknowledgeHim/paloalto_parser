import { Router } from 'express';
import { db, setSetting } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { isParentRequest, isSelfOrParent, sessionActor } from '../services/rewards.js';
import { addTokens, parentsDressFree, tokensPerStar } from '../services/tokens.js';

/** 💎 Tokens: balances, history, swapping ⭐ for 💎, and parents giving / taking. */
export const tokensRouter = Router();

function wallet(memberId: string) {
  const m = db.prepare('SELECT id, token_balance, star_balance FROM family_members WHERE id = ?').get(memberId) as
    | { id: string; token_balance: number; star_balance: number }
    | undefined;
  if (!m) return null;
  return {
    token_balance: m.token_balance,
    star_balance: m.star_balance,
    tokens_per_star: tokensPerStar(),
    log: db.prepare('SELECT delta, reason, by_member_id, at FROM token_log WHERE family_member_id = ? ORDER BY at DESC LIMIT 30').all(memberId),
  };
}

const tokenSettings = () => ({ tokens_per_star: tokensPerStar(), parents_dress_free: parentsDressFree() });
tokensRouter.get('/settings', (_req, res) => res.json(tokenSettings()));

/** PUT /settings { tokens_per_star?, parents_dress_free? } — parents. 0 tokens per star turns swapping off. */
tokensRouter.put('/settings', requireAdmin, (req, res) => {
  const b = req.body ?? {};
  if (b.tokens_per_star !== undefined) {
    const v = Math.round(Number(b.tokens_per_star));
    if (!Number.isFinite(v) || v < 0 || v > 100) return res.status(400).json({ error: 'Tokens per star: 0–100' });
    setSetting('tokens_per_star', String(v));
  }
  if (typeof b.parents_dress_free === 'boolean') setSetting('parents_dress_free', b.parents_dress_free ? '1' : '0');
  res.json(tokenSettings());
});

tokensRouter.get('/:memberId', (req, res) => {
  const w = wallet(req.params.memberId);
  if (!w) return res.status(404).json({ error: 'not found' });
  res.json(w);
});

/** POST /:memberId/swap { stars, acting_member_id } — a parent trades a kid's ⭐ Prize Bank stars for 💎 tokens. */
tokensRouter.post('/:memberId/swap', (req, res) => {
  const { memberId } = req.params;
  const { stars, acting_member_id } = req.body ?? {};
  // A parent does the swap for a kid — kids can't swap their own stars.
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can swap stars for tokens — ask a parent' });
  const rate = tokensPerStar();
  if (!rate) return res.status(400).json({ error: 'Swapping stars for tokens is turned off' });
  const n = Math.round(Number(stars));
  if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'How many stars?' });
  const w = wallet(memberId);
  if (!w) return res.status(404).json({ error: 'not found' });
  if (w.star_balance < n) return res.status(400).json({ error: `Only ${w.star_balance} ⭐ to swap` });
  db.transaction(() => {
    db.prepare('UPDATE family_members SET star_balance = star_balance - ? WHERE id = ?').run(n, memberId);
    addTokens(memberId, n * rate, `Swapped ${n} ⭐ for tokens`, sessionActor(req, acting_member_id));
  })();
  res.json(wallet(memberId));
});

/** POST /:memberId/adjust { delta, reason, acting_member_id } — parents give (+) or take away (−) tokens. */
tokensRouter.post('/:memberId/adjust', (req, res) => {
  const { memberId } = req.params;
  const { delta, reason, acting_member_id } = req.body ?? {};
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can do that' });
  const n = Math.round(Number(delta));
  if (!Number.isFinite(n) || !n || Math.abs(n) > 100_000) return res.status(400).json({ error: 'How many tokens?' });
  const w = wallet(memberId);
  if (!w) return res.status(404).json({ error: 'not found' });
  // Taking away never goes below 0.
  const d = n < 0 ? -Math.min(-n, w.token_balance) : n;
  const why = String(reason ?? '').trim() || (d > 0 ? 'From a parent' : 'Taken away by a parent');
  addTokens(memberId, d, why, sessionActor(req, acting_member_id));
  res.json(wallet(memberId));
});
