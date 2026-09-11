import type { CalendarEvent } from '../api/client.js';

interface Props {
  events: CalendarEvent[];
  days?: number;
}

function fmtTime(iso: string, allDay: boolean): string {
  if (allDay) return 'All day';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Simple "what's coming up" list, grouped by calendar day — used on the dashboard. */
export function CalendarAgenda({ events, days = 5 }: Props) {
  const byDay = new Map<string, CalendarEvent[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const ev of events) {
    const dayKey = new Date(ev.start_at).toDateString();
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey)!.push(ev);
  }

  const dayKeys = Array.from(byDay.keys())
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .slice(0, days);

  if (dayKeys.length === 0) {
    return <div className="agenda agenda--empty">No upcoming events</div>;
  }

  return (
    <div className="agenda">
      {dayKeys.map((dayKey) => (
        <div key={dayKey} className="agenda__day">
          <div className="agenda__day-label">
            {new Date(dayKey).toDateString() === today.toDateString()
              ? 'Today'
              : new Date(dayKey).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          {byDay.get(dayKey)!.map((ev) => (
            <div key={ev.id} className="agenda__event" style={{ borderLeftColor: ev.color }}>
              <span className="agenda__event-time">{fmtTime(ev.start_at, ev.all_day)}</span>
              <span className="agenda__event-title">{ev.title}</span>
              <span className={`badge badge--source-${ev.source}`}>{ev.source}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
