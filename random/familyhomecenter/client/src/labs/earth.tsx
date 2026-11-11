import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Choice, LabFrame, Readout, Slider, round } from './common.js';

/** 🌍 Earth & space labs. */

// ---------- 🌙 Moon phases ----------
const MONTH = 29.53;
const phaseName = (d: number) => {
  const f = d / MONTH;
  if (f < 0.03 || f > 0.97) return '🌑 New moon';
  if (f < 0.22) return '🌒 Waxing crescent';
  if (f < 0.28) return '🌓 First quarter';
  if (f < 0.47) return '🌔 Waxing gibbous';
  if (f < 0.53) return '🌕 Full moon';
  if (f < 0.72) return '🌖 Waning gibbous';
  if (f < 0.78) return '🌗 Last quarter';
  return '🌘 Waning crescent';
};
/** The lit part of the Moon as seen from Earth (northern hemisphere). */
function moonPath(day: number, cx: number, cy: number, r: number) {
  const phi = (2 * Math.PI * day) / MONTH;
  const k = Math.cos(phi);
  const rx = Math.abs(r * k);
  const waxing = day < MONTH / 2;
  const crescent = k > 0;
  // limb half-circle on the lit side, then the terminator (a half-ellipse) back to the top
  const limbSweep = waxing ? 1 : 0;
  const termSweep = waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0;
  return `M${cx},${cy - r} A${r},${r} 0 0 ${limbSweep} ${cx},${cy + r} A${rx},${r} 0 0 ${termSweep} ${cx},${cy - r} Z`;
}
export function MoonLab() {
  const [day, setDay] = useState(3);
  const [seen, setSeen] = useState<string[]>([]);
  const name = phaseName(day);
  useEffect(() => setSeen((s) => (s.includes(name) ? s : [...s, name])), [name]);
  const a = (2 * Math.PI * day) / MONTH; // 0 = between Earth and Sun
  const mx = 200 - Math.cos(a) * 60;
  const my = 90 + Math.sin(a) * 60;
  return (
    <LabFrame
      title="Phases of the Moon"
      intro="The Moon doesn't make light — the Sun lights half of it. As the Moon goes around Earth (about 29½ days), we see different amounts of the lit half."
      goals={[
        { text: 'Find the full moon', done: seen.includes('🌕 Full moon') },
        { text: 'Find the new moon (we can’t see it!)', done: seen.includes('🌑 New moon') },
        { text: 'Find both quarter moons', done: seen.includes('🌓 First quarter') && seen.includes('🌗 Last quarter') },
        { text: 'See all 8 phases', done: seen.length >= 8 },
      ]}
    >
      <svg viewBox="0 0 400 180" className="lab-svg" role="img" aria-label="Sun, Earth and Moon from above, and the Moon as seen from Earth">
        <text x="10" y="95" fontSize="22">☀️</text>
        <text x="40" y="95" fontSize="10" opacity="0.6">sunlight →</text>
        <circle cx="200" cy="90" r="60" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />
        <circle cx="200" cy="90" r="16" fill="#1e88e5" />
        <circle cx={mx} cy={my} r="9" fill="#424242" />
        <path d={`M${mx},${my - 9} A9,9 0 0 0 ${mx},${my + 9} Z`} fill="#fafafa" />
        <circle cx="340" cy="90" r="35" fill="#424242" />
        <path d={moonPath(day, 340, 90, 35)} fill="#fafafa" />
        <text x="340" y="145" fontSize="10" textAnchor="middle">seen from Earth</text>
      </svg>
      <Slider label="Day of the Moon's trip" value={day} onChange={setDay} min={0} max={29.5} step={0.5} />
      <Readout items={[['Phase', name], ['Lit part we see', `${Math.round(((1 - Math.cos(a)) / 2) * 100)}%`]]} />
    </LabFrame>
  );
}

