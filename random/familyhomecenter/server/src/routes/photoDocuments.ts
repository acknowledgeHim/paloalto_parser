import { Router } from 'express';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { listPhotos, photoIdFor } from '../services/photos.js';
import { canManageOwnedItem, sessionMemberId, SESSION_COOKIE_NAME } from '../services/auth.js';
import { buildPhotoDocument, type DocumentContent, type DocumentSection } from '../services/photoDocument.js';

// Photo documents: a title plus sections (heading, text, pictures with captions), downloaded as a
// .docx built fresh each time (services/photoDocument.ts). Anyone can view/download; only whoever
// made one, or a parent, can edit or delete it (canManageOwnedItem — same rule as movies). Read-only
// against PHOTOS_DIR throughout.
export const photoDocumentsRouter = Router();

interface DocumentRow {
  id: string;
  title: string;
  content: string;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

const LIMITS = { sections: 100, photos: 1000, title: 200, heading: 200, text: 50_000, caption: 2_000 };

function parseContent(raw: string): DocumentContent {
  try {
    const parsed = JSON.parse(raw) as DocumentContent;
    return Array.isArray(parsed.sections) ? parsed : { sections: [] };
  } catch {
    return { sections: [] };
  }
}

function getRow(id: string): DocumentRow | undefined {
  return db.prepare('SELECT * FROM photo_documents WHERE id = ?').get(id) as DocumentRow | undefined;
}

function summary(row: DocumentRow) {
  const content = parseContent(row.content);
  return {
    id: row.id,
    title: row.title,
    created_by_id: row.created_by_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    section_count: content.sections.length,
    photo_count: content.sections.reduce((n, s) => n + s.photos.length, 0),
  };
}

/** A path relative to PHOTOS_DIR that doesn't climb out of it. */
function isSafeRelative(p: string): boolean {
  if (!p || path.isAbsolute(p)) return false;
  const resolved = path.resolve(config.photosDir, p);
  return resolved.startsWith(path.resolve(config.photosDir) + path.sep);
}

/**
 * Validates a create/update body. Pictures come from the client as photo ids (what the photo grid
 * uses); they're stored as paths relative to PHOTOS_DIR so they survive anything id-related. A
 * picture that's since gone missing comes back with only its stored path, which is kept as-is.
 */
async function parseBody(body: Record<string, unknown>): Promise<{ title: string; content: DocumentContent } | string> {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return 'Give the document a title';
  if (title.length > LIMITS.title) return 'Title is too long';
  if (!Array.isArray(body.sections)) return 'sections must be a list';
  if (body.sections.length > LIMITS.sections) return `At most ${LIMITS.sections} sections`;

  const pathById = new Map((await listPhotos()).map((abs) => [photoIdFor(abs), path.relative(config.photosDir, abs)]));
  const sections: DocumentSection[] = [];
  let photoTotal = 0;
  for (const raw of body.sections as Array<Record<string, unknown>>) {
    const heading = typeof raw?.heading === 'string' ? raw.heading.trim() : '';
    const text = typeof raw?.text === 'string' ? raw.text : '';
    if (heading.length > LIMITS.heading) return 'A section heading is too long';
    if (text.length > LIMITS.text) return "A section's text is too long";
    const columns = [1, 2, 3].includes(Number(raw?.columns)) ? (Number(raw.columns) as 1 | 2 | 3) : 2;
    const photos: DocumentSection['photos'] = [];
    for (const p of Array.isArray(raw?.photos) ? (raw.photos as Array<Record<string, unknown>>) : []) {
      const caption = typeof p?.caption === 'string' ? p.caption : '';
      if (caption.length > LIMITS.caption) return 'A caption is too long';
      const byId = typeof p?.id === 'string' ? pathById.get(p.id) : undefined;
      const kept = typeof p?.path === 'string' && isSafeRelative(p.path) ? p.path : undefined;
      const rel = byId ?? kept;
      if (!rel) continue; // unknown picture — drop it
      photos.push({ path: rel, caption });
    }
    photoTotal += photos.length;
    sections.push({ heading, text, columns, photos });
  }
  if (photoTotal > LIMITS.photos) return `At most ${LIMITS.photos} pictures per document`;
  return { title, content: { sections } };
}

photoDocumentsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM photo_documents ORDER BY updated_at DESC').all() as DocumentRow[];
  res.json(rows.map(summary));
});

