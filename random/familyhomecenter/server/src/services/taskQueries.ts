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

/** Every active task applicable on `date`, each with its assignees and that date's completions
 *  (or, for a "once" task, every completion it's ever had — see routes/tasks.ts's GET /). */
export function tasksForDate(date: string): TaskWithAssignment[] {
  const tasks = db.prepare('SELECT * FROM tasks WHERE active = 1').all() as Task[];
  return tasks
    .filter((t) => taskAppliesOn(t, date))
    .map((task) => {
      const completions =
        task.recurrence === 'once'
          ? (db.prepare('SELECT * FROM task_completions WHERE task_id = ?').all(task.id) as TaskCompletion[])
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
