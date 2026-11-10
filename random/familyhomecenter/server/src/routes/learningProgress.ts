import { Router } from 'express';
import { db } from '../db.js';
import { GRADE_NAMES } from '../services/spellingWords.js';
import { LESSON_SUBJECTS, lessonRound } from './lessons.js';
import { SUBJECTS as PRACTICE_SUBJECTS } from './learning.js';
import type { FamilyMember } from '../types.js';
import { addWeeklyReportSection } from '../services/weeklyReport.js';
import { addDays } from '../utils/recurrence.js';

/**
 * 📈 Learning progress (📚 Learning → 📈 Progress): for one person, every lesson they've tried and
 * passed (each try, with its score — the history), their 🔁 round in each lesson subject, their
 * practice rounds (spelling, misspellings, grammar, math) and typing lessons. Read-only.
 */
export const learningProgressRouter = Router();

const MAX_ROWS = 2000;

learningProgressRouter.get('/:memberId', (req, res) => {
  const m = db.prepare('SELECT * FROM family_members WHERE id = ?').get(req.params.memberId) as FamilyMember | undefined;
  if (!m) return res.status(404).json({ error: 'not found' });
  const grade = (db.prepare('SELECT grade FROM learning_grades WHERE family_member_id = ?').get(m.id) as { grade: number } | undefined)?.grade ?? null;

  const tries = db
    .prepare('SELECT lesson_id, at, correct, total, passed, tokens FROM learning_lessons_done WHERE family_member_id = ? ORDER BY at DESC LIMIT ?')
    .all(m.id, MAX_ROWS) as Array<{ lesson_id: string; at: string; correct: number; total: number; passed: number; tokens: number }>;
  const byLesson = new Map<string, typeof tries>();
  for (const t of tries) byLesson.set(t.lesson_id, [...(byLesson.get(t.lesson_id) ?? []), t]);

  const lessons = Object.fromEntries(
    LESSON_SUBJECTS.map((s) => {
      const rows = db
        .prepare('SELECT id, grade, topic, title, hidden, quiz FROM learning_lessons WHERE subject = ? ORDER BY grade, sort, created_at')
        .all(s) as Array<{ id: string; grade: number; topic: string; title: string; hidden: number; quiz: string }>;
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
    })
  );

  const practice = Object.fromEntries(
    PRACTICE_SUBJECTS.map((s) => [
      s,
      db.prepare('SELECT grade, at, correct, total, tokens FROM learning_results WHERE family_member_id = ? AND subject = ? ORDER BY at DESC LIMIT ?').all(m.id, s, MAX_ROWS),
    ])
  );
  const typing = db
    .prepare("SELECT level, at, wpm, accuracy, passed, stars + speed_stars AS tokens FROM typing_results WHERE family_member_id = ? AND mode = 'lesson' ORDER BY at DESC LIMIT ?")
    .all(m.id, MAX_ROWS);

  res.json({ member: { id: m.id, grade, is_parent: m.is_parent === 1 }, grades: GRADE_NAMES, lessons, practice, typing });
});

// ---- 📬 the weekly report email (Sunday, to parents): the lessons each kid passed that week ----

const SUBJECT_LABEL: Record<string, string> = { grammar: '📝 Grammar', math: '➗ Math', history: '🇺🇸 History' };
const PRACTICE_LABEL: Record<string, string> = { spelling: '🔤 Spelling', spellcheck: '🔍 Misspellings', grammar: '📝 Grammar', math: '➗ Math' };
const MAX_LINES = 30;

