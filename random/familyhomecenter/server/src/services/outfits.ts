/**
 * 👕 Dress up: outfit pieces a kid buys with their Prize Bank stars and puts on their avatar —
 * on the floor plan, the Prize Bank and their Dress up page. One piece per slot.
 */
export type OutfitSlot = 'hat' | 'eyes' | 'hand' | 'pet' | 'magic';

export interface OutfitItem {
  id: string;
  slot: OutfitSlot;
  emoji: string;
  name: string;
  stars: number;
}

export const OUTFIT_SLOTS: Array<{ id: OutfitSlot; label: string }> = [
  { id: 'hat', label: '🎩 Hats' },
  { id: 'eyes', label: '🕶️ Glasses' },
  { id: 'hand', label: '🎈 In their hand' },
  { id: 'pet', label: '🐶 Pets' },
  { id: 'magic', label: '✨ Magic' },
];

export const OUTFIT_ITEMS: OutfitItem[] = [
  { id: 'cap', slot: 'hat', emoji: '🧢', name: 'Ball cap', stars: 5 },
  { id: 'bow', slot: 'hat', emoji: '🎀', name: 'Bow', stars: 5 },
  { id: 'sunhat', slot: 'hat', emoji: '👒', name: 'Sun hat', stars: 8 },
  { id: 'helmet', slot: 'hat', emoji: '⛑️', name: 'Rescue helmet', stars: 8 },
  { id: 'tophat', slot: 'hat', emoji: '🎩', name: 'Top hat', stars: 10 },
  { id: 'gradcap', slot: 'hat', emoji: '🎓', name: 'Graduation cap', stars: 12 },
  { id: 'crown', slot: 'hat', emoji: '👑', name: 'Crown', stars: 25 },
  { id: 'glasses', slot: 'eyes', emoji: '👓', name: 'Glasses', stars: 5 },
  { id: 'goggles', slot: 'eyes', emoji: '🥽', name: 'Goggles', stars: 8 },
  { id: 'shades', slot: 'eyes', emoji: '🕶️', name: 'Cool shades', stars: 10 },
  { id: 'balloon', slot: 'hand', emoji: '🎈', name: 'Balloon', stars: 3 },
  { id: 'icecream', slot: 'hand', emoji: '🍦', name: 'Ice cream', stars: 4 },
  { id: 'flower', slot: 'hand', emoji: '🌻', name: 'Sunflower', stars: 4 },
  { id: 'ball', slot: 'hand', emoji: '🏀', name: 'Basketball', stars: 5 },
  { id: 'umbrella', slot: 'hand', emoji: '🌂', name: 'Umbrella', stars: 6 },
  { id: 'guitar', slot: 'hand', emoji: '🎸', name: 'Guitar', stars: 12 },
  { id: 'wand', slot: 'hand', emoji: '🪄', name: 'Magic wand', stars: 15 },
  { id: 'sword', slot: 'hand', emoji: '⚔️', name: 'Swords', stars: 15 },
  { id: 'chick', slot: 'pet', emoji: '🐥', name: 'Chick', stars: 10 },
  { id: 'turtle', slot: 'pet', emoji: '🐢', name: 'Turtle', stars: 10 },
  { id: 'bunny', slot: 'pet', emoji: '🐰', name: 'Bunny', stars: 15 },
  { id: 'puppy', slot: 'pet', emoji: '🐶', name: 'Puppy', stars: 20 },
  { id: 'kitten', slot: 'pet', emoji: '🐱', name: 'Kitten', stars: 20 },
  { id: 'dino', slot: 'pet', emoji: '🦖', name: 'Dinosaur', stars: 30 },
  { id: 'unicorn', slot: 'pet', emoji: '🦄', name: 'Unicorn', stars: 40 },
  { id: 'dragon', slot: 'pet', emoji: '🐉', name: 'Dragon', stars: 50 },
  { id: 'hearts', slot: 'magic', emoji: '💖', name: 'Floating hearts', stars: 12 },
  { id: 'sparkles', slot: 'magic', emoji: '✨', name: 'Sparkles', stars: 15 },
  { id: 'music', slot: 'magic', emoji: '🎵', name: 'Music notes', stars: 15 },
  { id: 'rainbow', slot: 'magic', emoji: '🌈', name: 'Rainbow', stars: 20 },
  { id: 'fire', slot: 'magic', emoji: '🔥', name: 'Flames', stars: 25 },
];

export const outfitItem = (id: string) => OUTFIT_ITEMS.find((i) => i.id === id);

export function parseOutfit(raw: string | null | undefined): Partial<Record<OutfitSlot, string>> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}
