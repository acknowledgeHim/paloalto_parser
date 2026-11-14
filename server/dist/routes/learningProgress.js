import { Router } from 'express';
import { db } from '../db.js';
import { GRADE_NAMES } from '../services/spellingWords.js';
import { MATH_GRADE_TOPICS } from '../services/mathGen.js';
import { LESSON_SUBJECTS, lessonRound } from './lessons.js';
import { SUBJECTS as PRACTICE_SUBJECTS } from './learning.js';
import { addWeeklyReportSection } from '../services/weeklyReport.js';
import { addDays } from '../utils/recurrence.js';
/**
 * 📈 Learning progress (📚 Learning → 📈 Progress): for one person, every lesson they've tried and
 * passed (each try, with its score — the history), their 🔁 round in each lesson subject, their
 * practice rounds (spelling, misspellings, grammar, math) and typing lessons. Read-only.
 */
export const learningProgressRouter = Router();
const MAX_ROWS = 2000;
/** 🔤 The words a spelling round got wrong (its detail keeps the missed items: { right, given }). */
function missedWords(detail) {
    try {
        const items = JSON.parse(detail ?? '[]');
        return Array.isArray(items) ? items.filter((x) => typeof x?.right === 'string').map((x) => ({ right: String(x.right), given: String(x.given ?? '') })) : [];
    }
    catch {
        return []; // detail is cut at 4000 characters, so a long one may not parse
    }
}
learningProgressRouter.get('/:memberId', (req, res) => {
    const m = db.prepare('SELECT * FROM family_members WHERE id = ?').get(req.params.memberId);
    if (!m)
        return res.status(404).json({ error: 'not found' });
    const grade = db.prepare('SELECT grade FROM learning_grades WHERE family_member_id = ?').get(m.id)?.grade ?? null;
    const tries = db
        .prepare('SELECT lesson_id, at, correct, total, passed, tokens FROM learning_lessons_done WHERE family_member_id = ? ORDER BY at DESC LIMIT ?')
        .all(m.id, MAX_ROWS);
    const byLesson = new Map();
    for (const t of tries)
        byLesson.set(t.lesson_id, [...(byLesson.get(t.lesson_id) ?? []), t]);
    const lessons = Object.fromEntries(LESSON_SUBJECTS.map((s) => {
        const rows = db
            .prepare('SELECT id, grade, topic, title, hidden, quiz FROM learning_lessons WHERE subject = ? ORDER BY grade, sort, created_at')
            .all(s);
        return [
            s,
            {
                round: lessonRound(m.id, s),
                rounds: db.prepare('SELECT grade, lessons, at FROM learning_lesson_rounds WHERE family_member_id = ? AND subject = ? ORDER BY at').all(m.id, s),
                lessons: rows
                    // hidden lessons only when they tried them (their history stays)
                    .filter((r) => r.hidden === 0 || byLesson.has(r.id))
                    .filter((r) => r.quiz !== '[]' || byLesson.has(r.id))
                    .map((r) => ({
                    id: r.id,
                    grade: r.grade,
                    topic: r.topic,
                    title: r.title,
                    hidden: r.hidden === 1,
                    tries: (byLesson.get(r.id) ?? []).map(({ lesson_id: _, ...t }) => t),
                })),
            },
        ];
    }));
    const practice = Object.fromEntries(PRACTICE_SUBJECTS.map((s) => [
        s,
        db.prepare('SELECT grade, at, correct, total, tokens, topic, detail FROM learning_results WHERE family_member_id = ? AND subject = ? ORDER BY at DESC LIMIT ?').all(m.id, s, MAX_ROWS).map(({ detail, ...r }) => (s === 'spelling' ? { ...r, missed: missedWords(detail) } : r)),
    ]));
    const typing = db
        .prepare("SELECT level, at, wpm, accuracy, passed, stars + speed_stars AS tokens FROM typing_results WHERE family_member_id = ? AND mode = 'lesson' ORDER BY at DESC LIMIT ?")
        .all(m.id, MAX_ROWS);
    // ⌨️ typing games and the daily challenge: how many, best, last
    const typing_games = db
        .prepare("SELECT mode, COUNT(*) AS n, MAX(wpm) AS best_wpm, MAX(score) AS best_score, MAX(at) AS last, SUM(stars) AS tokens FROM typing_results WHERE family_member_id = ? AND mode != 'lesson' GROUP BY mode ORDER BY n DESC")
        .all(m.id);
    // 🎯 topic practice (➗ math): every topic tried, at every grade — rounds, best, last, tokens
    const topics = db
        .prepare("SELECT grade, topic, COUNT(*) AS rounds, MAX(correct) AS best, MAX(total) AS total, MAX(at) AS last, SUM(tokens) AS tokens, SUM(CASE WHEN tokens > 0 THEN 1 ELSE 0 END) AS paid FROM learning_results WHERE family_member_id = ? AND subject = 'math' AND topic IS NOT NULL GROUP BY grade, topic ORDER BY grade, topic")
        .all(m.id);
    res.json({ member: { id: m.id, grade, is_parent: m.is_parent === 1 }, grades: GRADE_NAMES, lessons, practice, typing, typing_games, math_topics: topics, math_grade_topics: MATH_GRADE_TOPICS });
});
// ---- 📬 the weekly report email (Sunday, to parents): the lessons each kid passed that week ----
const SUBJECT_LABEL = { grammar: '📝 Grammar', math: '➗ Math', history: '🇺🇸 History', science: '🔬 Science', handson: '🔧 Hands-on' };
const PRACTICE_LABEL = { spelling: '🔤 Spelling', spellcheck: '🔍 Misspellings', grammar: '📝 Grammar', math: '➗ Math' };
const MAX_LINES = 30;
/** ⌨️ Typing lesson names — keep in sync with LEVELS in client/src/utils/typing.ts. */
const TYPING_LESSONS = [
    'Pointer fingers', 'Middle fingers', 'Ring fingers', 'Little fingers', 'The whole home row', 'Reach up: E and I', 'Reach up: R and U', 'Stretch: T and Y',
    'In the middle: G and H', 'Reach up: W and O', 'Little fingers up: Q and P', 'Bottom row: C V B N M , .', 'Last letters: X and Z', 'Capital letters (Shift)', 'Numbers', 'Real sentences',
];
const TYPING_GAMES = { balloon: '🎈 Balloons', race: '🏎️ Race', whack: '🔨 Whack', meteor: '☄️ Meteors', tower: '🗼 Tower', snake: '🐍 Snake', story: '📖 Story', daily: '📅 Daily challenge', shop: '🛒 Shop' };
/** Lines for one kid's week (start…end are local YYYY-MM-DD days, both included). */
export function learningWeekLines(member, start, end) {
    const from = new Date(`${start}T00:00:00`).toISOString();
    const to = new Date(`${addDays(end, 1)}T00:00:00`).toISOString();
    const tries = db
        .prepare(`SELECT l.subject, l.title, l.grade, MAX(d.passed) AS passed, MAX(CAST(d.correct AS REAL) / d.total) AS best, SUM(d.tokens) AS tokens, COUNT(*) AS n
       FROM learning_lessons_done d JOIN learning_lessons l ON l.id = d.lesson_id
       WHERE d.family_member_id = ? AND d.at >= ? AND d.at < ? GROUP BY d.lesson_id ORDER BY l.subject, l.grade, l.sort`)
        .all(member.id, from, to);
    const passed = tries.filter((t) => t.passed);
    const notYet = tries.filter((t) => !t.passed);
    const lines = [];
    lines.push(`📖 Lessons this week: ${passed.length} passed · ${notYet.length} tried, not passed yet`);
    for (const t of passed.slice(0, MAX_LINES))
        lines.push(`✅ ${SUBJECT_LABEL[t.subject] ?? t.subject} (${GRADE_NAMES[t.grade]}): ${t.title}${t.tokens ? ` · +${t.tokens} 💎` : ''}${t.n > 1 ? ` · ${t.n} tries` : ''}`);
    if (passed.length > MAX_LINES)
        lines.push(`…and ${passed.length - MAX_LINES} more`);
    for (const t of notYet.slice(0, 10))
        lines.push(`🟡 Tried, not passed yet: ${SUBJECT_LABEL[t.subject] ?? t.subject}: ${t.title} (best ${Math.round(t.best * 100)}%, ${t.n} tr${t.n === 1 ? 'y' : 'ies'})`);
    if (notYet.length > 10)
        lines.push(`🟡 …and ${notYet.length - 10} more tried`);
    for (const s of LESSON_SUBJECTS) {
        const r = lessonRound(member.id, s);
        const finished = db.prepare('SELECT grade, COUNT(*) AS n FROM learning_lesson_rounds WHERE family_member_id = ? AND subject = ? AND at >= ? AND at < ? GROUP BY grade').all(member.id, s, from, to);
        const done = finished.reduce((a, f) => a + f.n, 0);
        for (const f of finished)
            lines.push(`🎉 ${SUBJECT_LABEL[s]}: passed every ${GRADE_NAMES[f.grade]} lesson — finished ${f.n === 1 ? 'a round' : `${f.n} rounds`}`);
        if (r && r.lesson_ids.length && (done || tries.some((t) => t.subject === s)))
            lines.push(`🔁 ${SUBJECT_LABEL[s]} round ${r.number}: ${r.paid_ids.length} of ${r.lesson_ids.length} ${GRADE_NAMES[r.grade]} lessons passed`);
    }
    // 🔤 Spelling: rounds, how right, tokens, and the words missed (to practise)
    const spell = db
        .prepare("SELECT grade, correct, total, tokens, detail FROM learning_results WHERE family_member_id = ? AND subject = 'spelling' AND at >= ? AND at < ?")
        .all(member.id, from, to);
    if (spell.length) {
        const right = spell.reduce((a, r) => a + r.correct, 0);
        const all = spell.reduce((a, r) => a + r.total, 0);
        const tok = spell.reduce((a, r) => a + r.tokens, 0);
        const grades = [...new Set(spell.map((r) => GRADE_NAMES[r.grade]))].join(', ');
        lines.push(`🔤 Spelling: ${spell.length} round${spell.length === 1 ? '' : 's'} (${grades}) · ${right} of ${all} words right (${Math.round((right / all) * 100)}%)${tok ? ` · +${tok} 💎` : ''}`);
        const missed = new Map();
        for (const r of spell)
            for (const w of missedWords(r.detail))
                missed.set(w.right, (missed.get(w.right) ?? 0) + 1);
        if (missed.size)
            lines.push(`🔤 Words to practise: ${[...missed]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 25)
                .map(([w, n]) => (n > 1 ? `${w} ×${n}` : w))
                .join(', ')}${missed.size > 25 ? ` …and ${missed.size - 25} more` : ''}`);
    }
    const practice = db
        .prepare("SELECT subject, COUNT(*) AS n, AVG(CAST(correct AS REAL) / total) AS avg FROM learning_results WHERE family_member_id = ? AND subject != 'spelling' AND at >= ? AND at < ? GROUP BY subject")
        .all(member.id, from, to);
    if (practice.length)
        lines.push(`🎯 Practice: ${practice.map((p) => `${PRACTICE_LABEL[p.subject] ?? p.subject} ${p.n}× (${Math.round(p.avg * 100)}% right)`).join(', ')}`);
    const topicWeek = db
        .prepare("SELECT topic, COUNT(*) AS n, MAX(correct) AS best, MAX(total) AS total, SUM(tokens) AS tokens FROM learning_results WHERE family_member_id = ? AND subject = 'math' AND topic IS NOT NULL AND at >= ? AND at < ? GROUP BY topic ORDER BY n DESC")
        .all(member.id, from, to);
    if (topicWeek.length)
        lines.push(`🎯 Math topics: ${topicWeek.map((x) => `${x.topic}${x.n > 1 ? ` ×${x.n}` : ''} (best ${x.best}/${x.total}${x.tokens ? `, +${x.tokens} 💎` : ''})`).join(', ')}`);
    // ⌨️ Typing: lesson tries and passes, best speed, games
    const typing = db
        .prepare("SELECT level, MAX(passed) AS passed, MAX(wpm) AS wpm, MAX(accuracy) AS acc, COUNT(*) AS n FROM typing_results WHERE family_member_id = ? AND mode = 'lesson' AND at >= ? AND at < ? GROUP BY level ORDER BY level")
        .all(member.id, from, to);
    const games = db
        .prepare("SELECT mode, COUNT(*) AS n FROM typing_results WHERE family_member_id = ? AND mode != 'lesson' AND at >= ? AND at < ? GROUP BY mode ORDER BY n DESC")
        .all(member.id, from, to);
    const tname = (n) => `${n}. ${TYPING_LESSONS[n - 1] ?? 'Lesson'}`;
    for (const t of typing.filter((x) => x.passed))
        lines.push(`⌨️ Typing lesson passed: ${tname(t.level)} — ${t.wpm} wpm${t.n > 1 ? ` · ${t.n} tries` : ''}`);
    for (const t of typing.filter((x) => !x.passed))
        lines.push(`⌨️ Typing lesson tried, not passed yet: ${tname(t.level)} — best ${t.wpm} wpm, ${t.acc}% right, ${t.n} tr${t.n === 1 ? 'y' : 'ies'}`);
    if (games.length)
        lines.push(`⌨️ Typing games: ${games.map((g) => `${TYPING_GAMES[g.mode] ?? g.mode} ×${g.n}`).join(', ')}`);
    const passedAll = db.prepare("SELECT COUNT(DISTINCT level) AS n FROM typing_results WHERE family_member_id = ? AND mode = 'lesson' AND passed = 1").get(member.id).n;
    if (typing.length)
        lines.push(`⌨️ Typing so far: ${passedAll} of ${TYPING_LESSONS.length} lessons passed`);
    // Nothing at all this week: leave the section out.
    return tries.length || practice.length || spell.length || typing.length || games.length ? lines : [];
}
addWeeklyReportSection((member, start, end) => ({ heading: '📚 Learning', lines: learningWeekLines(member, start, end) }));
