import { useEffect, useRef, useState } from 'react';
import { Choice, LabFrame, Readout, Slider, round, useAnimation } from './common.js';

/** ⚡ Physics labs. The numbers are the real formulas (simplified where it says so). */

const PLANETS = [
  { id: 'earth', label: '🌍 Earth', g: 9.8 },
  { id: 'moon', label: '🌙 Moon', g: 1.62 },
  { id: 'mars', label: '🔴 Mars', g: 3.71 },
  { id: 'jupiter', label: '🪐 Jupiter', g: 24.8 },
] as const;
type PlanetId = (typeof PLANETS)[number]['id'];

// ---------- 🕰️ Pendulum: T = 2π√(L/g) ----------
export function PendulumLab() {
  const [len, setLen] = useState(0.5);
  const [mass, setMass] = useState(1);
  const [massMoved, setMassMoved] = useState(false);
  const [planet, setPlanet] = useState<PlanetId>('earth');
  const [t, setT] = useState(0);
  const g = PLANETS.find((p) => p.id === planet)!.g;
  const period = 2 * Math.PI * Math.sqrt(len / g);
  useAnimation(true, (dt) => setT((x) => x + dt));
  const angle = 0.5 * Math.cos((2 * Math.PI * t) / period);
  const px = 150 + Math.sin(angle) * len * 70;
  const py = 15 + Math.cos(angle) * len * 70;
  return (
    <LabFrame
      title="Pendulum"
      intro="A pendulum swings back and forth. The time for one full swing (there and back) is its period."
      goals={[
        { text: 'Make one full swing take 2 seconds (1.9–2.1 s)', done: period >= 1.9 && period <= 2.1 },
        { text: 'Change the mass — does the period change?', done: massMoved },
        { text: 'Take the pendulum to the Moon', done: planet === 'moon' },
        { text: 'Make a pendulum swing faster than once a second', done: period < 1 },
      ]}
    >
      <svg viewBox="0 0 300 240" className="lab-svg" role="img" aria-label="A swinging pendulum">
        <line x1="100" y1="15" x2="200" y2="15" stroke="currentColor" strokeWidth="4" />
        <line x1="150" y1="15" x2={px} y2={py} stroke="currentColor" strokeWidth="2" />
        <circle cx={px} cy={py} r={6 + mass * 2.5} fill="#5b8def" />
      </svg>
      <Slider label="String length" value={len} onChange={setLen} min={0.1} max={3} step={0.1} unit=" m" />
      <Slider
        label="Mass of the bob"
        value={mass}
        onChange={(v) => {
          setMass(v);
          setMassMoved(true);
        }}
        min={0.5}
        max={5}
        step={0.5}
        unit=" kg"
      />
      <Choice label="Where" value={planet} options={PLANETS.map((p) => ({ id: p.id, label: p.label }))} onChange={setPlanet} />
      <Readout items={[['Period (one swing)', `${round(period, 2)} s`], ['Gravity', `${g} m/s²`]]} />
      <p className="hint">The mass doesn't change the period — only the length and gravity do.</p>
    </LabFrame>
  );
}