// ---------- ☀️ Seasons and daylight ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PLACES = [
  { id: 'eq', label: '🌴 Equator (0°)', lat: 0 },
  { id: 'mid', label: '🏙️ Middle (40°N)', lat: 40 },
  { id: 'arctic', label: '🐻‍❄️ Arctic (70°N)', lat: 70 },
  { id: 'south', label: '🦘 South (35°S)', lat: -35 },
] as const;
export function SeasonsLab() {
  const [month, setMonth] = useState(0);
  const [place, setPlace] = useState<(typeof PLACES)[number]['id']>('mid');
  const [log, setLog] = useState<Array<{ place: string; month: number; hours: number }>>([]);
  const lat = PLACES.find((p) => p.id === place)!.lat;
  const day = month * 30.4 + 15;
  const decl = 23.44 * Math.sin((2 * Math.PI * (day - 80)) / 365);
  const x = -Math.tan((lat * Math.PI) / 180) * Math.tan((decl * Math.PI) / 180);
  const hours = x <= -1 ? 24 : x >= 1 ? 0 : (24 / Math.PI) * Math.acos(x);
  const noon = Math.max(0, 90 - Math.abs(lat - decl));
  useEffect(() => setLog((l) => [...l, { place, month, hours }].slice(-100)), [place, month, hours]);
  const sunX = 150 - Math.cos((noon * Math.PI) / 180) * 110;
  const sunY = 150 - Math.sin((noon * Math.PI) / 180) * 110;
  return (
    <LabFrame
      title="Seasons and daylight"
      intro="Earth is tilted about 23½°. When your half of Earth tips toward the Sun, days are long and the Sun climbs high — that's summer."
      goals={[
        { text: 'Find the month with the longest days at 40°N', done: log.some((l) => l.place === 'mid' && l.month === 5) },
        { text: 'Find a place and month where the Sun never sets', done: log.some((l) => l.hours >= 24) },
        { text: 'Compare: when it’s summer up north, what season is it at 35°S?', done: log.some((l) => l.place === 'south' && (l.month === 5 || l.month === 6)) },
        { text: 'Find a month at 40°N with about equal day and night (11.8–12.2 hours)', done: log.some((l) => l.place === 'mid' && l.hours >= 11.8 && l.hours <= 12.2) },
      ]}
    >
      <svg viewBox="0 0 300 160" className="lab-svg" role="img" aria-label="How high the Sun gets at noon">
        <line x1="20" y1="150" x2="280" y2="150" stroke="currentColor" />
        <path d="M40,150 A110,110 0 0 1 260,150" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 3" />
        <line x1="150" y1="150" x2={sunX} y2={sunY} stroke="#f9a825" strokeDasharray="4 3" />
        <text x={sunX} y={sunY + 6} fontSize="18" textAnchor="middle">☀️</text>
        <text x="150" y="146" fontSize="14" textAnchor="middle">🧍</text>
      </svg>
      <Slider label="Month" value={month} onChange={setMonth} min={0} max={11} format={(v) => MONTHS[v]} />
      <Choice label="Place" value={place} options={PLACES.map((p) => ({ id: p.id, label: p.label }))} onChange={setPlace} />
      <Readout items={[['Daylight', `${round(hours, 1)} hours`], ['Sun height at noon', `${Math.round(noon)}°`], ['Season here', lat === 0 ? 'no big seasons' : Math.abs(decl) <= 5 ? 'spring or fall' : (lat > 0) === (decl > 0) ? 'summer-ish' : 'winter-ish']]} />
    </LabFrame>
  );
}

