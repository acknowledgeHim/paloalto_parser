/**
 * ➗ More math problem types for 6–12 (added to mathGen.ts's): new topics, and more kinds of problem
 * for topics that had only a few different ones (so a round of just that topic has enough).
 */
import {
  choice,
  cx,
  frac,
  gcd,
  n,
  NAMES,
  num,
  pk,
  poly,
  ri,
  round,
  sg,
  sub,
  sup,
  tenth,
  TRIPLES,
  type Gen,
  type Rng,
} from "./mathKit.js";

const shuffle = <T>(r: Rng, a: readonly T[]): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const asFrac = { note: "A fraction like 2/3 is fine." };
const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
const C = (nn: number, k: number) =>
  Math.round(fact(nn) / (fact(k) * fact(nn - k)));
/** a triple scaled by k, legs shuffled */
const triple = (r: Rng, maxK = 1) => {
  const [a, b, c] = pk(r, TRIPLES.slice(0, 4));
  const k = ri(r, 1, maxK);
  return r() < 0.5 ? [a * k, b * k, c * k] : [b * k, a * k, c * k];
};

// ---------------- 6 · Pre-Algebra ----------------
export const MORE_6: Gen[] = [
  (r) => {
    if (r() < 0.5) {
      const a = ri(r, 2, 9);
      const p = a <= 4 ? ri(r, 2, 5) : ri(r, 2, 3);
      return num(
        "Exponents",
        `${a}${sup(p)} = ?`,
        a ** p,
        `${a} multiplied by itself ${p} times.`,
      );
    }
    const a = ri(r, 2, 6);
    const b = ri(r, 2, 9);
    return num(
      "Exponents",
      `${a}² × ${b} = ?`,
      a * a * b,
      `Exponent first (${a}² = ${a * a}), then multiply.`,
    );
  },
  (r) => {
    const b = ri(r, 2, 20);
    const h = ri(r, 2, 15);
    return pk(r, [
      () =>
        num(
          "Area",
          `A triangle has base ${b * 2} cm and height ${h} cm. What is its area in cm²?`,
          b * h,
          "Triangle: ½ × base × height.",
        ),
      () =>
        num(
          "Area",
          `A parallelogram has base ${b} m and height ${h} m. What is its area in m²?`,
          b * h,
          "Parallelogram: base × height.",
        ),
      () => {
        const t = b + 2 * ri(r, 1, 5);
        return num(
          "Area",
          `A trapezoid has parallel sides ${b} and ${t} and height ${h * 2}. What is its area?`,
          (b + t) * h,
          "Trapezoid: ½ × (top + bottom) × height.",
        );
      },
    ])();
  },
  (r) => {
    const a = ri(r, 1, 9);
    const b = ri(r, 2, 10);
    const c = ri(r, 1, 9);
    const d = ri(r, 2, 10);
    return num(
      "Dividing fractions",
      `${frac(a, b)} ÷ ${frac(c, d)} = ?`,
      (a * d) / (b * c),
      "Keep, change, flip: multiply by the flipped second fraction.",
      { show: frac(a * d, b * c), ...asFrac },
    );
  },
  (r) => {
    if (r() < 0.5) {
      const p = ri(r, 1, 150);
      return num(
        "Percent",
        `Write ${p}% as a decimal.`,
        p / 100,
        "Percent means “out of 100”: divide by 100 (move the point 2 left).",
      );
    }
    const b = pk(r, [2, 4, 5, 10, 20, 25, 50]);
    const a = ri(r, 1, b - 1);
    return num(
      "Percent",
      `Write ${a}/${b} as a percent.`,
      (a / b) * 100,
      `Make the bottom 100: × ${100 / b} on top and bottom.`,
      { note: "Just the number (like 40)." },
    );
  },
  (r) => {
    const a = ri(r, 2, 15);
    const b = ri(r, a + 1, 40);
    if (r() < 0.5)
      return num(
        "Inequalities",
        `x + ${a} > ${b}. What is the smallest whole number x can be?`,
        b - a + 1,
        `x > ${b - a}, so the next whole number up.`,
      );
    const k = ri(r, 2, 9);
    const m = ri(r, 10, 80);
    return num(
      "Inequalities",
      `${k}x ≤ ${m}. What is the largest whole number x can be?`,
      Math.floor(m / k),
      `x ≤ ${m} ÷ ${k} = ${round(m / k, 2)}, so round down.`,
    );
  },
  (r) => {
    const len = pk(r, [5, 7]);
    const xs = Array.from({ length: len }, () => ri(r, 1, 30));
    const kind = pk(r, ["median", "range", "mode"] as const);
    if (kind === "mode") {
      const m = xs[0];
      xs[1] = m;
      xs[2] = m;
      const others = new Set<number>();
      for (let i = 3; i < len; i++) {
        let v = ri(r, 1, 30);
        while (v === m || others.has(v)) v = ri(r, 1, 30);
        others.add(v);
        xs[i] = v;
      }
    }
    const list = shuffle(r, xs);
    const sorted = [...xs].sort((a, b) => a - b);
    const v =
      kind === "median"
        ? sorted[(len - 1) / 2]
        : kind === "range"
          ? sorted[len - 1] - sorted[0]
          : xs[0];
    const hint = {
      median: "Put them in order; the median is the middle one.",
      range: "Range = biggest − smallest.",
      mode: "The mode is the number that shows up most.",
    }[kind];
    return num(
      "Median, mode, range",
      `What is the ${kind} of ${list.join(", ")}?`,
      v,
      hint,
    );
  },
  (r) => {
    const l = ri(r, 2, 12);
    const w = ri(r, 2, 10);
    const h = ri(r, 2, 10);
    return r() < 0.5
      ? num(
          "Volume",
          `A box is ${l} × ${w} × ${h} inches. What is its volume in cubic inches?`,
          l * w * h,
          "Volume = length × width × height.",
        )
      : num(
          "Volume",
          `A box holds ${l * w * h} cubic cm. It is ${l} cm long and ${w} cm wide. How tall is it?`,
          h,
          `Height = volume ÷ (length × width) = ${l * w * h} ÷ ${l * w}.`,
        );
  },
  (r) => {
    const x = ri(r, 1, 9) * pk(r, [1, -1]);
    const y = ri(r, 1, 9) * pk(r, [1, -1]);
    if (r() < 0.5) {
      const q = x > 0 ? (y > 0 ? "I" : "IV") : y > 0 ? "II" : "III";
      return choice(
        "Coordinate plane",
        `Which quadrant is the point (${n(x)}, ${n(y)}) in?`,
        q,
        ["I", "II", "III", "IV"],
        "I: (+, +) · II: (−, +) · III: (−, −) · IV: (+, −). They go counterclockwise from the top right.",
      );
    }
    const a = ri(r, 1, 9);
    const b = ri(r, 1, 9);
    return num(
      "Coordinate plane",
      `How far apart are (${a}, ${n(y)}) and (${n(-b)}, ${n(y)})?`,
      a + b,
      "Same y: the distance is the gap in x — here across 0, so add the distances from 0.",
    );
  },
  (r) => {
    const a = ri(r, 1, 9);
    const b = ri(r, 1, 9);
    const k = ri(r, 2, 9);
    return r() < 0.5
      ? num(
          "Ratios",
          `${a} : ${b} = ${a * k} : ?`,
          b * k,
          `The first number was × ${k}; do the same to the second.`,
        )
      : num(
          "Ratios",
          `${a} : ${b} = ? : ${b * k}`,
          a * k,
          `The second number was × ${k}; do the same to the first.`,
        );
  },
  (r) => {
    const t = ri(r, -15, 10);
    const ch = ri(r, 3, 20) * pk(r, [1, -1]);
    const name = pk(r, NAMES);
    return r() < 0.5
      ? num(
          "Integers",
          `🌡️ It was ${n(t)}°F this morning. By noon it ${ch > 0 ? "rose" : "fell"} ${Math.abs(ch)}°. What is the temperature now?`,
          t + ch,
          "Start at the first number and move up (add) or down (subtract) the number line.",
        )
      : num(
          "Integers",
          `🤿 ${name} is diving at ${n(-Math.abs(t) - 1)} m (below the surface is negative) and swims ${ch > 0 ? "up" : "down"} ${Math.abs(ch)} m. Where now?`,
          -Math.abs(t) - 1 + ch,
          "Up is adding, down is subtracting. Above the surface would be positive.",
        );
  },
];