// ---------- 🎯 Projectile: range = v² sin(2θ) / g ----------
export function ProjectileLab() {
  const [speed, setSpeed] = useState(20);
  const [angle, setAngle] = useState(30);
  const [target] = useState(() => 15 + Math.round(Math.random() * 30));
  const [flight, setFlight] = useState<{ t: number; v: number; a: number } | null>(null);
  const [shots, setShots] = useState<Array<{ v: number; a: number; range: number }>>([]);
  const g = 9.8;
  const rad = (a: number) => (a * Math.PI) / 180;
  const rangeOf = (v: number, a: number) => (v * v * Math.sin(2 * rad(a))) / g;
  const tTotal = (v: number, a: number) => (2 * v * Math.sin(rad(a))) / g;
  useAnimation(Boolean(flight), (dt) =>
    setFlight((f) => {
      if (!f) return f;
      const t = f.t + dt * 1.5;
      if (t >= tTotal(f.v, f.a)) {
        setShots((s) => [...s, { v: f.v, a: f.a, range: rangeOf(f.v, f.a) }]);
        return null;
      }
      return { ...f, t };
    })
  );
  const scale = 280 / 100; // 100 m across
  const ball = flight && {
    x: 10 + flight.v * Math.cos(rad(flight.a)) * flight.t * scale,
    y: 190 - (flight.v * Math.sin(rad(flight.a)) * flight.t - 0.5 * g * flight.t * flight.t) * scale,
  };
  const last = shots[shots.length - 1];
  const hit = shots.some((s) => Math.abs(s.range - target) <= 1.5);
  const same = shots.some((s) => s.a === 30 && shots.some((o) => o.a === 60 && o.v === s.v));
  return (
    <LabFrame
      title="Launch a ball"
      intro="Pick a launch speed and angle, then launch. Gravity pulls the ball down into a curve (a parabola). This lab has no air."
      goals={[
        { text: `Land the ball on the 🎯 target at ${target} m`, done: hit },
        { text: 'Find the angle that goes farthest at one speed (launch at 45°)', done: shots.some((s) => s.a === 45) },
        { text: 'Launch at 30° and at 60° with the same speed — where do they land?', done: same },
      ]}
    >
      <svg viewBox="0 0 300 200" className="lab-svg" role="img" aria-label="A ball's path">
        <line x1="0" y1="190" x2="300" y2="190" stroke="currentColor" />
        <text x={10 + target * scale} y="186" textAnchor="middle" fontSize="14">🎯</text>
        {shots.slice(-4).map((s, i) => (
          <circle key={i} cx={10 + s.range * scale} cy="190" r="3" fill="#e53935" opacity={0.4 + i * 0.15} />
        ))}
        {ball && <circle cx={ball.x} cy={ball.y} r="5" fill="#5b8def" />}
      </svg>
      <Slider label="Speed" value={speed} onChange={setSpeed} min={5} max={30} unit=" m/s" />
      <Slider label="Angle" value={angle} onChange={setAngle} min={5} max={85} unit="°" />
      <button type="button" className="primary" disabled={Boolean(flight)} onClick={() => setFlight({ t: 0, v: speed, a: angle })}>
        🚀 Launch
      </button>
      {last && (
        <Readout
          items={[
            ['Landed at', `${round(last.range)} m`],
            ['Highest point', `${round((last.v * Math.sin(rad(last.a))) ** 2 / (2 * g))} m`],
            ['Time in the air', `${round(tTotal(last.v, last.a), 2)} s`],
          ]}
        />
      )}
    </LabFrame>
  );
}

