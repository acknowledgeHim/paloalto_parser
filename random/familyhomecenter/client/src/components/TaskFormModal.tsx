import { useState, type FormEvent } from 'react';
import { api, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { TIME_OF_DAY_OPTIONS, parseTimeOfDaySlots, type TimeOfDaySlot } from '../utils/timeOfDay.js';
import { TASK_ICON_PRESETS, taskIcon } from '../utils/taskIcons.js';
import { EmojiPicker } from './EmojiPicker.js';
import { RewardEditor, type RewardValue } from './RewardEditor.js';
import { canPlaceTask, useFloorplans } from '../utils/floorplans.js';

const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'One time' },
  { value: 'asneeded', label: 'When needed (someone taps 🔔 Needs doing)' },
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
  /** Pre-pick this room when creating (e.g. "+ Add a job here" on a floor plan). */
  defaultRoomId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TaskFormModal({ task, defaultAssigneeId, defaultRoomId, onClose, onSaved }: Props) {
  const { members, activeProfile } = useFamilyMembers();
  const initialRecurrence = splitRecurrence(task?.recurrence ?? 'once');
  const isParent = activeProfile?.is_parent === 1;

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [kind, setKind] = useState<'chore' | 'todo'>(task?.kind ?? 'todo');
  const [icon, setIcon] = useState<string | null>(task?.icon ?? null);
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
  // ✅ A kid's check-off waits for a parent's OK (parents set this).
  const [needsApproval, setNeedsApproval] = useState(task?.needs_approval === 1);
  const [reward, setReward] = useState<RewardValue>({
    type: task?.reward_type ?? 'stars',
    amount: task?.reward_amount ?? 1,
    text: task?.reward_text ?? '',
    emoji: task?.reward_emoji ?? null,
  });
  const [bulkIconStatus, setBulkIconStatus] = useState<string | null>(null);
  const plans = useFloorplans();
  // 🔄 Taking turns (parents only): the people in order, and whose turn it is today. Only sent
  // when changed, so editing a title doesn't restart anyone's turn.
  const [rotating, setRotating] = useState(Boolean(task?.rotation_ids?.length));
  const [rotationOrder, setRotationOrder] = useState<string[]>(() => {
    const ids = task?.rotation_ids ?? [];
    const today = task?.assignee_ids.length === 1 ? task.assignee_ids[0] : null;
    const at = today ? ids.indexOf(today) : -1;
    return at > 0 ? [...ids.slice(at), ...ids.slice(0, at)] : ids;
  });
  const [rotationFirst, setRotationFirst] = useState<string | null>(task?.rotation_ids?.length ? rotationOrder[0] ?? null : null);
  const [rotationDirty, setRotationDirty] = useState(false);
  const moveInRotation = (id: string, by: -1 | 1) => {
    setRotationDirty(true);
    setRotationOrder((order) => {
      const i = order.indexOf(id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= order.length) return order;
      const next = [...order];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const [roomId, setRoomId] = useState<string>(task?.room_id ?? defaultRoomId ?? '');
  // How much: just check it off, a number of times (e.g. 5× at 30 min), or a number of hours (done
  // 30 minutes or more at a time).
  const [goalType, setGoalType] = useState<'' | 'times' | 'hours'>(task?.goal_type ?? '');
  const [goalAmount, setGoalAmount] = useState(String(task?.goal_amount ?? (task?.goal_type === 'hours' ? 1 : 5)));
  const [goalMinutes, setGoalMinutes] = useState(task?.goal_minutes ? String(task.goal_minutes) : '');

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

  // Sets this icon on every OTHER task sharing this exact title too (e.g. each kid's own copy of
  // "Make your bed") without saving the rest of this form's edits — a parent picks the icon here
  // once and it fans out, instead of opening and editing each kid's copy by hand.
  const applyIconToAllNamed = async () => {
    if (!title.trim()) return;
    setBulkIconStatus(null);
    try {
      const { updated } = await api.patch<{ updated: number }>('/tasks/by-title/icon', { title: title.trim(), icon });
      setBulkIconStatus(`Set on ${updated} task${updated === 1 ? '' : 's'} named "${title.trim()}".`);
    } catch (err) {
      setBulkIconStatus((err as Error).message || 'Could not apply that to the others');
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (isParent && rotating && recurrence !== 'once' && rotationOrder.length < 2) return;
    if (recurrence === 'weekly' && weeklyDays.length === 0) return;
    if (goalType === 'times' && !(Number(goalAmount) >= 1)) return;
    if (goalType === 'hours' && !(Number(goalAmount) >= 0.5)) return;

    let finalRecurrence = recurrence;
    if (recurrence === 'weekly') finalRecurrence = `weekly:${weeklyDays.join(',')}`;
    else if (recurrence === 'monthly') finalRecurrence = `monthly:${monthlyN}:${monthlyDay}`;
    else if (recurrence === 'biweekly') finalRecurrence = `biweekly:${biweeklyAnchor || anchorForDay(biweeklyDay)}:${biweeklyDay}`;

    // Defensive, not just UI-hiding: a kid's submission always resolves to just themselves,
    // regardless of any stale local state.
    const finalAssigneeIds = isParent ? assigneeIds : activeProfile ? [activeProfile.id] : [];

    const turns = isParent && rotating && recurrence !== 'once';
    const rotationFields = turns
      ? rotationDirty || !task?.rotation_ids?.length
        ? { rotation_ids: rotationOrder, rotation_first_id: rotationFirst ?? rotationOrder[0], assignee_ids: rotationOrder }
        : {}
      : isParent && task?.rotation_ids?.length
        ? { rotation_ids: null }
        : {};
    const body = {
      title: title.trim(),
      notes: notes.trim() || null,
      kind,
      icon,
      assignee_ids: finalAssigneeIds,
      recurrence: finalRecurrence,
      time_of_day: timeOfDaySlots.length > 0 ? timeOfDaySlots.join(',') : null,
      due_date: recurrence === 'once' ? dueDate || null : null,
      room_id: roomId || null,
      acting_member_id: activeProfile?.id ?? null,
      ...(isParent ? { needs_approval: needsApproval } : {}),
      goal_type: goalType || null,
      goal_amount: goalType ? Number(goalAmount) : null,
      goal_minutes: goalType === 'times' && goalMinutes ? Number(goalMinutes) : null,
      ...rotationFields,
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
      const effectiveType = kind === 'todo' && rewardEligible && (reward.type !== 'custom' || reward.text.trim()) ? reward.type : null;
      await api.patch(`/tasks/${taskId}/reward`, {
        reward_type: effectiveType,
        reward_amount: effectiveType && effectiveType !== 'custom' ? reward.amount : null,
        reward_text: effectiveType === 'custom' ? reward.text.trim() : null,
        reward_emoji: effectiveType ? reward.emoji : null,
      });
    }
    onSaved();
  };

  // ⧉ Copy to… (parents): each picked person gets their own copy of this job.
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTo, setCopyTo] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const close = () => (copied ? onSaved() : onClose());
  const copy = async () => {
    if (!task || copyTo.length === 0) return;
    setCopyStatus(null);
    try {
      await api.post(`/tasks/${task.id}/duplicate`, { member_ids: copyTo });
      setCopyStatus(`Copied to ${members.filter((m) => copyTo.includes(m.id)).map((m) => m.name).join(', ')} ✓`);
      setCopied(true);
      setCopyTo([]);
    } catch (err) {
      setCopyStatus((err as Error).message || 'Could not copy it');
    }
  };

  const remove = async () => {
    if (!task) return;
    await api.delete(`/tasks/${task.id}`);
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={close}>
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

        <div>
          <label className="member-form__label">Checkpoint icon (for the Adventure Map progress bar)</label>
          <EmojiPicker
            value={icon}
            suggestions={TASK_ICON_PRESETS}
            defaultCategory="tasks"
            onPick={(em) => setIcon((cur) => (cur === em ? null : em))}
            before={
              <button
                type="button"
                className={`member-form__emoji ${icon === null ? 'member-form__emoji--selected' : ''}`}
                onClick={() => setIcon(null)}
                aria-label="Use the default icon"
              >
                {taskIcon({ icon: null, kind })}
              </button>
            }
          />
          {isParent && title.trim() && (
            <div className="task-form__row">
              <button type="button" className="link-button" onClick={applyIconToAllNamed}>
                Apply to every task named "{title.trim()}"
              </button>
            </div>
          )}
          {bulkIconStatus && <p className="hint">{bulkIconStatus}</p>}
        </div>

        {isParent && kind === 'todo' && (
          <div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={rewardEligible}
                onChange={(e) => {
                  setRewardEligible(e.target.checked);
                  // A Prize Bank job usually wants a parent's OK before it pays — on by default (can be unticked).
                  if (e.target.checked && !task?.reward_type) setNeedsApproval(true);
                }}
              />
              Prize Bank eligible
            </label>
            {rewardEligible && <RewardEditor value={reward} onChange={setReward} />}
          </div>
        )}

        {isParent && (
          <label className="checkbox">
            <input type="checkbox" checked={needsApproval} onChange={(e) => setNeedsApproval(e.target.checked)} />
            ✅ Needs a parent's OK — when a kid checks it off, it waits in ✅ To approve before it counts (or pays)
          </label>
        )}

        {isParent && rotating && recurrence !== 'once' ? null : isParent ? (
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

        {plans && plans.some((p) => p.rooms.length > 0) && canPlaceTask({ assignee_ids: isParent ? assigneeIds : activeProfile ? [activeProfile.id] : [] }, activeProfile, members) && (
          <div>
            <label className="member-form__label">Where (optional — shows it in that room on the floor plan)</label>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Nowhere in particular</option>
              {plans.filter((p) => p.rooms.length > 0).map((p) => (
                <optgroup key={p.id} label={p.name}>
                  {[...p.rooms].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        <div className="task-form__row">
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="member-form__label">How much</label>
          <div className="task-form__row task-form__goal">
            <select value={goalType} onChange={(e) => {
              const v = e.target.value as '' | 'times' | 'hours';
              setGoalType(v);
              if (v === 'hours' && !(Number(goalAmount) >= 0.5)) setGoalAmount('1');
              if (v === 'times' && !(Number(goalAmount) >= 1)) setGoalAmount('5');
            }}>
              <option value="">Just check it off</option>
              <option value="times">A number of times</option>
              <option value="hours">A number of hours</option>
            </select>
            {goalType === 'times' && (
              <>
                <input type="number" min={1} step={1} value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} aria-label="How many times" />
                <span>times, at</span>
                <input type="number" min={1} step={5} value={goalMinutes} placeholder="—" onChange={(e) => setGoalMinutes(e.target.value)} aria-label="Minutes each time" />
                <span>min each (optional)</span>
              </>
            )}
            {goalType === 'hours' && (
              <>
                <input type="number" min={0.5} step={0.5} value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} aria-label="How many hours" />
                <span>hours</span>
              </>
            )}
          </div>
          {goalType && (
            <p className="hint">
              {goalType === 'hours'
                ? 'Checked off a bit at a time — 30 minutes or more at a go — until the hours are done.'
                : 'Tap ＋ each time it’s done; it’s checked off when all the times are done.'}
              {recurrence === 'once' ? ' It can take as many days as it needs.' : ' Each time it comes up, it starts again from zero.'}
            </p>
          )}
        </div>

        {isParent && recurrence !== 'once' && (
          <div className="task-form__turns">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={rotating}
                onChange={(e) => {
                  setRotating(e.target.checked);
                  setRotationDirty(true);
                  if (e.target.checked && rotationOrder.length === 0) {
                    const start = assigneeIds.length >= 2 ? assigneeIds : members.filter((m) => m.is_parent !== 1).map((m) => m.id);
                    setRotationOrder(start);
                    setRotationFirst(start[0] ?? null);
                  }
                }}
              />
              🔄 Take turns — each time it's done, it goes to the next person
            </label>
            {rotating && (
              <>
                <ol className="task-form__turn-list">
                  {rotationOrder.map((id, i) => {
                    const m = members.find((x) => x.id === id);
                    if (!m) return null;
                    return (
                      <li key={id}>
                        <span className="task-form__turn-name">{m.name}</span>
                        <label className="checkbox task-form__turn-first">
                          <input
                            type="radio"
                            name="rotation-first"
                            checked={(rotationFirst ?? rotationOrder[0]) === id}
                            onChange={() => {
                              setRotationFirst(id);
                              setRotationDirty(true);
                            }}
                          />
                          Up now
                        </label>
                        <button type="button" className="secondary" aria-label={`Move ${m.name} up`} disabled={i === 0} onClick={() => moveInRotation(id, -1)}>↑</button>
                        <button type="button" className="secondary" aria-label={`Move ${m.name} down`} disabled={i === rotationOrder.length - 1} onClick={() => moveInRotation(id, 1)}>↓</button>
                        <button
                          type="button"
                          className="secondary"
                          aria-label={`Take ${m.name} out`}
                          onClick={() => {
                            setRotationDirty(true);
                            setRotationOrder((o) => o.filter((x) => x !== id));
                            if (rotationFirst === id) setRotationFirst(null);
                          }}
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <div className="task-form__row chip-list">
                  {members
                    .filter((m) => !rotationOrder.includes(m.id))
                    .map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setRotationDirty(true);
                          setRotationOrder((o) => [...o, m.id]);
                        }}
                      >
                        + {m.name}
                      </button>
                    ))}
                </div>
                <p className="hint">
                  {rotationOrder.length < 2
                    ? 'Add at least two people.'
                    : `Order: ${(() => {
                        const first = Math.max(0, rotationOrder.indexOf(rotationFirst ?? rotationOrder[0]));
                        return [...rotationOrder.slice(first), ...rotationOrder.slice(0, first)]
                          .map((id) => members.find((m) => m.id === id)?.name)
                          .join(' → ');
                      })()} → back to the start. It shows on whoever's turn it is, and their history and rewards keep track.`}
                </p>
              </>
            )}
          </div>
        )}


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
          <button type="button" className="secondary" onClick={close}>{copied ? 'Close' : 'Cancel'}</button>
        </div>
        {task && isParent && (
          <div className="task-form__copy">
            {!copyOpen ? (
              <button type="button" className="secondary" onClick={() => setCopyOpen(true)}>
                ⧉ Copy to…
              </button>
            ) : (
              <>
                <label className="member-form__label">Copy this {kind === 'chore' ? 'chore' : 'to-do'} to — each gets their own to check off</label>
                <div className="task-form__row chip-list">
                  {members
                    .filter((m) => !task.assignee_ids.includes(m.id) && !(task.rotation_ids ?? []).includes(m.id))
                    .map((m) => (
                      <label key={m.id} className="checkbox">
                        <input
                          type="checkbox"
                          checked={copyTo.includes(m.id)}
                          onChange={() => setCopyTo((ids) => (ids.includes(m.id) ? ids.filter((x) => x !== m.id) : [...ids, m.id]))}
                        />
                        {m.name}
                      </label>
                    ))}
                </div>
                <div className="task-form__row">
                  <button type="button" onClick={copy} disabled={copyTo.length === 0}>
                    ⧉ Copy
                  </button>
                  <button type="button" className="link-button" onClick={() => setCopyOpen(false)}>Never mind</button>
                </div>
                <p className="hint">Copies it as saved — save any changes above first.</p>
              </>
            )}
            {copyStatus && <p className="hint task-form__copy-status">{copyStatus}</p>}
          </div>
        )}
        {task && (
          <button type="button" className="secondary task-form__delete" onClick={remove}>
            Delete this task
          </button>
        )}
      </form>
    </div>
  );
}