// ---------------- 7 · Algebra ----------------
export const MORE_7: Gen[] = [
  (r) => {
    const d = ri(r, 2, 9);
    const c = ri(r, 1, 12);
    const k = ri(r, 2, 6);
    return num(
      "Proportions",
      `x/${d * k} = ${c}/${d}. What is x?`,
      c * k,
      `Cross multiply: x × ${d} = ${c} × ${d * k}.`,
    );
  },
  (r) => {
    const o = 20 * ri(r, 1, 20);
    const p = 5 * ri(r, 1, 18);
    const up = r() < 0.6;
    const nv = (o * (100 + (up ? p : -p))) / 100;
    return num(
      "Percent change",
      `A price goes from $${o} to $${nv}. What is the percent ${up ? "increase" : "decrease"}?`,
      p,
      "Percent change = (change ÷ original) × 100.",
    );
  },
  (r) => {
    const P = 100 * ri(r, 2, 50);
    const rate = ri(r, 2, 8);
    const t = ri(r, 1, 6);
    return r() < 0.7
      ? num(
          "Simple interest",
          `$${P.toLocaleString("en-US")} earns ${rate}% simple interest a year. How much interest after ${t} year${t === 1 ? "" : "s"}?`,
          (P * rate * t) / 100,
          "Interest = principal × rate × time (rate as a decimal).",
        )
      : num(
          "Simple interest",
          `$${P.toLocaleString("en-US")} earns ${rate}% simple interest a year. What is the total after ${t} year${t === 1 ? "" : "s"}?`,
          P + (P * rate * t) / 100,
          "Total = principal + principal × rate × time.",
        );
  },
  (r) => {
    let a = ri(r, 1, 9);
    let b = ri(r, 1, 9);
    while (gcd(a, b) !== 1) [a, b] = [ri(r, 1, 9), ri(r, 1, 9)];
    const k = ri(r, 2, 9);
    const s = pk(r, [1, -1]);
    return r() < 0.5
      ? num(
          "Factoring",
          `${k * a}x ${sg(s * k * b)} = ?(${cx(a)}x ${sg(s * b)}). What goes in front?`,
          k,
          "Find the greatest common factor of both terms.",
        )
      : num(
          "Factoring",
          `${k * a}x ${sg(s * k * b)} = ${k}(${cx(a)}x ${s < 0 ? "−" : "+"} ?). What is ?`,
          b,
          `Divide the second term by ${k}.`,
        );
  },
  (r) => {
    const a = ri(r, 2, 9);
    const b = ri(r, 2, 9);
    const v = pk(r, ["x", "y", "a", "m"]);
    return pk(r, [
      () =>
        num(
          "Exponent rules",
          `${v}${sup(a)} · ${v}${sup(b)} = ${v}^?`,
          a + b,
          "Same base, multiplying: add the exponents.",
        ),
      () =>
        num(
          "Exponent rules",
          `(${v}${sup(a)})${sup(b)} = ${v}^?`,
          a * b,
          "Power of a power: multiply the exponents.",
        ),
      () =>
        num(
          "Exponent rules",
          `${v}${sup(a + b)} ÷ ${v}${sup(b)} = ${v}^?`,
          a,
          "Same base, dividing: subtract the exponents.",
        ),
    ])();
  },
  (r) => {
    const a = ri(r, 11, 99) / 10;
    const k = ri(r, 2, 6);
    if (r() < 0.5)
      return num(
        "Scientific notation",
        `${a} × 10${sup(k)} = ?`,
        round(a * 10 ** k, 4),
        `Move the point ${k} places to the right.`,
      );
    const v = round(a * 10 ** k, 4);
    return num(
      "Scientific notation",
      `${v.toLocaleString("en-US")} = ${a} × 10^?`,
      k,
      "Count how many places the point moves to get a number from 1 to 10.",
    );
  },
  (r) => {
    if (r() < 0.5) {
      const a = ri(r, 2, 20);
      return num(
        "Square roots",
        `√${a * a} = ?`,
        a,
        `What number times itself is ${a * a}?`,
      );
    }
    let m = ri(r, 2, 200);
    while (Number.isInteger(Math.sqrt(m))) m = ri(r, 2, 200);
    const f = Math.floor(Math.sqrt(m));
    return num(
      "Square roots",
      `√${m} is between two whole numbers in a row. What is the smaller one?`,
      f,
      `${f}² = ${f * f} and ${f + 1}² = ${(f + 1) ** 2}.`,
    );
  },
  (r) => {
    const x = ri(r, -5, 5);
    const p = ri(r, 1, 4) * pk(r, [1, -1]);
    const q = ri(r, -6, 6);
    const c = ri(r, -9, 9);
    return num(
      "Evaluating expressions",
      `If x = ${n(x)}, what is ${poly([
        [p, 2],
        [q, 1],
        [c, 0],
      ])}?`,
      p * x * x + q * x + c,
      "Put the number in for x (in parentheses), then exponents, multiply, add.",
    );
  },
  (r) => {
    if (r() < 0.5) {
      const k = pk(r, [2, 3]);
      const s = ri(r, 1, 40);
      const tot = Array.from({ length: k }, (_, i) => s + i).reduce(
        (a, b) => a + b,
        0,
      );
      return num(
        "Equation word problems",
        `${k === 2 ? "Two" : "Three"} whole numbers in a row add up to ${tot}. What is the smallest?`,
        s,
        `Call them x, x + 1${k === 3 ? ", x + 2" : ""}: ${k}x + ${k === 2 ? 1 : 3} = ${tot}.`,
      );
    }
    const [a, b] = shuffle(r, NAMES).slice(0, 2);
    const y = ri(r, 3, 15);
    const d = ri(r, 1, 10);
    return num(
      "Equation word problems",
      `${a} is ${d} years older than ${b}. Their ages add up to ${2 * y + d}. How old is ${b}?`,
      y,
      `x + (x + ${d}) = ${2 * y + d}.`,
    );
  },
  (r) => {
    const a = ri(r, 1, 9) * pk(r, [1, -1]);
    const b = ri(r, -10, 10);
    const c = ri(r, -6, 6);
    return r() < 0.5
      ? num(
          "Functions",
          `f(x) = ${cx(a)}x ${sg(b)}. What is f(${n(c)})?`,
          a * c + b,
          "Put the number in for x.",
        )
      : num(
          "Functions",
          `f(x) = ${cx(a)}x ${sg(b)} and f(x) = ${n(a * c + b)}. What is x?`,
          c,
          `Solve ${cx(a)}x ${sg(b)} = ${n(a * c + b)}.`,
        );
  },
];

