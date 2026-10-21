import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { buildWeeklyReport, renderWeeklyReport, sendWeeklyReports } from '../services/weeklyReport.js';
import type { FamilyMember } from '../types.js';

/** 📬 The weekly report: see it in the browser, or send it now. */
export const reportsRouter = Router();

/** GET /weekly/:memberId — this week's report as a page (what the email looks like). */
reportsRouter.get('/weekly/:memberId', (req, res) => {
  const member = db.prepare('SELECT * FROM family_members WHERE id = ?').get(req.params.memberId) as FamilyMember | undefined;
  if (!member) return res.status(404).json({ error: 'not found' });
  const { subject, html } = renderWeeklyReport(buildWeeklyReport(member));
  res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${subject.replace(/</g, '&lt;')}</title><body style="margin:16px">${html}</body>`);
});

/** POST /weekly/send { family_member_id? } — parents: send it now (everyone, or one kid). */
reportsRouter.post(
  '/weekly/send',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ message: await sendWeeklyReports(req.body?.family_member_id || undefined) });
  })
);
