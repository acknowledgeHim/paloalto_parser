import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import type { GroceryItem } from '../types.js';

// Open to everyone, same household-trust default as adding a to-do or calendar event — no reason
// to gate "we're out of milk" behind a password.
export const groceryRouter = Router();

/** GET / — every current item, requester-first-then-oldest so the newest asks sink to the bottom
 *  rather than jumping to the top and reordering the list while someone's mid-shop. */
groceryRouter.get('/', (_req, res) => {
  const items = db.prepare('SELECT * FROM grocery_items ORDER BY created_at ASC').all() as GroceryItem[];
  res.json(items);
});

groceryRouter.post('/', (req, res) => {
  const { name, quantity, requested_by_id, meal_id } = req.body as Partial<GroceryItem>;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const item: GroceryItem = {
    id: uuidv4(),
    name: name.trim(),
    quantity: quantity?.trim() || null,
    requested_by_id: requested_by_id ?? null,
    meal_id: meal_id ?? null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO grocery_items (id, name, quantity, requested_by_id, meal_id, created_at)
     VALUES (@id, @name, @quantity, @requested_by_id, @meal_id, @created_at)`
  ).run(item);
  res.status(201).json(item);
});

/** PATCH /:id — edit an item's name/quantity/meal link (e.g. fix a typo, or attach it to a meal
 *  after the fact). requested_by_id is deliberately left alone here — who asked for it doesn't
 *  change just because someone else tidies up the entry. */
groceryRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(req.params.id) as GroceryItem | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });

  const { name, quantity, meal_id } = req.body as Partial<GroceryItem>;
  const updated: GroceryItem = {
    ...existing,
    name: name !== undefined ? name.trim() || existing.name : existing.name,
    quantity: quantity !== undefined ? quantity?.trim() || null : existing.quantity,
    meal_id: meal_id !== undefined ? meal_id : existing.meal_id,
  };
  db.prepare('UPDATE grocery_items SET name = @name, quantity = @quantity, meal_id = @meal_id WHERE id = @id').run(updated);
  res.json(updated);
});

/** DELETE /:id — "got it" and "never mind, don't need it after all" are the same action: it's off
 *  the list either way, no purchased-vs-cancelled distinction kept. */
groceryRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM grocery_items WHERE id = ?').run(req.params.id);
  res.status(204).end();
});
