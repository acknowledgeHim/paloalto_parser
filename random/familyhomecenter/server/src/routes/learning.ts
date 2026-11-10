import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, getSetting, setSetting } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { isParentRequest, isSelfOrParent, sessionActor } from '../services/rewards.js';
import { speak, speechEngine } from '../services/speech.js';
import type { GrammarItem } from '../services/grammarContent.js';
import { GRAMMAR } from '../services/grammarGen.js';
import { checkMath, MATH_COURSE, MATH_GRADE_TOPICS, mathRound, type MathProblem } from '../services/mathGen.js';
import { makeSpellcheckItem } from '../services/spellcheckGen.js';
import { GRADE_NAMES, WORDS } from '../services/spellingWords.js';
import { addTokens } from '../services/tokens.js';
import { tryStart } from '../services/dailyLimits.js';
import type { FamilyMember } from '../types.js';

/**
 * 📚 Learning: 🔤 Spelling, 🔍 Spot the misspellings, 📝 Grammar, ➗ Math. Each kid has a school grade a parent sets;
 * they can practise any grade, but only rounds at their grade or higher earn 💎 tokens. A round is
 * 10 random items, checked here (not in the browser), and pays by the parent's "% right → tokens"
 * levels — the lowest level is the pass mark — up to so many paying rounds a day.
 */
export const learningRouter = Router();

export const SUBJECTS = ['spelling', 'spellcheck', 'grammar', 'math'] as const;
const SUBJECT_NAMES: Record<Subject, string> = { spelling: '🔤 Spelling', spellcheck: '🔍 Spot the misspellings', grammar: '📝 Grammar', math: '➗ Math' };
export type Subject = (typeof SUBJECTS)[number];
const ROUND_SIZE = 10;

// ---- ⚙️ settings ----

export interface Tier {
  pct: number;
  tokens: number;
}
export interface SubjectRewards {
  tiers: Tier[];
  /** rounds a day that can pay tokens (0 = no tokens) */
  per_day: number;
}
type Rewards = Record<Subject, SubjectRewards>;
const SETTING = 'learning_rewards';
const DEFAULT: SubjectRewards = { tiers: [{ pct: 80, tokens: 1 }, { pct: 100, tokens: 2 }], per_day: 3 };

function cleanTiers(v: unknown, fallback: Tier[]): Tier[] {
  if (!Array.isArray(v)) return fallback;
  const byPct = new Map<number, number>();
  for (const t of v.slice(0, 10)) {
    const pct = Math.round(Number((t as Tier)?.pct));
    const tokens = Math.round(Number((t as Tier)?.tokens));
    if (pct >= 10 && pct <= 100 && pct % 10 === 0 && tokens >= 0 && tokens <= 1000) byPct.set(pct, tokens);
  }
  return [...byPct].map(([pct, tokens]) => ({ pct, tokens })).sort((a, b) => a.pct - b.pct);
}
function readRewards(): Rewards {
  let saved: Partial<Record<Subject, Partial<SubjectRewards>>> = {};
  try {
    saved = JSON.parse(getSetting(SETTING, '{}'));
  } catch {
    /* defaults */
  }
  const out = {} as Rewards;
  for (const s of SUBJECTS) {
    const x = saved[s] ?? {};
    const pd = Math.round(Number(x.per_day));
    out[s] = { tiers: cleanTiers(x.tiers, DEFAULT.tiers), per_day: Number.isFinite(pd) && pd >= 0 && pd <= 100 ? pd : DEFAULT.per_day };
  }
  return out;
}
/** Tokens for this % right: the highest level reached (0 below the lowest = didn't pass). */
const worth = (tiers: Tier[], pct: number) => tiers.filter((t) => pct >= t.pct).reduce((m, t) => Math.max(m, t.tokens), 0);
const passMark = (tiers: Tier[]) => tiers[0]?.pct ?? 100;

// ---- 🎁 bonus: max out the day's paying rounds in each picked subject → extra tokens, once a day ----

