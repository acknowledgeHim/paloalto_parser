import type { CalendarEvent } from '../api/client.js';

interface Props {
  monthDate: Date; // any date within the month to render
  events: CalendarEvent[];
  onSelectDay?: (date: Date) => void;
  /** Called when a local event is clicked, to edit it — external (Google/Apple) events aren't editable here. */
  onSelectEvent?: (event: CalendarEvent) => void;
}

function startOfCalendarGrid(monthDate: Date): Date {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return gridStart;
}

/** Every calendar day (as a toDateString() key) an event touches, start through end inclusive —
 *  so a multi-day event (e.g. a trip, 9/22-9/28) shows up on each day of the grid, not just the
 *  first. Capped at a year so a malformed/runaway range can't loop the render forever. */
function dayKeysFor(event: CalendarEvent): string[] {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const keys: string[] = [];
  for (let i = 0; cursor <= lastDay && i < 366; i++) {
    keys.push(cursor.toDateString());
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

export function CalendarMonthView({ monthDate, events, onSelectDay, onSelectEvent }: Props) {
  const gridStart = startOfCalendarGrid(monthDate);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    for (const key of dayKeysFor(ev)) {
      if (!eventsByDay.has(key)) eventsByDay.set(key, []);
      eventsByDay.get(key)!.push(ev);
    }
  }

  const today = new Date().toDateString();
  const currentMonth = monthDate.getMonth();

  return (
    <div className="month-view">
      <div className="month-view__weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="month-view__grid">
        {cells.map((d) => {
          const key = d.toDateString();
          const dayEvents = eventsByDay.get(key) ?? [];
          return (
            <button
              key={key}
              className={[
                'month-view__cell',
                d.getMonth() !== currentMonth ? 'month-view__cell--outside' : '',
                key === today ? 'month-view__cell--today' : '',
              ].join(' ')}
              onClick={() => onSelectDay?.(d)}
            >
              <div className="month-view__date">{d.getDate()}</div>
              <div className="month-view__events">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    className={['month-view__event', ev.source === 'local' && onSelectEvent ? 'month-view__event--editable' : ''].join(' ')}
                    style={{ background: ev.color }}
                    title={ev.title}
                    onClick={(e) => {
                      if (ev.source !== 'local' || !onSelectEvent) return;
                      e.stopPropagation();
                      onSelectEvent(ev);
                    }}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && <div className="month-view__more">+{dayEvents.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
