import type { RequestHandler } from 'express';
import { canAccessBank, SESSION_COOKIE_NAME } from '../services/auth.js';

/**
 * Gates every bank route to the specific kid (the :memberId route param) or a parent — real,
 * session-based enforcement (unlike most everyday permissions in this app), because this is
 * explicitly meant to be private. See services/auth.ts's canAccessBank for the activation rule.
 */
export const requireBankAccess: RequestHandler = (req, res, next) => {
  if (canAccessBank(req.cookies?.[SESSION_COOKIE_NAME], req.params.memberId)) return next();
  res.status(401).json({ error: 'Only this person or a parent can view this' });
};
