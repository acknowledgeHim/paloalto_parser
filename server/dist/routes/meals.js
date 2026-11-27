import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { todayStr } from '../utils/recurrence.js';
export const mealsRouter = Router();
function mealIngredients(mealId) {
    return db.prepare('SELECT * FROM meal_ingredients WHERE meal_id = ? ORDER BY sort_order ASC').all(mealId);
}
function mealRecipes(mealId) {
    const recipes = db
        .prepare(`SELECT r.* FROM recipes r
       JOIN meal_recipes mr ON mr.recipe_id = r.id
       WHERE mr.meal_id = ? ORDER BY mr.sort_order ASC`)
        .all(mealId);
    return recipes.map((r) => ({
        ...r,
        ingredients: db.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC').all(r.id),
    }));
}
function fullMeal(meal) {
    return { ...meal, ingredients: mealIngredients(meal.id), recipes: mealRecipes(meal.id) };
}
function setIngredients(mealId, ingredients) {
    db.prepare('DELETE FROM meal_ingredients WHERE meal_id = ?').run(mealId);
    const stmt = db.prepare('INSERT INTO meal_ingredients (id, meal_id, name, quantity, sort_order) VALUES (?, ?, ?, ?, ?)');
    ingredients.forEach((ing, i) => {
        if (!ing.name?.trim())
            return;
        stmt.run(uuidv4(), mealId, ing.name.trim(), ing.quantity?.trim() || null, i);
    });
}
function setRecipes(mealId, recipeIds) {
    db.prepare('DELETE FROM meal_recipes WHERE meal_id = ?').run(mealId);
    const stmt = db.prepare('INSERT INTO meal_recipes (meal_id, recipe_id, sort_order) VALUES (?, ?, ?)');
    recipeIds.forEach((rid, i) => stmt.run(mealId, rid, i));
}
/** GET /api/meals?start=YYYY-MM-DD&end=YYYY-MM-DD — defaults both to today. */
mealsRouter.get('/', (req, res) => {
    const today = todayStr();
    const start = req.query.start || today;
    const end = req.query.end || start;
    const meals = db
        .prepare('SELECT * FROM meals WHERE date >= ? AND date <= ? ORDER BY date ASC, slot ASC')
        .all(start, end);
    res.json(meals.map(fullMeal));
});
mealsRouter.post('/', (req, res) => {
    const { date, slot, assignee_id, title, notes, ingredients, recipe_ids, created_by_id } = req.body;
    if (!date)
        return res.status(400).json({ error: 'date is required' });
    if (slot !== 'breakfast' && slot !== 'lunch' && slot !== 'dinner') {
        return res.status(400).json({ error: 'slot must be breakfast, lunch, or dinner' });
    }
    if (!title || !title.trim())
        return res.status(400).json({ error: 'title is required' });
    const meal = {
        id: uuidv4(),
        date,
        slot,
        assignee_id: assignee_id ?? null,
        title: title.trim(),
        notes: notes ?? null,
        created_by_id: created_by_id ?? null,
        created_at: new Date().toISOString(),
    };
    db.prepare(`INSERT INTO meals (id, date, slot, assignee_id, title, notes, created_by_id, created_at)
     VALUES (@id, @date, @slot, @assignee_id, @title, @notes, @created_by_id, @created_at)`).run(meal);
    setIngredients(meal.id, ingredients ?? []);
    setRecipes(meal.id, recipe_ids ?? []);
    res.status(201).json(fullMeal(meal));
});
mealsRouter.patch('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
    if (!existing)
        return res.status(404).json({ error: 'not found' });
    const updated = { ...existing, ...req.body, id: existing.id };
    db.prepare(`UPDATE meals SET date=@date, slot=@slot, assignee_id=@assignee_id, title=@title, notes=@notes WHERE id=@id`).run(updated);
    if (req.body.ingredients)
        setIngredients(req.params.id, req.body.ingredients);
    if (req.body.recipe_ids)
        setRecipes(req.params.id, req.body.recipe_ids);
    res.json(fullMeal(updated));
});
mealsRouter.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM meals WHERE id = ?').run(req.params.id);
    res.status(204).end();
});
