import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { api, type Floorplan, type FloorplanRoom, type Task } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { canEditTask, isTaskDoneByAll, isTaskDoneFor, sortForColumn } from '../utils/tasks.js';
import { taskIcon } from '../utils/taskIcons.js';
import { canPlaceTask, findRoom, refreshFloorplans, roomAt, useFloorplans } from '../utils/floorplans.js';
import { ConfirmButton } from './ConfirmButton.js';
import { FloorplanStage, walkerSpots } from './FloorplanStage.js';
import { MemberAvatar } from './MemberAvatar.js';
import { TaskCard } from './TaskCard.js';

/**
 * Chores & Tasks → 🏠 By room, and Family Board → 🏠 House: the floor plans (one per floor, the
 * yard…), each room showing how many jobs are left in it, and everyone's avatar standing where
 * their next job is. Tap a room for its jobs and who's on each. Parents can add plans and mark rooms.
 */

const ROOM_SUGGESTIONS = [
  'Kitchen', 'Living room', 'Dining room', 'Family room', 'Bathroom', 'Bedroom', 'Office', 'Laundry',
  'Garage', 'Hallway', 'Entry', 'Basement', 'Playroom', 'Front yard', 'Backyard', 'Patio', 'Driveway', 'Garden',
];
const PLAN_KEY = 'familyhomecenter.floorplan.active';
const THREE_D_KEY = 'familyhomecenter.floorplan.3d';
const PATHS_KEY = 'familyhomecenter.floorplan.paths';

const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not remembered — fine
  }
};
const recall = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** A picture file as a JPEG data URL, at most 3000px, on white (a see-through PNG would go black). */
function readPlanImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't open that picture — try a PNG or JPG (a screenshot of a PDF works)"));
    };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth || 1600;
      const h = img.naturalHeight || 1200;
      const scale = Math.min(1, 3000 / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale);
      c.height = Math.round(h * scale);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.9));
    };
    img.src = url;
  });
}

type DrawMode = 'box' | 'shape';

