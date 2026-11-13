import { Terrain, bodyPoint, type Car, type World } from './hillPhysics.js';

/**
 * 🌦️ Hill Hopper weather — one 🏆 prize power that makes a drive harder (and pays more coins):
 * 🌪️ tornadoes that pick the car up and toss it, 🌧️ rain with downpours you can hardly see through,
 * ❄️ snow with black-ice patches and deep snow drifts (jump them or ⛏️ drill under), 🔥 a heat wave
 * that overheats a car driven too fast for too long, 🌋 earthquakes that crack the ground open ahead
 * (big cracks only with 🦘 Jump or 🪂 Glider on), and 🌙 night with only your 🔦 headlights.
 * The kid picks some, or 🎲 one at random each drive, or 🔀 mixed: it keeps changing as you drive.
 * The rules are here; HillHopperRun draws them.
 */
export type WeatherId = 'tornado' | 'rain' | 'snow' | 'heat' | 'quake' | 'night';
export const WEATHER_IDS: WeatherId[] = ['tornado', 'rain', 'snow', 'heat', 'quake', 'night'];
export const WEATHER_INFO: Record<WeatherId, { emoji: string; name: string; blurb: string }> = {
  tornado: { emoji: '🌪️', name: 'Tornadoes', blurb: 'get close and one picks your car up, spins it and tosses it' },
  rain: { emoji: '🌧️', name: 'Rain', blurb: 'now and then a downpour so heavy you can hardly see ahead' },
  snow: { emoji: '❄️', name: 'Snow', blurb: 'black ice you can barely see, and deep drifts — jump them or drill under' },
  heat: { emoji: '🔥', name: 'Heat wave', blurb: 'drive too fast too long and the engine overheats' },
  quake: { emoji: '🌋', name: 'Earthquakes', blurb: 'cracks open ahead — speed over small ones, jump the big ones' },
  night: { emoji: '🌙', name: 'Night', blurb: 'only your 🔦 headlights to see by' },
};
/** pick: the ones ticked · random: one of them, new each drive · mixed: changing as you drive */
export interface WeatherChoice {
  mode: 'pick' | 'random' | 'mixed';
  picks: WeatherId[];
}
export const DEFAULT_WEATHER: WeatherChoice = { mode: 'mixed', picks: ['rain'] };
/** coins at the end ×: +20% for each weather picked, +20% for random, +50% for mixed */
export function weatherBonus(c: WeatherChoice): number {
  return 1 + (c.mode === 'mixed' ? 0.5 : c.mode === 'random' ? 0.2 : 0.2 * c.picks.length);
}

const rng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
};

// ---------- the ground: 🌋 cracks and ❄️ drifts change it ----------
export interface Crack {
  x: number;
  w: number;
  big: boolean;
  /** 0 = still closed, 1 = wide open */
  open: number;
  /** the car is going in: from now on the ground there is really gone */
  falling?: boolean;
}
export interface Drift {
  x: number;
  w: number;
  h: number;
}
const CRACK_DEPTH = 30;
/** go at least this fast (m/s) to bounce over a small crack */
export const SMALL_CRACK_SPEED = 7;
/** the ramp on a crack's near side: how long and how high (m) */
const RAMP_SMALL = { len: 3, h: 0.55 };
const RAMP_BIG = { len: 4.5, h: 0.9 };
/**
 * The hills, with snow drifts piled on and earthquake cracks cut in once they open. A crack is drawn
 * open (seen), but the car rolls across it (h) — unless it's too slow over a small one, or touches
 * down in a big one: then the ground there gives way and it falls in.
 */
