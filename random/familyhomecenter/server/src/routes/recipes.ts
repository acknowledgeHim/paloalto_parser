import { Router } from 'express';
import express from 'express';
import { pdfJob, startPdfJob, splitIngredient } from '../services/recipePdf.js';
import { fetchRecipeImage, localizeRecipeImage, localRecipeImagePath, proxiedRecipeImage, remoteRecipeImage, saveUploadedRecipeImage } from '../services/recipeImages.js';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { Recipe } from '../types.js';

export const recipesRouter = Router();

interface IngredientInput {
  name: string;
  quantity?: string | null;
}

function ingredientsFor(recipeId: string) {
  return db.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC').all(recipeId);
}

function setIngredients(recipeId: string, ingredients: IngredientInput[]) {
  db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(recipeId);
  const stmt = db.prepare(
    'INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  ingredients.forEach((ing, i) => {
    if (!ing.name?.trim()) return;
    stmt.run(uuidv4(), recipeId, ing.name.trim(), ing.quantity?.trim() || null, i);
  });
}

recipesRouter.get('/', (_req, res) => {
  const recipes = db.prepare('SELECT * FROM recipes ORDER BY title ASC').all() as Recipe[];
  res.json(recipes.map((r) => ({ ...r, ingredients: ingredientsFor(r.id) })));
});

recipesRouter.post('/', (req, res) => {
  const { title, instructions, servings, category, ingredients, created_by_id } = req.body as {
    title?: string;
    instructions?: string;
    servings?: number;
    category?: string | null;
    ingredients?: IngredientInput[];
    created_by_id?: string;
  };
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });

  const recipe: Recipe = {
    id: uuidv4(),
    title: title.trim(),
    source: 'local',
    source_id: null,
    instructions: instructions?.trim() || null,
    thumbnail_url: null,
    servings: Number(servings) > 0 ? Math.round(Number(servings)) : 4,
    category: category?.trim() || null,
    author: typeof req.body.author === 'string' ? req.body.author.trim().slice(0, 200) || null : null,
    origin: typeof req.body.origin === 'string' ? req.body.origin.trim().slice(0, 200) || null : null,
    created_by_id: created_by_id ?? null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO recipes (id, title, source, source_id, instructions, thumbnail_url, servings, category, author, origin, created_by_id, created_at)
     VALUES (@id, @title, @source, @source_id, @instructions, @thumbnail_url, @servings, @category, @author, @origin, @created_by_id, @created_at)`
  ).run(recipe);
  setIngredients(recipe.id, ingredients ?? []);
  res.status(201).json({ ...recipe, ingredients: ingredientsFor(recipe.id) });
});

recipesRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id) as Recipe | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });

  const updated: Recipe = {
    ...existing,
    title: (req.body.title as string | undefined)?.trim() || existing.title,
    instructions: (req.body.instructions as string | undefined)?.trim() || null,
    servings: Number(req.body.servings) > 0 ? Math.round(Number(req.body.servings)) : existing.servings,
    category: (req.body.category as string | null | undefined)?.trim() || null,
    author: req.body.author === undefined ? existing.author ?? null : typeof req.body.author === 'string' ? req.body.author.trim().slice(0, 200) || null : null,
    origin: req.body.origin === undefined ? existing.origin ?? null : typeof req.body.origin === 'string' ? req.body.origin.trim().slice(0, 200) || null : null,
  };
  db.prepare('UPDATE recipes SET title=@title, instructions=@instructions, servings=@servings, category=@category, author=@author, origin=@origin WHERE id=@id').run(updated);
  if (req.body.ingredients) setIngredients(req.params.id, req.body.ingredients as IngredientInput[]);
  res.json({ ...updated, ingredients: ingredientsFor(req.params.id) });
});

recipesRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---- Online search: TheMealDB, a free public recipe API that needs no API key/signup ----

interface TheMealDbMeal {
  idMeal: string;
  strMeal: string;
  strInstructions: string | null;
  strMealThumb: string | null;
  [ingredientOrMeasure: string]: string | null;
}

function normalizeTheMealDb(meal: TheMealDbMeal) {
  const ingredients: IngredientInput[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (name && name.trim()) ingredients.push({ name: name.trim(), quantity: measure?.trim() || null });
  }
  return {
    source: 'themealdb' as const,
    source_id: meal.idMeal,
    title: meal.strMeal,
    instructions: meal.strInstructions,
    // Shown through the Pi (not straight from TheMealDB) — see services/recipeImages.ts.
    thumbnail_url: proxiedRecipeImage(meal.strMealThumb),
    category: meal.strCategory?.trim() || null,
    ingredients,
  };
}

/** GET /api/recipes/search-online?q=chicken — searches TheMealDB, does not save anything locally. */
recipesRouter.get(
  '/search-online',
  asyncHandler(async (req, res) => {
    const q = ((req.query.q as string) ?? '').trim();
    if (!q) return res.json([]);
    let resp: Response;
    try {
      resp = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`);
    } catch (err) {
      console.warn('[recipes] TheMealDB search unreachable', err);
      return res.status(502).json({ error: 'recipe search is unreachable right now' });
    }
    if (!resp.ok) return res.status(502).json({ error: 'recipe search failed' });
    const data = (await resp.json()) as { meals: TheMealDbMeal[] | null };
    res.json((data.meals ?? []).map(normalizeTheMealDb));
  })
);

