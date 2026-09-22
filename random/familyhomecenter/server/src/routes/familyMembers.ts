import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireSelfOrAdmin } from '../middleware/requireSelfOrAdmin.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { deleteAvatarImage, findAvatarImage, saveAvatarImage } from '../services/avatars.js';
import { deleteCompletionSound, findCompletionSound, saveCompletionSound } from '../services/sounds.js';
import {
  createSession,
  hashPassword,
  verifyMemberPassword,
  isAdminGateActive,
  isRequestAdmin,
  SESSION_COOKIE_NAME,
} from '../services/auth.js';
import { tasksForDate } from '../services/taskQueries.js';
import { addDays, isCompletionLate, taskAppliesOn, timeOfDaySlots, todayStr } from '../utils/recurrence.js';
import type { FamilyMember, Task, TaskWithAssignment } from '../types.js';

export const familyMembersRouter = Router();

const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax' as const, maxAge: 30 * 24 * 60 * 60 * 1000 };

/** Never send password_hash to the client — expose only whether one is set. */
function toPublic(member: FamilyMember) {
  const { password_hash, ...rest } = member;
  return { ...rest, has_password: Boolean(password_hash) };
}

// GET stays open: the profile switcher and every assignee dropdown (tasks, calendar, music) need
// the roster for everyday use. Only adding/editing/removing a family member is "configuration".
familyMembersRouter.get('/', (_req, res) => {
  const members = db.prepare('SELECT * FROM family_members ORDER BY sort_order ASC, created_at ASC').all() as FamilyMember[];
  res.json(members.map(toPublic));
});

/**
 * POST /reorder { ids: string[] } — sets sort_order to each id's position in the given array
 * (any member left out keeps its existing sort_order). Parent-only, same gate as adding/removing
 * a family member — this is roster configuration, not everyday use.
 */
familyMembersRouter.post('/reorder', requireAdmin, (req, res) => {
  const { ids } = req.body as { ids?: string[] };
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
  const setOrder = db.prepare('UPDATE family_members SET sort_order = ? WHERE id = ?');
  db.transaction(() => {
    ids.forEach((id, i) => setOrder.run(i, id));
  })();
  const members = db.prepare('SELECT * FROM family_members ORDER BY sort_order ASC, created_at ASC').all() as FamilyMember[];
  res.json(members.map(toPublic));
});

/**
 * GET /:id/detail?upcomingDays=7&statsDays=30 — everything the per-person page needs in one call:
 * today's + upcoming days' assigned tasks, a daily completion count for the trend chart, and which
 * recurring tasks this person has been missing most (expected occurrences vs. actually completed,
 * over the stats window). Completions are never deleted except by an explicit "uncomplete", so this
 * is a real historical record, not a rolling snapshot.
 */
