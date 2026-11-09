/**
 * ➗ Math problems by grade (0 = K … 12), made fresh each time from problem types with random
 * numbers, so every grade has thousands of different ones. K–5: arithmetic, place value,
 * fractions, decimals. 6 Pre-Algebra · 7 Algebra · 8 Algebra II · 9 Geometry · 10 Trigonometry ·
 * 11 Pre-Calculus · 12 Calculus. Answers are a number (whole, negative, decimal or a fraction like
 * 3/4 — any equal form counts) or a choice from buttons.
 */
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

type Rng = () => number;
type Gen = (r: Rng) => MathProblem;

const ri = (r: Rng, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const pk = <T>(r: Rng, a: readonly T[]): T => a[Math.floor(r() * a.length)];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
/** −5, not -5 */
const n = (x: number) => (x < 0 ? `−${-x}` : String(x));
/** "+ 3" / "− 3" for after a term */
const sg = (x: number) => (x < 0 ? `− ${-x}` : `+ ${x}`);
function frac(num: number, den: number): string {
  if (den < 0) [num, den] = [-num, -den];
  const g = gcd(num, den) || 1;
  const a = num / g;
  const b = den / g;
  return b === 1 ? n(a) : `${n(a)}/${b}`;
}
/** 3x, x, −x */
const cx = (c: number) => (c === 1 ? '' : c === -1 ? '−' : n(c));
/** + 3y, + y, − y */
const sgx = (c: number) => (c < 0 ? `− ${c === -1 ? '' : -c}` : `+ ${c === 1 ? '' : c}`);
const round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places;
const fmt = (x: number, places = 2) => n(round(x, places));
/** Tidy written-out algebra: "2x² + 0x + 3" → "2x² + 3", "7x + 0" → "7x", "1x" → "x". */
const tidy = (q: string) =>
  q
    .replace(/ [+−] 0[a-z][²³⁴⁵⁶⁷⁸⁹]?(?![a-z])/g, '')
    .replace(/(?<=[a-z²³⁴⁵⁶⁷⁸⁹]) [+−] 0(?!\d|\.\d)/g, '')
    .replace(/(?<![\d.])1([a-z])(?![a-z])/g, '$1');
const num = (topic: string, q: string, value: number, hint: string, extra: Partial<MathProblem> = {}): MathProblem => ({ topic, q: tidy(q), value, show: extra.show ?? fmt(value, extra.note?.includes('nearest tenth') ? 1 : 6), hint, ...extra });
const choice = (topic: string, q: string, right: string, choices: string[], hint: string): MathProblem => ({ topic, q: tidy(q), show: right, choices: [...new Set(choices)], hint });
const tenth = { tol: 0.051, note: 'Round to the nearest tenth.' };

const NAMES = ['Sam', 'Mia', 'Leo', 'Ava', 'Max', 'Zoe', 'Ben', 'Lily', 'Omar', 'Nora', 'Eli', 'Ruby', 'Jack', 'Emma', 'Noah', 'Ivy', 'Luis', 'Maya', 'Owen', 'Grace'];
const STUFF: Array<[string, string]> = [
  ['🍎', 'apples'],
  ['🍪', 'cookies'],
  ['⭐', 'stars'],
  ['🎈', 'balloons'],
  ['🐟', 'fish'],
  ['🚗', 'toy cars'],
  ['🌸', 'flowers'],
  ['🧁', 'cupcakes'],
  ['🐞', 'ladybugs'],
  ['🍓', 'strawberries'],
  ['🏀', 'balls'],
  ['🦆', 'ducks'],
];

// ---------------- K ----------------
const K: Gen[] = [
  (r) => {
    const [e, w] = pk(r, STUFF);
    const c = ri(r, 1, 10);
    return num('Counting', `How many ${w}?\n${e.repeat(c)}`, c, 'Point to each one and count out loud.');
  },
  (r) => {
    const a = ri(r, 0, 9);
    const b = ri(r, 0, 10 - a);
    return num('Adding', `${a} + ${b} = ?`, a + b, `Start at ${a} and count up ${b} more.`);
  },
  (r) => {
    const a = ri(r, 1, 10);
    const b = ri(r, 0, a);
    return num('Taking away', `${a} − ${b} = ?`, a - b, `Start at ${a} and count back ${b}.`);
  },
  (r) => {
    const [e, w] = pk(r, STUFF);
    const name = pk(r, NAMES);
    const a = ri(r, 1, 6);
    const b = ri(r, 1, 10 - a);
    return num('Adding', `${name} has ${a} ${w} ${e} and gets ${b} more. How many now?`, a + b, `Put them together: ${a} + ${b}.`);
  },
  (r) => {
    const [e, w] = pk(r, STUFF);
    const name = pk(r, NAMES);
    const a = ri(r, 3, 10);
    const b = ri(r, 1, a);
    return num('Taking away', `${name} has ${a} ${w} ${e} and gives away ${b}. How many are left?`, a - b, `Take away: ${a} − ${b}.`);
  },
  (r) => {
    const a = ri(r, 0, 19);
    return r() < 0.5 ? num('Numbers', `What number comes right after ${a}?`, a + 1, 'Count up one.') : num('Numbers', `What number comes right before ${a + 1}?`, a, 'Count back one.');
  },
  (r) => {
    const a = ri(r, 0, 20);
    let b = ri(r, 0, 20);
    while (b === a) b = ri(r, 0, 20);
    const big = r() < 0.5;
    return choice('Comparing', `Which is ${big ? 'more' : 'less'}: ${a} or ${b}?`, String(big ? Math.max(a, b) : Math.min(a, b)), [String(a), String(b)], 'The bigger number comes later when you count.');
  },
  (r) => {
    const a = ri(r, 0, 10);
    return num('Making 10', `${a} + ? = 10`, 10 - a, `How many more from ${a} to get to 10? Count up on your fingers.`);
  },
  (r) => {
    const s = ri(r, 0, 15);
    const step = 1;
    return num('Patterns', `${s}, ${s + step}, ${s + 2 * step}, ?`, s + 3 * step, 'Each number is one more.');
  },
];

// ---------------- 1 ----------------
const G1: Gen[] = [
  (r) => {
    const a = ri(r, 2, 12);
    const b = ri(r, 2, 20 - a);
    return num('Adding', `${a} + ${b} = ?`, a + b, 'Make a 10 first: split the second number to fill up to 10.');
  },
  (r) => {
    const a = ri(r, 8, 20);
    const b = ri(r, 1, a);
    return num('Subtracting', `${a} − ${b} = ?`, a - b, 'Count back, or think: what plus ' + b + ' makes ' + a + '?');
  },
  (r) => {
    const a = ri(r, 1, 12);
    const s = ri(r, a + 1, 20);
    return num('Missing number', `${a} + ? = ${s}`, s - a, `Count up from ${a} to ${s}.`);
  },
  (r) => {
    const t = ri(r, 1, 9);
    const o = ri(r, 0, 9);
    return num('Tens and ones', `${t} tens and ${o} ones = ?`, t * 10 + o, 'Tens go in the first spot, ones in the second.');
  },
  (r) => {
    const a = ri(r, 10, 99);
    let b = ri(r, 10, 99);
    if (r() < 0.15) b = a;
    return choice('Comparing', `${a} ☐ ${b}\nWhich sign goes in the box?`, a > b ? '>' : a < b ? '<' : '=', ['<', '>', '='], 'Compare the tens first; if they match, compare the ones. The open side faces the bigger number.');
  },
  (r) => {
    const a = ri(r, 10, 89);
    return r() < 0.5 ? num('Ten more, ten less', `What is 10 more than ${a}?`, a + 10, 'Only the tens digit goes up by one.') : num('Ten more, ten less', `What is 10 less than ${a + 10}?`, a, 'Only the tens digit goes down by one.');
  },
  (r) => {
    const [e, w] = pk(r, STUFF);
    const name = pk(r, NAMES);
    const a = ri(r, 4, 12);
    const b = ri(r, 2, 8);
    return num('Word problems', `${name} picked ${a} ${w} ${e} in the morning and ${b} more after lunch. How many in all?`, a + b, '"In all" means add.');
  },
  (r) => {
    const name = pk(r, NAMES);
    const [, w] = pk(r, STUFF);
    const a = ri(r, 10, 20);
    const b = ri(r, 2, 9);
    return num('Word problems', `There were ${a} ${w}. ${name} ate (or used) ${b}. How many are left?`, a - b, '"Left" means subtract.');
  },
  (r) => {
    const a = ri(r, 1, 9);
    const b = ri(r, 1, 9);
    const c = ri(r, 1, 9);
    return num('Adding three numbers', `${a} + ${b} + ${c} = ?`, a + b + c, 'Add two first, then add the third. Look for two that make 10.');
  },
];

// ---------------- 2 ----------------
const G2: Gen[] = [
  (r) => {
    const a = ri(r, 10, 89);
    const b = ri(r, 10, 99 - a);
    return num('Adding 2-digit numbers', `${a} + ${b} = ?`, a + b, 'Add the ones, then the tens. If the ones make 10 or more, carry 1 ten.');
  },
  (r) => {
    const a = ri(r, 30, 99);
    const b = ri(r, 10, a);
    return num('Subtracting 2-digit numbers', `${a} − ${b} = ?`, a - b, 'Subtract the ones, then the tens. Not enough ones? Borrow a ten.');
  },
  (r) => {
    const a = ri(r, 100, 800);
    const b = ri(r, 10, 999 - a);
    return num('Adding 3-digit numbers', `${a} + ${b} = ?`, a + b, 'Line up ones, tens, hundreds. Add each column from the right, carrying when needed.');
  },
  (r) => {
    const step = pk(r, [2, 5, 10, 100]);
    const s = step * ri(r, 0, 20);
    return num('Skip counting', `${s}, ${s + step}, ${s + 2 * step}, ${s + 3 * step}, ?`, s + 4 * step, `Count by ${step}s.`);
  },
  (r) => {
    const a = ri(r, 1, 199);
    return choice('Even and odd', `Is ${a} even or odd?`, a % 2 ? 'odd' : 'even', ['even', 'odd'], 'Look at the last digit: 0, 2, 4, 6, 8 = even.');
  },
  (r) => {
    const q = ri(r, 0, 3);
    const d = ri(r, 0, 5);
    const nk = ri(r, 0, 4);
    const p = ri(r, 0, 4);
    if (q + d + nk + p === 0) return num('Money', '1 quarter = how many cents?', 25, 'A quarter is 25¢.');
    const parts = [q && `${q} quarter${q > 1 ? 's' : ''}`, d && `${d} dime${d > 1 ? 's' : ''}`, nk && `${nk} nickel${nk > 1 ? 's' : ''}`, p && `${p} penn${p > 1 ? 'ies' : 'y'}`].filter(Boolean);
    return num('Money', `${parts.join(', ')} = how many cents?`, q * 25 + d * 10 + nk * 5 + p, 'Quarter 25¢, dime 10¢, nickel 5¢, penny 1¢. Start with the biggest.');
  },
  (r) => {
    const x = ri(r, 100, 999);
    const place = pk(r, ['hundreds', 'tens', 'ones'] as const);
    const d = place === 'hundreds' ? Math.floor(x / 100) : place === 'tens' ? Math.floor(x / 10) % 10 : x % 10;
    return num('Place value', `In ${x}, what digit is in the ${place} place?`, d, 'Hundreds, tens, ones — from left to right.');
  },
  (r) => {
    const name = pk(r, NAMES);
    const a = ri(r, 20, 60);
    const b = ri(r, 10, 39);
    return num('Word problems', `${name} read ${a} pages last week and ${b} pages this week. How many pages in all?`, a + b, '"In all" means add.');
  },
  (r) => {
    const a = ri(r, 2, 5);
    const b = ri(r, 2, 5);
    return num('Equal groups', `${a} groups of ${b} = ?`, a * b, `Add ${b} again and again, ${a} times.`);
  },
];

// ---------------- 3 ----------------
const G3: Gen[] = [
  (r) => {
    const a = ri(r, 0, 12);
    const b = ri(r, 0, 12);
    return num('Multiplication facts', `${a} × ${b} = ?`, a * b, `${a} groups of ${b}. Anything × 0 = 0, × 1 = itself.`);
  },
  (r) => {
    const b = ri(r, 1, 12);
    const q = ri(r, 0, 12);
    return num('Division facts', `${b * q} ÷ ${b} = ?`, q, `What times ${b} makes ${b * q}?`);
  },
  (r) => {
    const a = ri(r, 2, 12);
    const p = a * ri(r, 2, 12);
    return num('Missing factor', `${a} × ? = ${p}`, p / a, `Divide: ${p} ÷ ${a}.`);
  },
  (r) => {
    const l = ri(r, 2, 15);
    const w = ri(r, 2, 12);
    return num('Area', `A rectangle is ${l} cm long and ${w} cm wide. What is its area (square cm)?`, l * w, 'Area = length × width.');
  },
  (r) => {
    const l = ri(r, 2, 25);
    const w = ri(r, 2, 20);
    return num('Perimeter', `A rectangle is ${l} m long and ${w} m wide. What is its perimeter (m)?`, 2 * (l + w), 'Perimeter = all the way around: add all four sides.');
  },
  (r) => {
    const x = ri(r, 11, 989);
    const to = pk(r, [10, 100]);
    return num('Rounding', `Round ${x} to the nearest ${to}.`, Math.round(x / to) * to, `Look at the digit to the right of the ${to === 10 ? 'tens' : 'hundreds'} place: 5 or more rounds up.`);
  },
  (r) => {
    const d = pk(r, [2, 3, 4, 5, 6, 8, 10]);
    const total = d * ri(r, 1, 10);
    return num('Fractions of a number', `What is 1/${d} of ${total}?`, total / d, `Split ${total} into ${d} equal groups.`);
  },
  (r) => {
    const name = pk(r, NAMES);
    const [, w] = pk(r, STUFF);
    const bags = ri(r, 2, 9);
    const each = ri(r, 2, 12);
    return r() < 0.5
      ? num('Word problems', `${name} has ${bags} bags with ${each} ${w} in each. How many ${w} in all?`, bags * each, 'Equal groups: multiply.')
      : num('Word problems', `${name} shares ${bags * each} ${w} equally among ${bags} friends. How many does each friend get?`, each, 'Sharing equally: divide.');
  },
  (r) => {
    const a = ri(r, 100, 999);
    const b = ri(r, 100, a);
    return num('Subtracting 3-digit numbers', `${a} − ${b} = ?`, a - b, 'Line up the places and subtract from the right, borrowing when needed.');
  },
  (r) => {
    const h = ri(r, 1, 11);
    const m = 5 * ri(r, 0, 11);
    const add = 5 * ri(r, 2, 11);
    const end = h * 60 + m + add;
    const eh = Math.floor(end / 60) % 12 || 12;
    return num('Time', `It is ${h}:${String(m).padStart(2, '0')}. What will the minutes say ${add} minutes later? (just the minutes)`, end % 60, `Add the minutes; past 60, start again from 0 and the hour goes up. (It will be ${eh}:${String(end % 60).padStart(2, '0')}.)`);
  },
];

// ---------------- 4 ----------------
const G4: Gen[] = [
  (r) => {
    const a = ri(r, 12, 99);
    const b = ri(r, 2, 9);
    return num('Multiplying', `${a} × ${b} = ?`, a * b, `Split it: ${Math.floor(a / 10) * 10} × ${b} + ${a % 10} × ${b}.`);
  },
  (r) => {
    const a = ri(r, 11, 99);
    const b = ri(r, 11, 99);
    return num('Multiplying 2-digit numbers', `${a} × ${b} = ?`, a * b, `Multiply ${a} by the ones of ${b}, then by the tens (add a 0), and add them.`);
  },
  (r) => {
    const a = ri(r, 100, 999);
    const b = ri(r, 2, 9);
    return num('Multiplying', `${a} × ${b} = ?`, a * b, 'Multiply each place, from the right, carrying as you go.');
  },
  (r) => {
    const b = ri(r, 2, 9);
    const q = ri(r, 11, 120);
    const rem = ri(r, 0, b - 1);
    const a = b * q + rem;
    return r() < 0.5
      ? num('Long division', `${a} ÷ ${b} = ? (the whole-number part)`, q, `How many ${b}s fit in ${a}? Divide, multiply, subtract, bring down.`)
      : num('Remainders', `What is the remainder of ${a} ÷ ${b}?`, rem, `${b} × ${q} = ${b * q}; what's left over?`);
  },
  (r) => {
    const d = ri(r, 2, 9);
    const top = ri(r, 1, d - 1);
    const k = ri(r, 2, 6);
    return num('Equivalent fractions', `${top}/${d} = ?/${d * k}`, top * k, `The bottom was multiplied by ${k}, so multiply the top by ${k} too.`);
  },
  (r) => {
    const d = ri(r, 3, 12);
    const a = ri(r, 1, d - 1);
    const b = ri(r, 1, d);
    return num('Adding fractions', `${a}/${d} + ${b}/${d} = ?`, (a + b) / d, 'Same bottom number: add the tops and keep the bottom.', { show: frac(a + b, d), note: 'A fraction like 3/4 is fine.' });
  },
  (r) => {
    const x = pk(r, [6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 24, 25, 28, 30, 32, 36, 40, 42, 45, 48]);
    let c = 0;
    for (let i = 1; i <= x; i++) if (x % i === 0) c++;
    return num('Factors', `How many factors does ${x} have?`, c, 'List the pairs that multiply to it: 1 × it, 2 × ?, … Count each number once.');
  },
  (r) => {
    const x = ri(r, 1000, 99999);
    const to = pk(r, [100, 1000]);
    return num('Rounding', `Round ${x.toLocaleString('en-US')} to the nearest ${to.toLocaleString('en-US')}.`, Math.round(x / to) * to, 'Look at the digit just to the right: 5 or more rounds up.');
  },
  (r) => {
    const a = ri(r, 1, 8);
    const b = ri(r, 1, 9 - a);
    return num('Decimals (tenths)', `0.${a} + 0.${b} = ?`, (a + b) / 10, 'Add the tenths like whole numbers, then put the point back.');
  },
  (r) => {
    const name = pk(r, NAMES);
    const price = ri(r, 3, 25);
    const k = ri(r, 3, 15);
    return num('Word problems', `${name} buys ${k} tickets at $${price} each. How many dollars in all?`, price * k, 'Multiply the price by how many.');
  },
];

// ---------------- 5 ----------------
const G5: Gen[] = [
  (r) => {
    const a = ri(r, 100, 9999) / 100;
    const b = ri(r, 100, 9999) / 100;
    return r() < 0.5 ? num('Adding decimals', `${a.toFixed(2)} + ${b.toFixed(2)} = ?`, round(a + b, 2), 'Line up the decimal points, then add.') : num('Subtracting decimals', `${Math.max(a, b).toFixed(2)} − ${Math.min(a, b).toFixed(2)} = ?`, round(Math.abs(a - b), 2), 'Line up the decimal points, then subtract.');
  },
  (r) => {
    const a = ri(r, 11, 999) / 10;
    const b = ri(r, 2, 12);
    return num('Multiplying decimals', `${a.toFixed(1)} × ${b} = ?`, round(a * b, 1), 'Multiply as if there were no point, then put back one decimal place.');
  },
  (r) => {
    const x = ri(r, 1, 9999) / 100;
    const p = pk(r, [10, 100, 1000]);
    return r() < 0.5 ? num('Powers of ten', `${x} × ${p} = ?`, round(x * p, 4), `× ${p}: the point moves ${String(p).length - 1} place(s) to the right.`) : num('Powers of ten', `${x} ÷ ${p} = ?`, round(x / p, 6), `÷ ${p}: the point moves ${String(p).length - 1} place(s) to the left.`);
  },
  (r) => {
    const b = ri(r, 2, 9);
    let d = ri(r, 2, 9);
    while (d === b) d = ri(r, 2, 9);
    const a = ri(r, 1, b - 1);
    const c = ri(r, 1, d - 1);
    const L = lcm(b, d);
    const sub = r() < 0.4 && a / b > c / d;
    return num(sub ? 'Subtracting fractions' : 'Adding fractions', `${a}/${b} ${sub ? '−' : '+'} ${c}/${d} = ?`, sub ? a / b - c / d : a / b + c / d, `Make the bottoms the same (${L}), then ${sub ? 'subtract' : 'add'} the tops.`, { show: frac(sub ? a * d - c * b : a * d + c * b, b * d), note: 'A fraction like 7/6 is fine.' });
  },
  (r) => {
    const a = ri(r, 1, 6);
    const b = ri(r, a + 1, 9);
    const c = ri(r, 1, 6);
    const d = ri(r, c + 1, 9);
    return num('Multiplying fractions', `${a}/${b} × ${c}/${d} = ?`, (a * c) / (b * d), 'Top × top, bottom × bottom.', { show: frac(a * c, b * d), note: 'A fraction is fine.' });
  },
  (r) => {
    const w = ri(r, 2, 9);
    const k = pk(r, [2, 3, 4, 5]);
    return num('Dividing by a fraction', `${w} ÷ 1/${k} = ?`, w * k, `How many 1/${k}s fit in ${w}? Each whole has ${k}.`);
  },
  (r) => {
    const l = ri(r, 2, 12);
    const w = ri(r, 2, 10);
    const h = ri(r, 2, 10);
    return num('Volume', `A box is ${l} cm long, ${w} cm wide and ${h} cm tall. What is its volume (cubic cm)?`, l * w * h, 'Volume = length × width × height.');
  },
  (r) => {
    const a = ri(r, 2, 9);
    const b = ri(r, 2, 9);
    const c = ri(r, 2, 9);
    const d = ri(r, 1, 9);
    return pk(r, [
      () => num('Order of operations', `${a} + ${b} × ${c} = ?`, a + b * c, 'Multiply before you add.'),
      () => num('Order of operations', `(${a} + ${b}) × ${c} = ?`, (a + b) * c, 'Brackets first.'),
      () => num('Order of operations', `${a * c} ÷ ${c} + ${b} × ${d} = ?`, a + b * d, 'Multiply and divide first (left to right), then add.'),
      () => num('Order of operations', `${b * c + d} − ${b} × ${c} = ?`, d, 'Multiply before you subtract.'),
    ])();
  },
  (r) => {
    const name = pk(r, NAMES);
    const price = ri(r, 105, 999) / 100;
    const k = ri(r, 2, 6);
    return num('Word problems', `${name} buys ${k} notebooks at $${price.toFixed(2)} each. How much in all (dollars)?`, round(price * k, 2), 'Multiply the price by how many.', { note: 'Like 12.50' });
  },
  (r) => {
    const x = ri(r, 2, 9);
    const e = ri(r, 2, 4);
    return num('Exponents', `${x}${['', '', '²', '³', '⁴'][e]} = ?`, x ** e, `Multiply ${x} by itself ${e} times.`);
  },
];

// ---------------- 6 · Pre-Algebra ----------------
const G6: Gen[] = [
  (r) => {
    const a = ri(r, -30, 30);
    const b = ri(r, -30, 30);
    return pk(r, [
      () => num('Integers', `${n(a)} + ${b < 0 ? `(${n(b)})` : b} = ?`, a + b, 'Same signs: add and keep the sign. Different signs: subtract and keep the sign of the bigger one.'),
      () => num('Integers', `${n(a)} − ${b < 0 ? `(${n(b)})` : b} = ?`, a - b, 'Subtracting is adding the opposite: − (−5) is + 5.'),
      () => num('Integers', `${n(a)} × ${b < 0 ? `(${n(b)})` : b} = ?`, a * b, 'Same signs → positive; different signs → negative.'),
    ])();
  },
  (r) => {
    const b = ri(r, 2, 12) * pk(r, [1, -1]);
    const q = ri(r, -12, 12);
    return num('Integers', `${n(b * q)} ÷ ${b < 0 ? `(${n(b)})` : b} = ?`, q, 'Same signs → positive; different signs → negative.');
  },
  (r) => {
    const x = ri(r, -20, 30);
    const a = ri(r, 1, 25);
    return pk(r, [
      () => num('One-step equations', `x + ${a} = ${n(x + a)}. What is x?`, x, `Take ${a} from both sides.`),
      () => num('One-step equations', `x − ${a} = ${n(x - a)}. What is x?`, x, `Add ${a} to both sides.`),
    ])();
  },
  (r) => {
    const x = ri(r, -12, 15);
    const a = ri(r, 2, 12);
    return r() < 0.5 ? num('One-step equations', `${a}x = ${n(a * x)}. What is x?`, x, `Divide both sides by ${a}.`) : num('One-step equations', `x ÷ ${a} = ${n(x)}. What is x?`, a * x, `Multiply both sides by ${a}.`);
  },
  (r) => {
    const p = pk(r, [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 12, 35, 45]);
    const w = ri(r, 2, 80) * 20;
    return num('Percent', `What is ${p}% of ${w}?`, (p * w) / 100, `${p}% means ${p} out of 100: ${w} × ${p} ÷ 100.`);
  },
  (r) => {
    const unit = ri(r, 2, 15);
    const k = ri(r, 2, 12);
    const [what, per] = pk(r, [
      ['miles', 'hour'],
      ['dollars', 'shirt'],
      ['pages', 'day'],
      ['words', 'minute'],
    ]);
    return num('Unit rate', `${unit * k} ${what} in ${k} ${per}s. How many ${what} per ${per}?`, unit, `Divide: ${unit * k} ÷ ${k}.`);
  },
  (r) => {
    const a = ri(r, 1, 9);
    const b = ri(r, 2, 12);
    const k = ri(r, 2, 9);
    return num('Ratios', `${a} : ${b} = ${a * k} : ?`, b * k, `The first number was multiplied by ${k}; do the same to the second.`);
  },
  (r) => {
    const g = ri(r, 2, 12);
    let a = ri(r, 2, 12);
    let b = ri(r, 2, 12);
    while (gcd(a, b) !== 1 || a === b) {
      a = ri(r, 2, 12);
      b = ri(r, 2, 12);
    }
    return r() < 0.5
      ? num('GCF', `What is the greatest common factor of ${a * g} and ${b * g}?`, g, 'The biggest number that divides both evenly. List factors, or break each into primes.')
      : num('LCM', `What is the least common multiple of ${a} and ${b}?`, lcm(a, b), 'The smallest number both go into. List multiples of the bigger one until the other divides it.');
  },
  (r) => {
    const a = ri(r, 2, 9);
    const b = ri(r, -9, 12);
    const x = ri(r, -6, 9);
    return num('Expressions', `What is ${a}x ${sg(b)} when x = ${n(x)}?`, a * x + b, `Put ${n(x)} in place of x: ${a} × ${x < 0 ? `(${n(x)})` : x} ${sg(b)}.`);
  },
  (r) => {
    const k = ri(r, 3, 6);
    const list = Array.from({ length: k }, () => ri(r, 1, 30));
    const s = list.reduce((a, b) => a + b, 0);
    const fix = (k - (s % k)) % k;
    list[0] += fix;
    return num('Mean', `What is the mean (average) of ${list.join(', ')}?`, (s + fix) / k, 'Add them all, then divide by how many there are.');
  },
  (r) => {
    const a = ri(r, -50, 50);
    return num('Absolute value', `|${n(a)}| = ?`, Math.abs(a), 'Absolute value is the distance from 0 — never negative.');
  },
  (r) => {
    const b = ri(r, 2, 10);
    const e = ri(r, 0, b <= 3 ? 6 : 3);
    return num('Exponents', `${b}^${e} = ?`, b ** e, `Multiply ${b} by itself ${e} times. Anything to the 0 is 1.`);
  },
];

// ---------------- 7 · Algebra ----------------
const G7: Gen[] = [
  (r) => {
    const x = ri(r, -12, 15);
    const a = ri(r, 2, 12) * pk(r, [1, 1, -1]);
    const b = ri(r, -20, 20);
    return num('Two-step equations', `${n(a)}x ${sg(b)} = ${n(a * x + b)}. What is x?`, x, `Undo the ${b < 0 ? 'subtracting' : 'adding'} first, then divide by ${n(a)}.`);
  },
  (r) => {
    const x = ri(r, -10, 12);
    const a = ri(r, 2, 9);
    const b = ri(r, -9, 9) || 1;
    return num('Distributing', `${a}(x ${sg(b)}) = ${n(a * (x + b))}. What is x?`, x, `Divide both sides by ${a} (or multiply out), then ${b < 0 ? 'add' : 'subtract'} ${Math.abs(b)}.`);
  },
  (r) => {
    const x = ri(r, -10, 12);
    const a = ri(r, 3, 12);
    let c = ri(r, 1, 11);
    while (c === a) c = ri(r, 1, 11);
    const b = ri(r, -15, 15);
    const d = a * x + b - c * x;
    return num('Variables on both sides', `${a}x ${sg(b)} = ${cx(c)}x ${sg(d)}. What is x?`, x, `Move the x's to one side (take ${c}x from both), then solve.`);
  },
  (r) => {
    const x1 = ri(r, -9, 9);
    const y1 = ri(r, -9, 9);
    let x2 = ri(r, -9, 9);
    while (x2 === x1) x2 = ri(r, -9, 9);
    const y2 = ri(r, -9, 9);
    return num('Slope', `What is the slope of the line through (${n(x1)}, ${n(y1)}) and (${n(x2)}, ${n(y2)})?`, (y2 - y1) / (x2 - x1), 'Slope = rise ÷ run = (y₂ − y₁) ÷ (x₂ − x₁).', { show: frac(y2 - y1, x2 - x1), note: 'A fraction like −3/4 is fine.' });
  },
  (r) => {
    const m = ri(r, -6, 6) || 3;
    const b = ri(r, -10, 10);
    const x = ri(r, -6, 6);
    return num('Linear functions', `y = ${m === 1 ? '' : m === -1 ? '−' : n(m)}x ${sg(b)}. What is y when x = ${n(x)}?`, m * x + b, 'Put the x value in and work it out.');
  },
  (r) => {
    const m = ri(r, -5, 5) || 2;
    const b = ri(r, -10, 10);
    const x1 = ri(r, -4, 4);
    const x2 = x1 + ri(r, 1, 4);
    return num('y-intercept', `A line goes through (${n(x1)}, ${n(m * x1 + b)}) and (${n(x2)}, ${n(m * x2 + b)}). Where does it cross the y-axis (the b in y = mx + b)?`, b, 'Find the slope m first, then b = y − m·x using either point.');
  },
  (r) => {
    const x = ri(r, -10, 12);
    const a = ri(r, 2, 9);
    const b = ri(r, -12, 12);
    const sign = pk(r, ['>', '<', '≥', '≤']);
    return num('Inequalities', `${a}x ${sg(b)} ${sign} ${n(a * x + b)}\nSo x ${sign} ?`, x, 'Solve it like an equation. (Only flip the sign when multiplying or dividing by a negative.)');
  },
  (r) => {
    const a = ri(r, 1, 12);
    const b = ri(r, 1, 12);
    const c = ri(r, 1, 9);
    return num('Combining like terms', `${cx(a)}x + ${cx(b)}x − ${cx(c)}x = ?x`, a + b - c, 'Like terms: add and subtract the numbers in front of x.');
  },
  (r) => {
    const x = ri(r, -8, 12);
    const y = ri(r, -8, 12);
    return num('Systems of equations', `x + y = ${n(x + y)}\nx − y = ${n(x - y)}\nWhat is x?`, x, 'Add the two equations: the y’s cancel, leaving 2x.');
  },
  (r) => {
    const a = ri(r, 1, 9);
    const b = ri(r, -9, 9);
    const c = ri(r, 1, 9);
    const d = ri(r, -9, 9);
    return pk(r, [
      () => num('Multiplying binomials', `(x ${sg(b)})(x ${sg(d)}) = x² + ?x ${sg(b * d)}`, b + d, 'FOIL: the middle term is outer + inner.'),
      () => num('Multiplying binomials', `(${cx(a)}x ${sg(b)})(${cx(c)}x ${sg(d)}) = ?x² + …`, a * c, 'First × first.'),
    ])();
  },
];

// ---------------- 8 · Algebra II ----------------
const G8: Gen[] = [
  (r) => {
    const p = ri(r, -10, 10);
    let q = ri(r, -10, 10);
    while (q === p) q = ri(r, -10, 10);
    const big = r() < 0.5;
    return num('Quadratics by factoring', `x² ${sg(-(p + q))}x ${sg(p * q)} = 0. What is the ${big ? 'larger' : 'smaller'} solution?`, big ? Math.max(p, q) : Math.min(p, q), 'Find two numbers that multiply to the last number and add to the middle one; flip their signs.');
  },
  (r) => {
    const a = ri(r, 1, 5);
    const b = ri(r, -10, 10);
    const c = ri(r, -10, 10);
    const D = b * b - 4 * a * c;
    return choice('The discriminant', `How many real solutions does ${a === 1 ? '' : a}x² ${sg(b)}x ${sg(c)} = 0 have?`, D > 0 ? '2' : D === 0 ? '1' : '0', ['0', '1', '2'], 'Work out b² − 4ac: positive → 2, zero → 1, negative → 0.');
  },
  (r) => {
    const x = ri(r, -8, 8);
    const y = ri(r, -8, 8);
    const a = ri(r, 1, 5);
    const b = ri(r, 1, 5);
    const c = ri(r, 1, 5);
    let d = ri(r, -5, 5);
    if (a * d - b * c === 0) d = d + 1 || 2;
    const which = r() < 0.5 ? 'x' : 'y';
    return num('Systems of equations', `${cx(a)}x ${sgx(b)}y = ${n(a * x + b * y)}\n${cx(c)}x ${sgx(d)}y = ${n(c * x + d * y)}\nWhat is ${which}?`, which === 'x' ? x : y, 'Multiply one equation so a variable cancels when you add or subtract them; or solve one for a variable and substitute.');
  },
  (r) => {
    const a = ri(r, 2, 9);
    const b = ri(r, 2, 9);
    return pk(r, [
      () => num('Exponent rules', `x^${a} · x^${b} = x^?`, a + b, 'Multiplying the same base: add the exponents.'),
      () => num('Exponent rules', `(x^${a})^${b} = x^?`, a * b, 'A power of a power: multiply the exponents.'),
      () => num('Exponent rules', `x^${a + b} ÷ x^${b} = x^?`, a, 'Dividing the same base: subtract the exponents.'),
    ])();
  },
  (r) => {
    const b = pk(r, [2, 3, 4, 5, 10]);
    const e = ri(r, 0, b === 2 ? 8 : b === 10 ? 6 : 4);
    return r() < 0.5 ? num('Logarithms', `log${sub(b)}(${(b ** e).toLocaleString('en-US')}) = ?`, e, `What power of ${b} gives ${b ** e}?`) : num('Exponential equations', `${b}^x = ${(b ** e).toLocaleString('en-US')}. What is x?`, e, `Write ${b ** e} as a power of ${b}.`);
  },
  (r) => {
    const a = ri(r, 1, 5);
    const b = ri(r, -5, 5);
    const c = ri(r, 1, 4);
    const d = ri(r, -5, 5);
    const x = ri(r, -3, 3);
    return num('Composing functions', `f(x) = ${a}x ${sg(b)} and g(x) = ${c}x ${sg(d)}. What is f(g(${n(x)}))?`, a * (c * x + d) + b, `Inside first: g(${n(x)}), then put that into f.`);
  },
  (r) => {
    const a = ri(r, -10, 10);
    const b = ri(r, 1, 12);
    const big = r() < 0.5;
    return num('Absolute value equations', `|x ${sg(-a)}| = ${b}. What is the ${big ? 'larger' : 'smaller'} solution?`, big ? a + b : a - b, `x ${sg(-a)} = ${b} or x ${sg(-a)} = −${b}.`);
  },
  (r) => {
    const k = ri(r, 2, 40);
    return choice('Imaginary numbers', `i^${k} = ?`, ['1', 'i', '−1', '−i'][k % 4], ['1', 'i', '−1', '−i'], 'Powers of i repeat every 4: i, −1, −i, 1. Use the remainder of the power ÷ 4.');
  },
  (r) => {
    const a = ri(r, 2, 9);
    const b = pk(r, [2, 3, 5, 6, 7]);
    return num('Simplifying roots', `√${a * a * b} = ?√${b}`, a, `Find the biggest perfect square inside: ${a * a} × ${b}.`);
  },
  (r) => {
    const a = ri(r, 1, 4) * pk(r, [1, -1]);
    const h = ri(r, -6, 6);
    const k = ri(r, -9, 9);
    const b = -2 * a * h;
    const c = a * h * h + k;
    return num('Parabolas', `y = ${a === 1 ? '' : a === -1 ? '−' : n(a)}x² ${sg(b)}x ${sg(c)}. What is the x of the vertex?`, h, 'x = −b ÷ (2a).');
  },
];
function sub(b: number) {
  return String(b)
    .split('')
    .map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])
    .join('');
}

