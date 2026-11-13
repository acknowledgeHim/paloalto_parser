/**
 * ⚠️ Optional obstacles for some Hill Hopper worlds ("Add obstacles" in the garage):
 *  - 🦖 Dino Land: big dinosaurs stand on the road and jump up and down. Drive under one while it's
 *    up in the air; if it lands on you (or you drive into it) you're squashed.
 *  - 🌕 The Moon: aliens in a flying saucer follow you and fire zappers. It glows before each shot
 *    and aims where you're heading, so change speed (gas or brake) when you see the glow.
 *  - 🥚 With 🦘 Jump on too, Dino Land has dino eggs on the road: hop over them (+3). Squash
 *    EGG_LIMIT of them and the next dinosaur you get under turns round and chases you for CHASE_TIME
 *    seconds, jumping at you. Outrun it (or dodge its landings) and it gives up (+20).
 *  - Every other world has its own critters (CRITTERS below), each with a warning first: they
 *    pop up out of the ground (🐹 🦂 🐧 🔥 — go past while they're down), bounce (🍬 — go under while
 *    it's up), leap out of the sea (🦈 — go past while it's under), or drop from the trees (🐒 🥥 —
 *    speed up or slow down when you see the 🎯). Bumping one costs a 🛡️ shield (3 a run).
 * No drawing here (HillHopperRun draws them), so the driver test can use it too.
 */
import { HEAD, type Car, type Terrain, type World } from './hillPhysics.js';

/** Worlds that have obstacles, and what they're called in the garage. */
export const HAZARD_WORLDS: Record<string, { emoji: string; text: string }> = {
  dino: { emoji: '🦖', text: 'Jumping dinosaurs — drive under them while they’re in the air, don’t get squashed!' },
  moon: { emoji: '👽', text: 'Aliens in a flying saucer shoot zappers — when it glows, speed up or slow down!' },
  hills: { emoji: '🐹', text: 'Gophers pop out of their holes — drive past while they’re down (the dirt shakes first)!' },
  desert: { emoji: '🦂', text: 'Scorpions pop up out of the sand — go past while they’re hiding!' },
  jungle: { emoji: '🐒', text: 'Monkeys drop coconuts from the trees — when you see the 🎯, speed up or slow down!' },
  ice: { emoji: '🐧', text: 'Penguins pop out of ice holes — go past while they’re underwater (bubbles come first)!' },
  water: { emoji: '🦈', text: 'Sharks leap out of the sea — when the fin splashes, wait, then go!' },
  candy: { emoji: '🍬', text: 'Giant gumdrops bounce on the road — zoom under while they’re up high!' },
  sun: { emoji: '🔥', text: 'Flames shoot up out of glowing cracks — go past while they’re out!' },
};

/** A world's critters: how they move, how big, how often (seconds), and how far apart (m). */
export interface CritterKind {
  move: 'pop' | 'bounce' | 'leap';
  emoji: string;
  /** how tall (m) when up, and half as wide */
  h: number;
  halfW: number;
  down: [number, number];
  warn: number;
  up: number;
  gap: [number, number];
  /** 🪙 for getting past one */
  coins: number;
}
export const CRITTERS: Record<string, CritterKind> = {
  // down long enough to get going from a stop just short of it and clear it (~2.2 s with no upgrades)
  hills: { move: 'pop', emoji: '🐹', h: 1.2, halfW: 0.6, down: [2.8, 3.8], warn: 0.8, up: 1.3, gap: [70, 120], coins: 5 },
  desert: { move: 'pop', emoji: '🦂', h: 1.0, halfW: 0.7, down: [2.8, 3.8], warn: 0.8, up: 1.4, gap: [70, 120], coins: 5 },
  ice: { move: 'pop', emoji: '🐧', h: 1.4, halfW: 0.6, down: [3.0, 4.0], warn: 0.9, up: 1.4, gap: [70, 120], coins: 5 },
  sun: { move: 'pop', emoji: '🔥', h: 4.2, halfW: 0.8, down: [2.8, 3.6], warn: 0.9, up: 1.1, gap: [65, 110], coins: 6 },
  candy: { move: 'bounce', emoji: '🍬', h: 1.3, halfW: 0.8, down: [0.5, 0.8], warn: 0, up: 0, gap: [70, 120], coins: 8 },
  water: { move: 'leap', emoji: '🦈', h: 1.4, halfW: 1.0, down: [3.2, 4.2], warn: 0.7, up: 1.2, gap: [50, 90], coins: 6 },
};
const GUMDROP_UP = 10.5; // m/s off the ground: ~5.6 m high, ~2.1 s in the air (~1.7 s above the car)
const SHARK_ARC = { half: 2.6, high: 2.8 };
const NUT_HEIGHT = 7.5; // how high above the ground the monkey drops it from

