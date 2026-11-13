/**
 * 🐝 Letter Maze — the rules, no drawing (MazeRun.tsx draws it). You munch round a maze; the bees
 * chase you. Grades K–5 (`letters`): every dot is a letter — eat the letters of the word in order
 * (wrong letters just stay put). Grades 6–12 (`words`): the dots are words — eat the one spelled
 * right for the clue (a misspelled one stays put, says so, and costs a few points). 🍯 honey pots make the bees nap, and then you
 * can catch them.
 */

export type Mode = 'letters' | 'words';
export interface MazeWord {
  word: string;
  meaning: string;
  sentence: string;
  /** misspelled look-alikes (grades 6–12) */
  wrong: string[];
}

/** # wall · . dot · o honey · P you start · B bees start · (space) path with nothing on it */
const LAYOUTS = [
  [
    '###################',
    '#o.......#.......o#',
    '#.##.###.#.###.##.#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.###.#.###.####',
    '#.......BBB.......#',
    '####.#.#####.#.####',
    '#....#...P...#....#',
    '#.##.###.#.###.##.#',
    '#...#.........#...#',
    '###.#.#.###.#.#.###',
    '#o....#.....#....o#',
    '###################',
  ],
  [
    '###################',
    '#o.......#.......o#',
    '#.###.##.#.##.###.#',
    '#.#.............#.#',
    '#.#.##.##.##.##.#.#',
    '#......#...#......#',
    '###.##.#.#.#.##.###',
    '#.......BBB.......#',
    '###.##.#####.##.###',
    '#.....#..P..#.....#',
    '#.###.#.###.#.###.#',
    '#.................#',
    '#.##.####.####.##.#',
    '#o.......#.......o#',
    '###################',
  ],
  [
    '###################',
    '#o...#.......#...o#',
    '#.#.##.#####.##.#.#',
    '#.#...............#',
    '#.###.##.#.##.###.#',
    '#.....#..#..#.....#',
    '##.##.#.###.#.##.##',
    '#.......BBB.......#',
    '##.#.###.#.###.#.##',
    '#..#.....P.....#..#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '#.####.#.#.#.####.#',
    '#o.....#...#.....o#',
    '###################',
  ],
];
export const LAYOUT_COUNT = LAYOUTS.length;
export const MAZE_W = 19;
export const MAZE_H = 15;
/** words to spell in each maze before the next one */
export const WORDS_PER_MAZE = 5;
export const START_LIVES = 3;
/** seconds the bees nap after a 🍯 */
export const NAP = 7;

export interface Mover {
  x: number;
  y: number;
  dx: number;
  dy: number;
}
export interface Bee extends Mover {
  home: [number, number];
  /** seconds until it comes back out (after being caught) */
  out: number;
  look: string;
}
export interface Dot {
  x: number;
  y: number;
  /** a letter (letters mode), a word (words mode), or '' (an empty dot) */
  text: string;
  honey?: boolean;
}

export interface Maze {
  mode: Mode;
  level: number;
  walls: boolean[];
  dots: Dot[];
  you: Mover;
  want: { dx: number; dy: number } | null;
  start: [number, number];
  bees: Bee[];
  words: MazeWord[];
  /** which word now (an index into words, going round) */
  wordAt: number;
  /** letters mode: how many letters of the word eaten so far */
  got: number;
  doneInMaze: number;
  score: number;
  lives: number;
  /** 🛡️ bumps left this maze (the Bee shield prize) */
  shield: number;
  shieldOn: boolean;
  napping: number;
  /** after losing a heart: a moment where nothing moves */
  frozen: number;
  /** the last wrong letter stepped on (so it's only said once) */
  lastWrong: number;
  over: boolean;
  /** what just happened, for the HUD (cleared by the screen after showing) */
  news: Array<{ kind: 'letter' | 'word' | 'wrong' | 'honey' | 'bee' | 'ouch' | 'shield' | 'maze' | 'over'; text: string }>;
  rand: () => number;
}

export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const isOpen = (m: Maze, x: number, y: number) => x >= 0 && y >= 0 && x < MAZE_W && y < MAZE_H && !m.walls[y * MAZE_W + x];
export const word = (m: Maze) => m.words[m.wordAt % m.words.length];

const BEE_LOOKS = ['🐝', '🐝', '🐝', '🐝'];
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

