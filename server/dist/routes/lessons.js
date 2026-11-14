import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, getSetting, setSetting } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { GRAMMAR_LESSONS, MATH_LESSONS } from '../services/lessonContent.js';
import { HISTORY_LESSONS } from '../services/historyContent.js';
import { MORE_MATH_LESSONS } from '../services/mathLessonsMore.js';
import { EXTRA_LESSONS } from '../services/lessonsExtra.js';
import { HANDSON_LESSONS } from '../services/handsOn/index.js';
import { isSelfOrParent, sessionActor } from '../services/rewards.js';
import { GRADE_NAMES } from '../services/spellingWords.js';
import { addTokens } from '../services/tokens.js';
/**
 * 📖 Lessons (📚 Learning → Grammar lessons, Math lessons, 🇺🇸 US History): read it, then take a
 * short quiz. Passing pays 💎 tokens (the parent sets how many — per lesson, or the subject's
 * default), for lessons at the kid's grade or higher — once per lesson per 🔁 round: after a kid has
 * passed every lesson at their grade in a subject, a new round starts and every lesson pays again
 * (so they move on to new lessons instead of redoing the easy ones). Lessons can always be retried. Lessons live in learning_lessons:
 * the built-in ones are added once, and parents can edit, add and hide them (nothing is deleted).
 */
export const lessonsRouter = Router();
export const LESSON_SUBJECTS = ['grammar', 'math', 'history', 'science', 'handson'];
/** 🔧 Hands-on is by trade, not by school grade: every hands-on lesson counts for every kid. */
const ANY_GRADE = new Set(['handson']);
const SUBJECTS = LESSON_SUBJECTS;
const LABEL = { grammar: '📝 Grammar lesson', math: '➗ Math lesson', history: '🇺🇸 US History', science: '🔬 Science', handson: '🔧 Hands-on' };
// ---- built-in lessons: added once, never over a parent's edits ----
function seed(list) {
    const now = new Date().toISOString();
    const ins = db.prepare(`INSERT OR IGNORE INTO learning_lessons (id, subject, grade, topic, title, body, quiz, tokens, sort, hidden, builtin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, 1, ?, ?)`);
    db.transaction(() => list.forEach((l, i) => ins.run(l.id, l.subject, l.grade, l.topic, l.title, l.body, JSON.stringify(l.quiz), i, now, now)))();
}
// (new lists go on the end, so the lessons already added keep their order)
seed([...GRAMMAR_LESSONS, ...MATH_LESSONS, ...HISTORY_LESSONS, ...MORE_MATH_LESSONS, ...EXTRA_LESSONS, ...HANDSON_LESSONS]);
// ---- built-in lessons replaced by newer ones (2026-11-11: climate-change topics → how energy
// is made from sun, wind, water, heat and hydrogen). Each old one is hidden ONCE, and only if no
// parent edited it; it stays in the database with all its tries, and a parent can un-hide it.
const RETIRED = [
    's-7-climate-change-7',
    's-8-climate-solutions-8',
    's-9-range-shift-9',
    's-10-ocean-acidification',
    's-12-energy-budget',
    's-12-feedbacks',
    's-12-sustainability',
    's-12-ice-cores-12',
    's-12-climate-models-12',
    's-12-carbon-capture-12',
];
function retire(ids) {
    const seen = db.prepare('SELECT 1 FROM learning_lessons_retired WHERE lesson_id = ?');
    const hide = db.prepare('UPDATE learning_lessons SET hidden = 1 WHERE id = ? AND builtin = 1 AND updated_by IS NULL');
    const mark = db.prepare('INSERT INTO learning_lessons_retired (lesson_id, at) VALUES (?, ?)');
    const now = new Date().toISOString();
    db.transaction(() => {
        for (const id of ids) {
            if (seen.get(id))
                continue;
            hide.run(id);
            mark.run(id, now);
        }
    })();
}
retire(RETIRED);
const SETTING = 'learning_lessons';
function readSettings() {
    let saved = {};
    try {
        saved = JSON.parse(getSetting(SETTING, '{}'));
    }
    catch {
        /* defaults */
    }
    const ok = (v, lo, hi, d) => {
        const n = Math.round(Number(v));
        return v !== undefined && v !== null && Number.isFinite(n) && n >= lo && n <= hi ? n : d;
    };
    return Object.fromEntries(SUBJECTS.map((s) => [s, { tokens: ok(saved[s]?.tokens, 0, 1000, s === 'history' || s === 'science' || s === 'handson' ? 2 : 1), pass_pct: ok(saved[s]?.pass_pct, 10, 100, 80) }]));
}
lessonsRouter.get('/settings', (_req, res) => res.json(readSettings()));
lessonsRouter.put('/settings', requireAdmin, (req, res) => {
    const cur = readSettings();
    const b = (req.body ?? {});
    for (const s of SUBJECTS) {
        if (!b[s])
            continue;
        const t = Math.round(Number(b[s].tokens));
        const p = Math.round(Number(b[s].pass_pct));
        if (b[s].tokens !== undefined && t >= 0 && t <= 1000)
            cur[s].tokens = t;
        if (b[s].pass_pct !== undefined && p >= 10 && p <= 100)
            cur[s].pass_pct = p;
    }
    setSetting(SETTING, JSON.stringify(cur));
    res.json(readSettings());
});
const memberOf = (id) => db.prepare('SELECT * FROM family_members WHERE id = ?').get(id);
const gradeOf = (id) => db.prepare('SELECT grade FROM learning_grades WHERE family_member_id = ?').get(id)?.grade ?? null;
const quizOf = (r) => {
    try {
        const q = JSON.parse(r.quiz);
        return Array.isArray(q) ? q : [];
    }
    catch {
        return [];
    }
};
const worth = (r) => r.tokens ?? readSettings()[r.subject].tokens;
// ---- 🔁 rounds: each lesson pays once a round; passing all of them at your grade starts a new one ----
/** When their current round in this subject began ('' = the first round: everything so far). */
const roundStart = (memberId, subject) => db.prepare('SELECT MAX(at) AS at FROM learning_lesson_rounds WHERE family_member_id = ? AND subject = ?').get(memberId, subject).at ?? '';
const paidCount = (memberId, lessonId, since) => db.prepare('SELECT COUNT(*) AS n FROM learning_lessons_done WHERE family_member_id = ? AND lesson_id = ? AND tokens > 0 AND at > ?').get(memberId, lessonId, since).n;
const paidFor = (memberId, lessonId, since) => paidCount(memberId, lessonId, since) > 0;
/** How many times passing it pays each round (1 unless a parent made it repeatable). */
const payTimes = (r) => Math.max(1, r.pay_times ?? 1);
const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
};
/** Where a kid is in this subject's round (null: parents, kids with no grade). Starts a new round
 *  when every lesson in it is paid — also when a parent hid or changed the last ones left. */
