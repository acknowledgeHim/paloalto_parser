/** ➗ More 8th grade math — algebra 2 (format: ../mathLessonsParse.ts; the right choice is starred). */
export const M_8 = `
@ square-roots-solve | Quadratics | Solving by square roots
If there's no x term, get x² alone and take **±** the square root.

- x² − 49 = 0 → x² = 49 → x = **±7**
? x² = 81 → x = | *±9 | 9 | 40.5
? 2x² = 50 → x = | *±5 | ±25 | 5
? (x − 3)² = 16 → x = | *7 or −1 | 7 | 19 or −13

@ discriminant | Quadratics | The discriminant
For ax² + bx + c = 0, **D = b² − 4ac**.

- D > 0 → 2 real solutions
- D = 0 → 1 real solution
- D < 0 → 2 complex solutions (no real ones)
? x² + 6x + 9 = 0 has D = | *0 | 72 | 36
? x² + 2x + 5 = 0 has how many real solutions? | *0 | 1 | 2
? x² − 5x + 6 = 0 has how many real solutions? | *2 | 1 | 0

@ roots-to-quadratic | Quadratics | Writing a quadratic from its roots
Roots r and s → **(x − r)(x − s) = 0**.

- Roots 2 and −5 → (x − 2)(x + 5) = x² + 3x − 10
? Roots 3 and 4 → | *x² − 7x + 12 | x² + 7x + 12 | x² − x − 12
? Roots −1 and −6 → | *x² + 7x + 6 | x² − 7x + 6 | x² + 5x − 6
? Roots ±2 → | *x² − 4 | x² + 4 | x² − 4x + 4

@ projectile | Quadratics | Projectile problems
Height **h = −16t² + v₀t + h₀** (feet, seconds). The top is at the **vertex**, t = −b / 2a.
? A ball: h = −16t² + 64t. When is it highest? | *t = 2 s | t = 4 s | t = 64 s
? Same ball — when does it land? | *t = 4 s | t = 2 s | t = 16 s
? Same ball — max height? | *64 ft | 128 ft | 32 ft

@ quadratic-inequalities | Quadratics | Quadratic inequalities
Find the roots, then test the regions between them.

- x² − x − 6 < 0 → (x − 3)(x + 2) < 0 → **−2 < x < 3**
? x² − 9 > 0 → | *x < −3 or x > 3 | −3 < x < 3 | x > 9
? (x − 1)(x − 5) ≤ 0 → | *1 ≤ x ≤ 5 | x ≤ 1 or x ≥ 5 | x ≤ 5
? Is x = 0 a solution of x² − 4x + 3 > 0? | *yes | no

@ rational-equations | Rational expressions | Solving rational equations
Multiply every term by the **common denominator**, solve, then **check** — reject values that make a denominator 0.

- 2/x + 1 = 5/x → 2 + x = 5 → x = 3 ✅
? 6/x = 3 → x = | *2 | 18 | 1/2
? x/(x − 2) = 3 → x = | *3 | 2 | 6
? 1/(x − 1) = 2/(x − 1) has … | *no solution | x = 1 | x = 2

@ radical-equations | Radicals | Solving radical equations
Get the radical alone, **square** both sides, solve, and **check** for extraneous solutions.

- √(x + 3) = 5 → x + 3 = 25 → **x = 22**
? √(2x) = 6 → x = | *18 | 3 | 72
? √(x − 1) + 2 = 5 → x = | *10 | 8 | 4
? √x = −3 has … | *no real solution | x = 9 | x = −9

@ radical-ops | Radicals | Adding and multiplying radicals
- Add **like** radicals: 3√2 + 5√2 = 8√2
- Multiply: √3 · √12 = √36 = 6
? 4√5 − √5 = | *3√5 | 4 | 3
? √8 + √2 = | *3√2 | √10 | 4√2
? √6 · √6 = | *6 | 36 | 2√6

@ rationalize | Radicals | Rationalizing denominators
Multiply top and bottom to remove a radical from the bottom.

- 3/√2 = 3√2/2
- 1/(1 + √2) → multiply by (1 − √2) → **√2 − 1**
? 5/√5 = | *√5 | 5√5 | 1
? 2/√3 = | *2√3/3 | 2√3 | √3/2
? 1/(√3 − 1) = | *(√3 + 1)/2 | √3 + 1 | (√3 − 1)/2

@ complex-ops | Complex numbers | Multiplying and dividing complex numbers
Remember **i² = −1**. To divide, multiply by the **conjugate**.

- (2 + i)(3 − i) = 6 − 2i + 3i − i² = **7 + i**
? (1 + i)(1 − i) = | *2 | 0 | 2i
? i³ = | *−i | i | −1
? (3 + 2i) + (1 − 5i) = | *4 − 3i | 4 + 7i | 2 − 3i

@ function-notation | Functions | Function notation
**f(x)** means "f of x" — plug in the value.

- f(x) = 2x² − 1 → f(3) = 18 − 1 = **17**
? f(x) = 4x + 1. f(−2) = | *−7 | 9 | −9
? g(x) = x² − x. g(5) = | *20 | 30 | 24
? If f(x) = 3x and f(a) = 21, a = | *7 | 63 | 18

@ rate-of-change | Functions | Average rate of change
**(f(b) − f(a)) ÷ (b − a)** — the slope between two points on a graph.
? f(x) = x². Average rate of change from 1 to 3? | *4 | 8 | 2
? f(x) = 2ˣ. From 0 to 3? | *7/3 | 8/3 | 2
? f(x) = 5x − 2 from any a to b? | *5 | −2 | 3

@ same-base | Exponentials | Exponential equations with the same base
Write both sides with the same base, then set the exponents equal.

- 2ˣ = 32 = 2⁵ → **x = 5**
- 9ˣ = 27 → 3²ˣ = 3³ → **x = 3/2**
? 3ˣ = 81 → x = | *4 | 27 | 3
? 5ˣ⁺¹ = 125 → x = | *2 | 3 | 4
? 4ˣ = 8 → x = | *3/2 | 2 | 2/3

@ log-convert | Logarithms | Logs and exponents are two views of one fact
**log_b(y) = x** means **bˣ = y**.

- log₂(8) = 3 because 2³ = 8
? log₃(9) = | *2 | 3 | 27
? log₁₀(1,000) = | *3 | 100 | 10
? log₅(1) = | *0 | 1 | 5

@ rational-add | Rational expressions | Adding rational expressions
Find a common denominator, then add the tops.

- 1/x + 2/(x + 1) = (x + 1 + 2x) / (x(x + 1)) = **(3x + 1)/(x(x + 1))**
? 3/x + 5/x = | *8/x | 8/2x | 15/x
? 1/2 + 1/x = | *(x + 2)/(2x) | 2/(2 + x) | 1/(2x)
? 2/(x − 1) − 1/(x − 1) = | *1/(x − 1) | 1/0 | 3/(x − 1)

@ rational-mult | Rational expressions | Multiplying and dividing rational expressions
Factor everything, cancel common factors, then multiply. To divide, flip the second fraction.

- (x² − 4)/x · x/(x + 2) = (x − 2)(x + 2)/x · x/(x + 2) = **x − 2**
? (x/3) · (6/x²) = | *2/x | 2x | 6/(3x²)
? (x + 1)/x ÷ (x + 1)/2 = | *2/x | x/2 | (x + 1)²/(2x)
? (x² − 9)/(x − 3) = | *x + 3 | x − 3 | x² − 3

@ sum-diff-cubes | Factoring | Sum and difference of cubes
- a³ + b³ = (a + b)(a² − ab + b²)
- a³ − b³ = (a − b)(a² + ab + b²)
? x³ − 8 = | *(x − 2)(x² + 2x + 4) | (x − 2)³ | (x − 2)(x² − 2x + 4)
? x³ + 27 = | *(x + 3)(x² − 3x + 9) | (x + 3)³ | (x + 3)(x² + 3x + 9)
? 8x³ − 1 = | *(2x − 1)(4x² + 2x + 1) | (2x − 1)³ | (8x − 1)(x² + 1)

@ factor-theorem | Polynomials | The factor theorem
If **p(a) = 0**, then **(x − a)** is a factor.

- p(x) = x³ − 6x² + 11x − 6, p(1) = 0 → (x − 1) is a factor
? p(x) = x² − 5x + 6. Is (x − 2) a factor? | *yes (p(2) = 0) | no
? p(x) = x³ − 1. Which is a factor? | *x − 1 | x + 1 | x − 3
? p(−3) = 0 means … is a factor | *x + 3 | x − 3 | x

@ synthetic-division | Polynomials | Synthetic division
A shortcut to divide by **(x − a)**: bring down, multiply by a, add, repeat.

- (x² + 5x + 6) ÷ (x + 2): use −2 → 1, 3, remainder 0 → **x + 3**
? (x² − 7x + 10) ÷ (x − 2) = | *x − 5 | x + 5 | x − 7
? (x² + x − 1) ÷ (x − 1) has remainder … | *1 | 0 | −1
? (x³ − 8) ÷ (x − 2) = | *x² + 2x + 4 | x² − 4 | x² − 2x + 4

@ multiplicity | Polynomials | Zeros and multiplicity
A factor repeated **k** times has multiplicity k.

- **Odd** multiplicity → the graph **crosses** the x-axis
- **Even** multiplicity → the graph **touches and turns**
? p(x) = (x − 1)²(x + 4). At x = 1 the graph … | *touches and turns | crosses
? Same p — at x = −4 the graph … | *crosses | touches and turns
? The degree of (x − 2)³(x + 1) is … | *4 | 3 | 2

@ variation | Functions | Direct, inverse and joint variation
- **Direct:** y = kx
- **Inverse:** y = k/x
- **Joint:** z = kxy
? y varies inversely with x; y = 6 when x = 2. Find y when x = 4. | *3 | 12 | 8
? y varies directly with x; y = 15 when x = 3. k = | *5 | 45 | 1/5
? If y = k/x and x doubles, y … | *halves | doubles | stays the same

@ line-parabola | Systems | A line and a parabola
Substitute the line into the parabola and solve the quadratic.

- y = x² and y = x + 2 → x² − x − 2 = 0 → x = 2 or −1 → (2, 4), (−1, 1)
? y = x² and y = 4 meet at … | *(2, 4) and (−2, 4) | (4, 2) only | (2, 4) only
? y = x² + 1 and y = 0. How many intersection points? | *0 | 1 | 2
? y = x² and y = 2x meet at x = | *0 and 2 | 2 only | 1 and 2

@ inequality-systems | Systems | Systems of inequalities
Graph each inequality and shade. The answer is where the shading **overlaps**.
? Is (1, 1) in y > x and y < 3? | *no (1 is not > 1) | yes
? Is (0, 2) in y ≥ x + 1 and y ≤ 4? | *yes | no
? A dashed boundary line means … | *the line is not included | the line is included

@ abs-graphs | Functions | Graphing absolute value functions
**y = a|x − h| + k** is a V with its vertex at **(h, k)**. If a < 0 it opens down.
? The vertex of y = |x − 3| + 2 is … | *(3, 2) | (−3, 2) | (2, 3)
? y = −|x| opens … | *down | up
? y = 2|x| is ___ than y = |x| | *narrower | wider

@ arith-formula | Sequences | The arithmetic sequence formula
**aₙ = a₁ + (n − 1)d**, where d is the common difference.

- 5, 8, 11, … → a₁₀ = 5 + 9(3) = **32**
? 2, 6, 10, … a₂₀ = | *78 | 80 | 82
? 50, 45, 40, … the common difference is … | *−5 | 5 | 45
? If a₁ = 7 and d = 4, a₅ = | *23 | 27 | 20

@ geo-formula | Sequences | The geometric sequence formula
**aₙ = a₁ · rⁿ⁻¹**, where r is the common ratio.

- 3, 6, 12, … → a₆ = 3 · 2⁵ = **96**
? 2, 10, 50, … the ratio is … | *5 | 8 | 10
? 1, 3, 9, … a₅ = | *81 | 27 | 243
? 64, 32, 16, … a₇ = | *1 | 2 | 1/2

@ half-life | Exponentials | Half-life
After each half-life, half is left: **A = A₀ (½)^(t/h)**.
? 80 g with half-life 5 years. Left after 10 years? | *20 g | 40 g | 10 g
? After 3 half-lives, what fraction is left? | *1/8 | 1/3 | 1/6
? 100 mg, half-life 2 hours. Left after 6 hours? | *12.5 mg | 25 mg | 33 mg

@ sqrt-functions | Functions | Graphing square root functions
**y = √(x − h) + k** starts at **(h, k)** and curves up to the right. The domain is x ≥ h.
? y = √(x − 4) starts at … | *(4, 0) | (−4, 0) | (0, 4)
? The domain of y = √(x + 2) is … | *x ≥ −2 | x ≥ 2 | all real numbers
? y = √x + 3 passes through … | *(9, 6) | (9, 3) | (3, 9)

@ best-fit | Statistics | Lines of best fit
A **line of best fit** follows the trend of a scatter plot. Use it to **predict**.

- **r** (correlation) near 1 → strong positive; near −1 → strong negative; near 0 → weak.
? The best-fit line is y = 2x + 10. Predict y at x = 15. | *40 | 25 | 32
? r = −0.95 means … | *strong negative correlation | weak correlation | no data
? Hours studied vs. test score usually has … correlation | *positive | negative
`;
