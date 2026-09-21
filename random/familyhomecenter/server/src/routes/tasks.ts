import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { todayStr } from '../utils/recurrence.js';
import { assigneesFor, tasksForDate, allActiveTasks } from '../services/taskQueries.js';
import type { Task, TaskCompletion } from '../types.js';

export const tasksRouter = Router();

function creditReward(memberId: string, rewardType: 'stars' | 'money', amount: number) {
  if (rewardType === 'stars') {
    db.prepare('UPDATE family_members SET star_balance = star_balance + ? WHERE id = ?').run(Math.round(amount), memberId);
  } else {
    db.prepare('UPDATE family_members SET money_balance = money_balance + ? WHERE id = ?').run(amount, memberId);
  }
}

function setAssignees(taskId: string, memberIds: string[]) {
  db.prepare('DELETE FROM task_assignees WHERE task_id = ?').run(taskId);
  const stmt = db.prepare('INSERT OR IGNORE INTO task_assignees (task_id, family_member_id) VALUES (?, ?)');
  memberIds.forEach((id) => stmt.run(taskId, id));
}

/** Finds this task's completion for a given date, (possibly null) person, and (possibly null) time-of-day
 *  slot — NULL columns need `IS`, not `=`, hence building the clause per column instead of one fixed query. */
function findCompletion(
  taskId: string,
  date: string,
  completedBy: string | null,
  timeOfDay: string | null
): TaskCompletion | undefined {
  const byClause = completedBy === null ? 'completed_by_id IS NULL' : 'completed_by_id = ?';
  const slotClause = timeOfDay === null ? 'time_of_day IS NULL' : 'time_of_day = ?';
  const params = [taskId, date, ...(completedBy === null ? [] : [completedBy]), ...(timeOfDay === null ? [] : [timeOfDay])];
  return db
    .prepare(`SELECT * FROM task_completions WHERE task_id = ? AND completed_on = ? AND ${byClause} AND ${slotClause}`)
    .get(...params) as TaskCompletion | undefined;
}

/**
 * GET /api/tasks?date=YYYY-MM-DD
 * Returns every active task that applies on `date` (defaults to today), each with its assignees
 * and every completion for that date/instance — a task assigned to several people can have one
 * completion per person, each completed (and Prize-Bank-rewarded) independently.
 *
 * GET /api/tasks?all=true bypasses the date filter entirely — used by the Prize Bank reward
 * configuration in Settings, which needs to see every chore/to-do, not just today's.
 */
tasksRouter.get('/', (req, res) => {
  if (req.query.all === 'true') return res.json(allActiveTasks());
  const date = (req.query.date as string) || todayStr();
  res.json(tasksForDate(date));
});

