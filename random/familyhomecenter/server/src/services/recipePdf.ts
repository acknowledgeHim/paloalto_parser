import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

/**
 * 📕 Recipes from a PDF (a family cookbook): the text is read out of the PDF (pdftotext; scanned
 * pages are read with OCR — pdftoppm + tesseract — when they're installed), then split into recipes
 * by what cookbooks usually look like: a title, "Ingredients", amounts at the start of lines,
 * "Directions"/"Method", "Serves 4". Nothing is saved here — the page shows what was found to check
 * and fix first. Runs as a job (OCR of a big scanned book takes a while on a Pi).
 */

export interface FoundRecipe {
  key: string;
  title: string;
  servings: number | null;
  category: string | null;
  ingredients: Array<{ quantity: string | null; name: string }>;
  instructions: string;
  page: number;
  /** Who it's from, when the book says ("From the kitchen of Aunt Mary" → "Aunt Mary"). */
  author: string | null;
}
export interface PdfJob {
  id: string;
  name: string;
  state: 'reading' | 'ocr' | 'done' | 'error';
  pages: number;
  page: number;
  ocrPages: number;
  error: string | null;
  recipes: FoundRecipe[];
  startedAt: number;
}

const jobs = new Map<string, PdfJob>();
export const pdfJob = (id: string) => jobs.get(id);

const PDFTOTEXT = process.env.PDFTOTEXT_PATH ?? 'pdftotext';
const PDFTOPPM = process.env.PDFTOPPM_PATH ?? 'pdftoppm';
const TESSERACT = process.env.TESSERACT_PATH ?? 'tesseract';

function run(cmd: string, args: string[], timeoutMs = 300_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err = (err + d).slice(-2000)));
    const t = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    p.on('error', (e) => {
      clearTimeout(t);
      reject((e as NodeJS.ErrnoException).code === 'ENOENT' ? new Error(`${cmd} is not installed`) : e);
    });
    p.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) resolve(out);
      else reject(new Error(err.trim().split('\n').pop() || `${cmd} exited ${code}`));
    });
  });
}

/** Start reading a PDF; poll pdfJob(id). */
export function startPdfJob(pdf: Buffer, name: string, categories: string[]): PdfJob {
  const job: PdfJob = { id: uuidv4(), name, state: 'reading', pages: 0, page: 0, ocrPages: 0, error: null, recipes: [], startedAt: Date.now() };
  jobs.set(job.id, job);
  // Old jobs go after an hour.
  for (const [id, j] of jobs) if (Date.now() - j.startedAt > 3600_000) jobs.delete(id);
  void (async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'recipe-pdf-'));
    try {
      const file = path.join(dir, 'book.pdf');
      await fs.writeFile(file, pdf);
      let text: string;
      try {
        text = await run(PDFTOTEXT, ['-enc', 'UTF-8', file, '-']);
      } catch (e) {
        throw new Error(/not installed/.test((e as Error).message) ? 'The Pi needs poppler-utils to read PDFs: sudo apt install poppler-utils' : `Couldn't read that PDF (${(e as Error).message})`);
      }
      const pages = text.split('\f');
      if (pages.length > 1 && !pages[pages.length - 1].trim()) pages.pop();
      job.pages = pages.length;
      // Scanned pages (pictures of the pages, almost no text): read them with OCR, if it's installed.
      const scanned = pages.map((p, i) => (p.replace(/\s/g, '').length < 40 ? i : -1)).filter((i) => i >= 0);
      if (scanned.length) {
        job.state = 'ocr';
        job.ocrPages = scanned.length;
        for (const i of scanned) {
          job.page = i + 1;
          try {
            await run(PDFTOPPM, ['-f', String(i + 1), '-l', String(i + 1), '-r', '300', '-gray', '-png', file, path.join(dir, 'p')]);
            const img = (await fs.readdir(dir)).find((f) => f.startsWith('p') && f.endsWith('.png'));
            if (!img) continue;
            pages[i] = await run(TESSERACT, [path.join(dir, img), '-', '--psm', '4']);
            await fs.rm(path.join(dir, img), { force: true });
          } catch (e) {
            if (/not installed/.test((e as Error).message)) {
              if (scanned.length === pages.length) {
                throw new Error('This PDF is scanned pictures of the pages. To read them the Pi needs OCR: sudo apt install tesseract-ocr');
              }
              break;
            }
          }
        }
      }
      job.recipes = findRecipes(pages, categories);
      job.state = 'done';
    } catch (e) {
      job.state = 'error';
      job.error = (e as Error).message;
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  })();
  return job;
}