// ---------------- 9 · Geometry ----------------
const TRIPLES: Array<[number, number, number]> = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
];
const G9: Gen[] = [
  (r) => {
    const a = ri(r, 1, 89);
    return r() < 0.5 ? num('Angles', `An angle is ${a}°. What is its complement?`, 90 - a, 'Complementary angles add to 90°.') : num('Angles', `An angle is ${a}°. What is its supplement?`, 180 - a, 'Supplementary angles add to 180°.');
  },
  (r) => {
    const a = ri(r, 20, 100);
    const b = ri(r, 10, 160 - a);
    return num('Triangles', `Two angles of a triangle are ${a}° and ${b}°. What is the third?`, 180 - a - b, 'The angles of a triangle add to 180°.');
  },
  (r) => {
    const [a, b, c] = pk(r, TRIPLES);
    const k = ri(r, 1, 6);
    return r() < 0.5 ? num('Pythagorean theorem', `A right triangle has legs ${a * k} and ${b * k}. How long is the hypotenuse?`, c * k, 'a² + b² = c². Add the squares, then take the square root.') : num('Pythagorean theorem', `A right triangle has hypotenuse ${c * k} and one leg ${a * k}. How long is the other leg?`, b * k, 'b² = c² − a².');
  },
  (r) => {
    const rad = ri(r, 1, 30);
    const area = r() < 0.5;
    const v = area ? 3.14 * rad * rad : 2 * 3.14 * rad;
    return num('Circles', `A circle has radius ${rad}. What is its ${area ? 'area' : 'circumference'}? (Use π ≈ 3.14)`, round(v, 2), area ? 'Area = π × r × r.' : 'Circumference = 2 × π × r.', { ...tenth, alts: [area ? Math.PI * rad * rad : 2 * Math.PI * rad] });
  },
  (r) => {
    const b = ri(r, 2, 30);
    const h = ri(r, 2, 30);
    return num('Area', `A triangle has base ${b} and height ${h}. What is its area?`, (b * h) / 2, 'Area = ½ × base × height.');
  },
  (r) => {
    const a = ri(r, 2, 20);
    const b = ri(r, a + 1, 30);
    const h = 2 * ri(r, 1, 10);
    return num('Area', `A trapezoid has parallel sides ${a} and ${b} and height ${h}. What is its area?`, ((a + b) * h) / 2, 'Area = (side 1 + side 2) ÷ 2 × height.');
  },
  (r) => {
    const s = ri(r, 3, 20);
    return r() < 0.5 ? num('Polygons', `What do the inside angles of a ${s}-sided polygon add up to?`, (s - 2) * 180, 'Sum = (sides − 2) × 180°.') : s <= 12 && 360 % s === 0 ? num('Polygons', `Each inside angle of a regular ${s}-sided polygon is how many degrees?`, 180 - 360 / s, 'Each = (sides − 2) × 180° ÷ sides.') : num('Polygons', `What do the outside angles of a ${s}-sided polygon add up to?`, 360, 'The outside angles of any polygon add to 360°.');
  },
  (r) => {
    const [a, b, c] = pk(r, TRIPLES.slice(0, 3));
    const k = ri(r, 1, 3);
    const x1 = ri(r, -9, 9);
    const y1 = ri(r, -9, 9);
    const sx = pk(r, [1, -1]);
    const sy = pk(r, [1, -1]);
    const [dx, dy] = r() < 0.5 ? [a, b] : [b, a];
    return num('Distance', `How far apart are (${n(x1)}, ${n(y1)}) and (${n(x1 + sx * dx * k)}, ${n(y1 + sy * dy * k)})?`, c * k, 'Distance = √((x₂ − x₁)² + (y₂ − y₁)²) — it’s the Pythagorean theorem.');
  },
  (r) => {
    const x1 = ri(r, -10, 10);
    const x2 = x1 + 2 * ri(r, -8, 8);
    const y1 = ri(r, -10, 10);
    const y2 = ri(r, -10, 10);
    return num('Midpoint', `What is the x of the midpoint of (${n(x1)}, ${n(y1)}) and (${n(x2)}, ${n(y2)})?`, (x1 + x2) / 2, 'Midpoint = the average: (x₁ + x₂) ÷ 2.');
  },
  (r) => {
    const rad = ri(r, 1, 12);
    const h = ri(r, 1, 20);
    const kind = pk(r, ['cylinder', 'cone', 'sphere'] as const);
    const v = kind === 'cylinder' ? 3.14 * rad * rad * h : kind === 'cone' ? (3.14 * rad * rad * h) / 3 : (4 / 3) * 3.14 * rad ** 3;
    const vp = kind === 'cylinder' ? Math.PI * rad * rad * h : kind === 'cone' ? (Math.PI * rad * rad * h) / 3 : (4 / 3) * Math.PI * rad ** 3;
    return num('Volume', kind === 'sphere' ? `What is the volume of a sphere with radius ${rad}? (Use π ≈ 3.14)` : `What is the volume of a ${kind} with radius ${rad} and height ${h}? (Use π ≈ 3.14)`, round(v, 2), kind === 'cylinder' ? 'V = π r² h.' : kind === 'cone' ? 'V = ⅓ π r² h.' : 'V = ⁴⁄₃ π r³.', { tol: Math.max(0.051, v * 0.0006), note: 'Round to the nearest tenth.', alts: [vp] });
  },
  (r) => {
    const a = ri(r, 2, 15);
    const k = ri(r, 2, 6);
    const b = ri(r, 2, 15);
    return num('Similar triangles', `Two triangles are similar. A side of ${a} in the small one matches ${a * k} in the big one. Another side of the small one is ${b}. What is the matching side in the big one?`, b * k, `Every side is scaled by the same amount (× ${k}).`);
  },
  (r) => {
    const a = ri(r, 20, 160);
    return num('Angles', `Two lines cross. One angle is ${a}°. What is the angle across from it (vertical angle)?`, a, 'Vertical angles are equal.');
  },
];

