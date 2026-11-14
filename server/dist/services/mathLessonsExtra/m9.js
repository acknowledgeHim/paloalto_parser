/** ➗ More 9th grade math — geometry (format: ../mathLessonsParse.ts; the right choice is starred). */
export const M_9 = `
@ constructions | Foundations | Compass and straightedge constructions
With only a compass and an unmarked straightedge you can copy segments, bisect segments and angles, and draw perpendiculars and parallels.

- A **perpendicular bisector** crosses a segment at its midpoint at 90°.
? Which tool draws circles and arcs? | *a compass | a straightedge | a protractor
? Every point on a segment's perpendicular bisector is … | *the same distance from both endpoints | on the segment | at the midpoint only
? An angle bisector splits an angle into … | *two equal angles | a right angle | three parts

@ segment-addition | Foundations | Segment and angle addition
If B is between A and C, **AB + BC = AC**. Angles work the same way.

- AB = 2x, BC = x + 4, AC = 19 → 3x + 4 = 19 → x = 5
? AB = 7, BC = 12. AC = | *19 | 5 | 84
? m∠ABD = 40°, m∠DBC = 35°. m∠ABC = | *75° | 5° | 140°
? AB = x + 1, BC = 2x, AC = 13. x = | *4 | 6 | 12

@ vertical-proof | Proof | Why vertical angles are equal
∠1 + ∠2 = 180° and ∠2 + ∠3 = 180° (linear pairs) → ∠1 = ∠3 (subtract ∠2).
? Vertical angles are … | *always equal | always supplementary | always 90°
? Two angles of a linear pair add to … | *180° | 90° | 360°
? Vertical angles 3x + 10 and 5x − 20. x = | *15 | 5 | 30

@ exterior-angles | Polygons | Interior and exterior angles of polygons
- Interior sum: **(n − 2) · 180°**
- Exterior angles (one at each vertex) always add to **360°**
- Regular polygon: each exterior angle = 360° ÷ n
? Interior angle sum of a hexagon | *720° | 540° | 1,080°
? Each exterior angle of a regular octagon | *45° | 135° | 60°
? A regular polygon has exterior angles of 30°. How many sides? | *12 | 6 | 30

@ isosceles-theorem | Triangles | The isosceles triangle theorem
If two **sides** are equal, the angles opposite them are equal (and the converse is true too).
? An isosceles triangle has a vertex angle of 40°. Each base angle is … | *70° | 40° | 140°
? Base angles are 55° each. The vertex angle is … | *70° | 55° | 110°
? A triangle has two 60° angles. It must be … | *equilateral | scalene | right

@ cpctc | Triangles | CPCTC
**Corresponding Parts of Congruent Triangles are Congruent.** First prove the triangles congruent (SSS, SAS, ASA, AAS), then use CPCTC.
? If △ABC ≅ △DEF, then AB = | *DE | EF | DF
? If △ABC ≅ △DEF, then ∠C = | *∠F | ∠D | ∠E
? CPCTC is used … | *after proving triangles congruent | to prove triangles congruent

@ hl | Triangles | HL for right triangles
Two right triangles are congruent if their **hypotenuses** and one **leg** match (HL).
? HL works only for … | *right triangles | all triangles | equilateral triangles
? Hypotenuse 13, leg 5 in both right triangles → | *congruent by HL | not enough information
? Is SSA a congruence rule for general triangles? | *no | yes

@ side-splitter | Similarity | The side-splitter theorem
A line **parallel** to one side of a triangle splits the other two sides **proportionally**.

- AD/DB = AE/EC
? AD = 4, DB = 6, AE = 6. EC = | *9 | 4 | 8
? AD = 3, DB = 3, AE = 5. EC = | *5 | 3 | 10
? AD = 2, AB = 8, AE = 3. AC = | *12 | 9 | 6

@ bisector-theorem | Similarity | The triangle angle bisector theorem
An angle bisector splits the opposite side in the **same ratio** as the two other sides.

- AB/AC = BD/DC
? AB = 6, AC = 9, BD = 4. DC = | *6 | 4 | 13.5
? AB = 10, AC = 10, BD = 3. DC = | *3 | 10 | 7
? AB = 8, AC = 12, BC = 10. BD = | *4 | 6 | 5

@ geometric-mean | Similarity | The altitude to the hypotenuse
The altitude to the hypotenuse makes three similar right triangles. **h² = (piece 1)(piece 2)**.
? The hypotenuse is split into 4 and 9. The altitude is … | *6 | 13 | 36
? The hypotenuse is split into 2 and 8. The altitude is … | *4 | 10 | 16
? The geometric mean of 3 and 12 is … | *6 | 7.5 | 36

@ pythag-converse | Right triangles | Acute, right or obtuse?
Compare c² (longest side) with a² + b²:

- c² = a² + b² → **right**
- c² < a² + b² → **acute**
- c² > a² + b² → **obtuse**
? Sides 6, 8, 10 → | *right | acute | obtuse
? Sides 4, 5, 6 → | *acute | right | obtuse
? Sides 3, 4, 6 → | *obtuse | acute | right

@ rhombus-rectangle | Quadrilaterals | Rhombuses, rectangles and squares
- **Rectangle:** diagonals are **equal**
- **Rhombus:** diagonals are **perpendicular** and bisect the angles
- **Square:** both!
? A parallelogram with perpendicular diagonals is a … | *rhombus | rectangle | trapezoid
? A parallelogram with equal diagonals is a … | *rectangle | rhombus | kite
? A rhombus has diagonals 6 and 8. Its area is … | *24 | 48 | 14

@ trapezoids-kites | Quadrilaterals | Trapezoids and kites
- Trapezoid **midsegment** = average of the bases
- **Isosceles** trapezoid: base angles equal, diagonals equal
- **Kite:** diagonals are perpendicular
? Bases 10 and 16. Midsegment? | *13 | 26 | 6
? A kite has diagonals 10 and 12. Area? | *60 | 120 | 22
? An isosceles trapezoid has one base angle 70°. The other angle on that base is … | *70° | 110° | 20°

@ tangents | Circles | Tangent lines
- A tangent is **perpendicular** to the radius at the point of contact.
- Two tangents from the same outside point are **equal** in length.
? Radius 5, tangent segment 12 from a point P. Distance from P to the center? | *13 | 17 | 7
? Two tangents from P: one is 9. The other is … | *9 | 18 | 4.5
? The angle between a tangent and the radius at the point of contact is … | *90° | 180° | 45°

@ inscribed-quads | Circles | Inscribed quadrilaterals
A quadrilateral inscribed in a circle has **opposite angles that add to 180°**.
? ∠A = 110° in an inscribed quadrilateral ABCD. ∠C = | *70° | 110° | 250°
? Can a non-square rectangle be inscribed in a circle? | *yes | no
? ∠B = 2x and ∠D = x in an inscribed ABCD. x = | *60° | 90° | 45°

@ chord-products | Circles | Segment lengths in circles
- Two chords crossing: **a · b = c · d**
- Two secants from one point: **outside · whole = outside · whole**
- Tangent and secant: **tangent² = outside · whole**
? Chords cross; pieces 3 and 8, and 4 and x. x = | *6 | 7 | 32/3
? Tangent 6 and secant with outside part 4. Whole secant? | *9 | 10 | 36
? Chords cross; pieces 5 and 2, and 1 and x. x = | *10 | 7 | 2.5

@ circle-center | Circles | Finding the center by completing the square
Rewrite x² + y² + Dx + Ey + F = 0 as (x − h)² + (y − k)² = r².

- x² − 6x + y² + 4y = 3 → (x − 3)² + (y + 2)² = 16 → center (3, −2), r = 4
? x² + y² − 10x = 0 has center … | *(5, 0) | (−5, 0) | (10, 0)
? x² + 2x + y² − 8y = 8 has radius … | *5 | 8 | √8
? (x + 1)² + (y − 7)² = 9 has center … | *(−1, 7) | (1, −7) | (7, −1)

@ regular-polygon-area | Area | Area of regular polygons
**A = ½ · apothem · perimeter**. The apothem goes from the center to the middle of a side.
? A regular hexagon has side 6 and apothem 3√3. Area? | *54√3 | 18√3 | 36
? A regular pentagon has perimeter 40 and apothem 5.5. Area? | *110 | 220 | 45.5
? A square with side 10 has apothem … | *5 | 10 | 5√2

@ cones-pyramids | Volume | Cones and pyramids
A cone or pyramid holds **one third** of the prism or cylinder with the same base and height.

- V = ⅓ · B · h
? A pyramid has base area 30 and height 8. Volume? | *80 | 240 | 38
? A cone has r = 3 and h = 10. Volume? | *30π | 90π | 10π
? A cylinder holds 27 L. The cone with the same base and height holds … | *9 L | 27 L | 81 L

@ spheres | Volume | Spheres
Every point on a sphere is the same distance (r) from the center. Its formulas use **r³** for volume and **r²** for area:

- **V = 4/3 πr³**
- **SA = 4πr²**
? A sphere with r = 3 has volume … | *36π | 12π | 108π
? A sphere with r = 5 has surface area … | *100π | 25π | 500π/3
? Doubling the radius multiplies the volume by … | *8 | 2 | 4

@ cavalieri | Volume | Cavalieri's principle
If two solids have the **same height** and the **same cross-section area** at every level, they have the **same volume** — even if one is slanted.
? A slanted stack of coins and a straight stack of the same coins have … | *the same volume | different volumes
? An oblique cylinder with r = 2, h = 5 has volume … | *20π | 10π | 4π
? Cavalieri's principle compares … | *cross-sections at each height | surface areas

@ density | Modeling | Density and modeling
**density = mass ÷ volume** (or people ÷ area).
? A 2 cm³ block has mass 16 g. Density? | *8 g/cm³ | 32 g/cm³ | 0.125 g/cm³
? A town of 12,000 people on 4 km² has density … | *3,000 per km² | 48,000 per km² | 0.0003
? Water's density is 1 g/cm³. The mass of 250 cm³ of water is … | *250 g | 1 g | 0.25 g

@ rotation-rules | Transformations | Rotation rules
Rotations about the origin (counterclockwise):

- 90°: (x, y) → (**−y, x**)
- 180°: (x, y) → (**−x, −y**)
- 270°: (x, y) → (**y, −x**)
? Rotate (2, 5) by 90° | *(−5, 2) | (5, −2) | (−2, −5)
? Rotate (3, −1) by 180° | *(−3, 1) | (1, 3) | (3, 1)
? Rotate (4, 1) by 270° | *(1, −4) | (−1, 4) | (−4, −1)

@ dilation-coords | Transformations | Dilations on the coordinate plane
Dilation from the origin by **k**: (x, y) → (**kx, ky**). k > 1 enlarges; 0 < k < 1 shrinks.
? Dilate (3, −2) by 4 | *(12, −8) | (7, 2) | (3/4, −1/2)
? Dilate (10, 6) by ½ | *(5, 3) | (20, 12) | (10.5, 6.5)
? (2, 3) → (6, 9). The scale factor is … | *3 | 4 | 1/3

@ symmetry-9 | Transformations | Line and rotational symmetry
A shape has **rotational symmetry** if a turn of less than 360° maps it onto itself.

- A regular n-gon has **n** lines of symmetry and turns of 360°/n.
? How many lines of symmetry does a square have? | *4 | 2 | 8
? The smallest turn that maps a regular hexagon onto itself is … | *60° | 90° | 120°
? Does the letter Z have rotational symmetry? | *yes (180°) | no

@ compose-transforms | Transformations | Composing transformations
Do transformations **in order**. Two reflections across parallel lines = a **translation**; across crossing lines = a **rotation**.
? Reflect (2, 3) over the x-axis, then the y-axis → | *(−2, −3) | (2, −3) | (3, 2)
? Translate (1, 1) by (3, 0), then reflect over the y-axis → | *(−4, 1) | (4, −1) | (−4, −1)
? Two reflections across intersecting lines make a … | *rotation | translation | dilation

@ conditionals | Logic | Converse, inverse and contrapositive
For "If p, then q":

- **Converse:** if q, then p
- **Inverse:** if not p, then not q
- **Contrapositive:** if not q, then not p (always has the same truth value)
? "If it's a square, it's a rectangle." Converse? | *If it's a rectangle, it's a square. | If it's not a square, it's not a rectangle.
? Which always has the same truth as the original? | *the contrapositive | the converse | the inverse
? "If x = 3, then x² = 9." Is the converse true? | *no (x could be −3) | yes

@ counterexample | Logic | Counterexamples
One **counterexample** proves a statement false.
? "All prime numbers are odd." Counterexample? | *2 | 3 | 9
? "Every quadrilateral with 4 equal sides is a square." Counterexample? | *a non-square rhombus | a square | a rectangle
? "x² > x for all x." Counterexample? | *x = 1/2 | x = 3 | x = 10

@ partition | Coordinates | Partitioning a segment
To find the point **k** of the way from A to B: **A + k(B − A)**.

- A(0, 0), B(9, 6), ⅓ of the way → (3, 2)
? A(2, 1), B(10, 5), halfway → | *(6, 3) | (8, 4) | (12, 6)
? A(0, 0), B(12, 8), ¾ of the way → | *(9, 6) | (3, 2) | (16, 12)
? A(1, 2), B(7, 2) in the ratio 1 : 2 → | *(3, 2) | (5, 2) | (4, 2)

@ geometric-probability | Probability | Geometric probability
**P = favorable length (or area) ÷ total length (or area)**
? A dart lands in a 10 × 10 board with a 4 × 5 target. P(target)? | *1/5 | 1/2 | 1/4
? A point is picked on a 12 cm segment. P(it's in the first 3 cm)? | *1/4 | 1/3 | 3/4
? A circle of radius 1 sits inside a circle of radius 2. P(inside the small one)? | *1/4 | 1/2 | 1/3
`;
