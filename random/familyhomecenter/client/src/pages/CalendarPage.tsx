import { useEffect, useMemo, useState } from 'react';
import { api, type CalendarEvent } from '../api/client.js';
import { CalendarMonthView } from '../components/CalendarMonthView.js';
import { CalendarAgenda } from '../components/CalendarAgenda.js';
import { AddEventForm } from '../components/AddEventForm.js';

export function CalendarPage() {
  const [monthDate, setMonthDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  interface CalendarSources {
    google?: { connected: boolean; configured: boolean };
    apple?: { configured: boolean };
  }
  const [sources, setSources] = useState<CalendarSources>({});

  const range = useMemo(() => {
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 2, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [monthDate]);

  const load = () => {
    api.get<CalendarEvent[]>(`/calendar/events?start=${range.start}&end=${range.end}`).then(setEvents).catch(console.error);
  };

  useEffect(load, [range.start, range.end]);
  useEffect(() => {
    api.get<CalendarSources>('/calendar/sources').then(setSources).catch(console.error);
  }, []);

  const connectGoogle = async () => {
    const { url } = await api.get<{ url: string }>('/calendar/google/auth-url');
    window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="calendar-page">
      <div className="calendar-page__toolbar">
        <button onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}>‹</button>
        <h1>{monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h1>
        <button onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}>›</button>
        <div className="calendar-page__spacer" />
        {sources.google && !sources.google.connected && sources.google.configured && (
          <button className="secondary" onClick={connectGoogle}>Connect Google Calendar</button>
        )}
        <button onClick={() => setShowForm(true)}>+ Add event</button>
      </div>

      {showForm && <AddEventForm onCreated={load} onClose={() => setShowForm(false)} />}

      <div className="calendar-page__body">
        <CalendarMonthView monthDate={monthDate} events={events} />
        <aside className="panel calendar-page__agenda">
          <h2>Next up</h2>
          <CalendarAgenda events={events.filter((e) => new Date(e.end_at) >= new Date())} days={7} />
        </aside>
      </div>
    </div>
  );
}
