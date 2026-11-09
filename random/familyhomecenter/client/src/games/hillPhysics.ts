/**
 * ⛰️ Hill Hopper — the world and the physics (no drawing here, so it can be tested on its own).
 * Metres and seconds, y points up. A car body on two sprung wheels; tires grip the ground with
 * friction (so they can spin out on a steep hill), gas tips the nose up and brake tips it down —
 * on the ground a little (wheelies), in the air a lot (flips). The driver's head touching the
 * ground ends the run.
 */

export interface Upgrades {
  engine: number;
  tires: number;
  springs: number;
  tank: number;
  /** 🦘 higher jumps (with Jump on) */
  jump?: number;
  /** 🪂 longer glides (with the Glider) */
  glide?: number;
}
export const UPGRADE_KEYS: Array<keyof Upgrades> = ['engine', 'tires', 'springs', 'tank'];
export const MAX_LEVEL = 5;
/** Coins for the next level (index = current level). */
export const UPGRADE_COST = [100, 250, 500, 1000, 2000];

// ---------- the hills ----------

/**
 * 🌍 Worlds to drive in. Green Hills is free; the rest are bought with coins from the game. Each one
 * drives differently (gravity, grip, bounce, hill shape, water) — the look is in HillHopperRun.
 */
export interface World {
  id: string;
  emoji: string;
  name: string;
  blurb: string;
  coins: number; // price
  gravity: number;
  grip: number; // × the tires' grip
  bounce: number; // × how bouncy the ground is
  bumps: number; // × bump size
  hillLen: number; // × distance between hill points (longer = smoother, rolling)
  trend: number; // × how much it climbs
  water: number | null; // sea level (m) — below it the car floats and slows
  fuelBurn: number; // × fuel use
  coinMul: number; // × coin values
  seed: number;
}

export const WORLDS: World[] = [
  { id: 'hills', emoji: '🌄', name: 'Green Hills', blurb: 'Where it all starts.', coins: 0, gravity: 9.8, grip: 1, bounce: 1, bumps: 1, hillLen: 1, trend: 1, water: null, fuelBurn: 1, coinMul: 1, seed: 7 },
  { id: 'desert', emoji: '🏜️', name: 'Desert Dunes', blurb: 'Long rolling dunes of loose sand — less grip.', coins: 300, gravity: 9.8, grip: 0.85, bounce: 0.9, bumps: 1.35, hillLen: 1.7, trend: 0.8, water: null, fuelBurn: 1.1, coinMul: 1.2, seed: 21 },
  { id: 'jungle', emoji: '🌴', name: 'Jungle', blurb: 'Short, choppy bumps and slippery mud.', coins: 600, gravity: 9.8, grip: 0.85, bounce: 1.1, bumps: 0.72, hillLen: 0.85, trend: 0.9, water: null, fuelBurn: 1, coinMul: 1.3, seed: 33 },
  { id: 'ice', emoji: '🧊', name: 'Ice World', blurb: 'Gentle hills — but so slippery!', coins: 900, gravity: 9.8, grip: 0.42, bounce: 1, bumps: 0.65, hillLen: 1.2, trend: 0.55, water: null, fuelBurn: 1, coinMul: 1.4, seed: 47 },
  { id: 'dino', emoji: '🦖', name: 'Dino Land', blurb: 'Big hills under a volcano sky.', coins: 1200, gravity: 9.8, grip: 1, bounce: 1.05, bumps: 1.2, hillLen: 1.1, trend: 1.0, water: null, fuelBurn: 1.1, coinMul: 1.5, seed: 65 },
  { id: 'water', emoji: '🌊', name: 'Water Planet', blurb: 'Islands and sea — your ride floats, slows down and paddles through the water.', coins: 1600, gravity: 9.8, grip: 1, bounce: 1, bumps: 1.25, hillLen: 1.3, trend: 0, water: -0.6, fuelBurn: 1.1, coinMul: 1.6, seed: 82 },
  { id: 'candy', emoji: '🍭', name: 'Candy Land', blurb: 'Everything is super bouncy.', coins: 2000, gravity: 9.8, grip: 1.05, bounce: 1.55, bumps: 1.1, hillLen: 0.9, trend: 0.8, water: null, fuelBurn: 1, coinMul: 1.6, seed: 97 },
  { id: 'moon', emoji: '🌕', name: 'The Moon', blurb: 'Low gravity — giant, floaty jumps. Land on your wheels!', coins: 2600, gravity: 3.4, grip: 0.9, bounce: 1.1, bumps: 1.5, hillLen: 1.2, trend: 0.5, water: null, fuelBurn: 0.9, coinMul: 2, seed: 111 },
  { id: 'sun', emoji: '☀️', name: 'The Sun', blurb: 'Heavy gravity, glowing ground, and the heat burns fuel fast.', coins: 3500, gravity: 14, grip: 1.15, bounce: 0.95, bumps: 1.0, hillLen: 1, trend: 0.75, water: null, fuelBurn: 1.45, coinMul: 2.5, seed: 131 },
];
export const worldOf = (id: string | null | undefined) => WORLDS.find((w) => w.id === id) ?? WORLDS[0];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STEP = 6; // metres between hill points

