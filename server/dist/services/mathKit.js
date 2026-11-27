export const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
export const pk = (r, a) => a[Math.floor(r() * a.length)];
export const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
export const lcm = (a, b) => (a / gcd(a, b)) * b;
/** −5, not -5 */
export const n = (x) => (x < 0 ? `−${-x}` : String(x));
/** "+ 3" / "− 3" for after a term */
export const sg = (x) => (x < 0 ? `− ${-x}` : `+ ${x}`);
export function frac(num, den) {
    if (den < 0)
        [num, den] = [-num, -den];
    const g = gcd(num, den) || 1;
    const a = num / g;
    const b = den / g;
    return b === 1 ? n(a) : `${n(a)}/${b}`;
}
/** 3x, x, −x */
export const cx = (c) => (c === 1 ? "" : c === -1 ? "−" : n(c));
/** + 3y, + y, − y */
export const sgx = (c) => c < 0 ? `− ${c === -1 ? "" : -c}` : `+ ${c === 1 ? "" : c}`;
export const round = (x, places) => Math.round(x * 10 ** places) / 10 ** places;
export const fmt = (x, places = 2) => n(round(x, places));
/** Tidy written-out algebra: "2x² + 0x + 3" → "2x² + 3", "7x + 0" → "7x", "1x" → "x". */
export const tidy = (q) => q
    .replace(/ [+−] 0[a-z][²³⁴⁵⁶⁷⁸⁹]?(?![a-z])/g, "")
    .replace(/(?<=[a-z²³⁴⁵⁶⁷⁸⁹]) [+−] 0(?!\d|\.\d)/g, "")
    .replace(/(?<![\d.])1([a-z])(?![a-z])/g, "$1");
export const num = (topic, q, value, hint, extra = {}) => ({
    topic,
    q: tidy(q),
    value,
    show: extra.show ?? fmt(value, extra.note?.includes("nearest tenth") ? 1 : 6),
    hint,
    ...extra,
});
export const choice = (topic, q, right, choices, hint) => ({
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
export const STUFF = [
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
export function sub(b) {
    return String(b)
        .split("")
        .map((d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)])
        .join("");
}
export const TRIPLES = [
    [3, 4, 5],
    [5, 12, 13],
    [8, 15, 17],
    [7, 24, 25],
    [20, 21, 29],
    [9, 40, 41],
];
export const SPECIAL = {
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
export const rad = (d) => (d * Math.PI) / 180;
export const term = (c, p, first = false, v = "x") => {
    const s = first ? (c < 0 ? "−" : "") : c < 0 ? " − " : " + ";
    const k = Math.abs(c);
    const body = p === 0 ? `${k}` : `${k === 1 ? "" : k}${v}${p === 1 ? "" : sup(p)}`;
    return s + body;
};
export const sup = (p) => String(p)
    .split("")
    .map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)])
    .join("");
export function poly(cs, v = "x") {
    const t = cs.filter(([c]) => c !== 0);
    return t.length ? t.map(([c, p], i) => term(c, p, i === 0, v)).join("") : "0";
}
export function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