// ---------------- 10 · Trigonometry ----------------
const SPECIAL: Record<number, { sin: string; cos: string; tan: string }> = {
  0: { sin: '0', cos: '1', tan: '0' },
  30: { sin: '1/2', cos: '√3/2', tan: '√3/3' },
  45: { sin: '√2/2', cos: '√2/2', tan: '1' },
  60: { sin: '√3/2', cos: '1/2', tan: '√3' },
  90: { sin: '1', cos: '0', tan: 'undefined' },
};
const SPECIAL_CHOICES = ['0', '1/2', '√2/2', '√3/2', '1', '√3', '√3/3', 'undefined'];
const rad = (d: number) => (d * Math.PI) / 180;
const G10: Gen[] = [
  (r) => {
    const base = pk(r, [0, 30, 45, 60, 90]);
    const fn = pk(r, ['sin', 'cos', 'tan'] as const);
    // also the same angle in other quadrants for sin/cos
    const quad = base !== 0 && base !== 90 && r() < 0.5 ? pk(r, [180 - base, 180 + base, 360 - base]) : base;
    let right = SPECIAL[base][fn];
    if (quad !== base) {
      const s = fn === 'sin' ? Math.sign(Math.sin(rad(quad))) : fn === 'cos' ? Math.sign(Math.cos(rad(quad))) : Math.sign(Math.tan(rad(quad)));
      if (s < 0) right = `−${right}`;
    }
    const choices = quad !== base ? [...SPECIAL_CHOICES.slice(0, 7), ...SPECIAL_CHOICES.slice(1, 7).map((c) => `−${c}`)] : SPECIAL_CHOICES;
    return choice('Special angles', `${fn}(${quad}°) = ?`, right, choices, quad !== base ? `Reference angle ${base}°; the sign depends on the quadrant (All Students Take Calculus: all, sin, tan, cos positive).` : '30-60-90 triangle sides 1, √3, 2; 45-45-90 sides 1, 1, √2. SOH-CAH-TOA.');
  },
  (r) => {
    const d = pk(r, [15, 30, 36, 45, 60, 72, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360, 400, 450, 540, 720]);
    return r() < 0.5 ? num('Radians', `Write ${d}° in radians, as a multiple of π. (? × π)`, d / 180, '× π/180: so the multiple is degrees ÷ 180.', { show: `${frac(d, 180)}π`, note: 'Just the number in front of π, like 2/3.' }) : num('Radians', `${frac(d, 180)}π radians = how many degrees?`, d, '× 180/π.');
  },
  (r) => {
    const a = ri(r, 10, 80);
    const h = ri(r, 3, 40);
    const which = pk(r, ['opposite', 'adjacent'] as const);
    const v = which === 'opposite' ? h * Math.sin(rad(a)) : h * Math.cos(rad(a));
    return num('Right-triangle trig', `A right triangle has hypotenuse ${h} and an angle of ${a}°. How long is the side ${which} that angle?`, round(v, 3), which === 'opposite' ? 'SOH: opposite = hypotenuse × sin.' : 'CAH: adjacent = hypotenuse × cos.', tenth);
  },
  (r) => {
    const o = ri(r, 2, 30);
    const a = ri(r, 2, 30);
    const v = (Math.atan(o / a) * 180) / Math.PI;
    return num('Inverse trig', `A right triangle has legs ${o} (opposite the angle) and ${a} (next to it). What is the angle in degrees?`, Math.round(v), 'TOA: angle = tan⁻¹(opposite ÷ adjacent).', { tol: 0.51, note: 'Round to the nearest degree.' });
  },
  (r) => {
    const a = ri(r, 3, 20);
    const b = ri(r, 3, 20);
    const C = ri(r, 20, 150);
    const c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(rad(C)));
    return num('Law of cosines', `A triangle has sides ${a} and ${b} with ${C}° between them. How long is the third side?`, round(c, 3), 'c² = a² + b² − 2ab·cos C.', tenth);
  },
  (r) => {
    const A = ri(r, 25, 80);
    const B = ri(r, 25, 80);
    const a = ri(r, 5, 25);
    const b = (a * Math.sin(rad(B))) / Math.sin(rad(A));
    return num('Law of sines', `In a triangle, angle A = ${A}°, angle B = ${B}°, and side a (across from A) = ${a}. How long is side b?`, round(b, 3), 'a / sin A = b / sin B.', tenth);
  },
  (r) => {
    const d = ri(r, 1, 359);
    if (d % 90 === 0) return num('Reference angles', `What is the reference angle of ${d + 1}°?`, Math.min((d + 1) % 180, 180 - ((d + 1) % 180)), 'The angle to the nearest part of the x-axis.');
    return num('Reference angles', `What is the reference angle of ${d}°?`, Math.min(d % 180, 180 - (d % 180)), 'The angle to the nearest part of the x-axis.');
  },
  (r) => {
    const d = ri(r, 1, 359);
    const q = d < 90 ? 'I' : d < 180 ? 'II' : d < 270 ? 'III' : 'IV';
    return d % 90 === 0 ? num('Coterminal angles', `${d + 360}° ends in the same place as what angle between 0° and 360°?`, d, 'Add or take away 360° until it’s between 0° and 360°.') : choice('Quadrants', `Which quadrant is ${d}° in?`, q, ['I', 'II', 'III', 'IV'], 'I: 0–90°, II: 90–180°, III: 180–270°, IV: 270–360°.');
  },
  (r) => {
    const b = pk(r, [1, 2, 3, 4, 5, 6, 8, 9, 10, 12]);
    const a = ri(r, 1, 9);
    return r() < 0.5 ? num('Graphs of sine', `What is the period (in degrees) of y = ${a} sin(${b === 1 ? '' : b}x)?`, 360 / b, 'Period = 360° ÷ b.') : num('Graphs of sine', `What is the amplitude of y = ${a} cos(${b === 1 ? '' : b}x)?`, a, 'Amplitude = |a|, the number in front.');
  },
  (r) => {
    const d = ri(r, 1, 359) + 360 * ri(r, 1, 3) * pk(r, [1, -1]);
    return num('Coterminal angles', `${n(d)}° ends in the same place as what angle between 0° and 360°?`, ((d % 360) + 360) % 360, 'Add or take away 360° until it’s between 0° and 360°.');
  },
];

