import { Router } from 'express';
import {
  isAdminPasswordConfigured,
  isSessionValid,
  verifyPassword,
  createSession,
  deleteSession,
  pruneExpiredSessions,
  SESSION_COOKIE_NAME,
} from '../services/auth.js';

export const authRouter = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

authRouter.get('/status', (req, res) => {
  const configured = isAdminPasswordConfigured();
  res.json({
    configured,
    authenticated: configured ? isSessionValid(req.cookies?.[SESSION_COOKIE_NAME]) : true,
  });
});

authRouter.post('/login', (req, res) => {
  if (!isAdminPasswordConfigured()) return res.json({ ok: true });
  if (!verifyPassword(req.body?.password ?? '')) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  pruneExpiredSessions();
  const { token } = createSession();
  res.cookie(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
  res.json({ ok: true });
});

authRouter.post('/logout', (req, res) => {
  deleteSession(req.cookies?.[SESSION_COOKIE_NAME]);
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).end();
});
