/**
 * 🚶🚗 Tiny Town traffic: people walking and cars driving between homes, work, shops, parks, the
 * beach… Just for looks — it never changes the town (townLogic.ts does that). No drawing here;
 * TinyTownRun.tsx draws it on a see-through layer over the map.
 *
 * People leave a home with people in it and walk to somewhere they'd go (work, a shop, a park, the
 * beach), along the road edges or across open grass and parks (not water, trees or other
 * buildings), then go inside. Cars, 🚚 trucks (from farms and factories) and a 🚌 bus (in bigger
 * towns) drive on the right of the road, over bridges too. How many there are follows how many
 * people live in town.
 */
import { BRIDGE, GRASS, W, buildingOf } from './townLogic.js';

export type AgentKind = 'walker' | 'car' | 'truck' | 'bus' | 'police' | 'fire' | 'ambulance' | 'train';
export interface Agent {
  kind: AgentKind;
  /** tiles, start to finish */
  path: number[];
  seg: number;
  /** 0–1 along path[seg] → path[seg + 1] */
  t: number;
  /** tiles a second */
  speed: number;
  /** walker: an emoji; vehicle: its colour */
  look: string;
  /** which side of the road a walker keeps to (±1) */
  side: number;
  /** what's on the last tile when it set off (gone → it stops) */
  goal: string;
  /** path positions it stops at for a moment (🚌 bus stops, 🚇 stations) */
  stops?: number[];
  /** seconds left standing at a stop */
  wait?: number;
  /** 🚨 lights on */
  lights?: boolean;
}

const isRoad = (c: string) => c === '=' || c === BRIDGE;
/** parks and the like that people walk through (no road needed, nothing inside) */
const walkThrough = (c: string) => {
  const b = buildingOf(c);
  return Boolean(b && !b.needsRoad && (b.cat === 'nature' || b.id === 'beach' || b.id === 'rainbow'));
};
const passable = (c: string) => isRoad(c) || c === GRASS || walkThrough(c);

type Place = 'home' | 'work' | 'shop' | 'fun' | 'nature' | 'service';
function placeOf(c: string): Place | null {
  const b = buildingOf(c);
  if (!b) return null;
  if (b.homes) return 'home';
  if (b.id === 'shop' || b.id === 'cafe') return 'shop';
  if (b.cat === 'nature' || b.id === 'beach' || b.id === 'rainbow') return 'nature';
  if (b.cat === 'fun' || b.cat === 'special') return 'fun';
  if (b.cat === 'service') return 'service';
  if (b.jobs) return 'work';
  return null; // ⚡💧 nobody goes there
}
const WEIGHT: Record<Place, number> = { work: 5, shop: 4, fun: 4, nature: 4, service: 2, home: 1 };

const WALKERS = ['🚶', '🚶‍♀️', '🚶‍♂️', '🧒', '🏃', '🚶', '👧', '🧓', '🐕'];
const CAR_COLOURS = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#eceff1', '#37474f', '#00acc1'];

const nbrs = (i: number, n: number) => {
  const x = i % W;
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < W - 1) out.push(i + 1);
  if (i - W >= 0) out.push(i - W);
  if (i + W < n) out.push(i + W);
  return out;
};
function pathTo(prev: Int32Array, to: number): number[] {
  const p: number[] = [];
  for (let i = to; i !== -1; i = prev[i]) p.push(i);
  return p.reverse();
}
function pick<T>(items: Array<[T, number]>, rnd: () => number): T | null {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [x, w] of items) if ((r -= w) <= 0) return x;
  return items.length ? items[items.length - 1][0] : null;
}

/** A walk from a home to somewhere nearby (roads cost less, so people keep to them). */
function walkFrom(map: string, from: number, rnd: () => number, maxCost = 50): number[] | null {
  const n = map.length;
  const dist = new Int32Array(n).fill(1 << 30);
  const prev = new Int32Array(n).fill(-1);
  const buckets: number[][] = [[from]];
  dist[from] = 0;
  const goals: Array<[number, number]> = [];
  for (let c = 0; c < buckets.length && c <= maxCost; c++) {
    const bk = buckets[c];
    if (!bk) continue;
    for (const i of bk) {
      if (dist[i] !== c) continue;
      if (i !== from) {
        const pl = placeOf(map[i]);
        if (pl && i !== from) goals.push([i, WEIGHT[pl]]);
        if (!passable(map[i])) continue; // went inside: doesn't walk on through
      }
      for (const j of nbrs(i, n)) {
        const ch = map[j];
        const w = isRoad(ch) ? 1 : ch === GRASS ? 3 : walkThrough(ch) ? 2 : placeOf(ch) ? 2 : -1;
        if (w < 0) continue;
        const nd = c + w;
        if (nd < dist[j]) {
          dist[j] = nd;
          prev[j] = i;
          (buckets[nd] ||= []).push(j);
        }
      }
    }
  }
  const to = pick(goals.filter(([g]) => dist[g] >= 3), rnd);
  return to === null ? null : pathTo(prev, to);
}

