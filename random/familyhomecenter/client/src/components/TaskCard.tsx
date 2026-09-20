import { api, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

interface Props {
  task: Task;
  onChange: () => void;
  /** Suppress the assignee line — used in the per-person column view, where the column itself already says whose task it is. */
  hideAssignee?: boolean;
  /** When provided, shows an edit icon that hands this task back to the caller (e.g. to open an edit modal). */
  onEdit?: (task: Task) => void;
}

export function TaskCard({ task, onChange, hideAssignee, onEdit }: Props) {
  const { members, activeProfile } = useFamilyMembers();
  const assignee = members.find((m) => m.id === task.assignee_id);
  const done = Boolean(task.completion);

  const toggle = async () => {
    if (done) {
      await api.post(`/tasks/${task.id}/uncomplete`, {});
    } else {
      await api.post(`/tasks/${task.id}/complete`, { completed_by_id: activeProfile?.id ?? null });
    }
    onChange();
  };

  const claim = async () => {
    if (!activeProfile) return;
    await api.patch(`/tasks/${task.id}`, { assignee_id: activeProfile.id });
    onChange();
  };

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
          {!hideAssignee && assignee && (
            <span className="task-card__assignee">
              <span className="avatar-dot" style={{ background: assignee.color }} /> {assignee.name}
            </span>
          )}
          {!assignee && !done && activeProfile && (
            <button className="link-button task-card__claim" onClick={claim}>
              Claim it — I'll do it
            </button>
          )}
          {!assignee && !activeProfile && (
            <span className="task-card__assignee task-card__assignee--unassigned">
              Unassigned — pick your name up top to claim it
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
