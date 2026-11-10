/**
 * 🏘️ Tiny Town — the town and how it grows (no drawing here; TinyTownRun.tsx draws it).
 *
 * The land is a grid of tiles, one character each (see BUILDINGS). Build roads, then homes next to
 * them; people move in when they're happy, have power and water, and there are jobs. People who
 * work pay taxes (🪙), which pay for more building and for the upkeep of services. A bigger town
 * opens new buildings (needPop). Each tick is one day.
 */

export const W = 48;
export const H = 36;
/** Without 🗺️ Bigger land, only this middle part can be built on (and is shown). */
export const SMALL = { x0: 9, y0: 7, w: 30, h: 22 };
export const FULL = { x0: 0, y0: 0, w: W, h: H };
export type Region = typeof SMALL;

export type Cat = 'road' | 'home' | 'work' | 'service' | 'nature' | 'utility' | 'fun';

export interface Building {
  ch: string;
  id: string;
  emoji: string;
  name: string;
  cat: Cat;
  cost: number;
  /** 🪙 a day to keep it running */
  upkeep: number;
  /** town size (people, the most it's had) that opens it */
  needPop: number;
  /** a 💎 extra it comes with */
  feature?: 'fun';
  homes?: number;
  jobs?: number;
  power?: number;
  water?: number;
  /** makes homes within `radius` (tiles) this much happier */
  happy?: [number, number];
  /** makes homes within `radius` this much less happy */
  noise?: [number, number];
  /** a service that covers homes within `radius` */
  cover?: [Service, number];
  /** makes every home in town this much happier */
  townHappy?: number;
  needsRoad: boolean;
  /** power it uses (and water: 1 each, for anything that uses power) */
  uses: number;
  /** must be next to water */
  byWater?: boolean;
  /** can't be built by hand (homes grow into these) */
  grown?: boolean;
  tip: string;
}
export type Service = 'school' | 'health' | 'fire' | 'police' | 'library';

const B = (b: Omit<Building, 'needsRoad' | 'uses'> & { needsRoad?: boolean; uses?: number }): Building => ({ needsRoad: true, uses: 1, ...b });

