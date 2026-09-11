import { google } from 'googleapis';
import { db } from '../../db.js';
import { config } from '../../config.js';
import type { CalendarEvent } from '../../types.js';

interface StoredTokens {
  access_token: string | null;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  expiry_date: number | null;
}

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

function oauthClient() {
  return new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, config.google.redirectUri);
}

export function isGoogleConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret);
}

export function isGoogleConnected(): boolean {
  const row = db.prepare('SELECT refresh_token FROM google_tokens WHERE id = 1').get() as
    | { refresh_token: string | null }
    | undefined;
  return Boolean(row?.refresh_token);
}

export function getGoogleAuthUrl(): string {
  const client = oauthClient();
  return client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
}

export async function handleGoogleCallback(code: string): Promise<void> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  db.prepare(
    `INSERT INTO google_tokens (id, access_token, refresh_token, scope, token_type, expiry_date)
     VALUES (1, @access_token, @refresh_token, @scope, @token_type, @expiry_date)
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, google_tokens.refresh_token),
       scope = excluded.scope, token_type = excluded.token_type, expiry_date = excluded.expiry_date`
  ).run({
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token ?? null,
    scope: tokens.scope ?? null,
    token_type: tokens.token_type ?? null,
    expiry_date: tokens.expiry_date ?? null,
  });
}

function loadClient() {
  const row = db.prepare('SELECT * FROM google_tokens WHERE id = 1').get() as StoredTokens | undefined;
  if (!row?.refresh_token) return null;
  const client = oauthClient();
  client.setCredentials({
    access_token: row.access_token ?? undefined,
    refresh_token: row.refresh_token ?? undefined,
    scope: row.scope ?? undefined,
    token_type: row.token_type ?? undefined,
    expiry_date: row.expiry_date ?? undefined,
  });
  client.on('tokens', (tokens) => {
    db.prepare(
      `UPDATE google_tokens SET
         access_token = COALESCE(@access_token, access_token),
         refresh_token = COALESCE(@refresh_token, refresh_token),
         expiry_date = COALESCE(@expiry_date, expiry_date)
       WHERE id = 1`
    ).run({
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      expiry_date: tokens.expiry_date ?? null,
    });
  });
  return client;
}

/** Fetch events from every calendar on the user's Google account within [rangeStart, rangeEnd]. */
export async function fetchGoogleEvents(rangeStart: string, rangeEnd: string): Promise<CalendarEvent[]> {
  const auth = loadClient();
  if (!auth) return [];

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarList = await calendar.calendarList.list();
  const events: CalendarEvent[] = [];

  for (const cal of calendarList.data.items ?? []) {
    if (!cal.id) continue;
    const resp = await calendar.events.list({
      calendarId: cal.id,
      timeMin: new Date(rangeStart).toISOString(),
      timeMax: new Date(rangeEnd).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    for (const ev of resp.data.items ?? []) {
      const start = ev.start?.dateTime ?? ev.start?.date;
      const end = ev.end?.dateTime ?? ev.end?.date;
      if (!start || !end || !ev.id) continue;
      events.push({
        id: `google:${ev.id}`,
        source: 'google',
        title: ev.summary ?? '(untitled)',
        description: ev.description ?? null,
        location: ev.location ?? null,
        start_at: start,
        end_at: end,
        all_day: Boolean(ev.start?.date && !ev.start?.dateTime),
        color: cal.backgroundColor ?? '#4285f4',
      });
    }
  }
  return events;
}