tasksRouter.post('/', (req, res) => {
  const { kind, title, notes, assignee_ids, created_by_id, recurrence, due_date, time_of_day } = req.body as Partial<Task> & {
    assignee_ids?: string[];
  };
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  if (kind !== 'chore' && kind !== 'todo') return res.status(400).json({ error: 'kind must be chore or todo' });

  const task: Task = {
    id: uuidv4(),
    kind,
    title: title.trim(),
    notes: notes ?? null,
    created_by_id: created_by_id ?? null,
    recurrence: (recurrence as Task['recurrence']) ?? 'once',
    due_date: due_date ?? null,
    time_of_day: time_of_day ?? null,
    reward_type: null,
    reward_amount: null,
    active: 1,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO tasks (id, kind, title, notes, created_by_id, recurrence, due_date, time_of_day, active, created_at)
     VALUES (@id, @kind, @title, @notes, @created_by_id, @recurrence, @due_date, @time_of_day, @active, @created_at)`
  ).run(task);
  setAssignees(task.id, assignee_ids ?? []);
  res.status(201).json({ ...task, assignee_ids: assignee_ids ?? [], completions: [] });
});

tasksRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });

  const { assignee_ids, ...fields } = req.body as Partial<Task> & { assignee_ids?: string[] };
  const updated: Task = { ...existing, ...fields, id: existing.id };
  db.prepare(
    `UPDATE tasks SET title=@title, notes=@notes, recurrence=@recurrence,
     due_date=@due_date, time_of_day=@time_of_day, active=@active WHERE id=@id`
  ).run(updated);
  if (assignee_ids !== undefined) setAssignees(req.params.id, assignee_ids);
  res.json({ ...updated, assignee_ids: assignee_ids ?? assigneesFor(req.params.id) });
});

/**
 * PATCH /api/tasks/:id/reward — sets/clears the Prize Bank reward for this task.
 * Gated behind the Settings password (same requireAdmin used by family roster / calendar
 * connect elsewhere) so kids can't grant themselves money or stars by editing a task.
 */
tasksRouter.patch('/:id/reward', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });

  const { reward_type, reward_amount } = req.body as { reward_type?: 'stars' | 'money' | null; reward_amount?: number | null };
  if (reward_type && reward_type !== 'stars' && reward_type !== 'money') {
    return res.status(400).json({ error: 'reward_type must be "stars", "money", or null' });
  }
  const updated: Task = {
    ...existing,
    reward_type: reward_type ?? null,
    reward_amount: reward_type ? Number(reward_amount) || 0 : null,
  };
  db.prepare('UPDATE tasks SET reward_type=@reward_type, reward_amount=@reward_amount WHERE id=@id').run(updated);
  res.json({ ...updated, assignee_ids: assigneesFor(req.params.id) });
});

tasksRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/** POST /api/tasks/:id/complete  { completed_by_id, date?, time_of_day? } — completes *that person's*
 *  copy (and, for a task with more than one time-of-day slot, *that slot's* copy). */
tasksRouter.post('/:id/complete', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
  if (!task) return res.status(404).json({ error: 'not found' });

  const date = (req.body.date as string) || todayStr();
  const completedBy: string | null = req.body.completed_by_id ?? null;
  const timeOfDay: string | null = req.body.time_of_day ?? null;
  const existing = findCompletion(task.id, date, completedBy, timeOfDay);

  const completion: TaskCompletion = {
    id: existing?.id ?? uuidv4(),
    task_id: task.id,
    completed_on: date,
    completed_by_id: completedBy,
    completed_at: new Date().toISOString(),
    time_of_day: timeOfDay,
  };
  if (existing) {
    db.prepare('UPDATE task_completions SET completed_at = @completed_at WHERE id = @id').run(completion);
  } else {
    db.prepare(
      `INSERT INTO task_completions (id, task_id, completed_on, completed_by_id, completed_at, time_of_day)
       VALUES (@id, @task_id, @completed_on, @completed_by_id, @completed_at, @time_of_day)`
    ).run(completion);
  }

  // Only credit the first time this person's instance (of this slot) is completed — re-saving the
  // same completion (e.g. a retried request) must not pay out twice.
  if (!existing && task.reward_type && task.reward_amount && completedBy) {
    creditReward(completedBy, task.reward_type, task.reward_amount);
  }

  res.status(201).json(completion);
});

/** POST /api/tasks/:id/uncomplete  { completed_by_id, date?, time_of_day? } — undoes *that person's*
 *  (and that slot's) checkmark. */
tasksRouter.post('/:id/uncomplete', (req, res) => {
  const date = (req.body.date as string) || todayStr();
  const completedBy: string | null = req.body.completed_by_id ?? null;
  const timeOfDay: string | null = req.body.time_of_day ?? null;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
  const existing = findCompletion(req.params.id, date, completedBy, timeOfDay);

  if (existing) {
    db.prepare('DELETE FROM task_completions WHERE id = ?').run(existing.id);
    if (task?.reward_type && task.reward_amount && existing.completed_by_id) {
      creditReward(existing.completed_by_id, task.reward_type, -task.reward_amount);
    }
  }
  res.status(204).end();
});
