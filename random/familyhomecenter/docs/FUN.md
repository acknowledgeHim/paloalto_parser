# Fun extras

## 👕 Dress up

**Chores ▾ → 👕 Dress up**, or the 👕 link in a kid's Prize Bank column. Kids spend their Prize
Bank ⭐ stars on pieces for their avatar.

- **Pieces:** a hat, glasses, something in their hand, a pet and a bit of magic (sparkles, hearts, flames…), one of each at a time.
- **Trying and buying:** tap a piece to try it on, then **Buy it** to spend the stars. Tap a piece you own to wear it or take it off.
- **Where it shows:** the floor plan, the Prize Bank and the replay.
- **Who can change it:** a kid can only spend their own stars. A parent can do it for anyone, and can **↶ refund** a piece, which gives the stars back.

## 🌗 Day and night on the floor plan

The floor plan follows the time of day: a warm dawn, a pink dusk and a dark night. At night, rooms
that still have jobs left glow with their lights on. Rain, snow, a storm or fog show when the
weather has them.

- **Sunrise and sunset:** taken from the weather. When the weather is turned off, it uses 7am and 7pm.
- **The 🌗 button:** cycles between following the clock, always day (☀️) and always night (🌙).

## ▶️ Replay today

**▶️ Replay today** on any floor plan plays back the day's check-offs in the order they happened.

- **What you see:** everyone walks from job to job, a ✓ pops up as each one is done, and the clock runs through the day. It switches floors to wherever the action is.
- **What's included:** only jobs placed in a room.
- **Stopping:** **⏹ Stop** ends it early.

## 🗳️ What's for dinner? (Meals → 🗳️ Vote)

1. A parent taps **＋ New vote**, then picks the day, the meal and 2–6 choices. A choice can be a recipe or just typed in.
2. Everyone taps their pick, and can change it until the vote closes. The list shows who still has to vote.
3. A parent taps **🏆 Close the vote**. The winner goes on the meal plan, with its recipe. A tie is a coin flip.

The Meals menu shows a red count while a vote is open.

## 📬 Weekly report (Settings → 📬 Weekly report)

Every Sunday at 6pm, each kid's week is emailed to every parent with an email, and to the kid if
they have their own. It covers:

- jobs done each day, with a little bar chart
- what slipped
- stars, money, rewards and prizes earned
- where their stars, Prize Bank money and bank accounts stand

The settings panel has three controls:

- **Turn it off.**
- **See this week's report** in the browser.
- **📬 Send them now.**

It needs email set up on the server (SMTP_HOST, the same as the grocery list).

## 🏠 Who's home

Home and the Family Board show everyone's avatar with where they are: 🏠 home, 🏫 school,
💼 work, ⚽ practice, 🧑‍🤝‍🧑 at a friend's, 🚗 out, ✈️ away or 😴 sleeping.

- **Setting it:** tap yours on the way out (a parent can tap anyone's), pick a place and add a few words if you like ("back by 5").
- **On the screensaver:** it shows along the bottom too.

## 📝 Sticky notes

On Home (and **Family ▾ → 📝 Notes**), tap **＋ Note** to leave a note, or draw one.

- **Options:** pick a color, and make it for everyone or for one person.
- **On the screensaver:** notes show in the corner, a few at a time.
- **Taking one down:** tap **✓ Done**. The writer, the person it's for or a parent can do this. The note is kept, just taken down.

## 📔 Journal & 🫙 gratitude jar (Family ▾)

- **📔 Journal:** each person writes (or draws) a little each day and picks how they feel. Only they and parents can see it. On the same date in later years, **📅 On this day** shows what they wrote.
- **🫙 Gratitude jar:** anyone puts in one thing they're thankful for, on a paper slip the whole family sees. **🎲 Pull one out** picks one at random.
- **In the weekly report:** it says how many days they wrote (with their moods, but never the words) and what they were grateful for.
- **Taking something out:** **Take out** hides an entry. It's kept, never deleted.

## 📏 Height chart (Family ▾)

**＋ Measure someone** records a height in feet and inches, with a date, a note and an optional
photo. The page shows:

- a door frame with everyone's latest mark, wearing their 👕 outfit
- a growth chart over the years
- each person's history, with how much they grew

When a measurement is added that week, the weekly report says how much they've grown.

## The menu

The top menu is grouped so it fits on one line. Each group opens a dropdown:

- **🏡 Family**
- **🧹 Chores**
- **🍽️ Meals**
- **🎵 Fun**
- **🛠️ More**

A group with only one page left for a kid (after Kids' access) is a plain link. On a phone, ☰
still shows everything.

## Data

Only new things were added:

- **Column:** `family_members.avatar_outfit` (what the avatar has on).
- **Tables:**
  - `outfit_items`: pieces bought, and what each cost.
  - `meal_polls`, `meal_poll_options` and `meal_poll_votes`.
- **More columns:** `family_members.presence`, `presence_note`, `presence_at`.
- **More tables:**
  - `journal_entries`
  - `heights`
  - `sticky_notes` (taking things down only sets `hidden_at` / `done_at`)
- **Setting:** `weekly_report_off`.
- **Weather:** now also asks for sunrise and sunset.

No existing data changes.
