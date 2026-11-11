import { useEffect, useMemo, useRef, useState } from 'react';
import { Choice, LabFrame, Readout, Slider, round, useAnimation } from './common.js';

/** 🧪 Chemistry labs. */

// ---------- 🧊 Solid, liquid, gas (water) ----------
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number;
  hy: number;
}
function makeParticles(n: number): P[] {
  return Array.from({ length: n }, (_, i) => {
    const hx = 100 + (i % 6) * 18;
    const hy = 60 + Math.floor(i / 6) * 18;
    return { x: hx, y: hy, vx: Math.random() - 0.5, vy: Math.random() - 0.5, hx, hy };
  });
}
export function StatesLab() {
  const [temp, setTemp] = useState(-10);
  const [trail, setTrail] = useState<string[]>([]);
  const parts = useRef<P[]>(makeParticles(30));
  const [, force] = useState(0);
  const state = temp < 0 ? 'solid' : temp < 100 ? 'liquid' : 'gas';
  useEffect(() => setTrail((t) => (t[t.length - 1] === state ? t : [...t, state])), [state]);
  useAnimation(true, (dt) => {
    const speed = 20 + Math.max(0, temp + 30) * 1.6;
    for (const p of parts.current) {
      if (state === 'solid') {
        p.x = p.hx + (Math.random() - 0.5) * (2 + (temp + 30) / 10);
        p.y = p.hy + (Math.random() - 0.5) * (2 + (temp + 30) / 10);
        continue;
      }
      p.vx += (Math.random() - 0.5) * 0.4;
      p.vy += (Math.random() - 0.5) * 0.4 + (state === 'liquid' ? 0.25 : 0);
      const v = Math.hypot(p.vx, p.vy) || 1;
      p.vx = (p.vx / v) * speed * dt;
      p.vy = (p.vy / v) * speed * dt;
      p.x += p.vx;
      p.y += p.vy;
      const top = state === 'liquid' ? 105 : 10;
      if (p.x < 12 || p.x > 288) p.vx *= -1;
      if (p.y < top || p.y > 168) p.vy *= -1;
      p.x = Math.max(12, Math.min(288, p.x));
      p.y = Math.max(top, Math.min(168, p.y));
    }
    force((n) => n + 1);
  });
  return (
    <LabFrame
      title="Heat up some water"
      intro="Everything is made of tiny particles that are always moving. Heating makes them move faster: ice melts at 0°C and water boils at 100°C."
      goals={[
        { text: 'Melt the ice into liquid water', done: trail.includes('liquid') },
        { text: 'Boil the water into a gas (steam)', done: trail.includes('gas') },
        { text: 'Cool it all the way back into ice', done: trail.includes('liquid') && trail.lastIndexOf('solid') > trail.indexOf('liquid') },
      ]}
    >
      <svg viewBox="0 0 300 180" className="lab-svg" role="img" aria-label={`Water as a ${state}`}>
        <rect x="5" y="5" width="290" height="170" rx="8" fill="none" stroke="currentColor" />
        {parts.current.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="6" fill="#5b8def" />
        ))}
      </svg>
      <Slider label="Temperature" value={temp} onChange={setTemp} min={-30} max={130} step={5} unit="°C" />
      <Readout items={[['State', state === 'solid' ? '🧊 Solid (ice)' : state === 'liquid' ? '💧 Liquid (water)' : '♨️ Gas (steam)']]} />
    </LabFrame>
  );
}

