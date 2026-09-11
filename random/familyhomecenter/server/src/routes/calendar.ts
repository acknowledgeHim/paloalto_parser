import { Router } from 'express';
import {
  listAllEvents,
  syncExternalCalendars,
} from '../services/calendar/aggregator.js';
import { createLocalEvent, updateLocalEvent, deleteLocalEvent } from '../services/calendar/localCalendar.js';
import { getGoogleAuthUrl, handleGoogleCallback, isGoogleConfigured, isGoogleConnected } from '../services/calendar/googleCalendar.js';
import { isAppleConfigured } from '../services/calendar/appleCalendar.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const calendarRouter = Router();

/** GET /api/calendar/events?start=ISO&end=ISO */
calendarRouter.get('/events', (req, res) => {
  const start = (req.query.start as string) || new Date().toISOString();
  const end = (req.query.end as string) || new Date(Date.now() + 30 * 86400_000).toISOString();
  res.json(listAllEvents(start, end));
});

calendarRouter.get('/sources', (_req, res) => {
  res.json({
    local: { enabled: true },
    google: { configured: isGoogleConfigured(), connected: isGoogleConnected() },
    apple: { configured: isAppleConfigured() },
  });
});

calendarRouter.post(
  '/sync',
  asyncHandler(async (_req, res) => {
    await syncExternalCalendars();
    res.status(204).end();
  })
);

// ---- Local events CRUD ----
calendarRouter.post('/local', (req, res) => {
  const { title, description, location, start_at, end_at, all_day, color, created_by_id, for_member_id } = req.body;
  if (!title || !start_at || !end_at) {
    return res.status(400).json({ error: 'title, start_at, end_at are required' });
  }
  const event = createLocalEvent({
    title, description, location, start_at, end_at, all_day, color, created_by_id, for_member_id,
  });
  res.status(201).json(event);
});

calendarRouter.patch('/local/:id', (req, res) => {
  const updated = updateLocalEvent(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(updated);
});

calendarRouter.delete('/local/:id', (req, res) => {
  deleteLocalEvent(req.params.id);
  res.status(204).end();
});

// ---- Google OAuth handshake ----
// Gated: starting this flow connects a specific Google account to the whole household's calendar,
// which is a configuration action, not everyday use.
calendarRouter.get('/google/auth-url', requireAdmin, (_req, res) => {
  if (!isGoogleConfigured()) return res.status(400).json({ error: 'Google client not configured in .env' });
  res.json({ url: getGoogleAuthUrl() });
});

calendarRouter.get('/google/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    await handleGoogleCallback(code);
    await syncExternalCalendars();
    res.send('<html><body>Google Calendar connected — you can close this tab.</body></html>');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to connect Google Calendar. Check server logs.');
  }
});
