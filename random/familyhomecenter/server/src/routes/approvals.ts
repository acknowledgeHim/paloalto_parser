import { Router } from 'express';
import { db } from '../db.js';
import { goalSlots, isParentRequest, recordCompletion } from '../services/rewards.js';
import { payPrize } from './prizes.js';
import { goalUnits, progressFor } from '../services/taskQueries.js';
import { todayStr } from '../utils/recurrence.js';
import type { PendingCompletion, Prize, Task } from '../types.js';

/**
 * ✅ To approve (parents): kids' check-offs of jobs that need a parent's OK, and prize claims that
 * do — each a yes (it counts / pays out) or a no (back to not done / stars returned).
 */
export const approvalsRouter = Router();

interface PendingClaim {
  id: string;
  prize_id: string;
  family_member_id: string;
  redeemed_at: string;
}

function list() {
  const jobs = db
    .prepare(
      `SELECT p.*, t.title, t.kind, t.icon, t.goal_type, t.goal_amount, t.goal_minutes, t.reward_type, t.reward_amount, t.reward_text, t.reward_emoji
       FROM pending_completions p JOIN tasks t ON t.id = p.task_id ORDER BY p.created_at`
    )
    .all();
  const prizes = db
    .prepare(
      `SELECT r.id, r.prize_id, r.family_member_id, r.redeemed_at, p.title, p.emoji, p.reward_kind, p.reward_amount, p.cost_type, p.star_cost
       FROM prize_redemptions r JOIN prizes p ON p.id = r.prize_id WHERE r.status = 'pending' ORDER BY r.redeemed_at`
    )
    .all();
  // Chunks of times/hours jobs (30 minutes of weeding, one basketball practice), each on its own.
  const chunks = db
    .prepare(
      `SELECT p.id, p.task_id, p.family_member_id, p.logged_on AS completed_on, NULL AS time_of_day, p.created_at, p.amount AS chunk,
              t.title, t.kind, t.icon, t.goal_type, t.goal_amount, t.goal_minutes, t.reward_type, t.reward_amount, t.reward_text, t.reward_emoji
       FROM task_progress p JOIN tasks t ON t.id = p.task_id WHERE p.pending = 1 ORDER BY p.created_at`
    )
    .all();
  return { jobs: [...chunks, ...jobs], prizes };
}

approvalsRouter.get('/', (_req, res) => {
  res.json(list());
});

approvalsRouter.get('/count', (_req, res) => {
  const jobs =
    (db.prepare('SELECT COUNT(*) AS n FROM pending_completions').get() as { n: number }).n +
    (db.prepare('SELECT COUNT(*) AS n FROM task_progress WHERE pending = 1').get() as { n: number }).n;
  const prizes = (db.prepare("SELECT COUNT(*) AS n FROM prize_redemptions WHERE status = 'pending'").get() as { n: number }).n;
  res.json(jobs + prizes);
});

/** POST /api/approvals/chunk/:id { ok, acting_member_id? } — a kid's chunk of a times/hours job.
 *  Yes: it counts (and if that reaches the goal, the job is checked off and pays its reward). No: it's
 *  taken off. */
approvalsRouter.post('/chunk/:id', (req, res) => {
  if (!isParentRequest(req, req.body?.acting_member_id)) return res.status(403).json({ error: 'Only a parent can approve' });
  const chunk = db.prepare('SELECT * FROM task_progress WHERE id = ? AND pending = 1').get(req.params.id) as
    | { id: string; task_id: string; family_member_id: string | null; logged_on: string }
    | undefined;
  if (!chunk) return res.status(404).json({ error: 'Already taken care of' });
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(chunk.task_id) as Task | undefined;
  db.transaction(() => {
    if (!req.body?.ok || !task) {
      db.prepare('DELETE FROM task_progress WHERE id = ?').run(chunk.id);
      return;
    }
    db.prepare('UPDATE task_progress SET pending = NULL WHERE id = ?').run(chunk.id);
    const goal = goalUnits(task);
    // A one-time job's chunks count up to today; a repeating job's, the day it was done.
    const on = task.recurrence === 'once' ? todayStr() : chunk.logged_on;
    if (goal && progressFor(task, chunk.family_member_id, on) >= goal) {
      const by = chunk.family_member_id === null ? 'completed_by_id IS NULL' : 'completed_by_id = ?';
      const already = db
        .prepare(`SELECT 1 FROM task_completions WHERE task_id = ? AND ${by} AND completed_on ${task.recurrence === 'once' ? '<=' : '='} ?`)
        .get(task.id, ...(chunk.family_member_id === null ? [] : [chunk.family_member_id]), on);
      if (!already) recordCompletion(task, chunk.family_member_id, on, goalSlots(task));
    }
  })();
  res.json(list());
});

/** POST /api/approvals/job/:id { ok, acting_member_id? } — yes: it's checked off (and pays its
 *  reward); no: it isn't (for a "times"/"hours" job, their last chunk comes off too). */
approvalsRouter.post('/job/:id', (req, res) => {
  if (!isParentRequest(req, req.body?.acting_member_id)) return res.status(403).json({ error: 'Only a parent can approve' });
  const pending = db.prepare('SELECT * FROM pending_completions WHERE id = ?').get(req.params.id) as PendingCompletion | undefined;
  if (!pending) return res.status(404).json({ error: 'Already taken care of' });
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(pending.task_id) as Task | undefined;
  db.transaction(() => {
    db.prepare('DELETE FROM pending_completions WHERE id = ?').run(pending.id);
    if (!task) return;
    if (req.body?.ok) {
      recordCompletion(task, pending.family_member_id, pending.completed_on, task.goal_type ? goalSlots(task) : [pending.time_of_day]);
    } else if (task.goal_type) {
      const by = pending.family_member_id === null ? 'family_member_id IS NULL' : 'family_member_id = ?';
      db.prepare(
        `DELETE FROM task_progress WHERE id = (SELECT id FROM task_progress WHERE task_id = ? AND ${by} ORDER BY created_at DESC LIMIT 1)`
      ).run(task.id, ...(pending.family_member_id === null ? [] : [pending.family_member_id]));
    }
  })();
  res.json(list());
});

/** POST /api/approvals/prize/:id { ok, acting_member_id? } — yes: it pays out; no: the claim is
 *  undone and any stars it cost come back. */
approvalsRouter.post('/prize/:id', (req, res) => {
  if (!isParentRequest(req, req.body?.acting_member_id)) return res.status(403).json({ error: 'Only a parent can approve' });
  const claim = db.prepare("SELECT * FROM prize_redemptions WHERE id = ? AND status = 'pending'").get(req.params.id) as PendingClaim | undefined;
  if (!claim) return res.status(404).json({ error: 'Already taken care of' });
  const prize = db.prepare('SELECT * FROM prizes WHERE id = ?').get(claim.prize_id) as Prize | undefined;
  db.transaction(() => {
    if (req.body?.ok) {
      db.prepare('UPDATE prize_redemptions SET status = NULL WHERE id = ?').run(claim.id);
      if (prize) payPrize(prize, claim.family_member_id, claim.id);
    } else {
      db.prepare('DELETE FROM prize_redemptions WHERE id = ?').run(claim.id);
      if (prize?.cost_type === 'stars' && prize.star_cost) {
        db.prepare('UPDATE family_members SET star_balance = star_balance + ? WHERE id = ?').run(prize.star_cost, claim.family_member_id);
      }
    }
  })();
  res.json(list());
});