// ---------------- 8 · Algebra II ----------------
export const MORE_8: Gen[] = [
  (r) => {
    const b = pk(r, [2, 3, 5]);
    const k = ri(r, 1, b === 2 ? 6 : 3);
    const mode = ri(r, 0, 2);
    if (mode === 0)
      return num(
        "Exponential equations",
        `(1/${b})^x = ${b ** k}. What is x?`,
        -k,
        `1/${b} = ${b}⁻¹, so ${b}^(−x) = ${b}${sup(k)}.`,
      );
    if (mode === 1) {
      const c = ri(r, 1, 4);
      return num(
        "Exponential equations",
        `${b}^(x + ${c}) = ${(b ** (k + c)).toLocaleString("en-US")}. What is x?`,
        k,
        `Write the right side as ${b}${sup(k + c)}; then x + ${c} = ${k + c}.`,
      );
    }
    const [p, q, v] = pk(r, [
      [4, 8, 3 / 2],
      [8, 4, 2 / 3],
      [9, 27, 3 / 2],
      [27, 9, 2 / 3],
      [4, 32, 5 / 2],
      [8, 16, 4 / 3],
      [16, 8, 3 / 4],
      [25, 125, 3 / 2],
    ] as const);
    return num(
      "Exponential equations",
      `${p}^x = ${q}. What is x?`,
      v,
      `Write both as powers of the same base (like 2 or 3), then set the exponents equal.`,
      { show: frac(Math.round(v * 12), 12), ...asFrac },
    );
  },
  (r) => {
    const mode = ri(r, 0, 2);
    if (mode === 0) {
      const k = ri(r, 0, 99);
      const right = ["1", "i", "−1", "−i"][k % 4];
      return choice(
        "Imaginary numbers",
        `i${sup(k)} = ?`,
        right,
        ["1", "i", "−1", "−i"],
        `The powers of i repeat every 4: ${k} ÷ 4 leaves ${k % 4}.`,
      );
    }
    if (mode === 1) {
      const [a, b, c] = triple(r, 3);
      return num(
        "Imaginary numbers",
        `|${a} ${sg(b * pk(r, [1, -1]))}i| = ? (the distance from 0)`,
        c,
        "|a + bi| = √(a² + b²).",
      );
    }
    const a = ri(r, -9, 9);
    const b = ri(r, -9, 9);
    const c = ri(r, -9, 9);
    const d = ri(r, -9, 9);
    return num(
      "Imaginary numbers",
      `(${n(a)} ${sg(b)}i) − (${n(c)} ${sg(d)}i) = … + ?i  (the imaginary part)`,
      b - d,
      "Subtract the real parts and the i parts separately.",
    );
  },
  (r) => {
    const m = pk(r, [2, 3, 5, 6, 7, 10, 11]);
    const k = ri(r, 2, 12);
    return num(
      "Simplifying roots",
      `√${k * k * m} = ?√${m}`,
      k,
      `${k * k * m} = ${k * k} × ${m}, and √${k * k} = ${k}.`,
    );
  },
  (r) => {
    let b = ri(r, -10, 10);
    let c = ri(r, -12, 12);
    while (b * b - 4 * c <= 0 || Number.isInteger(Math.sqrt(b * b - 4 * c)))
      [b, c] = [ri(r, -10, 10), ri(r, -12, 12)];
    const x = (-b + Math.sqrt(b * b - 4 * c)) / 2;
    return num(
      "Quadratic formula",
      `x² ${sg(b)}x ${sg(c)} = 0. What is the larger solution?`,
      x,
      "x = (−b ± √(b² − 4ac)) ÷ 2a; take +.",
      { show: round(x, 1).toFixed(1), ...tenth },
    );
  },
  (r) => {
    const a = ri(r, -6, 6) || 1;
    const b = ri(r, -6, 6);
    const c = ri(r, -9, 9);
    const which = pk(r, [
      ["x²", b + a],
      ["x", c + a * b],
      ["constant", a * c],
    ] as const);
    return num(
      "Polynomials",
      `Multiply (x ${sg(a)})(${poly([
        [1, 2],
        [b, 1],
        [c, 0],
      ])}). What is the ${which[0] === "constant" ? "constant term" : `coefficient of ${which[0]}`}?`,
      which[1],
      "Multiply each term in the first by each in the second, then combine like terms.",
    );
  },
  (r) => {
    const q = pk(r, [2, 3]);
    const k = q === 2 ? ri(r, 2, 10) : ri(r, 2, 5);
    const p = q === 2 ? pk(r, [1, 3]) : pk(r, [1, 2]);
    return num(
      "Rational exponents",
      `${k ** q}^(${p}/${q}) = ?`,
      k ** p,
      `The bottom is the root (${q === 2 ? "square" : "cube"} root of ${k ** q} = ${k}), the top is the power.`,
    );
  },
  (r) => {
    const k = ri(r, 2, 9);
    const x1 = ri(r, 1, 6);
    const x2 = ri(r, 1, 12);
    if (r() < 0.5)
      return num(
        "Variation",
        `y varies directly with x. y = ${k * x1} when x = ${x1}. What is y when x = ${x2}?`,
        k * x2,
        `y = kx; k = ${k * x1} ÷ ${x1} = ${k}.`,
      );
    const K = k * x1 * x2;
    return num(
      "Variation",
      `y varies inversely with x. y = ${k * x2} when x = ${x1}. What is y when x = ${x1 * k}?`,
      K / (x1 * k),
      `xy stays the same: ${x1} × ${k * x2} = ${K}.`,
      { show: frac(K, x1 * k) },
    );
  },
  (r) => {
    const a = ri(r, 1, 9);
    if (r() < 0.5)
      return num(
        "Rational expressions",
        `(x² − ${a * a}) ÷ (x − ${a}) = x + ?`,
        a,
        `Difference of squares: x² − ${a * a} = (x − ${a})(x + ${a}).`,
      );
    const b = ri(r, 1, 9) * pk(r, [1, -1]);
    return num(
      "Rational expressions",
      `(${poly([
        [1, 2],
        [a + b, 1],
        [a * b, 0],
      ])}) ÷ (x + ${a}) = x + ?`,
      b,
      `Factor the top: (x + ${a})(x ${sg(b)}), then cancel.`,
    );
  },
  (r) => {
    const b = ri(r, 2, 9);
    if (r() < 0.5) {
      const a = ri(r, -10, 10);
      return num(
        "Radical equations",
        `√(x ${sg(a)}) = ${b}. What is x?`,
        b * b - a,
        `Square both sides: x ${sg(a)} = ${b * b}.`,
      );
    }
    const x = ri(r, 1, 20);
    const a = 2 * x - b * b;
    return num(
      "Radical equations",
      `√(2x ${sg(-a)}) = ${b}. What is x?`,
      x,
      `Square both sides: 2x ${sg(-a)} = ${b * b}.`,
    );
  },
  (r) => {
    const a = ri(r, -5, 5) || 2;
    const b = ri(r, -6, 6);
    const c = ri(r, 1, 3);
    const d = ri(r, -6, 6);
    const k = ri(r, -3, 3);
    const f = a * k + b;
    const g = c * k * k + d;
    const [op, v] = pk(r, [
      ["+", f + g],
      ["−", f - g],
      ["·", f * g],
    ] as const);
    return num(
      "Function operations",
      `f(x) = ${cx(a)}x ${sg(b)} and g(x) = ${poly([
        [c, 2],
        [d, 0],
      ])}. What is (f ${op} g)(${n(k)})?`,
      v,
      `Find f(${n(k)}) = ${n(f)} and g(${n(k)}) = ${n(g)}, then ${op === "·" ? "multiply" : op === "+" ? "add" : "subtract"}.`,
    );
  },
];

