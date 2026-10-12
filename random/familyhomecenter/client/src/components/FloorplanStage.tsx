import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { FamilyMember, Floorplan, FloorplanRoom, Task } from '../api/client.js';
import { floorplanImage, roomCenter } from '../utils/floorplans.js';
import { isTaskDoneByAll, isTaskDoneFor, sortForColumn } from '../utils/tasks.js';
import { taskIcon } from '../utils/taskIcons.js';
import { MemberAvatar } from './MemberAvatar.js';

/**
 * One floor plan with its rooms outlined and labeled (how many jobs are left in each), and each
 * person's avatar standing in the room of their next unfinished chore/to-do — when they check it
 * off, they walk to the next one. Flat, or tilted into a 3-D "dollhouse" view with the avatars
 * standing up in it.
 */

/** How long a walk from one room to the next takes. */
const WALK_MS = 2200;
/** The 3-D view's tilt. */
const TILT_DEG = 52;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

export interface WalkerSpot {
  member: FamilyMember;
  planId: string;
  room: FloorplanRoom;
  task: Task;
  /** Where they stand: the job's exact spot (dragged there), else a spot in the middle of the room. */
  at: [number, number];
  /** Where their jobs after this one are, in order (repeats of the same place dropped), on any plan. */
  route: Array<{ planId: string; room: FloorplanRoom; at: [number, number] }>;
}

/**
 * Where everyone should be: the room of each person's next unfinished job that has a room (in
 * the order their list shows them — chores first, then by time of day). Nobody with nothing left
 * in a room has a spot.
 */
export function walkerSpots(tasks: Task[], members: FamilyMember[], plans: Floorplan[], threeD = false): WalkerSpot[] {
  const rooms = new Map<string, { planId: string; room: FloorplanRoom }>();
  for (const p of plans) for (const r of p.rooms) rooms.set(r.id, { planId: p.id, room: r });
  const spots: WalkerSpot[] = [];
  for (const member of members) {
    const located = sortForColumn(tasks.filter((t) => t.assignee_ids.includes(member.id) && !isTaskDoneFor(t, member.id))).filter(
      (t) => t.room_id && rooms.has(t.room_id)
    );
    const next = located[0];
    if (!next) continue;
    const where = (t: Task) => {
      const r = rooms.get(t.room_id!)!;
      return { ...r, at: jobSpot(t, r.room, threeD) };
    };
    const route: WalkerSpot['route'] = [];
    let last = where(next).at.join();
    for (const t of located.slice(1)) {
      const w = where(t);
      if (w.at.join() === last) continue;
      route.push(w);
      last = w.at.join();
    }
    spots.push({ member, task: next, route, ...where(next) });
  }
  return spots;
}

/** Jobs left in a room today (each counted once, however many people it's on). */
export function openInRoom(tasks: Task[], roomId: string): Task[] {
  return tasks.filter((t) => t.room_id === roomId && !isTaskDoneByAll(t));
}

/** A room's top and bottom edges (0–1 down the plan). */
function roomSpan(room: FloorplanRoom): [number, number] {
  const ys = room.points.map((p) => p[1]);
  return [Math.min(...ys), Math.max(...ys)];
}

/** The room's name sits a little above its middle, leaving room below for people to stand… */
function labelSpot(room: FloorplanRoom, threeD: boolean): [number, number] {
  const [cx, cy] = roomCenter(room);
  const [top, bottom] = roomSpan(room);
  return [cx, Math.max(top + (bottom - top) * 0.2, cy - (bottom - top) * (threeD ? 0.22 : 0.14))];
}

/** …and people stand (their feet) below it — farther down when tilted, since they stand up tall. */
function standSpot(room: FloorplanRoom, threeD: boolean): [number, number] {
  const [cx, cy] = roomCenter(room);
  const [top, bottom] = roomSpan(room);
  return [cx, Math.min(bottom - (bottom - top) * 0.06, cy + (bottom - top) * (threeD ? 0.32 : 0.24))];
}

/** Where a job is on the plan: its exact spot, or (put in a room from the form) the room's middle. */
export function jobSpot(task: Pick<Task, 'room_x' | 'room_y'>, room: FloorplanRoom, threeD = false): [number, number] {
  return task.room_x != null && task.room_y != null ? [task.room_x, task.room_y] : standSpot(room, threeD);
}

