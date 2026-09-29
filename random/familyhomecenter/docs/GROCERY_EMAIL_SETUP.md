# Grocery list email setup

The **Meals → Grocery List** tab is a running "need to buy" list anyone in the family can add to.
Every night at midnight, the server can email the current list to whichever parents have an email
address on file — this is optional and off by default.

## 1. Set a parent's email

Open the profile switcher (or Settings → family roster) → edit a parent → **Email**. Only parents
with an email set receive the digest; a kid's email field (if they have one) is never used for
this.

## 2. Configure an SMTP account

Any SMTP account works. The easiest option is a Gmail account with an **App Password** (Google
Account → Security → 2-Step Verification → App passwords — this requires 2FA to already be
enabled on that account, and is separate from the account's normal login password).

In `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=the-16-character-app-password
SMTP_FROM="Family Home Center <your-gmail-address@gmail.com>"
```

Any other provider's SMTP details (Outlook, a paid transactional service like SendGrid/Mailgun,
your own mail server) work the same way — just fill in that provider's host/port/user/password.

Restart the server. Leave `SMTP_HOST` blank to disable the digest entirely — the grocery list
itself still works either way, this only controls the nightly email.

## What gets sent

Every item currently on the list, with its quantity, who asked for it, and which upcoming meal
it's linked to (if any) — same information shown in the Grocery List tab. Checking an item off (or
deleting it) removes it from the list immediately, so only what's still needed shows up in that
night's email. An empty list still sends a short "nothing on it tonight" email rather than staying
silent, so a misconfigured setup doesn't quietly look like "nothing to buy."

## How it works

- Fires once a day at local midnight (per `TZ` in `.env`, same as every other date-related thing in
  this app).
- Uses [Nodemailer](https://nodemailer.com/) against the SMTP account above — nothing is queued or
  retried; a failure is logged to the server console and tried again at the next midnight.
- The email address is stored in plain text in the local SQLite database, same as a family
  member's name or color — not treated as sensitive.