export interface Bonus {
  /** 0 = no bonus */
  tokens: number;
  subjects: Subject[];
}
const BONUS_SETTING = 'learning_bonus';
const BONUS_DEFAULT: Bonus = { tokens: 0, subjects: ['spelling', 'grammar', 'math'] };
function cleanBonus(v: unknown, fallback: Bonus): Bonus {
  const x = (v ?? {}) as Partial<Bonus>;
  const t = Math.round(Number(x.tokens));
  return {
    tokens: x.tokens !== undefined && Number.isFinite(t) && t >= 0 && t <= 1000 ? t : fallback.tokens,
    subjects: Array.isArray(x.subjects) ? SUBJECTS.filter((s) => x.subjects!.includes(s)) : fallback.subjects,
  };
}
function readBonus(): Bonus {
  try {
    return cleanBonus(JSON.parse(getSetting(BONUS_SETTING, '{}')), BONUS_DEFAULT);
  } catch {
    return BONUS_DEFAULT;
  }
}
/** The picked subjects that pay anything (one set to pay nothing can't be maxed, so it's left out). */
const bonusSubjects = (b = readBonus(), rw = readRewards()) => b.subjects.filter((s) => rw[s].per_day > 0 && rw[s].tiers.some((t) => t.tokens > 0));
const bonusPaidToday = (id: string) =>
  (db.prepare('SELECT tokens FROM learning_bonus_paid WHERE family_member_id = ? AND day = ?').get(id, localDay()) as { tokens: number } | undefined)?.tokens ?? null;
/** Where someone is with today's bonus: which subjects count, which are done, and whether it's paid. */
function bonusStatus(id: string) {
  const b = readBonus();
  const rw = readRewards();
  const subjects = bonusSubjects(b, rw);
  return {
    tokens: subjects.length ? b.tokens : 0,
    subjects: subjects.map((s) => ({ subject: s, name: SUBJECT_NAMES[s], done: paidToday(id, s) >= rw[s].per_day })),
    paid_today: bonusPaidToday(id),
  };
}
/** Pay today's bonus if every picked subject is maxed out and it isn't paid yet. Returns what was paid. */
function maybePayBonus(m: FamilyMember): number {
  if (m.is_parent === 1) return 0;
  const st = bonusStatus(m.id);
  if (!st.tokens || !st.subjects.length || st.paid_today !== null || !st.subjects.every((x) => x.done)) return 0;
  const ok = db.prepare('INSERT OR IGNORE INTO learning_bonus_paid (family_member_id, day, tokens, at) VALUES (?, ?, ?, ?)').run(m.id, localDay(), st.tokens, new Date().toISOString()).changes;
  if (!ok) return 0;
  addTokens(m.id, st.tokens, `🎁 Learning bonus: all of today's tokens in ${st.subjects.map((x) => x.name).join(', ')}`);
  return st.tokens;
}

learningRouter.get('/settings', (_req, res) => res.json({ rewards: readRewards(), grades: GRADE_NAMES, bonus: readBonus() }));

learningRouter.put('/settings', requireAdmin, (req, res) => {
  if (!isParentRequest(req, req.body?.acting_member_id)) return res.status(403).json({ error: 'Only a parent can set learning tokens' });
  if (req.body?.bonus !== undefined) setSetting(BONUS_SETTING, JSON.stringify(cleanBonus(req.body.bonus, readBonus())));
  const cur = readRewards();
  const b = (req.body?.rewards ?? {}) as Partial<Record<Subject, Partial<SubjectRewards>>>;
  for (const s of SUBJECTS) {
    if (!b[s]) continue;
    if (b[s]!.tiers !== undefined) cur[s].tiers = cleanTiers(b[s]!.tiers, cur[s].tiers);
    const pd = Math.round(Number(b[s]!.per_day));
    if (b[s]!.per_day !== undefined && Number.isFinite(pd) && pd >= 0 && pd <= 100) cur[s].per_day = pd;
  }
  setSetting(SETTING, JSON.stringify(cur));
  res.json({ rewards: readRewards(), grades: GRADE_NAMES, bonus: readBonus() });
});

// ---- 👧 people ----

const memberOf = (id: string) => db.prepare('SELECT * FROM family_members WHERE id = ?').get(id) as FamilyMember | undefined;
const gradeOf = (id: string) => (db.prepare('SELECT grade FROM learning_grades WHERE family_member_id = ?').get(id) as { grade: number } | undefined)?.grade ?? null;
function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const paidToday = (id: string, subject: Subject) =>
  (db.prepare('SELECT COUNT(*) AS n FROM learning_results WHERE family_member_id = ? AND subject = ? AND day = ? AND tokens > 0').get(id, subject, localDay()) as { n: number }).n;

