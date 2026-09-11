import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import type { CalendarEvent } from '../../types.js';

interface LocalEventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: 0 | 1;
  color: string;
  created_by_id: string | null;
  for_member_id: string | null;
  created_at: string;
}

export function listLocalEvents(rangeStart: string, rangeEnd: string): CalendarEvent[] {
  const rows = db
    .prepare(
      `SELECT * FROM local_events WHERE start_at <= ? AND end_at >= ? ORDER BY start_at ASC`
    )
    .all(rangeEnd, rangeStart) as LocalEventRow[];

  return rows.map((r) => ({
    id: r.id,
    source: 'local',
    title: r.title,
    description: r.description,
    location: r.location,
    start_at: r.start_at,
    end_at: r.end_at,
    all_day: Boolean(r.all_day),
    color: r.color,
    for_member_id: r.for_member_id,
    created_by_id: r.created_by_id,
  }));
}

export function createLocalEvent(input: {
  title: string;
  description?: string | null;
  location?: string | null;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  color?: string;
  created_by_id?: string | null;
  for_member_id?: string | null;
}): LocalEventRow {
  const row: LocalEventRow = {
    id: uuidv4(),
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    start_at: input.start_at,
    end_at: input.end_at,
    all_day: input.all_day ? 1 : 0,
    color: input.color ?? '#5b8def',
    created_by_id: input.created_by_id ?? null,
    for_member_id: input.for_member_id ?? null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO local_events (id, title, description, location, start_at, end_at, all_day, color, created_by_id, for_member_id, created_at)
     VALUES (@id, @title, @description, @location, @start_at, @end_at, @all_day, @color, @created_by_id, @for_member_id, @created_at)`
  ).run(row);
  return row;
}

export function updateLocalEvent(id: string, patch: Partial<LocalEventRow>): LocalEventRow | null {
  const existing = db.prepare('SELECT * FROM local_events WHERE id = ?').get(id) as LocalEventRow | undefined;
  if (!existing) return null;
  const updated = { ...existing, ...patch, id };
  db.prepare(
    `UPDATE local_events SET title=@title, description=@description, location=@location, start_at=@start_at,
     end_at=@end_at, all_day=@all_day, color=@color, for_member_id=@for_member_id WHERE id=@id`
  ).run(updated);
  return updated;
}

export function deleteLocalEvent(id: string): void {
  db.prepare('DELETE FROM local_events WHERE id = ?').run(id);
}