export interface Critter {
  x: number;
  phase: 'down' | 'warn' | 'up';
  /** seconds left in this phase */
  t: number;
  /** bounce: height off the ground and speed */
  y: number;
  vy: number;
  passed: boolean;
}
/** 🐒 the monkey up in the trees, and the coconuts it's dropped */
export interface Dropper {
  x: number;
  y: number;
  next: number;
  charge: number;
  aim: { x: number; y: number } | null;
  nuts: Array<{ x: number; y: number; vy: number; done: boolean }>;
}

/** Where a 🦈 is (m, from its home spot and sea level) while it's leaping: p = 0…1 through the leap. */
export function sharkAt(c: Critter, kind: CritterKind, sea: number) {
  const p = c.phase === 'up' ? 1 - c.t / kind.up : 0;
  return { x: c.x - SHARK_ARC.half + 2 * SHARK_ARC.half * p, y: sea + Math.sin(Math.PI * p) * SHARK_ARC.high - 0.4, p };
}
/** More coins for driving with obstacles on. */
export const HAZARD_COINS = 1.5;
/** ⚠️ ×N obstacles (1–10, picked in the garage): N times as many — and more coins for it */
export const MAX_MANY = 10;
export const hazardCoins = (many = 1) => Math.round((HAZARD_COINS + 0.15 * (Math.max(1, many) - 1)) * 100) / 100;

export const DINO = { halfW: 1.7, h: 3.2 };
const DINO_G = 8;
const DINO_UP = 11; // jump speed: ~2.75 s in the air, ~7.5 m up
export const CROUCH = 0.45; // seconds it crouches before a jump (a warning)
const BOLT_SPEED = 7;
export const EGG_LIMIT = 3;
export const CHASE_TIME = 10;
const CHASE_SPEED = 7; // m/s — slower than a car going flat out, faster than one dawdling
const CHARGE = 1.0; // seconds it glows before firing

export interface Dino {
  x: number;
  y: number; // how high it is off the ground (0 = standing)
  vy: number;
  wait: number; // seconds left standing before it jumps
  awake: boolean;
  passed: boolean;
  /** when it last landed (for a little ground shake) */
  landed: number;
  /** 😡 seconds left chasing you (after you squashed too many eggs) */
  chase: number;
}
export interface Egg {
  x: number;
  broken: boolean;
  passed: boolean;
}
export interface Bolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
}
export interface Saucer {
  x: number;
  y: number;
  t: number; // time
  next: number; // seconds until it starts glowing for the next shot
  charge: number; // > 0 while glowing (seconds left)
  /** where the shot will land: picked when it starts glowing (shown on the ground as a target) */
  aim: { x: number; y: number } | null;
  bolts: Bolt[];
}