familyMembersRouter.get('/:id/detail', (req, res) => {
  const member = db.prepare('SELECT * FROM family_members WHERE id = ?').get(req.params.id) as FamilyMember | undefined;
  if (!member) return res.status(404).json({ error: 'not found' });

  const today = todayStr();
  const upcomingDays = Math.min(Math.max(Number(req.query.upcomingDays) || 7, 1), 31);
  const statsDays = Math.min(Math.max(Number(req.query.statsDays) || 30, 1), 180);

  const agenda: Array<{ date: string; tasks: TaskWithAssignment[] }> = [];
  for (let i = 0; i < upcomingDays; i++) {
    const date = addDays(today, i);
    agenda.push({ date, tasks: tasksForDate(date).filter((t) => t.assignee_ids.includes(member.id)) });
  }

  const startDate = addDays(today, -(statsDays - 1));

  const completionRows = db
    .prepare(
      `SELECT completed_on as date, COUNT(*) as count FROM task_completions
       WHERE completed_by_id = ? AND completed_on >= ? AND completed_on <= ?
       GROUP BY completed_on`
    )
    .all(member.id, startDate, today) as Array<{ date: string; count: number }>;
  const countByDate = new Map(completionRows.map((r) => [r.date, r.count]));
  const completionsByDay = Array.from({ length: statsDays }, (_, i) => {
    const date = addDays(startDate, i);
    return { date, count: countByDate.get(date) ?? 0 };
  });

  // "Late" = a time-of-day slot completed after its window closed, or a one-off task completed
  // after its due date — see isCompletionLate. Needs each completion joined back to its task for
  // recurrence/due_date, so this is a separate query from the plain per-day count above.
  const lateRows = db
    .prepare(
      `SELECT tc.completed_on as completed_on, tc.completed_at as completed_at, tc.time_of_day as time_of_day,
              t.recurrence as recurrence, t.due_date as due_date
       FROM task_completions tc
       JOIN tasks t ON t.id = tc.task_id
       WHERE tc.completed_by_id = ? AND tc.completed_on >= ? AND tc.completed_on <= ?`
    )
    .all(member.id, startDate, today) as Array<{
    completed_on: string;
    completed_at: string;
    time_of_day: string | null;
    recurrence: string;
    due_date: string | null;
  }>;
  const lateCountByDate = new Map<string, number>();
  for (const row of lateRows) {
    if (
      isCompletionLate({
        completedAt: row.completed_at,
        completedOn: row.completed_on,
        timeOfDay: row.time_of_day,
        recurrence: row.recurrence,
        dueDate: row.due_date,
      })
    ) {
      lateCountByDate.set(row.completed_on, (lateCountByDate.get(row.completed_on) ?? 0) + 1);
    }
  }
  const lateByDay = Array.from({ length: statsDays }, (_, i) => {
    const date = addDays(startDate, i);
    return { date, count: lateCountByDate.get(date) ?? 0 };
  });

  const assignedTaskIds = db
    .prepare('SELECT task_id FROM task_assignees WHERE family_member_id = ?')
    .all(member.id) as Array<{ task_id: string }>;

  const strugglingTasks: Array<{ task_id: string; title: string; kind: string; expected: number; completed: number; missed: number }> = [];
  for (const { task_id } of assignedTaskIds) {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND active = 1').get(task_id) as Task | undefined;
    if (!task || task.recurrence === 'once') continue; // "missed" isn't meaningful for a one-off

    // A task with multiple time-of-day slots (e.g. "morning,evening") expects — and can
    // independently complete — one occurrence per slot per applicable day, not just one.
    const slots = timeOfDaySlots(task.time_of_day);
    const perDay = Math.max(1, slots.length);

    let expected = 0;
    for (let i = 0; i < statsDays; i++) {
      if (taskAppliesOn(task, addDays(startDate, i))) expected += perDay;
    }
    if (expected === 0) continue;

    const { n: completed } = db
      .prepare(
        `SELECT COUNT(DISTINCT completed_on || ':' || COALESCE(time_of_day, '')) as n FROM task_completions
         WHERE task_id = ? AND completed_by_id = ? AND completed_on >= ? AND completed_on <= ?`
      )
      .get(task_id, member.id, startDate, today) as { n: number };

    const missed = expected - completed;
    if (missed > 0) strugglingTasks.push({ task_id, title: task.title, kind: task.kind, expected, completed, missed });
  }
  strugglingTasks.sort((a, b) => b.missed - a.missed);

  res.json({
    member: toPublic(member),
    today,
    agenda,
    stats: { statsDays, completionsByDay, lateByDay, strugglingTasks },
  });
});

