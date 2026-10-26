# ⌨️ Typing practice

## In the app: 🎵 Fun → ⌨️ Typing

It works on any device with a keyboard. On a tablet, tap the typing area to bring up the on-screen
keyboard. Pick who you are in the profile switcher (top right) to save progress and earn stars.

- **📘 Lessons:** 16 lessons that start at the home row (F and J) and build up through every
  letter, capital letters, numbers and real sentences.
  - An on-screen keyboard lights up the next key in that finger's color and names the finger to use
    ("d: left middle finger").
  - A lesson passes with 90% right plus its speed goal, which grows from 4 to 12 words a minute.
    Passing opens the next lesson.
- **🎈 Balloon Pop:** balloons with words float up; type a word to pop its balloon before it gets
  away. It speeds up as you go, and three escaped balloons end the game. The words come only from
  letters you've already learned.
- **🏁 Race:** your avatar races against a rival.
  - Rivals are an animal (🐢 🐇 🦊 🐆), **Yourself** (a faded copy of you), or anyone else in the
    family, with their avatar.
  - Speed is the rival's own best ("their best"), or a level on the **Easy → Hard** slider
    (5–50 words a minute).
- **🔨 Whack-a-Key:** a mole pops up on a key of the on-screen keyboard; press that key before it
  hides. Only the letters learned so far (at least the home row), so it works from lesson 1. Moles
  get quicker, and from 10 and 25 whacks there are two, then three at once. Three escapes end it.
- **☄️ Meteor Defense:** letters fall toward your planet (your avatar stands on it); type one to zap
  it. After lesson 8 some meteors carry whole words. Three hits break the shield.
- **🐍 Word Snake:** snacks with words sit around a field; type a snack's word and the snake goes and
  eats it and grows. Its tummy empties over time (faster the longer it is); empty ends the game.
- **🛒 Shopping Spree:** your avatar keeps grabbing things off a store shelf, and each one costs
  money. Type words to earn a dollar a letter (+$5 for five words in a row without a slip). Things
  get pricier and the grabbing gets quicker; when there isn't enough money to pay, the trip's over.
  Score = dollars spent. **The money is pretend** — it never touches anyone's bank or stars, and this
  game pays no ⭐.

**Open once all 16 lessons are passed** (a parent can always play) — until then the tab shows 🔒 and
how many lessons are left (the server refuses saving them too):

- **🧱 Tower Builder:** type each word to add a block to your tower. A typo or running out of time
  makes it wobble (less time the taller it gets); three wobbles and it falls. Five good words in a
  row steady it one wobble.
- **📖 Silly Story:** type a funny story a line at a time, starring you and someone else in the
  family. How fast you type decides the ending.
- **🏆 Daily Challenge:** everyone types the same two sentences that day; a family leaderboard shows
  each person's best try (fastest at 80% right or better). Today's leaderboard also shows on the
  Family Board once someone's played. A parent can hide or show it: **Settings → ⌨️ Typing** (or
  Typing → ⭐ Stars). Hiding it keeps everyone's results.

- **⭐ Stars** (parents only): set how many Prize Bank stars each lesson and game pays. Any of them can be 0.
  - A lesson pays once, the first time it's passed.
  - The games pay when someone beats their own best (top score; for Race and Silly Story, a faster
    winning speed). Shopping Spree never pays.
  - The Daily Challenge pays once a day for finishing it at 80% right.
  - "Game rounds that can pay each day" caps how many game rounds (not the Daily Challenge) can earn
    stars per day (default 3).

Progress (lessons passed, best speeds, recent rounds) is kept per person in the database.

## On the Pi's own desktop (optional)

Two free classics run on the Pi's screen and keyboard. They don't save progress in the Family Home
Center or give stars.

```bash
sudo apt install tuxtype     # Tux Typing: a penguin eats fish by typing the letters — great for ages 5–10
sudo apt install klavaro     # Klavaro: step-by-step lessons for older kids and grown-ups
```

Both show up in the Pi's menu under **Education** (or run `tuxtype` / `klavaro`).
