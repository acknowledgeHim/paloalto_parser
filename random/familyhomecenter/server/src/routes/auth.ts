import { Router } from 'express';
import { db } from '../db.js';
import {
  isAdminPasswordConfigured,
  isAdminGateActive,
  isRequestAdmin,
  verifyLegacyAdminPassword,
  verifyMemberPassword,
  createSession,
  deleteSession,
  pruneExpiredSessions,
  sessionMemberId,
  isSessionValid,
  SESSION_COOKIE_NAME,
} from '../services/auth.js';

export const authRouter = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

/** GET /api/auth/status — who (if anyone) is verified in this browser, and whether that grants admin rights. */
authRouter.get('/status', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const valid = isSessionValid(token);
  res.json({
    member_id: valid ? sessionMemberId(token) : null,
    is_admin: isRequestAdmin(token),
    admin_gate_active: isAdminGateActive(),
    legacy_recovery_available: isAdminPasswordConfigured(),
  });
});

/**
 * POST /api/auth/login
 * Either { family_member_id, password } to log in as a specific person, or { password } alone
 * to use the legacy household recovery password (see docs/SETTINGS_LOGIN.md).
 */
authRouter.post('/login', (req, res) => {
  const { family_member_id, password } = req.body as { family_member_id?: string; password?: string };

  if (family_member_id) {
    const member = db.prepare('SELECT id, password_hash FROM family_members WHERE id = ?').get(family_member_id) as
      | { id: string; password_hash: string | null }
      | undefined;
    if (!member || !member.password_hash) return res.status(400).json({ error: 'That person has no password set' });
    if (!verifyMemberPassword(password ?? '', member.password_hash)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    pruneExpiredSessions();
    const { token } = createSession(member.id);
    res.cookie(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
    return res.json({ ok: true, member_id: member.id });
  }

  if (!isAdminPasswordConfigured()) return res.status(400).json({ error: 'No recovery password is configured' });
  if (!verifyLegacyAdminPassword(password ?? '')) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  pruneExpiredSessions();
  const { token } = createSession(null);
  res.cookie(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
  res.json({ ok: true, member_id: null });
});

authRouter.post('/logout', (req, res) => {
  deleteSession(req.cookies?.[SESSION_COOKIE_NAME]);
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).end();
});
