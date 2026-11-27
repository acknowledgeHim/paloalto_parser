/** ➗ More 11th grade math — precalculus (format: ../mathLessonsParse.ts; the right choice is starred). */
export const M_11 = `
@ function-ops | Functions | Adding, multiplying and dividing functions
(f + g)(x) = f(x) + g(x), (fg)(x) = f(x)·g(x), (f/g)(x) = f(x)/g(x) where g(x) ≠ 0.
? f(x) = x + 2, g(x) = 3x. (f + g)(2) = | *10 | 8 | 24
? Same f and g. (fg)(1) = | *9 | 6 | 4
? The domain of (f/g) where g(x) = x − 5 excludes … | *x = 5 | x = 0 | x = −5

@ one-to-one | Functions | One-to-one functions
A function is **one-to-one** if each output comes from only one input. Test: every **horizontal line** hits the graph at most once.
? Is f(x) = x² one-to-one? | *no | yes
? Is f(x) = 2x + 1 one-to-one? | *yes | no
? Only one-to-one functions have … | *inverse functions | domains

@ inverse-graphs | Functions | Graphs of inverses
The graph of f⁻¹ is the graph of f **reflected over y = x** — swap every (x, y) to (y, x).
? If (2, 7) is on f, which point is on f⁻¹? | *(7, 2) | (−2, −7) | (2, −7)
? The inverse of f(x) = eˣ is … | *ln x | −eˣ | 1/eˣ
? f and f⁻¹ always meet … | *on the line y = x (if they meet) | at the origin

@ inc-dec | Functions | Increasing, decreasing and extrema
- **Increasing** where the graph goes up left to right.
- A **relative max** is a peak; a **relative min** is a valley.
? f(x) = x² is increasing on … | *x > 0 | x < 0 | all x
? f(x) = −(x − 3)² + 5 has a relative max at … | *(3, 5) | (−3, 5) | (5, 3)
? f(x) = x³ − 3x has a relative max at x = | *−1 | 1 | 0

@ rational-roots | Polynomials | The rational root theorem
Possible rational zeros = **±(factors of the constant) / (factors of the leading coefficient)**.
? Possible rational zeros of x³ − 2x + 4 include … | *±1, ±2, ±4 | ±3 | ±1/2 only
? For 2x² + 3x − 2, which is a possible zero? | *1/2 | 3 | 1/3
? Is x = 2 a zero of x³ − 8? | *yes | no

@ conjugate-roots | Polynomials | Complex zeros come in pairs
If a polynomial has **real** coefficients and **a + bi** is a zero, so is **a − bi**.
? 3 + 2i is a zero. Another zero must be … | *3 − 2i | −3 + 2i | 2 + 3i
? A degree-3 real polynomial has zeros 1 and i. The third is … | *−i | −1 | 1 + i
? Can a real cubic have exactly 2 non-real zeros and 1 real zero? | *yes | no

@ fta | Polynomials | The fundamental theorem of algebra
A polynomial of degree **n** has exactly **n** zeros (counting complex ones and repeats).
? x⁴ + 1 has how many complex zeros? | *4 | 0 | 1
? (x − 2)³ has how many zeros (with multiplicity)? | *3 | 1 | 2
? A degree-5 polynomial must have at least … real zero(s) | *1 | 0 | 5

@ holes | Rational functions | Holes vs. vertical asymptotes
If a factor **cancels**, there's a **hole**. If it stays in the denominator, there's a **vertical asymptote**.

- (x − 1)(x + 2)/(x − 1) → hole at x = 1
? f(x) = (x² − 9)/(x − 3) has … at x = 3 | *a hole | a vertical asymptote
? f(x) = 1/(x + 4) has … at x = −4 | *a vertical asymptote | a hole
? The hole of (x − 2)(x + 5)/(x − 2) is at … | *(2, 7) | (2, 0) | (−5, 0)

@ slant-asymptote | Rational functions | Slant asymptotes
When the top's degree is **one more** than the bottom's, divide: the quotient is the slant asymptote.
? (x² + 1)/x has slant asymptote … | *y = x | y = 1 | y = x + 1
? (x² + 3x + 1)/(x + 1) has slant asymptote … | *y = x + 2 | y = x + 3 | y = x
? (x³ + 1)/(x + 1) has … | *no slant asymptote (degree differs by 2) | y = x²

@ rational-inequalities | Rational functions | Rational inequalities
Find zeros of the top and bottom, then test each interval with a **sign chart**. Never include values that make the bottom zero.
? (x − 2)/(x + 1) > 0 → | *x < −1 or x > 2 | −1 < x < 2 | x > 2
? 1/x < 0 → | *x < 0 | x > 0 | x ≠ 0
? (x − 3)/(x − 1) ≤ 0 → | *1 < x ≤ 3 | 1 ≤ x ≤ 3 | x ≤ 3

@ change-of-base | Logarithms | Change of base
**log_b(a) = log(a) / log(b)** — handy on a calculator.
? log₂(10) ≈ | *3.32 | 5 | 0.30
? log₄(64) = | *3 | 16 | 4
? log₉(3) = | *1/2 | 3 | 2

@ log-equations | Logarithms | Solving logarithmic equations
Combine logs, rewrite as an exponential, solve, and **check** — logs of zero or negatives aren't allowed.

- log₂(x) + log₂(x − 2) = 3 → x(x − 2) = 8 → x = 4 (reject −2)
? log₃(x) = 4 → x = | *81 | 12 | 64
? ln(x) = 0 → x = | *1 | 0 | e
? log(x) + log(x − 3) = 1 → x = | *5 | −2 | 5 or −2

@ log-graphs | Logarithms | Graphs of logarithms
y = log_b(x) passes through **(1, 0)** and **(b, 1)**, with a vertical asymptote at **x = 0**. Domain x > 0.
? y = log₃(x) passes through … | *(3, 1) | (1, 3) | (0, 1)
? y = ln(x − 2) has asymptote … | *x = 2 | x = 0 | y = 2
? The domain of y = log(x + 5) is … | *x > −5 | x > 5 | all real numbers

@ continuous-growth | Exponentials | Continuous growth
**A = Pe^(rt)** for growth compounded continuously.
? $1,000 at 5% continuously for 10 years ≈ | *$1,649 | $1,500 | $1,629
? Doubling time at rate r is about … | *ln 2 / r | 2r | r/2
? A = 50e^(−0.1t) models … | *decay | growth

@ logistic | Exponentials | Logistic growth
Logistic growth starts like exponential, then levels off at the **carrying capacity** C: f(t) = C / (1 + ae^(−kt)).
? f(t) = 500 / (1 + 9e^(−t)). The carrying capacity is … | *500 | 9 | 50
? Same — f(0) = | *50 | 500 | 9
? Logistic graphs have the shape of … | *an S | a U | a V

@ sigma | Series | Sigma notation
**Σ** means add. Σ (k = 1 to 4) of 2k = 2 + 4 + 6 + 8 = **20**.
? Σ (k = 1 to 3) of k² = | *14 | 9 | 6
? Σ (k = 1 to 5) of 3 = | *15 | 3 | 8
? Σ (k = 0 to 2) of 2ᵏ = | *7 | 6 | 3

@ arithmetic-series | Series | Sum of an arithmetic series
**S = n(a₁ + aₙ)/2** — average of first and last, times how many.
? 1 + 2 + … + 100 = | *5,050 | 10,100 | 5,000
? 3 + 7 + 11 + … + 39 (10 terms) = | *210 | 420 | 42
? 2 + 4 + … + 20 = | *110 | 100 | 220

@ geometric-series | Series | Infinite geometric series
If **|r| < 1**, S = **a₁ / (1 − r)**. Otherwise it diverges.
? 1 + 1/2 + 1/4 + … = | *2 | 1 | infinite
? 9 + 3 + 1 + … = | *13.5 | 13 | 27
? 1 + 2 + 4 + … | *diverges | equals −1 | equals 2

@ recursive | Sequences | Recursive formulas
A **recursive** formula gives the next term from the one before.

- a₁ = 3, aₙ = 2aₙ₋₁ + 1 → 3, 7, 15, 31
? a₁ = 5, aₙ = aₙ₋₁ − 2. a₄ = | *−1 | 1 | −3
? a₁ = 1, a₂ = 1, aₙ = aₙ₋₁ + aₙ₋₂. a₆ = | *8 | 5 | 13
? a₁ = 2, aₙ = 3aₙ₋₁. a₃ = | *18 | 6 | 54

@ classify-conics | Conics | Identifying conics from equations
For Ax² + Cy² + … = 0 (no xy term):

- Only one squared term → **parabola**
- A = C → **circle**
- Same signs, A ≠ C → **ellipse**
- Opposite signs → **hyperbola**
? 4x² + 9y² = 36 is … | *an ellipse | a hyperbola | a circle
? x² − y² = 1 is … | *a hyperbola | an ellipse | a parabola
? y = x² + 3x is … | *a parabola | a circle | a hyperbola

@ eccentricity | Conics | Eccentricity
**e = c/a** measures how stretched a conic is.

- circle e = 0 · ellipse 0 < e < 1 · parabola e = 1 · hyperbola e > 1
? A conic with e = 0.5 is … | *an ellipse | a hyperbola | a parabola
? A conic with e = 1 is … | *a parabola | a circle | an ellipse
? An ellipse with a = 5, c = 3 has e = | *0.6 | 1.67 | 0.4

@ matrix-systems | Matrices | Solving systems with matrices
Write **AX = B**, then **X = A⁻¹B** (or row-reduce the augmented matrix).
? For 2x + y = 5, x − y = 1, the coefficient matrix A is … | *[[2, 1], [1, −1]] | [[5], [1]] | [[2, 5], [1, 1]]
? If det(A) = 0, the system … | *has no unique solution | has exactly one solution
? Solving gives x = 2, y = 1. Check 2x + y = | *5 | 3 | 4

@ eliminate-parameter | Parametric | Eliminating the parameter
Solve one equation for t and substitute into the other.

- x = t + 1, y = t² → t = x − 1 → **y = (x − 1)²**
? x = 2t, y = t + 3 → | *y = x/2 + 3 | y = 2x + 3 | y = x + 3
? x = cos t, y = sin t → | *x² + y² = 1 | y = x | x + y = 1
? x = t, y = 4 − t → | *y = 4 − x | y = x − 4 | y = 4x

@ vector-angle | Vectors | The angle between two vectors
**cos θ = (u · v) / (|u| |v|)**. If u · v = 0, the vectors are **perpendicular**.
? u = (1, 0), v = (0, 1). The angle is … | *90° | 0° | 45°
? u = (1, 1), v = (2, 2). The angle is … | *0° | 45° | 90°
? Are (3, −2) and (4, 6) perpendicular? | *yes (dot product 0) | no

@ de-moivre | Complex numbers | De Moivre's theorem
**[r(cos θ + i sin θ)]ⁿ = rⁿ(cos nθ + i sin nθ)**
? (cos 30° + i sin 30°)³ = | *cos 90° + i sin 90° = i | cos 30° + 3i | 3i
? (2 cis 45°)² = | *4 cis 90° | 2 cis 90° | 4 cis 45°
? (1 + i)⁴ = | *−4 | 4 | 4i

@ conditional-probability | Probability | Conditional probability
**P(A | B) = P(A and B) / P(B)** — the chance of A **given** B happened.
? P(A and B) = 0.2, P(B) = 0.5. P(A given B) = | *0.4 | 0.1 | 0.7
? A card is a face card. P(it's a king)? | *1/3 | 1/13 | 1/4
? Independent events have P(A given B) = | *P(A) | P(B) | 0

@ binomial-probability | Probability | Binomial probability
P(exactly k successes in n tries) = **C(n, k) pᵏ (1 − p)ⁿ⁻ᵏ**
? Flip 3 coins. P(exactly 2 heads) = | *3/8 | 1/4 | 2/3
? Flip 4 coins. P(all heads) = | *1/16 | 1/4 | 1/8
? C(5, 2) = | *10 | 20 | 7

@ expected-value | Probability | Expected value
**E = Σ (value × probability)** — the long-run average.
? A game: win $10 with P = 0.2, else $0. Expected value? | *$2 | $10 | $8
? The expected value of one fair die roll is … | *3.5 | 3 | 6
? A $1 ticket wins $100 with P = 1/200. Expected profit? | *−$0.50 | $0.50 | $99

@ normal-z | Statistics | The normal distribution and z-scores
**z = (x − mean) / SD**. About **68%** of data is within 1 SD, **95%** within 2, **99.7%** within 3.
? Mean 100, SD 15. z for 130? | *2 | 30 | 1.5
? About what percent of data is within 2 SDs? | *95% | 68% | 50%
? A z-score of 0 means the value is … | *the mean | 0 | the max
`;
