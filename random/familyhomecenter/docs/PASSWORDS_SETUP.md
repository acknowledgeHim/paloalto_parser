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
> To start someone again, see [Forgotten master password](#forgotten-master-password-or-removing-an-account).

## 🧰 What to install

- Docker and Vaultwarden: the setup script in §1 installs both (`sudo ./scripts/setup-vaultwarden.sh`).
- Caddy, for HTTPS (docs/INTERCOM_SETUP.md or docs/LETSENCRYPT_SETUP.md); the script adds the vault to it.
- The free Bitwarden apps or browser extensions on each person's devices (optional).

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

Then set these, rebuild Vaultwarden, and restart the app:

- In `/etc/vaultwarden.env`: `DOMAIN=https://huberhome.duckdns.org:8443`. Then rebuild the
  container so it reads the file again (see [Applying a change to /etc/vaultwarden.env](#applying-a-change-to-etcvaultwardenenv)).
  `docker restart` isn't enough, because the settings are read only when the container is created.
- In the app's `.env`: `VAULTWARDEN_URL=https://huberhome.duckdns.org:8443`.

Running the setup script again (including `--lock` / `--unlock`) writes `DOMAIN` back to
`https://<pi-ip>:8443`. After running it, put your `DOMAIN` line back and rebuild again.

### Applying a change to /etc/vaultwarden.env

The vaults are in `/var/lib/vaultwarden`, not in the container, so replacing the container keeps
them:

```bash
sudo docker rm -f vaultwarden
sudo docker run -d --name vaultwarden --restart unless-stopped \
  --env-file /etc/vaultwarden.env \
  -v /var/lib/vaultwarden:/data -p 127.0.0.1:8222:80 vaultwarden/server:latest
curl -s http://127.0.0.1:8222/alive     # should print a date
```

## Good to know

- **Backups:** the vaults aren't in the app's backup. See [BACKUP.md](BACKUP.md):
  `sudo tar czf ~/vaultwarden-$(date +%F).tar.gz -C /var/lib vaultwarden`.
- **Updating:** run the script again. It pulls the latest Vaultwarden and keeps the data.
- **Logs:** `sudo docker logs vaultwarden`
- **The vault's admin page is off.** No admin token is set, so there's no page that can list or
  manage accounts. [Forgotten master password](#forgotten-master-password-or-removing-an-account)
  shows how to turn it on for a few minutes when you need it.

## Changing a master password, or removing an account

**If the person knows their master password:**

- **Change it:** 🔑 Passwords → the vault → **Settings → Security → Master password**. Type the old
  one, then the new one twice. Everything in the vault stays. Other devices need to log in again.
- **Delete the account:** **Settings → My account → Delete account**, confirmed with the master
  password.

### Forgotten master password, or removing an account

Nobody can reset a forgotten master password, not even the admin page, because the vault is
encrypted with it. What you can do is **delete that one account** so the person can start again
with the same email. **That vault's passwords are gone for good**, so back up first.

1. **Back up all the vaults.** Nothing is deleted by this step:

   ```bash
   sudo tar czf ~/vaultwarden-$(date +%F).tar.gz -C /var/lib vaultwarden
   ```

2. **Make a one-time admin token** and keep it on screen:

   ```bash
   TOKEN=$(openssl rand -base64 33); echo "$TOKEN"
   ```

3. **Start Vaultwarden with the admin page on.** The vaults stay in `/var/lib/vaultwarden`:

   ```bash
   sudo docker rm -f vaultwarden
   sudo docker run -d --name vaultwarden --restart unless-stopped \
     --env-file /etc/vaultwarden.env -e ADMIN_TOKEN="$TOKEN" \
     -v /var/lib/vaultwarden:/data -p 127.0.0.1:8222:80 vaultwarden/server:latest
   ```

   The logs warn that the token is plain text. That's fine, because it's only on for a few minutes.

4. **Delete the account.** Open `https://<pi-ip>:8443/admin` and paste the token. Go to **Users**,
   find the person's email and press **Delete User**. Delete only that one user.
   - **Don't press Save** on the admin page's settings tabs. Saving writes
     `/var/lib/vaultwarden/config.json`, which would keep the admin page on.
   - The same page has **Remove 2FA** (for a lost second step, where the password is still known)
     and **Deauthorize sessions** (to log out a lost phone).

5. **Turn the admin page off again** by rebuilding without the token
   ([Applying a change to /etc/vaultwarden.env](#applying-a-change-to-etcvaultwardenenv)). Then
   `https://<pi-ip>:8443/admin` should say the admin panel is disabled.

6. **Let them make a new account:** run `sudo ./scripts/setup-vaultwarden.sh --unlock`, have them
   **Create account** in 🔑 Passwords, then run `--lock`. If you use your own `DOMAIN`, put it back
   afterwards (see [Certificate](#certificate)).

If an account was deleted by mistake, the backup from step 1 brings back **all** the vaults as they
were then. Anything saved since is lost, so do it straight away:

```bash
sudo docker stop vaultwarden
sudo mv /var/lib/vaultwarden /var/lib/vaultwarden.after-$(date +%F-%H%M)   # kept, not deleted
sudo tar xzf ~/vaultwarden-YYYY-MM-DD.tar.gz -C /var/lib
sudo docker start vaultwarden
```

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