familyMembersRouter.post('/', requireAdmin, (req, res) => {
  const { name, color, avatar, complete_sound, progress_bar_style, is_parent } = req.body as Partial<FamilyMember>;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const { max } = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as max FROM family_members').get() as { max: number };
  const member: FamilyMember = {
    id: uuidv4(),
    name: name.trim(),
    color: color || '#5b8def',
    avatar: avatar ?? null,
    complete_sound: complete_sound ?? null,
    progress_bar_style: progress_bar_style ?? null,
    star_balance: 0,
    money_balance: 0,
    password_hash: null,
    is_parent: is_parent ? 1 : 0,
    sort_order: max + 1,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO family_members (id, name, color, avatar, complete_sound, progress_bar_style, is_parent, sort_order, created_at)
     VALUES (@id, @name, @color, @avatar, @complete_sound, @progress_bar_style, @is_parent, @sort_order, @created_at)`
  ).run(member);
  res.status(201).json(toPublic(member));
});

/**
 * PATCH /:id — self-service (that member) or a parent, per requireSelfOrAdmin, so a kid can edit
 * their own avatar/color/sound/etc without needing a parent login. The "Parent" flag itself is a
 * privilege escalation risk though, so it's excluded here unless the requester is verified as an
 * actual admin (parent/legacy recovery) — a kid PATCHing their own record can't self-promote. Once
 * the admin gate isn't active yet (no password configured anywhere), that check is moot and this
 * matches the rest of the app's open, household-trust default.
 */
familyMembersRouter.patch('/:id', requireSelfOrAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM family_members WHERE id = ?').get(req.params.id) as
    | FamilyMember
    | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });

  const body = { ...req.body } as Partial<FamilyMember>;
  const canChangeRole = !isAdminGateActive() || isRequestAdmin(req.cookies?.[SESSION_COOKIE_NAME]);
  if (!canChangeRole) delete body.is_parent;

  const updated: FamilyMember = {
    ...existing,
    ...body,
    id: existing.id,
    is_parent: body.is_parent !== undefined ? (body.is_parent ? 1 : 0) : existing.is_parent,
  };
  db.prepare(
    `UPDATE family_members SET name = @name, color = @color, avatar = @avatar,
     complete_sound = @complete_sound, progress_bar_style = @progress_bar_style, is_parent = @is_parent WHERE id = @id`
  ).run(updated);
  res.json(toPublic(updated));
});

familyMembersRouter.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM family_members WHERE id = ?').run(req.params.id);
  deleteAvatarImage(req.params.id).catch(() => {});
  deleteCompletionSound(req.params.id).catch(() => {});
  res.status(204).end();
});

/**
 * PUT /:id/password { current_password?, new_password } — deliberately NOT admin-gated: this is
 * how anyone (parent or kid) sets/changes/removes their OWN login, self-service. If a password is
 * already set, current_password must match it; if none is set yet, this is first-time setup and
 * anything goes (bootstrapping — a family roster is a trusted starting point, same spirit as the
 * rest of this app). Setting a password also logs this browser in as that person.
 */
familyMembersRouter.put(
  '/:id/password',
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM family_members WHERE id = ?').get(req.params.id) as
      | FamilyMember
      | undefined;
    if (!existing) return res.status(404).json({ error: 'not found' });

    const { current_password, new_password } = req.body as { current_password?: string; new_password?: string | null };
    if (existing.password_hash && !verifyMemberPassword(current_password ?? '', existing.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const nextHash = new_password ? hashPassword(new_password) : null;
    db.prepare('UPDATE family_members SET password_hash = ? WHERE id = ?').run(nextHash, req.params.id);

    if (nextHash) {
      const { token } = createSession(req.params.id);
      res.cookie(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
    }
    res.json({ has_password: Boolean(nextHash) });
  })
);

/** POST /:id/avatar { imageDataUrl } — uploads/replaces this member's custom photo avatar. */
familyMembersRouter.post(
  '/:id/avatar',
  requireSelfOrAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM family_members WHERE id = ?').get(req.params.id) as
      | FamilyMember
      | undefined;
    if (!existing) return res.status(404).json({ error: 'not found' });
    const { imageDataUrl } = req.body as { imageDataUrl?: string };
    if (!imageDataUrl) return res.status(400).json({ error: 'imageDataUrl is required' });

    await saveAvatarImage(req.params.id, imageDataUrl);
    db.prepare('UPDATE family_members SET avatar = ? WHERE id = ?').run('image', req.params.id);
    res.json(toPublic({ ...existing, avatar: 'image' }));
  })
);

/** DELETE /:id/avatar — removes a custom photo avatar (falls back to emoji/initial). */
familyMembersRouter.delete(
  '/:id/avatar',
  requireSelfOrAdmin,
  asyncHandler(async (req, res) => {
    await deleteAvatarImage(req.params.id);
    db.prepare("UPDATE family_members SET avatar = NULL WHERE id = ?").run(req.params.id);
    res.status(204).end();
  })
);

// Public like GET / above — every avatar shows up in everyday UI (profile switcher, task cards),
// not just Settings.
familyMembersRouter.get(
  '/:id/avatar-image',
  asyncHandler(async (req, res) => {
    const file = await findAvatarImage(req.params.id);
    if (!file) return res.status(404).end();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(file);
  })
);

/** POST /:id/sound { audioDataUrl } — uploads a custom MP3 completion sound (client plays only the first few seconds). */
familyMembersRouter.post(
  '/:id/sound',
  requireSelfOrAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM family_members WHERE id = ?').get(req.params.id) as
      | FamilyMember
      | undefined;
    if (!existing) return res.status(404).json({ error: 'not found' });
    const { audioDataUrl } = req.body as { audioDataUrl?: string };
    if (!audioDataUrl) return res.status(400).json({ error: 'audioDataUrl is required' });

    await saveCompletionSound(req.params.id, audioDataUrl);
    db.prepare('UPDATE family_members SET complete_sound = ? WHERE id = ?').run('custom', req.params.id);
    res.json(toPublic({ ...existing, complete_sound: 'custom' }));
  })
);

/** DELETE /:id/sound — removes a custom MP3 (falls back to no sound / a preset if one is chosen instead). */
familyMembersRouter.delete(
  '/:id/sound',
  requireSelfOrAdmin,
  asyncHandler(async (req, res) => {
    await deleteCompletionSound(req.params.id);
    db.prepare("UPDATE family_members SET complete_sound = NULL WHERE id = ? AND complete_sound = 'custom'").run(
      req.params.id
    );
    res.status(204).end();
  })
);

// Public — needs to play during everyday task completion, not just Settings.
familyMembersRouter.get(
  '/:id/sound-file',
  asyncHandler(async (req, res) => {
    const file = await findCompletionSound(req.params.id);
    if (!file) return res.status(404).end();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(file);
  })
);
