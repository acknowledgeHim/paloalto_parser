/**
 * ➗ More math problem types for K–5 (added to mathGen.ts's): new topics, and more kinds of problem
 * for topics that had only a few different ones (so a round of just that topic has enough).
 */
import { choice, frac, lcm, NAMES, num, pk, ri, round, STUFF, sup, } from "./mathKit.js";
const shuffle = (r, a) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
};
/** <, > or = for a ☐ b */
const cmp = (a, b) => Math.abs(a - b) < 1e-9 ? "=" : a > b ? ">" : "<";
const SIGNS = ["<", ">", "="];
const signHint = "The open side of < or > faces the bigger number.";
const WORDS = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
];
const ORDINALS = ["first", "second", "third", "fourth", "fifth"];
const ANIMALS = [
    ["🐶", "dog"],
    ["🐱", "cat"],
    ["🐭", "mouse"],
    ["🐰", "bunny"],
    ["🦊", "fox"],
    ["🐻", "bear"],
    ["🐼", "panda"],
    ["🐸", "frog"],
    ["🐵", "monkey"],
    ["🐷", "pig"],
];
const SHAPES = [
    ["🔺", "triangle", 3],
    ["🟥", "square", 4],
    ["▭", "rectangle", 4],
    ["⬟", "pentagon", 5],
    ["⬢", "hexagon", 6],
    ["🛑", "octagon", 8],
    ["⚪", "circle", 0],
];
const SIZES = [
    ["🐜", "an ant", 1],
    ["🐭", "a mouse", 2],
    ["🐱", "a cat", 3],
    ["🐶", "a big dog", 4],
    ["🐴", "a horse", 5],
    ["🐘", "an elephant", 6],
    ["🐋", "a whale", 7],
];
const FOODS = [
    ["🍕", "pizza"],
    ["🥪", "sandwich"],
    ["🎂", "cake"],
    ["🥧", "pie"],
    ["🍫", "chocolate bar"],
    ["🧇", "waffle"],
];
/** "3:05" */
const clock = (h, m) => `${((h - 1 + 12) % 12) + 1}:${String(m).padStart(2, "0")}`;
/** after adding minutes to h:m */
const later = (h, m, add) => {
    const t = h * 60 + m + add;
    return clock(Math.floor(t / 60), t % 60);
};
// ---------------- K ----------------
export const MORE_K = [
    (r) => {
        const a = ri(r, 1, 9);
        return num("Making 10", `How many more dots to fill the ten frame?\n${"🔵".repeat(a)}${"⚪".repeat(10 - a)}`, 10 - a, "Count the empty spots.");
    },
    (r) => {
        const [e, w] = pk(r, STUFF);
        const name = pk(r, NAMES);
        const a = ri(r, 1, 9);
        return num("Making 10", `${name} has ${a} ${w} ${e}. How many more to have 10?`, 10 - a, `Count up from ${a} to 10.`);
    },
    (r) => {
        const mode = ri(r, 0, 2);
        if (mode === 0) {
            const s = 2 * ri(r, 0, 5);
            return num("Patterns", `${s}, ${s + 2}, ${s + 4}, ?`, s + 6, "Each number is two more.");
        }
        if (mode === 1) {
            const s = ri(r, 5, 20);
            return num("Patterns", `${s}, ${s - 1}, ${s - 2}, ?`, s - 3, "Each number is one less — counting back.");
        }
        const s = 5 * ri(r, 0, 3);
        return num("Patterns", `${s}, ${s + 5}, ${s + 10}, ?`, s + 15, "Counting by fives.");
    },
    (r) => {
        const [a, b, c] = shuffle(r, [
            "🔴",
            "🔵",
            "🟡",
            "🟢",
            "⭐",
            "🌙",
            "❤️",
            "🟣",
        ]);
        const kind = pk(r, [
            [a, b],
            [a, a, b],
            [a, b, b],
            [a, b, c],
        ]);
        const len = ri(r, kind.length + 2, kind.length * 2 + 1);
        const shown = Array.from({ length: len }, (_, i) => kind[i % kind.length]);
        return choice("Patterns", `What comes next?\n${shown.join(" ")} ?`, kind[len % kind.length], shuffle(r, [...new Set(kind)]), "Say the pattern out loud and keep going.");
    },
    (r) => {
        const a = ri(r, 0, 20);
        if (r() < 0.5)
            return num("Numbers", `Which number is “${WORDS[a]}”?`, a, "Count up and say the number words as you go.");
        const others = shuffle(r, WORDS.filter((_, i) => i !== a)).slice(0, 2);
        return choice("Numbers", `Which word is ${a}?`, WORDS[a], shuffle(r, [WORDS[a], ...others]), "Count up and say the number words as you go.");
    },
    (r) => {
        const [e, name, sides] = pk(r, SHAPES);
        const what = pk(r, ["sides", "corners"]);
        return num("Shapes", `How many ${what} does a ${name} ${e} have?`, sides, sides
            ? `Touch each ${what === "sides" ? "side" : "corner"} and count.`
            : "A circle is round — no straight sides and no corners.");
    },
    (r) => {
        const opts = shuffle(r, SHAPES).slice(0, 3);
        const [e, name] = opts[0];
        return r() < 0.5
            ? choice("Shapes", `What shape is this? ${e}`, name, shuffle(r, opts.map((s) => s[1])), "Count the sides: 3 = triangle, 4 = square or rectangle, round = circle.")
            : choice("Shapes", `Which one is ${/^[aeiou]/.test(name) ? "an" : "a"} ${name}?`, e, shuffle(r, opts.map((s) => s[0])), "Count the sides: 3 = triangle, 4 = square or rectangle, round = circle.");
    },
    (r) => {
        const mode = ri(r, 0, 2);
        if (mode === 0) {
            const s = 10 * ri(r, 1, 6);
            return num("Counting by tens", `${s}, ${s + 10}, ${s + 20}, ?`, s + 30, "Counting by tens: 10, 20, 30, 40, 50 …");
        }
        const t = ri(r, 1, 9);
        return mode === 1
            ? num("Counting by tens", `How many tens make ${t * 10}?`, t, "Count by tens until you get there.")
            : num("Counting by tens", `${t} tens = ?`, t * 10, "Count by tens.");
    },
    (r) => {
        const a = ri(r, 1, 9);
        const mode = ri(r, 0, 2);
        if (mode === 0)
            return num("Teen numbers", `10 + ${a} = ?`, 10 + a, `Ten and ${a} more is ${WORDS[10 + a]}.`);
        if (mode === 1)
            return num("Teen numbers", `${10 + a} is 10 and how many more?`, a, "Look at the second digit — those are the extra ones.");
        return num("Teen numbers", `1 ten and ${a} ones = ?`, 10 + a, "A 1 for the ten, then the ones.");
    },
    (r) => {
        const line = shuffle(r, ANIMALS).slice(0, 5);
        const k = ri(r, 0, 4);
        return choice("First, second, third", `Who is ${ORDINALS[k]} in line? (the line starts on the left)\n${line.map((a) => a[0]).join(" ")}`, line[k][0], line.map((a) => a[0]), "Count from the left: first, second, third, fourth, fifth.");
    },
    (r) => {
        const [[e1, w1], [e2, w2]] = shuffle(r, STUFF).slice(0, 2);
        const a = ri(r, 1, 10);
        let b = ri(r, 1, 10);
        while (b === a)
            b = ri(r, 1, 10);
        const more = r() < 0.5;
        return choice("Comparing", `Which has ${more ? "more" : "fewer"}?\n${e1.repeat(a)}\n${e2.repeat(b)}`, a > b === more ? w1 : w2, [w1, w2], "Count each row, or match them up one to one.");
    },
    (r) => {
        const [x, y] = shuffle(r, SIZES).slice(0, 2);
        const big = r() < 0.5;
        const right = x[2] > y[2] === big ? x : y;
        return choice("Bigger and smaller", `Which is ${big ? "bigger" : "smaller"}: ${x[1]} ${x[0]} or ${y[1]} ${y[0]}?`, right[1], [x[1], y[1]], "Picture them standing side by side.");
    },
    (r) => {
        const [e] = pk(r, STUFF);
        const a = ri(r, 1, 5);
        const b = ri(r, 1, 5);
        return num("Adding", `${e.repeat(a)} + ${e.repeat(b)} = ?`, a + b, "Count them all together.");
    },
];
// ---------------- 1 ----------------
export const MORE_1 = [
    (r) => {
        const a = ri(r, 1, 10);
        return r() < 0.5
            ? num("Doubles", `${a} + ${a} = ?`, 2 * a, "Doubles: the same number twice.")
            : num("Doubles", `${a} + ${a + 1} = ?`, 2 * a + 1, `Near doubles: ${a} + ${a} = ${2 * a}, then one more.`);
    },
    (r) => {
        const c = ri(r, 0, 10);
        const b = ri(r, 1, 20 - c);
        return r() < 0.5
            ? num("Missing number", `? − ${b} = ${c}`, b + c, `Think addition: ${c} + ${b} = ?`)
            : num("Missing number", `${b + c} − ? = ${c}`, b, `How far is it from ${c} up to ${b + c}?`);
    },
    (r) => {
        const h = ri(r, 1, 12);
        const half = r() < 0.5;
        const right = clock(h, half ? 30 : 0);
        const q = half
            ? `🕐 The short hand is halfway between ${h} and ${(h % 12) + 1}. The long hand points to 6. What time is it?`
            : `🕐 The short hand points to ${h}. The long hand points to 12. What time is it?`;
        return choice("Time", q, right, shuffle(r, [
            right,
            clock(h, half ? 0 : 30),
            clock(h + 1, half ? 30 : 0),
            clock(h + 6, 0),
        ]), "The short hand tells the hour. Long hand on 12 = o’clock; on 6 = half past.");
    },
    (r) => {
        const h = ri(r, 1, 12);
        const k = ri(r, 1, 4);
        const right = clock(h + k, 0);
        return choice("Time", `It is ${clock(h, 0)}. What time will it be in ${k} hour${k === 1 ? "" : "s"}?`, right, shuffle(r, [
            right,
            clock(h + k + 1, 0),
            clock(h - k, 0),
            clock(h + k, 30),
        ]), "Move the short hand forward one number for each hour.");
    },
    (r) => {
        const d = ri(r, 0, 5);
        const ni = ri(r, 0, 4);
        const p = ri(r, d + ni ? 0 : 1, 9);
        const parts = [
            d && `${d} dime${d === 1 ? "" : "s"}`,
            ni && `${ni} nickel${ni === 1 ? "" : "s"}`,
            p && `${p} penn${p === 1 ? "y" : "ies"}`,
        ].filter(Boolean);
        const said = parts.length > 1
            ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
            : parts[0];
        return num("Coins", `🪙 ${said}. How many cents is that?`, 10 * d + 5 * ni + p, "Dime = 10¢, nickel = 5¢, penny = 1¢. Count the big coins first.");
    },
    (r) => {
        const [e, food] = pk(r, FOODS);
        const mode = ri(r, 0, 2);
        if (mode === 2) {
            const which = pk(r, [
                ["halves", 2],
                ["fourths", 4],
            ]);
            return num("Equal shares", `How many ${which[0]} make a whole ${food} ${e}?`, which[1], `${which[1]} equal parts make the whole.`);
        }
        const parts = pk(r, [2, 4]);
        const q = mode === 0
            ? `A ${food} ${e} is cut into ${parts} equal parts. What is each part called?`
            : `${parts === 2 ? "Two" : "Four"} friends share a ${food} ${e} equally. Each gets …`;
        return choice("Equal shares", q, parts === 2 ? "a half" : "a fourth", ["a half", "a fourth"], "2 equal parts = halves. 4 equal parts = fourths (quarters).");
    },
    (r) => {
        const a = ri(r, 99, 119);
        return r() < 0.5
            ? num("Counting to 120", `What number comes right after ${a}?`, a + 1, "Count up one.")
            : num("Counting to 120", `What number comes right before ${a + 1}?`, a, "Count back one.");
    },
    (r) => {
        const s = ri(r, 1, 80);
        return num("Counting to 120", `Count by tens: ${s}, ${s + 10}, ${s + 20}, ?`, s + 30, "The ones digit stays the same; the tens go up by one.");
    },
    (r) => {
        const t = ri(r, 1, 9);
        const o = ri(r, 0, 9);
        const tens = r() < 0.5;
        return num("Tens and ones", `In ${t * 10 + o}, what digit is in the ${tens ? "tens" : "ones"} place?`, tens ? t : o, "The first digit is the tens, the last is the ones.");
    },
    (r) => {
        const [x, y] = shuffle(r, [
            "pencil ✏️",
            "crayon 🖍️",
            "spoon 🥄",
            "key 🔑",
            "paintbrush 🖌️",
            "carrot 🥕",
        ]).slice(0, 2);
        const a = ri(r, 4, 12);
        const b = ri(r, 2, a - 1);
        return num("Measuring", `A ${x} is ${a} paper clips long. A ${y} is ${b} paper clips long. How many paper clips longer is the ${x.split(" ")[0]}?`, a - b, `Longer by: ${a} − ${b}.`);
    },
    (r) => {
        const a = ri(r, 1, 9);
        const b = ri(r, 1, 9);
        const c = ri(r, 1, 9);
        const q = `Favorite fruit votes: 🍎 ${a} · 🍌 ${b} · 🍇 ${c}.`;
        if (r() < 0.5)
            return num("Charts", `${q} How many votes in all?`, a + b + c, "Add all three.");
        const [hi, lo] = a >= b
            ? [
                ["🍎", a],
                ["🍌", b],
            ]
            : [
                ["🍌", b],
                ["🍎", a],
            ];
        return num("Charts", `${q} How many more voted ${hi[0]} than ${lo[0]}?`, hi[1] - lo[1], "Subtract the smaller from the bigger.");
    },
    (r) => {
        const a = ri(r, 1, 8);
        const b = ri(r, 1, 9 - a);
        return r() < 0.5
            ? num("Adding tens", `${a * 10} + ${b * 10} = ?`, (a + b) * 10, `${a} ten${a === 1 ? "" : "s"} + ${b} ten${b === 1 ? "" : "s"} = ${a + b} tens.`)
            : num("Adding tens", `${(a + b) * 10} − ${b * 10} = ?`, a * 10, `${a + b} tens − ${b} ten${b === 1 ? "" : "s"} = ${a} ten${a === 1 ? "" : "s"}.`);
    },
    (r) => {
        const a = ri(r, 11, 89);
        if (r() < 0.5) {
            const d = ri(r, 1, 9);
            return num("Adding within 100", `${a} + ${d} = ?`, a + d, "Add the ones. If they make 10 or more, that’s one more ten.");
        }
        const t = 10 * ri(r, 1, Math.floor((99 - a) / 10) || 1);
        return num("Adding within 100", `${a} + ${t} = ?`, a + t, "Adding tens: only the tens digit changes.");
    },
];
// ---------------- 2 ----------------
export const MORE_2 = [
    (r) => {
        const [e] = pk(r, STUFF);
        const rows = ri(r, 2, 5);
        const cols = ri(r, 2, 5);
        return num("Equal groups", `How many in all? ${rows} rows of ${cols}.\n${Array.from({ length: rows }, () => e.repeat(cols)).join("\n")}`, rows * cols, `Skip count by ${cols}, once for each row.`);
    },
    (r) => {
        const c = ri(r, 2, 10);
        const k = ri(r, 2, 5);
        return num("Equal groups", `${Array(k).fill(c).join(" + ")} = ?`, c * k, `${k} groups of ${c}: skip count by ${c}.`);
    },
    (r) => {
        const step = pk(r, [2, 5, 10, 100]);
        const s = step * ri(r, 4, step === 100 ? 9 : 20);
        return num("Skip counting", `Count back: ${s}, ${s - step}, ${s - 2 * step}, ?`, s - 3 * step, `Each number is ${step} less.`);
    },
    (r) => {
        const a = ri(r, 100, 899);
        const step = pk(r, [10, 100]);
        return r() < 0.5
            ? num("Ten more, hundred more", `What is ${step} more than ${a}?`, a + step, `Only the ${step === 10 ? "tens" : "hundreds"} digit goes up (carry if it passes 9).`)
            : num("Ten more, hundred more", `What is ${step} less than ${a + step}?`, a, `Only the ${step === 10 ? "tens" : "hundreds"} digit goes down.`);
    },
    (r) => {
        const k = ri(r, 1, 11);
        return num("Time", `🕐 The long hand points to ${k}. How many minutes past the hour is it?`, 5 * k, "Each number on the clock is 5 minutes: count by fives.");
    },
    (r) => {
        const h = ri(r, 1, 12);
        const m = 5 * ri(r, 0, 11);
        const add = 5 * ri(r, 2, 9);
        const right = later(h, m, add);
        return choice("Time", `It is ${clock(h, m)}. What time will it be in ${add} minutes?`, right, shuffle(r, [
            right,
            later(h, m, add + 5),
            later(h, m, add - 5),
            later(h, m, add + 60),
        ]), "Count on by fives. 60 minutes is 1 hour.");
    },
    (r) => {
        const mode = ri(r, 0, 2);
        if (mode === 0) {
            const a = ri(r, 1, 5);
            return num("Length", `1 foot = 12 inches. How many inches is ${a} feet?`, 12 * a, `${a} groups of 12.`);
        }
        if (mode === 1) {
            const a = ri(r, 1, 9);
            return num("Length", `1 meter = 100 centimeters. How many centimeters is ${a} meters?`, 100 * a, `${a} hundreds.`);
        }
        const a = ri(r, 20, 95);
        const b = ri(r, 5, a - 5);
        return num("Length", `A ribbon is ${a} cm long. ${pk(r, NAMES)} cuts off ${b} cm. How long is it now?`, a - b, `${a} − ${b}.`);
    },
    (r) => {
        const a = ri(r, 100, 999);
        let b = r() < 0.2 ? a : ri(r, 100, 999);
        if (r() < 0.3)
            b = Math.min(999, Math.max(100, a + pk(r, [-10, 10, -1, 1, 100, -100])));
        return choice("Comparing", `${a} ☐ ${b}\nWhich sign goes in the box?`, cmp(a, b), SIGNS, "Compare hundreds, then tens, then ones. " + signHint);
    },
    (r) => {
        const [e, food] = pk(r, FOODS);
        const parts = pk(r, [2, 3, 4]);
        const name = { 2: "a half", 3: "a third", 4: "a fourth" }[parts];
        if (r() < 0.4)
            return num("Equal shares", `How many ${{ 2: "halves", 3: "thirds", 4: "fourths" }[parts]} make a whole ${food} ${e}?`, parts, `${parts} equal parts make one whole.`);
        return choice("Equal shares", `A ${food} ${e} is cut into ${parts} equal parts. Each part is …`, name, ["a half", "a third", "a fourth"], "2 parts: halves · 3 parts: thirds · 4 parts: fourths.");
    },
    (r) => {
        const h = ri(r, 1, 9);
        const t = ri(r, 0, 9);
        const o = ri(r, 0, 9);
        if (r() < 0.5)
            return num("Expanded form", `${h * 100} + ${t * 10} + ${o} = ?`, h * 100 + t * 10 + o, "Hundreds, then tens, then ones.");
        const v = h * 100 + t * 10 + o;
        const which = pk(r, [
            ["hundreds", h * 100, h],
            ["tens", t * 10, t],
            ["ones", o, o],
        ]);
        return num("Expanded form", `What is the ${which[2]} in ${v} worth? (It’s in the ${which[0]} place.)`, which[1], "A digit is worth its place: that many hundreds, tens or ones.");
    },
    (r) => {
        const [, w] = pk(r, STUFF);
        const have = pk(r, [50, 100]);
        const c = ri(r, 5, have - 1);
        return num("Money", `You have ${have === 100 ? "$1 (100¢)" : "50¢"}. You buy ${w} for ${c}¢. How many cents do you get back?`, have - c, `Change = ${have} − ${c}. Count up from ${c} to ${have}.`);
    },
    (r) => {
        const [x, y, z] = shuffle(r, NAMES).slice(0, 3);
        const a = ri(r, 5, 30);
        const b = ri(r, 5, 30);
        const c = ri(r, 5, 30);
        const q = `📚 Books read this year: ${x} ${a} · ${y} ${b} · ${z} ${c}.`;
        if (r() < 0.4)
            return num("Charts", `${q} How many in all?`, a + b + c, "Add all three.");
        const [hi, lo] = a >= b ? [x, y] : [y, x];
        return num("Charts", `${q} How many more did ${hi} read than ${lo}?`, Math.abs(a - b), "Subtract the smaller from the bigger.");
    },
    (r) => {
        const a = ri(r, 15, 50);
        const b = ri(r, 2, a - 5);
        const c = ri(r, 2, 20);
        return r() < 0.5
            ? num("Two-step problems", `🚌 A bus has ${a} people. At a stop ${b} get off and ${c} get on. How many are on the bus now?`, a - b + c, `First ${a} − ${b}, then add ${c}.`)
            : num("Two-step problems", `${pk(r, NAMES)} had ${a} stickers, got ${c} more, then gave ${b} away. How many now?`, a + c - b, `First ${a} + ${c}, then take away ${b}.`);
    },
];
// ---------------- 3 ----------------
export const MORE_3 = [
    (r) => {
        const b = ri(r, 2, 10);
        const k = ri(r, 1, 12);
        return num("Fractions of a number", `What is 1/${b} of ${b * k}?`, k, `1/${b} of a number: divide it into ${b} equal groups.`);
    },
    (r) => {
        const b = pk(r, [2, 3, 4, 5, 6, 8, 10]);
        const a = ri(r, 1, b - 1);
        const k = ri(r, 2, 10);
        return num("Fractions of a number", `What is ${a}/${b} of ${b * k}?`, a * k, `Find 1/${b} first (${b * k} ÷ ${b} = ${k}), then take ${a} of them.`);
    },
    (r) => {
        if (r() < 0.5) {
            const d = ri(r, 2, 12);
            const a = ri(r, 1, d);
            const b = ri(r, 1, d);
            return choice("Comparing fractions", `${a}/${d} ☐ ${b}/${d}`, cmp(a, b), SIGNS, `Same size pieces: more pieces is more. ${signHint}`);
        }
        const a = ri(r, 1, 5);
        const d1 = ri(r, a + 1, 12);
        const d2 = ri(r, a + 1, 12);
        return choice("Comparing fractions", `${a}/${d1} ☐ ${a}/${d2}`, cmp(a / d1, a / d2), SIGNS, `Same number of pieces: the bigger the bottom number, the smaller each piece. ${signHint}`);
    },
    (r) => {
        const b = pk(r, [2, 3, 4, 6]);
        const a = ri(r, 1, b - 1);
        const k = ri(r, 2, 4);
        return num("Equivalent fractions", `${a}/${b} = ?/${b * k}`, a * k, `The bottom was multiplied by ${k}, so do the same to the top.`);
    },
    (r) => {
        const a = ri(r, 2, 9);
        const b = ri(r, 1, 9);
        return num("Multiplying by tens", `${a} × ${b * 10} = ?`, a * b * 10, `${a} × ${b} = ${a * b}, then add a zero.`);
    },
    (r) => {
        const w1 = ri(r, 4, 10);
        const h1 = ri(r, 2, 4);
        const w2 = ri(r, 2, w1 - 1);
        const h2 = ri(r, 2, 6);
        return num("Area", `An L-shape is made of a ${w1} × ${h1} rectangle and a ${w2} × ${h2} rectangle. What is its area in square units?`, w1 * h1 + w2 * h2, `Find each rectangle's area and add: ${w1 * h1} + ${w2 * h2}.`);
    },
    (r) => {
        const h = ri(r, 1, 11);
        const m1 = 5 * ri(r, 0, 9);
        const len = 5 * ri(r, 3, 15);
        return num("Time", `A show starts at ${clock(h, m1)} and ends at ${later(h, m1, len)}. How many minutes long is it?`, len, "Count on to the next hour, then on to the end time.");
    },
    (r) => {
        const name = pk(r, NAMES);
        const a = ri(r, 2, 9);
        const b = ri(r, 2, 9);
        return pk(r, [
            () => num("Mass and liquid volume", `A bag of rice weighs ${a} kg. How many kilograms do ${b} bags weigh?`, a * b, `${b} × ${a}.`),
            () => num("Mass and liquid volume", `A jug holds ${a} liters. ${name} fills ${b} jugs. How many liters is that?`, a * b, `${b} × ${a}.`),
            () => num("Mass and liquid volume", `A tank has ${a * b} liters. It is poured equally into ${b} buckets. How many liters in each?`, a, `${a * b} ÷ ${b}.`),
            () => num("Mass and liquid volume", `A box weighs ${a + b + 10} kg. ${name} takes out ${b} kg. How much is left?`, a + 10, "Subtract."),
        ])();
    },
    (r) => {
        const a = ri(r, 2, 9);
        const b = ri(r, 2, 9);
        const mode = ri(r, 0, 2);
        if (mode === 0)
            return num("Properties", `${a} × ${b} = ${b} × ?`, a, "You can swap the order when you multiply.");
        if (mode === 1) {
            const c = ri(r, 2, 5);
            return num("Properties", `(${a} × ${c}) × ${b} = ${a} × (${c} × ?)`, b, "You can group the numbers either way when you multiply.");
        }
        const s = ri(r, 1, b - 1);
        return num("Properties", `${a} × ${b} = ${a} × ${s} + ${a} × ?`, b - s, `Break ${b} into ${s} + ${b - s}.`);
    },
    (r) => {
        const name = pk(r, NAMES);
        const p = ri(r, 2, 9);
        const c = ri(r, 3, 10);
        const d = ri(r, 1, p * c - 1);
        return r() < 0.5
            ? num("Two-step problems", `${name} buys ${p} packs of ${c} stickers and gives away ${d}. How many are left?`, p * c - d, `${p} × ${c} first, then subtract ${d}.`)
            : num("Two-step problems", `${name} has ${p} bags with ${c} marbles each and finds ${d} more. How many marbles?`, p * c + d, `${p} × ${c} first, then add ${d}.`);
    },
    (r) => {
        const k = pk(r, [2, 5, 10]);
        const a = ri(r, 1, 9);
        const b = ri(r, 1, 9);
        const [x, y] = shuffle(r, [
            "🍕 Pizza",
            "🌮 Tacos",
            "🍝 Pasta",
            "🍔 Burgers",
            "🥗 Salad",
        ]).slice(0, 2);
        const q = `Picture graph — each ⭐ = ${k} votes.\n${x}: ${"⭐".repeat(a)}\n${y}: ${"⭐".repeat(b)}`;
        if (r() < 0.5 || a === b)
            return num("Picture graphs", `${q}\nHow many votes for ${x}?`, a * k, `${a} stars × ${k}.`);
        return num("Picture graphs", `${q}\nHow many more votes for ${a > b ? x : y}?`, Math.abs(a - b) * k, `${Math.abs(a - b)} more stars, and each is ${k}.`);
    },
    (r) => {
        if (r() < 0.5) {
            const [desc, right] = pk(r, [
                ["4 equal sides and 4 right angles", "square"],
                ["4 right angles, but only opposite sides equal", "rectangle"],
                ["4 equal sides, but no right angles", "rhombus"],
                ["exactly one pair of parallel sides", "trapezoid"],
                ["2 pairs of parallel sides and no right angles", "parallelogram"],
            ]);
            return choice("Shapes", `Which shape has ${desc}?`, right, ["square", "rectangle", "rhombus", "trapezoid", "parallelogram"], "Check the sides first, then look for right (square) corners.");
        }
        const [e, name, sides] = pk(r, SHAPES.filter((s) => s[2] > 0));
        const what = pk(r, ["sides", "angles", "corners (vertices)"]);
        return num("Shapes", `How many ${what} does a ${name} ${e} have?`, sides, "A polygon has the same number of sides, angles and corners.");
    },
];
// ---------------- 4 ----------------
const isPrime = (x) => {
    if (x < 2)
        return false;
    for (let d = 2; d * d <= x; d++)
        if (x % d === 0)
            return false;
    return true;
};
const factorCount = (x) => {
    let c = 0;
    for (let d = 1; d <= x; d++)
        if (x % d === 0)
            c++;
    return c;
};
export const MORE_4 = [
    (r) => {
        const x = ri(r, 2, 100);
        return choice("Prime and composite", `Is ${x} prime or composite?`, isPrime(x) ? "prime" : "composite", ["prime", "composite"], "Prime: only 1 and itself go into it. Try 2, 3, 5, 7.");
    },
    (r) => {
        if (r() < 0.5) {
            const x = ri(r, 2, 60);
            return num("Factors", `How many factors does ${x} have?`, factorCount(x), "List them in pairs: 1 × ?, 2 × ?, … until the pairs meet.");
        }
        const a = ri(r, 2, 12);
        const b = r() < 0.5 ? a * ri(r, 2, 9) : ri(r, 10, 100);
        return choice("Factors", `Is ${a} a factor of ${b}?`, b % a === 0 ? "yes" : "no", ["yes", "no"], `Does ${b} ÷ ${a} come out even?`);
    },
    (r) => {
        if (r() < 0.5) {
            const a = ri(r, 1, 99);
            return num("Decimals (hundredths)", `Write ${a}/100 as a decimal.`, a / 100, "Hundredths go two places after the point.", { show: (a / 100).toFixed(2) });
        }
        const a = ri(r, 0, 9);
        const b = ri(r, 1, 9);
        return num("Decimals (hundredths)", `${a}/10 + ${b}/100 = ? (as a decimal)`, round(a / 10 + b / 100, 2), "Tenths in the first place after the point, hundredths in the second.", { show: (a / 10 + b / 100).toFixed(2) });
    },
    (r) => {
        const a = ri(r, 1, 99) / 100;
        let b = r() < 0.5 ? ri(r, 1, 9) / 10 : ri(r, 1, 99) / 100;
        if (r() < 0.15)
            b = a;
        const s = (x) => Math.round(x * 100) % 10 === 0 ? x.toFixed(1) : x.toFixed(2);
        return choice("Comparing decimals", `${s(a)} ☐ ${s(b)}`, cmp(a, b), SIGNS, `Compare tenths first, then hundredths (0.5 = 0.50). ${signHint}`);
    },
    (r) => {
        const d = ri(r, 3, 12);
        const a = ri(r, 2, d);
        const b = ri(r, 1, a - 1);
        return num("Subtracting fractions", `${a}/${d} − ${b}/${d} = ?`, (a - b) / d, "Same bottom: subtract the tops, keep the bottom.", { show: `${a - b}/${d}`, note: "Answer as a fraction (like 3/8)." });
    },
    (r) => {
        const d = pk(r, [2, 3, 4, 5, 6, 8]);
        const w = ri(r, 1, 5);
        const a = ri(r, 1, d - 1);
        return r() < 0.5
            ? num("Mixed numbers", `${w} ${a}/${d} = ?/${d}`, w * d + a, `${w} whole${w === 1 ? "" : "s"} = ${w * d}/${d}; add ${a} more.`)
            : num("Mixed numbers", `${w * d + a}/${d} = ? whole${w === 1 ? "" : "s"} and ${a}/${d}. How many wholes?`, w, `How many ${d}s fit in ${w * d + a}?`);
    },
    (r) => {
        const mode = ri(r, 0, 2);
        if (mode === 0) {
            const a = ri(r, 10, 80);
            return num("Angles", `A right angle (90°) is split into two angles. One is ${a}°. What is the other?`, 90 - a, "They add to 90°.");
        }
        if (mode === 1) {
            const a = ri(r, 10, 170);
            return num("Angles", `A straight line (180°) is split into two angles. One is ${a}°. What is the other?`, 180 - a, "They add to 180°.");
        }
        const k = ri(r, 1, 4);
        return num("Angles", `How many degrees is ${k} quarter turn${k === 1 ? "" : "s"}?`, 90 * k, "A quarter turn is 90°; a full turn is 360°.");
    },
    (r) => {
        const l = ri(r, 3, 15);
        const w = ri(r, 2, 12);
        return r() < 0.5
            ? num("Area and perimeter", `A rectangle has an area of ${l * w} square feet. Its length is ${l} feet. What is its width?`, w, `Area = length × width, so width = ${l * w} ÷ ${l}.`)
            : num("Area and perimeter", `A rectangle's perimeter is ${2 * (l + w)} m. Its length is ${l} m. What is its width?`, w, `Half the perimeter is length + width = ${l + w}.`);
    },
    (r) => {
        const [big, small, k] = pk(r, [
            ["feet", "inches", 12],
            ["yards", "feet", 3],
            ["hours", "minutes", 60],
            ["minutes", "seconds", 60],
            ["kilograms", "grams", 1000],
            ["liters", "milliliters", 1000],
            ["meters", "centimeters", 100],
            ["days", "hours", 24],
            ["weeks", "days", 7],
        ]);
        const a = ri(r, 2, 9);
        return num("Converting units", `${a} ${big} = ? ${small}`, a * k, `1 ${big.replace(/s$/, "").replace("feet", "foot")} = ${k} ${small}, so multiply by ${k}.`);
    },
    (r) => {
        const d = pk(r, [2, 3, 4, 5, 6, 8, 10]);
        const b = ri(r, 1, d - 1);
        const a = ri(r, 2, 9);
        return num("Fractions times whole numbers", `${a} × ${b}/${d} = ?`, (a * b) / d, `Multiply the top: ${a} × ${b} = ${a * b}, keep the bottom.`, { show: frac(a * b, d) });
    },
    (r) => {
        const d = ri(r, 3, 9);
        const q = ri(r, 2, 12);
        const rem = ri(r, 1, d - 1);
        return num("Remainders", `${q * d + rem} ÷ ${d} = ${q} R ?`, rem, `${d} × ${q} = ${q * d}; what's left over?`);
    },
    (r) => {
        const s = ri(r, 1, 20);
        const k = ri(r, 2, 12);
        const nth = ri(r, 4, 8);
        return num("Number patterns", `Start at ${s} and add ${k} each time. What is number ${nth} in the pattern? (${s} is number 1)`, s + (nth - 1) * k, `Add ${k} a total of ${nth - 1} times.`);
    },
];
// ---------------- 5 ----------------
export const MORE_5 = [
    (r) => {
        const b = ri(r, 2, 10);
        const w = ri(r, 2, 9);
        return num("Dividing by a fraction", `1/${b} ÷ ${w} = ?`, 1 / (b * w), `Split each 1/${b} into ${w} parts: 1/(${b} × ${w}).`, { show: `1/${b * w}`, note: "Answer as a fraction." });
    },
    (r) => {
        const mode = ri(r, 0, 2);
        if (mode === 0) {
            const a = ri(r, 1, 10);
            return num("Exponents", `${a}³ = ?`, a ** 3, `${a} × ${a} × ${a}.`);
        }
        if (mode === 1) {
            const p = ri(r, 1, 10);
            return num("Exponents", `2${sup(p)} = ?`, 2 ** p, `Multiply ${p} twos: 2 × 2 × …`);
        }
        const a = ri(r, 2, 12);
        return num("Exponents", `${a}² = ?`, a * a, `${a} × ${a}.`);
    },
    (r) => {
        const a = ri(r, 200, 999) / 100;
        const b = ri(r, 10, Math.floor(a * 100) - 10) / 100;
        return num("Subtracting decimals", `${a.toFixed(2)} − ${b.toFixed(2)} = ?`, round(a - b, 2), "Line up the decimal points; borrow just like whole numbers.");
    },
    (r) => {
        const d = ri(r, 2, 9);
        const q = ri(r, 11, 99) / 10;
        return num("Dividing decimals", `${round(q * d, 1)} ÷ ${d} = ?`, q, "Divide like whole numbers; put the point straight above.");
    },
    (r) => {
        const b = pk(r, [2, 3, 4, 5, 6, 8]);
        let d = pk(r, [2, 3, 4, 5, 6, 8, 10, 12]);
        while (d === b)
            d = pk(r, [3, 4, 6, 8, 10, 12]);
        const a = ri(r, 1, b - 1);
        const c = ri(r, 1, d - 1);
        const [x, y] = a / b >= c / d
            ? [
                [a, b],
                [c, d],
            ]
            : [
                [c, d],
                [a, b],
            ];
        if (x[0] / x[1] === y[0] / y[1])
            return num("Subtracting fractions", `${x[0]}/${x[1]} − ${y[0]}/${y[1]} = ?`, 0, "They are equal, so the answer is 0.");
        const L = lcm(x[1], y[1]);
        return num("Subtracting fractions", `${x[0]}/${x[1]} − ${y[0]}/${y[1]} = ?`, x[0] / x[1] - y[0] / y[1], `Make the bottoms match (${L}), then subtract the tops.`, { show: frac(x[0] * (L / x[1]) - y[0] * (L / y[1]), L) });
    },
    (r) => {
        const x = ri(r, 0, 9);
        const y = ri(r, 0, 9);
        const a = ri(r, 1, 6);
        const b = ri(r, 1, 6);
        const mode = ri(r, 0, 2);
        if (mode === 2) {
            const y2 = ri(r, 0, 9);
            return num("Coordinate plane", `How far apart are the points (${x}, ${Math.min(y, y2)}) and (${x}, ${Math.max(y, y2) + 1})?`, Math.abs(y - y2) + 1, "Same x: count the steps up and down (subtract the y’s).");
        }
        return num("Coordinate plane", `Start at (${x}, ${y}). Move ${a} right and ${b} up. What is the new ${mode ? "y" : "x"}?`, mode ? y + b : x + a, "Right/left changes x (the first number); up/down changes y.");
    },
    (r) => {
        const v = ri(r, 1000, 99999) / 1000;
        const [name, p] = pk(r, [
            ["whole number", 0],
            ["tenth", 1],
            ["hundredth", 2],
        ]);
        const ans = round(v, p);
        return num("Rounding decimals", `Round ${v.toFixed(3)} to the nearest ${name}.`, ans, "Look one place to the right: 5 or more rounds up.", { show: ans.toFixed(p) });
    },
    (r) => {
        return pk(r, [
            () => {
                const a = ri(r, 1, 99) / 10;
                return num("Converting units", `${a} m = ? cm`, round(a * 100, 2), "1 m = 100 cm: move the point 2 places right.");
            },
            () => {
                const a = ri(r, 1, 99) * 100;
                return num("Converting units", `${a.toLocaleString("en-US")} g = ? kg`, a / 1000, "1,000 g = 1 kg: move the point 3 places left.");
            },
            () => {
                const a = ri(r, 1, 39) * 50;
                return num("Converting units", `${a.toLocaleString("en-US")} mL = ? L`, a / 1000, "1,000 mL = 1 L.");
            },
            () => {
                const a = ri(r, 1, 50) / 10;
                return num("Converting units", `${a} km = ? m`, round(a * 1000, 2), "1 km = 1,000 m.");
            },
        ])();
    },
    (r) => {
        const d = pk(r, [2, 3, 4, 5, 6, 8]);
        const w1 = ri(r, 1, 5);
        const w2 = ri(r, 1, 5);
        const a = ri(r, 1, d - 1);
        const b = ri(r, 1, d - 1);
        const v = w1 + w2 + (a + b) / d;
        return num("Mixed numbers", `${w1} ${a}/${d} + ${w2} ${b}/${d} = ?`, v, "Add the wholes, add the fractions; if the fraction is more than 1, carry a whole.", {
            show: (a + b) % d === 0
                ? String(v)
                : `${Math.floor(v)} ${frac((a + b) % d, d)}`,
            note: "A mixed number like 3 1/4 is fine.",
        });
    },
    (r) => {
        const d = ri(r, 11, 49);
        const q = ri(r, 10, 40);
        return num("Dividing by 2-digit numbers", `${q * d} ÷ ${d} = ?`, q, `Estimate: how many ${d}s in ${q * d}? Try ${d} × ${Math.round(q / 10) * 10 || 10}.`);
    },
    (r) => {
        const a = ri(r, 1, 999) / 1000;
        let b = r() < 0.5 ? ri(r, 1, 99) / 100 : ri(r, 1, 999) / 1000;
        if (r() < 0.15)
            b = a;
        return choice("Comparing decimals", `${a} ☐ ${b}`, cmp(a, b), SIGNS, `Line up the points; compare tenths, then hundredths, then thousandths. ${signHint}`);
    },
];
