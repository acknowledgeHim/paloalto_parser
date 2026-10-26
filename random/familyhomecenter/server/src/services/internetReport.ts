import { db } from '../db.js';
import { isEmailConfigured, sendEmail } from './email.js';
import { getMemberRow, localDay } from './internetControl.js';
import { usageSite } from './internetUsage.js';

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

/** One person's time online between two days (inclusive), for the Time online graphs. */
export interface UsageHistory {
  member_id: string;
  name: string;
  from: string;
  to: string;
  /** Their current daily limits, for a line on the graph (null = none). */
  limit: { weekday: number | null; weekend: number | null };
  days: Array<{ day: string; minutes: number }>;
  total_minutes: number;
  /** Minutes online in each hour of the day (0 = midnight–1am), added up over the range. */
  hours: number[];
  /** Time on each site (minutes) plus how often it was looked up, most time first. */
  sites: Array<{ site: string; minutes: number; lookups: number }>;
  blocked: Array<{ site: string; blocked: number }>;
  /** The first day time-per-site and time-of-day were recorded (they were added later). */
  detail_since: string | null;
  /** Whether any device is assigned to them on the Internet page (nothing is tracked otherwise). */
  has_devices: boolean;
}

export function buildUsageHistory(memberId: string, from: string, to: string): UsageHistory | null {
  const member = db.prepare('SELECT id, name FROM family_members WHERE id = ?').get(memberId) as { id: string; name: string } | undefined;
  if (!member) return null;
  const days: string[] = [];
  const end = new Date(`${to}T12:00:00`);
  for (let d = new Date(`${from}T12:00:00`); d <= end && days.length < 400; d = new Date(d.getTime() + 86_400_000)) days.push(localDay(d));
  const usage = new Map(
    (db.prepare('SELECT day, minutes FROM internet_usage WHERE family_member_id = ? AND day BETWEEN ? AND ?').all(memberId, from, to) as Array<{
      day: string;
      minutes: number;
    }>).map((r) => [r.day, r.minutes])
  );
  const perDay = days.map((day) => ({ day, minutes: usage.get(day) ?? 0 }));

  const hours = new Array<number>(24).fill(0);
  for (const r of db
    .prepare('SELECT hour, SUM(minutes) AS minutes FROM internet_usage_hours WHERE family_member_id = ? AND day BETWEEN ? AND ? GROUP BY hour')
    .all(memberId, from, to) as Array<{ hour: number; minutes: number }>) {
    if (r.hour >= 0 && r.hour < 24) hours[r.hour] = r.minutes;
  }

  const sites = new Map<string, { site: string; minutes: number; lookups: number }>();
  const entry = (site: string) => sites.get(site) ?? sites.set(site, { site, minutes: 0, lookups: 0 }).get(site)!;
  for (const r of db
    .prepare('SELECT site, SUM(minutes) AS minutes FROM internet_site_minutes WHERE family_member_id = ? AND day BETWEEN ? AND ? GROUP BY site')
    .all(memberId, from, to) as Array<{ site: string; minutes: number }>) {
    entry(r.site).minutes += r.minutes;
  }
  for (const r of db
    .prepare(
      'SELECT site, SUM(lookups) AS lookups FROM internet_site_counts WHERE family_member_id = ? AND day BETWEEN ? AND ? GROUP BY site HAVING lookups > 0'
    )
    .all(memberId, from, to) as Array<{ site: string; lookups: number }>) {
    const u = usageSite(r.site);
    if (u) entry(u).lookups += r.lookups;
  }

  const row = getMemberRow(memberId);
  return {
    member_id: member.id,
    name: member.name,
    from,
    to,
    limit: { weekday: row.daily_minutes, weekend: row.weekend_minutes },
    days: perDay,
    total_minutes: perDay.reduce((n, d) => n + d.minutes, 0),
    hours,
    sites: [...sites.values()].sort((a, b) => b.minutes - a.minutes || b.lookups - a.lookups).slice(0, 40),
    blocked: db
      .prepare(
        `SELECT site, SUM(blocked) AS blocked FROM internet_site_counts WHERE family_member_id = ? AND day BETWEEN ? AND ?
         GROUP BY site HAVING blocked > 0 ORDER BY blocked DESC LIMIT 15`
      )
      .all(memberId, from, to) as Array<{ site: string; blocked: number }>,
    detail_since:
      (db.prepare('SELECT MIN(day) AS d FROM internet_usage_hours WHERE family_member_id = ?').get(memberId) as { d: string | null }).d ?? null,
    has_devices: Boolean(db.prepare('SELECT 1 FROM internet_devices WHERE family_member_id = ?').get(memberId)),
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

const hourLabel = (h: number) => (h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`);

/**
 * The Time online graphs for the email, drawn with plain table cells (no images or scripts — most
 * mail apps block those): minutes per day with the daily limit, time of day, and time on each site.
 */
function chartsHtml(h: UsageHistory, color: string): string {
  const MUTED = '#667085';
  const limitFor = (day: string) => ([0, 6].includes(new Date(`${day}T12:00:00`).getDay()) ? h.limit.weekend : h.limit.weekday);
  const maxDay = Math.max(30, ...h.days.map((d) => Math.max(d.minutes, limitFor(d.day) ?? 0)));
  const DAY_PX = 110;
  const dayCols = h.days
    .map((d) => {
      const limit = limitFor(d.day);
      const over = limit !== null && d.minutes > limit;
      const barPx = d.minutes > 0 ? Math.max(3, Math.round((d.minutes / maxDay) * DAY_PX)) : 0;
      const title = `${fmtMinutes(d.minutes)}${limit !== null ? ` of ${fmtMinutes(limit)}` : ''}`;
      return (
        `<td valign="bottom" align="center" style="padding:0 4px;width:44px">` +
        `<div style="font-size:11px;color:${over ? '#d64545' : MUTED};white-space:nowrap">${d.minutes ? fmtMinutes(d.minutes) : ''}</div>` +
        (barPx ? `<div title="${title}" style="height:${barPx}px;width:28px;background:${over ? '#d64545' : color};border-radius:3px 3px 0 0"></div>` : '') +
        `</td>`
      );
    })
    .join('');
  const dayLabels = h.days.map((d) => `<td align="center" style="font-size:11px;color:${MUTED};padding:2px 4px">${dayLabel(d.day)}</td>`).join('');
  const limits = [
    h.limit.weekday !== null ? `weekdays ${fmtMinutes(h.limit.weekday)}` : '',
    h.limit.weekend !== null ? `weekends ${fmtMinutes(h.limit.weekend)}` : '',
  ].filter(Boolean);

  const maxHour = Math.max(1, ...h.hours);
  const HOUR_PX = 60;
  const hourCols = h.hours
    .map((m) => {
      const px = m > 0 ? Math.max(3, Math.round((m / maxHour) * HOUR_PX)) : 0;
      return `<td valign="bottom" style="padding:0 1px;width:14px;height:${HOUR_PX}px">${px ? `<div style="height:${px}px;width:12px;background:${color}"></div>` : ''}</td>`;
    })
    .join('');
  const hourLabels = h.hours
    .map((_, i) => `<td style="font-size:10px;color:${MUTED};white-space:nowrap">${i % 3 === 0 ? hourLabel(i) : ''}</td>`)
    .join('');

  const sites = h.sites.filter((x) => x.minutes > 0).slice(0, 10);
  const maxSite = Math.max(1, ...sites.map((x) => x.minutes));
  const siteRows = sites
    .map(
      (x) =>
        `<tr><td style="font-size:13px;padding:2px 10px 2px 0;white-space:nowrap">${escapeHtml(x.site)}</td>` +
        `<td style="width:220px;padding:2px 0"><div style="height:10px;width:${Math.max(2, Math.round((x.minutes / maxSite) * 220))}px;background:${color};border-radius:5px"></div></td>` +
        `<td style="font-size:13px;padding:2px 0 2px 10px;text-align:right;white-space:nowrap">${fmtMinutes(x.minutes)}</td></tr>`
    )
    .join('');

  return (
    `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:6px"><tr>${dayCols}</tr><tr>${dayLabels}</tr></table>` +
    (limits.length ? `<p style="margin:2px 0;font-size:12px;color:${MUTED}">Daily limit: ${limits.join(', ')} — red = went over.</p>` : '') +
    (h.hours.some((m) => m > 0)
      ? `<p style="margin:12px 0 2px;font-weight:bold;font-size:14px">🕒 Time of day</p>` +
        `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>${hourCols}</tr><tr>${hourLabels}</tr></table>`
      : '') +
    (siteRows
      ? `<p style="margin:12px 0 2px;font-weight:bold;font-size:14px">🌐 Time on each site</p>` +
        `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">${siteRows}</table>`
      : '')
  );
}

function renderReport(report: WeeklyReport): { subject: string; text: string; html: string } {
  const text: string[] = [];
  const html: string[] = [];
  for (const k of report.kids) {
    const h = buildUsageHistory(k.member_id, report.from, report.to);
    const color = (db.prepare('SELECT color FROM family_members WHERE id = ?').get(k.member_id) as { color: string } | undefined)?.color ?? '#5b8def';
    const timed = h ? h.sites.filter((x) => x.minutes > 0).slice(0, 10) : [];
    text.push(`${k.name} — ${fmtMinutes(k.total_minutes)} online this week`);
    text.push('  ' + k.days.map((d) => `${dayLabel(d.day)} ${fmtMinutes(d.minutes)}`).join(' · '));
    if (timed.length) text.push('  Time on each site: ' + timed.map((x) => `${x.site} ${fmtMinutes(x.minutes)}`).join(', '));
    else if (k.top_sites.length) text.push('  Most used: ' + k.top_sites.map((s) => s.site).join(', '));
    if (h && h.hours.some((m) => m > 0)) {
      const busiest = h.hours
        .map((m, i) => ({ m, i }))
        .sort((a, b) => b.m - a.m)
        .slice(0, 3)
        .filter((x) => x.m > 0)
        .map((x) => `${hourLabel(x.i)} (${fmtMinutes(x.m)})`);
      text.push('  Busiest hours: ' + busiest.join(', '));
    }
    if (k.top_blocked.length) text.push('  Blocked most: ' + k.top_blocked.map((s) => `${s.site} (${s.blocked})`).join(', '));
    text.push('');
    html.push(
      `<h3 style="margin:22px 0 4px">${escapeHtml(k.name)} — ${fmtMinutes(k.total_minutes)} online this week</h3>` +
        (h ? chartsHtml(h, color) : '') +
        (!timed.length && k.top_sites.length
          ? `<p style="margin:6px 0"><strong>Most used:</strong> ${k.top_sites.map((s) => escapeHtml(s.site)).join(', ')}</p>`
          : '') +
        (k.top_blocked.length
          ? `<p style="margin:8px 0;color:#9b1c1c"><strong>Blocked most:</strong> ${k.top_blocked.map((s) => `${escapeHtml(s.site)} (${s.blocked})`).join(', ')}</p>`
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
