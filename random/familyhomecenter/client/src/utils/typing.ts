/** ⌨️ Typing practice — lessons, words and the keyboard map (pages/TypingPage.tsx). */

export interface Level {
  n: number;
  name: string;
  /** Keys this lesson adds (shown big on the intro). */
  newKeys: string;
  /** Every key allowed so far (lower case; capitals/numbers lessons set flags instead). */
  keys: string;
  goalWpm: number;
  capitals?: boolean;
  numbers?: boolean;
  sentences?: boolean;
}

const HOME = 'asdfjkl;';
const steps: Array<[string, string, number, Partial<Level>?]> = [
  ['Pointer fingers', 'fj', 4],
  ['Middle fingers', 'dk', 5],
  ['Ring fingers', 'sl', 5],
  ['Little fingers', 'a;', 5],
  ['The whole home row', '', 6],
  ['Reach up: E and I', 'ei', 7],
  ['Reach up: R and U', 'ru', 7],
  ['Stretch: T and Y', 'ty', 8],
  ['In the middle: G and H', 'gh', 8],
  ['Reach up: W and O', 'wo', 9],
  ['Little fingers up: Q and P', 'qp', 9],
  ['Bottom row: C V B N M , .', 'cvbnm,.', 10],
  ['Last letters: X and Z', 'xz', 10],
  ['Capital letters (Shift)', '', 11, { capitals: true }],
  ['Numbers', '1234567890', 11, { numbers: true }],
  ['Real sentences', '', 12, { sentences: true, capitals: true }],
];

export const LEVELS: Level[] = (() => {
  let keys = '';
  return steps.map(([name, add, goalWpm, extra], i) => {
    keys += add;
    if (i === 4) keys = HOME; // the whole home row
    return { n: i + 1, name, newKeys: i === 4 ? HOME : add, keys: [...new Set(keys)].join(''), goalWpm, ...extra };
  });
})();

export const PASS_ACCURACY = 90;

/** Kid-friendly words; a lesson only uses the ones made of keys learned so far. */
const WORDS = `a ad add ads all as ask asks dad dads fad fall falls flask lad lads lass sad salad all
 jak kale lake leak sale seal deal dial idle aide said slid side lid kid kids skid ski skis die dies lie
 like likes life file fire hire red read real rise ride rides ruler rude sure user us use used fur fuse
 rule rules jar jars far ear ears dear fear hear year tree trees try tries tide tight tail tale toy
 toys yes yet yard yell they the then that this there here her he she his hat had hug huge high
 sight light night right fight might gift girl go goes good goat gold glad egg eggs dog dogs log hot
 hop hope hold home house horse who what when where why will wish with water word work world
 wow owl owls two own over out our pop pup pig pie pies put quit quiz quick queen equal paper
 cat cats cub cup cake cave cow can candy bus bat bed bee bike bird book box ball blue black brown
 bread bring but by name nice nose new no not now nut man map me mom moon more most must my
 cave van very vote voice zoo zip zebra fox box six mix taxi lazy fizz jazz
 apple happy funny sunny silly kitty puppy bunny tiger lion bear shark fish frog duck horse pony
 snack pizza pasta cookie juice milk cheese bacon toast pancake popcorn rain snow wind storm cloud
 school friend family brother sister garden park beach river ocean rocket robot dragon castle
 magic game games play plays team jump run swim kick throw catch climb dance sing draw paint`
  .split(/\s+/)
  .filter(Boolean);

export const SENTENCES = [
  'The quick brown fox jumps over the lazy dog.',
  'My dog likes to dig in the garden.',
  'We had pizza and popcorn on movie night.',
  'A big red rocket flew up to the moon.',
  'Please feed the cat before school.',
  'The frog sat on a log by the river.',
  'I can swim, jump, run and climb.',
  'Grandma bakes the best cookies in town.',
  'The robot and the dragon became friends.',
  'It is sunny today, so we will go to the park.',
  'Five silly monkeys jumped on the bed.',
  'Reading a book is like a trip to a new world.',
  'The team cheered when she kicked the ball.',
  'Brush your teeth and then hop into bed.',
  'Zebras have black and white stripes.',
  'We built a castle out of sand at the beach.',
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function wordsFor(level: Level): string[] {
  const allowed = new Set(level.keys);
  return WORDS.filter((w) => [...w].every((c) => allowed.has(c)));
}

/** The text for one lesson round (about 50 characters). */
export function lessonText(level: Level): string {
  if (level.sentences) return `${pick(SENTENCES)} ${pick(SENTENCES)}`;
  if (level.numbers) {
    const parts: string[] = [];
    while (parts.join(' ').length < 45) {
      parts.push(Math.random() < 0.5 ? String(Math.floor(Math.random() * 1000)) : `${Math.floor(Math.random() * 20) + 1} ${pick(wordsFor(LEVELS[12]))}`);
    }
    return parts.join(' ');
  }
  const words = wordsFor(level);
  const parts: string[] = [];
  const fresh = [...level.newKeys];
  while (parts.join(' ').length < 50) {
    // Early lessons (few words possible) and the new keys get drills like "fff jjj fj".
    const drill = words.length < 6 || (fresh.length > 0 && Math.random() < 0.3);
    if (drill) {
      const a = pick(fresh.length ? fresh : [...level.keys]);
      const b = pick([...level.keys]);
      parts.push(Math.random() < 0.5 ? a.repeat(3) : `${a}${b}${a}`);
    } else {
      parts.push(pick(words));
    }
  }
  let text = parts.join(' ');
  if (level.capitals) text = text.replace(/(^|\s)(\w)/g, (m, sp, c) => (Math.random() < 0.4 ? sp + c.toUpperCase() : m));
  return text;
}

/** Words for Balloon Pop: from the lessons passed so far (at least the home row). */
export function gameWords(highestPassed: number): string[] {
  const level = LEVELS[Math.max(4, Math.min(LEVELS.length - 1, highestPassed - 1))];
  const words = wordsFor(level.sentences || level.numbers || level.capitals ? LEVELS[12] : level).filter((w) => w.length >= 2);
  return words.length >= 8 ? words : wordsFor(LEVELS[12]);
}

// ---- The keyboard ----

export const KEY_ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
];

