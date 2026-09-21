import { api, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { playCompletionSound } from '../utils/sounds.js';
import { parseTimeOfDaySlots, timeOfDayIcon, timeOfDayLabel, isSlotWindowPassed } from '../utils/timeOfDay.js';
import { MemberAvatar } from './MemberAvatar.js';

interface Props {
  task: Task;
  onChange: () => void;
  /** Suppress the "assigned to" line for the column's own person — used in per-person column views,
   *  where the column itself already says whose task it is. Co-assignees still show. */
  hideAssignee?: boolean;
  /** When provided, shows an edit icon that hands this task back to the caller (e.g. to open an edit modal). */
  onEdit?: (task: Task) => void;
  /** Whose copy of this task to show/toggle — the column this card is rendered in. Defaults to activeProfile. */
  viewerId?: string;
}

export function TaskCard({ task, onChange, hideAssignee, onEdit, viewerId }: Props) {
  const { members, activeProfile } = useFamilyMembers();
  const assignees = members.filter((m) => task.assignee_ids.includes(m.id));
  const effectiveViewerId = viewerId ?? activeProfile?.id;
  const slots = parseTimeOfDaySlots(task.time_of_day);
  const multiSlot = slots.length > 1;

  const isDone = (slot: string | null): boolean => {
    if (effectiveViewerId) {
      return task.completions.some((c) => c.completed_by_id === effectiveViewerId && c.time_of_day === slot);
    }
    return task.completions.some((c) => c.time_of_day === slot);
  };

  const toggle = async (slot: string | null) => {
    const done = isDone(slot);
    const body = { completed_by_id: effectiveViewerId ?? null, time_of_day: slot };
    if (done) {
      await api.post(`/tasks/${task.id}/uncomplete`, body);
    } else {
      // Play immediately (before the await) so it stays tied to this click as a user gesture.
      const soundOwner = members.find((m) => m.id === effectiveViewerId);
      if (soundOwner) playCompletionSound(soundOwner.complete_sound, soundOwner.id);
      await api.post(`/tasks/${task.id}/complete`, body);
    }
    onChange();
  };

  const claim = async () => {
    if (!activeProfile) return;
    await api.patch(`/tasks/${task.id}`, { assignee_ids: [...task.assignee_ids, activeProfile.id] });
    onChange();
  };

  const allDone = multiSlot ? slots.every((s) => isDone(s)) : isDone(null);
  const visibleAssignees = hideAssignee ? assignees.filter((m) => m.id !== effectiveViewerId) : assignees;

  return (
    <div className={`task-card ${allDone ? 'task-card--done' : ''}`}>
      {!multiSlot && (
        <button className="task-card__check" onClick={() => toggle(null)} aria-label={isDone(null) ? 'Mark not done' : 'Mark done'}>
          {isDone(null) ? '✓' : ''}
        </button>
      )}
      <div className="task-card__body">
        <div className="task-card__title">{task.title}</div>
        {task.notes && <div className="task-card__notes">{task.notes}</div>}
        <div className="task-card__meta">
          <span className={`badge badge--${task.kind}`}>{task.kind === 'chore' ? 'Chore' : 'To-do'}</span>
          {!multiSlot && slots[0] && <span className="badge badge--time">{timeOfDayIcon(slots[0])} {timeOfDayLabel(slots[0])}</span>}
          {task.reward_type === 'stars' && <span className="badge badge--reward">⭐ {task.reward_amount}</span>}
          {task.reward_type === 'money' && <span className="badge badge--reward">${task.reward_amount?.toFixed(2)}</span>}
          {onEdit && (
            <button
              type="button"
              className="task-card__edit"
              aria-label="Edit"
              onClick={() => onEdit(task)}
            >
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
                >
                  {done ? '✓' : passed ? '⏰' : timeOfDayIcon(slot)} {timeOfDayLabel(slot)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
