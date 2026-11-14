/** ➗ More 4th grade math (format: ../mathLessonsParse.ts; the right choice is starred). */
export const M_4 = `
@ times-10-100 | Multiplying | Multiplying by 10, 100 and 1,000
Each ×10 moves every digit **one place left** (add a zero for whole numbers).

- 46 × 10 = 460; 46 × 100 = 4,600; 46 × 1,000 = 46,000
? 73 × 100 = | *7,300 | 730 | 73,000
? 8 × 1,000 = | *8,000 | 800 | 80,000
? 250 × 10 = | *2,500 | 25,000 | 250

@ tens-times-tens | Multiplying | Multiplying tens by tens
Multiply the front digits, then add **all** the zeros.

- 30 × 40 → 3 × 4 = 12, two zeros → **1,200**
? 20 × 60 = | *1,200 | 120 | 12,000
? 50 × 70 = | *3,500 | 350 | 35,000
? 40 × 50 = | *2,000 | 200 | 20,000

@ area-model | Multiplying | The area model
Split each number by place value and multiply each piece.

- 23 × 14 = (20 × 10) + (20 × 4) + (3 × 10) + (3 × 4) = 200 + 80 + 30 + 12 = **322**
? 12 × 13 = | *156 | 136 | 166
? 21 × 15 = | *315 | 305 | 36
? 34 × 12 = | *408 | 368 | 418

@ estimate-products | Estimating | Estimating products
Round each factor to its biggest place, then multiply.

- 48 × 31 ≈ 50 × 30 = **1,500**
? 62 × 19 is about … | *1,200 | 120 | 1,800
? 395 × 4 is about … | *1,600 | 1,200 | 160
? Is 51 × 48 = 448 reasonable? (≈ 50 × 50) | *no | yes

@ divide-tens | Dividing | Dividing tens and hundreds
Use a basic fact, then add the zeros back.

- 2,400 ÷ 6 → 24 ÷ 6 = 4 → **400**
? 350 ÷ 7 = | *50 | 5 | 500
? 3,600 ÷ 9 = | *400 | 40 | 4,000
? 480 ÷ 8 = | *60 | 6 | 600

@ check-division | Dividing | Checking division
Multiply the answer by the divisor, then **add the remainder**. You should get the starting number.

- 47 ÷ 5 = 9 R2 → 9 × 5 + 2 = **47** ✅
? To check 83 ÷ 4 = 20 R3, compute … | *20 × 4 + 3 | 20 + 4 + 3 | 83 × 4
? Is 58 ÷ 6 = 9 R4 right? | *yes | no
? Is 75 ÷ 8 = 9 R5 right? | *no | yes

@ remainder-sense | Word problems | What to do with the remainder
Read the question: sometimes you **round up**, sometimes you **drop** the remainder, sometimes the remainder **is** the answer.

- 26 kids, 4 per car → 6 R2 → you need **7** cars
? 30 people, 8 per table. How many tables are needed? | *4 | 3 | 3 R6
? $25, toys cost $6. How many toys can you buy? | *4 | 5 | 19
? 50 cookies into bags of 6. How many cookies are left over? | *2 | 8 | 6

@ divisibility | Factors | Divisibility rules
- **2:** ends in 0, 2, 4, 6, 8
- **3:** the digits add to a multiple of 3
- **5:** ends in 0 or 5
- **9:** the digits add to a multiple of 9
- **10:** ends in 0
? Is 471 divisible by 3? (4 + 7 + 1 = 12) | *yes | no
? Which is divisible by 5? | *345 | 344 | 343
? Is 1,234 divisible by 9? | *no | yes

@ prime-composite | Factors | Prime or composite?
- **Prime:** exactly 2 factors (1 and itself): 2, 3, 5, 7, 11, 13…
- **Composite:** more than 2 factors: 4, 6, 8, 9…
- **1** is neither!
? Is 17 prime or composite? | *prime | composite
? Is 21 prime or composite? | *composite | prime
? Which number is neither prime nor composite? | *1 | 2 | 0

@ compare-big | Place value | Comparing big numbers
Line up the places. Compare from the **left**.

- 452,817 vs 452,871 → same until tens: 1 < 7 → 452,817 **<** 452,871
? Which is greater? | *603,120 | 601,320
? Which is less? | *89,999 | 90,001
? 1,000,000 ___ 999,999 | *> | < | =

@ expanded-big | Place value | Expanded form of big numbers
**Expanded form** writes a number as the sum of each digit's value. Skip the zeros.

- 305,240 = 300,000 + 5,000 + 200 + 40
? 70,000 + 4,000 + 6 = | *74,006 | 74,600 | 7,406
? 528,000 in expanded form is … | *500,000 + 20,000 + 8,000 | 500 + 20 + 8 | 5,000 + 2,000 + 800
? What is the value of 6 in 462,000? | *60,000 | 6,000 | 600,000

@ benchmark-half | Fractions | Comparing to one half
A fraction is more than ½ if its top is **more than half** of its bottom.

- 5/8 > ½ because 5 is more than 4 (half of 8)
? Is 3/7 more or less than ½? | *less | more
? Is 6/10 more or less than ½? | *more | less
? Which is greater? | *5/9 | 2/6

@ make-equal-fractions | Fractions | Making equal fractions
Multiply (or divide) the top and bottom by the **same** number.

- 2/3 = 4/6 = 8/12
? 1/4 = ?/12 | *3 | 4 | 1
? 3/5 = 6/? | *10 | 8 | 5
? 8/12 = 2/? | *3 | 4 | 6

@ sub-fractions-like | Fractions | Subtracting fractions with the same bottom
Subtract the **tops**. Keep the bottom.

- 7/8 − 3/8 = **4/8**
? 5/6 − 1/6 = | *4/6 | 4/0 | 6/6
? 9/10 − 4/10 = | *5/10 | 5/0 | 13/10
? 1 − 2/5 = | *3/5 | 1/5 | 2/5

@ add-mixed | Fractions | Adding mixed numbers
Add the whole numbers, add the fractions, and regroup if the fraction is more than 1.

- 2 ¾ + 1 ¾ = 3 6/4 = 3 + 1 2/4 = **4 2/4**
? 1 1/5 + 2 3/5 = | *3 4/5 | 3 4/10 | 4 4/5
? 3 1/3 + 1 1/3 = | *4 2/3 | 4 2/6 | 5 2/3
? 2 3/4 + 1 2/4 = | *4 1/4 | 3 5/8 | 3 1/4

@ break-fractions | Fractions | Breaking fractions apart
A fraction can be written as a **sum** of smaller fractions.

- 5/8 = 1/8 + 1/8 + 1/8 + 1/8 + 1/8 = 2/8 + 3/8
? 3/5 = 1/5 + ? | *2/5 | 1/5 | 3/10
? Which equals 4/6? | *1/6 + 3/6 | 2/3 + 2/3 | 4/12
? 1 3/4 = 1 + ? | *3/4 | 1/4 | 7/4

@ decimals-money | Decimals | Decimals and money
Dollars and cents are **decimals**: $3.25 = 3 dollars and 25 hundredths of a dollar.
? What is 0.25 of a dollar? | *a quarter (25¢) | a dime | 25 dollars
? $4.07 is … | *4 dollars and 7 cents | 4 dollars and 70 cents | 47 cents
? 0.10 of a dollar is … | *a dime | a penny | a dollar

@ tenths-plus-hundredths | Decimals | Adding tenths and hundredths
Change tenths to hundredths first: 3/10 = **30/100**.

- 3/10 + 4/100 = 30/100 + 4/100 = **34/100** = 0.34
? 2/10 + 5/100 = | *25/100 | 7/100 | 7/110
? 6/10 + 3/100 = | *63/100 | 9/100 | 36/100
? 4/10 written in hundredths is … | *40/100 | 4/100 | 400/100

@ compare-decimals-4 | Decimals | Comparing decimals
Compare **tenths** first, then **hundredths**. 0.5 is the same as 0.50.

- 0.6 > 0.45 (6 tenths beats 4 tenths)
? Which is bigger? | *0.7 | 0.65
? Which is smaller? | *0.09 | 0.1
? 0.30 ___ 0.3 | *= | > | <

@ time-units-4 | Measuring | Hours, minutes and seconds
- 1 minute = **60** seconds
- 1 hour = **60** minutes
- 1 day = **24** hours
? 3 minutes = ___ seconds | *180 | 30 | 300
? 2 hours = ___ minutes | *120 | 60 | 200
? 2 days = ___ hours | *48 | 24 | 60

@ metric-length | Measuring | Kilometers, meters and centimeters
- 1 km = **1,000** m
- 1 m = **100** cm
- 1 cm = **10** mm
? 4 km = ___ m | *4,000 | 400 | 40
? 3 m = ___ cm | *300 | 30 | 3,000
? 5 cm = ___ mm | *50 | 500 | 5

@ pounds-ounces | Measuring | Pounds and ounces
To change pounds to ounces, **multiply by 16**. A loaf of bread is about 1 pound.

- 1 pound (lb) = **16** ounces (oz)
? 2 lb = ___ oz | *32 | 20 | 16
? 3 lb 4 oz = ___ oz | *52 | 34 | 48
? Which is heavier? | *1 pound | 12 ounces

@ cups-gallons | Measuring | Cups, pints, quarts and gallons
- 2 cups = 1 pint
- 2 pints = 1 quart
- 4 quarts = 1 gallon
? 1 gallon = ___ quarts | *4 | 2 | 8
? 1 quart = ___ cups | *4 | 2 | 8
? 3 pints = ___ cups | *6 | 3 | 12

@ angle-types | Geometry | Acute, right, obtuse and straight angles
- **Acute:** less than 90°
- **Right:** exactly 90° (square corner)
- **Obtuse:** between 90° and 180°
- **Straight:** 180°
? A 45° angle is … | *acute | obtuse | right
? A 120° angle is … | *obtuse | acute | straight
? The corner of a book is … | *right | acute | obtuse

@ protractor | Geometry | Using a protractor
1. Put the center hole on the angle's **vertex**.
2. Line up one ray with **0°**.
3. Read where the other ray crosses — using the scale that started at 0.
? Where does the protractor's center go? | *on the vertex | on the end of a ray | anywhere
? An angle measured from 0 to 70 on the scale is … | *70° | 110° | 0°
? If you read the wrong scale for a 60° angle you might get … | *120° | 60° | 90°

@ adding-angles | Geometry | Adding angles
Angles side by side **add up**. A straight line is 180°; a full turn is 360°.

- 35° + 55° = **90°**
? Two angles of 40° and 50° make … | *90° | 10° | 100°
? An angle on a straight line next to 130° is … | *50° | 130° | 230°
? A right angle is split into 25° and ? | *65° | 75° | 155°

@ perpendicular | Geometry | Perpendicular lines
**Perpendicular** lines cross at a **right angle** (90°).
**Parallel** lines never cross.
? The two edges at a square's corner are … | *perpendicular | parallel
? Railroad tracks are … | *parallel | perpendicular
? Perpendicular lines make angles of … | *90° | 45° | 180°

@ times-as-many | Multiplying | Times as many
"**3 times as many**" means multiply.

- Ana has 4 shells. Ben has 3 times as many → 4 × 3 = **12**
? A dog is 5 times as heavy as a 6 kg cat. The dog weighs … | *30 kg | 11 kg | 1 kg
? 35 is 7 times as many as … | *5 | 28 | 42
? Leo ran 2 miles. Mia ran 4 times as far. Mia ran … | *8 miles | 6 miles | 2 miles

@ money-decimals-4 | Money | Money word problems with decimals
Line up the **decimal points** when you add or subtract money. To find change, count up from the price.

? A book costs $8.75 and a pen $1.50. Total? | *$10.25 | $9.25 | $10.75
? You pay $20 for a $13.40 game. Change? | *$6.60 | $7.60 | $6.40
? 3 snacks at $1.25 each cost … | *$3.75 | $3.25 | $4.25

@ elapsed-noon | Time | Elapsed time across noon
Break it into parts: up to **12:00**, then the rest.

- 10:30 a.m. → 1:15 p.m. = 1 h 30 min + 1 h 15 min = **2 h 45 min**
? 11:00 a.m. to 2:00 p.m. is … | *3 hours | 9 hours | 13 hours
? 9:45 a.m. to 12:15 p.m. is … | *2 h 30 min | 3 h 30 min | 2 h 70 min
? A trip leaves at 10:20 a.m. and takes 3 hours. It arrives at … | *1:20 p.m. | 13:20 a.m. | 1:20 a.m.
`;
