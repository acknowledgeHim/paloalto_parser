import { useEffect, useRef, useState } from 'react';

const INKS = ['#1d2433', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#9c36b5', '#ffffff'];

/**
 * A little drawing pad (finger or mouse) for journals and sticky notes. Calls onChange with a PNG
 * data URL after each stroke, or null once cleared.
 */
export function DrawPad({ onChange, height = 220, background = '#ffffff' }: { onChange: (dataUrl: string | null) => void; height?: number; background?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ink, setInk] = useState(INKS[0]);
  const [size, setSize] = useState(5);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const used = useRef(false);

  const clear = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, c.width, c.height);
    used.current = false;
    onChange(null);
  };
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    // Sharp on any screen: the canvas is drawn at the size it shows.
    const box = c.getBoundingClientRect();
    c.width = Math.round(box.width);
    c.height = height;
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, background]);

  const at = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * canvas.current!.width, y: ((e.clientY - r.top) / r.height) * canvas.current!.height };
  };
  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = at(e);
    move(e);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = at(e);
    const ctx = canvas.current!.getContext('2d')!;
    ctx.strokeStyle = ink;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(drawing.current.x, drawing.current.y);
    ctx.lineTo(p.x + 0.01, p.y);
    ctx.stroke();
    drawing.current = p;
    used.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = null;
    if (used.current) onChange(canvas.current!.toDataURL('image/png'));
  };

  return (
    <div className="draw-pad">
      <canvas
        ref={canvas}
        className="draw-pad__canvas"
        style={{ height, background }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <div className="draw-pad__tools">
        {INKS.map((c) => (
          <button key={c} type="button" aria-label={`Ink ${c}`} className={`draw-pad__ink ${ink === c ? 'draw-pad__ink--on' : ''}`} style={{ background: c }} onClick={() => setInk(c)} />
        ))}
        <select value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Pen size">
          <option value={3}>Thin</option>
          <option value={5}>Medium</option>
          <option value={10}>Thick</option>
          <option value={22}>Huge</option>
        </select>
        <button type="button" className="secondary" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}
