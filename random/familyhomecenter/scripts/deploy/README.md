# Family Home Center — auto-deploy (built output only)

This makes two things true:

1. **The build refreshes itself.** Every push that changes `random/familyhomecenter/**` triggers a
   GitHub Action that builds the client and server and publishes **only the built output** to the
   `fhc-deploy` branch. A timer on the Pi pulls that branch every ~2 minutes and restarts the app, so
   the running app keeps up with your changes with no manual `npm run build`.
2. **The Pi doesn't carry the source.** The Pi tracks a single-branch checkout of `fhc-deploy`, which
   contains compiled JavaScript (the client is minified by Vite), `package.json`/lockfile, and the
   `geo/places.json` data file — **no TypeScript, no git history of the source.**

Native modules (`better-sqlite3`, `sharp`) are built per-device, so they are **not** shipped from CI;
the Pi installs production dependencies itself (`npm ci --omit=dev`), which compiles them for its ARM
CPU. That's the only thing built on the Pi.

## Files here

| File | What it is |
|------|------------|
| `familyhomecenter.service` | systemd unit pointing at the new `/home/pi/fhc/server` location |
| `fhc-update.sh` | pulls `fhc-deploy`, reinstalls deps only if the lockfile changed, restarts |
| `fhc-update.service` / `.timer` | runs `fhc-update.sh` every ~2 minutes |
| `fhc-pi-setup.sh` | one-time migration (clone branch, link data + .env, install units) |

The workflow that produces all this is `.github/workflows/fhc-deploy.yml` at the repo root.

## One-time setup on the Pi

> Do this once. It is **additive**: your database, photos, movies, camera clips and `.env` are never
> moved or deleted — they are *symlinked* into the new folder from where they already live.

1. Make sure the Action has run at least once (push any change, or run the workflow by hand from the
   GitHub **Actions** tab), so the `fhc-deploy` branch exists.
2. On the Pi, back up as usual first. Then fetch and review the setup script, and run it:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/acknowledgeHim/paloalto_parser/fhc-deploy/setup.sh -o /tmp/fhc-setup.sh
   less /tmp/fhc-setup.sh        # read it
   bash /tmp/fhc-setup.sh
   ```
   If your paths differ from the defaults (`/home/pi/fhc`, `/home/pi/paloalto_parser/...`, user `pi`),
   set `FHC_DEPLOY_DIR`, `FHC_OLD_DIR`, `FHC_USER` before running.
3. Open the app → **Settings → 🏷️ App version** and confirm the screen and server versions match.

From now on you don't build on the Pi. Push your changes; a couple of minutes later the Pi has them.

## Checking / troubleshooting

```bash
systemctl status familyhomecenter --no-pager      # the app
systemctl status fhc-update.timer --no-pager      # the auto-updater
journalctl -u fhc-update.service -n 50 --no-pager # recent update runs
/home/pi/fhc/update.sh                             # force an update now
```

If App version keeps warning that screen and server differ, the Pi hasn't pulled yet (wait, or run
`update.sh`), or the Action hasn't finished — check the GitHub **Actions** tab.

## Removing the old source (optional, by hand)

After the new deploy has run for a while **and you have a backup**, you can remove the old *source*
checkout so the Pi carries no source at all. Keep the data and `.env` the links point to. Do this
manually, carefully — never scripted:

```bash
# the symlinks in /home/pi/fhc point here; keep these two:
#   /home/pi/paloalto_parser/random/familyhomecenter/server/data
#   /home/pi/paloalto_parser/random/familyhomecenter/.env
# remove only the source of THIS app, not the data folder.
```

The simplest safe option is to leave the old checkout in place (it just sits there, unused, holding
the data). Only prune it if you specifically want the source gone, and move/keep `server/data` and
`.env` first. If in doubt, leave it.
