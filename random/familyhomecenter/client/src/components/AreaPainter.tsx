import { useEffect, useRef, useState } from 'react';

/**
 * Painting the parts of a photo that should move in a living photo — the water, the fire, the
 * trees — each area with its own effect. Each area's mask is its own (offscreen) canvas the
 * photo's shape; on screen they're shown tinted in their effect's color over the photo.
 */

export type RegionEffect = 'water' | 'flames' | 'sway' | 'shimmer' | 'clouds' | 'twinkle';
export type Direction = 'down' | 'up' | 'left' | 'right';

export interface PaintedArea {
  key: number;
  effect: RegionEffect;
  direction: Direction;
  mask: HTMLCanvasElement;
}

export const REGION_EFFECTS: Array<{ id: RegionEffect; label: string; hint: string; color: string; flows?: boolean }> = [
  { id: 'water', label: '💧 Flowing water', hint: 'Rivers, waterfalls, waves', color: '#3aa0ff', flows: true },
  { id: 'flames', label: '🔥 Flames', hint: 'Campfires, candles, fireplaces', color: '#ff6a00' },
  { id: 'sway', label: '🌿 Sway', hint: 'Leaves, grass, flowers, hair in the wind', color: '#3cba54' },
  { id: 'shimmer', label: '🌫️ Shimmer', hint: 'Heat haze, a pool or lake surface', color: '#9a8cff' },
  { id: 'clouds', label: '☁️ Drifting clouds', hint: 'Paint the sky', color: '#e8eef5', flows: true },
  { id: 'twinkle', label: '💡 Twinkle', hint: 'Lights, stars, glints on water', color: '#ffd400' },
];

const DIRECTIONS: Array<{ id: Direction; label: string }> = [
  { id: 'down', label: '⬇️' },
  { id: 'up', label: '⬆️' },
  { id: 'left', label: '⬅️' },
  { id: 'right', label: '➡️' },
];

/** Masks are made at this size on the photo's long side — plenty for soft-edged areas. */
const MASK_LONG_SIDE = 600;

let nextKey = 1;

export function newArea(effect: RegionEffect, aspect: number): PaintedArea {
  const mask = document.createElement('canvas');
  mask.width = aspect >= 1 ? MASK_LONG_SIDE : Math.round(MASK_LONG_SIDE * aspect);
  mask.height = aspect >= 1 ? Math.round(MASK_LONG_SIDE / aspect) : MASK_LONG_SIDE;
  return { key: nextKey++, effect, direction: effect === 'clouds' ? 'right' : 'down', mask };
}

/** Whether anything's been painted on an area yet. */
export function isPainted(area: PaintedArea): boolean {
  const ctx = area.mask.getContext('2d');
  if (!ctx) return false;
  const data = ctx.getImageData(0, 0, area.mask.width, area.mask.height).data;
  for (let i = 3; i < data.length; i += 16) if (data[i] > 0) return true;
  return false;
}

