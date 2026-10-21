import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import exifr from 'exifr';
import { config } from '../config.js';
import { db } from '../db.js';

/**
 * 📍 Where a photo was taken.
 *  - GPS: read once from the photo's EXIF (latitude/longitude, if the phone saved it) and kept in
 *    photo_gps — the file itself is only ever read, never changed.
 *  - Country / US state: worked out right here on the Pi from the GPS, with the Natural Earth
 *    borders in server/geo/places.json (public domain) — nothing is sent anywhere.
 *  - A family member can set the country (and state, in the US) and the year themselves when it's
 *    missing or wrong (photo_place_edits); that wins over what the photo says.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEO_FILE = path.join(__dirname, '..', '..', 'geo', 'places.json');

interface Region {
  n: string;
  c: string;
  b: [number, number, number, number];
  p: number[][];
}
let geo: { countries: Region[]; states: Region[] } | null = null;
function places() {
  if (!geo) geo = JSON.parse(fs.readFileSync(GEO_FILE, 'utf8'));
  return geo!;
}

/** Even-odd over every ring: inside a polygon (and not in one of its holes/lakes). */
function inside(r: Region, x: number, y: number): boolean {
  if (x < r.b[0] || x > r.b[2] || y < r.b[1] || y > r.b[3]) return false;
  let ins = false;
  for (const ring of r.p) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i];
      const yi = ring[i + 1];
      const xj = ring[j];
      const yj = ring[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
  }
  return ins;
}

/** A beach or a boat just off the (simplified) coast: the nearest border point within ~25 km. */
function nearest(list: Region[], x: number, y: number, maxDeg = 0.25): Region | null {
  let best: Region | null = null;
  let bestD = maxDeg * maxDeg;
  for (const r of list) {
    if (x < r.b[0] - maxDeg || x > r.b[2] + maxDeg || y < r.b[1] - maxDeg || y > r.b[3] + maxDeg) continue;
    for (const ring of r.p) {
      for (let i = 0; i < ring.length; i += 2) {
        const dx = (ring[i] - x) * Math.cos((y * Math.PI) / 180);
        const dy = ring[i + 1] - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = r;
        }
      }
    }
  }
  return best;
}

const placeCache = new Map<string, { country: string | null; country_code: string | null; state: string | null }>();
/** Country (and US state) at a latitude/longitude — offline. */
export function placeAt(lat: number, lon: number): { country: string | null; country_code: string | null; state: string | null } {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const hit = placeCache.get(key);
  if (hit) return hit;
  const g = places();
  const country = g.countries.find((r) => inside(r, lon, lat)) ?? nearest(g.countries, lon, lat);
  let state: Region | null = null;
  if (country?.c === 'US') state = g.states.find((r) => inside(r, lon, lat)) ?? nearest(g.states, lon, lat);
  const out = { country: country?.n ?? null, country_code: country?.c || null, state: state?.n ?? null };
  placeCache.set(key, out);
  return out;
}

/** For the "set where it was taken" pickers. */
export function placeLists() {
  const g = places();
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  return {
    countries: g.countries.filter((r) => r.c).map((r) => ({ name: r.n, code: r.c })).sort(byName),
    states: g.states.map((r) => ({ name: r.n, code: r.c })).sort(byName),
  };
}

/** Borders for drawing the 🗺️ map on screen — the same data, rounded to ~10 km and without the
 *  tiniest islands, so it's small to send. Made once. */
let outlinesCache: string | null = null;
export function mapOutlines(): string {
  if (outlinesCache) return outlinesCache;
  const g = places();
  const thin = (list: Region[], step: number, minPts: number) =>
    list.map((r) => ({
      n: r.n,
      p: r.p
        .map((ring) => {
          const out: number[] = [];
          for (let i = 0; i < ring.length; i += 2) {
            // Whole numbers of `step` degrees (the page multiplies back) — much smaller to send.
            const x = Math.round(ring[i] / step);
            const y = Math.round(ring[i + 1] / step);
            if (out.length && out[out.length - 2] === x && out[out.length - 1] === y) continue;
            out.push(x, y);
          }
          return out;
        })
        .filter((ring) => ring.length >= minPts * 2),
    }));
  outlinesCache = JSON.stringify({ countries: { step: 0.1, list: thin(g.countries, 0.1, 4) }, states: { step: 0.05, list: thin(g.states, 0.05, 4) } });
  return outlinesCache;
}

/** Roughly the middle of a country/state (its biggest piece) — where a photo with only a hand-set place sits on the map. */
const middles = new Map<string, { lat: number; lon: number }>();
export function middleOf(country: string | null, state: string | null): { lat: number; lon: number } | null {
  const key = `${country}|${state}`;
  if (middles.has(key)) return middles.get(key)!;
  const g = places();
  const r = (state && g.states.find((s) => s.n === state)) || (country && g.countries.find((c) => c.n === country)) || null;
  if (!r) return null;
  const ring = r.p.reduce((a, b) => (b.length > a.length ? b : a));
  let x = 0;
  let y = 0;
  for (let i = 0; i < ring.length; i += 2) {
    x += ring[i];
    y += ring[i + 1];
  }
  const m = { lat: y / (ring.length / 2), lon: x / (ring.length / 2) };
  middles.set(key, m);
  return m;
}

