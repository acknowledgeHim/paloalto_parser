import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import * as B from './brickLogic.js';
import { FullscreenButton, useFullscreen } from '../utils/fullscreen.js';

/** 🎨 How the bricks look. Unlocked by your best score (see SKINS in BrickTumblePage). */
export interface Skin {
  id: string;
  emoji: string;
  name: string;
  /** best score needed to use it */
  needs: number;
  bg: [string, string];
  grid: string;
  /** one colour per kind, I O T S Z J L */
  colors: string[];
  /** optional picture on each square, per kind */
  marks?: string[];
}

export const SKINS: Skin[] = [
  { id: 'bright', emoji: '🎨', name: 'Bright', needs: 0, bg: ['#1f2a44', '#141b2e'], grid: 'rgba(255,255,255,0.05)', colors: ['#29b6f6', '#ffca28', '#ab47bc', '#66bb6a', '#ef5350', '#5c6bc0', '#ffa726'] },
  { id: 'candy', emoji: '🍬', name: 'Candy', needs: 3000, bg: ['#fde4f2', '#f8c8e4'], grid: 'rgba(160,60,120,0.07)', colors: ['#80deea', '#fff59d', '#ce93d8', '#a5d6a7', '#f48fb1', '#9fa8da', '#ffcc80'] },
  { id: 'fruit', emoji: '🍓', name: 'Fruit', needs: 8000, bg: ['#fff8e1', '#ffe0b2'], grid: 'rgba(120,80,0,0.07)', colors: ['#7e57c2', '#fdd835', '#8e24aa', '#7cb342', '#e53935', '#3949ab', '#fb8c00'], marks: ['🫐', '🍋', '🍇', '🍏', '🍓', '🫐', '🍊'] },
  { id: 'animals', emoji: '🐾', name: 'Animals', needs: 15000, bg: ['#e8f5e9', '#c8e6c9'], grid: 'rgba(0,80,0,0.07)', colors: ['#90caf9', '#ffe082', '#bcaaa4', '#a5d6a7', '#f8bbd0', '#b0bec5', '#ffcc80'], marks: ['🐳', '🐥', '🐻', '🐸', '🐷', '🐼', '🦊'] },
  { id: 'space', emoji: '🌌', name: 'Space', needs: 30000, bg: ['#0b0322', '#000000'], grid: 'rgba(255,255,255,0.04)', colors: ['#4fc3f7', '#fff176', '#b388ff', '#69f0ae', '#ff5252', '#536dfe', '#ffab40'], marks: ['🌍', '⭐', '🪐', '👽', '☄️', '🌙', '🚀'] },
];
export const skinOf = (id: string | undefined) => SKINS.find((s) => s.id === id) ?? SKINS[0];

export interface BrickResult {
  score: number;
  rows: number;
  level: number;
  bigClears: number;
  why: 'over' | 'quit';
}

const LOCK_DELAY = 0.5; // seconds a brick can slide around once it lands
const MAX_RESETS = 15; // …and how many moves can restart that wait
const REPEAT_WAIT = 0.17; // holding ◀ ▶: first repeat after this, then every…
const REPEAT_EVERY = 0.05;

type Act = 'left' | 'right' | 'down' | 'cw' | 'ccw' | 'slam' | 'hold' | 'pause';
const KEYS: Record<string, Act> = {
  arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down',
  arrowup: 'cw', w: 'cw', x: 'cw', z: 'ccw', q: 'ccw', ' ': 'slam', c: 'hold', shift: 'hold', p: 'pause', escape: 'pause',
};

