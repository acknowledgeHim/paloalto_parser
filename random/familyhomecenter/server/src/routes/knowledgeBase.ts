import { Router, type RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { isAdminGateActive, isRequestAdmin, SESSION_COOKIE_NAME } from '../services/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { deleteKbMediaFile, saveKbImage, saveKbVideo } from '../services/kbMedia.js';
import type { KbArticle, KbMedia } from '../types.js';

// Viewing is open to everyone — this is exactly the kind of thing a kid needs read access to in
// an emergency ("how do I shut off the water"). Adding, editing, removing an article, and
// attaching/removing its media are all parent-only (requireAdmin): this is curated reference
// material, not an everyday list.
//
// 🔒 An article marked parents_only isn't sent to anyone else at all, nor are its pictures/videos
// (see kbMediaGate). Before any parent has a password there's no telling who's asking, so the
// server sends everything and the page hides them unless a parent is picked up top.
export const knowledgeBaseRouter = Router();

/** Whether this request may see parents-only articles. */
export function canSeeParentsOnly(cookie: string | undefined): boolean {
  return !isAdminGateActive() || isRequestAdmin(cookie);
}

/** Put before the static /api/kb-media files: a parents-only article's files 404 for everyone else. */
export const kbMediaGate: RequestHandler = (req, res, next) => {
  if (canSeeParentsOnly(req.cookies?.[SESSION_COOKIE_NAME])) return next();
  const fileName = decodeURIComponent(req.path.replace(/^\//, ''));
  const hidden = db
    .prepare('SELECT 1 FROM kb_media m JOIN kb_articles a ON a.id = m.article_id WHERE m.file_name = ? AND a.parents_only = 1')
    .get(fileName);
  if (hidden) return res.status(404).end();
  next();
};

function mediaFor(articleId: string): KbMedia[] {
  return db.prepare('SELECT * FROM kb_media WHERE article_id = ? ORDER BY sort_order ASC').all(articleId) as KbMedia[];
}

function fullArticle(article: KbArticle) {
  return { ...article, media: mediaFor(article.id) };
}

knowledgeBaseRouter.get('/', (req, res) => {
  const all = canSeeParentsOnly(req.cookies?.[SESSION_COOKIE_NAME]);
  const articles = db
    .prepare(`SELECT * FROM kb_articles ${all ? '' : 'WHERE parents_only = 0'} ORDER BY title COLLATE NOCASE ASC`)
    .all() as KbArticle[];
  res.json(articles.map(fullArticle));
});

knowledgeBaseRouter.post('/', requireAdmin, (req, res) => {
  const { title, category, body, created_by_id, parents_only } = req.body as Partial<KbArticle> & { created_by_id?: string };
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });

  const now = new Date().toISOString();
  const article: KbArticle = {
    id: uuidv4(),
    title: title.trim(),
    category: category?.trim() || null,
    body: body ?? null,
    parents_only: parents_only ? 1 : 0,
    created_by_id: created_by_id ?? null,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO kb_articles (id, title, category, body, parents_only, created_by_id, created_at, updated_at)
     VALUES (@id, @title, @category, @body, @parents_only, @created_by_id, @created_at, @updated_at)`
  ).run(article);
  res.status(201).json(fullArticle(article));
});

knowledgeBaseRouter.patch('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(req.params.id) as KbArticle | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });

  const { title, category, body, parents_only } = req.body as Partial<KbArticle>;
  const updated: KbArticle = {
    ...existing,
    title: title !== undefined ? title.trim() || existing.title : existing.title,
    category: category !== undefined ? category?.trim() || null : existing.category,
    body: body !== undefined ? body : existing.body,
    parents_only: parents_only !== undefined ? (parents_only ? 1 : 0) : existing.parents_only,
    updated_at: new Date().toISOString(),
  };
  db.prepare('UPDATE kb_articles SET title=@title, category=@category, body=@body, parents_only=@parents_only, updated_at=@updated_at WHERE id=@id').run(
    updated
  );
  res.json(fullArticle(updated));
});

knowledgeBaseRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const media = mediaFor(req.params.id);
    db.prepare('DELETE FROM kb_articles WHERE id = ?').run(req.params.id); // cascades kb_media rows
    await Promise.all(media.filter((m) => m.file_name).map((m) => deleteKbMediaFile(m.file_name!)));
    res.status(204).end();
  })
);

/**
 * POST /:id/media — attaches one picture/video to an article.
 * { kind: 'image', data_url } | { kind: 'video', data_url } | { kind: 'video_link', external_url }
 */
knowledgeBaseRouter.post(
  '/:id/media',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const article = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(req.params.id) as KbArticle | undefined;
    if (!article) return res.status(404).json({ error: 'not found' });

    const { kind, data_url, external_url } = req.body as { kind?: string; data_url?: string; external_url?: string };
    const id = uuidv4();
    const { max } = db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) as max FROM kb_media WHERE article_id = ?')
      .get(article.id) as { max: number };

    let media: KbMedia;
    if (kind === 'image') {
      if (!data_url) return res.status(400).json({ error: 'data_url is required for an image' });
      const fileName = await saveKbImage(id, data_url);
      media = { id, article_id: article.id, kind: 'image', file_name: fileName, external_url: null, sort_order: max + 1, created_at: new Date().toISOString() };
    } else if (kind === 'video') {
      if (!data_url) return res.status(400).json({ error: 'data_url is required for a video' });
      const fileName = await saveKbVideo(id, data_url);
      media = { id, article_id: article.id, kind: 'video', file_name: fileName, external_url: null, sort_order: max + 1, created_at: new Date().toISOString() };
    } else if (kind === 'video_link') {
      if (!external_url || !external_url.trim()) return res.status(400).json({ error: 'external_url is required' });
      media = { id, article_id: article.id, kind: 'video_link', file_name: null, external_url: external_url.trim(), sort_order: max + 1, created_at: new Date().toISOString() };
    } else {
      return res.status(400).json({ error: "kind must be 'image', 'video', or 'video_link'" });
    }

    db.prepare(
      `INSERT INTO kb_media (id, article_id, kind, file_name, external_url, sort_order, created_at)
       VALUES (@id, @article_id, @kind, @file_name, @external_url, @sort_order, @created_at)`
    ).run(media);
    res.status(201).json(media);
  })
);

knowledgeBaseRouter.delete(
  '/:id/media/:mediaId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const media = db.prepare('SELECT * FROM kb_media WHERE id = ? AND article_id = ?').get(req.params.mediaId, req.params.id) as
      | KbMedia
      | undefined;
    if (!media) return res.status(404).json({ error: 'not found' });
    db.prepare('DELETE FROM kb_media WHERE id = ?').run(media.id);
    if (media.file_name) await deleteKbMediaFile(media.file_name);
    res.status(204).end();
  })
);
