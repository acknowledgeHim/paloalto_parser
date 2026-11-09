/**
 * ⚠️ Optional obstacles for some Hill Hopper worlds ("Add obstacles" in the garage):
 *  - 🦖 Dino Land: big dinosaurs stand on the road and jump up and down. Drive under one while it's
 *    up in the air; if it lands on you (or you drive into it) you're squashed.
 *  - 🌕 The Moon: aliens in a flying saucer follow you and fire zappers. It glows before each shot
 *    and aims where you're heading, so change speed (gas or brake) when you see the glow.
 *  - 🥚 With 🦘 Jump on too, Dino Land has dino eggs on the road: hop over them (+3). Squash
 *    EGG_LIMIT of them and the next dinosaur you get under turns round and chases you for CHASE_TIME
 *    seconds, jumping at you. Outrun it (or dodge its landings) and it gives up (+20).
 * No drawing here (HillHopperRun draws them), so the driver test can use it too.
 */
import { HEAD, type Car, type Terrain, type World } from './hillPhysics.js';

/** Worlds that have obstacles, and what they're called in the garage. */
export const HAZARD_WORLDS: Record<string, { emoji: string; text: string }> = {
  dino: { emoji: '🦖', text: 'Jumping dinosaurs — drive under them while they’re in the air, don’t get squashed!' },
  moon: { emoji: '👽', text: 'Aliens in a flying saucer shoot zappers — when it glows, speed up or slow down!' },
};
/** More coins for driving with obstacles on. */
export const HAZARD_COINS = 1.5;

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

export type HazardHit = 'squashed' | 'zapped' | null;

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
    readonly withEggs = false
  ) {
    this.rand = rng(world.seed * 31 + 5);
    this.placedTo = startX + 70;
    if (world.id === 'moon') this.saucer = { x: startX + 10, y: terrain.h(startX) + 9, t: 0, next: 4, charge: 0, aim: null, bolts: [] };
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
        this.placedTo += 110 + this.rand() * 80;
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
          u.next = 2.0 + this.rand() * 1.6;
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
