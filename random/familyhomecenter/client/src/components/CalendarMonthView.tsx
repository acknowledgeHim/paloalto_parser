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

export function CalendarMonthView({ monthDate, events, onSelectDay, onSelectEvent }: Props) {
  const gridStart = startOfCalendarGrid(monthDate);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = new Date(ev.start_at).toDateString();
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(ev);
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
