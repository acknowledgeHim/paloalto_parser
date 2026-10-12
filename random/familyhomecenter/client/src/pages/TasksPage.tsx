import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { TaskCard } from '../components/TaskCard.js';
import { TaskFormModal } from '../components/TaskFormModal.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { canEditTask, routineNumber, sortForColumn } from '../utils/tasks.js';
import { FloorplanView } from '../components/FloorplanView.js';
import { taskIcon } from '../utils/taskIcons.js';

const UNASSIGNED = 'unassigned';
const VIEW_KEY = 'familyhomecenter.tasks.view';

// How far the pointer has to move before a press counts as a drag rather than a tap — keeps
// checkbox/claim taps on the card working normally.
const DRAG_THRESHOLD_PX = 10;

export function TasksPage() {
  const { members, activeProfile } = useFamilyMembers();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalTask, setModalTask] = useState<Task | 'new' | null>(null);
  // ✎ always shows here; when this person can't edit that job, it says why instead of hiding.
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const tryEdit = (t: Task) => {
    if (canEditTask(t, activeProfile)) {
      setEditNotice(null);
      setModalTask(t);
      return;
    }
    setEditNotice(
      activeProfile
        ? `Only a parent, or whoever "${t.title}" is assigned to, can edit it — ${activeProfile.name} is picked in "Who's this?" up top.`
        : `Pick who you are in "Who's this?" up top first — parents can edit every chore and to-do, kids their own.`
    );
  };
  // "+ Add a job here" on a floor plan room: the new task starts in that room.
  const [newRoomId, setNewRoomId] = useState<string | null>(null);
  const [view, setViewState] = useState<'people' | 'rooms'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'rooms' ? 'rooms' : 'people';
    } catch {
      return 'people';
    }
  });
  const setView = (v: 'people' | 'rooms') => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // not remembered — fine
    }
  };
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const dragState = useRef<{ taskId: string; startX: number; startY: number; moved: boolean } | null>(null);

  // "When needed" chores (the dishwasher) that don't need doing right now — a 🔔 calls for one.
  const [waiting, setWaiting] = useState<Task[]>([]);
  const load = () => {
    api.get<Task[]>('/tasks').then(setTasks).catch(console.error);
    api
      .get<Task[]>('/tasks?all=true')
      .then((all) => setWaiting(all.filter((t) => t.recurrence === 'asneeded' && !t.needed_since)))
      .catch(console.error);
  };
  const callFor = (t: Task) => api.post(`/tasks/${t.id}/needed`, { needed: true }).then(load).catch(console.error);
  useEffect(load, []);

  const startDrag = (e: ReactPointerEvent, taskId: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // A chore taken in turns goes to whoever's turn it is — change that in its ✎ settings instead.
    if (tasks.find((t) => t.id === taskId)?.rotation_ids?.length) return;
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

  // 🔢 Putting someone's jobs in the order they should do them (parents, or that person themselves).
  const [orderingId, setOrderingId] = useState<string | null>(null);
  const [orderList, setOrderList] = useState<Task[] | null>(null);
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const canOrder = (memberId: string) => isParent || activeProfile?.id === memberId;
  const startOrdering = (memberId: string) => {
    setOrderingId(memberId);
    setOrderList(null);
    // Every job of theirs, not just today's — a weekly one keeps its place on the days it's off.
    api
      .get<Task[]>('/tasks?all=true')
      .then((all) => setOrderList(sortForColumn(all.filter((t) => t.assignee_ids.includes(memberId) && !t.finished), memberId)))
      .catch(console.error);
  };
  const moveInOrder = (i: number, by: -1 | 1) => {
    if (!orderList || !orderingId) return;
    const j = i + by;
    if (j < 0 || j >= orderList.length) return;
    const next = [...orderList];
    [next[i], next[j]] = [next[j], next[i]];
    setOrderList(next);
    api.put(`/tasks/order/${orderingId}`, { task_ids: next.map((t) => t.id) }).then(load).catch(console.error);
  };

  const renderTask = (t: Task, viewerId?: string, list?: Task[]) => (
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
        onEdit={tryEdit}
        orderNumber={viewerId && list ? routineNumber(t, list, viewerId) : null}
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
        <div className="tasks-page__views" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'people'} className={view === 'people' ? '' : 'secondary'} onClick={() => setView('people')}>
            👥 By person
          </button>
          <button type="button" role="tab" aria-selected={view === 'rooms'} className={view === 'rooms' ? '' : 'secondary'} onClick={() => setView('rooms')}>
            🏠 By room
          </button>
        </div>
      </div>

      {waiting.length > 0 && (
        <div className="tasks-page__waiting">
          <span className="hint">When needed:</span>
          {waiting.map((t) => {
            const who = members.find((m) => m.id === (t.rotation_next_id ?? (t.assignee_ids.length === 1 ? t.assignee_ids[0] : null)));
            return (
              <button key={t.id} type="button" className="secondary tasks-page__waiting-item" onClick={() => callFor(t)} title="Tap when it needs doing">
                🔔 {taskIcon(t)} {t.title}
                {who && (
                  <span className="hint">
                    {' '}
                    — {who.name}'s turn
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {editNotice && (
        <div className="settings-login__error tasks-page__notice" role="status">
          {editNotice}
          <button type="button" className="link-button" onClick={() => setEditNotice(null)}>OK</button>
        </div>
      )}

      {view === 'rooms' && (
        <FloorplanView
          tasks={tasks}
          onChange={load}
          onEdit={setModalTask}
          onAdd={(roomId) => {
            setNewRoomId(roomId);
            setModalTask('new');
          }}
          allowEditing
        />
      )}

      {view === 'people' && (
      <div className="tasks-page__columns">
        {members.map((member) => {
          const memberTasks = sortForColumn(tasks.filter((t) => t.assignee_ids.includes(member.id)), member.id);
          const ordering = orderingId === member.id;
          return (
            <section
              key={member.id}
              data-column-id={member.id}
              className={`panel person-column ${dropTargetId === member.id ? 'person-column--drop-target' : ''}`}
            >
              <h2>
                <Link to={`/person/${member.id}`} className="person-column__link">
                  <MemberAvatar member={member} /> {member.name}
                </Link>
                <span className="person-column__count">{memberTasks.length}</span>
                {canOrder(member.id) && (
                  <button
                    type="button"
                    className={`person-column__order ${ordering ? '' : 'secondary'}`}
                    onClick={() => (ordering ? setOrderingId(null) : startOrdering(member.id))}
                    title={ordering ? 'Done' : `Put ${member.name}'s jobs in the order to do them`}
                    aria-label={ordering ? 'Done ordering' : `Put ${member.name}'s jobs in order`}
                  >
                    {ordering ? '✓' : '🔢'}
                  </button>
                )}
              </h2>
              {ordering ? (
                <div className="task-order">
                  <p className="hint">
                    The order {member.name} does them in — their avatar on the floor plan walks from one to the next. ↑ ↓ to move.
                  </p>
                  {!orderList && <div className="empty-state">Loading…</div>}
                  {orderList?.length === 0 && <div className="empty-state">Nothing assigned</div>}
                  <ol className="task-order__list">
                    {orderList?.map((t, i) => (
                      <li key={t.id}>
                        <span className="task-card__order">{i + 1}</span>
                        <span className="task-order__title">
                          {taskIcon(t)} {t.title}
                        </span>
                        <button type="button" className="secondary" aria-label={`Move ${t.title} up`} disabled={i === 0} onClick={() => moveInOrder(i, -1)}>↑</button>
                        <button type="button" className="secondary" aria-label={`Move ${t.title} down`} disabled={i === orderList.length - 1} onClick={() => moveInOrder(i, 1)}>↓</button>
                      </li>
                    ))}
                  </ol>
                  <button type="button" onClick={() => setOrderingId(null)}>✓ Done</button>
                </div>
              ) : (
                <>
                  {memberTasks.length === 0 && <div className="empty-state">Nothing assigned</div>}
                  {memberTasks.map((t) => renderTask(t, member.id, memberTasks))}
                </>
              )}
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
      )}

      {draggedTask && dragPos && (
        <div className="drag-ghost" style={{ left: dragPos.x, top: dragPos.y }}>
          {draggedTask.title}
        </div>
      )}

      {modalTask && (
        <TaskFormModal
          task={modalTask === 'new' ? null : modalTask}
          defaultRoomId={modalTask === 'new' ? newRoomId : null}
          onClose={() => {
            setModalTask(null);
            setNewRoomId(null);
          }}
          onSaved={() => {
            setModalTask(null);
            setNewRoomId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
