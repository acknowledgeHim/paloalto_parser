import { GRAMMAR as HANDWRITTEN, parse } from './grammarContent.js';
const pk = (r, a) => a[Math.floor(r() * a.length)];
function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// ---- word lists ----
const NAMES = ['Sam', 'Mia', 'Leo', 'Ava', 'Max', 'Zoe', 'Ben', 'Lily', 'Omar', 'Nora', 'Eli', 'Ruby', 'Jack', 'Emma', 'Noah', 'Ivy', 'Luis', 'Maya', 'Owen', 'Grace', 'Kai', 'Rosa', 'Finn', 'Hana'];
const ANIMALS = ['dog', 'cat', 'bird', 'frog', 'duck', 'horse', 'pig', 'cow', 'goat', 'bear', 'lion', 'tiger', 'snake', 'turtle', 'rabbit', 'puppy', 'kitten', 'owl'];
const plural = (a) => (a.endsWith('y') && !/[aeiou]y$/.test(a) ? a.slice(0, -1) + 'ies' : a + 's');
const TAILED = ['dog', 'cat', 'horse', 'pig', 'cow', 'goat', 'lion', 'tiger', 'puppy', 'kitten', 'rabbit'];
const PLACES = ['the park', 'the zoo', 'the store', 'the beach', 'the library', 'the farm', 'the lake', 'the pool', 'the museum', 'the playground', 'the fair', 'the river'];
const FOODS = ['pizza', 'apples', 'pancakes', 'tacos', 'soup', 'carrots', 'cookies', 'grapes', 'rice', 'noodles', 'peas', 'oatmeal', 'popcorn', 'bananas'];
const THINGS = ['hat', 'book', 'ball', 'kite', 'bike', 'pencil', 'jacket', 'backpack', 'shoe', 'cup', 'scarf', 'drum', 'puzzle', 'sled', 'lunch box', 'umbrella'];
const THINGS_PL = ['crayons', 'marbles', 'stickers', 'books', 'pencils', 'toys', 'blocks', 'cards', 'balloons', 'shells'];
const ANIMAL_ADJ = ['happy', 'hungry', 'sleepy', 'big', 'small', 'fast', 'loud', 'wet', 'tired', 'cute', 'noisy', 'quiet'];
const PEOPLE_ADJ = ['happy', 'quiet', 'ready', 'excited', 'tired', 'hungry', 'proud', 'calm'];
const NUMS = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const an = (w) => (/^[aeiou]/.test(w) ? 'an' : 'a');
/** Things you did, for "X and I …" (past). */
const DID = () => ['went to ' + 'PLACE', 'built a fort', 'played tag', 'made a cake', 'saw ANIMAL_A', 'cleaned the garage', 'planted a garden', 'read a long book', 'won the race', 'painted a picture'];
function fill(r, s) {
    const n1 = pk(r, NAMES);
    let n2 = pk(r, NAMES);
    while (n2 === n1)
        n2 = pk(r, NAMES);
    const a = pk(r, ANIMALS);
    return s
        .replace(/NAME2/g, n2)
        .replace(/NAME/g, n1)
        .replace(/PLACE/g, () => pk(r, PLACES))
        .replace(/FOOD/g, () => pk(r, FOODS))
        .replace(/THINGS/g, () => pk(r, THINGS_PL))
        .replace(/THING/g, () => pk(r, THINGS))
        .replace(/ANIMAL_A/g, () => {
        const x = pk(r, ANIMALS);
        return `${an(x)} ${x}`;
    })
        .replace(/ANIMALS/g, plural(a))
        .replace(/ANIMAL/g, a)
        .replace(/NUM/g, () => pk(r, NUMS))
        .replace(/PADJ/g, () => pk(r, PEOPLE_ADJ))
        .replace(/AADJ/g, () => pk(r, ANIMAL_ADJ));
}
/** A rule from a list of patterns (with NAME, PLACE … to fill in). */
const pat = (from, to, list) => ({ from, to, make: (r) => fill(r, pk(r, list)) });
const PAST = [
    ['goed', 'went', 'to PLACE'],
    ['seen', 'saw', 'ANIMAL_A at PLACE'],
    ['eated', 'ate', 'FOOD for lunch'],
    ['runned', 'ran', 'to PLACE'],
    ['buyed', 'bought', 'a new THING'],
    ['catched', 'caught', 'the ball'],
    ['brang', 'brought', 'FOOD to school'],
    ['thinked', 'thought', 'hard about the puzzle'],
    ['swimmed', 'swam', 'in the lake'],
    ['drawed', 'drew', 'ANIMAL_A'],
    ['writed', 'wrote', 'a letter to Grandma'],
    ['taked', 'took', 'the bus to PLACE'],
    ['maked', 'made', 'a cake'],
    ['finded', 'found', 'a lost THING'],
    ['gived', 'gave', 'the ANIMAL some water'],
    ['rided', 'rode', 'a horse at the farm'],
    ['throwed', 'threw', 'the ball over the fence'],
    ['flied', 'flew', 'a kite at the beach'],
    ['knowed', 'knew', 'the answer'],
    ['sitted', 'sat', 'on the bench'],
    ['winned', 'won', 'the race'],
    ['sleeped', 'slept', 'for ten hours'],
    ['builded', 'built', 'a sandcastle'],
    ['drinked', 'drank', 'a glass of milk'],
    ['breaked', 'broke', 'a plate'],
    ['weared', 'wore', 'a red hat'],
    ['telled', 'told', 'a funny joke'],
    ['teached', 'taught', 'the dog a new trick'],
    ['singed', 'sang', 'a song at the show'],
    ['digged', 'dug', 'a hole in the sand'],
];
const WHEN = ['Yesterday', 'Last week', 'On Saturday', 'Last summer', 'This morning'];
const SVA_VERBS = [
    ['play', 'plays', 'soccer'],
    ['read', 'reads', 'books'],
    ['ride', 'rides', 'a bike'],
    ['eat', 'eats', 'lunch at noon'],
    ['swim', 'swims', 'in the pool'],
    ['draw', 'draws', 'pictures'],
    ['sing', 'sings', 'songs'],
    ['walk', 'walks', 'the dog'],
    ['watch', 'watches', 'cartoons'],
    ['wash', 'washes', 'the dishes'],
    ['feed', 'feeds', 'the fish'],
    ['practice', 'practices', 'the piano'],
];
const COMP = ['taller', 'faster', 'older', 'younger', 'stronger', 'louder', 'shorter', 'smaller'];
const IRR_PLURALS = [
    'NUM {mouses|mice} ran across the floor. || One mouse, two mice.',
    'NUM {childs|children} played at recess. || One child, two children.',
    'NAME lost two {tooths|teeth} this year. || One tooth, two teeth.',
    'A duck has two {foots|feet}. || One foot, two feet.',
    'NUM {gooses|geese} flew over the lake. || One goose, two geese.',
    'The {leafs|leaves} fell from the tree. || One leaf, two leaves.',
    'The {knifes|knives} are in the drawer. || One knife, two knives.',
    'NUM {wolfs|wolves} howled at the moon. || One wolf, two wolves.',
    'NUM {mans|men} fixed the road. || One man, two men.',
    'NUM {womans|women} ran the race. || One woman, two women.',
    'NUM {sheeps|sheep} are in the field. || One sheep, two sheep — it stays the same.',
    'NUM {fishes|fish} swam in the pond. || One fish, two fish (for the same kind).',
    'The {shelfs|shelves} are full of books. || One shelf, two shelves.',
    'NUM {deers|deer} ran into the woods. || One deer, two deer — it stays the same.',
];
const capNum = (s) => s.replace(/^NUM/, () => 'NUMCAP');
const RULES = [
    // ---- capitals ----
    pat(0, 1, [
        '{the|The} ANIMAL is AADJ. || A sentence starts with a capital letter.',
        '{my|My} ANIMAL likes FOOD. || A sentence starts with a capital letter.',
        '{we|We} went to PLACE. || A sentence starts with a capital letter.',
        '{she|She} has a red THING. || A sentence starts with a capital letter.',
        '{it|It} is a sunny day. || A sentence starts with a capital letter.',
        '{look|Look} at the ANIMAL! || A sentence starts with a capital letter.',
    ]),
    pat(0, 2, [
        'NAME and {i|I} went to PLACE. || "I" is always a capital letter.',
        'Can {i|I} have some FOOD? || "I" is always a capital letter.',
        'Mom and {i|I} made a cake. || "I" is always a capital letter.',
        'Today {i|I} saw ANIMAL_A. || "I" is always a capital letter.',
        'May {i|I} pet the ANIMAL? || "I" is always a capital letter.',
    ]),
    { from: 0, to: 3, make: (r) => fill(r, pk(r, ['I went to PLACE with {n|N}. || Names start with a capital letter.', 'My friend {n|N} has ANIMAL_A. || Names start with a capital letter.', 'This THING is for {n|N}. || Names start with a capital letter.'])).replace(/\{n\|N\}/, () => { const n = pk(r, NAMES); return `{${n.toLowerCase()}|${n}}`; }) },
    {
        from: 1,
        to: 3,
        make: (r) => {
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const months = ['January', 'February', 'March', 'April', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const d = pk(r, days);
            const m = pk(r, months);
            return pk(r, [
                `We go to PLACE on {${d.toLowerCase()}|${d}}. || Days of the week start with a capital letter.`,
                `NAME has art class on {${d.toLowerCase()}|${d}}. || Days of the week start with a capital letter.`,
                `My birthday is in {${m.toLowerCase()}|${m}}. || Months start with a capital letter.`,
                `We went camping in {${m.toLowerCase()}|${m}}. || Months start with a capital letter.`,
            ]).replace(/NAME/, pk(r, NAMES)).replace(/PLACE/, pk(r, PLACES));
        },
    },
    {
        from: 1,
        to: 3,
        make: (r) => {
            const p = pk(r, ['Texas', 'Ohio', 'Florida', 'Chicago', 'Denver', 'Boston', 'Maine', 'Utah', 'Iowa', 'Oregon', 'Seattle', 'Georgia', 'Kansas', 'Dallas', 'Montana']);
            return pk(r, [`We live in {${p.toLowerCase()}|${p}}. || Names of places start with a capital letter.`, `My grandma lives in {${p.toLowerCase()}|${p}}. || Names of places start with a capital letter.`, `NAME moved to {${p.toLowerCase()}|${p}}. || Names of places start with a capital letter.`]).replace(/NAME/, pk(r, NAMES));
        },
    },
    // ---- more than one ----
    {
        from: 0,
        to: 2,
        make: (r) => {
            const a = pk(r, ANIMALS.filter((x) => !x.endsWith('y')));
            return fill(r, pk(r, [`I see NUM {${a}|${a}s}. || More than one: add -s.`, `NAME has NUM {${a}|${a}s}. || More than one: add -s.`, `We saw NUM {${a}|${a}s} at the farm. || More than one: add -s.`]));
        },
    },
    {
        from: 1,
        to: 3,
        make: (r) => {
            const n = pk(r, ['box', 'fox', 'bus', 'dish', 'bench', 'glass', 'brush', 'watch', 'peach', 'dress', 'beach', 'class']);
            return fill(r, pk(r, [`I see NUM {${n}s|${n}es}. || Words ending in s, x, sh or ch add -es.`, `There are NUM {${n}s|${n}es} here. || Words ending in s, x, sh or ch add -es.`]));
        },
    },
    {
        from: 2,
        to: 4,
        make: (r) => {
            const s = pk(r, IRR_PLURALS);
            return fill(r, capNum(s).replace('NUMCAP', cap(pk(r, NUMS))));
        },
    },
    // ---- a / an ----
    {
        from: 0,
        to: 2,
        make: (r) => {
            const v = pk(r, ['apple', 'egg', 'owl', 'ant', 'orange', 'igloo', 'elephant', 'octopus', 'acorn', 'eagle', 'umbrella', 'iguana']);
            const c = pk(r, ['dog', 'cat', 'banana', 'kite', 'hat', 'ball', 'frog', 'cup', 'book', 'pear', 'lemon', 'duck', 'cookie']);
            const start = pk(r, ['I have', 'I saw', 'We found', 'NAME drew', 'There is', 'I want']);
            return fill(r, r() < 0.6 ? `${start} {a|an} ${v}. || Use "an" before a vowel sound: an ${v}.` : `${start} {an|a} ${c}. || Use "a" before a consonant sound: a ${c}.`);
        },
    },
    // ---- is / are / am, was / were ----
    pat(0, 3, [
        'The ANIMAL {are|is} AADJ. || One thing: "is".',
        'The ANIMALS {is|are} AADJ. || More than one: "are".',
        'I {is|am} PADJ. || With "I", use "am".',
        'We {is|are} PADJ. || With "we", use "are".',
        'NAME and NAME2 {is|are} friends. || Two people: "are".',
        'You {is|are} my best friend. || With "you", use "are".',
        'My THING {are|is} new. || One thing: "is".',
    ]),
    pat(1, 5, [
        'NAME and NAME2 {was|were} at PLACE. || Two people: "were".',
        'We {was|were} late for school. || With "we", use "were".',
        'The ANIMALS {was|were} AADJ. || More than one: "were".',
        'I {were|was} PADJ yesterday. || With "I", use "was".',
        'You {was|were} right. || With "you", use "were".',
        'They {was|were} at PLACE all day. || With "they", use "were".',
    ]),
    // ---- he runs / they run ----
    {
        from: 0,
        to: 4,
        make: (r) => {
            const [b, s, rest] = pk(r, SVA_VERBS);
            return fill(r, pk(r, [`NAME {${b}|${s}} ${rest} every day. || One person (he, she, it): add -s.`, `My friends {${s}|${b}} ${rest} every day. || More than one: no -s.`, `The ANIMAL {eat|eats} FOOD. || One animal: add -s.`, `They {${s}|${b}} ${rest} after school. || With "they", no -s.`]));
        },
    },
    pat(1, 4, [
        "NAME {don't|doesn't} like FOOD. || One person (he, she, it): doesn't.",
        "My ANIMAL {don't|doesn't} like baths. || One animal: doesn't.",
        "They {doesn't|don't} like FOOD. || With \"they\": don't.",
        "We {doesn't|don't} have school today. || With \"we\": don't.",
        "It {don't|doesn't} matter. || With \"it\": doesn't.",
    ]),
    // ---- past tense ----
    {
        from: 1,
        to: 5,
        make: (r) => {
            const [w, ri, rest] = pk(r, PAST);
            return fill(r, `${pk(r, WHEN)}, NAME {${w}|${ri}} ${rest}. || The past of this verb is "${ri}".`);
        },
    },
    // ---- apostrophes ----
    pat(2, 3, [
        "I {cant|can't} find my THING. || Can't = cannot; it needs an apostrophe.",
        "NAME {doesnt|doesn't} like FOOD. || Doesn't = does not; it needs an apostrophe.",
        "We {didnt|didn't} see the ANIMAL. || Didn't = did not; it needs an apostrophe.",
        "They {wont|won't} be late. || Won't = will not; it needs an apostrophe.",
        "{Lets|Let's} go to PLACE. || Let's = let us; it needs an apostrophe.",
        "{Im|I'm} PADJ today. || I'm = I am; it needs an apostrophe.",
        "That {isnt|isn't} my THING. || Isn't = is not; it needs an apostrophe.",
    ]),
    // ---- taller, not "more taller" ----
    {
        from: 2,
        to: 4,
        make: (r) => {
            const c = pk(r, COMP);
            return fill(r, pk(r, [`NAME is {more|} ${c} than NAME2. || Just "${c}" — never "more ${c}".`, 'This is the {goodest|best} FOOD ever. || Good, better, best.', 'My cold is {badder|worse} today. || Bad, worse, worst.', 'NAME is the {most|} fastest runner. || Just "fastest" — never "most fastest".']));
        },
    },
    // ---- there / their / they're, your / you're, its / it's, to / too / two ----
    pat(3, 7, [
        '{Their|There} is ANIMAL_A in the yard. || "There" is a place. "Their" means belonging to them.',
        '{They\'re|There} are NUM ANIMALS in the yard. || "There" is a place. They\'re = they are.',
        'The kids put {there|their} coats on the bed. || "Their" means belonging to them.',
        'NAME and NAME2 rode {there|their} bikes to PLACE. || "Their" means belonging to them.',
        '{Their|They\'re} going to PLACE tomorrow. || They\'re = they are.',
        "{There|They're} coming to my party. || They're = they are.",
        'Put the THING over {their|there}. || "There" is a place.',
    ]),
    pat(3, 7, [
        "{Your|You're} going to love this book. || You're = you are.",
        "Is this {you're|your} THING? || \"Your\" means belonging to you.",
        "I think {your|you're} right. || You're = you are.",
        "Don't forget {you're|your} THING. || \"Your\" means belonging to you.",
        "{You're|Your} ANIMAL is AADJ. || \"Your\" means belonging to you.",
    ]),
    {
        from: 3,
        to: 8,
        make: (r) => fill(r, pk(r, [
            `The ${pk(r, TAILED)} wagged {it's|its} tail. || "Its" (no apostrophe) means belonging to it. It's = it is.`,
            `{Its|It's} ${pk(r, ['raining', 'sunny', 'cold', 'windy', 'snowing', 'hot'])} today. || It's = it is.`,
            'The tree lost {it\'s|its} leaves. || "Its" means belonging to it.',
            "{Its|It's} time for bed. || It's = it is.",
            'The ANIMAL hurt {it\'s|its} paw. || "Its" means belonging to it.',
            "I think {its|it's} going to rain. || It's = it is.",
        ])),
    },
    pat(3, 5, [
        'Can I come {to|too}? || "Too" means also.',
        'NAME wants to come {to|too}. || "Too" means also.',
        'This box is {to|too} heavy to lift. || "Too" means more than enough.',
        'The soup is {to|too} hot to eat. || "Too" means more than enough.',
        'I have {to|two} ANIMALS. || The number is "two".',
        'NAME went {too|to} PLACE. || "To" shows where you go.',
        'We ate {to|two} slices of pizza. || The number is "two".',
    ]),
    {
        from: 4,
        to: 7,
        make: (r) => fill(r, pk(r, [`NAME is ${pk(r, COMP)} {then|than} NAME2. || "Than" compares. "Then" is about time.`, 'We ate lunch, and {than|then} we went to PLACE. || "Then" is about time.', 'First we went to PLACE, and {than|then} we went home. || "Then" is about time.', `My ANIMAL is ${pk(r, COMP)} {then|than} yours. || "Than" compares.`])),
    },
    // ---- no double negatives, good / well, could have ----
    pat(4, 6, [
        "I don't have {no|any} THINGS. || Two \"no\" words cancel out. Use \"any\".",
        "NAME didn't see {nobody|anybody} at PLACE. || Two \"no\" words cancel out. Use \"anybody\".",
        "We can't find {nothing|anything} to eat. || Two \"no\" words cancel out. Use \"anything\".",
        "There isn't {no|any} milk left. || Two \"no\" words cancel out. Use \"any\".",
        "NAME never goes {nowhere|anywhere} on Sundays. || Two \"no\" words cancel out. Use \"anywhere\".",
    ]),
    pat(4, 6, [
        'NAME sings {good|well}. || "Well" tells how you do something.',
        'NAME swims {good|well}. || "Well" tells how you do something.',
        'NAME did {good|well} on the test. || "Well" tells how you did.',
        'The team played {good|well} today. || "Well" tells how they played.',
        'NAME draws {good|well}. || "Well" tells how you do something.',
    ]),
    {
        from: 4,
        to: 7,
        make: (r) => {
            const m = pk(r, ['could', 'should', 'would']);
            const pp = pk(r, ['won the game', 'left sooner', 'called you', 'brought snacks', 'finished the puzzle', 'gone home', 'eaten breakfast']);
            return fill(r, `${pk(r, ['I', 'We', 'NAME'])} ${m} {of|have} ${pp}. || It's "${m} have" (${m}'ve), never "${m} of".`);
        },
    },
    // ---- I / me ----
    {
        from: 1,
        to: 5,
        make: (r) => {
            const did = fill(r, pk(r, DID()));
            return fill(r, pk(r, [`NAME and {me|I} ${did}. || Use "I" when you are one of the people doing it.`, `{Him|He} and NAME ${did}. || The ones doing it: "He and …".`, `{Her|She} and NAME ${did}. || The ones doing it: "She and …".`, `{Us|We} kids ${did}. || The ones doing it: "We kids".`, `{Them|They} ${did}. || The ones doing it: "They".`]));
        },
    },
    pat(4, 8, [
        'NAME gave the THING to NAME2 and {I|me}. || After "to", use "me" (to me).',
        'Mom took NAME and {I|me} to PLACE. || "Took me": use "me".',
        'Please save a seat for NAME and {I|me}. || After "for", use "me".',
        'The coach told NAME and {I|me} to run. || "Told me": use "me".',
        'Between you and {I|me}, this is hard. || After "between", use "me".',
        'Come sit with NAME and {I|me}. || After "with", use "me".',
    ]),
    // ---- fewer, affect / effect, lie / lay, lose / loose, whose, accept ----
    pat(5, 8, [
        'There were {less|fewer} ANIMALS at PLACE today. || Things you can count: fewer.',
        'I have {less|fewer} THINGS than NAME. || Things you can count: fewer.',
        'We need {less|fewer} chairs. || Things you can count: fewer.',
        'This year there are {less|fewer} kids in my class. || Things you can count: fewer.',
    ]),
    {
        from: 5,
        to: 12,
        make: (r) => {
            const [cause, result] = pk(r, [
                ['storm', 'a flooded road'],
                ['new rule', 'a quieter lunchroom'],
                ['cold weather', 'a frozen pond'],
                ['extra practice', 'a better score'],
                ['loud music', 'a headache'],
                ['long drought', 'a dry river'],
            ]);
            return fill(r, pk(r, [`The ${pk(r, ['rain', 'storm', 'new rule', 'noise', 'cold'])} will {effect|affect} ${pk(r, ['our plans', 'the game', 'our trip', 'the score', 'everyone'])}. || Affect is the action (to change); effect is the result.`, `The {affect|effect} of the ${cause} was ${result}. || The effect is the result.`, `Did the movie {effect|affect} you? || Affect is the action (to change).`]));
        },
    },
    {
        from: 5,
        to: 12,
        make: (r) => fill(r, pk(r, [`The ANIMAL is {laying|lying} on the ${pk(r, ['couch', 'rug', 'grass', 'bed', 'porch'])}. || You lie down (yourself); you lay something down.`, 'NAME {laid|lay} down for a nap yesterday. || You lie down yourself (yesterday: lay); you lay something down (yesterday: laid).', 'Please {lie|lay} the THING on the table. || You lay something down; you lie down yourself.', 'I am going to {lay|lie} down for a while. || You lie down yourself; you lay something down.'])),
    },
    pat(5, 8, [
        "Don't {loose|lose} your THING. || Lose = to not have anymore. Loose = not tight.",
        "If we {loose|lose} this game, we're out. || Lose = not win. Loose = not tight.",
        'My tooth is {lose|loose}. || Loose = not tight.',
        'The ANIMAL got {lose|loose} from the farm. || Loose = free, not tied up.',
    ]),
    pat(5, 12, [
        "{Who's|Whose} THING is this? || \"Whose\" asks who it belongs to. Who's = who is.",
        "{Whose|Who's} coming to PLACE? || Who's = who is.",
        "I know {who's|whose} THING this is. || \"Whose\" = belonging to whom.",
        "{Whose|Who's} ready for lunch? || Who's = who is.",
    ]),
    pat(5, 9, [
        'NAME {excepted|accepted} the prize. || Accept = take; except = leaving out.',
        'Everyone came {accept|except} NAME. || Except = leaving out.',
        'I like every fruit {accept|except} bananas. || Except = leaving out.',
        'Will you {except|accept} my apology? || Accept = take.',
    ]),
    // ---- tricky subjects ----
    pat(6, 12, [
        'Each of the ANIMALS {have|has} a name. || "Each" means every single one: "has".',
        'Everyone in the class {were|was} PADJ. || "Everyone" takes "was".',
        'Neither of the ANIMALS {were|was} hungry. || "Neither" means not one: "was".',
        'One of the THINGS {are|is} missing. || "One" is the subject: "is".',
        'Every one of the players {have|has} a jersey. || "Every one" takes "has".',
        'Nobody in my family {like|likes} FOOD. || "Nobody" takes "likes".',
    ]),
    {
        from: 6,
        to: 12,
        make: (r) => {
            const c = pk(r, ['box', 'bag', 'jar', 'basket', 'bowl']);
            const x = pk(r, ['crayons', 'cookies', 'marbles', 'apples', 'grapes', 'buttons']);
            return pk(r, [`The ${c} of ${x} {are|is} on the shelf. || The subject is "${c}" (one): "is".`, `The ${x} in the ${c} {is|are} mine. || The subject is "${x}" (many): "are".`, `A ${c} of ${x} {sit|sits} on the table. || The subject is "${c}" (one): "sits".`]);
        },
    },
    {
        from: 6,
        to: 12,
        make: (r) => {
            const [role, act] = pk(r, [
                ['a bird', 'fly south for the winter'],
                ['the teacher', 'give less homework'],
                ['taller', 'reach the top shelf'],
                ['the mayor', 'build a new park'],
                ['you', 'ask for help'],
                ['older', 'drive to the beach'],
                ['a fish', 'swim all day'],
            ]);
            return pk(r, [`If I {was|were} ${role}, I would ${act}. || For wishes and "if" situations, use "were".`, `I wish I {was|were} ${pk(r, ['at the beach', 'taller', 'older', 'on vacation'])}. || For wishes, use "were".`]);
        },
    },
    pat(6, 8, [
        'The movie was {real|really} fun. || "Really" describes "fun".',
        'The test was {real|really} hard. || "Really" describes "hard".',
        'NAME ran {real|really} fast. || "Really" describes "fast".',
        'The soup was {real|really} hot. || "Really" describes "hot".',
    ]),
    {
        from: 6,
        to: 12,
        make: (r) => fill(r, pk(r, [`NAME and {myself|I} ${fill(r, pk(r, DID()))}. || The ones doing it: "… and I". Use "myself" only when you did something to yourself.`, 'Please send the photos to NAME or {myself|me}. || Use "myself" only when you did something to yourself.', 'The teacher thanked NAME and {myself|me}. || Use "myself" only when you did something to yourself.'])),
    },
    {
        from: 6,
        to: 12,
        make: (r) => fill(r, pk(r, [
            'Yesterday NAME walked to PLACE and {sees|saw} ANIMAL_A. || Keep the same tense: it all happened yesterday.',
            'Last week NAME went to the store and {buys|bought} a new THING. || Keep the same tense: it all happened last week.',
            'Yesterday we cooked dinner and {eat|ate} it outside. || Keep the same tense: it all happened yesterday.',
            'This morning NAME found a THING and {gives|gave} it to NAME2. || Keep the same tense: it all happened this morning.',
            'Last summer we drove to the lake and {swim|swam} every day. || Keep the same tense: it all happened last summer.',
        ])),
    },
    pat(6, 8, [
        'The THING {who|that} I lost was red. || Use "who" for people; "that" or "which" for things.',
        'The book {who|that} NAME read was long. || Use "who" for people; "that" or "which" for things.',
        'The girl {which|who} won the race is my sister. || Use "who" for people.',
        'The man {which|who} fixed our sink was kind. || Use "who" for people.',
    ]),
    pat(8, 12, [
        '{Who|Whom} did you invite to the party? || You invited him → whom.',
        '{Who|Whom} did you see at PLACE? || You saw him → whom.',
        'To {who|whom} should I give the THING? || After "to": whom.',
        'The student {whom|who} won the race was PADJ. || He won → who.',
        'Give the prize to {whomever|whoever} finishes first. || He finishes → whoever.',
        '{Whom|Who} is coming to dinner? || He is coming → who.',
    ]),
    pat(7, 12, [
        'Neither the teacher nor the students {was|were} ready. || With "nor", match the closer one: students were.',
        'Either the cats or the dog {are|is} making that noise. || With "or", match the closer one: dog is.',
        'Neither NAME nor the twins {wants|want} to go. || With "nor", match the closer one: twins want.',
        'Either my parents or my aunt {are|is} picking us up. || With "or", match the closer one: aunt is.',
    ]),
    pat(9, 12, [
        'The coach, along with the players, {are|is} on the bus. || "Along with" doesn\'t add to the subject: the coach is.',
        'NAME, as well as NAME2, {are|is} coming. || "As well as" doesn\'t add to the subject: one person is.',
        'The teacher, together with her students, {plan|plans} the trip. || "Together with" doesn\'t add to the subject: the teacher plans.',
        'The number of students {have|has} grown. || "The number" is one thing: has.',
        'A number of students {has|have} left early. || "A number of" means several: have.',
        'The list of chores {seem|seems} endless. || The subject is "list" (one): seems.',
    ]),
    // ---- words that get mixed up ----
    pat(7, 12, [
        'NAME {complemented|complimented} my drawing. || Compliment = praise; complement = go well together.',
        'The red scarf {compliments|complements} the coat. || Complement = go well together.',
        'The bus stayed {stationery|stationary} in the traffic jam. || Stationary = not moving; stationery = writing paper.',
        'I wrote the letter on fancy {stationary|stationery}. || Stationery = writing paper.',
        'The coach gave us good {council|counsel}. || Counsel = advice; a council is a group that decides things.',
        'The city {counsel|council} meets on Tuesday. || A council is a group that decides things.',
        'The {principle|principal} visited our class. || The principal is the head of a school.',
        'Honesty is an important {principal|principle}. || A principle is a rule or belief.',
        'Austin is the {capitol|capital} of Texas. || The capital is the city; the capitol is the building.',
        'The {capital|capitol} building has a gold dome. || The capitol is the building.',
    ]),
    pat(9, 12, [
        'The storm is {eminent|imminent}, so stay inside. || Imminent = about to happen; eminent = famous.',
        'The question was meant to {illicit|elicit} an answer. || Elicit = draw out; illicit = against the law.',
        'We will play, {irregardless|regardless} of the rain. || "Regardless" is the standard word.',
        'The answer {alluded|eluded} me. || Elude = escape; allude = hint at.',
        'NAME {flaunted|flouted} the rules. || Flout = ignore a rule; flaunt = show off.',
        'NAME likes to {flout|flaunt} new sneakers. || Flaunt = show off; flout = ignore a rule.',
        'The teacher tried to {diffuse|defuse} the argument. || Defuse = calm down; diffuse = spread out.',
        'NAME is {adverse|averse} to taking risks. || Averse = unwilling; adverse = harmful.',
        'The medicine had no {averse|adverse} effects. || Adverse = harmful.',
        'Please be {discrete|discreet} about the surprise party. || Discreet = careful and private; discrete = separate.',
        'Please {precede|proceed} to the next room. || Proceed = go ahead; precede = come before.',
        'From the clues, I {implied|inferred} that the butler did it. || Infer = figure out; imply = hint.',
        'Are you {inferring|implying} that I cheated? || Imply = hint; infer = figure out.',
    ]),
    pat(11, 12, [
        'The most important {criteria|criterion} is honesty. || One criterion, two criteria.',
        'These {criterion|criteria} are strict. || One criterion, two criteria.',
        'This {phenomena|phenomenon} is rare. || One phenomenon, two phenomena.',
        'These {phenomenon|phenomena} are rare. || One phenomenon, two phenomena.',
        'We saw the {premier|premiere} of the new movie. || A premiere is a first showing; a premier is a leader.',
        'Scarcely had we left {than|when} it began to rain. || "Scarcely … when" (and "no sooner … than").',
        'This plan is {more|} superior to that one. || "Superior" already means better.',
        'The bacteria {is|are} growing quickly. || "Bacteria" is the plural of "bacterium".',
    ]),
];
/** How a grade's items are built: sentences in an item, and how many of them have a mistake. */
function shape(g, r) {
    if (g <= 4)
        return { sentences: 1, mistakes: 1 };
    if (g <= 6)
        return { sentences: 2, mistakes: 1 };
    if (g <= 8)
        return { sentences: 3, mistakes: 2 };
    if (g <= 10)
        return r() < 0.5 ? { sentences: 3, mistakes: 2 } : { sentences: 4, mistakes: 3 };
    return { sentences: 4, mistakes: 3 };
}
/** The sentence with its mistake fixed (no markers left). */
const fixed = (s) => s.replace(/\{[^|}]*\|([^}]*)\}/g, '$1').replace(/\s+/g, ' ').replace(/ ([.,?!])/g, '$1').trim();
export function makeGrammarItem(g, r) {
    const rules = RULES.filter((x) => x.from <= g && g <= x.to);
    const { sentences, mistakes } = shape(g, r);
    const used = new Set();
    const parts = [];
    for (let i = 0; i < sentences; i++) {
        let rule = pk(r, rules);
        for (let k = 0; k < 8 && used.has(rule); k++)
            rule = pk(r, rules);
        used.add(rule);
        const [text, tip = ''] = rule.make(r).split('||').map((x) => x.trim());
        parts.push({ text, tip, wrong: false });
    }
    // Which sentences keep their mistake.
    const order = parts.map((_, i) => i).sort(() => r() - 0.5);
    for (const i of order.slice(0, mistakes))
        parts[i].wrong = true;
    const text = parts.map((p) => (p.wrong ? p.text : fixed(p.text))).join(' ');
    const tips = parts.filter((p) => p.wrong).map((p) => p.tip);
    return parse(`${text} || ${tips.join(' ')}`);
}
export const GRAMMAR_PER_GRADE = 400;
/** Several hundred items a grade: the hand-written ones, then made ones (no repeats). Built once. */
export const GRAMMAR = HANDWRITTEN.map((hand, g) => {
    const r = mulberry(1000 + g);
    const seen = new Set(hand.map((x) => x.tokens.map((t) => t.shown).join(' ')));
    const out = [...hand];
    for (let tries = 0; out.length < GRAMMAR_PER_GRADE && tries < GRAMMAR_PER_GRADE * 20; tries++) {
        const it = makeGrammarItem(g, r);
        if (!it || !it.tokens.some((t) => t.right !== null))
            continue;
        const key = it.tokens.map((t) => t.shown).join(' ');
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(it);
    }
    return out;
});
