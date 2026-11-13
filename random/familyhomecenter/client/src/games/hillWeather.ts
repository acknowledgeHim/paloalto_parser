import { Terrain, bodyPoint, type Car, type World } from './hillPhysics.js';

/**
 * 🌦️ Hill Hopper weather — one 🏆 prize power that makes a drive harder (and pays more coins):
 * 🌪️ tornadoes that pick the car up and toss it, 🌧️ rain with downpours you can hardly see through,
 * ❄️ snow with black-ice patches and deep snow drifts (jump them or ⛏️ drill under), 🔥 a heat wave
 * that overheats a car driven too fast for too long, 🌋 earthquakes that crack the ground open ahead
 * (big cracks only with 🦘 Jump or 🪂 Glider on), 🌙 night with only your 🔦 headlights, and 🌊 tsunamis
 * that chase you from behind — get caught and you're swept back to the start.
 * The kid picks some, or 🎲 one at random each drive, or 🔀 mixed: it keeps changing as you drive.
 * The rules are here; HillHopperRun draws them.
 */
export type WeatherId = 'tornado' | 'rain' | 'snow' | 'heat' | 'quake' | 'night' | 'tsunami';
export const WEATHER_IDS: WeatherId[] = ['tornado', 'rain', 'snow', 'heat', 'quake', 'night', 'tsunami'];
export const WEATHER_INFO: Record<WeatherId, { emoji: string; name: string; blurb: string }> = {
  tornado: { emoji: '🌪️', name: 'Tornadoes', blurb: 'get close and one picks your car up, spins it and tosses it' },
  rain: { emoji: '🌧️', name: 'Rain', blurb: 'now and then a downpour so heavy you can hardly see ahead' },
  snow: { emoji: '❄️', name: 'Snow', blurb: 'it piles up into drifts that slow you down or stop you — go fast, jump them or drill under; black ice too' },
  heat: { emoji: '🔥', name: 'Heat wave', blurb: 'drive too fast too long and the engine overheats' },
  quake: { emoji: '🌋', name: 'Earthquakes', blurb: 'cracks open ahead — speed over small ones, jump the big ones' },
  night: { emoji: '🌙', name: 'Night', blurb: 'only your 🔦 headlights to see by' },
  tsunami: { emoji: '🌊', name: 'Tsunami', blurb: 'a giant wave chases you — outrun it or it sweeps you back to the start' },
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
  /** how high it gets once the snow has piled right up (m) */
  h: number;
  /** ❄️ how far it's piled up: 0 → 1 while it snows */
  grow: number;
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
  /** how deep the snow in a drift is here (m) */
  driftDepth(x: number, d = this.drift(x)): number {
    return d ? d.h * d.grow * Math.sin(((x - d.x) / d.w) * Math.PI) ** 2 : 0;
  }
  drift(x: number): Drift | null {
    for (const d of this.drifts) if (x > d.x && x < d.x + d.w) return d;
    return null;
  }
  private withDrift(x: number): number {
    let b = super.h(x);
    const d = this.drift(x);
    if (d) b += this.driftDepth(x, d);
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
/** 🌊 a tsunami wave chasing the car from behind */
export interface Wave {
  /** the front of the wave (m) */
  x: number;
  /** how tall (m), up to WAVE_H — it sinks away at the end */
  h: number;
  age: number;
}
export const WAVE_H = 4.5;
/** how long a wave chases you before it runs out (s) */
const WAVE_LIFE = 16;
export interface WeatherStep {
  /** multiply the tires' grip by this, this step */
  gripMul: number;
  /** slow the car down (deep snow) — per second */
  drag: number;
  /** the engine is off (overheated) */
  noGas: boolean;
  fell: boolean;
  /** 🌊 caught by the tsunami: back to the start */
  washed: boolean;
  say: string | null;
}

/** the plain hills (without drifts or cracks) */
const wt0 = (t: Terrain, x: number) => (t instanceof WeatherTerrain ? t.base(x) : t.h(x));

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
  /** ❄️ how much snow lies on the ground (0–1): it piles up while it snows, melts slowly after */
  snowCover = 0;
  wave: Wave | null = null;
  private nextWave = 0;
  private nextChange = 0;
  /** where the next of each thing goes (each kind on its own, so turning one on brings it soon) */
  private next: Record<'ice' | 'drift' | 'tornado' | 'crack', number>;
  private stuckT = 0;
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
    this.next = { ice: startX + 40, drift: startX + 30, tornado: startX + 60, crack: startX + 45 };
    this.nextWave = 8;
    if (this.active.has('night')) this.darkness = 1;
    if (this.active.has('snow')) this.snowCover = 0.3;
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
  /** A kind of weather just started: bring its first one along soon, so you see it. */
  private started(w: WeatherId, carX: number) {
    if (w === 'snow') this.next.drift = Math.min(this.next.drift, carX + 22 + this.rand() * 10);
    if (w === 'snow') this.next.ice = Math.min(this.next.ice, carX + 45);
    if (w === 'tornado') this.next.tornado = Math.min(this.next.tornado, carX + 50 + this.rand() * 20);
    if (w === 'quake') this.next.crack = Math.min(this.next.crack, carX + 40 + this.rand() * 15);
    if (w === 'tsunami') this.nextWave = Math.min(this.nextWave, this.time + 4);
  }
  private place(carX: number) {
    const r = this.rand;
    const upTo = carX + 90;
    const wt = this.t instanceof WeatherTerrain ? this.t : null;
    const n = this.next;
    // (what's off just moves along with you, so it starts close by when it comes on)
    for (const [k, w] of [['ice', 'snow'], ['drift', 'snow'], ['tornado', 'tornado'], ['crack', 'quake']] as const) if (!this.is(w)) n[k] = Math.max(n[k], upTo);
    while (this.is('snow') && n.ice < upTo) {
      this.ice.push({ x: n.ice, w: 5 + r() * 7 });
      n.ice += 45 + r() * 45;
    }
    while (this.is('snow') && wt && n.drift < upTo) {
      const x = n.drift;
      n.drift += 35 + r() * 35;
      if (wt.inCrack(x) || wt.inCrack(x + 10)) continue;
      const big = r() < 0.3;
      wt.drifts.push({ x, w: big ? 10 + r() * 3 : 5 + r() * 2, h: big ? 2.2 + r() * 0.6 : 0.9 + r() * 0.5, grow: 0.1 });
    }
    while (this.is('tornado') && n.tornado < upTo) {
      this.tornados.push({ x: n.tornado, used: false, gone: 0, phase: r() * 6 });
      n.tornado += 110 + r() * 90;
    }
    while (this.is('quake') && wt && n.crack < upTo) {
      const x = n.crack;
      n.crack += 60 + r() * 50;
      if (this.world.water != null && wt.base(x) < this.world.water + 0.3) continue;
      if (wt.drift(x) || wt.drift(x + 9)) continue;
      const big = this.bigCracks && r() < 0.45;
      wt.cracks.push({ x, w: big ? 5.5 + r() * 2.5 : 1.6 + r() * 1, big, open: 0 });
    }
    if (this.ice.length > 60) this.ice.splice(0, 20);
    if (this.tornados.length > 30) this.tornados.splice(0, 10);
    if (wt && wt.cracks.length > 30) wt.cracks.splice(0, 10);
    if (wt && wt.drifts.length > 40) wt.drifts.splice(0, 10);
  }

  /** One step. `gas` = the gas pedal is down; `underground` = safe in a ⛏️ tunnel. */
  step(car: Car, gas: boolean, dt: number, underground: boolean): WeatherStep {
    this.time += dt;
    const out: WeatherStep = { gripMul: 1, drag: 0, noGas: false, fell: false, washed: false, say: null };
    const was = this.active;
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
    if (this.time <= dt) for (const w of this.active) this.started(w, car.x);
    else if (was !== this.active) for (const w of this.active) if (!was.has(w)) this.started(w, car.x);
    this.place(car.x);
    this.darkness += ((this.is('night') ? 1 : 0) - this.darkness) * Math.min(1, dt * 0.6);
    this.rainFall += ((this.is('rain') ? 1 : 0) - this.rainFall) * Math.min(1, dt);
    this.snowFall += ((this.is('snow') ? 1 : 0) - this.snowFall) * Math.min(1, dt);
    this.shake = Math.max(0, this.shake - dt);
    out.gripMul *= 1 - 0.12 * this.downpour;
    // ❄️ black ice (stays slippery after the snow stops), and deep snow in a drift
    for (const p of this.ice) if (car.wheels.some((w) => w.ground && w.x > p.x && w.x < p.x + p.w)) out.gripMul *= 0.2;
    const wt = this.t instanceof WeatherTerrain ? this.t : null;
    // ❄️ while it snows, the snow piles up: on the ground, and into the drifts near you
    this.snowCover = Math.max(0, Math.min(1, this.snowCover + (this.is('snow') ? dt / 25 : -dt / 90)));
    out.gripMul *= 1 - 0.15 * this.snowCover;
    if (wt && this.is('snow')) for (const d of wt.drifts) if (d.grow < 1 && d.x < car.x + 130 && d.x + d.w > car.x - 30) d.grow = Math.min(1, d.grow + dt / 9);
    // ❄️ ploughing into a drift: the deeper the snow, the harder it holds you back — a big one can stop you
    const deep = wt ? Math.max(0, ...car.wheels.map((w) => (w.ground || w.y < wt.h(w.x) + 0.6 ? wt.driftDepth(w.x) : 0))) : 0;
    if (deep > 0.05) {
      out.gripMul *= 0.45;
      out.drag = 0.6 + 1.5 * deep;
      this.stuckT = Math.abs(car.vx) < 0.6 ? this.stuckT + dt : 0;
      if (this.stuckT > 2.5) {
        this.stuckT = -6;
        out.say = '❄️ Stuck in the snow! Back up (brake) and take a run at it — or jump it';
      }
    } else this.stuckT = Math.min(0, this.stuckT + dt);
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
    // 🌊 tsunami: a giant wave comes up behind and chases you; it runs out after a while
    if (this.wave) {
      const wv = this.wave;
      wv.age += dt;
      const ending = wv.age > WAVE_LIFE;
      wv.h = ending ? Math.max(0, wv.h - dt * 1.2) : Math.min(WAVE_H, wv.h + dt * 3);
      const speed = this.maxSpeed * (ending ? 0.3 : 0.5 + 0.32 * Math.min(1, wv.age / 7));
      wv.x += speed * dt;
      if (ending && wv.h <= 0) {
        this.wave = null;
        this.nextWave = this.time + 20 + this.luck() * 20;
        out.say = '🌊 The wave ran out — phew!';
      } else if (!underground && !ending && wv.x > car.x - 0.6 && car.y < wt0(this.t, car.x) + wv.h) {
        this.wave = null;
        this.nextWave = this.time + 25 + this.luck() * 20;
        out.washed = true;
        out.say = '🌊 Swept away by the tsunami — all the way back to the start!';
      }
    } else if (this.is('tsunami') && this.time >= this.nextWave) {
      this.wave = { x: car.x - 45, h: 0.5, age: 0 };
      out.say = '🌊 TSUNAMI! A giant wave behind you — drive, fast!';
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
