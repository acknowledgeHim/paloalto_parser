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
  { value: 'weekly', label: 'Weekly (choose days)' },
];

const DAYS = [
  { code: 'SUN', label: 'Sun' },
  { code: 'MON', label: 'Mon' },
  { code: 'TUE', label: 'Tue' },
  { code: 'WED', label: 'Wed' },
  { code: 'THU', label: 'Thu' },
  { code: 'FRI', label: 'Fri' },
  { code: 'SAT', label: 'Sat' },
];

export function TaskForm({ onCreated }: Props) {
  const { members, activeProfile } = useFamilyMembers();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'chore' | 'todo'>('todo');
  const [assigneeId, setAssigneeId] = useState('');
  const [recurrence, setRecurrence] = useState('once');
  const [weeklyDays, setWeeklyDays] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');

  // Only parents get the "chore" option (recurring, assigned duties) — anyone can add a plain to-do.
  const isParent = activeProfile?.is_parent === 1;

  const reset = () => {
    setTitle('');
    setKind('todo');
    setAssigneeId('');
    setRecurrence('once');
    setWeeklyDays([]);
    setDueDate('');
    setOpen(false);
  };

  const toggleWeeklyDay = (code: string) => {
    setWeeklyDays((days) => (days.includes(code) ? days.filter((d) => d !== code) : [...days, code]));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (kind === 'chore' && recurrence === 'weekly' && weeklyDays.length === 0) return;
    const finalRecurrence =
      kind === 'chore' ? (recurrence === 'weekly' ? `weekly:${weeklyDays.join(',')}` : recurrence) : 'once';
    await api.post('/tasks', {
      title: title.trim(),
      kind,
      assignee_id: assigneeId || null,
      created_by_id: activeProfile?.id ?? null,
      recurrence: finalRecurrence,
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
        <>
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {recurrence === 'weekly' && (
            <div className="task-form__row task-form__weekdays">
              {DAYS.map((d) => (
                <label key={d.code}>
                  <input
                    type="checkbox"
                    checked={weeklyDays.includes(d.code)}
                    onChange={() => toggleWeeklyDay(d.code)}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          )}
        </>
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