/**
 * The feel of the game in one place (tuned with a simulated driver: holding gas the whole way
 * flips over well before 300 m; easing off and braking on climbs gets much further).
 */
export const TUNE = {
  bumpStart: 1.3, // bump size at the start…
  bumpGrow: 300, // …growing by 1 m every this many metres…
  bumpMax: 3.0, // …up to this
  react: 0.55, // how much the engine twists the body back (wheelies / flipping over on climbs)
  groundTilt: 2.0, // gas / brake tipping the body while on the ground
  airTilt: 5.5, // … and in the air
  bounce: 1.25, // how hard the ground pushes back (1 = no bounce)
  springK: 170,
  springC: 4.5,
  firstCan: 150, // fuel can spacing
  canGap: 150,
  canGapGrow: 12,
};

/** The same course every run (so "Best" means something): flat to start, then hills that get bigger the further you go. */
export class Terrain {
  private pts: number[] = [];
  private rand: () => number;
  private step: number;
  readonly world: World;
  constructor(world: World = WORLDS[0]) {
    this.world = world;
    this.rand = mulberry32(world.seed);
    this.step = STEP * world.hillLen;
  }
  private point(i: number): number {
    if (i < 0) return 0;
    while (this.pts.length <= i) {
      const k = this.pts.length;
      const x = k * this.step;
      if (x < 30) {
        this.pts.push(0);
        continue;
      }
      const prev = this.pts[k - 1];
      const w = this.world;
      const size = Math.min(TUNE.bumpStart + x / TUNE.bumpGrow, TUNE.bumpMax) * w.bumps * Math.sqrt(w.hillLen); // how big the bumps get
      const trend = (Math.sin(x / 140) * 0.9 + 0.25) * w.trend; // long climbs and dips, mostly uphill
      let next = prev + trend * size * 0.6 + (this.rand() * 2 - 1) * size;
      // Water Planet: islands rising out of the sea, never too far above or below it.
      if (w.water != null) next = Math.max(w.water - 2.2, Math.min(w.water + 4.5, next - (next - w.water - 1) * 0.35));
      this.pts.push(next);
    }
    return this.pts[i];
  }
  /** Ground height at x (a smooth Catmull-Rom curve through the points). */
  h(x: number): number {
    const f = x / this.step;
    const i = Math.floor(f);
    const t = f - i;
    const p0 = this.point(i - 1);
    const p1 = this.point(i);
    const p2 = this.point(i + 1);
    const p3 = this.point(i + 2);
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  }
  slope(x: number): number {
    return (this.h(x + 0.05) - this.h(x - 0.05)) / 0.1;
  }
}

// ---------- things to pick up ----------

export interface Pickup {
  kind: 'coin' | 'fuel';
  x: number;
  y: number;
  value: number;
  taken: boolean;
}

export function placePickups(t: Terrain, upTo: number, into: Pickup[], from: number): number {
  const rand = mulberry32(Math.floor(from) + 99);
  let x = from;
  while (x < upTo) {
    // A row of coins every 35–60 m; more valuable the further you get.
    const value = Math.round((x > 1500 ? 25 : x > 600 ? 10 : 5) * t.world.coinMul);
    for (let k = 0; k < 5; k++) {
      const cx = x + k * 1.4;
      const ground = t.h(cx);
      into.push({ kind: 'coin', x: cx, y: Math.max(ground, t.world.water ?? -Infinity) + 1.1, value, taken: false });
    }
    x += 35 + rand() * 25;
  }
  return x;
}

/** Fuel cans: further apart the further you go. */
export function fuelSpots(upTo: number): number[] {
  const out: number[] = [];
  let x = TUNE.firstCan;
  let gap = TUNE.canGap;
  while (x < upTo) {
    out.push(x);
    gap += TUNE.canGapGrow;
    x += gap;
  }
  return out;
}

// ---------- the car ----------

interface Wheel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number; // rad/s, + = rolling forward (to the right)
  angle: number; // for drawing the spokes
  ground: boolean;
  ax: number; // anchor on the body (body coordinates)
  ay: number;
}

