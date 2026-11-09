# 👪 Relatives

**🏡 Family → 👪 Relatives** (`/#/relatives`): family, living or not — grandparents, aunts and
uncles, cousins, great-grandparents — with their dates, memories, and the photos and home movies
they're in.

## A relative

- **Name**, what the kids call them ("Grandma Jo"), how they're related ("Mom's mom").
- **🎂 Born** (date and place). Don't know the year? Tick it and give just the month and day — the
  birthday still shows, without an age.
- **🕊️ Has passed away** — date and place. Their birthday still comes up, as "would have been N".
- **About them** — anything: where they grew up, their work, what they loved.
- **👥 Their face in Photos** — link a person from face recognition (Photos → 👥 People). Every
  photo with their named face (or tagged to them there by hand) shows on their page.
- **👤 Someone in the household?** — link a parent's or kid's profile to their own entry. That's
  how household members get a birthday, and how "photos of me" knows which photos they're in. One
  profile per relative.

Parents add and edit relatives; **🙈 Hide** takes one off the list (nothing is deleted — **Show
hidden** brings them back).

## Memories, photos and home movies (anyone)

- **💬 Memories** — anyone can add one; whoever wrote it (or a parent) can edit or hide it.
- **📷 Photos** — the linked face's photos, plus **＋ Tag photos** (the usual photo picker). **✕**
  takes a photo off this relative's page only: the photo, its face names and the file are untouched.
- **🎬 Home movies** — **＋ Tag home movies** from 🎬 Movies (search by name, folder or year); ▶
  plays it right there.
- Photos and movies show only for people who can see Photos / Movies (Settings → Kids' access).

## 🎂 Birthdays

- **Home** shows today's birthdays (big) and the next few weeks'.
- **A hello on each person's first visit of the day** when it's a relative's birthday — "🎂 Grandma Jo
  turns 81 today!" (or "Happy birthday — you're 9 today!" for their own). The server remembers who's
  had it, so it's once a day per person on whichever screen they use.
- The ☀️ morning briefing (if on) lists them too, and reads them out.

## 📸 Photos of me from years ago

On their own profile page (👥 Family Board → their name), anyone can turn on **📸 Photos of me from
years ago** and pick which years (1, 2, 3, 5, 10 … or every year). Their Home screen then shows
photos with them in them from around today's date (within 3 days) those years back. It works even
if Photos is switched off for them — it's only pictures of themselves. It needs their profile
linked to a relative (see above), with their face linked or photos tagged.

## Data

New tables only — `relatives`, `relative_memories`, `relative_media` (photos and movies, pointed at
by path; untagging sets `hidden`), `birthday_greetings_seen` — and the `photo_memories` setting.
No existing data is changed, and no photo or movie file is ever copied, moved or touched.