// ---------- ⚛️ Build an atom ----------
const ELEMENTS = ['—', 'Hydrogen (H)', 'Helium (He)', 'Lithium (Li)', 'Beryllium (Be)', 'Boron (B)', 'Carbon (C)', 'Nitrogen (N)', 'Oxygen (O)', 'Fluorine (F)', 'Neon (Ne)'];
export function AtomLab() {
  const [p, setP] = useState(1);
  const [n, setN] = useState(0);
  const [e, setE] = useState(1);
  const [made, setMade] = useState<string[]>([]);
  const key = `${p}-${n}-${e}`;
  useEffect(() => setMade((m) => (m.includes(key) ? m : [...m, key])), [key]);
  const charge = p - e;
  const shells = [Math.min(e, 2), Math.max(0, Math.min(e - 2, 8)), Math.max(0, e - 10)];
  const nucleus = [...Array(p).fill('#e53935'), ...Array(n).fill('#9e9e9e')];
  return (
    <LabFrame
      title="Build an atom"
      intro="The number of protons decides which element it is. Neutrons add mass. Electrons (negative) balance the protons (positive)."
      goals={[
        { text: 'Build carbon-12: 6 protons, 6 neutrons, 6 electrons', done: made.includes('6-6-6') },
        { text: 'Make a neutral oxygen atom (any neutrons)', done: made.some((k) => k.startsWith('8-') && k.endsWith('-8')) },
        { text: 'Make a positive ion (fewer electrons than protons)', done: made.some((k) => { const [a, , c] = k.split('-').map(Number); return c < a; }) },
        { text: 'Make two isotopes of helium (2 protons, different neutrons)', done: new Set(made.filter((k) => k.startsWith('2-')).map((k) => k.split('-')[1])).size >= 2 },
      ]}
    >
      <svg viewBox="0 0 300 200" className="lab-svg" role="img" aria-label="An atom">
        {[40, 70, 95].map((r, i) => (
          <circle key={r} cx="150" cy="100" r={r} fill="none" stroke="currentColor" strokeOpacity={i === 0 || shells[i] ? 0.35 : 0.1} />
        ))}
        {nucleus.map((c, i) => (
          <circle key={i} cx={150 + ((i % 5) - 2) * 7} cy={100 + (Math.floor(i / 5) - 2) * 7 + 7} r="5" fill={c} />
        ))}
        {shells.flatMap((count, s) =>
          Array.from({ length: count }, (_, i) => {
            const r = [40, 70, 95][s];
            const a = (i / count) * 2 * Math.PI;
            return <circle key={`${s}-${i}`} cx={150 + r * Math.cos(a)} cy={100 + r * Math.sin(a)} r="4" fill="#5b8def" />;
          })
        )}
      </svg>
      <Slider label="🔴 Protons (+)" value={p} onChange={setP} min={1} max={10} />
      <Slider label="⚪ Neutrons" value={n} onChange={setN} min={0} max={12} />
      <Slider label="🔵 Electrons (−)" value={e} onChange={setE} min={0} max={12} />
      <Readout
        items={[
          ['Element', ELEMENTS[p]],
          ['Mass number', p + n],
          ['Charge', charge === 0 ? '0 (neutral)' : charge > 0 ? `+${charge} (positive ion)` : `${charge} (negative ion)`],
        ]}
      />
    </LabFrame>
  );
}

// ---------- 🍋 Acids and bases (pH, with red-cabbage indicator) ----------
const LIQUIDS = [
  { id: 'lemon', label: '🍋 Lemon juice', ph: 2 },
  { id: 'vinegar', label: '🫙 Vinegar', ph: 3 },
  { id: 'milk', label: '🥛 Milk', ph: 6.5 },
  { id: 'water', label: '💧 Pure water', ph: 7 },
  { id: 'soda', label: '🧁 Baking soda water', ph: 8.5 },
  { id: 'soap', label: '🧼 Soapy water', ph: 10 },
  { id: 'ammonia', label: '🧴 Ammonia cleaner', ph: 11.5 },
] as const;
type LiquidId = (typeof LIQUIDS)[number]['id'];
/** red cabbage juice: red (acid) → purple (neutral) → green / yellow (base) */
const cabbage = (ph: number) => (ph < 3 ? '#d81b60' : ph < 5 ? '#e91e63' : ph < 6.5 ? '#ab47bc' : ph < 7.5 ? '#7e57c2' : ph < 9 ? '#3f51b5' : ph < 11 ? '#26a69a' : '#c0ca33');
/**
 * A kid-sized model, not the real logarithm: each mL brings "acid points" (7 − pH) or "base points"
 * (pH − 7), they cancel, and what's left is spread over all the liquid. (Real pH jumps from ~4 to ~10
 * within a drop when an acid is neutralized, which is too sudden to find with a slider.)
 */
