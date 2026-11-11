import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * 🧪 Pieces every science lab uses: the frame (title, the lab, and its 🎯 "Try this" goals), sliders,
 * and an animation clock. Goals tick ✅ the moment the kid reaches them and stay ticked while the
 * lab is open — labs are for practice, so nothing is saved or paid (the lesson's quiz pays).
 */

export interface Goal {
  text: string;
  /** reached right now */
  done: boolean;
}

/** Remembers which goals were ever reached (so a goal stays ✅ after the kid moves on). */
function useSticky(goals: Goal[]) {
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const newly = goals.filter((g) => g.done && !seen[g.text]);
    if (newly.length) setSeen((s) => ({ ...s, ...Object.fromEntries(newly.map((g) => [g.text, true])) }));
  }, [goals, seen]);
  return (g: Goal) => g.done || Boolean(seen[g.text]);
}

export function LabFrame({ title, intro, goals = [], children }: { title: string; intro?: ReactNode; goals?: Goal[]; children: ReactNode }) {
  const isDone = useSticky(goals);
  const n = goals.filter(isDone).length;
  return (
    <section className="lab" aria-label={`Lab: ${title}`}>
      <h3 className="lab__title">🧪 Lab: {title}</h3>
      {intro && <p className="lab__intro">{intro}</p>}
      <div className="lab__body">{children}</div>
      {goals.length > 0 && (
        <div className="lab__goals">
          <strong>
            🎯 Try this {n === goals.length ? '— all done! 🎉' : `(${n} of ${goals.length})`}
          </strong>
          <ul>
            {goals.map((g) => (
              <li key={g.text} className={isDone(g) ? 'is-done' : ''}>
                {isDone(g) ? '✅' : '⬜'} {g.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  format?: (v: number) => string;
}) {
  return (
    <label className="lab-slider">
      <span>
        {label}: <strong>{format ? format(value) : `${value}${unit}`}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** Pick one of a few options, as buttons. */
export function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="lab-choice" role="group" aria-label={label}>
      <span>{label}:</span>
      {options.map((o) => (
        <button key={o.id} type="button" className={o.id === value ? 'is-on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A big readout: "Period 1.42 s". */
export function Readout({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="lab-readout">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Calls tick(dt seconds) every frame while running (paused when the tab is hidden). */
export function useAnimation(running: boolean, tick: (dt: number) => void) {
  const ref = useRef(tick);
  ref.current = tick;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let id = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ref.current(dt);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [running]);
}

export const round = (v: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};
