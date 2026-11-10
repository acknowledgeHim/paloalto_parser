import type { LessonSeed } from './lessonContent.js';
import { parseLessons } from './mathLessonsParse.js';
import { GRAMMAR_TEXT } from './grammarLessons/index.js';
import { MATH_EXTRA_TEXT } from './mathLessonsExtra/index.js';

/**
 * 📖 The big lesson sets: ~50 📝 grammar and ~50 ➗ math lessons for each grade, K–12 — about a
 * school year each (with the older ones in lessonContent.ts and mathLessons*.ts). Written in the
 * short text form (see mathLessonsParse.ts); quiz choices are mixed up. Added once, like every
 * built-in lesson, and never over a parent's edits.
 */
export const EXTRA_LESSONS: LessonSeed[] = [
  ...GRAMMAR_TEXT.flatMap((t, g) => (t ? parseLessons('grammar', g, t, { shuffle: true }) : [])),
  ...MATH_EXTRA_TEXT.flatMap((t, g) => (t ? parseLessons('math', g, t, { shuffle: true }) : [])),
];
