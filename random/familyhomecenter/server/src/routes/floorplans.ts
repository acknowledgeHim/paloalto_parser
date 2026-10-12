import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import type { Floorplan, FloorplanRoom } from '../types.js';

/**
 * Floor plans (Chores & Tasks → 🏠 By room): a picture of each floor (or the yard), with rooms
 * outlined on it. Chores/to-dos can be put in a room (tasks.room_id); the page shows each room's
 * jobs and who's doing them. Anyone can look; adding/changing plans and rooms is for parents.
 */
export const floorplansRouter = Router();

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,(.+)$/;
/** Plans are kept at most this big on their long side — plenty to read room labels on a TV. */
const MAX_SIDE = 3000;
const MAX_ROOMS_PER_PLAN = 60;
const ROOM_COLORS = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'];

const imagesDir = () => path.join(config.dataDir, 'floorplans');
const imagePath = (id: string) => path.join(imagesDir(), `${path.basename(id)}.webp`);

interface PlanRow extends Omit<Floorplan, 'rooms'> {}
interface RoomRow extends Omit<FloorplanRoom, 'points'> {
  points: string;
}

const toRoom = (r: RoomRow): FloorplanRoom => ({ ...r, points: JSON.parse(r.points) as Array<[number, number]> });

function plansWithRooms(): Floorplan[] {
  const plans = db.prepare('SELECT * FROM floorplans ORDER BY sort_order, created_at').all() as PlanRow[];
  const rooms = (db.prepare('SELECT * FROM floorplan_rooms ORDER BY created_at').all() as RoomRow[]).map(toRoom);
  return plans.map((p) => ({ ...p, rooms: rooms.filter((r) => r.floorplan_id === p.id) }));
}

/** Saves an uploaded picture as the plan's image; returns its size. */
async function saveImage(id: string, dataUrl: unknown): Promise<{ width: number; height: number }> {
  const match = typeof dataUrl === 'string' ? DATA_URL_RE.exec(dataUrl) : null;
  if (!match) throw Object.assign(new Error('Pick a picture (PNG, JPG, WebP, GIF or SVG) of the floor plan'), { status: 400 });
  await fs.mkdir(imagesDir(), { recursive: true });
  const tmp = `${imagePath(id)}.tmp`;
  const info = await sharp(Buffer.from(match[2], 'base64'), { density: 150 })
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }) // a see-through plan (SVG/PNG) on white, not black
    .webp({ quality: 90 })
    .toFile(tmp);
  await fs.rename(tmp, imagePath(id));
  return { width: info.width, height: info.height };
}

/** A room's outline from the client: 3–100 points, each clamped into the picture. */
function parsePoints(raw: unknown): Array<[number, number]> | null {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > 100) return null;
  const pts: Array<[number, number]> = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
    pts.push([Math.min(1, Math.max(0, p[0])), Math.min(1, Math.max(0, p[1]))]);
  }
  return pts;
}

const cleanName = (raw: unknown) => (typeof raw === 'string' ? raw.trim().slice(0, 60) : '');

floorplansRouter.get('/', (_req, res) => {
  res.json(plansWithRooms());
});

floorplansRouter.get(
  '/:id/image',
  asyncHandler(async (req, res) => {
    try {
      await fs.access(imagePath(req.params.id));
    } catch {
      return res.status(404).end();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(imagePath(req.params.id));
  })
);

/** POST / { name, imageDataUrl } — a new plan. */
floorplansRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Give the floor plan a name, like "Main floor" or "Yard"' });
    const id = uuidv4();
    let size;
    try {
      size = await saveImage(id, req.body?.imageDataUrl);
    } catch (err) {
      return res.status((err as { status?: number }).status ?? 400).json({ error: (err as Error).message });
    }
    const now = new Date().toISOString();
    const order = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM floorplans').get() as { n: number }).n;
    db.prepare(
      'INSERT INTO floorplans (id, name, width, height, sort_order, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, size.width, size.height, order, now, now);
    res.status(201).json(plansWithRooms().find((p) => p.id === id));
  })
);

/** PATCH /:id { name?, imageDataUrl?, move?: -1 | 1 } — rename, swap the picture (rooms stay where
 *  they are, as fractions of it), or move it left/right in the tabs. */
