import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type FamilyMember, type Task, type CalendarEvent } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { TaskCard } from '../components/TaskCard.js';
import { CalendarAgenda } from '../components/CalendarAgenda.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { isTaskDoneFor, sortForColumn } from '../utils/tasks.js';
import { progressFillFor } from '../utils/progressStyles.js';
import { timeOfDayIcon } from '../utils/timeOfDay.js';

// tasks (from GET /api/tasks, no ?date=) is already scoped to "what applies today" — for a
// recurring task the server only ever attaches completions where completed_on equals that date,
// but for a "once" task (see taskQueries.ts's tasksForDate) it attaches every completion the task
// has ever had, since a one-time task with no due date keeps applying indefinitely and its single
// completion doesn't reset daily. Filtering here by completed_on === today additionally used to
// drop that once-task's completion whenever it happened on an earlier day, undercounting this
// log relative to the progress bars/task list (which just check "has any completion" — see
// countProgress/isTaskDoneFor) even though the same task correctly shows as done everywhere else.
function completedToday(tasks: Task[], memberId: string) {
  return tasks
    .filter((t) => t.assignee_ids.includes(memberId))
    .flatMap((t) =>
      t.completions.filter((c) => c.completed_by_id === memberId).map((c) => ({ task: t, completion: c }))
    );
}

// Usually today (recurring tasks always are), but a one-time task with no due date keeps
// counting as done indefinitely once completed — show its actual date then, not just a time,
// so an older completion showing up here under "completed today" isn't confusing.
function fmtCompletedAt(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
}