// ---------- 🛒 Push a cart: F_net = push − friction, a = F/m ----------
const SURFACES = [
  { id: 'ice', label: '🧊 Ice', mu: 0.02 },
  { id: 'wood', label: '🪵 Wood floor', mu: 0.2 },
  { id: 'carpet', label: '🟫 Carpet', mu: 0.5 },
] as const;
export function PushLab() {
  const [push, setPush] = useState(20);
  const [mass, setMass] = useState(5);
  const [surface, setSurface] = useState<(typeof SURFACES)[number]['id']>('wood');
  const [runs, setRuns] = useState<Array<{ push: number; mass: number; surface: string; dist: number }>>([]);
  const [t, setT] = useState<number | null>(null);
  const mu = SURFACES.find((s) => s.id === surface)!.mu;
  const friction = mu * mass * 9.8;
  const net = Math.max(0, push - friction);
  const a = net / mass;
  const T = 3;
  useAnimation(t !== null, (dt) =>
    setT((x) => {
      if (x === null) return x;
      if (x + dt >= T) {
        setRuns((r) => [...r, { push, mass, surface, dist: 0.5 * a * T * T }]);
        return null;
      }
      return x + dt;
    })
  );
  const d = t === null ? 0 : 0.5 * a * t * t;
  return (
    <LabFrame
      title="Push a cart"
      intro="You push the cart for 3 seconds. Friction pushes back. If your push is bigger than friction, the cart speeds up: acceleration = net force ÷ mass."
      goals={[
        { text: "Push so gently the cart doesn't move at all", done: runs.some((r) => r.dist === 0) },
        { text: 'Slide the cart more than 20 m on ice', done: runs.some((r) => r.surface === 'ice' && r.dist > 20) },
        { text: 'Keep the same push, double the mass — how far does it go now?', done: runs.some((r) => runs.some((o) => o.push === r.push && o.surface === r.surface && o.mass === r.mass * 2)) },
      ]}
    >
      <svg viewBox="0 0 300 80" className="lab-svg" role="img" aria-label="A cart on a floor">
        <line x1="0" y1="70" x2="300" y2="70" stroke="currentColor" strokeWidth="3" />
        <g transform={`translate(${10 + Math.min(240, d * 6)},0)`}>
          <rect x="0" y="35" width={30 + mass * 2} height="25" rx="4" fill="#5b8def" />
          <circle cx="8" cy="64" r="5" fill="currentColor" />
          <circle cx={22 + mass * 2} cy="64" r="5" fill="currentColor" />
        </g>
      </svg>
      <Slider label="Your push" value={push} onChange={setPush} min={0} max={60} unit=" N" />
      <Slider label="Cart mass" value={mass} onChange={setMass} min={1} max={10} unit=" kg" />
      <Choice label="Floor" value={surface} options={SURFACES.map((s) => ({ id: s.id, label: s.label }))} onChange={setSurface} />
      <button type="button" className="primary" disabled={t !== null} onClick={() => setT(0)}>
        👐 Push for 3 seconds
      </button>
      <Readout
        items={[
          ['Friction', `${round(friction)} N`],
          ['Net force', `${round(net)} N`],
          ['Acceleration', `${round(a, 2)} m/s²`],
          ['Distance', `${round(runs.length && t === null ? runs[runs.length - 1].dist : d)} m`],
        ]}
      />
    </LabFrame>
  );
}