export function FloorplanView({
  tasks,
  onChange,
  onEdit,
  onAdd,
  allowEditing = false,
  defaultThreeD = false,
}: {
  tasks: Task[];
  onChange: () => void;
  onEdit?: (task: Task) => void;
  /** "+ Add a job here" — opens the task form with this room picked. */
  onAdd?: (roomId: string) => void;
  /** Show the parents' tools for adding plans and marking rooms. */
  allowEditing?: boolean;
  defaultThreeD?: boolean;
}) {
  const { members, activeProfile } = useFamilyMembers();
  const plans = useFloorplans();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const canEdit = allowEditing && isParent;

  const [planId, setPlanIdState] = useState<string | null>(() => recall(PLAN_KEY));
  const setPlanId = (id: string) => {
    setPlanIdState(id);
    setSelectedRoomId(null);
    remember(PLAN_KEY, id);
  };
  const [threeD, setThreeDState] = useState(() => {
    const saved = recall(THREE_D_KEY);
    return saved === null ? defaultThreeD : saved === '1';
  });
  const setThreeD = (v: boolean) => {
    setThreeDState(v);
    remember(THREE_D_KEY, v ? '1' : '0');
  };
  const [showPaths, setShowPathsState] = useState(() => recall(PATHS_KEY) === '1');
  const setShowPaths = (v: boolean) => {
    setShowPathsState(v);
    remember(PATHS_KEY, v ? '1' : '0');
  };
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const stageBox = useRef<HTMLDivElement>(null);
  /** After a check-off: back to the plan, to watch them walk to their next job. */
  const changedAndWatch = () => {
    onChange();
    stageBox.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const [editing, setEditing] = useState(false);
  // ⛶ Full screen: the plan fills the screen (viewing, placing or editing). Esc leaves.
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      // Esc closes a popup first, if one is open (they listen too).
      if (e.key === 'Escape' && !document.querySelector('.modal-overlay')) setFull(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('fp-full-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('fp-full-open');
    };
  }, [full]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 📌 Place chores: drag jobs from each person's list onto their spot on the plan.
  const canPlaceAny = canPlaceTask(null, activeProfile, members);
  const [placing, setPlacing] = useState(false);
  // Every job (not just today's), for placing — a weekly chore needs a spot too.
  const [allTasks, setAllTasks] = useState<Task[] | null>(null);
  const loadAll = () =>
    api
      .get<Task[]>('/tasks?all=true')
      .then(setAllTasks)
      .catch((err) => setError((err as Error).message));
  useEffect(() => {
    if (placing) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placing]);
  const [pinMenu, setPinMenu] = useState<Task | null>(null);
  const [drag, setDrag] = useState<{ task: Task; x: number; y: number } | null>(null);
  const changed = () => {
    onChange();
    if (placing) loadAll();
  };

  const plan = plans?.find((p) => p.id === planId) ?? plans?.[0] ?? null;
  const room = plan?.rooms.find((r) => r.id === selectedRoomId) ?? null;
  const spots = plans ? walkerSpots(tasks, members, plans, threeD) : [];

  const place = async (task: Task, roomId: string | null, at?: [number, number]) => {
    setError(null);
    try {
      await api.patch(`/tasks/${task.id}/location`, { room_id: roomId, x: at?.[0], y: at?.[1], acting_member_id: activeProfile?.id ?? null });
      changed();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  /** Press on a job (in a list, or its pin while placing): a drag puts it where it's dropped; a tap on a pin opens its menu. */
  const startDrag = (task: Task, e: ReactPointerEvent, fromPin: boolean) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) moved = true;
      if (!moved) return;
      setDrag({ task, x: ev.clientX, y: ev.clientY });
      // Near the top or bottom of the screen, scroll — the lists are under the plan.
      if (ev.clientY < 70) window.scrollBy(0, -18);
      else if (ev.clientY > window.innerHeight - 70) window.scrollBy(0, 18);
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      setDrag(null);
      if (!moved) {
        if (fromPin) setPinMenu(task);
        return;
      }
      const planeEl = document
        .elementsFromPoint(ev.clientX, ev.clientY)
        .find((el) => el.classList.contains('fp-stage__plane')) as HTMLElement | undefined;
      if (!planeEl || !plan) return; // dropped off the plan — nothing changes
      const r = planeEl.getBoundingClientRect();
      const pt: [number, number] = [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height];
      const target = roomAt(plan, pt);
      if (!target) {
        setError(`Drop "${task.title}" inside one of the marked rooms.`);
        return;
      }
      void place(task, target.id, pt);
    };
    const onCancel = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await refreshFloorplans();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!plans) return <div className="empty-state">Loading floor plans…</div>;

  if (plans.length === 0) {
    return (
      <section className="panel fp-view">
        <h2>🏠 Floor plans</h2>
        <p>
          Add a picture of your floor plan — one for each floor, and one of the yard if you like — then mark the rooms on it.
          Put chores and to-dos in a room, and tap a room to see what needs doing there and who's doing it.
          Everyone's avatar stands where their next job is, and walks to the next one when they finish.
        </p>
        {canEdit ? (
          <NewPlanForm onDone={(p) => setPlanId(p.id)} first />
        ) : (
          <p className="hint">{allowEditing ? 'A parent can add one here.' : 'A parent can add one under Chores & Tasks → 🏠 By room.'}</p>
        )}
      </section>
    );
  }

  return (
    <section className={`panel fp-view ${full ? 'fp-view--full' : ''}`}>
      {/* Full screen: the same controls, shrunk to icons floating in a corner, so the plan gets the screen. */}
      <div className={`fp-view__bar ${full ? 'fp-view__bar--float' : ''}`}>
        <div className="fp-view__tabs" role="tablist">
          {plans.map((p) => {
            const people = spots.filter((s) => s.planId === p.id);
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === plan?.id}
                className={`fp-view__tab ${p.id === plan?.id ? 'fp-view__tab--active' : ''}`}
                onClick={() => setPlanId(p.id)}
              >
                {p.name}
                {people.length > 0 && !full && (
                  <span className="fp-view__tab-people">
                    {people.slice(0, 4).map((s) => (
                      <MemberAvatar key={s.member.id} member={s.member} size={20} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="fp-view__tools">
          <button
            type="button"
            className={showPaths ? '' : 'secondary'}
            onClick={() => setShowPaths(!showPaths)}
            disabled={editing}
            aria-pressed={showPaths}
            aria-label="Paths"
            title="Show each person's walking route through their next jobs"
          >
            {full ? '👣' : '👣 Paths'}
          </button>
          <button
            type="button"
            className={`fp-view__full-toggle ${full ? '' : 'secondary'}`}
            onClick={() => setFull(!full)}
            aria-pressed={full}
            aria-label={full ? 'Exit full screen' : 'Full screen'}
            title={full ? 'Exit full screen (Esc)' : 'Fill the screen with the plan'}
          >
            {full ? '✕' : '⛶ Full screen'}
          </button>
          {canPlaceAny && (
            <button
              type="button"
              className={placing ? '' : 'secondary'}
              onClick={() => {
                setPlacing(!placing);
                setEditing(false);
                setSelectedRoomId(null);
              }}
              aria-pressed={placing}
              aria-label={placing ? 'Done placing' : 'Place chores'}
              title={placing ? 'Done placing' : 'Drag chores and to-dos onto their spot on the plan'}
            >
              {full ? (placing ? '✓📌' : '📌') : placing ? '✓ Done placing' : '📌 Place chores'}
            </button>
          )}
          <button
            type="button"
            className={threeD ? '' : 'secondary'}
            onClick={() => setThreeD(!threeD)}
            disabled={editing || placing}
            aria-label={threeD ? '3-D (tap for flat)' : 'Flat (tap for 3-D)'}
            title={threeD ? '3-D — tap for flat' : 'Flat — tap for 3-D'}
          >
            {full ? (threeD ? '🧊' : '🗺️') : threeD ? '🧊 3-D' : '🗺️ Flat'}
          </button>
          {canEdit && (
            <button
              type="button"
              className={editing ? '' : 'secondary'}
              onClick={() => { setEditing(!editing); setPlacing(false); setSelectedRoomId(null); }}
              aria-label={editing ? 'Done editing' : 'Edit plans'}
              title={editing ? 'Done editing' : 'Edit plans'}
            >
              {full ? (editing ? '✓✏️' : '✏️') : editing ? '✓ Done editing' : '✏️ Edit plans'}
            </button>
          )}
        </div>
      </div>
      {error && <div className="settings-login__error">{error}</div>}

      {plan && editing ? (
        <PlanEditor plan={plan} plans={plans} act={act} busy={busy} big={full} onPlanAdded={(p) => setPlanId(p.id)} />
      ) : plan && placing ? (
        <>
          <p className="hint fp-view__hint">
            Drag a job from the lists onto the spot in the room where it's done. Drag a pin to move it; tap it to take it off the
            plan, edit it, or delete it.
          </p>
          <div className="fp-place">
          <FloorplanStage
            plan={plan}
            tasks={tasks}
            spots={[]}
            big={full}
            showWalkers={false}
            pins={(allTasks ?? []).filter((t) => t.room_id)}
            onPinPointerDown={(t, e) => (canPlaceTask(t, activeProfile, members) ? startDrag(t, e, true) : setPinMenu(t))}
          />
          <UnplacedLists tasks={allTasks} onPress={(t, e) => startDrag(t, e, false)} />
          </div>
        </>
      ) : (
        plan && (
          <>
            <div ref={stageBox}>
            <FloorplanStage
              plan={plan}
              tasks={tasks}
              spots={spots}
              threeD={threeD}
              big={full}
              showPaths={showPaths}
              selectedRoomId={selectedRoomId}
              onRoomClick={(r) => setSelectedRoomId(selectedRoomId === r.id ? null : r.id)}
              onWalkerClick={(s) => setPersonId(s.member.id)}
            />
            </div>
            {plan.rooms.length === 0 && (
              <p className="hint">No rooms marked on this plan yet{canEdit ? ' — tap ✏️ Edit plans to mark them.' : '.'}</p>
            )}
            <WhereIsEveryone spots={spots} plans={plans} planId={plan.id} tasks={tasks} onPerson={setPersonId} />
            {room && <RoomPanel room={room} tasks={tasks} onChange={changedAndWatch} onEdit={onEdit} onAdd={onAdd} onClose={() => setSelectedRoomId(null)} />}
          </>
        )
      )}
      {drag && (
        <div className="drag-ghost fp-drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {taskIcon(drag.task)} {drag.task.title}
        </div>
      )}
      {pinMenu && (
        <PinMenu
          task={pinMenu}
          plans={plans}
          onClose={() => setPinMenu(null)}
          onRemove={() => {
            setPinMenu(null);
            void place(pinMenu, null);
          }}
          onEdit={
            onEdit
              ? () => {
                  setPinMenu(null);
                  onEdit(pinMenu);
                }
              : undefined
          }
          onDeleted={() => {
            setPinMenu(null);
            changed();
          }}
        />
      )}
      {personId && members.some((m) => m.id === personId) && (
        <PersonJobsPopup
          memberId={personId}
          tasks={tasks}
          plans={plans}
          onChange={() => {
            // Close so the walk to their next job can be seen.
            setPersonId(null);
            changedAndWatch();
          }}
          onClose={() => setPersonId(null)}
          onGoToRoom={(p, r) => {
            setPersonId(null);
            setPlanId(p);
            setSelectedRoomId(r);
          }}
        />
      )}
    </section>
  );
}

/**
 * While placing: each person's jobs that aren't on the plan yet, to drag onto it — a kid allowed to
 * place their own sees just theirs. A job on several people shows under each (it's one job).
 */
function UnplacedLists({ tasks, onPress }: { tasks: Task[] | null; onPress: (task: Task, e: ReactPointerEvent) => void }) {
  const { members, activeProfile } = useFamilyMembers();
  if (!tasks) return <div className="empty-state">Loading chores…</div>;
  const unplaced = sortForColumn(tasks.filter((t) => !t.room_id && canPlaceTask(t, activeProfile, members)));
  const groups = [
    ...members.map((m) => ({ key: m.id, member: m, label: m.name, items: unplaced.filter((t) => t.assignee_ids.includes(m.id)) })),
    { key: 'anyone', member: null, label: 'Anyone (not assigned)', items: unplaced.filter((t) => t.assignee_ids.length === 0) },
  ].filter((g) => g.items.length > 0);
  if (!groups.length) return <div className="empty-state">Every chore and to-do is on the plan. 🎉</div>;
  return (
    <div className="fp-unplaced">
      {groups.map((g) => (
        <div key={g.key} className="fp-unplaced__group" style={{ borderTopColor: g.member?.color ?? 'var(--border)' }}>
          <h4>
            {g.member && <MemberAvatar member={g.member} size={24} />} {g.label} <span className="hint">({g.items.length})</span>
          </h4>
          <div className="fp-unplaced__items">
            {g.items.map((t) => (
              <button key={t.id} type="button" className="fp-unplaced__item" onPointerDown={(e) => onPress(t, e)} title="Drag onto the plan">
                <span aria-hidden="true">{taskIcon(t)}</span> {t.title}
                <span className={`badge badge--${t.kind}`}>{t.kind === 'chore' ? 'Chore' : 'To-do'}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tap a job's pin: where it is and who it's on, then take it off the plan, edit it, or delete it. */
function PinMenu({
  task,
  plans,
  onClose,
  onRemove,
  onEdit,
  onDeleted,
}: {
  task: Task;
  plans: Floorplan[];
  onClose: () => void;
  onRemove: () => void;
  onEdit?: () => void;
  onDeleted: () => void;
}) {
  const { members, activeProfile } = useFamilyMembers();
  const found = findRoom(plans, task.room_id);
  const people = members.filter((m) => task.assignee_ids.includes(m.id));
  const mayPlace = canPlaceTask(task, activeProfile, members);
  const mayEdit = canEditTask(task, activeProfile);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel panel fp-pin-menu" onClick={(e) => e.stopPropagation()}>
        <h2>
          <span aria-hidden="true">{taskIcon(task)}</span> {task.title}
        </h2>
        <p className="hint">
          {found ? `📍 ${found.room.name}${plans.length > 1 ? ` · ${found.plan.name}` : ''}` : 'Not on the plan'}
          {' · '}
          {people.length ? people.map((m) => m.name).join(', ') : 'Anyone'}
        </p>
        {error && <div className="settings-login__error">{error}</div>}
        <div className="fp-pin-menu__buttons">
          {mayPlace && found && (
            <button type="button" className="secondary" onClick={onRemove}>
              📍 Take it off the plan
            </button>
          )}
          {mayEdit && onEdit && (
            <button type="button" className="secondary" onClick={onEdit}>
              ✎ Edit
            </button>
          )}
          {mayEdit && (
            <ConfirmButton
              label={`🗑️ Delete this ${task.kind === 'chore' ? 'chore' : 'to-do'}`}
              confirmLabel={`Delete "${task.title}" for good?`}
              className="secondary"
              onConfirm={async () => {
                try {
                  await api.delete(`/tasks/${task.id}`);
                  onDeleted();
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
          )}
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
        {!mayPlace && <p className="hint">Only a parent can move this on the plan.</p>}
      </div>
    </div>
  );
}

/** Below the plan: who's where (including on other floors), and who has nothing left in a room. */
function WhereIsEveryone({
  spots,
  plans,
  planId,
  tasks,
  onPerson,
}: {
  spots: ReturnType<typeof walkerSpots>;
  plans: Floorplan[];
  planId: string;
  tasks: Task[];
  onPerson: (memberId: string) => void;
}) {
  const { members } = useFamilyMembers();
  const elsewhere = spots.filter((s) => s.planId !== planId);
  const free = members.filter((m) => !spots.some((s) => s.member.id === m.id) && tasks.some((t) => t.assignee_ids.includes(m.id)));
  if (!elsewhere.length && !free.length) return null;
  return (
    <div className="fp-where">
      {elsewhere.map((s) => (
        <button key={s.member.id} type="button" className="fp-where__chip" onClick={() => onPerson(s.member.id)}>
          <MemberAvatar member={s.member} size={22} /> {s.member.name}: {taskIcon(s.task)} {s.room.name}
          <span className="hint"> ({plans.find((p) => p.id === s.planId)?.name})</span>
        </button>
      ))}
      {free.map((m) => {
        const left = tasks.filter((t) => t.assignee_ids.includes(m.id) && !isTaskDoneByAll(t)).length;
        return (
          <button key={m.id} type="button" className="fp-where__chip fp-where__chip--free" onClick={() => onPerson(m.id)}>
            <MemberAvatar member={m} size={22} /> {m.name}: {left ? `${left} left, not in a room` : 'all done 🎉'}
          </button>
        );
      })}
    </div>
  );
}

/** Tap a person: what's next for them (in order, with where) and what they've done today. */
function PersonJobsPopup({
  memberId,
  tasks,
  plans,
  onChange,
  onClose,
  onGoToRoom,
}: {
  memberId: string;
  tasks: Task[];
  plans: Floorplan[];
  onChange: () => void;
  onClose: () => void;
  onGoToRoom: (planId: string, roomId: string) => void;
}) {
  const { members } = useFamilyMembers();
  const member = members.find((m) => m.id === memberId)!;
  const mine = sortForColumn(tasks.filter((t) => t.assignee_ids.includes(memberId)));
  const next = mine.filter((t) => !isTaskDoneFor(t, memberId));
  const done = mine.filter((t) => isTaskDoneFor(t, memberId));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const where = (t: Task) => {
    const found = findRoom(plans, t.room_id);
    if (!found) return null;
    return (
      <button type="button" className="link-button fp-person__where" onClick={() => onGoToRoom(found.plan.id, found.room.id)}>
        📍 {found.room.name}
        {plans.length > 1 ? ` · ${found.plan.name}` : ''}
      </button>
    );
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel panel fp-person" onClick={(e) => e.stopPropagation()}>
        <div className="fp-person__head">
          <MemberAvatar member={member} size={64} />
          <h2>{member.name}</h2>
          <button type="button" className="secondary" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <h3>Up next {next.length > 0 && <span className="hint">({next.length})</span>}</h3>
        {next.length === 0 && <div className="empty-state">{mine.length ? 'All done for today! 🎉' : 'Nothing assigned today.'}</div>}
        {next.map((t, i) => (
          <div key={t.id} className={`fp-person__row ${i === 0 ? 'fp-person__row--now' : ''}`}>
            {i === 0 && <span className="fp-person__now">Now</span>}
            {where(t)}
            <TaskCard task={t} onChange={onChange} hideAssignee viewerId={memberId} />
          </div>
        ))}
        {done.length > 0 && (
          <>
            <h3>Done today <span className="hint">({done.length})</span></h3>
            {done.map((t) => (
              <div key={t.id} className="fp-person__row">
                {where(t)}
                <TaskCard task={t} onChange={onChange} hideAssignee viewerId={memberId} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** A room's jobs: one row per person on each (each checks off their own), plus unclaimed ones. */
function RoomPanel({
  room,
  tasks,
  onChange,
  onEdit,
  onAdd,
  onClose,
}: {
  room: FloorplanRoom;
  tasks: Task[];
  onChange: () => void;
  onEdit?: (task: Task) => void;
  onAdd?: (roomId: string) => void;
  onClose: () => void;
}) {
  const { members, activeProfile } = useFamilyMembers();
  const editFor = (t: Task) => (onEdit && canEditTask(t, activeProfile) ? onEdit : undefined);
  const here = sortForColumn(tasks.filter((t) => t.room_id === room.id));
  const open = here.filter((t) => !isTaskDoneByAll(t));
  const done = here.filter((t) => isTaskDoneByAll(t));
  const rows = (list: Task[]) =>
    list.flatMap((t) => {
      const people = members.filter((m) => t.assignee_ids.includes(m.id));
      if (!people.length) return [<TaskCard key={t.id} task={t} onChange={onChange} onEdit={editFor(t)} />];
      return people.map((m) => (
        <div key={`${t.id}:${m.id}`} className="fp-room-panel__row">
          <span className="fp-room-panel__who" style={{ borderColor: m.color }}>
            <MemberAvatar member={m} size={28} /> {m.name}
          </span>
          <TaskCard task={t} onChange={onChange} onEdit={editFor(t)} hideAssignee viewerId={m.id} />
        </div>
      ));
    });
  return (
    <div className="fp-room-panel" style={{ borderTopColor: room.color }}>
      <div className="fp-room-panel__head">
        <h3>{room.name}</h3>
        <span className="hint">{open.length ? `${open.length} to do` : here.length ? 'All done here ✓' : 'Nothing here today'}</span>
        {onAdd && (
          <button type="button" className="secondary" onClick={() => onAdd(room.id)}>
            + Add a job here
          </button>
        )}
        <button type="button" className="secondary" onClick={onClose} aria-label="Close">✕</button>
      </div>
      {rows(open)}
      {done.length > 0 && (
        <>
          <h4 className="hint">Done</h4>
          {rows(done)}
        </>
      )}
    </div>
  );
}

function NewPlanForm({ onDone, first = false }: { onDone: (plan: Floorplan) => void; first?: boolean }) {
  const [name, setName] = useState(first ? 'Main floor' : '');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!file || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const plan = await api.post<Floorplan>('/floorplans', { name: name.trim(), imageDataUrl: await readPlanImage(file) });
      await refreshFloorplans();
      onDone(plan);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fp-new">
      <label className="member-form__label member-form__label--inline">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g. "Upstairs" or "Yard"' maxLength={60} />
      </label>
      <label className="member-form__label member-form__label--inline">
        Picture
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <button type="button" onClick={submit} disabled={busy || !file || !name.trim()}>
        {busy ? 'Adding…' : '+ Add floor plan'}
      </button>
      <span className="hint">A drawing, a photo of a paper plan, a real-estate listing's plan, or a screenshot all work.</span>
      {error && <div className="settings-login__error">{error}</div>}
    </div>
  );
}

/** A size setting: − 75% ＋, in quarter steps between 50% and 300%. */
function SizeStepper({ label, value, busy, onSet }: { label: string; value: number; busy: boolean; onSet: (v: number) => void }) {
  const step = (by: number) => onSet(Math.round((value + by) * 100) / 100);
  return (
    <span className="fp-editor__size">
      {label}
      <button type="button" className="secondary" aria-label={`${label} smaller`} disabled={busy || value <= 0.5} onClick={() => step(-0.25)}>−</button>
      <span className="fp-zoom__level">{Math.round(value * 100)}%</span>
      <button type="button" className="secondary" aria-label={`${label} bigger`} disabled={busy || value >= 3} onClick={() => step(0.25)}>＋</button>
    </span>
  );
}

/** Parents: how this plan looks — starting zoom, and the size of room labels, avatars and job emoji. */
function PlanDisplaySettings({ plan, act, busy }: { plan: Floorplan; act: (fn: () => Promise<unknown>) => Promise<void>; busy: boolean }) {
  const set = (field: string, value: number | null) => act(() => api.patch(`/floorplans/${plan.id}`, { [field]: value }));
  return (
    <div className="fp-editor__display">
      <label className="fp-editor__size">
        Starting zoom
        <select value={plan.default_zoom == null ? 'fit' : String(plan.default_zoom)} disabled={busy} onChange={(e) => set('default_zoom', e.target.value === 'fit' ? null : Number(e.target.value))}>
          <option value="fit">Fit the screen</option>
          {[0.5, 0.75, 1.25, 1.5, 1.75, 2].map((z) => (
            <option key={z} value={String(z)}>{Math.round(z * 100)}%</option>
          ))}
        </select>
      </label>
      <SizeStepper label="Labels" value={plan.label_scale ?? 1} busy={busy} onSet={(v) => set('label_scale', v)} />
      <SizeStepper label="Avatars" value={plan.avatar_scale ?? 1} busy={busy} onSet={(v) => set('avatar_scale', v)} />
      <SizeStepper label="Job emoji" value={plan.job_scale ?? 1} busy={busy} onSet={(v) => set('job_scale', v)} />
    </div>
  );
}

/** Parents: rename/replace/reorder/delete the plan, and mark its rooms. */
function PlanEditor({
  plan,
  plans,
  act,
  busy,
  big = false,
  onPlanAdded,
}: {
  plan: Floorplan;
  plans: Floorplan[];
  act: (fn: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
  big?: boolean;
  onPlanAdded: (plan: Floorplan) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<DrawMode>('box');
  const [draft, setDraft] = useState<Array<[number, number]>>([]);
  const [box, setBoxState] = useState<{ from: [number, number]; to: [number, number] } | null>(null);
  // Also kept in a ref: pointer events can come faster than re-renders.
  const boxRef = useRef(box);
  const setBox = (b: typeof box) => {
    boxRef.current = b;
    setBoxState(b);
  };
  // An outline drawn and waiting for a name (or, when redrawing, for a room to go to).
  const [pending, setPending] = useState<Array<[number, number]> | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [redrawing, setRedrawing] = useState<string | null>(null);
  const [planName, setPlanName] = useState(plan.name);
  const [adding, setAdding] = useState(false);
  const selected = plan.rooms.find((r) => r.id === selectedId) ?? null;
  const [roomName, setRoomName] = useState('');
  useEffect(() => setRoomName(selected?.name ?? ''), [selected?.id, selected?.name]);
  useEffect(() => {
    setPlanName(plan.name);
    setDraft([]);
    setPending(null);
    setSelectedId(null);
    setRedrawing(null);
  }, [plan.id, plan.name]);

  const at = (e: ReactPointerEvent): [number, number] => {
    const r = stage.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const finishOutline = async (points: Array<[number, number]>) => {
    setDraft([]);
    setBox(null);
    if (redrawing) {
      const id = redrawing;
      setRedrawing(null);
      await act(() => api.patch(`/floorplans/rooms/${id}`, { points }));
      return;
    }
    setPending(points);
    setNewName('');
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pending) return;
    const p = at(e);
    if (mode === 'box') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // painting still works inside the plan
      }
      setBox({ from: p, to: p });
      return;
    }
    // Shape: tap each corner; tapping near the first one closes it.
    if (draft.length >= 3 && Math.hypot(p[0] - draft[0][0], p[1] - draft[0][1]) < 0.025) {
      void finishOutline(draft);
      return;
    }
    setDraft([...draft, p]);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const b = boxRef.current;
    if (b) setBox({ ...b, to: at(e) });
  };
  const onUp = () => {
    const box = boxRef.current;
    if (!box) return;
    const [x1, y1] = box.from;
    const [x2, y2] = box.to;
    if (Math.abs(x2 - x1) < 0.015 || Math.abs(y2 - y1) < 0.015) {
      setBox(null);
      return;
    }
    const l = Math.min(x1, x2);
    const r = Math.max(x1, x2);
    const t = Math.min(y1, y2);
    const b = Math.max(y1, y2);
    void finishOutline([[l, t], [r, t], [r, b], [l, b]]);
  };

  const outline = box
    ? [box.from, [box.to[0], box.from[1]], box.to, [box.from[0], box.to[1]]]
    : pending ?? draft;

  return (
    <div className="fp-editor">
      <div className="fp-editor__plan-tools">
        <label className="member-form__label member-form__label--inline">
          Plan name
          <input value={planName} onChange={(e) => setPlanName(e.target.value)} maxLength={60} />
        </label>
        <button type="button" className="secondary" disabled={busy || !planName.trim() || planName.trim() === plan.name} onClick={() => act(() => api.patch(`/floorplans/${plan.id}`, { name: planName.trim() }))}>
          Rename
        </button>
        <label className="secondary fp-editor__file">
          🖼️ Replace picture
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void act(async () => api.patch(`/floorplans/${plan.id}`, { imageDataUrl: await readPlanImage(f) }));
            }}
          />
        </label>
        {plans.length > 1 && (
          <>
            <button type="button" className="secondary" aria-label="Move left" disabled={busy || plans[0].id === plan.id} onClick={() => act(() => api.patch(`/floorplans/${plan.id}`, { move: -1 }))}>◀</button>
            <button type="button" className="secondary" aria-label="Move right" disabled={busy || plans[plans.length - 1].id === plan.id} onClick={() => act(() => api.patch(`/floorplans/${plan.id}`, { move: 1 }))}>▶</button>
          </>
        )}
        <PlanDisplaySettings plan={plan} act={act} busy={busy} />
        <ConfirmButton
          label="🗑️ Delete plan"
          confirmLabel={`Delete "${plan.name}" and its rooms? (Jobs in them stay, just without a room.)`}
          onConfirm={() => act(() => api.delete(`/floorplans/${plan.id}`))}
          className="secondary"
        />
        <button type="button" className="secondary" onClick={() => setAdding(!adding)}>
          {adding ? 'Cancel' : '+ Another floor plan'}
        </button>
      </div>
      {adding && (
        <NewPlanForm
          onDone={(p) => {
            setAdding(false);
            onPlanAdded(p);
          }}
        />
      )}

      <div className="fp-editor__draw-tools">
        <span>{redrawing ? `Redraw "${plan.rooms.find((r) => r.id === redrawing)?.name}":` : 'Mark a room:'}</span>
        <button type="button" className={mode === 'box' ? '' : 'secondary'} onClick={() => { setMode('box'); setDraft([]); }}>
          ⬛ Drag a box
        </button>
        <button type="button" className={mode === 'shape' ? '' : 'secondary'} onClick={() => setMode('shape')}>
          📐 Tap the corners
        </button>
        {mode === 'shape' && draft.length > 0 && (
          <>
            <button type="button" className="secondary" onClick={() => setDraft(draft.slice(0, -1))}>↶ Undo corner</button>
            <button type="button" disabled={draft.length < 3} onClick={() => finishOutline(draft)}>✓ Finish shape</button>
          </>
        )}
        {(redrawing || draft.length > 0) && (
          <button type="button" className="link-button" onClick={() => { setRedrawing(null); setDraft([]); }}>Cancel</button>
        )}
      </div>
      <p className="hint">
        {mode === 'box'
          ? 'Drag across a room on the plan to mark it. For an L-shaped room or the yard, use 📐 and tap each corner.'
          : 'Tap each corner of the room in order, then tap the first corner again (or ✓ Finish shape).'}
      </p>

      <FloorplanStage plan={plan} tasks={[]} spots={[]} big={big} showWalkers={false} selectedRoomId={selectedId} onRoomClick={pending || draft.length || box ? undefined : (r) => setSelectedId(r.id === selectedId ? null : r.id)}>
        <div
          ref={stage}
          className={`fp-editor__layer ${selectedId && !redrawing ? 'fp-editor__layer--passive' : ''}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => setBox(null)}
        >
          <svg viewBox="0 0 1 1" preserveAspectRatio="none">
            {outline.length > 1 && (
              <polygon
                points={outline.map((p) => p.join(',')).join(' ')}
                className={`fp-editor__draft ${pending || box ? 'fp-editor__draft--closed' : ''}`}
                style={{ fillOpacity: pending || box ? 0.25 : 0 }}
              />
            )}
            {!box && !pending && draft.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={0.006} className="fp-editor__corner" />)}
          </svg>
        </div>
      </FloorplanStage>

      {pending && (
        <div className="fp-editor__name">
          <label className="member-form__label member-form__label--inline">
            Room name
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} list="fp-room-suggestions" />
          </label>
          <datalist id="fp-room-suggestions">
            {ROOM_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button
            type="button"
            disabled={busy || !newName.trim()}
            onClick={async () => {
              const points = pending;
              setPending(null);
              await act(() => api.post(`/floorplans/${plan.id}/rooms`, { name: newName.trim(), points }));
            }}
          >
            Save room
          </button>
          <button type="button" className="secondary" onClick={() => setPending(null)}>Cancel</button>
          <div className="fp-editor__suggest">
            {ROOM_SUGGESTIONS.filter((s) => !plan.rooms.some((r) => r.name === s)).slice(0, 10).map((s) => (
              <button key={s} type="button" className="secondary" onClick={() => setNewName(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {selected && !pending && (
        <div className="fp-editor__room" style={{ borderLeftColor: selected.color }}>
          <label className="member-form__label member-form__label--inline">
            Room
            <input value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={60} />
          </label>
          <button type="button" className="secondary" disabled={busy || !roomName.trim() || roomName.trim() === selected.name} onClick={() => act(() => api.patch(`/floorplans/rooms/${selected.id}`, { name: roomName.trim() }))}>
            Rename
          </button>
          <span className="fp-editor__colors">
            {['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f'].map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                className={`fp-editor__color ${selected.color === c ? 'fp-editor__color--on' : ''}`}
                style={{ background: c }}
                onClick={() => act(() => api.patch(`/floorplans/rooms/${selected.id}`, { color: c }))}
              />
            ))}
          </span>
          <button type="button" className="secondary" onClick={() => { setRedrawing(selected.id); setSelectedId(null); }}>
            📐 Redraw
          </button>
          <ConfirmButton
            label="🗑️ Delete room"
            confirmLabel={`Delete "${selected.name}"? (Its jobs stay, just without a room.)`}
            onConfirm={() => {
              setSelectedId(null);
              return act(() => api.delete(`/floorplans/rooms/${selected.id}`));
            }}
            className="secondary"
          />
        </div>
      )}
      {plan.rooms.length > 0 && !selected && !pending && <p className="hint">Tap a room's name to rename, recolor, redraw or delete it.</p>}
    </div>
  );
}
