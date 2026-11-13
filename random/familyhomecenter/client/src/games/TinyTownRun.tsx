import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BRIDGE,
  BUILDINGS,
  DEFAULT_TAX,
  GRASS,
  TREE,
  W,
  WATER,
  anchorOf,
  build,
  buildingOf,
  isFiller,
  isRoadCh,
  repair,
  repairCost,
  canBuild,
  hasRoad,
  homeLook,
  report,
  step,
  tips,
  type Building,
  type Cat,
  type Region,
  type Tool,
  type Town,
} from './townLogic.js';
import { callKey, makeTraffic, metroLine, placeAgent, type Agent } from './townTraffic.js';
import { drawArt } from './townArt.js';
import { FullscreenButton, useFullscreen } from '../utils/fullscreen.js';

/** Days a second, by speed: ⏸ / ▶ / ⏩. */
const SPEEDS = [0, 1500, 500];
const PAINT = new Set(['=', 'p', '%']); // tools that draw as you drag (🚜 clearing doesn't: only the square you tap)

const PAD: Record<Cat, string> = {
  road: '#9e9e9e',
  home: '#ffe7c2',
  work: '#cfe3fb',
  service: '#f9d3e1',
  transit: '#d6e4f0',
  nature: '',
  utility: '#e6d6f2',
  fun: '#fff3a6',
  special: '#cdf3e6',
};
const GROUPS: Array<{ title: string; cats: Cat[] }> = [
  { title: '🛣️ Roads & homes', cats: ['road', 'home'] },
  { title: '💼 Jobs', cats: ['work'] },
  { title: '⚡ Power & water', cats: ['utility'] },
  { title: '🌳 Nice places', cats: ['nature'] },
  { title: '🏫 Town services', cats: ['service'] },
  { title: '🚏 Getting around', cats: ['transit'] },
  { title: '🎡 Fun places', cats: ['fun'] },
];

/** 💎 The token shop: what each thing costs this person (parents: 0) and the 🪙 a coin bag gives. */
export interface TokenShop {
  items: Record<string, { name: string; cost: number; coins: number }>;
  balance: number;
  /** spend the tokens (the server takes them): what it gave, or null if it didn't go through (it says why) */
  buy: (item: string) => Promise<{ coins: number } | null>;
}

