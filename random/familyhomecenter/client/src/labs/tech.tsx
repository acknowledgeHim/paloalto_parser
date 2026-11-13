import { useState } from 'react';
import { Choice, LabFrame, Readout, Slider, round, useAnimation } from './common.js';

/** 💻 Tech & robots labs (used by the 🔧 Hands-on lessons): binary, LED resistors, logic gates, subnets, PWM and a robot to program. */

// ---------- 🔢 Binary: flip 8 bits ----------
const PLACES = [128, 64, 32, 16, 8, 4, 2, 1];
export function BinaryLab() {
  const [bits, setBits] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const value = bits.reduce((sum, b, i) => sum + b * PLACES[i], 0);
  const hex = value.toString(16).toUpperCase().padStart(2, '0');
  const ch = value >= 33 && value <= 126 ? String.fromCharCode(value) : value === 32 ? '(space)' : '—';
  return (
    <LabFrame
      title="Binary switches"
      intro="Each switch is one bit: on = 1, off = 0. Add up the place values of the switches that are on."
      goals={[
        { text: 'Make 5', done: value === 5 },
        { text: 'Make 100', done: value === 100 },
        { text: 'Make the biggest number 8 bits can hold', done: value === 255 },
        { text: 'Make the letter A (ASCII 65)', done: value === 65 },
        { text: 'Make hex 2A', done: value === 0x2a },
      ]}
    >
      <div className="tech-bits">
        {bits.map((b, i) => (
          <button
            key={i}
            type="button"
            className={b ? 'is-on' : ''}
            aria-pressed={Boolean(b)}
            aria-label={`Bit worth ${PLACES[i]}`}
            onClick={() => setBits((bs) => bs.map((x, k) => (k === i ? 1 - x : x)))}
          >
            <span className="tech-bits__place">{PLACES[i]}</span>
            <span className="tech-bits__bit">{b}</span>
          </button>
        ))}
      </div>
      <div className="lab-buttons">
        <button type="button" onClick={() => setBits([0, 0, 0, 0, 0, 0, 0, 0])}>
          All off
        </button>
      </div>
      <Readout
        items={[
          ['Binary', bits.join('')],
          ['Number', value],
          ['Hex', hex],
          ['ASCII letter', ch],
        ]}
      />
    </LabFrame>
  );
}