// ---------- 🪨 The rock cycle ----------
type Rock = 'igneous' | 'sediment' | 'sedimentary' | 'metamorphic' | 'magma';
const ROCK: Record<Rock, string> = {
  igneous: '🌋 Igneous rock (like granite or basalt)',
  sediment: '🏖️ Sediment (sand, mud, pebbles)',
  sedimentary: '🪨 Sedimentary rock (like sandstone)',
  metamorphic: '💎 Metamorphic rock (like marble)',
  magma: '🔥 Magma (melted rock)',
};
const ACTIONS: Array<{ id: string; label: string; from: Rock[]; to: Rock }> = [
  { id: 'weather', label: '🌧️ Weather and erode it', from: ['igneous', 'sedimentary', 'metamorphic'], to: 'sediment' },
  { id: 'cement', label: '🧱 Bury, squeeze and cement', from: ['sediment'], to: 'sedimentary' },
  { id: 'heat', label: '♨️ Heat and pressure (no melting)', from: ['igneous', 'sedimentary'], to: 'metamorphic' },
  { id: 'melt', label: '🔥 Melt it deep underground', from: ['igneous', 'sedimentary', 'metamorphic'], to: 'magma' },
  { id: 'cool', label: '❄️ Cool and harden', from: ['magma'], to: 'igneous' },
];
export function RockCycleLab() {
  const [rock, setRock] = useState<Rock>('igneous');
  const [path, setPath] = useState<Rock[]>(['igneous']);
  const [msg, setMsg] = useState<string | null>(null);
  const act = (a: (typeof ACTIONS)[number]) => {
    if (!a.from.includes(rock)) {
      setMsg(`That doesn't happen to ${ROCK[rock].split(' (')[0].slice(3).toLowerCase()} — try something else.`);
      return;
    }
    setMsg(null);
    setRock(a.to);
    setPath((p) => [...p, a.to]);
  };
  const made = new Set(path);
  return (
    <LabFrame
      title="The rock cycle"
      intro="Rocks slowly change from one kind to another over millions of years. Pick what happens to your rock."
      goals={[
        { text: 'Turn igneous rock into sedimentary rock', done: made.has('sedimentary') },
        { text: 'Make metamorphic rock', done: made.has('metamorphic') },
        { text: 'Go all the way around: melt a rock and cool it back into igneous rock', done: path.slice(1).includes('magma') && path.lastIndexOf('igneous') > path.indexOf('magma') },
      ]}
    >
      <p className="lab-win">Your rock: <strong>{ROCK[rock]}</strong></p>
      <div className="lab-buttons">
        {ACTIONS.map((a) => (
          <button key={a.id} type="button" onClick={() => act(a)} className={a.from.includes(rock) ? '' : 'is-faded'}>
            {a.label}
          </button>
        ))}
      </div>
      {msg && <p className="hint">{msg}</p>}
      <p className="hint">Its journey: {path.map((p) => ROCK[p].split(' ')[0]).join(' → ')}</p>
    </LabFrame>
  );
}

// ---------- 🪐 Your weight on other worlds ----------
const WORLDS = [
  { name: '☿ Mercury', g: 3.7 },
  { name: '♀ Venus', g: 8.87 },
  { name: '🌍 Earth', g: 9.8 },
  { name: '🌙 Moon', g: 1.62 },
  { name: '🔴 Mars', g: 3.71 },
  { name: '🪐 Jupiter', g: 24.79 },
  { name: '🪐 Saturn', g: 10.44 },
  { name: '🔵 Uranus', g: 8.69 },
  { name: '🔵 Neptune', g: 11.15 },
  { name: '❄️ Pluto', g: 0.62 },
];
export function WeightLab() {
  const [lb, setLb] = useState(70);
  const [pick, setPick] = useState('🌍 Earth');
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => setSeen((s) => (s.includes(pick) ? s : [...s, pick])), [pick]);
  const w = WORLDS.find((x) => x.name === pick)!;
  const jump = 0.4 * (9.8 / w.g);
  return (
    <LabFrame
      title="Your weight on other worlds"
      intro="Your mass (how much of you there is) stays the same everywhere. Your weight is how hard gravity pulls on you — and that changes from world to world."
      goals={[
        { text: 'Find where you would weigh the most', done: seen.includes('🪐 Jupiter') },
        { text: 'Find where you would weigh the least', done: seen.includes('❄️ Pluto') },
        { text: 'Visit 5 worlds', done: seen.length >= 5 },
      ]}
    >
      <Slider label="Your weight on Earth" value={lb} onChange={setLb} min={20} max={250} step={5} unit=" lb" />
      <Choice label="Go to" value={pick} options={WORLDS.map((x) => ({ id: x.name, label: x.name }))} onChange={setPick} />
      <Readout items={[['Your weight there', `${round((lb * w.g) / 9.8)} lb`], ['Gravity', `${w.g} m/s² (${round(w.g / 9.8, 2)}× Earth)`], ['A 40 cm jump becomes', `${round(jump * 100)} cm`]]} />
    </LabFrame>
  );
}

