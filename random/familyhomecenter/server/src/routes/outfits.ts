import { Router } from 'express';
import { db } from '../db.js';
import { isParentRequest, isSelfOrParent } from '../services/rewards.js';
import { OUTFIT_ITEMS, OUTFIT_SLOTS, outfitItem, parseOutfit } from '../services/outfits.js';
import type { FamilyMember } from '../types.js';

/** 👕 Dress up: the shop, and each person's bought pieces and what they have on. */
export const outfitsRouter = Router();

outfitsRouter.get('/catalog', (_req, res) => {
  res.json({ slots: OUTFIT_SLOTS, items: OUTFIT_ITEMS });
});

function closet(memberId: string) {
  const member = db.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId) as FamilyMember | undefined;
  if (!member) return null;
  const owned = (db.prepare('SELECT item_id FROM outfit_items WHERE family_member_id = ?').all(memberId) as Array<{ item_id: string }>).map(
    (r) => r.item_id
  );
  return { owned, outfit: parseOutfit(member.avatar_outfit), star_balance: member.star_balance };
}

outfitsRouter.get('/:memberId', (req, res) => {
  const c = closet(req.params.memberId);
  if (!c) return res.status(404).json({ error: 'not found' });
  res.json(c);
});

/** POST /:memberId/buy { item_id, acting_member_id } — spends their stars and puts it on. */
outfitsRouter.post('/:memberId/buy', (req, res) => {
  const { memberId } = req.params;
  const { item_id, acting_member_id } = req.body ?? {};
  if (!isSelfOrParent(req, memberId, acting_member_id)) return res.status(403).json({ error: 'Only they or a parent can spend their stars' });
  const item = outfitItem(String(item_id));
  if (!item) return res.status(400).json({ error: 'No such outfit piece' });
  const c = closet(memberId);
  if (!c) return res.status(404).json({ error: 'not found' });
  if (c.owned.includes(item.id)) return res.status(400).json({ error: 'Already have it' });
  if (c.star_balance < item.stars) return res.status(400).json({ error: `Needs ${item.stars} ⭐ — ${item.stars - c.star_balance} more to go` });
  db.transaction(() => {
    db.prepare('UPDATE family_members SET star_balance = star_balance - ? WHERE id = ?').run(item.stars, memberId);
    db.prepare('INSERT INTO outfit_items (family_member_id, item_id, stars, bought_at) VALUES (?, ?, ?, ?)').run(
      memberId,
      item.id,
      item.stars,
      new Date().toISOString()
    );
    db.prepare('UPDATE family_members SET avatar_outfit = ? WHERE id = ?').run(JSON.stringify({ ...c.outfit, [item.slot]: item.id }), memberId);
  })();
  res.json(closet(memberId));
});

/** PUT /:memberId/wear { slot, item_id (null = take it off), acting_member_id } */
outfitsRouter.put('/:memberId/wear', (req, res) => {
  const { memberId } = req.params;
  const { slot, item_id, acting_member_id } = req.body ?? {};
  if (!isSelfOrParent(req, memberId, acting_member_id)) return res.status(403).json({ error: 'Only they or a parent can change their outfit' });
  const c = closet(memberId);
  if (!c) return res.status(404).json({ error: 'not found' });
  if (!OUTFIT_SLOTS.some((s) => s.id === slot)) return res.status(400).json({ error: 'No such slot' });
  const outfit = { ...c.outfit };
  if (item_id) {
    const item = outfitItem(String(item_id));
    if (!item || item.slot !== slot || !c.owned.includes(item.id)) return res.status(400).json({ error: "They don't have that one" });
    outfit[item.slot] = item.id;
  } else {
    delete outfit[slot as keyof typeof outfit];
  }
  db.prepare('UPDATE family_members SET avatar_outfit = ? WHERE id = ?').run(JSON.stringify(outfit), memberId);
  res.json(closet(memberId));
});

/** POST /:memberId/refund { item_id, acting_member_id } — parents: give the stars back and take it away. */
outfitsRouter.post('/:memberId/refund', (req, res) => {
  const { memberId } = req.params;
  const { item_id, acting_member_id } = req.body ?? {};
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can do that' });
  const row = db.prepare('SELECT * FROM outfit_items WHERE family_member_id = ? AND item_id = ?').get(memberId, item_id) as
    | { stars: number }
    | undefined;
  const c = closet(memberId);
  if (!row || !c) return res.status(404).json({ error: 'not found' });
  const outfit = Object.fromEntries(Object.entries(c.outfit).filter(([, v]) => v !== item_id));
  db.transaction(() => {
    db.prepare('DELETE FROM outfit_items WHERE family_member_id = ? AND item_id = ?').run(memberId, item_id);
    db.prepare('UPDATE family_members SET star_balance = star_balance + ?, avatar_outfit = ? WHERE id = ?').run(row.stars, JSON.stringify(outfit), memberId);
  })();
  res.json(closet(memberId));
});
