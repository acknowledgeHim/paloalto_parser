# 🔑 Passwords — a private password manager for each person

Each person gets their own password vault, using **Vaultwarden**: a free server for the Bitwarden
password manager that runs on the Pi.

- **Only you can see yours.** Each vault is encrypted on your own device with your **master
  password** before it's sent to the Pi. The Pi, the Family Home Center app, and parents only ever
  hold scrambled data. Nobody can open someone else's vault, parents included.
- **Two passwords to get in.** The app's **🔑 Passwords** page (🛠️ More menu) asks for your Family
  Home Center password again every time, and locks again after 2 minutes. The vault then asks for
  your master password.
- **Free apps that fill in passwords for you.** The Bitwarden phone apps and browser extensions work
  with it. At their login screen, choose **Self-hosted** and enter the vault's address.
- **At home only.** It's reachable on the home network, like the rest of the app.

> ⚠️ **A forgotten master password can't be reset.** That's what keeps the vault private. If it's
> forgotten, that vault is gone and its passwords need setting up again. Have each person write
> theirs down somewhere safe; for younger kids, a parent can keep it in a sealed envelope.

## 1. Install it on the Pi

```bash
cd ~/paloalto_parser/random/familyhomecenter     # wherever the repo is
git pull
sudo ./scripts/setup-vaultwarden.sh 192.168.1.50   # the Pi's IP; leave it off to use the current one
```

The script:

1. Installs Docker, if it isn't installed already.
2. Runs Vaultwarden, with its data in `/var/lib/vaultwarden`.
3. Adds `https://192.168.1.50:8443` to Caddy. It backs up the Caddyfile first, and your existing
   site keeps working.
4. Opens sign-ups, so everyone can create an account.

It's safe to run again (for example, to update Vaultwarden). It never deletes the vaults.

## 2. Everyone makes an account

On each person's device, open **🔑 Passwords** in the app, type your password, then **Open my
passwords** → **Create account**.

- **Email:** any email-shaped name works, for example `ben@home.family`. Nothing is emailed.
- **Master password:** something you'll remember. A short sentence works well.
- **Then:** in the vault's **Settings**, set **Vault timeout** to **On refresh** (or 1 minute), so
  it locks again when you leave.

The 🔑 Passwords page needs a Family Home Center password set for that person. A parent sets it in
**Settings** → the person's profile.

## 3. Close sign-ups

Once everyone has an account, run:

```bash
sudo ./scripts/setup-vaultwarden.sh --lock
```

To add someone later, run `--unlock`, have them create their account, then run `--lock` again.

## Certificate

The vault is on the Pi's https address, which uses the same Caddy certificate as the app. A device
needs to trust it first: **Settings → 🔒 This device's certificate**. The web vault won't work over
plain http, because browsers only allow its encryption on https.

If you set up Let's Encrypt ([LETSENCRYPT_SETUP.md](LETSENCRYPT_SETUP.md)), you can give the vault a
trusted address too. Add this to `/etc/caddy/Caddyfile`, using your own name:

```
huberhome.duckdns.org:8443 {
	tls {
		dns duckdns {env.DUCKDNS_API_TOKEN}
		resolvers 1.1.1.1
	}
	reverse_proxy 127.0.0.1:8222
}
```

Then set these, restart Vaultwarden, and restart the app:

- In `/etc/vaultwarden.env`: `DOMAIN=https://huberhome.duckdns.org:8443`. Restart Vaultwarden with
  `sudo docker restart vaultwarden`.
- In the app's `.env`: `VAULTWARDEN_URL=https://huberhome.duckdns.org:8443`.

## Good to know

- **Backups:** the vaults aren't in the app's backup. See [BACKUP.md](BACKUP.md):
  `sudo tar czf ~/vaultwarden-$(date +%F).tar.gz -C /var/lib vaultwarden`.
- **Updating:** run the script again. It pulls the latest Vaultwarden and keeps the data.
- **Logs:** `sudo docker logs vaultwarden`
- **The vault's admin page is off.** No admin token is set, so there's no page that can list or
  manage accounts.

## Troubleshooting: the vault tab says "This page cannot be displayed"

Run these on the Pi, in order:

1. **Is Vaultwarden running?** The 🔑 Passwords page also says so when it isn't.

   ```bash
   sudo docker ps --filter name=vaultwarden     # should list one line
   curl -s http://127.0.0.1:8222/alive          # should print a date
   ```

   If nothing comes back, run `sudo ./scripts/setup-vaultwarden.sh`. If it fails, look at
   `sudo docker logs vaultwarden`.

2. **Is Caddy serving port 8443?**

   ```bash
   grep -n 8443 /etc/caddy/Caddyfile            # should show https://<pi-ip>:8443 {
   sudo ss -ltnp | grep 8443                    # should show caddy listening
   curl -sk https://<pi-ip>:8443/alive          # should print a date
   ```

   If there's no 8443 block, run the setup script again. If the block is there but Caddy isn't
   listening, run `sudo systemctl restart caddy` and then check `journalctl -u caddy -n 30 --no-pager`.

3. **Is the address the same one you open the app with?** Caddy only serves the exact address in
   the Caddyfile. If you open the app as `https://familyhub.local` but the block says
   `https://192.168.1.50:8443`, the tab can't load. Either use the IP, or run the script with that
   name: `sudo ./scripts/setup-vaultwarden.sh familyhub.local`. Then set `VAULTWARDEN_URL` in `.env`
   to match.

4. **Is a firewall blocking it?** If `sudo ufw status` says active, run `sudo ufw allow 8443/tcp`.

5. **Is it the certificate?** A certificate warning (rather than "can't be displayed") means the
   device needs the Pi's certificate: **Settings → 🔒 This device's certificate**.
