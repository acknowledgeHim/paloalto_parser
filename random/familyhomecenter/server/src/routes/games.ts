import { Router } from 'express';
import { countTime, limitHit } from '../services/dailyLimits.js';
import { v4 as uuidv4 } from 'uuid';
import { db, getSetting, setSetting } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { GAMES, gameOf } from '../services/games.js';
import { isParentRequest, isSelfOrParent } from '../services/rewards.js';
import type { FamilyMember } from '../types.js';
import { addTokens } from '../services/tokens.js';

/** 🎮 Games: unlock with 💎 tokens (parents play free), play, keep best runs and progress. */
export const gamesRouter = Router();

const memberOf = (id: string) => db.prepare('SELECT * FROM family_members WHERE id = ?').get(id) as FamilyMember | undefined;
const unlockedFor = (m: FamilyMember) =>
  new Set((db.prepare('SELECT game_id FROM game_unlocks WHERE family_member_id = ?').all(m.id) as Array<{ game_id: string }>).map((r) => r.game_id));
const free = (m: FamilyMember) => m.is_parent === 1;
const best = (memberId: string, gameId: string) =>
  (db.prepare('SELECT MAX(score) AS s FROM game_scores WHERE family_member_id = ? AND game_id = ?').get(memberId, gameId) as { s: number | null }).s;

/** 🎟️ Plays a parent gave them: game id → how many are left (a row with 0 = had some, all used). */
const passesFor = (memberId: string) =>
  new Map((db.prepare('SELECT game_id, plays_left FROM game_passes WHERE family_member_id = ?').all(memberId) as Array<{ game_id: string; plays_left: number }>).map((r) => [r.game_id, r.plays_left]));

// ---- ⚙️ per game (parents): what unlocking costs, and how many plays it's good for ----
/** plays: 0 = an unlock is for good; N = unlocking gives N plays, then they unlock it again. cost: 💎 (default: the game's price). */
interface GameRule {
  cost: number;
  plays: number;
  /** 🔓 each extra's price in 💎 (0 = free for everyone) */
  features: Record<string, number>;
  /** 💎 each token-shop item's price (0 = free for everyone) */
  shop: Record<string, number>;
}
const RULES_KEY = 'game_rules';
function rules(): Record<string, GameRule> {
  let saved: Record<string, Partial<GameRule>> = {};
  try {
    saved = JSON.parse(getSetting(RULES_KEY, '{}'));
  } catch {
    /* defaults */
  }
  const n = (v: unknown, d: number) => (v !== undefined && v !== null && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10000 ? Math.round(Number(v)) : d);
  return Object.fromEntries(
    GAMES.map((g) => [
      g.id,
      {
        cost: n(saved[g.id]?.cost, g.stars),
        plays: n(saved[g.id]?.plays, 0),
        features: Object.fromEntries((g.features ?? []).map((f) => [f.id, n(saved[g.id]?.features?.[f.id], f.cost)])),
        shop: Object.fromEntries((g.shop ?? []).map((f) => [f.id, n(saved[g.id]?.shop?.[f.id], f.cost)])),
      },
    ])
  );
}
const ruleOf = (gameId: string): GameRule => rules()[gameId] ?? { cost: 0, plays: 0, features: {}, shop: {} };

/** GET /settings — each game's cost and plays per unlock. */
gamesRouter.get('/settings', (_req, res) => res.json(rules()));
/** PUT /settings { [gameId]: { cost, plays } } (parents). Unlocks already bought for good stay theirs (a parent can refund them). */
gamesRouter.put('/settings', requireAdmin, (req, res) => {
  if (!isParentRequest(req, req.body?.acting_member_id)) return res.status(403).json({ error: 'Only a parent can set what games cost' });
  const cur = rules();
  const b = (req.body ?? {}) as Record<string, Partial<GameRule>>;
  for (const g of GAMES) {
    const x = b[g.id];
    if (!x) continue;
    for (const k of ['cost', 'plays'] as const) {
      if (x[k] === undefined) continue;
      const v = Math.round(Number(x[k]));
      if (!(v >= 0 && v <= 10000)) return res.status(400).json({ error: `${g.name}: ${k === 'cost' ? 'cost' : 'plays'} must be 0–10000` });
      cur[g.id][k] = v;
    }
    for (const f of g.features ?? []) {
      const v0 = x.features?.[f.id];
      if (v0 === undefined) continue;
      const v = Math.round(Number(v0));
      if (!(v >= 0 && v <= 10000)) return res.status(400).json({ error: `${g.name} ${f.name}: 0–10000` });
      cur[g.id].features[f.id] = v;
    }
    for (const f of g.shop ?? []) {
      const v0 = x.shop?.[f.id];
      if (v0 === undefined) continue;
      const v = Math.round(Number(v0));
      if (!(v >= 0 && v <= 10000)) return res.status(400).json({ error: `${g.name} ${f.name}: 0–10000` });
      cur[g.id].shop[f.id] = v;
    }
  }
  setSetting(RULES_KEY, JSON.stringify(cur));
  res.json(cur);
});