export class WeatherTerrain extends Terrain {
  cracks: Crack[] = [];
  drifts: Drift[] = [];
  base(x: number): number {
    return super.h(x);
  }
  drift(x: number): Drift | null {
    for (const d of this.drifts) if (x > d.x && x < d.x + d.w) return d;
    return null;
  }
  private withDrift(x: number): number {
    let b = super.h(x);
    const d = this.drift(x);
    if (d) b += d.h * Math.sin(((x - d.x) / d.w) * Math.PI) ** 2;
    // 🛫 the near side of an open crack buckles up into a little ramp: fast enough, and you launch over
    for (const c of this.cracks) {
      const len = c.big ? RAMP_BIG.len : RAMP_SMALL.len;
      if (c.open <= 0 || x <= c.x - len || x > c.x) continue;
      const f = (x - (c.x - len)) / len;
      b += (c.big ? RAMP_BIG.h : RAMP_SMALL.h) * c.open * f * f;
    }
    return b;
  }
  override h(x: number): number {
    return this.cut(x, true);
  }
  override seen(x: number): number {
    return this.cut(x, false);
  }
  private cut(x: number, physics: boolean): number {
    const b = this.withDrift(x);
    for (const c of this.cracks) {
      if (c.open <= 0 || x <= c.x || x >= c.x + c.w || (physics && !c.falling)) continue;
      const edge = Math.min(x - c.x, c.x + c.w - x);
      return b - CRACK_DEPTH * c.open * Math.min(1, edge / 0.35);
    }
    return b;
  }
  /** the crack the car is going into, if any */
  falling(x: number): Crack | null {
    const c = this.inCrack(x);
    return c?.falling ? c : null;
  }
  inCrack(x: number): Crack | null {
    for (const c of this.cracks) if (c.open > 0.3 && x > c.x && x < c.x + c.w) return c;
    return null;
  }
}

export interface Tornado {
  x: number;
  used: boolean;
  /** fading away after a toss */
  gone: number;
  phase: number;
}
export interface IcePatch {
  x: number;
  w: number;
}
export interface WeatherStep {
  /** multiply the tires' grip by this, this step */
  gripMul: number;
  /** slow the car down (deep snow) — per second */
  drag: number;
  /** the engine is off (overheated) */
  noGas: boolean;
  fell: boolean;
  say: string | null;
}

