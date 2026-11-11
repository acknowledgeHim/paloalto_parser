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
- **🎁 Daily bonus** (default off): extra 💎 once a day for a kid who uses up all of the day's paying
  rounds in every ticked subject (🔤 Spelling, 📝 Grammar and ➗ Math to start; 🔍 Spot the
  misspellings can be ticked too). A ticked subject set to pay nothing is left out. The pages show
  which are ✅ done so far; the round that finishes the last one pays it. Only a parent can change
  any of these settings.
- Parents can play too, just for fun (no tokens).
- Answers are checked on the Family Home Center, not in the browser.

## 🔤 Spelling

Pick a grade (your own is outlined) and press **▶ Start 10 words**. About 200 words per grade, from
"cat" and "jump" up to "sesquipedalian"; a round picks 10 at random. Each word is used in only one grade, the lowest it fits (lists in `server/src/services/spellingWords.ts` and `spellingMore*.ts`).

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

## 📖 Lessons: Grammar, Math, 🔬 Science and 🇺🇸 US History

Read a lesson (a rule, formula or piece of history in plain words, with examples), then take its quiz.
Passing (80% right by default) pays 💎 tokens for lessons at the kid's grade or higher, **once per
lesson each 🔁 round**. Kids can read and retake any lesson as often as they like; younger-grade ones
are for practice.

**🔁 Rounds.** Once a lesson has paid, retaking it pays nothing until the kid has passed **every**
lesson at their grade in that subject (e.g. all 3rd grade ➗ Math lessons). Then a new round
starts and every lesson pays again, so kids move on to new lessons instead of redoing the easy
ones. A round only counts lessons that have a quiz, pay tokens and aren't hidden. If a parent hides
the last ones left, the round still finishes. The lessons page shows **Round N: X of Y lessons
passed**, and marks each lesson ✅ Passed today, 💎 earned this round, or 💎 N still to earn.
Lessons already paid before this change count as paid in round 1. Parents and kids without a
grade have no rounds. (⌨️ Typing lessons still pay once each, as before.)

**🔁 Repeatable lessons.** In a lesson's ✏️ Edit, a parent can set **Passing pays tokens N times
each round** (1–50; 1 is the usual). A repeatable lesson pays again each time it's passed, up to N
times a round. It counts toward finishing the round after its first pass, and pays N times again
in the next round.

### 📈 Progress (📚 Learning → 📈 Progress)

One kid's learning, by subject. Kids see their own; parents pick any kid. The same thing is on each
kid's profile page (Family Board → tap the kid) as **📚 Learning progress**.

- **Summary:** each lesson subject's 🔁 round bar at their grade, how many of that grade's lessons
  they've ever passed, and how many rounds they've finished.
- **Last 30 days chart** for the chosen subject: tries each day, passed ones vs. not yet. Hover or
  tap and hold a bar to see the day.
- **Every lesson**, by topic and grade: ⬜ not tried / 🟡 tried / ✅ passed, how many tries, best score,
  last try. Tap a lesson to see **each try**: when, the score, passed or not, tokens, and which round.
- **🔤 Spelling:** rounds a day (chart), % right lately, each grade's rounds and score, **words to
  practise** (missed most often, and what they wrote instead), and every round with its missed words.
- **⌨️ Typing:** lessons passed of 16 and best speed, each typing lesson tried/passed with every
  try, and the typing games played (how often, best, tokens).
- **🎯 Other practice** (misspellings, grammar, math rounds): % right in the last 30 rounds and a
  table of every round.

### 📬 In the weekly email

The Sunday 6pm weekly report each parent gets for each kid (Settings → Weekly report) has a
**📚 Learning** part. It lists every lesson passed that week (subject, grade, tokens, tries), the ones
tried but not passed yet with their best score, each subject's 🔁 round, any round finished,
🔤 spelling (rounds, words right, tokens, and the words to practise), other practice rounds, and
⌨️ typing (each lesson passed or tried with speed, typing games played, lessons passed so far). A week with no learning leaves it
out. **Send now** in Settings → Weekly report shows it straight away.

- **📖 Grammar lessons:** 50+ for every grade, K–12 — about a school year each: letters and
  sentences for K–2; nouns, verbs, punctuation and spelling rules for 3–5; clauses, usage and
  essays for 6–8; rhetoric, style, research and college writing for 9–12.
- **📖 Math lessons:** 50+ for every grade, K–12: counting and adding (K–2), times tables,
  fractions and decimals (3–5), ratios, integers and equations (6–7), algebra 2 (8), geometry (9),
  trigonometry (10), precalculus (11) and calculus (12).
- **🔬 Science lessons:** about 20 for every grade, K–12, grouped by branch: ⚡ Physics,
  🧪 Chemistry, 🧬 Biology and 🌍 Earth & space. K–8 mix all four; 9th grade is mostly biology,
  10th chemistry, 11th physics, and 12th earth & space plus advanced topics (biotech, relativity,
  nuclear power). Many lessons have a 🧪 lab built in (see below). The set lives in
  `server/src/services/scienceLessons/` (one file per grade).
- Quiz choices come in a mixed-up order, so the right answer isn't always first. The big sets
  live in `server/src/services/grammarLessons/` and `mathLessonsExtra/` (one file per grade).
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
history and science 2 💎), the pass mark, and optionally an amount for a single lesson.

Lesson text markup: `## ` heading, `- ` bullet, `1. ` step, `**bold**`, ✅ / ❌ example lines, and a
blank line between paragraphs. A line `🧪 lab: pendulum` puts that science lab in the lesson (any
subject; the ✏️ Edit hint lists the lab names).

### 🧪 Science labs (🔬 Science → 🧪 All the labs, or the menu's 🧪 Science labs)

30 hands-on simulations kids can play with: sliders, buttons and live readouts, each with a few
🎯 **Try this** goals that tick off as they're reached.

- **⚡ Physics:** push & friction, pendulum, projectile, falling (with/without air), lever, spring,
  float or sink, mixing hot and cold water, circuits (series/parallel), sound (plays the tone) and
  light & color.
- **🧪 Chemistry:** states of matter, build an atom, pH (a simplified model for kids), dissolving,
  balancing equations, gas laws and flame colors.
- **🧬 Biology:** plant growth, cell parts, Punnett squares, predator & prey, peppered moths,
  reaction time and heart rate.
- **🌍 Earth & space:** moon phases, seasons, the rock cycle, weight on other planets and
  earthquake waves.

Labs are practice: they don't pay 💎 and don't count toward daily limits. Tokens come from passing
the lesson's quiz. Code: `client/src/labs/` (`catalog.ts` lists them).

## ⏰ Daily limits (parents: 📚 Learning → ⚙️ Grades & tokens → ⏰ Daily limits)

For each kid, and for each of 🔤 Spelling, 🔍 Spot the misspellings, 📝 Grammar, ➗ Math, the four 📖
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
`learning_lessons_done` (every quiz taken), `learning_lesson_rounds` (when each 🔁 round finished), `learning_open_rounds` (practice rounds, kept so they
survive a restart; marked finished, never removed) and `learning_drafts` (💾 each person's saved
spot), `learning_bonus_paid` (🎁 the bonus paid, one row per kid per day) and `activity_usage` (⏰ times and seconds per person, activity and day; limits in the
`daily_limits` setting). Settings in `settings.learning_rewards` and `settings.learning_bonus`.
