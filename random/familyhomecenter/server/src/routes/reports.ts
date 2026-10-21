import { Router } from 'express';
import { db } from '../db.js';
import { addDays, todayStr } from '../utils/recurrence.js';
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

/**
 * GET /family-week — 🎞️ the weekly family recap: everyone's week (jobs done, stars and money
 * earned, prizes), plus the family's gratitude slips, meals picked by vote and heights measured.
 */
reportsRouter.get('/family-week', (_req, res) => {
  const end = todayStr();
  const start = addDays(end, -6);
  const since = `${start}T00:00:00`;
  const members = db.prepare('SELECT * FROM family_members ORDER BY sort_order, created_at').all() as FamilyMember[];
  const people = members
    .map((m) => {
      const r = buildWeeklyReport(m, end);
      return {
        id: m.id,
        done: r.done,
        total: r.total,
        days: r.days,
        stars: r.starsEarned,
        money: r.moneyEarned,
        prizes: r.prizes,
        rewards: r.rewards,
        top: r.doneTitles.slice(0, 3),
      };
    })
    .filter((p) => p.total > 0 || p.prizes.length);
  const gratitude = db
    .prepare(`SELECT family_member_id, text FROM journal_entries WHERE kind = 'gratitude' AND hidden_at IS NULL AND date >= ? AND text IS NOT NULL ORDER BY created_at`)
    .all(start);
  const meals = db
    .prepare(
      `SELECT o.title, o.emoji, p.date FROM meal_polls p JOIN meal_poll_options o ON o.id = p.winner_option_id
       WHERE p.closed_at IS NOT NULL AND p.date >= ? AND p.date <= ? ORDER BY p.date`
    )
    .all(start, end);
  const heights = db
    .prepare('SELECT family_member_id, inches, date FROM heights WHERE hidden_at IS NULL AND date >= ? ORDER BY date')
    .all(start);
  const journalDays = (
    db.prepare(`SELECT COUNT(*) AS n FROM journal_entries WHERE kind = 'journal' AND hidden_at IS NULL AND created_at >= ?`).get(since) as { n: number }
  ).n;
  res.json({ start, end, people, gratitude, meals, heights, journalDays });
});
