/** ➗ Shared bits for making math problems (mathGen.ts, mathMore.ts). */
export interface MathProblem {
  topic: string;
  q: string;
  /** the right answer as shown */
  show: string;
  /** number answers: the value, how close counts, and other values that also count */
  value?: number;
  tol?: number;
  alts?: number[];
  /** choice answers */
  choices?: string[];
  /** "round to …", "as a fraction" … shown under the question */
  note?: string;
  hint: string;
}

export type Rng = () => number;
export type Gen = (r: Rng) => MathProblem;

export const ri = (r: Rng, a: number, b: number) =>
  a + Math.floor(r() * (b - a + 1));
export const pk = <T>(r: Rng, a: readonly T[]): T =>
  a[Math.floor(r() * a.length)];
export const gcd = (a: number, b: number): number =>
  b ? gcd(b, a % b) : Math.abs(a);
export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
/** −5, not -5 */
export const n = (x: number) => (x < 0 ? `−${-x}` : String(x));
/** "+ 3" / "− 3" for after a term */
export const sg = (x: number) => (x < 0 ? `− ${-x}` : `+ ${x}`);
export function frac(num: number, den: number): string {
  if (den < 0) [num, den] = [-num, -den];
  const g = gcd(num, den) || 1;
  const a = num / g;
  const b = den / g;
  return b === 1 ? n(a) : `${n(a)}/${b}`;
}
/** 3x, x, −x */
export const cx = (c: number) => (c === 1 ? "" : c === -1 ? "−" : n(c));
/** + 3y, + y, − y */
export const sgx = (c: number) =>
  c < 0 ? `− ${c === -1 ? "" : -c}` : `+ ${c === 1 ? "" : c}`;
export const round = (x: number, places: number) =>
  Math.round(x * 10 ** places) / 10 ** places;
export const fmt = (x: number, places = 2) => n(round(x, places));
/** Tidy written-out algebra: "2x² + 0x + 3" → "2x² + 3", "7x + 0" → "7x", "1x" → "x". */
export const tidy = (q: string) =>
  q
    .replace(/ [+−] 0[a-z][²³⁴⁵⁶⁷⁸⁹]?(?![a-z])/g, "")
    .replace(/(?<=[a-z²³⁴⁵⁶⁷⁸⁹]) [+−] 0(?!\d|\.\d)/g, "")
    .replace(/(?<![\d.])1([a-z])(?![a-z])/g, "$1");
export const num = (
  topic: string,
  q: string,
  value: number,
  hint: string,
  extra: Partial<MathProblem> = {},
): MathProblem => ({
  topic,
  q: tidy(q),
  value,
  show: extra.show ?? fmt(value, extra.note?.includes("nearest tenth") ? 1 : 6),
  hint,
  ...extra,
});
export const choice = (
  topic: string,
  q: string,
  right: string,
  choices: string[],
  hint: string,
): MathProblem => ({
  topic,
  q: tidy(q),
  show: right,
  choices: [...new Set(choices)],
  hint,
});
export const tenth = { tol: 0.051, note: "Round to the nearest tenth." };

export const NAMES = [
  "Sam",
  "Mia",
  "Leo",
  "Ava",
  "Max",
  "Zoe",
  "Ben",
  "Lily",
  "Omar",
  "Nora",
  "Eli",
  "Ruby",
  "Jack",
  "Emma",
  "Noah",
  "Ivy",
  "Luis",
  "Maya",
  "Owen",
  "Grace",
];
export const STUFF: Array<[string, string]> = [
  ["🍎", "apples"],
  ["🍪", "cookies"],
  ["⭐", "stars"],
  ["🎈", "balloons"],
  ["🐟", "fish"],
  ["🚗", "toy cars"],
  ["🌸", "flowers"],
  ["🧁", "cupcakes"],
  ["🐞", "ladybugs"],
  ["🍓", "strawberries"],
  ["🏀", "balls"],
  ["🦆", "ducks"],
];

export function sub(b: number) {
  return String(b)
    .split("")
    .map((d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)])
    .join("");
}

export const TRIPLES: Array<[number, number, number]> = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
];

export const SPECIAL: Record<
  number,
  { sin: string; cos: string; tan: string }
> = {
  0: { sin: "0", cos: "1", tan: "0" },
  30: { sin: "1/2", cos: "√3/2", tan: "√3/3" },
  45: { sin: "√2/2", cos: "√2/2", tan: "1" },
  60: { sin: "√3/2", cos: "1/2", tan: "√3" },
  90: { sin: "1", cos: "0", tan: "undefined" },
};
export const SPECIAL_CHOICES = [
  "0",
  "1/2",
  "√2/2",
  "√3/2",
  "1",
  "√3",
  "√3/3",
  "undefined",
];
export const rad = (d: number) => (d * Math.PI) / 180;

export const term = (c: number, p: number, first = false, v = "x") => {
  const s = first ? (c < 0 ? "−" : "") : c < 0 ? " − " : " + ";
  const k = Math.abs(c);
  const body =
    p === 0 ? `${k}` : `${k === 1 ? "" : k}${v}${p === 1 ? "" : sup(p)}`;
  return s + body;
};
export const sup = (p: number) =>
  String(p)
    .split("")
    .map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)])
    .join("");
export function poly(cs: Array<[number, number]>, v = "x") {
  const t = cs.filter(([c]) => c !== 0);
  return t.length ? t.map(([c, p], i) => term(c, p, i === 0, v)).join("") : "0";
}

export function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
