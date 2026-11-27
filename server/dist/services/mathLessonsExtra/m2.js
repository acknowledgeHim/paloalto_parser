/** ➗ More 2nd grade math (format: ../mathLessonsParse.ts; the right choice is starred). */
export const M_2 = `
@ add-by-place | Adding | Adding tens and ones
Add the **tens**, add the **ones**, then put them together.

- 36 + 22 → 30 + 20 = 50 and 6 + 2 = 8 → **58**
? 41 + 35 = | *76 | 66 | 75
? 23 + 54 = | *77 | 78 | 31
? 60 + 27 = | *87 | 33 | 67

@ sub-by-place | Subtracting | Subtracting tens and ones
Take away the **ones** from the ones and the **tens** from the tens.

- 68 − 25 → 6 tens − 2 tens = 4 tens; 8 − 5 = 3 → **43**
? 79 − 34 = | *45 | 55 | 44
? 56 − 21 = | *35 | 77 | 36
? 98 − 50 = | *48 | 58 | 93

@ sub-trade | Subtracting | Subtracting with a trade
Not enough ones? **Trade** one ten for ten ones.

- 52 − 27 → trade: 4 tens and 12 ones. 12 − 7 = 5; 4 − 2 = 2 → **25**
? 52 − 27 = | *25 | 35 | 29
? 63 − 18 = | *45 | 55 | 41
? 40 − 13 = | *27 | 33 | 37

@ check-sub | Subtracting | Checking subtraction with addition
Add your answer to the number you took away. You should get the number you started with.

- 72 − 38 = 34 → check: 34 + 38 = **72** ✅
? To check 50 − 16 = 34, you add … | *34 + 16 | 50 + 16 | 34 + 50
? Is 45 − 19 = 26 right? (26 + 19 = 45) | *yes | no
? Is 81 − 27 = 64 right? | *no | yes

@ count-1000 | Counting | Counting to 1,000
After 199 comes **200**. After 999 comes **1,000**!
? What comes after 299? | *300 | 290 | 2,100
? What comes after 509? | *510 | 600 | 5,010
? What comes after 999? | *1,000 | 9,910 | 100

@ skip-100 | Counting | Skip counting by 5s, 10s and 100s
- by 5s: 105, 110, 115…
- by 10s: 340, 350, 360…
- by 100s: 200, 300, 400…
? 120, 125, 130, … | *135 | 131 | 140
? 470, 480, 490, … | *500 | 491 | 4,100
? 300, 400, 500, … | *600 | 510 | 501

@ minus-10-100 | Mental math | Taking away 10 or 100 in your head
Take away 10 → the **tens** digit goes down 1. Take away 100 → the **hundreds** digit goes down 1.

- 458 − 10 = **448**; 458 − 100 = **358**
? 365 − 10 = | *355 | 265 | 364
? 742 − 100 = | *642 | 732 | 741
? 805 − 10 = | *795 | 705 | 804

@ make-100 | Mental math | Pairs that make 100
The tens make 90 and the ones make 10.

- 64 + **36** = 100 (60 + 30 = 90; 4 + 6 = 10)
? 73 + ___ = 100 | *27 | 37 | 33
? 45 + ___ = 100 | *55 | 65 | 45
? 90 + ___ = 100 | *10 | 0 | 20

@ add-nines | Mental math | Adding 9 and 19: make a ten
Adding 9? Add **10** and take away 1. Adding 19? Add **20** and take away 1.

- 46 + 19 → 46 + 20 = 66, − 1 = **65**
? 37 + 9 = | *46 | 47 | 36
? 54 + 19 = | *73 | 74 | 63
? 28 + 29 = | *57 | 58 | 47

@ compare-stories | Word problems | How much longer? How much more?
To compare two amounts, **subtract** the smaller from the bigger.

- A rope is 42 inches. A string is 15 inches. The rope is **27 inches longer**.
? A red ribbon is 30 cm and a blue one is 18 cm. How much longer is the red one? | *12 cm | 48 cm | 18 cm
? Max has 55 cards and Zoe has 70. How many more does Zoe have? | *15 | 125 | 25
? A dog weighs 34 pounds and a cat weighs 9. How much heavier is the dog? | *25 pounds | 43 pounds | 35 pounds

@ equal-groups | Multiplying | Equal groups and adding again
Equal groups can be added over and over.

- 3 bags with 5 apples each → 5 + 5 + 5 = **15**
? 4 groups of 2 = | *8 | 6 | 42
? 2 + 2 + 2 + 2 + 2 = | *10 | 8 | 12
? 3 boxes with 10 crayons each → how many crayons? | *30 | 13 | 20

@ count-coins-2 | Money | Counting coins: biggest first
Start with the coins worth the most, then count on.

- quarter, dime, dime, nickel, penny → 25, 35, 45, 50, **51¢**
? 2 quarters and 1 dime = | *60¢ | 35¢ | 51¢
? 3 dimes, 2 nickels and 1 penny = | *41¢ | 36¢ | 6¢
? 1 quarter, 1 dime and 3 pennies = | *38¢ | 29¢ | 5¢

@ making-change | Money | How much change?
Count **up** from the price to the money you paid.

- Pay $1.00 (100¢) for a 65¢ toy → 65 + 35 = 100 → **35¢** change
? You pay $1 for an 80¢ snack. Change? | *20¢ | 80¢ | 18¢
? You pay 50¢ for a 35¢ pencil. Change? | *15¢ | 25¢ | 85¢
? You pay $1 for a 45¢ sticker. Change? | *55¢ | 45¢ | 65¢

@ money-stories | Money | Money word problems
Add to find a **total cost**. Subtract to find what's **left**.
? A ball costs 40¢ and a yo-yo 35¢. How much for both? | *75¢ | 5¢ | 65¢
? You have $5 and spend $2. How much is left? | *$3 | $7 | $2
? Juice is 60¢. You have 45¢. How much more do you need? | *15¢ | 25¢ | 105¢

@ quarter-hours | Time | Quarter past and quarter to
An hour has **60** minutes. A quarter hour is **15** minutes.

- 3:15 → **quarter past** 3
- 3:45 → **quarter to** 4
? 6:15 is … | *quarter past 6 | quarter to 6 | half past 6
? Quarter to 9 is … | *8:45 | 9:45 | 9:15
? How many minutes are in an hour? | *60 | 100 | 30

@ hours-later | Time | How long? Hours later
Count the **hours** from start to finish.

- Start 2:00, end 5:00 → **3 hours**
? A movie starts at 4:00 and ends at 6:00. How long is it? | *2 hours | 10 hours | 4 hours
? School starts at 8:00. Lunch is 4 hours later. What time is lunch? | *12:00 | 11:00 | 4:00
? Practice is 1:00 to 4:00. How long? | *3 hours | 5 hours | 4 hours

@ estimate-length | Measuring | Estimating length
Use things you know: a paper clip is about **1 inch**, a door is about **2 meters** tall, a fingertip is about **1 centimeter** wide.
? About how long is a pencil? | *7 inches | 7 feet | 7 yards
? About how tall is a door? | *2 meters | 2 centimeters | 20 meters
? About how long is a car? | *4 meters | 4 centimeters | 40 meters

@ using-ruler | Measuring | Using a ruler
Line up the end of the object with the **0** mark, then read the number at the other end.
? A crayon starts at 0 and ends at 4. How long is it? | *4 inches | 5 inches | 0 inches
? A leaf starts at 2 and ends at 7. How long is it? | *5 cm | 7 cm | 9 cm
? Where should you start measuring? | *at the 0 mark | at the 1 mark | anywhere

@ length-diff | Measuring | Comparing measured lengths
Measure both things in the **same unit**, then subtract.
? A table is 48 inches long. A desk is 30 inches. Difference? | *18 inches | 78 inches | 12 inches
? A worm is 9 cm and a snail trail is 15 cm. How much longer is the trail? | *6 cm | 24 cm | 9 cm
? A board is 72 inches. You cut off 20 inches. How long is it now? | *52 inches | 92 inches | 62 inches

@ tally-chart | Data | Tally charts
Tally marks are grouped in **fives**: four lines, then a fifth line drawn **across** them. Count the groups by 5s, then count the extra lines by 1s.

- 2 groups of five and 2 more lines → 5, 10, 11, **12**
? A group of five tally marks looks like … | *four lines with one across | five dots | one line
? 1 group of five and 3 more lines shows … | *8 | 5 | 3
? 3 groups of five show … | *15 | 3 | 10

@ solid-faces | Shapes | Faces, edges and corners of solids
- A **cube** has 6 square faces, 12 edges, 8 corners.
- A **cylinder** has 2 flat circle faces.
- A **sphere** has no flat faces.
? How many faces does a cube have? | *6 | 4 | 8
? Which solid has two circle faces? | *cylinder | cube | sphere
? How many corners does a cube have? | *8 | 6 | 12

@ rows-columns | Shapes | Splitting a rectangle into squares
A rectangle can be split into **rows** and **columns** of equal squares.

- 3 rows of 4 squares → **12** squares
? 2 rows of 5 squares → how many squares? | *10 | 7 | 25
? 4 rows of 3 squares → how many squares? | *12 | 7 | 43
? Rows go … | *across | up and down

@ equal-shares | Fractions | Equal shares can look different
Two halves of the same square can be different shapes — rectangles **or** triangles — and still be equal.
? Can a square be cut into halves that are triangles? | *yes | no
? 4 equal shares of a pizza are called … | *fourths (quarters) | halves | thirds
? If a cake is cut into 3 equal shares, each is … | *a third | a half | a fourth

@ jumps-number-line | Adding | Jumping on a number line
To add, jump **right**. To subtract, jump **left**. Big jumps of 10 make it fast.

- 34 + 25: 34 → 44 → 54 → 59
? Start at 20. Jump right 10, then 5. Where are you? | *35 | 15 | 30
? Start at 60. Jump left 10 two times. Where are you? | *40 | 80 | 50
? 47 + 30 on a number line ends at … | *77 | 50 | 17

@ missing-numbers-2 | Equations | Missing numbers in equations
Use the other operation to find the missing number.

- ___ − 15 = 30 → 30 + 15 = **45**
? 25 + ___ = 60 | *35 | 85 | 45
? ___ − 12 = 40 | *52 | 28 | 42
? 70 − ___ = 45 | *25 | 115 | 35

@ zero-placeholder | Place value | Zero holds a place
A **0** shows there are no tens or no ones in that place.

- 305 = 3 hundreds, **0 tens**, 5 ones
? 407 has how many tens? | *0 | 4 | 7
? 6 hundreds and 8 ones is … | *608 | 68 | 680
? 5 hundreds and 2 tens is … | *520 | 52 | 502

@ even-odd-sums | Even and odd | Adding even and odd numbers
- even + even = **even**
- odd + odd = **even**
- even + odd = **odd**
? 3 + 5 is … | *even | odd
? 4 + 7 is … | *odd | even
? 6 + 8 is … | *even | odd

@ word-problem-keys | Word problems | Add or subtract?
- **Add** when things are joined or put together.
- **Subtract** when things are taken away or compared.
? 28 kids are on a bus. 9 get off. Add or subtract? | *subtract | add
? You picked 14 apples and 18 pears. Fruits in all — add or subtract? | *add | subtract
? 28 kids on a bus, 9 get off. How many are left? | *19 | 37 | 21

@ hundreds-add | Adding | Adding hundreds
Adding hundreds is like adding ones — just say "hundred."

- 3 hundred + 4 hundred = 7 hundred → 300 + 400 = **700**
? 200 + 500 = | *700 | 250 | 7,000
? 600 + 300 = | *900 | 630 | 800
? 400 + 450 = | *850 | 800 | 490
`;
