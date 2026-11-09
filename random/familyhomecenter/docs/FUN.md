# Fun extras

## 💎 Tokens

Tokens are the app's own currency, kept apart from the Prize Bank's ⭐ stars (stars are for prizes).
- **Earned:** ⌨️ Typing (lessons, speed and game bests; a parent sets how many), chores and to-dos a
  parent sets to pay **💎 Tokens**, swapping ⭐ stars for tokens, and a parent giving some.
- **Spent:** 👕 Dress up and 🎮 Games.
- **The 💎 wallet** (on the Games and Dress up pages): the balance, **⭐ → 💎 swap** (parents only — a parent swaps a kid's stars; kids can't swap their own. A parent sets the rate,
  1 ⭐ = 1 💎 to start, 0 = off; stars can't be swapped back), **👑 Give / Take away** for parents, and
  a history of every change.
- When tokens arrived, everyone started with as many tokens as typing had paid them in stars so far.
  Stars weren't changed. Things bought before then were bought with stars, so a refund gives stars
  back; newer ones give tokens back. (New: `token_balance` column, `token_log` table, and a `currency`
  column on `outfit_items` / `game_unlocks`. Nothing removed.)

## 👕 Dress up

**Fun ▾ → 👕 Dress up**, or the 👕 link in a kid's Prize Bank column. Kids spend their 💎 tokens on pieces for their avatar. **👑 Parents dress up free:** every piece (vehicles too, so
also in ⛰️ Hill Hopper) is theirs to wear, with no tokens needed.

- **Pieces:** a hat, glasses, something in their hand, a pet, a vehicle and a bit of magic (sparkles, hearts, flames…), one of each at a time.
- **🚗 Vehicles** are the big things to save up for: 36 of them, and the fancier the ride, the more tokens it costs:
  - **20 💎:** roller skates, a skateboard, a scooter or a sled.
  - **25–45 💎:** bikes, a canoe, a moped, a tractor, cars, a pickup, a sailboat, a camper van, a school bus.
  - **50–60 💎:** an ambulance, a police car, a fire truck, a speedboat, a race car, a big rig, a yacht.
  - **70–100 💎:** trains, a cable car, a parachute, a helicopter, planes, a cruise ship.
  - **The top:** a 🚀 rocket (150 💎) and a 🛸 flying saucer (200 💎).
  The vehicle sits across the bottom of the avatar, so it looks like they are riding it.
- **Trying and buying:** tap a piece to try it on, then **Buy it** to spend the tokens. Tap a piece you own to wear it or take it off.
- **Where it shows:** everywhere their avatar shows up: the floor plan, the Prize Bank, Who's home, the name switcher, chores, lists, the replay and so on. Small avatars next to names keep their pieces tucked in close.
- **Who can change it:** a kid can only spend their own tokens. A parent can do it for anyone, and can **↶ refund** a piece, which gives the tokens back.

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

## 📬 Weekly report (Settings → 📬 Email)

Every Sunday at 6pm, each kid's week is emailed to every parent with an email, and to the kid if
they have their own. It covers:

- jobs done each day, with a little bar chart
- what slipped
- 🎁 **Prize Bank**, in its own section and not counted in the jobs above: prize-box jobs done and time logged on them, each prize box's progress, stars earned, their star count, rewards earned and prizes redeemed

No money or bank info goes in the email. A money prize box shows as "💲 Money prize", without the amount.

**📬 Send them now** says how each kid's email went, e.g. "Sent 2 of 2: Ava ✓ · Ben ✓", or the reason one failed.

The settings panel has three controls:

- **Turn it off.**
- **See this week's report** in the browser.
- **📬 Send them now.**

It needs email set up on the server (SMTP_HOST, the same as the grocery list).

## ✅ Approval emails (Settings → 📬 Email)

When a kid checks off a job that needs a parent's OK, logs a chunk of one (30 minutes of weeding),
or claims a prize that needs an OK, every parent with an email gets one.

- **Grouping:** things that come in together share one email, sent about a minute after the first.
- **Already answered:** if it's been answered or taken back by then, nothing is sent.
- **Turning it off:** use the switch in Settings → 📬 Email.

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

Only parents can add, change (✏️) or take off (✕) a measurement; kids can look but not change
anything. Changing one keeps the original: it is hidden and the corrected copy takes its place.

When a measurement is added that week, the weekly report says how much they've grown.

## ☀️ Morning briefing (Settings → ☀️ Wall screen)

Turn it on, and the first time someone wakes the wall screen in the morning (between the hours
you pick, 5am to 10am by default), a full-screen **Good morning!** comes up. It shows:

