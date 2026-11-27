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
export function parseMathLessons(grade, text) {
    return parseLessons('math', grade, text);
}
/** Same text form for any subject; ids are <m|g|h|s>-<grade>-<slug>. With shuffle, each question's
 *  choices are put in a fixed but mixed-up order (so the right one isn't always in one place —
 *  the lesson text can list it first). */
export function parseLessons(subject, grade, text, opts = {}) {
    const out = [];
    const g = grade === 0 ? 'k' : String(grade);
    const prefix = subject === 'math' ? 'm' : subject === 'grammar' ? 'g' : subject === 'science' ? 's' : subject === 'handson' ? 'ho' : 'h';
    for (const chunk of text.split(/^@ /m).slice(1)) {
        const lines = chunk.replace(/\r/g, '').split('\n');
        const [slug, topic, title] = lines[0].split(' | ').map((s) => s.trim());
        const id = `${prefix}-${g}-${slug}`;
        const body = [];
        const quiz = [];
        for (const raw of lines.slice(1)) {
            const l = raw.trimEnd();
            if (l.startsWith('? ')) {
                const [q, ...cs] = l.slice(2).split(' | ').map((s) => s.trim());
                let choices = cs.map((c) => c.replace(/^\*/, ''));
                let answer = cs.findIndex((c) => c.startsWith('*'));
                if (opts.shuffle && answer >= 0) {
                    const right = choices[answer];
                    choices = mix(choices, `${id}#${quiz.length}`);
                    answer = choices.indexOf(right);
                }
                quiz.push({ q, choices, answer });
            }
            else if (l.startsWith('> ') && quiz.length)
                quiz[quiz.length - 1].why = l.slice(2).trim();
            else if (!quiz.length)
                body.push(l);
        }
        out.push({ id, subject, grade, topic, title, body: body.join('\n').trim(), quiz });
    }
    return out;
}
/** A fixed shuffle (the same every start, so a lesson's quiz never changes under a parent). */
function mix(list, key) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++)
        h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
        const j = h % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