/** Emoji drawn once per size, then copied — much faster than drawing text every frame. */
const glyphs = new Map<string, HTMLCanvasElement>();
function glyph(e: string, px: number): HTMLCanvasElement {
  const key = `${e}|${px}`;
  let c = glyphs.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = Math.ceil(px * 1.25);
    const g = c.getContext('2d')!;
    g.font = `${px}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(e, c.width / 2, c.height / 2 + px * 0.06);
    glyphs.set(key, c);
  }
  return c;
}

/** One person or vehicle at (sx, sy) on screen; gives back the patch to clear next time. */
function drawAgent(g: CanvasRenderingContext2D, a: Agent, sx: number, sy: number, dx: number, dy: number, T: number): [number, number, number, number] {
  if (a.kind === 'walker') {
    const s = Math.max(9, Math.round(T * 0.5));
    const img = glyph(a.look, s);
    const sz = s * 1.25;
    g.save();
    g.translate(sx, sy);
    if (dx > 0) g.scale(-1, 1); // the emoji walk to the left; turn them round going right
    g.drawImage(img, -sz / 2, -sz * 0.62, sz, sz);
    g.restore();
    return [sx - sz / 2 - 2, sy - sz * 0.62 - 2, sz + 4, sz + 4];
  }
  const LEN: Record<string, number> = { tram: 0.9, bus: 0.72, truck: 0.56, fire: 0.62, ambulance: 0.5, train: 1.5, car: 0.42, police: 0.44 };
  const len = T * (LEN[a.kind] ?? 0.42);
  const wid = Math.max(4, T * (a.kind === 'car' || a.kind === 'police' ? 0.24 : a.kind === 'train' ? 0.3 : 0.27));
  g.save();
  g.translate(sx, sy);
  g.rotate(Math.atan2(dy, dx));
  const body = (x: number, w: number, colour: string) => {
    g.fillStyle = colour;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, -wid / 2, w, wid, Math.min(3, wid / 3));
    else g.rect(x, -wid / 2, w, wid);
    g.fill();
  };
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = 2;
  if (a.kind === 'truck') {
    body(-len / 2, len * 0.68, a.look); // the load
    body(len / 2 - len * 0.28, len * 0.28, '#1565c0'); // the cab
  } else if (a.kind === 'train') {
    // 3 carriages
    for (let k = 0; k < 3; k++) body(-len / 2 + (k * len) / 3, len / 3 - 1.5, a.look);
  } else body(-len / 2, len, a.look);
  g.shadowBlur = 0;
  const glass = 'rgba(30,40,60,0.75)';
  if (a.kind === 'bus' || a.kind === 'tram') {
    g.fillStyle = glass;
    for (let k = 0; k < 4; k++) g.fillRect(-len / 2 + len * (0.12 + k * 0.2), -wid / 2 + 1, len * 0.12, wid - 2);
  } else if (a.kind === 'train') {
    g.fillStyle = '#c62828'; // a red stripe down the side
    g.fillRect(-len / 2, -1, len, 2);
    g.fillStyle = glass;
    g.fillRect(len / 2 - len * 0.06, -wid / 2 + 1, len * 0.04, wid - 2);
  } else {
    g.fillStyle = glass;
    g.fillRect(len / 2 - len * (a.kind === 'truck' ? 0.16 : 0.32), -wid / 2 + 1, len * 0.12, wid - 2);
  }
  if (a.kind === 'police') {
    g.fillStyle = '#1a237e'; // dark doors
    g.fillRect(-len * 0.2, -wid / 2, len * 0.3, wid);
  }
  if (a.kind === 'fire') {
    g.strokeStyle = '#eeeeee'; // the ladder on top
    g.lineWidth = 1;
    g.strokeRect(-len * 0.4, -wid * 0.22, len * 0.6, wid * 0.44);
    for (let k = 1; k < 5; k++) line(g, -len * 0.4 + (len * 0.6 * k) / 5, -wid * 0.22, -len * 0.4 + (len * 0.6 * k) / 5, wid * 0.22);
  }
  if (a.kind === 'ambulance') {
    g.fillStyle = '#e53935'; // a red cross on the roof
    g.fillRect(-len * 0.2, -wid * 0.08, len * 0.3, wid * 0.16);
    g.fillRect(-len * 0.05 - wid * 0.08, -wid * 0.3, wid * 0.16, wid * 0.6);
  }
  if (a.kind === 'police' || a.kind === 'fire' || a.kind === 'ambulance') {
    // the light bar: flashing red / blue when they're on a call
    const on = a.lights && Math.floor(performance.now() / 220) % 2 === 0;
    g.fillStyle = a.lights ? (on ? '#ff1744' : '#2979ff') : '#90a4ae';
    g.fillRect(len * 0.02, -wid / 2 + 1, len * 0.08, (wid - 2) / 2);
    g.fillStyle = a.lights ? (on ? '#2979ff' : '#ff1744') : '#90a4ae';
    g.fillRect(len * 0.02, 0, len * 0.08, (wid - 2) / 2);
    if (a.lights) {
      g.fillStyle = on ? 'rgba(255,23,68,0.25)' : 'rgba(41,121,255,0.25)';
      g.beginPath();
      g.arc(len * 0.06, 0, wid * 1.1, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  const r = len / 2 + wid + 4;
  return [sx - r, sy - r, r * 2, r * 2];
}
function line(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

export interface RunProps {
  town: Town;
  region: Region;
  owned: { fun: boolean };
  shop: TokenShop;
  /** ⏰ a parent's minutes for today are used up: why (the town saves and closes soon) */
  timeUp: string | null;
  onSave: (t: Town) => void;
  onExit: (t: Town) => void;
}

/** 🏘️ Tiny Town: the map, the tools, and the days going by. */
export function TinyTownRun({ town, region, owned, shop, timeUp, onSave, onExit }: RunProps) {
  const t = useRef<Town>({ ...town });
  const [, setTick] = useState(0);
  const redraw = () => setTick((n) => n + 1);
  const [speed, setSpeed] = useState(1);
  const [tool, setTool] = useState<Tool>({ kind: 'build', ch: '=' });
  const [picked, setPicked] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [mood, setMood] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const screen = useFullscreen<HTMLDivElement>();
  const [tile, setTile] = useState(24);
  const rep = useMemo(() => report(t.current), [t.current.day, t.current.map, t.current.pops, t.current.tax]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit the land to the screen to start with.
  useEffect(() => {
    const w = wrap.current?.clientWidth ?? 800;
    setTile(Math.max(14, Math.min(40, Math.floor(w / region.w))));
  }, [region.w]);

  // 📅 The days go by. Saved every 30 days, and when leaving.
  useEffect(() => {
    if (!SPEEDS[speed]) return;
    const id = setInterval(() => {
      step(t.current);
      if (t.current.day % 30 === 0) onSave({ ...t.current });
      redraw();
    }, SPEEDS[speed]);
    return () => clearInterval(id);
  }, [speed]); // eslint-disable-line react-hooks/exhaustive-deps
  const latest = useRef(onSave);
  latest.current = onSave;
  useEffect(() => {
    const away = () => latest.current({ ...t.current });
    window.addEventListener('pagehide', away);
    return () => window.removeEventListener('pagehide', away);
  }, []);
  // ⏰ Out of minutes: a minute to finish up, then it saves and closes.
  useEffect(() => {
    if (!timeUp) return;
    const id = setTimeout(() => onExit({ ...t.current }), 60_000);
    return () => clearTimeout(id);
  }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 🎨 drawing ----
  const draw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const T = tile;
    c.width = region.w * T * dpr;
    c.height = region.h * T * dpr;
    c.style.width = `${region.w * T}px`;
    c.style.height = `${region.h * T}px`;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const map = t.current.map;
    const moon = t.current.land === 'moon';
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < map.length / W ? map[y * W + x] : '');
    const isRoad = (x: number, y: number) => isRoadCh(at(x, y));
    const isRail = (x: number, y: number) => at(x, y) === '%';
    const bigOnes: number[] = [];
    for (let ry = 0; ry < region.h; ry++)
      for (let rx = 0; rx < region.w; rx++) {
        const x = region.x0 + rx, y = region.y0 + ry, i = y * W + x;
        const ch = map[i];
        const px = rx * T, py = ry * T;
        if (ch === WATER || ch === BRIDGE) {
          // 🌙 on the Moon the water is ice in the craters
          g.fillStyle = moon ? ((x + y) % 2 ? '#d4e6ee' : '#cbe0ea') : (x + y) % 2 ? '#5aa9e6' : '#55a3df';
          g.fillRect(px, py, T, T);
        } else {
          g.fillStyle = moon ? ((x + y) % 2 ? '#a5a5ab' : '#9d9da3') : (x + y) % 2 ? '#94c95a' : '#8ec454';
          g.fillRect(px, py, T, T);
          if (moon && ((x * 7 + y * 13) % 11 === 0)) {
            // little craters in the dust
            g.strokeStyle = 'rgba(0,0,0,0.18)';
            g.lineWidth = 1;
            g.beginPath();
            g.arc(px + T * 0.5, py + T * 0.5, T * 0.22, 0, Math.PI * 2);
            g.stroke();
          }
        }
        if (isRoadCh(ch)) {
          g.fillStyle = ch === BRIDGE ? '#a1785a' : '#7f7f7f';
          const m = T * 0.2;
          g.fillRect(px + m, py + m, T - 2 * m, T - 2 * m);
          if (isRoad(x - 1, y)) g.fillRect(px, py + m, m, T - 2 * m);
          if (isRoad(x + 1, y)) g.fillRect(px + T - m, py + m, m, T - 2 * m);
          if (isRoad(x, y - 1)) g.fillRect(px + m, py, T - 2 * m, m);
          if (isRoad(x, y + 1)) g.fillRect(px + m, py + T - m, T - 2 * m, m);
          if (T >= 18 && ch === '=') {
            g.fillStyle = 'rgba(255,255,255,0.7)';
            const d = Math.max(1, T / 14);
            if (isRoad(x - 1, y) || isRoad(x + 1, y)) g.fillRect(px + T * 0.3, py + T / 2 - d / 2, T * 0.4, d);
            if (isRoad(x, y - 1) || isRoad(x, y + 1)) g.fillRect(px + T / 2 - d / 2, py + T * 0.3, d, T * 0.4);
          }
          if (ch === '%') {
            // 🚋 two rails along the line, with sleepers
            g.fillStyle = '#4e342e';
            const w = Math.max(1, T / 16);
            const across = isRail(x - 1, y) || isRail(x + 1, y) || !(isRail(x, y - 1) || isRail(x, y + 1));
            const down = isRail(x, y - 1) || isRail(x, y + 1);
            if (across) {
              const x0 = isRail(x - 1, y) ? px : px + T * 0.3, x1 = isRail(x + 1, y) ? px + T : px + T * 0.7;
              for (let k = 0; k < 3; k++) g.fillRect(px + T * (0.15 + k * 0.3), py + T * 0.3, w * 1.5, T * 0.4);
              g.fillStyle = '#b0bec5';
              g.fillRect(x0, py + T * 0.36, x1 - x0, w);
              g.fillRect(x0, py + T * 0.62, x1 - x0, w);
            }
            if (down) {
              g.fillStyle = '#4e342e';
              const y0 = isRail(x, y - 1) ? py : py + T * 0.3, y1 = isRail(x, y + 1) ? py + T : py + T * 0.7;
              for (let k = 0; k < 3; k++) g.fillRect(px + T * 0.3, py + T * (0.15 + k * 0.3), T * 0.4, w * 1.5);
              g.fillStyle = '#b0bec5';
              g.fillRect(px + T * 0.36, y0, w, y1 - y0);
              g.fillRect(px + T * 0.62, y0, w, y1 - y0);
            }
          }
          continue;
        }
        if (isFiller(ch)) continue; // part of a 2 × 2 building (drawn below)
        if (ch === TREE) {
          g.drawImage(glyph(moon ? '🪨' : '🌲', Math.round(T * 0.8)), px - T * 0.0, py - T * 0.05, T, T);
          continue;
        }
        const b = buildingOf(ch);
        if (!b) continue;
        if (b.size === 2) {
          bigOnes.push(i);
          continue;
        }
        if (drawArt(g, ch, i, px, py, T, t.current.day)) {
          if (mood && b.homes) {
            g.fillStyle = `hsla(${Math.round((rep.homeHappy.get(i) ?? 50) * 1.2)}, 85%, 50%, 0.45)`;
            g.fillRect(px + 1, py + 1, T - 2, T - 2);
          }
          if (b.homes) {
            const p = t.current.pops.charCodeAt(i) - 48;
            g.fillStyle = 'rgba(0,0,0,0.25)';
            g.fillRect(px + 2, py + T - 4, T - 4, 3);
            g.fillStyle = '#2e7d32';
            g.fillRect(px + 2, py + T - 4, ((T - 4) * p) / b.homes, 3);
          }
          if (b.needsRoad && !hasRoad(map, i) && T >= 14) g.drawImage(glyph('🚧', Math.round(T * 0.42)), px + T * 0.5, py - T * 0.05, T * 0.55, T * 0.55);
          continue;
        }
        if (PAD[b.cat]) {
          g.fillStyle = PAD[b.cat];
          g.fillRect(px + 1, py + 1, T - 2, T - 2);
        }
        if (mood && b.homes) {
          const h = rep.homeHappy.get(i) ?? 50;
          g.fillStyle = `hsla(${Math.round(h * 1.2)}, 85%, 50%, 0.6)`;
          g.fillRect(px + 1, py + 1, T - 2, T - 2);
        }
        g.drawImage(glyph(b.emoji, Math.round(T * 0.78)), px, py, T, T);
        if (b.homes) {
          const p = t.current.pops.charCodeAt(i) - 48;
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(px + 2, py + T - 4, T - 4, 3);
          g.fillStyle = '#2e7d32';
          g.fillRect(px + 2, py + T - 4, ((T - 4) * p) / b.homes, 3);
        }
        if (b.needsRoad && !hasRoad(map, i) && T >= 14) g.drawImage(glyph('🚧', Math.round(T * 0.42)), px + T * 0.5, py - T * 0.05, T * 0.55, T * 0.55);
      }
    // 🏬 2 × 2 buildings, on top of the ground around them
    for (const i of bigOnes) {
      const b = buildingOf(map[i])!;
      const px = ((i % W) - region.x0) * T, py = (Math.floor(i / W) - region.y0) * T;
      if (b.id === 'airport') {
        g.fillStyle = '#cfd8dc';
        g.fillRect(px + 1, py + 1, 2 * T - 2, 2 * T - 2);
        g.fillStyle = '#546e7a'; // the runway
        g.fillRect(px + T * 0.15, py + T * 1.2, T * 1.7, T * 0.45);
        g.fillStyle = '#fff';
        for (let k = 0; k < 5; k++) g.fillRect(px + T * (0.3 + k * 0.32), py + T * 1.41, T * 0.16, Math.max(1, T * 0.04));
        g.fillStyle = '#90a4ae'; // the terminal
        g.fillRect(px + T * 0.2, py + T * 0.2, T * 0.9, T * 0.55);
        g.drawImage(glyph('✈️', Math.round(T * 0.9)), px + T * 0.95, py + T * 0.05, T * 1.05, T * 1.05);
      } else {
        g.fillStyle = PAD[b.cat] || '#e0e0e0';
        g.fillRect(px + 2, py + 2, 2 * T - 4, 2 * T - 4);
        g.strokeStyle = 'rgba(0,0,0,0.15)';
        g.lineWidth = 1;
        g.strokeRect(px + 2.5, py + 2.5, 2 * T - 5, 2 * T - 5);
        g.drawImage(glyph(b.emoji, Math.round(T * 1.5)), px + T * 0.05, py + T * 0.05, T * 1.9, T * 1.9);
      }
      if (b.needsRoad && !hasRoad(map, i) && T >= 14) g.drawImage(glyph('🚧', Math.round(T * 0.5)), px + T * 1.3, py, T * 0.65, T * 0.65);
    }
    // 🏚️ burnt buildings: dark, with a 🔨 sign (🔥 and 🦹 move, so they're on the layer above)
    for (const e of t.current.events ?? []) {
      if (e.kind !== 'burnt') continue;
      const big = buildingOf(map[e.i])?.size === 2 ? 2 : 1;
      const px = ((e.i % W) - region.x0) * T, py = (Math.floor(e.i / W) - region.y0) * T;
      g.fillStyle = 'rgba(40,30,25,0.72)';
      g.fillRect(px + 1, py + 1, big * T - 2, big * T - 2);
      g.drawImage(glyph('🏚️', Math.round(T * 0.6 * big)), px + T * 0.12 * big, py + T * 0.05 * big, T * 0.75 * big, T * 0.75 * big);
      g.drawImage(glyph('🔨', Math.round(T * 0.4)), px + big * T - T * 0.5, py + big * T - T * 0.5, T * 0.5, T * 0.5);
    }
    // 🚇 The metro line, underground: a dashed line from station to station.
    const metro = metroLine(map);
    if (metro.length >= 2) {
      g.save();
      g.strokeStyle = 'rgba(106, 27, 154, 0.55)';
      g.lineWidth = Math.max(2, T * 0.14);
      g.setLineDash([T * 0.35, T * 0.25]);
      g.lineCap = 'round';
      g.beginPath();
      metro.forEach((s, k) => {
        const sx = ((s % W) - region.x0 + 0.5) * T, sy = (Math.floor(s / W) - region.y0 + 0.5) * T;
        if (k) g.lineTo(sx, sy);
        else g.moveTo(sx, sy);
      });
      g.stroke();
      g.restore();
    }
    // The tile under the pointer: what would happen there.
    const show = hover ?? picked;
    if (show !== null) {
      const rx = (show % W) - region.x0, ry = Math.floor(show / W) - region.y0;
      if (rx >= 0 && ry >= 0 && rx < region.w && ry < region.h) {
        let px = rx * T, py = ry * T;
        let colour = '#ffffff';
        // how big an outline: a 2 × 2 building being placed, or the whole of one being cleared / looked at
        let sz = tool.kind === 'build' && buildingOf(tool.ch)?.size === 2 && hover !== null ? 2 : 1;
        if (!(tool.kind === 'build') && buildingOf(map[anchorOf(map, show)])?.size === 2) {
          const a = anchorOf(map, show);
          px = ((a % W) - region.x0) * T;
          py = (Math.floor(a / W) - region.y0) * T;
          sz = 2;
        }
        if (hover !== null && (tool.kind === 'build' || tool.kind === 'bulldoze')) {
          const can = canBuild(t.current, show, tool, region, owned);
          colour = can.ok ? '#00e676' : '#ff5252';
          if (tool.kind === 'build' && can.ok) {
            g.globalAlpha = 0.6;
            g.drawImage(glyph(buildingOf(tool.ch)!.emoji, Math.round(T * 0.78 * sz)), px, py, T * sz, T * sz);
            g.globalAlpha = 1;
          }
        }
        g.strokeStyle = colour;
        g.lineWidth = 2;
        g.strokeRect(px + 1, py + 1, T * sz - 2, T * sz - 2);
      }
    }
  }, [tile, region, hover, picked, tool, mood, rep, owned]);
  useEffect(draw);

  // ---- 🚶🚗 people and cars going about (just for looks; townTraffic.ts) ----
  const moving = useRef<HTMLCanvasElement>(null);
  const traffic = useRef(makeTraffic());
  const [showTraffic, setShowTrafficState] = useState(() => {
    try {
      return localStorage.getItem('fhc.town.traffic') !== '0';
    } catch {
      return true;
    }
  });
  const setShowTraffic = (on: boolean) => {
    setShowTrafficState(on);
    try {
      localStorage.setItem('fhc.town.traffic', on ? '1' : '0');
    } catch {
      /* fine: just not remembered */
    }
  };
  useEffect(() => traffic.current.update(t.current.map, t.current.pops, rep.pop, t.current.events ?? []), [rep]);
  const speedNow = useRef(speed);
  speedNow.current = speed;
  useEffect(() => {
    const c = moving.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const T = tile;
    c.width = region.w * T * dpr; // (this clears it too)
    c.height = region.h * T * dpr;
    c.style.width = `${region.w * T}px`;
    c.style.height = `${region.h * T}px`;
    if (!showTraffic) return;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    let dirty: Array<[number, number, number, number]> = [];
    let last = performance.now(), drawn = 0, raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const mult = [0, 1, 2.2][speedNow.current] ?? 1;
      // ~30 a second while moving, a few a second when paused (so changes still show)
      if (now - drawn < (mult ? 33 : 250)) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = drawn = now;
      traffic.current.advance(dt * mult);
      for (const [x, y, w, h] of dirty) g.clearRect(x, y, w, h);
      dirty = [];
      const map = t.current.map;
      for (const e of t.current.events ?? []) {
        if (e.kind === 'burnt') continue;
        const big = buildingOf(map[e.i])?.size === 2 ? 2 : 1;
        const cx = ((e.i % W) - region.x0 + big / 2) * T, cy = (Math.floor(e.i / W) - region.y0 + big / 2) * T;
        const r = (T * big) / 2 + T * 0.5;
        dirty.push([cx - r, cy - r - T * 0.6, r * 2, r * 2 + T * 0.6]);
        if (e.kind === 'fire') {
          // 🔥 flickering flames and grey smoke rising
          for (let k = 0; k < 3; k++) {
            const rise = ((now / 1200 + k / 3) % 1) * T * 0.9;
            g.fillStyle = `rgba(90,90,90,${0.45 * (1 - rise / (T * 0.9))})`;
            g.beginPath();
            g.arc(cx + Math.sin(now / 400 + k) * T * 0.12, cy - T * 0.25 * big - rise, T * (0.12 + rise / T / 4), 0, Math.PI * 2);
            g.fill();
          }
          const f = 1 + Math.sin(now / 90) * 0.08;
          const sz = T * 0.7 * big * f;
          g.drawImage(glyph('🔥', Math.round(T * 0.6 * big)), cx - sz / 2 - T * 0.12, cy - sz / 2 + T * 0.05, sz, sz);
          g.drawImage(glyph('🔥', Math.round(T * 0.5 * big)), cx - sz * 0.3 + T * 0.18, cy - sz * 0.3 - T * 0.1, sz * 0.6, sz * 0.6);
        } else {
          // 🦹 sneaking about
          const sz = T * 0.6;
          const dx = Math.sin(now / 500) * T * 0.15;
          g.drawImage(glyph('🦹', Math.round(sz)), cx - sz / 2 + dx, cy - sz * 0.9, sz, sz);
        }
      }
      for (const a of traffic.current.agents) {
        const p = placeAgent(a, map);
        const sx = (p.x - region.x0) * T, sy = (p.y - region.y0) * T;
        if (sx < -T || sy < -T || sx > region.w * T + T || sy > region.h * T + T) continue;
        dirty.push(drawAgent(g, a, sx, sy, p.dx, p.dy, T));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [tile, region, showTraffic]);

  // ---- 👆 tapping and dragging ----
  const down = useRef<{ last: number | null; pan?: { x: number; y: number; sl: number; st: number } } | null>(null);
  const tileAt = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const rx = Math.floor((e.clientX - r.left) / tile), ry = Math.floor((e.clientY - r.top) / tile);
    if (rx < 0 || ry < 0 || rx >= region.w || ry >= region.h) return null;
    return (region.y0 + ry) * W + region.x0 + rx;
  };
  const buying = useRef(false);
  const act = (i: number) => {
    if (tool.kind === 'look') return setPicked(anchorOf(t.current.map, i));
    if (tool.kind !== 'build' && tool.kind !== 'bulldoze') return;
    const can = canBuild(t.current, i, tool, region, owned);
    if (!can.ok) {
      if (can.why) setMsg(can.why);
      return;
    }
    if (tool.kind === 'bulldoze' && buildingOf(t.current.map[anchorOf(t.current.map, i)])?.token) {
      const b = buildingOf(t.current.map[anchorOf(t.current.map, i)])!;
      if (!window.confirm(`Clear the ${b.emoji} ${b.name}? It was bought with 💎, and clearing it doesn't give the tokens back.`)) return;
    }
    // 💎 Bought with tokens: the server takes them first, then it's built.
    const tb = tool.kind === 'build' ? buildingOf(tool.ch) : undefined;
    if (tb?.token) {
      const price = shop.items[tb.token]?.cost ?? 0;
      if (buying.current) return;
      if (price > shop.balance) return setMsg(`${tb.emoji} ${tb.name} needs ${price} 💎 — you have ${shop.balance}. Earn more in 📚 Learning and ⌨️ Typing!`);
      if (price && !window.confirm(`Build a ${tb.emoji} ${tb.name} here for ${price} 💎?`)) return;
      buying.current = true;
      void shop.buy(tb.token).then((r) => {
        buying.current = false;
        if (!r) return;
        build(t.current, i, tool, region, owned);
        setMsg(`${tb.emoji} ${tb.name} built!`);
        onSave({ ...t.current }); // paid for: keep it straight away
        redraw();
      });
      return;
    }
    build(t.current, i, tool, region, owned);
    setMsg(null);
    redraw();
  };
  const buyCoins = async (item: string) => {
    const it = shop.items[item];
    if (!it || buying.current) return;
    if (it.cost > shop.balance) return setMsg(`That needs ${it.cost} 💎 — you have ${shop.balance}. Earn more in 📚 Learning and ⌨️ Typing!`);
    if (it.cost && !window.confirm(`Trade ${it.cost} 💎 for ${it.coins.toLocaleString()} 🪙?`)) return;
    buying.current = true;
    const r = await shop.buy(item);
    buying.current = false;
    if (!r) return;
    t.current.coins += r.coins;
    onSave({ ...t.current }); // paid for: keep it straight away
    setMsg(`+${r.coins.toLocaleString()} 🪙 for your town!`);
    redraw();
  };
  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool.kind === 'pan') {
      down.current = { last: null, pan: { x: e.clientX, y: e.clientY, sl: wrap.current!.scrollLeft, st: wrap.current!.scrollTop } };
      return;
    }
    const i = tileAt(e);
    down.current = { last: i };
    if (i !== null) act(i);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = down.current;
    if (d?.pan) {
      wrap.current!.scrollLeft = d.pan.sl - (e.clientX - d.pan.x);
      wrap.current!.scrollTop = d.pan.st - (e.clientY - d.pan.y);
      return;
    }
    const i = tileAt(e);
    if (e.pointerType === 'mouse') setHover(i);
    if (!d || i === null || i === d.last) return;
    d.last = i;
    if (tool.kind === 'build' && PAINT.has(tool.ch)) act(i);
  };
  const onUp = () => {
    down.current = null;
  };

  const town_ = t.current;
  const tipList = tips(town_, rep);
  const lookAt = picked !== null ? town_.map[picked] : null;
  const lookB = lookAt ? buildingOf(lookAt) : undefined;
  const choose = (next: Tool) => {
    setTool(next);
    setMsg(null);
    if (next.kind !== 'look') setPicked(null);
  };
  const isOn = (x: Tool) => JSON.stringify(x) === JSON.stringify(tool);
  const toolButton = (b: Building) => {
    const locked = (b.feature === 'fun' && !owned.fun) || town_.peak < b.needPop;
    const x: Tool = { kind: 'build', ch: b.ch };
    return (
      <button
        key={b.ch}
        type="button"
        className={`town-tool${isOn(x) ? ' is-on' : ''}${locked || (b.token && (shop.items[b.token]?.cost ?? 0) > shop.balance) ? ' is-locked' : ''}`}
        title={b.tip}
        onClick={() => (locked ? setMsg(b.feature === 'fun' && !owned.fun ? '🔒 Unlock 🎡 Fun places (in the town list) first' : `🔒 ${b.name} opens at ${b.needPop} people`) : choose(x))}
      >
        <span className="town-tool__emoji">{locked ? '🔒' : b.emoji}</span>
        <span className="town-tool__name">{b.name}</span>
        <span className="town-tool__cost">
          {locked ? (b.feature === 'fun' && !owned.fun ? '💎' : `${b.needPop} 👥`) : b.token ? `${shop.items[b.token]?.cost ?? 0} 💎` : `${b.cost} 🪙`}
        </span>
      </button>
    );
  };

  return (
    <div className={`town${screen.fake ? ' is-fake-full' : ''}`} ref={screen.ref}>
      <div className="town__hud">
        <strong className="town__name">🏘️ {town_.name}</strong>
        <span title="People">👥 {rep.pop}</span>
        <span title="Coins (a day: taxes in, upkeep out)">
          🪙 {town_.coins.toLocaleString()} <small className={rep.income - rep.upkeep < 0 ? 'is-bad' : ''}>({rep.income - rep.upkeep >= 0 ? '+' : ''}{rep.income - rep.upkeep}/day)</small>
        </span>
        <span title="How happy people are">{rep.happy >= 70 ? '😄' : rep.happy >= 45 ? '🙂' : '😟'} {rep.happy}</span>
        <span title="Jobs (people working / jobs)">💼 {rep.employed}/{rep.jobs}</span>
        <span title="Power (made / used)" className={rep.power[1] > rep.power[0] ? 'is-bad' : ''}>⚡ {rep.power[0]}/{rep.power[1]}</span>
        <span title="Water (made / used)" className={rep.water[1] > rep.water[0] ? 'is-bad' : ''}>💧 {rep.water[0]}/{rep.water[1]}</span>
        <span title="Your tokens (earned in Learning, Typing and chores) — spend them in the 💎 Token shop below">💎 {shop.balance}</span>
        <span title="Day">📅 {town_.day}</span>
        <span className="town__speed" role="radiogroup" aria-label="Speed">
          {['⏸', '▶', '⏩'].map((s, i) => (
            <button key={s} type="button" role="radio" aria-checked={speed === i} className={speed === i ? 'is-on' : ''} onClick={() => setSpeed(i)}>
              {s}
            </button>
          ))}
        </span>
        <span className="town__tax">
          Taxes
          <button type="button" onClick={() => ((t.current.tax = Math.max(0, town_.tax - 1)), redraw())} aria-label="Lower taxes">
            −
          </button>
          {town_.tax}%
          <button type="button" onClick={() => ((t.current.tax = Math.min(20, town_.tax + 1)), redraw())} aria-label="Raise taxes">
            +
          </button>
        </span>
        <FullscreenButton full={screen.full} toggle={() => void screen.toggle()} className="secondary" />
        <button type="button" className="secondary" onClick={() => onExit({ ...t.current })}>
          💾 Save & exit
        </button>
      </div>

      {timeUp && <p className="limit-note is-over">{timeUp} Your town saves and closes in a minute.</p>}
      <p className="town__tip">💡 {msg ?? tipList[0]}</p>

      <div className="town__map" ref={wrap}>
        <div className="town__layers">
        <canvas
          ref={canvas}
          className={`town__canvas town__canvas--${tool.kind}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={() => setHover(null)}
          onContextMenu={(e) => e.preventDefault()}
        />
        <canvas ref={moving} className="town__traffic" aria-hidden="true" />
        </div>
      </div>

      <div className="town__view">
        <button type="button" className={`secondary${mood ? ' is-on' : ''}`} onClick={() => setMood(!mood)}>
          😊 {mood ? 'Hide' : 'Show'} happiness
        </button>
        <button type="button" className={`secondary${showTraffic ? ' is-on' : ''}`} onClick={() => setShowTraffic(!showTraffic)}>
          🚶 {showTraffic ? 'Hide' : 'Show'} people &amp; cars
        </button>
        <button type="button" className="secondary" onClick={() => setTile((x) => Math.max(10, x - 4))} aria-label="Zoom out">
          ➖
        </button>
        <button type="button" className="secondary" onClick={() => setTile((x) => Math.min(56, x + 4))} aria-label="Zoom in">
          ➕
        </button>
        {tipList.slice(1, 3).map((x) => (
          <span key={x} className="hint">
            {x}
          </span>
        ))}
      </div>

      {picked !== null && lookAt && (
        <section className="panel town__look">
          {lookB ? (
            <>
              <h3>
                {lookB.emoji} {lookB.name}
              </h3>
              <p className="hint">{lookB.tip}</p>
              {(town_.events ?? [])
                .filter((e) => e.i === picked)
                .map((e) => (
                  <p key={callKey(e)} className="is-bad">
                    {e.kind === 'fire' && '🔥 On fire! It isn’t working until the fire’s out.'}
                    {e.kind === 'crime' && '🦹 Crime here — homes nearby aren’t happy about it.'}
                    {e.kind === 'burnt' && (
                      <>
                        🏚️ Burnt down — it isn’t working.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            if (repair(t.current, picked)) {
                              setMsg(`🔨 The ${lookB.emoji} ${lookB.name} is as good as new!`);
                              onSave({ ...t.current });
                              redraw();
                            } else setMsg(`🔨 Repairing needs ${repairCost(t.current, picked)} 🪙`);
                          }}
                        >
                          🔨 Repair ({repairCost(t.current, picked)} 🪙)
                        </button>
                      </>
                    )}
                  </p>
                ))}
              {lookB.needsRoad && !hasRoad(town_.map, picked) && <p className="is-bad">🚧 Not next to a road, so it isn't working.</p>}
              {lookB.homes &&
                (() => {
                  const look = homeLook(rep.ctx, picked);
                  return (
                    <>
                      <p>
                        👥 {town_.pops.charCodeAt(picked) - 48} of {lookB.homes} live here · {look.happy >= 70 ? '😄' : look.happy >= 45 ? '🙂' : '😟'} {look.happy} happy
                      </p>
                      <ul className="town__why">
                        {look.parts.map(([label, v]) => (
                          <li key={label} className={v < 0 ? 'is-bad' : ''}>
                            {v > 0 ? '+' : ''}
                            {v} {label}
                          </li>
                        ))}
                      </ul>
                      <p className="hint">People move in when it's 45 or more (and there's power, water and jobs). Full homes at 65+ grow bigger.</p>
                    </>
                  );
                })()}
            </>
          ) : (
            <p>{lookAt === WATER ? '🌊 Water. Roads can cross it as bridges.' : lookAt === TREE ? '🌲 Trees. Building here clears them (2 🪙).' : lookAt === BRIDGE ? '🌉 A bridge.' : lookAt === GRASS ? '🟩 Open land, ready to build on.' : ''}</p>
          )}
        </section>
      )}

      <div className="town__tools">
        <div className="town__group">
          <div className="town__group-title">🧰 Tools</div>
          <div className="town__group-row">
            {(
              [
                [{ kind: 'look' }, '🔍', 'Look'],
                [{ kind: 'pan' }, '✋', 'Move map'],
                [{ kind: 'bulldoze' }, '🚜', 'Clear'],
              ] as Array<[Tool, string, string]>
            ).map(([x, e, name]) => (
              <button key={name} type="button" className={`town-tool${isOn(x) ? ' is-on' : ''}`} onClick={() => choose(x)}>
                <span className="town-tool__emoji">{e}</span>
                <span className="town-tool__name">{name}</span>
                <span className="town-tool__cost">{x.kind === 'bulldoze' ? 'all 🪙 back' : ' '}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="town__group town__group--shop">
          <div className="town__group-title">💎 Token shop — you have {shop.balance} 💎</div>
          <div className="town__group-row">
            {Object.entries(shop.items)
              .filter(([, it]) => it.coins > 0)
              .map(([id, it]) => (
                <button key={id} type="button" className={`town-tool${it.cost > shop.balance ? ' is-locked' : ''}`} title={`Trade ${it.cost} 💎 for ${it.coins.toLocaleString()} 🪙`} onClick={() => void buyCoins(id)}>
                  <span className="town-tool__emoji">{it.coins >= 2000 ? '💰' : '🪙'}</span>
                  <span className="town-tool__name">+{it.coins.toLocaleString()} 🪙</span>
                  <span className="town-tool__cost">{it.cost} 💎</span>
                </button>
              ))}
            {BUILDINGS.filter((b) => b.cat === 'special').map(toolButton)}
          </div>
        </div>
        {GROUPS.map((grp) => (
          <div key={grp.title} className="town__group">
            <div className="town__group-title">{grp.title}</div>
            <div className="town__group-row">{BUILDINGS.filter((b) => grp.cats.includes(b.cat) && !b.grown).map(toolButton)}</div>
          </div>
        ))}
      </div>
      {town_.tax !== DEFAULT_TAX && <p className="hint">Taxes at {town_.tax}%: higher brings in more 🪙 but people are less happy; lower makes them happier.</p>}
    </div>
  );
}
