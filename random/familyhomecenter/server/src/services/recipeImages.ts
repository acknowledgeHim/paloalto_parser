import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { db } from '../db.js';
import { config } from '../config.js';

// Pictures for recipes imported from TheMealDB are kept on the Pi, so viewing saved recipes never
// makes a family member's browser load anything from TheMealDB (which would tell it your internet
// address and which recipe you were looking at). Only images from TheMealDB's own image host are
// ever fetched — this never fetches an arbitrary URL someone sends it.

const ALLOWED_HOST = 'www.themealdb.com';
const imagesDir = () => path.join(config.dataDir, 'recipe-images');

/** The real TheMealDB image URL behind a thumbnail_url (which may be our proxy link), or null if
 *  it isn't one we'll fetch. */
export function remoteRecipeImage(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url, 'http://local');
  } catch {
    return null;
  }
  if (u.pathname === '/api/recipes/online-image') return remoteRecipeImage(u.searchParams.get('u'));
  return u.protocol === 'https:' && u.hostname === ALLOWED_HOST ? u.toString() : null;
}

/** For online search results: our own link that proxies TheMealDB's image through the Pi. */
export function proxiedRecipeImage(url: string | null): string | null {
  const remote = remoteRecipeImage(url);
  return remote ? `/api/recipes/online-image?u=${encodeURIComponent(remote)}` : null;
}

export async function fetchRecipeImage(remote: string): Promise<Buffer> {
  const resp = await fetch(remote, { signal: AbortSignal.timeout(20_000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return sharp(Buffer.from(await resp.arrayBuffer())).resize({ width: 600, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
}

/** Downloads a recipe's picture into the app and points the recipe at the local copy. Returns the
 *  new thumbnail_url, or null (picture dropped) if it couldn't be fetched. */
export async function localizeRecipeImage(recipeId: string, remote: string): Promise<string | null> {
  try {
    const image = await fetchRecipeImage(remote);
    await fs.mkdir(imagesDir(), { recursive: true });
    await fs.writeFile(path.join(imagesDir(), `${recipeId}.jpg`), image);
    const local = `/api/recipes/${recipeId}/image`;
    db.prepare('UPDATE recipes SET thumbnail_url = ? WHERE id = ?').run(local, recipeId);
    return local;
  } catch (err) {
    console.warn(`[recipes] couldn't save the picture for ${recipeId}:`, (err as Error).message);
    db.prepare('UPDATE recipes SET thumbnail_url = NULL WHERE id = ?').run(recipeId);
    return null;
  }
}

export function localRecipeImagePath(recipeId: string): string {
  return path.join(imagesDir(), `${path.basename(recipeId)}.jpg`);
}

/** Startup: any recipe still pointing at a picture on another website gets a local copy (or, if
 *  it's not a TheMealDB picture, loses it — the app never shows images from elsewhere). */
export async function localizeExistingRecipeImages(): Promise<void> {
  const rows = db.prepare("SELECT id, thumbnail_url FROM recipes WHERE thumbnail_url LIKE 'http%'").all() as Array<{ id: string; thumbnail_url: string }>;
  for (const r of rows) {
    const remote = remoteRecipeImage(r.thumbnail_url);
    if (remote) await localizeRecipeImage(r.id, remote);
    else db.prepare('UPDATE recipes SET thumbnail_url = NULL WHERE id = ?').run(r.id);
  }
  if (rows.length) console.log(`[recipes] saved ${rows.length} recipe picture(s) locally.`);
}