// ---------- 💡 Circuits: series and parallel (each bulb 3 Ω) ----------
export function CircuitLab() {
  const [volts, setVolts] = useState(3);
  const [bulbs, setBulbs] = useState(2);
  const [kind, setKind] = useState<'series' | 'parallel'>('series');
  const [closed, setClosed] = useState(false);
  const [out, setOut] = useState(false);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const R = 3;
  const working = out ? bulbs - 1 : bulbs;
  let current = 0;
  let perBulb = 0;
  if (closed) {
    if (kind === 'series') {
      current = out ? 0 : volts / (R * bulbs);
      perBulb = current;
    } else {
      perBulb = volts / R;
      current = perBulb * working;
    }
  }
  const power = perBulb * perBulb * R;
  const glow = Math.min(1, power / 6);
  const note = (k: string) => !seen[k] && setSeen((s) => ({ ...s, [k]: true }));
  useEffect(() => {
    if (closed && out && kind === 'series') note('series-out');
    if (closed && out && kind === 'parallel' && working > 0) note('parallel-out');
    if (closed && !out && bulbs >= 2 && kind === 'parallel') note('parallel-on');
  });
  return (
    <LabFrame
      title="Light bulb circuits"
      intro="Electricity flows only around a closed loop. In series the bulbs share one path; in parallel each bulb gets its own path."
      goals={[
        { text: 'Close the switch to light the bulbs', done: closed && current > 0 },
        { text: 'Make the bulbs brighter without changing the battery', done: Boolean(seen['parallel-on']) },
        { text: 'Unscrew a bulb in a series circuit — what happens to the others?', done: Boolean(seen['series-out']) },
        { text: 'Unscrew a bulb in a parallel circuit', done: Boolean(seen['parallel-out']) },
      ]}
    >
      <svg viewBox="0 0 300 140" className="lab-svg" role="img" aria-label="A circuit with a battery and bulbs">
        <rect x="20" y="20" width="260" height="100" rx="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={closed ? '' : '6 6'} />
        <rect x="8" y="55" width="24" height="30" fill="#f9a825" />
        <text x="20" y="100" fontSize="10" textAnchor="middle">{volts} V</text>
        {Array.from({ length: bulbs }, (_, i) => {
          const x = 90 + i * 60;
          const dead = out && i === 0;
          const lit = !dead && closed && glow > 0;
          return (
            <g key={i}>
              {kind === 'parallel' && <line x1={x} y1="20" x2={x} y2="120" stroke="currentColor" strokeWidth="2" />}
              <circle cx={x} cy={kind === 'parallel' ? 70 : 20} r="14" fill={lit ? `rgba(255,214,0,${0.25 + glow * 0.75})` : 'var(--panel)'} stroke="currentColor" />
              {dead && <text x={x} y={kind === 'parallel' ? 75 : 25} fontSize="12" textAnchor="middle">✖</text>}
            </g>
          );
        })}
        <text x="150" y="135" fontSize="11" textAnchor="middle">{closed ? 'switch: closed (on)' : 'switch: open (off)'}</text>
      </svg>
      <Slider label="Battery" value={volts} onChange={setVolts} min={1.5} max={9} step={1.5} unit=" V" />
      <Slider label="Bulbs" value={bulbs} onChange={setBulbs} min={1} max={3} />
      <Choice label="Wiring" value={kind} options={[{ id: 'series', label: '➖ Series' }, { id: 'parallel', label: '🔀 Parallel' }]} onChange={setKind} />
      <div className="lab-buttons">
        <button type="button" onClick={() => setClosed((c) => !c)}>{closed ? '⏏️ Open the switch' : '🔘 Close the switch'}</button>
        <button type="button" onClick={() => setOut((o) => !o)}>{out ? '🔩 Screw the bulb back in' : '🪛 Unscrew a bulb'}</button>
      </div>
      <Readout items={[['Current from the battery', `${round(current, 2)} A`], ['Each bulb', closed && glow > 0 ? `${round(power, 1)} W` : 'off']]} />
    </LabFrame>
  );
}

// ---------- 🔊 Sound: pitch, loudness and wavelength (speed of sound 343 m/s) ----------
export function SoundLab() {
  const [freq, setFreq] = useState(440);
  const [vol, setVol] = useState(0.3);
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState<number[]>([]);
  const ctx = useRef<{ ac: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null);
  useEffect(() => {
    if (ctx.current) {
      ctx.current.osc.frequency.value = freq;
      ctx.current.gain.gain.value = vol * 0.3;
    }
    if (playing) setHeard((h) => (h.includes(freq) ? h : [...h, freq]));
  }, [freq, vol, playing]);
  useEffect(
    () => () => {
      ctx.current?.ac.close().catch(() => {});
    },
    []
  );
  const toggle = () => {
    if (playing) {
      ctx.current?.ac.close().catch(() => {});
      ctx.current = null;
      setPlaying(false);
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.frequency.value = freq;
      gain.gain.value = vol * 0.3;
      osc.connect(gain).connect(ac.destination);
      osc.start();
      ctx.current = { ac, osc, gain };
      setPlaying(true);
    } catch {
      /* no sound on this device — the picture still works */
    }
  };
  const waves = Math.max(1, Math.round(freq / 110));
  const path = Array.from({ length: 301 }, (_, x) => `${x === 0 ? 'M' : 'L'}${x},${60 - Math.sin((x / 300) * waves * 2 * Math.PI) * vol * 50}`).join(' ');
  return (
    <LabFrame
      title="Sound waves"
      intro="Sound is a vibration. More vibrations per second (frequency, in hertz) = a higher pitch. Bigger vibrations (amplitude) = louder."
      goals={[
        { text: 'Play a low note (under 200 Hz)', done: heard.some((f) => f < 200) },
        { text: 'Play a high note (over 800 Hz)', done: heard.some((f) => f > 800) },
        { text: 'Make the wavelength about 1 meter (0.9–1.1 m)', done: 343 / freq >= 0.9 && 343 / freq <= 1.1 },
      ]}
    >
      <svg viewBox="0 0 300 120" className="lab-svg" role="img" aria-label="A sound wave">
        <path d={path} fill="none" stroke="#5b8def" strokeWidth="2" />
      </svg>
      <Slider label="Frequency (pitch)" value={freq} onChange={setFreq} min={100} max={1000} step={10} unit=" Hz" />
      <Slider label="Loudness (amplitude)" value={vol} onChange={setVol} min={0.05} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} />
      <button type="button" className="primary" onClick={toggle}>{playing ? '⏹️ Stop' : '▶️ Play the sound'}</button>
      <Readout items={[['Wavelength', `${round(343 / freq, 2)} m`], ['Vibrations each second', String(freq)]]} />
    </LabFrame>
  );
}

