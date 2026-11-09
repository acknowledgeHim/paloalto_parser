/** ➗ More math lessons: 9th (Geometry), 10th (Trigonometry), 11th (Pre-Calculus), 12th (Calculus). Format: see mathLessonsParse.ts. */

export const MATH_9 = `
@ basics | Foundations | Points, lines, planes and segments
- **Point:** a location with no size, named with a capital letter: A
- **Line:** straight and endless both ways, through any two points: line AB
- **Plane:** a flat surface that goes on forever
- **Segment AB:** the part of a line between A and B
- **Collinear:** on the same line; **coplanar:** on the same plane

**Segment addition:** if B is between A and C, then AB + BC = AC.
**Midpoint:** splits a segment into two equal halves.
? B is between A and C. AB = 5 and BC = 8. AC = | 3 | *13 | 40
? Two different lines can meet in at most … | *one point | two points | a whole line
? M is the midpoint of PQ and PM = 7. PQ = | 3.5 | 7 | *14

@ distance-midpoint | Coordinate geometry | Distance and midpoint formulas
**Distance:** d = √((x₂ − x₁)² + (y₂ − y₁)²) — it's the Pythagorean theorem!

From (1, 2) to (4, 6): √(3² + 4²) = √25 = **5**

**Midpoint:** ((x₁ + x₂)/2, (y₁ + y₂)/2) — average the x's and average the y's.

The midpoint of (−2, 3) and (6, 7) is **(2, 5)**
? The distance from (0, 0) to (6, 8) | 14 | *10 | 7
? The midpoint of (2, 4) and (8, 10) | (6, 6) | *(5, 7) | (10, 14)
? The midpoint of AB is (3, 1) and A = (1, −2). B = | (2, −0.5) | *(5, 4) | (4, 3)

@ parallel-transversal | Lines | Parallel lines and a transversal
A **transversal** crossing two parallel lines makes 8 angles. Only **two sizes** appear, and they add up to **180°**.
- **Corresponding** angles (the same spot at each crossing): **equal**
- **Alternate interior** angles (inside, on opposite sides): **equal**
- **Alternate exterior** angles: **equal**
- **Same-side interior** angles: **add up to 180°**

If one angle is 65°, every angle is either 65° or 115°.
? With parallel lines, corresponding angles are … | supplementary | *equal | complementary
? Same-side interior angles: one is 70°. The other is … | 70° | 20° | *110°
? Alternate interior angles are 3x + 10 and 5x − 20. x = | 5 | *15 | 30

@ congruence | Triangles | Congruent triangles
**Congruent** = the same shape and the same size. To prove two triangles congruent you need just three matching parts:
- **SSS:** three sides
- **SAS:** two sides and the angle **between** them
- **ASA:** two angles and the side between them
- **AAS:** two angles and a side that isn't between them
- **HL:** (right triangles) the hypotenuse and a leg

❌ **AAA** only shows the same shape, not the same size.
❌ **SSA** doesn't work in general.

**CPCTC:** corresponding parts of congruent triangles are congruent.
? Two sides and the angle between them match. That's … | SSA | *SAS | ASA
? Which does NOT prove two triangles congruent? | SSS | ASA | *AAA
? Two right triangles have equal hypotenuses and one equal leg. Use … | *HL | AAA | SSA

@ similar | Triangles | Similar triangles
**Similar** = the same shape, maybe a different size. The angles are equal and the sides are **in proportion**.

Prove triangles similar with **AA** (two angles), **SSS~** (all sides in proportion) or **SAS~**.

If △ABC ~ △DEF with AB = 4 and DE = 10 (scale factor 2.5), and BC = 6, then EF = 6 × 2.5 = **15**

Shadows: a 6 ft person casts a 4 ft shadow while a tree casts a 20 ft shadow → the tree is **30 ft**
? Two triangles each have angles of 40° and 75°. They are … | congruent | *similar | neither
? Triangles with sides 3, 4, 5 and 6, 8, 10. The scale factor is … | 3 | *2 | 1/3
? A 5 ft kid has a 3 ft shadow. A pole's shadow is 12 ft. The pole is … | 7.2 ft | *20 ft | 15 ft

@ special-right | Right triangles | Special right triangles
**45°-45°-90°:** the legs are equal; hypotenuse = **leg × √2**
- legs of 5 → hypotenuse 5√2

**30°-60°-90°:** sides in the ratio **1 : √3 : 2**
- short leg (across from 30°) = x
- long leg (across from 60°) = x√3
- hypotenuse = 2x

Hypotenuse 10 → short leg 5, long leg 5√3
? A 45-45-90 triangle has legs of 7. The hypotenuse is … | 14 | *7√2 | 7√3
? A 30-60-90 triangle has a short leg of 4. The hypotenuse is … | 4√3 | *8 | 4√2
? A 30-60-90 triangle has a hypotenuse of 12. The long leg is … | 6 | *6√3 | 12√3

@ triangle-inequality | Triangles | The triangle inequality, sides and angles
**Triangle inequality:** any two sides must add up to **more than** the third.
- 3, 4, 8? 3 + 4 = 7, which is less than 8 → ❌ not a triangle
- A triangle with sides 5 and 9 has a third side between **4 and 14**

**The biggest angle is across from the longest side** (and the smallest across from the shortest).

**Exterior angle** = the sum of the two far-away interior angles.
? Can 2, 5 and 6 be the sides of a triangle? | *yes | no
? Two sides are 6 and 10. The third side could be … | 3 | *12 | 16
? A triangle has sides 7, 9 and 12. The largest angle is across from the side … | 7 | 9 | *12

@ midsegments | Triangles | Midsegments, medians and centers
- **Midsegment:** joins the midpoints of two sides; it's **parallel** to the third side and **half** as long
- **Median:** from a vertex to the midpoint of the opposite side. The three meet at the **centroid**, **2/3** of the way along each median from its vertex
- **Circumcenter:** where the perpendicular bisectors meet — the center of the circle through all three vertices
- **Incenter:** where the angle bisectors meet — the center of the circle inside that touches all three sides
? A midsegment is parallel to a side of length 18. The midsegment is … | 18 | *9 | 36
? A median is 12 long. How far is the centroid from the vertex? | 4 | 6 | *8
? The point the same distance from all three vertices is the … | incenter | *circumcenter | centroid

@ quadrilaterals | Polygons | Parallelograms and other quadrilaterals
**Parallelogram:** opposite sides parallel and equal, opposite angles equal, neighboring angles add up to 180°, and the **diagonals bisect each other**.
- **Rectangle:** also, the diagonals are **equal**
- **Rhombus:** also, the diagonals are **perpendicular**
- **Square:** all of the above
- **Trapezoid:** exactly one pair of parallel sides; its median = (base₁ + base₂)/2
- **Kite:** two pairs of equal neighboring sides; its diagonals are perpendicular
? One angle of a parallelogram is 110°. A neighboring angle is … | 110° | *70° | 90°
? Which always has perpendicular diagonals? | rectangle | *rhombus | trapezoid
? A trapezoid's bases are 8 and 14. Its median is … | 22 | *11 | 6

@ area-composite | Area | Area review and shaded regions
- Rectangle **lw**, triangle **½bh**, parallelogram **bh**, trapezoid **½(b₁ + b₂)h**
- Circle **πr²**
- Rhombus or kite: **½ d₁ d₂** (half the product of the diagonals)
- Regular polygon: **½ × apothem × perimeter**

**Shaded region** = the big area − the cut-out area.

A 10 × 10 square with a circle of radius 5 cut out: 100 − 25π ≈ **21.5**
? A rhombus has diagonals 6 and 10. Its area is … | 60 | *30 | 16
? A regular hexagon has perimeter 36 and apothem 3√3. Its area is … | *54√3 | 108√3 | 18√3
? An 8 × 8 square with a 2 × 2 hole. The area left is … | 56 | *60 | 64

@ circle-angles | Circles | Chords, arcs and angles in circles
- **Central angle** (vertex at the center) = its arc
- **Inscribed angle** (vertex on the circle) = **half** its arc
- An angle inscribed in a **semicircle** is **90°**
- A **tangent** line is **perpendicular** to the radius where it touches
- Two tangents from the same outside point are **equal** in length

The opposite angles of a quadrilateral drawn inside a circle add up to **180°**.
? An inscribed angle cuts off an 80° arc. The angle is … | 80° | *40° | 160°
? A triangle is drawn in a circle with one side a diameter. The angle across from the diameter is … | 45° | 60° | *90°
? A central angle is 110°. Its arc is … | 55° | *110° | 220°

@ arc-sector | Circles | Arc length and sector area
A sector is a "pizza slice" with angle θ (in degrees):
- **Arc length = (θ/360) × 2πr**
- **Sector area = (θ/360) × πr²**

r = 6 and θ = 60°: arc = (1/6)(12π) = **2π**; area = (1/6)(36π) = **6π**

With θ in radians: arc = **rθ** and area = **½r²θ**.
? The arc length for r = 10 and θ = 90° | 10π | *5π | 25π
? The sector area for r = 4 and θ = 180° | *8π | 16π | 4π
? In radians, the arc for r = 3 and θ = 2 is … | 6π | *6 | 1.5

@ circle-equation | Circles | The equation of a circle
A circle with center **(h, k)** and radius **r**:

**(x − h)² + (y − k)² = r²**

- Center (2, −3), radius 4 → (x − 2)² + (y + 3)² = 16
- x² + y² = 25 → center (0, 0), radius **5**

If the equation isn't in this form, **complete the square** for x and for y.
? The center of (x + 1)² + (y − 5)² = 9 | (1, −5) | *(−1, 5) | (−1, −5)
? The radius of (x − 4)² + y² = 49 | 49 | *7 | 4
? The circle with center (0, 0) and radius 3 | x² + y² = 3 | *x² + y² = 9 | x + y = 3

@ surface-area | Solids | Surface area of solids
- **Prism:** 2 × (base area) + (perimeter of the base) × h
- **Cylinder:** 2πr² + 2πrh
- **Pyramid:** base area + ½ × perimeter × slant height
- **Cone:** πr² + πrℓ (ℓ = slant height)
- **Sphere:** **4πr²**

A cylinder with r = 3 and h = 5: 2π(9) + 2π(3)(5) = 18π + 30π = **48π**
? The surface area of a sphere with r = 2 | 8π | *16π | 32π/3
? The surface area of a cylinder with r = 1 and h = 4 | 6π | *10π | 8π
? The label around a can (no top or bottom) is the cylinder's … | base area | *side area, 2πrh | volume

@ volume | Solids | Volume of solids
- **Prism and cylinder:** V = (base area) × h → cylinder **πr²h**
- **Pyramid and cone:** **⅓** × base area × h → cone **⅓πr²h**
- **Sphere:** **(4/3)πr³**

A cone holds a third of the cylinder with the same base and height.

**Cavalieri's principle:** a slanted (oblique) solid has the same volume as a straight one with the same base and height.
? A cylinder with r = 2 and h = 5 | 10π | *20π | 40π
? A cone with r = 3 and h = 4 | 36π | *12π | 4π
? A sphere with r = 3 | *36π | 27π | 12π

@ transformations | Transformations | Translations, reflections, rotations and dilations
- **Translation (slide):** (x, y) → (x + a, y + b)
- **Reflection:** across the x-axis (x, −y); across the y-axis (−x, y); across y = x (y, x)
- **Rotation** about the origin: 90° counterclockwise (−y, x); 180° (−x, −y)
- **Dilation** by k: (kx, ky) — it changes the size, so the result is similar, not congruent

The first three keep the size and shape (**rigid motions** → congruent).
? (3, 5) reflected across the x-axis | (−3, 5) | *(3, −5) | (5, 3)
? (2, 1) rotated 180° about the origin | (1, 2) | *(−2, −1) | (−1, 2)
? (4, −2) dilated by 3 | (7, 1) | *(12, −6) | (4/3, −2/3)

@ logic-proof | Logic | If-then statements and proofs
**Conditional:** if p, then q.
- **Converse:** if q, then p
- **Inverse:** if not p, then not q
- **Contrapositive:** if not q, then not p — **always true when the original is**

"If it's a square, then it's a rectangle." (true) Its converse, "If it's a rectangle, then it's a square," is false!

A **two-column proof** lists statements on the left and reasons (givens, definitions, postulates, theorems) on the right.
? The contrapositive of "if p, then q" is … | if q, then p | *if not q, then not p | if not p, then not q
? "If an angle is 30°, it's acute." Its converse ("if an angle is acute, it's 30°") is … | *false | true
? Which is always true when the statement is true? | the converse | the inverse | *the contrapositive

@ slopes-proofs | Coordinate geometry | Proving shapes with slopes and distances
Use coordinates to prove things:
- **Parallel:** equal slopes
- **Perpendicular:** slopes multiply to **−1** (like 2 and −1/2)
- **Equal sides:** the distance formula
- **Bisect each other:** the same midpoint

Is ABCD a rectangle? Check that opposite sides are parallel and neighboring sides are perpendicular.
? Slopes 3 and −1/3 mean the lines are … | parallel | *perpendicular | neither
? Two different lines with slopes 2/5 and 2/5 are … | *parallel | perpendicular | neither
? A quadrilateral's diagonals have the same midpoint. It must be a … | square | *parallelogram | trapezoid

@ scale-area-volume | Similarity | Scale factor, area and volume
If two similar shapes have scale factor **k**:
- lengths (and perimeters) × **k**
- areas × **k²**
- volumes × **k³**

Twice as tall (k = 2) → 4 times the paint and 8 times the water.
? Similar shapes with k = 3. The bigger one's area is how many times as big? | 3 | *9 | 27
? Two similar cubes have volumes 8 and 64. The scale factor is … | 8 | *2 | 4
? Two similar triangles have areas 16 and 25. The ratio of their sides is … | 16 : 25 | *4 : 5 | 2 : 3

@ euler | Solids | Faces, edges and vertices
**Euler's formula** for polyhedra (solids with flat faces): **F + V − E = 2**

- Cube: 6 faces + 8 vertices − 12 edges = 2 ✅
- Triangular prism: 5 + 6 − 9 = 2 ✅

The five **Platonic solids** (every face the same regular polygon): tetrahedron, cube, octahedron, dodecahedron, icosahedron.

**Cross sections:** slicing a cube can make a square, a rectangle, a triangle — even a hexagon.
? A solid has 8 faces and 6 vertices. How many edges? | 10 | *12 | 14
? How many faces does a square pyramid have? | 4 | *5 | 6
? Slicing a sphere with a flat cut makes a … | square | *circle | triangle
`;