// ---------- 💡 LED + resistor: R = (Vs − Vf) ÷ I ----------
const LEDS = [
  { id: 'red', label: '🔴 Red', name: 'red', vf: 2.0, color: '#ff3b30' },
  { id: 'green', label: '🟢 Green', name: 'green', vf: 2.2, color: '#34c759' },
  { id: 'blue', label: '🔵 Blue', name: 'blue', vf: 3.0, color: '#3a7bff' },
  { id: 'white', label: '⚪ White', name: 'white', vf: 3.0, color: '#f4f4f4' },
] as const;
type LedId = (typeof LEDS)[number]['id'];
const SUPPLIES = [
  { id: '3.3', label: '3.3 V', v: 3.3 },
  { id: '5', label: '5 V (USB)', v: 5 },
  { id: '9', label: '9 V battery', v: 9 },
] as const;
type SupplyId = (typeof SUPPLIES)[number]['id'];
const RESISTORS = [10, 22, 47, 68, 100, 150, 220, 330, 470, 680, 1000, 2200, 4700, 10000];
const BAND = ['#000', '#8b4513', '#e00', '#ff8c00', '#ffd700', '#2e8b57', '#1e60ff', '#8a2be2', '#888', '#fff'];
function bands(ohms: number) {
  const digits = String(ohms);
  return [Number(digits[0]), Number(digits[1] ?? 0), digits.length - 2];
}
const showOhms = (r: number) => (r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);
export function OhmLab() {
  const [led, setLed] = useState<LedId>('red');
  const [supply, setSupply] = useState<SupplyId>('5');
  const [ri, setRi] = useState(6);
  const [burned, setBurned] = useState<Record<string, boolean>>({});
  const L = LEDS.find((l) => l.id === led)!;
  const vs = SUPPLIES.find((s) => s.id === supply)!.v;
  const r = RESISTORS[ri];
  const amps = vs > L.vf ? (vs - L.vf) / r : 0;
  const ma = amps * 1000;
  const key = `${led}-${supply}-${r}`;
  const isBurnt = ma > 30;
  if (isBurnt && !burned[key]) setBurned((b) => ({ ...b, [key]: true }));
  const glow = isBurnt ? 0 : Math.min(1, ma / 20);
  const best = vs > L.vf ? ((vs - L.vf) / 0.015).toFixed(0) : '—';
  const [b1, b2, b3] = bands(r);
  return (
    <LabFrame
      title="Pick the LED's resistor"
      intro="An LED needs a resistor to limit the current. Most small LEDs like 10–20 mA. Over about 30 mA, it burns out (this lab gives you a new one each time!)."
      goals={[
        { text: 'Light the red LED safely from 5 V (10–20 mA)', done: led === 'red' && vs === 5 && ma >= 10 && ma <= 20 },
        { text: 'Burn out an LED with too small a resistor', done: Object.keys(burned).length > 0 },
        { text: 'Light a blue LED safely from 9 V', done: led === 'blue' && vs === 9 && ma >= 10 && ma <= 20 },
        { text: 'Find a combo that is too weak to light at all (under 1 mA)', done: ma < 1 },
      ]}
    >
      <svg viewBox="0 0 300 150" className="lab-svg" role="img" aria-label="A battery, resistor and LED in a loop">
        <rect x="20" y="20" width="260" height="110" rx="8" fill="none" stroke="currentColor" strokeWidth="3" />
        <rect x="8" y="55" width="24" height="40" fill="var(--panel)" stroke="currentColor" strokeWidth="2" />
        <text x="20" y="80" fontSize="12" textAnchor="middle" fill="currentColor">{vs}V</text>
        <rect x="110" y="12" width="70" height="16" rx="6" fill="#d8c19a" stroke="currentColor" strokeWidth="1.5" />
        <rect x="122" y="12" width="7" height="16" fill={BAND[b1]} />
        <rect x="136" y="12" width="7" height="16" fill={BAND[b2]} />
        <rect x="150" y="12" width="7" height="16" fill={BAND[b3] ?? '#000'} />
        <rect x="166" y="12" width="5" height="16" fill="#c9a227" />
        <circle cx="200" cy="130" r="26" fill={L.color} opacity={0.15 + glow * 0.6} />
        <circle cx="200" cy="130" r="12" fill={isBurnt ? '#444' : L.color} stroke="currentColor" strokeWidth="1.5" opacity={isBurnt ? 1 : 0.4 + glow * 0.6} />
        {isBurnt && (
          <text x="200" y="104" fontSize="16" textAnchor="middle">
            💥
          </text>
        )}
      </svg>
      <Choice label="LED" value={led} options={LEDS.map((l) => ({ id: l.id, label: l.label }))} onChange={setLed} />
      <Choice label="Power" value={supply} options={SUPPLIES.map((s) => ({ id: s.id, label: s.label }))} onChange={setSupply} />
      <Slider label="Resistor" value={ri} onChange={setRi} min={0} max={RESISTORS.length - 1} format={(i) => showOhms(RESISTORS[i])} />
      <Readout
        items={[
          ['Current', `${round(ma, 1)} mA`],
          ['LED', isBurnt ? '💥 burned out!' : ma < 1 ? 'off' : ma < 5 ? 'dim' : ma <= 20 ? '✅ just right' : '⚠️ too bright — too much current'],
          ['Volts on the resistor', `${round(Math.max(0, vs - L.vf), 1)} V`],
          ['Ideal for 15 mA', best === '—' ? 'too little voltage' : `${best} Ω`],
        ]}
      />
      <p className="hint">
        Current = (supply volts − LED volts) ÷ ohms. This {L.name} LED uses about {L.vf} V.
      </p>
    </LabFrame>
  );
}