// ---------- ⚖️ Lever / seesaw: balanced when m₁d₁ = m₂d₂ ----------
export function LeverLab() {
  const [m1, setM1] = useState(4);
  const [d1, setD1] = useState(1);
  const [m2, setM2] = useState(2);
  const [d2, setD2] = useState(1);
  const left = m1 * d1;
  const right = m2 * d2;
  const balanced = Math.abs(left - right) < 0.01;
  const tilt = Math.max(-15, Math.min(15, (right - left) * 3));
  return (
    <LabFrame
      title="Balance the seesaw"
      intro="A seesaw balances when weight × distance from the middle is the same on both sides. A small weight far out can balance a big weight close in."
      goals={[
        { text: 'Balance two equal weights', done: balanced && m1 === m2 },
        { text: 'Balance 2 kg against 6 kg', done: balanced && ((m1 === 2 && m2 === 6) || (m1 === 6 && m2 === 2)) },
        { text: 'Balance it with one side 3 times as far out as the other', done: balanced && (d1 === 3 * d2 || d2 === 3 * d1) },
      ]}
    >
      <svg viewBox="0 0 300 130" className="lab-svg" role="img" aria-label="A seesaw">
        <polygon points="150,100 135,125 165,125" fill="currentColor" />
        <g transform={`rotate(${tilt} 150 100)`}>
          <rect x="20" y="96" width="260" height="6" fill="#8d6e63" />
          <rect x={150 - d1 * 40 - 6 - m1} y={84 - m1 * 2} width={12 + m1 * 2} height={12 + m1 * 2} fill="#5b8def" />
          <rect x={150 + d2 * 40 - 6 - m2} y={84 - m2 * 2} width={12 + m2 * 2} height={12 + m2 * 2} fill="#e53935" />
        </g>
        <text x="150" y="20" textAnchor="middle" fontSize="14">{balanced ? '⚖️ Balanced!' : left > right ? '⬅️ Left side goes down' : 'Right side goes down ➡️'}</text>
      </svg>
      <Slider label="🟦 Left weight" value={m1} onChange={setM1} min={1} max={10} unit=" kg" />
      <Slider label="🟦 Left distance" value={d1} onChange={setD1} min={0.5} max={3} step={0.5} unit=" m" />
      <Slider label="🟥 Right weight" value={m2} onChange={setM2} min={1} max={10} unit=" kg" />
      <Slider label="🟥 Right distance" value={d2} onChange={setD2} min={0.5} max={3} step={0.5} unit=" m" />
      <Readout items={[['Left: weight × distance', round(left, 1)], ['Right: weight × distance', round(right, 1)]]} />
    </LabFrame>
  );
}