/** Lines for one kid's week (start…end are local YYYY-MM-DD days, both included). */
export function learningWeekLines(member: FamilyMember, start: string, end: string): string[] {
  const from = new Date(`${start}T00:00:00`).toISOString();
  const to = new Date(`${addDays(end, 1)}T00:00:00`).toISOString();
  const tries = db
    .prepare(
      `SELECT l.subject, l.title, l.grade, MAX(d.passed) AS passed, MAX(CAST(d.correct AS REAL) / d.total) AS best, SUM(d.tokens) AS tokens, COUNT(*) AS n
       FROM learning_lessons_done d JOIN learning_lessons l ON l.id = d.lesson_id
       WHERE d.family_member_id = ? AND d.at >= ? AND d.at < ? GROUP BY d.lesson_id ORDER BY l.subject, l.grade, l.sort`
    )
    .all(member.id, from, to) as Array<{ subject: string; title: string; grade: number; passed: number; best: number; tokens: number; n: number }>;
  const passed = tries.filter((t) => t.passed);
  const notYet = tries.filter((t) => !t.passed);
  const lines: string[] = [];
  lines.push(`📖 Lessons this week: ${passed.length} passed · ${notYet.length} tried, not passed yet`);
  for (const t of passed.slice(0, MAX_LINES))
    lines.push(`✅ ${SUBJECT_LABEL[t.subject] ?? t.subject} (${GRADE_NAMES[t.grade]}): ${t.title}${t.tokens ? ` · +${t.tokens} 💎` : ''}${t.n > 1 ? ` · ${t.n} tries` : ''}`);
  if (passed.length > MAX_LINES) lines.push(`…and ${passed.length - MAX_LINES} more`);
  for (const t of notYet.slice(0, 10)) lines.push(`🟡 Tried, not passed yet: ${SUBJECT_LABEL[t.subject] ?? t.subject}: ${t.title} (best ${Math.round(t.best * 100)}%, ${t.n} tr${t.n === 1 ? 'y' : 'ies'})`);
  if (notYet.length > 10) lines.push(`🟡 …and ${notYet.length - 10} more tried`);
  for (const s of LESSON_SUBJECTS) {
    const r = lessonRound(member.id, s);
    const finished = db.prepare('SELECT grade, COUNT(*) AS n FROM learning_lesson_rounds WHERE family_member_id = ? AND subject = ? AND at >= ? AND at < ? GROUP BY grade').all(member.id, s, from, to) as Array<{ grade: number; n: number }>;
    const done = finished.reduce((a, f) => a + f.n, 0);
    for (const f of finished) lines.push(`🎉 ${SUBJECT_LABEL[s]}: passed every ${GRADE_NAMES[f.grade]} lesson — finished ${f.n === 1 ? 'a round' : `${f.n} rounds`}`);
    if (r && r.lesson_ids.length && (done || tries.some((t) => t.subject === s)))
      lines.push(`🔁 ${SUBJECT_LABEL[s]} round ${r.number}: ${r.paid_ids.length} of ${r.lesson_ids.length} ${GRADE_NAMES[r.grade]} lessons passed`);
  }
  const practice = db
    .prepare('SELECT subject, COUNT(*) AS n, AVG(CAST(correct AS REAL) / total) AS avg FROM learning_results WHERE family_member_id = ? AND at >= ? AND at < ? GROUP BY subject')
    .all(member.id, from, to) as Array<{ subject: string; n: number; avg: number }>;
  if (practice.length) lines.push(`🎯 Practice: ${practice.map((p) => `${PRACTICE_LABEL[p.subject] ?? p.subject} ${p.n}× (${Math.round(p.avg * 100)}% right)`).join(', ')}`);
  const typed = db
    .prepare("SELECT level, MAX(wpm) AS wpm FROM typing_results WHERE family_member_id = ? AND mode = 'lesson' AND passed = 1 AND at >= ? AND at < ? GROUP BY level ORDER BY level")
    .all(member.id, from, to) as Array<{ level: number; wpm: number }>;
  if (typed.length) lines.push(`⌨️ Typing lessons passed: ${typed.map((t) => `#${t.level} (${t.wpm} wpm)`).join(', ')}`);
  // Nothing at all this week: leave the section out.
  return tries.length || practice.length || typed.length ? lines : [];
}

addWeeklyReportSection((member, start, end) => ({ heading: '📚 Learning', lines: learningWeekLines(member, start, end) }));