function shelf(m: FamilyMember) {
  const mine = unlockedFor(m);
  const passes = passesFor(m.id);
  return {
    token_balance: m.token_balance,
    plays_free: free(m),
    games: GAMES.map((g) => {
      const owned = free(m) || mine.has(g.id);
      const plays = passes.get(g.id) ?? null;
      const r = ruleOf(g.id);
      return { ...g, stars: r.cost, plays_per_unlock: r.plays, owned, plays_left: owned ? null : plays, unlocked: owned || (plays ?? 0) > 0, best: best(m.id, g.id) };
    }),
  };
}

/** GET /?member=ID — the games, which ones they can play, their best scores. */
gamesRouter.get('/', (req, res) => {
  const m = memberOf(String(req.query.member ?? ''));
  if (!m) return res.json({ token_balance: 0, plays_free: false, games: GAMES.map((g) => ({ ...g, unlocked: false, best: null })) });
  res.json(shelf(m));
});

/**
 * POST /:memberId/unlock { game_id, acting_member_id } — spend their 💎 tokens on a game: for good, or (if a
 * parent set plays per unlock) for that many 🎟️ plays — when they're used up, they unlock it again.
 */
gamesRouter.post('/:memberId/unlock', (req, res) => {
  const { memberId } = req.params;
  const { game_id, acting_member_id } = req.body ?? {};
  if (!isSelfOrParent(req, memberId, acting_member_id)) return res.status(403).json({ error: 'Only they or a parent can spend their tokens' });
  const g = gameOf(String(game_id));
  const m = memberOf(memberId);
  if (!g || !m) return res.status(404).json({ error: 'not found' });
  if (free(m) || unlockedFor(m).has(g.id)) return res.json(shelf(m));
  const r = ruleOf(g.id);
  if (m.token_balance < r.cost) return res.status(400).json({ error: `Needs ${r.cost} 💎 — ${r.cost - m.token_balance} more to go` });
  const by = typeof acting_member_id === 'string' ? acting_member_id : null;
  const now = new Date().toISOString();
  db.transaction(() => {
    if (r.plays > 0) {
      addTokens(m.id, -r.cost, `🎮 ${r.plays} play${r.plays === 1 ? '' : 's'}: ${g.emoji} ${g.name}`, by);
      db.prepare(
        `INSERT INTO game_passes (family_member_id, game_id, plays_left, given_by, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(family_member_id, game_id) DO UPDATE SET plays_left = plays_left + excluded.plays_left, given_by = excluded.given_by, updated_at = excluded.updated_at`
      ).run(m.id, g.id, r.plays, by, now);
    } else {
      addTokens(m.id, -r.cost, `🎮 Unlocked: ${g.emoji} ${g.name}`, by);
      db.prepare("INSERT INTO game_unlocks (family_member_id, game_id, stars, unlocked_at, currency) VALUES (?, ?, ?, ?, 'tokens')").run(m.id, g.id, r.cost, now);
    }
  })();
  res.json(shelf(memberOf(m.id)!));
});

