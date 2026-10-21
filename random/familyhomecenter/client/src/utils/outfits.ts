import { useEffect, useState } from 'react';
import { api, type FamilyMember, type OutfitCatalog, type OutfitItem, type OutfitSlot } from '../api/client.js';

/** 👕 Dress up: the shop's pieces (asked once, then shared by every avatar on the page). */
let catalog: Promise<OutfitCatalog> | null = null;
export function loadOutfitCatalog(): Promise<OutfitCatalog> {
  if (!catalog) catalog = api.get<OutfitCatalog>('/outfits/catalog').catch(() => ({ slots: [], items: [] }));
  return catalog;
}

export function useOutfitCatalog(): OutfitCatalog | null {
  const [c, setC] = useState<OutfitCatalog | null>(null);
  useEffect(() => {
    let live = true;
    loadOutfitCatalog().then((x) => live && setC(x));
    return () => {
      live = false;
    };
  }, []);
  return c;
}

/** What someone has on: slot → item id. */
export function outfitOf(member: Pick<FamilyMember, 'avatar_outfit'> | null | undefined): Partial<Record<OutfitSlot, string>> {
  if (!member?.avatar_outfit) return {};
  try {
    return JSON.parse(member.avatar_outfit) ?? {};
  } catch {
    return {};
  }
}

/** Their pieces, looked up in the shop. */
export function wornItems(outfit: Partial<Record<OutfitSlot, string>>, c: OutfitCatalog | null): Partial<Record<OutfitSlot, OutfitItem>> {
  if (!c) return {};
  const out: Partial<Record<OutfitSlot, OutfitItem>> = {};
  for (const [slot, id] of Object.entries(outfit)) {
    const item = c.items.find((i) => i.id === id);
    if (item) out[slot as OutfitSlot] = item;
  }
  return out;
}
