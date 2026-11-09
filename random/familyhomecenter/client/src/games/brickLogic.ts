/**
 * 🧱 Brick Tumble: the rules, with no drawing — a 10 × 20 well, seven 4-square bricks that fall,
 * full rows clear. Pure functions + one small state object, so it can be tested on its own.
 */

export const COLS = 10;
export const ROWS = 20;
/** Rows above the top you can't see, so a brick can turn while it's coming in. */
export const HIDDEN = 2;

export type Kind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export const KINDS: Kind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** Each brick's squares when it first appears ([col, row], row 0 at the top). */
const SHAPES: Record<Kind, Array<[number, number]>> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
/** The box each brick turns inside. */
const BOX: Record<Kind, number> = { I: 4, O: 4, T: 3, S: 3, Z: 3, J: 3, L: 3 };

/** The squares of a brick turned `rot` quarter-turns clockwise (inside its box). */
export function cells(kind: Kind, rot: number): Array<[number, number]> {
  const n = BOX[kind];
  let c = SHAPES[kind];
  if (kind === 'O') return c;
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) c = c.map(([x, y]) => [n - 1 - y, x] as [number, number]);
  return c;
}

export interface Piece {
  kind: Kind;
  rot: number;
  x: number; // box's left column
  y: number; // box's top row (0 = top of the hidden rows)
}

/** 0 = empty, otherwise the kind index + 1. Rows include the hidden ones at the top. */
export type Well = number[][];
export const emptyWell = (): Well => Array.from({ length: ROWS + HIDDEN }, () => Array(COLS).fill(0));

export function fits(well: Well, p: Piece): boolean {
  for (const [cx, cy] of cells(p.kind, p.rot)) {
    const x = p.x + cx;
    const y = p.y + cy;
    if (x < 0 || x >= COLS || y >= ROWS + HIDDEN) return false;
    if (y >= 0 && well[y][x]) return false;
  }
  return true;
}

/** Where a brick would land if dropped straight down. */
export function dropY(well: Well, p: Piece): number {
  let y = p.y;
  while (fits(well, { ...p, y: y + 1 })) y++;
  return y;
}

/** Turning against a wall or the pile: try nudging it over (or up a bit) before giving up. */
const KICKS: Array<[number, number]> = [[0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1], [-2, 0], [2, 0]];
export function turned(well: Well, p: Piece, dir: 1 | -1): Piece | null {
  const rot = (p.rot + dir + 4) % 4;
  for (const [dx, dy] of KICKS) {
    const q = { ...p, rot, x: p.x + dx, y: p.y + dy };
    if (fits(well, q)) return q;
  }
  return null;
}

/** A small seeded random (so tests can repeat a game). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Bricks come in shuffled bags of all seven, so you never wait forever for a long one. */
export function bagMaker(rand: () => number) {
  let bag: Kind[] = [];
  return (): Kind => {
    if (!bag.length) {
      bag = [...KINDS];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop()!;
  };
}

export const spawn = (kind: Kind): Piece => ({ kind, rot: 0, x: kind === 'O' ? 3 : 3, y: HIDDEN - 1 });

/** Points for clearing 1–4 rows at once, times the level. */
export const ROW_POINTS = [0, 100, 300, 500, 800];
/** Seconds per row the brick falls by itself, by level (1 = slowest). */
export function fallTime(level: number): number {
  return Math.max(0.05, 0.8 * Math.pow(0.85, level - 1));
}

export interface Game {
  well: Well;
  piece: Piece;
  next: Kind[];
  held: Kind | null;
  canHold: boolean;
  score: number;
  rows: number;
  level: number;
  startLevel: number;
  over: boolean;
  /** rows that just cleared (for the flash), and when */
  flash: { rows: number[]; t: number } | null;
  bigClears: number; // 4 rows at once
  combo: number;
  take: () => Kind;
}

export function newGame(seed: number, startLevel = 1): Game {
  const take = bagMaker(rng(seed));
  const first = take();
  return {
    well: emptyWell(),
    piece: spawn(first),
    next: [take(), take(), take()],
    held: null,
    canHold: true,
    score: 0,
    rows: 0,
    level: startLevel,
    startLevel,
    over: false,
    flash: null,
    bigClears: 0,
    combo: -1,
    take,
  };
}

function nextPiece(g: Game, kind?: Kind) {
  const k = kind ?? g.next.shift()!;
  if (!kind) g.next.push(g.take());
  g.piece = spawn(k);
  if (!fits(g.well, g.piece)) g.over = true;
}

/** The brick stops: it becomes part of the pile, full rows clear, the next brick comes. */
export function lock(g: Game, now = 0): number {
  const p = g.piece;
  let above = true;
  for (const [cx, cy] of cells(p.kind, p.rot)) {
    const y = p.y + cy;
    if (y >= 0) g.well[y][p.x + cx] = KINDS.indexOf(p.kind) + 1;
    if (y >= HIDDEN) above = false;
  }
  const full: number[] = [];
  g.well.forEach((row, y) => row.every((c) => c) && full.push(y));
  if (full.length) {
    g.well = [...Array.from({ length: full.length }, () => Array(COLS).fill(0)), ...g.well.filter((_, y) => !full.includes(y))];
    g.combo++;
    g.score += ROW_POINTS[full.length] * g.level + (g.combo > 0 ? 50 * g.combo * g.level : 0);
    if (full.length === 4) g.bigClears++;
    g.rows += full.length;
    g.level = Math.max(g.startLevel, g.startLevel + Math.floor(g.rows / 10));
    g.flash = { rows: full, t: now };
  } else {
    g.combo = -1;
  }
  g.canHold = true;
  if (above && !full.length) {
    g.over = true; // stopped entirely above the top
    return 0;
  }
  nextPiece(g);
  return full.length;
}

/** Move sideways; true if it moved. */
export function shift(g: Game, dx: number): boolean {
  const q = { ...g.piece, x: g.piece.x + dx };
  if (g.over || !fits(g.well, q)) return false;
  g.piece = q;
  return true;
}

export function turn(g: Game, dir: 1 | -1): boolean {
  if (g.over) return false;
  const q = turned(g.well, g.piece, dir);
  if (!q) return false;
  g.piece = q;
  return true;
}

/** One row down; false if it's sitting on something. `soft` = the player pushed it (1 point). */
export function fall(g: Game, soft = false): boolean {
  const q = { ...g.piece, y: g.piece.y + 1 };
  if (g.over || !fits(g.well, q)) return false;
  g.piece = q;
  if (soft) g.score += 1;
  return true;
}

/** Straight to the bottom (2 points a row) and stop there. Returns rows cleared. */
export function slam(g: Game, now = 0): number {
  if (g.over) return 0;
  const y = dropY(g.well, g.piece);
  g.score += 2 * (y - g.piece.y);
  g.piece = { ...g.piece, y };
  return lock(g, now);
}

/** Put this brick aside and take the one set aside before (once per brick). */
export function hold(g: Game): boolean {
  if (g.over || !g.canHold) return false;
  const k = g.piece.kind;
  nextPiece(g, g.held ?? undefined);
  g.held = k;
  g.canHold = false;
  return true;
}
