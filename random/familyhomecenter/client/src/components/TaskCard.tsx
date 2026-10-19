import { useState } from 'react';
import { api, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { playCompletionSound } from '../utils/sounds.js';
import { celebrateIfAllDone } from '../utils/celebrations.js';
import { parseTimeOfDaySlots, timeOfDayIcon, timeOfDayLabel, isSlotWindowPassed } from '../utils/timeOfDay.js';
import { taskIcon } from '../utils/taskIcons.js';
import { MemberAvatar } from './MemberAvatar.js';
import { findRoom, useFloorplans } from '../utils/floorplans.js';
import { canEditTask, formatHours, formatMinutes, goalUnits } from '../utils/tasks.js';
import { TaskFormModal } from './TaskFormModal.js';
import { taskRewardEmoji, taskRewardText } from '../utils/prizes.js';

interface Props {
  task: Task;
  onChange: () => void;
  /** Suppress the "assigned to" line for the column's own person — used in per-person column views,
   *  where the column itself already says whose task it is. Co-assignees still show. */
  hideAssignee?: boolean;
  /** Hands this task to the caller to edit (e.g. its own edit modal). Without it, the card opens the
   *  edit form itself — ✎ shows on every card the person picked up top may edit either way. */
  onEdit?: (task: Task) => void;
  /** Whose copy of this task to show/toggle — the column this card is rendered in. Defaults to activeProfile. */
  viewerId?: string;
  /** Its number in that person's routine (1st, 2nd, …), if they've put their jobs in order. */
  orderNumber?: number | null;
}

export function TaskCard({ task, onChange, hideAssignee, onEdit, viewerId, orderNumber }: Props) {
  const { members, activeProfile } = useFamilyMembers();
  const room = findRoom(useFloorplans(), task.room_id);
  const assignees = members.filter((m) => task.assignee_ids.includes(m.id));
  const effectiveViewerId = viewerId ?? activeProfile?.id;
  const slots = parseTimeOfDaySlots(task.time_of_day);
  // A "times"/"hours" job is done a bit at a time, then checked off as a whole (every slot at once).
  const goal = goalUnits(task);
  const multiSlot = slots.length > 1 && !goal;
  // Household-trust-level rule, same spirit as canEditTask — checking a task done/undone is
  // whoever's copy this card shows (effectiveViewerId), so only that person or a parent should be
  // able to tap it, not whoever else happens to be standing at the kiosk. Enforced client-side
  // only, same as the rest of this app's identity checks.
  const canToggle = Boolean(activeProfile && (activeProfile.id === effectiveViewerId || activeProfile.is_parent === 1));
  const toggleTitle = canToggle ? undefined : 'Only this person or a parent can check this off';

  const isDone = (slot: string | null): boolean => {
    if (effectiveViewerId) {
      return task.completions.some((c) => c.completed_by_id === effectiveViewerId && c.time_of_day === slot);
    }
    return task.completions.some((c) => c.time_of_day === slot);
  };

  // Checked off by a kid, waiting for a parent's OK (a job that needs one) — not done yet.
  const isPending = (slot: string | null): boolean =>
    Boolean(task.pending?.some((p) => (p.family_member_id ?? undefined) === (effectiveViewerId ?? undefined) && (goal || p.time_of_day === slot)));
  const isParentHere = activeProfile?.is_parent === 1;

  const toggle = async (slot: string | null) => {
    const done = isDone(slot);
    const body = { completed_by_id: effectiveViewerId ?? null, time_of_day: slot, acting_member_id: activeProfile?.id ?? null };
    // A kid tapping their waiting check-off takes it back; a parent tapping it says yes (it counts).
    if (isPending(slot) && !isParentHere) {
      await api.post(`/tasks/${task.id}/uncomplete`, body);
      onChange();
      return;
    }
    if (done) {
      await api.post(`/tasks/${task.id}/uncomplete`, body);
    } else {
      // Play immediately (before the await) so it stays tied to this click as a user gesture.
      const soundOwner = members.find((m) => m.id === effectiveViewerId);
      if (soundOwner) playCompletionSound(soundOwner.complete_sound, soundOwner.id);
      const r = await api.post<{ pending?: boolean }>(`/tasks/${task.id}/complete`, body);
      if (r?.pending || task.needs_approval) window.dispatchEvent(new Event('approvals-changed'));
      // Was that the last chore (or to-do) of their day? Then it's party time.
      if (soundOwner && !r?.pending) celebrateIfAllDone(soundOwner, task.kind).catch(() => {});
    }
    onChange();
  };

  // A "times"/"hours" job: how much of it this person has done, and adding to (or taking back) it.
  const doneSoFar = goal ? task.progress?.[effectiveViewerId ?? ''] ?? 0 : 0;
  const left = goal ? Math.max(0, goal - doneSoFar) : 0;
  const [choosingChunk, setChoosingChunk] = useState(false);
  const [busy, setBusy] = useState(false);
  const addChunk = async (amount: number) => {
    setChoosingChunk(false);
    setBusy(true);
    const soundOwner = members.find((m) => m.id === effectiveViewerId);
    if (soundOwner) playCompletionSound(soundOwner.complete_sound, soundOwner.id);
    try {
      const r = await api.post<{ done: boolean; pending?: boolean }>(`/tasks/${task.id}/progress`, {
        family_member_id: effectiveViewerId ?? null,
        amount,
        acting_member_id: activeProfile?.id ?? null,
      });
      if (r.done && !r.pending && soundOwner) celebrateIfAllDone(soundOwner, task.kind).catch(() => {});
    } finally {
      setBusy(false);
    }
    onChange();
  };
  const takeBack = async () => {
    setBusy(true);
    try {
      await api.post(`/tasks/${task.id}/progress/undo`, { family_member_id: effectiveViewerId ?? null, acting_member_id: activeProfile?.id ?? null });
    } finally {
      setBusy(false);
    }
    onChange();
  };
  const pressGoalCheck = () => {
    // Waiting for a parent's OK: a parent tapping it says yes (it counts); a kid takes the last chunk back.
    if (left <= 0 && isPending(null)) {
      if (isParentHere) {
        void api
          .post(`/tasks/${task.id}/complete`, { completed_by_id: effectiveViewerId ?? null, time_of_day: null, acting_member_id: activeProfile?.id ?? null })
          .then(onChange);
        return;
      }
      return void takeBack();
    }
    if (left <= 0) return void takeBack();
    if (task.goal_type === 'hours') setChoosingChunk(!choosingChunk);
    else void addChunk(1);
  };
  // Chunks of an hours job to pick from: 30 min up, as far as what's left.
  const chunkChoices = [30, 60, 90, 120, 180, 240].filter((m) => m < left);
  if (left > 0) chunkChoices.push(left);

  const claim = async () => {
    if (!activeProfile) return;
    await api.patch(`/tasks/${task.id}`, { assignee_ids: [...task.assignee_ids, activeProfile.id] });
    onChange();
  };

  // ✎ wherever this person may change it (parents: everything; kids: their own) — same rule as checking it off.
  const [editingHere, setEditingHere] = useState(false);
  const mayEdit = Boolean(onEdit) || canEditTask(task, activeProfile);
  const edit = () => (onEdit ? onEdit(task) : setEditingHere(true));

  const allDone = goal ? left <= 0 && !isPending(null) : multiSlot ? slots.every((s) => isDone(s)) : isDone(null);
  const waiting = multiSlot ? slots.some((sl) => isPending(sl)) : isPending(null);
  const visibleAssignees = hideAssignee ? assignees.filter((m) => m.id !== effectiveViewerId) : assignees;

  return (
    <div className={`task-card ${allDone ? 'task-card--done' : ''} ${waiting ? 'task-card--waiting' : ''}`}>
      {!multiSlot && !goal && (
        <button
          className="task-card__check"
          onClick={() => toggle(null)}
          disabled={!canToggle}
          title={toggleTitle}
          aria-label={isDone(null) ? 'Mark not done' : isPending(null) ? (isParentHere ? 'Approve' : 'Take it back') : 'Mark done'}
        >
          {isDone(null) ? '✓' : isPending(null) ? '⏳' : ''}
        </button>
      )}
      {goal && (
        <button
          className="task-card__check task-card__check--goal"
          onClick={pressGoalCheck}
          disabled={!canToggle || busy}
          title={toggleTitle ?? (left <= 0 ? 'Take back the last one' : task.goal_type === 'hours' ? 'Check off some time' : 'Did one more')}
          aria-label={left <= 0 ? 'Take back the last one' : task.goal_type === 'hours' ? 'Check off some time' : 'Did one more'}
        >
          {left <= 0 ? (isPending(null) ? '⏳' : '✓') : '＋'}
        </button>
      )}
      <div className="task-card__body">
        <div className="task-card__title">
          {orderNumber != null && (
            <span className="task-card__order" title={`Number ${orderNumber} in the routine`}>
              {orderNumber}
            </span>
          )}
          <span aria-hidden="true">{taskIcon(task)}</span> {task.title}
        </div>
        {task.notes && <div className="task-card__notes">{task.notes}</div>}
        <div className="task-card__meta">
          <span className={`badge badge--${task.kind}`}>{task.kind === 'chore' ? 'Chore' : 'To-do'}</span>
          {!multiSlot && slots[0] && <span className="badge badge--time">{timeOfDayIcon(slots[0])} {timeOfDayLabel(slots[0])}</span>}
          {room && <span className="badge badge--time" title={room.plan.name}>📍 {room.room.name}</span>}
          {task.recurrence === 'asneeded' && <span className="badge badge--time">🔔 When needed</span>}
          {task.rotation_ids && task.rotation_ids.length > 1 && (
            <span className="badge badge--time" title={`Taking turns: ${task.rotation_ids.map((id) => members.find((m) => m.id === id)?.name).join(' → ')}`}>
              🔄{task.rotation_next_id ? ` next: ${members.find((m) => m.id === task.rotation_next_id)?.name ?? '?'}` : ' turns'}
            </span>
          )}
          {waiting && (
            <span className="badge badge--waiting" title={isParentHere ? 'Tap ⏳ to approve, or use ✅ To approve' : 'A parent needs to OK it'}>
              ⏳ Waiting for a parent's OK
            </span>
          )}
          {task.needs_approval === 1 && !waiting && !allDone && (
            <span className="badge badge--time" title="A parent OKs it before it counts">✅ Parent OK</span>
          )}
          {taskRewardText(task) && (
            <span className="badge badge--reward" title="Prize Bank reward">
              {taskRewardEmoji(task)} {taskRewardText(task)}
            </span>
          )}
          {mayEdit && (
            <button type="button" className="task-card__edit" aria-label="Edit" onClick={edit}>
              ✎
            </button>
          )}
          {visibleAssignees.length > 0 && (
            <span className="task-card__assignee">
              {visibleAssignees.map((m) => (
                <MemberAvatar key={m.id} member={m} size={18} />
              ))}
              {hideAssignee ? `+ ${visibleAssignees.map((m) => m.name).join(', ')}` : visibleAssignees.map((m) => m.name).join(', ')}
            </span>
          )}
          {assignees.length === 0 && !allDone && activeProfile && (
            <button className="link-button task-card__claim" onClick={claim}>
              Claim it — I'll do it
            </button>
          )}
          {assignees.length === 0 && !activeProfile && (
            <span className="task-card__assignee task-card__assignee--unassigned">
              Unassigned — pick your name up top to claim it
            </span>
          )}
        </div>
        {goal && (
          <div className="task-card__goal">
            <div className="progress-bar task-card__goal-bar">
              <div className="progress-bar__fill" style={{ width: `${Math.min(100, (doneSoFar / goal) * 100)}%` }} />
            </div>
            <span className="task-card__goal-text">
              {task.goal_type === 'hours'
                ? `⏱ ${formatHours(doneSoFar / 60)} of ${formatHours(goal / 60)} h`
                : `🔁 ${doneSoFar} of ${goal} times${task.goal_minutes ? ` · ${formatMinutes(task.goal_minutes)} each` : ''}`}
            </span>
            {doneSoFar > 0 && left > 0 && canToggle && (
              <button type="button" className="link-button task-card__goal-undo" onClick={takeBack} disabled={busy} title="Take back the last one">
                ↶
              </button>
            )}
          </div>
        )}
        {goal && choosingChunk && left > 0 && (
          <div className="task-card__chunks" role="group" aria-label="How much did you do?">
            <span className="hint">How much did you do?</span>
            {chunkChoices.map((m) => (
              <button key={m} type="button" className="secondary" onClick={() => addChunk(m)} disabled={busy}>
                {m === left && m > 30 && !([30, 60, 90, 120, 180, 240].includes(m)) ? `All the rest (${formatMinutes(m)})` : `+${formatMinutes(m)}`}
              </button>
            ))}
            <button type="button" className="link-button" onClick={() => setChoosingChunk(false)}>Cancel</button>
          </div>
        )}
        {multiSlot && (
          <div className="task-card__slots">
            {slots.map((slot) => {
              const done = isDone(slot);
              const passed = !done && isSlotWindowPassed(slot);
              return (
                <button
                  key={slot}
                  type="button"
                  className={`task-card__slot ${done ? 'task-card__slot--done' : ''} ${passed ? 'task-card__slot--passed' : ''}`}
                  onClick={() => toggle(slot)}
                  disabled={!canToggle}
                  title={toggleTitle}
                >
                  {done ? '✓' : isPending(slot) ? '⏳' : passed ? '⏰' : timeOfDayIcon(slot)} {timeOfDayLabel(slot)}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {editingHere && (
        <TaskFormModal
          task={task}
          onClose={() => setEditingHere(false)}
          onSaved={() => {
            setEditingHere(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}
