import { Router } from 'express';
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
  const { title, instructions, servings, ingredients, created_by_id } = req.body as {
    title?: string;
    instructions?: string;
    servings?: number;
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
    created_by_id: created_by_id ?? null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO recipes (id, title, source, source_id, instructions, thumbnail_url, servings, created_by_id, created_at)
     VALUES (@id, @title, @source, @source_id, @instructions, @thumbnail_url, @servings, @created_by_id, @created_at)`
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
  };
  db.prepare('UPDATE recipes SET title=@title, instructions=@instructions, servings=@servings WHERE id=@id').run(updated);
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
    thumbnail_url: meal.strMealThumb,
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

/** POST /api/recipes/import — saves a search-online result (or any freeform recipe) into the local library. */
recipesRouter.post('/import', (req, res) => {
  const { title, instructions, thumbnail_url, source, source_id, servings, ingredients, created_by_id } = req.body as {
    title?: string;
    instructions?: string | null;
    thumbnail_url?: string | null;
    source?: string;
    source_id?: string | null;
    servings?: number;
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
    thumbnail_url: thumbnail_url ?? null,
    // TheMealDB's free API doesn't reliably report a serving size — 4 is a reasonable default,
    // editable afterward like any local recipe.
    servings: Number(servings) > 0 ? Math.round(Number(servings)) : 4,
    created_by_id: created_by_id ?? null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO recipes (id, title, source, source_id, instructions, thumbnail_url, servings, created_by_id, created_at)
     VALUES (@id, @title, @source, @source_id, @instructions, @thumbnail_url, @servings, @created_by_id, @created_at)`
  ).run(recipe);
  setIngredients(recipe.id, ingredients ?? []);
  res.status(201).json({ ...recipe, ingredients: ingredientsFor(recipe.id) });
});