// ---- Finding the recipes in the text ----

const HEAD_ING = /^\s*(ingredients?|you(?:'|’)?ll need|what you(?:'|’)?ll need|what you need)\s*:?\s*$/i;
const HEAD_DIR = /^\s*(directions?|instructions?|method|preparation|procedure|steps|how to make( it)?|to (make|prepare)|instructions & tips)\s*:?\s*$/i;
const SERVES = /\b(?:serves|servings?|makes|yields?|feeds)\s*:?\s*(?:about\s*)?(\d{1,3})/i;
const FRACTIONS = '¼½¾⅓⅔⅛⅜⅝⅞';
const QTY = new RegExp(
  `^(?:[-•*·▪◦●○]\\s*)?((?:\\d+\\s+)?\\d+\\s*/\\s*\\d+|\\d+\\s*[${FRACTIONS}]|[${FRACTIONS}]|\\d+(?:[.,]\\d+)?(?:\\s*(?:-|–|to)\\s*\\d+(?:[.,]\\d+)?)?|an?\\s+(?:pinch|dash|few|handful|couple)|pinch|dash|one|two|three|four|five|six|half)(?=\\s|$|[a-z])`,
  'i'
);
const UNIT =
  /^(cups?|c\.|tablespoons?|tbsps?\.?|tbs\.?|tbl\.?|T\.?(?=\s)|teaspoons?|tsps?\.?|t\.?(?=\s)|ounces?|oz\.?|fl\.?\s*oz\.?|pounds?|lbs?\.?|grams?|g(?=\s)|kilograms?|kg|ml|milliliters?|liters?|litres?|l(?=\s)|quarts?|qts?\.?|pints?|pts?\.?|gallons?|gal\.?|sticks?|cans?|packages?|pkgs?\.?|envelopes?|cloves?|slices?|pieces?|dozen|bunch(?:es)?|heads?|stalks?|sprigs?|jars?|bottles?|boxes?|bags?|containers?|cartons?|squares?|drops?|dashes?|pinch(?:es)?|handfuls?)\b\.?/i;
const BULLET = /^\s*[-•*·▪◦●○]\s+/;

/** "2 1/2 cups flour" → { quantity: "2 1/2 cups", name: "flour" }. */
/** Common scanning (OCR) slips in a recipe line: "Ib" for lb, "Y2" for ½, a bullet read as « or ~. */
export function fixOcr(line: string): string {
  return line
    .replace(/^\s*[«»~=>›‹°¢©®]+\s*/, '')
    .replace(/\b(\d+\s*)?Y2\b/g, (_m, d) => `${d ?? ''}1/2`)
    .replace(/\b(\d+\s*)?Y4\b/g, (_m, d) => `${d ?? ''}1/4`)
    .replace(/(\d|\()\s*Ibs?\b/g, (m) => m.replace(/Ib/, 'lb'))
    .replace(/\bIbs?\.?(?=\s)/g, (m) => m.replace('Ib', 'lb'))
    .replace(/\bt(?:bsp|sp)\b/gi, (m) => m.toLowerCase());
}

export function splitIngredient(line: string): { quantity: string | null; name: string } {
  const s = fixOcr(line).replace(BULLET, '').replace(/\s+/g, ' ').trim();
  const m = QTY.exec(s);
  if (!m) return { quantity: null, name: s };
  let qty = m[1].replace(/\s*\/\s*/g, '/');
  let rest = s.slice(m[0].length).trim();
  // "(8 oz)" right after the number belongs to the amount: "1 (8 oz) package".
  const paren = /^\([^)]{1,20}\)\s*/.exec(rest);
  if (paren) {
    qty += ` ${paren[0].trim()}`;
    rest = rest.slice(paren[0].length);
  }
  const u = UNIT.exec(rest);
  if (u) {
    qty += ` ${u[0].trim()}`;
    rest = rest.slice(u[0].length).trim();
    // "1 can (28 oz) tomatoes".
    const p2 = /^\([^)]{1,20}\)\s*/.exec(rest);
    if (p2) {
      qty += ` ${p2[0].trim()}`;
      rest = rest.slice(p2[0].length);
    }
  }
  rest = rest.replace(/^of\s+/i, '').trim();
  return rest ? { quantity: qty, name: rest } : { quantity: null, name: s };
}