export type HazardHit = 'squashed' | 'zapped' | 'bumped' | null;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** The points of the car that can be hit: body corners, middle, and the driver's head. */
function carPoints(car: Car) {
  const c = Math.cos(car.a);
  const s = Math.sin(car.a);
  const at = (x: number, y: number) => ({ x: car.x + x * c - y * s, y: car.y + x * s + y * c });
  return [at(-1.35, -0.1), at(1.35, -0.1), at(-1.2, 0.5), at(1.2, 0.5), at(0, 0.2), at(HEAD.x, HEAD.y + HEAD.r)];
}

export class Hazards {
  dinos: Dino[] = [];
  eggs: Egg[] = [];
  /** eggs squashed since the last chase, and whether the next dinosaur is angry */
  eggsBroken = 0;
  angry = false;
  saucer: Saucer | null = null;
  /** this world's critters (CRITTERS), if it has them */
  readonly kind: CritterKind | null;
  critters: Critter[] = [];
  dropper: Dropper | null = null;
  /** 🛡️ zaps you can take on the Moon before it's over, and a moment of safety after each */
  shields = 3;
  private safeUntil = 0;
  private rand: () => number;
  private placedTo: number;
  time = 0;

  constructor(
    private world: World,
    private terrain: Terrain,
    startX: number,
    /** 🥚 eggs on the road (Dino Land with 🦘 Jump on) */
    readonly withEggs = false,
    /** ⚠️ ×N as many obstacles (gaps ÷ N, never too close together) */
    readonly many = 1
  ) {
    this.rand = rng(world.seed * 31 + 5);
    this.placedTo = startX + 70;
    if (world.id === 'moon') this.saucer = { x: startX + 10, y: terrain.h(startX) + 9, t: 0, next: 4, charge: 0, aim: null, bolts: [] };
    if (world.id === 'jungle') this.dropper = { x: startX + 12, y: terrain.h(startX) + NUT_HEIGHT, next: 5, charge: 0, aim: null, nuts: [] };
    this.kind = CRITTERS[world.id] ?? null;
  }

  /** Lost a 🛡️ (or the last one). */
  private bump(why: string): { over: boolean; say: string } | null {
    if (this.time < this.safeUntil) return null;
    this.shields--;
    if (this.shields <= 0) return { over: true, say: why };
    this.safeUntil = this.time + 1.5;
    return { over: false, say: `${why} 🛡️ ${this.shields} left` };
  }

  private between(r: [number, number]) {
    return r[0] + this.rand() * (r[1] - r[0]);
  }

