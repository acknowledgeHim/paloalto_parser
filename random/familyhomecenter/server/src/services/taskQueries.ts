import { db } from '../db.js';
import { taskAppliesOn } from '../utils/recurrence.js';
import type { Task, TaskCompletion, TaskWithAssignment } from '../types.js';

export function assigneesFor(taskId: string): string[] {
  return (
    db.prepare('SELECT family_member_id FROM task_assignees WHERE task_id = ?').all(taskId) as Array<{
      family_member_id: string;
    }>
  ).map((r) => r.family_member_id);
}

/**
 * A "once" task with no due date applies every single day until it's done (taskAppliesOn has no
 * concept of completions, so by itself it just returns true forever for that case). Its real
 * timeframe is "whenever someone gets to it" — once it has a completion from an earlier day, that
 * timeframe has passed, so it should stop applying (and therefore stop counting as done, in every
 * progress bar/list/log that trusts tasksForDate's output) on every day after that, instead of
 * permanently lingering on every future day's board. It's still included on the exact day it was
 * completed, so it shows crossed out there.
 */
function onceTaskStillOpenOn(task: Task, date: string): boolean {
  if (task.recurrence !== 'once' || task.due_date) return true;
  const row = db.prepare('SELECT 1 FROM task_completions WHERE task_id = ? AND completed_on < ? LIMIT 1').get(task.id, date);
  return !row;
}

/** Every active task applicable on `date`, each with its assignees and that date's completions
 *  (or, for a "once" task, every completion up through `date` — see routes/tasks.ts's GET /). */
export function tasksForDate(date: string): TaskWithAssignment[] {
  const tasks = db.prepare('SELECT * FROM tasks WHERE active = 1').all() as Task[];
  return tasks
    .filter((t) => taskAppliesOn(t, date))
    .filter((t) => onceTaskStillOpenOn(t, date))
    .map((task) => {
      const completions =
        task.recurrence === 'once'
          ? // Bounded by <= date, not unconditional — otherwise browsing/computing a date before a
            // once task's actual completion would already show it done, pulling in a completion
            // from its future relative to that date.
            (db
              .prepare('SELECT * FROM task_completions WHERE task_id = ? AND completed_on <= ?')
              .all(task.id, date) as TaskCompletion[])
          : (db
              .prepare('SELECT * FROM task_completions WHERE task_id = ? AND completed_on = ?')
              .all(task.id, date) as TaskCompletion[]);
      return { ...task, assignee_ids: assigneesFor(task.id), completions };
    });
}

export function allActiveTasks(): TaskWithAssignment[] {
  const tasks = db.prepare('SELECT * FROM tasks WHERE active = 1').all() as Task[];
  return tasks.map((task) => ({ ...task, assignee_ids: assigneesFor(task.id), completions: [] }));
}
