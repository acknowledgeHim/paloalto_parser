import { Router } from 'express';
import { db, setSetting } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { activities, activityOf, addTime, cleanLimits, readLimits, status, tryStart } from '../services/dailyLimits.js';
import { isParentRequest, isSelfOrParent } from '../services/rewards.js';
/** ⏰ Daily limits (services/dailyLimits.ts): what a parent set per kid, and how much is used today. */
export const limitsRouter = Router();
const memberOf = (id) => db.prepare('SELECT id, is_parent FROM family_members WHERE id = ?').get(id);
/** GET /settings → { activities, limits: { memberId: { activity: { times, minutes } } } } */
limitsRouter.get('/settings', (_req, res) => res.json({ activities: activities(), limits: readLimits() }));
/** PUT /settings/:memberId { limits: { activity: { times, minutes } }, acting_member_id } — parents. */
limitsRouter.put('/settings/:memberId', requireAdmin, (req, res) => {
    if (!isParentRequest(req, req.body?.acting_member_id))
        return res.status(403).json({ error: 'Only a parent can set limits' });
    const m = memberOf(req.params.memberId);
    if (!m)
        return res.status(404).json({ error: 'not found' });
    if (m.is_parent)
        return res.status(400).json({ error: 'Limits are for kids' });
    const all = readLimits();
    all[m.id] = cleanLimits(req.body?.limits);
    setSetting('daily_limits', JSON.stringify(all));
    res.json({ activities: activities(), limits: all });
});
/** GET /:memberId[?activity=] → today's use and limits for each activity (or just that one). */
limitsRouter.get('/:memberId', (req, res) => {
    const m = memberOf(req.params.memberId);
    if (!m)
        return res.status(404).json({ error: 'not found' });
    const one = typeof req.query.activity === 'string' ? req.query.activity : null;
    if (one) {
        const s = status(m.id, one);
        return s ? res.json(s) : res.status(404).json({ error: 'No such activity' });
    }
    res.json(activities().map((a) => status(m.id, a.id)));
});
/** POST /:memberId/start { activity, acting_member_id } — starting one (a lesson): counted, or 429 with why not. */
limitsRouter.post('/:memberId/start', (req, res) => {
    const m = memberOf(req.params.memberId);
    const activity = String(req.body?.activity ?? '');
    if (!m || !activityOf(activity))
        return res.status(404).json({ error: 'not found' });
    if (!isSelfOrParent(req, m.id, req.body?.acting_member_id))
        return res.status(403).json({ error: "That's someone else's" });
    const why = tryStart(m.id, activity);
    if (why)
        return res.status(429).json({ error: why, limit: true });
    res.json(status(m.id, activity));
});
/** POST /:memberId/beat { activity, seconds, acting_member_id } — the screen is in use (every 30 s). */
limitsRouter.post('/:memberId/beat', (req, res) => {
    const m = memberOf(req.params.memberId);
    const activity = String(req.body?.activity ?? '');
    if (!m || !activityOf(activity))
        return res.status(404).json({ error: 'not found' });
    if (!isSelfOrParent(req, m.id, req.body?.acting_member_id))
        return res.status(403).json({ error: "That's someone else's" });
    addTime(m.id, activity, Number(req.body?.seconds) || 0);
    res.json(status(m.id, activity));
});