// ---------------- 11 · Pre-Calculus ----------------
const G11: Gen[] = [
  (r) => {
    const a = ri(r, -20, 20);
    const d = ri(r, -9, 9) || 3;
    const k = ri(r, 5, 50);
    return num('Arithmetic sequences', `${n(a)}, ${n(a + d)}, ${n(a + 2 * d)}, … What is term number ${k}?`, a + (k - 1) * d, 'aₙ = a₁ + (n − 1)·d.');
  },
  (r) => {
    const a = ri(r, 1, 20);
    const d = ri(r, 1, 9);
    const k = ri(r, 5, 30);
    return num('Series', `What is the sum of the first ${k} terms of ${a}, ${a + d}, ${a + 2 * d}, …?`, (k * (2 * a + (k - 1) * d)) / 2, 'Sum = n × (first + last) ÷ 2.');
  },
  (r) => {
    const a = ri(r, 1, 6);
    const q = pk(r, [2, 3, -2]);
    const k = ri(r, 3, q === 3 ? 7 : 10);
    return r() < 0.5 ? num('Geometric sequences', `${n(a)}, ${n(a * q)}, ${n(a * q * q)}, … What is term number ${k}?`, a * q ** (k - 1), 'aₙ = a₁ × r^(n − 1).') : num('Geometric series', `What is the sum of the first ${k} terms of ${n(a)}, ${n(a * q)}, ${n(a * q * q)}, …?`, (a * (q ** k - 1)) / (q - 1), 'Sum = a₁ × (rⁿ − 1) ÷ (r − 1).');
  },
  (r) => {
    const b = pk(r, [2, 3, 5, 10]);
    const e = ri(r, -3, b === 2 ? 8 : 4);
    return num('Logarithms', `log${sub(b)}(x) = ${n(e)}. What is x?`, b ** e, `x = ${b}^${n(e)}.`, { show: e < 0 ? `1/${b ** -e}` : String(b ** e), note: e < 0 ? 'A fraction like 1/8 is fine.' : undefined });
  },
  (r) => {
    const p = ri(r, 10, 100) * 100;
    const rate = pk(r, [2, 3, 4, 5, 6, 8]);
    const y = ri(r, 2, 15);
    const v = p * (1 + rate / 100) ** y;
    return num('Compound interest', `$${p.toLocaleString('en-US')} grows at ${rate}% a year (compounded yearly). How much after ${y} years?`, round(v, 2), 'A = P(1 + r)ᵗ with r as a decimal.', { tol: 0.6, note: 'To the nearest dollar is fine.' });
  },
  (r) => {
    const [a, b, c, d] = [ri(r, -9, 9), ri(r, -9, 9), ri(r, -9, 9), ri(r, -9, 9)];
    return num('Matrices', `What is the determinant of [[${n(a)}, ${n(b)}], [${n(c)}, ${n(d)}]]?`, a * d - b * c, 'ad − bc.');
  },
  (r) => {
    const [x, y, z] = pk(r, TRIPLES);
    const k = ri(r, 1, 4);
    const sx = pk(r, [1, -1]);
    const sy = pk(r, [1, -1]);
    return r() < 0.5 ? num('Vectors', `How long is the vector ⟨${n(sx * x * k)}, ${n(sy * y * k)}⟩?`, z * k, '|v| = √(x² + y²).') : (() => {
      const a = [ri(r, -9, 9), ri(r, -9, 9)];
      const b = [ri(r, -9, 9), ri(r, -9, 9)];
      return num('Vectors', `⟨${n(a[0])}, ${n(a[1])}⟩ · ⟨${n(b[0])}, ${n(b[1])}⟩ = ?`, a[0] * b[0] + a[1] * b[1], 'Dot product: multiply matching parts and add.');
    })();
  },
  (r) => {
    const a = ri(r, 2, 9);
    const b = ri(r, -12, 12);
    const x = ri(r, -10, 10);
    return num('Inverse functions', `f(x) = ${a}x ${sg(b)}. What is f⁻¹(${n(a * x + b)})?`, x, 'f⁻¹ undoes f: solve ' + a + 'x ' + sg(b) + ' = ' + n(a * x + b) + '.');
  },
  (r) => {
    const c = [ri(r, 1, 3), ri(r, -5, 5), ri(r, -5, 5), ri(r, -9, 9)];
    const a = ri(r, -3, 3);
    const v = c[0] * a ** 3 + c[1] * a ** 2 + c[2] * a + c[3];
    return num('Remainder theorem', `What is the remainder when ${c[0] === 1 ? '' : c[0]}x³ ${sg(c[1])}x² ${sg(c[2])}x ${sg(c[3])} is divided by (x ${sg(-a)})?`, v, `The remainder is p(${n(a)}): put ${n(a)} in for x.`);
  },
  (r) => {
    const nn = ri(r, 4, 12);
    const k = ri(r, 1, Math.min(5, nn - 1));
    let c = 1;
    let p = 1;
    for (let i = 0; i < k; i++) {
      c = (c * (nn - i)) / (i + 1);
      p *= nn - i;
    }
    return r() < 0.5 ? num('Combinations', `How many ways to choose ${k} from ${nn} (order doesn’t matter)?`, c, 'C(n, k) = n! ÷ (k!(n − k)!).') : num('Permutations', `How many ways to line up ${k} of ${nn} people (order matters)?`, p, 'P(n, k) = n × (n − 1) × … (k numbers).');
  },
  (r) => {
    const a = ri(r, -6, 6);
    const b = ri(r, -6, 6);
    const c = ri(r, -6, 6);
    const d = ri(r, -6, 6);
    return num('Complex numbers', `(${n(a)} ${sg(b)}i)(${n(c)} ${sg(d)}i) = ? + …i  (the real part)`, a * c - b * d, 'FOIL, and i² = −1: real part = ac − bd.');
  },
];

