import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Choice, LabFrame, Readout, Slider, round } from './common.js';

/** 🧬 Biology labs. */

// ---------- 🌱 Grow a plant: light and water ----------
export function PlantLab() {
  const [light, setLight] = useState(8);
  const [water, setWater] = useState(2);
  const [days, setDays] = useState(10);
  const [log, setLog] = useState<Array<{ light: number; water: number; days: number; h: number }>>([]);
  const lightF = light < 2 ? 0 : Math.min(1, light / 10);
  const waterF = water === 0 ? 0 : water <= 3 ? 1 : water === 4 ? 0.5 : 0.2;
  const h = 2 + days * 2 * lightF * waterF;
  const health = water === 0 ? '🥀 Wilting — no water' : light < 2 ? '🥀 Pale and weak — no light' : water >= 4 ? '🟤 Roots too soggy' : lightF * waterF >= 0.8 ? '🌿 Healthy' : '🙂 Growing slowly';
  useEffect(() => setLog((l) => [...l, { light, water, days, h }].slice(-80)), [light, water, days, h]);
  const stem = Math.min(140, h * 3.5);
  return (
    <LabFrame
      title="Grow a bean plant"
      intro="Plants make their own food from light, water and air (photosynthesis). Change the light and water and see how tall it grows."
      goals={[
        { text: 'Grow the plant taller than 30 cm in 20 days or less', done: log.some((x) => x.h > 30 && x.days <= 20) },
        { text: 'What happens with no light?', done: log.some((x) => x.light < 2 && x.days >= 5) },
        { text: 'Try too much water', done: log.some((x) => x.water >= 4 && x.days >= 5) },
      ]}
    >
      <svg viewBox="0 0 300 180" className="lab-svg" role="img" aria-label="A plant in a pot">
        <text x="20" y="30" fontSize="24" opacity={Math.max(0.15, light / 16)}>☀️</text>
        <line x1="150" y1="150" x2="150" y2={150 - stem} stroke={light < 2 ? '#c5e1a5' : '#43a047'} strokeWidth="4" />
        {Array.from({ length: Math.floor(stem / 25) }, (_, i) => (
          <ellipse key={i} cx={150 + (i % 2 ? 12 : -12)} cy={140 - i * 25} rx="11" ry="5" fill={water === 0 ? '#a1887f' : light < 2 ? '#dce775' : '#66bb6a'} />
        ))}
        <polygon points="120,150 180,150 172,178 128,178" fill="#8d6e63" />
      </svg>
      <Slider label="☀️ Light each day" value={light} onChange={setLight} min={0} max={16} unit=" hours" />
      <Slider label="💧 Water each day" value={water} onChange={setWater} min={0} max={5} unit=" cups" />
      <Slider label="📅 Days of growing" value={days} onChange={setDays} min={0} max={30} />
      <Readout items={[['Height', `${round(h)} cm`], ['How it looks', health]]} />
    </LabFrame>
  );
}