/** POST /:memberId/refund { game_id, acting_member_id } — parents: give back what it cost (💎, or ⭐ if before tokens) and lock it again (scores and progress are kept). */
gamesRouter.post('/:memberId/refund', (req, res) => {
  const { memberId } = req.params;
  const { game_id, acting_member_id } = req.body ?? {};
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can do that' });
  const row = db.prepare('SELECT stars, currency FROM game_unlocks WHERE family_member_id = ? AND game_id = ?').get(memberId, game_id) as
    | { stars: number; currency: string | null }
    | undefined;
  if (!row) return res.status(404).json({ error: 'not found' });
  db.transaction(() => {
    db.prepare('DELETE FROM game_unlocks WHERE family_member_id = ? AND game_id = ?').run(memberId, game_id);
    const g = gameOf(String(game_id));
    if (row.currency === 'tokens') addTokens(memberId, row.stars, `🎮 Refund: ${g ? `${g.emoji} ${g.name}` : game_id}`, typeof acting_member_id === 'string' ? acting_member_id : null);
    else db.prepare('UPDATE family_members SET star_balance = star_balance + ? WHERE id = ?').run(row.stars, memberId);
  })();
  res.json(shelf(memberOf(memberId)!));
});

/** Can they open the game (garage, saving a run)? Bought, free, or ever given plays (even if used up — so a last run still saves). */
function mayPlay(m: FamilyMember, gameId: string) {
  return free(m) || unlockedFor(m).has(gameId) || passesFor(m.id).has(gameId);
}

/** POST /:memberId/passes { game_id, plays, mode: 'add' | 'set', acting_member_id } (parents) — 🎟️ give a kid a number of plays. */
gamesRouter.post('/:memberId/passes', (req, res) => {
  const { memberId } = req.params;
  const { game_id, plays, mode, acting_member_id } = req.body ?? {};
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can do that' });
  const g = gameOf(String(game_id));
  const m = memberOf(memberId);
  if (!g || !m) return res.status(404).json({ error: 'not found' });
  const n = Math.round(Number(plays));
  if (!Number.isFinite(n) || n < 0 || n > 1000) return res.status(400).json({ error: 'How many plays? (0–1000)' });
  const now = new Date().toISOString();
  const by = typeof acting_member_id === 'string' ? acting_member_id : null;
  if (mode === 'set') {
    db.prepare(
      `INSERT INTO game_passes (family_member_id, game_id, plays_left, given_by, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(family_member_id, game_id) DO UPDATE SET plays_left = excluded.plays_left, given_by = excluded.given_by, updated_at = excluded.updated_at`
    ).run(m.id, g.id, n, by, now);
  } else {
    db.prepare(
      `INSERT INTO game_passes (family_member_id, game_id, plays_left, given_by, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(family_member_id, game_id) DO UPDATE SET plays_left = plays_left + excluded.plays_left, given_by = excluded.given_by, updated_at = excluded.updated_at`
    ).run(m.id, g.id, n, by, now);
  }
  res.json(shelf(m));
});

/** POST /:gameId/play/:memberId/start { acting_member_id } — a run is starting: uses up one 🎟️ play unless the game is theirs. */
gamesRouter.post('/:gameId/play/:memberId/start', (req, res) => {
  const { gameId, memberId } = req.params;
  if (!isSelfOrParent(req, memberId, req.body?.acting_member_id)) return res.status(403).json({ error: 'Only they or a parent can play as them' });
  const g = gameOf(gameId);
  const m = memberOf(memberId);
  if (!g || !m) return res.status(404).json({ error: 'not found' });
  // ⏰ a parent's daily limit for this game (checked first, so a play isn't used up for nothing)
  const over = limitHit(m.id, `game:${g.id}`);
  if (over) return res.status(429).json({ error: over, limit: true });
  if (free(m) || unlockedFor(m).has(g.id)) {
    countTime(m.id, `game:${g.id}`);
    return res.json({ ok: true, plays_left: null });
  }
  const r = db
    .prepare('UPDATE game_passes SET plays_left = plays_left - 1, updated_at = ? WHERE family_member_id = ? AND game_id = ? AND plays_left > 0')
    .run(new Date().toISOString(), m.id, g.id);
  if (r.changes === 0) return res.status(403).json({ error: `No plays left — unlock ${g.name} again (${ruleOf(g.id).cost} 💎), or ask a parent for more plays` });
  countTime(m.id, `game:${g.id}`);
  res.json({ ok: true, plays_left: passesFor(m.id).get(g.id) ?? 0 });
});

