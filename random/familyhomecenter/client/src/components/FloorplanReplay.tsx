import { useEffect, useRef, useState } from 'react';
import type { FamilyMember, Floorplan, FloorplanRoom, Task } from '../api/client.js';
import { taskIcon } from '../utils/taskIcons.js';
import { localDate } from '../utils/daylight.js';
import { bendFor, jobSpot, legControl } from './FloorplanStage.js';
import { DressedAvatar } from './DressedAvatar.js';

/**
 * ▶️ Replay today: everyone's check-offs in the order they happened, played back on the floor
 * plan — each person walks from job to job, with a ✓ popping up as each one is done, and the
 * clock running through the day.
 */

export interface ReplayEvent {
  member: FamilyMember;
  task: Task;
  planId: string;
  room: FloorplanRoom;
  at: [number, number];
  /** When it was checked off. */
  time: number;
  /** Its turn in the replay (ms from the start). */
  t: number;
}

/** How long one check-off takes in the replay (shorter when there are lots). */
export const stepFor = (n: number) => Math.max(650, Math.min(1700, 30_000 / Math.max(1, n)));
/** A beat before the first one, and the summary after the last. */
export const LEAD_MS = 900;
export const TAIL_MS = 2500;

export function replayEvents(tasks: Task[], members: FamilyMember[], plans: Floorplan[], threeD: boolean): ReplayEvent[] {
  const today = localDate();
  const rooms = new Map<string, { planId: string; room: FloorplanRoom }>();
  for (const p of plans) for (const r of p.rooms) rooms.set(r.id, { planId: p.id, room: r });
  const list: Omit<ReplayEvent, 't'>[] = [];
  for (const task of tasks) {
    const where = task.room_id ? rooms.get(task.room_id) : undefined;
    if (!where) continue;
    for (const c of task.completions) {
      const member = members.find((m) => m.id === c.completed_by_id);
      if (!member || c.completed_on !== today) continue;
      list.push({ member, task, ...where, at: jobSpot(task, where.room, threeD), time: Date.parse(c.completed_at) });
    }
  }
  list.sort((a, b) => a.time - b.time);
  const step = stepFor(list.length);
  return list.map((e, i) => ({ ...e, t: LEAD_MS + i * step }));
}

export function replayLength(events: ReplayEvent[]): number {
  return events.length ? events[events.length - 1].t + TAIL_MS : 0;
}

/** The replay's clock: ms since it started, while it's playing. */
export function useReplayClock(playing: boolean, length: number, onEnd: () => void): number {
  const [t, setT] = useState(0);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    if (!playing) {
      setT(0);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const el = now - start;
      setT(el);
      if (el < length) frame = requestAnimationFrame(tick);
      else end.current();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, length]);
  return t;
}

/** The time of day the replay has reached, for the clock. */
export function replayTimeOfDay(events: ReplayEvent[], t: number): number | null {
  if (!events.length) return null;
  if (t <= events[0].t) return events[0].time;
  for (let i = 1; i < events.length; i++) {
    const a = events[i - 1];
    const b = events[i];
    if (t < b.t) return a.time + ((t - a.t) / (b.t - a.t)) * (b.time - a.time);
  }
  return events[events.length - 1].time;
}

/** The walkers and ✓ pops for one plan, at time t. Goes inside the FloorplanStage. */
export function ReplayLayer({ events, planId, t, threeD, scale }: { events: ReplayEvent[]; planId: string; t: number; threeD: boolean; scale: number }) {
  const people = [...new Map(events.map((e) => [e.member.id, e.member])).values()];
  const walk = Math.min(1100, stepFor(events.length) * 0.8);
  const shown: Array<{ member: FamilyMember; x: number; y: number; walking: boolean; icon: string }> = [];
  for (const member of people) {
    const mine = events.filter((e) => e.member.id === member.id);
    // Their last stop reached, and the next one.
    let k = -1;
    while (k + 1 < mine.length && mine[k + 1].t <= t) k++;
    const next = mine[k + 1];
    const prev = mine[k];
    // Not started yet: they appear at their first job a moment before it's done.
    if (!prev) {
      if (next && next.planId === planId && t > next.t - walk) shown.push({ member, x: next.at[0], y: next.at[1], walking: false, icon: taskIcon(next.task) });
      continue;
    }
    const leaving = next && t > next.t - walk;
    if (leaving && prev.planId === planId && next.planId === planId) {
      const p = Math.min(1, (t - (next.t - walk)) / walk);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      const c = legControl(prev.at, next.at, bendFor(member.id));
      const u = 1 - e;
      shown.push({
        member,
        x: u * u * prev.at[0] + 2 * u * e * c[0] + e * e * next.at[0],
        y: u * u * prev.at[1] + 2 * u * e * c[1] + e * e * next.at[1],
        walking: true,
        icon: taskIcon(next.task),
      });
    } else if (leaving && next.planId === planId) {
      shown.push({ member, x: next.at[0], y: next.at[1], walking: false, icon: taskIcon(next.task) });
    } else if (prev.planId === planId) {
      shown.push({ member, x: prev.at[0], y: prev.at[1], walking: false, icon: taskIcon(prev.task) });
    }
  }
  const pops = events.filter((e) => e.planId === planId && t >= e.t && t < e.t + 1300);
  return (
    <>
      {pops.map((e, i) => (
        <div key={`${e.task.id}-${e.member.id}-${i}`} className="fp-replay__pop" style={{ left: `${e.at[0] * 100}%`, top: `${e.at[1] * 100}%`, ['--c' as string]: e.member.color }}>
          ✓ {taskIcon(e.task)}
        </div>
      ))}
      {shown.map((s, i) => {
        const same = shown.filter((o) => Math.hypot(o.x - s.x, o.y - s.y) < 0.01);
        const dx = same.length > 1 ? (same.indexOf(s) - (same.length - 1) / 2) * 50 * scale : 0;
        return (
          <div
            key={s.member.id}
            className={`fp-walker fp-replay__walker ${s.walking ? 'fp-walker--walking' : ''} ${threeD ? 'fp-walker--3d' : ''}`}
            style={{ left: `calc(${s.x * 100}% + ${dx}px)`, top: `${s.y * 100}%`, ['--tilt' as string]: '-52deg', zIndex: 3 + i }}
          >
            <div className="fp-walker__shadow" />
            <div className="fp-walker__body" style={{ borderColor: s.member.color }}>
              <DressedAvatar member={s.member} size={Math.round((threeD ? 54 : 44) * scale)} />
              <span className="fp-walker__job" aria-hidden="true">{s.icon}</span>
            </div>
            <div className="fp-walker__name" style={{ background: s.member.color }}>{s.member.name}</div>
          </div>
        );
      })}
    </>
  );
}
