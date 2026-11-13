import { Router } from 'express';
import { countTime, limitHit } from '../services/dailyLimits.js';
import { v4 as uuidv4 } from 'uuid';
import { db, getSetting, setSetting } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { GAMES, PRIZE_SUBJECTS, gameOf, type PrizeSubject } from '../services/games.js';
import { subjectMastery } from './lessons.js';
import { GRADE_NAMES, WORDS } from '../services/spellingWords.js';
import { misspell } from '../services/spellcheckGen.js';
import { isParentRequest, isSelfOrParent } from '../services/rewards.js';
import type { FamilyMember } from '../types.js';
import { addTokens } from '../services/tokens.js';

/** 🎮 Games: unlock with 💎 tokens (parents play free), play, keep best runs and progress. */
export const gamesRouter = Router();

const memberOf = (id: string) => db.prepare('SELECT * FROM family_members WHERE id = ?').get(id) as FamilyMember | undefined;
/** An unlock a parent 🔒 locked again (game_unlock_ends) doesn't count any more. */
const NOT_ENDED = 'NOT EXISTS (SELECT 1 FROM game_unlock_ends e WHERE e.family_member_id = u.family_member_id AND e.game_id = u.game_id AND e.unlocked_at = u.unlocked_at)';
const unlockedFor = (m: FamilyMember) =>
  new Set((db.prepare(`SELECT game_id FROM game_unlocks u WHERE family_member_id = ? AND ${NOT_ENDED}`).all(m.id) as Array<{ game_id: string }>).map((r) => r.game_id));
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
  /** 🏆 each prize power: which lessons earn it, uses per earning (0 = unlimited), free for parents */
  prizes: Record<string, PrizeRule>;
  /** 🙈 hidden from kids: not on their Games page, can't be unlocked or played (what they already have is kept for if it's shown again) */
  hidden: boolean;
}
interface PrizeRule {
  subject: PrizeSubject;
  uses: number;
  parents_free: boolean;
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
        hidden: saved[g.id]?.hidden === true,
        features: Object.fromEntries((g.features ?? []).map((f) => [f.id, n(saved[g.id]?.features?.[f.id], f.cost)])),
        shop: Object.fromEntries((g.shop ?? []).map((f) => [f.id, n(saved[g.id]?.shop?.[f.id], f.cost)])),
        prizes: Object.fromEntries(
          (g.prizes ?? []).map((p) => {
            const x = saved[g.id]?.prizes?.[p.id];
            return [
              p.id,
              {
                subject: PRIZE_SUBJECTS.includes(x?.subject as PrizeSubject) ? (x!.subject as PrizeSubject) : p.subject,
                uses: n(x?.uses, p.uses),
                parents_free: x?.parents_free === undefined ? true : x.parents_free === true,
              },
            ];
          })
        ),
      },
    ])
  );
}
const ruleOf = (gameId: string): GameRule => rules()[gameId] ?? { cost: 0, plays: 0, features: {}, shop: {}, prizes: {}, hidden: false };
/** 🙈 a game a parent hid from kids (parents still see and play everything) */
const hiddenFor = (m: FamilyMember, gameId: string) => !free(m) && ruleOf(gameId).hidden;
const HIDDEN_MSG = 'A parent has turned that game off for now';

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
    if (x.hidden !== undefined) cur[g.id].hidden = x.hidden === true;
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
    for (const p of g.prizes ?? []) {
      const y = x.prizes?.[p.id];
      if (!y) continue;
      if (y.subject !== undefined) {
        if (!PRIZE_SUBJECTS.includes(y.subject)) return res.status(400).json({ error: `${g.name} ${p.name}: pick a subject` });
        cur[g.id].prizes[p.id].subject = y.subject;
      }
      if (y.uses !== undefined) {
        const v = Math.round(Number(y.uses));
        if (!(v >= 0 && v <= 1000)) return res.status(400).json({ error: `${g.name} ${p.name}: uses 0–1000 (0 = unlimited)` });
        cur[g.id].prizes[p.id].uses = v;
      }
      if (y.parents_free !== undefined) cur[g.id].prizes[p.id].parents_free = y.parents_free === true;
    }
  }
  setSetting(RULES_KEY, JSON.stringify(cur));
  res.json(cur);
});

