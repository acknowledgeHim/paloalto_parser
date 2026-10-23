# Real HTTPS with Let's Encrypt (free, renews itself)

The Caddy setup in `INTERCOM_SETUP.md` and `ANDROID_TABLET_SETUP.md` uses Caddy's own certificate,
so every phone, tablet and browser shows a certificate warning until you install Caddy's root
certificate on it. This replaces that with a normal **Let's Encrypt** certificate that every device
trusts automatically.

- **Free.** It uses a free DuckDNS name and a free Let's Encrypt certificate.
- **Nothing opened on the router.** The name points to the Pi's home IP, so the site is still only
  reachable at home. Let's Encrypt checks you own the name through a DNS record, not by visiting
  the Pi.
- **Renews automatically.** Caddy renews the certificate about 30 days before it expires, with no
  cron job needed.

## 1. Get a DuckDNS name

1. Go to [duckdns.org](https://www.duckdns.org) and sign in (Google, GitHub, etc.).
2. Add a sub domain, for example `huberhome`. That gives you `huberhome.duckdns.org`.
3. Copy the **token** shown at the top of the page.

## 2. Run the setup script on the Pi

The Pi should have a fixed IP (reserve one in your router's settings).

```bash
cd ~/paloalto_parser/random/familyhomecenter     # wherever the repo is
git pull
sudo ./scripts/setup-letsencrypt.sh huberhome YOUR-DUCKDNS-TOKEN 192.168.1.50
```

The script does six things:

1. Points `huberhome.duckdns.org` at `192.168.1.50`. If you leave the IP off, it uses the Pi's
   current IP.
2. Installs Caddy if it isn't installed, and adds Caddy's DuckDNS module.
3. Stores the token in `/etc/caddy/duckdns.env`, readable only by root.
4. Backs up `/etc/caddy/Caddyfile` and then **adds** a new site to it. Your existing `https://<ip>`
   site keeps working.
5. Restarts Caddy and waits for the certificate.
6. Prints `Done: https://huberhome.duckdns.org`.

It's safe to run again.

## 3. Use the new address everywhere

- Open `https://huberhome.duckdns.org` on phones, tablets and computers. There's no certificate
  warning, so you can install it again with Add to Home Screen.
- On the tablets, set Fully Kiosk's start URL to the new address. You can turn "Ignore SSL errors"
  back off.
- If you added Caddy's root certificate to any devices earlier, it does no harm to leave it there.

## Spotify, Google, etc.

Spotify only accepts an **https** redirect address (except `127.0.0.1`).

1. In the Spotify Developer Dashboard, add this redirect URI:
   `https://huberhome.duckdns.org/api/music/spotify/callback`
2. In `.env`, set:

   ```
   SPOTIFY_REDIRECT_URI=https://huberhome.duckdns.org/api/music/spotify/callback
   ```

3. Run `sudo systemctl restart familyhomecenter`.

## Good to know

- **Upgrading Caddy:** use `sudo caddy upgrade`, not `apt upgrade`. The script holds the apt
  package, because apt's Caddy doesn't include the DuckDNS module and renewals would stop.
- **If the Pi's IP changes,** run the script again with the new IP.
- **Checking renewals:** run `journalctl -u caddy | grep -i -E "certificate|renew"`. To see the
  current expiry date, run:

  ```bash
  echo | openssl s_client -connect huberhome.duckdns.org:443 2>/dev/null | openssl x509 -noout -enddate
  ```

- **If the name doesn't resolve at home but works elsewhere:** some routers block public names
  that point at home IPs ("DNS rebinding protection"). Either allow `duckdns.org` in the router,
  or, if you run Pi-hole, add a **Local DNS record** `huberhome.duckdns.org → 192.168.1.50`.
- **If the script says "No certificate yet":** look at `journalctl -u caddy -n 50 --no-pager`. A
  wrong token shows up as a DuckDNS error there. Fix it and run the script again.
- **To undo:** the backup is `/etc/caddy/Caddyfile.backup-<date>`. Copy it back and run
  `sudo systemctl restart caddy`.
