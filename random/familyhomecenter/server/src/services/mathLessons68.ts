/** ➗ More math lessons: 6th (Pre-Algebra), 7th (Algebra) and 8th (Algebra II). Format: see mathLessonsParse.ts. */

export const MATH_6 = `
@ ratio-tables | Ratios | Ratios and ratio tables
A **ratio** compares two amounts: 3 cups of flour to 2 cups of sugar is **3 : 2** (or 3 to 2, or 3/2).

Equal ratios come from multiplying or dividing **both** parts by the same number:
- 3 : 2 = 6 : 4 = 9 : 6 = 12 : 8

A **ratio table** lists equal ratios:
- Flour: 3, 6, 9, 12
- Sugar: 2, 4, 6, 8
? Which ratio equals 4 : 5? | 5 : 4 | *8 : 10 | 6 : 7
? A recipe uses 2 eggs for every 3 cups of milk. How many eggs for 12 cups of milk? | 6 | *8 | 18
? A class has 12 girls and 9 boys. The ratio of boys to girls in simplest form is … | 12 : 9 | 4 : 3 | *3 : 4

@ unit-rate | Ratios | Unit rates and best buys
A **unit rate** is "per one": divide to find how much for **1**.
- 180 miles in 3 hours → 180 ÷ 3 = **60 miles per hour**
- $4.50 for 3 pounds → **$1.50 per pound**

**Best buy:** compare the unit prices.
- 12 oz for $3.00 → $0.25 per oz
- 20 oz for $4.40 → $0.22 per oz ← cheaper per ounce
? 240 words in 4 minutes is how many words per minute? | 40 | *60 | 960
? Which is the better buy? | 5 pens for $4.00 | *8 pens for $6.00 | they're the same
> $4.00 ÷ 5 = $0.80 a pen; $6.00 ÷ 8 = $0.75 a pen.
? At 15 km per hour, how far do you go in 3 hours? | 5 km | 18 km | *45 km

@ percent-problems | Percents | Percent: part, whole and percent
**Percent** means "out of 100": 35% = 35/100 = 0.35.

Three kinds of problems — use **part = percent × whole**:
- **Find the part:** 20% of 60 = 0.2 × 60 = **12**
- **Find the percent:** 9 out of 36 = 9 ÷ 36 = 0.25 = **25%**
- **Find the whole:** 15 is 30% of what? 15 ÷ 0.3 = **50**

Handy: for 10%, move the decimal point one place left. 10% of 85 = 8.5
? 25% of 80 = | *20 | 25 | 40
? 18 is what percent of 72? | 18% | *25% | 54%
? 12 is 40% of what number? | 4.8 | *30 | 48

@ discounts | Percents | Discounts, tax and tips
- **Discount:** a percent **off**. A $40 shirt at 25% off → 40 × 0.25 = $10 off → **$30**
- **Sales tax:** a percent **added on**. $30 with 8% tax → 30 × 0.08 = $2.40 → **$32.40**
- **Tip:** a percent of the bill. 20% of $45 = **$9**

Shortcut: 25% off means you pay 75% → 40 × 0.75 = $30.
? A $60 game is 30% off. What do you pay? | $18 | *$42 | $57
? A $50 meal plus a 20% tip is … | $52 | $55 | *$60
? $20 plus 5% tax is … | $20.50 | *$21.00 | $25.00

@ gcf-lcm | Number theory | GCF and LCM
- **GCF (greatest common factor):** the biggest number that divides both. For 12 and 18: factors of 12 are 1, 2, 3, 4, **6**, 12; factors of 18 are 1, 2, 3, **6**, 9, 18 → **6**
- **LCM (least common multiple):** the smallest number both go into. For 4 and 6: multiples of 4 are 4, 8, **12**; of 6 are 6, **12** → **12**

Use the GCF to simplify fractions or split things into equal groups. Use the LCM for common denominators and "when will they line up again?"
? GCF of 24 and 36 | 6 | *12 | 72
? LCM of 6 and 8 | 14 | *24 | 48
? Hot dogs come in packs of 10 and buns in packs of 8. What's the fewest of each so they match exactly? | *40 | 80 | 18

@ prime-factor | Number theory | Prime factorization
Every whole number above 1 is a product of **primes** in exactly one way.

**Factor tree for 60:** 60 = 6 × 10 = (2 × 3) × (2 × 5) = **2² × 3 × 5**

Use it to find the GCF (the primes they share) and the LCM (every prime, as many times as it appears most).
? The prime factorization of 36 is … | 4 × 9 | *2² × 3² | 2 × 3 × 6
? The prime factorization of 45 is … | *3² × 5 | 5 × 9 | 3 × 15
? 2³ × 5 = | 30 | *40 | 16

@ dividing-fractions | Fractions | Dividing fractions: keep, change, flip
To divide by a fraction, **multiply by its reciprocal** (flip it).

**Keep, change, flip:** 2/3 ÷ 4/5 → 2/3 × 5/4 = 10/12 = **5/6**

Change mixed numbers to improper fractions first:
- 1 1/2 ÷ 3/4 = 3/2 × 4/3 = 12/6 = **2**

Check: 2 × 3/4 = 1 1/2 ✅
? 3/4 ÷ 1/2 = | 3/8 | *1 1/2 | 2/3
? 5 ÷ 2/3 = | 10/3 | *7 1/2 | 3 1/3
? How many 3/8-inch pieces can you cut from a 3-inch strip? | *8 | 9 | 1 1/8

@ long-division | Decimals | Dividing big numbers and decimals
Long division the standard way: **divide, multiply, subtract, bring down**.

- 3,456 ÷ 12 = **288**
- Keep going past the decimal point by adding zeros: 7 ÷ 4 = 1.75
- Dividing by a decimal: 2.88 ÷ 0.12 → 288 ÷ 12 = **24**
? 1,872 ÷ 24 = | 68 | *78 | 87
? 9 ÷ 8 = | 1.8 | *1.125 | 1.25
? 4.5 ÷ 0.15 = | 3 | *30 | 0.3

@ exponents | Expressions | Exponents and the order of operations
An **exponent** says how many times to multiply a number by itself: 2⁴ = 2 × 2 × 2 × 2 = **16** (not 8!)

**Order of operations (PEMDAS):**
1. Parentheses
2. Exponents
3. Multiply and divide, left to right
4. Add and subtract, left to right

3 + 2 × 4² = 3 + 2 × 16 = 3 + 32 = **35**
? 5² = | 10 | *25 | 7
? 2 + 3² × 2 = | 22 | *20 | 50
> 3² = 9, then 9 × 2 = 18, then 2 + 18 = 20.
? (4 + 2)² ÷ 4 = | *9 | 36 | 8

@ variables | Expressions | Writing expressions with variables
A **variable** is a letter that stands for a number.
- "5 more than n" → **n + 5**
- "3 times a number" → **3x**
- "a number divided by 4" → **y/4** or y ÷ 4
- "7 less than t" → **t − 7** (careful — not 7 − t!)

**Parts:** in 4x + 9, **4** is the coefficient, **x** the variable and **9** the constant; 4x and 9 are the terms.
? "6 less than k" | 6 − k | *k − 6 | 6k
? "twice a number, plus 3" | 2 + 3n | *2n + 3 | 2(n + 3)
? In 7m − 2, the coefficient is … | *7 | m | −2

@ evaluate | Expressions | Evaluating expressions
**Evaluate** = put the number in place of the variable, then do the math (PEMDAS).

If x = 4:
- 3x + 5 = 3(4) + 5 = **17**
- x² − 2x = 16 − 8 = **8**

Formulas too: area A = lw with l = 7 and w = 3 → **21**
? If a = 5, then 2a − 3 = | 49 | *7 | 13
? If n = 3, then n² + n = | 9 | *12 | 15
? If p = 10 and q = 2, then p ÷ q + q = | 2.5 | *7 | 10

@ like-terms | Expressions | Combining like terms and distributing
**Like terms** have the same variable part. Add their coefficients:
✅ 3x + 5x = 8x
✅ 4y + 2 + y + 7 = 5y + 9
❌ 2x + 3 = 5x

**Distributive property:** a(b + c) = ab + ac
- 4(x + 3) = **4x + 12**
- 2(3a − 5) = **6a − 10**
? 6m + 2m − m = | 8m | *7m | 9m
? 3(2x + 4) = | 6x + 4 | *6x + 12 | 5x + 7
? 5 + 2y + 3 + 4y = | 14y | *6y + 8 | 8y + 6

@ inequalities | Equations | Inequalities
- **x > 3:** bigger than 3 (3 itself doesn't count) — open circle at 3, shade to the right
- **x ≥ 3:** 3 or bigger — closed circle at 3
- **x < 3** and **x ≤ 3:** shade to the left

An inequality has **lots of solutions**: x > 3 includes 3.5, 4, 100 …

One step: x + 4 < 10 → x < 6.
? Which number is a solution of x ≥ 7? | 6.9 | *7 | 0
? x − 2 > 5 means … | x > 3 | *x > 7 | x < 7
? "You must be at least 48 inches tall" is … | h > 48 | *h ≥ 48 | h ≤ 48

@ absolute-value | Integers | Absolute value and opposites
The **absolute value** is the distance from 0, so it's never negative.
- |−6| = **6**
- |6| = **6**
- |0| = 0

**Opposites** are the same distance from 0 on opposite sides: 4 and −4.

Comparing negatives: −8 < −3 (−8 is further left), but |−8| > |−3|.
? The absolute value of −12 is … | −12 | *12 | 0
? Which is smaller? | −2 | *−9 | they're equal
? The opposite of −5 is … | −5 | *5 | 0

@ quadrants | Graphing | The four quadrants
The axes split the plane into **four quadrants**, numbered counterclockwise from the top right:
- **I:** (+, +)
- **II:** (−, +)
- **III:** (−, −)
- **IV:** (+, −)

Reflect (3, 2) across the x-axis → (3, −2); across the y-axis → (−3, 2).

The distance between (2, 5) and (2, −1) (same x): 5 − (−1) = **6**
? (−4, 7) is in quadrant … | I | *II | III
? (5, −1) reflected across the y-axis is … | (5, 1) | *(−5, −1) | (−5, 1)
? The distance from (−3, 4) to (6, 4) is … | 3 | *9 | 10

@ area-polygons | Geometry | Area of triangles, parallelograms and trapezoids
- **Parallelogram:** A = base × height
- **Triangle:** A = ½ × base × height (half a parallelogram)
- **Trapezoid:** A = ½ × (base₁ + base₂) × height

The **height** goes straight up from the base (at a right angle), not along a slanted side.

A triangle with base 10 and height 6 → ½ × 10 × 6 = **30**
? A triangle has base 8 and height 5. Its area is … | 40 | *20 | 13
? A parallelogram with base 9 and height 4 has area … | 13 | 18 | *36
? A trapezoid with bases 6 and 10 and height 4 has area … | *32 | 64 | 240

@ surface-area | Geometry | Surface area with nets
A **net** is a solid unfolded flat. **Surface area** = the areas of all the faces added up.

**A 4 × 3 × 2 box:**
- top and bottom: 2 × (4 × 3) = 24
- front and back: 2 × (4 × 2) = 16
- the two sides: 2 × (3 × 2) = 12
- **SA = 52 square units**

A cube with edge s: **SA = 6s²**
? The surface area of a cube with edges of 3 | 27 | *54 | 18
? The surface area of a 5 × 2 × 1 box | 10 | *34 | 17
? Surface area is measured in … | *square units | cubic units | plain units

@ volume-fractions | Geometry | Volume with fraction edges
**V = l × w × h** works for fractions and decimals too.

A box ½ ft × 2 ft × 3 ft → ½ × 2 × 3 = **3 cubic feet**

Another way to see it: fill it with little cubes with ½-foot sides. Each is ⅛ cubic foot and you need 24 of them → 24 × ⅛ = 3 ✅
? A box 1/2 × 1/2 × 4 has volume … | 2 | *1 | 4
? A box 2.5 × 2 × 3 has volume … | 7.5 | *15 | 30
? How many 1/2-inch cubes fill a 1-inch cube? | 2 | 4 | *8

@ center | Statistics | Mean, median, mode and range
Data: 3, 7, 7, 8, 10
- **Mean** (average): add them and divide by how many → 35 ÷ 5 = **7**
- **Median:** the middle one, in order → **7** (with an even count, average the two middle numbers)
- **Mode:** the most common → **7**
- **Range:** biggest − smallest → 10 − 3 = **7**

An **outlier** (a far-away value) pulls the mean much more than the median.
? The mean of 4, 6, 8, 10 | 6 | *7 | 8
? The median of 2, 9, 4, 7 | 4 | *5.5 | 7
> In order: 2, 4, 7, 9. The middle two are 4 and 7, and halfway between is 5.5.
? The range of 12, 5, 20, 8 | 8 | *15 | 20
? Which changes most with one huge outlier? | the median | *the mean | the mode

@ spread | Statistics | Box plots and the interquartile range
A **box plot** shows five numbers: **minimum, Q1, median, Q3, maximum**.
- Q1 = the median of the lower half; Q3 = the median of the upper half
- **IQR (interquartile range)** = Q3 − Q1 — how spread out the middle half is

Data: 1, 3, 4, 6, 8, 9, 12 → median 6; lower half 1, 3, 4 → Q1 = 3; upper half 8, 9, 12 → Q3 = 9; **IQR = 6**
? If Q1 = 10 and Q3 = 25, the IQR is … | 35 | *15 | 17.5
? In a box plot, the line inside the box is the … | mean | *median | mode
? About how much of the data is inside the box? | a quarter | *half | all of it

@ dependent | Equations | Independent and dependent variables
When one amount **depends on** another:
- You earn $9 an hour: pay **p = 9h**
- **h** (hours) is the **independent** variable — you choose it
- **p** (pay) is the **dependent** variable — it depends on h

Make a table (h: 1, 2, 3 → p: 9, 18, 27) and graph it: the points make a straight line through (0, 0).
? A car goes 50 miles per hour. Which equation fits? | t = 50d | *d = 50t | d = t + 50
? "The number of cookies baked depends on the cups of flour." The dependent variable is … | cups of flour | *cookies baked
? Tickets cost $6 each: c = 6t. If t = 7, then c = | 13 | *42 | 67
`;

