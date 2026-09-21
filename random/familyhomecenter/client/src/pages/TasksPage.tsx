import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { api, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { TaskCard } from '../components/TaskCard.js';
import { TaskFormModal } from '../components/TaskFormModal.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { canEditTask, sortForColumn } from '../utils/tasks.js';

const UNASSIGNED = 'unassigned';

// How far the pointer has to move before a press counts as a drag rather than a tap — keeps
// checkbox/claim taps on the card working normally.
const DRAG_THRESHOLD_PX = 10;

export function TasksPage() {
  const { members, activeProfile } = useFamilyMembers();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalTask, setModalTask] = useState<Task | 'new' | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const dragState = useRef<{ taskId: string; startX: number; startY: number; moved: boolean } | null>(null);

  const load = () => {
    api.get<Task[]>('/tasks').then(setTasks).catch(console.error);
  };
  useEffect(load, []);

  const startDrag = (e: ReactPointerEvent, taskId: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragState.current = { taskId, startX: e.clientX, startY: e.clientY, moved: false };

    const findColumn = (x: number, y: number) =>
      (document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-column-id]') ?? null)?.dataset.columnId ?? null;

    const onMove = (ev: PointerEvent) => {
      const st = dragState.current;
      if (!st) return;
      if (!st.moved && Math.hypot(ev.clientX - st.startX, ev.clientY - st.startY) > DRAG_THRESHOLD_PX) {
        st.moved = true;
        setDragTaskId(st.taskId);
      }
      if (st.moved) {
        setDragPos({ x: ev.clientX, y: ev.clientY });
        setDropTargetId(findColumn(ev.clientX, ev.clientY));
      }
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const st = dragState.current;
      dragState.current = null;
      setDragTaskId(null);
      setDragPos(null);
      setDropTargetId(null);
      if (!st?.moved) return; // a plain tap — let the card's own click handlers do their thing
      const columnId = findColumn(ev.clientX, ev.clientY);
      if (!columnId) return;
      const assigneeIds = columnId === UNASSIGNED ? [] : [columnId];
      api.patch(`/tasks/${st.taskId}`, { assignee_ids: assigneeIds }).then(load).catch(console.error);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const unassigned = sortForColumn(tasks.filter((t) => t.assignee_ids.length === 0));
  const draggedTask = dragTaskId ? tasks.find((t) => t.id === dragTaskId) : null;

  const renderTask = (t: Task, viewerId?: string) => (
    <div
      key={t.id}
      className={`draggable-task ${dragTaskId === t.id ? 'draggable-task--dragging' : ''}`}
      onPointerDown={(e) => startDrag(e, t.id)}
    >
      <TaskCard
        task={t}
        onChange={load}
        hideAssignee
        viewerId={viewerId}
        onEdit={canEditTask(t, activeProfile) ? setModalTask : undefined}
      />
    </div>
  );

  return (
    <div className="tasks-page">
      <div className="tasks-page__header">
        <button
          type="button"
          className="icon-button"
          aria-label="Add a chore or to-do"
          onClick={() => setModalTask('new')}
        >
          +
        </button>
        <h1>Chores &amp; To-dos</h1>
      </div>

      <div className="tasks-page__columns">
        {members.map((member) => {
          const memberTasks = sortForColumn(tasks.filter((t) => t.assignee_ids.includes(member.id)));
          return (
            <section
              key={member.id}
              data-column-id={member.id}
              className={`panel person-column ${dropTargetId === member.id ? 'person-column--drop-target' : ''}`}
            >
              <h2>
                <MemberAvatar member={member} /> {member.name}
                <span className="person-column__count">{memberTasks.length}</span>
              </h2>
              {memberTasks.length === 0 && <div className="empty-state">Nothing assigned</div>}
              {memberTasks.map((t) => renderTask(t, member.id))}
            </section>
          );
        })}

        <section
          data-column-id={UNASSIGNED}
          className={`panel person-column person-column--unassigned ${dropTargetId === UNASSIGNED ? 'person-column--drop-target' : ''}`}
        >
          <h2>
            Unassigned
            <span className="person-column__count">{unassigned.length}</span>
          </h2>
          {unassigned.length === 0 && <div className="empty-state">Nothing unclaimed</div>}
          {unassigned.map((t) => renderTask(t))}
        </section>
      </div>

      {draggedTask && dragPos && (
        <div className="drag-ghost" style={{ left: dragPos.x, top: dragPos.y }}>
          {draggedTask.title}
        </div>
      )}

      {modalTask && (
        <TaskFormModal
          task={modalTask === 'new' ? null : modalTask}
          onClose={() => setModalTask(null)}
          onSaved={() => {
            setModalTask(null);
            load();
          }}
        />
      )}
    </div>
  );
}