- today's weather, with tips like ☔ grab an umbrella, 🧥 bring a jacket, or 🧴 sunscreen
- everyone's first three jobs
- today's calendar
- today's meals, plus a button to vote if a dinner vote is open
- the sticky notes that are up

**🔊 Read it to me** reads it out loud, and **Let's go!** closes it. It shows once a morning per
screen. Off by default.

**☀️ Today** next to the date on Home opens it any time.

## 🎞️ This week (Fun ▾)

The family's week as a little story:

- how many jobs everyone did together
- each person's own week: something nice about it, how much they finished (a ring that fills), daily bars, stars, money, prizes and shout-outs like ✅ finished everything on 3 days, 🏅 their best day, 📈 got stronger as the week went on. Nobody is ranked or compared.
- the gratitude jar
- meals picked by vote
- who grew
- the week's photos

It plays on its own. **‹ Back**, **⏸ Pause** and **Next ›** step through it.

**On the weekend screensaver:** on Saturdays and Sundays it plays every 20 minutes or so, between
photos. Turn this off in Settings → ☀️ Wall screen.

## ⚙️ Settings sections

Each section in Settings is folded down to its heading. Tap a heading to open or close it. The
screen remembers which ones you left open.

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
- **📹 Cameras** (`docs/ANDROID_TABLET_SETUP.md`): tables `camera_devices` and `camera_clips` (taking
  one away only sets `hidden_at`); clip pictures saved under `server/data/cameras/`; setting
  `camera_motion_email_off`; storage: new clip columns (archive_file, backed_up_at, downloaded_at, purged_at…), table
  `camera_purges` (parent removals), settings `camera_min_free_gb`, `camera_compress_off`, `camera_smb_*`. Nothing is removed automatically.
