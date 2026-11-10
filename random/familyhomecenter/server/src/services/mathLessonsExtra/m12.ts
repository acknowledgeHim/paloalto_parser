/** ➗ More 12th grade math — calculus (format: ../mathLessonsParse.ts; the right choice is starred). */
export const M_12 = `
@ one-sided | Limits | One-sided limits
**lim x→a⁻** comes from the left; **lim x→a⁺** from the right. The limit exists only if both sides agree.
? f(x) = |x|/x. lim x→0⁺ = | *1 | −1 | 0
? Same f — does lim x→0 exist? | *no | yes, it's 0 | yes, it's 1
? lim x→2⁻ of 1/(x − 2) = | *−∞ | +∞ | 0

@ squeeze | Limits | The squeeze theorem
If g ≤ f ≤ h near a and g, h have the same limit L, then f → **L** too. Famous result: **lim x→0 sin x / x = 1**.
? lim x→0 sin(3x)/x = | *3 | 1 | 1/3
? lim x→0 x² sin(1/x) = | *0 | 1 | does not exist
? lim x→0 (1 − cos x)/x = | *0 | 1 | ∞

@ ivt | Continuity | The intermediate value theorem
If f is **continuous** on [a, b], it hits every value between f(a) and f(b).
? f continuous, f(1) = −2, f(3) = 5. Must f(c) = 0 for some c in (1, 3)? | *yes | no
? The IVT needs f to be … | *continuous | differentiable | increasing
? f(x) = x³ − x − 1: f(1) = −1, f(2) = 5. A root lies between … | *1 and 2 | 0 and 1 | 2 and 3

@ differentiability | Derivatives | Differentiable vs. continuous
Differentiable ⇒ continuous, but **not** the other way. Corners, cusps and vertical tangents are continuous but not differentiable.
? f(x) = |x| at x = 0 is … | *continuous but not differentiable | differentiable | not continuous
? If f is differentiable at a, then f is … | *continuous at a | not continuous at a
? f(x) = x^(1/3) at x = 0 has … | *a vertical tangent | a hole | a corner

@ log-exp-derivs | Derivatives | Derivatives of aˣ and logs
- d/dx aˣ = **aˣ ln a**
- d/dx ln x = **1/x**
- d/dx log_b x = **1/(x ln b)**
? d/dx 2ˣ = | *2ˣ ln 2 | x·2ˣ⁻¹ | 2ˣ
? d/dx ln(3x) = | *1/x | 3/x | 1/(3x)
? d/dx log₁₀ x = | *1/(x ln 10) | 10/x | 1/x

@ inverse-trig-derivs | Derivatives | Derivatives of inverse trig functions
- d/dx arcsin x = **1/√(1 − x²)**
- d/dx arctan x = **1/(1 + x²)**
? d/dx arctan x at x = 1 = | *1/2 | 1 | π/4
? d/dx arcsin x at x = 0 = | *1 | 0 | π
? d/dx arctan(2x) = | *2/(1 + 4x²) | 1/(1 + 4x²) | 2/(1 + 2x²)

@ higher-derivatives | Derivatives | Higher derivatives
Differentiate again: f″ is the second derivative, f‴ the third.
? f(x) = x⁴. f″(x) = | *12x² | 4x³ | 24x
? f(x) = sin x. f‴(x) = | *−cos x | cos x | −sin x
? f(x) = eˣ. The 10th derivative is … | *eˣ | 10eˣ | 0

@ mvt | Theorems | The mean value theorem
If f is continuous on [a, b] and differentiable on (a, b), some c has **f′(c) = (f(b) − f(a))/(b − a)**.
? f(x) = x² on [0, 4]. The average slope is … | *4 | 16 | 8
? Same — the c with f′(c) = 4 is … | *2 | 4 | 1
? A car goes 120 miles in 2 hours. At some moment its speed was exactly … | *60 mph | 120 mph | 2 mph

@ first-derivative-test | Applications | The first derivative test
At a critical point: f′ goes **+ to −** → max; **− to +** → min; no sign change → neither.
? f′ changes from − to + at x = 3. x = 3 is a … | *relative min | relative max | neither
? f(x) = x³. At x = 0 there is … | *neither a max nor a min | a min | a max
? f′(x) = (x − 1)(x + 2). The relative max is at x = | *−2 | 1 | 0

@ curve-sketching | Applications | Curve sketching
Use f′ for **increasing/decreasing** and f″ for **concavity**. Inflection points are where concavity changes.
? f(x) = x³ − 3x² has an inflection point at x = | *1 | 0 | 2
? f′ > 0 and f″ < 0 means the graph is … | *increasing and concave down | decreasing and concave up
? f(x) = x⁴ at x = 0 has f″ = 0. Is it an inflection point? | *no | yes

@ inverse-derivatives | Derivatives | Derivatives of inverse functions
**(f⁻¹)′(b) = 1 / f′(a)**, where f(a) = b.
? f(3) = 7, f′(3) = 2. (f⁻¹)′(7) = | *1/2 | 2 | 1/7
? f(x) = x³ + x. f(1) = 2. (f⁻¹)′(2) = | *1/4 | 4 | 1/2
? The slopes of f and f⁻¹ at matching points are … | *reciprocals | negatives | equal

@ newtons-method | Applications | Newton's method
Guess, then improve: **xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ)**.
? f(x) = x² − 2, x₀ = 1. x₁ = | *1.5 | 2 | 1.41
? Newton's method finds … | *zeros of a function | areas | maximums only
? It fails when f′(xₙ) = | *0 | 1 | f(xₙ)

@ integral-properties | Integrals | Properties of definite integrals
- ∫ₐᵃ f = 0
- ∫ₐᵇ f = −∫ᵇₐ f
- ∫ₐᵇ f + ∫ᵇᶜ f = ∫ₐᶜ f
? If ∫₀³ f = 5 and ∫₃⁷ f = 2, then ∫₀⁷ f = | *7 | 3 | 10
? ∫₄⁴ x² dx = | *0 | 16 | 64/3
? If ∫₁⁵ f = 6, then ∫₅¹ f = | *−6 | 6 | 0

@ trapezoid-rule | Integrals | The trapezoid rule
Approximate area with trapezoids: **(Δx/2)(f₀ + 2f₁ + 2f₂ + … + fₙ)**.
? Δx = 1, values 2, 4, 6. Estimate? | *8 | 12 | 6
? For a concave-up function, the trapezoid rule … | *overestimates | underestimates | is exact
? For a straight line, the trapezoid rule is … | *exact | an overestimate | an underestimate

@ average-value | Integrals | Average value of a function
The average height of a graph: the area under it divided by the width of the interval.

**f_avg = (1/(b − a)) ∫ₐᵇ f(x) dx**
? Average of f(x) = x on [0, 4] | *2 | 4 | 8
? Average of f(x) = x² on [0, 3] | *3 | 9 | 4.5
? Average of a constant 5 on [2, 10] | *5 | 40 | 8

@ accumulation | Integrals | Accumulation functions
If **F(x) = ∫ₐˣ f(t) dt**, then **F′(x) = f(x)**. With the chain rule: d/dx ∫ₐ^g(x) f = f(g(x))·g′(x).
? d/dx ∫₀ˣ t² dt = | *x² | x³/3 | 2x
? d/dx ∫₁ˣ cos t dt = | *cos x | sin x | −sin x
? d/dx ∫₀^(x²) eᵗ dt = | *2x e^(x²) | e^(x²) | eˣ

@ by-parts | Techniques | Integration by parts
**∫u dv = uv − ∫v du**. Pick u by **LIATE**: Logs, Inverse trig, Algebra, Trig, Exponentials.
? For ∫x eˣ dx, choose u = | *x | eˣ | x eˣ
? ∫x eˣ dx = | *x eˣ − eˣ + C | x eˣ + C | eˣ/2 + C
? ∫ln x dx = | *x ln x − x + C | 1/x + C | ln x/x + C

@ partial-fractions | Techniques | Partial fractions
Split a rational function into simpler pieces.

- 1/(x(x + 1)) = 1/x − 1/(x + 1)
? 1/((x − 1)(x + 1)) = A/(x − 1) + B/(x + 1). A = | *1/2 | 1 | −1/2
? ∫1/(x(x + 1)) dx = | *ln|x| − ln|x + 1| + C | ln|x(x + 1)| + C | 1/x² + C
? Partial fractions works on … | *rational functions | trig functions only

@ trig-integrals | Integrals | Basic trig integrals
- ∫sin x dx = −cos x + C
- ∫cos x dx = sin x + C
- ∫sec²x dx = tan x + C
? ∫cos x dx = | *sin x + C | −sin x + C | cos²x/2 + C
? ∫₀^π sin x dx = | *2 | 0 | 1
? ∫sec²x dx = | *tan x + C | sec x + C | 2 sec x + C

@ ln-integral | Integrals | The integral of 1/x
**∫(1/x) dx = ln|x| + C** — the power rule fails for x⁻¹.
? ∫(1/x) dx from 1 to e = | *1 | e | 0
? ∫ 3/x dx = | *3 ln|x| + C | 3/x² + C | ln|3x| only
? ∫ 1/(x + 2) dx = | *ln|x + 2| + C | 1/(x + 2)² + C | ln|x| + 2 + C

@ separable | Differential equations | Separable differential equations
Get all y's with dy and all x's with dx, then integrate both sides.

- dy/dx = xy → dy/y = x dx → ln|y| = x²/2 + C
? dy/dx = 2x, y(0) = 1 → y = | *x² + 1 | 2x + 1 | x²
? dy/dx = y, y(0) = 3 → y = | *3eˣ | eˣ + 3 | 3x
? dy/dx = x/y. Separate: | *y dy = x dx | dy = x/y dx only | y dx = x dy

@ slope-fields | Differential equations | Slope fields
A slope field draws a little segment with slope **dy/dx** at each point — solution curves follow them.
? For dy/dx = x, slopes along the y-axis are … | *0 | 1 | undefined
? For dy/dx = y, slopes are positive where … | *y > 0 | x > 0 | x < 0
? For dy/dx = x + y, the slope at (1, 2) is … | *3 | 2 | −1

@ growth-de | Differential equations | dy/dt = ky
Growth proportional to size gives **y = y₀e^(kt)**.
? A population grows at dy/dt = 0.03y. This is … | *exponential growth | linear growth
? dy/dt = −0.2y, y₀ = 100. y(5) = | *100e⁻¹ ≈ 36.8 | 0 | 100e⁻⁵
? Newton's law of cooling says dT/dt is proportional to … | *T − room temperature | T² | time

@ improper | Integrals | Improper integrals
Replace ∞ (or a bad point) with a letter, take the limit.

- ∫₁^∞ 1/x² dx = lim [−1/x]₁ᵇ = **1**
? ∫₁^∞ 1/x dx | *diverges | = 1 | = 0
? ∫₀^∞ e⁻ˣ dx = | *1 | ∞ | 0
? ∫₁^∞ 1/xᵖ dx converges when … | *p > 1 | p < 1 | p = 1

@ series-tests | Series | Do the terms add to a number?
- **nth-term test:** if terms don't → 0, the series **diverges**
- **p-series** Σ1/nᵖ converges when **p > 1**
- **geometric** converges when |r| < 1
? Σ 1/n (harmonic series) | *diverges | converges
? Σ 1/n² | *converges | diverges
? Σ n/(n + 1) | *diverges (terms → 1) | converges

@ taylor | Series | Taylor polynomials
Approximate f near 0 with **f(0) + f′(0)x + f″(0)x²/2! + …**

- eˣ ≈ 1 + x + x²/2 + x³/6
? The degree-2 Taylor polynomial of cos x at 0 is … | *1 − x²/2 | 1 + x | x − x³/6
? Using 1 + x + x²/2, e^0.1 ≈ | *1.105 | 1.1 | 1.01
? sin x ≈ x − x³/6. The next term is … | *+x⁵/120 | −x⁵/120 | +x⁴/24

@ arc-length | Applications | Arc length
Add up tiny straight pieces along the curve; each piece has length √(1 + slope²)·dx.

**L = ∫ₐᵇ √(1 + (f′(x))²) dx**
? For y = 2x on [0, 3], L = | *3√5 | 6 | 9
? For y = 5 (a flat line) on [0, 4], L = | *4 | 5 | 0
? Arc length measures … | *the length of a curve | area under a curve

@ net-change | Applications | Displacement vs. total distance
- **Displacement** = ∫ v(t) dt
- **Total distance** = ∫ |v(t)| dt
? v(t) = t − 2 on [0, 4]. Displacement = | *0 | 4 | 2
? Same v — total distance = | *4 | 0 | 2
? If v(t) > 0 the whole time, displacement and distance are … | *equal | opposite | unrelated
`;
