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
- **Setting:** `weekly_report_off`.
- **Weather:** now also asks for sunrise and sunset.

No existing data changes.
