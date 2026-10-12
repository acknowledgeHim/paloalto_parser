import { Router, type Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { isAdminGateActive, isRequestAdmin, sessionMemberId, SESSION_COOKIE_NAME } from '../services/auth.js';
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

/**
 * Putting a chore/to-do somewhere on the floor plan is a parent's call — or a kid's whom a parent
 * has let place their own (family_members.can_place_tasks), for jobs that are theirs. Like the rest
 * of the parent-only settings, this only bites once a parent has a password (requireAdmin).
 */
function mayPlace(req: Request, assigneeIds: string[], actingMemberId: unknown): boolean {
  if (!isAdminGateActive()) return true;
  const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (isRequestAdmin(token)) return true;
  const actor = sessionMemberId(token) ?? (typeof actingMemberId === 'string' ? actingMemberId : null);
  if (!actor || !assigneeIds.includes(actor)) return false;
  return Boolean(db.prepare('SELECT 1 FROM family_members WHERE id = ? AND can_place_tasks = 1').get(actor));
}

/** Setting up (or changing, or stopping) taking turns is a parent's call. */
function mayRotate(req: Request): boolean {
  return !isAdminGateActive() || isRequestAdmin(req.cookies?.[SESSION_COOKIE_NAME] as string | undefined);
}

/**
 * The rotation from a request: { rotation_ids: [...in order], rotation_first_id } — stored so the
 * first person's turn is `startDate`. null = stop rotating; undefined = leave as is.
 */
function parseRotation(body: { rotation_ids?: unknown; rotation_first_id?: unknown }, startDate: string): { rotation: string | null; rotation_start: string | null } | undefined | 'bad' {
  if (body.rotation_ids === undefined) return undefined;
  if (body.rotation_ids === null) return { rotation: null, rotation_start: null };
  const ids = body.rotation_ids;
  if (!Array.isArray(ids) || ids.length < 2 || !ids.every((x) => typeof x === 'string') || new Set(ids).size !== ids.length) return 'bad';
  const known = db.prepare('SELECT 1 FROM family_members WHERE id = ?');
  if (!ids.every((id) => known.get(id))) return 'bad';
  const first = typeof body.rotation_first_id === 'string' ? ids.indexOf(body.rotation_first_id) : 0;
  const ordered = [...ids.slice(Math.max(0, first)), ...ids.slice(0, Math.max(0, first))] as string[];
  return { rotation: JSON.stringify(ordered), rotation_start: startDate };
}

/** A spot on the plan: both 0–1, or neither (the middle of the room). */
function parseSpot(x: unknown, y: unknown): { room_x: number | null; room_y: number | null } | null {
  if (x == null && y == null) return { room_x: null, room_y: null };
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { room_x: Math.min(1, Math.max(0, x)), room_y: Math.min(1, Math.max(0, y)) };
}

/** A task's room must be a real one (or none). */
function roomExists(roomId: string | null | undefined): boolean {
  return !roomId || Boolean(db.prepare('SELECT 1 FROM floorplan_rooms WHERE id = ?').get(roomId));
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
  const { kind, title, notes, assignee_ids, created_by_id, recurrence, due_date, time_of_day, icon, room_id } = req.body as Partial<Task> & {
    assignee_ids?: string[];
  };
  if (room_id && !mayPlace(req, assignee_ids ?? [], (req.body as { acting_member_id?: unknown }).acting_member_id)) {
    return res.status(403).json({ error: 'Only a parent can put this on the floor plan' });
  }
  const rotation = parseRotation(req.body, (req.body as { rotation_start?: string }).rotation_start || todayStr());
  if (rotation === 'bad') return res.status(400).json({ error: 'Taking turns needs at least two different people' });
  if (rotation?.rotation && !mayRotate(req)) return res.status(403).json({ error: 'Only a parent can set up taking turns' });
  if (rotation?.rotation && (recurrence ?? 'once') === 'once') return res.status(400).json({ error: 'Taking turns is for chores that repeat' });
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  if (kind !== 'chore' && kind !== 'todo') return res.status(400).json({ error: 'kind must be chore or todo' });
  if (!roomExists(room_id)) return res.status(400).json({ error: 'That room is gone — pick another' });

  const task: Task = {
    id: uuidv4(),
    kind,
    title: title.trim(),
    notes: notes ?? null,
    created_by_id: created_by_id ?? null,
    recurrence: (recurrence as Task['recurrence']) ?? 'once',
    due_date: due_date ?? null,
    time_of_day: time_of_day ?? null,
    icon: icon ?? null,
    room_id: room_id || null,
    room_x: null,
    room_y: null,
    rotation: rotation?.rotation ?? null,
    rotation_start: rotation?.rotation_start ?? null,
    needed_since: null,
    reward_type: null,
    reward_amount: null,
    active: 1,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO tasks (id, kind, title, notes, created_by_id, recurrence, due_date, time_of_day, icon, room_id, room_x, room_y, rotation, rotation_start, active, created_at)
     VALUES (@id, @kind, @title, @notes, @created_by_id, @recurrence, @due_date, @time_of_day, @icon, @room_id, @room_x, @room_y, @rotation, @rotation_start, @active, @created_at)`
  ).run(task);
  // A rotating chore is on everyone in the rotation (whose turn it is, is worked out per day).
  setAssignees(task.id, rotation?.rotation ? (JSON.parse(rotation.rotation) as string[]) : assignee_ids ?? []);
  res.status(201).json({ ...task, assignee_ids: assignee_ids ?? [], completions: [] });
});

/**
 * PATCH /by-title/icon { title, icon } — sets the Adventure Map checkpoint icon on every active
 * task sharing this exact title (e.g. every kid's own "Make your bed" copy) in one shot, instead
 * of a parent having to open and edit each kid's copy separately. Parent-only (requireAdmin) — a
 * bulk edit like this isn't an everyday action. Placed before PATCH /:id so it can't be shadowed
 * by it (Express only matches /:id against a single path segment anyway, but this stays explicit).
 */
tasksRouter.patch('/by-title/icon', requireAdmin, (req, res) => {
  const { title, icon } = req.body as { title?: string; icon?: string | null };
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });

  const { changes } = db.prepare('UPDATE tasks SET icon = ? WHERE title = ? AND active = 1').run(icon || null, title.trim());
  res.json({ updated: changes });
});

tasksRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });

  const {
    assignee_ids: requestedAssignees,
    acting_member_id,
    room_x: _x,
    room_y: _y,
    rotation: _r,
    rotation_start: _rs,
    rotation_ids: _ri,
    rotation_first_id: _rf,
    rotation_next_id: _rn,
    ...fields
  } = req.body as Partial<Task> & {
    assignee_ids?: string[];
    acting_member_id?: unknown;
    rotation_ids?: unknown;
    rotation_first_id?: unknown;
    rotation_next_id?: unknown;
  };
  let assignee_ids = requestedAssignees;
  const rotation = parseRotation(req.body, todayStr());
  if (rotation === 'bad') return res.status(400).json({ error: 'Taking turns needs at least two different people' });
  const rotating = Boolean(existing.rotation);
  if (rotation !== undefined && !mayRotate(req)) {
    return res.status(403).json({ error: 'Only a parent can change who takes turns' });
  }
  // A rotating chore's people are its rotation — dragging it to someone's column doesn't change that.
  if (rotation === undefined && rotating) assignee_ids = undefined;
  if (rotation?.rotation) assignee_ids = JSON.parse(rotation.rotation) as string[];
  const updated: Task = { ...existing, ...fields, ...(rotation ?? {}), id: existing.id };
  if (updated.rotation && updated.recurrence === 'once') return res.status(400).json({ error: 'Taking turns is for chores that repeat' });
  updated.room_id = updated.room_id || null;
  if (!roomExists(updated.room_id)) return res.status(400).json({ error: 'That room is gone — pick another' });
  if (updated.room_id !== existing.room_id) {
    // Moving it to another room (from the edit form) — only someone who may place it, and the old
    // exact spot doesn't belong to the new room.
    if (!mayPlace(req, assignee_ids ?? assigneesFor(existing.id), acting_member_id)) {
      return res.status(403).json({ error: 'Only a parent can change where this is on the floor plan' });
    }
    updated.room_x = null;
    updated.room_y = null;
  }
  db.prepare(
    `UPDATE tasks SET kind=@kind, title=@title, notes=@notes, recurrence=@recurrence,
     due_date=@due_date, time_of_day=@time_of_day, icon=@icon, room_id=@room_id, room_x=@room_x, room_y=@room_y,
     rotation=@rotation, rotation_start=@rotation_start, active=@active WHERE id=@id`
  ).run(updated);
  if (assignee_ids !== undefined) setAssignees(req.params.id, assignee_ids);
  res.json({ ...updated, assignee_ids: assignee_ids ?? assigneesFor(req.params.id) });
});

/**
 * PATCH /api/tasks/:id/location { room_id, x?, y?, acting_member_id? } — puts a chore/to-do at a
 * spot on the floor plan (dragged there), or takes it off (room_id null). Parents, or a kid allowed
 * to place their own jobs (see mayPlace).
 */
tasksRouter.patch('/:id/location', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });
  const { room_id, x, y, acting_member_id } = req.body as { room_id?: string | null; x?: unknown; y?: unknown; acting_member_id?: unknown };
  if (!mayPlace(req, assigneesFor(existing.id), acting_member_id)) {
    return res.status(403).json({ error: 'Only a parent can change where this is on the floor plan' });
  }
  if (!roomExists(room_id)) return res.status(400).json({ error: 'That room is gone — pick another' });
  const spot = room_id ? parseSpot(x, y) : { room_x: null, room_y: null };
  if (!spot) return res.status(400).json({ error: 'x and y must be numbers from 0 to 1' });
  db.prepare('UPDATE tasks SET room_id = ?, room_x = ?, room_y = ? WHERE id = ?').run(room_id || null, spot.room_x, spot.room_y, existing.id);
  res.json({ ...existing, room_id: room_id || null, ...spot, assignee_ids: assigneesFor(existing.id) });
});

/**
 * PUT /api/tasks/order/:memberId { task_ids: [...] } — this person's routine: their jobs in the
 * order they should do them (1st, 2nd, …). Replaces their whole order; jobs left out are unordered.
 */
tasksRouter.put('/order/:memberId', (req, res) => {
  const ids = (req.body as { task_ids?: unknown }).task_ids;
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) return res.status(400).json({ error: 'task_ids must be a list' });
  if (!db.prepare('SELECT 1 FROM family_members WHERE id = ?').get(req.params.memberId)) return res.status(404).json({ error: 'not found' });
  const known = db.prepare('SELECT 1 FROM tasks WHERE id = ?');
  const insert = db.prepare('INSERT INTO task_positions (family_member_id, task_id, position) VALUES (?, ?, ?)');
  db.transaction(() => {
    db.prepare('DELETE FROM task_positions WHERE family_member_id = ?').run(req.params.memberId);
    [...new Set(ids as string[])].filter((id) => known.get(id)).forEach((id, i) => insert.run(req.params.memberId, id, i + 1));
  })();
  res.status(204).end();
});

/**
 * POST /api/tasks/:id/needed { needed?: boolean } — 🔔 a "when needed" chore needs doing (anyone can
 * say so — the dishwasher's clean, the trash is full); it shows up for whoever's turn it is.
 */
tasksRouter.post('/:id/needed', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
  if (!task) return res.status(404).json({ error: 'not found' });
  if (task.recurrence !== 'asneeded') return res.status(400).json({ error: 'Only a "when needed" chore can be called for' });
  const needed = (req.body as { needed?: boolean }).needed !== false;
  db.prepare('UPDATE tasks SET needed_since = ? WHERE id = ?').run(needed ? task.needed_since ?? todayStr() : null, task.id);
  res.json({ ...task, needed_since: needed ? task.needed_since ?? todayStr() : null });
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

  // A "when needed" chore is done until someone says it needs doing again.
  if (task.recurrence === 'asneeded') db.prepare('UPDATE tasks SET needed_since = NULL WHERE id = ?').run(task.id);

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
    // Undoing the last check-off of a "when needed" chore: it still needs doing.
    if (task?.recurrence === 'asneeded' && !task.needed_since) {
      const left = db.prepare('SELECT 1 FROM task_completions WHERE task_id = ? AND completed_on = ? LIMIT 1').get(task.id, date);
      if (!left) db.prepare('UPDATE tasks SET needed_since = ? WHERE id = ?').run(date, task.id);
    }
  }
  res.status(204).end();
});
