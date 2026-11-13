/*
 * Family Home Center — Copyright (c) 2026 the Family Home Center authors.
 * All rights reserved. Proprietary and confidential; see the LICENSE file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import type { Game } from './games.js';

/**
 * 🎮 Classic games: .nes (and later other) ROM files a parent uploads and the kids play in the browser
 * (EmulatorJS, self-hosted). Each ROM shows up in 🎮 Games as its own game, so it rides the same 💎
 * token economy as the built-in games — a parent sets its price and show/hide, kids unlock/buy plays.
 * Files live in config.romsDir and are NEVER deleted (removing one just archives it from the list).
 */

export type RomSystem = 'nes' | 'snes';
export interface Rom {
  id: string;
  file: string;
  title: string;
  system: RomSystem;
  size: number;
  /** archived = parent removed it from the list (the file is kept) */
  hidden: number;
  sort: number;
  created_at: string;
}

/** default 💎 price for a newly added classic game (a parent can change it in ⚙️ What each game costs) */
export const ROM_DEFAULT_STARS = 15;
const SYSTEM_EMOJI: Record<RomSystem, string> = { nes: '🎮', snes: '👾' };
const SYSTEM_NAME: Record<RomSystem, string> = { nes: 'NES', snes: 'SNES' };
/** which EmulatorJS core each system uses (self-hosted under /emulatorjs/data/cores/) */
export const SYSTEM_CORE: Record<RomSystem, string> = { nes: 'nes', snes: 'snes' };
/** iNES header — every real .nes file starts with these bytes */
const INES_MAGIC = Buffer.from([0x4e, 0x45, 0x53, 0x1a]); // "NES\x1a"

/**
 * Work out which system a file is for, or null if it's not one we support. .nes must have the real
 * iNES header; .sfc/.smc are SNES (no reliable magic, so we go by extension + a size sanity check).
 */
export function detectSystem(filename: string, buf: Buffer): RomSystem | null {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.nes') return buf.length > 16 && buf.subarray(0, 4).equals(INES_MAGIC) ? 'nes' : null;
  if (ext === '.sfc' || ext === '.smc') return buf.length > 16 * 1024 ? 'snes' : null;
  return null;
}
/** file extensions a parent can upload */
export const ROM_EXTENSIONS = ['.nes', '.sfc', '.smc'];

function rowToRom(r: Record<string, unknown>): Rom {
  return r as unknown as Rom;
}

export function listRoms(includeArchived = false): Rom[] {
  const where = includeArchived ? '' : 'WHERE hidden = 0';
  return (db.prepare(`SELECT * FROM game_roms ${where} ORDER BY sort, title COLLATE NOCASE`).all() as Record<string, unknown>[]).map(rowToRom);
}

export function romById(id: string): Rom | undefined {
  const r = db.prepare('SELECT * FROM game_roms WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return r ? rowToRom(r) : undefined;
}

export const romFilePath = (r: Rom): string => path.join(config.romsDir, r.file);

/** Save a ROM's bytes (already validated) and record it. The on-disk name is the id, so titles can repeat. */
export function addRom(bytes: Buffer, originalName: string, system: RomSystem = 'nes'): Rom {
  fs.mkdirSync(config.romsDir, { recursive: true });
  const id = randomUUID();
  const ext = path.extname(originalName).toLowerCase() || '.nes';
  const file = `${id}${ext}`;
  fs.writeFileSync(path.join(config.romsDir, file), bytes, { flag: 'wx' });
  const title = cleanTitle(originalName);
  const nextSort = (db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM game_roms').get() as { n: number }).n;
  db.prepare('INSERT INTO game_roms (id, file, title, system, size, hidden, sort, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)').run(
    id,
    file,
    title,
    system,
    bytes.length,
    nextSort,
    new Date().toISOString()
  );
  return romById(id)!;
}

/** Title from a filename: drop the extension, turn _ and - into spaces, tidy whitespace. */
function cleanTitle(name: string): string {
  return (
    path
      .basename(name, path.extname(name))
      .replace(/[_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Classic game'
  );
}

export function updateRom(id: string, patch: { title?: string; hidden?: boolean; sort?: number }): Rom | undefined {
  const r = romById(id);
  if (!r) return undefined;
  const title = patch.title !== undefined ? patch.title.trim().slice(0, 80) || r.title : r.title;
  const hidden = patch.hidden !== undefined ? (patch.hidden ? 1 : 0) : r.hidden;
  const sort = patch.sort !== undefined && Number.isFinite(patch.sort) ? Math.round(patch.sort) : r.sort;
  db.prepare('UPDATE game_roms SET title = ?, hidden = ?, sort = ? WHERE id = ?').run(title, hidden, sort, id);
  return romById(id);
}

/** A ROM as a Game (id `rom:<id>`), so the games routes treat it like any other game. */
export function romToGame(r: Rom): Game {
  return {
    id: `rom:${r.id}`,
    emoji: SYSTEM_EMOJI[r.system] ?? '🎮',
    name: r.title,
    stars: ROM_DEFAULT_STARS,
    blurb: `Classic ${SYSTEM_NAME[r.system] ?? r.system.toUpperCase()} game`,
    minutesOnly: true, // an emulator just keeps running — daily limits are by minutes
  };
}

/** All classic games (not archived), newest-sorted, as Game objects for the shelf/rules. */
export const romGames = (): Game[] => listRoms(false).map(romToGame);

/** Look up one classic game by its full `rom:<id>` game id. */
export function romGame(fullId: string): Game | undefined {
  if (!fullId.startsWith('rom:')) return undefined;
  const r = romById(fullId.slice(4));
  return r ? romToGame(r) : undefined;
}
