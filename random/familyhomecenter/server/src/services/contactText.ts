import { sendEmail } from './email.js';

/**
 * Texts a phone number via its carrier's free "email-to-SMS" gateway — an email sent to
 * <digits>@<gateway> is delivered as a text by the carrier. No subject (some gateways prepend it
 * to the body, some drop it; leaving it off keeps behavior predictable) and no HTML — carriers
 * expect plain text and often truncate around 140-160 characters regardless.
 */
export async function sendContactText(phone: string, gatewayDomain: string, message: string): Promise<void> {
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) throw new Error('That phone number has no digits to text');
  await sendEmail({ to: `${digits}@${gatewayDomain}`, text: message });
}