/** A drive along the roads from beside `from` to beside a building it could be going to. */
function driveFrom(map: string, from: number, rnd: () => number, want?: (p: Place, ch: string) => number): number[] | null {
  const n = map.length;
  const starts = nbrs(from, n).filter((j) => isRoad(map[j]));
  if (!starts.length) return null;
  const s = starts[Math.floor(rnd() * starts.length)];
  const prev = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  const order: number[] = [s];
  seen[s] = 1;
  for (let k = 0; k < order.length; k++)
    for (const j of nbrs(order[k], n))
      if (!seen[j] && isRoad(map[j])) {
        seen[j] = 1;
        prev[j] = order[k];
        order.push(j);
      }
  // somewhere to go: a building beside a road this one reaches, not too close
  const goals: Array<[number, number]> = [];
  for (const r of order) {
    for (const j of nbrs(r, n)) {
      if (j === from) continue;
      const pl = placeOf(map[j]);
      if (!pl) continue;
      const w = want ? want(pl, map[j]) : WEIGHT[pl];
      if (w > 0) goals.push([r, w]);
    }
  }
  const to = pick(goals.filter(([r]) => r !== s), rnd);
  if (to === null) return null;
  const p = pathTo(prev, to);
  return p.length >= 3 ? p : null;
}

/** Road path from road tile `s` to whichever of `to` (road tiles) it reaches first. */
function roadPath(map: string, s: number, to: Set<number>): number[] | null {
  const n = map.length;
  const prev = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  const order = [s];
  seen[s] = 1;
  for (let k = 0; k < order.length; k++) {
    if (to.has(order[k]) && order[k] !== s) return pathTo(prev, order[k]);
    for (const j of nbrs(order[k], n))
      if (!seen[j] && isRoad(map[j])) {
        seen[j] = 1;
        prev[j] = order[k];
        order.push(j);
      }
  }
  return null;
}

/** 🚌 A bus going round the 🚏 stops (in the order they're nearest each other), pausing at each. */
function busStopsRoute(map: string, stops: number[], rnd: () => number): { path: number[]; stops: number[] } | null {
  const n = map.length;
  const roadBy = (i: number) => nbrs(i, n).filter((j) => isRoad(map[j]));
  const usable = stops.filter((i) => roadBy(i).length);
  if (usable.length < 2) return null;
  // a tour: start somewhere, always the nearest stop not yet visited
  const left = [...usable];
  const tour = [left.splice(Math.floor(rnd() * left.length), 1)[0]];
  while (left.length) {
    const last = tour[tour.length - 1];
    let best = 0;
    for (let k = 1; k < left.length; k++) if (manhattan(left[k], last) < manhattan(left[best], last)) best = k;
    tour.push(left.splice(best, 1)[0]);
  }
  const path: number[] = [roadBy(tour[0])[0]];
  const at: number[] = [0];
  for (let k = 1; k < tour.length; k++) {
    const leg = roadPath(map, path[path.length - 1], new Set(roadBy(tour[k])));
    if (!leg) continue;
    path.push(...leg.slice(1));
    at.push(path.length - 1);
  }
  return path.length >= 3 ? { path, stops: at } : null;
}
const manhattan = (a: number, b: number) => Math.abs((a % W) - (b % W)) + Math.abs(Math.floor(a / W) - Math.floor(b / W));

/** 🚇 The metro line: the stations joined up, each to the nearest one not yet on the line. */
export function metroLine(map: string): number[] {
  const st: number[] = [];
  for (let i = 0; i < map.length; i++) if (map[i] === 'U') st.push(i);
  if (st.length < 2) return [];
  const left = [...st];
  const line = [left.shift()!];
  while (left.length) {
    const last = line[line.length - 1];
    let best = 0;
    for (let k = 1; k < left.length; k++) if (manhattan(left[k], last) < manhattan(left[best], last)) best = k;
    line.push(left.splice(best, 1)[0]);
  }
  return line;
}

/** A long bus route between two far-apart road tiles. */
function busRoute(map: string, roads: number[], rnd: () => number): number[] | null {
  if (roads.length < 12) return null;
  const s = roads[Math.floor(rnd() * roads.length)];
  const n = map.length;
  const prev = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  const order = [s];
  seen[s] = 1;
  for (let k = 0; k < order.length; k++)
    for (const j of nbrs(order[k], n))
      if (!seen[j] && isRoad(map[j])) {
        seen[j] = 1;
        prev[j] = order[k];
        order.push(j);
      }
  const far = order.slice(Math.floor(order.length * 0.7));
  if (!far.length) return null;
  const p = pathTo(prev, far[Math.floor(rnd() * far.length)]);
  return p.length >= 8 ? p : null;
}

