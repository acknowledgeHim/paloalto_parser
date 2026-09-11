import { useEffect, useState } from 'react';
import { api, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { TaskCard } from '../components/TaskCard.js';
import { TaskForm } from '../components/TaskForm.js';

// Chores (recurring, parent-assigned) read before to-dos within a person's column, otherwise keep
// whatever order the API returned them in.
function sortForColumn(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'chore' ? -1 : 1));
}

export function TasksPage() {
  const { members } = useFamilyMembers();
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = () => {
    api.get<Task[]>('/tasks').then(setTasks).catch(console.error);
  };
  useEffect(load, []);

  const unassigned = sortForColumn(tasks.filter((t) => !t.assignee_id));

  return (
    <div className="tasks-page">
      <h1>Chores &amp; To-dos</h1>

      <TaskForm onCreated={load} />

      <div className="tasks-page__columns">
        {members.map((member) => {
          const memberTasks = sortForColumn(tasks.filter((t) => t.assignee_id === member.id));
          return (
            <section key={member.id} className="panel person-column">
              <h2>
                <span className="avatar-dot" style={{ background: member.color }} /> {member.name}
                <span className="person-column__count">{memberTasks.length}</span>
              </h2>
              {memberTasks.length === 0 && <div className="empty-state">Nothing assigned</div>}
              {memberTasks.map((t) => (
                <TaskCard key={t.id} task={t} onChange={load} hideAssignee />
              ))}
            </section>
          );
        })}

        <section className="panel person-column person-column--unassigned">
          <h2>
            Unassigned
            <span className="person-column__count">{unassigned.length}</span>
          </h2>
          {unassigned.length === 0 && <div className="empty-state">Nothing unclaimed</div>}
          {unassigned.map((t) => (
            <TaskCard key={t.id} task={t} onChange={load} hideAssignee />
          ))}
        </section>
      </div>
    </div>
  );
}