export class Weather {
  /** what this drive can have */
  readonly can: Set<WeatherId>;
  /** what's happening right now */
  active = new Set<WeatherId>();
  readonly choice: WeatherChoice;
  time = 0;
  tornados: Tornado[] = [];
  carry = 0;
  private carrier: Tornado | null = null;
  ice: IcePatch[] = [];
  heat = 0;
  hot = 0;
  shake = 0;
  private fallT = 0;
  /** 🌙 how dark it is (fades in and out in mixed weather) */
  darkness = 0;
  /** 🌧️ ❄️ how much rain / snow is falling (fades) */
  rainFall = 0;
  snowFall = 0;
  private nextChange = 0;
  private placedTo: number;
  private rand: () => number;
  private luck: () => number;
  constructor(
    private world: World,
    private t: Terrain,
    startX: number,
    choice: WeatherChoice,
    private bigCracks: boolean,
    private maxSpeed: number,
    seed = Math.floor(Math.random() * 1e9)
  ) {
    this.choice = choice;
    this.rand = rng(world.seed * 91 + 17);
    this.luck = rng(seed);
    const picks = choice.picks.length ? choice.picks : WEATHER_IDS;
    if (choice.mode === 'pick') this.can = new Set(picks);
    else if (choice.mode === 'random') this.can = new Set([picks[Math.floor(this.luck() * picks.length)]]);
    else this.can = new Set(WEATHER_IDS);
    if (choice.mode === 'mixed') {
      this.nextChange = 6;
      this.active = new Set();
    } else this.active = new Set(this.can);
    this.placedTo = startX + 50;
    if (this.active.has('night')) this.darkness = 1;
  }
  is(w: WeatherId) {
    return this.active.has(w);
  }
  /** "🌧️ + ❄️" (or ☀️ clear) */
  label(): string {
    return this.active.size ? [...this.active].map((w) => WEATHER_INFO[w].emoji).join(' ') : '☀️';
  }
  get downpour(): number {
    if (!this.is('rain')) return 0;
    const p = this.time % 26;
    if (p < 13 || p > 23) return 0;
    return Math.min(1, (p - 13) / 1.5, (23 - p) / 1.5);
  }
  private place(upTo: number) {
    const r = this.rand;
    const wt = this.t instanceof WeatherTerrain ? this.t : null;
    while (this.placedTo < upTo) {
      const x = (this.placedTo += 14 + r() * 10);
      const roll = r();
      // (the same random numbers whatever's on, so a world's course doesn't shift around)
      if (this.is('snow') && roll < 0.14) this.ice.push({ x, w: 5 + r() * 7 });
      else if (this.is('snow') && wt && roll < 0.22 && !wt.drift(x - 3) && !wt.drift(x + 12)) {
        const big = r() < 0.35;
        wt.drifts.push({ x, w: big ? 7 + r() * 3 : 4 + r() * 2, h: big ? 2.6 + r() * 0.8 : 1 + r() * 0.6 });
      } else if (this.is('tornado') && roll > 0.95) this.tornados.push({ x: x + 20, used: false, gone: 0, phase: r() * 6 });
      else if (this.is('quake') && wt && roll > 0.8 && roll <= 0.95) {
        if (this.world.water != null && wt.base(x) < this.world.water + 0.3) continue;
        if (wt.drift(x) || wt.drift(x + 9)) continue;
        const big = this.bigCracks && r() < 0.45;
        wt.cracks.push({ x, w: big ? 5.5 + r() * 2.5 : 1.6 + r() * 1, big, open: 0 });
        this.placedTo += 12;
      }
    }
    if (this.ice.length > 60) this.ice.splice(0, 20);
    if (this.tornados.length > 30) this.tornados.splice(0, 10);
    if (wt && wt.cracks.length > 30) wt.cracks.splice(0, 10);
    if (wt && wt.drifts.length > 40) wt.drifts.splice(0, 10);
  }