export const BUILDINGS: Building[] = [
  B({ ch: '=', id: 'road', emoji: '🛣️', name: 'Road', cat: 'road', cost: 5, upkeep: 0, needPop: 0, needsRoad: false, uses: 0, tip: 'Everything (but parks and nature) needs a road next to it. Drag to draw. Over water it builds a bridge (25 🪙).' }),
  B({ ch: 'h', id: 'house', emoji: '🏠', name: 'House', cat: 'home', cost: 30, upkeep: 0, needPop: 0, homes: 4, tip: 'Homes for 4. Happy, full houses grow into bigger homes.' }),
  B({ ch: 'H', id: 'house2', emoji: '🏡', name: 'Big house', cat: 'home', cost: 30, upkeep: 0, needPop: 0, homes: 10, grown: true, tip: 'A house that grew: homes for 10.' }),
  B({ ch: 'T', id: 'house3', emoji: '🏘️', name: 'Townhouses', cat: 'home', cost: 30, upkeep: 0, needPop: 0, homes: 24, uses: 2, grown: true, tip: 'Grew from a big house: homes for 24.' }),
  B({ ch: 's', id: 'shop', emoji: '🏪', name: 'Shop', cat: 'work', cost: 50, upkeep: 0, needPop: 0, jobs: 5, tip: '5 jobs.' }),
  B({ ch: 'm', id: 'farm', emoji: '🚜', name: 'Farm', cat: 'work', cost: 40, upkeep: 0, needPop: 0, jobs: 4, tip: '4 jobs, and quiet.' }),
  B({ ch: 'k', id: 'cafe', emoji: '☕', name: 'Café', cat: 'work', cost: 70, upkeep: 0, needPop: 30, jobs: 3, happy: [2, 6], tip: '3 jobs, and nearby homes like it.' }),
  B({ ch: 'f', id: 'factory', emoji: '🏭', name: 'Factory', cat: 'work', cost: 90, upkeep: 0, needPop: 15, jobs: 10, noise: [3, 15], tip: '10 jobs, but noisy: homes within 3 tiles are less happy.' }),
  B({ ch: 'o', id: 'office', emoji: '🏢', name: 'Offices', cat: 'work', cost: 300, upkeep: 1, needPop: 80, jobs: 16, tip: '16 jobs, and quiet.' }),
  B({ ch: 'p', id: 'park', emoji: '🌳', name: 'Park', cat: 'nature', cost: 25, upkeep: 0, needPop: 0, happy: [3, 10], needsRoad: false, uses: 0, tip: 'Homes within 3 tiles are happier. Drag to plant lots.' }),
  B({ ch: 'y', id: 'playground', emoji: '🎠', name: 'Playground', cat: 'nature', cost: 60, upkeep: 0, needPop: 20, happy: [3, 15], needsRoad: false, uses: 0, tip: 'Homes within 3 tiles are a lot happier.' }),
  B({ ch: 'n', id: 'fountain', emoji: '⛲', name: 'Fountain', cat: 'nature', cost: 120, upkeep: 0, needPop: 150, happy: [4, 12], needsRoad: false, uses: 0, tip: 'Homes within 4 tiles are happier.' }),
  B({ ch: 'u', id: 'solar', emoji: '☀️', name: 'Solar panels', cat: 'utility', cost: 100, upkeep: 1, needPop: 0, power: 15, needsRoad: false, uses: 0, tip: 'Power for 15 buildings. No road needed.' }),
  B({ ch: 'g', id: 'power', emoji: '⚡', name: 'Power station', cat: 'utility', cost: 300, upkeep: 4, needPop: 40, power: 70, noise: [2, 10], uses: 0, tip: 'Power for 70 buildings, a little noisy.' }),
  B({ ch: 'w', id: 'tower', emoji: '💧', name: 'Water tower', cat: 'utility', cost: 100, upkeep: 1, needPop: 0, water: 30, uses: 0, tip: 'Water for 30 buildings.' }),
  B({ ch: 'q', id: 'pump', emoji: '🚰', name: 'Water pump', cat: 'utility', cost: 60, upkeep: 1, needPop: 0, water: 25, uses: 0, byWater: true, tip: 'Water for 25 buildings. Build it next to the water.' }),
  B({ ch: 'x', id: 'fire', emoji: '🚒', name: 'Fire station', cat: 'service', cost: 150, upkeep: 3, needPop: 15, jobs: 3, cover: ['fire', 7], tip: 'Homes within 7 tiles feel safe. Towns over 60 people want one.' }),
  B({ ch: 'e', id: 'school', emoji: '🏫', name: 'School', cat: 'service', cost: 200, upkeep: 4, needPop: 40, jobs: 4, cover: ['school', 6], tip: 'Homes within 6 tiles are happier. Towns over 60 people want one.' }),
  B({ ch: 'c', id: 'clinic', emoji: '🏥', name: 'Clinic', cat: 'service', cost: 250, upkeep: 5, needPop: 80, jobs: 5, cover: ['health', 7], tip: 'Homes within 7 tiles are happier. Towns over 120 people want one.' }),
  B({ ch: 'z', id: 'police', emoji: '🚓', name: 'Police', cat: 'service', cost: 150, upkeep: 3, needPop: 80, jobs: 3, cover: ['police', 7], tip: 'Homes within 7 tiles feel safe. Towns over 150 people want one.' }),
  B({ ch: 'l', id: 'library', emoji: '📚', name: 'Library', cat: 'service', cost: 200, upkeep: 2, needPop: 150, jobs: 2, cover: ['library', 6], tip: 'Homes within 6 tiles are happier.' }),
  B({ ch: 'S', id: 'stadium', emoji: '🏟️', name: 'Stadium', cat: 'service', cost: 1200, upkeep: 8, needPop: 250, jobs: 10, townHappy: 5, tip: 'The whole town is happier.' }),
  B({ ch: 'M', id: 'museum', emoji: '🏛️', name: 'Museum', cat: 'service', cost: 900, upkeep: 5, needPop: 400, jobs: 6, townHappy: 4, tip: 'The whole town is happier.' }),
  B({ ch: 'R', id: 'rocket', emoji: '🚀', name: 'Rocket base', cat: 'service', cost: 3000, upkeep: 10, needPop: 1000, jobs: 25, townHappy: 8, tip: 'The biggest thing a town can build. Everyone is proud of it.' }),
  B({ ch: 'F', id: 'funpark', emoji: '🎡', name: 'Fun park', cat: 'fun', cost: 600, upkeep: 3, needPop: 60, feature: 'fun', jobs: 6, happy: [6, 20], tip: 'Homes within 6 tiles are much happier.' }),
  B({ ch: 'Z', id: 'zoo', emoji: '🦁', name: 'Zoo', cat: 'fun', cost: 700, upkeep: 4, needPop: 120, feature: 'fun', jobs: 8, townHappy: 4, tip: 'The whole town is happier.' }),
  B({ ch: 'Q', id: 'aquarium', emoji: '🐠', name: 'Aquarium', cat: 'fun', cost: 700, upkeep: 4, needPop: 120, feature: 'fun', jobs: 6, townHappy: 4, byWater: true, tip: 'The whole town is happier. Build it next to the water.' }),
  B({ ch: 'C', id: 'castle', emoji: '🏰', name: 'Castle', cat: 'fun', cost: 800, upkeep: 2, needPop: 200, feature: 'fun', jobs: 4, townHappy: 5, tip: 'Every town should have one. The whole town is happier.' }),
];
const BY_CH = new Map(BUILDINGS.map((b) => [b.ch, b]));
export const buildingOf = (ch: string) => BY_CH.get(ch);
export const BRIDGE = '#';
export const GRASS = '.';
export const WATER = '~';
export const TREE = 't';
const HOME_UP: Record<string, string> = { h: 'H', H: 'T' };