export const MATH_10 = `
@ inverse-right | Right triangles | Finding an angle with inverse trig
When you know two sides and want the **angle**, use **sin⁻¹, cos⁻¹ or tan⁻¹**.

Opposite 5, adjacent 5: tan θ = 1 → θ = tan⁻¹(1) = **45°**
Opposite 3, hypotenuse 6: sin θ = 0.5 → θ = **30°**

Make sure your calculator is in **degree** mode!
? Adjacent 4 and hypotenuse 8. The angle is … | 30° | *60° | 45°
? tan θ = √3, so θ = | 30° | 45° | *60°
? To find an angle from the opposite and adjacent sides, use … | sin⁻¹ | cos⁻¹ | *tan⁻¹

@ elevation | Right triangles | Angles of elevation and depression
- **Angle of elevation:** looking **up** from level
- **Angle of depression:** looking **down** from level
Between the same two points they're equal (alternate interior angles).

You stand 50 m from a tower and look up 40° to the top: height = 50 × tan 40° ≈ **42 m**

Draw the right triangle first: the level distance, the height, and the line of sight as the hypotenuse.
? You're 20 ft from a tree and the top is at a 45° angle of elevation. The tree is … (ignore eye height) | 10 ft | *20 ft | 20√2 ft
? A plane 1,000 ft up sees a car at a 30° angle of depression. The level distance to the car is … | 500 ft | *1,000√3 ft | 2,000 ft
> tan 30° = 1000/d → d = 1000/tan 30° = 1000√3 ≈ 1,732 ft.
? Angles of elevation and depression between the same two points are … | complementary | *equal | supplementary

@ exact-values | Unit circle | Exact values for 30°, 45° and 60°
- **sin 30° = 1/2**, cos 30° = √3/2, tan 30° = √3/3
- **sin 45° = cos 45° = √2/2**, tan 45° = 1
- **sin 60° = √3/2**, cos 60° = 1/2, tan 60° = √3

A trick: sin of 0°, 30°, 45°, 60°, 90° = √0/2, √1/2, √2/2, √3/2, √4/2. Cosine is the same list backwards.
? sin 60° = | 1/2 | *√3/2 | √2/2
? cos 45° = | 1/2 | *√2/2 | 1
? tan 30° = | √3 | *√3/3 | 1

@ reference-angles | Unit circle | Reference angles and the four quadrants
A **reference angle** is the acute angle to the x-axis. Find its value, then pick the **sign** from the quadrant.

**All Students Take Calculus** (quadrants I → IV):
- I: **all** positive
- II: **sin** positive
- III: **tan** positive
- IV: **cos** positive

sin 150° → reference 30°, quadrant II (sin +) → **1/2**
cos 240° → reference 60°, quadrant III (cos −) → **−1/2**
? The reference angle of 135° | 35° | *45° | 135°
? cos 120° = | 1/2 | *−1/2 | −√3/2
? sin 330° = | 1/2 | *−1/2 | √3/2

@ reciprocal | Functions | Secant, cosecant and cotangent
- **csc θ = 1/sin θ**
- **sec θ = 1/cos θ**
- **cot θ = 1/tan θ = cos θ/sin θ**

sec 60° = 1/(1/2) = **2**; csc 30° = **2**; cot 45° = **1**

They're undefined where the bottom is 0: sec 90° and csc 0° don't exist.
? csc θ is the reciprocal of … | cos θ | *sin θ | tan θ
? sec 0° = | 0 | *1 | undefined
? cot 90° = | *0 | 1 | undefined

@ pythag-identity | Identities | The Pythagorean identities
On the unit circle x² + y² = 1, so:

**sin²θ + cos²θ = 1**

Divide by cos²θ: **1 + tan²θ = sec²θ**
Divide by sin²θ: **1 + cot²θ = csc²θ**

If sin θ = 3/5 (θ in quadrant I): cos²θ = 1 − 9/25 = 16/25 → **cos θ = 4/5**
? sin²40° + cos²40° = | 0 | *1 | 40
? cos θ = 5/13 in quadrant I. sin θ = | 8/13 | *12/13 | 13/12
? 1 + tan²θ = | csc²θ | *sec²θ | cot²θ

@ identities-more | Identities | Quotient, even-odd and cofunction identities
- **Quotient:** tan θ = sin θ / cos θ
- **Even/odd:** cos(−θ) = cos θ (even); sin(−θ) = −sin θ and tan(−θ) = −tan θ (odd)
- **Cofunction:** sin(90° − θ) = cos θ and cos(90° − θ) = sin θ

**Proving an identity:** work on one side only (usually the messier one) and rewrite in sines and cosines.
- tan θ · cos θ = (sin θ/cos θ) · cos θ = **sin θ**
? sin(−30°) = | 1/2 | *−1/2 | √3/2
? cos(90° − θ) = | cos θ | *sin θ | −sin θ
? sec θ · cos θ = | *1 | cos²θ | tan θ

@ sine-graphs | Graphs | Graphing sine and cosine
**y = A sin(Bx)** and **y = A cos(Bx)**
- **Amplitude = the size of A** (how high the wave goes from the middle)
- **Period = 2π/B** (or 360°/B) — the length of one full wave
- sine starts at 0 going up; cosine starts at the top

y = 3 sin(2x): amplitude **3**, period 2π/2 = **π**
? The amplitude of y = −5 cos x | −5 | *5 | 10
? The period of y = sin(4x) | 4π | *π/2 | 2π
? y = cos x at x = 0 is … | 0 | *1 | −1

@ shifts | Graphs | Phase shift and midline
**y = A sin(B(x − C)) + D**
- **C:** phase shift (right by C; left if it's negative)
- **D:** vertical shift — the **midline** is y = D

y = 2 sin(x − π/4) + 1 → amplitude 2, period 2π, shifted right π/4, midline y = 1, max 3, min −1

In real life, temperatures and tides follow waves like these.
? The midline of y = 4 cos x − 3 | y = 4 | *y = −3 | y = 0
? y = sin(x + π/3) is shifted … | right π/3 | *left π/3 | up π/3
? The maximum of y = 3 sin x + 2 | 3 | *5 | 2

@ tangent-graph | Graphs | The graph of tangent
**y = tan x**
- its period is **π** (not 2π!)
- it's 0 at 0, π, 2π …
- **vertical asymptotes** at π/2, 3π/2 … (where cos x = 0)
- each piece climbs from −∞ to +∞

**y = sec x** and **y = csc x** are U-shaped pieces with asymptotes where cos x or sin x is 0.
? The period of y = tan x | 2π | *π | π/2
? y = tan x has an asymptote at … | x = 0 | *x = π/2 | x = π
? The period of y = tan(2x) | 2π | π | *π/2

@ inverse-trig | Inverse trig | Inverse trig functions
They give back an **angle** — just one, from a set range:
- **arcsin x** (sin⁻¹): from −π/2 to π/2 (−90° to 90°)
- **arccos x** (cos⁻¹): from 0 to π (0° to 180°)
- **arctan x** (tan⁻¹): between −π/2 and π/2

arcsin(1/2) = **π/6**; arccos(−1/2) = **2π/3**; arctan(−1) = **−π/4**

arcsin 2 doesn't exist — sine is never more than 1.
? arccos(0) = | 0 | *π/2 | π
? arcsin(−1) = | *−π/2 | 3π/2 | −π
? arcsin(3) is … | π | 3π/2 | *undefined

@ trig-equations | Equations | Solving trig equations
Solve for the trig function, then find **every** angle that works — usually two in each full circle.

**2 sin x − 1 = 0** for 0 ≤ x < 2π
- sin x = 1/2
- x = **π/6** or **5π/6**
- All solutions: add **2πk**

**Factor** when you can: sin²x − sin x = 0 → sin x(sin x − 1) = 0 → x = 0, π/2, π
? cos x = −1 for 0 ≤ x < 2π | 0 | *π | 3π/2
? tan x = 1 for 0 ≤ x < 2π | π/4 only | *π/4 and 5π/4 | π/4 and 3π/4
? How many solutions does sin x = 1/2 have for 0 ≤ x < 2π? | 1 | *2 | 4

@ law-sines | Oblique triangles | The law of sines
For **any** triangle (sides a, b, c across from angles A, B, C):

**a / sin A = b / sin B = c / sin C**

Use it when you know **two angles and a side** (AAS or ASA), or SSA — careful: SSA can give 0, 1 or 2 triangles (the **ambiguous case**).

A = 30°, B = 45°, a = 10 → b = 10 · sin 45°/sin 30° = 10 · (√2/2)/(1/2) = **10√2**
? The law of sines works for … | only right triangles | *any triangle
? A = 90°, a = 10 and B = 30°. b = | *5 | 10 | 5√3
? Which case can give two different triangles? | SSS | ASA | *SSA

@ law-cosines | Oblique triangles | The law of cosines
**c² = a² + b² − 2ab cos C**

Use it for **SAS** (to find the third side) and **SSS** (to find an angle).

a = 5, b = 8, C = 60°: c² = 25 + 64 − 2(5)(8)(1/2) = 49 → **c = 7**

When C = 90°, cos C = 0 and it turns into **a² + b² = c²**.
? a = 3, b = 4, C = 90°. c = | 7 | *5 | 25
? a = 2, b = 2, C = 60°. c = | 4 | *2 | 2√3
? You know all three sides. Find an angle with … | the law of sines | *the law of cosines | SOH-CAH-TOA

@ area-sas | Oblique triangles | Area with sine, and Heron's formula
**Area = ½ ab sin C** (two sides and the angle between them)
- a = 6, b = 10, C = 30° → ½ · 6 · 10 · ½ = **15**

**Heron's formula** (three sides): s = (a + b + c)/2, Area = √(s(s − a)(s − b)(s − c))
- 3, 4, 5: s = 6 → √(6 · 3 · 2 · 1) = **6**
? Sides 4 and 9 with 90° between them. The area is … | *18 | 36 | 13
? Sides 8 and 8 with 30° between them. The area is … | 32 | *16 | 64
? Sides 5, 5 and 6: s = 8. The area is … | 10 | *12 | 15

@ sum-angle | Identities | Sum and difference formulas
- **sin(A ± B) = sin A cos B ± cos A sin B**
- **cos(A ± B) = cos A cos B ∓ sin A sin B**
- tan(A + B) = (tan A + tan B)/(1 − tan A tan B)

**The exact value of sin 75°** = sin(45° + 30°) = (√2/2)(√3/2) + (√2/2)(1/2) = **(√6 + √2)/4**
? cos(A + B) = | cos A + cos B | *cos A cos B − sin A sin B | cos A cos B + sin A sin B
? sin 15° = sin(45° − 30°) = | (√6 + √2)/4 | *(√6 − √2)/4 | 1/4
? Using the formula, sin(90° + 0°) = | 0 | *1 | −1

@ double-angle | Identities | Double-angle and half-angle formulas
- **sin 2θ = 2 sin θ cos θ**
- **cos 2θ = cos²θ − sin²θ = 2cos²θ − 1 = 1 − 2sin²θ**
- tan 2θ = 2 tan θ/(1 − tan²θ)

sin θ = 3/5 and cos θ = 4/5 → sin 2θ = 2(3/5)(4/5) = **24/25**

**Half-angle:** sin(θ/2) = ±√((1 − cos θ)/2)
? sin θ = 3/5 and cos θ = 4/5. cos 2θ = | 1/25 | *7/25 | 24/25
? 2 sin 15° cos 15° = | sin 15° | *1/2 | √3/2
> It's sin 30°, which is 1/2.
? If sin θ = 0, then cos 2θ = | 0 | *1 | −1

@ arc-speed | Radians | Arc length and angular speed
With θ in **radians**:
- **Arc length s = rθ**
- **Angular speed ω = θ/t** (radians per second)
- **Linear speed v = rω**

A wheel of radius 0.3 m spinning at 10 radians per second → its edge moves at 0.3 × 10 = **3 m/s**

One full turn = **2π radians** = 360°.
? The arc with r = 5 and θ = π/2 | *5π/2 | 10π | π/10
? 3 full turns is how many radians? | 3π | *6π | 9π
? r = 2 m and ω = 4 rad/s. The linear speed is … | 2 m/s | *8 m/s | 16 m/s

@ vectors | Vectors | Vectors: size and direction
A **vector** has a **magnitude** (size) and a **direction** — like a velocity or a force.
- Component form ⟨a, b⟩; **magnitude = √(a² + b²)**
- Direction angle: tan θ = b/a
- From a size and angle: ⟨r cos θ, r sin θ⟩
- Add by components: ⟨1, 2⟩ + ⟨3, −5⟩ = **⟨4, −3⟩**

⟨3, 4⟩ has magnitude **5**.
? The magnitude of ⟨6, 8⟩ | 14 | *10 | 48
? ⟨2, −1⟩ + ⟨−5, 4⟩ = | ⟨7, 3⟩ | *⟨−3, 3⟩ | ⟨−3, −5⟩
? A vector of length 10 at 30°. Its x-component is … | 5 | *5√3 | 10

@ polar | Polar | Polar coordinates
**Polar (r, θ):** the distance r from the origin, at angle θ.

**Polar → rectangular:** x = r cos θ, y = r sin θ
- (2, π/3) → (2 · 1/2, 2 · √3/2) = **(1, √3)**

**Rectangular → polar:** r = √(x² + y²), tan θ = y/x
- (0, 5) → **(5, π/2)**

One point has many polar names: (2, π/3) = (2, 7π/3) = (−2, 4π/3).
? (4, 0) in polar is … | (0, 4) | *(4, 0) | (4, π)
? The polar point (3, π) in rectangular is … | (3, 0) | *(−3, 0) | (0, 3)
? The point (1, 1) has r = | 1 | *√2 | 2
`;

