import { useState, type FormEvent } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

interface Props {
  onCreated: () => void;
}

const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'One time' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
];

export function TaskForm({ onCreated }: Props) {
  const { members, activeProfile } = useFamilyMembers();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'chore' | 'todo'>('todo');
  const [assigneeId, setAssigneeId] = useState('');
  const [recurrence, setRecurrence] = useState('once');
  const [dueDate, setDueDate] = useState('');

  // Only parents get the "chore" option (recurring, assigned duties) — anyone can add a plain to-do.
  const isParent = activeProfile?.is_parent === 1;

  const reset = () => {
    setTitle('');
    setKind('todo');
    setAssigneeId('');
    setRecurrence('once');
    setDueDate('');
    setOpen(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post('/tasks', {
      title: title.trim(),
      kind,
      assignee_id: assigneeId || null,
      created_by_id: activeProfile?.id ?? null,
      recurrence: kind === 'chore' ? recurrence : 'once',
      due_date: dueDate || null,
    });
    reset();
    onCreated();
  };

  if (!open) {
    return (
      <button className="task-form__open" onClick={() => setOpen(true)}>
        + Add a task
      </button>
    );
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <input
        autoFocus
        placeholder="What needs doing?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="task-form__row">
        {isParent && (
          <select value={kind} onChange={(e) => setKind(e.target.value as 'chore' | 'todo')}>
            <option value="todo">To-do</option>
            <option value="chore">Chore</option>
          </select>
        )}
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      {kind === 'chore' ? (
        <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
          {RECURRENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      )}
      <div className="task-form__row">
        <button type="submit">Add</button>
        <button type="button" className="secondary" onClick={reset}>Cancel</button>
      </div>
    </form>
  );
}
