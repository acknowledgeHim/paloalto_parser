import { Router } from 'express';
import { db } from '../db.js';
import { isParentRequest, isSelfOrParent } from '../services/rewards.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { OUTFIT_ITEMS, OUTFIT_SLOTS, outfitItem, parseOutfit, priceRanges, pricedItem, pricedItems, savePriceRanges, PRICE_MAX, PRICE_MIN } from '../services/outfits.js';
import { addTokens, parentsDressFree } from '../services/tokens.js';
/** 👕 Dress up: the shop, and each person's bought pieces and what they have on. */
export const outfitsRouter = Router();
outfitsRouter.get('/catalog', (_req, res) => {
    res.json({ slots: OUTFIT_SLOTS, items: pricedItems(), prices: priceRanges(), price_limits: { min: PRICE_MIN, max: PRICE_MAX } });
});
/** PUT /prices { slot: { min, max } } — parents: how many 💎 each kind of piece costs (1–10). Pieces already bought keep what was paid. */
outfitsRouter.put('/prices', requireAdmin, (req, res) => {
    savePriceRanges(req.body ?? {});
    res.json({ slots: OUTFIT_SLOTS, items: pricedItems(), prices: priceRanges(), price_limits: { min: PRICE_MIN, max: PRICE_MAX } });
});
function closet(memberId) {
    const member = db.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId);
    if (!member)
        return null;
    const owned = db.prepare('SELECT item_id FROM outfit_items WHERE family_member_id = ?').all(memberId).map((r) => r.item_id);
    // 👑 Parents dress up free (unless turned off in Settings → 💎 Tokens): every piece is theirs to
    // wear (nothing is bought or stored for it). Turned off, they buy pieces like everyone else.
    const free = member.is_parent === 1 && parentsDressFree();
    return { owned: free ? OUTFIT_ITEMS.map((i) => i.id) : owned, bought: owned, free, outfit: parseOutfit(member.avatar_outfit), token_balance: member.token_balance, star_balance: member.star_balance };
}
outfitsRouter.get('/:memberId', (req, res) => {
    const c = closet(req.params.memberId);
    if (!c)
        return res.status(404).json({ error: 'not found' });
    res.json(c);
});
/** POST /:memberId/buy { item_id, acting_member_id } — spends their 💎 tokens and puts it on. */
outfitsRouter.post('/:memberId/buy', (req, res) => {
    const { memberId } = req.params;
    const { item_id, acting_member_id } = req.body ?? {};
    if (!isSelfOrParent(req, memberId, acting_member_id))
        return res.status(403).json({ error: 'Only they or a parent can spend their tokens' });
    const item = pricedItem(String(item_id));
    if (!item)
        return res.status(400).json({ error: 'No such outfit piece' });
    const c = closet(memberId);
    if (!c)
        return res.status(404).json({ error: 'not found' });
    if (c.owned.includes(item.id))
        return res.status(400).json({ error: c.free ? 'Parents can wear everything free' : 'Already have it' });
    if (c.token_balance < item.stars)
        return res.status(400).json({ error: `Needs ${item.stars} 💎 — ${item.stars - c.token_balance} more to go` });
    db.transaction(() => {
        addTokens(memberId, -item.stars, `👕 Bought: ${item.emoji} ${item.name}`, typeof acting_member_id === 'string' ? acting_member_id : null);
        db.prepare("INSERT INTO outfit_items (family_member_id, item_id, stars, bought_at, currency) VALUES (?, ?, ?, ?, 'tokens')").run(memberId, item.id, item.stars, new Date().toISOString());
        db.prepare('UPDATE family_members SET avatar_outfit = ? WHERE id = ?').run(JSON.stringify({ ...c.outfit, [item.slot]: item.id }), memberId);
    })();
    res.json(closet(memberId));
});
/** PUT /:memberId/wear { slot, item_id (null = take it off), acting_member_id } */
outfitsRouter.put('/:memberId/wear', (req, res) => {
    const { memberId } = req.params;
    const { slot, item_id, acting_member_id } = req.body ?? {};
    if (!isSelfOrParent(req, memberId, acting_member_id))
        return res.status(403).json({ error: 'Only they or a parent can change their outfit' });
    const c = closet(memberId);
    if (!c)
        return res.status(404).json({ error: 'not found' });
    if (!OUTFIT_SLOTS.some((s) => s.id === slot))
        return res.status(400).json({ error: 'No such slot' });
    const outfit = { ...c.outfit };
    if (item_id) {
        const item = outfitItem(String(item_id));
        if (!item || item.slot !== slot || !c.owned.includes(item.id))
            return res.status(400).json({ error: "They don't have that one" });
        outfit[item.slot] = item.id;
    }
    else {
        delete outfit[slot];
    }
    db.prepare('UPDATE family_members SET avatar_outfit = ? WHERE id = ?').run(JSON.stringify(outfit), memberId);
    res.json(closet(memberId));
});
/** POST /:memberId/refund { item_id, acting_member_id } — parents: give back what it cost (💎, or ⭐ if bought before tokens) and take it away. */
outfitsRouter.post('/:memberId/refund', (req, res) => {
    const { memberId } = req.params;
    const { item_id, acting_member_id } = req.body ?? {};
    if (!isParentRequest(req, acting_member_id))
        return res.status(403).json({ error: 'Only a parent can do that' });
    const row = db.prepare('SELECT * FROM outfit_items WHERE family_member_id = ? AND item_id = ?').get(memberId, item_id);
    const c = closet(memberId);
    if (!row || !c)
        return res.status(404).json({ error: 'not found' });
    const outfit = Object.fromEntries(Object.entries(c.outfit).filter(([, v]) => v !== item_id));
    db.transaction(() => {
        db.prepare('DELETE FROM outfit_items WHERE family_member_id = ? AND item_id = ?').run(memberId, item_id);
        db.prepare('UPDATE family_members SET avatar_outfit = ? WHERE id = ?').run(JSON.stringify(outfit), memberId);
        const item = outfitItem(String(item_id));
        if (row.currency === 'tokens')
            addTokens(memberId, row.stars, `👕 Refund: ${item ? `${item.emoji} ${item.name}` : item_id}`, typeof acting_member_id === 'string' ? acting_member_id : null);
        else
            db.prepare('UPDATE family_members SET star_balance = star_balance + ? WHERE id = ?').run(row.stars, memberId);
    })();
    res.json(closet(memberId));
});
