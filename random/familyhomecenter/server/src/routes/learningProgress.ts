import { Router } from 'express';
import { db } from '../db.js';
import { GRADE_NAMES } from '../services/spellingWords.js';
import { LESSON_SUBJECTS, lessonRound } from './lessons.js';
import { SUBJECTS as PRACTICE_SUBJECTS } from './learning.js';
import type { FamilyMember } from '../types.js';

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
