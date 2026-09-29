import cron from 'node-cron';
import { db } from '../db.js';
import { isEmailConfigured, sendEmail } from './email.js';
import type { FamilyMember, GroceryItem, Meal } from '../types.js';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildBody(items: GroceryItem[], members: FamilyMember[], meals: Meal[]): { text: string; html: string } {
  const memberName = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? 'someone' : null);
  const mealLabel = (id: string | null) => {
    if (!id) return null;
    const meal = meals.find((m) => m.id === id);
    if (!meal) return null;
    const date = new Date(`${meal.date}T00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return `${meal.title} (${date})`;
  };

  if (items.length === 0) {
    return { text: 'The grocery list is empty tonight.', html: '<p>The grocery list is empty tonight.</p>' };
  }

  const lines = items.map((item) => {
    const bits = [item.quantity, memberName(item.requested_by_id) && `for ${memberName(item.requested_by_id)}`, mealLabel(item.meal_id)]
      .filter(Boolean)
      .join(' — ');
    return { name: item.name, detail: bits };
  });

  const text = lines.map((l) => `- ${l.name}${l.detail ? ` (${l.detail})` : ''}`).join('\n');
  const html =
    '<ul>' +
    lines
      .map(
        (l) =>
          `<li><strong>${escapeHtml(l.name)}</strong>${l.detail ? ` <span style="color:#667085">— ${escapeHtml(l.detail)}</span>` : ''}</li>`
      )
      .join('') +
    '</ul>';

  return { text, html };
}

/** Builds and sends tonight's grocery-list digest to every parent with an email set. Exported
 *  separately from the cron wiring so it's directly testable/triggerable without waiting for
 *  midnight. No-op (logged, not thrown) if SMTP isn't configured or no parent has an email. */
export async function sendGroceryListEmail(): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('[grocery] SMTP not configured (SMTP_HOST unset) — skipping nightly digest.');
    return;
  }

  const recipients = (db.prepare('SELECT * FROM family_members WHERE is_parent = 1 AND email IS NOT NULL AND email != \'\'').all() as FamilyMember[]);
  if (recipients.length === 0) {
    console.log('[grocery] No parent has an email set — skipping nightly digest.');
    return;
  }

  const items = db.prepare('SELECT * FROM grocery_items ORDER BY created_at ASC').all() as GroceryItem[];
  const members = db.prepare('SELECT * FROM family_members').all() as FamilyMember[];
  const meals = db.prepare('SELECT * FROM meals').all() as Meal[];
  const { text, html } = buildBody(items, members, meals);

  const subject = items.length === 0 ? 'Grocery list — nothing on it tonight' : `Grocery list — ${items.length} item${items.length === 1 ? '' : 's'}`;
  await sendEmail({ to: recipients.map((r) => r.email).join(', '), subject, text, html });
  console.log(`[grocery] Sent nightly digest (${items.length} item${items.length === 1 ? '' : 's'}) to ${recipients.length} parent${recipients.length === 1 ? '' : 's'}.`);
}

/** Fires at local midnight (per TZ in .env, same as everything else date-related in this app). */
export function startGroceryEmailSchedule(): void {
  cron.schedule('0 0 * * *', () => {
    sendGroceryListEmail().catch((err) => console.error('[grocery] Failed to send nightly digest:', err));
  });
}
