import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  bodyPoint,
  fuelSpots,
  HEAD,
  newCar,
  placePickups,
  statsFor,
  step,
  Terrain,
  WHEEL_R,
  type Car,
  type Pickup,
  type Upgrades,
  type World,
} from './hillPhysics.js';
import { CROUCH, DINO, EGG_LIMIT, HAZARD_COINS, HAZARD_WORLDS, Hazards, sharkAt } from './hillHazards.js';

export interface Driver {
  id: string;
  name: string;
  color: string;
  avatar: string | null;
  hat: string | null;
  /** 🎈 what they hold (Dress up → In their hand), drawn beside the head */
  hand?: string | null;
}

/** How gas and brake are worked: keys (each a KeyboardEvent.key, lower case) and the mouse. */
export interface Controls {
  gasKeys: string[];
  brakeKeys: string[];
  /** 🦘 keys that jump (when Jump is on); old saves don't have it → Space */
  jumpKeys?: string[];
  /** 🦘 how the mouse / a finger jumps: tap the middle of the game, an on-screen JUMP button, the
   *  middle mouse button (wheel click), or keys only. Old saves don't have it → middle. */
  jumpTap?: JumpTap;
  /** pedals: only the on-screen pedals · buttons: left button = gas, right = brake · sides: right half = gas, left half = brake */
  mouse: 'pedals' | 'buttons' | 'sides';
}
export const DEFAULT_CONTROLS: Controls = { gasKeys: ['arrowright', 'd'], brakeKeys: ['arrowleft', 'a'], jumpKeys: [' '], mouse: 'pedals' };
export const jumpKeysOf = (c: Controls) => c.jumpKeys ?? [' '];
export type JumpTap = 'middle' | 'button' | 'wheel' | 'none';
export const jumpTapOf = (c: Controls): JumpTap => c.jumpTap ?? 'middle';
export const JUMP_TAP_LABEL: Record<JumpTap, string> = {
  middle: 'Tap / click the middle of the game',
  button: 'An on-screen 🦘 JUMP button (between the pedals)',
  wheel: 'The middle mouse button (click the scroll wheel)',
  none: 'Keys only',
};
/** What the run's "how to jump" hint says for the mouse / touch part. */
const jumpTapHint: Record<JumpTap, string> = { middle: 'tap the middle', button: 'tap JUMP', wheel: 'click the mouse wheel', none: '' };
/** 🦘 how high a jump goes (m), whatever the gravity */
const JUMP_HEIGHT = 1.7;
/** 🦘 each Jump upgrade level: this much higher (×) */
const JUMP_PER_LEVEL = 0.25;
/** 🪂 gliding: how fast it sinks (m/s), and seconds of glide with no upgrades / per level */
const GLIDE_SINK = 1.4;
const GLIDE_TIME = 1.6;
const GLIDE_PER_LEVEL = 0.7;
/** 🦈 how far back from where it leaps its fin circles (m) */
const SHARK_FIN = 2.2;

const KEY_NAMES: Record<string, string> = { arrowright: '→', arrowleft: '←', arrowup: '↑', arrowdown: '↓', ' ': 'Space', shift: 'Shift', control: 'Ctrl', enter: 'Enter' };
export const keyName = (k: string) => KEY_NAMES[k] ?? (k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));

export interface RunResult {
  distance: number;
  coins: number;
  flips: number;
  why: 'crash' | 'tipped' | 'fuel' | 'quit' | 'squashed' | 'zapped' | 'bumped';
}

/** Vehicle pictures that already face right (most vehicle emoji face left, so they're mirrored). */
const FACES_RIGHT = new Set(['🚀', '✈️', '🛸', '🪂', '🛩️']);
const FUEL_PER_SEC = 3.5;

/** 🌍 How each world looks (its physics is in hillPhysics.ts WORLDS). */
interface Look {
  sky: [string, string];
  far: [string, string]; // two rows of far-off hills
  ground: [string, string]; // top, deep
  edge: string; // the line along the top (grass, sand…)
  orb: { color?: string; emoji?: string; glow?: boolean }; // sun / moon / planet in the sky
  stars?: boolean;
  decor: string[]; // scenery along the road
}
const LOOKS: Record<string, Look> = {
  hills: { sky: ['#6fb7ff', '#d9f0ff'], far: ['#a8d5a0', '#86c27c'], ground: ['#9b6b3d', '#6d4523'], edge: '#4caf50', orb: { color: 'rgba(255, 236, 140, 0.9)' }, decor: ['🌳', '🌲', '🌼', '🏡', '🐄'] },
  desert: { sky: ['#ffb74d', '#fff3e0'], far: ['#f0c27b', '#e6a957'], ground: ['#e9c27a', '#c8954a'], edge: '#f6d796', orb: { color: 'rgba(255, 250, 220, 0.95)', glow: true }, decor: ['🌵', '🌵', '🐪', '🦂', '🏜️'] },
  jungle: { sky: ['#4db6ac', '#c8f7e6'], far: ['#2e7d32', '#1b5e20'], ground: ['#5d4037', '#3e2723'], edge: '#2e7d32', orb: { color: 'rgba(255, 255, 200, 0.7)' }, decor: ['🌴', '🌿', '🦜', '🐒', '🌺', '🐍'] },
  ice: { sky: ['#90caf9', '#f1f8ff'], far: ['#e3f2fd', '#bbdefb'], ground: ['#cfe8ff', '#90b8de'], edge: '#ffffff', orb: { color: 'rgba(255, 255, 255, 0.9)' }, decor: ['⛄', '🐧', '🌨️', '🏔️', '🦭'] },
  dino: { sky: ['#bf360c', '#ffcc80'], far: ['#6d4c41', '#4e342e'], ground: ['#8d6e63', '#4e342e'], edge: '#7cb342', orb: { emoji: '🌋' }, decor: ['🦕', '🦖', '🌿', '🥚', '🌴'] },
  water: { sky: ['#29b6f6', '#e1f5fe'], far: ['#4fc3f7', '#0288d1'], ground: ['#f4d58d', '#c9a45c'], edge: '#ffe082', orb: { color: 'rgba(255, 245, 157, 0.95)' }, decor: ['🌴', '🐚', '🦀', '⛱️', '🐢'] },
  candy: { sky: ['#f8bbd0', '#fff0f6'], far: ['#ce93d8', '#f48fb1'], ground: ['#f06292', '#ad1457'], edge: '#fff59d', orb: { emoji: '🍬' }, decor: ['🍭', '🍬', '🧁', '🍩', '🍦'] },
  moon: { sky: ['#000010', '#1a1a2e'], far: ['#3a3a4a', '#2a2a36'], ground: ['#b0b0b0', '#6e6e6e'], edge: '#d6d6d6', orb: { emoji: '🌍' }, stars: true, decor: ['🚩', '🛰️', '👨‍🚀', '🪨'] },
  sun: { sky: ['#ff6f00', '#ffd54f'], far: ['#ff8f00', '#e65100'], ground: ['#ff7043', '#b71c1c'], edge: '#ffeb3b', orb: { emoji: '🔥' }, decor: ['🔥', '✨', '☄️', '🌟'] },
};
const DT = 1 / 240;

