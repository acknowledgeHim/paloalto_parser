# Browser calling setup (Twilio)

The **Contacts** page's "📱 Call (browser)" button places a real phone call straight from
whatever screen you're on — including a desktop or the kiosk touchscreen, where a `tel:` link has
no phone app to hand off to. This is entirely optional, off by default, and needs a **paid Twilio
account** — there's no free way to place an actual phone call from a web page (see the main
conversation that led here: Google Voice has no public calling API at all).

Everything else in Contacts (Call/Text via `tel:`/`sms:` links, and email-to-SMS texting) works
without any of this and costs nothing.

## What it costs

- A Twilio phone number: roughly **$1/month**.
- Outbound calls: roughly **$0.01-0.02/minute** to a US number (Twilio's pricing page has exact,
  current rates — international rates vary a lot more).
- New accounts start in **trial mode**: a small free credit, but every call is prefixed with a
  "this call is from a trial account" message and — more importantly — **you can only call phone
  numbers you've manually verified** in the Twilio console first. Add a payment method and upgrade
  the account to remove both restrictions.

## The hard part: Twilio needs to reach your server

When the browser places a call, Twilio's servers call back into *your* server (a "TwiML webhook")
to find out what to actually do with it. That means `your-server/api/calling/voice` has to be
reachable from the public internet over HTTPS — not just your home network. A Pi sitting behind a
home router isn't reachable that way by default. The two common fixes:

- **Cloudflare Tunnel (recommended)** — free, no port-forwarding or router changes, gives you a
  stable HTTPS URL.
  1. Install `cloudflared` on the Pi (see Cloudflare's docs for your OS/architecture).
  2. `cloudflared tunnel login`, then `cloudflared tunnel create familyhomecenter`.
  3. Point it at your server: `cloudflared tunnel route dns familyhomecenter familyhub.yourdomain.com`
     (needs a domain on Cloudflare — free ones work) or use the quick, no-domain-needed form:
     `cloudflared tunnel --url http://localhost:3000` (prints a random `*.trycloudflare.com` URL,
     which changes every time you restart it — fine for testing, not for a permanent setup).
  4. Run it as a service so it survives reboots (`cloudflared service install`).
- **ngrok** — faster to try once (`ngrok http 3000`), but the free tier's URL changes every time
  you restart it, so it's really only good for testing the setup works before committing to a
  tunnel you'll keep running.

**Security note:** whichever you use, the tunnel exposes your *entire* app to the internet at that
URL, not just the calling webhook — anyone with the link could reach it. Set an `ADMIN_PASSWORD`
(see `docs/SETTINGS_LOGIN.md`) before doing this if you haven't already, and don't share the tunnel
URL beyond what Twilio needs it for.

## 1. Create a Twilio account and get your Account SID

Sign up at [twilio.com](https://www.twilio.com/try-twilio). Your **Account SID** (starts with
`AC...`) is on the console dashboard.

## 2. Buy a phone number

Console → **Phone Numbers** → **Buy a number** — pick one with **Voice** capability (any US number
works fine). This becomes `TWILIO_CALLER_NUMBER` below, in E.164 format (e.g. `+15551234567`).

## 3. Create an API Key (not your Auth Token)

Console → **Account** → **API keys & tokens** → **Create API key**. This gives you an **API Key
SID** (`SK...`) and an **API Key Secret** — shown once, copy it immediately. This is what generates
short-lived tokens for the browser; it's deliberately separate from your main Auth Token, which
this app never touches or needs.

## 4. Create a TwiML App

Console → **Voice** → **TwiML Apps** → **Create new TwiML App**.

- **Voice Request URL**: `https://<your-tunnel-url>/api/calling/voice`, method `POST`.
- Everything else can be left at its default.

Copy the app's SID (`AP...`) — this is `TWILIO_TWIML_APP_SID`.

## 5. Configure the app

In `.env`:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=your-api-key-secret
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CALLER_NUMBER=+15551234567
```

Restart the server. Leave `TWILIO_ACCOUNT_SID` blank (the default) to keep browser calling off
entirely — the "Call (browser)" button simply won't appear (`GET /api/calling/status` returns
`{ enabled: false }`, which is all the client checks).

## 6. Test it

Open **Contacts** on any device, on a contact with a phone number. If everything above is
configured, a **📱 Call (browser)** button appears next to the usual Call/Text links. Tap it,
allow microphone access when the browser asks, and you should hear it ring. **On a trial account,
this only works for numbers you've manually verified** in the Twilio console first (Phone Numbers
→ Verified Caller IDs) — upgrade the account to call anyone.

## Troubleshooting

- **Button never appears**: `GET /api/calling/status` is returning `false` — double-check every
  `TWILIO_*` variable is set and the server was actually restarted after editing `.env`.
- **"Could not start the call" / no ring**: open the browser console for the actual error. A
  microphone-permission denial shows up here. Twilio's own **Voice Insights** (console → Monitor →
  Insights → Calls) shows every call attempt and is the best place to see what Twilio's side saw.
- **Call connects but nothing happens / immediately drops**: almost always the TwiML webhook isn't
  reachable — check the tunnel is actually running, and that the TwiML App's Voice Request URL
  matches it exactly (including `https://` and the `/api/calling/voice` path).
- **"account not authorized to call this number"**: trial account restriction — verify the number
  first, or upgrade the account.

## How it works

- The browser never talks to Twilio's phone network directly — it registers with Twilio using a
  short-lived access token (`GET /api/calling/token`, minted server-side from your API Key so the
  Key Secret itself never reaches the browser) and opens a WebRTC connection for audio.
- Placing a call tells Twilio "connect me, and go ask `/api/calling/voice` what to do" — that
  route (server/src/routes/calling.ts) replies with TwiML telling Twilio to dial the actual phone
  number, using your Twilio number as the caller ID.
- Incoming calls are disabled (`incomingAllow: false`) — this is strictly click-to-call *out*, not
  a way to receive calls on the kiosk.