function mixPh(a: { ph: number; ml: number }, b: { ph: number; ml: number }) {
  const total = a.ml + b.ml;
  if (total <= 0) return 7;
  const net = (a.ml * (a.ph - 7) + b.ml * (b.ph - 7)) / total;
  return Math.max(0, Math.min(14, 7 + net));
}
export function PhLab() {
  const [a, setA] = useState<LiquidId>('vinegar');
  const [b, setB] = useState<LiquidId>('water');
  const [mlA, setMlA] = useState(10);
  const [mlB, setMlB] = useState(0);
  const [log, setLog] = useState<number[]>([]);
  const ph = mixPh({ ph: LIQUIDS.find((l) => l.id === a)!.ph, ml: mlA }, { ph: LIQUIDS.find((l) => l.id === b)!.ph, ml: mlB });
  useEffect(() => setLog((l) => [...l, ph].slice(-80)), [ph]);
  const pa = LIQUIDS.find((l) => l.id === a)!.ph;
  const pb = LIQUIDS.find((l) => l.id === b)!.ph;
  return (
    <LabFrame
      title="Acids and bases"
      intro="The pH scale goes from 0 to 14. Below 7 is an acid, 7 is neutral, above 7 is a base. Red cabbage juice changes color to show the pH!"
      goals={[
        { text: 'Find an acid strong enough to turn the juice red (pH under 3)', done: log.some((x) => x < 3) },
        { text: 'Find a base (pH over 9)', done: log.some((x) => x > 9) },
        { text: 'Mix an acid and a base to get close to neutral (pH 6.5–7.5)', done: mlA > 0 && mlB > 0 && ((pa < 7 && pb > 7) || (pa > 7 && pb < 7)) && ph >= 6.5 && ph <= 7.5 },
      ]}
    >
      <div className="lab-row">
        <div className="lab-cup" style={{ background: cabbage(ph), color: '#fff' }}>🧪 pH {round(ph, 1)}</div>
      </div>
      <div className="lab-phbar" aria-hidden>
        {Array.from({ length: 15 }, (_, i) => (
          <span key={i} style={{ background: cabbage(i) }} className={Math.round(ph) === i ? 'is-on' : ''}>{i}</span>
        ))}
      </div>
      <Choice label="First liquid" value={a} options={LIQUIDS.map((l) => ({ id: l.id, label: l.label }))} onChange={setA} />
      <Slider label="How much" value={mlA} onChange={setMlA} min={0} max={50} unit=" mL" />
      <Choice label="Second liquid" value={b} options={LIQUIDS.map((l) => ({ id: l.id, label: l.label }))} onChange={setB} />
      <Slider label="How much" value={mlB} onChange={setMlB} min={0} max={50} unit=" mL" />
      <Readout items={[['pH', round(ph, 1)], ['Acid, base or neutral?', ph < 6.5 ? 'acid' : ph > 7.5 ? 'base' : 'about neutral']]} />
      <p className="hint">⚠️ Real cleaners can hurt your skin and eyes — only an adult should handle them. This lab is safe to play with.</p>
    </LabFrame>
  );
}