// ---- GPS from the photo (read once, kept) ----

const rel = (abs: string) => path.relative(config.photosDir, abs);
const gpsCache = new Map<string, { lat: number | null; lon: number | null }>();
let gpsLoaded = false;
function loadGps() {
  if (gpsLoaded) return;
  gpsLoaded = true;
  for (const r of db.prepare('SELECT path, lat, lon FROM photo_gps').all() as Array<{ path: string; lat: number | null; lon: number | null }>) {
    gpsCache.set(r.path, { lat: r.lat, lon: r.lon });
  }
}
const saveGps = db.prepare('INSERT OR REPLACE INTO photo_gps (path, lat, lon, read_at) VALUES (?, ?, ?, ?)');

/** The photo's GPS, if it has any (null lat/lon when it doesn't). Read from the file once. */
export async function getPhotoGps(absolutePath: string): Promise<{ lat: number | null; lon: number | null }> {
  loadGps();
  const key = rel(absolutePath);
  const hit = gpsCache.get(key);
  if (hit) return hit;
  let out: { lat: number | null; lon: number | null } = { lat: null, lon: null };
  try {
    const g = await exifr.gps(absolutePath);
    const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
    // 0,0 is a phone that saved "no fix" — not the middle of the ocean.
    if (g && ok(g.latitude) && ok(g.longitude) && !(g.latitude === 0 && g.longitude === 0) && Math.abs(g.latitude) <= 90 && Math.abs(g.longitude) <= 180) {
      out = { lat: Math.round(g.latitude * 1e6) / 1e6, lon: Math.round(g.longitude * 1e6) / 1e6 };
    }
  } catch {
    // No EXIF (PNG, screenshot, stripped by a messaging app) — no GPS.
  }
  gpsCache.set(key, out);
  saveGps.run(key, out.lat, out.lon, new Date().toISOString());
  return out;
}
/** Already read? (Without reading the file.) */
export function knownGps(relPath: string): { lat: number | null; lon: number | null } | undefined {
  loadGps();
  return gpsCache.get(relPath);
}

// ---- What a family member set by hand ----

export interface PlaceEdit {
  path: string;
  country: string | null;
  country_code: string | null;
  state: string | null;
  year: number | null;
  month: number | null;
  updated_at: string;
  updated_by: string | null;
}
const edits = new Map<string, PlaceEdit>();
let editsLoaded = false;
export function placeEdit(relPath: string): PlaceEdit | undefined {
  if (!editsLoaded) {
    editsLoaded = true;
    for (const r of db.prepare('SELECT * FROM photo_place_edits').all() as PlaceEdit[]) edits.set(r.path, r);
  }
  return edits.get(relPath);
}
export function savePlaceEdit(e: PlaceEdit) {
  db.prepare(
    `INSERT INTO photo_place_edits (path, country, country_code, state, year, month, updated_at, updated_by)
     VALUES (@path, @country, @country_code, @state, @year, @month, @updated_at, @updated_by)
     ON CONFLICT(path) DO UPDATE SET country = @country, country_code = @country_code, state = @state, year = @year, month = @month,
       updated_at = @updated_at, updated_by = @updated_by`
  ).run(e);
  placeEdit(e.path);
  edits.set(e.path, e);
}

/** A hand-set year (and month) moves the date the photo says it was taken — everywhere (sorting, On this day, movies). */
export function withDateFix(absolutePath: string, date: Date): Date {
  const e = placeEdit(rel(absolutePath));
  if (!e?.year) return date;
  const d = new Date(date);
  d.setFullYear(e.year);
  if (e.month) d.setMonth(e.month - 1);
  return d;
}

/** Everything about where a photo was taken: hand-set first, else from its GPS. */
export function placeOf(relPath: string) {
  const gps = knownGps(relPath);
  const e = placeEdit(relPath);
  const fromGps = gps?.lat != null && gps.lon != null ? placeAt(gps.lat, gps.lon) : null;
  const handSet = Boolean(e && (e.country || e.state));
  const country = handSet ? e!.country : fromGps?.country ?? null;
  const state = handSet ? e!.state : fromGps?.state ?? null;
  return {
    lat: gps?.lat ?? null,
    lon: gps?.lon ?? null,
    gps_read: gps !== undefined,
    country,
    country_code: handSet ? e!.country_code : fromGps?.country_code ?? null,
    state,
    place_source: handSet ? ('set' as const) : fromGps?.country ? ('gps' as const) : null,
    year_fixed: e?.year ?? null,
    month_fixed: e?.month ?? null,
  };
}