// ---------------- 12 · Calculus ----------------
const term = (c: number, p: number, first = false, v = 'x') => {
  const s = first ? (c < 0 ? '−' : '') : c < 0 ? ' − ' : ' + ';
  const k = Math.abs(c);
  const body = p === 0 ? `${k}` : `${k === 1 ? '' : k}${v}${p === 1 ? '' : sup(p)}`;
  return s + body;
};
const sup = (p: number) =>
  String(p)
    .split('')
    .map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])
    .join('');
function poly(cs: Array<[number, number]>, v = 'x') {
  const t = cs.filter(([c]) => c !== 0);
  return t.length ? t.map(([c, p], i) => term(c, p, i === 0, v)).join('') : '0';
}
const G12: Gen[] = [
  (r) => {
    const cs: Array<[number, number]> = [
      [ri(r, -5, 5) || 1, 3],
      [ri(r, -6, 6), 2],
      [ri(r, -9, 9), 1],
      [ri(r, -9, 9), 0],
    ];
    const x = ri(r, -3, 3);
    const d = cs.reduce((s, [c, p]) => s + (p ? c * p * x ** (p - 1) : 0), 0);
    return num('Derivatives', `f(x) = ${poly(cs)}. What is f′(${n(x)})?`, d, 'Power rule: the derivative of xⁿ is n·xⁿ⁻¹. Then put the number in.');
  },
  (r) => {
    const c = ri(r, 1, 12);
    const p = ri(r, 2, 9);
    return num('Power rule', `d/dx (${c === 1 ? '' : c}x${sup(p)}) = ?x${sup(p - 1)}`, c * p, 'Bring the power down and multiply; lower the power by one.');
  },
  (r) => {
    const a = ri(r, -9, 9) || 4;
    return num('Limits', `lim (x → ${n(a)}) of (x² − ${a * a}) ÷ (x ${sg(-a)}) = ?`, 2 * a, `Factor the top: (x − ${n(a)})(x + ${n(a)}), cancel, then put x = ${n(a)} in.`);
  },
  (r) => {
    const a = ri(r, 1, 9);
    const b = ri(r, 1, 9);
    const p = ri(r, 1, 4);
    const q = r() < 0.6 ? p : ri(r, 1, 4);
    const v = q > p ? 0 : q === p ? a / b : null;
    if (v === null) return num('Limits at infinity', `lim (x → ∞) of ${b === 1 ? '' : b}x${sup(p)} ÷ ${a === 1 ? '' : a}x${sup(p)} = ?`, b / a, 'Same top and bottom powers: divide the leading numbers.', { show: frac(b, a) });
    return num('Limits at infinity', `lim (x → ∞) of ${a === 1 ? '' : a}x${sup(p)} ÷ (${b === 1 ? '' : b}x${sup(q)} + 1) = ?`, v, 'Compare the highest powers: same → divide the numbers in front; bigger on the bottom → 0.', { show: q > p ? '0' : frac(a, b), note: 'A fraction is fine.' });
  },
  (r) => {
    // ∫₀ᵇ of a polynomial whose integral is whole at b
    const b = ri(r, 1, 4);
    const c2 = 3 * ri(r, 0, 3);
    const c1 = 2 * ri(r, -3, 4);
    const c0 = ri(r, -5, 5);
    const cs: Array<[number, number]> = [
      [c2, 2],
      [c1, 1],
      [c0, 0],
    ];
    if (cs.every(([c]) => c === 0)) cs[2][0] = 2;
    const v = (cs[0][0] / 3) * b ** 3 + (cs[1][0] / 2) * b ** 2 + cs[2][0] * b;
    return num('Integrals', `∫ from 0 to ${b} of (${poly(cs)}) dx = ?`, v, 'Antiderivative: xⁿ → xⁿ⁺¹ ÷ (n + 1). Then (value at the top) − (value at the bottom).');
  },
  (r) => {
    const a = ri(r, -4, 4) || 1;
    const b = ri(r, -8, 8);
    const c = ri(r, -9, 9);
    const x = ri(r, -4, 4);
    return num('Tangent lines', `What is the slope of the tangent line to y = ${poly([[a, 2], [b, 1], [c, 0]])} at x = ${n(x)}?`, 2 * a * x + b, 'The slope of the tangent is the derivative at that point.');
  },
  (r) => {
    const a = ri(r, 1, 5) * pk(r, [1, -1]);
    const h = ri(r, -8, 8);
    return num('Critical points', `At what x is f(x) = ${poly([[a, 2], [-2 * a * h, 1], [ri(r, -9, 9), 0]])} flat (f′(x) = 0)?`, h, 'Take the derivative, set it to 0, solve.');
  },
  (r) => {
    const a = ri(r, 1, 5);
    const b = ri(r, 1, 4);
    const p = ri(r, 2, 5);
    return num('Chain rule', `f(x) = (${a === 1 ? '' : a}x + ${b})${sup(p)}. What is f′(0)?`, p * a * b ** (p - 1), 'Chain rule: n·(inside)ⁿ⁻¹ × (derivative of the inside).');
  },
  (r) => {
    const fn = pk(r, ['sin', 'cos'] as const);
    const at = pk(r, ['0', 'π/2', 'π'] as const);
    const x = at === '0' ? 0 : at === 'π' ? Math.PI : Math.PI / 2;
    const v = fn === 'sin' ? Math.cos(x) : -Math.sin(x);
    const s = Math.abs(v) < 1e-9 ? '0' : v > 0 ? '1' : '−1';
    return choice('Trig derivatives', `What is the derivative of ${fn}(x) at x = ${at}?`, s, ['−1', '0', '1'], 'd/dx sin x = cos x; d/dx cos x = −sin x.');
  },
  (r) => {
    const a = ri(r, 1, 6);
    const b = ri(r, -10, 10);
    const t = ri(r, 0, 8);
    return num('Motion', `A ball’s position is s(t) = ${poly([[a, 2], [b, 1]], 't')} metres. What is its speed (velocity) at t = ${t}?`, 2 * a * t + b, 'Velocity is the derivative of position.');
  },
  (r) => {
    const a = ri(r, 1, 6);
    const b = ri(r, 1, 6);
    const c = ri(r, -5, 5);
    const d = ri(r, -5, 5);
    const x = ri(r, -3, 3);
    // (ax + c)(bx + d) derivative = a(bx+d) + b(ax+c)
    return num('Product rule', `f(x) = (${a === 1 ? '' : a}x ${sg(c)})(${b === 1 ? '' : b}x ${sg(d)}). What is f′(${n(x)})?`, a * (b * x + d) + b * (a * x + c), "Product rule: (fg)′ = f′g + fg′.");
  },
];