// ---------------- 9 · Geometry ----------------
export const MORE_9: Gen[] = [
  (r) => {
    const [a, b, c] = triple(r, 4);
    if (r() < 0.5)
      return num(
        "Pythagorean theorem",
        `A right triangle has a leg of ${a} and a hypotenuse of ${c}. How long is the other leg?`,
        b,
        `b = √(c² − a²) = √(${c * c} − ${a * a}).`,
      );
    const x = ri(r, 2, 15);
    const y = ri(r, 2, 15);
    const h = Math.sqrt(x * x + y * y);
    return num(
      "Pythagorean theorem",
      `A right triangle has legs ${x} and ${y}. How long is the hypotenuse?`,
      h,
      "c = √(a² + b²).",
      { show: round(h, 1).toFixed(1), ...tenth },
    );
  },
  (r) => {
    const rr = ri(r, 1, 30);
    return pk(r, [
      () =>
        num(
          "Circles",
          `A circle has radius ${rr}. What is its area?`,
          Math.PI * rr * rr,
          "A = πr².",
          { show: round(Math.PI * rr * rr, 1).toFixed(1), ...tenth },
        ),
      () =>
        num(
          "Circles",
          `A circle has diameter ${2 * rr}. What is its circumference?`,
          2 * Math.PI * rr,
          "C = πd.",
          { show: round(2 * Math.PI * rr, 1).toFixed(1), ...tenth },
        ),
      () => {
        const deg = pk(r, [30, 45, 60, 90, 120, 135, 150, 180, 270]);
        const s = (deg / 360) * 2 * Math.PI * rr;
        return num(
          "Circles",
          `A circle has radius ${rr}. How long is the arc of a ${deg}° slice?`,
          s,
          "Arc = (angle ÷ 360) × 2πr.",
          { show: round(s, 1).toFixed(1), ...tenth },
        );
      },
    ])();
  },
  (r) => {
    const sides = ri(r, 3, 20);
    const regular = [3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20];
    return pk(r, [
      () =>
        num(
          "Polygons",
          `What do the inside angles of a ${sides}-sided polygon add up to?`,
          (sides - 2) * 180,
          "Sum = (n − 2) × 180°.",
        ),
      () => {
        const k = pk(r, regular);
        return num(
          "Polygons",
          `What is each inside angle of a regular ${k}-sided polygon?`,
          ((k - 2) * 180) / k,
          "Each = (n − 2) × 180° ÷ n.",
        );
      },
      () => {
        const k = pk(r, regular);
        return r() < 0.5
          ? num(
              "Polygons",
              `What is each outside (exterior) angle of a regular ${k}-sided polygon?`,
              360 / k,
              "The outside angles always add to 360°.",
            )
          : num(
              "Polygons",
              `Each exterior angle of a regular polygon is ${360 / k}°. How many sides does it have?`,
              k,
              "n = 360° ÷ the exterior angle.",
            );
      },
    ])();
  },
  (r) => {
    const l = ri(r, 2, 12);
    const w = ri(r, 2, 10);
    const h = ri(r, 2, 10);
    return r() < 0.6
      ? num(
          "Surface area",
          `What is the surface area of a ${l} × ${w} × ${h} box?`,
          2 * (l * w + l * h + w * h),
          "SA = 2(lw + lh + wh): two of each face.",
        )
      : num(
          "Surface area",
          `What is the surface area of a cube with edges ${l}?`,
          6 * l * l,
          "6 square faces: 6s².",
        );
  },
  (r) => {
    const x = ri(r, -9, 9);
    const y = ri(r, -9, 9);
    const [how, nx, ny] = pk(r, [
      ["reflected over the x-axis", x, -y],
      ["reflected over the y-axis", -x, y],
      ["rotated 90° counterclockwise about the origin", -y, x],
      ["rotated 180° about the origin", -x, -y],
      ["reflected over the line y = x", y, x],
    ] as const);
    const which = pk(r, ["x", "y"] as const);
    return num(
      "Transformations",
      `The point (${n(x)}, ${n(y)}) is ${how}. What is the new ${which}?`,
      which === "x" ? nx : ny,
      "x-axis: (x, −y) · y-axis: (−x, y) · 90° ccw: (−y, x) · 180°: (−x, −y) · y = x: (y, x).",
    );
  },
  (r) => {
    const p = ri(r, 1, 6) * pk(r, [1, -1]);
    const q = ri(r, 1, 6);
    const m = frac(p, q);
    return r() < 0.6
      ? num(
          "Parallel and perpendicular lines",
          `A line has slope ${m}. What is the slope of a line perpendicular to it?`,
          -q / p,
          "Perpendicular slopes are negative reciprocals: flip it and change the sign.",
          { show: frac(-q, p), ...asFrac },
        )
      : num(
          "Parallel and perpendicular lines",
          `A line has slope ${m}. What is the slope of a line parallel to it?`,
          p / q,
          "Parallel lines have the same slope.",
          { show: m, ...asFrac },
        );
  },
  (r) => {
    const s = ri(r, 2, 15);
    return pk(r, [
      () =>
        num(
          "Special right triangles",
          `In a 30°-60°-90° triangle the short leg is ${s}. How long is the hypotenuse?`,
          2 * s,
          "Sides are x, x√3, 2x.",
        ),
      () =>
        num(
          "Special right triangles",
          `In a 30°-60°-90° triangle the short leg is ${s}. How long is the long leg?`,
          s * Math.sqrt(3),
          "Sides are x, x√3, 2x.",
          { show: round(s * Math.sqrt(3), 1).toFixed(1), ...tenth },
        ),
      () =>
        num(
          "Special right triangles",
          `In a 45°-45°-90° triangle each leg is ${s}. How long is the hypotenuse?`,
          s * Math.SQRT2,
          "Sides are x, x, x√2.",
          { show: round(s * Math.SQRT2, 1).toFixed(1), ...tenth },
        ),
      () =>
        num(
          "Special right triangles",
          `In a 30°-60°-90° triangle the hypotenuse is ${2 * s}. How long is the short leg?`,
          s,
          "The short leg is half the hypotenuse.",
        ),
    ])();
  },
  (r) => {
    const a = ri(r, 2, 15);
    const b = ri(r, 2, 15);
    const c =
      r() < 0.5
        ? ri(r, Math.abs(a - b) + 1, a + b - 1)
        : pk(r, [
            a + b,
            a + b + ri(r, 1, 5),
            Math.max(1, Math.abs(a - b) - ri(r, 0, 1)),
          ]);
    const ok = a + b > c && a + c > b && b + c > a;
    return choice(
      "Triangle inequality",
      `Can sides of ${a}, ${b} and ${c} make a triangle?`,
      ok ? "yes" : "no",
      ["yes", "no"],
      "Any two sides must add to more than the third.",
    );
  },
  (r) => {
    const a = ri(r, 25, 155);
    const [kind, v] = pk(r, [
      ["corresponding angle", a],
      ["alternate interior angle", a],
      ["alternate exterior angle", a],
      ["same-side interior angle", 180 - a],
    ] as const);
    return num(
      "Parallel lines",
      `Two parallel lines are cut by a transversal. One angle is ${a}°. What is its ${kind}?`,
      v,
      "Corresponding and alternate angles are equal; same-side interior angles add to 180°.",
    );
  },
  (r) => {
    const rr = ri(r, 1, 10);
    const h = ri(r, 2, 15);
    return pk(r, [
      () =>
        num(
          "Volume",
          `A cylinder has radius ${rr} and height ${h}. What is its volume?`,
          Math.PI * rr * rr * h,
          "V = πr²h.",
          { show: round(Math.PI * rr * rr * h, 1).toFixed(1), ...tenth },
        ),
      () =>
        num(
          "Volume",
          `A sphere has radius ${rr}. What is its volume?`,
          (4 / 3) * Math.PI * rr ** 3,
          "V = (4/3)πr³.",
          { show: round((4 / 3) * Math.PI * rr ** 3, 1).toFixed(1), ...tenth },
        ),
      () =>
        num(
          "Volume",
          `A cone has radius ${rr} and height ${h}. What is its volume?`,
          (Math.PI * rr * rr * h) / 3,
          "V = (1/3)πr²h.",
          { show: round((Math.PI * rr * rr * h) / 3, 1).toFixed(1), ...tenth },
        ),
    ])();
  },
];