// ---------- 🔣 Logic gates ----------
type Gate = 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR';
const GATES: Gate[] = ['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR'];
function gate(g: Gate, a: number, b: number) {
  switch (g) {
    case 'AND':
      return a & b;
    case 'OR':
      return a | b;
    case 'NOT':
      return 1 - a;
    case 'XOR':
      return a ^ b;
    case 'NAND':
      return 1 - (a & b);
    case 'NOR':
      return 1 - (a | b);
  }
}
export function GatesLab() {
  const [g, setG] = useState<Gate>('AND');
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const out = gate(g, a, b);
  const mark = `${g}${a}${b}${out}`;
  if (!seen[mark]) setSeen((s) => ({ ...s, [mark]: true }));
  const rows = g === 'NOT' ? [[0, 0], [1, 0]] : [[0, 0], [0, 1], [1, 0], [1, 1]];
  return (
    <LabFrame
      title="Logic gates"
      intro="Flip the inputs A and B and watch the output light. The table shows every possible input."
      goals={[
        { text: 'Light the AND gate', done: Boolean(seen.AND111) },
        { text: 'Find the only way an OR gate stays dark', done: Boolean(seen.OR000) },
        { text: 'Make NOT light up', done: Boolean(seen.NOT001 || seen.NOT011) },
        { text: 'Light XOR with A on', done: Boolean(seen.XOR101) },
        { text: 'Make NAND go dark', done: Boolean(seen.NAND110) },
      ]}
    >
      <Choice label="Gate" value={g} options={GATES.map((x) => ({ id: x, label: x }))} onChange={setG} />
      <div className="tech-gate">
        <div className="lab-buttons tech-gate__inputs">
          <button type="button" className={a ? 'is-on' : 'is-faded'} aria-pressed={Boolean(a)} onClick={() => setA(1 - a)}>
            A = {a}
          </button>
          {g !== 'NOT' && (
            <button type="button" className={b ? 'is-on' : 'is-faded'} aria-pressed={Boolean(b)} onClick={() => setB(1 - b)}>
              B = {b}
            </button>
          )}
        </div>
        <div className="tech-gate__box">{g}</div>
        <div className={`tech-gate__lamp${out ? ' is-on' : ''}`} aria-label={`Output ${out}`}>
          {out ? '💡' : '⚫'} {out}
        </div>
      </div>
      <table className="tech-table">
        <thead>
          <tr>
            <th>A</th>
            {g !== 'NOT' && <th>B</th>}
            <th>Out</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([x, y]) => (
            <tr key={`${x}${y}`} className={x === a && (g === 'NOT' || y === b) ? 'is-now' : ''}>
              <td>{x}</td>
              {g !== 'NOT' && <td>{y}</td>}
              <td>{gate(g, x, y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">XOR + AND together add two bits: XOR gives the sum, AND gives the carry.</p>
    </LabFrame>
  );
}

// ---------- 🌐 Subnets: same network, or through the router? ----------
const A_IP = [192, 168, 1, 10];
const toInt = (ip: number[]) => ((ip[0] << 24) | (ip[1] << 16) | (ip[2] << 8) | ip[3]) >>> 0;
const toIp = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
export function SubnetLab() {
  const [prefix, setPrefix] = useState(24);
  const [b3, setB3] = useState(1);
  const [b4, setB4] = useState(80);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const aNet = (toInt(A_IP) & mask) >>> 0;
  const bIp = [192, 168, b3, b4];
  const bNet = (toInt(bIp) & mask) >>> 0;
  const broadcast = (aNet | (~mask >>> 0)) >>> 0;
  const hosts = 2 ** (32 - prefix) - 2;
  const same = aNet === bNet;
  const bIsSpecial = same && (toInt(bIp) === aNet || toInt(bIp) === broadcast);
  const bIsA = toInt(bIp) === toInt(A_IP);
  const maskBits = Array.from({ length: 32 }, (_, i) => (i < prefix ? '1' : '0'))
    .join('')
    .replace(/(.{8})(?!$)/g, '$1.');
  return (
    <LabFrame
      title="Same network?"
      intro={`Computer A is 192.168.1.10. Set computer B's address and the subnet mask (the /number). Same network → they talk directly through the switch. Different → the packet goes to the router.`}
      goals={[
        { text: 'Put B on the same /24 network as A', done: prefix === 24 && same && !bIsSpecial && !bIsA },
        { text: 'Move B so it has to go through the router', done: !same },
        { text: 'Find the mask with exactly 62 hosts', done: hosts === 62 },
        { text: "Give B the network's broadcast address (not allowed for a device!)", done: same && toInt(bIp) === broadcast },
        { text: 'Make a mask so big that 192.168.1.10 and 192.168.200.5 are on one network', done: same && b3 === 200 && b4 === 5 },
      ]}
    >
      <Slider label="Mask" value={prefix} onChange={setPrefix} min={16} max={30} format={(p) => `/${p} = ${toIp(p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0)}`} />
      <Slider label="B's 3rd number" value={b3} onChange={setB3} min={0} max={255} />
      <Slider label="B's 4th number" value={b4} onChange={setB4} min={0} max={255} />
      <svg viewBox="0 0 300 110" className="lab-svg" role="img" aria-label={same ? 'Both computers on one switch' : 'Packet goes through the router'}>
        <text x="40" y="30" fontSize="26" textAnchor="middle">💻</text>
        <text x="40" y="52" fontSize="9" textAnchor="middle" fill="currentColor">A 192.168.1.10</text>
        <text x="260" y="30" fontSize="26" textAnchor="middle">💻</text>
        <text x="260" y="52" fontSize="9" textAnchor="middle" fill="currentColor">B {bIp.join('.')}</text>
        {same ? (
          <>
            <line x1="62" y1="22" x2="238" y2="22" stroke="#34c759" strokeWidth="3" strokeDasharray="6 4" />
            <text x="150" y="16" fontSize="10" textAnchor="middle" fill="currentColor">direct (switch)</text>
          </>
        ) : (
          <>
            <polyline points="62,26 150,82 238,26" fill="none" stroke="#ff9500" strokeWidth="3" strokeDasharray="6 4" />
            <text x="150" y="100" fontSize="22" textAnchor="middle">📡</text>
            <text x="150" y="74" fontSize="10" textAnchor="middle" fill="currentColor">through the router</text>
          </>
        )}
      </svg>
      <Readout
        items={[
          ['Mask in binary', <code key="m" style={{ fontSize: '0.75em', wordBreak: 'break-all' }}>{maskBits}</code>],
          ["A's network", `${toIp(aNet)}/${prefix}`],
          ["B's network", `${toIp(bNet)}/${prefix}`],
          ['Devices that fit', hosts.toLocaleString()],
          ['Broadcast', toIp(broadcast)],
          ['Result', bIsA ? '⚠️ same address as A — a conflict!' : bIsSpecial ? '⚠️ reserved address' : same ? '✅ same network' : '📡 different networks'],
        ]}
      />
      <p className="hint">The 1s in the mask mark the network part. Two addresses are on the same network when those bits match.</p>
    </LabFrame>
  );
}

// ---------- ⚙️ PWM: motor speed and servo angle ----------
export function PwmLab() {
  const [mode, setMode] = useState<'motor' | 'servo'>('motor');
  const [duty, setDuty] = useState(30);
  const [pulse, setPulse] = useState(1.5);
  const [spin, setSpin] = useState(0);
  useAnimation(mode === 'motor', (dt) => setSpin((s) => (s + dt * duty * 7.2) % 360));
  const angle = Math.max(0, Math.min(180, (pulse - 1) * 180));
  // waveform: 4 periods over 260 px
  const on = mode === 'motor' ? duty / 100 : pulse / 20;
  const pts: string[] = [];
  const per = mode === 'motor' ? 65 : 130;
  for (let x0 = 20; x0 < 280; x0 += per) {
    const w = Math.max(on * per, 0);
    pts.push(`${x0},70 ${x0},${w > 0 ? 30 : 70} ${x0 + w},${w > 0 ? 30 : 70} ${x0 + w},70 ${x0 + per},70`);
  }
  const rad = (angle * Math.PI) / 180;
  return (
    <LabFrame
      title="PWM: speed and angle"
      intro="PWM switches power on and off very fast. The longer it stays on each time, the more power: a motor spins faster. A servo reads the width of the pulse as an angle."
      goals={[
        { text: 'Run the motor at half speed (45–55%)', done: mode === 'motor' && duty >= 45 && duty <= 55 },
        { text: 'Stop the motor with PWM', done: mode === 'motor' && duty === 0 },
        { text: 'Point the servo straight up (90°)', done: mode === 'servo' && Math.abs(angle - 90) < 1 },
        { text: 'Turn the servo all the way to 180°', done: mode === 'servo' && angle >= 179 },
      ]}
    >
      <Choice
        label="Drive a"
        value={mode}
        options={[
          { id: 'motor', label: '⚙️ DC motor' },
          { id: 'servo', label: '🦾 Servo' },
        ]}
        onChange={setMode}
      />
      <svg viewBox="0 0 300 200" className="lab-svg" role="img" aria-label="The PWM signal and what it drives">
        <text x="20" y="22" fontSize="10" fill="currentColor">{mode === 'motor' ? 'Signal (on = top)' : 'Pulse every 20 ms'}</text>
        <polyline points={pts.join(' ')} fill="none" stroke="#5b8def" strokeWidth="2.5" />
        {mode === 'motor' ? (
          <g transform={`translate(150 140) rotate(${spin})`}>
            <circle r="40" fill="var(--panel)" stroke="currentColor" strokeWidth="3" />
            {[0, 60, 120, 180, 240, 300].map((d) => (
              <line key={d} x1="0" y1="0" x2={40 * Math.cos((d * Math.PI) / 180)} y2={40 * Math.sin((d * Math.PI) / 180)} stroke="currentColor" strokeWidth="3" />
            ))}
            <circle r="7" fill="#ff9500" />
          </g>
        ) : (
          <g>
            <path d="M 90 180 A 60 60 0 0 1 210 180" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
            <text x="84" y="195" fontSize="9" fill="currentColor">0°</text>
            <text x="143" y="112" fontSize="9" fill="currentColor">90°</text>
            <text x="205" y="195" fontSize="9" fill="currentColor">180°</text>
            <rect x="130" y="172" width="40" height="22" rx="4" fill="#3a3f55" />
            <line x1="150" y1="180" x2={150 - 58 * Math.cos(rad)} y2={180 - 58 * Math.sin(rad)} stroke="#ff9500" strokeWidth="6" strokeLinecap="round" />
            <circle cx="150" cy="180" r="6" fill="#fff" />
          </g>
        )}
      </svg>
      {mode === 'motor' ? (
        <Slider label="Duty cycle (time on)" value={duty} onChange={setDuty} min={0} max={100} step={5} unit="%" />
      ) : (
        <Slider label="Pulse width" value={pulse} onChange={setPulse} min={1} max={2} step={0.05} format={(v) => `${v.toFixed(2)} ms`} />
      )}
      <Readout
        items={
          mode === 'motor'
            ? [
                ['Duty cycle', `${duty}%`],
                ['Average volts (from 12 V)', `${round((12 * duty) / 100, 1)} V`],
                ['Speed', `${duty}% of full`],
              ]
            : [
                ['Pulse', `${pulse.toFixed(2)} ms of every 20 ms`],
                ['Angle', `${Math.round(angle)}°`],
              ]
        }
      />
    </LabFrame>
  );
}

// ---------- 🤖 Program the robot ----------
type Cmd = 'F' | 'L' | 'R';
const CMD_LABEL: Record<Cmd, string> = { F: '⬆️ Forward', L: '↩️ Turn left', R: '↪️ Turn right' };
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const ARROW = ['➡️', '⬇️', '⬅️', '⬆️'];
interface Level {
  name: string;
  start: [number, number, number];
  star: [number, number];
  walls: Array<[number, number]>;
  hint: string;
}
const SIZE = 6;
const LEVELS: Level[] = [
  { name: '1 · Straight', start: [0, 5, 0], star: [4, 5], walls: [], hint: 'Go forward until you reach the star.' },
  {
    name: '2 · Around the wall',
    start: [0, 5, 3],
    star: [3, 1],
    walls: [[0, 1], [0, 2], [1, 2], [2, 2], [1, 4], [2, 4], [4, 1], [4, 2], [4, 3]],
    hint: 'Turns spin the robot in place. Find a way between the walls.',
  },
  {
    name: '3 · Stairs',
    start: [0, 5, 0],
    star: [3, 2],
    walls: [[2, 5], [3, 5], [3, 4], [4, 3], [1, 3], [0, 4], [0, 3], [2, 2], [4, 2], [3, 1]],
    hint: 'The stairs repeat the same steps. Write one step of the stairs, then set 🔁 Repeat.',
  },
];
type Run = { x: number; y: number; d: number; step: number; state: 'ready' | 'running' | 'crash' | 'win' | 'stopped' };
export function RobotLab() {
  const [li, setLi] = useState(0);
  const [prog, setProg] = useState<Cmd[]>([]);
  const [rep, setRep] = useState(1);
  const [run, setRun] = useState<Run | null>(null);
  const [acc, setAcc] = useState(0);
  const [wins, setWins] = useState<Record<string, number>>({});
  const L = LEVELS[li];
  const full = Array.from({ length: rep }, () => prog).flat();
  const isWall = (x: number, y: number) => L.walls.some(([a, b]) => a === x && b === y);

  useAnimation(run?.state === 'running', (dt) => {
    const t = acc + dt;
    if (t < 0.45) return setAcc(t);
    setAcc(0);
    const r = run;
    if (!r || r.state !== 'running') return;
    if (r.step >= full.length) {
      const won = r.x === L.star[0] && r.y === L.star[1];
      if (won) setWins((w) => ({ ...w, [L.name]: Math.min(w[L.name] ?? 99, prog.length) }));
      return setRun({ ...r, state: won ? 'win' : 'stopped' });
    }
    const c = full[r.step];
    if (c === 'L') return setRun({ ...r, d: (r.d + 3) % 4, step: r.step + 1 });
    if (c === 'R') return setRun({ ...r, d: (r.d + 1) % 4, step: r.step + 1 });
    const nx = r.x + DIRS[r.d][0];
    const ny = r.y + DIRS[r.d][1];
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || isWall(nx, ny)) return setRun({ ...r, state: 'crash', step: r.step + 1 });
    setRun({ ...r, x: nx, y: ny, step: r.step + 1 });
  });

  const pos = run ?? { x: L.start[0], y: L.start[1], d: L.start[2], step: 0, state: 'ready' as const };
  const reset = () => {
    setRun(null);
    setAcc(0);
  };
  const add = (c: Cmd) => {
    if (prog.length >= 12) return;
    reset();
    setProg((p) => [...p, c]);
  };
  const go = () => {
    setAcc(0);
    setRun({ x: L.start[0], y: L.start[1], d: L.start[2], step: 0, state: 'running' });
  };
  const cell = 40;
  return (
    <LabFrame
      title="Program the robot"
      intro="Add blocks to the program, then press ▶️ Run. The robot does them in order — exactly what you say! Stop on the ⭐ to win."
      goals={[
        { text: 'Solve level 1', done: wins[LEVELS[0].name] !== undefined },
        { text: 'Solve level 2', done: wins[LEVELS[1].name] !== undefined },
        { text: 'Solve level 3 (the stairs)', done: wins[LEVELS[2].name] !== undefined },
        { text: 'Solve the stairs with 4 blocks or fewer (use 🔁 Repeat)', done: (wins[LEVELS[2].name] ?? 99) <= 4 },
        { text: 'Crash into a wall (it happens to every programmer)', done: run?.state === 'crash' },
      ]}
    >
      <Choice
        label="Level"
        value={String(li)}
        options={LEVELS.map((l, i) => ({ id: String(i), label: l.name }))}
        onChange={(v) => {
          setLi(Number(v));
          setProg([]);
          setRep(1);
          reset();
        }}
      />
      <svg viewBox={`0 0 ${SIZE * cell} ${SIZE * cell}`} className="lab-svg tech-robot" role="img" aria-label="The robot's grid">
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const x = i % SIZE;
          const y = Math.floor(i / SIZE);
          return (
            <rect
              key={i}
              x={x * cell + 1}
              y={y * cell + 1}
              width={cell - 2}
              height={cell - 2}
              rx="5"
              fill={isWall(x, y) ? '#6b4f3a' : 'currentColor'}
              fillOpacity={isWall(x, y) ? 1 : 0.06}
            />
          );
        })}
        <text x={L.star[0] * cell + cell / 2} y={L.star[1] * cell + cell / 2 + 9} fontSize="26" textAnchor="middle">
          ⭐
        </text>
        <g transform={`translate(${pos.x * cell + cell / 2} ${pos.y * cell + cell / 2})`}>
          <text y="10" fontSize="28" textAnchor="middle">
            {pos.state === 'crash' ? '💥' : '🤖'}
          </text>
          <text x="13" y="-9" fontSize="13" textAnchor="middle">
            {ARROW[pos.d]}
          </text>
        </g>
      </svg>
      <p className="hint">{L.hint}</p>
      <div className="lab-buttons">
        {(Object.keys(CMD_LABEL) as Cmd[]).map((c) => (
          <button key={c} type="button" onClick={() => add(c)} disabled={prog.length >= 12}>
            {CMD_LABEL[c]}
          </button>
        ))}
      </div>
      <ol className="tech-program" aria-label="Your program">
        {prog.length === 0 && <li className="hint">(no blocks yet)</li>}
        {prog.map((c, i) => (
          <li key={i} className={run?.state === 'running' && (run.step - 1 + full.length) % prog.length === i && run.step > 0 ? 'is-now' : ''}>
            {CMD_LABEL[c]}
          </li>
        ))}
      </ol>
      <Choice
        label="🔁 Repeat the whole program"
        value={String(rep)}
        options={[1, 2, 3, 4].map((n) => ({ id: String(n), label: `${n}×` }))}
        onChange={(v) => {
          setRep(Number(v));
          reset();
        }}
      />
      <div className="lab-buttons">
        <button type="button" onClick={go} disabled={!prog.length || run?.state === 'running'}>
          ▶️ Run
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setProg((p) => p.slice(0, -1));
          }}
          disabled={!prog.length}
        >
          ⌫ Remove last
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setProg([]);
          }}
          disabled={!prog.length}
        >
          🗑️ Clear
        </button>
      </div>
      <Readout
        items={[
          ['Blocks', `${prog.length}${rep > 1 ? ` × ${rep} = ${full.length} steps` : ''}`],
          [
            'Robot',
            pos.state === 'win'
              ? '🎉 On the star!'
              : pos.state === 'crash'
                ? '💥 Bumped into something — fix the program'
                : pos.state === 'stopped'
                  ? '🤔 Program ended — not on the star'
                  : pos.state === 'running'
                    ? `Step ${pos.step} of ${full.length}`
                    : 'Ready',
          ],
        ]}
      />
    </LabFrame>
  );
}