/** A new game (or carrying on from a maze: `level`). */
export function newMaze(mode: Mode, words: MazeWord[], level: number, seed: number, shield = false, score = 0, lives = START_LIVES): Maze {
  const rand = rng(seed);
  const m: Maze = {
    mode,
    level,
    walls: [],
    dots: [],
    you: { x: 0, y: 0, dx: 0, dy: 0 },
    want: null,
    start: [0, 0],
    bees: [],
    words: words.length ? words : [{ word: 'cat', meaning: 'a small furry pet', sentence: 'The cat naps.', wrong: [] }],
    wordAt: Math.floor(rand() * Math.max(1, words.length)),
    got: 0,
    doneInMaze: 0,
    score,
    lives,
    shield: shield ? 1 : 0,
    shieldOn: shield,
    napping: 0,
    frozen: 1.2,
    lastWrong: -1,
    over: false,
    news: [],
    rand,
  };
  buildLevel(m);
  return m;
}

/** Lay out the maze for m.level: walls, dots, honey, you and the bees. */
function buildLevel(m: Maze) {
  const rows = LAYOUTS[(m.level - 1) % LAYOUTS.length];
  m.walls = [];
  m.dots = [];
  const homes: Array<[number, number]> = [];
  for (let y = 0; y < MAZE_H; y++)
    for (let x = 0; x < MAZE_W; x++) {
      const c = rows[y][x] ?? '#';
      m.walls.push(c === '#');
      if (c === '.') m.dots.push({ x, y, text: '' });
      if (c === 'o') m.dots.push({ x, y, text: '', honey: true });
      if (c === 'P') m.start = [x, y];
      if (c === 'B') homes.push([x, y]);
    }
  m.you = { x: m.start[0], y: m.start[1], dx: 0, dy: 0 };
  m.want = null;
  const n = Math.min(4, 2 + Math.floor((m.level - 1) / 2));
  m.bees = Array.from({ length: n }, (_, k) => {
    const h = homes[k % homes.length];
    return { x: h[0], y: h[1], dx: 0, dy: -1, home: h, out: 1.5 + k * 2.5, look: BEE_LOOKS[k % BEE_LOOKS.length] };
  });
  m.doneInMaze = 0;
  m.napping = 0;
  m.frozen = 1.2;
  if (m.shieldOn) m.shield = 1;
  fillWord(m);
}

