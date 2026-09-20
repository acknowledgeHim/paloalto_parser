import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import type { FamilyMember, Prize } from '../types.js';

export const prizesRouter = Router();

function completionsFor(taskId: string, memberId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) as n FROM task_completions WHERE task_id = ? AND completed_by_id = ?')
    .get(taskId, memberId) as { n: number };
  return row.n;
}

function redemptionsFor(prizeId: string, memberId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) as n FROM prize_redemptions WHERE prize_id = ? AND family_member_id = ?')
    .get(prizeId, memberId) as { n: number };
  return row.n;
}

/** How many more times this prize can currently be redeemed by this member, and their progress toward the next one. */
function progressFor(prize: Prize, memberId: string) {
  if (prize.cost_type === 'stars') {
    const member = db.prepare('SELECT star_balance FROM family_members WHERE id = ?').get(memberId) as
      | Pick<FamilyMember, 'star_balance'>
      | undefined;
    const current = member?.star_balance ?? 0;
    const needed = prize.star_cost ?? 0;
    return { current, needed, available: needed > 0 ? Math.floor(current / needed) - redemptionsFor(prize.id, memberId) : 0 };
  }
  if (!prize.task_id || !prize.required_count) return { current: 0, needed: 0, available: 0 };
  const completions = completionsFor(prize.task_id, memberId);
  const redemptions = redemptionsFor(prize.id, memberId);
  return {
    current: completions - redemptions * prize.required_count,
    needed: prize.required_count,
    available: Math.floor(completions / prize.required_count) - redemptions,
  };
}

/** GET /api/prizes?family_member_id=<id> — with that param, each prize includes redemption progress/eligibility for them. */
prizesRouter.get('/', (req, res) => {
  const prizes = db.prepare('SELECT * FROM prizes ORDER BY created_at ASC').all() as Prize[];
  const memberId = req.query.family_member_id as string | undefined;
  if (!memberId) return res.json(prizes);
  res.json(
    prizes.map((p) => {
      const progress = progressFor(p, memberId);
      return { ...p, progress, eligible: progress.available > 0 };
    })
  );
});

prizesRouter.post('/', requireAdmin, (req, res) => {
  const { title, cost_type, star_cost, task_id, required_count } = req.body as Partial<Prize>;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  if (cost_type !== 'stars' && cost_type !== 'task_count') {
    return res.status(400).json({ error: 'cost_type must be "stars" or "task_count"' });
  }
  if (cost_type === 'stars' && !(Number(star_cost) > 0)) {
    return res.status(400).json({ error: 'star_cost must be a positive number' });
  }
  if (cost_type === 'task_count' && (!task_id || !(Number(required_count) > 0))) {
    return res.status(400).json({ error: 'task_count prizes need a task_id and a positive required_count' });
  }

  const prize: Prize = {
    id: uuidv4(),
    title: title.trim(),
    cost_type,
    star_cost: cost_type === 'stars' ? Math.round(Number(star_cost)) : null,
    task_id: cost_type === 'task_count' ? (task_id as string) : null,
    required_count: cost_type === 'task_count' ? Math.round(Number(required_count)) : null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO prizes (id, title, cost_type, star_cost, task_id, required_count, created_at)
     VALUES (@id, @title, @cost_type, @star_cost, @task_id, @required_count, @created_at)`
  ).run(prize);
  res.status(201).json(prize);
});

prizesRouter.patch('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM prizes WHERE id = ?').get(req.params.id) as Prize | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });
  const updated: Prize = { ...existing, ...req.body, id: existing.id };
  db.prepare(
    `UPDATE prizes SET title=@title, cost_type=@cost_type, star_cost=@star_cost,
     task_id=@task_id, required_count=@required_count WHERE id=@id`
  ).run(updated);
  res.json(updated);
});

prizesRouter.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM prizes WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/** POST /api/prizes/:id/redeem { family_member_id } — validated server-side against the real balance/count. */
prizesRouter.post('/:id/redeem', (req, res) => {
  const prize = db.prepare('SELECT * FROM prizes WHERE id = ?').get(req.params.id) as Prize | undefined;
  if (!prize) return res.status(404).json({ error: 'not found' });
  const memberId = req.body.family_member_id as string | undefined;
  if (!memberId) return res.status(400).json({ error: 'family_member_id is required' });

  const progress = progressFor(prize, memberId);
  if (progress.available <= 0) return res.status(400).json({ error: 'not eligible for this prize yet' });

  if (prize.cost_type === 'stars' && prize.star_cost) {
    db.prepare('UPDATE family_members SET star_balance = star_balance - ? WHERE id = ?').run(prize.star_cost, memberId);
  }
  const redemption = { id: uuidv4(), prize_id: prize.id, family_member_id: memberId, redeemed_at: new Date().toISOString() };
  db.prepare(
    'INSERT INTO prize_redemptions (id, prize_id, family_member_id, redeemed_at) VALUES (@id, @prize_id, @family_member_id, @redeemed_at)'
  ).run(redemption);
  res.status(201).json(redemption);
});
