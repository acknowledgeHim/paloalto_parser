import { useState, type FormEvent } from 'react';
import { api, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { TIME_OF_DAY_OPTIONS, parseTimeOfDaySlots, type TimeOfDaySlot } from '../utils/timeOfDay.js';

const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'One time' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'weekly', label: 'Weekly (choose days)' },
  { value: 'biweekly', label: 'Every other week (choose a day)' },
  { value: 'monthly', label: 'Monthly (e.g. "1st Friday")' },
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

const MONTHLY_POSITIONS = [
  { value: '1', label: '1st' },
  { value: '2', label: '2nd' },
  { value: '3', label: '3rd' },
  { value: '4', label: '4th' },
  { value: '-1', label: 'Last' },
];

const DAY_INDEX: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

/** The most recent (or today's) occurrence of this weekday — a stable "week 0" anchor for biweekly math. */
function anchorForDay(dayCode: string): string {
  const today = new Date();
  const diff = (today.getDay() - (DAY_INDEX[dayCode] ?? 0) + 7) % 7;
  const anchor = new Date(today);
  anchor.setDate(today.getDate() - diff);
  return anchor.toISOString().slice(0, 10);
}

interface RecurrenceState {
  base: string;
  weeklyDays: string[];
  monthlyN: string;
  monthlyDay: string;
  biweeklyDay: string;
  biweeklyAnchor: string;
}

function splitRecurrence(recurrence: string): RecurrenceState {
  if (recurrence.startsWith('weekly:')) {
    return { base: 'weekly', weeklyDays: recurrence.slice(7).split(',').filter(Boolean), monthlyN: '1', monthlyDay: 'MON', biweeklyDay: 'MON', biweeklyAnchor: '' };
  }
  if (recurrence.startsWith('monthly:')) {
    const [, n, day] = recurrence.split(':');
    return { base: 'monthly', weeklyDays: [], monthlyN: n ?? '1', monthlyDay: day ?? 'MON', biweeklyDay: 'MON', biweeklyAnchor: '' };
  }
  if (recurrence.startsWith('biweekly:')) {
    const [, anchor, day] = recurrence.split(':');
    return { base: 'biweekly', weeklyDays: [], monthlyN: '1', monthlyDay: 'MON', biweeklyDay: day ?? 'MON', biweeklyAnchor: anchor ?? '' };
  }
  return { base: recurrence || 'once', weeklyDays: [], monthlyN: '1', monthlyDay: 'MON', biweeklyDay: 'MON', biweeklyAnchor: '' };
}

interface Props {
  /** null = creating a new task. */
  task: Task | null;
  /** Pre-select this assignee when creating a new task (e.g. opened from a specific column). Ignored for a non-parent, who can only assign to themselves. */
  defaultAssigneeId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TaskFormModal({ task, defaultAssigneeId, onClose, onSaved }: Props) {
  const { members, activeProfile } = useFamilyMembers();
  const initialRecurrence = splitRecurrence(task?.recurrence ?? 'once');
  const isParent = activeProfile?.is_parent === 1;

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [kind, setKind] = useState<'chore' | 'todo'>(task?.kind ?? 'todo');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task?.assignee_ids ?? (isParent ? (defaultAssigneeId ? [defaultAssigneeId] : []) : activeProfile ? [activeProfile.id] : [])
  );
  const [recurrence, setRecurrence] = useState(initialRecurrence.base);
  const [weeklyDays, setWeeklyDays] = useState<string[]>(initialRecurrence.weeklyDays);
  const [monthlyN, setMonthlyN] = useState(initialRecurrence.monthlyN);
  const [monthlyDay, setMonthlyDay] = useState(initialRecurrence.monthlyDay);
  const [biweeklyDay, setBiweeklyDay] = useState(initialRecurrence.biweeklyDay);
  const [biweeklyAnchor, setBiweeklyAnchor] = useState(initialRecurrence.biweeklyAnchor);
  const [timeOfDaySlots, setTimeOfDaySlots] = useState<TimeOfDaySlot[]>(parseTimeOfDaySlots(task?.time_of_day));
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [rewardEligible, setRewardEligible] = useState(Boolean(task?.reward_type));
  const [rewardType, setRewardType] = useState<'stars' | 'money'>(task?.reward_type ?? 'stars');
  const [rewardAmount, setRewardAmount] = useState(task?.reward_amount ?? 1);

  const toggleWeeklyDay = (code: string) => {
    setWeeklyDays((days) => (days.includes(code) ? days.filter((d) => d !== code) : [...days, code]));
  };

  const toggleTimeOfDay = (slot: TimeOfDaySlot) => {
    setTimeOfDaySlots((slots) => (slots.includes(slot) ? slots.filter((s) => s !== slot) : [...slots, slot]));
  };