function shelf(m: FamilyMember) {
  const mine = unlockedFor(m);
  const passes = passesFor(m.id);
  const all = rules();
  return {
    token_balance: m.token_balance,
    plays_free: free(m),
    // 🙈 games a parent hid aren't shown to kids at all
    games: GAMES.filter((g) => free(m) || !all[g.id]?.hidden).map((g) => {
      const owned = free(m) || mine.has(g.id);
      const plays = passes.get(g.id) ?? null;
      const r = ruleOf(g.id);
      // 🏆 prize powers: earned or not, uses left, lesson progress (shown on the game's card)
      return { ...g, stars: r.cost, plays_per_unlock: r.plays, hidden: r.hidden, owned, plays_left: owned ? null : plays, unlocked: owned || (plays ?? 0) > 0, best: best(m.id, g.id), prize_status: prizesFor(m, g.id) };
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
  if (hiddenFor(m, g.id)) return res.status(403).json({ error: HIDDEN_MSG });
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
      // (an old unlock a parent locked again is reused: its end stays recorded in game_unlock_ends)
      db.prepare(
        `INSERT INTO game_unlocks (family_member_id, game_id, stars, unlocked_at, currency) VALUES (?, ?, ?, ?, 'tokens')
         ON CONFLICT(family_member_id, game_id) DO UPDATE SET stars = excluded.stars, unlocked_at = excluded.unlocked_at, currency = excluded.currency`
      ).run(m.id, g.id, r.cost, now);
    }
  })();
  res.json(shelf(memberOf(m.id)!));
});

