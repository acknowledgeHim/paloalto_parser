import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const settingsRouter = Router();

const KEYS = ['idle_timeout_seconds', 'slideshow_interval_seconds'] as const;

// GET stays open: every kiosk/phone reads this on load to drive its own idle-screensaver timer,
// regardless of whether anyone's logged in to Settings.
settingsRouter.get('/', (_req, res) => {
  const result: Record<string, string> = {};
  for (const key of KEYS) result[key] = getSetting(key);
  res.json(result);
});

settingsRouter.patch('/', requireAdmin, (req, res) => {
  for (const key of KEYS) {
    if (req.body[key] !== undefined) setSetting(key, String(req.body[key]));
  }
  const result: Record<string, string> = {};
  for (const key of KEYS) result[key] = getSetting(key);
  res.json(result);
});