  const toggleAssignee = (id: string) => {
    if (!isParent) return; // kids can only ever be assigned to themselves
    setAssigneeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (recurrence === 'weekly' && weeklyDays.length === 0) return;

    let finalRecurrence = recurrence;
    if (recurrence === 'weekly') finalRecurrence = `weekly:${weeklyDays.join(',')}`;
    else if (recurrence === 'monthly') finalRecurrence = `monthly:${monthlyN}:${monthlyDay}`;
    else if (recurrence === 'biweekly') finalRecurrence = `biweekly:${biweeklyAnchor || anchorForDay(biweeklyDay)}:${biweeklyDay}`;

    // Defensive, not just UI-hiding: a kid's submission always resolves to just themselves,
    // regardless of any stale local state.
    const finalAssigneeIds = isParent ? assigneeIds : activeProfile ? [activeProfile.id] : [];

    const body = {
      title: title.trim(),
      notes: notes.trim() || null,
      kind,
      assignee_ids: finalAssigneeIds,
      recurrence: finalRecurrence,
      time_of_day: timeOfDaySlots.length > 0 ? timeOfDaySlots.join(',') : null,
      due_date: recurrence === 'once' ? dueDate || null : null,
    };
    let taskId: string;
    if (task) {
      await api.patch(`/tasks/${task.id}`, body);
      taskId = task.id;
    } else {
      const created = await api.post<Task>('/tasks', { ...body, created_by_id: activeProfile?.id ?? null });
      taskId = created.id;
    }
    // Only a parent can set/clear a reward (Prize Bank eligibility) — kids never see the checkbox,
    // so this only fires for a parent's own add/edit, and PATCH /:id/reward is itself admin-gated
    // server-side, same defense-in-depth as everywhere else Prize Bank rewards are set.
    if (isParent) {
      const effectiveType = kind === 'todo' && rewardEligible ? rewardType : null;
      await api.patch(`/tasks/${taskId}/reward`, {
        reward_type: effectiveType,
        reward_amount: effectiveType ? rewardAmount : null,
      });
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
          <select value={kind} onChange={(e) => setKind(e.target.value as 'chore' | 'todo')}>
            <option value="todo">To-do</option>
            <option value="chore">Chore</option>
          </select>
        </div>

        {isParent && kind === 'todo' && (
          <div>
            <label className="checkbox">
              <input type="checkbox" checked={rewardEligible} onChange={(e) => setRewardEligible(e.target.checked)} />
              Prize Bank eligible
            </label>
            {rewardEligible && (
              <div className="task-form__row">
                <select value={rewardType} onChange={(e) => setRewardType(e.target.value as 'stars' | 'money')}>
                  <option value="stars">Stars</option>
                  <option value="money">Money</option>
                </select>
                <input
                  type="number"
                  min={rewardType === 'stars' ? 1 : 0.01}
                  step={rewardType === 'stars' ? 1 : 0.01}
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(Number(e.target.value) || 0)}
                />
              </div>
            )}
          </div>
        )}

        {isParent ? (
          <div>
            <label className="member-form__label">Assign to (optional — leave all unchecked for anyone to claim)</label>
            <div className="task-form__row chip-list">
              {members.map((m) => (
                <label key={m.id} className="checkbox">
                  <input type="checkbox" checked={assigneeIds.includes(m.id)} onChange={() => toggleAssignee(m.id)} />
                  {m.name}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="hint">
            {activeProfile ? `Assigned to: you (${activeProfile.name})` : 'Pick your name up top first'}
          </p>
        )}

        <div className="task-form__row">
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="member-form__label">
            Time of day (optional — pick more than one, e.g. morning + evening, for a chore/to-do
            done multiple times a day, each completed independently)
          </label>
          <div className="task-form__row chip-list">
            {TIME_OF_DAY_OPTIONS.map((o) => (
              <label key={o.value} className="checkbox">
                <input
                  type="checkbox"
                  checked={timeOfDaySlots.includes(o.value)}
                  onChange={() => toggleTimeOfDay(o.value)}
                />
                {o.icon} {o.label}
              </label>
            ))}
          </div>
        </div>

        {recurrence === 'weekly' && (
          <div className="task-form__row chip-list">
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

        {recurrence === 'monthly' && (
          <div className="task-form__row">
            <select value={monthlyN} onChange={(e) => setMonthlyN(e.target.value)}>
              {MONTHLY_POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select value={monthlyDay} onChange={(e) => setMonthlyDay(e.target.value)}>
              {DAYS.map((d) => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>
          </div>
        )}

        {recurrence === 'biweekly' && (
          <div className="task-form__row">
            <span className="hint">Every other</span>
            <select value={biweeklyDay} onChange={(e) => setBiweeklyDay(e.target.value)}>
              {DAYS.map((d) => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>
          </div>
        )}

        {recurrence === 'once' && (
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