// ---------------- 10 · Trigonometry ----------------
const ANGLES = [
  0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330,
];
const EXACT: Array<[number, string]> = [
  [0, "0"],
  [0.5, "1/2"],
  [Math.SQRT2 / 2, "√2/2"],
  [Math.sqrt(3) / 2, "√3/2"],
  [1, "1"],
  [Math.sqrt(3), "√3"],
  [Math.sqrt(3) / 3, "√3/3"],
];
/** sin/cos/tan of a special angle written exactly ("−√3/2", "undefined") */
function exact(fn: "sin" | "cos" | "tan", deg: number): string {
  const x = (deg * Math.PI) / 180;
  if (fn === "tan" && Math.abs(Math.cos(x)) < 1e-9) return "undefined";
  const v =
    fn === "sin" ? Math.sin(x) : fn === "cos" ? Math.cos(x) : Math.tan(x);
  const hit = EXACT.find(([a]) => Math.abs(Math.abs(v) - a) < 1e-9)!;
  return v < -1e-9 ? `−${hit[1]}` : hit[1];
}
export const MORE_10: Gen[] = [
  (r) => {
    const deg = pk(
      r,
      ANGLES.filter((a) => a > 90),
    );
    const fn = pk(r, ["sin", "cos", "tan"] as const);
    const right = exact(fn, deg);
    const pool = [
      "0",
      "1/2",
      "−1/2",
      "√2/2",
      "−√2/2",
      "√3/2",
      "−√3/2",
      "1",
      "−1",
      "√3",
      "−√3",
      "√3/3",
      "−√3/3",
      "undefined",
    ];
    const flip = right.startsWith("−")
      ? right.slice(1)
      : right === "0" || right === "undefined"
        ? "1"
        : `−${right}`;
    const others = shuffle(
      r,
      pool.filter((x) => x !== right && x !== flip),
    ).slice(0, 2);
    return choice(
      "Special angles",
      `${fn}(${deg}°) = ?`,
      right,
      shuffle(r, [right, flip, ...others]),
      "Find the reference angle, then the sign from the quadrant: All Students Take Calculus (all, sin, tan, cos positive in I, II, III, IV).",
    );
  },
  (r) => {
    const k = ri(r, 1, 6);
    if (r() < 0.5)
      return num(
        "Radians",
        `How many radians are ${k} full turn${k === 1 ? "" : "s"}? (? × π)`,
        2 * k,
        "One full turn is 2π radians.",
        { show: `${2 * k}π`, note: "Just the number in front of π." },
      );
    const d = pk(
      r,
      [210, 225, 240, 270, 300, 315, 330, 360, 420, 450, 540, 720],
    );
    return num(
      "Radians",
      `Write ${d}° in radians, as a multiple of π. (? × π)`,
      d / 180,
      "Multiply by π/180: the multiple is degrees ÷ 180.",
      {
        show: `${frac(d, 180)}π`,
        note: "Just the number in front of π, like 7/6.",
      },
    );
  },
  (r) => {
    const A = ri(r, 1, 9) * pk(r, [1, -1]);
    const B = pk(r, [1, 2, 3, 4, 5, 6, 8, 9, 10, 12]);
    const fn = pk(r, ["sin", "cos"]);
    const eq = `y = ${cx(A)}${fn}(${B === 1 ? "" : B}x)`;
    return r() < 0.5
      ? num(
          "Amplitude and period",
          `${eq}. What is the amplitude?`,
          Math.abs(A),
          "Amplitude = |A|: how far it goes above and below the middle.",
        )
      : num(
          "Amplitude and period",
          `${eq}. What is the period in degrees?`,
          360 / B,
          "Period = 360° ÷ B.",
        );
  },
  (r) => {
    const [a, b, c] = triple(r);
    const q2 = r() < 0.4;
    if (r() < 0.5)
      return num(
        "Identities",
        `sin θ = ${a}/${c} and θ is in quadrant ${q2 ? "II" : "I"}. What is cos θ?`,
        (q2 ? -b : b) / c,
        "sin²θ + cos²θ = 1; the quadrant gives the sign.",
        { show: frac(q2 ? -b : b, c), ...asFrac },
      );
    return num(
      "Identities",
      `sin θ = ${a}/${c} and θ is in quadrant ${q2 ? "II" : "I"}. What is tan θ?`,
      (q2 ? -a : a) / b,
      "tan = sin ÷ cos; find cos first with sin² + cos² = 1.",
      { show: frac(q2 ? -a : a, b), ...asFrac },
    );
  },
  (r) => {
    const [a, b, c] = triple(r);
    return r() < 0.5
      ? num(
          "Identities",
          `sin θ = ${a}/${c} and cos θ = ${b}/${c}. What is sin 2θ?`,
          (2 * a * b) / (c * c),
          "sin 2θ = 2 sin θ cos θ.",
          { show: frac(2 * a * b, c * c), ...asFrac },
        )
      : num(
          "Identities",
          `sin θ = ${a}/${c} and cos θ = ${b}/${c}. What is cos 2θ?`,
          (b * b - a * a) / (c * c),
          "cos 2θ = cos²θ − sin²θ.",
          { show: frac(b * b - a * a, c * c), ...asFrac },
        );
  },
  (r) => {
    const rr = ri(r, 2, 20);
    const t = ri(r, 1, 30) / 10;
    return r() < 0.5
      ? num(
          "Arc length and sectors",
          `A circle has radius ${rr}. How long is the arc for a central angle of ${t} radians?`,
          rr * t,
          "s = rθ (θ in radians).",
          { show: round(rr * t, 1).toFixed(1), ...tenth },
        )
      : num(
          "Arc length and sectors",
          `A circle has radius ${rr}. What is the area of the sector with a central angle of ${t} radians?`,
          (rr * rr * t) / 2,
          "Sector area = ½r²θ (θ in radians).",
          { show: round((rr * rr * t) / 2, 1).toFixed(1), ...tenth },
        );
  },
  (r) => {
    const a = ri(r, 3, 20);
    const b = ri(r, 3, 20);
    const C = ri(r, 20, 150);
    const v = 0.5 * a * b * Math.sin((C * Math.PI) / 180);
    return num(
      "Triangle area with sine",
      `A triangle has sides ${a} and ${b} with a ${C}° angle between them. What is its area?`,
      v,
      "Area = ½ab sin C.",
      { show: round(v, 1).toFixed(1), ...tenth },
    );
  },
  (r) => {
    const fn = pk(r, ["sin", "cos", "tan"] as const);
    const targets =
      fn === "tan"
        ? ["1", "√3", "√3/3", "−1", "0"]
        : ["1/2", "√2/2", "√3/2", "−1/2", "−√2/2", "−√3/2", "0", "1", "−1"];
    const v = pk(r, targets);
    const sols = [...ANGLES, 360].filter((d) => d < 360 && exact(fn, d) === v);
    return num(
      "Trig equations",
      `${fn} x = ${v}, for 0° ≤ x < 360°. What is the smallest solution, in degrees?`,
      sols[0],
      "Find the reference angle, then the first quadrant where the sign is right.",
    );
  },
  (r) => {
    const d = ri(r, 10, 200);
    const t = ri(r, 10, 75);
    const h = d * Math.tan((t * Math.PI) / 180);
    return r() < 0.5
      ? num(
          "Angle of elevation",
          `From ${d} m away, the angle up to the top of a tower is ${t}°. How tall is the tower?`,
          h,
          "tan(angle) = height ÷ distance.",
          { show: round(h, 1).toFixed(1), ...tenth },
        )
      : num(
          "Angle of elevation",
          `A ${round(h, 0)} m tall cliff. From a boat the angle up to the top is ${t}°. How far is the boat from the cliff?`,
          round(h, 0) / Math.tan((t * Math.PI) / 180),
          "distance = height ÷ tan(angle).",
          {
            show: round(round(h, 0) / Math.tan((t * Math.PI) / 180), 1).toFixed(
              1,
            ),
            ...tenth,
          },
        );
  },
  (r) => {
    const dg = ri(r, 1, 89);
    const m = pk(r, [6, 12, 15, 18, 24, 30, 36, 42, 45, 48, 54]);
    return r() < 0.5
      ? num(
          "Degrees and minutes",
          `Write ${dg}° ${m}′ in decimal degrees. (60′ = 1°)`,
          dg + m / 60,
          "Divide the minutes by 60.",
        )
      : num(
          "Degrees and minutes",
          `${round(dg + m / 60, 2)}° = ${dg}° and how many minutes (′)?`,
          m,
          "Multiply the decimal part by 60.",
        );
  },
];