/**
 * ⛰️ One run of Hill Hopper on a canvas: the car, the hills, coins and fuel cans, and the HUD.
 * Gas / brake from the on-screen pedals (touch), or → / ← (also D / A) on a keyboard.
 */
export function HillHopperRun({
  driver,
  vehicle,
  upgrades,
  world,
  obstacles = false,
  jump = false,
  glide = false,
  best,
  controls,
  onEnd,
}: {
  driver: Driver;
  vehicle: string | null;
  upgrades: Upgrades;
  world: World;
  /** ⚠️ dinosaurs / aliens on (worlds in HAZARD_WORLDS only) */
  obstacles?: boolean;
  /** 🦘 jump: a key (Space) or tapping the middle of the screen */
  jump?: boolean;
  /** 🪂 glider: hold the jump key / button in the air to glide (sky coins and cans come with it) */
  glide?: boolean;
  best: number | null;
  controls: Controls;
  onEnd: (r: RunResult) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pedal = useRef({ gas: false, brake: false });
  /** 🦘 a jump asked for (when), used up by the next step on the ground */
  const jumpAsk = useRef(0);
  /** 🪂 the jump key / button is being held (glides while in the air) */
  const jumpHeld = useRef(false);
  const jumpers = useRef(new Set<number>());
  const usesJumpKey = jump || glide;
  const quit = useRef(false);
  const [, setPressed] = useState(0);

  useEffect(() => {
    const keys = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (usesJumpKey && jumpKeysOf(controls).includes(k)) {
        if (down && !e.repeat) jumpAsk.current = performance.now();
        jumpHeld.current = down;
        e.preventDefault();
        return;
      }
      if (controls.gasKeys.includes(k)) pedal.current.gas = down;
      else if (controls.brakeKeys.includes(k)) pedal.current.brake = down;
      else return;
      e.preventDefault();
      setPressed((n) => n + 1);
    };
    const kd = keys(true);
    const ku = keys(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    // Let go of everything if the window loses focus (a key-up would never arrive).
    const blur = () => {
      pedal.current.gas = false;
      pedal.current.brake = false;
      jumpHeld.current = false;
    };
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
  }, [controls, jump, glide]);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const terrain = new Terrain(world);
    const stats = statsFor(upgrades, world);
    const look = LOOKS[world.id] ?? LOOKS.hills;
    const starField = Array.from({ length: 70 }, (_, i) => [((i * 7919) % 1000) / 1000, ((i * 104729) % 1000) / 1000, (i % 3) + 1]);
    const car: Car = newCar(terrain);
    const startX = car.x;
    const hz = obstacles && HAZARD_WORLDS[world.id] ? new Hazards(world, terrain, startX, jump && world.id === 'dino') : null;
    const jumpG = Math.sqrt(2 * world.gravity * JUMP_HEIGHT * (1 + JUMP_PER_LEVEL * (upgrades.jump ?? 0)));
    // 🪂 glide time per trip into the air
    const glideMax = GLIDE_TIME + GLIDE_PER_LEVEL * (upgrades.glide ?? 0);
    let glideLeft = glideMax;
    let gliding = false;
    // ☁️ with the glider: coins (worth double) and now and then a ⛽ can, up in the sky
    const skyBits: Array<{ x: number; y: number; fuel: boolean; taken: boolean }> = [];
    let skyTo = startX + 90;
    let skySeed = world.seed * 7 + 3;
    const skyRand = () => {
      skySeed = (skySeed * 1103515245 + 12345) & 0x7fffffff;
      return skySeed / 0x7fffffff;
    };
    const placeSky = (upTo: number) => {
      while (glide && skyTo < upTo) {
        const high = 4.5 + skyRand() * 3;
        if (skyRand() < 0.25) skyBits.push({ x: skyTo, y: terrain.h(skyTo) + high, fuel: true, taken: false });
        else
          for (let k = 0; k < 6; k++) {
            const cx = skyTo + k * 1.6;
            skyBits.push({ x: cx, y: Math.max(terrain.h(cx), world.water ?? -Infinity) + high + Math.sin((k / 5) * Math.PI) * 1.2, fuel: false, taken: false });
          }
        skyTo += 110 + skyRand() * 110;
      }
    };
    let jumpReady = 0; // seconds until another jump is allowed
    let shake = 0;
    let zoom = 1;
    // With obstacles on, no little 🦖 in the scenery (it'd look like a real one).
    const decor = hz ? look.decor.filter((d) => d !== '🦖' && d !== HAZARD_WORLDS[world.id]?.emoji) : look.decor;
    const pickups: Pickup[] = [];
    let placedTo = placePickups(terrain, 400, pickups, 40);
    const fuelAt = fuelSpots(20000).map((x) => ({ x, taken: false }));
    let fuel = stats.tank;
    let started = false;
    let coins = 0;
    let flips = 0;
    let maxX = car.x;
    let airRot = 0;
    let airTime = 0;
    let stopped = 0;
    let toast: { text: string; until: number } | null = null;
    let ended = false;
    let last = performance.now();
    let acc = 0;
    let camY = car.y;
    let raf = 0;

    const face = new Image();
    let faceOk = false;
    if (driver.avatar === 'image' || driver.avatar === 'video') {
      face.onload = () => (faceOk = true);
      face.src = `/api/family-members/${driver.id}/avatar-image`;
    }

    const finish = (why: RunResult['why']) => {
      if (ended) return;
      ended = true;
      onEnd({ distance: Math.max(0, Math.floor(maxX - startX)), coins: hz ? Math.round(coins * HAZARD_COINS) : coins, flips, why });
    };

    const say = (text: string) => (toast = { text, until: performance.now() + 1600 });

    const sim = () => {
      const p = pedal.current;
      const input = p.gas && !p.brake ? 1 : p.brake && !p.gas ? -1 : 0;
      if (input !== 0) started = true;
      if (started) fuel = Math.max(0, fuel - FUEL_PER_SEC * world.fuelBurn * DT);
      // 🦘 Jump: only from the ground (a press up to 0.2 s early still counts).
      jumpReady = Math.max(0, jumpReady - DT);
      const onGround = car.wheels.some((w) => w.ground);
      // 🪂 gliding: hold jump while in the air — sinks slowly and stays level, until the glide runs out
      gliding = glide && !onGround && jumpHeld.current && glideLeft > 0 && car.vy < 0.5 && performance.now() - jumpAsk.current > 120;
      if (onGround) glideLeft = glideMax;
      else if (gliding) {
        glideLeft -= DT;
        const sink = -GLIDE_SINK;
        if (car.vy < sink) {
          const dv = Math.min(sink - car.vy, 30 * DT);
          car.vy += dv;
          for (const w of car.wheels) w.vy += dv;
        }
        car.w *= 0.96;
        car.a *= 0.995;
        if (car.vx < 9) {
          car.vx += 1.2 * DT;
          for (const w of car.wheels) w.vx += 1.2 * DT;
        }
      }
      if (jump && jumpAsk.current && performance.now() - jumpAsk.current < 200 && jumpReady <= 0 && onGround) {
        jumpAsk.current = 0;
        jumpReady = 0.4;
        started = true;
        car.vy = Math.max(car.vy, 0) + jumpG;
        for (const w of car.wheels) w.vy = Math.max(w.vy, 0) + jumpG;
      }
      const r = step(car, terrain, stats, input, fuel > 0, DT);
      if (r.crashed) return finish(car.tipped > 1 ? 'tipped' : 'crash');
      if (hz) {
        const h = hz.update(car, DT, startX);
        coins += h.coins;
        if (h.say) say(h.say);
        if (h.hit) return finish(h.hit);
      }
      // Flips: count the turning done while both wheels are off the ground.
      if (!r.grounded) {
        airRot += car.w * DT;
        airTime += DT;
      } else if (airTime > 0) {
        const n = Math.floor((Math.abs(airRot) + 0.4) / (2 * Math.PI));
        if (n > 0) {
          flips += n;
          coins += 25 * n;
          say(`${airRot > 0 ? '🔄 Backflip' : '🔃 Front flip'}${n > 1 ? ` ×${n}` : ''}! +${25 * n}`);
        } else if (airTime > 1.4) {
          coins += 10;
          say('🪽 Big air! +10');
        }
        airRot = 0;
        airTime = 0;
      }
      maxX = Math.max(maxX, car.x);
      if (fuel <= 0 && Math.hypot(car.vx, car.vy) < 0.4) {
        stopped += DT;
        if (stopped > 2) finish('fuel');
      } else stopped = 0;
    };

    const pickUp = () => {
      if (car.x + 300 > placedTo) placedTo = placePickups(terrain, placedTo + 400, pickups, placedTo);
      const near = (x: number, y: number, d: number) =>
        Math.hypot(car.x - x, car.y - y) < d || car.wheels.some((w) => Math.hypot(w.x - x, w.y - y) < d * 0.8);
      for (const c of pickups) {
        if (c.taken || Math.abs(c.x - car.x) > 3) continue;
        if (near(c.x, c.y, 1.3)) {
          c.taken = true;
          coins += c.value;
        }
      }
      placeSky(car.x + 200);
      for (const c of skyBits) {
        if (c.taken || Math.abs(c.x - car.x) > 3) continue;
        if (near(c.x, c.y, c.fuel ? 1.6 : 1.3)) {
          c.taken = true;
          if (c.fuel) {
            fuel = stats.tank;
            say('☁️⛽ Sky fuel — full tank!');
          } else coins += Math.round((car.x > 1500 ? 25 : car.x > 600 ? 10 : 5) * world.coinMul * 2);
        }
      }
      if (skyBits.length > 200) skyBits.splice(0, skyBits.findIndex((c) => c.x > car.x - 30));
      for (const f of fuelAt) {
        if (f.taken || Math.abs(f.x - car.x) > 3) continue;
        if (near(f.x, terrain.h(f.x) + 0.8, 1.6)) {
          f.taken = true;
          fuel = stats.tank;
          say('⛽ Full tank!');
        }
      }
      // Don't keep thousands of old coins around.
      if (pickups.length > 400) pickups.splice(0, pickups.findIndex((c) => c.x > car.x - 30));
    };

    const drawHazards = (x0: number, x1: number, sx: (x: number) => number, sy: (y: number) => number, S: number, W: number, H: number) => {
      if (!hz) return;
      const emojiFont = (px: number) => `${Math.round(px)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const e of hz.eggs) {
        if (e.x < x0 - 1 || e.x > x1 + 1) continue;
        ctx.font = emojiFont(S * (e.broken ? 0.75 : 0.85));
        ctx.fillStyle = '#000';
        ctx.textBaseline = 'bottom';
        ctx.fillText(e.broken ? '🍳' : '🥚', sx(e.x), sy(terrain.h(e.x)) + S * 0.12);
        ctx.textBaseline = 'middle';
      }
      for (const d of hz.dinos) {
        const gy = terrain.h(d.x);
        if (d.x + 4 < x0) continue;
        if (d.x - 4 > x1) {
          // 🦖 coming up: a warning at the right edge
          const ahead = d.x - car.x;
          if (ahead < 70) {
            ctx.font = 'bold 16px system-ui, sans-serif';
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(W - 112, H * 0.42 - 18, 104, 36);
            ctx.fillStyle = '#fff';
            ctx.fillText(`🦖 ${Math.round(ahead)} m ▶`, W - 60, H * 0.42);
          }
          continue;
        }
        // its shadow: bigger and darker the closer it is to the ground
        const k = Math.max(0, 1 - d.y / 8);
        ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.25 * k})`;
        ctx.beginPath();
        ctx.ellipse(sx(d.x), sy(gy) + 2, DINO.halfW * S * (0.6 + 0.4 * k), S * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        // crouching just before a jump (the warning), stretched while going up
        const crouch = d.y <= 0 && d.vy <= 0 && d.awake && d.wait < CROUCH;
        const sqY = crouch ? 0.82 : d.vy > 3 ? 1.08 : 1;
        ctx.save();
        ctx.translate(sx(d.x), sy(gy + d.y));
        // 😡 a chasing one faces you (the emoji faces left; it's behind you, so turn it round)
        ctx.scale(d.chase > 0 && car.x > d.x ? -1 : 1, sqY);
        ctx.font = emojiFont(DINO.h * S * 1.15);
        ctx.fillStyle = '#000'; // (emoji take the fill's see-through-ness)
        ctx.textBaseline = 'bottom';
        ctx.fillText('🦖', 0, S * 0.35);
        ctx.restore();
        if (d.chase > 0) {
          ctx.font = emojiFont(S * 1.1);
          ctx.fillStyle = '#000';
          ctx.fillText('💢', sx(d.x), sy(gy + d.y + DINO.h + 0.6));
        }
      }
      // 🐹 🦂 🐧 🔥 🍬 🦈 — this world's critters
      const k = hz.kind;
      if (k) {
        const sea = world.water ?? 0;
        for (const c of hz.critters) {
          const gy = terrain.h(c.x);
          if (c.x + 4 < x0) continue;
          if (c.x - 4 > x1) {
            const ahead = c.x - car.x;
            if (ahead < 60) {
              ctx.font = 'bold 16px system-ui, sans-serif';
              ctx.fillStyle = 'rgba(0,0,0,0.45)';
              ctx.fillRect(W - 112, H * 0.42 - 18, 104, 36);
              ctx.fillStyle = '#fff';
              ctx.fillText(`${k.emoji} ${Math.round(ahead)} m ▶`, W - 60, H * 0.42);
            }
            continue;
          }
          ctx.fillStyle = '#000';
          if (k.move === 'bounce') {
            const kk = Math.max(0, 1 - c.y / 5);
            ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.25 * kk})`;
            ctx.beginPath();
            ctx.ellipse(sx(c.x), sy(gy) + 2, k.halfW * S * (0.6 + 0.4 * kk), S * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.translate(sx(c.x), sy(gy + c.y));
            ctx.scale(1, c.y <= 0 ? 0.8 : 1); // squished on landing
            ctx.font = emojiFont(k.h * S * 1.25);
            ctx.fillStyle = '#000';
            ctx.textBaseline = 'bottom';
            ctx.fillText(k.emoji, 0, S * 0.2);
            ctx.restore();
            continue;
          }
          if (k.move === 'leap') {
            const at = sharkAt(c, k, sea);
            if (c.phase === 'up') {
              ctx.save();
              ctx.translate(sx(at.x), sy(at.y));
              // nose up going out, nose down coming back in (the emoji faces left: flip it)
              ctx.scale(-1, 1);
              ctx.rotate((at.p - 0.5) * 1.6);
              ctx.font = emojiFont(S * 2.2);
              ctx.fillStyle = '#000';
              ctx.fillText('🦈', 0, 0);
              ctx.restore();
            } else {
              // its fin, circling — splashing when it's about to leap
              const fx = c.x - SHARK_FIN + Math.sin(performance.now() / 400 + c.x) * 1.2;
              const fy = sy(sea);
              ctx.fillStyle = '#455a64';
              ctx.beginPath();
              ctx.moveTo(sx(fx) - S * 0.35, fy);
              ctx.lineTo(sx(fx) + S * 0.1, fy - S * 0.7);
              ctx.lineTo(sx(fx) + S * 0.35, fy);
              ctx.closePath();
              ctx.fill();
              if (c.phase === 'warn') {
                ctx.font = emojiFont(S * 1.0);
                ctx.fillStyle = '#000';
                ctx.fillText('💦', sx(c.x - SHARK_FIN), fy - S * 0.9);
              }
            }
            continue;
          }
          // pop: a hole, the warning, then it's up
          const hx = sx(c.x);
          const hy = sy(gy);
          ctx.fillStyle = world.id === 'sun' ? (c.phase === 'warn' ? `rgba(255,${120 + 80 * Math.sin(performance.now() / 60)},0,0.95)` : 'rgba(120,20,0,0.85)') : world.id === 'ice' ? 'rgba(30,80,140,0.85)' : 'rgba(40,25,10,0.8)';
          ctx.beginPath();
          ctx.ellipse(hx, hy + 2, k.halfW * S * 1.1, S * 0.22, 0, 0, Math.PI * 2);
          ctx.fill();
          if (c.phase === 'warn') {
            const wob = Math.sin(performance.now() / 45) * S * 0.08;
            ctx.font = emojiFont(S * 0.8);
            ctx.fillStyle = '#000';
            ctx.fillText(world.id === 'ice' ? '🫧' : world.id === 'sun' ? '♨️' : '💨', hx + wob, hy - S * 0.5);
          } else if (c.phase === 'up') {
            ctx.font = emojiFont(S * Math.min(k.h, 1.6) * 1.15);
            ctx.fillStyle = '#000';
            ctx.textBaseline = 'bottom';
            // 🔥 a tall column of flames; the others pop up out of the hole
            const n = world.id === 'sun' ? Math.round(k.h / 1.3) : 1;
            const rise = Math.min(1, (k.up - c.t) / 0.15);
            for (let i = 0; i < n; i++) ctx.fillText(k.emoji, hx + (i % 2 ? S * 0.15 : -S * 0.1), hy + S * 0.25 - i * S * 1.3 + (1 - rise) * S);
            ctx.textBaseline = 'middle';
          }
        }
      }
      const m = hz.dropper;
      if (m) {
        if (m.aim && m.aim.x > x0 && m.aim.x < x1) {
          const ax = sx(m.aim.x);
          const ay = sy(m.aim.y);
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 70);
          ctx.strokeStyle = `rgba(255,23,68,${0.5 + 0.5 * pulse})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(ax, ay, S * 0.9, S * 0.3, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#000';
        for (const n of m.nuts) {
          ctx.font = emojiFont(S * 0.9);
          ctx.fillText('🥥', sx(n.x), sy(n.y));
        }
        ctx.font = emojiFont(S * 1.8);
        ctx.fillText('🌿', sx(m.x), sy(m.y + 0.9));
        ctx.font = emojiFont(S * 1.5);
        ctx.fillText('🐒', sx(m.x), sy(m.y));
      }
      if (k || m) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(12, 76 + 44, 110, 26);
        ctx.fillStyle = '#fff';
        ctx.fillText('🛡️'.repeat(Math.max(0, hz.shields)), 20, 76 + 47);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      }
      const u = hz.saucer;
      if (u) {
        if (u.aim && u.aim.x > x0 && u.aim.x < x1) {
          // 🎯 where the next shot is going
          const ax = sx(u.aim.x);
          const ay = sy(u.aim.y - 0.4);
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 70);
          ctx.strokeStyle = `rgba(255,23,68,${0.5 + 0.5 * pulse})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(ax, ay, S * 0.9, S * 0.3, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ax - S, ay);
          ctx.lineTo(ax + S, ay);
          ctx.stroke();
        }
        for (const b of u.bolts) {
          const bx = sx(b.x);
          const by = sy(b.y);
          const n = Math.hypot(b.vx, b.vy) || 1;
          ctx.strokeStyle = 'rgba(118,255,3,0.35)';
          ctx.lineWidth = S * 0.45;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - (b.vx / n) * S * 1.2, by + (b.vy / n) * S * 1.2);
          ctx.stroke();
          ctx.strokeStyle = '#ccff90';
          ctx.lineWidth = S * 0.15;
          ctx.stroke();
          ctx.lineCap = 'butt';
        }
        const ux = sx(u.x);
        const uy = sy(u.y);
        if (u.charge > 0) {
          const glow = ctx.createRadialGradient(ux, uy + S * 0.5, 0, ux, uy + S * 0.5, S * 2.2);
          glow.addColorStop(0, `rgba(118,255,3,${0.9 - u.charge * 0.5})`);
          glow.addColorStop(1, 'rgba(118,255,3,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(ux - S * 2.5, uy - S * 2, S * 5, S * 5);
        }
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.font = emojiFont(S * 2.4);
        ctx.fillText('🛸', ux, uy + S * 0.2);
        ctx.font = emojiFont(S * 0.9);
        ctx.fillText('👽', ux, uy - S * 1.0);
        // 🛡️ shields left
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(12, 76 + 44, 110, 26);
        ctx.fillStyle = '#fff';
        ctx.fillText('🛡️'.repeat(Math.max(0, hz.shields)), 20, 76 + 47);
      }
      if (hz.withEggs) {
        const chasing = hz.dinos.find((d) => d.chase > 0);
        const text = chasing ? `😡 🦖 ${Math.ceil(chasing.chase)} s` : hz.angry ? '😡 next 🦖 is angry!' : `🥚 ${hz.eggsBroken}/${EGG_LIMIT}`;
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const w = ctx.measureText(text).width + 16;
        ctx.fillStyle = chasing || hz.angry ? 'rgba(183,28,28,0.75)' : 'rgba(0,0,0,0.35)';
        ctx.fillRect(12, 76 + 44, w, 26);
        ctx.fillStyle = '#fff';
        ctx.fillText(text, 20, 76 + 49);
      }
    };

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 🦖 zoom out (and look higher) while a dinosaur is close, so you can see it jump
      const near = hz?.dinos.some((d) => d.x - car.x < 22 && d.x - car.x > -8) ?? false;
      zoom += ((near ? 0.68 : 1) - zoom) * 0.04;
      const S = Math.max(15, Math.min(W / 22, H / 11) * zoom); // pixels per metre
      camY += (car.y - camY) * 0.08;
      const camX = car.x - (W * 0.32) / S;
      const sx = (x: number) => (x - camX) * S;
      // 🦖 the ground shakes for a moment when a dinosaur lands nearby
      shake = 0;
      if (hz) for (const d of hz.dinos) if (Math.abs(d.x - car.x) < 25) shake = Math.max(shake, Math.max(0, 0.35 - (hz.time - d.landed)) * 0.6);
      const shakeY = shake ? Math.sin(performance.now() / 18) * shake * S : 0;
      const sy = (y: number) => H * (0.58 + (1 - zoom) * 0.4) - (y - camY) * S + shakeY;

      // Sky, sun / moon / planet, stars, far hills (they move slower — parallax).
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, look.sky[0]);
      sky.addColorStop(1, look.sky[1]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      if (look.stars) {
        ctx.fillStyle = '#fff';
        for (const [fx, fy, r] of starField) ctx.fillRect(((fx * W - camX * 2) % W + W) % W, fy * H * 0.6, r, r);
      }
      const orbR = Math.min(W, H) * 0.07;
      if (look.orb.emoji) {
        ctx.font = `${Math.round(orbR * 2)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(look.orb.emoji, W * 0.82, H * 0.18);
      } else {
        if (look.orb.glow) {
          const glow = ctx.createRadialGradient(W * 0.82, H * 0.18, orbR * 0.5, W * 0.82, H * 0.18, orbR * 3);
          glow.addColorStop(0, 'rgba(255,255,220,0.6)');
          glow.addColorStop(1, 'rgba(255,255,220,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, W, H);
        }
        ctx.fillStyle = look.orb.color ?? '#fff';
        ctx.beginPath();
        ctx.arc(W * 0.82, H * 0.18, orbR, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const [k, color, base] of [
        [0.15, look.far[0], 0.55],
        [0.35, look.far[1], 0.68],
      ] as Array<[number, string, number]>) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let px = 0; px <= W + 10; px += 10) {
          const wx = (px / S + camX * k) * 0.35;
          ctx.lineTo(px, H * base - (Math.sin(wx) * 0.5 + Math.sin(wx * 0.37 + 1) * 0.8) * S * 1.2);
        }
        ctx.lineTo(W, H);
        ctx.fill();
      }

      // The ground, and its top edge (grass, sand, ice…).
      const x0 = camX - 1;
      const x1 = camX + W / S + 1;
      ctx.beginPath();
      ctx.moveTo(sx(x0), H + 10);
      for (let x = x0; x <= x1; x += 0.4) ctx.lineTo(sx(x), sy(terrain.h(x)));
      ctx.lineTo(sx(x1), H + 10);
      ctx.closePath();
      const dirt = ctx.createLinearGradient(0, sy(car.y), 0, H + sy(car.y));
      dirt.addColorStop(0, look.ground[0]);
      dirt.addColorStop(1, look.ground[1]);
      ctx.fillStyle = dirt;
      ctx.fill();
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 0.4) (x === x0 ? ctx.moveTo : ctx.lineTo).call(ctx, sx(x), sy(terrain.h(x)));
      ctx.strokeStyle = look.edge;
      ctx.lineWidth = Math.max(4, S * 0.22);
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Scenery along the road (the same spots every run).
      ctx.font = `${Math.round(S * 1.5)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (let i = Math.floor(x0 / 17); i * 17 <= x1; i++) {
        const hsh = Math.abs(Math.sin(i * 12.9898 + world.seed) * 43758.5453) % 1;
        if (hsh < 0.35) continue;
        const dx = i * 17 + hsh * 8;
        const gy = terrain.h(dx);
        if (world.water != null && gy < world.water + 0.3) continue; // nothing growing in the sea
        ctx.fillText(decor[Math.floor(hsh * 997) % decor.length], sx(dx), sy(gy) + S * 0.15);
      }
      ctx.textBaseline = 'alphabetic';

      // Distance signs every 100 m, and the best so far.
      ctx.font = `bold ${Math.round(S * 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      for (let m = Math.ceil((x0 - startX) / 100) * 100; m + startX <= x1; m += 100) {
        if (m <= 0) continue;
        const gx = startX + m;
        const gy = terrain.h(gx);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(sx(gx) - 2, sy(gy + 1.8), 4, S * 1.8);
        ctx.fillStyle = '#fff8e1';
        ctx.fillRect(sx(gx) - S * 0.75, sy(gy + 2.3), S * 1.5, S * 0.6);
        ctx.fillStyle = '#5d4037';
        ctx.fillText(`${m} m`, sx(gx), sy(gy + 1.85));
      }
      if (best && best > 0) {
        const bx = startX + best;
        if (bx > x0 && bx < x1) {
          const by = terrain.h(bx);
          ctx.fillStyle = '#333';
          ctx.fillRect(sx(bx) - 2, sy(by + 3), 4, S * 3);
          ctx.fillStyle = '#e53935';
          ctx.beginPath();
          ctx.moveTo(sx(bx) + 2, sy(by + 3));
          ctx.lineTo(sx(bx) + S * 1.3, sy(by + 2.6));
          ctx.lineTo(sx(bx) + 2, sy(by + 2.2));
          ctx.fill();
          ctx.fillStyle = '#b71c1c';
          ctx.fillText('Best', sx(bx), sy(by + 3.3));
        }
      }

      // Coins and fuel cans.
      for (const c of pickups) {
        if (c.taken || c.x < x0 || c.x > x1) continue;
        const r = S * (c.value >= 25 ? 0.42 : c.value >= 10 ? 0.36 : 0.3);
        ctx.fillStyle = c.value >= 25 ? '#ff9800' : c.value >= 10 ? '#cfd8dc' : '#ffd54f';
        ctx.strokeStyle = c.value >= 25 ? '#e65100' : c.value >= 10 ? '#78909c' : '#f9a825';
        ctx.lineWidth = Math.max(2, S * 0.07);
        ctx.beginPath();
        ctx.arc(sx(c.x), sy(c.y), r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.font = `${Math.round(S * 1.1)}px system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      for (const f of fuelAt) {
        if (f.taken || f.x < x0 || f.x > x1) continue;
        ctx.fillText('⛽', sx(f.x), sy(terrain.h(f.x) + 0.8));
      }
      // ☁️ sky coins and cans (with the glider)
      for (const c of skyBits) {
        if (c.taken || c.x < x0 || c.x > x1) continue;
        if (c.fuel) {
          ctx.font = `${Math.round(S * 1.6)}px system-ui, sans-serif`;
          ctx.fillText('☁️', sx(c.x), sy(c.y - 0.5));
          ctx.font = `${Math.round(S * 1.1)}px system-ui, sans-serif`;
          ctx.fillText('⛽', sx(c.x), sy(c.y));
          continue;
        }
        ctx.fillStyle = '#fff176';
        ctx.strokeStyle = '#f57f17';
        ctx.lineWidth = Math.max(2, S * 0.07);
        ctx.beginPath();
        ctx.arc(sx(c.x), sy(c.y), S * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f57f17';
        ctx.font = `bold ${Math.round(S * 0.4)}px system-ui, sans-serif`;
        ctx.fillText('×2', sx(c.x), sy(c.y));
      }
      ctx.font = `${Math.round(S * 1.1)}px system-ui, sans-serif`;

      // 🪂 the glider, open above the car
      if (gliding) {
        ctx.font = `${Math.round(S * 2.4)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.fillText('🪂', sx(car.x), sy(car.y + 2.6));
      }

      // The car: springs, wheels, body, driver.
      for (const w of car.wheels) {
        const a = bodyPoint(car, w.ax, w.ay + 0.25);
        ctx.strokeStyle = '#616161';
        ctx.lineWidth = Math.max(3, S * 0.12);
        ctx.beginPath();
        ctx.moveTo(sx(a.x), sy(a.y));
        ctx.lineTo(sx(w.x), sy(w.y));
        ctx.stroke();
      }
      for (const w of car.wheels) {
        ctx.save();
        ctx.translate(sx(w.x), sy(w.y));
        ctx.rotate(-w.angle);
        ctx.fillStyle = '#212121';
        ctx.beginPath();
        ctx.arc(0, 0, WHEEL_R * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#bdbdbd';
        ctx.beginPath();
        ctx.arc(0, 0, WHEEL_R * S * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#757575';
        ctx.lineWidth = Math.max(2, S * 0.06);
        for (let k = 0; k < 3; k++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(-WHEEL_R * S * 0.5, 0);
          ctx.lineTo(WHEEL_R * S * 0.5, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.save();
      if (hz?.shielding) ctx.globalAlpha = Math.floor(performance.now() / 90) % 2 ? 0.35 : 1;
      ctx.translate(sx(car.x), sy(car.y));
      ctx.rotate(-car.a);
      if (vehicle) {
        ctx.font = `${Math.round(S * 2.6)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (!FACES_RIGHT.has(vehicle)) ctx.scale(-1, 1);
        ctx.fillText(vehicle, 0, -S * 0.1);
        if (!FACES_RIGHT.has(vehicle)) ctx.scale(-1, 1);
      } else {
        // The buggy: a body in their colour and a roll bar.
        ctx.fillStyle = driver.color || '#7c5cff';
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = Math.max(2, S * 0.07);
        ctx.beginPath();
        ctx.roundRect(-1.45 * S, -0.3 * S, 2.9 * S, 0.65 * S, 0.22 * S);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#424242';
        ctx.lineWidth = Math.max(3, S * 0.1);
        ctx.beginPath();
        ctx.moveTo(-0.75 * S, -0.3 * S);
        ctx.lineTo(-0.7 * S, -1.35 * S);
        ctx.lineTo(0.35 * S, -1.35 * S);
        ctx.lineTo(0.75 * S, -0.3 * S);
        ctx.stroke();
      }
      // The driver's head: their avatar, with their hat.
      const hx = HEAD.x * S;
      const hy = -HEAD.y * S;
      const hr = HEAD.r * S;
      ctx.fillStyle = driver.color || '#7c5cff';
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();
      if (faceOk) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(face, hx - hr, hy - hr, hr * 2, hr * 2);
        ctx.restore();
      } else if (driver.avatar && driver.avatar !== 'image' && driver.avatar !== 'video') {
        ctx.font = `${Math.round(hr * 1.3)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(driver.avatar, hx, hy + hr * 0.08);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(2, S * 0.06);
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.stroke();
      if (driver.hat) {
        ctx.font = `${Math.round(hr * 1.4)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(driver.hat, hx, hy - hr * 1.05);
      }
      if (driver.hand) {
        ctx.fillStyle = '#000'; // opaque, so the emoji isn't see-through
        ctx.font = `${Math.round(hr * 1.7)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(driver.hand, hx + hr * 1.7, hy - hr * 0.1);
      }
      ctx.restore();

      if (hz) drawHazards(x0, x1, sx, sy, S, W, H);

      // 🌊 The sea, see-through, over everything below sea level.
      if (world.water != null) {
        const wy = sy(world.water);
        if (wy < H) {
          ctx.fillStyle = 'rgba(2, 136, 209, 0.55)';
          ctx.fillRect(0, wy, W, H - wy);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          const tnow = performance.now() / 600;
          for (let px = 0; px <= W; px += 8) {
            const yy = wy + Math.sin(px / 30 + tnow + camX) * 3;
            if (px === 0) ctx.moveTo(px, yy);
            else ctx.lineTo(px, yy);
          }
          ctx.stroke();
        }
      }

      // HUD: fuel, coins, distance.
      const pad = 12;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const fw = Math.min(220, W * 0.38);
      const low = fuel / stats.tank < 0.25;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(pad, pad, fw + 44, 26);
      ctx.fillStyle = low && Math.floor(performance.now() / 300) % 2 ? '#ff5252' : low ? '#ff8a80' : '#69f0ae';
      ctx.fillRect(pad + 38, pad + 5, (fw * fuel) / stats.tank, 16);
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('⛽', pad + 8, pad + 3);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(pad, pad + 32, 150, 26);
      ctx.fillStyle = '#fff';
      ctx.fillText(`🪙 ${coins}${hz ? ` ×${HAZARD_COINS}` : ''}`, pad + 8, pad + 35);
      if (glide) {
        // 🪂 glide left on this trip into the air
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(pad + 156, pad + 32, fw * 0.6 + 44, 26);
        ctx.fillStyle = gliding ? '#81d4fa' : '#b3e5fc';
        ctx.fillRect(pad + 156 + 38, pad + 37, (fw * 0.6 * Math.max(0, glideLeft)) / glideMax, 16);
        ctx.fillStyle = '#fff';
        ctx.fillText('🪂', pad + 164, pad + 35);
      }
      const dist = Math.max(0, Math.floor(maxX - startX));
      ctx.textAlign = 'right';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(W - pad - 170, pad, 170, 30);
      ctx.fillStyle = '#fff';
      ctx.fillText(`${dist} m${best ? ` / ${best}` : ''}`, W - pad - 10, pad + 4);
      if (toast && performance.now() < toast.until) {
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.round(Math.min(34, W / 16))}px system-ui, sans-serif`;
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeText(toast.text, W / 2, H * 0.16);
        ctx.fillStyle = '#ffeb3b';
        ctx.fillText(toast.text, W / 2, H * 0.16);
      }
      if (!started) {
        ctx.textAlign = 'center';
        const jk = jumpKeysOf(controls).map(keyName).join(' / ');
        const jt = jumpTapHint[jumpTapOf(controls)];
        const hint = jump
          ? `Hold GAS${controls.gasKeys.length ? ` (${controls.gasKeys.map(keyName).join(' / ')})` : ''} to go!  🦘 Jump: ${[jt, jk && `press ${jk}`].filter(Boolean).join(' or ') || 'no key set'}`
          : `Hold GAS${controls.gasKeys.length ? ` (${controls.gasKeys.map(keyName).join(' / ')})` : ''} to go!  Ease off on hills — brake if the nose comes up`;
        let size = Math.round(Math.min(26, W / 20));
        ctx.font = `bold ${size}px system-ui, sans-serif`;
        const fit = ctx.measureText(hint).width;
        if (fit > W * 0.94) {
          size = Math.max(11, Math.floor((size * W * 0.94) / fit));
          ctx.font = `bold ${size}px system-ui, sans-serif`;
        }
        // White with a dark edge, so it reads on every world's sky (the moon's is black).
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeText(hint, W / 2, H * 0.3);
        ctx.fillStyle = '#fff';
        ctx.fillText(hint, W / 2, H * 0.3);
      }
    };

    const frame = (now: number) => {
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      while (acc >= DT && !ended) {
        sim();
        acc -= DT;
      }
      if (!ended) pickUp();
      if (quit.current) finish('quit');
      draw();
      if (!ended) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // One run per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which pointer (mouse button / finger) is holding which pedal on the game area.
  const held = useRef(new Map<number, 'gas' | 'brake'>());
  const letGo = (id: number) => {
    const which = held.current.get(id);
    if (!which) return;
    held.current.delete(id);
    if (![...held.current.values()].includes(which)) pedal.current[which] = false;
    setPressed((n) => n + 1);
  };
  const keysFor = (ks: string[]) => (ks.length ? ` (${ks.map(keyName).join(' / ')})` : '');

  const hold = (which: 'gas' | 'brake', down: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    pedal.current[which] = down;
    if (down) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setPressed((n) => n + 1);
  };

  return (
    <div className="hill-run">
      <canvas
        ref={canvas}
        className="hill-run__canvas"
        onPointerDown={(e) => {
          // 🦘 jumping with the mouse / a finger (when Jump is on): the middle third of the game, or the wheel button
          const rx = (e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.clientWidth;
          const tap = jumpTapOf(controls);
          if (usesJumpKey && ((tap === 'middle' && e.button === 0 && rx > 1 / 3 && rx < 2 / 3) || (tap === 'wheel' && e.button === 1))) {
            e.preventDefault();
            jumpAsk.current = performance.now();
            jumpHeld.current = true;
            jumpers.current.add(e.pointerId);
            e.currentTarget.setPointerCapture?.(e.pointerId);
            return;
          }
          if (controls.mouse === 'pedals') return;
          e.preventDefault();
          const which =
            controls.mouse === 'buttons'
              ? e.button === 2
                ? 'brake'
                : e.button === 0
                  ? 'gas'
                  : null
              : e.clientX - e.currentTarget.getBoundingClientRect().left > e.currentTarget.clientWidth / 2
                ? 'gas'
                : 'brake';
          if (!which) return;
          held.current.set(e.pointerId, which);
          pedal.current[which] = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setPressed((n) => n + 1);
        }}
        onPointerUp={(e) => {
          if (jumpers.current.delete(e.pointerId)) jumpHeld.current = jumpers.current.size > 0;
          letGo(e.pointerId);
        }}
        onPointerCancel={(e) => {
          if (jumpers.current.delete(e.pointerId)) jumpHeld.current = jumpers.current.size > 0;
          letGo(e.pointerId);
        }}
        // no auto-scroll when the wheel button jumps
        onMouseDown={(e) => e.button === 1 && e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      />
      <button type="button" className="hill-run__quit secondary" onClick={() => (quit.current = true)}>
        ✕ Stop
      </button>
      <button
        type="button"
        className={`hill-run__pedal hill-run__pedal--brake${pedal.current.brake ? ' is-down' : ''}`}
        onPointerDown={hold('brake', true)}
        onPointerUp={hold('brake', false)}
        onPointerCancel={hold('brake', false)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Brake"
      >
        BRAKE
        <small>{keysFor(controls.brakeKeys)}</small>
      </button>
      {usesJumpKey && jumpTapOf(controls) === 'button' && (
        <button
          type="button"
          className="hill-run__pedal hill-run__pedal--jump"
          onPointerDown={(e) => {
            e.preventDefault();
            jumpAsk.current = performance.now();
            jumpHeld.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerUp={() => (jumpHeld.current = false)}
          onPointerCancel={() => (jumpHeld.current = false)}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Jump"
        >
          {jump ? '🦘 JUMP' : '🪂 GLIDE'}
          <small>{keysFor(jumpKeysOf(controls))}</small>
        </button>
      )}
      <button
        type="button"
        className={`hill-run__pedal hill-run__pedal--gas${pedal.current.gas ? ' is-down' : ''}`}
        onPointerDown={hold('gas', true)}
        onPointerUp={hold('gas', false)}
        onPointerCancel={hold('gas', false)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Gas"
      >
        GAS
        <small>{keysFor(controls.gasKeys)}</small>
      </button>
    </div>
  );
}
