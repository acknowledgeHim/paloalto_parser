import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { isParentRequest } from '../services/rewards.js';
import type { FamilyMember, Prize, PrizeRequirement, Task } from '../types.js';

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

function requirementsOf(prizeId: string): PrizeRequirement[] {
  return db.prepare('SELECT * FROM prize_requirements WHERE prize_id = ? ORDER BY sort_order').all(prizeId) as PrizeRequirement[];
}

/** How much of a job this person has ever done, in a prize's terms: hours for an "hours" job, times
 *  for a "times" job (each time counts), else how many times they've checked it off. */
function doneFor(task: Task | undefined, memberId: string): number {
  if (!task) return 0;
  if (task.goal_type === 'hours' || task.goal_type === 'times') {
    const row = db
      .prepare('SELECT COALESCE(SUM(amount), 0) AS n FROM task_progress WHERE task_id = ? AND family_member_id = ?')
      .get(task.id, memberId) as { n: number };
    return task.goal_type === 'hours' ? row.n / 60 : row.n;
  }
  return completionsFor(task.id, memberId);
}

/** How many more times this prize can currently be redeemed by this member, and their progress toward the next one. */
function progressFor(prize: Prize, memberId: string) {
  const reqs = prize.cost_type === 'task_count' ? requirementsOf(prize.id) : [];
  if (reqs.length) {
    // Several jobs (or one, counted in hours/times): each one's progress toward the next prize, and
    // it can be claimed as many times as the job furthest behind allows.
    const redemptions = redemptionsFor(prize.id, memberId);
    const getTask = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const parts = reqs.map((r) => {
      const task = getTask.get(r.task_id) as Task | undefined;
      const done = doneFor(task, memberId);
      return {
        task_id: r.task_id,
        title: task?.title ?? '(deleted)',
        icon: task?.icon ?? null,
        kind: task?.kind ?? 'todo',
        unit: task?.goal_type === 'hours' ? ('hours' as const) : ('times' as const),
        current: Math.max(0, Math.min(r.amount, done - redemptions * r.amount)),
        needed: r.amount,
        times: Math.floor(done / r.amount + 1e-9),
      };
    });
    const fraction = parts.reduce((a, p) => a + p.current / p.needed, 0) / parts.length;
    return {
      current: Math.round(fraction * 100),
      needed: 100,
      available: Math.min(...parts.map((p) => p.times)) - redemptions,
      parts: parts.map(({ times: _t, ...p }) => p),
    };
  }
  if (prize.cost_type === 'stars') {
    const member = db.prepare('SELECT star_balance FROM family_members WHERE id = ?').get(memberId) as
      | Pick<FamilyMember, 'star_balance'>
      | undefined;
    const current = member?.star_balance ?? 0;
    const needed = prize.star_cost ?? 0;
    // Claiming already takes the stars out of the balance, so what's left is all that counts.
    return { current, needed, available: needed > 0 ? Math.floor(current / needed) : 0 };
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

/**
 * GET /api/prizes/earned?family_member_id=<id> — what they've earned that isn't money or stars:
 * everything not used yet, then the last few used.
 */
prizesRouter.get('/earned', (req, res) => {
  const memberId = req.query.family_member_id as string | undefined;
  if (!memberId) return res.status(400).json({ error: 'family_member_id is required' });
  const open = db.prepare('SELECT * FROM earned_rewards WHERE family_member_id = ? AND used_at IS NULL ORDER BY earned_at').all(memberId);
  const used = db.prepare('SELECT * FROM earned_rewards WHERE family_member_id = ? AND used_at IS NOT NULL ORDER BY used_at DESC LIMIT 10').all(memberId);
  res.json([...open, ...used]);
});

/** POST /api/prizes/earned/:id/use { used: boolean } — a parent marks it enjoyed (or not yet, to undo). */
prizesRouter.post('/earned/:id/use', requireAdmin, (req, res) => {
  const used = req.body?.used !== false;
  const { changes } = db.prepare('UPDATE earned_rewards SET used_at = ? WHERE id = ?').run(used ? new Date().toISOString() : null, req.params.id);
  if (!changes) return res.status(404).json({ error: 'not found' });
  res.json(db.prepare('SELECT * FROM earned_rewards WHERE id = ?').get(req.params.id));
});

const withRequirements = (p: Prize) => ({ ...p, requirements: requirementsOf(p.id) });

/** GET /api/prizes?family_member_id=<id> — with that param, each prize includes redemption progress/eligibility for them. */
prizesRouter.get('/', (req, res) => {
  const prizes = db.prepare('SELECT * FROM prizes ORDER BY created_at ASC').all() as Prize[];
  const memberId = req.query.family_member_id as string | undefined;
  if (!memberId) return res.json(prizes.map(withRequirements));
  res.json(
    prizes.map((p) => {
      const progress = progressFor(p, memberId);
      const waiting = (db
        .prepare("SELECT COUNT(*) AS n FROM prize_redemptions WHERE prize_id = ? AND family_member_id = ? AND status = 'pending'")
        .get(p.id, memberId) as { n: number }).n;
      return { ...withRequirements(p), progress, eligible: progress.available > 0, waiting };
    })
  );
});

const REWARD_KINDS = ['money', 'stars', 'custom'] as const;

/**
 * A prize from a request. cost_type 'stars' { star_cost } or 'task_count' — either
 * { requirements: [{ task_id, amount }, …] } (one or more jobs; amount in hours for an "hours" job,
 * else times) or the older single { task_id, required_count }. What you get: reward_kind 'money' /
 * 'stars' (reward_amount) or 'custom' (just the title), and an emoji.
 */
function parsePrize(body: Record<string, unknown>, existing?: Prize):
  | { error: string }
  | { prize: Prize; requirements: Array<{ task_id: string; amount: number }> | undefined } {
  const merged = { ...existing, ...body } as Record<string, unknown>;
  const cost_type = merged.cost_type;
  if (cost_type !== 'stars' && cost_type !== 'task_count') return { error: 'cost_type must be "stars" or "task_count"' };
  const reward_kind = (merged.reward_kind ?? null) as Prize['reward_kind'];
  if (reward_kind != null && !REWARD_KINDS.includes(reward_kind)) return { error: 'reward_kind must be money, stars or custom' };
  const reward_amount = reward_kind === 'money' || reward_kind === 'stars' ? Number(merged.reward_amount) : null;
  if (reward_amount !== null && !(reward_amount > 0)) return { error: 'How much money or how many stars?' };
  const roundedReward = reward_kind === 'stars' && reward_amount !== null ? Math.round(reward_amount) : reward_amount !== null ? Math.round(reward_amount * 100) / 100 : null;
  let title = typeof merged.title === 'string' ? merged.title.trim().slice(0, 120) : '';
  if (!title && reward_kind === 'money' && roundedReward) title = `$${roundedReward.toFixed(2)}`;
  if (!title && reward_kind === 'stars' && roundedReward) title = `${roundedReward} stars`;
  if (!title) return { error: 'title is required' };
  const emoji = typeof merged.emoji === 'string' && merged.emoji.trim() ? merged.emoji.trim().slice(0, 16) : null;

  let requirements: Array<{ task_id: string; amount: number }> | undefined;
  if (Array.isArray(body.requirements)) {
    const seen = new Set<string>();
    requirements = [];
    for (const r of body.requirements as Array<{ task_id?: unknown; amount?: unknown }>) {
      const amount = Math.round(Number(r?.amount) * 2) / 2;
      if (typeof r?.task_id !== 'string' || seen.has(r.task_id) || !(amount > 0)) continue;
      if (!db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(r.task_id)) continue;
      seen.add(r.task_id);
      requirements.push({ task_id: r.task_id, amount });
    }
  }
  let task_id = (merged.task_id ?? null) as string | null;
  let required_count = merged.required_count == null ? null : Math.round(Number(merged.required_count));
  if (cost_type === 'stars') {
    if (!(Number(merged.star_cost) > 0)) return { error: 'star_cost must be a positive number' };
    task_id = null;
    required_count = null;
    requirements = requirements === undefined ? undefined : [];
  } else if (requirements?.length) {
    // The first job also goes in the older single-job columns, so anything reading those still works.
    task_id = requirements[0].task_id;
    required_count = Math.max(1, Math.ceil(requirements[0].amount));
  } else {
    const hasOld = existing ? requirementsOf(existing.id).length > 0 : false;
    if (requirements || (!hasOld && (!task_id || !(Number(required_count) > 0)))) {
      return { error: 'Pick at least one chore or to-do and how much of it' };
    }
  }
  return {
    requirements,
    prize: {
      id: existing?.id ?? uuidv4(),
      title,
      cost_type,
      star_cost: cost_type === 'stars' ? Math.round(Number(merged.star_cost)) : null,
      task_id,
      required_count,
      created_at: existing?.created_at ?? new Date().toISOString(),
      reward_kind,
      reward_amount: roundedReward,
      emoji,
      needs_approval: merged.needs_approval ? 1 : 0,
    },
  };
}

function saveRequirements(prizeId: string, reqs: Array<{ task_id: string; amount: number }> | undefined) {
  if (reqs === undefined) return;
  db.prepare('DELETE FROM prize_requirements WHERE prize_id = ?').run(prizeId);
  const add = db.prepare('INSERT INTO prize_requirements (prize_id, task_id, amount, sort_order) VALUES (?, ?, ?, ?)');
  reqs.forEach((r, i) => add.run(prizeId, r.task_id, r.amount, i));
}

prizesRouter.post('/', requireAdmin, (req, res) => {
  const parsed = parsePrize(req.body ?? {});
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const { prize, requirements } = parsed;
  db.transaction(() => {
    db.prepare(
      `INSERT INTO prizes (id, title, cost_type, star_cost, task_id, required_count, created_at, reward_kind, reward_amount, emoji, needs_approval)
       VALUES (@id, @title, @cost_type, @star_cost, @task_id, @required_count, @created_at, @reward_kind, @reward_amount, @emoji, @needs_approval)`
    ).run(prize);
    saveRequirements(prize.id, requirements);
  })();
  res.status(201).json(withRequirements(prize));
});

prizesRouter.patch('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM prizes WHERE id = ?').get(req.params.id) as Prize | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });
  const parsed = parsePrize(req.body ?? {}, existing);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const { prize, requirements } = parsed;
  db.transaction(() => {
    db.prepare(
      `UPDATE prizes SET title=@title, cost_type=@cost_type, star_cost=@star_cost, task_id=@task_id,
       required_count=@required_count, reward_kind=@reward_kind, reward_amount=@reward_amount, emoji=@emoji,
       needs_approval=@needs_approval WHERE id=@id`
    ).run(prize);
    saveRequirements(prize.id, requirements);
  })();
  res.json(withRequirements(prize));
});

