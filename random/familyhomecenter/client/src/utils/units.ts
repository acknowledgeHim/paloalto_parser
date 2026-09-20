// Cooking unit conversion + recipe-quantity scaling. Pure client-side math — no server/network
// involved, same "self-contained" approach as utils/sounds.ts.

interface UnitDef {
  label: string;
  /** Multiplier to this dimension's base unit (ml for volume, g for weight). */
  toBase: number;
}

export const VOLUME_UNITS: Record<string, UnitDef> = {
  tsp: { label: 'teaspoon (tsp)', toBase: 4.92892 },
  tbsp: { label: 'tablespoon (tbsp)', toBase: 14.7868 },
  floz: { label: 'fluid ounce (fl oz)', toBase: 29.5735 },
  cup: { label: 'cup', toBase: 236.588 },
  pint: { label: 'pint', toBase: 473.176 },
  quart: { label: 'quart', toBase: 946.353 },
  gallon: { label: 'gallon', toBase: 3785.41 },
  ml: { label: 'milliliter (ml)', toBase: 1 },
  l: { label: 'liter (L)', toBase: 1000 },
};

export const WEIGHT_UNITS: Record<string, UnitDef> = {
  oz: { label: 'ounce (oz)', toBase: 28.3495 },
  lb: { label: 'pound (lb)', toBase: 453.592 },
  g: { label: 'gram (g)', toBase: 1 },
  kg: { label: 'kilogram (kg)', toBase: 1000 },
};

export function convertVolume(value: number, from: string, to: string): number {
  return (value * VOLUME_UNITS[from].toBase) / VOLUME_UNITS[to].toBase;
}

export function convertWeight(value: number, from: string, to: string): number {
  return (value * WEIGHT_UNITS[from].toBase) / WEIGHT_UNITS[to].toBase;
}

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}

// ---- Recipe ingredient scaling ----

const FRACTION_WORDS: Record<string, number> = {
  '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

/** Parses a leading quantity (e.g. "1 1/2", "2.5", "¾", "3") off the front of a string. */
function parseLeadingAmount(text: string): { amount: number; rest: string } | null {
  const trimmed = text.trim();
  // "1 1/2 cups" or "1/2 cup"
  const mixedFraction = /^(\d+\s+)?(\d+)\/(\d+)\s*(.*)$/.exec(trimmed);
  if (mixedFraction) {
    const whole = mixedFraction[1] ? parseInt(mixedFraction[1], 10) : 0;
    const amount = whole + parseInt(mixedFraction[2], 10) / parseInt(mixedFraction[3], 10);
    return { amount, rest: mixedFraction[4] };
  }
  // "2.5 cups" or "3 cups"
  const decimal = /^(\d+(?:\.\d+)?)\s*(.*)$/.exec(trimmed);
  if (decimal) {
    return { amount: parseFloat(decimal[1]), rest: decimal[2] };
  }
  // "¾ cup"
  const unicodeFraction = /^([¼½¾⅓⅔⅛⅜⅝⅞])\s*(.*)$/.exec(trimmed);
  if (unicodeFraction) {
    return { amount: FRACTION_WORDS[unicodeFraction[1]], rest: unicodeFraction[2] };
  }
  return null;
}

/** Formats a number back into a cooking-friendly mixed fraction (nearest 1/8) + optional rest text. */
function formatAmount(amount: number, rest: string): string {
  const rounded = Math.round(amount * 8) / 8;
  const whole = Math.floor(rounded);
  const frac = Math.round((rounded - whole) * 8);
  const FRACTIONS: Record<number, string> = { 1: '⅛', 2: '¼', 3: '⅜', 4: '½', 5: '⅝', 6: '¾', 7: '⅞' };
  let amountStr: string;
  if (frac === 0 || frac === 8) {
    amountStr = String(frac === 8 ? whole + 1 : whole || 0);
  } else if (whole === 0) {
    amountStr = FRACTIONS[frac];
  } else {
    amountStr = `${whole} ${FRACTIONS[frac]}`;
  }
  return rest ? `${amountStr} ${rest}` : amountStr;
}

/** Scales a freeform ingredient quantity string ("2 cups", "1/2 tsp") by factor. Quantities with
 *  no leading number ("to taste", "a pinch") are returned unchanged — nothing sensible to scale. */
export function scaleQuantity(quantity: string | null, factor: number): string | null {
  if (!quantity || factor === 1) return quantity;
  const parsed = parseLeadingAmount(quantity);
  if (!parsed) return quantity;
  return formatAmount(parsed.amount * factor, parsed.rest.trim());
}