export const START_COINS = 800;
export const DEFAULT_TAX = 10;
/** 🌱 a day for a small town that's run out of 🪙 */
export const HELP = 3;

export interface Town {
  v: 1;
  name: string;
  seed: number;
  /** W*H tile characters */
  map: string;
  /** people in each tile (homes only), as chars '0' + n */
  pops: string;
  coins: number;
  day: number;
  tax: number;
  /** the most people it's ever had — opens buildings, and is the score */
  peak: number;
}

// ---- 🗺️ new land ----

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A river across, maybe a lake, and woods — the middle stays mostly open to build on. */
export function newTown(name: string, seed: number): Town {
  const r = rng(seed);
  const m: string[] = new Array(W * H).fill(GRASS);
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = c;
  };
  // 🌊 a river, top to bottom or left to right, wandering a little
  if (r() < 0.5) {
    let x = Math.floor(W * (0.2 + r() * 0.6));
    for (let y = 0; y < H; y++) {
      set(x, y, WATER);
      set(x + 1, y, WATER);
      if (r() < 0.35) x += r() < 0.5 ? -1 : 1;
      x = Math.max(2, Math.min(W - 4, x));
    }
  } else {
    let y = Math.floor(H * (0.2 + r() * 0.6));
    for (let x = 0; x < W; x++) {
      set(x, y, WATER);
      set(x, y + 1, WATER);
      if (r() < 0.35) y += r() < 0.5 ? -1 : 1;
      y = Math.max(2, Math.min(H - 4, y));
    }
  }
  // 🏞️ a lake, often
  if (r() < 0.7) {
    const cx = Math.floor(r() * W), cy = Math.floor(r() * H), rad = 2 + r() * 3;
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= rad * rad * (0.8 + r() * 0.4)) set(cx + x, cy + y, WATER);
  }
  // 🌲 woods: clumps, thicker near the edges
  for (let k = 0; k < 18; k++) {
    const edge = r() < 0.7;
    const cx = edge ? (r() < 0.5 ? Math.floor(r() * 8) : W - 1 - Math.floor(r() * 8)) : Math.floor(r() * W);
    const cy = Math.floor(r() * H);
    const n = 6 + Math.floor(r() * 14);
    for (let i = 0; i < n; i++) {
      const x = cx + Math.round((r() - 0.5) * 6), y = cy + Math.round((r() - 0.5) * 6);
      if (x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === GRASS) m[y * W + x] = TREE;
    }
  }
  return { v: 1, name: name.slice(0, 30) || 'My town', seed, map: m.join(''), pops: '0'.repeat(W * H), coins: START_COINS, day: 0, tax: DEFAULT_TAX, peak: 0 };
}