/** Which finger presses each key: 0–3 left pinky→index, 4–7 right index→pinky, 8 thumbs. */
export function fingerFor(key: string): number {
  const k = key.toLowerCase();
  if (k === ' ') return 8;
  const col: Record<string, number> = {};
  KEY_ROWS.forEach((row) => row.forEach((c, i) => (col[c] = i)));
  const i = col[k] ?? col[shifted[k] ?? ''] ?? -1;
  if (i < 0) return 7;
  return [0, 1, 2, 3, 3, 4, 4, 5, 6, 7][i];
}

/** Shifted characters → the key they're on. */
const shifted: Record<string, string> = { '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', ':': ';', '<': ',', '>': '.', '?': '/' };

export const FINGER_NAMES = [
  'left little finger',
  'left ring finger',
  'left middle finger',
  'left pointer finger',
  'right pointer finger',
  'right middle finger',
  'right ring finger',
  'right little finger',
  'thumb',
];
export const FINGER_COLORS = ['#f472b6', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#60a5fa', '#a78bfa', '#f87171', '#cbd5e1'];

export function needsShift(ch: string): boolean {
  return /[A-Z]/.test(ch) || ch in shifted;
}

/** Words per minute the usual way: 5 characters = 1 word. */
export function wpmOf(chars: number, ms: number): number {
  if (ms <= 0) return 0;
  return Math.round((chars / 5 / (ms / 60_000)) * 10) / 10;
}

// ---- Games ----

/** The letters a game can use: what's been learned so far, at least the home row. */
export function gameKeys(highestPassed: number): string[] {
  const level = LEVELS[Math.max(4, Math.min(12, highestPassed - 1))];
  return [...level.keys];
}

/** A number from a string (the same every time) — the Daily Challenge picks its text from the day. */
function hashOf(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Today's Daily Challenge: the same two sentences for everyone in the family. */
export function dailyText(day: string): string {
  const h = hashOf(day);
  const a = h % SENTENCES.length;
  const b = (a + 1 + ((h >>> 8) % (SENTENCES.length - 1))) % SENTENCES.length;
  return `${SENTENCES[a]} ${SENTENCES[b]}`;
}

// 📖 Silly Story — sentences with blanks filled from the family and a few silly lists.
const STORIES: string[][] = [
  [
    '{me} woke up and found {animal} eating {food} in the kitchen.',
    '"Is that my breakfast?" asked {me}.',
    'The {animal2} just smiled and asked {fam} for more.',
    'So they all went to {place} to buy a mountain of {food}.',
  ],
  [
    'One day {fam} built a rocket out of {thing}.',
    '{me} climbed in and pressed the big red button.',
    'The rocket zoomed past the moon and landed on {place}.',
    'A friendly alien gave them {food} and a high five.',
  ],
  [
    '{me} and {fam} went to {place} to look for treasure.',
    'They dug a hole and found {thing} inside an old box.',
    'Then {animal} popped out and sang a funny song.',
    'Everyone danced until the sun went down.',
  ],
  [
    'There was a dragon at {place} who only ate {food}.',
    '{fam} was not scared and walked right up to it.',
    '"Would you like to play a game?" asked {me}.',
    'The dragon laughed so hard it sneezed out {thing}.',
  ],
  [
    'At school, {me} found {animal} sitting at the teacher\'s desk.',
    'It wore glasses and was reading a book about {food}.',
    '{fam} said, "That is the best teacher we ever had!"',
    'The whole class got {thing} for homework.',
  ],
];
const ANIMALS = ['a purple hippo', 'a dancing penguin', 'a tiny giraffe', 'a sleepy bear', 'a silly goose', 'a polka dot cow', 'a giant frog'];
const FOODS = ['pickles', 'spaghetti', 'pancakes', 'ice cream', 'cheese pizza', 'jelly beans', 'broccoli', 'tacos'];
const PLACES = ['the zoo', 'the beach', 'the moon', 'a candy shop', 'the library', 'a castle', 'the park'];
const THINGS = ['a rubber duck', 'a rainbow sock', 'a magic hat', 'a box of crayons', 'a golden spoon', 'a squeaky toy', 'a sparkly rock'];

export const STORY_ENDINGS: Array<{ wpm: number; text: string }> = [
  { wpm: 30, text: 'And because {me} typed so fast, everyone got a medal and a parade. The end!' },
  { wpm: 15, text: 'And {me} told the whole story at dinner, and everyone laughed. The end!' },
  { wpm: 0, text: 'And they all took a long nap, because it had been a very busy day. The end!' },
];

function pickOne<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** A new silly story: four sentences starring `me` and someone else in the family. */
export function makeStory(me: string, family: string[]): { sentences: string[]; fill: (s: string) => string } {
  const animal = pickOne(ANIMALS);
  const words: Record<string, string> = {
    me,
    fam: family.length ? pickOne(family) : 'Grandma',
    animal,
    animal2: animal.replace(/^an? /, ''),
    food: pickOne(FOODS),
    place: pickOne(PLACES),
    thing: pickOne(THINGS),
  };
  const fill = (s: string) => {
    const out = s.replace(/\{(\w+)\}/g, (_, k: string) => words[k] ?? k);
    return out.charAt(0).toUpperCase() + out.slice(1);
  };
  return { sentences: pickOne(STORIES).map(fill), fill };
}
