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
  },
  {
    id: 'brick-tumble',
    emoji: '🧱',
    name: 'Brick Tumble',
    stars: 20,
    blurb:
      'Falling bricks: move and turn them as they drop, fill a row from side to side to clear it, and don’t let the pile reach the top. It speeds up as you go — big scores unlock new brick looks.',
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
];

export const gameOf = (id: string) => GAMES.find((g) => g.id === id);