// ---------- 🧬 Punnett squares ----------
const TRAITS = [
  { id: 'pea', label: '🟢 Pea color', big: 'Y', small: 'y', dom: 'yellow', rec: 'green' },
  { id: 'flower', label: '🌸 Flower color', big: 'P', small: 'p', dom: 'purple', rec: 'white' },
  { id: 'fur', label: '🐹 Hamster fur', big: 'B', small: 'b', dom: 'black', rec: 'brown' },
] as const;
type Geno = 'AA' | 'Aa' | 'aa';
export function PunnettLab() {
  const [trait, setTrait] = useState<(typeof TRAITS)[number]['id']>('pea');
  const [mom, setMom] = useState<Geno>('AA');
  const [dad, setDad] = useState<Geno>('aa');
  const [seen, setSeen] = useState<string[]>([]);
  const t = TRAITS.find((x) => x.id === trait)!;
  const letters = (g: Geno) => g.split('').map((c) => (c === 'A' ? t.big : t.small));
  const show = (g: Geno) => letters(g).join('');
  const kids = letters(mom).flatMap((a) => letters(dad).map((b) => [a, b].sort((x, y) => (x === t.big ? -1 : y === t.big ? 1 : 0)).join('')));
  const domN = kids.filter((k) => k.includes(t.big)).length;
  const ratio = `${domN}:${4 - domN}`;
  useEffect(() => setSeen((s) => (s.includes(ratio) ? s : [...s, ratio])), [ratio]);
  const genos: Geno[] = ['AA', 'Aa', 'aa'];
  return (
    <LabFrame
      title="Punnett square"
      intro="Each parent passes one of their two genes to each child. A capital letter is dominant — it shows up even if there's only one."
      goals={[
        { text: 'Get a 3 : 1 ratio (3 dominant to 1 recessive)', done: seen.includes('3:1') },
        { text: 'Get a 1 : 1 ratio', done: seen.includes('2:2') },
        { text: 'Make every child show the recessive trait', done: seen.includes('0:4') },
      ]}
    >
      <Choice label="Trait" value={trait} options={TRAITS.map((x) => ({ id: x.id, label: x.label }))} onChange={setTrait} />
      <Choice label="Parent 1" value={mom} options={genos.map((g) => ({ id: g, label: show(g) }))} onChange={setMom} />
      <Choice label="Parent 2" value={dad} options={genos.map((g) => ({ id: g, label: show(g) }))} onChange={setDad} />
      <table className="lab-punnett">
        <tbody>
          <tr>
            <th />
            {letters(dad).map((b, i) => <th key={i}>{b}</th>)}
          </tr>
          {letters(mom).map((a, i) => (
            <tr key={i}>
              <th>{a}</th>
              {kids.slice(i * 2, i * 2 + 2).map((k, j) => (
                <td key={j} className={k.includes(t.big) ? 'is-dom' : 'is-rec'}>{k}<br /><small>{k.includes(t.big) ? t.dom : t.rec}</small></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Readout items={[[`Show ${t.dom}`, `${domN} of 4 (${domN * 25}%)`], [`Show ${t.rec}`, `${4 - domN} of 4 (${(4 - domN) * 25}%)`]]} />
    </LabFrame>
  );
}

// ---------- 🔬 Parts of a cell ----------
const PARTS: Record<string, { name: string; job: string; plantOnly?: boolean }> = {
  membrane: { name: 'Cell membrane', job: 'a thin skin that controls what goes in and out' },
  wall: { name: 'Cell wall', job: 'a stiff outer layer that holds a plant cell’s shape', plantOnly: true },
  nucleus: { name: 'Nucleus', job: 'the control center — it holds the DNA' },
  mito: { name: 'Mitochondrion', job: 'the powerhouse — it turns food into energy' },
  chloro: { name: 'Chloroplast', job: 'where photosynthesis happens (it’s green from chlorophyll)', plantOnly: true },
  vacuole: { name: 'Vacuole', job: 'stores water; in plants one big one keeps the cell firm' },
  cyto: { name: 'Cytoplasm', job: 'the jelly that fills the cell, where the parts float' },
};
export function CellLab() {
  const [kind, setKind] = useState<'plant' | 'animal'>('plant');
  const [picked, setPicked] = useState<string | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const pick = (id: string) => {
    setPicked(id);
    setFound((f) => (f.includes(id) ? f : [...f, id]));
  };
  const plant = kind === 'plant';
  const hit = (id: string) => ({ onClick: () => pick(id), style: { cursor: 'pointer' }, role: 'button', 'aria-label': PARTS[id].name, tabIndex: 0, onKeyDown: (e: KeyboardEvent) => e.key === 'Enter' && pick(id) });
  return (
    <LabFrame
      title="Explore a cell"
      intro="Tap each part of the cell to find out what it does. Plant and animal cells share most parts, but plant cells have a few extras."
      goals={[
        { text: 'Find the nucleus', done: found.includes('nucleus') },
        { text: 'Find the powerhouse of the cell', done: found.includes('mito') },
        { text: 'Find the two parts only plant cells have', done: found.includes('wall') && found.includes('chloro') },
        { text: 'Tap all 7 parts', done: Object.keys(PARTS).every((p) => found.includes(p)) },
      ]}
    >
      <Choice label="Cell" value={kind} options={[{ id: 'plant', label: '🌿 Plant cell' }, { id: 'animal', label: '🐾 Animal cell' }]} onChange={(v) => { setKind(v); setPicked(null); }} />
      <svg viewBox="0 0 300 200" className="lab-svg" role="img" aria-label={`A ${kind} cell`}>
        {plant ? (
          <>
            <rect x="12" y="8" width="276" height="184" rx="6" fill="#9ccc65" stroke="#558b2f" strokeWidth="4" {...hit('wall')} />
            <rect x="30" y="25" width="240" height="150" rx="4" fill="#f1f8e9" {...hit('cyto')} />
            <rect x="30" y="25" width="240" height="150" rx="4" fill="none" stroke="#33691e" strokeWidth="6" {...hit('membrane')} />
            <rect x="120" y="45" width="130" height="80" rx="20" fill="#b3e5fc" {...hit('vacuole')} />
            {[[60, 60], [70, 140], [200, 150]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="16" ry="8" fill="#43a047" {...hit('chloro')} />)}
          </>
        ) : (
          <>
            <ellipse cx="150" cy="100" rx="135" ry="88" fill="#ffe0b2" {...hit('cyto')} />
            <ellipse cx="150" cy="100" rx="135" ry="88" fill="none" stroke="#e65100" strokeWidth="3" {...hit('membrane')} />
            <circle cx="215" cy="70" r="14" fill="#b3e5fc" {...hit('vacuole')} />
          </>
        )}
        <circle cx={plant ? 85 : 140} cy="100" r="24" fill="#9575cd" {...hit('nucleus')} />
        {[[plant ? 210 : 90, plant ? 140 : 150], [plant ? 100 : 210, plant ? 40 : 130]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx="15" ry="7" fill="#ef6c00" {...hit('mito')} />
        ))}
      </svg>
      {picked && (
        <p className="lab-win">
          <strong>{PARTS[picked].name}</strong>: {PARTS[picked].job}
          {PARTS[picked].plantOnly ? ' 🌿 (plant cells only)' : ''}
        </p>
      )}
    </LabFrame>
  );
}

// ---------- 🐇🦊 Predators and prey ----------
function simulate(r0: number, f0: number, steps = 120) {
  // a simple predator–prey model (Lotka–Volterra), one step = one month
  const out: Array<[number, number]> = [];
  let r = r0;
  let f = f0;
  for (let i = 0; i < steps; i++) {
    out.push([r, f]);
    const nr = r + 0.1 * r * (1 - r / 2000) - 0.002 * r * f;
    const nf = f + 0.0005 * r * f - 0.08 * f;
    r = Math.max(0, nr);
    f = Math.max(0, nf < 0.5 ? 0 : nf);
  }
  return out;
}
export function PredatorLab() {
  const [rabbits, setRabbits] = useState(400);
  const [foxes, setFoxes] = useState(20);
  const [ran, setRan] = useState<Array<{ r: number; f: number; foxesEnd: number; rabbitsEnd: number }>>([]);
  const data = useMemo(() => simulate(rabbits, foxes), [rabbits, foxes]);
  useEffect(() => {
    const [re, fe] = data[data.length - 1];
    setRan((x) => [...x, { r: rabbits, f: foxes, foxesEnd: fe, rabbitsEnd: re }].slice(-60));
  }, [data, rabbits, foxes]);
  const maxR = Math.max(...data.map((d) => d[0]), 1);
  const maxF = Math.max(...data.map((d) => d[1]), 1);
  const line = (k: 0 | 1, max: number) => data.map((d, i) => `${i === 0 ? 'M' : 'L'}${20 + (i / (data.length - 1)) * 270},${170 - (d[k] / max) * 150}`).join(' ');
  return (
    <LabFrame
      title="Foxes and rabbits"
      intro="Foxes eat rabbits. More rabbits → more food → more foxes. More foxes → fewer rabbits → foxes go hungry. Watch the numbers rise and fall over 10 years."
      goals={[
        { text: 'Start with no foxes — what do the rabbits do?', done: ran.some((x) => x.f === 0) },
        { text: 'Find a start where the foxes die out', done: ran.some((x) => x.f > 0 && x.foxesEnd === 0) },
        { text: 'Start with lots of foxes (over 80)', done: ran.some((x) => x.f > 80) },
      ]}
    >
      <svg viewBox="0 0 300 190" className="lab-svg" role="img" aria-label="Rabbit and fox numbers over time">
        <line x1="20" y1="170" x2="290" y2="170" stroke="currentColor" strokeOpacity="0.4" />
        <path d={line(0, maxR)} fill="none" stroke="#8d6e63" strokeWidth="2" />
        <path d={line(1, maxF)} fill="none" stroke="#ef6c00" strokeWidth="2" strokeDasharray="5 3" />
        <text x="22" y="185" fontSize="10">month 0</text>
        <text x="288" y="185" fontSize="10" textAnchor="end">10 years</text>
      </svg>
      <p className="lab-legend">
        <span className="lab-key" style={{ background: '#8d6e63' }} /> 🐇 Rabbits (most {Math.round(maxR)}) · <span className="lab-key is-dashed" style={{ borderColor: '#ef6c00' }} /> 🦊 Foxes (most {Math.round(maxF)})
      </p>
      <Slider label="🐇 Rabbits at the start" value={rabbits} onChange={setRabbits} min={0} max={1500} step={50} />
      <Slider label="🦊 Foxes at the start" value={foxes} onChange={setFoxes} min={0} max={150} step={5} />
      <Readout items={[['🐇 After 10 years', Math.round(data[data.length - 1][0])], ['🦊 After 10 years', Math.round(data[data.length - 1][1])]]} />
    </LabFrame>
  );
}

// ---------- 🦋 Natural selection: be the bird ----------
interface Moth {
  id: number;
  x: number;
  y: number;
  dark: boolean;
}
const newMoths = (darkShare: number, n = 20, start = 0): Moth[] =>
  Array.from({ length: n }, (_, i) => ({ id: start + i, x: 15 + Math.random() * 270, y: 15 + Math.random() * 150, dark: Math.random() < darkShare }));
export function MothLab() {
  const [bark, setBark] = useState<'light' | 'dark'>('dark');
  const [moths, setMoths] = useState<Moth[]>(() => newMoths(0.5));
  const [eaten, setEaten] = useState(0);
  const [gens, setGens] = useState<Array<{ bark: string; dark: number }>>([{ bark: 'dark', dark: 50 }]);
  const next = useRef(1000);
  const darkPct = Math.round((moths.filter((m) => m.dark).length / Math.max(1, moths.length)) * 100);
  const eat = (id: number) => {
    if (eaten >= 10) return;
    setMoths((ms) => ms.filter((m) => m.id !== id));
    setEaten((e) => e + 1);
  };
  const nextGen = () => {
    const share = moths.length ? moths.filter((m) => m.dark).length / moths.length : 0.5;
    const s = Math.min(0.97, Math.max(0.03, share)); // a few of the other color are always born
    next.current += 20;
    const born = newMoths(s, 20, next.current);
    setMoths(born);
    setEaten(0);
    setGens((g) => [...g, { bark, dark: Math.round((born.filter((m) => m.dark).length / 20) * 100) }]);
  };
  const lastGens = gens.slice(-8);
  return (
    <LabFrame
      title="Be the bird (natural selection)"
      intro="You're a hungry bird. Tap 10 moths to eat them — you'll catch the ones that are easy to see. The moths you miss have the babies. Then make the next generation."
      goals={[
        { text: 'On dark bark, make dark moths 80% or more', done: gens.some((g) => g.bark === 'dark' && g.dark >= 80) },
        { text: 'Switch to light bark and make light moths 80% or more', done: gens.some((g) => g.bark === 'light' && g.dark <= 20) },
      ]}
    >
      <svg viewBox="0 0 300 180" className="lab-svg" role="img" aria-label="Moths on tree bark">
        <rect x="0" y="0" width="300" height="180" fill={bark === 'dark' ? '#3e2723' : '#d7ccc8'} />
        {Array.from({ length: 14 }, (_, i) => (
          <line key={i} x1={i * 23} y1="0" x2={i * 23 + 8} y2="180" stroke={bark === 'dark' ? '#4e342e' : '#bcaaa4'} strokeWidth="5" />
        ))}
        {moths.map((m) => (
          <g key={m.id} onClick={() => eat(m.id)} style={{ cursor: 'pointer' }} role="button" aria-label={`${m.dark ? 'dark' : 'light'} moth`}>
            <ellipse cx={m.x - 6} cy={m.y} rx="8" ry="5" fill={m.dark ? '#4e342e' : '#d7ccc8'} />
            <ellipse cx={m.x + 6} cy={m.y} rx="8" ry="5" fill={m.dark ? '#4e342e' : '#d7ccc8'} />
            <circle cx={m.x} cy={m.y} r="14" fill="transparent" />
          </g>
        ))}
      </svg>
      <Choice label="Tree bark" value={bark} options={[{ id: 'dark', label: '🟫 Dark (sooty)' }, { id: 'light', label: '⬜ Light' }]} onChange={setBark} />
      <p>🐦 Eaten: {eaten} of 10 {eaten >= 10 && '— full!'}</p>
      <button type="button" className="primary" disabled={eaten < 10} onClick={nextGen}>🥚 Next generation</button>
      <Readout items={[['Dark moths now', `${darkPct}%`], ['Generations', lastGens.map((g) => `${g.dark}%`).join(' → ')]]} />
    </LabFrame>
  );
}

// ---------- ⚡ Reaction time ----------
export function ReactionLab() {
  const [phase, setPhase] = useState<'idle' | 'wait' | 'go' | 'early'>('idle');
  const [times, setTimes] = useState<number[]>([]);
  const start = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const tap = () => {
    if (phase === 'idle' || phase === 'early') {
      setPhase('wait');
      timer.current = setTimeout(() => {
        start.current = performance.now();
        setPhase('go');
      }, 1200 + Math.random() * 2500);
    } else if (phase === 'wait') {
      clearTimeout(timer.current);
      setPhase('early');
    } else {
      setTimes((t) => [...t, Math.round(performance.now() - start.current)]);
      setPhase('idle');
    }
  };
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  return (
    <LabFrame
      title="How fast are your nerves?"
      intro="Your eyes see the color change, a signal races along nerves to your brain, and your brain tells your finger to tap. That takes time!"
      goals={[
        { text: 'Test your reaction 3 times', done: times.length >= 3 },
        { text: 'React in under 300 milliseconds', done: times.some((t) => t < 300) },
      ]}
    >
      <button type="button" className={`lab-react is-${phase}`} onClick={tap}>
        {phase === 'idle' ? '👆 Tap to start' : phase === 'wait' ? '⏳ Wait for green…' : phase === 'go' ? '🟢 TAP NOW!' : '😅 Too soon! Tap to try again'}
      </button>
      <Readout items={[['Last', times.length ? `${times[times.length - 1]} ms` : '—'], ['Average', avg ? `${avg} ms` : '—'], ['Tries', times.length]]} />
      <p className="hint">1,000 milliseconds = 1 second. Most people react in about 200–300 ms.</p>
    </LabFrame>
  );
}

// ---------- ❤️ Measure your pulse ----------
export function PulseLab() {
  const [left, setLeft] = useState<number | null>(null);
  const [count, setCount] = useState(18);
  const [when, setWhen] = useState<'rest' | 'after'>('rest');
  const [saved, setSaved] = useState<Partial<Record<'rest' | 'after', number>>>({});
  useEffect(() => {
    if (left === null || left <= 0) return;
    const t = setTimeout(() => setLeft((l) => (l === null ? l : l - 1)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <LabFrame
      title="Measure your heart rate"
      intro="Put two fingers on the side of your neck or the inside of your wrist until you feel a beat. Start the timer and count the beats for 15 seconds. Beats × 4 = beats per minute."
      goals={[
        { text: 'Measure your resting heart rate', done: saved.rest !== undefined },
        { text: 'Do 30 jumping jacks, then measure again', done: saved.after !== undefined },
        { text: 'Compare: did exercise make your heart beat faster?', done: saved.rest !== undefined && saved.after !== undefined },
      ]}
    >
      <Choice label="When" value={when} options={[{ id: 'rest', label: '🛋️ Resting' }, { id: 'after', label: '🤸 After exercise' }]} onChange={setWhen} />
      <button type="button" className="primary" onClick={() => setLeft(15)} disabled={left !== null && left > 0}>
        {left === null ? '⏱️ Start 15 seconds' : left > 0 ? `Counting… ${left}` : '⏱️ Again'}
      </button>
      {left === 0 && <p className="lab-win">⏰ Stop counting!</p>}
      <Slider label="Beats I counted" value={count} onChange={setCount} min={5} max={50} />
      <button type="button" onClick={() => setSaved((s) => ({ ...s, [when]: count * 4 }))}>💾 Save: {count * 4} beats per minute</button>
      <Readout items={[['Resting', saved.rest ? `${saved.rest} bpm` : '—'], ['After exercise', saved.after ? `${saved.after} bpm` : '—']]} />
    </LabFrame>
  );
}
