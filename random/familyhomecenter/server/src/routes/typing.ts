import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, getSetting, setSetting } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { isSelfOrParent } from '../services/rewards.js';

// ⌨️ Typing practice (client/src/pages/TypingPage.tsx): lessons from the home row up, and the games —
// Balloon Pop, Race, Whack-a-Key, Meteor Defense, Word Snake, Tower Builder, Silly Story, the family's
// Daily Challenge and Shopping Spree (Tower, Story and the Daily Challenge open once all the lessons
// are passed — or straight away for a parent). Shopping Spree's money is pretend and it pays no ⭐. Each finished round is saved here for progress. A parent decides the ⭐ for the Prize
// Bank (any of it can be 0): so many for passing each lesson the first time, and so many for beating
// your own best in a game — games capped at a number of rewarded rounds a day, so it's a nudge to
// practise, not a star farm.
export const typingRouter = Router();

/** Lessons 1..LEVEL_COUNT — keep in sync with LEVELS in client/src/pages/TypingPage.tsx. */
const LEVEL_COUNT = 16;
const MODES = ['lesson', 'balloon', 'race', 'whack', 'meteor', 'tower', 'snake', 'story', 'daily', 'shop'] as const;
type Mode = (typeof MODES)[number];
/** Games won by a higher score (the others — race, story — by a faster winning speed). */
const SCORE_GAMES: Mode[] = ['balloon', 'whack', 'meteor', 'tower', 'snake', 'shop'];
/** Open after every lesson is passed, or for a parent. */
const LOCKED_GAMES: Mode[] = ['tower', 'story', 'daily'];
/** The Daily Challenge counts at this much right or better. */
const DAILY_ACCURACY = 80;
const SETTING_KEY = 'typing_rewards';

export interface TypingRewards {
  /** Stars for passing lesson n the first time: levels[n - 1]. */
  levels: number[];
  balloon_best: number;
  race_best: number;
  whack_best: number;
  meteor_best: number;
  tower_best: number;
  snake_best: number;
  story_best: number;
  /** For finishing the Daily Challenge (once a day; not counted in games_per_day). */
  daily: number;
  /** Show the Daily Challenge (its tab, and today's results on the Family Board). */
  daily_enabled: boolean;
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
    whack_best: n(saved.whack_best, 1),
    meteor_best: n(saved.meteor_best, 1),
    tower_best: n(saved.tower_best, 1),
    snake_best: n(saved.snake_best, 1),
    story_best: n(saved.story_best, 1),
    daily: n(saved.daily, 1),
    daily_enabled: saved.daily_enabled !== false,
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
  const merged: TypingRewards = { ...cur };
  for (const k of Object.keys(cur) as Array<keyof TypingRewards>) {
    if (k === 'levels') merged.levels = Array.isArray(b.levels) ? cur.levels.map((v, i) => b.levels![i] ?? v) : cur.levels;
    else if (k === 'daily_enabled') merged.daily_enabled = typeof b.daily_enabled === 'boolean' ? b.daily_enabled : cur.daily_enabled;
    else if (b[k] !== undefined) (merged[k] as number) = Number(b[k]);
  }
  setSetting(SETTING_KEY, JSON.stringify(merged));
  res.json(readRewards());
});

const GAME_NAMES: Record<string, string> = {
  balloon: 'Balloon Pop',
  race: 'Race',
  whack: 'Whack-a-Key',
  meteor: 'Meteor Defense',
  tower: 'Tower Builder',
  snake: 'Word Snake',
  story: 'Silly Story',
  shop: 'Shopping Spree',
};

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
      .prepare("SELECT COUNT(*) AS n FROM typing_results WHERE family_member_id = ? AND day = ? AND mode NOT IN ('lesson', 'daily') AND stars > 0")
      .get(memberId, localDay()) as { n: number }
  ).n;
}

/** Every lesson passed, or a parent: Tower Builder, Silly Story and the Daily Challenge are open. */
function sentencesOpen(memberId: string): boolean {
  if (db.prepare('SELECT 1 FROM family_members WHERE id = ? AND is_parent = 1').get(memberId)) return true;
  const n = (
    db
      .prepare("SELECT COUNT(DISTINCT level) AS n FROM typing_results WHERE family_member_id = ? AND mode = 'lesson' AND passed = 1 AND level BETWEEN 1 AND ?")
      .get(memberId, LEVEL_COUNT) as { n: number }
  ).n;
  return n >= LEVEL_COUNT;
}

