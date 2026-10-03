# Internet controls (Pi-hole) setup

The **Internet** page lets a parent, from the dashboard:

- **Pause** a kid's internet (30 min, 1 hr, 2 hr, or until resumed), or pause/resume all kids at once
- Set **schedules** — e.g. "Bedtime, Sun–Thu, 9:00 PM–7:00 AM" — with **+30 min / +1 hr** bonus
  time or a one-tap **Resume** when you want to make an exception tonight
- Choose each kid's **web access**:
  - **Open** — ads and trackers blocked, nothing else
  - **Kid web filter** — also blocks adult content, gambling, ways around the filter (VPNs,
    proxies, private DNS), and optionally social media
  - **Approved sites only** — everything is blocked except that kid's own approved list (good for
    younger kids), with a **What's being blocked?** helper to approve what a site needs
- Keep lists of **always allowed** sites (school sites keep working even at bedtime) and sites
  **blocked for kids**

…while [Pi-hole](https://pi-hole.net) blocks ads and trackers for every device in the house.
Anyone can *see* the Internet page (a kid can check why they're offline and until when); only a
parent can change anything — the same login as Settings, see [SETTINGS_LOGIN.md](SETTINGS_LOGIN.md).

## How it works (and its limits)

Pi-hole is the house's DNS server — the "phone book" every device asks to turn `youtube.com` into
an address. This app puts each kid's devices into Pi-hole groups: a "paused" group whose devices
get no answers at all, a "kid filter" group with the family blocklists, and for each
approved-sites-only kid a group of their own whose approved sites are let through the block. It re-checks every
minute, so schedules start and stop on time.

Worth knowing up front:

- **It isn't instant.** Changes reach Pi-hole within a few seconds, but a device remembers recent
  lookups for a minute or two, and a video that's already streaming may keep going until the app
  reconnects. Give it a couple of minutes.
- **It works per device, so each device has to ask Pi-hole directly** — see *Router setup* below,
  the one part that depends on your Linksys model.
- **It can't count time** ("2 hours of YouTube a day") — it blocks on a schedule or on demand.
- **It isn't bulletproof.** Phone data (cellular) skips your Wi-Fi entirely, and a determined kid
  can try a VPN or a device with its own DNS settings. The "ways around the filter" blocklist
  closes most of the easy routes; *Closing the gaps* below covers the rest.

## 1. Give the Pi a fixed address

Everything will point at the Pi, so its address must never change. In the Linksys web UI
(`http://myrouter.local` or `http://192.168.1.1`): **Connectivity → Local Network → DHCP
Reservations** (Velop app: **Advanced Settings → DHCP Reservations**), reserve the Pi's current
address, and note it — `192.168.1.10` in the examples below. A wired (Ethernet) Pi is best.

## 2. Install Pi-hole on the Pi

```bash
curl -sSL https://install.pi-hole.net | bash
```

Accept the defaults (pick the Ethernet interface if asked, any upstream DNS provider you like).
This guide assumes **Pi-hole v6** (anything installed in 2025 or later). Then set its admin password:

```bash
sudo pihole setpassword
```

**If you set up Caddy for the intercom** ([INTERCOM_SETUP.md](INTERCOM_SETUP.md)), Caddy already
uses ports 80/443 — move Pi-hole's own web page to 8080:

```bash
sudo pihole-FTL --config webserver.port '8080o,[::]:8080o'
```

Pi-hole's admin page is then at `http://192.168.1.10/admin` (or `:8080/admin`).

## 3. Connect this app to Pi-hole

In `.env`:

```bash
PIHOLE_URL=http://localhost          # or http://localhost:8080 if you moved the port above
PIHOLE_PASSWORD=the-password-you-set
```

Restart the app (`sudo systemctl restart familyhomecenter`). On startup it creates what it needs in
Pi-hole — two groups, **FHC Paused** and **FHC Kid filter**, a block-everything rule for the
paused group, and the filter blocklists — then downloads the blocklists in the background (a
minute or two). Don't rename or delete those groups in Pi-hole's own UI; if anything gets out of
step (e.g. you reinstall Pi-hole), **Repair Pi-hole setup** at the bottom of the Internet page
rebuilds it all.

## 4. Router setup (Linksys)

The goal: every device should send its lookups **straight to the Pi**. You don't need to make
Pi-hole your DHCP server for this — keep the Linksys doing that job.

### Option A — have the Linksys hand out the Pi as DNS (try this first)

Most Linksys Smart Wi-Fi routers (EA-series, WRT, MR-series): **Connectivity → Local Network →
DHCP Server → Static DNS 1** = the Pi's address (`192.168.1.10`). **Leave Static DNS 2 and 3
blank** — devices use any DNS server they're given, so a second one (like 8.8.8.8) would let them
skip Pi-hole. Save, then reconnect devices to Wi-Fi (or just wait — they pick it up within a day).
Wired and Wi-Fi devices both get it; they're on the same network.

### Check it worked

Open the **Internet** page. Pi-hole's line at the top says how many active devices it sees. If it
says only **1 or 2**, your router is answering for everyone and passing the lookups to Pi-hole as
its own — ad blocking works, but per-kid rules can't tell devices apart (the page shows a warning).
This is common on **Velop** mesh systems, whose only DNS setting is under Internet Settings. In that
case use Option B.

### Option B — point just the kids' devices at the Pi

Set the router's DNS (Internet Settings) to the Pi so the whole house still gets ad blocking, then
on each kid's device set DNS by hand to the Pi's address:

- **iPhone / iPad:** Settings → Wi-Fi → ⓘ next to your network → Configure DNS → Manual → remove
  the existing entry, add `192.168.1.10`. Lock it with Screen Time (Content & Privacy Restrictions
  → Allow Changes: Passcode Changes / Account Changes → Don't Allow) so it can't be undone.
- **Windows:** Settings → Network & internet → Wi-Fi (or Ethernet) → your network → DNS server
  assignment → Edit → Manual → IPv4 → `192.168.1.10`. Use a standard (non-admin) account for kids.
- **Mac:** System Settings → Wi-Fi → Details → DNS → replace with `192.168.1.10`.
- **Android:** turn **Private DNS** off (Settings → Network → Private DNS), then Wi-Fi → your
  network → edit → Advanced → IP settings: Static, DNS 1 = `192.168.1.10`. Family Link can lock
  settings down.
- **Game consoles:** network settings → DNS → Manual → `192.168.1.10`, secondary blank (or the same).

### Last resort — Pi-hole as DHCP server

Only if neither works for you. Having wired and Wi-Fi devices doesn't complicate it (it's one
network), but it does mean turning off the Linksys's DHCP server — skip it unless you need it.

## 5. Add the kids' devices

On the Internet page (logged in as a parent): **Find devices Pi-hole has seen**, name each one,
pick whose it is, **Add**. Or type a MAC/IP by hand.

**Turn off rotating "private" Wi-Fi addresses on the kids' devices**, or the device looks new to
Pi-hole every so often and slips out of its rules:

- iPhone/iPad: Settings → Wi-Fi → ⓘ → Private Wi-Fi Address → **Off** (or **Fixed** — fixed is fine;
  **Rotating** is the problem)
- Android: Wi-Fi → your network → Privacy → **Use device MAC**
- Windows: Wi-Fi → Random hardware addresses → **Off**

Then on each kid's card: pick their **Web access**, and **+ Add a schedule** (Bedtime defaults to
Sun–Thu 9 PM–7 AM — days are the nights it *starts*).

### Approved sites only

Type a site (e.g. `pbskids.org`) and **Approve** — that covers the site and everything under it
(`www.`, `m.`, …). Most sites also quietly load pieces from *other* domains (YouTube needs
`ytimg.com` and `googlevideo.com`, for example), so the first visit to a new site often half-works.
When that happens, have them try it, then tap **What's being blocked?** on their card: it lists
what their devices tried to reach in the last little while, grouped by site, each with an
**Approve** button. Approve the ones that belong to the site and leave the rest.

Pausing and schedules still apply on top: a paused approved-only kid is fully offline, apart from
the household **Always allowed** list (which works for every kid in every mode).

## Closing the gaps (optional)

- **Cellular data** — use the phone's own parental controls (Screen Time / Family Link), which work
  on any network.
- **Linksys parental controls** (Smart Wi-Fi: **Parental Controls**; Velop app: **Parental
  Controls**) can also block a device by schedule at the router, which no DNS setting gets around —
  a good backstop for the one device a kid really wants unblocked.
- **SafeSearch for the whole house** — Pi-hole admin → Settings → Local DNS Records → **CNAME**:
  `www.google.com` → `forcesafesearch.google.com`, `www.bing.com` → `strict.bing.com`,
  `www.youtube.com` → `restrictmoderate.youtube.com`. This applies to everyone (Pi-hole can't do it
  per person), which most households are fine with.

## If something goes wrong

- **"Can't reach Pi-hole"** — check `PIHOLE_URL` (port!) and that Pi-hole is running:
  `pihole status`.
- **"Pi-hole rejected the password"** — re-check `PIHOLE_PASSWORD`; restart the app after changing it.
- **The whole house loses internet** — devices use the Pi for every lookup, so if the Pi is down,
  nothing resolves. Quick fix: set the router's DNS back to automatic until the Pi is back.
- **A kid isn't being blocked** — check their device is listed under Devices with their name, that
  its private address isn't rotating, and that the warning about "only sees N devices" isn't showing.
