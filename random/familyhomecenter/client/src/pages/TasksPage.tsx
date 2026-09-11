import { useEffect, useState } from 'react';
import { api, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { TaskCard } from '../components/TaskCard.js';
import { TaskForm } from '../components/TaskForm.js';

export function TasksPage() {
  const { members } = useFamilyMembers();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterMember, setFilterMember] = useState<string>('all');

  const load = () => {
    api.get<Task[]>('/tasks').then(setTasks).catch(console.error);
  };
  useEffect(load, []);

  const visible = tasks.filter((t) => filterMember === 'all' || t.assignee_id === filterMember);
  const chores = visible.filter((t) => t.kind === 'chore');
  const todos = visible.filter((t) => t.kind === 'todo');

  return (
    <div className="tasks-page">
      <div className="tasks-page__toolbar">
        <h1>Chores &amp; To-dos</h1>
        <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)}>
          <option value="all">Everyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <TaskForm onCreated={load} />

      <div className="tasks-page__columns">
        <section className="panel">
          <h2>Chores ({chores.length})</h2>
          {chores.length === 0 && <div className="empty-state">No chores yet — parents can add recurring ones above.</div>}
          {chores.map((t) => <TaskCard key={t.id} task={t} onChange={load} />)}
        </section>
        <section className="panel">
          <h2>To-dos ({todos.length})</h2>
          {todos.length === 0 && <div className="empty-state">Nothing here — add a one-off task above.</div>}
          {todos.map((t) => <TaskCard key={t.id} task={t} onChange={load} />)}
        </section>
      </div>
    </div>
  );
}
