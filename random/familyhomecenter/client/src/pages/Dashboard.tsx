import { useEffect, useState } from 'react';
import { api, type CalendarEvent, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { WeatherWidget } from '../components/WeatherWidget.js';
import { CalendarAgenda } from '../components/CalendarAgenda.js';
import { TaskCard } from '../components/TaskCard.js';
import { TaskFormModal } from '../components/TaskFormModal.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { canEditTask } from '../utils/tasks.js';

export function Dashboard() {
  const { members, activeProfile } = useFamilyMembers();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalTask, setModalTask] = useState<Task | null>(null);

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

  const openTasks = tasks.filter((t) => t.completions.length === 0);
  const rewardTasks = tasks.filter((t) => t.reward_type);

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
        <WeatherWidget />
      </header>

      {rewardTasks.length > 0 && (
        <section className="panel">
          <h2>Prize Bank progress today</h2>
          {members.map((m) => {
            const memberRewardTasks = rewardTasks.filter((t) => t.assignee_ids.includes(m.id));
            if (memberRewardTasks.length === 0) return null;
            const done = memberRewardTasks.filter((t) => t.completions.some((c) => c.completed_by_id === m.id)).length;
            const pct = Math.round((done / memberRewardTasks.length) * 100);
            return (
              <div key={m.id} className="dashboard__progress">
                <div className="dashboard__progress-label">
                  <span><MemberAvatar member={m} size={18} /> {m.name}</span>
                  <span>{done}/{memberRewardTasks.length} completed</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div className="dashboard__columns">
        <section className="panel">
          <h2>Coming up</h2>
          <CalendarAgenda events={events} />
        </section>

        <section className="panel">
          <h2>Today's chores &amp; tasks ({openTasks.length} open)</h2>
          {tasks.length === 0 && <div className="empty-state">Nothing on the list — add a chore or to-do!</div>}
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onChange={loadTasks}
              onEdit={canEditTask(t, activeProfile) ? setModalTask : undefined}
            />
          ))}
        </section>
      </div>

      {modalTask && (
        <TaskFormModal
          task={modalTask}
          onClose={() => setModalTask(null)}
          onSaved={() => {
            setModalTask(null);
            loadTasks();
          }}
        />
      )}
    </div>
  );
}