// ---------------- 11 · Pre-Calculus ----------------
export const MORE_11: Gen[] = [
  (r) => {
    const b = pk(r, [2, 3, 5, 10]);
    const m = ri(r, 1, b === 2 ? 5 : 3);
    const k = ri(r, 1, b === 2 ? 5 : 3);
    return r() < 0.5
      ? num(
          "Logarithms",
          `log${sub(b)} ${b ** m} + log${sub(b)} ${b ** k} = ?`,
          m + k,
          "log a + log b = log(ab) — or work out each one and add.",
        )
      : num(
          "Logarithms",
          `log${sub(b)} ${(b ** (m + k)).toLocaleString("en-US")} − log${sub(b)} ${b ** k} = ?`,
          m,
          "log a − log b = log(a ÷ b).",
        );
  },
  (r) => {
    const k = ri(r, -4, 9);
    return pk(r, [
      () =>
        num(
          "Logarithms",
          `log ${(10 ** k).toLocaleString("en-US", { maximumFractionDigits: 6 })} = ?`,
          k,
          "log with no base means base 10: how many times is 10 multiplied (or divided)?",
        ),
      () =>
        num(
          "Logarithms",
          `ln e${k < 0 ? `^(${n(k)})` : sup(k)} = ?`,
          k,
          "ln is log base e: ln eˣ = x.",
        ),
      () => {
        const p = ri(r, 2, 5);
        const b = pk(r, [2, 3]);
        return num(
          "Logarithms",
          `${p} · log${sub(b)} ${b} = log${sub(b)} ?`,
          b ** p,
          "k · log x = log xᵏ.",
        );
      },
    ])();
  },
  (r) => {
    const mode = ri(r, 0, 2);
    if (mode === 0) {
      const k = ri(r, 3, 7);
      const word =
        pk(
          r,
          [
            "MATH",
            "PLANE",
            "TIGER",
            "CLOUDY",
            "BRIGHT",
            "FROSTY",
            "JUMPING",
            "SHAPE",
            "QUICK",
            "LEMON",
          ].filter((w) => w.length === k),
        ) ?? "MATH";
      return num(
        "Permutations",
        `How many ways can the letters of ${word} be arranged?`,
        fact(word.length),
        `All ${word.length} letters are different: ${word.length}! = ${word.length} × ${word.length - 1} × … × 1.`,
      );
    }
    if (mode === 1) {
      const len = ri(r, 2, 5);
      const opts = pk(r, [10, 26, 5, 4]);
      return num(
        "Permutations",
        `How many ${len}-symbol codes can be made from ${opts} symbols, if symbols can repeat?`,
        opts ** len,
        `${opts} choices for each spot: ${opts}${sup(len)}.`,
      );
    }
    const nn = ri(r, 5, 12);
    return num(
      "Permutations",
      `${nn} runners race. How many ways can 1st, 2nd and 3rd place be given out?`,
      nn * (nn - 1) * (nn - 2),
      `${nn} × ${nn - 1} × ${nn - 2}.`,
    );
  },
  (r) => {
    const mode = ri(r, 0, 2);
    if (mode === 0) {
      const red = ri(r, 1, 9);
      const blue = ri(r, 1, 9);
      const green = ri(r, 0, 6);
      return num(
        "Probability",
        `A bag has ${red} red, ${blue} blue and ${green} green marbles. What is the chance of pulling a red one?`,
        red / (red + blue + green),
        "Probability = ways it can happen ÷ all the ways.",
        { show: frac(red, red + blue + green), ...asFrac },
      );
    }
    if (mode === 1) {
      const s = ri(r, 2, 12);
      const ways = 6 - Math.abs(s - 7);
      return num(
        "Probability",
        `Two dice are rolled. What is the chance they add up to ${s}?`,
        ways / 36,
        `There are 36 equally likely rolls; count the ones that make ${s}.`,
        { show: frac(ways, 36), ...asFrac },
      );
    }
    const k = ri(r, 2, 6);
    return num(
      "Probability",
      `A fair coin is flipped ${k} times. What is the chance every flip is heads?`,
      1 / 2 ** k,
      "Independent events: multiply ½ for each flip.",
      { show: `1/${2 ** k}`, ...asFrac },
    );
  },
  (r) => {
    const a = ri(r, 1, 6) * pk(r, [1, -1]);
    const bb = ri(r, -9, 9);
    const c = ri(r, -8, 8);
    const b = a * c + bb === 0 ? bb + 1 : bb; // not a hole: the top isn't 0 there
    const eq = `y = (${cx(a)}x ${sg(b)}) ÷ (x ${sg(-c)})`;
    return r() < 0.5
      ? num(
          "Asymptotes",
          `${eq}. The vertical asymptote is x = ?`,
          c,
          "Where the bottom is 0 (and the top isn’t).",
        )
      : num(
          "Asymptotes",
          `${eq}. The horizontal asymptote is y = ?`,
          a,
          "Same degree top and bottom: divide the leading numbers.",
        );
  },
  (r) => {
    if (r() < 0.5) {
      const p0 = 100 * ri(r, 1, 20);
      const d = ri(r, 2, 6);
      const k = ri(r, 1, 4);
      return num(
        "Exponential growth and decay",
        `A town of ${p0.toLocaleString("en-US")} doubles every ${d} years. How many people after ${d * k} years?`,
        p0 * 2 ** k,
        `${d * k} years is ${k} doublings: × 2${sup(k)}.`,
      );
    }
    const m = 16 * ri(r, 1, 20);
    const h = ri(r, 2, 10);
    const k = ri(r, 1, 4);
    return num(
      "Exponential growth and decay",
      `A ${m} g sample has a half-life of ${h} days. How many grams are left after ${h * k} days?`,
      m / 2 ** k,
      `${k} half-lives: × (1/2)${sup(k)}.`,
    );
  },
  (r) => {
    const h = ri(r, -9, 9);
    const k = ri(r, -9, 9);
    const R = ri(r, 1, 12);
    const eq = `(x ${sg(-h)})² + (y ${sg(-k)})² = ${R * R}`;
    return pk(r, [
      () =>
        num(
          "Circles and conics",
          `${eq}. What is the radius?`,
          R,
          "(x − h)² + (y − k)² = r²: take the square root.",
        ),
      () =>
        num(
          "Circles and conics",
          `${eq}. What is the x of the center?`,
          h,
          "The center is (h, k) — watch the signs: x − h.",
        ),
      () =>
        num(
          "Circles and conics",
          `${eq}. What is the y of the center?`,
          k,
          "The center is (h, k) — watch the signs: y − k.",
        ),
    ])();
  },
  (r) => {
    const [a, b, c, d] = Array.from({ length: 4 }, () => ri(r, -9, 9));
    return num(
      "Matrices",
      `What is the determinant of [[${n(a)}, ${n(b)}], [${n(c)}, ${n(d)}]]?`,
      a * d - b * c,
      "For [[a, b], [c, d]]: ad − bc.",
    );
  },
  (r) => {
    if (r() < 0.5) {
      const [a, b, c, d] = Array.from({ length: 4 }, () => ri(r, -9, 9));
      return num(
        "Vectors",
        `u = ⟨${n(a)}, ${n(b)}⟩ and v = ⟨${n(c)}, ${n(d)}⟩. What is the dot product u · v?`,
        a * c + b * d,
        "Multiply matching parts and add: ac + bd.",
      );
    }
    const [a, b, c] = triple(r, 3);
    return num(
      "Vectors",
      `How long is the vector ⟨${n(a * pk(r, [1, -1]))}, ${n(b * pk(r, [1, -1]))}⟩?`,
      c,
      "|⟨a, b⟩| = √(a² + b²).",
    );
  },
  (r) => {
    const c = ri(r, -3, 3);
    const a = ri(r, 1, 4);
    const b = ri(r, -6, 6);
    const m = ri(r, -5, 5);
    const x = ri(r, -6, 6);
    const v = x < c ? a * x * x + b : m * x + b;
    return num(
      "Piecewise functions",
      `f(x) = ${poly([
        [a, 2],
        [b, 0],
      ])} when x < ${n(c)}, and ${
        m === 0
          ? n(b)
          : poly([
              [m, 1],
              [b, 0],
            ])
      } when x ≥ ${n(c)}. What is f(${n(x)})?`,
      v,
      `First check which rule ${n(x)} belongs to.`,
    );
  },
  (r) => {
    const nn = ri(r, 3, 8);
    const k = ri(r, 1, nn - 1);
    if (r() < 0.5)
      return num(
        "Binomial theorem",
        `In (x + 1)${sup(nn)}, what is the coefficient of x${k === 1 ? "" : sup(k)}?`,
        C(nn, k),
        `It is C(${nn}, ${k}) — row ${nn} of Pascal’s triangle.`,
      );
    const a = ri(r, 2, 3);
    const nn2 = ri(r, 3, 5);
    const k2 = ri(r, 1, nn2 - 1);
    return num(
      "Binomial theorem",
      `In (x + ${a})${sup(nn2)}, what is the coefficient of x${k2 === 1 ? "" : sup(k2)}?`,
      C(nn2, k2) * a ** (nn2 - k2),
      `C(${nn2}, ${k2}) × ${a}${sup(nn2 - k2)}.`,
    );
  },
  (r) => {
    const R = ri(r, 1, 12);
    const t = pk(
      r,
      [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 240, 270, 300, 330],
    );
    const which = pk(r, ["x", "y"] as const);
    const v =
      which === "x"
        ? R * Math.cos((t * Math.PI) / 180)
        : R * Math.sin((t * Math.PI) / 180);
    const clean = Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v;
    return num(
      "Polar coordinates",
      `The polar point (r, θ) = (${R}, ${t}°). What is its ${which}?`,
      clean,
      which === "x" ? "x = r cos θ." : "y = r sin θ.",
      Number.isInteger(clean)
        ? {}
        : { show: round(clean, 1).toFixed(1), ...tenth },
    );
  },
];