/** Why a round at this grade won't pay (null = it can). */
function noTokensWhy(m: FamilyMember, subject: Subject, grade: number): string | null {
  if (m.is_parent === 1) return 'Parents practise just for fun';
  const g = gradeOf(m.id);
  if (g === null) return 'A parent needs to set your grade first (📚 Learning → ⚙️ Grades & tokens)';
  if (grade < g) return `Below your grade (${GRADE_NAMES[g]}) — practise for fun, or try your grade or higher for tokens`;
  const r = readRewards()[subject];
  if (!r.per_day || !r.tiers.some((t) => t.tokens > 0)) return 'This game pays no tokens right now';
  if (paidToday(m.id, subject) >= r.per_day) return `Tokens done for today (${r.per_day} round${r.per_day === 1 ? '' : 's'}) — come back tomorrow`;
  return null;
}

/** GET /:memberId — their grade, and for each subject: bests by grade and recent rounds. */
learningRouter.get('/people/:memberId', (req, res) => {
  const m = memberOf(req.params.memberId);
  if (!m) return res.status(404).json({ error: 'not found' });
  const subjects = Object.fromEntries(
    SUBJECTS.map((s) => [
      s,
      {
        best: db.prepare('SELECT grade, MAX(correct) AS correct, COUNT(*) AS rounds FROM learning_results WHERE family_member_id = ? AND subject = ? GROUP BY grade').all(m.id, s),
        recent: db.prepare('SELECT grade, at, correct, total, tokens FROM learning_results WHERE family_member_id = ? AND subject = ? ORDER BY at DESC LIMIT 15').all(m.id, s),
        paid_today: paidToday(m.id, s),
      },
    ])
  );
  res.json({ grade: gradeOf(m.id), is_parent: m.is_parent === 1, token_balance: m.token_balance, subjects, bonus: bonusStatus(m.id) });
});

/** PUT /people/:memberId/grade { grade (0 = K … 12), acting_member_id } — parents. */
learningRouter.put('/people/:memberId/grade', (req, res) => {
  const { grade, acting_member_id } = req.body ?? {};
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can set the grade' });
  const m = memberOf(req.params.memberId);
  if (!m) return res.status(404).json({ error: 'not found' });
  const g = Math.round(Number(grade));
  if (!(g >= 0 && g < GRADE_NAMES.length)) return res.status(400).json({ error: 'Grade: K–12' });
  db.prepare(
    `INSERT INTO learning_grades (family_member_id, grade, set_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(family_member_id) DO UPDATE SET grade = excluded.grade, set_by = excluded.set_by, updated_at = excluded.updated_at`
  ).run(m.id, g, sessionActor(req, acting_member_id), new Date().toISOString());
  res.json({ grade: gradeOf(m.id) });
});

// ---- 🎯 rounds ----

interface Round {
  id: string;
  member: string;
  subject: Subject;
  grade: number;
  started: number;
  /** what's right for each item (spelling: the word) */
  answers: string[];
  /** tap-the-mistakes games: each item's words, with the fix for each mistake */
  tap?: GrammarItem[];
  /** tap games: answers already checked one by one (they can't be changed after) */
  locked?: number[][];
  /** ➗ math: the problems, and answers already checked one by one */
  math?: MathProblem[];
  lockedText?: string[];
}
/** How long a round started and left can be picked up again (💾 auto-save). */
const KEEP_MS = 3 * 24 * 3600_000;
/** Rounds live in the database, so a closed tab, another screen or a restart can carry on. */
const rounds = {
  get(id: string): Round | undefined {
    const row = db.prepare('SELECT data FROM learning_open_rounds WHERE id = ? AND finished_at IS NULL').get(id) as { data: string } | undefined;
    if (!row) return undefined;
    const r = JSON.parse(row.data) as Round;
    return r.started < Date.now() - KEEP_MS ? undefined : r;
  },
  set(id: string, r: Round) {
    db.prepare('INSERT INTO learning_open_rounds (id, family_member_id, subject, started_at, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data').run(
      id,
      r.member,
      r.subject,
      new Date(r.started).toISOString(),
      JSON.stringify(r)
    );
  },
  /** Marks it finished; false when it already was (each round counts once). */
  finish(id: string): boolean {
    return db.prepare('UPDATE learning_open_rounds SET finished_at = ? WHERE id = ? AND finished_at IS NULL').run(new Date().toISOString(), id).changes === 1;
  },
};

