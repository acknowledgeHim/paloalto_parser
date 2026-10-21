import cron from 'node-cron';
import { db, getSetting } from '../db.js';
import { isEmailConfigured, sendEmail } from './email.js';
import { tasksForDate } from './taskQueries.js';
import { addDays, timeOfDaySlots, todayStr } from '../utils/recurrence.js';
import type { FamilyMember, TaskWithAssignment } from '../types.js';

/**
 * 📬 Weekly report: one email per kid each Sunday evening, to the parents (and the kid, if they
 * have an email) — what they got done each day, what slipped, what they earned and redeemed, and
 * where their stars, money and bank stand. Settings → Weekly report turns it off or sends one now.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function doneFor(task: TaskWithAssignment, memberId: string): boolean {
  const slots = timeOfDaySlots(task.time_of_day);
  if (slots.length > 1) return slots.every((s) => task.completions.some((c) => c.completed_by_id === memberId && c.time_of_day === s));
  return task.completions.some((c) => c.completed_by_id === memberId);
}

export interface WeeklyReport {
  member: FamilyMember;
  start: string;
  end: string;
  days: Array<{ date: string; done: number; total: number }>;
  done: number;
  total: number;
  doneTitles: Array<{ title: string; n: number }>;
  missed: Array<{ title: string; n: number }>;
  starsEarned: number;
  moneyEarned: number;
  rewards: string[];
  prizes: string[];
  bank: Array<{ name: string; balance: number }>;
  extras: Array<{ heading: string; lines: string[] }>;
}

/** Extra sections other features add (journal, height…): each returns a heading and lines, or null. */
const extraSections: Array<(member: FamilyMember, start: string, end: string) => { heading: string; lines: string[] } | null> = [];
export function addWeeklyReportSection(fn: (typeof extraSections)[number]) {
  extraSections.push(fn);
}

export function buildWeeklyReport(member: FamilyMember, end = todayStr()): WeeklyReport {
  const start = addDays(end, -6);
  const days: WeeklyReport['days'] = [];
  const doneCount = new Map<string, number>();
  const missedCount = new Map<string, number>();
  let starsEarned = 0;
  let moneyEarned = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    // Jobs that were on their list that day (a one-time job counts on the day it was done, or today if still open).
    const tasks = tasksForDate(date).filter((t) => t.assignee_ids.includes(member.id));
    let done = 0;
    let total = 0;
    for (const t of tasks) {
      const isDone = doneFor(t, member.id);
      if (t.recurrence === 'once' && !(isDone ? t.completions.some((c) => c.completed_on === date) : date === end)) continue;
      if (t.recurrence === 'asneeded' && !isDone) continue;
      total++;
      if (isDone) {
        done++;
        doneCount.set(t.title, (doneCount.get(t.title) ?? 0) + 1);
        if (t.reward_type === 'stars') starsEarned += t.reward_amount ?? 0;
        if (t.reward_type === 'money') moneyEarned += t.reward_amount ?? 0;
      } else {
        missedCount.set(t.title, (missedCount.get(t.title) ?? 0) + 1);
      }
    }
    days.push({ date, done, total });
  }
  const top = (m: Map<string, number>) => [...m].map(([title, n]) => ({ title, n })).sort((a, b) => b.n - a.n);
  const since = `${start}T00:00:00`;
  const rewards = (
    db.prepare('SELECT text, emoji FROM earned_rewards WHERE family_member_id = ? AND earned_at >= ?').all(member.id, since) as Array<{
      text: string;
      emoji: string | null;
    }>
  ).map((r) => `${r.emoji ?? '🎁'} ${r.text}`);
  const prizes = (
    db
      .prepare(
        `SELECT p.title, p.emoji FROM prize_redemptions r JOIN prizes p ON p.id = r.prize_id
         WHERE r.family_member_id = ? AND r.redeemed_at >= ? AND (r.status IS NULL OR r.status != 'pending')`
      )
      .all(member.id, since) as Array<{ title: string; emoji: string | null }>
  ).map((p) => `${p.emoji ?? '🎁'} ${p.title}`);
  const bank = db
    .prepare(
      `SELECT a.name, COALESCE(SUM(t.amount), 0) as balance FROM bank_accounts a LEFT JOIN bank_transactions t ON t.account_id = a.id
       WHERE a.family_member_id = ? GROUP BY a.id ORDER BY a.sort_order`
    )
    .all(member.id) as Array<{ name: string; balance: number }>;
  const extras = extraSections.map((fn) => fn(member, start, end)).filter((x): x is { heading: string; lines: string[] } => Boolean(x?.lines.length));
  return {
    member,
    start,
    end,
    days,
    done: days.reduce((n, d) => n + d.done, 0),
    total: days.reduce((n, d) => n + d.total, 0),
    doneTitles: top(doneCount),
    missed: top(missedCount),
    starsEarned,
    moneyEarned,
    rewards,
    prizes,
    bank,
    extras,
  };
}