/**
 * A person's route as a dotted trail in their color: from where they stand, through each next
 * room on this plan in order, gently curved so trails between the same rooms don't sit on top of
 * each other, with a dot at each stop. A stop on another floor ends the trail there.
 */
function WalkPath({ spot, planId }: { spot: WalkerSpot; planId: string }) {
  const stops: Array<[number, number]> = [spot.at];
  for (const r of spot.route) {
    if (r.planId !== planId) break;
    stops.push(r.at);
  }
  if (stops.length < 2) return null;
  // Bend each leg a little to one side, by an amount that differs per person.
  const bend = 0.06 + (parseInt(spot.member.id.replace(/[^0-9a-f]/gi, '').slice(-2) || '0', 16) % 5) * 0.025;
  let d = `M ${stops[0][0]} ${stops[0][1]}`;
  const heads: Array<{ x: number; y: number }> = [];
  for (let i = 1; i < stops.length; i++) {
    const [x1, y1] = stops[i - 1];
    const [x2, y2] = stops[i];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const cx = (x1 + x2) / 2 - ((y2 - y1) / len) * len * bend;
    const cy = (y1 + y2) / 2 + ((x2 - x1) / len) * len * bend;
    d += ` Q ${cx} ${cy} ${x2} ${y2}`;
    heads.push({ x: x2, y: y2 });
  }
  return (
    <g className="fp-path" style={{ color: spot.member.color }}>
      <path d={d} className="fp-path__trail" />
      {heads.map((h, i) => (
        <circle key={i} cx={h.x} cy={h.y} r={0.007} className="fp-path__stop" />
      ))}
    </g>
  );
}

function Walker({ spot, x, y, dx, threeD, onClick }: { spot: WalkerSpot; x: number; y: number; dx: number; threeD: boolean; onClick?: () => void }) {
  const [walking, setWalking] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = { x, y };
    if (!prev || (Math.abs(prev.x - x) < 0.001 && Math.abs(prev.y - y) < 0.001)) return;
    setWalking(true);
    const t = setTimeout(() => setWalking(false), WALK_MS);
    return () => clearTimeout(t);
  }, [x, y]);
  return (
    <button
      type="button"
      className={`fp-walker ${walking ? 'fp-walker--walking' : ''} ${threeD ? 'fp-walker--3d' : ''}`}
      onClick={onClick}
      aria-label={`${spot.member.name}: next is ${spot.task.title}`}
      style={{ left: `calc(${x * 100}% + ${dx}px)`, top: `${y * 100}%`, transitionDuration: `${WALK_MS}ms`, ['--tilt' as string]: `${-TILT_DEG}deg` }}
      title={`${spot.member.name}: ${spot.task.title} (${spot.room.name})`}
    >
      <div className="fp-walker__shadow" />
      <div className="fp-walker__body" style={{ borderColor: spot.member.color }}>
        <MemberAvatar member={spot.member} size={threeD ? 54 : 44} />
        {/* What they're on: smaller than them, so it's still clearly them. */}
        <span className="fp-walker__job" aria-hidden="true">{taskIcon(spot.task)}</span>
      </div>
      <div className="fp-walker__name" style={{ background: spot.member.color }}>
        {spot.member.name}
      </div>
    </button>
  );
}