const looksLikeIngredient = (raw: string) => {
  const l = fixOcr(raw);
  return l.length <= 90 && (QTY.test(l.replace(BULLET, '')) || BULLET.test(l)) && !/[.!?]\s+\S/.test(l);
};
const ATTRIBUTION = /^(from( the kitchen of)?|by|submitted by|courtesy of|recipe from|from grandma|from mom)\b/i;
/** "From the kitchen of Aunt Mary" → "Aunt Mary"; "Submitted by: Grandma Huber" → "Grandma Huber". */
export function authorOf(line: string): string | null {
  const m = /^(?:from(?:\s+the\s+kitchen\s+of)?|by|submitted\s+by|courtesy\s+of|recipe\s+from)\s*:?\s*(.+)$/i.exec(line.trim());
  const name = m?.[1].replace(/[.,;]+$/, '').trim();
  return name && name.length <= 60 && name.split(' ').length <= 6 ? name : null;
}
const looksLikeTitle = (l: string) =>
  !SERVES.test(l) &&
  !ATTRIBUTION.test(l) &&
  l.length >= 3 && l.length <= 60 && !/[.:;,]$/.test(l) && !looksLikeIngredient(l) && !HEAD_ING.test(l) && !HEAD_DIR.test(l) && /[a-z]/i.test(l) && l.split(' ').length <= 9;

interface Line {
  t: string;
  page: number;
}

