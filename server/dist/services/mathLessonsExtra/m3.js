/** ➗ More 3rd grade math (format: ../mathLessonsParse.ts; the right choice is starred). */
export const M_3 = `
@ times-2-5-10 | Multiplying | Multiplying by 2, 5 and 10
- ×2 is a **double**: 2 × 8 = 16
- ×5 ends in **0 or 5**: 5 × 7 = 35
- ×10 puts a **0** on the end: 10 × 6 = 60
? 2 × 9 = | *18 | 11 | 16
? 5 × 6 = | *30 | 35 | 11
? 10 × 8 = | *80 | 18 | 108

@ times-3-4 | Multiplying | Multiplying by 3 and 4
- ×3: double it, then add one more group: 3 × 6 = 12 + 6 = **18**
- ×4: double, then double again: 4 × 7 → 14 → **28**
? 3 × 7 = | *21 | 24 | 10
? 4 × 6 = | *24 | 20 | 28
? 4 × 8 = | *32 | 36 | 24

@ times-6-7-8 | Multiplying | Multiplying by 6, 7 and 8
Break a hard fact into easy ones.

- 6 × 7 = (5 × 7) + (1 × 7) = 35 + 7 = **42**
- 8 × 7 = double 4 × 7 → 28 + 28 = **56**
? 6 × 8 = | *48 | 42 | 54
? 7 × 7 = | *49 | 47 | 56
? 8 × 6 = | *48 | 46 | 56
? 7 × 8 = | *56 | 54 | 63

@ nines-trick | Multiplying | The nines trick
For 9 × a number: the tens digit is **one less** than the number, and the two digits add to **9**.

- 9 × 6 → tens digit 5, ones digit 4 → **54**
? 9 × 4 = | *36 | 32 | 45
? 9 × 7 = | *63 | 56 | 72
? 9 × 9 = | *81 | 99 | 72

@ times-0-1 | Multiplying | Multiplying by 0 and 1
- Any number × **0** = **0** (0 groups of anything is nothing)
- Any number × **1** = **the same number**
? 0 × 25 = | *0 | 25 | 1
? 1 × 13 = | *13 | 1 | 14
? 7 × 0 = | *0 | 7 | 70

@ division-facts | Dividing | Division facts
Use a times fact you know: 56 ÷ 8 = ? → 8 × **7** = 56, so the answer is **7**.
? 42 ÷ 6 = | *7 | 6 | 8
? 36 ÷ 4 = | *9 | 8 | 6
? 63 ÷ 9 = | *7 | 6 | 8
? 40 ÷ 5 = | *8 | 9 | 35

@ mult-stories | Word problems | Multiplication word problems
Look for **equal groups**: "each," "every," "per."

- 6 packs with 4 juice boxes **each** → 6 × 4 = **24**
? 5 shelves hold 8 books each. How many books? | *40 | 13 | 45
? A spider has 8 legs. How many legs do 3 spiders have? | *24 | 11 | 32
? Tickets cost $7 each. How much for 4 tickets? | *$28 | $11 | $24

@ div-stories | Word problems | Division word problems
Division **shares** equally or makes **equal groups**.

- 24 cookies shared by 6 kids → 24 ÷ 6 = **4 each**
? 30 crayons in 5 equal boxes. How many in each box? | *6 | 25 | 35
? 18 kids make teams of 3. How many teams? | *6 | 15 | 21
? 45 stickers shared by 9 friends. How many each? | *5 | 4 | 36

@ array-multiply | Multiplying | Multiplying with arrays
An **array** has equal rows. Rows × columns = total.

- 4 rows of 6 → 4 × 6 = **24**
? 3 rows of 9 chairs → how many chairs? | *27 | 12 | 39
? An array with 5 rows and 5 columns has … | *25 | 10 | 55
? 7 rows of 2 → | *14 | 9 | 72

@ three-factors | Multiplying | Grouping three factors
You can multiply three numbers **in any grouping**. Find an easy pair first!

- 2 × 7 × 5 → 2 × 5 = 10, then 10 × 7 = **70**
? 5 × 3 × 2 = | *30 | 10 | 25
? 2 × 9 × 5 = | *90 | 16 | 45
? 4 × 2 × 5 = | *40 | 11 | 20

@ estimate-round | Estimating | Estimating with rounding
Round each number, then add or subtract to check if an answer makes sense.

- 389 + 214 ≈ 400 + 200 = **600**
? 312 + 495 is about … | *800 | 700 | 900
? 708 − 289 is about … | *400 | 500 | 300
? Is 487 + 302 = 589 reasonable? (≈ 500 + 300) | *no | yes

@ sub-two-trades | Subtracting | Subtracting with two trades
Sometimes you trade twice — once for ones, once for tens.

- 532 − 278: 12 − 8 = 4; 12 − 7 = 5; 4 − 2 = 2 → **254**
? 532 − 278 = | *254 | 354 | 266
? 421 − 156 = | *265 | 375 | 335
? 600 − 247 = | *353 | 447 | 363

@ add-or-sub-3 | Word problems | Choosing the operation
- **Add**: total, in all, combined
- **Subtract**: left, difference, how many more
- **Multiply**: groups of, each
- **Divide**: share equally, split into groups
? 8 bags with 6 marbles each. Total marbles? | *multiply | add | divide
? 56 pages, read 7 each day. How many days? | *divide | multiply | subtract
? A school has 312 boys and 298 girls. How many kids? | *add | subtract | multiply

@ odd-even-mult | Patterns | Even and odd products
- even × any number = **even**
- odd × odd = **odd**
? 7 × 5 is … | *odd | even
? 4 × 9 is … | *even | odd
? 6 × 6 is … | *even | odd

@ fraction-of-group | Fractions | Fractions of a group
A fraction can name part of a **group**.

- 3 of 4 balloons are red → **3/4** are red
? 2 of 5 apples are green. What fraction is green? | *2/5 | 3/5 | 5/2
? 1 of 6 cars is blue. What fraction is blue? | *1/6 | 6/1 | 5/6
? 4 of 8 kids wear hats. What fraction wear hats? | *4/8 | 8/4 | 4/4

@ whole-fractions | Fractions | Whole numbers as fractions
- When top and bottom match, it's **1 whole**: 4/4 = 1
- A whole number over 1: 3/1 = **3**
? 6/6 = | *1 | 6 | 0
? 5/1 = | *5 | 1 | 1/5
? 8/4 = | *2 | 4 | 32

@ fraction-names | Fractions | Numerator and denominator
- The **denominator** (bottom) tells how many **equal parts** make a whole.
- The **numerator** (top) tells how many parts we **have**.
? In 3/8, the denominator is … | *8 | 3 | 11
? In 5/6, the numerator is … | *5 | 6 | 1
? A pizza cut into 8 equal slices; you eat 3. What fraction did you eat? | *3/8 | 8/3 | 5/8

@ same-top | Fractions | Same top, different bottom
When the numerators match, the fraction with the **smaller denominator** is bigger (its pieces are bigger).

- 1/3 > 1/8
? Which is bigger? | *2/3 | 2/5
? Which is bigger? | *1/4 | 1/10
? Which is smaller? | *3/8 | 3/4

@ start-end-time | Time | Starting and ending times
Count forward to find when something **ends**, or back to find when it **started**.

- Starts 2:15, lasts 40 minutes → ends **2:55**
? Starts 3:10, lasts 25 minutes. Ends at … | *3:35 | 3:25 | 3:45
? Ends 5:00, lasted 30 minutes. Started at … | *4:30 | 5:30 | 4:00
? Starts 9:45, lasts 30 minutes. Ends at … | *10:15 | 9:75 | 10:45

@ half-quarter-inch | Measuring | Measuring to the half and quarter inch
Each inch on a ruler is split into halves and quarters.

- A line ending halfway between 3 and 4 is **3½ inches**
? A line ends halfway between 5 and 6 inches. It is … | *5½ in | 5 in | 6½ in
? How many quarter inches make 1 inch? | *4 | 2 | 8
? Two quarter inches equal … | *½ inch | 2 inches | ¼ inch

@ line-plot-halves | Data | Line plots with halves
A line plot shows data with **X**s above a number line.

- Ribbon lengths: 2, 2½, 2½, 3 → two Xs above 2½
? If 3 Xs are above 4½, how many items measured 4½? | *3 | 4½ | 1
? A line plot is good for showing … | *how often each measurement happens | colors
? Data 1, 1½, 1½, 2, 1½: which length is most common? | *1½ | 1 | 2

@ scaled-bar | Data | Scaled bar graphs
On a **scaled bar graph**, each grid line can stand for 2, 5, 10 or more.

- If each line is 5 and a bar reaches the 4th line → **20**
? Each line means 10. A bar reaches the 3rd line. Value? | *30 | 3 | 13
? Each line means 2. A bar is halfway between 4 and 6. Value? | *5 | 4 | 6
? Each line means 5. Bar A is at 25, Bar B at 15. Difference? | *10 | 40 | 2

@ missing-side | Area and perimeter | Finding a missing side
Perimeter = all the sides added. Subtract the sides you know to find the missing one.

- Perimeter 20, sides 6, 4, 6, ? → 20 − 16 = **4**
? A rectangle has perimeter 18 and length 5. The width is … | *4 | 13 | 9
? A square's perimeter is 24. Each side is … | *6 | 4 | 12
? Area 24, one side 6. The other side is … | *4 | 18 | 30

@ same-area | Area and perimeter | Same area, different perimeter
Rectangles can have the **same area** but **different perimeters**.

- 1 × 12, 2 × 6, 3 × 4 all have area **12**; perimeters 26, 16, 14
? A 2 × 8 rectangle has area … | *16 | 20 | 10
? A 4 × 4 square has perimeter … | *16 | 8 | 12
? A 1 × 16 rectangle has perimeter … | *34 | 16 | 17

@ equal-area-parts | Fractions | Shapes cut into equal parts
Each equal part of a shape is a **unit fraction** of the whole area.

- A rectangle cut into 6 equal parts → each part is **1/6**
? A shape cut into 4 equal parts — each part is … | *1/4 | 4 | 1/3
? How many 1/3 parts make the whole? | *3 | 1 | 6
? If parts are NOT equal, can each be called 1/4? | *no | yes

@ add-money-3 | Money | Adding money
Line up the **decimal points**, then add like whole numbers.

- $2.45 + $1.30 = **$3.75**
? $1.25 + $2.50 = | *$3.75 | $3.30 | $4.75
? $4.10 + $0.85 = | *$4.95 | $4.85 | $12.50
? $5.00 − $1.75 = | *$3.25 | $4.25 | $6.75

@ read-thousands | Place value | Numbers to 10,000
- 4,326 = **4 thousands, 3 hundreds, 2 tens, 6 ones**
- Read it: "four thousand, three hundred twenty-six"
? In 7,482, what is the value of the 4? | *400 | 4 | 4,000
? 3 thousands and 5 ones is … | *3,005 | 3,500 | 35
? "Two thousand sixty" is … | *2,060 | 2,600 | 260

@ compensation | Mental math | Adding in your head: borrow and pay back
Make one number friendly, then fix it.

- 298 + 135 → 300 + 135 = 435, then − 2 = **433**
? 199 + 46 = | *245 | 246 | 244
? 398 + 207 = | *605 | 607 | 595
? 52 − 19 = (think 52 − 20 + 1) | *33 | 31 | 34
`;
