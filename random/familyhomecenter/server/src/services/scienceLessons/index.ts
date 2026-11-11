/** 🔬 Science lessons by grade (index = grade, 0 = K). Format: see ../mathLessonsParse.ts. Topics
 *  are the four branches; a body line "🧪 lab: <id>" shows that lab (client/src/labs/catalog.ts). */
import { S_K } from './sK.js';
import { S_1 } from './s1.js';
import { S_2 } from './s2.js';
import { S_3 } from './s3.js';

export const SCIENCE_TEXT: string[] = [S_K, S_1, S_2, S_3];
