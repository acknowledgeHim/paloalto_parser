import { useEffect, useRef, useState } from 'react';
import { onCelebrate, type CelebrateDetail, type CelebrationId } from '../utils/celebrations.js';
import { playCelebrationTune } from '../utils/sounds.js';

/**
 * The full-screen "all done!" animation (see utils/celebrations.ts). Mounted once in App; plays
 * whenever celebrate() is called, for a few seconds — tap anywhere to close it early. Everything is
 * drawn on one canvas from small recipes below (particles + a star of the show), so there are no
 * video files and it runs the same offline.
 */
export function CelebrationHost() {
  const [current, setCurrent] = useState<(CelebrateDetail & { key: number }) | null>(null);
  useEffect(() => onCelebrate((d) => setCurrent({ ...d, key: Date.now() })), []);
  if (!current) return null;
  return <Celebration key={current.key} detail={current} onDone={() => setCurrent(null)} />;
}

const DURATION_MS = 6000;

function Celebration({ detail, onDone }: { detail: CelebrateDetail; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    playCelebrationTune(detail.celebration);
    const canvas = canvasRef.current!;
    const stop = run(canvas, detail.celebration);
    const fade = window.setTimeout(() => setLeaving(true), DURATION_MS - 600);
    const end = window.setTimeout(onDone, DURATION_MS);
    return () => {
      stop();
      window.clearTimeout(fade);
      window.clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const what = detail.kind === 'chore' ? 'chores' : 'to-dos';
  return (
    <div className={`celebration celebration--${detail.celebration} ${leaving ? 'celebration--leaving' : ''}`} onClick={onDone} role="alert">
      <canvas ref={canvasRef} className="celebration__canvas" />
      <div className="celebration__message">
        <div className="celebration__title">{TITLES[detail.celebration]}</div>
        <div className="celebration__sub">
          {detail.name} finished all their {what} today!
        </div>
      </div>
    </div>
  );
}

const TITLES: Record<CelebrationId, string> = {
  confetti: 'All done! 🎉',
  fireworks: 'Amazing! 🎆',
  balloons: 'Hooray! 🎈',
  rocket: 'Blast off! 🚀',
  unicorn: 'Magical! 🦄',
  dino: 'ROAR-some! 🦖',
  dance: 'Party time! 🕺',
  trophy: 'Champion! 🏆',
};

// ---- A tiny particle engine ----

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Pull downward (px/s²); negative floats up. */
  g: number;
  /** Fraction of speed kept per second (1 = none lost). */
  drag: number;
  rot: number;
  vr: number;
  size: number;
  life: number;
  age: number;
  color?: string;
  emoji?: string;
  shape: 'rect' | 'circle' | 'emoji';
  /** Mirror the emoji (most face left; the unicorn runs right). */
  flip?: boolean;
  /** Side-to-side drift (balloons, falling confetti). */
  sway?: number;
  phase?: number;
  /** Fades out over its life (else stays solid, then pops off at the end). */
  fade?: boolean;
  /** Runs every frame (to leave a trail, etc.). */
  tick?: (p: Particle, add: Add, dt: number) => void;
  /** Drawn over everything else (the trophy, the rocket). */
  top?: boolean;
  /** Runs when it reaches the end of its life (a firework bursting). */
  done?: (p: Particle, add: Add) => void;
}

type Add = (p: Partial<Particle> & Pick<Particle, 'x' | 'y'>) => void;

interface Scene {
  w: number;
  h: number;
  t: number;
  /** t on the previous frame (-1 before the first). */
  prev: number;
  add: Add;
  /** Shake the whole picture for a moment (dino stomps). */
  shake: (amount: number) => void;
}

interface Recipe {
  /** Called every frame with the time since the start (s) and the frame's length. */
  frame: (s: Scene, dt: number) => void;
  /** Drawn under the particles (spotlights, rays). */
  backdrop?: (ctx: CanvasRenderingContext2D, s: Scene) => void;
}

const COLORS = ['#ff5e5b', '#ffd23f', '#3bceac', '#4d9de0', '#c879ff', '#ff9f1c', '#ffffff'];
const RAINBOW = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#0a84ff', '#5e5ce6', '#bf5af2'];
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Something that happens every `period` seconds from `from` (a long period = just once): true on
 *  the frames where it's due. */
function every(s: Scene, _dt: number, period: number, from = 0, until = Infinity): boolean {
  if (s.t < from || s.t > until) return false;
  return s.prev < from || Math.floor((s.t - from) / period) !== Math.floor((s.prev - from) / period);
}

const RECIPES: Record<CelebrationId, Recipe> = {
  confetti: {
    frame: (s, dt) => {
      // Two cannons from the bottom corners, then a gentle rain from the top.
      if (every(s, dt, 0.35, 0, 1.2)) {
        for (const side of [0, 1]) {
          for (let i = 0; i < 45; i++) {
            const angle = side ? rand(-2.4, -1.9) : rand(-1.25, -0.75);
            const speed = rand(0.7, 1.25) * s.h;
            s.add({ x: side ? s.w : 0, y: s.h, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, g: s.h * 0.9, drag: 0.35, shape: 'rect', size: rand(8, 16), color: pick(COLORS), vr: rand(-12, 12), sway: 30, life: 4.5 });
          }
        }
      }
      if (s.t < 4 && Math.random() < dt * 40) {
        s.add({ x: rand(0, s.w), y: -20, vy: rand(80, 160), g: 20, shape: 'rect', size: rand(8, 14), color: pick(COLORS), vr: rand(-8, 8), sway: 50, life: 6 });
      }
    },
  },

  fireworks: {
    frame: (s, dt) => {
      if (every(s, dt, 0.28, 0, 4.4)) {
        const color = pick(COLORS);
        s.add({
          x: rand(s.w * 0.15, s.w * 0.85), y: s.h, vy: -rand(0.85, 1.1) * s.h, vx: rand(-60, 60), g: s.h * 0.75, shape: 'circle', size: 5, color: '#fff7c2', life: rand(0.8, 1.05),
          tick: (p, add) => add({ x: p.x, y: p.y, shape: 'circle', size: 3, color: '#ffb347', life: 0.35, fade: true, drag: 0.1 }),
          done: (p, add) => {
            const n = 90;
            const speed = rand(0.3, 0.42) * s.h;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2;
              const v = speed * rand(0.7, 1);
              add({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 140, drag: 0.25, shape: 'circle', size: rand(3, 5), color: Math.random() < 0.2 ? '#ffffff' : color, life: rand(1.1, 1.6), fade: true });
            }
          },
        });
      }
    },
  },

  balloons: {
    frame: (s, dt) => {
      if (s.t < 4.2 && Math.random() < dt * 9) {
        s.add({ x: rand(0, s.w), y: s.h + 60, vy: -rand(0.22, 0.4) * s.h, g: 0, shape: 'emoji', emoji: Math.random() < 0.85 ? '🎈' : pick(['🎁', '🎀', '⭐']), size: rand(50, 100), sway: 40, life: 7 });
      }
      if (every(s, dt, 0.5, 0, 3)) {
        for (let i = 0; i < 12; i++) s.add({ x: rand(0, s.w), y: -10, vy: rand(60, 140), g: 30, shape: 'rect', size: rand(6, 10), color: pick(COLORS), vr: rand(-8, 8), sway: 40, life: 5 });
      }
    },
  },

  rocket: {
    frame: (s, dt) => {
      if (every(s, dt, 99, 0.2)) {
        // Lift-off from the bottom middle, curving up and away to the top right.
        s.add({
          x: s.w * 0.35, y: s.h + 40, vx: s.w * 0.12, vy: -s.h * 0.15, g: -s.h * 0.2, shape: 'emoji', emoji: '🚀', top: true, size: Math.min(160, s.w * 0.18), rot: 0, life: 4,
          tick: (p, add) => {
            p.rot = Math.atan2(p.vy, p.vx) + Math.PI / 4; // the emoji points up-right
            const back = p.size * 0.35;
            const a = Math.atan2(p.vy, p.vx) + Math.PI;
            for (let i = 0; i < 3; i++) {
              add({ x: p.x + Math.cos(a) * back + rand(-8, 8), y: p.y + Math.sin(a) * back + rand(-8, 8), vx: Math.cos(a) * 80 + rand(-40, 40), vy: Math.sin(a) * 80 + rand(-40, 40), shape: 'circle', size: rand(6, 16), color: pick(['#ffd23f', '#ff9f1c', '#ff5e5b', '#dddddd', '#bbbbbb']), life: rand(0.5, 1.1), fade: true, drag: 0.2 });
            }
          },
        });
      }
      // Stars twinkling everywhere.
      if (Math.random() < dt * 25) s.add({ x: rand(0, s.w), y: rand(0, s.h), shape: 'emoji', emoji: pick(['✨', '⭐', '🌟']), size: rand(18, 40), life: rand(0.8, 1.6), fade: true, g: 0 });
      if (every(s, dt, 99, 3)) {
        for (let i = 0; i < 40; i++) {
          const a = rand(0, Math.PI * 2);
          const v = rand(150, 450);
          s.add({ x: s.w * 0.65, y: s.h * 0.12, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 200, drag: 0.3, shape: 'emoji', emoji: pick(['⭐', '🌟', '🪐']), size: rand(20, 40), life: 2, fade: true });
        }
      }
    },
  },

  unicorn: {
    frame: (s, dt) => {
      if (every(s, dt, 99, 0.1)) {
        const size = Math.min(150, s.w * 0.16);
        s.add({
          x: -size, y: s.h * 0.55, vx: (s.w + size * 2) / 4.2, vy: 0, g: 0, shape: 'emoji', emoji: '🦄', flip: true, size, life: 4.4, phase: 0,
          tick: (p, add, dt2) => {
            // Hop along, leaving a rainbow behind.
            p.phase! += dt2 * 7;
            p.y = s.h * 0.55 - Math.abs(Math.sin(p.phase!)) * s.h * 0.12;
            RAINBOW.forEach((color, i) => add({ x: p.x - p.size * 0.35, y: p.y + (i - 3) * 9 + p.size * 0.15, shape: 'circle', size: 9, color, life: 2.2, fade: true, g: 0 }));
            if (Math.random() < 0.4) add({ x: p.x, y: p.y, vx: rand(-80, 80), vy: rand(-120, 40), g: 120, shape: 'emoji', emoji: pick(['✨', '💖', '⭐']), size: rand(18, 30), life: 1.2, fade: true });
          },
        });
      }
    },
  },

  dino: {
    frame: (s, dt) => {
      const size = Math.min(200, s.w * 0.22);
      if (every(s, dt, 99, 0.1)) {
        s.add({
          x: s.w + size, y: s.h - size * 0.55, vx: -(s.w + size * 2) / 4.6, g: 0, shape: 'emoji', emoji: '🦖', size, life: 4.8, phase: 0,
          tick: (p, add, dt2) => {
            const before = Math.floor(p.phase! / Math.PI);
            p.phase! += dt2 * 6.5;
            p.y = s.h - size * 0.55 - Math.abs(Math.sin(p.phase!)) * size * 0.15;
            if (Math.floor(p.phase! / Math.PI) !== before) {
              // STOMP: shake, dust, and something bounces up.
              s.shake(14);
              for (let i = 0; i < 14; i++) add({ x: p.x + rand(-size / 3, size / 3), y: s.h - 8, vx: rand(-160, 160), vy: rand(-180, -40), g: 300, drag: 0.4, shape: 'circle', size: rand(8, 18), color: pick(['#c8a165', '#a07c4b', '#e2c799']), life: 0.9, fade: true });
              add({ x: p.x, y: s.h - size, vx: rand(-100, 100), vy: -rand(300, 500), g: 700, shape: 'emoji', emoji: pick(['🦴', '🌿', '🥚', '🌋']), size: rand(28, 44), vr: rand(-6, 6), life: 1.6 });
            }
          },
        });
      }
      if (every(s, dt, 0.7, 0.3, 3.5)) s.add({ x: rand(s.w * 0.1, s.w * 0.9), y: s.h * rand(0.15, 0.35), vy: -30, g: 0, shape: 'emoji', emoji: pick(['💥', '🦕', '🌴']), size: rand(40, 64), life: 1, fade: true });
    },
  },

  dance: {
    backdrop: (ctx, s) => {
      // Sweeping colored spotlights from the top corners.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const fromX = i % 2 ? s.w * 0.1 : s.w * 0.9;
        const a = Math.PI / 2 + Math.sin(s.t * 1.6 + i * 1.7) * 0.6;
        const len = s.h * 1.3;
        ctx.fillStyle = `${RAINBOW[(i * 2 + Math.floor(s.t * 2)) % RAINBOW.length]}33`;
        ctx.beginPath();
        ctx.moveTo(fromX, -10);
        ctx.lineTo(fromX + Math.cos(a - 0.14) * len, Math.sin(a - 0.14) * len);
        ctx.lineTo(fromX + Math.cos(a + 0.14) * len, Math.sin(a + 0.14) * len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
    frame: (s, dt) => {
      if (every(s, dt, 99, 0)) s.add({ x: s.w / 2, y: s.h * 0.12, g: 0, shape: 'emoji', emoji: '💿', size: Math.min(110, s.w * 0.12), vr: 1.5, life: 6 });
      // Dancers bounce up from the bottom on the beat; notes fall.
      if (every(s, dt, 0.42, 0.1, 4.6)) {
        for (let i = 0; i < 3; i++) s.add({ x: rand(s.w * 0.08, s.w * 0.92), y: s.h + 40, vy: -rand(0.75, 0.95) * s.h, g: s.h * 1.1, shape: 'emoji', emoji: pick(['🕺', '💃', '🐧', '🦜', '🐸', '🤖']), size: rand(56, 90), vr: rand(-2, 2), life: 2.2 });
      }
      if (s.t < 4.8 && Math.random() < dt * 14) s.add({ x: rand(0, s.w), y: -30, vy: rand(120, 220), g: 0, shape: 'emoji', emoji: pick(['🎵', '🎶', '✨']), size: rand(24, 44), sway: 60, life: 5 });
    },
  },

  trophy: {
    backdrop: (ctx, s) => {
      // Slowly turning golden rays behind the trophy.
      const cx = s.w / 2;
      const cy = s.h * 0.42;
      const r = Math.hypot(s.w, s.h);
      const grow = Math.min(1, s.t / 0.6);
      ctx.save();
      ctx.globalAlpha = 0.28 * grow;
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + s.t * 0.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a - 0.08) * r, cy + Math.sin(a - 0.08) * r);
        ctx.lineTo(cx + Math.cos(a + 0.08) * r, cy + Math.sin(a + 0.08) * r);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
    frame: (s, dt) => {
      const size = Math.min(220, s.w * 0.24, s.h * 0.3);
      if (every(s, dt, 99, 0)) {
        s.add({
          x: s.w / 2, y: s.h * 0.42, g: 0, shape: 'emoji', emoji: '🏆', top: true, size: 1, life: 6, phase: 0,
          // Pops in with a little overshoot, then bobs.
          tick: (p, _add, dt2) => {
            p.phase! += dt2;
            const t = p.phase!;
            const pop = t < 0.5 ? (t / 0.5) * 1.15 : t < 0.7 ? 1.15 - ((t - 0.5) / 0.2) * 0.15 : 1;
            p.size = size * pop;
            p.y = s.h * 0.42 + Math.sin(t * 3) * 6;
          },
        });
      }
      if (every(s, dt, 0.9, 0.5, 4.5)) {
        for (let i = 0; i < 26; i++) {
          const a = rand(0, Math.PI * 2);
          const v = rand(250, 520);
          s.add({ x: s.w / 2, y: s.h * 0.42, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 260, drag: 0.35, shape: 'emoji', emoji: pick(['⭐', '🌟', '🥇', '✨']), size: rand(22, 40), vr: rand(-5, 5), life: 1.8, fade: true });
        }
      }
    },
  },
};

/** Emoji drawn once into a small canvas per size, then stamped — far cheaper than text each frame on a Pi. */
const sprites = new Map<string, HTMLCanvasElement>();
function sprite(emoji: string, size: number): HTMLCanvasElement {
  const px = Math.max(8, Math.ceil(size / 8) * 8);
  const key = `${emoji}@${px}`;
  let c = sprites.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = Math.ceil(px * 1.3);
    const g = c.getContext('2d')!;
    g.font = `${px}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, c.width / 2, c.height / 2 + px * 0.05);
    sprites.set(key, c);
  }
  return c;
}

const MAX_PARTICLES = 900;

/** Runs a recipe on the canvas until the returned stop() is called. */
function run(canvas: HTMLCanvasElement, id: CelebrationId): () => void {
  const ctx = canvas.getContext('2d')!;
  const recipe = RECIPES[id];
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let particles: Particle[] = [];
  let shakeAmount = 0;
  const scene: Scene = {
    w: 0,
    h: 0,
    t: 0,
    prev: -1,
    add: (p) => {
      if (particles.length >= MAX_PARTICLES) return;
      particles.push({ vx: 0, vy: 0, g: 0, drag: 1, rot: 0, vr: 0, size: 10, life: 2, age: 0, shape: 'circle', phase: rand(0, Math.PI * 2), ...p });
    },
    shake: (n) => {
      if (!reduceMotion) shakeAmount = Math.max(shakeAmount, n);
    },
  };
  const resize = () => {
    scene.w = canvas.clientWidth;
    scene.h = canvas.clientHeight;
    canvas.width = Math.round(scene.w * dpr);
    canvas.height = Math.round(scene.h * dpr);
  };
  resize();
  window.addEventListener('resize', resize);

  let raf = 0;
  let first = true;
  let last = performance.now();
  const start = last;
  const loop = (now: number) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = Math.max(last, now);
    if (!first) scene.prev = scene.t;
    first = false;
    scene.t = Math.max(scene.t, (now - start) / 1000);
    // With reduced motion: no particle show, just the message (and the trophy/backdrop standing still).
    if (!reduceMotion) recipe.frame(scene, dt);

    const born: Particle[] = [];
    const addLater: Add = (p) => {
      if (particles.length + born.length < MAX_PARTICLES) born.push({ vx: 0, vy: 0, g: 0, drag: 1, rot: 0, vr: 0, size: 10, life: 2, age: 0, shape: 'circle', phase: rand(0, Math.PI * 2), ...p });
    };
    const alive: Particle[] = [];
    for (const p of particles) {
      p.age += dt;
      if (p.age >= p.life) {
        p.done?.(p, addLater);
        continue;
      }
      p.tick?.(p, addLater, dt);
      const keep = Math.pow(p.drag, dt);
      p.vx *= keep;
      p.vy = p.vy * keep + p.g * dt;
      p.x += p.vx * dt + (p.sway ? Math.sin(p.age * 3 + p.phase!) * p.sway * dt : 0);
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      alive.push(p);
    }
    particles = alive.concat(born);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, scene.w, scene.h);
    if (shakeAmount > 0.5) {
      ctx.translate(rand(-shakeAmount, shakeAmount), rand(-shakeAmount, shakeAmount));
      shakeAmount *= Math.pow(0.002, dt);
    }
    recipe.backdrop?.(ctx, scene);
    for (const p of [...particles.filter((q) => !q.top), ...particles.filter((q) => q.top)]) {
      ctx.globalAlpha = p.fade ? Math.max(0, 1 - p.age / p.life) : 1;
      if (p.shape === 'circle') {
        ctx.fillStyle = p.color!;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.flip) ctx.scale(-1, 1);
      if (p.shape === 'rect') {
        ctx.fillStyle = p.color!;
        // A flat piece of paper tumbling: squash one side as it turns.
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, (p.size / 2) * Math.abs(Math.cos(p.age * 6 + p.phase!)));
      } else {
        const img = sprite(p.emoji!, p.size);
        const d = p.size * 1.3;
        ctx.drawImage(img, -d / 2, -d / 2, d, d);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}