prizesRouter.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM prizes WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/** POST /api/prizes/:id/redeem { family_member_id } — validated server-side against the real balance/count. */
/** Pays out a claimed prize: money or stars into their balance; anything else ("Movie night") onto
 *  their earned list until a parent marks it used. */
export function payPrize(prize: Prize, memberId: string, at: string): void {
  if (prize.reward_kind === 'money' && prize.reward_amount) {
    db.prepare('UPDATE family_members SET money_balance = money_balance + ? WHERE id = ?').run(prize.reward_amount, memberId);
  } else if (prize.reward_kind === 'stars' && prize.reward_amount) {
    db.prepare('UPDATE family_members SET star_balance = star_balance + ? WHERE id = ?').run(Math.round(prize.reward_amount), memberId);
  } else {
    db.prepare('INSERT INTO earned_rewards (id, family_member_id, prize_id, text, emoji, earned_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      uuidv4(),
      memberId,
      prize.id,
      prize.title,
      prize.emoji ?? null,
      at
    );
  }
}

/** POST /api/prizes/:id/redeem { family_member_id, acting_member_id? } — validated server-side against
 *  the real balance/count. A prize that needs a parent's OK, claimed by a kid, waits for it: its star
 *  cost is held now, and it pays out when a parent says yes (or the stars come back on a no). */
