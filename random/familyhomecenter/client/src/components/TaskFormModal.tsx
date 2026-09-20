import { useState, type FormEvent } from 'react';
import { api, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'One time' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'weekly', label: 'Weekly (choose days)' },
];

const TIME_OF_DAY_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: 'morning', label: '🌅 Morning' },
  { value: 'afternoon', label: '☀️ Afternoon' },
  { value: 'evening', label: '🌙 Evening' },
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

function splitRecurrence(recurrence: string): { base: string; days: string[] } {
  if (recurrence.startsWith('weekly:')) {
    return { base: 'weekly', days: recurrence.slice('weekly:'.length).split(',').filter(Boolean) };
  }
  return { base: recurrence || 'once', days: [] };
}

interface Props {
  /** null = creating a new task. */
  task: Task | null;
  /** Pre-select this assignee when creating a new task (e.g. opened from a specific column). */
  defaultAssigneeId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TaskFormModal({ task, defaultAssigneeId, onClose, onSaved }: Props) {
  const { members, activeProfile } = useFamilyMembers();
  const initialRecurrence = splitRecurrence(task?.recurrence ?? 'once');

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [kind, setKind] = useState<'chore' | 'todo'>(task?.kind ?? 'todo');
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? defaultAssigneeId ?? '');
  const [recurrence, setRecurrence] = useState(initialRecurrence.base);
  const [weeklyDays, setWeeklyDays] = useState<string[]>(initialRecurrence.days);
  const [timeOfDay, setTimeOfDay] = useState(task?.time_of_day ?? '');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');

  // Only parents get the "chore" option (recurring, assigned duties) — anyone can add a plain to-do.
  const isParent = activeProfile?.is_parent === 1;

  const toggleWeeklyDay = (code: string) => {
    setWeeklyDays((days) => (days.includes(code) ? days.filter((d) => d !== code) : [...days, code]));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (kind === 'chore' && recurrence === 'weekly' && weeklyDays.length === 0) return;
    const finalRecurrence =
      kind === 'chore' ? (recurrence === 'weekly' ? `weekly:${weeklyDays.join(',')}` : recurrence) : 'once';
    const body = {
      title: title.trim(),
      notes: notes.trim() || null,
      kind,
      assignee_id: assigneeId || null,
      recurrence: finalRecurrence,
      time_of_day: kind === 'chore' ? timeOfDay || null : null,
      due_date: dueDate || null,
    };
    if (task) {
      await api.patch(`/tasks/${task.id}`, body);
    } else {
      await api.post('/tasks', { ...body, created_by_id: activeProfile?.id ?? null });
    }
    onSaved();
  };

  const remove = async () => {
    if (!task) return;
    await api.delete(`/tasks/${task.id}`);
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-panel task-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{task ? 'Edit task' : 'Add a task'}</h2>
        <input
          autoFocus
          placeholder="What needs doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
            <div className="task-form__row">
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                {RECURRENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)}>
                {TIME_OF_DAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
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
          <button type="submit">{task ? 'Save' : 'Add'}</button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
        {task && (
          <button type="button" className="secondary task-form__delete" onClick={remove}>
            Delete this task
          </button>
        )}
      </form>
    </div>
  );
}