export function AreaPainter({
  photoId,
  areas,
  setAreas,
}: {
  photoId: string;
  areas: PaintedArea[];
  setAreas: (fn: (cur: PaintedArea[]) => PaintedArea[]) => void;
}) {
  const img = useRef<HTMLImageElement>(null);
  const display = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const [brush, setBrush] = useState(40); // in mask pixels
  const [erasing, setErasing] = useState(false);
  const [, setVersion] = useState(0); // bumped after each stroke so "painted?" hints refresh
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const active = areas.find((a) => a.key === activeKey) ?? null;

  // The tinted view of every area.
  const redraw = () => {
    const c = display.current;
    if (!c || !aspect) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const a of areas) {
      const tint = document.createElement('canvas');
      tint.width = c.width;
      tint.height = c.height;
      const t = tint.getContext('2d')!;
      t.fillStyle = REGION_EFFECTS.find((e) => e.id === a.effect)!.color;
      t.fillRect(0, 0, tint.width, tint.height);
      t.globalCompositeOperation = 'destination-in';
      t.drawImage(a.mask, 0, 0, tint.width, tint.height);
      ctx.globalAlpha = a.key === activeKey ? 0.55 : 0.3;
      ctx.drawImage(tint, 0, 0);
    }
    ctx.globalAlpha = 1;
  };
  useEffect(redraw);

  const toMask = (e: React.PointerEvent<HTMLCanvasElement>, area: PaintedArea) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * area.mask.width, y: ((e.clientY - rect.top) / rect.height) * area.mask.height };
  };
  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }, area: PaintedArea) => {
    const ctx = area.mask.getContext('2d')!;
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = brush;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    redraw();
  };

  const add = (effect: RegionEffect) => {
    if (!aspect) return;
    const area = newArea(effect, aspect);
    setAreas((cur) => [...cur, area]);
    setActiveKey(area.key);
    setErasing(false);
  };

  return (
    <div className="area-painter">
      <p className="hint">
        Make part of the photo move: pick what it is, then paint over it with your finger or the mouse.
        Paint just that part — anything painted moves.
      </p>
      <div className="living-maker__chips">
        {REGION_EFFECTS.map((e) => (
          <button key={e.id} type="button" className="secondary area-painter__add" title={e.hint} onClick={() => add(e.id)} disabled={!aspect || areas.length >= 6}>
            + {e.label}
          </button>
        ))}
      </div>

      <div
        className="area-painter__stage"
        // As wide as fits, but never taller than most of the screen (a tall photo would push the tools off it).
        style={{ aspectRatio: aspect ?? undefined, width: aspect ? `min(100%, ${(60 * aspect).toFixed(2)}vh)` : undefined }}
      >
        <img
          ref={img}
          src={`/api/photos/${photoId}/image`}
          alt=""
          draggable={false}
          onLoad={(e) => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
        />
        {aspect && (
          <canvas
            ref={display}
            className={`area-painter__canvas ${active ? 'area-painter__canvas--painting' : ''}`}
            width={800}
            height={Math.round(800 / aspect)}
            onPointerDown={(e) => {
              if (!active) return;
              try {
                e.currentTarget.setPointerCapture(e.pointerId); // keep painting if the finger slides off
              } catch {
                // not capturable (some touch drivers) — painting still works inside the photo
              }
              const p = toMask(e, active);
              drawing.current = p;
              stroke(p, p, active);
            }}
            onPointerMove={(e) => {
              if (!active || !drawing.current) return;
              const p = toMask(e, active);
              stroke(drawing.current, p, active);
              drawing.current = p;
            }}
            onPointerUp={() => {
              drawing.current = null;
              setVersion((v) => v + 1);
            }}
            onPointerCancel={() => {
              drawing.current = null;
            }}
          />
        )}
        {aspect && !active && areas.length === 0 && <div className="area-painter__tip">Pick an effect above to start painting</div>}
      </div>

      {areas.length > 0 && (
        <>
          <div className="area-painter__tools">
            <label className="member-form__label member-form__label--inline">
              Brush
              <input type="range" min={10} max={120} value={brush} onChange={(e) => setBrush(Number(e.target.value))} />
            </label>
            <button type="button" className={erasing ? '' : 'secondary'} onClick={() => setErasing((v) => !v)} disabled={!active}>
              {erasing ? '🧽 Erasing' : '🧽 Eraser'}
            </button>
          </div>
          <ul className="area-painter__list">
            {areas.map((a) => {
              const info = REGION_EFFECTS.find((e) => e.id === a.effect)!;
              return (
                <li key={a.key} className={a.key === activeKey ? 'area-painter__item--active' : ''} style={{ borderLeftColor: info.color }}>
                  <button type="button" className="link-button" onClick={() => setActiveKey(a.key)}>
                    {a.key === activeKey ? '🖌️ Painting: ' : 'Paint: '}
                    {info.label}
                  </button>
                  {!isPainted(a) && <span className="hint">(nothing painted yet)</span>}
                  {info.flows && (
                    <span className="area-painter__dirs" aria-label="Which way it flows">
                      {DIRECTIONS.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className={a.direction === d.id ? '' : 'secondary'}
                          aria-label={`Flows ${d.id}`}
                          onClick={() => setAreas((cur) => cur.map((x) => (x.key === a.key ? { ...x, direction: d.id } : x)))}
                        >
                          {d.label}
                        </button>
                      ))}
                    </span>
                  )}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      a.mask.getContext('2d')!.clearRect(0, 0, a.mask.width, a.mask.height);
                      setVersion((v) => v + 1);
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setAreas((cur) => cur.filter((x) => x.key !== a.key));
                      if (activeKey === a.key) setActiveKey(null);
                    }}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
