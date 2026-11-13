import { WHEEL_R, bodyPoint, rightCar, type Car, type Terrain, type World } from './hillPhysics.js';

/**
 * ⛏️ Hill Hopper's drill (a 🏆 prize power): press the dig key on the ground and the car tunnels into
 * the hill, drives along under the surface for a few seconds (longer with the 🔧 Drill time upgrade),
 * then drills straight back up and pops out. Secret things are buried in the hills — only seen when
 * your headlight reaches them underground (a ✨ on the surface hints at something rare below).
 * No drawing here (see HillHopperRun), so it can be tested on its own.
 */

/** seconds underground with no upgrades, and per 🔧 Drill time level */
export const DIG_TIME = 3;
export const DIG_PER_LEVEL = 1;
export const digTimeFor = (level: number) => DIG_TIME + DIG_PER_LEVEL * Math.max(0, level);
/** how deep the tunnel runs below the surface (m) */
const DEPTH = 3.6;
/** wait after popping out before digging again (s) */
const COOLDOWN = 1;

export interface Buried {
  x: number;
  y: number;
  kind: BuriedKind;
  taken: boolean;
}
export type BuriedKind = 'coins' | 'gem' | 'fossil' | 'fuel' | 'vase' | 'chest' | 'crown';
export const BURIED: Record<BuriedKind, { emoji: string; name: string; value: [number, number, number]; rare: boolean }> = {
  coins: { emoji: '💰', name: 'Buried coins', value: [40, 80, 150], rare: false },
  fuel: { emoji: '🛢️', name: 'Buried fuel — full tank', value: [0, 0, 0], rare: false },
  gem: { emoji: '💎', name: 'A gem', value: [150, 300, 600], rare: false },
  fossil: { emoji: '🦴', name: 'A fossil', value: [100, 200, 400], rare: false },
  vase: { emoji: '🏺', name: 'An ancient vase', value: [250, 500, 900], rare: true },
  chest: { emoji: '🧰', name: 'A treasure chest', value: [300, 600, 1200], rare: true },
  crown: { emoji: '👑', name: 'A lost crown', value: [800, 1500, 3000], rare: true },
};
/** each world's own fossil */
export const WORLD_FOSSIL: Record<string, { emoji: string; name: string }> = {
  dino: { emoji: '🦕', name: 'A dinosaur skeleton' },
  ice: { emoji: '🦣', name: 'A frozen mammoth' },
  moon: { emoji: '🛸', name: 'A buried flying saucer' },
  desert: { emoji: '🦂', name: 'A fossil scorpion' },
  water: { emoji: '🐚', name: 'A giant fossil shell' },
  jungle: { emoji: '🐊', name: 'A fossil crocodile' },
  candy: { emoji: '🍫', name: 'A chocolate fossil' },
  sun: { emoji: '☄️', name: 'A sun-forged meteorite' },
};
export const buriedLook = (b: BuriedKind, world: World) => (b === 'fossil' && WORLD_FOSSIL[world.id] ? { ...BURIED.fossil, ...WORLD_FOSSIL[world.id] } : BURIED[b]);

/** Hide things in the hills from `from` to `upTo` (the same spots every run of a world). */
export function placeBuried(t: Terrain, world: World, from: number, upTo: number, into: Buried[], seed: { s: number }): number {
  const rand = () => {
    seed.s = (seed.s * 1103515245 + 12345) & 0x7fffffff;
    return seed.s / 0x7fffffff;
  };
  let x = from;
  while (x < upTo) {
    x += 5 + rand() * 9;
    const depth = 1.6 + rand() * 4.4;
    const r = rand();
    // deeper = rarer things
    const kind: BuriedKind =
      depth > 5.2 && r < 0.12 ? 'crown' : depth > 4.2 && r < 0.3 ? 'chest' : depth > 3.4 && r < 0.38 ? 'vase' : r < 0.12 ? 'fuel' : r < 0.3 ? 'gem' : r < 0.42 ? 'fossil' : 'coins';
    into.push({ x, y: t.h(x) - depth, kind, taken: false });
  }
  return x;
}

export interface Dig {
  phase: 'down' | 'tunnel' | 'up';
  /** seconds of tunnelling left */
  left: number;
  total: number;
}

