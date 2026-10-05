import { Router } from 'express';
import { db, getSetting, setSetting } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

// Which parts of the app each kid can currently use — a parent turns sections off (e.g. "no movie
// making this week") and back on later. Parents always see everything. "guest" covers the
// dashboard when nobody's picked in the profile switcher, so a kid can't sidestep their limits by
// un-picking themselves. Enforced by the app's screens (client/src/state/SectionAccess.tsx) — with
// passwords on the kids' profiles, a kid can't switch to a sibling's either (docs/SETTINGS_LOGIN.md).
export const accessRouter = Router();

/** Every section that can be turned off. Home is always on. Keep in sync with
 *  client/src/utils/sections.ts. */
export const SECTION_KEYS = [
  'calendar',
  'tasks',
  'meals',
  'contacts',
  'knowledge-base',
  'prizes',
  'board',
  'music',
  'photos',
  'movies',
  'documents',
  'intercom',
  'internet',
] as const;

const SETTING_KEY = 'section_access';

/** { [member id | 'guest']: allowed section keys } — a missing entry means everything. */
type AccessMap = Record<string, string[]>;

function readAccess(): AccessMap {
  try {
    const raw = getSetting(SETTING_KEY, '');
    return raw ? (JSON.parse(raw) as AccessMap) : {};
  } catch {
    return {};
  }
}

/** GET / — everyone's current access, for the screens to apply (open: it's not secret, and a kid's
 *  own screen needs it). */
accessRouter.get('/', (_req, res) => {
  res.json({ sections: SECTION_KEYS, access: readAccess() });
});

/** PUT /:target { sections: string[] | null } — target is a family member id or "guest"; null (or
 *  every section) = everything again. Parent-only. */
accessRouter.put('/:target', requireAdmin, (req, res) => {
  const target = req.params.target;
  if (target !== 'guest') {
    const member = db.prepare('SELECT is_parent FROM family_members WHERE id = ?').get(target) as { is_parent: number } | undefined;
    if (!member) return res.status(404).json({ error: 'Unknown family member' });
    if (member.is_parent) return res.status(400).json({ error: 'Parents always have access to everything' });
  }
  const { sections } = req.body as { sections?: unknown };
  const access = readAccess();
  if (sections === null || (Array.isArray(sections) && SECTION_KEYS.every((k) => sections.includes(k)))) {
    delete access[target];
  } else if (Array.isArray(sections)) {
    access[target] = SECTION_KEYS.filter((k) => sections.includes(k));
  } else {
    return res.status(400).json({ error: 'sections must be a list, or null for everything' });
  }
  setSetting(SETTING_KEY, JSON.stringify(access));
  res.json({ sections: SECTION_KEYS, access });
});