  /** One step. `gas` = the gas pedal is down; `underground` = safe in a ⛏️ tunnel. */
  step(car: Car, gas: boolean, dt: number, underground: boolean): WeatherStep {
    this.time += dt;
    const out: WeatherStep = { gripMul: 1, drag: 0, noGas: false, fell: false, say: null };
    // 🔀 mixed: every 15–30 s it changes — from clear skies up to everything at once
    if (this.choice.mode === 'mixed' && this.time >= this.nextChange) {
      this.nextChange = this.time + 15 + this.luck() * 15;
      const n = Math.floor(this.luck() * (WEATHER_IDS.length + 1) * this.luck() * 1.6);
      const next = new Set<WeatherId>();
      const pool = [...WEATHER_IDS];
      for (let k = 0; k < Math.min(n, pool.length); k++) next.add(pool.splice(Math.floor(this.luck() * pool.length), 1)[0]);
      this.active = next;
      out.say = next.size ? `🌦️ The weather changes: ${this.label()}` : '☀️ The weather clears up!';
    }
    this.place(car.x + 90);
    this.darkness += ((this.is('night') ? 1 : 0) - this.darkness) * Math.min(1, dt * 0.6);
    this.rainFall += ((this.is('rain') ? 1 : 0) - this.rainFall) * Math.min(1, dt);
    this.snowFall += ((this.is('snow') ? 1 : 0) - this.snowFall) * Math.min(1, dt);
    this.shake = Math.max(0, this.shake - dt);
    out.gripMul *= 1 - 0.12 * this.downpour;
    // ❄️ black ice (stays slippery after the snow stops), and deep snow in a drift
    for (const p of this.ice) if (car.wheels.some((w) => w.ground && w.x > p.x && w.x < p.x + p.w)) out.gripMul *= 0.2;
    const wt = this.t instanceof WeatherTerrain ? this.t : null;
    if (wt && car.wheels.some((w) => w.ground && wt.drift(w.x))) {
      out.gripMul *= 0.45;
      out.drag = 1.3;
    }
    // 🔥 overheating: too fast for too long
    if (this.hot > 0) {
      this.hot -= dt;
      out.noGas = true;
      if (this.hot <= 0) {
        this.heat = 0.45;
        out.say = '🌡️ Cooled down — gas is back!';
      }
    } else if (this.is('heat')) {
      const fast = gas && Math.abs(car.vx) > this.maxSpeed * 0.6;
      this.heat = Math.max(0, Math.min(1, this.heat + (fast ? dt / 7 : -dt / 9)));
      if (this.heat >= 1) {
        this.hot = 4;
        out.noGas = true;
        out.say = '🔥 Overheated! No gas till it cools…';
      }
    } else this.heat = Math.max(0, this.heat - dt / 9);
    // 🌋 cracks open as you come near
    if (wt) {
      for (const c of wt.cracks) {
        if (c.open < 1 && c.x - car.x < 38 && c.x > car.x - 5) {
          if (c.open === 0) {
            this.shake = 1.2;
            out.say = c.big ? '🌋 Earthquake! A BIG crack — jump it!' : '🌋 Earthquake! A crack opens — speed over it!';
          }
          c.open = Math.min(1, c.open + dt * 1.5);
        }
      }
      if (!underground) {
        // too slow over a small crack, or touching down in a big one: in you go
        for (const w of car.wheels) {
          const c = w.ground ? wt.inCrack(w.x) : null;
          // (a wheel just at the lip — taking off or landing — doesn't count)
          if (c && (w.x < c.x + 0.4 || w.x > c.x + c.w - 0.4)) continue;
          if (c && !c.falling && (c.big || Math.abs(car.vx) < SMALL_CRACK_SPEED)) {
            c.falling = true;
            out.say = c.big ? '🌋 Too short — into the crack!' : '🌋 Too slow — into the crack!';
          }
        }
        // in (or wedged across) a crack that gave way: that's the end of the drive, a moment later
        const near = wt.cracks.find((c) => c.falling && car.x > c.x - 2.5 && car.x < c.x + c.w + 2.5);
        this.fallT = near ? this.fallT + dt : 0;
        if ((near && car.y < wt.base(car.x) - 2) || this.fallT > 1.2) out.fell = true;
      }
    }
    // 🌪️ tornadoes drift your way and grab you if you get close
    for (const tor of this.tornados) {
      if (tor.gone > 0) {
        tor.gone += dt;
        continue;
      }
      if (Math.abs(tor.x - car.x) < 90) tor.x -= (1.3 + Math.sin(this.time * 0.7 + tor.phase) * 0.9) * dt;
      if (!tor.used && !underground && this.carry <= 0 && Math.abs(tor.x - car.x) < 1.8 && car.y - this.t.h(car.x) < 5) {
        tor.used = true;
        this.carry = 1.5;
        this.carrier = tor;
        out.say = '🌪️ Whoa — the tornado picked you up!';
      }
    }
    return out;
  }

  /** After the physics step: a tornado carrying the car spins it up, then tosses it. */
  afterStep(car: Car, dt: number) {
    if (this.carry <= 0 || !this.carrier) return;
    this.carry -= dt;
    const tor = this.carrier;
    tor.x += (car.x - tor.x) * Math.min(1, 4 * dt);
    let vx = 1.5;
    let vy = 4.2;
    if (this.carry <= 0) {
      vx = 8;
      vy = 3;
      tor.gone = 0.01;
      this.carrier = null;
    }
    car.vx = vx;
    car.vy = vy;
    car.w = 6;
    for (const w of car.wheels) {
      const p = bodyPoint(car, w.ax, w.ay);
      w.x = p.x;
      w.y = p.y;
      w.vx = vx - car.w * (p.y - car.y);
      w.vy = vy + car.w * (p.x - car.x);
      w.ground = false;
    }
  }
}
