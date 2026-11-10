/** ➗ More kindergarten math (format: ../mathLessonsParse.ts; the right choice is starred). */
export const M_K = `
@ count-objects | Counting | Count each thing once
Touch each thing as you count it, and say one number for each one.
The **last number** you say tells **how many**.

🍎🍎🍎🍎 → 1, 2, 3, **4**. There are 4 apples.
? How many? ⭐⭐⭐ | *3 | 2 | 4
? How many? 🐶🐶🐶🐶🐶 | *5 | 4 | 6
? You count 1, 2, 3, 4, 5, 6. How many are there? | *6 | 1 | 5

@ count-back | Counting | Counting back from 10
Counting back goes down by one: **10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0!** 🚀
? What comes next? 10, 9, 8, … | *7 | 9 | 6
? What comes next? 5, 4, 3, … | *2 | 4 | 1
? Counting back from 3: 3, 2, 1, … | *0 | 4 | 2

@ before-after | Counting | Numbers before and after
The number **after** is one more. The number **before** is one less.

- Before 5 is **4**. After 5 is **6**.
? What number comes after 7? | *8 | 6 | 9
? What number comes before 4? | *3 | 5 | 2
? What number comes after 9? | *10 | 8 | 11

@ count-50 | Counting | Counting to 50
After a number ending in 9, start the next ten: 29, **30**, 31 … 39, **40**, 41 … 49, **50**.
? What comes after 29? | *30 | 20 | 39
? What comes after 39? | *40 | 30 | 31
? 44, 45, 46, … | *47 | 48 | 56

@ count-100-ones | Counting | Counting to 100 by ones
Every number has a **tens** part and a **ones** part. After 99 comes **100**!
? What comes after 69? | *70 | 60 | 80
? What comes after 99? | *100 | 90 | 98
? 81, 82, 83, … | *84 | 85 | 93

@ which-bigger | Comparing | Which number is bigger?
Count up: the number you say **later** is bigger.

- 8 is bigger than 5 because you say 8 later.
? Which is bigger? | *9 | 6
? Which is bigger? | *10 | 7
? Which is smaller? | *2 | 5

@ plus-sign | Adding | The plus sign
The **plus sign (+)** means put together. 2 + 1 means 2 and 1 more.

🍪🍪 + 🍪 = 🍪🍪🍪
? What does + mean? | *put together | take away | is the same as
? 2 + 1 = | *3 | 1 | 2
? 🐱 + 🐱🐱 = how many cats? | *3 | 2 | 4

@ minus-sign | Subtracting | The minus sign
The **minus sign (−)** means take away. 4 − 1 means 4 take away 1.

🎈🎈🎈🎈 pop one → 🎈🎈🎈
? What does − mean? | *take away | put together | is the same as
? 4 − 1 = | *3 | 5 | 2
? 3 − 2 = | *1 | 5 | 2

@ add-within-5 | Adding | Adding within 5
Hold up fingers on each hand, then count them all.
? 2 + 2 = | *4 | 3 | 5
? 1 + 3 = | *4 | 2 | 5
? 3 + 2 = | *5 | 4 | 6
? 4 + 1 = | *5 | 3 | 4

@ sub-within-5 | Subtracting | Subtracting within 5
Start with all of them, take some away, and count what's left.
? 5 − 2 = | *3 | 2 | 4
? 4 − 3 = | *1 | 2 | 7
? 5 − 5 = | *0 | 5 | 1

@ add-within-10 | Adding | Adding within 10
Start with the **bigger** number and count on: 6 + 3 → 6… **7, 8, 9**.
? 6 + 3 = | *9 | 8 | 10
? 5 + 4 = | *9 | 1 | 8
? 7 + 2 = | *9 | 5 | 8
? 4 + 4 = | *8 | 6 | 9

@ sub-within-10 | Subtracting | Subtracting within 10
Count back: 9 − 2 → 9… **8, 7**. The answer is 7.
? 9 − 2 = | *7 | 6 | 8
? 8 − 3 = | *5 | 6 | 4
? 10 − 4 = | *6 | 5 | 7

@ doubles-k | Adding | Doubles up to 5 + 5
A **double** adds a number to itself.

- 1 + 1 = 2, 2 + 2 = 4, 3 + 3 = 6, 4 + 4 = 8, 5 + 5 = 10
? 3 + 3 = | *6 | 5 | 7
? 5 + 5 = | *10 | 9 | 11
? 2 + 2 = | *4 | 3 | 22

@ ten-frame | Counting | Ten frames
A **ten frame** has 2 rows of 5 boxes. A full ten frame is **10**.

🔴🔴🔴🔴🔴
🔴🔴⚪⚪⚪  → 7 filled, 3 empty
? A ten frame has 7 dots. How many empty boxes? | *3 | 7 | 4
? A full top row is how many? | *5 | 10 | 4
? A ten frame with every box filled shows … | *10 | 5 | 9

@ fingers-five | Counting | Fives and fingers
One hand has **5** fingers. Two hands have **10**. 5 and some more: 5 + 2 = **7**.
? One full hand and 3 more fingers is … | *8 | 3 | 7
? Two full hands is … | *10 | 5 | 2
? One full hand and 1 more finger is … | *6 | 5 | 4

@ take-zero | Subtracting | Taking away nothing, taking away all
- Take away **0** → nothing changes: 6 − 0 = **6**
- Take away **all** → none left: 6 − 6 = **0**
? 7 − 0 = | *7 | 0 | 6
? 4 − 4 = | *0 | 4 | 8
? 9 − 9 = | *0 | 9 | 1

@ count-sides | Shapes | Counting sides and corners
- Triangle: **3** sides, 3 corners
- Square and rectangle: **4** sides, 4 corners
- Circle: **no** sides or corners
? How many sides does a triangle have? | *3 | 4 | 0
? How many corners does a square have? | *4 | 3 | 5
? Which shape has no corners? | *circle | square | triangle

@ shapes-around | Shapes | Shapes all around us
Look for shapes at home!

- A door is a **rectangle**. A clock is a **circle**. A slice of pizza is like a **triangle**.
? A plate is shaped like a … | *circle | triangle | square
? A ball is shaped like a … | *sphere | cube | cone
? An ice cream cone is shaped like a … | *cone | cube | cylinder

@ big-bigger | Comparing | Big, bigger, biggest
When you compare three things, one is **biggest** and one is **smallest**.

🐭 mouse, 🐶 dog, 🐘 elephant
? Which is biggest? | *elephant | mouse | dog
? Which is smallest? | *mouse | dog | elephant
? A cat is bigger than a … | *mouse | horse | car

@ holds-more | Measuring | Holds more, holds less
A **bathtub** holds more water than a **cup**.
? Which holds more? | *a bucket | a spoon
? Which holds less? | *a cup | a pool
? Which holds more milk? | *a big jug | a small glass

@ times-of-day | Time | Morning, afternoon, evening and night
- **Morning:** wake up, eat breakfast 🌅
- **Afternoon:** after lunch ☀️
- **Night:** dark, bedtime 🌙
? When do you usually eat breakfast? | *morning | night | afternoon
? When do you see the moon and stars? | *night | morning
? Lunch is in the middle of the … | *day | night

@ yesterday-today | Time | Yesterday, today and tomorrow
- **Yesterday** was the day before today.
- **Tomorrow** is the day after today.
? If today is Monday, tomorrow is … | *Tuesday | Sunday | Friday
? If today is Friday, yesterday was … | *Thursday | Saturday | Monday
? The day after today is … | *tomorrow | yesterday

@ picture-graph-k | Data | Reading a picture graph
A **picture graph** uses pictures to show how many.

- 🍎🍎🍎 apples
- 🍌🍌 bananas
? Which fruit has more pictures? | *apples | bananas
? How many bananas? | *2 | 3 | 5
? How many fruits in all? | *5 | 3 | 2

@ count-by-5 | Counting | Counting by fives
Count by fives: **5, 10, 15, 20, 25, 30**. Every hand is 5 fingers!
? 5, 10, 15, … | *20 | 16 | 25
? 20, 25, 30, … | *35 | 31 | 40
? Three hands have how many fingers? | *15 | 10 | 3

@ count-pennies | Money | Counting pennies
A **penny** is worth **1 cent**. Count pennies by ones.
? 4 pennies are worth … | *4 cents | 1 cent | 10 cents
? 7 pennies are worth … | *7 cents | 70 cents | 1 cent
? Which is worth more: 6 pennies or 3 pennies? | *6 pennies | 3 pennies

@ fair-share | Fractions | Sharing fairly
**Fair share** means everyone gets the **same** amount.

- 4 cookies shared by 2 friends → **2 each**.
? 6 grapes shared fairly by 2 kids → each gets … | *3 | 2 | 4
? 4 apples shared fairly by 4 kids → each gets … | *1 | 4 | 2
? Is it fair if one kid gets 3 and one gets 1? | *no | yes

@ left-right | Position | Left and right
Hold up your hands with your thumbs out. Your **left** hand makes an **L**!
? Which hand makes an L shape with your thumb and finger? | *left | right
? In "🐱 🐶", the cat is to the ___ of the dog. | *left | right
? In "🍎 🍌", the banana is to the ___ of the apple. | *right | left

@ same-different | Sorting | Same and different
Things are the **same** if they match. They're **different** if something changed.
? Which one is different? 🔴 🔴 🔵 🔴 | *🔵 | 🔴
? Which pair is the same? | *⭐ ⭐ | ⭐ 🌙
? Which one is different? 🐶 🐶 🐱 | *🐱 | 🐶

@ add-word-k | Adding | Adding stories
Listen for words like **in all**, **altogether** and **more came**. They mean add!
? 3 ducks swim. 2 more come. How many in all? | *5 | 1 | 6
? You have 4 crayons and get 4 more. How many altogether? | *8 | 4 | 0
? 1 bird, then 5 more birds. How many birds? | *6 | 4 | 5

@ sub-word-k | Subtracting | Take-away stories
Listen for **left**, **ate**, **flew away** and **gave away**. They mean subtract!
? 5 frogs. 2 hop away. How many are left? | *3 | 7 | 2
? You have 6 grapes and eat 3. How many are left? | *3 | 9 | 6
? 8 balloons. 1 pops. How many are left? | *7 | 9 | 8
`;
