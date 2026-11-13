import { useEffect, useMemo, useRef, useState } from 'react';
import { BRIDGE, GRASS, H, TREE, W, WATER, buildingOf, isFiller, isRoadCh, report, type Town } from './townLogic.js';

/** Where each land sits on the Earth (in land-widths), with ocean between them. */
const SPOTS: Array<[number, number]> = [
  [0.15, 0.1],
  [1.45, 0.3],
  [0.35, 1.4],
  [1.65, 1.55],
];
const SPAN_X = 2.8;
const SPAN_Y = 2.75;

const CAT_COLOUR: Record<string, string> = {
  home: '#ffb74d',
  work: '#64b5f6',
  service: '#f06292',
  transit: '#90a4ae',
  utility: '#ba68c8',
  fun: '#ffee58',
  special: '#4db6ac',
  nature: '#66bb6a',
};

/**
 * 🌍 The whole Earth (a 🏆 Tiny Town prize land): its four lands drawn small with the oceans between
 * them. Tap one to zoom in and build on it.
 */
export function EarthView({ lands, canOpen, why, onOpen, onBack }: { lands: Town[]; canOpen: boolean; why: string | null; onOpen: (k: number) => void; onBack: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [zooming, setZooming] = useState<number | null>(null);
  const px = useRef(4);
  /** Each land drawn once, one pixel a tile (the ocean round it left see-through, lakes kept). */
  const pictures = useMemo(() => lands.map(landPicture), [lands]);
  const pops = useMemo(() => lands.map((t) => report(t).pop), [lands]);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current;
      if (!c) return;
      const width = Math.min(wrap.current?.clientWidth ?? 800, 1000);
      const P = Math.max(1.5, width / (SPAN_X * W));
      px.current = P;
      const cw = Math.round(SPAN_X * W * P);
      const ch = Math.round(SPAN_Y * H * P);
      const dpr = window.devicePixelRatio || 1;
      if (c.width !== cw * dpr) {
        c.width = cw * dpr;
        c.height = ch * dpr;
        c.style.width = `${cw}px`;
        c.style.height = `${ch}px`;
      }
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 🌊 the ocean, with slow waves
      const sea = g.createLinearGradient(0, 0, 0, ch);
      sea.addColorStop(0, '#1e88e5');
      sea.addColorStop(1, '#0d47a1');
      g.fillStyle = sea;
      g.fillRect(0, 0, cw, ch);
      const tnow = performance.now() / 1400;
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.lineWidth = 1;
      for (let y = 10; y < ch; y += 18) {
        g.beginPath();
        for (let x = 0; x <= cw; x += 10) g.lineTo(x, y + Math.sin(x / 40 + tnow + y) * 3);
        g.stroke();
      }
      lands.forEach((t, k) => {
        const ox = SPOTS[k][0] * W * P;
        const oy = SPOTS[k][1] * H * P;
        g.imageSmoothingEnabled = false;
        g.drawImage(pictures[k], ox, oy, W * P, H * P);
        if (hover === k || zooming === k) {
          g.strokeStyle = '#ffeb3b';
          g.lineWidth = 3;
          g.strokeRect(ox + 1, oy + 1, W * P - 2, H * P - 2);
        }
        // its name and people
        g.font = `800 ${Math.max(12, Math.round(P * 3.2))}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        const label = `${t.name} · 👥 ${pops[k]}`;
        g.strokeText(label, ox + (W * P) / 2, oy + H * P + Math.max(14, P * 3.5));
        g.fillStyle = '#fff';
        g.fillText(label, ox + (W * P) / 2, oy + H * P + Math.max(14, P * 3.5));
      });
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [lands, hover, zooming, pictures, pops]);

  const landAt = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const P = px.current;
    const x = (e.clientX - r.left) / P / W;
    const y = (e.clientY - r.top) / P / H;
    const k = SPOTS.findIndex(([sx, sy]) => x >= sx && x <= sx + 1 && y >= sy && y <= sy + 1);
    return k >= 0 && k < lands.length ? k : null;
  };

  const go = (k: number) => {
    if (!canOpen) return;
    // 🔭 a moment of zooming in, then into the land
    setZooming(k);
    setTimeout(() => onOpen(k), 450);
  };

  return (
    <div className="hill-garage earth-view">
      <div className="hill-garage__head">
        <h1>🌍 The whole Earth</h1>
        <button type="button" className="link-button" onClick={onBack}>
          ← Back to your towns
        </button>
      </div>
      <p className="hint">Four big lands with oceans between them. Tap one to zoom in and build there — every land is a whole town of its own.</p>
      {why && <p className="limit-note is-over">{why}</p>}
      <div ref={wrap} className={`earth-view__map${zooming !== null ? ' is-zooming' : ''}`}>
        <canvas
          ref={canvas}
          style={zooming !== null ? { transformOrigin: `${(SPOTS[zooming][0] + 0.5) * (100 / SPAN_X)}% ${(SPOTS[zooming][1] + 0.5) * (100 / SPAN_Y)}%` } : undefined}
          onPointerMove={(e) => setHover(landAt(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const k = landAt(e as unknown as React.PointerEvent);
            if (k !== null) go(k);
          }}
        />
      </div>
      <div className="earth-view__lands">
        {lands.map((t, k) => (
          <button key={k} type="button" disabled={!canOpen} onClick={() => go(k)}>
            🔍 {t.name} · 👥 {pops[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

function landPicture(t: Town): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // the ocean: water joined to the edge (flooded in from there); the rest of the water is lakes
  const ocean = new Uint8Array(W * H);
  const q: number[] = [];
  for (let x = 0; x < W; x++) q.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) q.push(y * W, y * W + W - 1);
  while (q.length) {
    const i = q.pop()!;
    if (ocean[i] || t.map[i] !== WATER) continue;
    ocean[i] = 1;
    const x = i % W;
    if (x > 0) q.push(i - 1);
    if (x < W - 1) q.push(i + 1);
    if (i >= W) q.push(i - W);
    if (i + W < W * H) q.push(i + W);
  }
  for (let i = 0; i < W * H; i++) {
    const c0 = t.map[i];
    if (ocean[i]) continue;
    const x = i % W, y = Math.floor(i / W);
    let col: string;
    if (c0 === WATER) col = '#4fc3f7';
    else if (c0 === GRASS) col = (x + y) % 2 ? '#8bc34a' : '#86bd45';
    else if (c0 === TREE) col = '#2e7d32';
    else if (c0 === BRIDGE || isRoadCh(c0)) col = '#757575';
    else if (isFiller(c0)) col = '#ffb74d';
    else col = CAT_COLOUR[buildingOf(c0)?.cat ?? ''] ?? '#bdbdbd';
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  }
  return c;
}
