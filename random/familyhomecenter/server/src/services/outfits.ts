/**
 * 👕 Dress up: outfit pieces a kid buys with their Prize Bank stars and puts on their avatar —
 * everywhere their avatar shows up (components/MemberAvatar.tsx). One piece per slot.
 */
export type OutfitSlot = 'hat' | 'eyes' | 'hand' | 'pet' | 'vehicle' | 'magic';

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
  { id: 'vehicle', label: '🚗 Vehicles' },
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
  // 🚗 Vehicles — something to ride, the big things to save up for: from 20 ⭐ (skates, scooters)
  // up to 200 ⭐ (a flying saucer). The fancier, the more stars.
  { id: 'rollerskates', slot: 'vehicle', emoji: '🛼', name: 'Roller skates', stars: 20 },
  { id: 'skateboard', slot: 'vehicle', emoji: '🛹', name: 'Skateboard', stars: 20 },
  { id: 'scooter', slot: 'vehicle', emoji: '🛴', name: 'Scooter', stars: 20 },
  { id: 'sled', slot: 'vehicle', emoji: '🛷', name: 'Sled', stars: 20 },
  { id: 'bike', slot: 'vehicle', emoji: '🚲', name: 'Bike', stars: 25 },
  { id: 'canoe', slot: 'vehicle', emoji: '🛶', name: 'Canoe', stars: 25 },
  { id: 'moped', slot: 'vehicle', emoji: '🛵', name: 'Moped', stars: 30 },
  { id: 'tractor', slot: 'vehicle', emoji: '🚜', name: 'Tractor', stars: 30 },
  { id: 'carousel', slot: 'vehicle', emoji: '🎠', name: 'Carousel horse', stars: 30 },
  { id: 'motorbike', slot: 'vehicle', emoji: '🏍️', name: 'Motorbike', stars: 35 },
  { id: 'tuktuk', slot: 'vehicle', emoji: '🛺', name: 'Tuk-tuk', stars: 35 },
  { id: 'taxi', slot: 'vehicle', emoji: '🚕', name: 'Taxi', stars: 35 },
  { id: 'car', slot: 'vehicle', emoji: '🚗', name: 'Car', stars: 40 },
  { id: 'suv', slot: 'vehicle', emoji: '🚙', name: 'SUV', stars: 40 },
  { id: 'pickup', slot: 'vehicle', emoji: '🛻', name: 'Pickup truck', stars: 40 },
  { id: 'sailboat', slot: 'vehicle', emoji: '⛵', name: 'Sailboat', stars: 40 },
  { id: 'camper', slot: 'vehicle', emoji: '🚐', name: 'Camper van', stars: 45 },
  { id: 'truck', slot: 'vehicle', emoji: '🚚', name: 'Delivery truck', stars: 45 },
  { id: 'bus', slot: 'vehicle', emoji: '🚌', name: 'School bus', stars: 45 },
  { id: 'ambulance', slot: 'vehicle', emoji: '🚑', name: 'Ambulance', stars: 50 },
  { id: 'police', slot: 'vehicle', emoji: '🚓', name: 'Police car', stars: 50 },
  { id: 'firetruck', slot: 'vehicle', emoji: '🚒', name: 'Fire truck', stars: 50 },
  { id: 'speedboat', slot: 'vehicle', emoji: '🚤', name: 'Speedboat', stars: 50 },
  { id: 'racecar', slot: 'vehicle', emoji: '🏎️', name: 'Race car', stars: 60 },
  { id: 'bigrig', slot: 'vehicle', emoji: '🚛', name: 'Big rig', stars: 60 },
  { id: 'yacht', slot: 'vehicle', emoji: '🛥️', name: 'Yacht', stars: 60 },
  { id: 'train', slot: 'vehicle', emoji: '🚂', name: 'Steam train', stars: 70 },
  { id: 'cablecar', slot: 'vehicle', emoji: '🚠', name: 'Cable car', stars: 70 },
  { id: 'bullettrain', slot: 'vehicle', emoji: '🚄', name: 'Bullet train', stars: 80 },
  { id: 'parachute', slot: 'vehicle', emoji: '🪂', name: 'Parachute', stars: 80 },
  { id: 'helicopter', slot: 'vehicle', emoji: '🚁', name: 'Helicopter', stars: 90 },
  { id: 'smallplane', slot: 'vehicle', emoji: '🛩️', name: 'Little airplane', stars: 90 },
  { id: 'jet', slot: 'vehicle', emoji: '✈️', name: 'Jumbo jet', stars: 100 },
  { id: 'cruiseship', slot: 'vehicle', emoji: '🛳️', name: 'Cruise ship', stars: 100 },
  { id: 'rocket', slot: 'vehicle', emoji: '🚀', name: 'Rocket', stars: 150 },
  { id: 'ufo', slot: 'vehicle', emoji: '🛸', name: 'Flying saucer', stars: 200 },
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