export class Digger {
  dig: Dig | null = null;
  cool = 0;
  /** every tunnel dug this run (for drawing) */
  tunnels: Array<Array<{ x: number; y: number }>> = [];
  buried: Buried[] = [];
  private placedTo: number;
  private seed: { s: number };
  constructor(
    private t: Terrain,
    private world: World,
    startX: number,
    private time: number
  ) {
    this.seed = { s: world.seed * 57 + 11 };
    this.placedTo = placeBuried(t, world, startX + 12, startX + 300, this.buried, this.seed);
  }
  get underground() {
    return this.dig !== null;
  }
  /** Start a dig if we can (on the ground, not in water, not just out of one). */
  start(car: Car): boolean {
    if (this.dig || this.cool > 0) return false;
    if (!car.wheels.some((w) => w.ground)) return false;
    if (this.world.water != null && this.t.h(car.x) < this.world.water) return false;
    this.dig = { phase: 'down', left: this.time, total: this.time };
    this.tunnels.push([{ x: car.x, y: this.t.h(car.x) }]);
    if (this.tunnels.length > 12) this.tunnels.shift();
    return true;
  }
  /**
   * One step underground: moves the car itself (no physics). pedal 1 = faster, -1 = slower.
   * Returns what was found this step and whether the car just popped out.
   */
  step(car: Car, pedal: number, dt: number): { found: Buried[]; out: boolean } {
    if (car.x + 200 > this.placedTo) this.placedTo = placeBuried(this.t, this.world, this.placedTo, this.placedTo + 300, this.buried, this.seed);
    if (this.buried.length > 600) this.buried.splice(0, this.buried.findIndex((b) => b.x > car.x - 40));
    this.cool = Math.max(0, this.cool - dt);
    const d = this.dig;
    if (!d) return { found: [], out: false };
    const speed = pedal > 0 ? 6 : pedal < 0 ? 1.5 : 3.5;
    const surface = this.t.h(car.x);
    let vx = speed;
    let vy = 0;
    if (d.phase === 'down') {
      vy = -4.5;
      if (car.y <= surface - DEPTH) d.phase = 'tunnel';
    } else if (d.phase === 'tunnel') {
      // follow the hill's shape, DEPTH below it
      vy = (surface - DEPTH - car.y) * 3;
    } else {
      vx = 0;
      vy = 7;
    }
    if (d.phase !== 'up') {
      d.left -= dt;
      if (d.left <= 0) d.phase = 'up';
    }
    car.x += vx * dt;
    car.y += vy * dt;
    car.vx = vx;
    car.vy = vy;
    car.w = 0;
    car.tipped = 0;
    const want = d.phase === 'up' ? Math.PI / 2 : Math.atan2(vy, vx);
    car.a += (want - car.a) * Math.min(1, 10 * dt);
    for (const w of car.wheels) {
      const p = bodyPoint(car, w.ax, w.ay);
      w.x = p.x;
      w.y = p.y;
      w.vx = vx;
      w.vy = vy;
      w.ground = false;
      w.angle += (speed / WHEEL_R) * dt * 0.3;
    }
    const path = this.tunnels[this.tunnels.length - 1];
    const lastPt = path[path.length - 1];
    if (Math.hypot(car.x - lastPt.x, car.y - lastPt.y) > 0.3) path.push({ x: car.x, y: car.y });
    // 🔦 bump into buried things with the drill (or the car)
    const nose = bodyPoint(car, 1.9, 0);
    const found: Buried[] = [];
    for (const b of this.buried) {
      if (b.taken || Math.abs(b.x - car.x) > 4) continue;
      if (Math.hypot(b.x - nose.x, b.y - nose.y) < 1.3 || Math.hypot(b.x - car.x, b.y - car.y) < 1.2) {
        b.taken = true;
        found.push(b);
      }
    }
    // ⬆️ out of the ground: back on the wheels, with a little hop
    if (d.phase === 'up' && car.y >= this.t.h(car.x) + WHEEL_R + 0.7) {
      this.dig = null;
      this.cool = COOLDOWN;
      path.push({ x: car.x, y: this.t.h(car.x) });
      car.vx = 3;
      car.vy = 2.5;
      rightCar(car, this.t);
      return { found, out: true };
    }
    return { found, out: false };
  }
}
