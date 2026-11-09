# 📚 Learning

A top-level menu: **⌨️ Typing** (see [TYPING.md](TYPING.md)), **🔤 Spelling**, and (parents)
**⚙️ Grades & tokens**. Everything here earns 💎 tokens (see [FUN.md](FUN.md#-tokens)), not Prize Bank stars.

## 🎒 Grades and tokens (parents: 📚 Learning → ⚙️ Grades & tokens)

Each section on this page folds down to its heading — tap it to open or close.

- **Each kid's grade** (Kindergarten–12th). They can practise **any** grade, but only rounds at
  **their grade or higher** earn tokens. Until a parent sets a grade, nothing pays.
- **Tokens per game:** "% right → 💎" levels for a round of 10 (e.g. 80% = 1 💎, 100% = 2 💎, the
  default). The highest level reached pays; the lowest level is the **pass mark**. Add or remove
  levels freely.
- **Rounds a day that can pay** (default 3), so it's practice, not a token farm.
- Parents can play too, just for fun (no tokens).
- Answers are checked on the Family Home Center, not in the browser.

## 🔤 Spelling

Pick a grade (your own is outlined) and press **▶ Start 10 words**. 30 words per grade, from
"cat" and "jump" up to "sesquipedalian"; a round picks 10 at random.

- Each word is **said, used in a sentence, then said again**. Type it and press Enter (or ✓ Check)
  within **90 seconds** — the bar runs down and turns red for the last 15. Time's up = whatever's
  typed counts.
- **🔊 Word**, **🗣️ Sentence**, **📖 Meaning** (also shown on screen) and **🐢 Slowly** say it again.
- After each word: ✅ or ❌ with the right spelling. At the end: the score, tokens, and every word
  (tap 🔊 to hear it).
- Capital letters don't matter; spelling does.

### 🗣️ The voice

Phones, tablets, Windows and Macs speak with their own voice. Screens with none (Chromium on the Pi,
often) use the Family Home Center's voice, which needs one of these installed on it:

    sudo apt install -y libttspico-utils     # Pico — the nicer voice
    sudo apt install -y espeak-ng            # or eSpeak

then restart the Family Home Center. ⚙️ Grades & tokens shows whether it's installed and has a
**🔊 Test the voice** button.

### Adding words

`server/src/services/spellingWords.ts`: one line per word, `word|a sentence using it|what it means`,
under its grade.

## 🔍 Spot the misspellings

A short paragraph made from the grade's spelling sentences, with some of that grade's words spelled
wrong in a believable way: a dropped or doubled letter, ie/ei, a wrong vowel, "f" for "ph" and so on.
Tap every misspelled word, then **Check**. It shows the right spellings, and that answer is then final.
Kindergarten–1st: 2 sentences, 1 to find. Higher grades: up to 5 sentences and 4 to find. A misspelling is
never a real word: it's checked against the spelling lists and, on computers that have one, the dictionary.

## 📝 Grammar

Read a sentence or paragraph and tap every word that's wrong:
- a wrong form ("goed")
- a mix-up ("their" / "there")
- a missing capital
- a word that shouldn't be there ("more taller")

It says how many to find. **Check** shows the fixes and a tip. An item is right only when you tap exactly
the mistakes. K–4 get one sentence with one mistake. 5–6 get two sentences with one mistake. 7–8 get three
with two. 9–12 get three or four with two or three.

There are **400 items per grade**. A few are hand-written (`server/src/services/grammarContent.ts`). The rest
come from sentence patterns filled in from word lists (`server/src/services/grammarGen.ts`). Each pattern
covers a range of grades:
- capitals, plurals, a/an, is/are: K–3
- past tenses, there/their, its/it's, good/well, could have, I/me: 1–7
- fewer, affect/effect, lie/lay, who/whom, "neither … nor", "along with": 5–12
- confusable words like imminent/eminent and criterion/criteria: 9–12

To add a pattern, write a sentence with the mistake as `{wrong|right}` (`{word|}` means the word shouldn't
be there), then `||` and a tip. Write it so every other word in it is correct.

## ➗ Math

10 problems a round, made fresh each time from problem types with random numbers. Every grade has
thousands of different problems (more than 10,000 each when sampled).
- K–2: counting, adding/taking away, place value, money
- 3–5: times tables, division, fractions, decimals, area/volume
- 6: Pre-Algebra (integers, one-step equations, percents, ratios, GCF/LCM)
- 7: Algebra (two-step equations, slope, inequalities, systems)
- 8: Algebra II (quadratics, logs, exponent rules, i, composing functions)
- 9: Geometry (angles, Pythagorean theorem, circles, polygons, volume)
- 10: Trigonometry (special angles, radians, SOH-CAH-TOA, laws of sines/cosines)
- 11: Pre-Calculus (sequences/series, interest, matrices, vectors, combinations)
- 12: Calculus (derivatives, limits, integrals, tangent lines, chain/product rule)

Type a number. Fractions (3/4), mixed numbers (1 1/2) and decimals all count if they're equal.
Answers that need rounding say so. Some problems are tap-a-choice instead (like sin 30°). Check shows
the right answer and a tip, and that answer is then final. Problem types live in
`server/src/services/mathGen.ts`.

## 📖 Lessons: Grammar, Math and 🇺🇸 US History

Read a lesson (a rule, formula or piece of history in plain words, with examples), then take its quiz.
Passing (80% right by default) pays 💎 tokens **once per lesson**, for lessons at the kid's grade or
higher. Kids can read any lesson; younger-grade ones are for practice.

- **📖 Grammar lessons:** 27 lessons, K–12 (capitals, there/their/they're, I/me, who/whom, …).
- **📖 Math lessons:** 28 lessons, K–12 (make a 10, long division, fractions, equations, slope,
  quadratics, the Pythagorean theorem, SOH-CAH-TOA, sequences, derivatives, integrals).
- **🇺🇸 US History:** the Declaration of Independence, the Constitution, the Revolutionary War, the
  Civil War, WWI and WWII. It starts simple for K–2 and adds detail for 3–5 and 6–8. In 9–12 it goes
  piece by piece: Articles I, II, III, IV–VII, the Bill of Rights, the later amendments, federalism,
  Reconstruction, the Gettysburg Address, and more. A lesson's grade is the top of the grades it's
  written for (K–2 lessons are "2nd grade").

**Parents can edit everything.** Open any lesson and tap **✏️ Edit** to change the text, the quiz
(questions, choices, the right answer, an optional "why"), the grade and topic, or its tokens. You can
also **hide** a lesson; it's kept, and untick to show it again. **＋ New lesson** adds your own.
Lessons are never deleted. A later update adds new built-in lessons but never overwrites ones you've
edited.

**Tokens:** 📚 Learning → ⚙️ Grades & tokens → 📖 Lessons sets each subject's usual amount (1 💎;
history 2 💎), the pass mark, and optionally an amount for a single lesson.

Lesson text markup: `## ` heading, `- ` bullet, `1. ` step, `**bold**`, ✅ / ❌ example lines, and a
blank line between paragraphs.

## ⏰ Daily limits (parents: 📚 Learning → ⚙️ Grades & tokens → ⏰ Daily limits)

For each kid, and for each of 🔤 Spelling, 🔍 Spot the misspellings, 📝 Grammar, ➗ Math, the three 📖
lesson sets, ⌨️ Typing and each 🎮 game: **times a day** (rounds, lessons, games) and/or **minutes a
day**. Blank = no limit; 0 = off for the day. Parents have no limits.

- **Whatever's started gets finished.** A round, lesson, typing round or game run that's going when
  the limit is reached carries on to the end, results and 💎 included. Only the *next* one is stopped,
  with "⏰ That's 3 rounds of ➗ Math today — come back tomorrow!" Picking a 💾 saved round back up
  is allowed too, because it was already started.
- **Times** count when something starts: a round, opening a lesson, or a game run. Typing counts
  each finished round.
- **Minutes** count only while the screen is showing it *and* someone has touched it in the last 2
  minutes, so a tab left open doesn't use them up.
- Each page shows what's left today ("⏰ 2 of 3 rounds left today · 12 of 30 minutes left"). The
  settings show what each kid has used today.

## 💾 Auto-save

Nothing is lost if a kid closes the tab, taps something else, or the screen restarts. Their spot is
kept on the server for 3 days, so it works on another screen too.

- **🔤 Spelling, 🔍 Spot the misspellings, 📝 Grammar, ➗ Math:** the page shows **💾 You have a round
  going … ▶ Keep going**, which carries on at the next word or problem. Answers already given stay as
  they were. **↻ Start a new** one replaces it. ✕ Stop keeps it too, so a stray tap there isn't lost.
- **📖 Lessons (grammar, math, history):** going back to the page opens the lesson they were on, at
  the same spot, with their quiz answers ticked. **‹ Back** or finishing the quiz is done with it.
- **⌨️ Typing lessons:** **💾 Lesson N is 40% typed — ▶ Keep going** (or opening that lesson) carries on
  from the same letter with the same speed and accuracy so far. The clock doesn't count the time away.
  The typing games are quick rounds and start fresh.

## Data

New tables only: `learning_grades` (each kid's grade), `learning_results` (every round: grade,
right out of 10, tokens, the words missed), `learning_lessons` (the lessons, built-in and parents'), and
`learning_lessons_done` (every quiz taken), `learning_open_rounds` (practice rounds, kept so they
survive a restart; marked finished, never removed) and `learning_drafts` (💾 each person's saved
spot), and `activity_usage` (⏰ times and seconds per person, activity and day; limits in the
`daily_limits` setting). Settings in `settings.learning_rewards`.