/** One game of 🧱 Brick Tumble, from the first brick to the pile reaching the top. */
export function BrickTumbleRun({ skin, startLevel, best, seed, onEnd }: { skin: Skin; startLevel: number; best: number | null; seed: number; onEnd: (r: BrickResult) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const screen = useFullscreen<HTMLDivElement>();
  const game = useRef<B.Game>(B.newGame(seed, startLevel));
  const held = useRef<Set<Act>>(new Set()); // move/drop buttons or keys being held
  const repeat = useRef<Record<string, number>>({});
  const lockT = useRef({ t: 0, resets: 0 });
  const paused = useRef(false);
  const ended = useRef(false);
  const [isPaused, setPaused] = useState(false);
  const [, redraw] = useState(0);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const finish = (why: BrickResult['why']) => {
    if (ended.current) return;
    ended.current = true;
    const g = game.current;
    onEndRef.current({ score: g.score, rows: g.rows, level: g.level, bigClears: g.bigClears, why });
  };
  const setPause = (p: boolean) => {
    paused.current = p;
    setPaused(p);
  };

  /** Something moved the brick while it was resting: give it a little longer before it sticks. */
  const moved = (ok: boolean) => {
    const g = game.current;
    if (ok && !B.fits(g.well, { ...g.piece, y: g.piece.y + 1 }) && lockT.current.resets < MAX_RESETS) {
      lockT.current.t = 0;
      lockT.current.resets++;
    }
  };
  const newBrick = () => {
    lockT.current = { t: 0, resets: 0 };
  };

  const act = (a: Act, now = performance.now() / 1000) => {
    const g = game.current;
    if (a === 'pause') return setPause(!paused.current);
    if (paused.current || g.over) return;
    if (a === 'left') moved(B.shift(g, -1));
    else if (a === 'right') moved(B.shift(g, 1));
    else if (a === 'down') {
      if (B.fall(g, true)) lockT.current.t = 0;
    } else if (a === 'cw') moved(B.turn(g, 1));
    else if (a === 'ccw') moved(B.turn(g, -1));
    else if (a === 'slam') {
      B.slam(g, now);
      newBrick();
    } else if (a === 'hold' && B.hold(g)) newBrick();
  };
  const press = (a: Act) => {
    if (held.current.has(a)) return;
    act(a);
    if (a === 'left' || a === 'right' || a === 'down') {
      held.current.add(a);
      repeat.current[a] = a === 'down' ? REPEAT_EVERY : REPEAT_WAIT;
      if (a === 'left') held.current.delete('right');
      if (a === 'right') held.current.delete('left');
    }
  };
  const release = (a: Act) => held.current.delete(a);

  // ⌨️ keys
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const a = KEYS[e.key.toLowerCase()];
      if (!a) return;
      e.preventDefault();
      if (e.repeat) return; // we do our own repeating
      press(a);
    };
    const ku = (e: KeyboardEvent) => {
      const a = KEYS[e.key.toLowerCase()];
      if (a) release(a);
    };
    const away = () => {
      held.current.clear();
      if (!game.current.over) setPause(true);
    };
    const vis = () => document.hidden && away();
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', away);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', away);
      document.removeEventListener('visibilitychange', vis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🖱️ / 👆 on the well: tap = turn, drag sideways = move, drag down = drop faster, flick down = slam. Right click = hold.
  const drag = useRef<{ id: number; x: number; y: number; t: number; sx: number; sy: number; movedAny: boolean } | null>(null);
  const cellPx = useRef(24);
  const onDown = (e: React.PointerEvent) => {
    if (e.button === 2) {
      act('hold');
      return;
    }
    if (paused.current) return setPause(false);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), movedAny: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const c = cellPx.current;
    while (e.clientX - d.x > c) {
      act('right');
      d.x += c;
      d.movedAny = true;
    }
    while (d.x - e.clientX > c) {
      act('left');
      d.x -= c;
      d.movedAny = true;
    }
    while (e.clientY - d.y > c) {
      act('down');
      d.y += c;
      d.movedAny = true;
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const dt = performance.now() - d.t;
    const dy = e.clientY - d.sy;
    const dx = e.clientX - d.sx;
    if (dy > cellPx.current * 2 && dt < 250 && Math.abs(dy) > Math.abs(dx) * 1.5) act('slam'); // a quick flick down
    else if (!d.movedAny && Math.hypot(dx, dy) < 10) act(e.clientX < (canvas.current?.getBoundingClientRect().left ?? 0) + (canvas.current?.clientWidth ?? 0) * 0.25 ? 'ccw' : 'cw');
  };

  // 🎬 the loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now() / 1000;
    let fallT = 0;
    let overAt = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now() / 1000;
      const dt = Math.min(0.1, now - last);
      last = now;
      const g = game.current;
      if (!paused.current && !g.over) {
        for (const a of held.current) {
          repeat.current[a] -= dt;
          while (repeat.current[a] <= 0) {
            act(a, now);
            repeat.current[a] += REPEAT_EVERY;
          }
        }
        const resting = !B.fits(g.well, { ...g.piece, y: g.piece.y + 1 });
        if (resting) {
          lockT.current.t += dt;
          if (lockT.current.t >= LOCK_DELAY) {
            B.lock(g, now);
            newBrick();
            fallT = 0;
          }
        } else {
          fallT += dt;
          const ft = B.fallTime(g.level);
          while (fallT >= ft) {
            fallT -= ft;
            if (!B.fall(g)) break;
          }
        }
      }
      // However it ended (a brick that stopped by itself, or one dropped with Space), show it for a moment.
      if (g.over && !overAt) {
        overAt = now;
        redraw((n) => n + 1);
        setTimeout(() => finish('over'), 1200);
      }
      draw(now);
    };

    const draw = (now: number) => {
      const cv = canvas.current;
      const ctx = cv?.getContext('2d');
      if (!cv || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = game.current;
      const narrow = W < H * 0.75; // phone upright: side bits go above the well
      const c = Math.floor(narrow ? Math.min((H - 8) / (B.ROWS + 4.2), (W - 8) / B.COLS) : Math.min((H - 16) / B.ROWS, (W - 16) / (B.COLS + 12)));
      cellPx.current = c;
      const wellW = c * B.COLS;
      const wellH = c * B.ROWS;
      const ox = Math.round((W - wellW) / 2);
      const oy = narrow ? Math.round(H - wellH - 4) : Math.round((H - wellH) / 2);

      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, skin.bg[0]);
      bg.addColorStop(1, skin.bg[1]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const dark = luminance(skin.bg[0]) < 0.4;
      const ink = dark ? '#fff' : '#3a2a3a';

      // the well
      ctx.fillStyle = dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.55)';
      roundRect(ctx, ox - 4, oy - 4, wellW + 8, wellH + 8, 10);
      ctx.fill();
      ctx.strokeStyle = skin.grid;
      ctx.lineWidth = 1;
      for (let x = 1; x < B.COLS; x++) line(ctx, ox + x * c, oy, ox + x * c, oy + wellH);
      for (let y = 1; y < B.ROWS; y++) line(ctx, ox, oy + y * c, ox + wellW, oy + y * c);

      const square = (k: number, x: number, y: number, size: number, alpha = 1) => {
        ctx.globalAlpha = alpha;
        const col = skin.colors[k - 1];
        const r = size * 0.22;
        ctx.fillStyle = col;
        roundRect(ctx, x + 1, y + 1, size - 2, size - 2, r);
        ctx.fill();
        // a soft shine and shadow so they look squishy
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        roundRect(ctx, x + size * 0.16, y + size * 0.12, size * 0.68, size * 0.22, r * 0.6);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        roundRect(ctx, x + 1, y + size * 0.78, size - 2, size * 0.2, r * 0.6);
        ctx.fill();
        if (skin.marks && size >= 14) {
          ctx.font = `${Math.round(size * 0.62)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(skin.marks[k - 1], x + size / 2, y + size / 2 + 1);
        }
        ctx.globalAlpha = 1;
      };

      // the pile (rows that just cleared flash white for a moment, drawn over below)
      for (let y = B.HIDDEN; y < B.ROWS + B.HIDDEN; y++)
        for (let x = 0; x < B.COLS; x++) if (g.well[y][x]) square(g.well[y][x], ox + x * c, oy + (y - B.HIDDEN) * c, c);

      if (!g.over) {
        const k = B.KINDS.indexOf(g.piece.kind) + 1;
        // 👻 where it will land
        const gy = B.dropY(g.well, g.piece);
        for (const [cx, cy] of B.cells(g.piece.kind, g.piece.rot)) {
          const y = gy + cy - B.HIDDEN;
          if (y < 0) continue;
          ctx.strokeStyle = skin.colors[k - 1];
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.7;
          roundRect(ctx, ox + (g.piece.x + cx) * c + 3, oy + y * c + 3, c - 6, c - 6, c * 0.2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        for (const [cx, cy] of B.cells(g.piece.kind, g.piece.rot)) {
          const y = g.piece.y + cy - B.HIDDEN;
          if (y >= 0) square(k, ox + (g.piece.x + cx) * c, oy + y * c, c);
        }
      }

      // ✨ cleared rows: a white flash that fades
      if (g.flash && now - g.flash.t < 0.35) {
        const a = 1 - (now - g.flash.t) / 0.35;
        ctx.fillStyle = `rgba(255,255,255,${0.8 * a})`;
        const n = g.flash.rows.length;
        // they've gone already; flash the bottom of where the pile settled
        for (let i = 0; i < n; i++) {
          const y = g.flash.rows[i] - B.HIDDEN;
          if (y >= 0) ctx.fillRect(ox, oy + y * c, wellW, c);
        }
        if (n >= 2) {
          ctx.globalAlpha = a;
          ctx.font = `900 ${Math.round(c * 1.3)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 5;
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          const word = n === 4 ? '🧱 TUMBLE! ×4' : n === 3 ? 'Triple!' : 'Double!';
          ctx.strokeText(word, ox + wellW / 2, oy + wellH * 0.4);
          ctx.fillStyle = '#ffeb3b';
          ctx.fillText(word, ox + wellW / 2, oy + wellH * 0.4);
          ctx.globalAlpha = 1;
        }
      }

      // side bits: hold, next, score
      const small = Math.max(10, Math.round(c * 0.6));
      const mini = (kind: B.Kind | null, x: number, y: number, size: number, dim = false) => {
        if (!kind) return;
        const cs = B.cells(kind, 0);
        const minX = Math.min(...cs.map((p) => p[0]));
        const maxX = Math.max(...cs.map((p) => p[0]));
        const minY = Math.min(...cs.map((p) => p[1]));
        const maxY = Math.max(...cs.map((p) => p[1]));
        const w = (maxX - minX + 1) * size;
        const h = (maxY - minY + 1) * size;
        for (const [cx, cy] of cs) square(B.KINDS.indexOf(kind) + 1, x - w / 2 + (cx - minX) * size, y - h / 2 + (cy - minY) * size, size, dim ? 0.4 : 1);
      };
      ctx.fillStyle = ink;
      ctx.textBaseline = 'alphabetic';
      const label = (t: string, x: number, y: number, align: CanvasTextAlign, size = small, weight = 700) => {
        ctx.font = `${weight} ${size}px system-ui, sans-serif`;
        ctx.textAlign = align;
        ctx.fillStyle = ink;
        ctx.fillText(t, x, y);
      };
      if (narrow) {
        const ty = oy - c * 3.6;
        label('HOLD', ox, ty + small, 'left', small * 0.8);
        mini(g.held, ox + c * 1.6, ty + c * 2.1, c * 0.6, !g.canHold);
        label('NEXT', ox + wellW, ty + small, 'right', small * 0.8);
        g.next.slice(0, 2).forEach((k, i) => mini(k, ox + wellW - c * 1.4 - i * c * 2.6, ty + c * 2.1, i ? c * 0.45 : c * 0.6));
        label(`${g.score}`, ox + wellW / 2, ty + small * 1.4, 'center', Math.round(small * 1.5), 900);
        label(`Level ${g.level} · ${g.rows} rows${best ? ` · best ${best}` : ''}`, ox + wellW / 2, ty + small * 2.8, 'center', Math.round(small * 0.75), 600);
      } else {
        const lx = ox - c * 3.5;
        label('HOLD', lx, oy + small, 'center');
        mini(g.held, lx, oy + c * 2.4, c * 0.8, !g.canHold);
        label('SCORE', lx, oy + c * 6, 'center', small * 0.85);
        label(`${g.score}`, lx, oy + c * 7.2, 'center', Math.round(small * 1.3), 900);
        label('LEVEL', lx, oy + c * 9, 'center', small * 0.85);
        label(`${g.level}`, lx, oy + c * 10.2, 'center', Math.round(small * 1.3), 900);
        label('ROWS', lx, oy + c * 12, 'center', small * 0.85);
        label(`${g.rows}`, lx, oy + c * 13.2, 'center', Math.round(small * 1.3), 900);
        if (best) {
          label('BEST', lx, oy + c * 15, 'center', small * 0.85);
          label(`${Math.max(best, g.score)}`, lx, oy + c * 16.2, 'center', Math.round(small * 1.1), 800);
        }
        const rx = ox + wellW + c * 3.5;
        label('NEXT', rx, oy + small, 'center');
        g.next.forEach((k, i) => mini(k, rx, oy + c * 2.4 + i * c * 3, i ? c * 0.6 : c * 0.8));
      }

      if (g.over) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(ox, oy, wellW, wellH);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${Math.round(c * 1.1)}px system-ui, sans-serif`;
        ctx.fillText('Topped out!', ox + wellW / 2, oy + wellH * 0.45);
      } else if (paused.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(ox, oy, wellW, wellH);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = `900 ${Math.round(c * 1.1)}px system-ui, sans-serif`;
        ctx.fillText('⏸ Paused', ox + wellW / 2, oy + wellH * 0.42);
        ctx.font = `600 ${Math.round(c * 0.55)}px system-ui, sans-serif`;
        ctx.fillText('Tap, or press P, to carry on', ox + wellW / 2, oy + wellH * 0.42 + c * 1.2);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // One game per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** On-screen buttons: pressed while the finger/mouse is down (◀ ▶ ▼ repeat). */
  const pad = (a: Act, text: string, title: string) => (
    <button
      type="button"
      className={`brick-run__btn brick-run__btn--${a}`}
      title={title}
      aria-label={title}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        press(a);
      }}
      onPointerUp={() => release(a)}
      onPointerCancel={() => release(a)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {text}
    </button>
  );

  return (
    <div className={`brick-run${screen.fake ? ' is-fake-full' : ''}`} ref={screen.ref}>
      <div className="brick-run__top">
        <FullscreenButton full={screen.full} toggle={() => void screen.toggle()} className="brick-run__small" />
        <button type="button" className="brick-run__small" onClick={() => setPause(!paused.current)}>
          {isPaused ? '▶ Go' : '⏸ Pause'}
        </button>
        <button type="button" className="brick-run__small" onClick={() => finish('quit')}>
          ✕ Stop
        </button>
      </div>
      <canvas
        ref={canvas}
        className="brick-run__canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (drag.current = null)}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="brick-run__pad">
        {pad('hold', '📥', 'Hold (C)')}
        {pad('ccw', '⟲', 'Turn left (Z)')}
        {pad('left', '◀', 'Left (←)')}
        {pad('down', '▼', 'Down faster (↓)')}
        {pad('right', '▶', 'Right (→)')}
        {pad('cw', '⟳', 'Turn right (↑)')}
        {pad('slam', '⤓', 'Drop (Space)')}
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
