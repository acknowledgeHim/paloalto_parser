import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const settingsRouter = Router();

// contacts_distance_lookup: '1' = look up contacts' distance from home, which sends their street
// address to OpenStreetMap (services/geocodeAddress.ts) — off unless a parent turns it on.
// weather_off: '1' = no weather at all — nothing is asked of Open-Meteo (routes/weather.ts).
// weekly_report_off: '1' = no 📬 weekly report emails (services/weeklyReport.ts).
const KEYS = ['idle_timeout_seconds', 'slideshow_interval_seconds', 'contacts_distance_lookup', 'weather_off', 'weekly_report_off',
  // ☀️ Morning briefing on the wall screen: '1' = on, and the hours it shows between (start, end).
  'morning_briefing', 'morning_briefing_start', 'morning_briefing_end',
  // 🎞️ Weekly recap on the weekend screensaver: '1' = off.
  'recap_off',
  // ✅ Email parents when something's waiting for their OK: '1' = off.
  'approval_email_off'] as const;

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