// ---------- ⚖️ Balancing chemical equations ----------
type Formula = Record<string, number>;
const EQUATIONS: Array<{ id: string; label: string; left: Array<[string, Formula]>; right: Array<[string, Formula]> }> = [
  { id: 'water', label: 'Making water', left: [['H₂', { H: 2 }], ['O₂', { O: 2 }]], right: [['H₂O', { H: 2, O: 1 }]] },
  { id: 'methane', label: 'Burning methane', left: [['CH₄', { C: 1, H: 4 }], ['O₂', { O: 2 }]], right: [['CO₂', { C: 1, O: 2 }], ['H₂O', { H: 2, O: 1 }]] },
  { id: 'ammonia', label: 'Making ammonia', left: [['N₂', { N: 2 }], ['H₂', { H: 2 }]], right: [['NH₃', { N: 1, H: 3 }]] },
  { id: 'rust', label: 'Iron rusting', left: [['Fe', { Fe: 1 }], ['O₂', { O: 2 }]], right: [['Fe₂O₃', { Fe: 2, O: 3 }]] },
  { id: 'photo', label: 'Photosynthesis', left: [['CO₂', { C: 1, O: 2 }], ['H₂O', { H: 2, O: 1 }]], right: [['C₆H₁₂O₆', { C: 6, H: 12, O: 6 }], ['O₂', { O: 2 }]] },
];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export function BalanceLab() {
  const [eq, setEq] = useState('water');
  const e = EQUATIONS.find((x) => x.id === eq)!;
  const [coef, setCoef] = useState<Record<string, number[]>>({});
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const cs = coef[eq] ?? Array(e.left.length + e.right.length).fill(1);
  const count = (side: Array<[string, Formula]>, off: number) => {
    const c: Record<string, number> = {};
    side.forEach(([, f], i) => Object.entries(f).forEach(([el, k]) => (c[el] = (c[el] ?? 0) + k * cs[off + i])));
    return c;
  };
  const L = count(e.left, 0);
  const R = count(e.right, e.left.length);
  const elements = Object.keys(L);
  const balanced = elements.every((el) => L[el] === R[el]) && cs.reduce(gcd) === 1;
  useEffect(() => {
    if (balanced && !solved[eq]) setSolved((s) => ({ ...s, [eq]: true }));
  }, [balanced, eq, solved]);
  const set = (i: number, d: number) => setCoef((c) => ({ ...c, [eq]: cs.map((v, j) => (j === i ? Math.max(1, Math.min(12, v + d)) : v)) }));
  const term = (name: string, i: number) => (
    <span className="lab-term" key={name + i}>
      <button type="button" onClick={() => set(i, -1)} aria-label={`Fewer ${name}`}>−</button>
      <strong>{cs[i] > 1 ? cs[i] : ''}{name}</strong>
      <button type="button" onClick={() => set(i, 1)} aria-label={`More ${name}`}>＋</button>
    </span>
  );
  return (
    <LabFrame
      title="Balance the equation"
      intro="Atoms aren't made or destroyed in a reaction — they're rearranged. Change the big numbers in front until each kind of atom is the same on both sides."
      goals={EQUATIONS.map((x) => ({ text: `Balance: ${x.label}`, done: Boolean(solved[x.id]) }))}
    >
      <Choice label="Reaction" value={eq} options={EQUATIONS.map((x) => ({ id: x.id, label: x.label }))} onChange={setEq} />
      <div className="lab-equation">
        {e.left.map(([n], i) => [i > 0 && <span key={`p${i}`}>+</span>, term(n, i)])}
        <span>→</span>
        {e.right.map(([n], i) => [i > 0 && <span key={`q${i}`}>+</span>, term(n, e.left.length + i)])}
      </div>
      <Readout items={elements.map((el) => [el, `${L[el]} left · ${R[el] ?? 0} right ${L[el] === R[el] ? '✅' : '❌'}`])} />
      {balanced && <p className="lab-win">⚖️ Balanced!</p>}
    </LabFrame>
  );
}

