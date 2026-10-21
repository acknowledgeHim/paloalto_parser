import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { FamilyMember, Floorplan, FloorplanRoom, Task } from '../api/client.js';
import { floorplanImage, roomCenter } from '../utils/floorplans.js';
import { isTaskDoneByAll, isTaskDoneFor, sortForColumn } from '../utils/tasks.js';
import { taskIcon } from '../utils/taskIcons.js';
import { DressedAvatar } from './DressedAvatar.js';
import type { Sky } from '../utils/daylight.js';

/**
 * One floor plan with its rooms outlined and labeled (how many jobs are left in each), and each
 * person's avatar standing in the room of their next unfinished chore/to-do — when they check it
 * off, they walk to the next one. Flat, or tilted into a 3-D "dollhouse" view with the avatars
 * standing up in it.
 */

/** The 3-D view's tilt. */
const TILT_DEG = 52;
/** Never smaller than fitting the screen. */
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
    const located = sortForColumn(tasks.filter((t) => t.assignee_ids.includes(member.id) && !isTaskDoneFor(t, member.id)), member.id).filter(
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

/** How much a person's walking legs bend to one side — a little different per person. */
export function bendFor(memberId: string): number {
  return 0.06 + (parseInt(memberId.replace(/[^0-9a-f]/gi, '').slice(-2) || '0', 16) % 5) * 0.025;
}

/** The curve's control point for one leg of a walk (a quadratic Bézier from `a` to `b`). */
export function legControl([x1, y1]: [number, number], [x2, y2]: [number, number], bend: number): [number, number] {
  return [(x1 + x2) / 2 - (y2 - y1) * bend, (y1 + y2) / 2 + (x2 - x1) * bend];
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
  const bend = bendFor(spot.member.id);
  let d = `M ${stops[0][0]} ${stops[0][1]}`;
  const heads: Array<{ x: number; y: number }> = [];
  for (let i = 1; i < stops.length; i++) {
    const [cx, cy] = legControl(stops[i - 1], stops[i], bend);
    d += ` Q ${cx} ${cy} ${stops[i][0]} ${stops[i][1]}`;
    heads.push({ x: stops[i][0], y: stops[i][1] });
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

/** The little dance when the next job is right where they already are: spin around, bounce twice. */
const SPIN_MS = 1400;

/**
 * A person standing at their job. When the job changes they walk there along the same curve the
 * 👣 path draws (bobbing as they go); if the next job is in the same spot, they spin and bounce.
 */
function Walker({ spot, x, y, dx, threeD, scale, onClick }: { spot: WalkerSpot; x: number; y: number; dx: number; threeD: boolean; scale: number; onClick?: () => void }) {
  const [pos, setPos] = useState<[number, number]>([x, y]);
  const posRef = useRef<[number, number]>([x, y]);
  const [walking, setWalking] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const lastTask = useRef(spot.task.id);

  useEffect(() => {
    const from = posRef.current;
    const to: [number, number] = [x, y];
    const moved = Math.hypot(to[0] - from[0], to[1] - from[1]) > 0.001;
    const newJob = lastTask.current !== spot.task.id;
    lastTask.current = spot.task.id;
    if (!moved) {
      if (!newJob) return;
      setSpinning(true);
      const t = setTimeout(() => setSpinning(false), SPIN_MS);
      return () => clearTimeout(t);
    }
    // Walk the curve: a quadratic Bézier from where they are to the new spot, eased in and out.
    const ctrl = legControl(from, to, bendFor(spot.member.id));
    const ms = Math.min(3200, Math.max(1200, Math.hypot(to[0] - from[0], to[1] - from[1]) * 5000));
    const start = performance.now();
    let frame = 0;
    setWalking(true);
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const t = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      const u = 1 - t;
      const next: [number, number] = [
        u * u * from[0] + 2 * u * t * ctrl[0] + t * t * to[0],
        u * u * from[1] + 2 * u * t * ctrl[1] + t * t * to[1],
      ];
      posRef.current = next;
      setPos(next);
      if (p < 1) frame = requestAnimationFrame(step);
      else setWalking(false);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      setWalking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, spot.task.id]);

  return (
    <button
      type="button"
      className={`fp-walker ${walking ? 'fp-walker--walking' : ''} ${spinning ? 'fp-walker--spin' : ''} ${threeD ? 'fp-walker--3d' : ''}`}
      onClick={onClick}
      aria-label={`${spot.member.name}: next is ${spot.task.title}`}
      style={{ left: `calc(${pos[0] * 100}% + ${dx}px)`, top: `${pos[1] * 100}%`, ['--tilt' as string]: `${-TILT_DEG}deg` }}
      title={`${spot.member.name}: ${spot.task.title} (${spot.room.name})`}
    >
      <div className="fp-walker__shadow" />
      <div className="fp-walker__body" style={{ borderColor: spot.member.color }}>
        <DressedAvatar member={spot.member} size={Math.round((threeD ? 54 : 44) * scale)} />
        {/* What they're on: smaller than them, so it's still clearly them. */}
        <span className="fp-walker__job" aria-hidden="true">{taskIcon(spot.task)}</span>
      </div>
      <div className="fp-walker__name" style={{ background: spot.member.color }}>
        {spot.member.name}
      </div>
    </button>
  );
}

/** A made-up but steady "random" 0–1 for the i-th raindrop, so they don't jump on every render. */
const scatter = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * 🌗 The plan at this time of day: a warm dawn, a pink dusk and a dark night — where rooms with
 * jobs still left glow with their lights on — plus rain, snow, a storm or fog from the weather.
 */
function SkyLayer({ sky, plan, tasks }: { sky: Sky; plan: Floorplan; tasks: Task[] }) {
  const lit = sky.phase === 'day' ? [] : plan.rooms.filter((r) => openInRoom(tasks, r.id).length > 0);
  const falling = sky.weather === 'rain' || sky.weather === 'storm' ? 70 : sky.weather === 'snow' ? 45 : 0;
  return (
    <>
      <div className={`fp-sky fp-sky--${sky.phase}`} aria-hidden="true" />
      {lit.length > 0 && (
        <svg className="fp-sky__lights" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id="fp-lamp-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.012" />
            </filter>
          </defs>
          {lit.map((r) => (
            <polygon key={r.id} points={r.points.map((p) => p.join(',')).join(' ')} className="fp-sky__lamp" filter="url(#fp-lamp-glow)" />
          ))}
        </svg>
      )}
      {falling > 0 && (
        <div className={`fp-weather fp-weather--${sky.weather}`} aria-hidden="true">
          {Array.from({ length: falling }, (_, i) => (
            <span
              key={i}
              className="fp-weather__drop"
              style={{
                left: `${scatter(i, 1) * 100}%`,
                animationDelay: `${-scatter(i, 2) * 3}s`,
                animationDuration: `${sky.weather === 'snow' ? 5 + scatter(i, 3) * 4 : 0.7 + scatter(i, 3) * 0.5}s`,
              }}
            >
              {sky.weather === 'snow' ? '❄' : ''}
            </span>
          ))}
        </div>
      )}
      {sky.weather === 'storm' && <div className="fp-weather__flash" aria-hidden="true" />}
      {sky.weather === 'fog' && <div className="fp-weather__fog" aria-hidden="true" />}
    </>
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
  sky,
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
  /** 🌗 Time of day and weather to show on the plan. */
  sky?: Sky;
  /** Drawn over the plan (inside the tilt) — the editor's drawing layer. */
  children?: ReactNode;
}) {
  const aspect = plan.width / plan.height;
  const avatarScale = plan.avatar_scale ?? 1;
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
    // Each plan starts at its own zoom (set in ✏️ Edit plans), or fitting the screen.
    const start = threeD ? 1 : Math.max(MIN_ZOOM, plan.default_zoom ?? 1);
    zoomRef.current = start;
    setZoomState(start);
  }, [plan.id, threeD, plan.default_zoom]);
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
          width: `calc(min(100%, ${((threeD ? (big ? 135 : 95) : big ? 96 : 70) * aspect).toFixed(2)}vh) * ${zoom})`,
          maxWidth: zoom > 1 ? 'none' : undefined,
          ['--tilt' as string]: `${TILT_DEG}deg`,
          ['--label-scale' as string]: String(plan.label_scale ?? 1),
          ['--avatar-scale' as string]: String(avatarScale),
          ['--job-scale' as string]: String(plan.job_scale ?? 1),
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
        {sky && <SkyLayer sky={sky} plan={plan} tasks={tasks} />}
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
          const dx = row ? (row.i - (row.n - 1) / 2) * 30 * (plan.job_scale ?? 1) : 0;
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
            const dx = (i - (group.length - 1) / 2) * (threeD ? 66 : 58) * avatarScale;
            return <Walker key={s.member.id} spot={s} x={cx} y={y} dx={dx} threeD={threeD} scale={avatarScale} onClick={onWalkerClick ? () => onWalkerClick(s) : undefined} />;
          })}
        {children}
      </div>
    </div>
    </div>
  );
}