/** A saved town, checked; null if it isn't one. */
export function cleanTown(t: unknown): Town | null {
  const x = t as Partial<Town> | null;
  if (!x || typeof x.map !== 'string' || x.map.length !== W * H || typeof x.pops !== 'string' || x.pops.length !== W * H) return null;
  const ok = (c: string) => c === GRASS || c === WATER || c === TREE || c === BRIDGE || BY_CH.has(c);
  if (![...x.map].every(ok) || ![...x.pops].every((c) => c >= '0' && c <= 'H')) return null;
  const n = (v: unknown, d: number, lo: number, hi: number) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : d);
  return {
    v: 1,
    name: String(x.name ?? 'My town').slice(0, 30),
    seed: n(x.seed, 1, 0, 2 ** 31),
    map: x.map,
    pops: x.pops,
    coins: n(x.coins, START_COINS, -1e6, 1e9),
    day: n(x.day, 0, 0, 1e9),
    tax: n(x.tax, DEFAULT_TAX, 0, 20),
    peak: n(x.peak, 0, 0, 1e7),
  };
}

// ---- 🧮 working the town out ----

export interface HomeLook {
  happy: number;
  parts: Array<[string, number]>;
}
export interface Report {
  pop: number;
  jobs: number;
  employed: number;
  power: [number, number];
  water: [number, number];
  income: number;
  upkeep: number;
  happy: number;
  homes: number;
  homesFull: number;
  noRoad: number;
  /** happiness of each home tile (index → 0–100) */
  homeHappy: Map<number, number>;
}

const dist = (a: number, b: number) => Math.abs((a % W) - (b % W)) + Math.abs(Math.floor(a / W) - Math.floor(b / W));
const popAt = (t: Town, i: number) => t.pops.charCodeAt(i) - 48;

export function hasRoad(map: string, i: number): boolean {
  const x = i % W, y = Math.floor(i / W);
  const r = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < W && yy < H && (map[yy * W + xx] === '=' || map[yy * W + xx] === BRIDGE);
  return r(x - 1, y) || r(x + 1, y) || r(x, y - 1) || r(x, y + 1);
}
export function byWater(map: string, i: number): boolean {
  const x = i % W, y = Math.floor(i / W);
  const w = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < W && yy < H && map[yy * W + xx] === WATER;
  return w(x - 1, y) || w(x + 1, y) || w(x, y - 1) || w(x, y + 1);
}
/** Is this building working — next to a road if it needs one (and water, if it needs that)? */
const works = (map: string, i: number, b: Building) => (!b.needsRoad || hasRoad(map, i)) && (!b.byWater || byWater(map, i));

interface Ctx {
  map: string;
  happySrc: Array<[number, number, number, string]>; // index, radius, amount, label
  noiseSrc: Array<[number, number, number, string]>;
  cover: Record<Service, number[]>;
  coverR: Record<Service, number>;
  townHappy: number;
  powerOk: boolean;
  waterOk: boolean;
  pop: number;
  jobs: number;
  tax: number;
}