// ---------- 🍬 Dissolving: how much dissolves in 100 g of water ----------
const SOLUBILITY: Record<'sugar' | 'salt', Array<[number, number]>> = {
  // grams that dissolve in 100 g of water at each °C (real values, rounded)
  sugar: [[0, 179], [20, 204], [40, 238], [60, 287], [80, 362], [100, 487]],
  salt: [[0, 35.7], [20, 36], [40, 36.6], [60, 37.3], [80, 38.4], [100, 39.2]],
};
const solubility = (what: 'sugar' | 'salt', t: number) => {
  const tbl = SOLUBILITY[what];
  for (let i = 1; i < tbl.length; i++) if (t <= tbl[i][0]) {
    const [t0, s0] = tbl[i - 1];
    const [t1, s1] = tbl[i];
    return s0 + ((t - t0) / (t1 - t0)) * (s1 - s0);
  }
  return tbl[tbl.length - 1][1];
};
export function DissolveLab() {
  const [what, setWhat] = useState<'sugar' | 'salt'>('salt');
  const [grams, setGrams] = useState(20);
  const [temp, setTemp] = useState(20);
  const [log, setLog] = useState<Array<{ what: string; g: number; t: number; extra: number }>>([]);
  const max = solubility(what, temp);
  const dissolved = Math.min(grams, max);
  const extra = grams - dissolved;
  useEffect(() => setLog((l) => [...l, { what, g: grams, t: temp, extra }].slice(-80)), [what, grams, temp, extra]);
  return (
    <LabFrame
      title="How much will dissolve?"
      intro="Stir something into 100 g of water. It dissolves until the water is saturated (full) — then the rest sits on the bottom. Warm water can hold more of some things."
      goals={[
        { text: 'Add so much salt that some won’t dissolve', done: log.some((x) => x.what === 'salt' && x.extra > 0) },
        { text: 'Heat the water until that extra salt dissolves — can you?', done: log.some((x) => x.what === 'salt' && x.t >= 90) },
        { text: 'Dissolve more than 300 g of sugar in 100 g of water', done: log.some((x) => x.what === 'sugar' && x.g > 300 && x.extra === 0) },
      ]}
    >
      <svg viewBox="0 0 300 150" className="lab-svg" role="img" aria-label="A glass of water">
        <rect x="100" y="20" width="100" height="120" rx="6" fill={`hsl(${210 - temp} 70% ${85 - Math.min(30, dissolved / 10)}%)`} stroke="currentColor" />
        {extra > 0 && <rect x="102" y={138 - Math.min(40, extra / 4)} width="96" height={Math.min(40, extra / 4)} fill="#eeeeee" stroke="#bdbdbd" />}
        <text x="150" y="15" textAnchor="middle" fontSize="11">{temp}°C</text>
      </svg>
      <Choice label="Stir in" value={what} options={[{ id: 'salt', label: '🧂 Salt' }, { id: 'sugar', label: '🍬 Sugar' }]} onChange={setWhat} />
      <Slider label="How much" value={grams} onChange={setGrams} min={0} max={500} step={5} unit=" g" />
      <Slider label="Water temperature" value={temp} onChange={setTemp} min={0} max={100} step={5} unit="°C" />
      <Readout items={[['Most that can dissolve', `${round(max)} g`], ['Dissolved', `${round(dissolved)} g`], ['On the bottom', `${round(extra)} g`]]} />
    </LabFrame>
  );
}