export const MATH_11 = `
@ domain-range | Functions | Domain and range
- **Domain:** all the x-values allowed
- **Range:** all the y-values you get

Watch out for:
- **Dividing by 0:** f(x) = 1/(x − 3) → the domain is every x except **3**
- **Square roots of negatives:** f(x) = √(x + 2) → **x ≥ −2**
- **Logs of 0 or negatives:** ln(x) → **x > 0**

Interval notation: x ≥ −2 is **[−2, ∞)**; all reals except 3 is (−∞, 3) ∪ (3, ∞).
? The domain of √(x − 5) | x > 5 | *x ≥ 5 | all reals
? The range of f(x) = x² | all reals | *y ≥ 0 | y > 0
? The domain of 1/(x + 4) leaves out … | 4 | *−4 | 0

@ piecewise | Functions | Piecewise functions
A **piecewise** function uses different rules on different parts of its domain.

f(x) = x + 1 when x < 0, and x² when x ≥ 0
- f(−3) = −2
- f(2) = 4
- f(0) = 0 (it uses the second piece — check which piece includes the endpoint!)

**Absolute value** is piecewise: it's −x when x < 0 and x when x ≥ 0.

Graph each piece only on its own interval: an open dot ○ for < and a closed dot ● for ≤.
? With that f, f(−1) = | 1 | *0 | −2
? With that f, f(3) = | 4 | *9 | 3
? A "round down" step function (floor) jumps at … | *every integer | every half | nowhere

@ even-odd | Functions | Even and odd functions
- **Even:** f(−x) = f(x) — a mirror image across the **y-axis** (x², cos x)
- **Odd:** f(−x) = −f(x) — symmetric about the **origin** (x³, sin x, 1/x)
- Most functions are **neither** (like x² + x)

To test: put in −x and simplify.
- f(x) = x⁴ − 3x² → f(−x) = x⁴ − 3x² → **even**
? f(x) = x⁵ is … | even | *odd | neither
? f(x) = x² + 1 is … | *even | odd | neither
? f(x) = x³ + 2 is … | even | odd | *neither

@ end-behavior | Polynomials | Polynomial graphs: end behavior and zeros
**End behavior** depends on the **leading term**:
- Even degree, positive → **both ends up** ↑↑
- Even degree, negative → both ends down ↓↓
- Odd degree, positive → **down on the left, up on the right**
- Odd degree, negative → up on the left, down on the right

**Zeros:** a factor (x − a) means the graph meets the x-axis at a. A **squared** factor (x − a)² → it **bounces** off; an odd power → it **crosses**.

A polynomial of degree n has at most **n zeros** and **n − 1 turns**.
? y = −2x³ + x: as x → ∞, y → | ∞ | *−∞ | 0
? At x = 1, y = (x − 1)²(x + 3) … | crosses the axis | *bounces off the axis | has an asymptote
? The most turning points a degree-5 polynomial can have | 5 | *4 | 6

@ rational-functions | Rational functions | Asymptotes of rational functions
For f(x) = p(x)/q(x), after canceling common factors:
- **Vertical asymptote:** where the bottom is 0
- **Hole:** where a factor canceled
- **Horizontal asymptote** (compare the degrees):
- top degree smaller → **y = 0**
- the same → y = **the ratio of the leading coefficients**
- top bigger → no horizontal asymptote (top bigger by one → a slant asymptote)

f(x) = (2x + 1)/(x − 3): vertical x = 3, horizontal **y = 2**
? The vertical asymptote of 5/(x + 2) | x = 2 | *x = −2 | y = 5
? The horizontal asymptote of (3x² + 1)/(x² − 4) | y = 0 | *y = 3 | there isn't one
? (x − 1)(x + 2)/(x − 1) has what at x = 1? | a vertical asymptote | *a hole | a zero

@ log-rules | Logarithms | Properties of logarithms
- **log_b(MN) = log_b M + log_b N**
- **log_b(M/N) = log_b M − log_b N**
- **log_b(Mᵖ) = p · log_b M**
- log_b 1 = 0 and log_b b = 1
- **Change of base:** log_b x = ln x / ln b

**Expand:** log(x²y/z) = 2 log x + log y − log z
**Condense:** 3 ln a − ln b = ln(a³/b)
? log₃ 81 = | 27 | *4 | 3
? log 200 − log 2 = (base 10) | log 198 | *2 | 100
? log₂ 7 with change of base is … | log 2 / log 7 | *ln 7 / ln 2 | ln 14

@ natural-e | Logarithms | e and the natural log
**e ≈ 2.71828** — the number behind continuous growth.

**ln x = log_e x**, so **ln e = 1**, e^(ln x) = x and ln(eˣ) = x.

**Continuous growth: A = Pe^(rt)**
- $1,000 at 5% compounded continuously for 10 years: 1000e^(0.5) ≈ **$1,648.72**

Solve eˣ = 7 → x = **ln 7** ≈ 1.95
? ln(e⁴) = | e⁴ | *4 | 1/4
? e^(ln 9) = | ln 9 | *9 | e⁹
? Solve e^(2x) = 10 | ln 5 | *(ln 10)/2 | 2 ln 10

@ compound-interest | Exponential | Compound interest
**A = P(1 + r/n)^(nt)**
- P = principal, r = yearly rate, n = times compounded per year, t = years

$2,000 at 6% compounded monthly for 3 years:
A = 2000(1 + 0.06/12)^36 = 2000(1.005)^36 ≈ **$2,393.36**

More compounding → a little more money; compounding continuously is the limit: **Pe^(rt)**.

**Rule of 72:** money doubles in about 72 ÷ (the rate in %) years.
? For quarterly compounding, n = | 3 | *4 | 12
? With the rule of 72, money at 8% doubles in about … | 8 years | *9 years | 12 years
? $100 at 10% compounded yearly for 2 years | $120 | *$121 | $110

@ parabola-conic | Conics | Parabolas: focus and directrix
A **parabola** is every point the same distance from a **focus** (a point) and a **directrix** (a line).

**x² = 4py** — vertex (0, 0), focus **(0, p)**, directrix **y = −p**
**y² = 4px** — opens sideways, focus (p, 0), directrix x = −p

x² = 12y → 4p = 12 → p = 3 → focus (0, 3), directrix y = −3

Satellite dishes and headlights use the focus: signals bounce to it (or out from it).
? x² = 8y has its focus at … | (0, 8) | *(0, 2) | (2, 0)
? y² = −4x opens … | right | *left | up
? The directrix of x² = 20y | y = 5 | *y = −5 | x = −5

@ ellipse | Conics | Ellipses
**x²/a² + y²/b² = 1** (a > b): center (0, 0), stretched along the x-axis
- **Vertices** at (±a, 0), co-vertices at (0, ±b)
- **Foci** at (±c, 0), where **c² = a² − b²**
- From any point on it, the distances to the two foci add up to **2a**

x²/25 + y²/9 = 1 → a = 5, b = 3, c = 4 → foci at (±4, 0)

Planets orbit the sun in ellipses, with the sun at one focus.
? The vertices of x²/16 + y²/4 = 1 | (±2, 0) | *(±4, 0) | (±16, 0)
? For x²/100 + y²/36 = 1, c = | 64 | *8 | 6
? If a = b, the ellipse is a … | parabola | *circle | hyperbola

@ hyperbola | Conics | Hyperbolas
**x²/a² − y²/b² = 1:** two branches opening left and right
- **Vertices** (±a, 0)
- **Foci** (±c, 0), where **c² = a² + b²** (plus, not minus!)
- **Asymptotes:** y = ±(b/a)x
- The **difference** of the distances to the foci is 2a

x²/9 − y²/16 = 1 → a = 3, b = 4, c = 5; asymptotes y = ±(4/3)x

**Which conic is Ax² + Cy² + …?** A and C with the same sign → ellipse (a circle if equal); opposite signs → hyperbola; one of them 0 → parabola.
? For x²/16 − y²/9 = 1, c = | √7 | *5 | 25
? The asymptotes of x²/4 − y²/25 = 1 | y = ±(2/5)x | *y = ±(5/2)x | y = ±(25/4)x
? 4x² − y² = 4 is a … | ellipse | *hyperbola | parabola

@ matrices | Matrices | Matrix operations
A **matrix** is a grid of numbers; a 2 × 3 matrix has 2 rows and 3 columns.
- **Add/subtract:** same-size matrices, entry by entry
- **Scalar multiply:** multiply every entry
- **Matrix multiply:** row × column. An (m × n) times an (n × p) gives an m × p — the **inside numbers must match**

The row [1 2] times the column [3; 4] = 1·3 + 2·4 = **11**

Matrix multiplication **isn't commutative**: AB is usually not BA.
? A 3 × 2 matrix times a 2 × 4 matrix gives … | 2 × 2 | *3 × 4 | you can't multiply them
? Can you multiply a 2 × 3 matrix by a 2 × 3 matrix? | yes | *no
? 3 times the matrix [1 −2] = | [3 −2] | *[3 −6] | [4 1]

@ determinants | Matrices | Determinants and inverses
For [[a, b], [c, d]]:
- **Determinant = ad − bc**
- **Inverse = (1/(ad − bc)) · [[d, −b], [−c, a]]** — swap a and d, and make b and c negative
- If the determinant is **0**, there's **no inverse**

[[3, 1], [4, 2]]: det = 6 − 4 = **2** → inverse = ½[[2, −1], [−4, 3]]

Systems: AX = B → X = A⁻¹B.
? det [[2, 5], [1, 3]] | 11 | *1 | 6
? det [[4, 2], [6, 3]] = 0, so the matrix … | *has no inverse | is the identity | is its own inverse
? The identity matrix I has … | all 1s | *1s on the diagonal and 0s everywhere else | all 0s

@ dot-product | Vectors | The dot product
**u · v = u₁v₁ + u₂v₂** (the answer is a number, not a vector)

⟨2, 3⟩ · ⟨4, −1⟩ = 8 − 3 = **5**

**The angle between two vectors:** cos θ = (u · v) / (length of u × length of v)
- u · v = 0 → **perpendicular** (orthogonal)

**Projection** of u onto v: ((u · v)/(length of v)²) v
? ⟨1, 5⟩ · ⟨3, 2⟩ = | ⟨3, 10⟩ | *13 | 11
? ⟨2, 4⟩ and ⟨−2, 1⟩ are … | parallel | *perpendicular | neither
? A dot product of 0 means the angle between them is … | 0° | *90° | 180°

@ parametric | Parametric | Parametric equations
Both x and y depend on a third variable, **t** (often time):
- x = 2t, y = t + 1 → at t = 3: **(6, 4)**

**Get rid of t:** t = x/2 → y = x/2 + 1 (a line)

A circle: x = cos t, y = sin t (0 ≤ t < 2π) → x² + y² = 1

Something thrown: x = v₀ cos θ · t and y = v₀ sin θ · t − 16t² (in feet)
? x = t² and y = t − 1. At t = 2 the point is … | (2, 1) | *(4, 1) | (4, 3)
? x = t + 3 and y = 2t. Without t: | y = 2x + 3 | *y = 2x − 6 | y = x − 3
? x = 3 cos t, y = 3 sin t traces a … | line | *circle of radius 3 | parabola

@ complex-polar | Complex | Complex numbers in polar form
**z = a + bi = r(cos θ + i sin θ)**, with r = √(a² + b²) and tan θ = b/a.
- 1 + i = √2(cos 45° + i sin 45°)

**Multiply:** multiply the r's and **add** the angles.
**De Moivre's theorem:** **zⁿ = rⁿ(cos nθ + i sin nθ)**
- (1 + i)⁴ = (√2)⁴(cos 180° + i sin 180°) = 4(−1) = **−4**
? The modulus r of 3 + 4i | 7 | *5 | 25
? Multiplying two complex numbers ___ their angles. | multiplies | *adds | subtracts
? (cos 30° + i sin 30°)⁶ = | *−1 | 1 | i

@ binomial | Counting | The binomial theorem
**(a + b)ⁿ** expands with coefficients from **Pascal's triangle** (or nCk):

Row 4: 1, 4, 6, 4, 1 → (a + b)⁴ = a⁴ + 4a³b + 6a²b² + 4ab³ + b⁴

The term with bᵏ: **C(n, k) · aⁿ⁻ᵏ · bᵏ**

(x + 2)³ = x³ + 3x²(2) + 3x(4) + 8 = **x³ + 6x² + 12x + 8**
? The coefficients of (a + b)³ | 1, 2, 1 | *1, 3, 3, 1 | 1, 3, 1
? How many terms does (x + y)⁷ have? | 7 | *8 | 14
? The x² term of (x + 1)⁴ | 4x² | *6x² | x²

@ counting | Counting | Permutations and combinations
**Counting principle:** multiply the choices: 3 shirts × 4 pants = 12 outfits

**Permutations** (order matters): **P(n, r) = n!/(n − r)!**
- 1st, 2nd and 3rd place among 8 runners: 8 · 7 · 6 = **336**

**Combinations** (order doesn't matter): **C(n, r) = n!/(r!(n − r)!)**
- Choose 3 of 8 for a team: 336 / 6 = **56**

n! = n × (n − 1) × … × 1, and 0! = 1
? 5! = | 25 | *120 | 60
? Ways to choose 2 of 5 friends (order doesn't matter) | 20 | *10 | 25
? Ways to arrange 4 books on a shelf | 16 | *24 | 4

@ induction | Proof | Proof by induction
To prove something for **every** n ≥ 1:
1. **Base case:** show it's true for n = 1
2. **Inductive step:** assume it's true for n = k, and show that makes it true for n = k + 1

Like dominoes: the first one falls, and each one knocks over the next.

Example: 1 + 2 + … + n = n(n + 1)/2. Base: 1 = 1·2/2 ✅. Step: k(k + 1)/2 + (k + 1) = (k + 1)(k + 2)/2 ✅
? The first step of a proof by induction is the … | inductive step | *base case | conclusion
? In the inductive step you assume … | *it's true for n = k | it's true for every n | it's false
? 1 + 2 + … + 10 = | 50 | *55 | 100

@ limits-intro | Limits | An introduction to limits
A **limit** asks: what does f(x) get close to as x gets close to a number?

**The limit of (x² − 4)/(x − 2) as x → 2**
- Plugging in gives 0/0 — not allowed
- Factor: (x − 2)(x + 2)/(x − 2) = x + 2
- As x → 2, this → **4**

The limit exists only if the limits from the **left** and **right** agree. The function's value at the point doesn't have to equal the limit.
? The limit of (2x + 1) as x → 3 | 6 | *7 | 3
? The limit of (x² − 1)/(x − 1) as x → 1 | 0 | *2 | it doesn't exist
? The limit of 1/x as x → 0 | 0 | ∞ | *it doesn't exist (the left and right sides differ)
`;