/** A game's best: top score, or for race/story the fastest win. */
function bestOf(memberId: string, mode: Mode): number | null {
  const sql = SCORE_GAMES.includes(mode)
    ? 'SELECT MAX(score) AS v FROM typing_results WHERE family_member_id = ? AND mode = ?'
    : 'SELECT MAX(wpm) AS v FROM typing_results WHERE family_member_id = ? AND mode = ? AND passed = 1';
  return (db.prepare(sql).get(memberId, mode) as { v: number | null }).v;
}

/** GET /daily — today's Daily Challenge: whether it's on, the day (the text is picked from it, so
 *  everyone types the same), and everyone's best try today. */
typingRouter.get('/daily', (_req, res) => {
  const day = localDay();
  const board = db
    .prepare(
      `SELECT family_member_id AS member_id, wpm, accuracy, ROUND(wpm * accuracy / 100, 1) AS net, passed,
              (SELECT COUNT(*) FROM typing_results t2 WHERE t2.family_member_id = t.family_member_id AND t2.mode = 'daily' AND t2.day = t.day) AS tries
       FROM typing_results t
       WHERE mode = 'daily' AND day = ?
         AND id = (SELECT id FROM typing_results t3 WHERE t3.family_member_id = t.family_member_id AND t3.mode = 'daily' AND t3.day = t.day
                   ORDER BY t3.passed DESC, t3.wpm * t3.accuracy DESC LIMIT 1)
       ORDER BY passed DESC, net DESC`
    )
    .all(day);
  res.json({ enabled: readRewards().daily_enabled, day, accuracy_needed: DAILY_ACCURACY, board });
});

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
    game_bests: Object.fromEntries(MODES.filter((m) => m !== 'lesson' && m !== 'daily').map((m) => [m, bestOf(id, m) ?? 0])),
    sentences_open: sentencesOpen(id),
    daily_done_today: Boolean(
      db.prepare("SELECT 1 FROM typing_results WHERE family_member_id = ? AND mode = 'daily' AND day = ? AND passed = 1").get(id, localDay())
    ),
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
  const mode = String(b.mode) as Mode;
  if (!MODES.includes(mode)) return res.status(400).json({ error: `mode must be one of ${MODES.join(', ')}` });
  if (LOCKED_GAMES.includes(mode) && !sentencesOpen(id)) return res.status(403).json({ error: 'Pass all the lessons first' });
  if (mode === 'daily' && !readRewards().daily_enabled) return res.status(403).json({ error: 'The Daily Challenge is turned off' });
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
  } else if (mode === 'daily') {
    // Finishing today's challenge (at DAILY_ACCURACY% right) pays once a day.
    row.passed = row.accuracy >= DAILY_ACCURACY ? 1 : 0;
    const before = db.prepare("SELECT 1 FROM typing_results WHERE family_member_id = ? AND mode = 'daily' AND day = ? AND passed = 1").get(id, localDay());
    earned = Boolean(row.passed) && !before;
    why = "Finished today's challenge";
  } else if (mode === 'shop') {
    // Just for fun — its money is pretend and it never pays ⭐ (a best is still kept).
  } else if (SCORE_GAMES.includes(mode)) {
    const best = bestOf(id, mode);
    earned = row.score >= 10 && (best === null || row.score > best);
    why = `New ${GAME_NAMES[mode]} best`;
  } else if (row.passed) {
    const best = bestOf(id, mode);
    earned = best === null || row.wpm > best;
    why = mode === 'race' ? 'Won a race at a new best speed' : `New ${GAME_NAMES[mode]} best speed`;
  }
  const rewards = readRewards();
  let stars = 0;
  let capped = false;
  if (earned && mode === 'lesson') stars = rewards.levels[row.level - 1] ?? 0;
  if (earned && mode === 'daily') stars = rewards.daily;
  if (earned && mode !== 'lesson' && mode !== 'daily') {
    const worth = rewards[`${mode}_best` as 'balloon_best'];
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