/** Give the dots their letters (or words) for the word now. */
function fillWord(m: Maze) {
  m.got = 0;
  const w = word(m);
  const free = m.dots.filter((d) => !d.honey);
  for (const d of free) d.text = '';
  const shuffled = [...free].sort(() => m.rand() - 0.5);
  if (m.mode === 'letters') {
    // every letter of the word somewhere (each one its own dot, not right beside you), the rest other letters
    const far = shuffled.filter((d) => Math.abs(d.x - m.you.x) + Math.abs(d.y - m.you.y) > 3);
    const spots = far.length >= w.word.length ? far : shuffled;
    [...w.word].forEach((ch, i) => spots[i] && (spots[i].text = ch));
    for (const d of free) if (!d.text) d.text = ALPHABET[Math.floor(m.rand() * ALPHABET.length)];
  } else {
    // words: spread out (no two near each other), the right one twice, the misspellings, and other words
    const chosen: Dot[] = [];
    for (const d of shuffled) {
      if (chosen.length >= 16) break;
      if (Math.abs(d.x - m.you.x) + Math.abs(d.y - m.you.y) < 3) continue;
      if (chosen.some((c) => (c.y === d.y && Math.abs(c.x - d.x) < 4) || (Math.abs(c.y - d.y) < 2 && Math.abs(c.x - d.x) < 3))) continue;
      chosen.push(d);
    }
    const others = m.words.filter((x) => x.word !== w.word).map((x) => x.word);
    const pool = [w.word, w.word, ...w.wrong, ...w.wrong.slice(0, 2)];
    while (pool.length < chosen.length) pool.push(others[Math.floor(m.rand() * others.length)] ?? w.wrong[0] ?? w.word);
    chosen.forEach((d, i) => (d.text = pool[i]));
    // the other dots are plain (nothing to eat there)
  }
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Move along the maze at `speed` cells a second, turning to `want` at the first cell it can. */
export function moveOn(m: Maze, o: Mover, want: { dx: number; dy: number } | null, speed: number, dt: number) {
  let dist = speed * dt;
  if (want && (o.dx || o.dy) && want.dx === -o.dx && want.dy === -o.dy) {
    o.dx = want.dx;
    o.dy = want.dy;
  }
  for (let guard = 0; dist > 1e-9 && guard < 8; guard++) {
    const cx = Math.round(o.x);
    const cy = Math.round(o.y);
    const atCentre = Math.abs(o.x - cx) < 1e-6 && Math.abs(o.y - cy) < 1e-6;
    if (atCentre) {
      o.x = cx;
      o.y = cy;
      if (want && isOpen(m, cx + want.dx, cy + want.dy)) {
        o.dx = want.dx;
        o.dy = want.dy;
      }
      if (!isOpen(m, cx + o.dx, cy + o.dy)) {
        o.dx = 0;
        o.dy = 0;
        return;
      }
    }
    if (!o.dx && !o.dy) return;
    const nx = atCentre ? cx + o.dx : o.dx > 0 ? Math.ceil(o.x) : o.dx < 0 ? Math.floor(o.x) : o.x;
    const ny = atCentre ? cy + o.dy : o.dy > 0 ? Math.ceil(o.y) : o.dy < 0 ? Math.floor(o.y) : o.y;
    const left = Math.abs(nx - o.x) + Math.abs(ny - o.y);
    if (dist >= left) {
      o.x = nx;
      o.y = ny;
      dist -= left;
    } else {
      o.x += o.dx * dist;
      o.y += o.dy * dist;
      dist = 0;
    }
  }
}

/** A bee at a crossing: mostly towards you (away while napping), sometimes anywhere — never straight back unless stuck. */
function beeTurn(m: Maze, b: Bee) {
  const cx = Math.round(b.x);
  const cy = Math.round(b.y);
  if (Math.abs(b.x - cx) > 1e-6 || Math.abs(b.y - cy) > 1e-6) return;
  const ways = DIRS.filter(([dx, dy]) => isOpen(m, cx + dx, cy + dy) && !(dx === -b.dx && dy === -b.dy));
  const opts = ways.length ? ways : DIRS.filter(([dx, dy]) => isOpen(m, cx + dx, cy + dy));
  if (!opts.length) return;
  const smart = m.napping > 0 ? 0.7 : Math.min(0.85, 0.45 + 0.08 * m.level);
  let pick = opts[Math.floor(m.rand() * opts.length)];
  if (m.rand() < smart) {
    const d = (dx: number, dy: number) => Math.hypot(cx + dx - m.you.x, cy + dy - m.you.y);
    pick = [...opts].sort((a, z) => (m.napping > 0 ? d(z[0], z[1]) - d(a[0], a[1]) : d(a[0], a[1]) - d(z[0], z[1])))[0];
  }
  b.dx = pick[0];
  b.dy = pick[1];
}

export const youSpeed = (m: Maze) => 4.6 + Math.min(1.2, 0.1 * m.level);
export const beeSpeed = (m: Maze) => (m.napping > 0 ? 2.3 : Math.min(4.4, 3.1 + 0.2 * m.level));

/** One small step of time. */
export function tick(m: Maze, dt: number) {
  if (m.over) return;
  if (m.frozen > 0) {
    m.frozen = Math.max(0, m.frozen - dt);
    return;
  }
  m.napping = Math.max(0, m.napping - dt);
  moveOn(m, m.you, m.want, youSpeed(m), dt);
  // 🍽️ eating what's here
  const ux = Math.round(m.you.x);
  const uy = Math.round(m.you.y);
  if (Math.abs(m.you.x - ux) < 0.3 && Math.abs(m.you.y - uy) < 0.3) {
    const i = m.dots.findIndex((d) => d.x === ux && d.y === uy && (d.honey || d.text));
    if (i >= 0) eat(m, i);
  }
  for (const b of m.bees) {
    if (b.out > 0) {
      b.out -= dt;
      continue;
    }
    beeTurn(m, b);
    moveOn(m, b, { dx: b.dx, dy: b.dy }, beeSpeed(m), dt);
    beeTurn(m, b);
    if (Math.hypot(b.x - m.you.x, b.y - m.you.y) < 0.65) bump(m, b);
    if (m.over) return;
  }
}

function eat(m: Maze, i: number) {
  const d = m.dots[i];
  if (d.honey) {
    m.dots.splice(i, 1);
    m.napping = NAP;
    m.score += 50;
    m.news.push({ kind: 'honey', text: '🍯 Honey! The bees are sleepy — catch them!' });
    return;
  }
  const w = word(m);
  if (m.mode === 'letters') {
    const need = w.word[m.got];
    if (d.text !== need) {
      // not the next letter: it stays (no harm done) — once per letter, so walking over it again doesn't nag
      const cell = d.y * MAZE_W + d.x;
      if (m.lastWrong !== cell) m.news.push({ kind: 'wrong', text: `Not ${d.text.toUpperCase()} — find ${need.toUpperCase()}` });
      m.lastWrong = cell;
      return;
    }
    m.dots.splice(i, 1);
    m.lastWrong = -1;
    m.got++;
    m.score += 10 * m.level;
    m.news.push({ kind: 'letter', text: need });
    if (m.got >= w.word.length) wordDone(m);
    return;
  }
  // words: only the right one is eaten; a wrong one stays put and says why (and costs a few points)
  if (d.text === w.word) {
    m.dots.splice(i, 1);
    m.lastWrong = -1;
    wordDone(m);
    return;
  }
  const cell = d.y * MAZE_W + d.x;
  if (m.lastWrong !== cell) {
    m.news.push({ kind: 'wrong', text: w.wrong.includes(d.text) ? `❌ “${d.text}” is spelled wrong` : `❌ “${d.text}” isn’t the word for this clue` });
    m.score = Math.max(0, m.score - 20);
  }
  m.lastWrong = cell;
}

function wordDone(m: Maze) {
  const w = word(m);
  m.score += 30 * w.word.length * m.level;
  m.doneInMaze++;
  m.news.push({ kind: 'word', text: w.word });
  m.wordAt++;
  if (m.doneInMaze >= WORDS_PER_MAZE) {
    m.score += 500 * m.level;
    m.level++;
    m.news.push({ kind: 'maze', text: `🎉 Maze ${m.level - 1} done!` });
    buildLevel(m);
    return;
  }
  // a fresh set of dots if most are eaten
  if (m.mode === 'letters' && m.dots.filter((d) => !d.honey).length < 40) {
    const rows = LAYOUTS[(m.level - 1) % LAYOUTS.length];
    const have = new Set(m.dots.map((d) => d.y * MAZE_W + d.x));
    for (let y = 0; y < MAZE_H; y++) for (let x = 0; x < MAZE_W; x++) if (rows[y][x] === '.' && !have.has(y * MAZE_W + x)) m.dots.push({ x, y, text: '' });
  }
  if (m.mode === 'words') {
    // words come back for the next clue: every path dot can hold one again
    const rows = LAYOUTS[(m.level - 1) % LAYOUTS.length];
    const have = new Set(m.dots.map((d) => d.y * MAZE_W + d.x));
    for (let y = 0; y < MAZE_H; y++) for (let x = 0; x < MAZE_W; x++) if (rows[y][x] === '.' && !have.has(y * MAZE_W + x)) m.dots.push({ x, y, text: '' });
  }
  fillWord(m);
}

function bump(m: Maze, b: Bee) {
  if (m.napping > 0) {
    // 🐝 caught a sleepy bee: back home for a bit
    m.score += 200;
    m.news.push({ kind: 'bee', text: '🐝 Caught a bee! +200' });
    b.x = b.home[0];
    b.y = b.home[1];
    b.dx = 0;
    b.dy = -1;
    b.out = 3;
    return;
  }
  if (m.shield > 0) {
    m.shield--;
    m.news.push({ kind: 'shield', text: '🛡️ Bee shield! It bounced off.' });
    b.x = b.home[0];
    b.y = b.home[1];
    b.out = 2;
    return;
  }
  m.news.push({ kind: 'ouch', text: '🐝 Ouch! A bee got you.' });
  loseHeart(m);
}

function loseHeart(m: Maze) {
  m.lives--;
  if (m.lives <= 0) {
    m.over = true;
    m.news.push({ kind: 'over', text: 'Game over' });
    return;
  }
  m.you = { x: m.start[0], y: m.start[1], dx: 0, dy: 0 };
  m.want = null;
  m.bees.forEach((b, k) => {
    b.x = b.home[0];
    b.y = b.home[1];
    b.dx = 0;
    b.dy = -1;
    b.out = 1 + k * 1.5;
  });
  m.frozen = 1.2;
}

/** Each layout, checked: the right size, and every dot can be reached from the start (for tests). */
export function layoutProblems(): string[] {
  const out: string[] = [];
  LAYOUTS.forEach((rows, k) => {
    if (rows.length !== MAZE_H || rows.some((r) => r.length !== MAZE_W)) out.push(`layout ${k}: wrong size ${rows.map((r) => r.length).join(',')}`);
    const m = newMaze('letters', [], k + 1, 1);
    const seen = new Set<number>();
    const q = [m.start];
    while (q.length) {
      const [x, y] = q.pop()!;
      const i = y * MAZE_W + x;
      if (seen.has(i) || !isOpen(m, x, y)) continue;
      seen.add(i);
      for (const [dx, dy] of DIRS) q.push([x + dx, y + dy]);
    }
    const lost = m.dots.filter((d) => !seen.has(d.y * MAZE_W + d.x)).length;
    if (lost) out.push(`layout ${k}: ${lost} dots can't be reached`);
  });
  return out;
}