export function lessonRound(memberId, subject) {
    const m = memberOf(memberId);
    const g = m && m.is_parent !== 1 ? gradeOf(m.id) : null;
    if (!m || g === null)
        return null;
    const set = (ANY_GRADE.has(subject)
        ? db.prepare('SELECT * FROM learning_lessons WHERE subject = ? AND hidden = 0 ORDER BY sort, created_at').all(subject)
        : db.prepare('SELECT * FROM learning_lessons WHERE subject = ? AND grade = ? AND hidden = 0 ORDER BY sort, created_at').all(subject, g)).filter((r) => quizOf(r).length > 0 && worth(r) > 0);
    const status = () => {
        const since = roundStart(m.id, subject);
        return {
            subject,
            grade: g,
            number: 1 + db.prepare('SELECT COUNT(*) AS n FROM learning_lesson_rounds WHERE family_member_id = ? AND subject = ?').get(m.id, subject).n,
            started_at: since || null,
            lesson_ids: set.map((r) => r.id),
            paid_ids: set.filter((r) => paidFor(m.id, r.id, since)).map((r) => r.id),
            passed_today: db
                .prepare('SELECT COUNT(DISTINCT d.lesson_id) AS n FROM learning_lessons_done d JOIN learning_lessons l ON l.id = d.lesson_id WHERE d.family_member_id = ? AND l.subject = ? AND d.passed = 1 AND d.at >= ?')
                .get(m.id, subject, startOfToday()).n,
        };
    };
    const st = status();
    if (!set.length || st.paid_ids.length < set.length)
        return st;
    db.prepare('INSERT INTO learning_lesson_rounds (id, family_member_id, subject, grade, lessons, at) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), m.id, subject, g, set.length, new Date().toISOString());
    return status();
}
/**
 * 🏆 Has this kid passed every lesson in the subject at their grade (ever — not just this round)?
 * Every lesson that has a quiz counts, paid or not; hidden ones don't. null: parents, or no grade set.
 */
export function subjectMastery(memberId, subject) {
    const m = memberOf(memberId);
    const g = m && m.is_parent !== 1 ? gradeOf(m.id) : null;
    if (!m || g === null)
        return null;
    const anyGrade = ANY_GRADE.has(subject);
    const set = (anyGrade ? db.prepare('SELECT * FROM learning_lessons WHERE subject = ? AND hidden = 0').all(subject) : db.prepare('SELECT * FROM learning_lessons WHERE subject = ? AND grade = ? AND hidden = 0').all(subject, g)).filter((r) => quizOf(r).length > 0);
    const passedIds = new Set(db.prepare('SELECT DISTINCT d.lesson_id FROM learning_lessons_done d JOIN learning_lessons l ON l.id = d.lesson_id WHERE d.family_member_id = ? AND d.passed = 1 AND l.subject = ? AND (l.grade = ? OR ?)').all(m.id, subject, g, anyGrade ? 1 : 0).map((x) => x.lesson_id));
    const passed = set.filter((r) => passedIds.has(r.id)).length;
    return { grade: g, total: set.length, passed, done: set.length > 0 && passed === set.length };
}
function noTokensWhy(m, r) {
    if (!m)
        return 'Pick who you are up top to earn tokens';
    if (m.is_parent === 1)
        return 'Parents read just for fun';
    const g = gradeOf(m.id);
    if (g === null)
        return 'A parent needs to set your grade first (📚 Learning → ⚙️ Grades & tokens)';
    if (r.grade < g && !ANY_GRADE.has(r.subject))
        return `Below your grade (${GRADE_NAMES[g]}) — for practice, no tokens`;
    if (!worth(r))
        return 'This lesson pays no tokens';
    const round = lessonRound(m.id, r.subject);
    if (round && paidCount(m.id, r.id, round.started_at ?? '') >= payTimes(r)) {
        const left = round.lesson_ids.length - round.paid_ids.length;
        if (payTimes(r) > 1)
            return `Already earned its ${payTimes(r)} times this round 🔁 — ${left ? `pass the other ${left} ${GRADE_NAMES[g]} lesson${left === 1 ? '' : 's'} and every lesson pays again` : 'a new round starts soon'}. You can still practise it.`;
        return `Already earned this round 🔁 — pass the other ${left} ${ANY_GRADE.has(r.subject) ? '' : `${GRADE_NAMES[g]} `}lesson${left === 1 ? '' : 's'} and every lesson pays again. You can still practise it.`;
    }
    return null;
}
/** GET /?subject=grammar&member_id=…&all=1 — the lessons (all=1: hidden ones too, for parents). */
lessonsRouter.get('/', (req, res) => {
    const subject = String(req.query.subject);
    if (!SUBJECTS.includes(subject))
        return res.status(400).json({ error: `subject: ${SUBJECTS.join(', ')}` });
    const m = req.query.member_id ? memberOf(String(req.query.member_id)) : undefined;
    const round = m ? lessonRound(m.id, subject) : null;
    const paidNow = new Map(m && round
        ? db.prepare('SELECT lesson_id, COUNT(*) AS n FROM learning_lessons_done WHERE family_member_id = ? AND tokens > 0 AND at > ? GROUP BY lesson_id').all(m.id, round.started_at ?? '').map((x) => [x.lesson_id, x.n])
        : []);
    const passedToday = new Set(m ? db.prepare('SELECT DISTINCT lesson_id FROM learning_lessons_done WHERE family_member_id = ? AND passed = 1 AND at >= ?').all(m.id, startOfToday()).map((x) => x.lesson_id) : []);
    const rows = db
        .prepare(`SELECT * FROM learning_lessons WHERE subject = ? ${req.query.all === '1' ? '' : 'AND hidden = 0'} ORDER BY grade, sort, created_at`)
        .all(subject);
    const done = new Map();
    if (m)
        for (const d of db
            .prepare('SELECT lesson_id, MAX(passed) AS passed, MAX(correct) AS best, MAX(total) AS total, SUM(tokens) AS paid FROM learning_lessons_done WHERE family_member_id = ? GROUP BY lesson_id')
            .all(m.id))
            done.set(d.lesson_id, d);
    res.json({
        settings: readSettings()[subject],
        grades: GRADE_NAMES,
        member: m ? { grade: gradeOf(m.id), is_parent: m.is_parent === 1 } : null,
        round: round ? { number: round.number, grade: round.grade, started_at: round.started_at, total: round.lesson_ids.length, paid: round.paid_ids.length, passed_today: round.passed_today } : null,
        lessons: rows.map((r) => ({
            id: r.id,
            grade: r.grade,
            topic: r.topic,
            title: r.title,
            tokens: worth(r),
            tokens_set: r.tokens,
            hidden: r.hidden === 1,
            builtin: r.builtin === 1,
            questions: quizOf(r).length,
            done: done.get(r.id) ?? null,
            /** 🔁 its tokens are already paid this round */
            paid_this_round: (paidNow.get(r.id) ?? 0) >= payTimes(r),
            /** 🔁 repeatable: pays up to pay_times a round; times_paid so far this round */
            pay_times: payTimes(r),
            times_paid: paidNow.get(r.id) ?? 0,
            passed_today: passedToday.has(r.id),
        })),
    });
});
/** GET /:id — the lesson to read, and its quiz questions (not the answers). ?edit=1 (parents): with answers. */
lessonsRouter.get('/:id', (req, res, next) => {
    const r = db.prepare('SELECT * FROM learning_lessons WHERE id = ?').get(req.params.id);
    if (!r)
        return res.status(404).json({ error: 'No such lesson' });
    const base = { id: r.id, subject: r.subject, grade: r.grade, topic: r.topic, title: r.title, body: r.body, tokens: worth(r), tokens_set: r.tokens, pay_times: payTimes(r), hidden: r.hidden === 1, builtin: r.builtin === 1, updated_at: r.updated_at };
    if (req.query.edit === '1')
        return requireAdmin(req, res, () => res.json({ ...base, quiz: quizOf(r) }));
    const m = req.query.member_id ? memberOf(String(req.query.member_id)) : undefined;
    res.json({ ...base, quiz: quizOf(r).map((x) => ({ q: x.q, choices: x.choices })), no_tokens_why: noTokensWhy(m, r) });
    void next;
});
/** POST /:id/quiz { member_id, answers: number[], acting_member_id } — check it; pays once if passed. */
lessonsRouter.post('/:id/quiz', (req, res) => {
    const r = db.prepare('SELECT * FROM learning_lessons WHERE id = ?').get(req.params.id);
    if (!r)
        return res.status(404).json({ error: 'No such lesson' });
    const { member_id, answers, acting_member_id } = req.body ?? {};
    const m = memberOf(String(member_id));
    if (!m)
        return res.status(404).json({ error: 'not found' });
    if (!isSelfOrParent(req, m.id, acting_member_id))
        return res.status(403).json({ error: "That's someone else's quiz" });
    const quiz = quizOf(r);
    if (!quiz.length)
        return res.status(400).json({ error: 'This lesson has no quiz yet' });
    const given = Array.isArray(answers) ? answers : [];
    const items = quiz.map((x, i) => {
        const g = given[i] === null || given[i] === undefined ? null : Math.round(Number(given[i]));
        return { q: x.q, choices: x.choices, answer: x.answer, given: g, ok: g === x.answer, why: x.why ?? null };
    });
    const correct = items.filter((x) => x.ok).length;
    const pct = Math.round((correct / quiz.length) * 100);
    const passed = pct >= readSettings()[r.subject].pass_pct;
    const why = noTokensWhy(m, r);
    const tokens = passed && !why ? worth(r) : 0;
    db.transaction(() => {
        db.prepare('INSERT INTO learning_lessons_done (id, family_member_id, lesson_id, at, correct, total, passed, tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), m.id, r.id, new Date().toISOString(), correct, quiz.length, passed ? 1 : 0, tokens);
        if (tokens)
            addTokens(m.id, tokens, `${LABEL[r.subject]}: ${r.title}`);
    })();
    // 🔁 That may have been the last one at their grade: a new round starts.
    const before = tokens ? roundStart(m.id, r.subject) : '';
    const round = tokens ? lessonRound(m.id, r.subject) : null;
    const newRound = Boolean(round && (round.started_at ?? '') !== before);
    res.json({
        round: round ? { number: round.number, total: round.lesson_ids.length, paid: round.paid_ids.length, new_round: newRound } : null,
        correct, total: quiz.length, pct, passed, pass_pct: readSettings()[r.subject].pass_pct, tokens, no_tokens_why: tokens ? null : passed ? why : null, items
    });
});
// ---- ✏️ parents: add, edit, hide ----
function cleanQuiz(v) {
    if (!Array.isArray(v) || v.length > 40)
        return null;
    const out = [];
    for (const x of v) {
        const q = String(x?.q ?? '').trim().slice(0, 600);
        const choices = Array.isArray(x?.choices) ? x.choices.map((c) => String(c ?? '').trim().slice(0, 300)).filter(Boolean).slice(0, 8) : [];
        const answer = Math.round(Number(x?.answer));
        if (!q || choices.length < 2 || !(answer >= 0 && answer < choices.length))
            return null;
        const why = String(x?.why ?? '').trim().slice(0, 600);
        out.push(why ? { q, choices, answer, why } : { q, choices, answer });
    }
    return out;
}
function applyEdit(b, cur) {
    const out = { ...cur };
    if (b.subject !== undefined) {
        if (!SUBJECTS.includes(b.subject))
            return 'Pick a subject';
        out.subject = b.subject;
    }
    if (b.grade !== undefined) {
        const g = Math.round(Number(b.grade));
        if (!(g >= 0 && g < GRADE_NAMES.length))
            return 'Grade: K–12';
        out.grade = g;
    }
    if (b.topic !== undefined)
        out.topic = String(b.topic).trim().slice(0, 100);
    if (b.title !== undefined) {
        const t = String(b.title).trim().slice(0, 200);
        if (!t)
            return 'A lesson needs a title';
        out.title = t;
    }
    if (b.body !== undefined)
        out.body = String(b.body).slice(0, 50_000);
    if (b.quiz !== undefined) {
        const q = cleanQuiz(b.quiz);
        if (!q)
            return 'Each question needs the question, at least 2 choices, and which one is right';
        out.quiz = JSON.stringify(q);
    }
    if (b.tokens !== undefined) {
        if (b.tokens === null)
            out.tokens = null;
        else {
            const t = Math.round(Number(b.tokens));
            if (!(t >= 0 && t <= 1000))
                return 'Tokens: 0–1000';
            out.tokens = t;
        }
    }
    if (b.pay_times !== undefined) {
        const t = b.pay_times === null ? 1 : Math.round(Number(b.pay_times));
        if (!(t >= 1 && t <= 50))
            return 'Pays tokens: 1–50 times a round';
        out.pay_times = t === 1 ? null : t;
    }
    if (b.hidden !== undefined)
        out.hidden = b.hidden ? 1 : 0;
    if (b.sort !== undefined && Number.isFinite(Number(b.sort)))
        out.sort = Math.round(Number(b.sort));
    return out;
}
/** POST / { subject, grade, topic, title, body, quiz, tokens } — a new lesson (parents). */
lessonsRouter.post('/', requireAdmin, (req, res) => {
    const b = (req.body ?? {});
    const r = applyEdit({ ...b, subject: b.subject ?? '', title: b.title ?? '', grade: b.grade ?? -1 }, { topic: '', body: '', quiz: '[]', tokens: null, hidden: 0, sort: 1000 });
    if (typeof r === 'string')
        return res.status(400).json({ error: r });
    const id = `p-${uuidv4()}`;
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO learning_lessons (id, subject, grade, topic, title, body, quiz, tokens, pay_times, sort, hidden, builtin, created_at, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`).run(id, r.subject, r.grade, r.topic, r.title, r.body, r.quiz, r.tokens ?? null, r.pay_times ?? null, r.sort ?? 1000, r.hidden ?? 0, now, now, sessionActor(req, b.acting_member_id));
    res.json({ id });
});
/** PUT /:id { any of: grade, topic, title, body, quiz, tokens (null = the default), hidden } — parents. */
lessonsRouter.put('/:id', requireAdmin, (req, res) => {
    const cur = db.prepare('SELECT * FROM learning_lessons WHERE id = ?').get(req.params.id);
    if (!cur)
        return res.status(404).json({ error: 'No such lesson' });
    const b = (req.body ?? {});
    const r = applyEdit({ ...b, subject: undefined }, cur);
    if (typeof r === 'string')
        return res.status(400).json({ error: r });
    db.prepare('UPDATE learning_lessons SET grade = ?, topic = ?, title = ?, body = ?, quiz = ?, tokens = ?, pay_times = ?, hidden = ?, sort = ?, updated_at = ?, updated_by = ? WHERE id = ?').run(r.grade, r.topic, r.title, r.body, r.quiz, r.tokens ?? null, r.pay_times ?? null, r.hidden, r.sort, new Date().toISOString(), sessionActor(req, b.acting_member_id), cur.id);
    res.json({ ok: true });
});
