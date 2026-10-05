import { db } from '../db.js';
import { isEmailConfigured, sendEmail } from './email.js';
import { localDay } from './internetControl.js';

/** One kid's week online, for the Internet page and the Sunday email. */
export interface KidWeek {
  member_id: string;
  name: string;
  days: Array<{ day: string; minutes: number }>;
  total_minutes: number;
  top_sites: Array<{ site: string; lookups: number }>;
  top_blocked: Array<{ site: string; blocked: number }>;
}

export interface WeeklyReport {
  from: string;
  to: string;
  kids: KidWeek[];
  pending_requests: number;
}

/** The last 7 days (today included) for everyone who isn't a parent and has a device assigned. */
export function buildWeeklyReport(now = new Date()): WeeklyReport {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) days.push(localDay(new Date(now.getTime() - i * 86_400_000)));
  const [from, to] = [days[0], days[days.length - 1]];
  const kids = db
    .prepare(
      `SELECT DISTINCT m.id, m.name FROM family_members m JOIN internet_devices d ON d.family_member_id = m.id
       WHERE m.is_parent = 0 ORDER BY m.sort_order, m.name`
    )
    .all() as Array<{ id: string; name: string }>;
  return {
    from,
    to,
    pending_requests: (db.prepare("SELECT COUNT(*) AS n FROM internet_requests WHERE status = 'pending'").get() as { n: number }).n,
    kids: kids.map((k) => {
      const usage = new Map(
        (db.prepare('SELECT day, minutes FROM internet_usage WHERE family_member_id = ? AND day BETWEEN ? AND ?').all(k.id, from, to) as Array<{
          day: string;
          minutes: number;
        }>).map((r) => [r.day, r.minutes])
      );
      const perDay = days.map((day) => ({ day, minutes: usage.get(day) ?? 0 }));
      return {
        member_id: k.id,
        name: k.name,
        days: perDay,
        total_minutes: perDay.reduce((n, d) => n + d.minutes, 0),
        top_sites: db
          .prepare(
            `SELECT site, SUM(lookups) AS lookups FROM internet_site_counts WHERE family_member_id = ? AND day BETWEEN ? AND ?
             GROUP BY site HAVING lookups > 0 ORDER BY lookups DESC LIMIT 10`
          )
          .all(k.id, from, to) as Array<{ site: string; lookups: number }>,
        top_blocked: db
          .prepare(
            `SELECT site, SUM(blocked) AS blocked FROM internet_site_counts WHERE family_member_id = ? AND day BETWEEN ? AND ?
             GROUP BY site HAVING blocked > 0 ORDER BY blocked DESC LIMIT 5`
          )
          .all(k.id, from, to) as Array<{ site: string; blocked: number }>,
      };
    }),
  };
}

export function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });

function renderReport(report: WeeklyReport): { subject: string; text: string; html: string } {
  const text: string[] = [];
  const html: string[] = [];
  for (const k of report.kids) {
    text.push(`${k.name} — ${fmtMinutes(k.total_minutes)} online this week`);
    text.push('  ' + k.days.map((d) => `${dayLabel(d.day)} ${fmtMinutes(d.minutes)}`).join(' · '));
    if (k.top_sites.length) text.push('  Most used: ' + k.top_sites.map((s) => s.site).join(', '));
    if (k.top_blocked.length) text.push('  Blocked most: ' + k.top_blocked.map((s) => `${s.site} (${s.blocked})`).join(', '));
    text.push('');
    html.push(
      `<h3 style="margin:18px 0 4px">${escapeHtml(k.name)} — ${fmtMinutes(k.total_minutes)} online this week</h3>` +
        `<table style="border-collapse:collapse;font-size:14px"><tr>${k.days
          .map((d) => `<td style="padding:2px 10px;text-align:center;color:#667085">${dayLabel(d.day)}</td>`)
          .join('')}</tr><tr>${k.days.map((d) => `<td style="padding:2px 10px;text-align:center">${fmtMinutes(d.minutes)}</td>`).join('')}</tr></table>` +
        (k.top_sites.length ? `<p style="margin:6px 0"><strong>Most used:</strong> ${k.top_sites.map((s) => escapeHtml(s.site)).join(', ')}</p>` : '') +
        (k.top_blocked.length
          ? `<p style="margin:6px 0;color:#9b1c1c"><strong>Blocked most:</strong> ${k.top_blocked.map((s) => `${escapeHtml(s.site)} (${s.blocked})`).join(', ')}</p>`
          : '')
    );
  }
  if (report.pending_requests) {
    const line = `${report.pending_requests} request${report.pending_requests === 1 ? '' : 's'} waiting for a parent on the Internet page.`;
    text.push(line);
    html.push(`<p><strong>${line}</strong></p>`);
  }
  if (report.kids.length === 0) {
    text.push('No kids have devices set up on the Internet page yet.');
    html.push('<p>No kids have devices set up on the Internet page yet.</p>');
  }
  text.push('Times are estimates from website lookups — see docs/PIHOLE_SETUP.md.');
  html.push('<p style="color:#667085;font-size:12px">Times are estimates from website lookups.</p>');
  return { subject: `Internet this week (${report.from} – ${report.to})`, text: text.join('\n'), html: html.join('') };
}

/** Emails the report to every parent with an email set. Throws (with a readable reason) if it
 *  can't — the "Send it now" button shows that; the Sunday job just logs it. */
export async function sendWeeklyReport(): Promise<number> {
  if (!isEmailConfigured()) throw new Error('Email isn’t set up (SMTP_HOST in .env) — see docs/GROCERY_EMAIL_SETUP.md');
  const recipients = db.prepare("SELECT email FROM family_members WHERE is_parent = 1 AND email IS NOT NULL AND email != ''").all() as Array<{
    email: string;
  }>;
  if (recipients.length === 0) throw new Error('No parent has an email address set (Settings → family member)');
  const { subject, text, html } = renderReport(buildWeeklyReport());
  await sendEmail({ to: recipients.map((r) => r.email).join(', '), subject, text, html });
  return recipients.length;
}
