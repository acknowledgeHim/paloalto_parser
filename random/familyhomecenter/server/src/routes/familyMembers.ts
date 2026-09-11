import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import type { FamilyMember } from '../types.js';

export const familyMembersRouter = Router();

// GET stays open: the profile switcher and every assignee dropdown (tasks, calendar, music) need
// the roster for everyday use. Only adding/editing/removing a family member is "configuration".
familyMembersRouter.get('/', (_req, res) => {
  const members = db.prepare('SELECT * FROM family_members ORDER BY created_at ASC').all();
  res.json(members);
});

familyMembersRouter.post('/', requireAdmin, (req, res) => {
  const { name, color, avatar, is_parent } = req.body as Partial<FamilyMember>;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const member: FamilyMember = {
    id: uuidv4(),
    name: name.trim(),
    color: color || '#5b8def',
    avatar: avatar ?? null,
    is_parent: is_parent ? 1 : 0,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    'INSERT INTO family_members (id, name, color, avatar, is_parent, created_at) VALUES (@id, @name, @color, @avatar, @is_parent, @created_at)'
  ).run(member);
  res.status(201).json(member);
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
    'UPDATE family_members SET name = @name, color = @color, avatar = @avatar, is_parent = @is_parent WHERE id = @id'
  ).run(updated);
  res.json(updated);
});

familyMembersRouter.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM family_members WHERE id = ?').run(req.params.id);
  res.status(204).end();
});
