import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

/**
 * The small year tag in the top-right corner of a photo or face thumbnail. Every photo's year is
 * fetched once (GET /photos/years) and shared by all the tags on screen; it's refreshed after a
 * couple of minutes, or straight away when a year is changed by hand (PHOTO_YEARS_CHANGED).
 */
export const PHOTO_YEARS_CHANGED = 'photo-years-changed';

type Years = Record<string, number>;
let cache: { at: number; years: Promise<Years> } | null = null;
const listeners = new Set<(y: Years) => void>();

function loadYears(force = false): Promise<Years> {
  if (!cache || force || Date.now() - cache.at > 120_000) {
    const years = api.get<Years>('/photos/years').catch(() => ({}) as Years);
    cache = { at: Date.now(), years };
    void years.then((y) => listeners.forEach((l) => l(y)));
  }
  return cache.years;
}

if (typeof window !== 'undefined') window.addEventListener(PHOTO_YEARS_CHANGED, () => void loadYears(true));

export function usePhotoYears(): Years | null {
  const [years, setYears] = useState<Years | null>(null);
  useEffect(() => {
    let live = true;
    listeners.add(setYears);
    void loadYears().then((y) => live && setYears(y));
    return () => {
      live = false;
      listeners.delete(setYears);
    };
  }, []);
  return years;
}

export function ThumbYear({ photoId }: { photoId: string }) {
  const years = usePhotoYears();
  const year = years?.[photoId];
  if (!year) return null;
  return (
    <span className="thumb-year" title={`Taken ${year}`}>
      {year}
    </span>
  );
}