function context(t: Town): Omit<Report, 'homeHappy' | 'happy'> & { ctx: Ctx } {
  const map = t.map;
  const ctx: Ctx = {
    map,
    happySrc: [],
    noiseSrc: [],
    cover: { school: [], health: [], fire: [], police: [], library: [] },
    coverR: { school: 0, health: 0, fire: 0, police: 0, library: 0 },
    townHappy: 0,
    powerOk: true,
    waterOk: true,
    pop: 0,
    jobs: 0,
    tax: t.tax,
  };
  let power = 0, powerUse = 0, water = 0, waterUse = 0, jobs = 0, pop = 0, upkeep = 0, roads = 0, homes = 0, homesFull = 0, noRoad = 0;
  for (let i = 0; i < map.length; i++) {
    const c = map[i];
    if (c === '=' || c === BRIDGE) {
      roads++;
      continue;
    }
    const b = BY_CH.get(c);
    if (!b) continue;
    upkeep += b.upkeep;
    const ok = works(map, i, b);
    if (b.needsRoad && !hasRoad(map, i)) noRoad++;
    if (b.homes) {
      homes++;
      const p = popAt(t, i);
      pop += p;
      if (p >= b.homes) homesFull++;
    }
    if (!ok) continue;
    powerUse += b.uses;
    waterUse += b.uses;
    if (b.power) power += b.power;
    if (b.water) water += b.water;
    if (b.jobs) jobs += b.jobs;
    if (b.happy) ctx.happySrc.push([i, b.happy[0], b.happy[1], `${b.emoji} ${b.name}`]);
    if (b.noise) ctx.noiseSrc.push([i, b.noise[0], b.noise[1], `${b.emoji} ${b.name}`]);
    if (b.cover) {
      ctx.cover[b.cover[0]].push(i);
      ctx.coverR[b.cover[0]] = b.cover[1];
    }
    if (b.townHappy) ctx.townHappy += b.townHappy;
  }
  ctx.powerOk = power >= powerUse;
  ctx.waterOk = water >= waterUse;
  // Short of power: work places only manage part of their jobs.
  if (!ctx.powerOk && powerUse) jobs = Math.floor((jobs * power) / powerUse);
  ctx.pop = pop;
  ctx.jobs = jobs;
  const employed = Math.min(pop, jobs);
  upkeep += Math.floor(roads / 10);
  const income = Math.round((employed * t.tax) / 10 + (pop * t.tax) / 40);
  return { pop, jobs, employed, power: [power, powerUse], water: [water, waterUse], income, upkeep, homes, homesFull, noRoad, ctx };
}

/** How happy a home is, and why. */
export function homeLook(ctx: Ctx, i: number): HomeLook {
  const parts: Array<[string, number]> = [['🙂 Starting point', 50]];
  let nice = 0;
  const niceBy = new Map<string, number>();
  for (const [j, r, a, label] of ctx.happySrc)
    if (dist(i, j) <= r) {
      nice += a;
      niceBy.set(label, (niceBy.get(label) ?? 0) + a);
    }
  if (nice) parts.push([`🌳 Nice things nearby (${[...niceBy.keys()].join(', ')})`, Math.min(35, nice)]);
  let noise = 0;
  for (const [j, r, a] of ctx.noiseSrc) if (dist(i, j) <= r) noise += a;
  if (noise) parts.push(['🔊 Noise from 🏭 / ⚡ nearby', -Math.min(40, noise)]);
  const near = (s: Service) => ctx.cover[s].some((j) => dist(i, j) <= ctx.coverR[s]);
  const svc: Array<[Service, string, number, number]> = [
    ['school', '🏫 School', 8, 60],
    ['health', '🏥 Clinic', 8, 120],
    ['fire', '🚒 Fire station', 5, 60],
    ['police', '🚓 Police', 5, 150],
    ['library', '📚 Library', 4, Infinity],
  ];
  for (const [s, label, plus, wantAt] of svc) {
    if (near(s)) parts.push([`${label} nearby`, plus]);
    else if (ctx.pop >= wantAt) parts.push([`${label}: none close enough`, -plus]);
  }
  if (ctx.townHappy) parts.push(['🏟️ Town sights', Math.min(25, ctx.townHappy)]);
  if (ctx.tax !== DEFAULT_TAX) parts.push([`🪙 Taxes ${ctx.tax}%`, (DEFAULT_TAX - ctx.tax) * 2]);
  if (ctx.pop > 0 && ctx.jobs < ctx.pop) parts.push(['💼 Not enough jobs', -Math.round(30 * (1 - ctx.jobs / ctx.pop))]);
  if (!ctx.powerOk) parts.push(['⚡ Not enough power', -20]);
  if (!ctx.waterOk) parts.push(['💧 Not enough water', -20]);
  if (!hasRoad(ctx.map, i)) parts.push(['🚧 No road', -30]);
  const happy = Math.max(0, Math.min(100, parts.reduce((s, [, v]) => s + v, 0)));
  return { happy, parts };
}