// ---------- 🌐 Find the earthquake ----------
const STATIONS = [
  { name: 'A', x: 60, y: 50 },
  { name: 'B', x: 250, y: 70 },
  { name: 'C', x: 140, y: 170 },
];
const KM_PER_PX = 2;
/** seconds between the P wave and the S wave for each km (simplified: about 1 s per 8 km) */
const KM_PER_SECOND_OF_LAG = 8;
export function QuakeLab() {
  const quake = useMemo(() => ({ x: 90 + Math.random() * 120, y: 70 + Math.random() * 70 }), []);
  const lags = STATIONS.map((s) => (Math.hypot(s.x - quake.x, s.y - quake.y) * KM_PER_PX) / KM_PER_SECOND_OF_LAG);
  const [radii, setRadii] = useState<number[]>([50, 50, 50]);
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null);
  const correct = radii.every((r, i) => Math.abs(r - lags[i] * KM_PER_SECOND_OF_LAG) < 12);
  const close = guess && Math.hypot(guess.x - quake.x, guess.y - quake.y) * KM_PER_PX < 30;
  const onMap = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setGuess({ x: ((e.clientX - r.left) / r.width) * 300, y: ((e.clientY - r.top) / r.height) * 220 });
  };
  return (
    <LabFrame
      title="Find the earthquake"
      intro="Earthquakes send out fast P waves and slower S waves. The longer the wait between them at a station, the farther away the quake. Here 1 second of waiting ≈ 8 km. Draw each station's circle, then tap where all three cross."
      goals={[
        { text: 'Set all three circles to the right distance', done: correct },
        { text: 'Tap the map within 30 km of the epicenter', done: Boolean(close) },
      ]}
    >
      <svg viewBox="0 0 300 220" className="lab-svg lab-map" role="img" aria-label="A map with three seismograph stations" onClick={onMap}>
        <rect x="0" y="0" width="300" height="220" fill="#e8f5e9" />
        {STATIONS.map((s, i) => (
          <g key={s.name}>
            <circle cx={s.x} cy={s.y} r={radii[i] / KM_PER_PX} fill="none" stroke="#5b8def" strokeWidth="1.5" />
            <text x={s.x} y={s.y + 4} fontSize="12" textAnchor="middle">📡{s.name}</text>
          </g>
        ))}
        {guess && <text x={guess.x} y={guess.y + 5} fontSize="14" textAnchor="middle">❌</text>}
        {close && <text x={quake.x} y={quake.y + 5} fontSize="18" textAnchor="middle">💥</text>}
      </svg>
      {STATIONS.map((s, i) => (
        <div key={s.name}>
          <p className="hint">📡 Station {s.name}: the S wave came {round(lags[i], 1)} s after the P wave.</p>
          <Slider label={`Circle around ${s.name}`} value={radii[i]} onChange={(v) => setRadii((r) => r.map((x, j) => (j === i ? v : x)))} min={10} max={500} step={5} unit=" km" />
        </div>
      ))}
      {close && <p className="lab-win">💥 Found it! The epicenter is where the circles cross.</p>}
    </LabFrame>
  );
}
