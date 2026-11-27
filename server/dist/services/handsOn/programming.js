/** 🧑‍💻 Hands-on: programming — gets you ready for Certiport IT Specialist (Python, JavaScript, HTML & CSS), Python Institute PCEP and AP Computer Science (format: ../mathLessonsParse.ts; right choice starred). Code goes between \`\`\` lines. */
export const HO_PROGRAMMING = `
@ code-certs | 🧑‍💻 Programming | 🎓 Programming certificates you can earn as a student
You don't need a degree to prove you can code. These are made for students:

## Certiport IT Specialist
Single exams, about 50 minutes each, given at many schools: **Python**, **JavaScript**, **HTML and CSS**, **Java**, **Databases**, **Software Development**, and more. Each one is a real credential you can put on a résumé.

## Python Institute PCEP
**PCEP — Certified Entry-Level Python Programmer.** About 30 questions on Python basics: variables, if/else, loops, lists, functions. Next steps are **PCAP** and up.

## AP Computer Science (high school)
- **AP Computer Science Principles** — how computers, the internet and data work, plus a coding project.
- **AP Computer Science A** — real programming in **Java**.
A good score can earn **college credit**.

## Then what?
Junior developer jobs, coding bootcamps, or a **computer science** degree. Most of all, build things — a **portfolio** of projects on GitHub shows what you can do.

## Where to practice for free
Python comes free on most computers (and on the Raspberry Pi). Try writing the examples in these lessons.
? PCEP is a certificate for … | *entry-level Python programmers | car mechanics | typing speed
? AP Computer Science A uses the language … | *Java | French | HTML only
? A good way to show employers what you can code is … | *a portfolio of projects | a long email | a photo of your computer
? Certiport IT Specialist has exams in … | *Python, JavaScript, HTML and CSS, and more | only Spanish | welding

@ code-think | 🧑‍💻 Programming | Thinking like a programmer: algorithms
An **algorithm** is a list of exact steps that solves a problem. A computer does **exactly** what you say — not what you meant!

## Sequence
Steps happen **in order**. "Put on shoes, then socks" is a bug.

## Break it down (decomposition)
Big problems become small ones. "Make a game" → draw the player → move it with keys → add a goal → keep score.

## Patterns and loops
If you do the same thing again and again, use a **loop**. "Walk forward, turn left" 4 times makes a square.

## Debugging
When the program doesn't do what you want, find the first step where it went wrong. That's **debugging**.

Program the robot below. It does your blocks in order — try to reach the ⭐.
🧪 lab: robot
? An algorithm is … | *an exact list of steps to solve a problem | a type of computer | a math mistake
? Breaking a big problem into small ones is called … | *decomposition | a loop | a bug
? A computer does … | *exactly what you tell it | what you meant | whatever it wants
? Doing the same steps again and again is best done with … | *a loop | more typing | a new computer

@ code-variables | 🧑‍💻 Programming | Variables and printing (Python)
A **variable** is a name for a value — like a labeled box.

\`\`\`
name = "Sam"
age = 11
print("Hi", name)
print("Next year you'll be", age + 1)
\`\`\`

This prints **Hi Sam** and **Next year you'll be 12**.

## Types of values
- **int** — whole numbers: \`7\`, \`-3\`
- **float** — decimals: \`3.14\`
- **str** (string) — text, in quotes: \`"hello"\`
- **bool** — \`True\` or \`False\`

## Rules for names
Letters, numbers and _ only, can't start with a number, no spaces: \`high_score\` ✅, \`high score\` ❌. Python cares about **capitals**: \`Score\` and \`score\` are different.

## Asking the user
\`\`\`
color = input("Favorite color? ")
print("I like", color, "too!")
\`\`\`
\`input\` always gives back a **string**. To do math with it, turn it into a number: \`int(input("Age? "))\`.

## The = sign
In code, \`=\` means **store** (put the value in the box), not "equals". \`score = score + 1\` adds one to the score.
? In Python, "hello" is a … | *string (str) | int | bool
? Which is a good variable name? | *high_score | high score | 2score
? score = score + 1 … | *adds one to score | is always an error | makes score zero
? input() gives back a … | *string | number | picture

@ code-if | 🧑‍💻 Programming | Making decisions: if, elif, else
Programs choose what to do with **if**.

\`\`\`
temp = 85
if temp > 80:
    print("Shorts weather!")
elif temp > 50:
    print("Bring a jacket.")
else:
    print("Coat and hat!")
\`\`\`

## Indentation matters
In Python, the lines **inside** an if are pushed in by **4 spaces**. That's how Python knows which lines belong to it. And don't forget the **colon :** at the end of the if line.

## Comparisons
\`==\` equal (two equals signs!) · \`!=\` not equal · \`<\` \`>\` \`<=\` \`>=\`

## and, or, not
\`\`\`
if age >= 13 and has_permission:
    print("You can join.")
\`\`\`
? To check if x equals 5, write … | *x == 5 | x = 5 | x := 5 only
? How does Python know which lines are inside an if? | *They are indented | they are in capitals | they end in a period
? With temp = 60, the example prints … | *Bring a jacket. | Shorts weather! | Coat and hat!
? An if line ends with … | *a colon | a semicolon | nothing

@ code-loops | 🧑‍💻 Programming | Loops: for and while
Loops repeat code so you don't have to.

## for loops — a set number of times
\`\`\`
for i in range(5):
    print("Lap", i)
\`\`\`
Prints Lap 0, Lap 1, Lap 2, Lap 3, Lap 4. \`range(5)\` counts **0 to 4** — five numbers, starting at 0.

## while loops — until something changes
\`\`\`
fuel = 3
while fuel > 0:
    print("Vroom!")
    fuel = fuel - 1
print("Out of gas")
\`\`\`

## Infinite loops
If the condition never becomes False, the loop never ends. (Press **Ctrl+C** to stop a stuck Python program.) Robots often use a loop that runs forever on purpose: read sensors, decide, move, repeat.

Try the robot again: use 🔁 **Repeat** to solve the stairs with only a few blocks.
🧪 lab: robot
? range(5) counts … | *0, 1, 2, 3, 4 | 1 to 5 | 5 only
? A while loop keeps going … | *as long as its condition is True | exactly 10 times | until you save
? To stop a stuck Python program, press … | *Ctrl+C | the space bar | Enter
? How many times does "for i in range(3):" run? | *3 | 2 | 4

@ code-functions | 🧑‍💻 Programming | Functions: name your steps
A **function** is a named set of steps you can use again. \`print\` and \`input\` are functions. You can make your own with **def**:

\`\`\`
def area(width, height):
    return width * height
print(area(3, 4))
print(area(10, 2))
\`\`\`

Prints **12** and **20**.

## The words
- **Parameters** — the names in the parentheses (width, height)
- **Arguments** — the values you pass in (3, 4)
- **return** — sends the answer back to whoever called it

## Why use them?
- Write it once, use it many times
- Fix a bug in **one place**
- Give a name to an idea: \`turn_left()\` is easier to read than five motor commands
? A function in Python is made with … | *def | func | make
? return … | *sends an answer back from the function | prints a newline | ends the program
? In area(3, 4), the 3 and 4 are … | *arguments | functions | loops
? A good reason to use functions is … | *fix a bug in one place and reuse the code | to make code longer | computers like them

@ code-lists | 🧑‍💻 Programming | Lists: many values in one name
\`\`\`
pets = ["dog", "cat", "fish"]
print(pets[0])
pets.append("hamster")
print(len(pets))
for p in pets:
    print("I love my", p)
\`\`\`

## Counting from 0
The **first** item is at **index 0**: \`pets[0]\` is "dog", \`pets[2]\` is "fish". Asking for \`pets[10]\` gives an **IndexError** — there's nothing there.

## Handy list tools
- \`append(x)\` — add to the end
- \`len(list)\` — how many items
- \`x in list\` — is it there? (True or False)
- \`sort()\` — put in order

## Strings act like lists of letters
\`"robot"[0]\` is **"r"**, and \`len("robot")\` is 5.
? In pets = ["dog", "cat", "fish"], pets[1] is … | *"cat" | "dog" | "fish"
? len(["a", "b", "c"]) is … | *3 | 2 | 4
? append adds an item … | *to the end of the list | to the start | nowhere
? Asking for an index that isn't there gives … | *an IndexError | the last item | zero

@ code-debug | 🧑‍💻 Programming | Bugs and how to fix them
Every programmer writes bugs. Good programmers are good at **finding** them.

## Three kinds of bugs
- **Syntax error** — the code isn't written right, so it won't run at all: a missing colon, a missing quote or parenthesis. Python points to the line.
- **Runtime error** — it starts, then crashes: dividing by zero, a misspelled variable name (\`NameError\`), a list index that's too big.
- **Logic error** — it runs but gives the **wrong answer**. The hardest kind. Example: \`average = a + b / 2\` should be \`(a + b) / 2\`.

## How to find them
1. **Read the error message** — the last line says what kind of error; it shows the line number.
2. **Print** values along the way to see where they go wrong.
3. Change **one thing** at a time and test again.
4. **Rubber-duck debugging** — explain your code out loud, line by line, to a rubber duck (or a pet). You'll often hear the bug yourself.

## Good habits
Save often, use **version control** (git) to keep old working versions, and write **comments** (lines starting with #) to explain tricky parts.
? A missing colon after an if is a … | *syntax error | logic error | hardware error
? A program that runs but gives the wrong answer has a … | *logic error | syntax error | virus
? average = a + b / 2 should be … | *(a + b) / 2 | a + (b / 2) | a / b + 2
? Explaining your code out loud to find a bug is called … | *rubber-duck debugging | yelling | compiling

@ code-web | 🧑‍💻 Programming | Making web pages: HTML, CSS and JavaScript
Every web page uses three languages:
- **HTML** — the **content** and structure (headings, paragraphs, pictures, buttons)
- **CSS** — the **look** (colors, fonts, layout)
- **JavaScript** — the **behavior** (what happens when you click)

## HTML tags
\`\`\`
<h1>My Robot Club</h1>
<p>We meet on <b>Fridays</b>.</p>
<img src="robot.png" alt="Our robot">
<button id="go">Click me</button>
\`\`\`
Most tags come in pairs: an **opening** tag \`<p>\` and a **closing** tag \`</p>\`. The **alt** text describes a picture for people who can't see it.

## CSS
\`\`\`
h1 { color: navy; font-size: 40px; }
\`\`\`

## JavaScript
\`\`\`
document.getElementById("go").onclick = function () {
  alert("Beep boop!");
};
\`\`\`

## Try it
Save HTML in a file ending in **.html** and open it in a web browser. Right-click any page and choose **View page source** to see how it's made.
? Which language sets a page's colors and fonts? | *CSS | HTML | Python
? A closing paragraph tag looks like … | *</p> | <p> | <p/close>
? What makes a button do something when clicked? | *JavaScript | CSS | the alt text
? alt text on a picture is for … | *describing it to people who can't see it | making it bigger | a secret password
`;
