import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { deleteAvatarImage, findAvatarImage, saveAvatarImage } from '../services/avatars.js';
import { deleteCompletionSound, findCompletionSound, saveCompletionSound } from '../services/sounds.js';
import { createSession, hashPassword, verifyMemberPassword, SESSION_COOKIE_NAME } from '../services/auth.js';
import type { FamilyMember } from '../types.js';

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
  const members = db.prepare('SELECT * FROM family_members ORDER BY created_at ASC').all() as FamilyMember[];
  res.json(members.map(toPublic));
});

familyMembersRouter.post('/', requireAdmin, (req, res) => {
  const { name, color, avatar, complete_sound, is_parent } = req.body as Partial<FamilyMember>;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const member: FamilyMember = {
    id: uuidv4(),
    name: name.trim(),
    color: color || '#5b8def',
    avatar: avatar ?? null,
    complete_sound: complete_sound ?? null,
    star_balance: 0,
    money_balance: 0,
    password_hash: null,
    is_parent: is_parent ? 1 : 0,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO family_members (id, name, color, avatar, complete_sound, is_parent, created_at)
     VALUES (@id, @name, @color, @avatar, @complete_sound, @is_parent, @created_at)`
  ).run(member);
  res.status(201).json(toPublic(member));
});

familyMembersRouter.patch('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM family_members WHERE id = ?').get(req.params.id) as
    | FamilyMember
    | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });

  const updated: FamilyMember = {
    ...existing,
    ...req.body,
    id: existing.id,
    is_parent: req.body.is_parent !== undefined ? (req.body.is_parent ? 1 : 0) : existing.is_parent,
  };
  db.prepare(
    `UPDATE family_members SET name = @name, color = @color, avatar = @avatar,
     complete_sound = @complete_sound, is_parent = @is_parent WHERE id = @id`
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
  requireAdmin,
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
  requireAdmin,
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
  requireAdmin,
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
  requireAdmin,
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