function CompletedTodayModal({ member, tasks, onClose }: { member: FamilyMember; tasks: Task[]; onClose: () => void }) {
  const items = completedToday(tasks, member.id);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel task-form" onClick={(e) => e.stopPropagation()}>
        <h2>{member.name} — completed today</h2>
        {items.length === 0 && <div className="empty-state">Nothing completed yet today.</div>}
        <ul className="settings-page__member-list">
          {items.map(({ task, completion }) => (
            <li key={completion.id}>
              <span className={`badge badge--${task.kind}`}>{task.kind === 'chore' ? 'Chore' : 'To-do'}</span>{' '}
              {task.title}
              {completion.time_of_day && <span className="hint"> {timeOfDayIcon(completion.time_of_day)}</span>}
              <span className="person-column__count">{fmtCompletedAt(completion.completed_at)}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function countProgress(tasks: Task[], memberId: string, kind: 'chore' | 'todo') {
  const relevant = tasks.filter((t) => t.kind === kind && t.assignee_ids.includes(memberId));
  const done = relevant.filter((t) => t.completions.some((c) => c.completed_by_id === memberId)).length;
  return { done, total: relevant.length };
}

function MemberProgressBars({ member, tasks }: { member: FamilyMember; tasks: Task[] }) {
  const fill = progressFillFor(member.progress_bar_style, member.color);
  const bars: Array<{ label: string; done: number; total: number }> = [
    { label: 'Chores', ...countProgress(tasks, member.id, 'chore') },
    { label: 'To-dos', ...countProgress(tasks, member.id, 'todo') },
  ].filter((b) => b.total > 0);

  if (bars.length === 0) return null;

  return (
    <div className="member-progress">
      {bars.map((b) => (
        <div key={b.label} className="dashboard__progress">
          <div className="dashboard__progress-label">
            <span>{b.label}</span>
            <span>{b.done}/{b.total}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${Math.round((b.done / b.total) * 100)}%`, background: fill }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * One glance per person: their chores, their to-dos, and what's on the calendar for them —
 * side by side with everyone else's. A separate view from the Chores & Tasks page, which is
 * better for quickly filtering/checking things off; this one is better for "what does everyone
 * have going on."
 */
export function FamilyBoardPage() {
  const { members } = useFamilyMembers();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [logMemberId, setLogMemberId] = useState<string | null>(null);
  // Collapsed by default — with several people, everyone's full chore/calendar lists push the
  // next row of columns far down the page. Collapsed shows just the avatar + progress bars;
  // clicking expands that one person's column to the full detail.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpandedIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadTasks = () => api.get<Task[]>('/tasks').then(setTasks).catch(console.error);

  useEffect(() => {
    loadTasks();
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 14 * 86400_000).toISOString();
    api.get<CalendarEvent[]>(`/calendar/events?start=${start}&end=${end}`).then(setEvents).catch(console.error);
  }, []);

  const unassignedTasks = sortForColumn(tasks.filter((t) => t.assignee_ids.length === 0));
  const familyEvents = events.filter((e) => !e.for_member_id);

  return (
    <div className="family-board">
      <h1>Family Board</h1>

      <section className="panel">
        <h2>Coming up for everyone</h2>
        <CalendarAgenda events={familyEvents} days={5} />
      </section>

      <div className="family-board__columns">
        {members.map((member) => {
          const allMemberTasks = tasks.filter((t) => t.assignee_ids.includes(member.id));
          // Pending first (still actionable), done ones after — struck through via TaskCard's own
          // "done" styling, same as the main Chores & To-dos page. Columns collapse by default now,
          // so there's no more scroll cost to leaving completed chores visible at a glance.
          const sortedMemberTasks = sortForColumn(allMemberTasks);
          const pendingTasks = sortedMemberTasks.filter((t) => !isTaskDoneFor(t, member.id));
          const doneMemberTasks = sortedMemberTasks.filter((t) => isTaskDoneFor(t, member.id));
          const memberEvents = events.filter((e) => e.for_member_id === member.id);
          const doneToday = completedToday(tasks, member.id).length;
          const expanded = expandedIds.has(member.id);
          return (
            <section key={member.id} className={`panel person-column ${expanded ? '' : 'person-column--collapsed'}`}>
              <h2>
                <Link to={`/person/${member.id}`} className="person-column__link">
                  <MemberAvatar member={member} /> {member.name}
                </Link>
                <button
                  type="button"
                  className="person-column__log"
                  aria-label={`${member.name}'s completed today`}
                  onClick={() => setLogMemberId(member.id)}
                >
                  🗹 {doneToday}
                </button>
                <button
                  type="button"
                  className="person-column__expand"
                  aria-label={expanded ? `Collapse ${member.name}'s column` : `Expand ${member.name}'s column`}
                  onClick={() => toggleExpanded(member.id)}
                >
                  {expanded ? '▲' : '▼'}
                </button>
              </h2>

              <MemberProgressBars member={member} tasks={tasks} />

              {expanded && (
                <>
                  <h3>Chores &amp; to-dos</h3>
                  {allMemberTasks.length === 0 && <div className="empty-state">Nothing assigned</div>}
                  {allMemberTasks.length > 0 && pendingTasks.length === 0 && (
                    <div className="empty-state">All done! 🎉</div>
                  )}
                  {pendingTasks.map((t) => (
                    <TaskCard key={t.id} task={t} onChange={loadTasks} hideAssignee viewerId={member.id} />
                  ))}
                  {doneMemberTasks.map((t) => (
                    <TaskCard key={t.id} task={t} onChange={loadTasks} hideAssignee viewerId={member.id} />
                  ))}

                  <h3>Calendar</h3>
                  {memberEvents.length === 0 && <div className="empty-state">Nothing on the calendar</div>}
                  <CalendarAgenda events={memberEvents} days={7} />
                </>
              )}
            </section>
          );
        })}

        <section className="panel person-column person-column--unassigned">
          <h2>Unassigned</h2>
          <h3>Chores &amp; to-dos</h3>
          {unassignedTasks.length === 0 && <div className="empty-state">Nothing unclaimed</div>}
          {unassignedTasks.map((t) => <TaskCard key={t.id} task={t} onChange={loadTasks} hideAssignee />)}
        </section>
      </div>

      <p className="hint">
        Only local calendar events can be "for" a specific person — Google/Apple calendar events
        aren't attributed to a family member, so they only show under "Coming up for everyone."
      </p>

      {logMemberId && (
        <CompletedTodayModal
          member={members.find((m) => m.id === logMemberId)!}
          tasks={tasks}
          onClose={() => setLogMemberId(null)}
        />
      )}
    </div>
  );
}
