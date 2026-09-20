import { useEffect, useState } from 'react';
import { api, type Task, type CalendarEvent } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { TaskCard } from '../components/TaskCard.js';
import { CalendarAgenda } from '../components/CalendarAgenda.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { sortForColumn } from '../utils/tasks.js';

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

  const unassignedTasks = sortForColumn(tasks.filter((t) => !t.assignee_id));
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
          const memberTasks = sortForColumn(tasks.filter((t) => t.assignee_id === member.id));
          const memberEvents = events.filter((e) => e.for_member_id === member.id);
          return (
            <section key={member.id} className="panel person-column">
              <h2><MemberAvatar member={member} /> {member.name}</h2>

              <h3>Chores &amp; to-dos</h3>
              {memberTasks.length === 0 && <div className="empty-state">Nothing assigned</div>}
              {memberTasks.map((t) => <TaskCard key={t.id} task={t} onChange={loadTasks} hideAssignee />)}

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