// ---------- 🛟 Sink or float: density = mass ÷ volume ----------
const LIQUIDS = [
  { id: 'water', label: '💧 Fresh water', d: 1.0 },
  { id: 'salt', label: '🧂 Very salty water', d: 1.2 },
  { id: 'oil', label: '🫒 Cooking oil', d: 0.9 },
] as const;
export function FloatLab() {
  const [mass, setMass] = useState(400);
  const [vol, setVol] = useState(400);
  const [liquid, setLiquid] = useState<(typeof LIQUIDS)[number]['id']>('water');
  const [tried, setTried] = useState<Array<{ d: number; liquid: string }>>([]);
  const density = mass / vol;
  const ld = LIQUIDS.find((l) => l.id === liquid)!.d;
  const floats = density < ld;
  const under = floats ? density / ld : 1;
  useEffect(() => setTried((t) => [...t, { d: density, liquid }].slice(-40)), [density, liquid]);
  const side = Math.cbrt(vol) * 6;
  const top = floats ? 70 - side * (1 - under) : 140 - side;
  return (
    <LabFrame
      title="Sink or float"
      intro="An object floats if it is less dense than the liquid (less mass packed into each cm³). Density = mass ÷ volume."
      goals={[
        { text: 'Make the block float in fresh water', done: tried.some((t) => t.liquid === 'water' && t.d < 1) },
        { text: 'Make it sink in fresh water', done: tried.some((t) => t.liquid === 'water' && t.d > 1) },
        { text: 'Find a block that sinks in fresh water but floats in very salty water', done: density > 1 && density < 1.2 && liquid === 'salt' },
        { text: 'Make a block that floats in water but sinks in oil', done: density > 0.9 && density < 1 && liquid === 'oil' },
      ]}
    >
      <svg viewBox="0 0 300 150" className="lab-svg" role="img" aria-label="A block in a tank">
        <rect x="40" y="70" width="220" height="75" fill={liquid === 'oil' ? 'rgba(255,193,7,0.35)' : 'rgba(91,141,239,0.3)'} />
        <rect x="40" y="10" width="220" height="135" fill="none" stroke="currentColor" />
        <rect x={150 - side / 2} y={top} width={side} height={side} fill="#8d6e63" />
      </svg>
      <Slider label="Mass" value={mass} onChange={setMass} min={20} max={600} step={10} unit=" g" />
      <Slider label="Volume (size)" value={vol} onChange={setVol} min={50} max={600} step={10} unit=" cm³" />
      <Choice label="Liquid" value={liquid} options={LIQUIDS.map((l) => ({ id: l.id, label: l.label }))} onChange={setLiquid} />
      <Readout items={[['Block density', `${round(density, 2)} g/cm³`], ['Liquid density', `${ld} g/cm³`], ['Result', floats ? `🛟 Floats (${Math.round(under * 100)}% under)` : density === ld ? '⚖️ Hovers — same density as the liquid' : '⬇️ Sinks']]} />
    </LabFrame>
  );
}

// ---------- 🌡️ Mixing hot and cold water: T = (m₁T₁ + m₂T₂) / (m₁ + m₂) ----------
export function MixLab() {
  const [m1, setM1] = useState(300);
  const [t1, setT1] = useState(20);
  const [m2, setM2] = useState(200);
  const [t2, setT2] = useState(80);
  const final = (m1 * t1 + m2 * t2) / (m1 + m2);
  return (
    <LabFrame
      title="Mixing hot and cold water"
      intro="When hot and cold water mix, heat moves from hot to cold until they're the same temperature. More water counts for more."
      goals={[
        { text: 'Mix 20°C and 80°C water to get exactly 50°C', done: Math.round(final) === 50 && t1 === 20 && t2 === 80 },
        { text: 'Make a bath at body temperature (36–38°C)', done: final >= 36 && final <= 38 },
        { text: 'Get a mix closer to the cold temperature than the hot one', done: Math.abs(final - Math.min(t1, t2)) < Math.abs(final - Math.max(t1, t2)) },
      ]}
    >
      <div className="lab-row">
        <div className="lab-cup" style={{ background: `hsl(${220 - t1 * 2.2} 80% 60%)` }}>🥛 {m1} g · {t1}°C</div>
        <span>+</span>
        <div className="lab-cup" style={{ background: `hsl(${220 - t2 * 2.2} 80% 60%)` }}>🥛 {m2} g · {t2}°C</div>
        <span>=</span>
        <div className="lab-cup" style={{ background: `hsl(${220 - final * 2.2} 80% 60%)` }}>{m1 + m2} g · {round(final)}°C</div>
      </div>
      <Slider label="Cup 1 water" value={m1} onChange={setM1} min={50} max={500} step={50} unit=" g" />
      <Slider label="Cup 1 temperature" value={t1} onChange={setT1} min={0} max={100} unit="°C" />
      <Slider label="Cup 2 water" value={m2} onChange={setM2} min={50} max={500} step={50} unit=" g" />
      <Slider label="Cup 2 temperature" value={t2} onChange={setT2} min={0} max={100} unit="°C" />
    </LabFrame>
  );
}

