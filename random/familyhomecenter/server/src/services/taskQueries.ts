import { db } from '../db.js';
import { taskAppliesOn, todayStr } from '../utils/recurrence.js';
import type { Task, TaskCompletion, TaskWithAssignment } from '../types.js';

export function assigneesFor(taskId: string): string[] {
  return (
    db.prepare('SELECT family_member_id FROM task_assignees WHERE task_id = ?').all(taskId) as Array<{
      family_member_id: string;
    }>
  ).map((r) => r.family_member_id);
}

/**
 * A "once" task (with or without a due date — see taskAppliesOn) applies every single day from
 * whenever it starts mattering until it's done (taskAppliesOn has no concept of completions, so
 * by itself it just returns true forever from that point on). Its real timeframe is "whenever
 * someone gets to it" — once it has a completion from an earlier day, that timeframe has passed,
 * so it should stop applying (and therefore stop counting as done, in every progress bar/list/log
 * that trusts tasksForDate's output) on every day after that, instead of permanently lingering on
 * every future day's board. It's still included on the exact day it was completed, so it shows
 * crossed out there.
 */
function onceTaskStillOpenOn(task: Task, date: string): boolean {
  if (task.recurrence !== 'once') return true;
  const row = db.prepare('SELECT 1 FROM task_completions WHERE task_id = ? AND completed_on < ? LIMIT 1').get(task.id, date);
  return !row;
}

/** Every active task applicable on `date`, each with its assignees and that date's completions
 *  (or, for a "once" task, every completion up through `date` — see routes/tasks.ts's GET /). */
/** The people a chore takes turns between, in order (null = it doesn't rotate). */
export function rotationIds(task: Pick<Task, 'rotation'>): string[] | null {
  if (!task.rotation) return null;
  try {
    const ids = JSON.parse(task.rotation) as unknown;
    return Array.isArray(ids) && ids.length > 0 && ids.every((x) => typeof x === 'string') ? (ids as string[]) : null;
  } catch {
    return null;
  }
}

/**
 * Whose turn a rotating chore is on `date`. Turns pass on when it's *done*, not by the calendar:
 * rotation[0] has it from rotation_start until they (or anyone) do it, then the next person has it
 * until it's done again, and so on — so a chore that isn't needed every day (the dishwasher) still
 * goes round fairly. On a day it was done, it's the person who did it (so it shows done in their
 * column). null = not a rotating chore.
 */
export function rotationTurn(task: Task, date: string): string | null {
  return rotationState(task, date)?.turn ?? null;
}

function rotationState(task: Task, date: string): { turn: string; next: string; upcoming: string } | null {
  const ids = rotationIds(task);
  if (!ids || !task.rotation_start) return null;
  const done = db
    .prepare(
      `SELECT completed_on, completed_by_id FROM task_completions
       WHERE task_id = ? AND completed_on >= ? AND completed_on <= ? ORDER BY completed_on, completed_at`
    )
    .all(task.id, task.rotation_start, date) as Array<{ completed_on: string; completed_by_id: string | null }>;
  // Each day it was done is one turn used (doing a morning and an evening slot is still one turn).
  const daysBefore = new Set(done.filter((c) => c.completed_on < date).map((c) => c.completed_on)).size;
  const n = ids.length;
  const due = ids[daysBefore % n];
  const today = done.filter((c) => c.completed_on === date);
  if (today.length) {
    const by = today.find((c) => c.completed_by_id && ids.includes(c.completed_by_id))?.completed_by_id;
    const next = ids[(daysBefore + 1) % n];
    return { turn: by ?? due, next, upcoming: next };
  }
  return { turn: due, next: ids[(daysBefore + 1) % n], upcoming: due };
}

/** Does a "when needed" chore show on `date`: someone said it needs doing (on or before then), or it was done that day. */
function asNeededShowsOn(task: Task, date: string): boolean {
  if (task.needed_since && task.needed_since <= date) return true;
  return Boolean(db.prepare('SELECT 1 FROM task_completions WHERE task_id = ? AND completed_on = ? LIMIT 1').get(task.id, date));
}

/** A task with who it's on for `date`: for a rotating chore, just whoever's turn it is. */
function withAssignees(task: Task, date: string, completions: TaskCompletion[]): TaskWithAssignment {
  const ids = rotationIds(task);
  const state = ids ? rotationState(task, date) : null;
  if (ids && state) return { ...task, assignee_ids: [state.turn], completions, rotation_ids: ids, rotation_next_id: state.next };
  return { ...task, assignee_ids: assigneesFor(task.id), completions };
}

/** Every person's routine order, by task: task id → { member id: position }. */
function allPositions(): Map<string, Record<string, number>> {
  const rows = db.prepare('SELECT family_member_id, task_id, position FROM task_positions').all() as Array<{
    family_member_id: string;
    task_id: string;
    position: number;
  }>;
  const map = new Map<string, Record<string, number>>();
  for (const r of rows) map.set(r.task_id, { ...(map.get(r.task_id) ?? {}), [r.family_member_id]: r.position });
  return map;
}

export function tasksForDate(date: string): TaskWithAssignment[] {
  const tasks = db.prepare('SELECT * FROM tasks WHERE active = 1').all() as Task[];
  const positions = allPositions();
  return tasks
    .filter((t) => (t.recurrence === 'asneeded' ? asNeededShowsOn(t, date) : taskAppliesOn(t, date)))
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
      return { ...withAssignees(task, date, completions), positions: positions.get(task.id) ?? {} };
    });
}

export function allActiveTasks(): TaskWithAssignment[] {
  const tasks = db.prepare('SELECT * FROM tasks WHERE active = 1').all() as Task[];
  // Everyone a rotating chore can land on (for setting things up — rewards, the floor plan…), and
  // whose turn it is now (for "when needed" chores waiting for a 🔔).
  const today = todayStr();
  const positions = allPositions();
  const finishedOnce = new Set(
    (
      db
        .prepare(`SELECT DISTINCT c.task_id FROM task_completions c JOIN tasks t ON t.id = c.task_id WHERE t.recurrence = 'once'`)
        .all() as Array<{ task_id: string }>
    ).map((r) => r.task_id)
  );
  return tasks.map((task) => {
    const state = rotationState(task, today);
    return {
      ...task,
      positions: positions.get(task.id) ?? {},
      finished: finishedOnce.has(task.id),
      assignee_ids: assigneesFor(task.id),
      completions: [],
      rotation_ids: rotationIds(task) ?? undefined,
      rotation_next_id: state?.upcoming,
    };
  });
}
