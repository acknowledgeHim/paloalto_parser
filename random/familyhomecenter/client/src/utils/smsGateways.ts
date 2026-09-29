/**
 * Free "email-to-SMS" gateway domains — an email to <10-digit-number>@<domain> arrives as a text.
 * Not officially guaranteed by any carrier (some have gotten stricter about it over the years),
 * and MVNOs typically ride on one of these networks even when the brand name differs, hence
 * "Other (enter the gateway domain)" as an escape hatch for anything not listed.
 */
export const SMS_GATEWAYS = [
  { label: 'Verizon', domain: 'vtext.com' },
  { label: 'AT&T', domain: 'txt.att.net' },
  { label: 'T-Mobile', domain: 'tmomail.net' },
  { label: 'Sprint (legacy)', domain: 'messaging.sprintpcs.com' },
  { label: 'US Cellular', domain: 'email.uscc.net' },
  { label: 'Google Fi', domain: 'msg.fi.google.com' },
  { label: 'Cricket', domain: 'sms.cricketwireless.net' },
  { label: 'Boost Mobile', domain: 'sms.myboostmobile.com' },
  { label: 'MetroPCS', domain: 'mymetropcs.com' },
  { label: 'Xfinity Mobile / Visible (Verizon network)', domain: 'vtext.com' },
  { label: 'Mint Mobile / Metro-by-T-Mobile (T-Mobile network)', domain: 'tmomail.net' },
] as const;