export interface Car {
  x: number;
  y: number;
  a: number; // body angle, + = nose up
  vx: number;
  vy: number;
  w: number;
  wheels: [Wheel, Wheel];
  /** How long it's been standing on its tail / lying on its back (over 1 s = tipped over). */
  tipped: number;
}

export const WHEEL_R = 0.42;
const M = 1.6; // body
const I = 0.75;
const MW = 0.3; // each wheel
const IW = 0.5 * MW * WHEEL_R * WHEEL_R;
/** The driver's head, in body coordinates, and its size. */
export const HEAD = { x: -0.15, y: 0.95, r: 0.36 };
/** Corners of the body that can scrape the ground. */
const BODY_PTS = [
  { x: -1.35, y: -0.1 },
  { x: 1.35, y: -0.1 },
  { x: -1.3, y: 0.45 },
  { x: 1.3, y: 0.45 },
];

export function newCar(t: Terrain, x = 6): Car {
  const y = t.h(x) + WHEEL_R + 0.75;
  const wheel = (ax: number): Wheel => ({ x: x + ax, y: y - 0.5, vx: 0, vy: 0, spin: 0, angle: 0, ground: false, ax, ay: -0.5 });
  return { x, y, a: 0, vx: 0, vy: 0, w: 0, wheels: [wheel(-1.05), wheel(1.05)], tipped: 0 };
}

export interface Stats {
  torque: number;
  maxSpeed: number;
  grip: number;
  k: number;
  c: number;
  tank: number;
  g: number;
  bounce: number;
  water: number | null;
}

export function statsFor(u: Upgrades, world: World = WORLDS[0]): Stats {
  return {
    torque: 1.7 * (1 + 0.22 * u.engine) * Math.max(1, world.gravity / 9.8), // enough pull for heavy gravity
    maxSpeed: 13 + 2.6 * u.engine,
    grip: (0.95 + 0.14 * u.tires) * world.grip,
    g: world.gravity,
    bounce: TUNE.bounce * world.bounce,
    water: world.water,
    k: TUNE.springK + 25 * u.springs,
    c: TUNE.springC + 1.1 * u.springs, // better springs: less bouncy
    tank: 100 * (1 + 0.25 * u.tank),
  };
}

const rot = (car: Car, lx: number, ly: number) => {
  const c = Math.cos(car.a);
  const s = Math.sin(car.a);
  return { x: car.x + lx * c - ly * s, y: car.y + lx * s + ly * c };
};
export const bodyPoint = rot;

/** Push the body at world point (px, py) by impulse (jx, jy). */
function impulse(car: Car, px: number, py: number, jx: number, jy: number) {
  car.vx += jx / M;
  car.vy += jy / M;
  car.w += ((px - car.x) * jy - (py - car.y) * jx) / I;
}

export interface StepResult {
  crashed: boolean;
  grounded: boolean;
}

/**
 * One small step (dt ≈ 1/240 s). `pedal`: +1 gas, −1 brake / reverse, 0 nothing. `fuel`: whether
 * there's any left (no fuel → no engine).
 */