// ---------- 🪶 Falling: with and without air ----------
export function FallLab() {
  const [height, setHeight] = useState(20);
  const [air, setAir] = useState(true);
  const [sim, setSim] = useState<{ t: number; ball: [number, number]; feather: [number, number] } | null>(null);
  const [results, setResults] = useState<Array<{ air: boolean; ball: number; feather: number }>>([]);
  const g = 9.8;
  // [distance fallen, speed]; terminal speeds with air: ball 40 m/s, feather 0.8 m/s
  const step = ([y, v]: [number, number], vt: number, dt: number): [number, number] => {
    const a = air ? g * (1 - (v * v) / (vt * vt)) : g;
    const nv = v + a * dt;
    return [y + nv * dt, nv];
  };
  const times = useRef<{ ball: number | null; feather: number | null }>({ ball: null, feather: null });
  useAnimation(Boolean(sim), (dt) =>
    setSim((s) => {
      if (!s) return s;
      const t = s.t + dt;
      const ball = s.ball[0] >= height ? s.ball : step(s.ball, 40, dt);
      const feather = s.feather[0] >= height ? s.feather : step(s.feather, 0.8, dt);
      if (ball[0] >= height && times.current.ball === null) times.current.ball = t;
      if (feather[0] >= height && times.current.feather === null) times.current.feather = t;
      if (times.current.ball !== null && (times.current.feather !== null || t > 8)) {
        setResults((r) => [...r, { air, ball: times.current.ball!, feather: times.current.feather ?? height / 0.8 }]);
        return null;
      }
      return { t, ball, feather };
    })
  );
  const drop = () => {
    times.current = { ball: null, feather: null };
    setSim({ t: 0, ball: [0, 0], feather: [0, 0] });
  };
  const y = (d: number) => 15 + (Math.min(d, height) / height) * 120;
  const last = results[results.length - 1];
  return (
    <LabFrame
      title="Ball and feather drop"
      intro="Gravity pulls on everything the same way. Air pushes back on things that are light and spread out, like a feather."
      goals={[
        { text: 'Drop both with air — which lands first?', done: results.some((r) => r.air) },
        { text: 'Take the air away (like on the Moon) and drop them again', done: results.some((r) => !r.air) },
      ]}
    >
      <svg viewBox="0 0 300 150" className="lab-svg" role="img" aria-label="A ball and a feather falling">
        <line x1="0" y1="140" x2="300" y2="140" stroke="currentColor" />
        <circle cx="110" cy={y(sim?.ball[0] ?? (last ? height : 0))} r="7" fill="#e53935" />
        <text x="190" y={y(sim?.feather[0] ?? (last ? height : 0)) + 5} fontSize="16" textAnchor="middle">🪶</text>
      </svg>
      <Slider label="Height" value={height} onChange={setHeight} min={5} max={50} step={5} unit=" m" />
      <Choice label="Air" value={air ? 'on' : 'off'} options={[{ id: 'on', label: '💨 With air' }, { id: 'off', label: '🌑 No air' }]} onChange={(v) => setAir(v === 'on')} />
      <button type="button" className="primary" disabled={Boolean(sim)} onClick={drop}>⬇️ Drop both</button>
      {last && <Readout items={[['🔴 Ball landed', `${round(last.ball, 2)} s`], ['🪶 Feather landed', `${round(last.feather, 2)} s`], ['With air?', last.air ? 'yes' : 'no']]} />}
    </LabFrame>
  );
}

