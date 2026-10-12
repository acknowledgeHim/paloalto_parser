import { useEffect, useState } from 'react';
import { api, type FamilyMember, type Floorplan, type FloorplanRoom, type Task } from '../api/client.js';

/**
 * The floor plans, fetched once and shared — every task card shows its room's name, and a page of
 * them shouldn't each ask the server. Call refreshFloorplans() after changing plans or rooms.
 */
let cache: Promise<Floorplan[]> | null = null;
const listeners = new Set<(plans: Floorplan[]) => void>();

function load(): Promise<Floorplan[]> {
  if (!cache) {
    cache = api.get<Floorplan[]>('/floorplans');
    cache.then((plans) => listeners.forEach((l) => l(plans))).catch(() => {
      cache = null;
    });
  }
  return cache;
}

export function refreshFloorplans(): Promise<Floorplan[]> {
  cache = null;
  return load();
}

export function useFloorplans(): Floorplan[] | null {
  const [plans, setPlans] = useState<Floorplan[] | null>(null);
  useEffect(() => {
    listeners.add(setPlans);
    load().then(setPlans).catch(() => setPlans([]));
    return () => {
      listeners.delete(setPlans);
    };
  }, []);
  return plans;
}

export function findRoom(plans: Floorplan[] | null, roomId: string | null | undefined): { plan: Floorplan; room: FloorplanRoom } | null {
  if (!plans || !roomId) return null;
  for (const plan of plans) {
    const room = plan.rooms.find((r) => r.id === roomId);
    if (room) return { plan, room };
  }
  return null;
}

/** The plan's picture — its URL changes when the picture is replaced, so browsers don't keep the old one. */
export const floorplanImage = (plan: Floorplan) => `/api/floorplans/${plan.id}/image?v=${encodeURIComponent(plan.updated_at)}`;

/** Where to put a room's label: the middle of its outline (the average of its corners). */
export function roomCenter(room: FloorplanRoom): [number, number] {
  const n = room.points.length;
  return [room.points.reduce((s, p) => s + p[0], 0) / n, room.points.reduce((s, p) => s + p[1], 0) / n];
}

/** Whether a point (0–1 across/down the plan) is inside a room's outline. */
export function pointInRoom([x, y]: [number, number], room: FloorplanRoom): boolean {
  let inside = false;
  const pts = room.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The room a point is in (the smallest, if outlines overlap — a closet drawn inside a bedroom). */
export function roomAt(plan: Floorplan, pt: [number, number]): FloorplanRoom | null {
  const area = (r: FloorplanRoom) => {
    let a = 0;
    r.points.forEach((p, i) => {
      const q = r.points[(i + 1) % r.points.length];
      a += p[0] * q[1] - q[0] * p[1];
    });
    return Math.abs(a / 2);
  };
  return plan.rooms.filter((r) => pointInRoom(pt, r)).sort((a, b) => area(a) - area(b))[0] ?? null;
}

/**
 * Who may put a chore/to-do on the floor plan (or move it, or take it off): a parent (or anyone,
 * while no one in the family is a parent), or a kid a parent has allowed, for their own jobs. The
 * server checks the same once parents have passwords (routes/tasks.ts's mayPlace).
 */
export function canPlaceTask(task: Pick<Task, 'assignee_ids'> | null, me: FamilyMember | null, members: FamilyMember[]): boolean {
  if (me?.is_parent === 1 || members.every((m) => m.is_parent !== 1)) return true;
  if (!me || me.can_place_tasks !== 1) return false;
  return task === null || task.assignee_ids.includes(me.id);
}
