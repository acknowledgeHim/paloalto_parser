import type { RequestHandler } from 'express';
import { isAdminPasswordConfigured, isSessionValid, SESSION_COOKIE_NAME } from '../services/auth.js';

/**
 * Gates configuration-changing endpoints (family roster edits, calendar/Spotify connect, timing
 * settings). If no ADMIN_PASSWORD is set, everything stays open — same "optional, off by default"
 * pattern as the rest of this app's integrations. See docs/SETTINGS_LOGIN.md.
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!isAdminPasswordConfigured()) return next();
  if (isSessionValid(req.cookies?.[SESSION_COOKIE_NAME])) return next();
  res.status(401).json({ error: 'Settings login required' });
};
