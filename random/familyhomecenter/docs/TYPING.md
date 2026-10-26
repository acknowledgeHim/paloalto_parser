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
- **⭐ Stars** (parents only): set how many Prize Bank stars each lesson pays. Any of them can be 0.
  - A lesson pays once, the first time it's passed.
  - The games pay when someone beats their own best (Balloon Pop score, or a race won at a new best
    speed).
  - "Game rounds that can pay each day" caps how many game rounds can earn stars per day (default 3).

Progress (lessons passed, best speeds, recent rounds) is kept per person in the database.

## On the Pi's own desktop (optional)

Two free classics run on the Pi's screen and keyboard. They don't save progress in the Family Home
Center or give stars.

```bash
sudo apt install tuxtype     # Tux Typing: a penguin eats fish by typing the letters — great for ages 5–10
sudo apt install klavaro     # Klavaro: step-by-step lessons for older kids and grown-ups
```

Both show up in the Pi's menu under **Education** (or run `tuxtype` / `klavaro`).
