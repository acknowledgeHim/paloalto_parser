/**
 * 🎮 Games: a kid unlocks each game once with their Prize Bank stars, then plays it as much as
 * they like. Parents play free. Best runs and in-game progress (coins, upgrades) are kept per
 * person (routes/games.ts). New games: add one here and a page for it in client/src/games/.
 */
export interface Game {
  id: string;
  emoji: string;
  name: string;
  stars: number;
  blurb: string;
  /** ⏰ daily limits for it are minutes only (it has no rounds or runs — e.g. a town that keeps going) */
  minutesOnly?: boolean;
  /** 🔓 extras inside the game a kid unlocks with 💎 too (a parent sets the price; 0 = free) */
  features?: Array<{ id: string; name: string; cost: number }>;
  /** 💎 a token shop inside the game: bought each time (coins: in-game coins it gives) — parent-set prices */
  shop?: Array<{ id: string; name: string; cost: number; coins?: number }>;
  /**
   * 🏆 Prize powers: can't be bought — a kid earns one by passing every lesson in a subject at their
   * grade (📚 Learning). A parent picks the subject and how many uses each earning gives (0 = unlimited),
   * and whether parents can use it free (to show the kids what they're working for).
   */
  prizes?: Prize[];
}
/** 🏆 Which lessons earn a prize: one subject, any one of them (each one finished earns it again), or all four. */
export type PrizeSubject = 'grammar' | 'math' | 'history' | 'science' | 'handson' | 'any' | 'all';
/** ('any' and 'all' are the four school subjects; 🔧 hands-on is picked on its own) */
export const PRIZE_SUBJECTS: PrizeSubject[] = ['math', 'grammar', 'history', 'science', 'handson', 'any', 'all'];
export interface Prize {
  id: string;
  name: string;
  blurb: string;
  /** what one use is: a drive, a game, a visit */
  unit: string;
  /** the usual subject and uses per earning (0 = unlimited) — a parent can change both */
  subject: PrizeSubject;
  uses: number;
}

export const GAMES: Game[] = [
  {
    id: 'hill-hopper',
    emoji: '⛰️',
    name: 'Hill Hopper',
    stars: 25,
    blurb:
      'Drive your Dress up ride over bumpy hills — balance it so you don’t flip, grab fuel cans before you run dry, collect coins and spend them on a better engine, grippier tires and a bigger tank.',
    features: [
      { id: 'jump', name: '🦘 Jump', cost: 5 },
      { id: 'obstacles', name: '⚠️ Obstacles', cost: 5 },
      { id: 'glide', name: '🪂 Glider', cost: 5 },
    ],
    prizes: [
      { id: 'flip-wheels', name: '🛞 Flip-proof wheels', blurb: 'Wheels on the roof too — land upside down and you just roll back over. You can never flip out!', unit: 'drive', subject: 'math', uses: 10 },
      { id: 'drill', name: '⛏️ Drill', blurb: 'A drill on the front of your ride: drive into the ✨ sparkly hill spots to dig up secret treasure — big coins, gems and fuel.', unit: 'drive', subject: 'science', uses: 10 },
    ],
  },
  {
    id: 'brick-tumble',
    emoji: '🧱',
    name: 'Brick Tumble',
    stars: 20,
    blurb:
      'Falling bricks: move and turn them as they drop, fill a row from side to side to clear it, and don’t let the pile reach the top. It speeds up as you go — big scores unlock new brick looks.',
    prizes: [
      { id: 'laser', name: '🔫 Laser', blurb: 'Blast the bricks! Each game you get 3 laser shots (and one more every 10 rows) — the laser zaps every brick under the falling one.', unit: 'game', subject: 'grammar', uses: 10 },
    ],
  },
  {
    id: 'tiny-town',
    emoji: '🏘️',
    name: 'Tiny Town',
    stars: 30,
    minutesOnly: true,
    blurb:
      'Build your own town: lay roads, put up homes, and give people jobs, power, water and parks. Happy people move in and pay taxes, so you can build more — schools, a stadium, all the way to a rocket base.',
    features: [
      { id: 'big-map', name: '🗺️ Bigger land', cost: 5 },
      { id: 'fun', name: '🎡 Fun places', cost: 5 },
    ],
    prizes: [
      { id: 'moon', name: '🌙 Moon base', blurb: 'A town on the Moon: grey dust, rocks and icy craters under the stars — with a 🚀 moon bonus of extra coins to start.', unit: 'visit', subject: 'science', uses: 0 },
      { id: 'earth', name: '🌍 The whole Earth', blurb: 'A huge world: four big lands with oceans between them and great lakes. See the whole Earth, then zoom in to build on each land.', unit: 'visit', subject: 'any', uses: 0 },
      { id: 'more-lands', name: '🗺️ 2 more lands', blurb: 'A 4th and 5th town to build.', unit: 'visit', subject: 'math', uses: 0 },
    ],
    // Keep the building ids in sync with `token` in client/src/games/townLogic.ts.
    shop: [
      { id: 'coins-small', name: '🪙 Bag of 500 coins', cost: 1, coins: 500 },
      { id: 'coins-big', name: '🪙 Chest of 3,000 coins', cost: 5, coins: 3000 },
      { id: 'rainbow', name: '🌈 Rainbow garden', cost: 2 },
      { id: 'beach', name: '🏖️ Beach', cost: 2 },
      { id: 'coaster', name: '🎢 Roller coaster', cost: 3 },
      { id: 'circus', name: '🎪 Circus', cost: 3 },
      { id: 'hotel', name: '🏨 Hotel', cost: 4 },
      { id: 'spacepad', name: '🛸 Space pad', cost: 6 },
    ],
  },
  {
    id: 'letter-maze',
    emoji: '🐝',
    name: 'Letter Maze',
    stars: 20,
    blurb:
      'Munch your way round the maze and spell! Little kids eat the letters of the word in order; big kids eat the word that’s spelled right. Dodge the bees — or grab a 🍯 honey pot and catch them while they nap.',
    prizes: [
      { id: 'shield', name: '🛡️ Bee shield', blurb: 'A bubble round you: the first bee that bumps you in each maze just bounces off.', unit: 'game', subject: 'any', uses: 10 },
    ],
  },
];

export const gameOf = (id: string) => GAMES.find((g) => g.id === id);
