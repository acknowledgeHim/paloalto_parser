# Photo documents (Word / .docx)

**Photos → Documents** turns pictures into a Word document you can download, print, or keep
editing in Word / Google Docs / Pages.

## Making one

Tap **+** next to Documents, give it a **title**, then build it out of **sections**. Each section has:

- an optional **heading** (e.g. "Day at the beach")
- optional **text** — blank lines start a new paragraph
- a group of **pictures**, added with **＋ Add pictures**, which has the same ways to pick as the
  movie maker:
  - **By date taken** — everything between two dates, oldest first
  - **By folder or filename** — anything with that text in its folder path or filename
  - **Random** — a number of random pictures (**Shuffle again** for a different set)
  - **Choose from the grid** — sort by date taken or folder/filename, separate folder and filename
    filters, **Select all shown**, **Clear selection**, and **Show only picked**; picks are added in
    the grid's sort order

  Pictures already in the section are left out of the matches, so adding twice doesn't duplicate.
- a **caption** under any picture (optional), and ◀ ▶ ✕ to reorder or remove pictures
- a **layout**: Large (1 per row), 2 per row, or 3 per row

Sections can be reordered (↑ ↓) or removed. **Save** keeps it; **Save & download** also downloads it.

## Templates and shortcuts (all optional)

A new document starts by asking what to start with:

- **📄 Blank** — one empty section.
- **🧳 Trip journal** — pick the trip's dates; you get a section per day ("Day 1 · Wed, Jul 1")
  holding that day's pictures (up to 4 / 6 / 12, or all — spread across the day), with a "What
  happened this day?" prompt to write under.
- **🔬 School project** — Introduction / What I did / What I found out / Conclusion, each with a
  writing prompt.
- **🗓️ Year in review** — pick a year; a section per month with up to 3–12 pictures spread across it.

Trip journal and Year in review can **skip blurry photos and extra duplicates** (on by default).
Everything a template makes is ordinary sections you can edit, reorder, or delete.

Any time, **📅 Add sections by day…** appends a section per day for a date range — the same as the
trip journal, for adding more days later.

**Cover photo** — optionally choose one big picture (with a caption) that goes under the title on a
page of its own; the sections start on the next page.

## The download

**⬇ Word** downloads a .docx; **⬇ PDF** downloads the same thing as a PDF (easier to print or
email). Both are built fresh each time you tap them: the title and "By <name> · <date>" at the top, then
each section. Pictures are turned the right way up (phone photos stored sideways are fixed) and
sized to fit a Letter page; headings and text are kept on the same page as their pictures. Photos
that have since been removed from the library are left out. Building a document with lots of
pictures takes a few seconds on a Pi.

Nothing about the original photos is ever changed — the document only ever reads them.

## Who can edit or delete

Anyone can download a document. Only whoever made it (whoever was picked in the profile switcher
or logged in) or a parent can edit or delete it — the same rule as movies: enforced once that
person or a parent has a password set (see [SETTINGS_LOGIN.md](SETTINGS_LOGIN.md)), on the honor
system before then. Closing the editor with unsaved changes asks first.

## PDF downloads need LibreOffice

Word downloads work out of the box. PDF downloads convert the Word file with LibreOffice, which has
to be installed on the Pi once:

```bash
sudo apt install -y libreoffice-writer-nogui
```

(~300 MB; no desktop needed.) Without it, **⬇ PDF** says so and Word still works. If `soffice`
isn't on PATH, set `SOFFICE_PATH` in `.env`.
