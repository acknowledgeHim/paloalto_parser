# 📕 Importing recipes from a PDF cookbook

Meals → Recipes → **📕 Import from a PDF** reads a cookbook PDF, finds the recipes, and shows them
for you to check and fix before any are saved. It works with typed PDFs and with scanned ones,
like a family cookbook run through a scanner.

## One-time setup on the Pi

```bash
sudo apt install -y poppler-utils tesseract-ocr
sudo systemctl restart familyhomecenter
```

- `poppler-utils` reads the text out of PDFs.
- `tesseract-ocr` is the OCR that reads scanned pages (pictures of the pages). It's only needed
  for scanned PDFs.
- **Not sure whether your PDF is scanned?** Open it on a computer and try to select a word. If you
  can't highlight text, it's scanned.

## Using it

1. Type the **cookbook's name** (for example, *Huber Family Cookbook*). Every recipe remembers it,
   with the page: "Huber Family Cookbook, p. 6".
2. **📄 Pick the PDF.**
   - A typed PDF takes seconds.
   - A scanned one is read page by page with a progress bar: roughly 5–15 seconds a page on a
     Pi 5, so a 100-page book takes about 10–25 minutes.
   - You can close the window; it keeps going on the Pi.
3. **Check what it found.** Each recipe shows its title, page, number of ingredients, author and
   section.
   - **Check** opens it to fix anything: title, who it's from, category, servings, ingredients
     (one per line, amount first) and the steps.
   - Untick any you don't want, such as an introduction page read as a recipe. Ones whose title is
     already in My recipes start unticked.
4. **Add N recipes to My recipes.**

## What it looks for

- **Title:** a short heading, followed by "Ingredients" or by lines that start with an amount.
- **Ingredients:** "2 1/2 cups flour", "1 can (28 oz) tomatoes", "• 1 onion". Each one is split
  into amount and name, so 🔢 scaling and the grocery list work.
- **Steps:** "Directions", "Method" or "Instructions", or the first full sentences after the
  ingredients. A recipe that runs onto the next page is kept together.
- **Servings:** "Serves 8", "Makes 6 servings", "Yield: 12".
- **Who it's from:** "From the kitchen of Aunt Mary", "By Grandma Huber", "Submitted by …" fill in
  **Who it's from**.
- **Section headings:** "DESSERTS", "Main Dishes", "Drinks" set the category of the recipes after
  them.
- **Skipped:** the book's running header and page numbers.
- **Common OCR slips are fixed:** "Ib" → lb, "Y2" → 1/2, stray symbols in front of bullets.

## Tips for scanning

- Scan at **300 dpi**, black-and-white or grayscale, with the pages straight.
- Handwritten recipe cards don't read well with OCR. Type those in with ＋, or fix them on the
  check screen.
- You can import the same book again later; recipes already in My recipes start unticked.

## Who it's from and where it came from

Every recipe now has **Who it's from** and **Where it came from**. They're shown under the title on
the recipe card, editable with ✎, and searchable.

- Recipes imported from TheMealDB say "TheMealDB".
- Older ones you typed in can have them added with ✎.
