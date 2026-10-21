import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from 'react';
import { api } from '../api/client.js';
import { placeLabel } from './PhotoPlaceInfo.js';

interface MapPhoto {
  id: string;
  lat: number;
  lon: number;
  /** Placed at the middle of a country/state someone set (no GPS). */
  approx: boolean;
  country: string | null;
  state: string | null;
}
interface Outlines {
  countries: { step: number; list: Array<{ n: string; p: number[][] }> };
  states: { step: number; list: Array<{ n: string; p: number[][] }> };
}
interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

let outlinesPromise: Promise<Outlines> | null = null;
const toPath = (o: Outlines['countries']) =>
  o.list.map((r) => ({
    n: r.n,
    d: r.p
      .map((ring) => {
        let s = '';
        for (let i = 0; i < ring.length; i += 2) s += `${i ? 'L' : 'M'}${(ring[i] * o.step).toFixed(2)} ${(-ring[i + 1] * o.step).toFixed(2)}`;
        return `${s}Z`;
      })
      .join(''),
  }));

const WORLD: View = { x: -180, y: -84, w: 360, h: 150 };

/**
 * 🗺️ Where our photos were taken — drawn right here from the built-in borders (no outside map
 * service). Drag to move, scroll/pinch or + / − to zoom; tap a circle to see those photos.
 */
