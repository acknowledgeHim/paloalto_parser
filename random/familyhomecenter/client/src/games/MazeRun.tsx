import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import * as Z from './mazeLogic.js';
import { FullscreenButton, useFullscreen } from '../utils/fullscreen.js';
import { say, stopSpeaking } from '../utils/speech.js';

export interface MazeResult {
  score: number;
  /** the maze they got to */
  level: number;
  words: number;
  why: 'over' | 'quit';
}
export interface MazePlayer {
  id: string;
  color: string;
  avatar: string | null;
}

const KEYS: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
};
const EMOJI_FONT = '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';

/** The sentence with the word blanked out ("The ____ sat on the mat."). */
const blank = (sentence: string, w: string) => sentence.replace(new RegExp(`\\b${w}\\b`, 'gi'), '_____');

/** 🐝 One game of Letter Maze, from the first maze until the hearts run out (or Stop). */
export function MazeRun({
  mode,
  words,
  startLevel,
  shield,
  player,
  showWord,
  best,
  onLevel,
  onEnd,
}: {
  mode: Z.Mode;
  words: Z.MazeWord[];
  startLevel: number;
  /** 🏆 🛡️ the Bee shield prize is on */
  shield: boolean;
  player: MazePlayer;
  /** letters mode: show the word to spell (off = hear it and spell it) */
  showWord: boolean;
  best: number | null;
  /** a maze was finished: they can carry on from this one next time */
  onLevel: (level: number, score: number) => void;
  onEnd: (r: MazeResult) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const screen = useFullscreen<HTMLDivElement>();
  const game = useRef<Z.Maze>(Z.newMaze(mode, words, startLevel, Math.floor(Math.random() * 2 ** 31), shield));
  const wordsDone = useRef(0);
  const paused = useRef(false);
  const ended = useRef(false);
  const [isPaused, setPaused] = useState(false);
  const [peek, setPeek] = useState(false);
  const [, redraw] = useState(0);
  const toast = useRef<{ text: string; until: number; good: boolean } | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const onLevelRef = useRef(onLevel);
  onLevelRef.current = onLevel;

  const g0 = game.current;
  const now = Z.word(g0);
  const speak = () => void say(mode === 'letters' ? [now.word, now.sentence, now.word] : [now.word, now.sentence]);

  const finish = (why: MazeResult['why']) => {
    if (ended.current) return;
    ended.current = true;
    stopSpeaking();
    const g = game.current;
    onEndRef.current({ score: g.score, level: g.level, words: wordsDone.current, why });
  };
  const setPause = (p: boolean) => {
    paused.current = p;
    setPaused(p);
  };

  // 🔊 each new word is said out loud
  useEffect(() => {
    speak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g0.wordAt, g0.level]);
  useEffect(() => () => stopSpeaking(), []);

  // ⌨️ keys
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'p' || k === 'escape') {
        e.preventDefault();
        setPause(!paused.current);
        return;
      }
      const d = KEYS[k];
      if (!d) return;
      e.preventDefault();
      if (paused.current) setPause(false);
      game.current.want = { dx: d[0], dy: d[1] };
    };
    const away = () => !game.current.over && setPause(true);
    const vis = () => document.hidden && away();
    window.addEventListener('keydown', kd);
    window.addEventListener('blur', away);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('blur', away);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  // 👆 swipe on the maze
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (paused.current) return setPause(false);
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < 18) return;
    game.current.want = Math.abs(dx) > Math.abs(dy) ? { dx: Math.sign(dx), dy: 0 } : { dx: 0, dy: Math.sign(dy) };
    swipe.current = { x: e.clientX, y: e.clientY };
  };

  // 🎬 the loop
  useEffect(() => {
    const face = new Image();
    let faceOk = false;
    if (player.avatar === 'image' || player.avatar === 'video') {
      face.onload = () => (faceOk = true);
      face.src = `/api/family-members/${player.id}/avatar-image`;
    }
    let raf = 0;
    let last = performance.now() / 1000;
    let overAt = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = performance.now() / 1000;
      const dt = Math.min(0.05, t - last);
      last = t;
      const g = game.current;
      if (!paused.current && !g.over) {
        // small steps, so nothing jumps through anything
        for (let k = 0; k < 4; k++) Z.tick(g, dt / 4);
      }
      if (g.news.length) {
        for (const n of g.news) {
          if (n.kind === 'letter') continue;
          if (n.kind === 'word') {
            wordsDone.current++;
            toast.current = { text: `✅ ${n.text.toUpperCase()}!`, until: t + 1.6, good: true };
          } else if (n.kind === 'maze') {
            toast.current = { text: n.text, until: t + 2.2, good: true };
            onLevelRef.current(g.level, g.score);
          } else toast.current = { text: n.text, until: t + (n.kind === 'wrong' ? 1.8 : 1.4), good: n.kind === 'honey' || n.kind === 'bee' || n.kind === 'shield' };
        }
        g.news = [];
        redraw((x) => x + 1);
      }
      if (g.over && !overAt) {
        overAt = t;
        setTimeout(() => finish('over'), 1500);
      }
      draw(t);
    };

    const draw = (t: number) => {
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
      const S = Math.floor(Math.min(W / Z.MAZE_W, H / Z.MAZE_H));
      const ox = Math.round((W - S * Z.MAZE_W) / 2);
      const oy = Math.round((H - S * Z.MAZE_H) / 2);
      const cx = (x: number) => ox + (x + 0.5) * S;
      const cy = (y: number) => oy + (y + 0.5) * S;
      ctx.fillStyle = '#0b1030';
      ctx.fillRect(0, 0, W, H);
      // 🧱 the walls: hedges of soft blue
      for (let y = 0; y < Z.MAZE_H; y++)
        for (let x = 0; x < Z.MAZE_W; x++) {
          if (Z.isOpen(g, x, y)) continue;
          ctx.fillStyle = '#26357a';
          ctx.fillRect(ox + x * S, oy + y * S, S, S);
          ctx.fillStyle = '#3d52b5';
          const m = S * 0.18;
          const l = Z.isOpen(g, x - 1, y) ? m : 0;
          const r = Z.isOpen(g, x + 1, y) ? m : 0;
          const u = Z.isOpen(g, x, y - 1) ? m : 0;
          const d = Z.isOpen(g, x, y + 1) ? m : 0;
          ctx.fillRect(ox + x * S + l, oy + y * S + u, S - l - r, S - u - d);
        }
      // 🔤 the dots
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const d of g.dots) {
        const x = cx(d.x);
        const y = cy(d.y);
        if (d.honey) {
          const k = 1 + 0.12 * Math.sin(t * 5 + d.x);
          ctx.font = `${Math.round(S * 0.8 * k)}px ${EMOJI_FONT}`;
          ctx.fillStyle = '#000';
          ctx.fillText('🍯', x, y + S * 0.04);
          continue;
        }
        if (!d.text) continue;
        if (g.mode === 'letters') {
          ctx.fillStyle = '#fff8e1';
          ctx.beginPath();
          ctx.arc(x, y, S * 0.34, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#3e2723';
          ctx.font = `800 ${Math.round(S * 0.46)}px system-ui, sans-serif`;
          ctx.fillText(d.text.toUpperCase(), x, y + S * 0.03);
        } else {
          let size = Math.round(S * 0.42);
          ctx.font = `700 ${size}px system-ui, sans-serif`;
          const maxW = S * 2.8;
          const tw = ctx.measureText(d.text).width;
          if (tw > maxW) {
            size = Math.max(8, Math.floor((size * maxW) / tw));
            ctx.font = `700 ${size}px system-ui, sans-serif`;
          }
          const w = Math.min(maxW, tw) + S * 0.3;
          ctx.fillStyle = '#fff8e1';
          ctx.beginPath();
          ctx.roundRect(x - w / 2, y - S * 0.3, w, S * 0.6, S * 0.3);
          ctx.fill();
          ctx.fillStyle = '#3e2723';
          ctx.fillText(d.text, x, y + S * 0.02);
        }
      }
      // 🐝 the bees
      for (const b of g.bees) {
        if (b.out > 0 && Math.hypot(b.x - b.home[0], b.y - b.home[1]) < 0.01 && g.napping > 0) continue;
        const nap = g.napping > 0;
        const blink = nap && g.napping < 2 && Math.floor(t * 6) % 2 === 0;
        ctx.globalAlpha = nap ? (blink ? 1 : 0.55) : 1;
        ctx.save();
        ctx.translate(cx(b.x), cy(b.y) + Math.sin(t * 8 + b.home[0]) * S * 0.05);
        if (b.dx > 0) ctx.scale(-1, 1);
        ctx.font = `${Math.round(S * 0.85)}px ${EMOJI_FONT}`;
        ctx.fillStyle = '#000';
        ctx.fillText(b.look, 0, 0);
        ctx.restore();
        if (nap) {
          ctx.font = `${Math.round(S * 0.4)}px ${EMOJI_FONT}`;
          ctx.fillText('💤', cx(b.x) + S * 0.35, cy(b.y) - S * 0.4);
        }
        ctx.globalAlpha = 1;
      }
      // 😀 you: your colour, your avatar, a mouth that munches as you go
      const px = cx(g.you.x);
      const py = cy(g.you.y);
      const r = S * 0.42;
      const moving = g.you.dx || g.you.dy;
      const munch = moving ? 0.18 + 0.18 * Math.abs(Math.sin(t * 12)) : 0.05;
      const ang = Math.atan2(g.you.dy, g.you.dx || (g.you.dy ? 0 : 1));
      ctx.fillStyle = player.color || '#7c5cff';
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      if (faceOk) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, r * 0.82, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(face, px - r * 0.82, py - r * 0.82, r * 1.64, r * 1.64);
        ctx.restore();
      } else if (player.avatar && player.avatar !== 'image' && player.avatar !== 'video') {
        ctx.font = `${Math.round(r * 1.25)}px ${EMOJI_FONT}`;
        ctx.fillStyle = '#000';
        ctx.fillText(player.avatar, px, py + r * 0.06);
      }
      // the munching mouth: a dark wedge on the side you're heading
      ctx.fillStyle = 'rgba(20, 10, 30, 0.85)';
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(ang) * r * 0.35, py + Math.sin(ang) * r * 0.35);
      ctx.arc(px, py, r, ang - munch * Math.PI, ang + munch * Math.PI);
      ctx.closePath();
      ctx.fill();
      if (g.shield > 0) {
        ctx.strokeStyle = `rgba(129, 212, 250, ${0.6 + 0.3 * Math.sin(t * 4)})`;
        ctx.lineWidth = Math.max(2, S * 0.08);
        ctx.beginPath();
        ctx.arc(px, py, r * 1.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 💬 what just happened
      const tt = toast.current;
      if (tt && t < tt.until) {
        ctx.font = `800 ${Math.round(Math.min(30, W / 18))}px system-ui, sans-serif`;
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.strokeText(tt.text, W / 2, oy + S * 1.6);
        ctx.fillStyle = tt.good ? '#ffeb3b' : '#ff8a80';
        ctx.fillText(tt.text, W / 2, oy + S * 1.6);
      }
      if (g.frozen > 0 && !g.over) {
        ctx.font = `800 ${Math.round(S * 0.8)}px system-ui, sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.fillText('Get ready…', W / 2, cy(7));
      }
      if (g.over) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(ox, oy, S * Z.MAZE_W, S * Z.MAZE_H);
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${Math.round(S * 1.1)}px system-ui, sans-serif`;
        ctx.fillText('Out of hearts!', W / 2, H / 2);
      } else if (paused.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(ox, oy, S * Z.MAZE_W, S * Z.MAZE_H);
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${Math.round(S * 1)}px system-ui, sans-serif`;
        ctx.fillText('⏸ Paused', W / 2, H / 2 - S * 0.5);
        ctx.font = `600 ${Math.round(S * 0.5)}px system-ui, sans-serif`;
        ctx.fillText('Tap, or press an arrow, to carry on', W / 2, H / 2 + S * 0.6);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // One game per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pad = (dx: number, dy: number, text: string, label: string) => (
    <button
      type="button"
      className="maze-run__btn"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        if (paused.current) setPause(false);
        game.current.want = { dx, dy };
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {text}
    </button>
  );

  const g = game.current;
  const target = Z.word(g);
  return (
    <div className={`brick-run maze-run${screen.fake ? ' is-fake-full' : ''}`} ref={screen.ref}>
      <div className="brick-run__top">
        <FullscreenButton full={screen.full} toggle={() => void screen.toggle()} className="brick-run__small" />
        <button type="button" className="brick-run__small" onClick={() => setPause(!paused.current)}>
          {isPaused ? '▶ Go' : '⏸ Pause'}
        </button>
        <button type="button" className="brick-run__small" onClick={() => finish('quit')}>
          ✕ Stop
        </button>
      </div>
      <div className="maze-run__clue">
        <div className="maze-run__stats">
          <span>{'❤️'.repeat(Math.max(0, g.lives))}</span>
          {g.shield > 0 && <span>🛡️</span>}
          <span>
            🏁 Maze {g.level} · word {g.doneInMaze + 1} of {Z.WORDS_PER_MAZE}
          </span>
          <span>
            ⭐ {g.score}
            {best ? ` · best ${Math.max(best, g.score)}` : ''}
          </span>
        </div>
        {mode === 'letters' ? (
          <div className="maze-run__word" aria-live="polite">
            {[...target.word].map((ch, i) => (
              <span key={i} className={i < g.got ? 'is-got' : i === g.got ? 'is-next' : ''}>
                {i < g.got || showWord || peek ? ch.toUpperCase() : '_'}
              </span>
            ))}
          </div>
        ) : (
          <div className="maze-run__word maze-run__word--clue">🔎 {target.meaning}</div>
        )}
        <div className="maze-run__hint">
          {mode === 'words' ? <>“{blank(target.sentence, target.word)}” — eat the word spelled right!</> : <>Eat the letters in order. {target.meaning}</>}{' '}
          <button type="button" className="brick-run__small" onClick={speak}>
            🔊 Say it
          </button>
          {mode === 'letters' && !showWord && (
            <button type="button" className="brick-run__small" onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}>
              👀 Hold to peek
            </button>
          )}
        </div>
      </div>
      <canvas
        ref={canvas}
        className="brick-run__canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (swipe.current = null)}
        onPointerCancel={() => (swipe.current = null)}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="maze-run__pad">
        <span />
        {pad(0, -1, '▲', 'Up')}
        <span />
        {pad(-1, 0, '◀', 'Left')}
        {pad(0, 1, '▼', 'Down')}
        {pad(1, 0, '▶', 'Right')}
      </div>
    </div>
  );
}
