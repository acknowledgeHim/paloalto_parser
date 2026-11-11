/** 🔬 Science lessons by grade (index = grade, 0 = K). Format: see ../mathLessonsParse.ts. Topics
 *  are the four branches; a body line "🧪 lab: <id>" shows that lab (client/src/labs/catalog.ts). */
import { S_K } from './sK.js';
import { S_1 } from './s1.js';

export const SCIENCE_TEXT: string[] = [S_K, S_1];