/** Split a cookbook's text into recipes. */
export function findRecipes(pages: string[], categories: string[]): FoundRecipe[] {
  // Running headers/footers (the book's title, page numbers) are dropped.
  const count = new Map<string, number>();
  for (const p of pages) for (const l of new Set(p.split('\n').map((x) => x.trim()).filter(Boolean))) count.set(l, (count.get(l) ?? 0) + 1);
  const repeated = (l: string) => pages.length >= 4 && (count.get(l) ?? 0) >= Math.max(3, pages.length * 0.4);
  const lines: Line[] = [];
  pages.forEach((p, i) => {
    for (const raw of p.split('\n')) {
      const t = raw.replace(/\s+/g, ' ').trim();
      if (/^(page\s*)?\d{1,4}$/i.test(t) || (t && repeated(t))) continue;
      lines.push({ t, page: i + 1 });
    }
    lines.push({ t: '', page: i + 1 });
  });

  const catOf = (l: string) => {
    const w = l.toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (!w || w.split(' ').length > 3) return null;
    const hit = categories.find((c) => {
      const cc = c.toLowerCase();
      return w === cc || w === `${cc}s` || w === cc.replace(/ dish$/, '') + 's' || w.replace(/s$/, '') === cc.replace(/s$/, '') || (cc === 'main dish' && /^(mains?|main dishes|entrees?|dinners?)$/.test(w)) || (cc === 'side dish' && /^(sides?|side dishes)$/.test(w)) || (cc === 'appetizer' && /^(appetizers|starters|snacks)$/.test(w)) || (cc === 'dessert' && /^(desserts|sweets|cookies|cakes|pies)$/.test(w)) || (cc === 'drink' && /^(drinks|beverages)$/.test(w)) || (cc === 'bread' && /^(breads)$/.test(w)) || (cc === 'soup' && /^(soups|soups and stews|soups stews)$/.test(w));
    });
    return hit ?? null;
  };

  // Where each recipe starts: a title line followed (soon) by "Ingredients" or by amount lines.
  const starts: number[] = [];
  const nextText = (i: number, n: number) => {
    const out: number[] = [];
    for (let k = i + 1; k < lines.length && out.length < n; k++) if (lines[k].t) out.push(k);
    return out;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].t;
    if (!l || !looksLikeTitle(l) || catOf(l)) continue;
    const ahead = nextText(i, 4).map((k) => lines[k].t);
    // Title, maybe a "Serves"/"From Grandma" line or two, then Ingredients or ≥2 amounts.
    const skip = ahead.findIndex((t) => !(SERVES.test(t) || ATTRIBUTION.test(t) || (t.length < 50 && /^\(.*\)$/.test(t))));
    const rest = ahead.slice(Math.max(0, skip));
    if (rest[0] && HEAD_ING.test(rest[0])) starts.push(i);
    else if (rest.length >= 2 && looksLikeIngredient(rest[0]) && looksLikeIngredient(rest[1])) starts.push(i);
  }
  // The cookbook's section ("DESSERTS", "Main Dishes") each line is in.
  const sectionAt: Array<string | null> = [];
  let section: string | null = null;
  lines.forEach((l, i) => {
    const c = l.t ? catOf(l.t) : null;
    if (c) section = c;
    sectionAt[i] = section;
  });
  const recipes: FoundRecipe[] = [];
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const category = sectionAt[from];
    const body = lines.slice(from + 1, to).map((x) => x.t);
    const credits: string[] = [];
    let servings: number | null = null;
    const ingredients: FoundRecipe['ingredients'] = [];
    const steps: string[] = [];
    let mode: 'start' | 'ing' | 'dir' = 'start';
    for (const t of body) {
      if (!t) {
        if (mode === 'dir' && steps.length && steps[steps.length - 1] !== '') steps.push('');
        continue;
      }
      const sv = SERVES.exec(t);
      if (sv && t.length < 60 && servings === null) {
        servings = Number(sv[1]);
        if (mode !== 'dir') continue;
      }
      if (HEAD_ING.test(t)) {
        mode = 'ing';
        continue;
      }
      if (HEAD_DIR.test(t)) {
        mode = 'dir';
        continue;
      }
      // A section heading for what comes next ("MAIN DISHES") isn't part of this recipe.
      if (catOf(t)) continue;
      if (ATTRIBUTION.test(t) && t.length < 70 && mode !== 'dir') {
        credits.push(t);
        continue;
      }
      if (mode === 'start') mode = looksLikeIngredient(t) ? 'ing' : 'dir';
      if (mode === 'ing') {
        // No "Directions" heading: the first long sentence-like line starts the steps.
        if (!looksLikeIngredient(t) && (t.length > 60 || /[.!?]$/.test(t)) && ingredients.length) {
          mode = 'dir';
          steps.push(t);
        } else ingredients.push(splitIngredient(t));
      } else steps.push(t);
    }
    if (!ingredients.length && !steps.join('').trim()) continue;
    // Lines of a paragraph are joined; blank lines (and numbered steps) start new paragraphs.
    const instructions = [
      steps
        .join('\n')
        .replace(/\n(?!\n|\s*(?:\d+[.)]|step\s*\d+|[-•*]\s))/gi, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim(),
      // Credit lines that aren't just a name stay with the recipe as a note.
      ...credits.filter((c) => !authorOf(c)).map((c) => `— ${c}`),
    ]
      .filter(Boolean)
      .join('\n\n');
    recipes.push({
      key: uuidv4(),
      title: lines[from].t.replace(/\s+/g, ' ').trim(),
      servings,
      category,
      ingredients,
      instructions,
      page: lines[from].page,
      author: credits.map(authorOf).find(Boolean) ?? null,
    });
  }
  return recipes;
}