function pick<T>(list: T[], n: number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/** POST /spelling/start { member_id, grade, acting_member_id } — 10 random words at that grade. */
learningRouter.post('/spelling/start', (req, res) => {
  const { member_id, grade, acting_member_id } = req.body ?? {};
  const m = memberOf(String(member_id));
  if (!m) return res.status(404).json({ error: 'not found' });
  if (!isSelfOrParent(req, m.id, acting_member_id)) return res.status(403).json({ error: "That's someone else's practice" });
  const g = Math.round(Number(grade));
  if (!(g >= 0 && g < WORDS.length)) return res.status(400).json({ error: 'Grade: K–12' });
  const over = tryStart(m.id, 'spelling');
  if (over) return res.status(429).json({ error: over, limit: true });
  // No word twice in a round (a few lists repeat a word on purpose across grades, not within one).
  const seen = new Set<string>();
  const words = pick(WORDS[g], WORDS[g].length).filter((w) => !seen.has(w.word.toLowerCase()) && seen.add(w.word.toLowerCase())).slice(0, ROUND_SIZE);
  const r: Round = { id: uuidv4(), member: m.id, subject: 'spelling', grade: g, started: Date.now(), answers: words.map((w) => w.word) };
  rounds.set(r.id, r);
  res.json({
    round_id: r.id,
    grade: g,
    // The word is needed to say it out loud; the screen never shows it until it's been answered.
    words: words.map((w) => ({ word: w.word, sentence: w.sentence, meaning: w.meaning })),
    tokens: noTokensWhy(m, 'spelling', g) ? null : readRewards().spelling.tiers,
    no_tokens_why: noTokensWhy(m, 'spelling', g),
  });
});

/** Start a tap-the-mistakes round (🔍 misspellings, 📝 grammar). */
function startTap(req: import('express').Request, res: import('express').Response, subject: Subject, make: (g: number) => GrammarItem[]) {
  const { member_id, grade, acting_member_id } = req.body ?? {};
  const m = memberOf(String(member_id));
  if (!m) return res.status(404).json({ error: 'not found' });
  if (!isSelfOrParent(req, m.id, acting_member_id)) return res.status(403).json({ error: "That's someone else's practice" });
  const g = Math.round(Number(grade));
  if (!(g >= 0 && g < GRADE_NAMES.length)) return res.status(400).json({ error: 'Grade: K–12' });
  const over = tryStart(m.id, subject);
  if (over) return res.status(429).json({ error: over, limit: true });
  const items = make(g);
  const r: Round = { id: uuidv4(), member: m.id, subject, grade: g, started: Date.now(), answers: [], tap: items };
  rounds.set(r.id, r);
  const why = noTokensWhy(m, subject, g);
  res.json({
    round_id: r.id,
    grade: g,
    // Only the words and how many to find — never which ones.
    items: items.map((it) => ({ words: it.tokens.map((t) => t.shown), mistakes: it.tokens.filter((t) => t.right !== null).length })),
    tokens: why ? null : readRewards()[subject].tiers,
    no_tokens_why: why,
  });
}

/** POST /grammar/start { member_id, grade } — 10 random sentences/paragraphs, each with mistakes. */
learningRouter.post('/grammar/start', (req, res) => startTap(req, res, 'grammar', (g) => pick(GRAMMAR[g], ROUND_SIZE)));

/** POST /spellcheck/start { member_id, grade } — 10 paragraphs with misspelled words to tap. */
learningRouter.post('/spellcheck/start', (req, res) =>
  startTap(req, res, 'spellcheck', (g) => {
    const out: GrammarItem[] = [];
    for (let k = 0; out.length < ROUND_SIZE && k < 100; k++) {
      const it = makeSpellcheckItem(g);
      if (it.tokens.some((t) => t.right !== null)) out.push(it);
    }
    return out;
  })
);

function tapResult(it: GrammarItem, tapped: number[]) {
  const want = it.tokens.flatMap((t, k) => (t.right !== null ? [k] : []));
  const got = [...new Set(tapped)].filter((k) => Number.isInteger(k) && k >= 0 && k < it.tokens.length).sort((a, b) => a - b);
  return {
    words: it.tokens.map((t) => t.shown),
    fixes: want.map((k) => ({ i: k, right: it.tokens[k].right as string })),
    tapped: got,
    ok: got.length === want.length && got.every((k, j) => k === want[j]),
    tip: it.tip,
  };
}
const cleanTaps = (a: unknown): number[] => (Array.isArray(a) ? a.map(Number).filter(Number.isInteger).slice(0, 200) : []);

const mathResult = (p: MathProblem, given: string) => ({ q: p.q, given, ok: checkMath(p, given), right: p.show, hint: p.hint, topic: p.topic });

/** POST /math/start { member_id, grade } — 10 problems at that grade (made fresh, mixed topics). */
learningRouter.post('/math/start', (req, res) => {
  const { member_id, grade, acting_member_id } = req.body ?? {};
  const m = memberOf(String(member_id));
  if (!m) return res.status(404).json({ error: 'not found' });
  if (!isSelfOrParent(req, m.id, acting_member_id)) return res.status(403).json({ error: "That's someone else's practice" });
  const g = Math.round(Number(grade));
  if (!(g >= 0 && g < GRADE_NAMES.length)) return res.status(400).json({ error: 'Grade: K–12' });
  const over = tryStart(m.id, 'math');
  if (over) return res.status(429).json({ error: over, limit: true });
  const math = mathRound(g, ROUND_SIZE);
  const r: Round = { id: uuidv4(), member: m.id, subject: 'math', grade: g, started: Date.now(), answers: [], math };
  rounds.set(r.id, r);
  const why = noTokensWhy(m, 'math', g);
  res.json({
    round_id: r.id,
    grade: g,
    problems: math.map((p) => ({ q: p.q, topic: p.topic, note: p.note ?? null, choices: p.choices ?? null })),
    tokens: why ? null : readRewards().math.tiers,
    no_tokens_why: why,
  });
});

/** GET /math/topics — what each grade covers. */
learningRouter.get('/math/topics', (_req, res) => res.json({ course: MATH_COURSE, topics: MATH_GRADE_TOPICS }));

/** POST /round/:id/check { index, tapped: number[] } — tap games: check one item (it's then final). */
learningRouter.post('/round/:id/check', (req, res) => {
  const r = rounds.get(req.params.id);
  if (!r?.tap && !r?.math) return res.status(404).json({ error: 'That round has expired — start a new one' });
  if (!isSelfOrParent(req, r.member, req.body?.acting_member_id)) return res.status(403).json({ error: "That's someone else's round" });
  const i = Math.round(Number(req.body?.index));
  if (r.math) {
    if (!(i >= 0 && i < r.math.length)) return res.status(400).json({ error: 'No such problem' });
    r.lockedText ??= [];
    r.lockedText[i] ??= String(req.body?.answer ?? '').slice(0, 40);
    rounds.set(r.id, r);
    return res.json(mathResult(r.math[i], r.lockedText[i]));
  }
  if (!r.tap || !(i >= 0 && i < r.tap.length)) return res.status(400).json({ error: 'No such item' });
  r.locked ??= [];
  r.locked[i] ??= tapResult(r.tap[i], cleanTaps(req.body?.tapped)).tapped;
  rounds.set(r.id, r);
  res.json(tapResult(r.tap[i], r.locked[i]));
});

const same = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase();

/** POST /round/:id/finish { answers: string[], acting_member_id } — checked here; pays tokens. */
learningRouter.post('/round/:id/finish', (req, res) => {
  const r = rounds.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'That round has expired — start a new one' });
  const { answers, acting_member_id } = req.body ?? {};
  if (!isSelfOrParent(req, r.member, acting_member_id)) return res.status(403).json({ error: "That's someone else's round" });
  const m = memberOf(r.member);
  if (!m) return res.status(404).json({ error: 'not found' });
  if (!rounds.finish(r.id)) return res.status(404).json({ error: 'That round was already finished' }); // each round counts once
  let items: unknown[];
  let correct: number;
  if (r.math) {
    const given: unknown[] = Array.isArray(answers) ? answers : [];
    const mathItems = r.math.map((p, i) => mathResult(p, r.lockedText?.[i] ?? String(given[i] ?? '').slice(0, 40)));
    items = mathItems;
    correct = mathItems.filter((x) => x.ok).length;
  } else if (r.tap) {
    // Each answer: the word numbers tapped (ones already checked stay as they were). Right =
    // exactly the mistakes, no more, no less.
    const taps: unknown[] = Array.isArray(answers) ? answers : [];
    const tapItems = r.tap.map((it, i) => tapResult(it, r.locked?.[i] ?? cleanTaps(taps[i])));
    items = tapItems;
    correct = tapItems.filter((x) => x.ok).length;
  } else {
    const given: string[] = Array.isArray(answers) ? answers.map((a) => String(a ?? '').slice(0, 60)) : [];
    const spellItems = r.answers.map((right, i) => ({ right, given: given[i] ?? '', ok: same(given[i] ?? '', right) }));
    items = spellItems;
    correct = spellItems.filter((x) => x.ok).length;
  }
  const total = r.math ? r.math.length : r.tap ? r.tap.length : r.answers.length;
  const pct = Math.round((correct / total) * 100);
  const rw = readRewards()[r.subject];
  const why = noTokensWhy(m, r.subject, r.grade);
  const tokens = why ? 0 : worth(rw.tiers, pct);
  const now = new Date();
  db.transaction(() => {
    db.prepare(
      'INSERT INTO learning_results (id, family_member_id, subject, grade, at, day, correct, total, tokens, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), m.id, r.subject, r.grade, now.toISOString(), localDay(now), correct, total, tokens, JSON.stringify(items.filter((x) => !(x as { ok: boolean }).ok)).slice(0, 4000));
    if (tokens) addTokens(m.id, tokens, `${SUBJECT_NAMES[r.subject]}: ${correct}/${total} at ${GRADE_NAMES[r.grade]}`);
  })();
  // 🎁 This round may have maxed out the last picked subject for today.
  const bonus = tokens ? maybePayBonus(m) : 0;
  res.json({ correct, total, pct, passed: pct >= passMark(rw.tiers), tokens, bonus, no_tokens_why: tokens ? null : why, items });
});

