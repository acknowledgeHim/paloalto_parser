import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { isParentRequest } from '../services/rewards.js';
import { sessionMemberId, SESSION_COOKIE_NAME } from '../services/auth.js';
import type { Request } from 'express';
import type { GroceryItem } from '../types.js';

// Viewing is open to everyone. Adding is for parents, and for kids a parent has allowed
// (family_members.can_add_grocery — Settings → Kids' access). Editing an item's
// details is parent-only (requireAdmin, real enforcement once a password exists). Marking one off
// — ✓ purchased or ✕ ignore — is parent-only too: an item stays on the list until a parent does.
// Marked-off items are kept (status, who, when), never deleted, and can be put back on the list.
export const groceryRouter = Router();

/** GET / — what's on the list, oldest first so the newest asks sink to the bottom rather than
 *  jumping to the top and reordering the list while someone's mid-shop. ?done=1 — the marked-off
 *  ones instead, newest first (?limit, default 50). */
groceryRouter.get('/', (req, res) => {
  if (req.query.done) {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));
    return res.json(db.prepare('SELECT * FROM grocery_items WHERE status IS NOT NULL ORDER BY done_at DESC LIMIT ?').all(limit) as GroceryItem[]);
  }
  const items = db.prepare('SELECT * FROM grocery_items WHERE status IS NULL ORDER BY created_at ASC').all() as GroceryItem[];
  res.json(items);
});

/** May whoever's asking add to the list? A parent, or a kid with can_add_grocery. */
function mayAdd(req: Request, actingMemberId: unknown): boolean {
  if (isParentRequest(req, actingMemberId)) return true;
  const actor = sessionMemberId(req.cookies?.[SESSION_COOKIE_NAME] as string | undefined) ?? (typeof actingMemberId === 'string' ? actingMemberId : null);
  return Boolean(actor && db.prepare('SELECT 1 FROM family_members WHERE id = ? AND can_add_grocery = 1').get(actor));
}

groceryRouter.post('/', (req, res) => {
  const { name, quantity, requested_by_id, meal_id, acting_member_id } = req.body as Partial<GroceryItem> & { acting_member_id?: string };
  if (!mayAdd(req, acting_member_id)) return res.status(403).json({ error: 'Ask a parent to let you add to the grocery list (Settings → Kids’ access)' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const item: GroceryItem = {
    id: uuidv4(),
    name: name.trim(),
    quantity: quantity?.trim() || null,
    requested_by_id: requested_by_id ?? null,
    meal_id: meal_id ?? null,
    created_at: new Date().toISOString(),
    status: null,
    done_at: null,
    done_by_id: null,
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
groceryRouter.patch('/:id', requireAdmin, (req, res) => {
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

/** POST /:id/mark { status: 'purchased' | 'ignored' | null, acting_member_id } — a parent marks
 *  it off the list (kept, with who and when), or puts it back on (status null). */
groceryRouter.post('/:id/mark', (req, res) => {
  const body = req.body as { status?: string | null; acting_member_id?: string };
  if (!isParentRequest(req, body.acting_member_id)) return res.status(403).json({ error: 'Only a parent can mark things off the grocery list' });
  const status = body.status === 'purchased' || body.status === 'ignored' ? body.status : null;
  if (body.status != null && !status) return res.status(400).json({ error: "status is 'purchased', 'ignored' or null" });
  const existing = db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(req.params.id) as GroceryItem | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });
  const by = typeof body.acting_member_id === 'string' && body.acting_member_id ? body.acting_member_id : null;
  db.prepare('UPDATE grocery_items SET status = ?, done_at = ?, done_by_id = ? WHERE id = ?').run(
    status,
    status ? new Date().toISOString() : null,
    status ? by : null,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(req.params.id));
});

/** DELETE /:id — kept for older screens: now a parent marking it "purchased" (never a real delete). */
groceryRouter.delete('/:id', (req, res) => {
  const acting = (req.query.acting_member_id as string | undefined) ?? (req.body as { acting_member_id?: string } | undefined)?.acting_member_id;
  if (!isParentRequest(req, acting)) return res.status(403).json({ error: 'Only a parent can mark things off the grocery list' });
  db.prepare("UPDATE grocery_items SET status = 'purchased', done_at = ?, done_by_id = ? WHERE id = ? AND status IS NULL").run(
    new Date().toISOString(),
    acting || null,
    req.params.id
  );
  res.status(204).end();
});