export function FloorplanStage({
  plan,
  tasks,
  spots,
  threeD = false,
  showPaths = false,
  selectedRoomId,
  onRoomClick,
  showWalkers = true,
  onWalkerClick,
  pins = [],
  big = false,
  hidePinIds,
  onPinPointerDown,
  onPinClick,
  children,
}: {
  plan: Floorplan;
  tasks: Task[];
  spots: WalkerSpot[];
  threeD?: boolean;
  /** 👣 Each person's walking route through the rooms of their next jobs. */
  showPaths?: boolean;
  selectedRoomId?: string | null;
  onRoomClick?: (room: FloorplanRoom) => void;
  showWalkers?: boolean;
  onWalkerClick?: (spot: WalkerSpot) => void;
  /** Full screen: let the plan use (nearly) all of the screen's height. */
  big?: boolean;
  /** Jobs to show as emoji pins where they are (any of them on this plan). */
  pins?: Task[];
  /** Pins not to show — a job someone is standing on already shows on them. */
  hidePinIds?: Set<string>;
  /** Pressing a pin — the placer starts dragging it to move it. */
  onPinPointerDown?: (task: Task, e: ReactPointerEvent) => void;
  onPinClick?: (task: Task) => void;
  /** Drawn over the plan (inside the tilt) — the editor's drawing layer. */
  children?: ReactNode;
}) {
  const aspect = plan.width / plan.height;
  // Tilted back, the plan takes up much less height than it did flat — measure it so the page
  // doesn't keep a big empty gap where its top used to be.
  const plane = useRef<HTMLDivElement>(null);
  const [planeHeight, setPlaneHeight] = useState(0);
  useLayoutEffect(() => {
    const el = plane.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPlaneHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const here = spots.filter((s) => s.planId === plan.id);
  // People at the same spot stand side by side instead of on top of each other.
  const byPlace = new Map<string, WalkerSpot[]>();
  for (const s of here) byPlace.set(s.at.join(), [...(byPlace.get(s.at.join()) ?? []), s]);
  const roomsById = new Map(plan.rooms.map((r) => [r.id, r]));
  const shownPins = pins.filter((t) => t.room_id && roomsById.has(t.room_id) && !hidePinIds?.has(t.id));
  // Jobs put in a room without an exact spot line up in a row at its middle.
  const rowIndex = new Map<string, { i: number; n: number }>();
  for (const r of plan.rooms) {
    const row = shownPins.filter((t) => t.room_id === r.id && t.room_x == null);
    row.forEach((t, i) => rowIndex.set(t.id, { i, n: row.length }));
  }

  // ---- Zoom (flat only): ＋/−, Ctrl+wheel or a trackpad pinch, two-finger pinch on a touchscreen ----
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoomState] = useState(1);
  const zoomRef = useRef(1);
  // The point (in the scroller, px) to keep still while zooming, and where it was on the plan (0–1).
  const anchor = useRef<{ px: number; py: number; fx: number; fy: number } | null>(null);
  const setZoom = (z: number, at?: { clientX: number; clientY: number }) => {
    const el = scroller.current;
    const p = plane.current;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    if (el && p) {
      const box = el.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      const cx = at ? at.clientX : box.left + box.width / 2;
      const cy = at ? at.clientY : box.top + box.height / 2;
      anchor.current = { px: cx - box.left, py: cy - box.top, fx: (cx - pr.left) / pr.width, fy: (cy - pr.top) / pr.height };
    }
    zoomRef.current = next;
    setZoomState(next);
  };
  useLayoutEffect(() => {
    const el = scroller.current;
    const p = plane.current;
    const a = anchor.current;
    anchor.current = null;
    if (!el || !p || !a) return;
    el.scrollLeft = p.offsetLeft + a.fx * p.offsetWidth - a.px;
    el.scrollTop = p.offsetTop + a.fy * p.offsetHeight - a.py;
  }, [zoom]);
  useEffect(() => {
    zoomRef.current = 1;
    setZoomState(1);
  }, [plan.id, threeD]);
  useEffect(() => {
    const el = scroller.current;
    if (!el || threeD) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // plain scrolling still scrolls; Ctrl+wheel (and trackpad pinches) zoom
      e.preventDefault();
      setZoom(zoomRef.current * Math.exp(-e.deltaY * 0.01), e);
    };
    let pinch: { d: number; z: number; mx: number; my: number } | null = null;
    const two = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 };
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t = two(e);
        pinch = { d: t.d, z: zoomRef.current, mx: t.mx, my: t.my };
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const t = two(e);
      // Two fingers also pan.
      el.scrollLeft -= t.mx - pinch.mx;
      el.scrollTop -= t.my - pinch.my;
      pinch.mx = t.mx;
      pinch.my = t.my;
      setZoom(pinch.z * (t.d / (pinch.d || 1)), { clientX: t.mx, clientY: t.my });
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threeD]);

  return (
    <div className="fp-stage-wrap">
      {!threeD && (
        <div className="fp-zoom" aria-label="Zoom">
          <button type="button" className="secondary" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom(zoom / 1.5)}>−</button>
          <span className="fp-zoom__level">{Math.round(zoom * 100)}%</span>
          <button type="button" className="secondary" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom(zoom * 1.5)}>＋</button>
          {zoom > 1 && <button type="button" className="secondary" onClick={() => setZoom(1)}>Fit</button>}
        </div>
      )}
    <div
      ref={scroller}
      className={`fp-stage ${threeD ? 'fp-stage--3d' : 'fp-stage--flat'} ${zoom > 1 ? 'fp-stage--zoomed' : ''}`}
      style={threeD && planeHeight ? { marginTop: -planeHeight * 0.3 } : undefined}
    >
      <div
        ref={plane}
        className="fp-stage__plane"
        style={{
          aspectRatio: aspect,
          // As wide as fits, but not taller than most of the screen — times the zoom.
          width: `calc(min(100%, ${((threeD ? (big ? 120 : 95) : big ? 76 : 70) * aspect).toFixed(2)}vh) * ${zoom})`,
          maxWidth: zoom > 1 ? 'none' : undefined,
          ['--tilt' as string]: `${TILT_DEG}deg`,
        }}
      >
        <img className="fp-stage__img" src={floorplanImage(plan)} alt={plan.name} draggable={false} />
        <svg className="fp-stage__rooms" viewBox="0 0 1 1" preserveAspectRatio="none">
          {plan.rooms.map((r) => {
            const open = openInRoom(tasks, r.id).length;
            const any = tasks.some((t) => t.room_id === r.id);
            return (
              <polygon
                key={r.id}
                points={r.points.map((p) => p.join(',')).join(' ')}
                className={`fp-room ${selectedRoomId === r.id ? 'fp-room--selected' : ''} ${onRoomClick ? 'fp-room--clickable' : ''}`}
                style={{ fill: r.color, fillOpacity: open ? 0.32 : any ? 0.12 : 0.06, stroke: r.color }}
                onClick={onRoomClick ? () => onRoomClick(r) : undefined}
              />
            );
          })}
          {showPaths && showWalkers && here.map((s) => <WalkPath key={s.member.id} spot={s} planId={plan.id} />)}
        </svg>
        {plan.rooms.map((r) => {
          const [cx, cy] = labelSpot(r, threeD);
          const open = openInRoom(tasks, r.id).length;
          const done = !open && tasks.some((t) => t.room_id === r.id);
          return (
            <button
              key={r.id}
              type="button"
              className={`fp-label ${threeD ? 'fp-label--3d' : ''} ${selectedRoomId === r.id ? 'fp-label--selected' : ''}`}
              style={{ left: `${cx * 100}%`, top: `${cy * 100}%`, borderColor: r.color }}
              onClick={onRoomClick ? () => onRoomClick(r) : undefined}
              tabIndex={onRoomClick ? 0 : -1}
            >
              {r.name}
              {open > 0 && <span className="fp-label__count" style={{ background: r.color }}>{open}</span>}
              {done && <span className="fp-label__done">✓</span>}
            </button>
          );
        })}
        {shownPins.map((t) => {
          const room = roomsById.get(t.room_id!)!;
          const [x, y] = jobSpot(t, room, threeD);
          const row = rowIndex.get(t.id);
          const dx = row ? (row.i - (row.n - 1) / 2) * 30 : 0;
          return (
            <button
              key={t.id}
              type="button"
              className={`fp-pin ${isTaskDoneByAll(t) ? 'fp-pin--done' : ''} ${onPinPointerDown ? 'fp-pin--movable' : ''} ${threeD ? 'fp-pin--3d' : ''}`}
              style={{ left: `calc(${x * 100}% + ${dx}px)`, top: `${y * 100}%`, ['--tilt' as string]: `${-TILT_DEG}deg` }}
              title={`${t.title} (${room.name})`}
              aria-label={`${t.title} in ${room.name}`}
              onPointerDown={onPinPointerDown ? (e) => onPinPointerDown(t, e) : undefined}
              onClick={onPinClick ? () => onPinClick(t) : undefined}
            >
              <span className="fp-pin__icon">{taskIcon(t)}</span>
            </button>
          );
        })}
        {showWalkers &&
          here.map((s) => {
            const group = byPlace.get(s.at.join())!;
            const i = group.indexOf(s);
            const [cx, y] = s.at;
            // Side by side, a body's width apart.
            const dx = (i - (group.length - 1) / 2) * (threeD ? 66 : 58);
            return <Walker key={s.member.id} spot={s} x={cx} y={y} dx={dx} threeD={threeD} onClick={onWalkerClick ? () => onWalkerClick(s) : undefined} />;
          })}
        {children}
      </div>
    </div>
    </div>
  );
}
