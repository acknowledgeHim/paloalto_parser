/** ➗ More math lessons: 3rd, 4th and 5th grade. Format: see mathLessonsParse.ts. */
export const MATH_3 = `
@ times-tricks | Multiplying | Times table tricks
- **×0:** always 0. **×1:** stays the same.
- **×2:** double it. 2 × 8 = 16
- **×5:** ends in 0 or 5. 5 × 7 = 35
- **×10:** put a 0 on the end. 10 × 6 = 60
- **×9:** the digits add up to 9! 9 × 4 = 36 (3 + 6 = 9), and the tens digit is one less than 4.
- **×4:** double, then double again. 4 × 7 → 14 → 28
? 9 × 6 = | 56 | *54 | 45
? 4 × 8 = | 24 | *32 | 36
? 5 × 9 = | 54 | *45 | 40
? 0 × 125 = | 125 | *0 | 1

@ mult-properties | Multiplying | Turn it around and break it apart
- **Turn it around (commutative):** 3 × 7 = 7 × 3
- **Group any way (associative):** (2 × 3) × 4 = 2 × (3 × 4) = 24
- **Break it apart (distributive):** 7 × 8 = 7 × 5 + 7 × 3 = 35 + 21 = **56**

Break hard facts into easy ones!
? 6 × 7 = 6 × 5 + 6 × ☐ | *2 | 7 | 5
? 8 × 3 is the same as … | 8 + 3 | *3 × 8 | 8 × 8
? 7 × 6 = 7 × 3 + 7 × 3 = 21 + 21 = | *42 | 36 | 49

@ division-meaning | Dividing | Dividing: sharing and grouping
**Division** splits things into **equal groups**.
- **Sharing:** 12 cookies shared by 3 kids → each gets **4**
- **Grouping:** 12 cookies, 3 in each bag → **4** bags

12 ÷ 3 = 4 is read "12 divided by 3 equals 4".
? 15 crayons shared by 5 kids. Each gets … | *3 | 10 | 20
? 20 wheels, 4 on each car. How many cars? | *5 | 16 | 24
? 18 ÷ 2 = | 8 | *9 | 16

@ fact-families-x | Dividing | Multiplying and dividing go together
**4, 6, 24:**
- 4 × 6 = 24 and 6 × 4 = 24
- 24 ÷ 4 = 6 and 24 ÷ 6 = 4

For 35 ÷ 7, think: **7 × what = 35?** → 5
? 42 ÷ 6 = | 6 | *7 | 8
? 8 × 9 = 72, so 72 ÷ 8 = | 8 | *9 | 64
? 56 ÷ 7 = | *8 | 7 | 9

@ division-rules | Dividing | Dividing with 0 and 1
- A number ÷ 1 = the same number: 9 ÷ 1 = 9
- A number ÷ itself = 1: 9 ÷ 9 = 1
- 0 ÷ any number = 0: 0 ÷ 5 = 0
- You **can't** divide by 0! (Share 5 cookies among 0 friends? It doesn't make sense.)
? 7 ÷ 7 = | 0 | *1 | 7
? 0 ÷ 8 = | *0 | 1 | 8
? 6 ÷ 1 = | 1 | *6 | 0

@ unknown | Multiplying | Finding the unknown number
A letter or ☐ can stand for a missing number.

- 6 × ☐ = 42 → 42 ÷ 6 = **7**
- n ÷ 4 = 5 → 5 × 4 = **20**
? 8 × ☐ = 48 | 5 | *6 | 7
? n ÷ 3 = 9. What is n? | 3 | 12 | *27
? ☐ × 7 = 63 | *9 | 8 | 7

@ mult-tens | Multiplying | Multiplying by multiples of 10
**4 × 60** = 4 × 6 tens = 24 tens = **240**

Do the basic fact, then put on the zero:
- 3 × 50 → 3 × 5 = 15 → **150**
- 7 × 80 → 7 × 8 = 56 → **560**
? 6 × 30 = | 18 | *180 | 1800
? 9 × 40 = | *360 | 36 | 3600
? 5 × 80 = | 40 | *400 | 4000

@ rounding | Numbers | Rounding to the nearest 10 and 100
Look at the digit **to the right** of the place you're rounding to.
- **5 or more** → round **up**
- **4 or less** → round **down**

- 67 → **70** (7 ones is 5 or more)
- 643 → **600** to the nearest hundred (4 tens is less than 5)
- 250 → **300** (5 rounds up)
? 84 rounded to the nearest 10 | *80 | 90 | 85
? 365 rounded to the nearest 10 | 360 | *370 | 400
? 749 rounded to the nearest 100 | *700 | 750 | 800

@ add-sub-1000 | Adding and subtracting | Adding and subtracting within 1000
Line up the places. Work **right to left**, carrying or borrowing when you need to.

**602 − 358**
- 2 − 8 can't be done, and there are no tens, so borrow a hundred: 5 hundreds, 9 tens, 12 ones
- 12 − 8 = 4, 9 − 5 = 4, 5 − 3 = 2 → **244**

Estimate first: 600 − 360 is about 240 ✅
? 457 + 386 = | 733 | *843 | 833
? 700 − 264 = | *436 | 546 | 464
? 529 − 199 is about … | 200 | *300 | 400

@ two-step-letters | Word problems | Two-step problems with a letter
Write an equation with a letter for the unknown.

"Pat buys 3 packs of 8 pencils and gives away 5. How many are left?"
- p = 3 × 8 − 5 = 24 − 5 = **19**

Check that the answer is **reasonable**: 3 × 8 is about 25, minus 5 is about 20 ✅
? 4 boxes of 6 eggs, and 3 eggs break. How many good eggs? | *21 | 27 | 13
? You have $50 and spend 2 × $9. How much is left? | $41 | *$32 | $18
? 5 rows of 7 chairs, and 10 are taken. How many are empty? | *25 | 35 | 22

@ table-patterns | Multiplying | Patterns in the times table
- Any number × 2 is **even**.
- Even × anything = even. Odd × odd = **odd**: 3 × 5 = 15
- The ×5 answers end in 5, 0, 5, 0 …
- The ×9 answers' digits add up to 9: 18, 27, 36, 45 …
? Is 7 × 9 even or odd? | even | *odd
? 4 × 7 is … | odd | *even
? Which could be a ×5 answer? | 42 | *45 | 47

@ unit-fractions | Fractions | Unit fractions
A **fraction** names part of a whole.
- **Bottom (denominator):** how many equal parts the whole is cut into
- **Top (numerator):** how many of those parts we have

A **unit fraction** has 1 on top: 1/2, 1/3, 1/4, 1/8 …

3/4 means 3 of the 4 equal parts — three 1/4s.
? A pie is cut into 8 equal pieces. One piece is … | 1/4 | *1/8 | 8/1
? In 2/5, the 5 tells … | how many parts we have | *how many equal parts in the whole | nothing
? 3/4 is how many 1/4s? | 1 | *3 | 4

@ fraction-line | Fractions | Fractions on a number line
Cut the space from **0 to 1** into equal parts.

0 — 1/4 — 2/4 — 3/4 — 1

- 4/4 = **1** (a whole)
- 2/2 = 1 and 3/3 = 1
- Past 1: 5/4 is one more fourth past 1
? On a number line cut into thirds, the mark after 1/3 is … | 1/2 | *2/3 | 3/3
? 6/6 = | 6 | *1 | 0
? Where is 1/2 on a number line from 0 to 1? | near 0 | *in the middle | at 1

@ equal-fractions | Fractions | Equal fractions
Different fractions can be the **same amount**.

- 1/2 = 2/4 = 3/6 = 4/8
- 1/3 = 2/6
- Whole numbers: 3 = 3/1 and 1 = 4/4

Fold a paper in half, then in half again: 1 half = 2 fourths.
? 1/2 = ☐/8 | 2 | *4 | 6
? Which equals 1? | 3/4 | *5/5 | 1/5
? 2/6 = | 1/2 | *1/3 | 2/3

@ compare-fractions | Fractions | Comparing fractions
- **Same bottom:** more pieces is bigger → 3/8 > 2/8
- **Same top:** a **smaller** bottom means bigger pieces → 1/3 > 1/6

Only compare fractions of the **same-size whole**!
? 5/8 ☐ 3/8 | *> | < | =
? 1/4 ☐ 1/2 | > | *< | =
? 2/3 ☐ 2/5 | *> | < | =

@ elapsed | Time | Time to the minute and elapsed time
Read the hour, then count the minutes by 5s and then by 1s.

**Elapsed time** is how much time passes.
"Practice starts at 3:15 and ends at 4:05."
- 3:15 → 4:00 is 45 minutes
- 4:00 → 4:05 is 5 minutes
- Total: **50 minutes**

1 hour = 60 minutes.
? From 2:40 to 3:10 is … | 70 minutes | *30 minutes | 1 hour
? A movie starts at 6:30 and lasts 1 hour 20 minutes. It ends at … | 7:20 | *7:50 | 8:00
? How many minutes are in 2 hours? | 100 | *120 | 200

@ mass-liquid | Measuring | Grams, kilograms and liters
- **Mass** (how heavy): a paper clip is about 1 **gram (g)**; a big book is about 1 **kilogram (kg)**. 1 kg = 1000 g.
- **Liquid volume** (how much it holds): a big water bottle is about 1 **liter (L)**. 1 L = 1000 milliliters (mL).
? Which is about 1 gram? | a dog | *a paper clip | a bike
? 1 kilogram = ☐ grams | 10 | 100 | *1000
? A bathtub holds about … | 2 liters | *200 liters | 2 milliliters

@ area-shapes | Shapes | Area of shapes made of rectangles
Break an odd shape into **rectangles**, find each area, then **add** them.

An L-shape made of a 4 × 3 rectangle and a 2 × 2 rectangle → 12 + 4 = **16 square units**

**Area of a rectangle = length × width**
? A 5 × 2 rectangle and a 3 × 3 rectangle put together. Total area? | 15 | *19 | 30
? A rectangle is 6 by 4. Its area is … | 10 | 20 | *24
? A rectangle has area 18 and length 6. Its width is … | *3 | 12 | 24

@ perimeter-more | Shapes | Perimeter: the distance around
**Perimeter** = add up all the sides.

- A 5 by 3 rectangle: 5 + 3 + 5 + 3 = **16**
- A square with sides of 4: 4 × 4 = **16**

Two shapes can have the **same area** but **different perimeters**:
- 1 × 12 rectangle: area 12, perimeter 26
- 3 × 4 rectangle: area 12, perimeter 14
? The perimeter of a 6 by 2 rectangle | 12 | *16 | 8
? A square has a perimeter of 20. Each side is … | 4 | *5 | 10
? A triangle with sides 3, 4 and 5 has perimeter … | *12 | 60 | 9

@ quadrilaterals | Shapes | Kinds of quadrilaterals
They all have **4 sides**.
- **Rectangle:** 4 square corners (right angles)
- **Square:** 4 right angles **and** 4 equal sides (a square is a special rectangle!)
- **Rhombus:** 4 equal sides (the corners don't have to be square)
- **Trapezoid:** at least one pair of parallel sides
? A square is also a … | triangle | *rectangle and a rhombus | pentagon
? A shape with 4 equal sides but slanted corners is a … | rectangle | *rhombus | square
? Do all quadrilaterals have 4 right angles? | yes | *no

@ scaled-graphs | Data | Graphs where one picture means more
In a **scaled picture graph** one picture can stand for more than one thing.

Key: ⭐ = 2 books
- Sam: ⭐⭐⭐ → **6** books
- Ana: ⭐⭐⭐⭐⭐ → **10** books

On a scaled **bar graph** the scale might count by 2s, 5s or 10s.
? Key: ⭐ = 5. A row has ⭐⭐⭐⭐. How many is that? | 4 | 9 | *20
? Key: 🍎 = 2. Ten apples need how many 🍎 pictures? | *5 | 10 | 20
? With Sam and Ana above, how many more books did Ana read? | 2 | *4 | 16
`;
export const MATH_4 = `
@ place-million | Place value | Place value to a million
Each place is worth **10 times** the place to its right.

ones, tens, hundreds, **thousands**, ten thousands, hundred thousands, **millions**

**3,482,105** → 3 millions, 4 hundred thousands, 8 ten thousands, 2 thousands, 1 hundred, 0 tens, 5 ones

Commas split every 3 digits, counting from the right.
? In 56,213, the 6 is in the … place | hundreds | *thousands | ten thousands
? The 7 in 70,000 is worth … | 700 | 7,000 | *70,000
? 400 is how many times 40? | 4 | *10 | 100

@ round-big | Place value | Rounding big numbers
Same rule: look one place to the **right**. 5 or more → round up.

- 47,382 to the nearest thousand → **47,000** (3 is less than 5)
- 47,382 to the nearest ten thousand → **50,000** (7 is 5 or more)
- 8,951 to the nearest hundred → **9,000**
? 62,749 to the nearest thousand | 62,000 | *63,000 | 62,700
? 5,250 to the nearest hundred | 5,200 | *5,300 | 5,000
? 381,000 to the nearest hundred thousand | *400,000 | 300,000 | 380,000

@ add-sub-big | Adding and subtracting | Adding and subtracting big numbers
Line up the places — ones under ones. Carry and borrow just like with smaller numbers.

**45,206 − 18,739 = 26,467**
Check: 26,467 + 18,739 = 45,206 ✅
? 23,456 + 11,111 = | *34,567 | 34,467 | 12,345
? 10,000 − 1 = | *9,999 | 9,000 | 1,000
? 7,302 − 2,654 = | 5,348 | *4,648 | 4,758

@ mult-2digit | Multiplying | Multiplying two-digit numbers
Break it apart (partial products):

**24 × 13**
- 24 × 10 = 240
- 24 × 3 = 72
- 240 + 72 = **312**

**Area model:** split 24 into 20 + 4 and 13 into 10 + 3, multiply each box and add: 200 + 40 + 60 + 12 = 312.
? 15 × 12 = | 170 | *180 | 150
? 23 × 11 = | *253 | 233 | 243
? 30 × 40 = | 120 | *1,200 | 12,000

@ mult-4by1 | Multiplying | Multiplying a big number by one digit
Multiply each place, starting with the **ones**, and carry.

**3,264 × 4**
- 4 × 4 = 16 → write 6, carry 1
- 6 × 4 = 24, + 1 = 25 → write 5, carry 2
- 2 × 4 = 8, + 2 = 10 → write 0, carry 1
- 3 × 4 = 12, + 1 = 13
- **13,056**
? 512 × 3 = | 1,516 | *1,536 | 1,546
? 2,005 × 6 = | 12,300 | *12,030 | 1,230
? 999 × 2 = | *1,998 | 1,988 | 1,898

@ remainders | Dividing | Remainders
When things don't share out evenly, what's left over is the **remainder**.

**17 ÷ 5 = 3 R 2** → 3 groups of 5 is 15, with 2 left over.

What you do with the remainder depends on the story:
- 17 kids, 5 per car → you need **4** cars (round up)
- 17 cookies, 5 per bag → **3** full bags (leave the extra out)
? 23 ÷ 4 = | 5 R 2 | *5 R 3 | 6 R 1
? 26 people, 6 at each table. How many tables are needed? | 4 | *5 | 6
? The remainder must always be … | bigger than the number you divide by | *smaller than the number you divide by | zero

@ factors | Numbers | Factors, multiples and primes
- **Factors** of 12: numbers that divide it evenly → 1, 2, 3, 4, 6, 12
- **Multiples** of 4: 4, 8, 12, 16, 20 … (the ×4 table)
- A **prime** number has exactly 2 factors, 1 and itself (2, 3, 5, 7, 11, 13 …)
- A **composite** number has more than 2 factors (4, 6, 8, 9 …)
- 1 is neither prime nor composite.
? Which is a factor of 18? | 4 | *6 | 8
? Which is prime? | 9 | 15 | *13
? Which is a multiple of 7? | 17 | *28 | 37

@ patterns-rules | Patterns | Number patterns and rules
A **pattern rule** tells you how to get the next number.

Rule "add 3", starting at 1: 1, 4, 7, 10, 13 …

Look for other things too: these go odd, even, odd, even.
? Rule "multiply by 2", starting at 3: 3, 6, 12, __ | 18 | *24 | 15
? 5, 9, 13, 17 … the rule is … | add 5 | *add 4 | multiply by 2
? Rule "add 4", starting at 2. Will any number be odd? | yes | *no

@ equivalent-compare | Fractions | Comparing fractions with different bottoms
To compare 2/3 and 3/4, make the **bottoms the same**:
- 2/3 = 8/12
- 3/4 = 9/12
- 9/12 > 8/12, so **3/4 > 2/3**

**Compare with 1/2:** 3/8 is less than half (half is 4/8), and 5/8 is more than half.
? Which is bigger: 3/5 or 1/2? | 1/2 | *3/5 | they're the same
? 2/4 ☐ 5/10 | > | < | *=
? Which is smallest? | *1/3 | 5/6 | 2/3

@ add-fractions-like | Fractions | Adding fractions with the same bottom
When the bottoms are the same, add or subtract the **tops**. The bottom stays the same.

✅ 2/8 + 3/8 = 5/8
✅ 7/10 − 4/10 = 3/10
❌ 2/8 + 3/8 = 5/16

**Mixed numbers:** 1 2/5 + 2 1/5 = 3 3/5
? 3/7 + 2/7 = | 5/14 | *5/7 | 6/7
? 9/12 − 5/12 = | *4/12 | 4/0 | 14/12
? 2 1/4 + 1 2/4 = | 3 3/8 | *3 3/4 | 1 1/4

@ fraction-times-whole | Fractions | Multiplying a fraction by a whole number
3 × 2/5 means **three groups of 2/5**: 2/5 + 2/5 + 2/5 = **6/5** (= 1 1/5)

Multiply the **top** by the whole number and keep the bottom.
? 4 × 1/3 = | 4/12 | *4/3 | 1/12
? 2 × 3/8 = | *6/8 | 6/16 | 5/8
? 5 × 1/5 = | 5/25 | *1 | 1/25

@ decimals-tenths | Decimals | Tenths and hundredths
- **Tenths:** 1/10 = **0.1**
- **Hundredths:** 1/100 = **0.01**
- 3/10 = 0.3 and 30/100 = 0.30 — the same amount!
- 0.47 = 47/100: 4 tenths and 7 hundredths

Money: $0.25 is 25 hundredths of a dollar.
? 7/10 as a decimal | 0.07 | *0.7 | 7.10
? 0.09 = | 9/10 | *9/100 | 9
? Which is bigger: 0.6 or 0.58? | *0.6 | 0.58 | they're the same
> 0.6 = 0.60, and 60 hundredths is more than 58 hundredths.

@ units-convert | Measuring | Changing units
Bigger unit → smaller unit: **multiply**.
- 1 ft = 12 in, 1 yd = 3 ft, 1 lb = 16 oz
- 1 m = 100 cm, 1 km = 1,000 m, 1 kg = 1,000 g
- 1 hour = 60 min, 1 min = 60 s

5 feet = 5 × 12 = **60 inches**
? 3 yards = ☐ feet | 6 | *9 | 36
? 4 kg = ☐ g | 400 | *4,000 | 40
? 2 pounds = ☐ ounces | 24 | *32 | 20

@ area-perimeter-formulas | Measuring | Area and perimeter formulas
For a rectangle:
- **Area = length × width**
- **Perimeter = 2 × length + 2 × width**

Working backwards: area 48 and length 8 → width = 48 ÷ 8 = **6**
? A garden is 9 m by 4 m. Its area is … | 26 m² | *36 m² | 13 m²
? The perimeter of that 9 m by 4 m garden is … | *26 m | 36 m | 13 m
? A rectangle has perimeter 20 and length 6. Its width is … | 14 | *4 | 8

@ angles-measure | Shapes | Angles and degrees
An **angle** is measured in **degrees (°)** with a protractor. A full turn is **360°**.
- **Right angle:** 90° (a square corner)
- **Acute:** less than 90°
- **Obtuse:** more than 90° but less than 180°
- **Straight:** 180°

Angles add up: angles of 30° and 45° side by side make **75°**.
? An angle of 120° is … | acute | *obtuse | right
? How many degrees is a quarter turn? | 45° | *90° | 180°
? A straight angle is split into 110° and ☐ | 80° | *70° | 250°

@ lines | Shapes | Lines, rays and parallel lines
- **Line:** goes on forever both ways
- **Ray:** starts at a point and goes on forever one way
- **Line segment:** has two ends
- **Parallel:** never meet (like train tracks) ∥
- **Perpendicular:** meet at a right angle ⊥
? Train tracks are … | perpendicular | *parallel | rays
? A part of a line with two endpoints is a … | ray | *segment | angle
? The edges at the corner of a book are … | parallel | *perpendicular

@ symmetry | Shapes | Symmetry and kinds of triangles
A **line of symmetry** folds a shape into two **matching halves**.
- Square: 4 lines of symmetry
- Rectangle (not a square): 2
- Circle: endless lines of symmetry

**Triangles by their angles:** right (one 90° angle), acute (all less than 90°), obtuse (one more than 90°).
? How many lines of symmetry does a square have? | 2 | *4 | 8
? The letter A has a line of symmetry that goes … | across | *up and down | it has none
? A triangle with a 100° angle is … | right | acute | *obtuse

@ word-multistep | Word problems | Multi-step problems
Read carefully. Work out **what you know** and **what you need**, then plan the steps.

"A school buys 6 boxes of 24 pencils. They give 35 pencils to each of 3 classes. How many are left?"
- 6 × 24 = 144
- 35 × 3 = 105
- 144 − 105 = **39**
? 5 shelves with 32 books each, and 47 books are checked out. How many are still on the shelves? | 103 | *113 | 207
? Tickets cost $8 each. A family of 4 pays with $50. How much change? | *$18 | $32 | $42
? 3 packs of 12 markers are shared by 4 kids. Each gets … | 3 | *9 | 12

@ line-plot-fractions | Data | Line plots with fractions
A line plot can show measurements with fractions.

Bean plant heights (inches): 1/4, 1/2, 1/2, 3/4, 3/4, 3/4

- The most common height is **3/4** inch (3 plants)
- Tallest − shortest: 3/4 − 1/4 = **2/4 = 1/2** inch
? How many of the plants are 1/2 inch tall? | 1 | *2 | 3
? Add the two 1/2-inch plants' heights together. | 1/4 inch | *1 inch | 2/4 inch
? How many plants are taller than 1/4 inch? | 3 | 4 | *5
`;
export const MATH_5 = `
@ powers-of-10 | Place value | Powers of 10
**10² = 10 × 10 = 100**, 10³ = 1,000, 10⁴ = 10,000. The little number tells **how many zeros**.

Multiplying by 10 moves every digit **one place left**: 3.7 × 10 = 37, 3.7 × 100 = 370
Dividing by 10 moves every digit **one place right**: 45 ÷ 10 = 4.5, 45 ÷ 100 = 0.45
? 10³ = | 30 | *1,000 | 100
? 6.2 × 100 = | 62 | *620 | 6.200
? 85 ÷ 1,000 = | 0.85 | *0.085 | 8.5

@ compare-decimals | Decimals | Comparing and rounding decimals
Line up the **decimal points** and compare place by place. Add zeros so they're the same length.
- 0.7 vs 0.65 → 0.70 vs 0.65 → **0.7 is bigger**
- 3.456 to the nearest tenth → **3.5** (5 hundredths rounds up)
- 2.849 to the nearest hundredth → **2.85**
? Which is greatest? | 0.09 | *0.9 | 0.89
? 7.36 to the nearest tenth | 7.3 | *7.4 | 7.0
? 12.051 ☐ 12.15 | > | *< | =

@ add-decimals | Decimals | Adding and subtracting decimals
**Line up the decimal points!** Fill the empty places with 0.

- 4.5 + 2.36 → 4.50 + 2.36 = **6.86**
- 10 − 3.75 → 10.00 − 3.75 = **6.25**
? 3.2 + 1.45 = | 1.77 | *4.65 | 4.47
? 5 − 0.6 = | 4.6 | *4.4 | 0.1
? 12.75 + 0.25 = | 12.100 | *13 | 12.10

@ multiply-decimals | Decimals | Multiplying decimals
Multiply as if there were no decimal points. Then **count the decimal places** in both numbers and put that many in the answer.

**1.2 × 0.3**
- 12 × 3 = 36
- 1 + 1 = 2 decimal places → **0.36**

**Estimate to check:** 4.9 × 2.1 is about 5 × 2 = 10, and the answer is 10.29 ✅
? 0.4 × 0.2 = | 0.8 | *0.08 | 8
? 2.5 × 4 = | *10 | 1.0 | 100
? 3.1 × 1.1 = | 3.31 | *3.41 | 34.1

@ divide-decimals | Decimals | Dividing with decimals
**A decimal ÷ a whole number:** divide like normal and put the point straight up.
- 7.2 ÷ 3 = **2.4**

**Dividing by a decimal:** move both points the same number of places so you divide by a whole number.
- 1.5 ÷ 0.5 → 15 ÷ 5 = **3**
- 4 ÷ 0.2 → 40 ÷ 2 = **20**
? 8.4 ÷ 4 = | *2.1 | 21 | 0.21
? 6 ÷ 0.3 = | 2 | *20 | 0.2
? 0.9 ÷ 0.03 = | 3 | *30 | 0.3

@ mult-multi | Multiplying | Multiplying multi-digit numbers
Multiply by the ones, then by the tens (put a 0 to hold the place), then add.

**342 × 26**
- 342 × 6 = 2,052
- 342 × 20 = 6,840
- 2,052 + 6,840 = **8,892**
? 125 × 12 = | 1,250 | *1,500 | 1,400
? 48 × 25 = | *1,200 | 1,000 | 960
? 203 × 31 = | 6,093 | *6,293 | 6,903

@ divide-2digit | Dividing | Dividing by two-digit numbers
Estimate how many times the divisor fits, using rounded numbers.

**744 ÷ 24**
- 24 goes into 74 about **3** times: 3 × 24 = 72, and 74 − 72 = 2
- Bring down the 4 → 24. 24 ÷ 24 = **1**
- The answer is **31**. Check: 31 × 24 = 744 ✅
? 528 ÷ 12 = | 42 | *44 | 46
? 900 ÷ 36 = | *25 | 30 | 24
? 1,000 ÷ 40 = | 2.5 | *25 | 250

@ multiply-fractions | Fractions | Multiplying fractions
Multiply **top × top** and **bottom × bottom**.

- 2/3 × 4/5 = 8/15
- 1/2 × 6 = 6/2 = **3** ("half of 6")
- "of" means **times**: 3/4 of 20 = 15

Multiplying by a fraction less than 1 makes a number **smaller**.
? 1/3 × 3/4 = | 4/7 | *1/4 | 3/7
> 1 × 3 = 3 and 3 × 4 = 12, so 3/12, which simplifies to 1/4.
? 2/5 of 30 = | 6 | *12 | 15
? 3/4 × 8 = | *6 | 24/32 | 2

@ divide-fractions | Fractions | Dividing with unit fractions
**How many 1/4s are in 3?** Each whole has 4 fourths → 3 ÷ 1/4 = **12**

**1/2 ÷ 3:** share half a pizza among 3 people → each gets **1/6**

A trick: dividing by a fraction is the same as multiplying by it **flipped** (its reciprocal): 3 ÷ 1/4 = 3 × 4 = 12
? 2 ÷ 1/3 = | 2/3 | *6 | 1/6
? 1/4 ÷ 2 = | 1/2 | *1/8 | 2/4
? How many 1/2-cup servings are in 5 cups? | 2.5 | *10 | 5

@ mixed-numbers | Fractions | Mixed numbers and improper fractions
- **Improper fraction:** the top is as big as the bottom or bigger, like 7/4
- **Mixed number:** a whole number and a fraction, like 1 3/4

**7/4 → mixed:** 7 ÷ 4 = 1 R 3 → **1 3/4**
**2 1/3 → improper:** 2 × 3 + 1 = 7 → **7/3**

A fraction is a division: 3/4 = 3 ÷ 4 = 0.75
? 11/5 as a mixed number | 1 1/5 | *2 1/5 | 5 1/2
? 3 2/5 as an improper fraction | 32/5 | *17/5 | 15/5
? 5 ÷ 8 as a fraction | 8/5 | *5/8 | 1 3/8

@ simplify | Fractions | Simplest form
Divide the top and the bottom by the **same number** — the biggest one you can (the greatest common factor).

- 6/8 → ÷ 2 → **3/4**
- 12/18 → ÷ 6 → **2/3**

A fraction is in **simplest form** when only 1 divides both the top and the bottom.
? 10/15 in simplest form | 5/10 | *2/3 | 1/3
? 8/12 in simplest form | 4/8 | *2/3 | 3/4
? Is 7/9 in simplest form? | *yes | no

@ volume | Measuring | Volume of boxes
**Volume** is how much space something takes up, measured in **cubic units** (units³).

A box (rectangular prism): **V = length × width × height**
- 4 × 3 × 2 = **24 cubic units**

Two boxes stuck together: find each volume and **add** them.
? A box is 5 × 2 × 3. Its volume is … | 10 | *30 | 25
? A cube has edges of 4 cm. Its volume is … | 12 cm³ | 16 cm³ | *64 cm³
? A box has volume 60, length 5 and width 4. Its height is … | *3 | 15 | 12

@ coordinates | Graphing | The coordinate plane
Two number lines cross at the **origin (0, 0)**.
- **x-axis:** across →
- **y-axis:** up ↑

To find the point (3, 5): go **3 across**, then **5 up**. "Walk before you climb!"
? From (0, 0), the point (2, 6) is … | 6 across and 2 up | *2 across and 6 up | 8 across
? The origin is … | (1, 1) | *(0, 0) | (0, 1)
? A point on the x-axis always has y = | 1 | *0 | x

@ patterns-tables | Patterns | Two patterns side by side
Rule A: add 3, starting at 0 → 0, 3, 6, 9, 12
Rule B: add 6, starting at 0 → 0, 6, 12, 18, 24

Each B number is **2 times** the A number. The pairs (0, 0), (3, 6), (6, 12) … can be graphed as points.
? Rule A: add 2 → 0, 2, 4, 6. Rule B: add 8 → 0, 8, 16, 24. Each B number is how many times the A number? | 2 | *4 | 6
? Rule "add 5", starting at 0. What is the 4th number? | 20 | *15 | 25
> 0, 5, 10, 15 — the 4th number is 15.
? The pairs (1, 3), (2, 6), (3, 9): the rule from the first number to the second is … | add 2 | *multiply by 3 | add 3

@ expressions | Numbers | Writing expressions
Write and read expressions with **parentheses**.
- "Add 8 and 7, then multiply by 2" → **2 × (8 + 7)**
- 3 × (18 + 932) is **3 times as big** as 18 + 932 — no need to work it out!

Brackets [ ] and braces { } work like parentheses: do the inside first.
? "Subtract 4 from 10, then divide by 3" | 4 − 10 ÷ 3 | *(10 − 4) ÷ 3 | 10 − 4 ÷ 3
? 5 × [2 + (6 − 3)] = | *25 | 35 | 13
? Compared with 95 + 5, the expression 4 × (95 + 5) is … | 4 more | *4 times as big | the same

@ convert-measures | Measuring | Converting measurements
Change units within the same system:
- Metric: 1 km = 1,000 m, 1 m = 100 cm, 1 cm = 10 mm, 1 L = 1,000 mL
- Customary: 1 mile = 5,280 ft, 1 gallon = 4 quarts, 1 quart = 2 pints, 1 pint = 2 cups

Big unit → small unit: **multiply**. Small unit → big unit: **divide**.
- 250 cm = 2.5 m
- 3 gallons = 12 quarts
? 3.5 km = ☐ m | 350 | *3,500 | 35,000
? 48 ounces = ☐ pounds (16 oz = 1 lb) | *3 | 4 | 32
? 2 quarts = ☐ cups | 4 | *8 | 6

@ shapes-hierarchy | Shapes | Sorting shapes by their properties
Shapes belong to **families**. Every member has the family's properties.

- All **squares** are rectangles **and** rhombuses.
- All **rectangles** are parallelograms.
- **Parallelogram:** 2 pairs of parallel sides.
- **Triangles by sides:** equilateral (all sides equal), isosceles (2 equal), scalene (none equal).
? Is every rectangle a square? | yes | *no
? Is every square a parallelogram? | *yes | no
? A triangle with sides 5, 5 and 8 is … | equilateral | *isosceles | scalene

@ word-fractions | Word problems | Fraction word problems
"Mia ran 2 1/2 miles on Monday and 1 3/4 miles on Tuesday. How far in all?"
- 2 1/2 = 2 2/4
- 2 2/4 + 1 3/4 = 3 5/4 = **4 1/4 miles**

"3/4 of the 24 kids like pizza. How many?" → 24 ÷ 4 × 3 = **18**
? Half of half a pie is … | 1 pie | *1/4 of a pie | 1/2 a pie
? 5 − 1 1/3 = | 4 1/3 | *3 2/3 | 3 1/3
? 2/3 of 15 kids wear glasses. How many? | 5 | *10 | 12
`;