/** GET /online-image?u=… — a TheMealDB picture for a search result, fetched by the Pi so the
 *  browser never contacts TheMealDB itself. Only TheMealDB's own image host is allowed. */
recipesRouter.get(
  '/online-image',
  asyncHandler(async (req, res) => {
    const remote = remoteRecipeImage(String(req.query.u ?? ''));
    if (!remote) return res.status(400).end();
    try {
      res.type('image/jpeg').set('Cache-Control', 'private, max-age=86400').send(await fetchRecipeImage(remote));
    } catch {
      res.status(502).end();
    }
  })
);

// ---- 📕 Recipes from a PDF cookbook ----

// The same course names the recipe form offers (client/src/utils/recipeCategories.ts).
const CATEGORIES = ['Main dish', 'Side dish', 'Appetizer', 'Salad', 'Soup', 'Breakfast', 'Bread', 'Dessert', 'Drink'];

/** POST /pdf (the PDF as the body; x-filename) — start reading it; poll GET /pdf/:job. */
recipesRouter.post('/pdf', express.raw({ type: () => true, limit: '300mb' }), (req, res) => {
  const pdf = req.body as Buffer;
  if (!Buffer.isBuffer(pdf) || pdf.subarray(0, 5).toString() !== '%PDF-') return res.status(400).json({ error: 'That isn’t a PDF' });
  const job = startPdfJob(pdf, decodeURIComponent(String(req.get('x-filename') ?? 'cookbook.pdf')), CATEGORIES);
  res.status(202).json({ id: job.id });
});

/** GET /pdf/:job — how reading is going, and what was found (each marked if My recipes already has that title). */
recipesRouter.get('/pdf/:job', (req, res) => {
  const job = pdfJob(req.params.job);
  if (!job) return res.status(404).json({ error: 'That reading has finished or expired — upload the PDF again' });
  const have = new Set((db.prepare('SELECT title FROM recipes').all() as Array<{ title: string }>).map((r) => r.title.trim().toLowerCase()));
  res.json({ ...job, recipes: job.recipes.map((r) => ({ ...r, already: have.has(r.title.trim().toLowerCase()) })) });
});