export interface Traffic {
  agents: Agent[];
  /** call when the map or the people change */
  update: (map: string, pops: string, pop: number) => void;
  /** move everyone on `dt` seconds (already × the game speed) */
  advance: (dt: number) => void;
}

export function makeTraffic(rnd: () => number = Math.random): Traffic {
  let map = '';
  let homes: number[] = []; // homes with people in
  let makers: number[] = []; // farms & factories (trucks)
  let busStops: number[] = [];
  let line: number[] = [];
  const stations: Record<'police' | 'fire' | 'ambulance', number[]> = { police: [], fire: [], ambulance: [] };
  let roads: number[] = [];
  let want: Record<AgentKind, number> = { walker: 0, car: 0, truck: 0, bus: 0, police: 0, fire: 0, ambulance: 0, train: 0 };
  let spawnIn = 0;
  const agents: Agent[] = [];
  const count = (k: AgentKind) => agents.filter((a) => a.kind === k).length;
  const stillOk = (a: Agent) => {
    for (let k = a.seg; k < a.path.length; k++) {
      const c = map[a.path[k]];
      if (a.kind === 'train') {
        if (c !== 'U') return false;
      } else if (k === a.path.length - 1 && a.kind === 'walker') {
        if (c !== a.goal) return false;
      } else if (a.kind === 'walker' ? !(passable(c) || (k === 0 && placeOf(c))) : !isRoad(c)) return false;
    }
    return true;
  };

  function spawn() {
    let path: number[] | null = null;
    let stops: number[] | undefined;
    // whichever is furthest short of how many there should be
    const short = (Object.keys(want) as AgentKind[]).map((k) => [k, want[k] ? 1 - count(k) / want[k] : 0] as [AgentKind, number]).sort((x, y) => y[1] - x[1]);
    const kind: AgentKind | null = short[0][1] > 0 ? short[0][0] : null;
    const any = (xs: number[]) => xs[Math.floor(rnd() * xs.length)];
    if (kind === 'walker') path = walkFrom(map, any(homes), rnd);
    else if (kind === 'car') path = driveFrom(map, any(homes), rnd);
    else if (kind === 'truck') path = driveFrom(map, any(makers), rnd, (p) => (p === 'shop' ? 5 : p === 'work' ? 2 : 0));
    else if (kind === 'police' || kind === 'fire' || kind === 'ambulance') path = driveFrom(map, any(stations[kind]), rnd, (p) => (p === 'home' ? 3 : 1));
    else if (kind === 'bus') {
      const r = busStops.length >= 2 ? busStopsRoute(map, busStops, rnd) : null;
      if (r) ({ path, stops } = r);
      else path = busRoute(map, roads, rnd);
    } else if (kind === 'train') {
      // there and back along the line, stopping at every station
      path = rnd() < 0.5 ? [...line] : [...line].reverse();
      stops = path.map((_, k) => k);
    }
    if (!kind || !path || path.length < 2) return;
    const look =
      kind === 'walker'
        ? WALKERS[Math.floor(rnd() * WALKERS.length)]
        : ({ bus: '#fbc02d', truck: rnd() < 0.5 ? '#f5f5f5' : '#8d6e63', police: '#f5f5f5', fire: '#d32f2f', ambulance: '#fafafa', train: '#cfd8dc' } as Record<string, string>)[kind] ?? CAR_COLOURS[Math.floor(rnd() * CAR_COLOURS.length)];
    const speed = kind === 'walker' ? 0.7 + rnd() * 0.5 : kind === 'car' ? 2.2 + rnd() * 1.0 : kind === 'train' ? 4 : kind === 'truck' ? 1.7 : kind === 'bus' ? 1.5 : 2.6;
    // 🚨 now and then they're off to help someone, lights flashing
    const lights = (kind === 'police' || kind === 'fire' || kind === 'ambulance') && rnd() < 0.4;
    agents.push({ kind, path, seg: 0, t: 0, speed: lights ? speed * 1.4 : speed, look, side: rnd() < 0.5 ? -1 : 1, goal: map[path[path.length - 1]], stops, wait: stops?.includes(0) ? 1.5 : 0, lights });
  }

  return {
    agents,
    update(m, pops, pop) {
      const changed = m !== map;
      map = m;
      homes = [];
      makers = [];
      roads = [];
      busStops = [];
      stations.police = [];
      stations.fire = [];
      stations.ambulance = [];
      for (let i = 0; i < m.length; i++) {
        const c = m[i];
        if (isRoad(c)) roads.push(i);
        const b = buildingOf(c);
        if (b?.homes && pops.charCodeAt(i) > 48) homes.push(i);
        if (b && (b.id === 'farm' || b.id === 'factory')) makers.push(i);
        if (c === 'B') busStops.push(i);
        if (c === 'z') stations.police.push(i);
        if (c === 'x') stations.fire.push(i);
        if (c === 'c') stations.ambulance.push(i);
      }
      line = metroLine(m);
      const hasRoads = roads.length >= 3;
      const on = hasRoads && pop > 0;
      want = {
        walker: pop && homes.length ? Math.min(40, 2 + Math.ceil(pop / 4)) : 0,
        car: on && homes.length ? Math.min(26, Math.ceil(pop / 6)) : 0,
        truck: on ? Math.min(4, makers.length) : 0,
        bus: on ? (busStops.length >= 2 ? Math.min(4, Math.ceil(busStops.length / 2)) : pop >= 100 ? 1 : 0) : 0,
        police: on ? Math.min(3, stations.police.length) : 0,
        fire: on ? Math.min(2, stations.fire.length) : 0,
        ambulance: on ? Math.min(2, stations.ambulance.length) : 0,
        train: line.length >= 2 ? Math.min(3, line.length - 1) : 0,
      };
      if (changed) for (let k = agents.length - 1; k >= 0; k--) if (!stillOk(agents[k])) agents.splice(k, 1);
      // fewer people now: the extra ones just finish their trip
    },
    advance(dt) {
      if (dt <= 0) return;
      for (let k = agents.length - 1; k >= 0; k--) {
        const a = agents[k];
        let left = dt;
        if (a.wait && a.wait > 0) {
          const w = Math.min(a.wait, left);
          a.wait -= w;
          left -= w;
        }
        // each step is one tile, except the metro's (station to station)
        const len = () => Math.max(1, manhattan(a.path[a.seg], a.path[Math.min(a.seg + 1, a.path.length - 1)]));
        a.t += (left * a.speed) / len();
        while (a.t >= 1 && a.seg < a.path.length - 1) {
          const over = (a.t - 1) * len();
          a.seg++;
          a.t = 0;
          if (a.stops?.includes(a.seg) && a.seg < a.path.length - 1) {
            a.wait = a.kind === 'train' ? 1.2 : 1.5; // people get on and off
            break;
          }
          a.t = over / len();
        }
        if (a.seg >= a.path.length - 1) agents.splice(k, 1); // there: gone inside / parked
      }
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = 0.12;
      }
    },
  };
}