export function PhotoMap({
  onOpen,
  onShowPlace,
  noPlaceCount,
  onShowNoPlace,
}: {
  onOpen: (id: string) => void;
  onShowPlace: (where: { country: string | null; state: string | null }) => void;
  noPlaceCount: number | null;
  onShowNoPlace: () => void;
}) {
  const [photos, setPhotos] = useState<MapPhoto[] | null>(null);
  const [outlines, setOutlines] = useState<Outlines | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(WORLD);
  const [progress, setProgress] = useState<{ total: number; read: number; with_gps: number; placed: number; hand_set: number; no_location: number } | null>(null);
  // 📍 How far reading GPS has got — checked every 15 s until it's done (then the map reloads once).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    let wasDone: boolean | null = null;
    const check = () =>
      api
        .get<NonNullable<typeof progress>>('/photos/places/progress')
        .then((p) => {
          setProgress(p);
          const done = p.read >= p.total;
          if (wasDone === false && done) api.get<MapPhoto[]>('/photos/map').then(setPhotos).catch(() => {});
          wasDone = done;
          if (!done) t = setTimeout(check, 15_000);
        })
        .catch(() => (t = setTimeout(check, 60_000)));
    void check();
    return () => clearTimeout(t);
  }, []);
  const [picked, setPicked] = useState<MapPhoto[] | null>(null);
  // ⛶ Full screen: the map fills the whole screen (Esc or ✕ to come back).
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const esc = (e: KeyboardEvent) => {
      // Esc closes an open photo first (the viewer handles that); only leave full screen when none is open.
      if (e.key === 'Escape' && !document.querySelector('.photo-lightbox')) setFull(false);
    };
    window.addEventListener('keydown', esc);
    document.body.classList.add('photo-map-full-open');
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.classList.remove('photo-map-full-open');
    };
  }, [full]);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);

  useEffect(() => {
    api
      .get<MapPhoto[]>('/photos/map')
      .then((p) => {
        setPhotos(p);
        if (p.length) setView(fit(p));
      })
      .catch((e) => setError(e.message));
    outlinesPromise ??= api.get<Outlines>('/photos/places/outlines');
    outlinesPromise.then(setOutlines).catch(() => (outlinesPromise = null));
  }, []);

  const countries = useMemo(() => (outlines ? toPath(outlines.countries) : []), [outlines]);
  const states = useMemo(() => (outlines ? toPath(outlines.states) : []), [outlines]);

  // Circles: photos close together (for this zoom) become one circle with a count.
  const clusters = useMemo(() => {
    if (!photos) return [];
    const cell = view.w / 28;
    const groups = new Map<string, MapPhoto[]>();
    for (const p of photos) {
      const k = `${Math.floor(p.lon / cell)},${Math.floor(p.lat / cell)}`;
      const g = groups.get(k);
      if (g) g.push(p);
      else groups.set(k, [p]);
    }
    return [...groups.values()].map((g) => ({
      photos: g,
      lon: g.reduce((t, p) => t + p.lon, 0) / g.length,
      lat: g.reduce((t, p) => t + p.lat, 0) / g.length,
      approx: g.every((p) => p.approx),
    }));
  }, [photos, view.w]);

  /** Screen pixels → map degrees. */
  const scale = () => {
    const el = svgRef.current;
    if (!el) return 1;
    const r = el.getBoundingClientRect();
    return Math.max(view.w / r.width, view.h / r.height);
  };
  const zoomAt = (factor: number, cx = view.x + view.w / 2, cy = view.y + view.h / 2) =>
    setView((v) => {
      const w = Math.min(400, Math.max(0.05, v.w * factor));
      const h = (v.h / v.w) * w;
      return { x: cx - ((cx - v.x) / v.w) * w, y: cy - ((cy - v.y) / v.h) * h, w, h };
    });
  const toMap = (clientX: number, clientY: number) => {
    const el = svgRef.current!;
    const pt = el.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const m = pt.matrixTransform(el.getScreenCTM()!.inverse());
    return { x: m.x, y: m.y };
  };
  const onWheel = (e: RWheelEvent) => {
    const m = toMap(e.clientX, e.clientY);
    zoomAt(e.deltaY > 0 ? 1.25 : 0.8, m.x, m.y);
  };
  const onDown = (e: RPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
  };
  const onMove = (e: RPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const s = scale();
    if (pointers.current.size === 2) {
      // Pinch: zoom by how much the two fingers moved apart.
      const [a, b] = [...pointers.current.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = [...pointers.current.values()];
      const after = Math.hypot(c.x - d.x, c.y - d.y);
      if (before > 0 && after > 0) {
        const mid = toMap((c.x + d.x) / 2, (c.y + d.y) / 2);
        zoomAt(before / after, mid.x, mid.y);
      }
      moved.current = true;
      return;
    }
    const dx = (e.clientX - prev.x) * s;
    const dy = (e.clientY - prev.y) * s;
    if (Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y) > 2) moved.current = true;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
  };
  const onUp = (e: RPointerEvent) => pointers.current.delete(e.pointerId);

  const r = view.w / 120;
  const showStates = view.w < 70;
  const pickedPlace = picked ? mostCommon(picked) : null;

  return (
    <div className={`photo-map ${full ? 'photo-map--full' : ''}`}>
      <div className="photo-map__bar">
        <span className="hint">
          {photos ? `${photos.length.toLocaleString()} photo${photos.length === 1 ? '' : 's'} on the map` : 'Loading the map…'}
          {noPlaceCount != null && noPlaceCount > 0 && (
            <>
              {' · '}
              <button type="button" className="link-button" onClick={onShowNoPlace}>
                {noPlaceCount.toLocaleString()} with no location
              </button>
            </>
          )}
        </span>
        <span className="photo-map__zoom">
          <button type="button" className="secondary" onClick={() => zoomAt(0.6)} aria-label="Zoom in">
            ＋
          </button>
          <button type="button" className="secondary" onClick={() => zoomAt(1.6)} aria-label="Zoom out">
            －
          </button>
          <button type="button" className="secondary" onClick={() => setView(photos?.length ? fit(photos) : WORLD)}>
            Fit
          </button>
          <button type="button" className="secondary" onClick={() => setView(WORLD)}>
            🌍
          </button>
          <button type="button" className={full ? '' : 'secondary'} onClick={() => setFull(!full)} aria-label={full ? 'Leave full screen' : 'Full screen'} title={full ? 'Leave full screen (Esc)' : 'Full screen'}>
            {full ? '✕' : '⛶'}
          </button>
        </span>
      </div>
      {progress && (
        <div className="photo-map__progress">
          {progress.read < progress.total ? (
            <>
              <span>
                📍 Reading where photos were taken: <strong>{progress.read.toLocaleString()}</strong> of {progress.total.toLocaleString()} (
                {Math.floor((progress.read / Math.max(1, progress.total)) * 100)}%) — still going, in the background
              </span>
              <span className="photo-map__progress-bar">
                <span style={{ width: `${(progress.read / Math.max(1, progress.total)) * 100}%` }} />
              </span>
            </>
          ) : (
            <span>📍 All {progress.total.toLocaleString()} photos read ✓</span>
          )}
          <span className="hint">
            {progress.with_gps.toLocaleString()} have GPS · {progress.placed.toLocaleString()} have a place
            {progress.hand_set ? ` (${progress.hand_set.toLocaleString()} set by hand)` : ''} · {progress.no_location.toLocaleString()} with no location
          </span>
        </div>
      )}
      {error && <div className="settings-login__error">{error}</div>}
      <svg
        ref={svgRef}
        className="photo-map__svg"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="img"
        aria-label="Map of where the photos were taken"
      >
        <rect x={-400} y={-200} width={800} height={400} className="photo-map__sea" />
        {countries.map((c) => (
          <path key={c.n} d={c.d} className="photo-map__land" vectorEffect="non-scaling-stroke">
            <title>{c.n}</title>
          </path>
        ))}
        {showStates &&
          states.map((s) => (
            <path key={s.n} d={s.d} className="photo-map__state" vectorEffect="non-scaling-stroke">
              <title>{s.n}</title>
            </path>
          ))}
        {clusters.map((c, i) => {
          const rr = r * (1 + Math.log10(c.photos.length) * 0.9);
          return (
            <g
              key={i}
              className={`photo-map__pin ${c.approx ? 'photo-map__pin--approx' : ''} ${picked === c.photos ? 'photo-map__pin--on' : ''}`}
              onClick={() => !moved.current && setPicked(c.photos)}
            >
              <circle cx={c.lon} cy={-c.lat} r={rr} vectorEffect="non-scaling-stroke" />
              {c.photos.length > 1 && (
                <text x={c.lon} y={-c.lat} fontSize={rr * 1.05} dominantBaseline="central" textAnchor="middle">
                  {c.photos.length > 999 ? `${Math.round(c.photos.length / 1000)}k` : c.photos.length}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="hint">Drag to move · scroll or pinch to zoom · tap a circle. Hollow circles are photos placed by a country/state someone set (no GPS).</p>
      {picked && (
        <section className="panel photo-map__picked">
          <div className="family-board__head">
            <h2>
              📍 {pickedPlace ? placeLabel(pickedPlace) || 'Somewhere' : ''} · {picked.length} photo{picked.length === 1 ? '' : 's'}
            </h2>
            <span className="task-form__row">
              {picked.length > 1 && (
                <button type="button" className="secondary" onClick={() => setView(fit(picked))}>
                  🔍 Zoom in here
                </button>
              )}
              {pickedPlace && (pickedPlace.country || pickedPlace.state) && (
                <button type="button" className="secondary" onClick={() => onShowPlace(pickedPlace)}>
                  Show all from {placeLabel(pickedPlace)} in Photos
                </button>
              )}
              <button type="button" className="secondary" onClick={() => setPicked(null)}>
                ✕
              </button>
            </span>
          </div>
          <div className="photo-map__thumbs">
            {picked.slice(0, 60).map((p) => (
              <button key={p.id} type="button" onClick={() => onOpen(p.id)}>
                <img src={`/api/photos/${p.id}/image`} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          {picked.length > 60 && <p className="hint">Showing 60 — zoom in to see the rest.</p>}
        </section>
      )}
    </div>
  );
}

/** Frame these photos (with a little room around them). */
function fit(ps: Array<{ lat: number; lon: number }>): View {
  const xs = ps.map((p) => p.lon);
  const ys = ps.map((p) => -p.lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = Math.max(0.2, (x1 - x0) * 1.3);
  const h = Math.max(0.1, (y1 - y0) * 1.3, w / 2.2);
  const ww = Math.max(w, h * 1.6);
  return { x: (x0 + x1) / 2 - ww / 2, y: (y0 + y1) / 2 - h / 2, w: ww, h };
}

function mostCommon(ps: MapPhoto[]): { country: string | null; state: string | null } | null {
  const n = new Map<string, number>();
  for (const p of ps) {
    const k = `${p.country ?? ''}|${p.state ?? ''}`;
    n.set(k, (n.get(k) ?? 0) + 1);
  }
  const [best] = [...n].sort((a, b) => b[1] - a[1]);
  if (!best) return null;
  const [country, state] = best[0].split('|');
  return { country: country || null, state: state || null };
}
