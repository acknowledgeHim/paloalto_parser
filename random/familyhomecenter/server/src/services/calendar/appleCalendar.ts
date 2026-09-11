import { DAVClient } from 'tsdav';
import ICAL from 'ical.js';
import { config } from '../../config.js';
import type { CalendarEvent } from '../../types.js';

export function isAppleConfigured(): boolean {
  return Boolean(config.apple.appleId && config.apple.appSpecificPassword);
}

async function connect(): Promise<DAVClient | null> {
  if (!isAppleConfigured()) return null;
  const client = new DAVClient({
    serverUrl: 'https://caldav.icloud.com',
    credentials: {
      username: config.apple.appleId,
      password: config.apple.appSpecificPassword,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
  await client.login();
  return client;
}

/** Fetch events from every iCloud calendar within [rangeStart, rangeEnd] (ISO date strings). */
export async function fetchAppleEvents(rangeStart: string, rangeEnd: string): Promise<CalendarEvent[]> {
  const client = await connect();
  if (!client) return [];

  const rangeStartDate = new Date(rangeStart);
  const rangeEndDate = new Date(rangeEnd);
  const calendars = await client.fetchCalendars();
  const events: CalendarEvent[] = [];

  for (const cal of calendars) {
    const objects = await client.fetchCalendarObjects({ calendar: cal });
    for (const obj of objects) {
      if (!obj.data) continue;
      try {
        const jcalData = ICAL.parse(obj.data);
        const comp = new ICAL.Component(jcalData);
        for (const vevent of comp.getAllSubcomponents('vevent')) {
          const icalEvent = new ICAL.Event(vevent);
          const color = typeof cal.calendarColor === 'string' ? cal.calendarColor : '#a2845e';
          const pushOccurrence = (start: ICAL.Time, end: ICAL.Time, uidSuffix = '') => {
            const startJs = start.toJSDate();
            const endJs = end.toJSDate();
            if (endJs < rangeStartDate || startJs > rangeEndDate) return;
            events.push({
              id: `apple:${icalEvent.uid}${uidSuffix}`,
              source: 'apple',
              title: icalEvent.summary || '(untitled)',
              description: icalEvent.description || null,
              location: icalEvent.location || null,
              start_at: startJs.toISOString(),
              end_at: endJs.toISOString(),
              all_day: start.isDate,
              color,
            });
          };

          if (icalEvent.isRecurring()) {
            const iterator = icalEvent.iterator();
            let next: ICAL.Time | null;
            let count = 0;
            // Cap iterations defensively; recurring events run indefinitely otherwise.
            while ((next = iterator.next()) && count < 500) {
              count += 1;
              if (next.toJSDate() > rangeEndDate) break;
              const duration = icalEvent.duration;
              const occurrenceEnd = next.clone();
              occurrenceEnd.addDuration(duration);
              pushOccurrence(next, occurrenceEnd, `:${next.toString()}`);
            }
          } else {
            pushOccurrence(icalEvent.startDate, icalEvent.endDate);
          }
        }
      } catch (err) {
        console.warn('[appleCalendar] failed to parse calendar object', err);
      }
    }
  }
  return events;
}
