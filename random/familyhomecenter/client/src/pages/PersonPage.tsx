import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type CalendarEvent, type FamilyMember, type PersonDetail, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { TaskCard } from '../components/TaskCard.js';
import { TaskFormModal } from '../components/TaskFormModal.js';
import { FamilyMemberFormModal } from '../components/FamilyMemberFormModal.js';
import { CompletionTrendChart } from '../components/CompletionTrendChart.js';
import { CalendarAgenda } from '../components/CalendarAgenda.js';
import { canEditHistoricalTask, canEditTask, isTaskDoneFor, sortForColumn } from '../utils/tasks.js';
import { parseTimeOfDaySlots, timeOfDayIcon } from '../utils/timeOfDay.js';

const TREND_DAYS = 14;
const AGENDA_DAYS = 7;

/** What a specific day looked like for this person — every task assigned to them that day, done
 *  or not — opened by tapping a bar in the Trends/Late-completions charts. Mostly read-only (this
 *  is history, not necessarily today, so there's no complete/uncomplete toggle here), but offers
 *  an edit button per canEditHistoricalTask — e.g. to fix a to-do that was given the wrong
 *  time-of-day and so looks like it was missed. */
function DayDetailModal({
  member,
  date,
  activeProfile,
  onClose,
  onEdit,
}: {
  member: FamilyMember;
  date: string;
  activeProfile: FamilyMember | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
}) {
  const [tasks, setTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    setTasks(null);
    api
      .get<Task[]>(`/tasks?date=${date}`)
      .then((all) => setTasks(sortForColumn(all.filter((t) => t.assignee_ids.includes(member.id)))))
      .catch(() => setTasks([]));
  }, [date, member.id]);

  const label = new Date(`${date}T00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel task-form" onClick={(e) => e.stopPropagation()}>
        <h2>{member.name} — {label}</h2>
        {tasks === null && <div className="empty-state">Loading…</div>}
        {tasks !== null && tasks.length === 0 && <div className="empty-state">Nothing assigned this day.</div>}
        {tasks !== null && tasks.length > 0 && (
          <>
            <ul className="day-detail__list">
              {tasks.map((t) => {
                const done = isTaskDoneFor(t, member.id);
                return (
                  <li key={t.id}>
                    <span className={`badge badge--${t.kind}`}>{t.kind === 'chore' ? 'Chore' : 'To-do'}</span>{' '}
                    <span className={done ? 'day-detail__title--done' : undefined}>{t.title}</span>
                    <span className={`day-detail__status ${done ? 'day-detail__status--done' : 'day-detail__status--pending'}`}>
                      {done ? '✓ Done' : 'Not done'}
                    </span>
                    {canEditHistoricalTask(t, member.id, activeProfile) && (
                      <button type="button" className="task-card__edit" aria-label="Edit" onClick={() => onEdit(t)}>
                        ✎
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {!activeProfile && (
              <p className="hint">
                Pick your name (or a parent's) up top to edit a wrongly-timed to-do or chore from here.
              </p>
            )}
            {activeProfile && !activeProfile.is_parent && !tasks.some((t) => canEditHistoricalTask(t, member.id, activeProfile)) && (
              <p className="hint">
                Only {member.name} or a parent can edit a to-do here; only a parent can edit a chore.
              </p>
            )}
          </>
        )}
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const { activeProfile, refresh } = useFamilyMembers();
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [detailDate, setDetailDate] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    api
      .get<PersonDetail>(`/family-members/${id}/detail?statsDays=${TREND_DAYS}&upcomingDays=${AGENDA_DAYS}`)
      .then(setDetail)
      .catch(() => setNotFound(true));
  };
  useEffect(load, [id]);

  useEffect(() => {
    if (!id) return;
    const start = new Date().toISOString();
    const end = new Date(Date.now() + AGENDA_DAYS * 86400_000).toISOString();
    api.get<CalendarEvent[]>(`/calendar/events?start=${start}&end=${end}`).then(setEvents).catch(console.error);
  }, [id]);

  if (notFound) return <div className="empty-state">Family member not found.</div>;
  if (!detail) return null;

  const { member, agenda, stats } = detail;
  const [current, ...upcoming] = agenda;
  const currentTasks = sortForColumn(current?.tasks ?? []);
  const personEvents = events.filter((e) => !e.for_member_id || e.for_member_id === member.id);
  // Household-trust-level rule (see utils/tasks.ts's canEditTask comment) — real enforcement is
  // server-side once a password protects it (requireSelfOrAdmin), same as Bank.
  const canEditProfile = Boolean(activeProfile && (activeProfile.id === member.id || activeProfile.is_parent === 1));

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
        <div className="person-page__header-icons">
          {canEditProfile && (
            <button
              type="button"
              className="person-page__icon-link"
              aria-label={`Edit ${member.name}'s profile`}
              onClick={() => setEditingProfile(true)}
            >
              ✎
            </button>
          )}
          <Link to={`/person/${member.id}/bank`} className="person-page__icon-link" aria-label={`${member.name}'s bank`}>
            🏦
          </Link>
        </div>
      </header>

      <section className="panel">
        <h2>Trends — last {TREND_DAYS} days</h2>
        {stats.completionsByDay.every((d) => d.count === 0) ? (
          <div className="empty-state">Nothing completed yet in this window.</div>
        ) : (
          <CompletionTrendChart data={stats.completionsByDay} color={member.color} onSelectDate={setDetailDate} />
        )}
        <p className="hint">Tap a day for what was completed and what wasn't.</p>
      </section>

      {stats.lateByDay.some((d) => d.count > 0) && (
        <section className="panel">
          <h2>Late completions</h2>
          <p className="hint">
            A time-of-day slot finished after its window (morning: noon, afternoon: 4pm), or a
            to-do finished after its due date.
          </p>
          <CompletionTrendChart data={stats.lateByDay} color="#f59e0b" onSelectDate={setDetailDate} />
        </section>
      )}

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
                    {parseTimeOfDaySlots(t.time_of_day).length > 0 && (
                      <span className="hint"> {parseTimeOfDaySlots(t.time_of_day).map((s) => timeOfDayIcon(s)).join(' ')}</span>
                    )}
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

      <section className="panel">
        <h2>Calendar — next {AGENDA_DAYS} days</h2>
        <CalendarAgenda events={personEvents} days={AGENDA_DAYS} wholeFamilyLabel="Whole family" />
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

      {detailDate && (
        <DayDetailModal
          member={member}
          date={detailDate}
          activeProfile={activeProfile}
          onClose={() => setDetailDate(null)}
          onEdit={(t) => {
            setDetailDate(null);
            setModalTask(t);
          }}
        />
      )}

      {editingProfile && (
        <FamilyMemberFormModal
          member={member}
          canChangeRole={activeProfile?.is_parent === 1}
          onClose={() => setEditingProfile(false)}
          onSaved={() => {
            setEditingProfile(false);
            load();
            refresh();
          }}
        />
      )}
    </div>
  );
}
