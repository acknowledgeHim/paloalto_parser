import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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

export interface WalkerSpot {
  member: FamilyMember;
  planId: string;
  room: FloorplanRoom;
  task: Task;
  /** The rooms of their jobs after this one, in order (repeats of the same room dropped), on any plan. */
  route: Array<{ planId: string; room: FloorplanRoom }>;
}

/**
 * Where everyone should be: the room of each person's next unfinished job that has a room (in
 * the order their list shows them — chores first, then by time of day). Nobody with nothing left
 * in a room has a spot.
 */
export function walkerSpots(tasks: Task[], members: FamilyMember[], plans: Floorplan[]): WalkerSpot[] {
  const rooms = new Map<string, { planId: string; room: FloorplanRoom }>();
  for (const p of plans) for (const r of p.rooms) rooms.set(r.id, { planId: p.id, room: r });
  const spots: WalkerSpot[] = [];
  for (const member of members) {
    const located = sortForColumn(tasks.filter((t) => t.assignee_ids.includes(member.id) && !isTaskDoneFor(t, member.id))).filter(
      (t) => t.room_id && rooms.has(t.room_id)
    );
    const next = located[0];
    if (!next) continue;
    const route: WalkerSpot['route'] = [];
    let last = next.room_id;
    for (const t of located.slice(1)) {
      if (t.room_id === last) continue;
      route.push(rooms.get(t.room_id!)!);
      last = t.room_id;
    }
    spots.push({ member, task: next, route, ...rooms.get(next.room_id!)! });
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

/**
 * A person's route as a dotted trail in their color: from where they stand, through each next
 * room on this plan in order, gently curved so trails between the same rooms don't sit on top of
 * each other, with a dot at each stop. A stop on another floor ends the trail there.
 */
function WalkPath({ spot, planId, threeD }: { spot: WalkerSpot; planId: string; threeD: boolean }) {
  const stops: Array<[number, number]> = [standSpot(spot.room, threeD)];
  for (const r of spot.route) {
    if (r.planId !== planId) break;
    stops.push(standSpot(r.room, threeD));
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
  // People in the same room stand side by side instead of on top of each other.
  const byRoom = new Map<string, WalkerSpot[]>();
  for (const s of here) byRoom.set(s.room.id, [...(byRoom.get(s.room.id) ?? []), s]);

  return (
    <div
      className={`fp-stage ${threeD ? 'fp-stage--3d' : ''}`}
      style={threeD && planeHeight ? { marginTop: -planeHeight * 0.3 } : undefined}
    >
      <div
        ref={plane}
        className="fp-stage__plane"
        style={{
          aspectRatio: aspect,
          // As wide as fits, but not taller than most of the screen.
          width: `min(100%, ${((threeD ? 95 : 70) * aspect).toFixed(2)}vh)`,
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
          {showPaths && showWalkers && here.map((s) => <WalkPath key={s.member.id} spot={s} planId={plan.id} threeD={threeD} />)}
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
        {showWalkers &&
          here.map((s) => {
            const group = byRoom.get(s.room.id)!;
            const i = group.indexOf(s);
            const [cx, y] = standSpot(s.room, threeD);
            // Side by side, a body's width apart.
            const dx = (i - (group.length - 1) / 2) * (threeD ? 66 : 58);
            return <Walker key={s.member.id} spot={s} x={cx} y={y} dx={dx} threeD={threeD} onClick={onWalkerClick ? () => onWalkerClick(s) : undefined} />;
          })}
        {children}
      </div>
    </div>
  );
}
