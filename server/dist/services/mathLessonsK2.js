/** ➗ More math lessons: Kindergarten, 1st and 2nd grade. Format: see mathLessonsParse.ts. */
export const MATH_K = `
@ count-20 | Counting | Counting to 20
Say the numbers in order. Each number is **one more** than the one before.

1, 2, 3, 4, 5, 6, 7, 8, 9, **10**, 11, 12, 13, 14, 15, 16, 17, 18, 19, **20**

- Touch each thing **once** as you count it.
- The **last number** you say tells **how many** there are.
- Counting back: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1 … blast off! 🚀
? What comes after 12? | 11 | *13 | 14
? What comes after 19? | 18 | 10 | *20
? Count back: 7, 6, 5, … what is next? | *4 | 6 | 8
? You count 🍎🍎🍎🍎🍎 and the last number you say is 5. How many apples? | 4 | *5 | 6

@ count-by-10 | Counting | Counting by tens to 100
Counting by **tens** is a fast way to count big groups. Each jump adds 10.

10, 20, 30, 40, 50, 60, 70, 80, 90, **100**

- Ten fingers and ten more fingers are **20** fingers.
- 100 is ten groups of ten.
? What comes after 40 when you count by tens? | 41 | *50 | 60
? 70, 80, __, 100 | *90 | 85 | 81
? How many tens make 100? | *10 | 100 | 1
? 10, 20, 30 — how many tens did we count? | 30 | *3 | 10

@ teen-numbers | Numbers | Teen numbers: ten and some more
The numbers 11 to 19 are **ten and some more**.

- 13 is **10 and 3**
- 16 is **10 and 6**
- 19 is **10 and 9**

🔟 and ●●● make 13.
? 10 and 4 is … | *14 | 41 | 104
? 18 is 10 and … | 10 | *8 | 18
? Which is 10 and 1? | 10 | *11 | 101

@ compare | Numbers | More, fewer, the same
Line the things up **one to one**. The group with some left over has **more**.

●●●●● (5) and ●●● (3): 5 is **more** than 3. 3 is **fewer** (less) than 5.

- If nothing is left over, they are **the same** (equal).
- When you count, bigger numbers come later.
? Which is more: 7 or 4? | 4 | *7 | they are the same
? Which is fewer: 9 or 6? | 9 | *6 | they are the same
? 🐶🐶🐶 and 🐱🐱🐱 — the dogs and cats are … | more dogs | more cats | *the same
? Which number is the biggest? | 8 | 3 | *10

@ one-more-less | Numbers | One more and one less
**One more** is the next number when you count. **One less** is the number just before.

- One more than 6 is **7**.
- One less than 6 is **5**.

5 ← **6** → 7
? One more than 9 is … | 8 | *10 | 11
? One less than 4 is … | *3 | 5 | 2
? One more than 15 is … | 14 | *16 | 17

@ make-5 | Adding | Ways to make 5
There are lots of ways to make **5**.

- 0 + 5 = 5
- 1 + 4 = 5
- 2 + 3 = 5
- 3 + 2 = 5
- 4 + 1 = 5
- 5 + 0 = 5

Hold up 5 fingers and fold some down: the ones up and the ones down always make 5!
? 2 + __ = 5 | 2 | *3 | 4
? 4 + __ = 5 | *1 | 2 | 5
? Which makes 5? | 2 + 2 | *1 + 4 | 3 + 3

@ make-10 | Adding | Ways to make 10
A **ten frame** has 10 boxes. Fill some with red and the rest with blue — together they make **10**.

- 1 + 9, 2 + 8, 3 + 7, 4 + 6, 5 + 5
- …and turned around: 6 + 4, 7 + 3, 8 + 2, 9 + 1

**Ten friends:** 1 & 9, 2 & 8, 3 & 7, 4 & 6, 5 & 5.
? 7 + __ = 10 | 2 | *3 | 4
? 6 + __ = 10 | *4 | 5 | 6
? Which pair makes 10? | 5 + 4 | *8 + 2 | 3 + 6

@ number-bonds | Adding | Parts and the whole
A **whole** can be split into two **parts**.

Whole **6** → parts **4** and **2**

- Put the parts together → the whole (4 + 2 = 6).
- Take one part away → the other part (6 − 4 = 2).
? The whole is 8. One part is 5. The other part is … | 2 | *3 | 13
? The parts are 3 and 3. The whole is … | 3 | *6 | 33
? The whole is 7. One part is 7. The other part is … | *0 | 7 | 1

@ zero-one | Adding | Adding 0 and adding 1
- **Adding 0:** nothing changes. 6 + 0 = **6**
- **Adding 1:** say the next number. 6 + 1 = **7**
- **Taking away 0:** nothing changes. 6 − 0 = **6**
- **Taking away 1:** say the number before. 6 − 1 = **5**
? 9 + 0 = | 10 | *9 | 0
? 4 + 1 = | *5 | 4 | 3
? 8 − 1 = | 9 | *7 | 8
? 3 − 0 = | 0 | 2 | *3

@ story-problems | Word problems | Story problems
Listen to the story. Are things being **put together** (add) or **taken away** (subtract)?

- "3 birds sit in a tree. 2 more come." → put together: 3 + 2 = **5**
- "5 balloons. 1 pops." → take away: 5 − 1 = **4**

Draw it, use your fingers, or use blocks!
? 4 ducks swim. 2 more join them. How many ducks? | 2 | *6 | 5
? There are 6 cookies. You eat 2. How many are left? | *4 | 8 | 3
? 3 red cars and 3 blue cars. How many cars? | 3 | 5 | *6

@ shapes-flat | Shapes | Flat shapes
- ⚪ **Circle:** round, no corners
- 🔺 **Triangle:** 3 sides, 3 corners
- 🟥 **Square:** 4 sides all the same, 4 corners
- **Rectangle:** 4 sides, 4 corners (two long sides and two short sides)
- **Hexagon:** 6 sides, 6 corners (like a honeycomb 🐝)
? How many sides does a triangle have? | 2 | *3 | 4
? Which shape has no corners? | square | *circle | triangle
? A shape with 6 sides is a … | rectangle | *hexagon | triangle

@ shapes-solid | Shapes | Solid shapes
Solid shapes are not flat — you can pick them up.
- **Sphere:** a ball ⚽ — it rolls
- **Cube:** a block or a dice 🎲 — 6 flat square faces
- **Cylinder:** a can 🥫 — it rolls and it stacks
- **Cone:** an ice-cream cone 🍦 or a party hat — it has a point
? A ball is a … | cube | *sphere | cone
? A dice is shaped like a … | *cube | cylinder | sphere
? A soup can is a … | cone | *cylinder | cube

@ position | Shapes | Where is it?
Words that tell where things are:
- **above** / **below** (over / under)
- **beside** (next to)
- **in front of** / **behind**
- **inside** / **outside**

The bird is **above** the tree. The cat is **under** the table.
? The sun is ___ the house. | below | *above | inside
? A fish in a bowl is ___ the bowl. | *inside | above | behind
? The opposite of "in front of" is … | beside | *behind | above

@ measure | Measuring | Longer, shorter, heavier, lighter
Compare two things:
- **Length:** line them up at one end. The one that sticks out is **longer**.
- **Height:** the one that reaches higher is **taller**.
- **Weight:** the one that's harder to lift is **heavier**; the other is **lighter**.
? A pencil and a crayon start at the same line. The pencil sticks out past the crayon. Which is longer? | the crayon | *the pencil | they're the same
? Which is heavier? | a feather | *a rock | a leaf
? Which is taller? | *a giraffe | a cat | a mouse

@ sorting | Data | Sorting and counting groups
**Sort** things into groups that are alike — by color, shape or size — then count each group.

🔴🔵🔴🔴🔵 → red: **3**, blue: **2**. There are **more** red ones.
? 🍎🍌🍎🍎🍌 How many apples? | 2 | *3 | 5
? You sort by color. Which goes in the group with 🔵? | 🔴 | *🔷 | 🟡
? 🐶🐶🐱 Which group has fewer? | the dogs | *the cats | they're the same

@ patterns | Patterns | Patterns
A **pattern** repeats over and over.
- **AB:** 🔴🔵🔴🔵🔴🔵
- **AAB:** 🍎🍎🍌🍎🍎🍌
- **ABC:** ⭐🌙☀️⭐🌙☀️

Find the part that repeats, then say what comes next.
? 🔴🔵🔴🔵🔴 … what's next? | 🔴 | *🔵 | 🟢
? 🍎🍎🍌🍎🍎 … what's next? | *🍌 | 🍎 | 🍊
? clap, stomp, clap, stomp, clap … what's next? | clap | *stomp | jump

@ ordinal | Numbers | First, second, third
Words for **order** in a line:
**1st** first, **2nd** second, **3rd** third, **4th** fourth, **5th** fifth

🐶 🐱 🐰 🐻 → the dog is **first** and the rabbit is **third**.
? 🚗 🚌 🚲 Which is second? | 🚗 | *🚌 | 🚲
? 🍎 🍌 🍇 🍊 Which is fourth? | 🍇 | 🍎 | *🍊
? The first one in line is … | *at the front | at the back | in the middle

@ coins | Money | Coins
- **Penny:** 1 cent
- **Nickel:** 5 cents
- **Dime:** 10 cents (the smallest coin!)
- **Quarter:** 25 cents

A dime is smaller than a nickel but worth **more**.
? How many cents is a penny? | *1 | 5 | 10
? Which coin is worth 10 cents? | nickel | *dime | quarter
? Which is worth more? | a nickel | *a dime | they're the same

@ days | Time | Days of the week
There are **7 days** in a week:
1. Sunday
2. Monday
3. Tuesday
4. Wednesday
5. Thursday
6. Friday
7. Saturday

Saturday and Sunday are the **weekend**.
? How many days are in a week? | 5 | *7 | 10
? What day comes after Monday? | Sunday | *Tuesday | Wednesday
? What day comes before Saturday? | *Friday | Sunday | Thursday
`;
export const MATH_1 = `
@ count-on | Adding | Counting on
Start with the **bigger** number in your head and count on.

**8 + 3:** start at 8 … 9, 10, **11**

- You don't have to start at 1!
- Turn it around: 2 + 9 is the same as 9 + 2 → 9 … 10, **11**
? 7 + 2 = | 8 | *9 | 10
? 3 + 9 = | 11 | *12 | 13
? 6 + 3 = | *9 | 8 | 10
? For 2 + 8, which number do you start at? | 2 | *8 | 10

@ doubles | Adding | Doubles and near doubles
**Doubles** are a number plus itself: 1+1=2, 2+2=4, 3+3=6, 4+4=8, 5+5=10, 6+6=12, 7+7=14, 8+8=16, 9+9=18

**Near doubles:** 6 + 7 is double 6 **plus one** → 12 + 1 = **13**
? 8 + 8 = | 15 | *16 | 18
? 7 + 8 = | 14 | *15 | 16
> Double 7 is 14, and one more is 15.
? 5 + 6 = | 10 | *11 | 12

@ subtract-20 | Subtracting | Subtracting: think addition
To find **13 − 5**, think: **5 + ? = 13**. 5 + 8 = 13, so 13 − 5 = **8**.

You can also count up from the smaller number:
- 12 − 9: 9 … 10, 11, 12 → that's **3** jumps
? 14 − 6 = | 7 | *8 | 9
? 11 − 9 = | *2 | 3 | 20
? 15 − 8 = | *7 | 8 | 6

@ fact-family | Adding and subtracting | Fact families
Three numbers that go together make **four facts**.

**3, 5, 8:**
- 3 + 5 = 8
- 5 + 3 = 8
- 8 − 3 = 5
- 8 − 5 = 3
? Which is in the fact family 4, 6, 10? | 10 − 3 = 7 | *10 − 6 = 4 | 6 − 4 = 2
? 9 + 2 = 11, so 11 − 2 = | *9 | 7 | 13
? 7 + 6 = 13. Which is also true? | 13 − 7 = 7 | *13 − 6 = 7 | 6 − 7 = 13

@ missing | Adding and subtracting | The missing number
A box ☐ stands for the missing number.

**5 + ☐ = 12** → what goes with 5 to make 12? Count up from 5 to 12: **7**

**☐ − 4 = 6** → put the 4 back: 6 + 4 = **10**
? 6 + ☐ = 14 | 7 | *8 | 20
? ☐ − 3 = 9 | 6 | *12 | 11
? 15 − ☐ = 10 | *5 | 10 | 25

@ equal-sign | Adding and subtracting | The equal sign means "the same as"
**=** means both sides are **worth the same**. It doesn't just mean "the answer comes next".

✅ 4 + 3 = 7
✅ 7 = 4 + 3
✅ 5 + 2 = 6 + 1 (both are 7)
❌ 5 + 2 = 8
? Is 6 + 1 = 5 + 2 true? | *yes | no
? 8 = 4 + ☐ | *4 | 12 | 8
? 3 + 4 = ☐ + 5 | 7 | *2 | 1

@ add-three | Adding | Adding three numbers
Add two first, then add the third. Look for a **10** or a **double** to make it easier!

**6 + 4 + 3:** 6 + 4 = 10, then 10 + 3 = **13**
**5 + 2 + 5:** 5 + 5 = 10, then 10 + 2 = **12**
? 7 + 3 + 5 = | 14 | *15 | 16
? 2 + 8 + 4 = | *14 | 13 | 12
? 4 + 4 + 1 = | 8 | *9 | 10

@ compare-symbols | Numbers | Greater than, less than
- **>** means **greater than**: 9 > 4
- **<** means **less than**: 4 < 9
- **=** means **equal**: 6 = 6

🐊 The alligator's mouth opens toward the **bigger** number.

For two-digit numbers, look at the **tens** first: 52 > 39 because 5 tens > 3 tens.
? 34 ☐ 43 | > | *< | =
? 71 ☐ 17 | *> | < | =
? 25 ☐ 25 | > | < | *=
? Which is true? | 60 < 59 | *48 > 46 | 30 > 31

@ count-120 | Numbers | Counting to 120
After 100 we keep going: 101, 102, … 109, **110**, 111, … 119, **120**

- 99 → 100 (ten tens!)
- 109 → 110
- Say 115 as "one hundred fifteen".
? What comes after 109? | 1010 | *110 | 100
? What comes after 99? | 910 | *100 | 98
? 117, 118, 119, __ | 1110 | *120 | 200

@ ten-more | Place value | Ten more, ten less, adding tens
**10 more** → the tens digit goes up by 1: 34 → **44**
**10 less** → the tens digit goes down by 1: 34 → **24**

Adding tens: 30 + 40 is 3 tens + 4 tens = 7 tens = **70**
Taking away tens: 80 − 50 = **30**
? 10 more than 56 is … | 57 | *66 | 46
? 10 less than 90 is … | 89 | *80 | 100
? 40 + 30 = | *70 | 43 | 7
? 60 − 20 = | *40 | 4 | 58

@ add-2digit | Adding | Adding to a two-digit number
Add the **ones** to the ones. Keep the tens.

**42 + 5:** ones 2 + 5 = 7 → **47**

If the ones make 10 or more, you make a new ten:
**38 + 6:** 8 + 6 = 14 → 30 + 14 = **44**
? 23 + 4 = | 63 | *27 | 28
? 46 + 7 = | 52 | *53 | 413
? 59 + 1 = | 50 | 51 | *60

@ time-hour | Time | Time to the hour and half hour
A clock has a **short hand** (the hour) and a **long hand** (the minutes).
- Long hand on **12** → it's **o'clock**. Short hand on 3 → **3:00**.
- Long hand on **6** → it's **half past**. 3:30 is half past 3.

At half past, the short hand is **halfway between** two numbers.
? The long hand is on 12 and the short hand is on 8. What time is it? | 12:00 | *8:00 | 8:30
? 5:30 is called … | 5 o'clock | *half past 5 | half past 6
? At 4:00, where is the long hand? | on the 4 | *on the 12 | on the 6

@ measure-units | Measuring | Measuring length
Measure by laying **same-size** things end to end with **no gaps** and **no overlaps**.

The pencil is **6 paper clips** long.

- Start right at the end of the thing you're measuring.
- Smaller units → you need more of them.
? A book is 8 paper clips long. If you measure it with bigger blocks, you'll need … | more | *fewer | the same number
? The paper clips have gaps between them. The length you get is … | *too small | too big | just right
> Gaps mean you don't count all of the length, so the number comes out too small.
? A ribbon is 5 cubes long and a string is 7 cubes long. Which is longer? | the ribbon | *the string | they're the same

@ tally | Data | Tally marks and picture graphs
**Tally marks** count in fives: four lines with a fifth line across them = **5**.

Two bundles of five and 3 more lines = 5 + 5 + 3 = **13**.

A **picture graph** uses a picture for each thing. Count the pictures in each row to compare.
? One bundle of five and 2 more lines is … | 3 | *7 | 52
? Three bundles of five is … | 3 | 8 | *15
? Favorite fruit: 🍎🍎🍎🍎 and 🍌🍌. How many more kids like apples than bananas? | *2 | 4 | 6

@ halves-fourths | Fractions | Halves and fourths
Cut a shape into **equal** parts.
- 2 equal parts → **halves** (each one is a half)
- 4 equal parts → **fourths** or **quarters**

The parts must be the **same size**!

More equal parts → each part is **smaller**.
? A pizza cut into 4 equal parts. Each part is a … | half | *fourth | third
? Which piece is bigger? | a fourth of a sandwich | *half of the same sandwich
? Two halves make … | a fourth | *a whole | two wholes

@ shape-parts | Shapes | Sides and corners
Shapes are named by their **sides** (straight lines) and **corners**.
- Triangle: 3 sides, 3 corners
- Square and rectangle: 4 sides, 4 corners
- Pentagon: 5 sides
- Hexagon: 6 sides

Color and size don't change the name — a big red triangle and a tiny blue one are both triangles.
? How many corners does a rectangle have? | 3 | *4 | 5
? A shape with 5 sides is a … | hexagon | *pentagon | square
? How many corners does a circle have? | *0 | 1 | 4

@ count-coins | Money | Counting coins
Count the **biggest** coins first, then count on.

Quarter 25¢, dime 10¢, nickel 5¢, penny 1¢

**1 dime, 2 nickels, 3 pennies:** 10 … 15, 20 … 21, 22, **23¢**
? 2 dimes = | 2¢ | 12¢ | *20¢
? 1 dime and 1 nickel = | 11¢ | *15¢ | 6¢
? 3 nickels and 1 penny = | 4¢ | *16¢ | 31¢

@ how-many-more | Word problems | How many more?
"How many more" means **compare** — find the difference.

"Sam has 9 stickers. Ana has 5. How many more does Sam have?"
→ 9 − 5 = **4** (or think 5 + ? = 9)
? Mia read 12 books. Leo read 8. How many more did Mia read? | 20 | *4 | 3
? There are 7 cups and 10 straws. How many more straws than cups? | *3 | 17 | 4
? Jo has 6 shells. She wants 11. How many more does she need? | 4 | *5 | 17

@ skip-count | Numbers | Skip counting by 2s, 5s and 10s
- **2s:** 2, 4, 6, 8, 10, 12 … (pairs of socks 🧦)
- **5s:** 5, 10, 15, 20, 25 … (fingers on hands ✋)
- **10s:** 10, 20, 30, 40 …
? 2, 4, 6, __ | 7 | *8 | 10
? 15, 20, 25, __ | 26 | *30 | 35
? How many fingers on 4 hands? Count by 5s. | 9 | *20 | 45
`;
export const MATH_2 = `
@ hundreds | Place value | Hundreds, tens and ones
A 3-digit number has **hundreds**, **tens** and **ones**.

**352** = 3 hundreds + 5 tens + 2 ones

- 10 ones = 1 ten
- 10 tens = 1 hundred
- In 507, the **0** means there are no tens.
? In 468, the 6 means … | 6 ones | *6 tens | 6 hundreds
? 2 hundreds, 0 tens and 9 ones is … | 29 | *209 | 290
? How many tens are in 100? | *10 | 100 | 1

@ expanded | Place value | Expanded form and number words
**Standard form:** 734
**Expanded form:** 700 + 30 + 4
**Word form:** seven hundred thirty-four
? 500 + 60 + 2 = | 5602 | *562 | 526
? The expanded form of 408 is … | 400 + 80 | *400 + 8 | 40 + 8
? "Two hundred fifteen" is … | 2015 | *215 | 250

@ compare-3 | Place value | Comparing three-digit numbers
Compare the **hundreds** first. If they're the same, compare the **tens**, then the **ones**.

- 642 > 618 (same hundreds; 4 tens > 1 ten)
- 299 < 300 (2 hundreds < 3 hundreds)
? 437 ☐ 473 | > | *< | =
? 805 ☐ 799 | *> | < | =
? Which is biggest? | 619 | 691 | *916

@ mental-10-100 | Adding and subtracting | Adding 10 or 100 in your head
- **+10:** the tens digit goes up 1 → 245 + 10 = **255**
- **+100:** the hundreds digit goes up 1 → 245 + 100 = **345**
- **−10** and **−100** go down the same way.

Careful when a digit is 9: 392 + 10 = **402** (ten tens make a new hundred).
? 523 + 100 = | 533 | *623 | 524
? 478 − 10 = | *468 | 378 | 477
? 195 + 10 = | 196 | 295 | *205

@ add-3digit | Adding and subtracting | Adding three-digit numbers
Line up the places and add the **ones, then the tens, then the hundreds**. Carry when a place makes 10 or more.

**256 + 178**
- Ones: 6 + 8 = 14 → write 4, carry 1 ten
- Tens: 5 + 7 + 1 = 13 → write 3, carry 1 hundred
- Hundreds: 2 + 1 + 1 = 4
- Answer: **434**
? 314 + 225 = | *539 | 549 | 5309
? 168 + 245 = | 303 | *413 | 403
? 499 + 1 = | 4910 | 490 | *500

@ sub-zeros | Adding and subtracting | Subtracting across zeros
**300 − 147:** you can't take 7 from 0, and there are no tens to borrow.
- Borrow from the hundreds: 3 hundreds → 2 hundreds and **10 tens**
- Borrow a ten: 10 tens → 9 tens and **10 ones**
- Now 10 − 7 = 3, 9 − 4 = 5, 2 − 1 = 1 → **153**

**Check:** 153 + 147 = 300 ✅
? 200 − 45 = | 165 | *155 | 245
? 401 − 102 = | *299 | 301 | 309
? To check 500 − 123 = 377, you can … | *add 377 + 123 | subtract 377 − 123 | add 500 + 123

@ arrays | Multiplying | Arrays: rows and columns
An **array** puts things in equal **rows**.

⭐⭐⭐⭐
⭐⭐⭐⭐
⭐⭐⭐⭐

3 rows of 4 → 4 + 4 + 4 = **12**

This gets you ready for multiplying!
? 2 rows of 5 is … | 7 | *10 | 25
? 4 + 4 + 4 + 4 is 4 rows of … | *4 | 16 | 8
? 3 rows of 3 = | 6 | *9 | 33

@ money | Money | Dollars and cents
- **100¢ = $1.00** (one dollar)
- 4 quarters = $1.00, 10 dimes = $1.00, 20 nickels = $1.00
- Money is written with a **$** and a **dot**: $3.45 is 3 dollars and 45 cents.

**2 quarters + 3 dimes:** 25, 50 … 60, 70, 80 → **80¢**
? 3 quarters = | 30¢ | *75¢ | 53¢
? $2.50 means … | 250 dollars | *2 dollars and 50 cents | 25 cents
? How many dimes make a dollar? | 4 | *10 | 100

@ time-5 | Time | Time to 5 minutes; a.m. and p.m.
The long hand moves **5 minutes** from one number to the next. Count by 5s!

- On the 1 → :05, on the 3 → :15, on the 6 → :30, on the 9 → :45
- **a.m.** = midnight to noon (morning)
- **p.m.** = noon to midnight (afternoon and night)
? The long hand is on the 4. How many minutes past the hour? | 4 | *20 | 40
? The short hand is just past 7 and the long hand is on the 9. What time is it? | 9:07 | *7:45 | 7:09
? Eating breakfast at 7:00 is … | *a.m. | p.m.

@ measure-units | Measuring | Inches, feet, centimeters and meters
- **inch** (in): about as long as a paper clip
- **foot** (ft) = 12 inches — a ruler
- **yard** = 3 feet
- **centimeter** (cm): about as wide as your finger
- **meter** (m) = 100 centimeters — about one big step

Start measuring at the **0** on the ruler.
? How many inches are in a foot? | 10 | *12 | 100
? How many centimeters are in a meter? | 10 | 12 | *100
? Which unit fits the length of a classroom? | inches | centimeters | *meters

@ number-line | Numbers | Number lines
A **number line** has numbers in order with equal spaces.
- Adding → jump to the **right**
- Subtracting → jump to the **left**

**47 + 25:** jump 20 to 67, then 5 more to **72**
? Start at 30 and jump right 15. You land on … | 15 | *45 | 35
? Start at 80 and jump left 20. You land on … | *60 | 100 | 78
? On a number line, the bigger numbers are to the … | left | *right

@ bar-graphs | Data | Bar graphs
A **bar graph** shows how many with bars. Read the number that the top of the bar lines up with.

Pet votes:
- 🐶 Dog: 8
- 🐱 Cat: 5
- 🐟 Fish: 2

The tallest bar shows the **most**. To find how many more, **subtract**: dogs − cats = 8 − 5 = **3**.
? Using the pet votes, how many more votes did cat get than fish? | 2 | *3 | 7
? How many votes were there in all? | 13 | *15 | 8
? Which pet got the fewest votes? | dog | cat | *fish

@ line-plots | Data | Line plots
A **line plot** puts an ✕ above a number line for each thing measured.

The lengths of 7 pencils (inches): 4, 5, 5, 6, 6, 6, 7

- 6 inches has the most ✕s (3 pencils)
- Longest − shortest = 7 − 4 = 3 inches
? How many of those pencils are 5 inches long? | 1 | *2 | 3
? How many pencils are longer than 5 inches? | 3 | *4 | 5
> 6, 6, 6 and 7 — that's 4 pencils.
? What does each ✕ stand for? | *one pencil | one inch | five pencils

@ polygons | Shapes | Polygons and solid shapes
A **polygon** is a flat shape with straight sides.
- 3 sides: **triangle**
- 4 sides: **quadrilateral** (squares, rectangles …)
- 5: **pentagon**, 6: **hexagon**, 8: **octagon** 🛑

A **cube** has 6 faces, 12 edges and 8 vertices (corners).
? A stop sign 🛑 is an … | hexagon | *octagon | pentagon
? A quadrilateral has how many sides? | 3 | *4 | 5
? How many faces does a cube have? | 4 | *6 | 8

@ thirds | Fractions | Halves, thirds and fourths
Equal parts of a whole:
- 2 parts → **halves**
- 3 parts → **thirds**
- 4 parts → **fourths**

**3 thirds** make one whole. **4 fourths** make one whole.

The more pieces, the smaller each piece: a third is smaller than a half.
? A cake cut into 3 equal pieces. Each piece is a … | half | *third | fourth
? How many fourths make a whole? | 2 | 3 | *4
? Which is bigger? | one third | *one half | one fourth

@ two-step | Word problems | Two-step word problems
Some problems need **two steps**. Do one, then use that answer in the next.

"There are 24 kids on a bus. 9 get off, then 6 get on. How many now?"
- Step 1: 24 − 9 = 15
- Step 2: 15 + 6 = **21**
? 30 apples. 12 are eaten, then 5 more are picked. How many now? | 13 | *23 | 47
? Max has 15¢, gets 10¢ more, then spends 8¢. How much now? | *17¢ | 33¢ | 13¢
? A book has 40 pages. You read 15 on Monday and 15 on Tuesday. How many are left? | 25 | *10 | 15

@ fact-strategies | Adding and subtracting | Fast fact tricks
- **Make a 10:** 8 + 5 → 8 + 2 + 3 = 10 + 3 = **13**
- **Doubles + 1:** 7 + 8 = 7 + 7 + 1 = **15**
- **Adding 9:** add 10, then take 1 away → 9 + 6 = 16 − 1 = **15**
- **Turn it around:** 2 + 9 = 9 + 2
? 9 + 7 = | 15 | *16 | 17
? 8 + 6 = | 13 | *14 | 15
? 6 + 7 = | *13 | 12 | 14

@ estimate | Numbers | Estimating
To **estimate**, use friendly numbers close by.
- 48 is close to **50**, and 31 is close to **30**
- 48 + 31 is about 50 + 30 = **80** (the exact answer is 79)

Use an estimate to check that an answer makes sense.
? 29 + 42 is about … | 60 | *70 | 80
? 51 is closest to … | 40 | *50 | 60
? Jo says 39 + 22 = 161. Does that make sense? | yes | *no — it should be about 60

@ add-4 | Adding and subtracting | Adding up to four two-digit numbers
Add the ones of all the numbers, then the tens.

**23 + 14 + 31 + 12**
- Ones: 3 + 4 + 1 + 2 = 10 → write 0, carry 1
- Tens: 2 + 1 + 3 + 1, plus the 1 carried = 8
- **80**

Look for pairs that make a ten: 23 + 17 = 40.
? 10 + 20 + 30 + 40 = | 90 | *100 | 1000
? 15 + 15 + 20 = | 40 | *50 | 35
? 21 + 22 + 23 = | *66 | 63 | 69
`;