  /** 🐹 🦂 🐧 🔥 🍬 🦈 */
  private updateCritters(car: Car, dt: number, pts: Array<{ x: number; y: number }>): { hit: boolean; coins: number; say?: string } {
    const k = this.kind!;
    const sea = this.world.water ?? 0;
    let coins = 0;
    let say: string | undefined;
    while (this.placedTo < car.x + 120) {
      this.placedTo += Math.max(12, this.between(k.gap) / this.many);
      if (k.move === 'leap') {
        // 🦈 only out at sea: somewhere the water's deep enough on both sides of the leap
        let tries = 0;
        const deep = (x: number) => [-3, -1.5, 0, 1.5, 3].every((dx) => this.terrain.h(x + dx) < sea - 0.5);
        while (tries++ < 120 && !deep(this.placedTo)) this.placedTo += 2;
        if (!deep(this.placedTo)) continue;
      } else {
        for (let tries = 0; tries < 60 && !this.flat(this.placedTo); tries++) this.placedTo += 1.5;
      }
      this.critters.push({ x: this.placedTo, phase: 'down', t: this.between(k.down), y: 0, vy: 0, passed: false });
    }
    for (const c of this.critters) {
      if (c.x < car.x - 40) continue;
      if (k.move === 'bounce') {
        if (c.y <= 0 && c.vy <= 0) {
          c.t -= dt;
          if (c.t <= 0) c.vy = GUMDROP_UP;
        } else {
          c.vy -= this.world.gravity * dt;
          c.y += c.vy * dt;
          if (c.y <= 0) {
            c.y = 0;
            c.vy = 0;
            c.t = this.between(k.down);
          }
        }
      } else if (c.x - car.x < 50) {
        c.t -= dt;
        if (c.t <= 0) {
          if (c.phase === 'down') {
            c.phase = 'warn';
            c.t = k.warn;
          } else if (c.phase === 'warn') {
            c.phase = 'up';
            c.t = k.up;
          } else {
            c.phase = 'down';
            c.t = this.between(k.down);
          }
        }
      }
      // touching it?
      let touching = false;
      if (k.move === 'leap') {
        if (c.phase === 'up') {
          const at = sharkAt(c, k, sea);
          touching = pts.some((p) => Math.hypot(p.x - at.x, p.y - at.y) < k.halfW);
        }
      } else {
        const gy = this.terrain.h(c.x);
        const base = gy + (k.move === 'bounce' ? c.y : 0);
        const up = k.move === 'bounce' || c.phase === 'up';
        touching = up && pts.some((p) => Math.abs(p.x - c.x) < k.halfW && p.y > base - 0.05 && p.y < base + k.h);
      }
      if (touching) {
        const b = this.bump(`${k.emoji} Bumped!`);
        if (b?.over) return { hit: true, coins };
        if (b) say = b.say;
      }
      if (!c.passed && car.x > c.x + k.halfW + 1.6) {
        c.passed = true;
        coins += k.coins;
        say ??= `${k.emoji} Got past! +${k.coins}`;
      }
    }
    if (this.critters.length > 8) this.critters = this.critters.filter((c) => c.x > car.x - 40);
    return { hit: false, coins, say };
  }

  /** 🐒 🥥 */
  private updateDropper(car: Car, dt: number, pts: Array<{ x: number; y: number }>): { hit: boolean; coins: number; say?: string } {
    const m = this.dropper!;
    let coins = 0;
    let say: string | undefined;
    // It swings along the treetops a bit ahead of you — or to where it's aiming.
    const tx = m.aim ? m.aim.x : car.x + 5 + 4 * Math.sin(this.time * 0.5);
    const ty = this.terrain.h(tx) + NUT_HEIGHT;
    const f = Math.min(1, dt * (m.aim ? 5 : 2));
    m.x += (tx - m.x) * f;
    m.y += (ty - m.y) * f;
    if (m.charge > 0) {
      m.charge -= dt;
      if (m.charge <= 0 && m.aim) {
        m.nuts.push({ x: m.aim.x, y: this.terrain.h(m.aim.x) + NUT_HEIGHT - 0.5, vy: 0, done: false });
        m.aim = null;
        m.next = Math.max(0.7, (2.2 + this.rand() * 1.8) / Math.sqrt(this.many));
      }
    } else if (car.x > 40) {
      m.next -= dt;
      if (m.next <= 0) {
        // 🎯 where you'll be when it lands, if you keep going the same speed
        m.charge = CHARGE;
        const fall = Math.sqrt((2 * (NUT_HEIGHT - 0.5)) / this.world.gravity);
        const ax = car.x + Math.max(0, car.vx) * (CHARGE + fall);
        m.aim = { x: ax, y: this.terrain.h(ax) };
      }
    }
    for (const n of m.nuts) {
      if (n.done) continue;
      n.vy -= this.world.gravity * dt;
      n.y += n.vy * dt;
      if (pts.some((p) => Math.hypot(p.x - n.x, p.y - n.y) < 0.55)) {
        n.done = true;
        const b = this.bump('🥥 Bonk!');
        if (b?.over) return { hit: true, coins };
        if (b) say = b.say;
      } else if (n.y < this.terrain.h(n.x) + 0.2) {
        n.done = true;
        coins += 5;
        say ??= '🐒 Missed you! +5';
      }
    }
    m.nuts = m.nuts.filter((n) => !n.done);
    return { hit: false, coins, say };
  }