/** Where the town is, without changing it. */
export function report(t: Town): Report & { ctx: Ctx } {
  const base = context(t);
  const homeHappy = new Map<number, number>();
  let sum = 0;
  for (let i = 0; i < t.map.length; i++) {
    const b = BY_CH.get(t.map[i]);
    if (!b?.homes) continue;
    const h = homeLook(base.ctx, i).happy;
    homeHappy.set(i, h);
    sum += h * Math.max(1, popAt(t, i));
  }
  const weight = [...homeHappy.keys()].reduce((s, i) => s + Math.max(1, popAt(t, i)), 0);
  return { ...base, homeHappy, happy: weight ? Math.round(sum / weight) : 0 };
}

/** One day: people move in or out, homes grow, taxes come in and upkeep goes out. */
export function step(t: Town, random: () => number = Math.random): Report {
  const rep = report(t);
  const map = t.map.split('');
  const pops = t.pops.split('');
  const room = rep.jobs + 6 > rep.pop; // jobs for newcomers (a few can come without)
  let moved = 0;
  for (const [i, h] of rep.homeHappy) {
    const b = BY_CH.get(map[i])!;
    let p = popAt(t, i);
    const cap = b.homes!;
    if (hasRoad(t.map, i) && h >= 45 && room && rep.ctx.powerOk && rep.ctx.waterOk && p < cap && moved < 40) {
      p += h >= 75 ? 2 : 1;
      moved++;
    } else if (h < 25 && p > 0) p--;
    p = Math.min(p, cap);
    // 🏡 A full, happy home grows into a bigger one, now and then.
    const up = HOME_UP[map[i]];
    if (up && p >= cap && ((map[i] === 'h' && h >= 65 && rep.pop >= 30 && random() < 0.05) || (map[i] === 'H' && h >= 75 && rep.pop >= 150 && random() < 0.03))) map[i] = up;
    pops[i] = String.fromCharCode(48 + Math.max(0, p));
  }
  t.map = map.join('');
  t.pops = pops.join('');
  // 🪙 Never below 0 (upkeep just goes unpaid), and a small town that's run out gets a little help.
  t.coins = Math.max(0, t.coins + rep.income - rep.upkeep + (t.coins < 40 && rep.pop < 20 ? HELP : 0));
  t.day++;
  const after = report(t);
  t.peak = Math.max(t.peak, after.pop);
  return after;
}

// ---- 🔨 building ----

export type Tool = { kind: 'look' } | { kind: 'pan' } | { kind: 'bulldoze' } | { kind: 'build'; ch: string };

