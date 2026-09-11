import { api, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

interface Props {
  task: Task;
  onChange: () => void;
}

export function TaskCard({ task, onChange }: Props) {
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
          {assignee && (
            <span className="task-card__assignee">
              <span className="avatar-dot" style={{ background: assignee.color }} /> {assignee.name}
            </span>
          )}
          {!assignee && <span className="task-card__assignee task-card__assignee--unassigned">Unassigned</span>}
        </div>
      </div>
    </div>
  );
}
