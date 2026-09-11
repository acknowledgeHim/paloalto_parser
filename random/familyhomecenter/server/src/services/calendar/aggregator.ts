import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { listLocalEvents } from './localCalendar.js';
import { fetchGoogleEvents, isGoogleConnected } from './googleCalendar.js';
import { fetchAppleEvents, isAppleConfigured } from './appleCalendar.js';
import type { CalendarEvent } from '../../types.js';

// How far ahead/behind of "now" the background sync keeps cached, in days.
const SYNC_WINDOW_DAYS = 60;

function windowRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  const end = new Date(now);
  end.setDate(end.getDate() + SYNC_WINDOW_DAYS);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Pull external (Google/Apple) events into the local cache table. Safe to call repeatedly. */
export async function syncExternalCalendars(): Promise<void> {
  const { start, end } = windowRange();
  const [googleEvents, appleEvents] = await Promise.all([
    isGoogleConnected() ? fetchGoogleEvents(start, end).catch((e) => (console.warn('[sync] google failed', e), [])) : [],
    isAppleConfigured() ? fetchAppleEvents(start, end).catch((e) => (console.warn('[sync] apple failed', e), [])) : [],
  ]);

  const upsert = db.prepare(
    `INSERT INTO external_events_cache
       (id, source, source_calendar_id, external_id, title, location, start_at, end_at, all_day, color, synced_at)
     VALUES (@id, @source, NULL, @external_id, @title, @location, @start_at, @end_at, @all_day, @color, @synced_at)
     ON CONFLICT(source, external_id) DO UPDATE SET
       title=excluded.title, location=excluded.location, start_at=excluded.start_at,
       end_at=excluded.end_at, all_day=excluded.all_day, color=excluded.color, synced_at=excluded.synced_at`
  );

  const syncedAt = new Date().toISOString();
  const runAll = db.transaction((events: CalendarEvent[]) => {
    for (const ev of events) {
      upsert.run({
        id: uuidv4(),
        source: ev.source,
        external_id: ev.id,
        title: ev.title,
        location: ev.location ?? null,
        start_at: ev.start_at,
        end_at: ev.end_at,
        all_day: ev.all_day ? 1 : 0,
        color: ev.color,
        synced_at: syncedAt,
      });
    }
  });
  runAll([...googleEvents, ...appleEvents]);

  // Drop stale cached events from a since-removed source calendar (weren't touched this sync).
  db.prepare(`DELETE FROM external_events_cache WHERE source = 'google' AND synced_at != ?`).run(
    isGoogleConnected() ? syncedAt : ''
  );
  db.prepare(`DELETE FROM external_events_cache WHERE source = 'apple' AND synced_at != ?`).run(
    isAppleConfigured() ? syncedAt : ''
  );
}

export function startCalendarSyncSchedule(): void {
  // Sync on boot, then every 15 minutes.
  syncExternalCalendars().catch((e) => console.warn('[sync] initial sync failed', e));
  cron.schedule('*/15 * * * *', () => {
    syncExternalCalendars().catch((e) => console.warn('[sync] scheduled sync failed', e));
  });
}

export function listCachedExternalEvents(rangeStart: string, rangeEnd: string): CalendarEvent[] {
  const rows = db
    .prepare(
      `SELECT * FROM external_events_cache WHERE start_at <= ? AND end_at >= ? ORDER BY start_at ASC`
    )
    .all(rangeEnd, rangeStart) as Array<{
    id: string;
    source: 'google' | 'apple';
    title: string;
    location: string | null;
    start_at: string;
    end_at: string;
    all_day: 0 | 1;
    color: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    title: r.title,
    description: null,
    location: r.location,
    start_at: r.start_at,
    end_at: r.end_at,
    all_day: Boolean(r.all_day),
    color: r.color,
  }));
}

/** Merge local + cached-external events for the requested range, sorted by start time. */
export function listAllEvents(rangeStart: string, rangeEnd: string): CalendarEvent[] {
  const events = [...listLocalEvents(rangeStart, rangeEnd), ...listCachedExternalEvents(rangeStart, rangeEnd)];
  return events.sort((a, b) => a.start_at.localeCompare(b.start_at));
}
