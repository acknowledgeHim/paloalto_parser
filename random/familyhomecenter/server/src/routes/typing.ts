import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, getSetting, setSetting } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { isSelfOrParent } from '../services/rewards.js';

// ⌨️ Typing practice (client/src/pages/TypingPage.tsx): lessons from the home row up, Balloon Pop
// and Race. Each finished round is saved here for progress. A parent decides the ⭐ for the Prize
// Bank (any of it can be 0): so many for passing each lesson the first time, and so many for beating
// your own best in a game — games capped at a number of rewarded rounds a day, so it's a nudge to
// practise, not a star farm.
export const typingRouter = Router();

/** Lessons 1..LEVEL_COUNT — keep in sync with LEVELS in client/src/pages/TypingPage.tsx. */
const LEVEL_COUNT = 16;
const MODES = ['lesson', 'balloon', 'race'] as const;
const SETTING_KEY = 'typing_rewards';

export interface TypingRewards {
  /** Stars for passing lesson n the first time: levels[n - 1]. */
  levels: number[];
  balloon_best: number;
  race_best: number;
  /** How many game rounds a day can pay out (0 = games pay nothing). */
  games_per_day: number;
}

function readRewards(): TypingRewards {
  let saved: Partial<TypingRewards> = {};
  try {
    saved = JSON.parse(getSetting(SETTING_KEY, '{}')) as Partial<TypingRewards>;
  } catch {
    /* defaults */
  }
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? Math.max(0, Math.min(1000, Math.round(Number(v)))) : d);
  return {
    levels: Array.from({ length: LEVEL_COUNT }, (_, i) => n(saved.levels?.[i], 1)),
    balloon_best: n(saved.balloon_best, 1),
    race_best: n(saved.race_best, 1),
    games_per_day: n(saved.games_per_day, 3),
  };
}

/** GET /settings/rewards — the stars for each level and game (open: the page shows "+2 ⭐"). */
typingRouter.get('/settings/rewards', (_req, res) => {
  res.json(readRewards());
});

/** PUT /settings/rewards — parent only. */
typingRouter.put('/settings/rewards', requireAdmin, (req, res) => {
  const cur = readRewards();
  const b = req.body as Partial<TypingRewards>;
  const merged = {
    levels: Array.isArray(b.levels) ? cur.levels.map((v, i) => (b.levels![i] ?? v)) : cur.levels,
    balloon_best: b.balloon_best ?? cur.balloon_best,
    race_best: b.race_best ?? cur.race_best,
    games_per_day: b.games_per_day ?? cur.games_per_day,
  };
  setSetting(SETTING_KEY, JSON.stringify(merged));
  res.json(readRewards());
});

function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function starsToday(memberId: string): number {
  return (
    db.prepare('SELECT COALESCE(SUM(stars), 0) AS n FROM typing_results WHERE family_member_id = ? AND day = ?').get(memberId, localDay()) as {
      n: number;
    }
  ).n;
}

/** Game rounds that paid stars today (lessons don't count — each pays once ever). */
function paidGamesToday(memberId: string): number {
  return (
    db
      .prepare("SELECT COUNT(*) AS n FROM typing_results WHERE family_member_id = ? AND day = ? AND mode != 'lesson' AND stars > 0")
      .get(memberId, localDay()) as { n: number }
  ).n;
}

/** GET /bests — everyone's best speed (at 90%+ right), so family can be raced as rivals. */
typingRouter.get('/bests', (_req, res) => {
  res.json(
    db
      .prepare('SELECT family_member_id AS member_id, MAX(wpm) AS best_wpm FROM typing_results WHERE accuracy >= 90 GROUP BY family_member_id')
      .all()
  );
});