- **📍 Photo places** (`docs/PHOTOS_SETUP.md`): tables `photo_gps` (read from EXIF once) and `photo_place_edits`
  (country/state/year set by hand; the photo file is never changed); setting `photo_source_notes` (parents' notes on the photo share — no password).
- **📥 Photo filing** (`docs/PHOTOS_SETUP.md`): table `photo_filings` (what was filed where); settings `photo_inbox_dir`, `photo_inbox_auto`. Photos are moved into YEAR/Month, duplicates into Inbox/Duplicates — nothing deleted.
- **🍽️ Recipes:** columns `recipes.author`, `recipes.origin` (who it's from, where it came from); recipe pictures saved on the Pi; 📕 PDF import (`docs/RECIPE_PDF_IMPORT.md`) only adds recipes.
- **Settings:** `weekly_report_off`, `approval_email_off`, `morning_briefing`, `morning_briefing_start`, `morning_briefing_end`, `recap_off`, `whos_home_off` (Settings → ☀️ Wall screen hides 🏠 Who's home).
- **Weather:** now also asks for sunrise and sunset.

No existing data changes.

## 🎮 Games

**🎵 Fun → 🎮 Games** (`/#/games`). Each game is **unlocked with 💎 tokens** — for good, or for a
number of plays.

- **⚙️ What each game costs** (parents, bottom of the Games page): per game, the 💎 cost and how
  many plays an unlock is good for. **0 plays = for good** (the default). With a number, unlocking
  gives that many 🎟️ plays; each go uses one, and when they're used up the kid earns tokens and
  unlocks it again (buying again while some are left adds more). Games already unlocked for good
  stay theirs — ↶ refund takes one back. Saved in the `game_rules` setting; no data changes.

- **Parents play free.** In **Kids' games** a parent can unlock a game for a kid (it uses the kid's
  tokens) or **↶ refund** it (tokens back, game locked again; scores and progress are kept).
- **🎟️ Plays:** a parent can give a kid a number of plays of a game instead (Kids' games → give N
  plays). Each go uses one. When they run out, the game locks again, unless the kid unlocks it for
  good with tokens. Plays add up, and **take away** clears them. Kept in the new `game_passes` table.
- Kids' access has a **Games** switch (Settings → Kids' access). A kid whose sections were already
  picked by hand needs it ticked.
- Kept per person, in new tables (`game_unlocks`, `game_scores`, `game_saves`; no existing data
  changes): unlocks, every run's score, and in-game progress.
- Adding a game: an entry in `server/src/services/games.ts` and a page in `client/src/games/`.

### ⛰️ Hill Hopper (25 💎)

A side-scrolling hill driver. You drive your 👕 Dress up ride (or a buggy in your colour), with your
own avatar at the wheel wearing your hat.

- **Controls** (🎮 Controls in the garage, saved per person):
  - **Keys:** gas → / D and brake ← / A to start with. Press **Change**, then any key.
  - **Mouse:** the on-screen pedals, *or* hold the left button for gas and the right button for brake,
    *or* hold the right half of the game for gas and the left half for brake.
  - The big on-screen pedals always work too, for the touch screen. Brake reverses once stopped.
- **It's bouncy:** gas lifts the nose (the engine twists the car back). Too much on a climb flips you
  over, so ease off or tap the brake. Holding gas the whole way flips you before ~200 m. The run
  ends if your head touches the ground, or if you end up on your back or standing on your tail
  for a second. In the air, gas tips you back and brake tips you forward.
- **⛽ Fuel** runs down while you drive. Cans come every ~150 m at first, a little further apart as
  you go, so you can drive carefully and still reach the next one.
- **🪙 Coins** come from the road (5, then 10 after 600 m, then 25 after 1500 m), plus flips (+25)
  and big jumps (+10). They buy **upgrades**: engine, tires, springs and fuel tank, 5 levels each
  (100 → 2000 coins). Coins stay in the game; they're not Prize Bank tokens.
- **🌍 Worlds**, unlocked with game coins in the garage (once bought, pick any of them to drive in):

  | World | 🪙 | How it drives | Coins |
  |---|---|---|---|
  | 🌄 Green Hills | free | where it starts | ×1 |
  | 🏜️ Desert Dunes | 300 | long dunes, loose sand (less grip) | ×1.2 |
  | 🌴 Jungle | 600 | short choppy bumps, slippery mud | ×1.3 |
  | 🧊 Ice World | 900 | gentle hills, very slippery | ×1.4 |
  | 🦖 Dino Land | 1200 | big hills, volcano sky | ×1.5 |
  | 🌊 Water Planet | 1600 | islands and sea; you float, slow down and paddle | ×1.6 |
  | 🍭 Candy Land | 2000 | everything super bouncy | ×1.6 |
  | 🌕 The Moon | 2600 | low gravity, giant floaty jumps | ×2 |
  | ☀️ The Sun | 3500 | heavy gravity; the heat burns fuel fast | ×2.5 |

  **⚠️ Add obstacles** (a switch on the world's card, once it's unlocked; ×1.5 coins while on):
  - 🦖 **Dino Land:** big dinosaurs stand on the road and jump. They crouch just before a jump.
    Drive underneath while one is in the air (+15 coins); if it lands on you, or you drive into it,
    you're squashed. A "🦖 40 m ▶" sign warns you one is coming, and the camera zooms out near one.
  - 👽 **The Moon:** aliens in a flying saucer follow you. When it glows, a red target shows where
    the zapper will land: where you'd be if you kept going at the same speed. Speed up or slow down
    to dodge (+5 each miss). You have 🛡️🛡️🛡️ shields; the third zap ends the run.
  **🦘 Jump** (garage → Controls, off unless you turn it on): press the jump key (Space;
  change it there) or the jump button to hop. The jump button is picked there too: tap the middle of
  the screen (the default), an on-screen 🦘 JUMP button between the pedals, the middle mouse button
  (wheel click), or keys only. With Jump on, 🦖 Dino Land also has 🥚 dino eggs on
  the road: hop over one for +3. Squash 3 and the next dinosaur you get under turns round and
  chases you for 10 s, jumping at you — outrun it (or dodge its landings) and it gives up (+20).
  **−** next to an upgrade takes a level off and gives its coins back.
  Each world has its own course and its own **Best** (your Green Hills best from before carries over).
- It's the same course every run, so the **Best** flag means something. **🏆 Family best**
  shows everyone's longest run.

### 🧱 Brick Tumble (20 💎)

A falling-bricks game, our own version (not a copy of any particular one). Bricks of four squares
fall into a 10 × 20 well. Move and turn them, fill a row from side to side to clear it, and don't
let the pile reach the top.

- **Keys:** ← → / A D move · ↑ / W / X turn · Z / Q turn the other way · ↓ / S faster ·
  Space drops it · C / Shift puts it on hold · P / Esc pauses. It pauses by itself if you switch away.
- **Mouse or finger on the well:** tap to turn (the left edge turns the other way), drag sideways to
  move, drag down to go faster, flick down to drop. Right-click = hold. There are also big buttons
  under the game for touch screens.
- **Points:** 100 / 300 / 500 / 800 for 1–4 rows at once, times the level. Clearing rows with brick
  after brick adds a bonus, and dropping adds a little. It gets faster every 10 rows. You can start at
  level 1, 3, 5, 7 or 10.
- **🎨 Brick looks**, unlocked by your best score: Bright (free), 🍬 Candy 3,000, 🍓 Fruit 8,000,
  🐾 Animals 15,000, 🌌 Space 30,000.
- 🏆 Family best, 🎟️ parent-given plays and unlocking with tokens all work like Hill Hopper.

