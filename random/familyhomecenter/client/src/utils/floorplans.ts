import { useEffect, useState } from 'react';
import { api, type Floorplan, type FloorplanRoom } from '../api/client.js';

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
