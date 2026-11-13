#!/usr/bin/env bash
#
# One-time migration on the Raspberry Pi: switch the running app from the source checkout to the
# built-only `fhc-deploy` branch, and turn on the auto-update timer.
#
# SAFE / ADDITIVE: your database, photos, movies, camera clips and .env are NEVER moved or deleted.
# They stay exactly where they are; this only *symlinks* them into the new deploy folder. If a symlink
# is wrong the app would look empty, but your real data is untouched — fix the link and restart.
#
# Re-running this script is safe (idempotent). Review it before running. Defaults assume user `pi`.
set -euo pipefail

# --- where things are (override by exporting these before running) ---
REPO="${FHC_REPO:-https://github.com/acknowledgeHim/paloalto_parser.git}"
DEPLOY="${FHC_DEPLOY_DIR:-/home/pi/fhc}"
OLD="${FHC_OLD_DIR:-/home/pi/paloalto_parser/random/familyhomecenter}"
USER_NAME="${FHC_USER:-pi}"

OLD_DATA="$OLD/server/data"
OLD_ENV="$OLD/.env"

echo "== Family Home Center: migrate to built-only auto-deploy =="
echo "   deploy dir : $DEPLOY"
echo "   data stays : $OLD_DATA"
echo "   .env stays : $OLD_ENV"
echo

# --- 0. sanity: the existing data + .env must be there, or we would start empty ---
if [ ! -e "$OLD_DATA" ]; then
  echo "!! Existing data not found at $OLD_DATA"
  echo "   Set FHC_OLD_DIR to your current familyhomecenter folder and re-run. Nothing was changed."
  exit 1
fi
if [ ! -e "$OLD_ENV" ]; then
  echo "!! Existing .env not found at $OLD_ENV — set FHC_OLD_DIR and re-run. Nothing was changed."
  exit 1
fi

# --- 1. clone ONLY the built-only branch (no source, no history) ---
if [ ! -d "$DEPLOY/.git" ]; then
  echo "-- Cloning the fhc-deploy branch (built output only) into $DEPLOY"
  git clone --single-branch --branch fhc-deploy --depth 1 "$REPO" "$DEPLOY"
else
  echo "-- $DEPLOY already a checkout; fetching latest"
  git -C "$DEPLOY" fetch --quiet origin fhc-deploy
  git -C "$DEPLOY" reset --hard --quiet origin/fhc-deploy
fi

# --- 2. symlink the EXISTING data + .env into the deploy tree (additive; never move/delete) ---
if [ ! -e "$DEPLOY/server/data" ]; then
  echo "-- Linking data: $DEPLOY/server/data -> $OLD_DATA"
  ln -s "$OLD_DATA" "$DEPLOY/server/data"
else
  echo "-- $DEPLOY/server/data already present (leaving it)"
fi
if [ ! -e "$DEPLOY/.env" ]; then
  echo "-- Linking .env: $DEPLOY/.env -> $OLD_ENV"
  ln -s "$OLD_ENV" "$DEPLOY/.env"
else
  echo "-- $DEPLOY/.env already present (leaving it)"
fi

# --- 3. install production dependencies (builds better-sqlite3 + sharp for this Pi) ---
echo "-- Installing production dependencies (this compiles native modules; takes a few minutes)"
( cd "$DEPLOY/server" && npm ci --omit=dev && cp package-lock.json .deployed-lock )

# --- 4. let the updater restart the service without a password ---
echo "-- Allowing '$USER_NAME' to restart the service (sudoers drop-in)"
printf '%s ALL=(root) NOPASSWD: /usr/bin/systemctl restart familyhomecenter\n' "$USER_NAME" \
  | sudo tee /etc/sudoers.d/fhc-update >/dev/null
sudo chmod 440 /etc/sudoers.d/fhc-update

# --- 5. point systemd at the new location and turn on the auto-update timer ---
echo "-- Installing systemd units and (re)starting"
sudo cp "$DEPLOY/familyhomecenter.service" /etc/systemd/system/familyhomecenter.service
sudo cp "$DEPLOY/fhc-update.service"        /etc/systemd/system/fhc-update.service
sudo cp "$DEPLOY/fhc-update.timer"          /etc/systemd/system/fhc-update.timer
sudo systemctl daemon-reload
sudo systemctl restart familyhomecenter
sudo systemctl enable --now fhc-update.timer

echo
echo "== Done. =="
echo "   The app now runs from $DEPLOY (built output only) and auto-updates every ~2 minutes."
echo "   Check it:   systemctl status familyhomecenter --no-pager"
echo "   Then open the app → Settings → 🏷️ App version to confirm screen and server match."
echo
echo "   Your old source checkout at $OLD is now unused (it still holds your data + .env, which the"
echo "   links above point to). Leave it as-is. Only after you've confirmed the new deploy works AND"
echo "   have a backup, you may optionally remove the old *source* while keeping data + .env — see"
echo "   the 'Removing the old source' section of README.md. Do that by hand, not in this script."
