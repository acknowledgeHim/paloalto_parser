# 📚 Learning

A top-level menu: **⌨️ Typing** (see [TYPING.md](TYPING.md)), **🔤 Spelling**, and (parents)
**⚙️ Grades & tokens**. Everything here earns 💎 tokens (see [FUN.md](FUN.md#-tokens)), not Prize Bank stars.

## 🎒 Grades and tokens (parents: 📚 Learning → ⚙️ Grades & tokens)

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

## Data

New tables only: `learning_grades` (each kid's grade) and `learning_results` (every round: grade,
right out of 10, tokens, the words missed). Settings in `settings.learning_rewards`.
