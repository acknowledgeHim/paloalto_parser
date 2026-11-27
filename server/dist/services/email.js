import nodemailer from 'nodemailer';
import { config } from '../config.js';
let cachedTransporter = null;
/** Shared by the nightly grocery digest (groceryEmail.ts) and the Contacts page's email-to-SMS
 *  texting (contactText.ts) — both need the same SMTP account, just with different content. */
export function isEmailConfigured() {
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
export async function sendEmail(opts) {
    if (!isEmailConfigured())
        throw new Error('SMTP is not configured (SMTP_HOST unset)');
    await transporter().sendMail({ from: config.smtp.from, ...opts });
}
