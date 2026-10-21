import { db, getSetting } from '../db.js';
import { isEmailConfigured, sendEmail } from './email.js';
import type { FamilyMember } from '../types.js';

/**
 * ✅ An email to the parents when a kid's check-off, chunk of time, or prize claim is waiting for
 * an OK. Things that come in close together go in one email (sent a minute after the first), and
 * nothing is sent if it's all been answered (or taken back) by then. Settings → 📬 Email turns it off.
 */

const WAIT_MS = 60_000;
let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function stillWaiting(): number {
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return (
    n('SELECT COUNT(*) AS n FROM pending_completions') +
    n('SELECT COUNT(*) AS n FROM task_progress WHERE pending = 1') +
    n("SELECT COUNT(*) AS n FROM prize_redemptions WHERE status = 'pending'")
  );
}

async function flush() {
  timer = null;
  const items = queue;
  queue = [];
  if (!items.length || getSetting('approval_email_off') === '1' || !isEmailConfigured()) return;
  const waiting = stillWaiting();
  if (!waiting) return;
  const parents = (db.prepare("SELECT * FROM family_members WHERE is_parent = 1 AND email IS NOT NULL AND email != ''").all() as FamilyMember[]).map(
    (p) => p.email!
  );
  if (!parents.length) return;
  const subject = `✅ ${items.length === 1 ? items[0] : `${items.length} things`} — waiting for your OK`;
  const text = [`Waiting for a parent's OK:`, ...items.map((i) => `- ${i}`), '', `Open ✅ To approve on the Family Home Center (${waiting} waiting in all).`].join('\n');
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1d2939">
    <h2 style="margin:0 0 8px">✅ Waiting for your OK</h2>
    <ul style="margin:0 0 12px 18px;padding:0;font-size:16px">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    <p>Open <strong>✅ To approve</strong> on the Family Home Center — ${waiting} waiting in all.</p>
    <p style="color:#98a2b3;font-size:12px">Turn these off in Settings → 📬 Email.</p></div>`;
  try {
    await sendEmail({ to: parents.join(', '), subject, text, html });
    console.log(`[approvals] Emailed parents about ${items.length} item${items.length === 1 ? '' : 's'}.`);
  } catch (err) {
    console.error('[approvals] Could not send the approval email:', err);
  }
}

/** Something new to approve — e.g. "Grandma: Mulch · 30 min". */
export function notifyApproval(memberId: string | null, what: string): void {
  if (getSetting('approval_email_off') === '1' || !isEmailConfigured()) return;
  const name = memberId ? (db.prepare('SELECT name FROM family_members WHERE id = ?').get(memberId) as { name: string } | undefined)?.name : null;
  queue.push(`${name ?? 'Someone'}: ${what}`);
  if (!timer) timer = setTimeout(() => void flush(), WAIT_MS);
}
