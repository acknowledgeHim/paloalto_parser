/** ➗ More 10th grade math — trigonometry (format: ../mathLessonsParse.ts; the right choice is starred). */
export const M_10 = `
@ deg-rad | Angles | Converting degrees and radians
- Degrees → radians: multiply by **π/180**
- Radians → degrees: multiply by **180/π**
? 60° = | *π/3 | π/6 | 3π
? 3π/4 = | *135° | 45° | 270°
? 1 radian is about … | *57.3° | 1° | 180°

@ coterminal | Angles | Coterminal angles
Angles that end in the same place differ by **360°** (or **2π**).
? An angle coterminal with 30° is … | *390° | 330° | 60°
? An angle coterminal with −45° between 0° and 360° is … | *315° | 45° | 135°
? An angle coterminal with π/3 is … | *7π/3 | 2π/3 | −π/3

@ unit-circle-coords | Unit circle | Points on the unit circle
On the unit circle, the point at angle θ is **(cos θ, sin θ)**.
? The point at 90° is … | *(0, 1) | (1, 0) | (−1, 0)
? The point at 60° is … | *(1/2, √3/2) | (√3/2, 1/2) | (√2/2, √2/2)
? The point at 180° is … | *(−1, 0) | (0, −1) | (1, 0)

@ astc | Unit circle | Signs in the four quadrants
"**A**ll **S**tudents **T**ake **C**alculus":

- Q I: **All** positive · Q II: **Sin** · Q III: **Tan** · Q IV: **Cos**
? In quadrant III, which is positive? | *tan | sin | cos
? sin 200° is … | *negative | positive
? cos 300° is … | *positive | negative

@ trig-from-point | Unit circle | Trig values from a point
For a point (x, y) on the terminal side, **r = √(x² + y²)**; sin = y/r, cos = x/r, tan = y/x.
? Point (3, 4): sin θ = | *4/5 | 3/5 | 4/3
? Point (−5, 12): cos θ = | *−5/13 | 5/13 | 12/13
? Point (−1, −1): tan θ = | *1 | −1 | √2

@ one-ratio | Unit circle | Finding all trig values from one
Draw a triangle, find the third side, and use the quadrant for signs.

- sin θ = 3/5 in Q II → cos θ = **−4/5**, tan θ = **−3/4**
? cos θ = 5/13 in Q IV. sin θ = | *−12/13 | 12/13 | −5/12
? tan θ = 1 in Q III. sin θ = | *−√2/2 | √2/2 | −1
? sin θ = −1/2 in Q III. cos θ = | *−√3/2 | √3/2 | −1/2

@ solve-right | Right triangles | Solving a right triangle
"Solve" means find **every** side and angle. Use SOH-CAH-TOA, the Pythagorean theorem, and angles summing to 90°.
? A right triangle has an angle of 35°. The other acute angle is … | *55° | 65° | 145°
? Hypotenuse 10, angle 30°. The side opposite 30° is … | *5 | 5√3 | 10√3
? Legs 7 and 7. The acute angles are … | *45° each | 30° and 60° | 7° each

@ bearings | Applications | Bearings
A bearing measures **clockwise from north**: N = 000°, E = 090°, S = 180°, W = 270°.
? A ship heads due east. Bearing? | *090° | 270° | 000°
? Bearing 225° points … | *southwest | northeast | southeast
? Walk 3 km north then 4 km east. Distance from start? | *5 km | 7 km | 1 km

@ two-triangles | Applications | Two-triangle problems
Some problems need **two** right triangles that share a side.

- From 100 m away, the angle to a tower top is 30°: height = 100 tan 30° ≈ **57.7 m**
? From 50 m away the angle of elevation is 45°. Height? | *50 m | 25 m | 70.7 m
? A kite string is 80 m at 30° to the ground. The kite's height is … | *40 m | 69.3 m | 80 m
? Two observers see a plane at different angles. You often solve by … | *writing two tangent equations for the same height | using the law of sines only

@ ambiguous-case | Oblique triangles | The ambiguous case (SSA)
With two sides and a non-included angle there can be **0, 1 or 2** triangles.

- If sin B > 1 → no triangle
- If sin B < 1, check whether 180° − B also works → maybe two
? sin B comes out 1.3. How many triangles? | *0 | 1 | 2
? A = 30°, a = 5, b = 10. sin B = 1. How many triangles? | *1 (a right triangle) | 2 | 0
? A = 30°, a = 6, b = 10. sin B = 5/6. How many triangles? | *2 | 1 | 0

@ amplitude-period | Graphs | Amplitude and period
For **y = A sin(Bx)**: amplitude = **|A|**, period = **2π / B**.
? y = 3 sin x has amplitude … | *3 | 1 | 2π
? y = sin 2x has period … | *π | 2π | 4π
? y = −4 cos(x/2) has period … | *4π | π | 8π

@ sinusoid-models | Graphs | Modeling with sine
Ferris wheels, tides and daylight repeat in waves.

- midline = (max + min)/2, amplitude = (max − min)/2
? A tide goes from 2 m to 10 m. The midline is … | *6 m | 8 m | 4 m
? Same tide — the amplitude is … | *4 m | 8 m | 6 m
? A Ferris wheel turns once every 40 s. The period is … | *40 s | 20 s | 2π s

@ sec-csc-graphs | Graphs | Graphs of secant and cosecant
sec x = 1/cos x has **vertical asymptotes** where cos x = 0. csc x = 1/sin x has them where sin x = 0.
? sec x has asymptotes at … | *x = π/2 + πn | x = πn | x = 2πn
? The range of csc x is … | *y ≤ −1 or y ≥ 1 | −1 ≤ y ≤ 1 | all real numbers
? csc x has an asymptote at x = | *π | π/2 | π/4

@ verify-identities | Identities | Proving identities
Work on **one side** only. Rewrite in sines and cosines, factor, or use Pythagorean identities.

- tan x · cos x = (sin x / cos x) · cos x = **sin x**
? sec x · cos x = | *1 | sec² x | 0
? (1 − cos² x) / sin x = | *sin x | cos x | 1
? sin x / tan x = | *cos x | sec x | sin² x

@ quadratic-trig | Equations | Quadratic-type trig equations
Treat sin x (or cos x) like a variable and factor.

- 2sin²x − sin x − 1 = 0 → (2sin x + 1)(sin x − 1) = 0 → sin x = −1/2 or 1
? sin²x = 1/4 on [0, 2π) has how many solutions? | *4 | 2 | 1
? cos²x − cos x = 0 → cos x = | *0 or 1 | 1 only | −1 or 0
? 2cos²x = 1 → cos x = | *±√2/2 | ±1/2 | √2

@ general-solutions | Equations | All the solutions
Trig equations repeat. Add **2πn** for sin and cos, **πn** for tan.

- sin x = 0 → x = **πn**
? cos x = 1 → x = | *2πn | πn | π/2 + πn
? tan x = 1 → x = | *π/4 + πn | π/4 + 2πn | π/4 only
? sin x = 1 → x = | *π/2 + 2πn | π/2 + πn | πn

@ power-reducing | Identities | Power-reducing formulas
- sin²x = (1 − cos 2x)/2
- cos²x = (1 + cos 2x)/2
? cos²x = | *(1 + cos 2x)/2 | (1 − cos 2x)/2 | 2cos x
? sin²(15°) = | *(1 − cos 30°)/2 | (1 + cos 30°)/2 | sin 30°/2
? These formulas help in calculus to … | *integrate sin² and cos² | find slopes of lines

@ vector-components | Vectors | Vector components
A vector of length **r** at angle θ has components **(r cos θ, r sin θ)**.
? A vector of length 10 at 30° has x-component … | *5√3 | 5 | 10
? Length 6 at 90° → components | *(0, 6) | (6, 0) | (3, 3)
? Vector (3, 4) has length … | *5 | 7 | 12

@ vector-ops | Vectors | Adding vectors and scalar multiples
Add vectors **component by component**. Multiply by a number to stretch.

- (2, 3) + (4, −1) = (6, 2); 3(1, 2) = (3, 6)
? (1, 5) + (−3, 2) = | *(−2, 7) | (4, 3) | (−3, 10)
? 2(4, −3) = | *(8, −6) | (6, −1) | (8, 6)
? (5, 5) − (2, 7) = | *(3, −2) | (7, 12) | (3, 2)

@ unit-vectors | Vectors | Unit vectors and i, j
A **unit vector** has length 1. Divide a vector by its length. **i** = (1, 0), **j** = (0, 1).
? The unit vector in the direction of (3, 4) is … | *(3/5, 4/5) | (3, 4) | (1, 1)
? 5i − 2j = | *(5, −2) | (−2, 5) | (5, 2)
? The length of i + j is … | *√2 | 2 | 1

@ wind-current | Vectors | Navigation with vectors
The actual path = **heading vector + wind (or current) vector**.
? A boat goes 4 km/h north in a 3 km/h east current. Actual speed? | *5 km/h | 7 km/h | 1 km/h
? A plane flies east at 300 mph into a 50 mph headwind from the east. Ground speed? | *250 mph | 350 mph | 300 mph
? Resultant of (200, 0) and (0, −50) is … | *(200, −50) | (150, 0) | (250, 0)

@ polar-convert | Polar | Converting polar and rectangular equations
Use **x = r cos θ**, **y = r sin θ**, **r² = x² + y²**.
? r = 4 in rectangular form is … | *x² + y² = 16 | x = 4 | y = 4
? x = 3 in polar form is … | *r cos θ = 3 | r = 3 | θ = 3
? r = 2 sin θ is a … | *circle | line | rose

@ polar-graphs | Polar | Polar graphs
- **r = a** → circle
- **r = a cos(nθ)** → rose (n petals if n is odd, 2n if even)
- **r = a + a cos θ** → cardioid (heart)
? r = 3 cos(3θ) has how many petals? | *3 | 6 | 9
? r = 2 sin(2θ) has how many petals? | *4 | 2 | 8
? r = 1 + cos θ is a … | *cardioid | circle | rose

@ inverse-compositions | Inverse trig | Compositions like sin(arccos x)
Draw the triangle for the inside function, then read the outside one.

- sin(arccos 3/5) → cos θ = 3/5 → opposite = 4 → **4/5**
? cos(arcsin 5/13) = | *12/13 | 5/12 | 13/12
? tan(arccos 4/5) = | *3/4 | 4/3 | 3/5
? sin(arcsin 0.7) = | *0.7 | 0.3 | 1/0.7

@ harmonic-motion | Applications | Simple harmonic motion
A spring or pendulum: **d = a sin(ωt)** or a cos(ωt). Frequency = ω / 2π (cycles per second).
? d = 5 cos(4πt). The amplitude is … | *5 | 4π | 2
? Same — the frequency is … | *2 per second | 4π per second | 1/2 per second
? Same — the period is … | *1/2 s | 2 s | 4π s

@ calculator-mode | Tools | Degree mode vs. radian mode
A calculator in the wrong mode gives wrong answers! sin 30 = **0.5** in degree mode but ≈ **−0.988** in radian mode.
? sin(90) gives 0.894 on your calculator. It's in … | *radian mode | degree mode
? For sin(π/6), use … | *radian mode | degree mode
? cos(0) in either mode is … | *1 | 0 | depends on the mode

@ law-cosines-angle | Oblique triangles | Finding an angle with the law of cosines
Rearrange: **cos C = (a² + b² − c²) / (2ab)**.
? Sides 3, 4, 5: the angle opposite 5 is … | *90° | 60° | 45°
? An equilateral triangle: cos C = | *1/2 | 0 | 1
? Sides 5, 7, 8: cos of the angle opposite 7 = (25 + 64 − 49)/80 = | *1/2 (60°) | 0 | √3/2

@ slope-angle | Applications | Slope and angle: tan θ = m
The angle a line makes with the x-axis satisfies **tan θ = slope**.
? A line with slope 1 makes an angle of … | *45° | 30° | 60°
? A line at 60° has slope … | *√3 | 1/2 | √3/3
? A ramp rises 1 m for every 10 m across. Its angle is about … | *5.7° | 10° | 45°
`;