// ---------- 🌈 Mixing colored light (red + green + blue) ----------
export function LightMixLab() {
  const [r, setR] = useState(255);
  const [g, setG] = useState(0);
  const [b, setB] = useState(0);
  const hi = (v: number) => v >= 200;
  const lo = (v: number) => v <= 60;
  return (
    <LabFrame
      title="Mixing colors of light"
      intro="Screens make every color from red, green and blue light. Mixing light is different from mixing paint — all three together make white!"
      goals={[
        { text: 'Make yellow light (red + green)', done: hi(r) && hi(g) && lo(b) },
        { text: 'Make cyan (green + blue)', done: lo(r) && hi(g) && hi(b) },
        { text: 'Make magenta (red + blue)', done: hi(r) && lo(g) && hi(b) },
        { text: 'Make white light', done: hi(r) && hi(g) && hi(b) },
      ]}
    >
      <div className="lab-swatch" style={{ background: `rgb(${r},${g},${b})` }} aria-label="The mixed color" />
      <Slider label="🔴 Red light" value={r} onChange={setR} min={0} max={255} step={5} />
      <Slider label="🟢 Green light" value={g} onChange={setG} min={0} max={255} step={5} />
      <Slider label="🔵 Blue light" value={b} onChange={setB} min={0} max={255} step={5} />
    </LabFrame>
  );
}

// ---------- 🪀 Spring: stretch = force ÷ stiffness (Hooke's law) ----------
export function SpringLab() {
  const [k, setK] = useState(40);
  const [mass, setMass] = useState(0.5);
  const [log, setLog] = useState<Array<{ k: number; m: number; x: number }>>([]);
  const x = (mass * 9.8) / k;
  useEffect(() => setLog((l) => [...l, { k, m: mass, x }].slice(-60)), [k, mass, x]);
  const coils = 10;
  const len = 30 + x * 300;
  const path = Array.from({ length: coils * 2 + 1 }, (_, i) => `${i === 0 ? 'M' : 'L'}${150 + (i === 0 || i === coils * 2 ? 0 : i % 2 ? 15 : -15)},${10 + (i / (coils * 2)) * len}`).join(' ');
  return (
    <LabFrame
      title="Stretch a spring"
      intro="Hang a weight on a spring. The stretch is the force (the weight) divided by the spring's stiffness. Twice the weight = twice the stretch."
      goals={[
        { text: 'Stretch the spring exactly 10 cm (9.5–10.5)', done: x >= 0.095 && x <= 0.105 },
        { text: 'Keep the same spring and double the mass — compare the stretch', done: log.some((a) => log.some((b) => b.k === a.k && Math.abs(b.m - 2 * a.m) < 1e-9)) },
        { text: 'Use a stiffer spring to make the stretch smaller', done: log.some((a) => log.some((b) => b.m === a.m && b.k > a.k)) },
      ]}
    >
      <svg viewBox="0 0 300 190" className="lab-svg" role="img" aria-label="A spring with a weight">
        <line x1="100" y1="10" x2="200" y2="10" stroke="currentColor" strokeWidth="4" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x={135} y={10 + len} width="30" height={10 + mass * 8} fill="#5b8def" />
      </svg>
      <Slider label="Spring stiffness" value={k} onChange={setK} min={10} max={100} step={5} unit=" N/m" />
      <Slider label="Mass" value={mass} onChange={setMass} min={0.1} max={2} step={0.1} unit=" kg" format={(v) => `${round(v, 1)} kg`} />
      <Readout items={[['Weight (force)', `${round(mass * 9.8, 2)} N`], ['Stretch', `${round(x * 100, 1)} cm`]]} />
    </LabFrame>
  );
}
