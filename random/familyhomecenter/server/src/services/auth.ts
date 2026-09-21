import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';

const SESSION_COOKIE = 'fhc_session';
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — a home kiosk, not a bank
const SCRYPT_KEYLEN = 64;

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

// ---- Per-family-member passwords ----
// Stored as "<saltHex>:<hashHex>" — scrypt, not a shipped dependency, same approach used
// elsewhere in Node for password hashing without adding bcrypt/argon2 as a dependency.

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyMemberPassword(password: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const given = crypto.scryptSync(password ?? '', salt, SCRYPT_KEYLEN);
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

// ---- Legacy single household password (ADMIN_PASSWORD env var) ----
// Kept as a recovery path so a forgotten per-parent password can't lock everyone out of
// Settings — see docs/SETTINGS_LOGIN.md.

export function isAdminPasswordConfigured(): boolean {
  return config.admin.password.length > 0;
}

function anyParentHasPassword(): boolean {
  const row = db
    .prepare('SELECT 1 FROM family_members WHERE is_parent = 1 AND password_hash IS NOT NULL LIMIT 1')
    .get();
  return row !== undefined;
}

/** Is there anything at all configured to protect admin actions? (Same "optional, off by default" pattern as the rest of the app.) */
export function isAdminGateActive(): boolean {
  return isAdminPasswordConfigured() || anyParentHasPassword();
}

/** Constant-time comparison so a wrong guess can't be timed to learn how many characters matched. */
export function verifyLegacyAdminPassword(candidate: string): boolean {
  const expected = Buffer.from(config.admin.password);
  const given = Buffer.from(candidate ?? '');
  if (expected.length !== given.length) {
    crypto.timingSafeEqual(expected, expected);
    return false;
  }
  return crypto.timingSafeEqual(expected, given);
}

// ---- Sessions ----
// A session is either tied to a specific family member (they entered their own password) or,
// for the legacy recovery path, to no one in particular (family_member_id is NULL).

export function createSession(familyMemberId: string | null): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  db.prepare('INSERT INTO admin_sessions (token, family_member_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    familyMemberId,
    expiresAt.toISOString()
  );
  return { token, expiresAt };
}

interface SessionRow {
  family_member_id: string | null;
  expires_at: string;
}

function getValidSession(token: string | undefined): SessionRow | null {
  if (!token) return null;
  const row = db.prepare('SELECT family_member_id, expires_at FROM admin_sessions WHERE token = ?').get(token) as
    | SessionRow
    | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row;
}

/** True for a valid session of any kind (a specific family member, or the legacy recovery login). */
export function isSessionValid(token: string | undefined): boolean {
  return getValidSession(token) !== null;
}

/** The verified family member for this session, or null (no session, expired, or a legacy recovery session). */
export function sessionMemberId(token: string | undefined): string | null {
  return getValidSession(token)?.family_member_id ?? null;
}

/** Does this session currently grant admin/parent rights? (Legacy recovery login, or a parent's own login.) */
export function isRequestAdmin(token: string | undefined): boolean {
  const session = getValidSession(token);
  if (!session) return false;
  if (!session.family_member_id) return true; // legacy recovery login
  const member = db.prepare('SELECT is_parent FROM family_members WHERE id = ?').get(session.family_member_id) as
    | { is_parent: 0 | 1 }
    | undefined;
  return member?.is_parent === 1;
}

// ---- Bank access (per-kid privacy) ----
// Unlike most everyday permissions in this app (task edit/delete — see utils/tasks.ts's
// canEditTask comment), bank data is explicitly supposed to be private to one kid + parents, so
// this gets a real session-based check, same spirit as requireAdmin. It only activates once
// there's actually a password to check against — either this specific member's own, or any
// parent's — so a family that hasn't set up logins yet keeps the same open, household-trust
// behavior as everything else, and a parent can always reach a passwordless kid's bank.
function bankGateActiveFor(memberId: string): boolean {
  if (isAdminPasswordConfigured()) return true;
  const member = db.prepare('SELECT password_hash FROM family_members WHERE id = ?').get(memberId) as
    | { password_hash: string | null }
    | undefined;
  if (member?.password_hash) return true;
  return anyParentHasPassword();
}

/** Can this session view/edit memberId's bank? */
export function canAccessBank(token: string | undefined, memberId: string): boolean {
  if (!bankGateActiveFor(memberId)) return true;
  const session = getValidSession(token);
  if (!session) return false;
  if (!session.family_member_id) return true; // legacy recovery login
  if (session.family_member_id === memberId) return true;
  const member = db.prepare('SELECT is_parent FROM family_members WHERE id = ?').get(session.family_member_id) as
    | { is_parent: 0 | 1 }
    | undefined;
  return member?.is_parent === 1;
}

export function deleteSession(token: string | undefined): void {
  if (!token) return;
  db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
}

/** Best-effort housekeeping so admin_sessions doesn't grow forever; call occasionally, not per-request. */
export function pruneExpiredSessions(): void {
  db.prepare("DELETE FROM admin_sessions WHERE expires_at <= datetime('now')").run();
}
