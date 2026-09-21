import type { RequestHandler } from 'express';
import { canManageMember, SESSION_COOKIE_NAME } from '../services/auth.js';

/**
 * Gates a family member's own profile edits (name, color, avatar, sound, etc — the "Parent" flag
 * itself is checked separately, see routes/familyMembers.ts's PATCH handler) to that member or a
 * parent. Real, session-based enforcement (unlike most everyday permissions in this app), same
 * spirit as Bank access — see services/auth.ts's canManageMember for the activation rule.
 */
export const requireSelfOrAdmin: RequestHandler = (req, res, next) => {
  if (canManageMember(req.cookies?.[SESSION_COOKIE_NAME], req.params.id)) return next();
  res.status(401).json({ error: 'Only this person or a parent can edit this' });
};