/** Where an agent is, in tiles (x, y), and which way it's heading. Turning corners is smoothed. */
export function placeAgent(a: Agent, map: string): { x: number; y: number; dx: number; dy: number } {
  const L = a.path.length - 1;
  const at = (k: number) => a.path[Math.max(0, Math.min(L, k))];
  const xy = (i: number) => [(i % W) + 0.5, Math.floor(i / W) + 0.5];
  const dir = (k: number) => {
    // the way segment k goes (the ends keep the nearest real one)
    const kk = Math.max(0, Math.min(L - 1, k));
    const [ax, ay] = xy(at(kk)), [bx, by] = xy(at(kk + 1));
    const l = Math.hypot(bx - ax, by - ay) || 1;
    return [(bx - ax) / l, (by - ay) / l];
  };
  // how far off the middle line: cars on the right, people on the road's edge (middle of grass)
  const offOf = (i: number) => (a.kind === 'train' ? 0 : a.kind === 'walker' ? (isRoad(map[i]) ? 0.34 * a.side : 0) : 0.15);
  const [ax, ay] = xy(at(a.seg)), [bx, by] = xy(at(a.seg + 1));
  const [dx, dy] = dir(a.seg);
  let x = ax + (bx - ax) * a.t, y = ay + (by - ay) * a.t;
  const [px, py] = dir(a.seg - 1), [nx, ny] = dir(a.seg + 1);
  // the sideways direction, blended across each tile boundary so corners don't jump
  const mix = (u: number[], v: number[], f: number) => [u[0] + (v[0] - u[0]) * f, u[1] + (v[1] - u[1]) * f];
  const d = a.t < 0.5 ? mix([px, py], [dx, dy], 0.5 + a.t) : mix([dx, dy], [nx, ny], a.t - 0.5);
  const oA = offOf(at(a.seg)), oB = offOf(at(a.seg + 1));
  const off = oA + (oB - oA) * a.t;
  x += -d[1] * off;
  y += d[0] * off;
  return { x, y, dx, dy };
}
