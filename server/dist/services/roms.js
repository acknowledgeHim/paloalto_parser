/*
 * Family Home Center — Copyright (c) 2026 the Family Home Center authors.
 * All rights reserved. Proprietary and confidential; see the LICENSE file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
/** default 💎 price for a newly added classic game (a parent can change it in ⚙️ What each game costs) */
export const ROM_DEFAULT_STARS = 15;
const SYSTEM_EMOJI = { nes: '🎮', snes: '👾' };
const SYSTEM_NAME = { nes: 'NES', snes: 'SNES' };
/** which EmulatorJS core each system uses (self-hosted under /emulatorjs/data/cores/) */
export const SYSTEM_CORE = { nes: 'nes', snes: 'snes' };
/** iNES header — every real .nes file starts with these bytes */
const INES_MAGIC = Buffer.from([0x4e, 0x45, 0x53, 0x1a]); // "NES\x1a"
/**
 * Work out which system a file is for, or null if it's not one we support. .nes must have the real
 * iNES header; .sfc/.smc are SNES (no reliable magic, so we go by extension + a size sanity check).
 */
export function detectSystem(filename, buf) {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.nes')
        return buf.length > 16 && buf.subarray(0, 4).equals(INES_MAGIC) ? 'nes' : null;
    if (ext === '.sfc' || ext === '.smc')
        return buf.length > 16 * 1024 ? 'snes' : null;
    return null;
}
/** file extensions a parent can upload */
export const ROM_EXTENSIONS = ['.nes', '.sfc', '.smc'];
function rowToRom(r) {
    return r;
}
export function listRoms(includeArchived = false) {
    const where = includeArchived ? '' : 'WHERE hidden = 0';
    return db.prepare(`SELECT * FROM game_roms ${where} ORDER BY sort, title COLLATE NOCASE`).all().map(rowToRom);
}
export function romById(id) {
    const r = db.prepare('SELECT * FROM game_roms WHERE id = ?').get(id);
    return r ? rowToRom(r) : undefined;
}
export const romFilePath = (r) => path.join(config.romsDir, r.file);
/** Save a ROM's bytes (already validated) and record it. The on-disk name is the id, so titles can repeat. */
export function addRom(bytes, originalName, system = 'nes') {
    fs.mkdirSync(config.romsDir, { recursive: true });
    const id = randomUUID();
    const ext = path.extname(originalName).toLowerCase() || '.nes';
    const file = `${id}${ext}`;
    fs.writeFileSync(path.join(config.romsDir, file), bytes, { flag: 'wx' });
    const title = cleanTitle(originalName);
    const nextSort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM game_roms').get().n;
    db.prepare('INSERT INTO game_roms (id, file, title, system, size, hidden, sort, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)').run(id, file, title, system, bytes.length, nextSort, new Date().toISOString());
    return romById(id);
}
/** Title from a filename: drop the extension, turn _ and - into spaces, tidy whitespace. */
function cleanTitle(name) {
    return (path
        .basename(name, path.extname(name))
        .replace(/[_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || 'Classic game');
}
export function updateRom(id, patch) {
    const r = romById(id);
    if (!r)
        return undefined;
    const title = patch.title !== undefined ? patch.title.trim().slice(0, 80) || r.title : r.title;
    const hidden = patch.hidden !== undefined ? (patch.hidden ? 1 : 0) : r.hidden;
    const sort = patch.sort !== undefined && Number.isFinite(patch.sort) ? Math.round(patch.sort) : r.sort;
    db.prepare('UPDATE game_roms SET title = ?, hidden = ?, sort = ? WHERE id = ?').run(title, hidden, sort, id);
    return romById(id);
}
/** A ROM as a Game (id `rom:<id>`), so the games routes treat it like any other game. */
export function romToGame(r) {
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
export const romGames = () => listRoms(false).map(romToGame);
/** Look up one classic game by its full `rom:<id>` game id. */
export function romGame(fullId) {
    if (!fullId.startsWith('rom:'))
        return undefined;
    const r = romById(fullId.slice(4));
    return r ? romToGame(r) : undefined;
}
