import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type PersonDetail, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { TaskCard } from '../components/TaskCard.js';
import { TaskFormModal } from '../components/TaskFormModal.js';
import { CompletionTrendChart } from '../components/CompletionTrendChart.js';
import { canEditTask, sortForColumn } from '../utils/tasks.js';

const TIME_OF_DAY_LABEL: Record<string, string> = { morning: '🌅', afternoon: '☀️', evening: '🌙' };
const TREND_DAYS = 14;

export function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const { activeProfile } = useFamilyMembers();
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [modalTask, setModalTask] = useState<Task | null>(null);

  const load = () => {
    if (!id) return;
    api
      .get<PersonDetail>(`/family-members/${id}/detail?statsDays=${TREND_DAYS}&upcomingDays=7`)
      .then(setDetail)
      .catch(() => setNotFound(true));
  };
  useEffect(load, [id]);

  if (notFound) return <div className="empty-state">Family member not found.</div>;
  if (!detail) return null;

  const { member, agenda, stats } = detail;
  const [current, ...upcoming] = agenda;
  const currentTasks = sortForColumn(current?.tasks ?? []);

  return (
    <div className="person-page">
      <Link to="/board" className="link-button">‹ Back to Family Board</Link>

      <header className="person-page__header">
        <MemberAvatar member={member} size={64} />
        <div>
          <h1>{member.name}</h1>
          <div className="person-page__balances">
            <span>⭐ {member.star_balance}</span>
            <span>${member.money_balance.toFixed(2)}</span>
          </div>
        </div>
      </header>

      <section className="panel">
        <h2>Trends — last {TREND_DAYS} days</h2>
        {stats.completionsByDay.every((d) => d.count === 0) ? (
          <div className="empty-state">Nothing completed yet in this window.</div>
        ) : (
          <CompletionTrendChart data={stats.completionsByDay} color={member.color} />
        )}
      </section>

      {stats.strugglingTasks.length > 0 && (
        <section className="panel">
          <h2>Could use a reminder</h2>
          <p className="hint">Recurring chores/to-dos missed most often over the last {stats.statsDays} days.</p>
          <ul className="person-page__struggling-list">
            {stats.strugglingTasks.map((t) => (
              <li key={t.task_id}>
                <span className={`badge badge--${t.kind}`}>{t.kind === 'chore' ? 'Chore' : 'To-do'}</span>
                <span className="person-page__struggling-title">{t.title}</span>
                <span className="hint">missed {t.missed} of {t.expected} times</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>Today</h2>
        {currentTasks.length === 0 && <div className="empty-state">Nothing today</div>}
        {currentTasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onChange={load}
            hideAssignee
            viewerId={member.id}
            onEdit={canEditTask(t, activeProfile) ? setModalTask : undefined}
          />
        ))}
      </section>

      <section className="panel">
        <h2>Coming up</h2>
        {upcoming.every((d) => d.tasks.length === 0) && <div className="empty-state">Nothing scheduled in the next week</div>}
        {upcoming.map(
          (day) =>
            day.tasks.length > 0 && (
              <div key={day.date} className="person-page__upcoming-day">
                <div className="person-page__upcoming-date">
                  {new Date(`${day.date}T00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                {sortForColumn(day.tasks).map((t) => (
                  <div key={t.id} className="person-page__upcoming-task">
                    <span className={`badge badge--${t.kind}`}>{t.kind === 'chore' ? 'Chore' : 'To-do'}</span>
                    {t.title}
                    {t.time_of_day && <span className="hint"> {TIME_OF_DAY_LABEL[t.time_of_day]}</span>}
                    {canEditTask(t, activeProfile) && (
                      <button
                        type="button"
                        className="task-card__edit"
                        aria-label="Edit"
                        onClick={() => setModalTask(t)}
                      >
                        ✎
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
        )}
      </section>

      {modalTask && (
        <TaskFormModal
          task={modalTask}
          onClose={() => setModalTask(null)}
          onSaved={() => {
            setModalTask(null);
            load();
          }}
        />
      )}
    </div>
  );
}