/** Can this go here — and if not, why? `cost` is what it would take. */
export function canBuild(t: Town, i: number, tool: Tool, region: Region, owned: { fun: boolean }): { ok: boolean; cost: number; why?: string } {
  const x = i % W, y = Math.floor(i / W);
  if (x < region.x0 || y < region.y0 || x >= region.x0 + region.w || y >= region.y0 + region.h) return { ok: false, cost: 0, why: 'Outside your land' };
  const here = t.map[i];
  if (tool.kind === 'bulldoze') {
    if (here === GRASS || here === WATER) return { ok: false, cost: 0, why: 'Nothing to clear' };
    if (here === TREE) return { ok: t.coins >= 2, cost: 2, why: t.coins < 2 ? 'Not enough 🪙' : undefined };
    return { ok: true, cost: 0 };
  }
  if (tool.kind !== 'build') return { ok: false, cost: 0 };
  const b = BY_CH.get(tool.ch);
  if (!b || b.grown) return { ok: false, cost: 0 };
  if (b.feature === 'fun' && !owned.fun) return { ok: false, cost: b.cost, why: '🔒 Unlock 🎡 Fun places first' };
  if (t.peak < b.needPop) return { ok: false, cost: b.cost, why: `🔒 Opens at ${b.needPop} people` };
  let cost = b.cost;
  if (here === WATER) {
    if (b.ch !== '=') return { ok: false, cost, why: 'That can’t go on water (roads can: a bridge)' };
    cost = 25;
  } else if (here === TREE) cost += 2;
  else if (here !== GRASS) return { ok: false, cost, why: 'Something’s already here — 🚜 clear it first' };
  if (b.byWater && !byWater(t.map, i)) return { ok: false, cost, why: 'Needs to be next to the water' };
  if (t.coins < cost) return { ok: false, cost, why: `Needs ${cost} 🪙` };
  return { ok: true, cost };
}

/** Do it (after canBuild said yes). Clearing a building gives half its price back. */
export function build(t: Town, i: number, tool: Tool, region: Region, owned: { fun: boolean }): boolean {
  const c = canBuild(t, i, tool, region, owned);
  if (!c.ok) return false;
  const map = t.map.split('');
  const pops = t.pops.split('');
  if (tool.kind === 'bulldoze') {
    const here = map[i];
    if (here === BRIDGE) map[i] = WATER;
    else if (here === TREE) {
      map[i] = GRASS;
      t.coins -= 2;
    } else {
      const b = BY_CH.get(here);
      if (b && !b.grown) t.coins += Math.floor(b.cost / 2);
      else if (b?.grown) t.coins += 15;
      map[i] = GRASS;
    }
    pops[i] = '0';
  } else if (tool.kind === 'build') {
    map[i] = map[i] === WATER ? BRIDGE : tool.ch;
    pops[i] = '0';
    t.coins -= c.cost;
  }
  t.map = map.join('');
  t.pops = pops.join('');
  return true;
}

/** The most pressing thing to do next, for the 💡 line. */
export function tips(t: Town, r: Report): string[] {
  const out: string[] = [];
  if (!r.homes) out.push('🛣️ Draw a road, then put 🏠 houses next to it.');
  if (r.noRoad) out.push(`🚧 ${r.noRoad} building${r.noRoad === 1 ? ' isn’t' : 's aren’t'} next to a road, so ${r.noRoad === 1 ? 'it doesn’t' : 'they don’t'} work.`);
  if (r.power[1] > r.power[0]) out.push(`⚡ Not enough power (${r.power[0]} for ${r.power[1]}) — build ☀️ solar panels${t.peak >= 40 ? ' or a ⚡ power station' : ''}.`);
  if (r.water[1] > r.water[0]) out.push(`💧 Not enough water (${r.water[0]} for ${r.water[1]}) — build a 💧 water tower, or a 🚰 pump next to the water.`);
  if (r.homes && r.jobs + 6 <= r.pop) out.push('💼 People need jobs — build 🏪 shops, 🚜 farms' + (t.peak >= 15 ? ' or 🏭 factories.' : '.'));
  if (r.homes && r.happy < 45) out.push('😟 People aren’t happy — 🌳 parks help, and keep 🏭 factories away from homes. Tap a home with 🔍 to see why.');
  if (r.income < r.upkeep) out.push('🪙 Spending more than you earn — get more people working, or raise taxes a little.');
  if (r.homes && r.homesFull === r.homes && !out.length) out.push('🏠 Every home is full — build more houses!');
  const next = BUILDINGS.filter((b) => !b.grown && !b.feature && b.needPop > t.peak).sort((a, b) => a.needPop - b.needPop)[0];
  if (next) out.push(`🔓 Next: ${next.emoji} ${next.name} at ${next.needPop} people.`);
  return out;
}