export const MATH_7 = `
@ proportional | Ratios | Proportional relationships
Two amounts are **proportional** when their ratio is always the same: **y = kx**.
- **k** is the **constant of proportionality** (the unit rate): k = y ÷ x
- The graph is a straight line **through (0, 0)**

Gas: 2 gal → $7, 4 gal → $14, 6 gal → $21 → k = **3.5**, so y = 3.5x

❌ A taxi charging $3 plus $2 a mile (y = 2x + 3) is **not** proportional — it doesn't start at 0.
? x: 3, 6, 9 and y: 12, 24, 36. The constant k is … | 3 | *4 | 12
? Which is proportional? | y = x + 2 | *y = 5x | y = 3x − 1
? y = 0.5x. If x = 18, then y = | *9 | 36 | 18.5

@ proportions | Ratios | Solving proportions
A **proportion** says two ratios are equal: a/b = c/d.

**Cross-multiply:** a × d = b × c

3/5 = x/20 → 5x = 60 → **x = 12**

Use it for maps, recipes and similar shapes.
? 4/7 = 12/x, so x = | 15 | *21 | 28
? On a map, 1 inch = 50 miles. How far is 3.5 inches? | 150 miles | *175 miles | 53.5 miles
? 6 apples cost $4. How much do 15 apples cost? | $8 | *$10 | $12

@ percent-change | Percents | Percent increase and decrease
**Percent change = (new − old) ÷ old × 100%**
- $50 → $60: 10 ÷ 50 = **20% increase**
- 80 → 60: −20 ÷ 80 = **25% decrease**

The other way round: a 15% raise on $40 → 40 × 1.15 = **$46**; 15% off → 40 × 0.85 = **$34**

**Percent error** = (how far off the guess was) ÷ actual × 100%
? From 20 to 25 is a … | 5% increase | *25% increase | 20% increase
? From 200 to 150 is a … | 50% decrease | *25% decrease | 33% decrease
? $80 increased by 10% is … | $8 | *$88 | $90

@ interest | Percents | Simple interest
**Simple interest: I = P × r × t**
- P = principal (the starting money)
- r = rate per year (as a decimal)
- t = time in years

$500 at 4% for 3 years: I = 500 × 0.04 × 3 = **$60** → total **$560**
? $1,000 at 5% for 2 years earns … | $10 | *$100 | $1,100
? $200 at 3% for 5 years. The total at the end is … | $30 | $203 | *$230
? 6% as a decimal is … | 6.0 | 0.6 | *0.06

@ integer-rules | Integers | Multiplying and dividing negatives
- **Same signs → positive:** (−4)(−3) = **12**, (−20) ÷ (−5) = **4**
- **Different signs → negative:** (−4)(3) = **−12**, 20 ÷ (−5) = **−4**

An even number of negatives multiplied → positive; an odd number → negative: (−1)(−1)(−1) = −1.

Subtracting a negative is **adding**: 5 − (−3) = 8
? (−6)(−7) = | −42 | *42 | −13
? −36 ÷ 4 = | 9 | *−9 | −32
? −8 − (−10) = | −18 | *2 | −2

@ rational | Numbers | Rational numbers and repeating decimals
A **rational number** can be written as a fraction of integers: 3, −1/2, 0.75, 0.333…

To turn a fraction into a decimal, divide the top by the bottom.
- 3/8 = 0.375 (it **ends**)
- 1/3 = 0.333… (it **repeats**)
- 5/11 = 0.4545…

Every rational number's decimal either ends or repeats.
? 7/8 as a decimal | 0.78 | *0.875 | 0.87
? 2/3 as a decimal | *0.666… | 0.23 | exactly 0.67
? Which is rational? | *−4.25 | π | √2

@ factor-out | Expressions | Expanding and factoring expressions
**Expand** with the distributive property:
- −3(2x − 5) = **−6x + 15** (the negative goes to both terms!)

**Factor** by pulling out a common factor:
- 6x + 9 = **3(2x + 3)**
- 10a − 15b = **5(2a − 3b)**

Simplify: 5(x + 2) − 2x = 5x + 10 − 2x = **3x + 10**
? −2(4 − x) = | −8 − 2x | *−8 + 2x | 8 + 2x
? Factor 12y + 18 | *6(2y + 3) | 3(4y + 18) | 12(y + 6)
? 4(a + 1) + 3a = | 7a + 1 | *7a + 4 | 8a

@ multi-step | Equations | Multi-step equations
1. **Distribute** to clear parentheses
2. **Combine like terms** on each side
3. **Move the variables** to one side
4. **Undo** adding/subtracting, then multiplying/dividing
5. **Check** in the original equation

3(x − 2) + 4 = 2x + 7
- 3x − 6 + 4 = 2x + 7
- 3x − 2 = 2x + 7
- **x = 9** → check: 3(7) + 4 = 25 and 2(9) + 7 = 25 ✅
? 2(x + 5) = 18 | x = 6.5 | *x = 4 | x = 9
? 5x − 3 = 2x + 9 | *x = 4 | x = 2 | x = 12/7
? 4(x − 1) − x = 11 | x = 4 | *x = 5 | x = 3

@ inequalities-solve | Inequalities | Solving inequalities
Solve like an equation — **but flip the sign when you multiply or divide by a negative**.

- 2x + 3 > 11 → 2x > 8 → **x > 4**
- −3x ≤ 12 → divide by −3 and flip → **x ≥ −4**

Why flip? 2 < 5, but −2 > −5.
? 3x − 4 < 8 | x < 4/3 | *x < 4 | x > 4
? −2x > 10 | x > −5 | *x < −5 | x < 5
? 5 − x ≥ 2 | x ≥ 3 | *x ≤ 3 | x ≤ −3

@ literal | Equations | Solving a formula for a letter
A **literal equation** has several letters. Solve for one by undoing the others.

- d = rt, solve for t → **t = d/r**
- P = 2l + 2w, solve for w → P − 2l = 2w → **w = (P − 2l)/2**
- y = mx + b, solve for x → **x = (y − b)/m**
? A = lw. Solve for w. | w = A − l | *w = A/l | w = Al
? F = 1.8C + 32. Solve for C. | C = F/1.8 − 32 | *C = (F − 32)/1.8 | C = 1.8F + 32
? V = Bh. If V = 60 and B = 12, then h = | 720 | *5 | 48

@ graph-lines | Linear functions | Graphing a line from y = mx + b
1. Plot **b** on the y-axis (the y-intercept).
2. From there, use the slope **rise over run**: m = 2/3 → up 2, right 3.
3. Draw the line through the points.

Slopes:
- positive → uphill ↗, negative → downhill ↘
- **0** → flat (y = 4); **undefined** → straight up and down (x = 4)
? y = −2x + 1 crosses the y-axis at … | −2 | *1 | 2
? A line with slope −3/4 goes … | uphill | *downhill | flat
? The slope of y = 7 is … | 7 | *0 | undefined

@ line-equation | Linear functions | Writing the equation of a line
**From two points** (1, 3) and (3, 7):
- slope m = (7 − 3)/(3 − 1) = **2**
- put one point into y = mx + b: 3 = 2(1) + b → **b = 1**
- **y = 2x + 1**

**Point-slope form:** y − y₁ = m(x − x₁)

**Parallel** lines have the **same slope**. **Perpendicular** slopes are **negative reciprocals** (2 and −1/2).
? The line through (0, 4) with slope 3 | *y = 3x + 4 | y = 4x + 3 | y = 3x − 4
? The slope of the line through (2, 1) and (4, 5) | 1/2 | *2 | 4
? A line perpendicular to y = 4x − 1 has slope … | 4 | −4 | *−1/4

@ functions | Functions | What is a function?
A **function** gives **exactly one output for each input**.
- f(x) = 2x + 1 → f(3) = 2(3) + 1 = **7**
- **Domain:** the inputs allowed; **range:** the outputs you get

**Vertical line test:** if any up-and-down line crosses the graph twice, it's **not** a function.

The pairs (1, 4), (2, 5), (1, 6) are **not** a function — the input 1 has two outputs.
? f(x) = x² − 1. f(4) = | 7 | *15 | 9
? Which is a function? | (2, 3), (2, 5) | *(1, 2), (2, 2), (3, 2) | (0, 1), (0, −1)
? A circle drawn on a graph is … | a function | *not a function

@ systems | Systems | Systems of two equations
A **system** is two equations together. The solution is the point that works in **both** — where the lines cross.

**Substitution:** y = x + 1 and 2x + y = 7 → 2x + (x + 1) = 7 → x = 2, y = 3 → **(2, 3)**

**Elimination:** add or subtract the equations to cancel a letter:
- x + y = 10 and x − y = 4 → add: 2x = 14 → x = 7, y = 3

Parallel lines → **no solution**; the same line twice → **infinitely many**.
? x + y = 8 and x − y = 2. x = | 3 | *5 | 6
? y = 2x and x + y = 9. y = | 3 | *6 | 9
? y = 3x + 1 and y = 3x − 2 have … | one solution | *no solution | infinitely many

@ scale | Geometry | Scale drawings
A **scale** compares a drawing to the real thing: **1 cm : 5 m** means each centimeter on paper is 5 meters for real.

- 6 cm on the plan → 6 × 5 = **30 m**
- A 40 m wall → 40 ÷ 5 = **8 cm**

Areas grow by the scale factor **squared**: double every length and the area is 4 times as big.
? Scale 1 in : 4 ft. A room 3.5 in long on the plan is really … | 7 ft | *14 ft | 12 ft
? Scale 1 cm : 20 km. Two cities 90 km apart are how far apart on the map? | *4.5 cm | 18 cm | 1,800 cm
? Doubling every length of a drawing makes its area … | double | *four times as big | the same

@ circles | Geometry | Circles: circumference and area
- **Radius r:** center to edge. **Diameter d = 2r**
- **Circumference** (the distance around): **C = πd = 2πr**
- **Area: A = πr²**
- **π ≈ 3.14** (or 22/7)

Radius 5: C = 10π ≈ **31.4** and A = 25π ≈ **78.5**
? A circle has diameter 8. Its radius is … | 16 | *4 | 8π
? The area of a circle with radius 3 (π ≈ 3.14) | 18.84 | *28.26 | 9.42
? The circumference of a circle with diameter 10 (π ≈ 3.14) | *31.4 | 314 | 15.7

@ angle-pairs | Geometry | Angle pairs
- **Complementary:** add up to **90°** (30° and 60°)
- **Supplementary:** add up to **180°** (110° and 70°)
- **Vertical angles:** opposite each other where two lines cross — **equal**
- **Adjacent:** side by side, sharing a ray

A triangle's angles add up to **180°**.

Solve: angles x and 2x are supplementary → 3x = 180 → x = 60°
? The complement of 35° is … | 145° | *55° | 65°
? Two lines cross and one angle is 72°. The angle opposite it is … | 108° | *72° | 18°
? A triangle has angles of 50° and 60°. The third angle is … | 90° | *70° | 110°

@ probability | Probability | Probability
**Probability = favorable outcomes ÷ total outcomes**, from 0 (impossible) to 1 (certain).

A bag has 3 red, 5 blue and 2 green: P(blue) = 5/10 = **1/2**

- P(not blue) = 1 − 1/2 = 1/2
- **Experimental** probability comes from trying it: 18 heads in 40 flips → 18/40 = 0.45
? A die is rolled. P(a number greater than 4) | 1/6 | *1/3 | 1/2
? P(event) = 0.3. P(not the event) = | 0.3 | *0.7 | 1.3
? Which probability means "likely"? | 0.1 | 0.5 | *0.85

@ compound | Probability | Compound events
For two **independent** events, multiply: **P(A and B) = P(A) × P(B)**

- Flip a coin and roll a die: P(heads and 6) = 1/2 × 1/6 = **1/12**
- A **tree diagram** or a table lists every outcome: coin × die = 2 × 6 = **12** outcomes

**Without putting it back,** the second pick changes. 2 red out of 5 marbles: P(red, then red) = 2/5 × 1/4 = **1/10**
? Two coins: P(both heads) | 1/2 | *1/4 | 1/3
? 3 shirts and 4 pairs of pants. How many outfits? | 7 | *12 | 34
? Roll two dice. P(both 1s) | 1/6 | 1/12 | *1/36

@ sampling | Statistics | Samples and predictions
A **sample** is a part of a group used to learn about the whole **population**.

A **random sample** — everyone has the same chance of being picked — is fair. Asking only your friends is **biased**.

**Predict:** 12 of 40 students sampled like jazz → 12/40 = 30%. With 600 students: 0.3 × 600 ≈ **180**
? Which sample is fairest? | your soccer team | *20 names drawn from a hat with the whole school's names | the first 20 people at the gym
? In a sample, 15 of 50 like tea. Out of 1,000 people, about how many like tea? | 150 | *300 | 15
? Asking people in a pet store "do you like pets?" is … | random | *biased

@ sci-notation | Exponents | Zero and negative exponents, scientific notation
- **x⁰ = 1** (for any number except 0)
- **x⁻ⁿ = 1/xⁿ** → 2⁻³ = 1/8
- **Scientific notation:** a number from 1 to 10 times a power of 10
- 45,000 = **4.5 × 10⁴**
- 0.0036 = **3.6 × 10⁻³**

Multiplying: (2 × 10³)(4 × 10⁵) = **8 × 10⁸**
? 5⁰ = | 0 | *1 | 5
? 10⁻² = | −100 | *0.01 | −20
? 7,200,000 in scientific notation | 72 × 10⁵ | *7.2 × 10⁶ | 7.2 × 10⁵
`;