// ---- 💾 auto-save: where someone is in a round, a lesson or a typing lesson ----

const DRAFT_KEY = /^[a-z0-9:_-]{1,80}$/i;

/** GET /drafts/:memberId/:key → { data, updated_at } (data null when there's nothing saved). */
learningRouter.get('/drafts/:memberId/:key', (req, res) => {
  const { memberId, key } = req.params;
  if (!DRAFT_KEY.test(key)) return res.status(400).json({ error: 'bad key' });
  const row = db.prepare('SELECT data, updated_at FROM learning_drafts WHERE family_member_id = ? AND key = ?').get(memberId, key) as { data: string | null; updated_at: string } | undefined;
  const fresh = row?.data && Date.parse(row.updated_at) > Date.now() - KEEP_MS;
  res.json({ data: fresh ? JSON.parse(row!.data!) : null, updated_at: fresh ? row!.updated_at : null });
});

/** PUT /drafts/:memberId/:key { data, acting_member_id } — save their spot (data null = done with it). */
learningRouter.put('/drafts/:memberId/:key', (req, res) => {
  const { memberId, key } = req.params;
  const { data, acting_member_id } = req.body ?? {};
  if (!DRAFT_KEY.test(key)) return res.status(400).json({ error: 'bad key' });
  if (!memberOf(memberId)) return res.status(404).json({ error: 'not found' });
  if (!isSelfOrParent(req, memberId, acting_member_id)) return res.status(403).json({ error: "That's someone else's" });
  const json = data === null || data === undefined ? null : JSON.stringify(data);
  if (json && json.length > 200_000) return res.status(413).json({ error: 'too big' });
  db.prepare(
    'INSERT INTO learning_drafts (family_member_id, key, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(family_member_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
  ).run(memberId, key, json, new Date().toISOString());
  res.json({ ok: true });
});

// ---- 🗣️ speech, for browsers without voices ----

learningRouter.get('/speech', asyncHandler(async (_req, res) => res.json({ engine: await speechEngine() })));

/** GET /say?text=…&slow=1 — a WAV of it. Short texts only (a word, a sentence, a meaning). */
learningRouter.get(
  '/say',
  asyncHandler(async (req, res) => {
    const text = String(req.query.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text) return res.status(400).json({ error: 'Nothing to say' });
    try {
      const wav = await speak(text, req.query.slow === '1');
      res.set('Cache-Control', 'private, max-age=86400').type('audio/wav').send(wav);
    } catch (e) {
      res.status(503).json({ error: (e as Error).message });
    }
  })
);
