import type { LessonSeed } from './lessonContent.js';
import { parseMathLessons } from './mathLessonsParse.js';
import { MATH_1, MATH_2, MATH_K } from './mathLessonsK2.js';
import { MATH_3, MATH_4, MATH_5 } from './mathLessons35.js';

/** ➗ The extra math lessons (20+ per grade with the originals in lessonContent.ts). */
export const MORE_MATH_LESSONS: LessonSeed[] = [MATH_K, MATH_1, MATH_2, MATH_3, MATH_4, MATH_5].flatMap((t, g) => parseMathLessons(g, t));