// ---------------- 12 · Calculus ----------------
export const MORE_12: Gen[] = [
  (r) => {
    const a = ri(r, 1, 9) * pk(r, [1, -1]);
    const b = ri(r, 1, 6);
    const mode = ri(r, 0, 2);
    const bx = b === 1 ? "x" : `${b}x`;
    if (mode === 0)
      return num(
        "Trig derivatives",
        `f(x) = ${cx(a)}sin(${bx}). What is f′(0)?`,
        a * b,
        `f′(x) = ${n(a * b)}cos(${bx}), and cos 0 = 1.`,
      );
    if (mode === 1)
      return num(
        "Trig derivatives",
        `f(x) = ${cx(a)}cos(${bx}). What is f′(π/${2 * b})?`,
        -a * b,
        `f′(x) = ${cx(-a * b)}sin(${bx}); at x = π/${2 * b}, ${bx} = π/2 and sin = 1.`,
      );
    const at = pk(r, ["0", "π/4"] as const);
    return num(
      "Trig derivatives",
      `f(x) = ${cx(a)}tan x. What is f′(${at})?`,
      at === "0" ? a : 2 * a,
      "d/dx tan x = sec²x = 1/cos²x.",
    );
  },
  (r) => {
    const a = ri(r, -4, 4);
    const p = ri(r, -3, 3) || 1;
    const q = ri(r, -6, 6);
    const c = ri(r, -9, 9);
    return num(
      "Limits",
      `lim (x → ${n(a)}) of ${poly([
        [p, 2],
        [q, 1],
        [c, 0],
      ])} = ?`,
      p * a * a + q * a + c,
      "A polynomial is continuous: just put the number in.",
    );
  },
  (r) => {
    const a = ri(r, 1, 9);
    const b = ri(r, 1, 9);
    return r() < 0.5
      ? num(
          "Limits",
          `lim (x → 0) of sin(${a}x) ÷ x = ?`,
          a,
          `sin(kx)/x → k as x → 0 (since sin u / u → 1).`,
        )
      : num(
          "Limits",
          `lim (x → 0) of sin(${a}x) ÷ (${b}x) = ?`,
          a / b,
          "sin(ax)/(bx) → a/b.",
          { show: frac(a, b), ...asFrac },
        );
  },
  (r) => {
    const mode = ri(r, 0, 2);
    const a = ri(r, 1, 9) * pk(r, [1, -1]);
    if (mode === 0)
      return num(
        "Chain rule",
        `f(x) = e^(${n(a)}x). What is f′(0)?`,
        a,
        `f′(x) = ${cx(a)}e^(${cx(a)}x), and e⁰ = 1.`,
      );
    if (mode === 1)
      return num(
        "Chain rule",
        `f(x) = sin(${n(a)}x). What is f′(0)?`,
        a,
        `f′(x) = ${n(a)}cos(${cx(a)}x), and cos 0 = 1.`,
      );
    const k = ri(r, 1, 3);
    const b = ri(r, 0, 3);
    const p = ri(r, 2, 3);
    return num(
      "Chain rule",
      `f(x) = (${poly([
        [k, 2],
        [b, 0],
      ])})${sup(p)}. What is f′(1)?`,
      p * (k + b) ** (p - 1) * 2 * k,
      `n·(inside)ⁿ⁻¹ × (inside)′ = ${p}(${k + b})${sup(p - 1)} × ${2 * k}.`,
    );
  },
  (r) => {
    const a = ri(r, 1, 9);
    return pk(r, [
      () =>
        num(
          "Power rule",
          `f(x) = ${a === 1 ? "" : a}√x. What is f′(4)?`,
          a / 4,
          "√x = x^(1/2), so the derivative is ½x^(−1/2) = 1/(2√x).",
          { show: frac(a, 4), ...asFrac },
        ),
      () => {
        const k = ri(r, 1, 5);
        return num(
          "Power rule",
          `f(x) = ${a}/x. What is f′(${k})?`,
          -a / (k * k),
          `${a}/x = ${a}x⁻¹, so f′(x) = −${a}x⁻².`,
          { show: frac(-a, k * k), ...asFrac },
        );
      },
      () => {
        const p = ri(r, 2, 9);
        return num(
          "Power rule",
          `f(x) = ${a === 1 ? "" : a}x${sup(p)}. What is f′(1)?`,
          a * p,
          "Bring the power down, take one off the power.",
        );
      },
    ])();
  },
  (r) => {
    if (r() < 0.5) {
      const c = pk(r, [1, 2, 3, 6]);
      const b = ri(r, 1, 6);
      return num(
        "Definite integrals",
        `∫ from 0 to ${b} of ${cx(c)}x² dx = ?`,
        (c * b ** 3) / 3,
        `Antiderivative ${c === 1 ? "" : c}x³/3; plug in ${b} and 0.`,
        { show: frac(c * b ** 3, 3), ...asFrac },
      );
    }
    const m = ri(r, -4, 4) || 2;
    const k = ri(r, -6, 6);
    const a = ri(r, -3, 2);
    const b = ri(r, a + 1, 5);
    const F = (x: number) => (m * x * x) / 2 + k * x;
    return num(
      "Definite integrals",
      `∫ from ${n(a)} to ${b} of (${poly([
        [m, 1],
        [k, 0],
      ])}) dx = ?`,
      F(b) - F(a),
      `Antiderivative ${m === 2 ? "" : m === -2 ? "−" : `(${frac(m, 2)})`}x² ${sg(k)}x; then F(${b}) − F(${n(a)}).`,
      {
        show: frac(m * b * b + 2 * k * b - m * a * a - 2 * k * a, 2),
        ...asFrac,
      },
    );
  },
  (r) => {
    const a = ri(r, 1, 6);
    const b = ri(r, -6, 6);
    const c = ri(r, 1, 4);
    const d = ri(r, 1, 6) * pk(r, [1, -1]);
    return num(
      "Quotient rule",
      `f(x) = (${cx(a)}x ${sg(b)}) ÷ (${cx(c)}x ${sg(d)}). What is f′(0)?`,
      (a * d - b * c) / (d * d),
      "Quotient rule: (low·d(high) − high·d(low)) ÷ low².",
      { show: frac(a * d - b * c, d * d), ...asFrac },
    );
  },
  (r) => {
    const a = ri(r, 1, 9);
    const k = ri(r, 1, 6);
    return pk(r, [
      () =>
        num(
          "Exponential and log derivatives",
          `f(x) = ${a === 1 ? "" : a}ln x. What is f′(${k})?`,
          a / k,
          "d/dx ln x = 1/x.",
          { show: frac(a, k), ...asFrac },
        ),
      () =>
        num(
          "Exponential and log derivatives",
          `f(x) = ln(${a}x). What is f′(${k})?`,
          1 / k,
          `ln(${a}x) = ln ${a} + ln x, so the derivative is 1/x.`,
          { show: frac(1, k), ...asFrac },
        ),
      () =>
        num(
          "Exponential and log derivatives",
          `f(x) = ${a === 1 ? "" : a}eˣ. What is f′(0)?`,
          a,
          "eˣ is its own derivative, and e⁰ = 1.",
        ),
      () =>
        num(
          "Exponential and log derivatives",
          `f(x) = x·eˣ. What is f′(0)?`,
          1,
          "Product rule: eˣ + x·eˣ; at 0 that is 1 + 0.",
        ),
    ])();
  },
  (r) => {
    const a = ri(r, -3, 3) || 1;
    const b = ri(r, -6, 6);
    const c = ri(r, -9, 9);
    const d = ri(r, -9, 9);
    const k = ri(r, -3, 3);
    return num(
      "Second derivatives",
      `f(x) = ${poly([
        [a, 3],
        [b, 2],
        [c, 1],
        [d, 0],
      ])}. What is f″(${n(k)})?`,
      6 * a * k + 2 * b,
      `f′ = ${poly([
        [3 * a, 2],
        [2 * b, 1],
        [c, 0],
      ])}; take the derivative again.`,
    );
  },
  (r) => {
    const rr = ri(r, 2, 20);
    const dr = ri(r, 1, 5);
    return pk(r, [
      () =>
        num(
          "Related rates",
          `A circle's radius grows ${dr} cm/s. How fast is its area growing when the radius is ${rr} cm? (cm²/s)`,
          2 * Math.PI * rr * dr,
          "A = πr², so dA/dt = 2πr · dr/dt.",
          { show: round(2 * Math.PI * rr * dr, 1).toFixed(1), ...tenth },
        ),
      () =>
        num(
          "Related rates",
          `A square's sides grow ${dr} cm/s. How fast is its area growing when a side is ${rr} cm? (cm²/s)`,
          2 * rr * dr,
          "A = s², so dA/dt = 2s · ds/dt.",
        ),
      () =>
        num(
          "Related rates",
          `A balloon's radius grows ${dr} cm/s. How fast is its volume growing when the radius is ${rr} cm? (cm³/s)`,
          4 * Math.PI * rr * rr * dr,
          "V = (4/3)πr³, so dV/dt = 4πr² · dr/dt.",
          { show: round(4 * Math.PI * rr * rr * dr, 1).toFixed(1), ...tenth },
        ),
    ])();
  },
  (r) => {
    const s = ri(r, 2, 30);
    return r() < 0.5
      ? num(
          "Optimization",
          `A rectangle has a perimeter of ${4 * s} m. What is the largest area it can have?`,
          s * s,
          "Area = x(P/2 − x); its derivative is 0 at x = P/4 — a square.",
        )
      : num(
          "Optimization",
          `${pk(r, NAMES)} has ${4 * s} m of fence for 3 sides of a pen along a river (no fence on the river side). What is the largest area?`,
          2 * s * s,
          "Area = x(L − 2x); derivative 0 at x = L/4, so the long side is L/2.",
        );
  },
  (r) => {
    if (r() < 0.5) {
      const m = ri(r, -5, 5) || 1;
      const k = ri(r, -9, 9);
      const a = ri(r, -4, 3);
      const b = ri(r, a + 1, 6);
      return num(
        "Average value",
        `What is the average value of f(x) = ${poly([
          [m, 1],
          [k, 0],
        ])} on [${n(a)}, ${b}]?`,
        (m * (a + b)) / 2 + k,
        "Average = (1/(b − a)) ∫ f dx; for a line it is f at the middle.",
        { show: frac(m * (a + b) + 2 * k, 2), ...asFrac },
      );
    }
    const b = ri(r, 1, 9);
    return num(
      "Average value",
      `What is the average value of f(x) = x² on [0, ${b}]?`,
      (b * b) / 3,
      `(1/${b}) × ${b}³/3.`,
      { show: frac(b * b, 3), ...asFrac },
    );
  },
  (r) => {
    const a = ri(r, -5, 4);
    const b = ri(r, a + 1, 8);
    return num(
      "Mean value theorem",
      `f(x) = x² on [${n(a)}, ${b}]. Where is f′(c) equal to the average slope? What is c?`,
      (a + b) / 2,
      `Average slope = (f(${b}) − f(${n(a)})) ÷ (${b} − ${a < 0 ? `(${n(a)})` : a}) = ${n(a + b)}; f′(c) = 2c, so c = ${n(a + b)} ÷ 2.`,
      { show: frac(a + b, 2), ...asFrac },
    );
  },
];