/** GET /:memberId — their progress: lessons passed, bests, recent rounds. Open, like the board. */
typingRouter.get('/:memberId', (req, res) => {
  const id = req.params.memberId;
  if (!db.prepare('SELECT 1 FROM family_members WHERE id = ?').get(id)) return res.status(404).json({ error: 'No such person' });
  const levels = db
    .prepare(
      `SELECT level, MAX(wpm) AS best_wpm, MAX(accuracy) AS best_accuracy, MAX(passed) AS passed, COUNT(*) AS tries
       FROM typing_results WHERE family_member_id = ? AND mode = 'lesson' GROUP BY level`
    )
    .all(id) as Array<{ level: number; best_wpm: number; best_accuracy: number; passed: number; tries: number }>;
  const best = (mode: string, col: 'score' | 'wpm') =>
    (db.prepare(`SELECT MAX(${col}) AS v FROM typing_results WHERE family_member_id = ? AND mode = ?`).get(id, mode) as { v: number | null }).v ?? 0;
  res.json({
    levels,
    best_wpm: (db.prepare('SELECT MAX(wpm) AS v FROM typing_results WHERE family_member_id = ? AND accuracy >= 90').get(id) as { v: number | null }).v ?? 0,
    balloon_best: best('balloon', 'score'),
    race_best_wpm: best('race', 'wpm'),
    stars_today: starsToday(id),
    paid_games_today: paidGamesToday(id),
    recent: db
      .prepare('SELECT at, mode, level, wpm, accuracy, score, passed, stars FROM typing_results WHERE family_member_id = ? ORDER BY at DESC LIMIT 30')
      .all(id),
  });
});

/** POST /:memberId/results — a finished round. Answers with the stars it earned. */
typingRouter.post('/:memberId/results', (req, res) => {
  const id = req.params.memberId;
  const b = req.body as Record<string, unknown>;
  if (!db.prepare('SELECT 1 FROM family_members WHERE id = ?').get(id)) return res.status(404).json({ error: 'No such person' });
  if (!isSelfOrParent(req, id, b.acting_member_id)) return res.status(403).json({ error: "That's someone else's typing" });
  const mode = String(b.mode) as (typeof MODES)[number];
  if (!MODES.includes(mode)) return res.status(400).json({ error: 'mode must be lesson, balloon or race' });
  const num = (v: unknown, max: number) => Math.max(0, Math.min(max, Number(v) || 0));
  const row = {
    level: Math.round(num(b.level, 100)),
    wpm: Math.round(num(b.wpm, 250) * 10) / 10,
    accuracy: Math.round(num(b.accuracy, 100) * 10) / 10,
    chars: Math.round(num(b.chars, 100_000)),
    seconds: Math.round(num(b.seconds, 24 * 3600)),
    score: Math.round(num(b.score, 1_000_000)),
    passed: b.passed ? 1 : 0,
  };

  // Earned? Worked out before saving, against what was there already.
  let earned = false;
  let why = '';
  if (mode === 'lesson' && row.passed) {
    const before = db
      .prepare("SELECT 1 FROM typing_results WHERE family_member_id = ? AND mode = 'lesson' AND level = ? AND passed = 1")
      .get(id, row.level);
    earned = !before;
    why = 'Passed a new lesson';
  } else if (mode === 'balloon') {
    const best = (db.prepare("SELECT MAX(score) AS v FROM typing_results WHERE family_member_id = ? AND mode = 'balloon'").get(id) as {
      v: number | null;
    }).v;
    earned = row.score >= 10 && (best === null || row.score > best);
    why = 'New Balloon Pop best';
  } else if (mode === 'race' && row.passed) {
    const best = (db.prepare("SELECT MAX(wpm) AS v FROM typing_results WHERE family_member_id = ? AND mode = 'race' AND passed = 1").get(id) as {
      v: number | null;
    }).v;
    earned = best === null || row.wpm > best;
    why = 'Won a race at a new best speed';
  }
  const rewards = readRewards();
  let stars = 0;
  let capped = false;
  if (earned && mode === 'lesson') stars = rewards.levels[row.level - 1] ?? 0;
  if (earned && mode !== 'lesson') {
    const worth = mode === 'balloon' ? rewards.balloon_best : rewards.race_best;
    if (worth > 0 && paidGamesToday(id) >= rewards.games_per_day) capped = true;
    else stars = worth;
  }

  const now = new Date();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO typing_results (id, family_member_id, at, day, mode, level, wpm, accuracy, chars, seconds, score, passed, stars)
       VALUES (@id, @m, @at, @day, @mode, @level, @wpm, @accuracy, @chars, @seconds, @score, @passed, @stars)`
    ).run({ id: uuidv4(), m: id, at: now.toISOString(), day: localDay(now), mode, ...row, stars });
    if (stars) db.prepare('UPDATE family_members SET star_balance = star_balance + ? WHERE id = ?').run(stars, id);
  })();
  res.json({
    stars,
    reason: stars ? why : capped ? `${why} — games have paid their stars for today` : earned ? why : null,
    stars_today: starsToday(id),
  });
});
