import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { GAMES, gameOf } from '../services/games.js';
import { isParentRequest, isSelfOrParent } from '../services/rewards.js';
import type { FamilyMember } from '../types.js';

/** 🎮 Games: unlock with stars (parents play free), play, keep best runs and progress. */
export const gamesRouter = Router();

const memberOf = (id: string) => db.prepare('SELECT * FROM family_members WHERE id = ?').get(id) as FamilyMember | undefined;
const unlockedFor = (m: FamilyMember) =>
  new Set((db.prepare('SELECT game_id FROM game_unlocks WHERE family_member_id = ?').all(m.id) as Array<{ game_id: string }>).map((r) => r.game_id));
const free = (m: FamilyMember) => m.is_parent === 1;
const best = (memberId: string, gameId: string) =>
  (db.prepare('SELECT MAX(score) AS s FROM game_scores WHERE family_member_id = ? AND game_id = ?').get(memberId, gameId) as { s: number | null }).s;

function shelf(m: FamilyMember) {
  const mine = unlockedFor(m);
  return {
    star_balance: m.star_balance,
    plays_free: free(m),
    games: GAMES.map((g) => ({ ...g, unlocked: free(m) || mine.has(g.id), best: best(m.id, g.id) })),
  };
}

/** GET /?member=ID — the games, which ones they can play, their best scores. */
gamesRouter.get('/', (req, res) => {
  const m = memberOf(String(req.query.member ?? ''));
  if (!m) return res.json({ star_balance: 0, plays_free: false, games: GAMES.map((g) => ({ ...g, unlocked: false, best: null })) });
  res.json(shelf(m));
});

/** POST /:memberId/unlock { game_id, acting_member_id } — spend their stars on a game (once). */
gamesRouter.post('/:memberId/unlock', (req, res) => {
  const { memberId } = req.params;
  const { game_id, acting_member_id } = req.body ?? {};
  if (!isSelfOrParent(req, memberId, acting_member_id)) return res.status(403).json({ error: 'Only they or a parent can spend their stars' });
  const g = gameOf(String(game_id));
  const m = memberOf(memberId);
  if (!g || !m) return res.status(404).json({ error: 'not found' });
  if (free(m) || unlockedFor(m).has(g.id)) return res.json(shelf(m));
  if (m.star_balance < g.stars) return res.status(400).json({ error: `Needs ${g.stars} ⭐ — ${g.stars - m.star_balance} more to go` });
  db.transaction(() => {
    db.prepare('UPDATE family_members SET star_balance = star_balance - ? WHERE id = ?').run(g.stars, m.id);
    db.prepare('INSERT INTO game_unlocks (family_member_id, game_id, stars, unlocked_at) VALUES (?, ?, ?, ?)').run(m.id, g.id, g.stars, new Date().toISOString());
  })();
  res.json(shelf(memberOf(m.id)!));
});

/** POST /:memberId/refund { game_id, acting_member_id } — parents: give the stars back and lock it again (scores and progress are kept). */
gamesRouter.post('/:memberId/refund', (req, res) => {
  const { memberId } = req.params;
  const { game_id, acting_member_id } = req.body ?? {};
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can do that' });
  const row = db.prepare('SELECT stars FROM game_unlocks WHERE family_member_id = ? AND game_id = ?').get(memberId, game_id) as { stars: number } | undefined;
  if (!row) return res.status(404).json({ error: 'not found' });
  db.transaction(() => {
    db.prepare('DELETE FROM game_unlocks WHERE family_member_id = ? AND game_id = ?').run(memberId, game_id);
    db.prepare('UPDATE family_members SET star_balance = star_balance + ? WHERE id = ?').run(row.stars, memberId);
  })();
  res.json(shelf(memberOf(memberId)!));
});

function mayPlay(m: FamilyMember, gameId: string) {
  return free(m) || unlockedFor(m).has(gameId);
}

/** GET /:gameId/play/:memberId — their saved progress, best score and the family's top runs. */
gamesRouter.get('/:gameId/play/:memberId', (req, res) => {
  const g = gameOf(req.params.gameId);
  const m = memberOf(req.params.memberId);
  if (!g || !m) return res.status(404).json({ error: 'not found' });
  if (!mayPlay(m, g.id)) return res.status(403).json({ error: `Unlock ${g.name} first (${g.stars} ⭐)` });
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
  res.json({ game: g, save: data, best: best(m.id, g.id), top });
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