export const MATH_GENS: Gen[][] = [K, G1, G2, G3, G4, G5, G6, G7, G8, G9, G10, G11, G12];
/** What each grade covers (shown on the page). */
export const MATH_GRADE_TOPICS = MATH_GENS.map((gens) => {
  const r = mulberry(7);
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) seen.add(pk(r, gens)(r).topic);
  return [...seen];
});
export const MATH_COURSE = ['', '', '', '', '', '', 'Pre-Algebra', 'Algebra', 'Algebra II', 'Geometry', 'Trigonometry', 'Pre-Calculus', 'Calculus'];

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

/** 10 different problems at a grade, mixing the types. */
export function mathRound(g: number, count = 10, r: Rng = Math.random): MathProblem[] {
  const gens = MATH_GENS[g];
  const out: MathProblem[] = [];
  const seen = new Set<string>();
  let lastTopic = '';
  for (let k = 0; out.length < count && k < count * 30; k++) {
    const p = pk(r, gens)(r);
    if (seen.has(p.q) || (p.topic === lastTopic && k < count * 10)) continue;
    seen.add(p.q);
    lastTopic = p.topic;
    out.push(p);
  }
  return out;
}

/** "3/4", "-0.75", "1 1/2", "x = 5", "$12.50", "−3" → a number (null if it isn't one). */
export function readNumber(s: string): number | null {
  let t = String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, '-')
    .replace(/^[a-z]\s*=\s*/, '')
    .replace(/[$,°%¢]/g, '')
    .replace(/π$/, '')
    .trim();
  if (!t) return null;
  const mixed = /^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (mixed) {
    const v = Number(mixed[2]) + Number(mixed[3]) / Number(mixed[4]);
    return mixed[1] ? -v : v;
  }
  t = t.replace(/\s+/g, '');
  const f = /^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/.exec(t);
  if (f) {
    const d = Number(f[2]);
    return d ? Number(f[1]) / d : null;
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}

export function checkMath(p: MathProblem, given: string): boolean {
  if (p.choices) return String(given ?? '').trim() === p.show;
  const x = readNumber(given);
  if (x === null || p.value === undefined) return false;
  const tol = p.tol ?? 1e-6;
  return [p.value, ...(p.alts ?? [])].some((v) => Math.abs(x - v) <= tol + 1e-9);
}