  private flat(x: number) {
    for (let dx = -10; dx <= 6; dx += 2) if (Math.abs(this.terrain.slope(x + dx)) > 0.2) return false;
    return true;
  }

  /** One small step. Returns what hit the car (if anything) and coins earned for dodging. */
  /** Flashing after a zap (for drawing). */
  get shielding() {
    return this.time < this.safeUntil;
  }

  update(car: Car, dt: number, startX: number): { hit: HazardHit; coins: number; say?: string } {
    this.time += dt;
    let coins = 0;
    let say: string | undefined;
    const pts = carPoints(car);

    if (this.world.id === 'dino') {
      // More dinosaurs further along the road (110–190 m apart).
      while (this.placedTo < car.x + 120) {
        const prev = this.placedTo;
        this.placedTo += Math.max(30, (110 + this.rand() * 80) / this.many);
        // Somewhere flat-ish, so you can get going again after waiting for it to jump.
        for (let tries = 0; tries < 80 && !this.flat(this.placedTo); tries++) this.placedTo += 1.5;
        this.dinos.push({ x: this.placedTo, y: 0, vy: 0, wait: 0.6 + this.rand() * 1.6, awake: false, passed: false, landed: -9, chase: 0 });
        // 🥚 eggs between the dinosaurs, on gentle ground, not right next to one
        if (this.withEggs)
          for (let x = prev + 22 + this.rand() * 10; x < this.placedTo - 16; x += 14 + this.rand() * 18)
            if (Math.abs(this.terrain.slope(x)) < 0.35) this.eggs.push({ x, broken: false, passed: false });
      }
      // 🥚 squashed, or hopped over?
      for (const e of this.eggs) {
        if (e.broken || e.passed || Math.abs(e.x - car.x) > 4) continue;
        const gy = this.terrain.h(e.x);
        if (car.wheels.some((w) => Math.abs(w.x - e.x) < 0.5 && w.y - gy < 0.42 + 0.35)) {
          e.broken = true;
          this.eggsBroken++;
          if (this.eggsBroken >= EGG_LIMIT && !this.angry) {
            this.angry = true;
            say = `🥚 ${EGG_LIMIT} eggs squashed — the next 🦖 is ANGRY!`;
          } else if (!this.angry) say = `🥚 Squashed an egg! (${this.eggsBroken}/${EGG_LIMIT})`;
        } else if (car.x - 1.7 > e.x) {
          e.passed = true;
          coins += 3;
          say = '🥚 Hopped it! +3';
        }
      }
      if (this.eggs.length > 30) this.eggs = this.eggs.filter((e) => e.x > car.x - 40);
      for (const d of this.dinos) {
        if (d.x < car.x - 40 && d.chase <= 0) continue;
        if (!d.awake && d.x - car.x < 45) d.awake = true; // starts jumping once you're getting close
        if (d.chase > 0) {
          // 😡 Chasing: runs after you (faster while leaping) and jumps more often.
          d.chase -= dt;
          const gap = car.x - d.x;
          d.x += Math.sign(gap) * Math.min(Math.abs(gap), CHASE_SPEED * (d.y > 0 ? 1 : 0.7) * dt);
          if (d.chase <= 0) {
            d.chase = 0;
            coins += 20;
            say = '🦖 It gave up! +20';
          }
        }
        if (d.awake) {
          if (d.y <= 0 && d.vy <= 0) {
            d.wait -= dt;
            if (d.wait <= 0) d.vy = DINO_UP;
          } else {
            d.vy -= DINO_G * dt;
            d.y += d.vy * dt;
            if (d.y <= 0) {
              d.y = 0;
              d.vy = 0;
              d.wait = d.chase > 0 ? 0.35 + this.rand() * 0.35 : 1.0 + this.rand() * 0.9;
              d.landed = this.time;
            }
          }
        }
        const base = this.terrain.h(d.x) + d.y;
        for (const p of pts) {
          if (Math.abs(p.x - d.x) < DINO.halfW && p.y > base - 0.05 && p.y < base + DINO.h) return { hit: 'squashed', coins };
        }
        if (!d.passed && car.x > d.x + DINO.halfW + 1.5) {
          d.passed = true;
          coins += 15;
          say = '🦖 Made it under! +15';
          if (this.angry) {
            // 😡 Too many eggs: this one turns round and comes after you.
            this.angry = false;
            this.eggsBroken = 0;
            d.chase = CHASE_TIME;
            say = `🦖 Uh-oh — it’s chasing you! Get away for ${CHASE_TIME} s!`;
          }
        }
      }
      if (this.dinos.length > 6) this.dinos = this.dinos.filter((d) => d.x > car.x - 40 || d.chase > 0);
    }

    if (this.kind) {
      const r = this.updateCritters(car, dt, pts);
      coins += r.coins;
      say = r.say ?? say;
      if (r.hit) return { hit: 'bumped', coins };
    }
    if (this.dropper) {
      const r = this.updateDropper(car, dt, pts);
      coins += r.coins;
      say = r.say ?? say;
      if (r.hit) return { hit: 'bumped', coins };
    }

    const u = this.saucer;
    let zappedNow = false;
    if (u && car.x - startX > 40) {
      u.t += dt;
      // It hovers above you and a bit ahead, drifting back and forth.
      const tx = car.x + 3 + 6 * Math.sin(u.t * 0.45);
      const ty = Math.max(this.terrain.h(tx), car.y) + 5.2 + Math.sin(u.t * 1.3) * 0.4;
      const k = Math.min(1, dt * 2.2);
      u.x += (tx - u.x) * k;
      u.y += (ty - u.y) * k;
      if (u.charge > 0) {
        u.charge -= dt;
        if (u.charge <= 0 && u.aim) {
          const d = Math.hypot(u.aim.x - u.x, u.aim.y - u.y) || 1;
          u.bolts.push({ x: u.x, y: u.y - 0.6, vx: ((u.aim.x - u.x) / d) * BOLT_SPEED, vy: ((u.aim.y - u.y) / d) * BOLT_SPEED, age: 0 });
          u.aim = null;
          u.next = Math.max(0.7, (2.0 + this.rand() * 1.6) / Math.sqrt(this.many));
        }
      } else {
        u.next -= dt;
        if (u.next <= 0) {
          // 🎯 It starts glowing and picks a spot: where you'll be when the shot gets there, if you
          // keep going the same speed. Speed up or slow down and it misses.
          u.charge = CHARGE;
          let ax = car.x;
          for (let i = 0; i < 4; i++) {
            const ay = this.terrain.h(ax) + 0.6;
            const tof = Math.hypot(ax - u.x, ay - u.y) / BOLT_SPEED;
            ax = car.x + Math.max(0, car.vx) * (CHARGE + tof);
          }
          u.aim = { x: ax, y: this.terrain.h(ax) + 0.4 };
        }
      }
      for (const b of u.bolts) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.age += dt;
        if (b.age < 0 || !pts.some((p) => Math.hypot(p.x - b.x, p.y - b.y) < 0.45)) continue;
        b.age = 99; // used up
        if (this.time < this.safeUntil) continue;
        this.shields--;
        if (this.shields <= 0) return { hit: 'zapped', coins };
        this.safeUntil = this.time + 1.5;
        say = `⚡ Zapped! 🛡️ ${this.shields} left`;
        zappedNow = true;
      }
      const before = u.bolts.length;
      u.bolts = u.bolts.filter((b) => b.age < 4 && b.y > this.terrain.h(b.x) - 0.2);
      if (u.bolts.length < before && !zappedNow) {
        coins += 5 * (before - u.bolts.length);
        say ??= '👽 Missed you! +5';
      }
    }
    return { hit: null, coins, say };
  }
}