const dayName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function renderWeeklyReport(r: WeeklyReport): { subject: string; text: string; html: string } {
  const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
  const cheer = pct >= 90 ? '🌟 Superstar week!' : pct >= 70 ? '💪 Great week!' : pct >= 40 ? '👍 Nice work' : r.done ? '🌱 Every job counts' : r.total ? '😊 Next week is a fresh start' : '😴 Quiet week';
  const subject = `${r.member.name}'s week: ${r.done} of ${r.total} jobs done ${pct >= 70 ? '🎉' : ''}`.trim();
  const color = r.member.color || '#5b8def';
  const bars = r.days
    .map((d) => {
      const h = d.total ? Math.round((d.done / d.total) * 60) : 0;
      return `<td style="vertical-align:bottom;text-align:center;padding:0 4px;font-size:12px;color:#667085">
        <div style="font-weight:600;color:#1d2939">${d.done}/${d.total}</div>
        <div style="width:28px;height:60px;background:#eef2f6;border-radius:6px;display:flex;align-items:flex-end;margin:4px auto">
          <div style="width:28px;height:${h}px;background:${color};border-radius:6px"></div></div>${dayName(d.date)}</td>`;
    })
    .join('');
  const list = (items: string[]) => (items.length ? `<ul style="margin:4px 0 0 18px;padding:0">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
  const section = (title: string, body: string) => (body ? `<h3 style="margin:18px 0 4px;font-size:16px">${title}</h3>${body}` : '');
  const money = (n: number) => `$${n.toFixed(2)}`;
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;color:#1d2939">
    <h2 style="margin:0;color:${color}">${esc(r.member.avatar && r.member.avatar.length <= 4 ? r.member.avatar + ' ' : '')}${esc(r.member.name)}'s week</h2>
    <div style="color:#667085">${longDay(r.start)} – ${longDay(r.end)}</div>
    <p style="font-size:18px;margin:12px 0"><strong>${r.done}</strong> of ${r.total} jobs done (${pct}%) — ${cheer}</p>
    <table style="border-collapse:collapse"><tr>${bars}</tr></table>
    ${section('✅ Got done', list(r.doneTitles.slice(0, 8).map((t) => `${t.title}${t.n > 1 ? ` ×${t.n}` : ''}`)))}
    ${section('⏰ Slipped', list(r.missed.slice(0, 6).map((t) => `${t.title}${t.n > 1 ? ` (missed ${t.n}×)` : ''}`)))}
    ${section(
      '🎁 Earned',
      list([
        ...(r.starsEarned ? [`${r.starsEarned} ⭐`] : []),
        ...(r.moneyEarned ? [money(r.moneyEarned)] : []),
        ...r.rewards,
        ...r.prizes.map((p) => `Prize redeemed: ${p}`),
      ])
    )}
    ${section(
      '🏦 Now',
      list([`⭐ ${r.member.star_balance} stars`, `${money(r.member.money_balance)} Prize Bank money`, ...r.bank.map((b) => `${b.name}: ${money(b.balance)}`)])
    )}
    ${r.extras.map((x) => section(esc(x.heading), list(x.lines))).join('')}
    <p style="color:#98a2b3;font-size:12px;margin-top:24px">From the Family Home Center · turn this off in Settings → Weekly report</p>
  </div>`;
  const text = [
    `${r.member.name}'s week (${longDay(r.start)} – ${longDay(r.end)})`,
    `${r.done} of ${r.total} jobs done (${pct}%) — ${cheer}`,
    r.days.map((d) => `${dayName(d.date)} ${d.done}/${d.total}`).join(' · '),
    r.doneTitles.length ? `Got done: ${r.doneTitles.map((t) => `${t.title}${t.n > 1 ? ` ×${t.n}` : ''}`).join(', ')}` : '',
    r.missed.length ? `Slipped: ${r.missed.map((t) => `${t.title} (${t.n}×)`).join(', ')}` : '',
    `Stars: ${r.member.star_balance} · Prize Bank money: ${money(r.member.money_balance)}`,
    ...r.extras.map((x) => `${x.heading}: ${x.lines.join('; ')}`),
  ]
    .filter(Boolean)
    .join('\n');
  return { subject, text, html };
}

/** Sends every kid's report (or just one). Returns what it did, for Settings → Send now. */
export async function sendWeeklyReports(onlyMemberId?: string): Promise<string> {
  if (!isEmailConfigured()) return 'Email isn’t set up on the server (SMTP_HOST), so nothing was sent.';
  const members = db.prepare('SELECT * FROM family_members ORDER BY sort_order').all() as FamilyMember[];
  const parents = members.filter((m) => m.is_parent === 1 && m.email);
  const kids = members.filter((m) => m.is_parent !== 1 && (!onlyMemberId || m.id === onlyMemberId));
  let sent = 0;
  for (const kid of kids) {
    const to = [...new Set([...parents.map((p) => p.email!), ...(kid.email ? [kid.email] : [])])];
    if (!to.length) continue;
    const { subject, text, html } = renderWeeklyReport(buildWeeklyReport(kid));
    await sendEmail({ to: to.join(', '), subject, text, html });
    sent++;
  }
  if (!sent) return 'Nobody to send to — add a parent’s email in Settings → Family.';
  console.log(`[weekly] Sent ${sent} weekly report${sent === 1 ? '' : 's'}.`);
  return `Sent ${sent} report${sent === 1 ? '' : 's'} ✓`;
}

/** Sunday 6pm (local TZ), unless turned off. */
export function startWeeklyReportSchedule(): void {
  cron.schedule('0 18 * * 0', () => {
    if (getSetting('weekly_report_off') === '1') return;
    sendWeeklyReports().catch((err) => console.error('[weekly] Failed to send weekly reports:', err));
  });
}
