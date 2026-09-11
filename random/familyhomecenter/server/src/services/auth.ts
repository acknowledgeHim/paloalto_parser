import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';

const SESSION_COOKIE = 'fhc_admin_session';
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — a home kiosk, not a bank

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

export function isAdminPasswordConfigured(): boolean {
  return config.admin.password.length > 0;
}

/** Constant-time comparison so a wrong guess can't be timed to learn how many characters matched. */
export function verifyPassword(candidate: string): boolean {
  const expected = Buffer.from(config.admin.password);
  const given = Buffer.from(candidate ?? '');
  if (expected.length !== given.length) {
    // Still do a comparison of *some* buffer so failure timing doesn't leak the length either.
    crypto.timingSafeEqual(expected, expected);
    return false;
  }
  return crypto.timingSafeEqual(expected, given);
}

export function createSession(): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  db.prepare('INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)').run(token, expiresAt.toISOString());
  return { token, expiresAt };
}

export function isSessionValid(token: string | undefined): boolean {
  if (!token) return false;
  const row = db.prepare('SELECT expires_at FROM admin_sessions WHERE token = ?').get(token) as
    | { expires_at: string }
    | undefined;
  if (!row) return false;
  return new Date(row.expires_at).getTime() > Date.now();
}

export function deleteSession(token: string | undefined): void {
  if (!token) return;
  db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
}

/** Best-effort housekeeping so admin_sessions doesn't grow forever; call occasionally, not per-request. */
export function pruneExpiredSessions(): void {
  db.prepare("DELETE FROM admin_sessions WHERE expires_at <= datetime('now')").run();
}
