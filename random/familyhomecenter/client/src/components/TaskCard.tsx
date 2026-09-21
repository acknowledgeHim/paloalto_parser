import { api, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { playCompletionSound } from '../utils/sounds.js';
import { MemberAvatar } from './MemberAvatar.js';

const TIME_OF_DAY_LABEL: Record<string, string> = {
  morning: '🌅 Morning',
  afternoon: '☀️ Afternoon',
  evening: '🌙 Evening',
};

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
  const myCompletion = effectiveViewerId
    ? task.completions.find((c) => c.completed_by_id === effectiveViewerId)
    : task.completions[0];
  const done = Boolean(myCompletion);

  const toggle = async () => {
    if (done) {
      await api.post(`/tasks/${task.id}/uncomplete`, { completed_by_id: effectiveViewerId ?? null });
    } else {
      // Play immediately (before the await) so it stays tied to this click as a user gesture.
      const soundOwnerId = effectiveViewerId ?? activeProfile?.id;
      const soundOwner = members.find((m) => m.id === soundOwnerId);
      if (soundOwner) playCompletionSound(soundOwner.complete_sound, soundOwner.id);
      await api.post(`/tasks/${task.id}/complete`, { completed_by_id: effectiveViewerId ?? null });
    }
    onChange();
  };

  const claim = async () => {
    if (!activeProfile) return;
    await api.patch(`/tasks/${task.id}`, { assignee_ids: [...task.assignee_ids, activeProfile.id] });
    onChange();
  };

  const visibleAssignees = hideAssignee ? assignees.filter((m) => m.id !== effectiveViewerId) : assignees;

  return (
    <div className={`task-card ${done ? 'task-card--done' : ''}`}>
      <button className="task-card__check" onClick={toggle} aria-label={done ? 'Mark not done' : 'Mark done'}>
        {done ? '✓' : ''}
      </button>
      <div className="task-card__body">
        <div className="task-card__title">{task.title}</div>
        {task.notes && <div className="task-card__notes">{task.notes}</div>}
        <div className="task-card__meta">
          <span className={`badge badge--${task.kind}`}>{task.kind === 'chore' ? 'Chore' : 'To-do'}</span>
          {task.time_of_day && <span className="badge badge--time">{TIME_OF_DAY_LABEL[task.time_of_day]}</span>}
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
          {assignees.length === 0 && !done && activeProfile && (
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
      </div>
    </div>
  );
}
