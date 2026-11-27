import fs from 'node:fs';
import { WORDS } from './spellingWords.js';
/**
 * 🔍 Spot the misspellings: a short paragraph made from a grade's spelling sentences, with some of
 * that grade's words spelled wrong in a believable way (a dropped or doubled letter, ie/ei, a wrong
 * vowel …). The kid taps each misspelled word. Higher grades: longer paragraphs, more to find.
 * A misspelling is never a real word (checked against the spelling lists and, when the computer
 * has one, its dictionary), so "form" can't turn into "from".
 */
const real = new Set();
for (const g of WORDS)
    for (const w of g)
        for (const t of `${w.word} ${w.sentence} ${w.meaning}`.toLowerCase().match(/[a-z']+/g) ?? [])
            real.add(t);
try {
    for (const w of fs.readFileSync('/usr/share/dict/words', 'utf8').split('\n'))
        if (w)
            real.add(w.toLowerCase());
}
catch {
    /* no dictionary on this computer: the spelling lists still guard */
}
const VOWELS = 'aeiou';
const SWAPS = [
    [/ie/, 'ei'],
    [/ei/, 'ie'],
    [/ph/, 'f'],
    [/ck/, 'k'],
    [/tion$/, 'shun'],
    [/ous$/, 'us'],
    [/ight/, 'ite'],
    [/ough/, 'uff'],
    [/able$/, 'ible'],
    [/ible$/, 'able'],
    [/ance$/, 'ence'],
    [/ence$/, 'ance'],
    [/ant$/, 'ent'],
    [/ent$/, 'ant'],
    [/ary$/, 'ery'],
    [/ery$/, 'ary'],
    [/c([ei])/, 's$1'],
    [/qu/, 'kw'],
    [/wh/, 'w'],
    [/kn/, 'n'],
    [/wr/, 'r'],
];
/** One believable misspelling, or null. */
export function misspell(word, r) {
    const w = word.toLowerCase();
    const tries = [
        // a doubled letter made single, or a single consonant doubled
        () => {
            const m = [...w.matchAll(/([a-z])\1/g)];
            if (m.length) {
                const x = m[Math.floor(r() * m.length)];
                return w.slice(0, x.index) + w.slice(x.index + 1);
            }
            const spots = [...w].map((c, i) => i).filter((i) => i > 0 && i < w.length - 1 && !VOWELS.includes(w[i]) && VOWELS.includes(w[i - 1]));
            if (!spots.length)
                return null;
            const i = spots[Math.floor(r() * spots.length)];
            return w.slice(0, i) + w[i] + w.slice(i);
        },
        // a sound written another way
        () => {
            const ok = SWAPS.filter(([re]) => re.test(w));
            if (!ok.length)
                return null;
            const [re, to] = ok[Math.floor(r() * ok.length)];
            return w.replace(re, to);
        },
        // a vowel in the middle swapped for another
        () => {
            const spots = [...w].map((c, i) => i).filter((i) => i > 0 && VOWELS.includes(w[i]));
            if (!spots.length)
                return null;
            const i = spots[Math.floor(r() * spots.length)];
            const others = VOWELS.replace(w[i], '');
            return w.slice(0, i) + others[Math.floor(r() * others.length)] + w.slice(i + 1);
        },
        // a silent e dropped
        () => (w.length > 3 && /[^aeiou]e$/.test(w) ? w.slice(0, -1) : null),
        // two letters swapped in the middle
        () => {
            if (w.length < 4)
                return null;
            const i = 1 + Math.floor(r() * (w.length - 2));
            if (i + 1 >= w.length || w[i] === w[i + 1])
                return null;
            return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
        },
        // a letter left out
        () => {
            if (w.length < 5)
                return null;
            const i = 1 + Math.floor(r() * (w.length - 2));
            return w.slice(0, i) + w.slice(i + 1);
        },
    ];
    for (let k = 0; k < 30; k++) {
        const out = tries[Math.floor(r() * tries.length)]();
        if (out && out !== w && out.length >= 2 && !real.has(out))
            return word[0] === word[0].toUpperCase() ? out[0].toUpperCase() + out.slice(1) : out;
    }
    return null;
}
/** Sentences in a paragraph, and how many words to misspell, by grade. */
function shape(g) {
    if (g <= 1)
        return { sentences: 2, mistakes: [1, 1] };
    if (g <= 3)
        return { sentences: 3, mistakes: [1, 2] };
    if (g <= 6)
        return { sentences: 3, mistakes: [2, 3] };
    if (g <= 9)
        return { sentences: 4, mistakes: [2, 4] };
    return { sentences: 5, mistakes: [3, 4] };
}
export function makeSpellcheckItem(g, r = Math.random) {
    const list = WORDS[g];
    const { sentences, mistakes } = shape(g);
    const picked = new Set();
    while (picked.size < Math.min(sentences, list.length))
        picked.add(Math.floor(r() * list.length));
    const chosen = [...picked].map((i) => list[i]);
    const want = mistakes[0] + Math.floor(r() * (mistakes[1] - mistakes[0] + 1));
    const order = chosen.map((_, i) => i).sort(() => r() - 0.5);
    const wrongIn = new Set(order.slice(0, want));
    const tokens = [];
    const fixedWords = [];
    chosen.forEach((w, si) => {
        let done = !wrongIn.has(si);
        for (const t of w.sentence.split(/\s+/)) {
            const m = /^([^A-Za-z]*)([A-Za-z']+)([^A-Za-z]*)$/.exec(t);
            if (!done && m && m[2].toLowerCase() === w.word.toLowerCase()) {
                const bad = misspell(m[2], r);
                if (bad) {
                    tokens.push({ shown: m[1] + bad + m[3], right: t });
                    fixedWords.push(w.word);
                    done = true;
                    continue;
                }
            }
            tokens.push({ shown: t, right: null });
        }
    });
    return { tokens, tip: fixedWords.length ? `Spelled right: ${fixedWords.join(', ')}` : '' };
}