/** POST /bulk { recipes: [{ title, servings, category, ingredients | ingredients_text, instructions }], created_by_id } — save checked recipes. */
recipesRouter.post('/bulk', (req, res) => {
  const list = Array.isArray(req.body?.recipes) ? req.body.recipes : [];
  const created: string[] = [];
  const insert = db.prepare(
    `INSERT INTO recipes (id, title, source, source_id, instructions, thumbnail_url, servings, category, author, origin, created_by_id, created_at)
     VALUES (@id, @title, @source, @source_id, @instructions, @thumbnail_url, @servings, @category, @author, @origin, @created_by_id, @created_at)`
  );
  db.transaction(() => {
    for (const r of list.slice(0, 2000)) {
      const title = String(r?.title ?? '').trim().slice(0, 200);
      if (!title) continue;
      const ingredients: IngredientInput[] = Array.isArray(r.ingredients)
        ? r.ingredients.map((i: IngredientInput) => ({ name: String(i?.name ?? ''), quantity: i?.quantity ?? null }))
        : String(r.ingredients_text ?? '')
            .split('\n')
            .map((l: string) => l.trim())
            .filter(Boolean)
            .map((l: string) => splitIngredient(l));
      const recipe = {
        id: uuidv4(),
        title,
        source: 'local',
        source_id: null,
        instructions: String(r.instructions ?? '').trim() || null,
        thumbnail_url: null,
        servings: Number(r.servings) > 0 ? Math.round(Number(r.servings)) : 4,
        category: String(r.category ?? '').trim() || null,
        author: String(r.author ?? '').trim().slice(0, 200) || null,
        origin: String(r.origin ?? '').trim().slice(0, 200) || null,
        created_by_id: typeof req.body?.created_by_id === 'string' ? req.body.created_by_id : null,
        created_at: new Date().toISOString(),
      };
      insert.run(recipe);
      setIngredients(recipe.id, ingredients);
      created.push(recipe.id);
    }
  })();
  res.status(201).json({ created: created.length });
});

/** PUT /:id/image { data_url } — add or replace a recipe's picture (yours, or instead of TheMealDB's). */
recipesRouter.put(
  '/:id/image',
  asyncHandler(async (req, res) => {
    if (!db.prepare('SELECT 1 FROM recipes WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'not found' });
    try {
      res.json({ thumbnail_url: await saveUploadedRecipeImage(req.params.id, String(req.body?.data_url ?? '')) });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  })
);

/** POST /:id/image/remove — stop showing its picture (the file is kept on the Pi). */
recipesRouter.post('/:id/image/remove', (req, res) => {
  db.prepare('UPDATE recipes SET thumbnail_url = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/** GET /:id/image — a saved recipe's picture, stored on the Pi. */
recipesRouter.get('/:id/image', (req, res) => {
  res.sendFile(localRecipeImagePath(req.params.id), (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

/** POST /api/recipes/import — saves a search-online result (or any freeform recipe) into the local library. */
recipesRouter.post('/import', asyncHandler(async (req, res) => {
  const { title, instructions, thumbnail_url, source, source_id, servings, category, ingredients, created_by_id } = req.body as {
    title?: string;
    instructions?: string | null;
    thumbnail_url?: string | null;
    source?: string;
    source_id?: string | null;
    servings?: number;
    category?: string | null;
    ingredients?: IngredientInput[];
    created_by_id?: string;
  };
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });

  const recipe: Recipe = {
    id: uuidv4(),
    title: title.trim(),
    source: source === 'themealdb' ? 'themealdb' : 'local',
    source_id: source_id ?? null,
    instructions: instructions?.trim() || null,
    // The picture is downloaded onto the Pi just below (only from TheMealDB) — never hot-linked.
    thumbnail_url: null,
    // TheMealDB's free API doesn't reliably report a serving size — 4 is a reasonable default,
    // editable afterward like any local recipe.
    servings: Number(servings) > 0 ? Math.round(Number(servings)) : 4,
    category: category?.trim() || null,
    author: null,
    origin: source === 'themealdb' ? `TheMealDB${source_id ? ` (#${source_id})` : ''}` : null,
    created_by_id: created_by_id ?? null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO recipes (id, title, source, source_id, instructions, thumbnail_url, servings, category, author, origin, created_by_id, created_at)
     VALUES (@id, @title, @source, @source_id, @instructions, @thumbnail_url, @servings, @category, @author, @origin, @created_by_id, @created_at)`
  ).run(recipe);
  setIngredients(recipe.id, ingredients ?? []);
  const remote = remoteRecipeImage(thumbnail_url);
  if (remote) recipe.thumbnail_url = await localizeRecipeImage(recipe.id, remote);
  res.status(201).json({ ...recipe, ingredients: ingredientsFor(recipe.id) });
}));