floorplansRouter.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const plan = db.prepare('SELECT * FROM floorplans WHERE id = ?').get(req.params.id) as PlanRow | undefined;
    if (!plan) return res.status(404).json({ error: 'not found' });
    const body = req.body as { name?: unknown; imageDataUrl?: unknown; move?: unknown };
    if (body.name !== undefined) {
      const name = cleanName(body.name);
      if (!name) return res.status(400).json({ error: 'The name can’t be empty' });
      db.prepare('UPDATE floorplans SET name = ? WHERE id = ?').run(name, plan.id);
    }
    if (body.imageDataUrl !== undefined) {
      try {
        const size = await saveImage(plan.id, body.imageDataUrl);
        db.prepare('UPDATE floorplans SET width = ?, height = ?, updated_at = ? WHERE id = ?').run(size.width, size.height, new Date().toISOString(), plan.id);
      } catch (err) {
        return res.status((err as { status?: number }).status ?? 400).json({ error: (err as Error).message });
      }
    }
    if (body.move === -1 || body.move === 1) {
      const ids = (db.prepare('SELECT id FROM floorplans ORDER BY sort_order, created_at').all() as Array<{ id: string }>).map((r) => r.id);
      const at = ids.indexOf(plan.id);
      const to = at + body.move;
      if (to >= 0 && to < ids.length) {
        [ids[at], ids[to]] = [ids[to], ids[at]];
        const set = db.prepare('UPDATE floorplans SET sort_order = ? WHERE id = ?');
        db.transaction(() => ids.forEach((id, i) => set.run(i, id)))();
      }
    }
    res.json(plansWithRooms().find((p) => p.id === plan.id));
  })
);

/** DELETE /:id — the plan and its rooms; chores in those rooms just lose their room. */
floorplansRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM floorplans WHERE id = ?').run(req.params.id);
    await fs.rm(imagePath(req.params.id), { force: true });
    res.status(204).end();
  })
);

/** POST /:id/rooms { name, points, color? } */
floorplansRouter.post('/:id/rooms', requireAdmin, (req, res) => {
  const plan = db.prepare('SELECT id FROM floorplans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'not found' });
  const name = cleanName(req.body?.name);
  const points = parsePoints(req.body?.points);
  if (!name) return res.status(400).json({ error: 'Give the room a name' });
  if (!points) return res.status(400).json({ error: 'Mark where the room is on the plan' });
  const count = (db.prepare('SELECT COUNT(*) AS n FROM floorplan_rooms WHERE floorplan_id = ?').get(req.params.id) as { n: number }).n;
  if (count >= MAX_ROOMS_PER_PLAN) return res.status(400).json({ error: `A plan can have up to ${MAX_ROOMS_PER_PLAN} rooms` });
  const color = typeof req.body?.color === 'string' && /^#[0-9a-f]{6}$/i.test(req.body.color) ? req.body.color : ROOM_COLORS[count % ROOM_COLORS.length];
  const room: RoomRow = { id: uuidv4(), floorplan_id: req.params.id, name, points: JSON.stringify(points), color, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO floorplan_rooms (id, floorplan_id, name, points, color, created_at) VALUES (@id, @floorplan_id, @name, @points, @color, @created_at)').run(room);
  res.status(201).json(toRoom(room));
});

/** PATCH /rooms/:roomId { name?, points?, color? } */
floorplansRouter.patch('/rooms/:roomId', requireAdmin, (req, res) => {
  const room = db.prepare('SELECT * FROM floorplan_rooms WHERE id = ?').get(req.params.roomId) as RoomRow | undefined;
  if (!room) return res.status(404).json({ error: 'not found' });
  const next = { ...room };
  if (req.body?.name !== undefined) {
    next.name = cleanName(req.body.name);
    if (!next.name) return res.status(400).json({ error: 'The name can’t be empty' });
  }
  if (req.body?.points !== undefined) {
    const points = parsePoints(req.body.points);
    if (!points) return res.status(400).json({ error: 'Mark where the room is on the plan' });
    next.points = JSON.stringify(points);
  }
  if (typeof req.body?.color === 'string' && /^#[0-9a-f]{6}$/i.test(req.body.color)) next.color = req.body.color;
  db.prepare('UPDATE floorplan_rooms SET name = @name, points = @points, color = @color WHERE id = @id').run(next);
  res.json(toRoom(next));
});

floorplansRouter.delete('/rooms/:roomId', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM floorplan_rooms WHERE id = ?').run(req.params.roomId);
  res.status(204).end();
});