// ---------- 🎈 Gas in a cylinder: PV = nRT ----------
export function GasLab() {
  const [vol, setVol] = useState(2);
  const [temp, setTemp] = useState(300);
  const [log, setLog] = useState<Array<{ v: number; t: number; p: number }>>([]);
  const n = 0.1;
  const Rg = 8.314;
  const p = (n * Rg * temp) / (vol / 1000) / 1000; // kPa
  useEffect(() => setLog((l) => [...l, { v: vol, t: temp, p }].slice(-80)), [vol, temp, p]);
  const parts = useMemo(() => Array.from({ length: 24 }, () => ({ x: Math.random(), y: Math.random(), a: Math.random() * 6.28 })), []);
  const [, force] = useState(0);
  useAnimation(true, (dt) => {
    const sp = Math.sqrt(temp) * 0.02 * dt * 6;
    for (const q of parts) {
      q.x += Math.cos(q.a) * sp;
      q.y += Math.sin(q.a) * sp;
      if (q.x < 0 || q.x > 1) { q.a = Math.PI - q.a; q.x = Math.max(0, Math.min(1, q.x)); }
      if (q.y < 0 || q.y > 1) { q.a = -q.a; q.y = Math.max(0, Math.min(1, q.y)); }
    }
    force((k) => k + 1);
  });
  const w = 50 + vol * 55;
  const has = (f: (a: (typeof log)[0], b: (typeof log)[0]) => boolean) => log.some((a) => log.some((b) => f(a, b)));
  return (
    <LabFrame
      title="Squeeze and heat a gas"
      intro="Gas particles bounce off the walls — that push is pressure. Squeeze them into less space, or heat them so they move faster, and the pressure goes up."
      goals={[
        { text: 'Halve the volume at the same temperature — what happens to the pressure?', done: has((a, b) => a.t === b.t && Math.abs(b.v * 2 - a.v) < 1e-9) },
        { text: 'Raise the pressure by heating, without changing the volume', done: has((a, b) => a.v === b.v && b.t > a.t) },
        { text: 'Get the pressure above 400 kPa', done: log.some((x) => x.p > 400) },
      ]}
    >
      <svg viewBox="0 0 300 120" className="lab-svg" role="img" aria-label="Gas in a cylinder with a piston">
        <rect x="10" y="10" width={w} height="100" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x={10 + w} y="5" width="8" height="110" fill="#8d6e63" />
        {parts.map((q, i) => (
          <circle key={i} cx={16 + q.x * (w - 12)} cy={16 + q.y * 88} r="4" fill={`hsl(${240 - (temp - 200) * 0.5} 80% 55%)`} />
        ))}
      </svg>
      <Slider label="Volume (push the piston)" value={vol} onChange={setVol} min={0.5} max={4} step={0.5} unit=" L" />
      <Slider label="Temperature" value={temp} onChange={setTemp} min={200} max={600} step={25} unit=" K" format={(v) => `${v} K (${v - 273}°C)`} />
      <Readout items={[['Pressure', `${round(p)} kPa`]]} />
    </LabFrame>
  );
}

// ---------- 🔥 Flame tests: metals glow their own colors ----------
const FLAMES = [
  { id: 'none', label: 'Nothing', color: '#ff9800', name: 'plain orange-blue' },
  { id: 'li', label: 'Lithium', color: '#e53935', name: 'crimson red' },
  { id: 'na', label: 'Sodium', color: '#fdd835', name: 'bright yellow' },
  { id: 'k', label: 'Potassium', color: '#b39ddb', name: 'lilac' },
  { id: 'cu', label: 'Copper', color: '#26a69a', name: 'blue-green' },
  { id: 'ca', label: 'Calcium', color: '#ff7043', name: 'orange-red' },
  { id: 'sr', label: 'Strontium', color: '#c62828', name: 'deep red' },
] as const;
export function FlameLab() {
  const [metal, setMetal] = useState<(typeof FLAMES)[number]['id']>('none');
  const [tried, setTried] = useState<string[]>([]);
  useEffect(() => setTried((t) => (t.includes(metal) ? t : [...t, metal])), [metal]);
  const f = FLAMES.find((x) => x.id === metal)!;
  return (
    <LabFrame
      title="Flame test"
      intro="When some metals get hot, their electrons jump up and fall back, giving off light of one special color. Fireworks use this!"
      goals={[
        { text: 'Test 4 different metals', done: tried.filter((t) => t !== 'none').length >= 4 },
        { text: 'Find the metal that makes a yellow flame', done: tried.includes('na') },
        { text: 'Find the metal that makes a green flame', done: tried.includes('cu') },
      ]}
    >
      <svg viewBox="0 0 300 160" className="lab-svg" role="img" aria-label={`A ${f.name} flame`}>
        <path d="M150 20 C 185 70, 190 110, 150 140 C 110 110, 115 70, 150 20 Z" fill={f.color} opacity="0.85" />
        <path d="M150 70 C 165 95, 165 120, 150 135 C 135 120, 135 95, 150 70 Z" fill="#90caf9" opacity="0.7" />
        <rect x="135" y="140" width="30" height="15" fill="#9e9e9e" />
      </svg>
      <Choice label="Put in the flame" value={metal} options={FLAMES.map((x) => ({ id: x.id, label: x.label }))} onChange={setMetal} />
      <Readout items={[['Flame color', f.name]]} />
    </LabFrame>
  );
}
