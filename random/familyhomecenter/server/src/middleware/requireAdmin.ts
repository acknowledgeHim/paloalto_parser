import type { RequestHandler } from 'express';
import { isAdminGateActive, isRequestAdmin, SESSION_COOKIE_NAME } from '../services/auth.js';

/**
 * Gates configuration-changing endpoints (family roster edits, calendar/Spotify connect, timing
 * settings, Prize Bank rewards). Same "optional, off by default" pattern as the rest of this app:
 * if no parent has set a password (and the legacy ADMIN_PASSWORD isn't set either), nothing is
 * gated yet. Once at least one is, this requires the current session to be either the legacy
 * household recovery login or a parent's own login — see docs/SETTINGS_LOGIN.md. A logged-in
 * kid's session does not pass, even though it's a valid session.
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!isAdminGateActive()) return next();
  if (isRequestAdmin(req.cookies?.[SESSION_COOKIE_NAME])) return next();
  res.status(401).json({ error: 'Parent login required' });
};
