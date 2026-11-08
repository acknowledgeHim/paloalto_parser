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
}

export const GAMES: Game[] = [
  {
    id: 'hill-hopper',
    emoji: '⛰️',
    name: 'Hill Hopper',
    stars: 25,
    blurb:
      'Drive your Dress up ride over bumpy hills — balance it so you don’t flip, grab fuel cans before you run dry, collect coins and spend them on a better engine, grippier tires and a bigger tank.',
  },
];

export const gameOf = (id: string) => GAMES.find((g) => g.id === id);
