import type { LessonSeed, QuizItem } from './lessonContent.js';

/**
 * The extra ➗ math lessons are written in a short text form (mathLessons*.ts) so there can be lots
 * of them per grade. Each lesson:
 *
 *   @ slug | Topic | Title
 *   body (same markup as lessonContent.ts: "## ", "- ", "1. ", "✅ ", "❌ ", **bold**, blank lines)
 *   ? Question | choice | *right choice | choice
 *   > why (optional, shown after answering that question)
 *
 * Choices are split on " | ", and the one starting with * is right. The id is m-<grade>-<slug>
 * (grade 0 = k). Like every built-in lesson they're copied in once and never over a parent's edits.
 */
export function parseMathLessons(grade: number, text: string): LessonSeed[] {
  const out: LessonSeed[] = [];
  const g = grade === 0 ? 'k' : String(grade);
  for (const chunk of text.split(/^@ /m).slice(1)) {
    const lines = chunk.replace(/\r/g, '').split('\n');
    const [slug, topic, title] = lines[0].split(' | ').map((s) => s.trim());
    const body: string[] = [];
    const quiz: QuizItem[] = [];
    for (const raw of lines.slice(1)) {
      const l = raw.trimEnd();
      if (l.startsWith('? ')) {
        const [q, ...cs] = l.slice(2).split(' | ').map((s) => s.trim());
        const answer = cs.findIndex((c) => c.startsWith('*'));
        quiz.push({ q, choices: cs.map((c) => c.replace(/^\*/, '')), answer });
      } else if (l.startsWith('> ') && quiz.length) quiz[quiz.length - 1].why = l.slice(2).trim();
      else if (!quiz.length) body.push(l);
    }
    out.push({ id: `m-${g}-${slug}`, subject: 'math', grade, topic, title, body: body.join('\n').trim(), quiz });
  }
  return out;
}