/**
 * 🔓 Each extra: its price and whether they have it — bought, free (price 0 or a parent), or
 * already switched on in their saved game from before extras had a price (that stays theirs).
 */
function featuresFor(m: FamilyMember, gameId: string, save: unknown) {
  const g = gameOf(gameId);
  const bought = new Set(
    (db.prepare('SELECT feature FROM game_features WHERE family_member_id = ? AND game_id = ?').all(m.id, gameId) as Array<{ feature: string }>).map((x) => x.feature)
  );
  const sv = (save ?? {}) as { jump?: boolean; obstacles?: unknown[] };
  const had = new Set<string>();
  if (sv.jump) had.add('jump');
  if (Array.isArray(sv.obstacles) && sv.obstacles.length) had.add('obstacles');
  // Had it on before it had a price: theirs for good (kept, so turning it off doesn't lose it).
  for (const f of had)
    if (!bought.has(f) && g?.features?.some((x) => x.id === f)) {
      db.prepare('INSERT OR IGNORE INTO game_features (family_member_id, game_id, feature, cost, unlocked_at) VALUES (?, ?, ?, 0, ?)').run(m.id, gameId, f, new Date().toISOString());
      bought.add(f);
    }
  const prices = ruleOf(gameId).features;
  return Object.fromEntries(
    (g?.features ?? []).map((f) => {
      const cost = prices[f.id] ?? f.cost;
      return [f.id, { name: f.name, cost, owned: free(m) || cost === 0 || bought.has(f.id) }];
    })
  );
}

/** 💎 The token shop: each item's price for them (parents: free) and the coins it gives. */
function shopFor(m: FamilyMember, gameId: string) {
  const prices = ruleOf(gameId).shop;
  return Object.fromEntries((gameOf(gameId)?.shop ?? []).map((f) => [f.id, { name: f.name, cost: free(m) ? 0 : (prices[f.id] ?? f.cost), coins: f.coins ?? 0 }]));
}

/**
 * POST /:gameId/play/:memberId/buy { item, acting_member_id } — 💎 buy something in the game's token
 * shop (each time: a bag of coins, a special building). Answers with what it gives and their balance.
 */
gamesRouter.post('/:gameId/play/:memberId/buy', (req, res) => {
  const { gameId, memberId } = req.params;
  const { item, acting_member_id } = req.body ?? {};
  if (!isSelfOrParent(req, memberId, acting_member_id)) return res.status(403).json({ error: 'Only they or a parent can spend their tokens' });
  const g = gameOf(gameId);
  const m = memberOf(memberId);
  if (!g || !m) return res.status(404).json({ error: 'not found' });
  if (!mayPlay(m, g.id)) return res.status(403).json({ error: 'Unlock it first' });
  const it = shopFor(m, g.id)[String(item)];
  if (!it) return res.status(404).json({ error: 'No such thing in the shop' });
  if (m.token_balance < it.cost) return res.status(400).json({ error: `Needs ${it.cost} 💎 — ${it.cost - m.token_balance} more to go` });
  db.transaction(() => {
    if (it.cost) addTokens(m.id, -it.cost, `💎 ${g.emoji} ${g.name}: ${it.name}`, typeof acting_member_id === 'string' ? acting_member_id : null);
    db.prepare('INSERT INTO game_purchases (id, family_member_id, game_id, item, cost, bought_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      uuidv4(),
      m.id,
      g.id,
      String(item),
      it.cost,
      new Date().toISOString()
    );
  })();
  res.json({ item: String(item), coins: it.coins, cost: it.cost, token_balance: memberOf(m.id)!.token_balance });
});

