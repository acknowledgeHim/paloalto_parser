import { useEffect, useState } from 'react';
import { api, type CalendarEvent, type Task } from '../api/client.js';
import { WeatherWidget } from '../components/WeatherWidget.js';
import { CalendarAgenda } from '../components/CalendarAgenda.js';
import { TaskCard } from '../components/TaskCard.js';

export function Dashboard() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadEvents = () => {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 7 * 86400_000).toISOString();
    api.get<CalendarEvent[]>(`/calendar/events?start=${start}&end=${end}`).then(setEvents).catch(console.error);
  };
  const loadTasks = () => {
    api.get<Task[]>('/tasks').then(setTasks).catch(console.error);
  };

  useEffect(() => {
    loadEvents();
    loadTasks();
    const interval = setInterval(() => {
      loadEvents();
      loadTasks();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const openTasks = tasks.filter((t) => !t.completion);

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
        <WeatherWidget />
      </header>

      <div className="dashboard__columns">
        <section className="panel">
          <h2>Coming up</h2>
          <CalendarAgenda events={events} />
        </section>

        <section className="panel">
          <h2>Today's chores &amp; tasks ({openTasks.length} open)</h2>
          {tasks.length === 0 && <div className="empty-state">Nothing on the list — add a chore or to-do!</div>}
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onChange={loadTasks} />
          ))}
        </section>
      </div>
    </div>
  );
}