export const MATH_8 = `
@ poly-add | Polynomials | Adding and subtracting polynomials
A **polynomial** is a sum of terms like 3x², −5x and 7. Its **degree** is the highest power.

**Add:** combine like terms. (3x² + 2x − 1) + (x² − 5x + 4) = **4x² − 3x + 3**

**Subtract:** change every sign in the second one first.
(5x² − x + 2) − (2x² + 3x − 6) = 5x² − x + 2 − 2x² − 3x + 6 = **3x² − 4x + 8**
? (2x² + 3x) + (x² − 7x) = | 3x² + 10x | *3x² − 4x | 3x⁴ − 4x
? (4x − 3) − (x − 5) = | 3x − 8 | *3x + 2 | 3x − 2
? The degree of 6x³ − x⁵ + 2 is … | 3 | *5 | 6

@ multiply-poly | Polynomials | Multiplying polynomials
Multiply **every term by every term**.

**FOIL** for two binomials (First, Outer, Inner, Last):
(x + 3)(x + 5) = x² + 5x + 3x + 15 = **x² + 8x + 15**

(2x − 1)(x + 4) = 2x² + 8x − x − 4 = **2x² + 7x − 4**

Bigger ones: (x + 1)(x² + 2x + 3) = x³ + 2x² + 3x + x² + 2x + 3 = **x³ + 3x² + 5x + 3**
? (x + 2)(x + 6) = | x² + 12 | *x² + 8x + 12 | x² + 8x + 8
? (x − 4)(x + 3) = | *x² − x − 12 | x² + x − 12 | x² − 7x − 12
? (3x)(2x² − x) = | 6x² − 3x | *6x³ − 3x² | 5x³ − 3x

@ special-products | Polynomials | Special products
- **(a + b)² = a² + 2ab + b²** → (x + 5)² = x² + 10x + 25
- **(a − b)² = a² − 2ab + b²** → (x − 3)² = x² − 6x + 9
- **(a + b)(a − b) = a² − b²** → (x + 7)(x − 7) = x² − 49

❌ (x + 5)² = x² + 25
? (x + 4)² = | x² + 16 | *x² + 8x + 16 | x² + 4x + 16
? (x − 9)(x + 9) = | *x² − 81 | x² + 81 | x² − 18x − 81
? (2x − 1)² = | 4x² + 1 | *4x² − 4x + 1 | 4x² − 2x + 1

@ factor-gcf | Factoring | Factoring: GCF, difference of squares, grouping
Always look for a **GCF first**:
- 6x³ − 9x² = **3x²(2x − 3)**

**Difference of squares:** a² − b² = (a + b)(a − b)
- x² − 25 = **(x + 5)(x − 5)**
- 4x² − 9 = **(2x + 3)(2x − 3)**

**Grouping** (four terms): x³ + 2x² + 3x + 6 = x²(x + 2) + 3(x + 2) = **(x² + 3)(x + 2)**
? Factor 5x² + 10x | 5(x² + 10x) | *5x(x + 2) | x(5x + 2)
? Factor x² − 64 | (x − 8)² | *(x + 8)(x − 8) | (x + 32)(x − 2)
? Can x² + 9 be factored using real numbers? | yes: (x + 3)(x − 3) | *no

@ factor-ac | Factoring | Factoring ax² + bx + c
When a isn't 1, use the **ac method**:

**2x² + 7x + 3**
- a × c = 6. Find two numbers that multiply to 6 and add to 7: **6 and 1**
- Split the middle term: 2x² + 6x + x + 3
- Group: 2x(x + 3) + 1(x + 3) = **(2x + 1)(x + 3)**

Check with FOIL: 2x² + 6x + x + 3 ✅
? Factor 3x² + 10x + 3 | (3x + 3)(x + 1) | *(3x + 1)(x + 3) | (3x − 1)(x − 3)
? Factor 2x² − x − 6 | *(2x + 3)(x − 2) | (2x − 3)(x + 2) | (2x + 2)(x − 3)
? Solve 2x² + 5x − 3 = 0 | x = 3 or x = −1/2 | *x = 1/2 or x = −3 | x = −1/2 or x = −3

@ complete-square | Quadratics | Completing the square
Turn x² + bx into a perfect square by adding **(b/2)²**.

**Solve x² + 6x − 7 = 0**
- x² + 6x = 7
- add (6/2)² = 9 to both sides: x² + 6x + 9 = 16
- (x + 3)² = 16 → x + 3 = ±4
- **x = 1 or x = −7**

It's also how you get **vertex form**, and where the quadratic formula comes from.
? To complete the square for x² + 10x, add … | 10 | *25 | 100
? x² − 8x + 16 = | (x + 4)² | *(x − 4)² | (x − 8)²
? (x − 2)² = 9 gives x = | *5 or −1 | 3 or −3 | 11 or −7

@ quad-formula | Quadratics | The quadratic formula
For **ax² + bx + c = 0**:

**x = (−b ± √(b² − 4ac)) / 2a**

**x² − 4x − 5 = 0:** a = 1, b = −4, c = −5
- b² − 4ac = 16 + 20 = 36
- x = (4 ± 6)/2 → **x = 5 or x = −1**

The **discriminant** b² − 4ac: positive → 2 real answers; 0 → 1; negative → 2 complex (non-real) answers.
? For 2x² + 3x − 1 = 0, b² − 4ac = | 1 | *17 | 9
? The discriminant is −8. The solutions are … | two real | one real | *two non-real (complex)
? Solve x² + 2x − 8 = 0 | x = 4 or −2 | *x = 2 or −4 | x = 8 or −1

@ vertex-form | Quadratics | Graphing parabolas
**Vertex form: y = a(x − h)² + k** → the vertex is **(h, k)**
- a > 0 → opens **up** (a minimum); a < 0 → opens **down** (a maximum)
- the bigger a is (ignoring its sign), the narrower

**Standard form y = ax² + bx + c:** the axis of symmetry is **x = −b/2a**
- y = x² − 6x + 5 → x = 3, y = 9 − 18 + 5 = −4 → vertex **(3, −4)**
? The vertex of y = 2(x − 1)² + 7 | (−1, 7) | *(1, 7) | (2, 7)
? y = −3x² + 4 opens … | up | *down
? The axis of symmetry of y = x² + 8x + 1 | x = 8 | *x = −4 | x = 4

@ complex | Complex numbers | Imaginary and complex numbers
**i = √−1**, so **i² = −1**.
- √−16 = **4i**
- A **complex number** is a + bi (like 3 + 2i)

**Add:** (3 + 2i) + (1 − 5i) = **4 − 3i**
**Multiply:** (2 + i)(3 − i) = 6 − 2i + 3i − i² = 6 + i + 1 = **7 + i**

Powers of i go round in a cycle: i, −1, −i, 1, i, …
? √−49 = | −7 | *7i | 49i
? i² = | i | 1 | *−1
? (1 + i)(1 − i) = | 0 | 1 | *2

@ radicals | Radicals | Simplifying radicals
Pull out **perfect squares**: √(ab) = √a × √b
- √50 = √25 × √2 = **5√2**
- √72 = √36 × √2 = **6√2**

**Add** only like radicals: 3√2 + 5√2 = **8√2** (but √2 + √3 can't be combined)

**Rationalize** the bottom: 1/√3 = √3/3
? √48 = | 2√12 | *4√3 | 16√3
? 2√5 + 7√5 = | 9√10 | *9√5 | 14√5
? 6/√2 = | 6√2 | *3√2 | 3

@ rational-exp | Radicals | Fraction exponents
- **x^(1/2) = √x** and x^(1/3) = ∛x
- **x^(m/n) = (ⁿ√x)ᵐ**

- 8^(1/3) = **2**
- 27^(2/3) = (∛27)² = 3² = **9**
- 16^(−1/2) = 1/√16 = **1/4**

The usual exponent rules still work: x^(1/2) · x^(3/2) = x²
? 25^(1/2) = | 12.5 | *5 | 625
? 8^(2/3) = | *4 | 16/3 | 2
? 9^(−1/2) = | −3 | *1/3 | −1/3

@ rational-expr | Rational expressions | Simplifying rational expressions
A **rational expression** is a fraction made of polynomials. **Factor**, then cancel common **factors** (never terms).

(x² − 9)/(x² + 5x + 6) = (x + 3)(x − 3) / ((x + 2)(x + 3)) = **(x − 3)/(x + 2)**, as long as x ≠ −3 and x ≠ −2

❌ (x + 5)/5 = x — the 5 on top is a term, not a factor.

Multiply and divide them like fractions; to add, find a common denominator.
? Simplify (x² − 4)/(x − 2) | x − 2 | *x + 2 | x² − 2
? Simplify (3x + 6)/3 | 3x + 2 | *x + 2 | x + 6
? Which x is not allowed in 5/(x − 7)? | 0 | −7 | *7

@ composition | Functions | Combining functions: f(g(x))
- (f + g)(x) = f(x) + g(x)
- **Composition:** f(g(x)) — do g first, then put the answer into f

f(x) = x² and g(x) = x + 3:
- f(g(2)) = f(5) = **25**
- g(f(2)) = g(4) = **7**
- f(g(x)) = **(x + 3)²**

Order matters: f(g(x)) usually isn't g(f(x)).
? f(x) = 2x and g(x) = x − 1. f(g(4)) = | 7 | *6 | 8
? With the same f and g, g(f(4)) = | 6 | *7 | 8
? f(x) = x + 5 and g(x) = 3x. g(f(x)) = | 3x + 5 | *3x + 15 | x + 15

@ inverse | Functions | Inverse functions
An **inverse** f⁻¹ undoes f: if f(2) = 7, then **f⁻¹(7) = 2**.

**To find it:** swap x and y, then solve for y.
- y = 3x − 4 → x = 3y − 4 → **f⁻¹(x) = (x + 4)/3**

The two graphs are mirror images across the line **y = x**. A function has an inverse function only if it passes the **horizontal line test**.
? f(x) = x + 9. f⁻¹(x) = | x + 9 | *x − 9 | 9x
? f(x) = 2x + 1. f⁻¹(5) = | 11 | *2 | 3
? f(f⁻¹(x)) = | 0 | 1 | *x

@ abs-equations | Equations | Absolute value equations and inequalities
|x| = 5 means x is 5 away from 0 → **x = 5 or x = −5**

**|2x − 1| = 7**
- 2x − 1 = 7 → x = 4
- 2x − 1 = −7 → x = −3

**Inequalities:**
- |x| < 3 → **−3 < x < 3** ("less than" → in between)
- |x| > 3 → **x < −3 or x > 3** ("greater than" → outside)

An absolute value can never equal a negative number.
? The absolute value of (x − 2) equals 6. Solve. | x = 8 | *x = 8 or x = −4 | x = 4 or x = −8
? "The absolute value of x is less than 4" means … | x < 4 | *−4 < x < 4 | x < −4 or x > 4
? How many solutions does "the absolute value of x equals −2" have? | 2 | 1 | *0

@ exp-functions | Exponential | Exponential growth and decay
**y = a · bˣ**
- a = the starting amount
- b > 1 → **growth**; b between 0 and 1 → **decay**

With a percent rate r: growth y = a(1 + r)ᵗ, decay y = a(1 − r)ᵗ
- $1,000 growing 5% a year: 1000(1.05)ᵗ
- A car losing 15% of its value a year: V = 20000(0.85)ᵗ
? y = 300(0.9)ˣ shows … | growth | *decay
? 100 bacteria double every hour. How many after 3 hours? | 300 | 600 | *800
? Something worth $500 grows 10% a year. After 2 years it's worth … | $600 | *$605 | $550

@ log-solve | Logarithms | Solving exponential equations with logs
**log_b(x) = y means bʸ = x.** Logs undo exponents.

**Rules:**
- log(ab) = log a + log b
- log(a/b) = log a − log b
- **log(aⁿ) = n · log a** ← brings the exponent down

**Solve 3ˣ = 20:** take the log of both sides: x · log 3 = log 20 → x = log 20 / log 3 ≈ **2.73**
? log₂ 32 = | 16 | *5 | 6
? log 5 + log 2 = (base 10) | log 7 | *1 | log 3
> log 5 + log 2 = log 10 = 1.
? Solve 2ˣ = 64 | 32 | *6 | 8

@ transformations | Functions | Shifting and stretching graphs
Starting from y = f(x):
- **f(x) + k:** up k (down if k is negative)
- **f(x − h):** right h — the sign is backwards inside!
- **−f(x):** flip over the x-axis
- **a · f(x):** stretch taller (a > 1) or squash (a between 0 and 1)

y = (x + 2)² − 3 is y = x² moved **left 2** and **down 3**.
? y = √(x − 4) is y = √x moved … | left 4 | *right 4 | up 4
? y = x² + 6 is y = x² moved … | *up 6 | right 6 | down 6
? y = −x² compared with y = x² is … | *flipped upside down | moved left | stretched taller

@ poly-division | Polynomials | Dividing polynomials and the remainder theorem
**Long division** works like it does with numbers: (x² + 5x + 6) ÷ (x + 2) = **x + 3**

**Synthetic division** is a shortcut for dividing by (x − c).

**Remainder theorem:** dividing p(x) by (x − c) leaves the remainder **p(c)**.
- p(x) = x³ − 2x + 4 divided by (x − 1): p(1) = 1 − 2 + 4 = **3**

**Factor theorem:** if p(c) = 0, then (x − c) is a factor.
? (x² + 7x + 10) ÷ (x + 5) = | x + 5 | *x + 2 | x + 7
? The remainder of (x² + 1) ÷ (x − 3) | 1 | 9 | *10
? p(2) = 0, so which is a factor of p(x)? | x + 2 | *x − 2 | 2x

@ systems-3 | Systems | Systems with three variables
Eliminate the same variable twice to get **two equations in two variables**, solve those, then substitute back.

- x + y + z = 6
- x − y + z = 2
- 2x + y − z = 1

First minus second: 2y = 4 → **y = 2**
First plus third: 3x + 2y = 7 → 3x = 3 → **x = 1**
Then z = 6 − 1 − 2 = **3** → the solution is **(1, 2, 3)**

The answer is one point in 3-D space, where three planes meet.
? Does (1, 2, 3) make x − y + z = 2 true? | *yes | no
? x + y = 5, x − y = 1 and z = 2. What is x? | 2 | *3 | 4
? In the example, subtracting the second equation from the first gets rid of … | y | *x and z | nothing
`;