/** POST /:gameId/play/:memberId/feature { feature, acting_member_id } — 🔓 buy an extra with 💎. */
gamesRouter.post('/:gameId/play/:memberId/feature', (req, res) => {
  const { gameId, memberId } = req.params;
  const { feature, acting_member_id } = req.body ?? {};
  if (!isSelfOrParent(req, memberId, acting_member_id)) return res.status(403).json({ error: 'Only they or a parent can spend their tokens' });
  const g = gameOf(gameId);
  const m = memberOf(memberId);
  if (!g || !m) return res.status(404).json({ error: 'not found' });
  const f = g.features?.find((x) => x.id === feature);
  if (!f) return res.status(404).json({ error: 'No such extra' });
  const save = db.prepare('SELECT data FROM game_saves WHERE family_member_id = ? AND game_id = ?').get(m.id, g.id) as { data: string } | undefined;
  let data: unknown = null;
  try {
    data = save ? JSON.parse(save.data) : null;
  } catch {
    data = null;
  }
  const now = featuresFor(m, g.id, data);
  if (now[f.id]?.owned) return res.json({ features: now, token_balance: m.token_balance });
  const cost = now[f.id].cost;
  if (m.token_balance < cost) return res.status(400).json({ error: `Needs ${cost} 💎 — ${cost - m.token_balance} more to go` });
  db.transaction(() => {
    addTokens(m.id, -cost, `🔓 ${g.emoji} ${g.name}: ${f.name}`, typeof acting_member_id === 'string' ? acting_member_id : null);
    db.prepare('INSERT OR IGNORE INTO game_features (family_member_id, game_id, feature, cost, unlocked_at) VALUES (?, ?, ?, ?, ?)').run(m.id, g.id, f.id, cost, new Date().toISOString());
  })();
  const after = memberOf(m.id)!;
  res.json({ features: featuresFor(after, g.id, data), token_balance: after.token_balance });
});

/** GET /:gameId/play/:memberId — their saved progress, best score and the family's top runs. */
gamesRouter.get('/:gameId/play/:memberId', (req, res) => {
  const g = gameOf(req.params.gameId);
  const m = memberOf(req.params.memberId);
  if (!g || !m) return res.status(404).json({ error: 'not found' });
  if (!mayPlay(m, g.id)) return res.status(403).json({ error: `Unlock ${g.name} first (${ruleOf(g.id).cost} 💎), or ask a parent for some plays` });
  const save = db.prepare('SELECT data FROM game_saves WHERE family_member_id = ? AND game_id = ?').get(m.id, g.id) as { data: string } | undefined;
  const top = db
    .prepare(
      `SELECT s.family_member_id AS member_id, MAX(s.score) AS score FROM game_scores s WHERE s.game_id = ?
       GROUP BY s.family_member_id ORDER BY score DESC LIMIT 10`
    )
    .all(g.id);
  let data: unknown = null;
  try {
    data = save ? JSON.parse(save.data) : null;
  } catch {
    data = null;
  }
  const owned = free(m) || unlockedFor(m).has(g.id);
  res.json({ game: g, save: data, best: best(m.id, g.id), top, owned, plays_left: owned ? null : passesFor(m.id).get(g.id) ?? 0, features: featuresFor(m, g.id, data), shop: shopFor(m, g.id), token_balance: m.token_balance });
});

/** POST /:gameId/play/:memberId/result { score, detail, save, acting_member_id } — a finished run, and progress to keep. */
gamesRouter.post('/:gameId/play/:memberId/result', (req, res) => {
  const { gameId, memberId } = req.params;
  const { score, detail, save, acting_member_id } = req.body ?? {};
  if (!isSelfOrParent(req, memberId, acting_member_id)) return res.status(403).json({ error: 'Only they or a parent can play as them' });
  const g = gameOf(gameId);
  const m = memberOf(memberId);
  if (!g || !m) return res.status(404).json({ error: 'not found' });
  if (!mayPlay(m, g.id)) return res.status(403).json({ error: 'Unlock it first' });
  const now = new Date().toISOString();
  const s = Math.round(Number(score));
  if (Number.isFinite(s) && s > 0 && s < 1e9) {
    db.prepare('INSERT INTO game_scores (id, family_member_id, game_id, score, detail, played_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      uuidv4(),
      m.id,
      g.id,
      s,
      detail ? JSON.stringify(detail).slice(0, 2000) : null,
      now
    );
  }
  if (save && typeof save === 'object') {
    const data = JSON.stringify(save);
    if (data.length > 20_000) return res.status(400).json({ error: 'Too much to save' });
    db.prepare(
      `INSERT INTO game_saves (family_member_id, game_id, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(family_member_id, game_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).run(m.id, g.id, data, now);
  }
  res.json({ best: best(m.id, g.id) });
});