export const MATH_12 = `
@ limit-laws | Limits | Finding limits with algebra
1. **Plug in** first. If you get a number, you're done.
2. Got 0/0? **Factor and cancel**, or **rationalize** (multiply by the conjugate).
3. A special one: **the limit of sin x / x as x → 0 is 1**

- (√x − 2)/(x − 4) as x → 4: multiply by (√x + 2) → 1/(√x + 2) → **1/4**
- sin 3x / x as x → 0 = 3 · (sin 3x)/(3x) → **3**
? The limit of (x² − 25)/(x − 5) as x → 5 | 0 | *10 | 25
? The limit of sin x / x as x → 0 | 0 | *1 | undefined
? The limit of (√x − 3)/(x − 9) as x → 9 | *1/6 | 1/3 | 0

@ continuity | Limits | Continuity
f is **continuous** at x = a if:
1. f(a) exists
2. the limit as x → a exists
3. they're **equal**

"You can draw it without lifting your pencil."

Kinds of breaks: a **hole** (removable), a **jump**, a **vertical asymptote** (infinite).

**Intermediate Value Theorem:** if f is continuous on [a, b], it hits every value between f(a) and f(b). f(1) = −2 and f(3) = 5 → f(c) = 0 somewhere in between.
? (x² − 1)/(x − 1) at x = 1 has a … | jump | *removable hole | vertical asymptote
? Polynomials are continuous … | only for x > 0 | *everywhere | nowhere
? f is continuous, f(0) = 3 and f(2) = −1. The IVT says f(c) = 0 for some c in … | *(0, 2) | (2, 4) | nowhere

@ limits-infinity | Limits | Limits at infinity
As x → ∞, compare the **highest powers** on top and bottom:
- top smaller → **0** (3x/(x² + 1) → 0)
- the same → **the ratio of the leading coefficients** ((4x² + x)/(2x² − 7) → 2)
- top bigger → ∞ or −∞

**How fast things grow** (slowest → fastest): ln x, √x, x, x², eˣ

eˣ/x¹⁰⁰ as x → ∞ → **∞** (the exponential wins)
? The limit of (5x³ − 2)/(x³ + 8) as x → ∞ | 0 | *5 | ∞
? The limit of 7/x as x → ∞ | 7 | *0 | ∞
? The limit of x²/eˣ as x → ∞ | ∞ | 1 | *0

@ derivative-definition | Derivatives | The definition of the derivative
**f′(x) = the limit as h → 0 of [f(x + h) − f(x)] / h**

It's the **slope of the tangent line** — the rate of change at an instant.

f(x) = x²:
- [(x + h)² − x²]/h = (2xh + h²)/h = 2x + h → **f′(x) = 2x**

A function has no derivative at a **corner** (like the absolute value of x at 0), a **cusp**, a break, or a vertical tangent.
? Using the definition, the derivative of f(x) = 3x is … | 0 | *3 | 3x
? f′(a) means … | the area under f | *the slope of the tangent line at x = a | f(a) divided by a
? Does the absolute value of x have a derivative at x = 0? | yes | *no — there's a corner

@ power-rule | Derivatives | The power rule and friends
- **Power rule:** d/dx xⁿ = **n xⁿ⁻¹**
- A constant: d/dx 7 = **0**
- A constant multiple: d/dx 5x³ = 15x²
- A sum: do each term separately

f(x) = 4x³ − 2x² + 9x − 1 → **f′(x) = 12x² − 4x + 9**

Roots and fractions: √x = x^(1/2) → (1/2)x^(−1/2); 1/x² = x⁻² → −2x⁻³
? d/dx x⁷ | 7x⁷ | *7x⁶ | x⁶
? d/dx (3x² + 5x) | 6x | *6x + 5 | 3x + 5
? d/dx (1/x) | ln x | *−1/x² | 1/x²

@ product-quotient | Derivatives | The product and quotient rules
- **Product:** (fg)′ = **f′g + fg′**
- **Quotient:** (f/g)′ = **(f′g − fg′)/g²** — "low d-high minus high d-low, over low squared"

d/dx [x² · sin x] = 2x sin x + x² cos x
d/dx [x/(x + 1)] = [(1)(x + 1) − x(1)]/(x + 1)² = **1/(x + 1)²**

❌ (fg)′ = f′g′
? d/dx [x · eˣ] | eˣ | *eˣ + xeˣ | xeˣ
? d/dx [x³ · x²] (check with the power rule) | 6x³ | *5x⁴ | 6x
? The top of the quotient rule is … | f′g′ | *f′g − fg′ | fg′ − f′g

@ chain-rule | Derivatives | The chain rule
For a function inside a function: **d/dx f(g(x)) = f′(g(x)) · g′(x)**

"The derivative of the outside (leave the inside alone) × the derivative of the inside."

- d/dx (3x + 1)⁵ = 5(3x + 1)⁴ · 3 = **15(3x + 1)⁴**
- d/dx sin(x²) = cos(x²) · 2x
- d/dx e^(4x) = **4e^(4x)**
? d/dx (x² + 1)³ | 3(x² + 1)² | *6x(x² + 1)² | 3(2x)²
? d/dx cos(5x) | −sin(5x) | *−5 sin(5x) | 5 sin(5x)
? d/dx √(2x) | 1/(2√(2x)) | *1/√(2x) | √2

@ trig-exp-derivs | Derivatives | Derivatives of trig functions, eˣ and ln x
- d/dx **sin x = cos x**
- d/dx **cos x = −sin x**
- d/dx **tan x = sec²x**
- d/dx **eˣ = eˣ** (it's its own derivative!)
- d/dx **ln x = 1/x**
- d/dx aˣ = aˣ ln a

d/dx [ln(x²)] = (1/x²) · 2x = **2/x**
? d/dx sin x | −cos x | *cos x | sec x
? d/dx ln(3x) | 3/x | *1/x | 1/(3x)
? d/dx 2ˣ | x · 2ˣ⁻¹ | *2ˣ ln 2 | 2ˣ

@ implicit | Derivatives | Implicit differentiation
When y isn't on its own, take the derivative of **both sides** with respect to x. Every y term picks up a **dy/dx** (the chain rule).

**x² + y² = 25**
- 2x + 2y · dy/dx = 0
- **dy/dx = −x/y**

At (3, 4) the slope is **−3/4**.
? d/dx (y²) = | 2y | *2y · dy/dx | y²
? For xy = 6, dy/dx = | 6 | *−y/x | x/y
? On x² + y² = 25, the slope at (0, 5) is … | undefined | *0 | 5

@ related-rates | Applications | Related rates
Two changing amounts linked by an equation → take the derivative with respect to **time t**.

**A balloon's radius grows at 2 cm/s. How fast is its volume growing when r = 5?**
- V = (4/3)πr³
- dV/dt = 4πr² · dr/dt = 4π(25)(2) = **200π cm³/s**

The steps: draw it, write the equation, take the derivative, then put in the numbers (**only after** taking the derivative).
? A circle's radius grows at 3 cm/s. dA/dt when r = 10 | 30π | *60π | 300π
? A square's side grows at 2 in/s. How fast does its area grow when the side is 5 in? | 10 in²/s | *20 in²/s | 25 in²/s
? When do you put in the numbers? | before taking the derivative | *after taking the derivative

@ tangent-lines | Applications | Tangent lines and linear approximation
**The tangent line at x = a:** y − f(a) = f′(a)(x − a)

f(x) = x² at x = 3: f(3) = 9 and f′(3) = 6 → **y = 6x − 9**

**Linear approximation:** near a, f(x) ≈ f(a) + f′(a)(x − a)
- √4.1 ≈ 2 + (1/4)(0.1) = **2.025** (the real value is 2.0248…)
? The tangent to y = x³ at x = 1 has slope … | 1 | *3 | 0
? The tangent line to y = x² at x = 2 | y = 4x | *y = 4x − 4 | y = 2x
? Using the tangent line at 9, √9.2 ≈ | 3.2 | *3.033 | 3.1

@ extrema | Applications | Maximums and minimums
**Critical points:** where f′(x) = 0 or f′ doesn't exist.

**First derivative test:**
- f′ changes from + to − → **local max**
- f′ changes from − to + → **local min**

**On a closed interval [a, b]:** check the critical points **and the endpoints**; the biggest value is the absolute max.

f(x) = x³ − 3x: f′ = 3x² − 3 = 0 → x = ±1. f(−1) = 2 (max), f(1) = −2 (min)
? The critical point of f(x) = x² − 6x | x = 6 | *x = 3 | x = −3
? f′ changes from negative to positive at x = 2. That's a … | max | *min | neither
? On a closed interval, the absolute max can be at … | only a critical point | *a critical point or an endpoint | only an endpoint

@ concavity | Applications | The second derivative and concavity
- **f″ > 0:** concave **up** (a cup ∪) — the slopes are increasing
- **f″ < 0:** concave **down** (a cap ∩)
- **Inflection point:** where the concavity changes

**Second derivative test:** at a critical point, f″ > 0 → **min**; f″ < 0 → **max**; f″ = 0 → this test can't tell.

f(x) = x³: f″ = 6x → inflection at **x = 0**
? f″(x) = −4 everywhere. The graph is … | concave up | *concave down | a line
? f′(2) = 0 and f″(2) = 5. At x = 2 there's a … | max | *min | inflection point
? The inflection point of f(x) = x³ − 6x² | x = 0 | *x = 2 | x = 4

@ optimization | Applications | Optimization
Find the **best** (biggest or smallest) value:
1. Draw it and label it
2. Write what you're optimizing as a function of **one** variable (use the constraint)
3. Set the derivative to 0 and solve
4. Check it's really a max or min (and check the endpoints)

**100 m of fence around a rectangle — what's the biggest area?**
- 2l + 2w = 100 → w = 50 − l
- A = l(50 − l) = 50l − l²
- A′ = 50 − 2l = 0 → l = 25 → a **25 × 25 square**, A = **625 m²**
? Two numbers add up to 20. Their biggest possible product is … | 96 | *100 | 400
? A rectangle with perimeter 40 has the largest area when it's … | 15 × 5 | *10 × 10 | 12 × 8
? In optimization you set ___ equal to 0. | the function | *its derivative | the constraint

@ motion | Applications | Position, velocity and acceleration
- **Position** s(t)
- **Velocity** v(t) = s′(t) — speed with a direction
- **Acceleration** a(t) = v′(t) = s″(t)

s(t) = t³ − 6t² + 9t:
- v(t) = 3t² − 12t + 9 = 3(t − 1)(t − 3) → stopped at t = 1 and t = 3
- a(t) = 6t − 12

It's **speeding up** when v and a have the **same sign**, and slowing down when the signs are opposite.
? s(t) = 5t². v(2) = | 10 | *20 | 40
? v(t) = 3t² − 12t + 9 is 0 at … | t = 0 | *t = 1 and t = 3 | t = 2
? v = −4 and a = −2. The object is … | slowing down | *speeding up | stopped

@ antiderivatives | Integrals | Antiderivatives
An **antiderivative** undoes a derivative. Always add **+ C**.
- **∫ xⁿ dx = xⁿ⁺¹/(n + 1) + C** (n ≠ −1)
- ∫ 1/x dx = **ln of the absolute value of x, + C**
- ∫ eˣ dx = eˣ + C
- ∫ cos x dx = sin x + C; ∫ sin x dx = −cos x + C

∫ (6x² + 4x − 3) dx = **2x³ + 2x² − 3x + C**

Check by taking the derivative!
? ∫ x⁴ dx | 4x³ + C | *x⁵/5 + C | x⁵ + C
? ∫ 3 dx | 0 | *3x + C | 3 + C
? ∫ sin x dx | cos x + C | *−cos x + C | −sin x + C

@ ftc | Integrals | The Fundamental Theorem of Calculus
**Part 2:** the integral from a to b of f(x) dx = **F(b) − F(a)**, where F is any antiderivative.

The integral of 2x from 1 to 3 = [x²] from 1 to 3 = 9 − 1 = **8**

**Part 1:** d/dx of the integral from a to x of f(t) dt = **f(x)** — derivatives and integrals undo each other.

A definite integral is the **net signed area**: area below the x-axis counts as negative.
? The integral of 3x² from 0 to 2 | 12 | *8 | 6
? d/dx of the integral from 0 to x of cos t dt | sin x | *cos x | −sin x
? The integral of sin x from 0 to π | 0 | *2 | 1

@ u-sub | Integrals | u-substitution
It's the chain rule backwards. Look for a function **and its derivative**.

**∫ 2x(x² + 1)⁵ dx**
- u = x² + 1 → du = 2x dx
- ∫ u⁵ du = u⁶/6 + C = **(x² + 1)⁶/6 + C**

**∫ cos(3x) dx:** u = 3x, du = 3 dx → **(1/3) sin(3x) + C**

For definite integrals, change the limits to u-values too.
? For ∫ x e^(x²) dx, pick u = | x | *x² | e^(x²)
? ∫ e^(5x) dx | 5e^(5x) + C | *e^(5x)/5 + C | e^(5x) + C
? ∫ 3x²(x³ + 2)⁴ dx | (x³ + 2)⁴ + C | *(x³ + 2)⁵/5 + C | 3(x³ + 2)⁵ + C

@ riemann | Integrals | Riemann sums
Estimate the area under a curve with **rectangles**:
- width Δx = (b − a)/n
- heights from the **left**, **right** or **midpoint**
- **Trapezoid rule:** the average of the left and right sums

f(x) = x² on [0, 2] with 2 right rectangles: Δx = 1 → 1·f(1) + 1·f(2) = 1 + 4 = **5** (the real area is 8/3 ≈ 2.67)

For an increasing function, left sums come out **too small** and right sums **too big**. More rectangles → closer; the limit is the integral.
? f(x) = x on [0, 4] with 2 left rectangles. The sum is … | 8 | *4 | 6
? For an increasing function, a right sum … | *overestimates | underestimates | is exact
? As the number of rectangles → ∞, the sum → | 0 | *the definite integral | infinity

@ area-between | Integrals | Area between curves
**Area = the integral from a to b of (top − bottom) dx**

Find where the curves cross to get a and b.

y = x and y = x² cross at x = 0 and x = 1. On [0, 1], y = x is on top:
the integral of (x − x²) from 0 to 1 = 1/2 − 1/3 = **1/6**
? The area between y = 4 and y = x² from x = −2 to x = 2 | 16/3 | *32/3 | 16
? The area between curves uses … | bottom − top | *top − bottom | top × bottom
? y = x² and y = 2x cross at … | x = 0 only | *x = 0 and x = 2 | x = 1

@ lhopital | Limits | L'Hôpital's rule
If a limit gives **0/0** or **∞/∞**, take the derivative of the top and of the bottom **separately**:

**lim f/g = lim f′/g′**

- (eˣ − 1)/x as x → 0 → eˣ/1 → **1**
- x/eˣ as x → ∞ → 1/eˣ → **0**

❌ It is **not** the quotient rule.
❌ Don't use it unless you have 0/0 or ∞/∞.
? The limit of sin(2x)/x as x → 0 | 1 | *2 | 0
? The limit of ln x / x as x → ∞ | 1 | ∞ | *0
? The limit of (x + 1)/x as x → 1 — can you use L'Hôpital? | yes | *no — just plug in: 2/1 = 2

@ volume-revolution | Integrals | Volumes of revolution
Spin a region around an axis.

**Disk method** (around the x-axis): **V = π × the integral of [f(x)]² dx**
- y = √x on [0, 4]: V = π × (the integral of x from 0 to 4) = π · 8 = **8π**

**Washer method** (a hole in the middle): V = π × the integral of (R² − r²) dx

**Shell method** (around the y-axis): V = 2π × the integral of x · f(x) dx
? Spin y = 2 on [0, 3] around the x-axis. The volume is … | 6π | *12π | 36π
? The disk method integrates … | f(x) | *π [f(x)]² | 2πx f(x)
? A washer is used when the solid has … | *a hole in the middle | a point | only flat ends
`;