/** POST /:memberId/refund { game_id, acting_member_id } — parents: give back what it cost (💎, or ⭐ if before tokens) and lock it again (scores and progress are kept). */
gamesRouter.post('/:memberId/refund', (req, res) => {
  const { memberId } = req.params;
  const { game_id, acting_member_id } = req.body ?? {};
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can do that' });
  const row = db.prepare(`SELECT stars, currency FROM game_unlocks u WHERE family_member_id = ? AND game_id = ? AND ${NOT_ENDED}`).get(memberId, game_id) as
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

/**
 * POST /:memberId/relock { game_id, plays, acting_member_id } (parents) — 🔒 a game they unlocked for good
 * goes back to locked, with no refund; plays > 0 gives them that many 🎟️ plays instead (e.g. what one
 * unlock is worth now). Scores, towns and extras are kept.
 */
gamesRouter.post('/:memberId/relock', (req, res) => {
  const { memberId } = req.params;
  const { game_id, plays, acting_member_id } = req.body ?? {};
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can do that' });
  const g = gameOf(String(game_id));
  const m = memberOf(memberId);
  if (!g || !m) return res.status(404).json({ error: 'not found' });
  const row = db.prepare(`SELECT unlocked_at FROM game_unlocks u WHERE family_member_id = ? AND game_id = ? AND ${NOT_ENDED}`).get(m.id, g.id) as { unlocked_at: string } | undefined;
  if (!row) return res.status(404).json({ error: `${m.name} hasn't unlocked ${g.name} for good` });
  const n = Math.round(Number(plays ?? 0));
  if (!Number.isFinite(n) || n < 0 || n > 1000) return res.status(400).json({ error: 'How many plays? (0–1000)' });
  const now = new Date().toISOString();
  const by = typeof acting_member_id === 'string' ? acting_member_id : null;
  db.transaction(() => {
    db.prepare('INSERT INTO game_unlock_ends (id, family_member_id, game_id, unlocked_at, ended_at, ended_by, plays_given) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      uuidv4(),
      m.id,
      g.id,
      row.unlocked_at,
      now,
      by,
      n
    );
    if (n > 0)
      db.prepare(
        `INSERT INTO game_passes (family_member_id, game_id, plays_left, given_by, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(family_member_id, game_id) DO UPDATE SET plays_left = plays_left + excluded.plays_left, given_by = excluded.given_by, updated_at = excluded.updated_at`
      ).run(m.id, g.id, n, by, now);
  })();
  res.json(shelf(memberOf(m.id)!));
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
  if (hiddenFor(m, g.id)) return res.status(403).json({ error: HIDDEN_MSG });
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

// ---- 🏆 prize powers: earned by passing every lesson in a subject at your grade ----
const SUBJECT_NAME: Record<string, string> = { math: '➗ Math', grammar: '📝 Grammar', history: '🇺🇸 History', science: '🔬 Science', handson: '🔧 Hands-on' };
const LESSON_SUBJECTS = ['math', 'grammar', 'history', 'science'] as const;
export interface PrizeStatus {
  name: string;
  blurb: string;
  unit: string;
  subject: PrizeSubject;
  /** uses each earning gives (0 = unlimited) */
  uses_per: number;
  parents_free: boolean;
  /** a parent trying it out free */
  free: boolean;
  earned: boolean;
  unlimited: boolean;
  /** uses left (null: free or unlimited) */
  left: number | null;
  /** can it be switched on now */
  ready: boolean;
  /** 📚 where they are in each subject that earns it, at their grade */
  progress: Array<{ subject: string; label: string; grade: string; passed: number; total: number; done: boolean }>;
  /** why a kid can't earn it yet (no grade set) */
  note: string | null;
}

/** Their prize powers in this game — and any they've just earned get handed out (once per subject per grade). */
function prizesFor(m: FamilyMember, gameId: string): Record<string, PrizeStatus> {
  const g = gameOf(gameId);
  const rs = ruleOf(gameId).prizes;
  const out: Record<string, PrizeStatus> = {};
  for (const p of g?.prizes ?? []) {
    const r = rs[p.id] ?? { subject: p.subject, uses: p.uses, parents_free: true };
    const subjects = r.subject === 'any' || r.subject === 'all' ? [...LESSON_SUBJECTS] : [r.subject];
    // (for 'any' and 'all', a subject with no lessons at their grade — like US History in some grades — doesn't count)
    const prog = free(m) ? [] : subjects.map((s) => ({ s, x: subjectMastery(m.id, s) })).filter((y) => subjects.length === 1 || !y.x || y.x.total > 0);
    const progress = prog
      .filter((y) => y.x)
      .map(({ s, x }) => ({ subject: s, label: SUBJECT_NAME[s], grade: GRADE_NAMES[x!.grade], passed: x!.passed, total: x!.total, done: x!.done }));
    // 🎉 hand out what they've earned (each subject, once per grade; 'all' once per grade)
    const now = new Date().toISOString();
    const grant = db.prepare('INSERT OR IGNORE INTO game_prize_grants (id, family_member_id, game_id, prize, subject, grade, uses, granted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    if (r.subject === 'all') {
      if (prog.length && prog.every((y) => y.x?.done)) grant.run(uuidv4(), m.id, gameId, p.id, 'all', prog[0].x!.grade, r.uses, now);
    } else for (const y of prog) if (y.x?.done) grant.run(uuidv4(), m.id, gameId, p.id, y.s, y.x.grade, r.uses, now);
    const grants = db.prepare('SELECT uses FROM game_prize_grants WHERE family_member_id = ? AND game_id = ? AND prize = ?').all(m.id, gameId, p.id) as Array<{ uses: number }>;
    const used = (db.prepare('SELECT COUNT(*) AS n FROM game_prize_uses WHERE family_member_id = ? AND game_id = ? AND prize = ?').get(m.id, gameId, p.id) as { n: number }).n;
    const isFree = free(m) && r.parents_free;
    const unlimited = grants.some((x) => x.uses === 0);
    const left = isFree || unlimited ? null : Math.max(0, grants.reduce((a, x) => a + x.uses, 0) - used);
    out[p.id] = {
      name: p.name,
      blurb: p.blurb,
      unit: p.unit,
      subject: r.subject,
      uses_per: r.uses,
      parents_free: r.parents_free,
      free: isFree,
      earned: grants.length > 0,
      unlimited,
      left,
      ready: isFree || unlimited || (left ?? 0) > 0,
      progress,
      note: !free(m) && !progress.length ? 'A parent needs to set your grade first (📚 Learning → ⚙️ Grades & tokens)' : null,
    };
  }
  return out;
}

/** POST /:gameId/play/:memberId/prize { prize, acting_member_id } — 🏆 use one go of a prize power (a drive, a game, a visit). */
gamesRouter.post('/:gameId/play/:memberId/prize', (req, res) => {
  const { gameId, memberId } = req.params;
  const { prize, acting_member_id } = req.body ?? {};
  if (!isSelfOrParent(req, memberId, acting_member_id)) return res.status(403).json({ error: 'Only they or a parent can play as them' });
  const g = gameOf(gameId);
  const m = memberOf(memberId);
  if (!g || !m) return res.status(404).json({ error: 'not found' });
  if (!mayPlay(m, g.id)) return res.status(403).json({ error: 'Unlock it first' });
  const st = prizesFor(m, g.id)[String(prize)];
  if (!st) return res.status(404).json({ error: 'No such prize' });
  if (!st.ready) return res.status(403).json({ error: st.earned ? `No ${st.name} left — finish another subject's lessons to earn more` : `Pass every lesson to earn ${st.name}` });
  db.prepare('INSERT INTO game_prize_uses (id, family_member_id, game_id, prize, used_at) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), m.id, g.id, String(prize), new Date().toISOString());
  res.json({ prizes: prizesFor(m, g.id) });
});

/**
 * GET /letter-maze/words/:memberId?grade=N — 🐝 Letter Maze: spelling words for a game, from the
 * kid's grade (a parent's grade is picked with ?grade, or 3rd grade). Grades 6–12 also get
 * misspelled look-alikes to dodge. Their 🔤 spelling words — the same lists as 📚 Learning.
 */
gamesRouter.get('/letter-maze/words/:memberId', (req, res) => {
  const m = memberOf(req.params.memberId);
  if (!m) return res.status(404).json({ error: 'not found' });
  const own = (db.prepare('SELECT grade FROM learning_grades WHERE family_member_id = ?').get(m.id) as { grade: number } | undefined)?.grade ?? null;
  const asked = Number(req.query.grade);
  // kids play their own grade (or lower, for practice); parents any
  const want = Number.isInteger(asked) && asked >= 0 && asked < WORDS.length ? asked : (own ?? 3);
  const grade = free(m) || own === null ? want : Math.min(want, own);
  const list = [...WORDS[grade]].sort(() => Math.random() - 0.5).slice(0, 40);
  const words = list.map((w) => {
    const wrong = new Set<string>();
    if (grade >= 6) for (let k = 0; k < 12 && wrong.size < 4; k++) {
      const x = misspell(w.word, Math.random);
      if (x && x.toLowerCase() !== w.word.toLowerCase()) wrong.add(x.toLowerCase());
    }
    return { word: w.word.toLowerCase(), meaning: w.meaning, sentence: w.sentence, wrong: [...wrong] };
  });
  res.json({ grade, grade_name: GRADE_NAMES[grade], own_grade: own, mode: grade >= 6 ? 'words' : 'letters', words });
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
  res.json({ game: g, save: data, best: best(m.id, g.id), top, owned, plays_left: owned ? null : passesFor(m.id).get(g.id) ?? 0, features: featuresFor(m, g.id, data), shop: shopFor(m, g.id), prizes: prizesFor(m, g.id), token_balance: m.token_balance });
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
    if (data.length > 80_000) return res.status(400).json({ error: 'Too much to save' });
    db.prepare(
      `INSERT INTO game_saves (family_member_id, game_id, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(family_member_id, game_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).run(m.id, g.id, data, now);
  }
  res.json({ best: best(m.id, g.id) });
});