prizesRouter.post('/:id/redeem', (req, res) => {
  const prize = db.prepare('SELECT * FROM prizes WHERE id = ?').get(req.params.id) as Prize | undefined;
  if (!prize) return res.status(404).json({ error: 'not found' });
  const memberId = req.body.family_member_id as string | undefined;
  if (!memberId) return res.status(400).json({ error: 'family_member_id is required' });

  const progress = progressFor(prize, memberId);
  if (progress.available <= 0) return res.status(400).json({ error: 'not eligible for this prize yet' });

  const pending = Boolean(prize.needs_approval) && !isParentRequest(req, req.body.acting_member_id ?? memberId);
  const redemption = {
    id: uuidv4(),
    prize_id: prize.id,
    family_member_id: memberId,
    redeemed_at: new Date().toISOString(),
    status: pending ? 'pending' : null,
  };
  db.transaction(() => {
    if (prize.cost_type === 'stars' && prize.star_cost) {
      db.prepare('UPDATE family_members SET star_balance = star_balance - ? WHERE id = ?').run(prize.star_cost, memberId);
    }
    db.prepare(
      'INSERT INTO prize_redemptions (id, prize_id, family_member_id, redeemed_at, status) VALUES (@id, @prize_id, @family_member_id, @redeemed_at, @status)'
    ).run(redemption);
    if (!pending) payPrize(prize, memberId, redemption.redeemed_at);
  })();
  res.status(201).json({ ...redemption, pending });
});
