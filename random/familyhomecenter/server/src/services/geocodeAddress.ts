import { config } from '../config.js';

// OpenStreetMap's free Nominatim API — no key needed. Unlike services/weather.ts's geocode()
// (Open-Meteo, place names/cities only — fine for "set home location" but returns nothing for a
// full street address), this resolves an actual mailing address. Its usage policy caps free use
// at ~1 request/second and requires a descriptive User-Agent — trivially satisfied by a family
// app's occasional contact-address edits.
const USER_AGENT = 'FamilyHomeCenter/1.0 (self-hosted family dashboard, contact list distance lookup)';

let lastRequestAt = 0;
async function throttle(): Promise<void> {
  const wait = 1100 - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

/** Geocodes a free-text address. Best-effort: returns null (never throws) if nothing matched or
 *  the request failed — geocoding a contact's distance is a nice-to-have, never something that
 *  should block saving the contact itself. */
export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    await throttle();
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!resp.ok) return null;
    const results = (await resp.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(results) || results.length === 0) return null;
    const lat = Number(results[0].lat);
    const lon = Number(results[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch (err) {
    console.warn('[contacts] geocoding failed:', (err as Error).message);
    return null;
  }
}

const EARTH_RADIUS_MILES = 3958.8;

/** Straight-line ("as the crow flies") distance in miles — not driving distance, which would need
 *  a paid routing API (Google/Mapbox Distance Matrix); good enough for "roughly how far away". */
export function haversineMiles(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(h));
}

/** Geocodes `address` and returns its straight-line distance in miles from home (config.weather.lat/lon —
 *  the same "home location" Settings' weather widget uses) — null if geocoding failed. */
export async function distanceFromHomeMiles(address: string): Promise<number | null> {
  const coords = await geocodeAddress(address);
  if (!coords) return null;
  return haversineMiles({ lat: config.weather.lat, lon: config.weather.lon }, coords);
}
