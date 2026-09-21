import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type FamilyMember, type Task, type CalendarEvent } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { TaskCard } from '../components/TaskCard.js';
import { CalendarAgenda } from '../components/CalendarAgenda.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { sortForColumn } from '../utils/tasks.js';
import { progressFillFor } from '../utils/progressStyles.js';

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
          const memberTasks = sortForColumn(tasks.filter((t) => t.assignee_ids.includes(member.id)));
          const memberEvents = events.filter((e) => e.for_member_id === member.id);
          return (
            <section key={member.id} className="panel person-column">
              <h2>
                <Link to={`/person/${member.id}`} className="person-column__link">
                  <MemberAvatar member={member} /> {member.name}
                </Link>
              </h2>

              <MemberProgressBars member={member} tasks={tasks} />

              <h3>Chores &amp; to-dos</h3>
              {memberTasks.length === 0 && <div className="empty-state">Nothing assigned</div>}
              {memberTasks.map((t) => (
                <TaskCard key={t.id} task={t} onChange={loadTasks} hideAssignee viewerId={member.id} />
              ))}

              <h3>Calendar</h3>
              {memberEvents.length === 0 && <div className="empty-state">Nothing on the calendar</div>}
              <CalendarAgenda events={memberEvents} days={7} />
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
    </div>
  );
}
