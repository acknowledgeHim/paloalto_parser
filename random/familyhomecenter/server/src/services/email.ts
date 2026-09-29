import nodemailer from 'nodemailer';
import { config } from '../config.js';

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

/** Shared by the nightly grocery digest (groceryEmail.ts) and the Contacts page's email-to-SMS
 *  texting (contactText.ts) — both need the same SMTP account, just with different content. */
export function isEmailConfigured(): boolean {
  return Boolean(config.smtp.host);
}

function transporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return cachedTransporter;
}

export async function sendEmail(opts: { to: string; subject?: string; text: string; html?: string }): Promise<void> {
  if (!isEmailConfigured()) throw new Error('SMTP is not configured (SMTP_HOST unset)');
  await transporter().sendMail({ from: config.smtp.from, ...opts });
}