/** GET /:id — the full document for the editor, with each picture's current photo id (null if it's
 *  no longer in the library). */
photoDocumentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = getRow(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    const existing = new Set(await listPhotos());
    const content = parseContent(row.content);
    res.json({
      ...summary(row),
      sections: content.sections.map((s) => ({
        ...s,
        photos: s.photos.map((p) => {
          const abs = path.join(config.photosDir, p.path);
          return { ...p, id: existing.has(abs) ? photoIdFor(abs) : null };
        }),
      })),
    });
  })
);

photoDocumentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = await parseBody(req.body);
    if (typeof parsed === 'string') return res.status(400).json({ error: parsed });
    const claimed = (req.body as { created_by_id?: string | null }).created_by_id ?? null;
    let createdBy = sessionMemberId(req.cookies?.[SESSION_COOKIE_NAME]) ?? claimed;
    if (createdBy && !db.prepare('SELECT 1 FROM family_members WHERE id = ?').get(createdBy)) createdBy = null;
    const now = new Date().toISOString();
    const row: DocumentRow = {
      id: uuidv4(),
      title: parsed.title,
      content: JSON.stringify(parsed.content),
      created_by_id: createdBy,
      created_at: now,
      updated_at: now,
    };
    db.prepare(
      `INSERT INTO photo_documents (id, title, content, created_by_id, created_at, updated_at)
       VALUES (@id, @title, @content, @created_by_id, @created_at, @updated_at)`
    ).run(row);
    res.status(201).json(summary(row));
  })
);

photoDocumentsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = getRow(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    if (!canManageOwnedItem(req.cookies?.[SESSION_COOKIE_NAME], row.created_by_id)) {
      return res.status(401).json({ error: 'Only whoever made this document, or a parent, can change it' });
    }
    const parsed = await parseBody(req.body);
    if (typeof parsed === 'string') return res.status(400).json({ error: parsed });
    const updated: DocumentRow = { ...row, title: parsed.title, content: JSON.stringify(parsed.content), updated_at: new Date().toISOString() };
    db.prepare('UPDATE photo_documents SET title = @title, content = @content, updated_at = @updated_at WHERE id = @id').run(updated);
    res.json(summary(updated));
  })
);

photoDocumentsRouter.delete('/:id', (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (!canManageOwnedItem(req.cookies?.[SESSION_COOKIE_NAME], row.created_by_id)) {
    return res.status(401).json({ error: 'Only whoever made this document, or a parent, can delete it' });
  }
  db.prepare('DELETE FROM photo_documents WHERE id = ?').run(row.id);
  res.status(204).end();
});

/** "Summer 2026" → "Summer 2026.docx", minus characters Windows/macOS won't take in a filename. */
function downloadName(title: string): string {
  return `${title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'document'}.docx`;
}

/** GET /:id/download — builds the .docx now from the saved document. */
photoDocumentsRouter.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const row = getRow(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    const creator = row.created_by_id
      ? (db.prepare('SELECT name FROM family_members WHERE id = ?').get(row.created_by_id) as { name: string } | undefined)?.name
      : undefined;
    const date = new Date(row.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const buffer = await buildPhotoDocument({
      title: row.title,
      byline: creator ? `By ${creator} · ${date}` : date,
      content: parseContent(row.content),
    });
    const name = downloadName(row.title);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    // filename* carries the real (possibly non-ASCII) name; filename is a plain-ASCII fallback.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`
    );
    res.send(buffer);
  })
);