export function step(car: Car, t: Terrain, s: Stats, pedal: number, fuel: boolean, dt: number): StepResult {
  const drive = fuel ? pedal : 0;
  // Gravity.
  const G = s.g;
  car.vy -= G * dt;
  for (const wh of car.wheels) wh.vy -= G * dt;

  // 🌊 Water: below sea level things float up, slow down, and the engine paddles a little.
  if (s.water != null) {
    const sink = (y: number) => Math.min(Math.max(s.water! - y, 0), 1.2);
    const d = sink(car.y);
    if (d > 0) {
      car.vy += d * 13 * dt;
      car.vx *= Math.exp(-1.4 * d * dt);
      car.vy *= Math.exp(-1.8 * d * dt);
      car.w *= Math.exp(-2 * d * dt);
      car.vx += drive * 2.2 * d * dt;
    }
    for (const wh of car.wheels) {
      const dw = sink(wh.y);
      if (dw > 0) {
        wh.vy += dw * 10 * dt;
        wh.vx *= Math.exp(-1.2 * dw * dt);
      }
    }
  }

  // Springs between the body and each wheel.
  for (const wh of car.wheels) {
    const p = rot(car, wh.ax, wh.ay);
    const pvx = car.vx - car.w * (p.y - car.y);
    const pvy = car.vy + car.w * (p.x - car.x);
    const fx = -s.k * (wh.x - p.x) - s.c * (wh.vx - pvx);
    const fy = -s.k * (wh.y - p.y) - s.c * (wh.vy - pvy);
    wh.vx += (fx / MW) * dt;
    wh.vy += (fy / MW) * dt;
    impulse(car, p.x, p.y, -fx * dt, -fy * dt);
  }

  // Engine and brakes turn the wheels.
  const maxSpin = s.maxSpeed / WHEEL_R;
  for (const wh of car.wheels) {
    if (drive > 0) {
      if (wh.spin < maxSpin) {
        wh.spin += ((drive * s.torque) / IW) * dt;
        // The wheels push back on the body: accelerating lifts the nose (and can flip you over).
        if (wh.ground) car.w += ((TUNE.react * drive * s.torque) / I) * dt;
      }
    } else if (drive < 0) {
      if (wh.spin > 0.5) wh.spin = Math.max(0, wh.spin * Math.exp(-12 * dt) - 30 * dt); // brake — firmly
      else if (wh.spin > -maxSpin * 0.35) wh.spin -= ((s.torque * 0.6) / IW) * dt; // reverse, slower
    } else {
      wh.spin *= Math.exp(-0.25 * dt); // rolling slowly to a stop
    }
  }
  if (!fuel && pedal < 0) for (const wh of car.wheels) wh.spin *= Math.exp(-6 * dt); // brakes work without fuel

  // Tilt: gas = nose up, brake = nose down. A lot in the air, a little on the ground (wheelies).
  const grounded = car.wheels.some((wh) => wh.ground);
  car.w += pedal * (grounded ? TUNE.groundTilt : TUNE.airTilt) * dt * (fuel || !grounded ? 1 : 0);
  car.w *= Math.exp(-(grounded ? 0.6 : 0.25) * dt);

  // Move.
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.a += car.w * dt;
  for (const wh of car.wheels) {
    wh.x += wh.vx * dt;
    wh.y += wh.vy * dt;
    wh.angle -= wh.spin * dt;
  }

  // Wheels on the ground: push out, stop sinking, grip (or slip).
  for (const wh of car.wheels) {
    const sl = t.slope(wh.x);
    const len = Math.hypot(1, sl);
    const nx = -sl / len;
    const ny = 1 / len;
    const d = (wh.y - t.h(wh.x)) / len; // distance from the ground, roughly
    wh.ground = d < WHEEL_R + 0.02;
    if (d >= WHEEL_R) continue;
    wh.x += nx * (WHEEL_R - d);
    wh.y += ny * (WHEEL_R - d);
    const vn = wh.vx * nx + wh.vy * ny;
    let jn = 0;
    if (vn < 0) {
      jn = -vn * MW * s.bounce;
      wh.vx += (nx * jn) / MW;
      wh.vy += (ny * jn) / MW;
    }
    // Friction along the ground, against the tire slipping (wheel speed vs ground speed).
    const tx = ny;
    const ty = -nx;
    const vt = wh.vx * tx + wh.vy * ty;
    const slip = vt - wh.spin * WHEEL_R;
    const meff = 1 / (1 / MW + (WHEEL_R * WHEEL_R) / IW);
    const limit = s.grip * (jn + MW * G * ny * dt + 0.6 * MW * G * dt);
    const jt = Math.max(-limit, Math.min(limit, -slip * meff));
    wh.vx += (tx * jt) / MW;
    wh.vy += (ty * jt) / MW;
    wh.spin -= (jt * WHEEL_R) / IW;
  }

  // The body scraping the ground.
  for (const bp of BODY_PTS) {
    const p = rot(car, bp.x, bp.y);
    const gh = t.h(p.x);
    if (p.y >= gh) continue;
    const sl = t.slope(p.x);
    const len = Math.hypot(1, sl);
    const nx = -sl / len;
    const ny = 1 / len;
    const pen = (gh - p.y) / len;
    car.x += nx * pen;
    car.y += ny * pen;
    const pvx = car.vx - car.w * (p.y - car.y);
    const pvy = car.vy + car.w * (p.x - car.x);
    const vn = pvx * nx + pvy * ny;
    if (vn < 0) {
      const tx = ny;
      const ty = -nx;
      const vt = pvx * tx + pvy * ty;
      impulse(car, p.x, p.y, (-vn * nx - vt * 0.3 * tx) * M * 0.5, (-vn * ny - vt * 0.3 * ty) * M * 0.5);
    }
  }

  // The driver's head touching the ground = the end.
  const head = rot(car, HEAD.x, HEAD.y);
  // Standing on its tail or lying on its back (turned 90°+ from the ground) for a second: tipped over.
  const rel = Math.atan2(Math.sin(car.a - Math.atan(t.slope(car.x))), Math.cos(car.a - Math.atan(t.slope(car.x))));
  const nearGround = car.y - t.h(car.x) < 2.2;
  car.tipped = Math.abs(rel) > 1.5 && nearGround ? car.tipped + dt : 0;
  const crashed = head.y - HEAD.r * 0.7 < t.h(head.x) || car.tipped > 1;
  return { crashed, grounded };
}
