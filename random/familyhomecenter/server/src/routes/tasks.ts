import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { taskAppliesOn, todayStr } from '../utils/recurrence.js';
import type { Task, TaskCompletion } from '../types.js';

export const tasksRouter = Router();

/**
 * GET /api/tasks?date=YYYY-MM-DD
 * Returns every active task that applies on `date` (defaults to today),
 * each annotated with whether it's completed for that date/instance.
 */
tasksRouter.get('/', (req, res) => {
  const date = (req.query.date as string) || todayStr();
  const tasks = db.prepare('SELECT * FROM tasks WHERE active = 1').all() as Task[];
  const applicable = tasks.filter((t) => taskAppliesOn(t, date));

  const completionStmt = db.prepare(
    'SELECT * FROM task_completions WHERE task_id = ? AND completed_on = ?'
  );
  const anyCompletionStmt = db.prepare(
    'SELECT * FROM task_completions WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1'
  );

  const result = applicable.map((task) => {
    const completion =
      task.recurrence === 'once'
        ? (anyCompletionStmt.get(task.id) as TaskCompletion | undefined)
        : (completionStmt.get(task.id, date) as TaskCompletion | undefined);
    return { ...task, completion: completion ?? null };
  });

  res.json(result);
});

tasksRouter.post('/', (req, res) => {
  const { kind, title, notes, assignee_id, created_by_id, recurrence, due_date, time_of_day } =
    req.body as Partial<Task>;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  if (kind !== 'chore' && kind !== 'todo') return res.status(400).json({ error: 'kind must be chore or todo' });

  const task: Task = {
    id: uuidv4(),
    kind,
    title: title.trim(),
    notes: notes ?? null,
    assignee_id: assignee_id ?? null,
    created_by_id: created_by_id ?? null,
    recurrence: (recurrence as Task['recurrence']) ?? 'once',
    due_date: due_date ?? null,
    time_of_day: time_of_day ?? null,
    active: 1,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO tasks (id, kind, title, notes, assignee_id, created_by_id, recurrence, due_date, time_of_day, active, created_at)
     VALUES (@id, @kind, @title, @notes, @assignee_id, @created_by_id, @recurrence, @due_date, @time_of_day, @active, @created_at)`
  ).run(task);
  res.status(201).json(task);
});

tasksRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });
  const updated: Task = { ...existing, ...req.body, id: existing.id };
  db.prepare(
    `UPDATE tasks SET title=@title, notes=@notes, assignee_id=@assignee_id, recurrence=@recurrence,
     due_date=@due_date, time_of_day=@time_of_day, active=@active WHERE id=@id`
  ).run(updated);
  res.json(updated);
});

tasksRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/** POST /api/tasks/:id/complete  { completed_by_id, date? } */
tasksRouter.post('/:id/complete', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
  if (!task) return res.status(404).json({ error: 'not found' });

  const date = (req.body.date as string) || todayStr();
  const completion: TaskCompletion = {
    id: uuidv4(),
    task_id: task.id,
    completed_on: date,
    completed_by_id: req.body.completed_by_id ?? null,
    completed_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO task_completions (id, task_id, completed_on, completed_by_id, completed_at)
     VALUES (@id, @task_id, @completed_on, @completed_by_id, @completed_at)
     ON CONFLICT(task_id, completed_on) DO UPDATE SET
       completed_by_id = excluded.completed_by_id, completed_at = excluded.completed_at`
  ).run(completion);
  res.status(201).json(completion);
});

/** POST /api/tasks/:id/uncomplete  { date? }  — undo a checkmark */
tasksRouter.post('/:id/uncomplete', (req, res) => {
  const date = (req.body.date as string) || todayStr();
  db.prepare('DELETE FROM task_completions WHERE task_id = ? AND completed_on = ?').run(req.params.id, date);
  res.status(204).end();
});
