#!/usr/bin/env bash
#
# Set up Family Home Center on a device from the built-only `fhc-deploy` branch (no source, no
# history). Two modes, picked automatically:
#
#   • NEW DEVICE (fresh install) — no existing install found: makes a fresh data folder and an .env
#     from .env.example for you to fill in.
#   • EXISTING DEVICE (migrate) — an existing install is found: SYMLINKS your current data + .env into
#     the new folder. Nothing is ever moved or deleted; your database, photos, movies and camera clips
#     stay exactly where they are.
#
# Re-running is safe (idempotent). Review before running. Override the defaults by exporting the
# FHC_* variables below. Force a mode with FHC_FRESH=1 (new) or FHC_FRESH=0 (migrate).
set -euo pipefail

REPO="${FHC_REPO:-https://github.com/acknowledgeHim/paloalto_parser.git}"
DEPLOY="${FHC_DEPLOY_DIR:-/home/pi/fhc}"
OLD="${FHC_OLD_DIR:-/home/pi/paloalto_parser/random/familyhomecenter}"
USER_NAME="${FHC_USER:-pi}"
NODE_BIN="${FHC_NODE:-/usr/bin/node}"

OLD_DATA="$OLD/server/data"
OLD_ENV="$OLD/.env"

# --- decide the mode ---
FRESH="${FHC_FRESH:-}"
if [ -z "$FRESH" ]; then
  if [ -e "$OLD_DATA" ] || [ -e "$OLD_ENV" ]; then FRESH=0; else FRESH=1; fi
fi

echo "== Family Home Center setup =="
echo "   mode       : $([ "$FRESH" = 1 ] && echo 'NEW DEVICE (fresh)' || echo 'MIGRATE (link existing data)')"
echo "   deploy dir : $DEPLOY"
echo "   user       : $USER_NAME"
[ "$FRESH" = 0 ] && { echo "   data stays : $OLD_DATA"; echo "   .env stays : $OLD_ENV"; }
echo

# --- 1. clone / update ONLY the built-only branch (no source, no history) ---
if [ ! -d "$DEPLOY/.git" ]; then
  echo "-- Cloning the fhc-deploy branch (built output only) into $DEPLOY"
  git clone --single-branch --branch fhc-deploy --depth 1 "$REPO" "$DEPLOY"
else
  echo "-- $DEPLOY already a checkout; fetching latest"
  git -C "$DEPLOY" fetch --quiet origin fhc-deploy
  git -C "$DEPLOY" reset --hard --quiet origin/fhc-deploy
fi

# --- 2. data + .env ---
if [ "$FRESH" = 1 ]; then
  # new device: a real (empty) data folder — the app creates its database on first boot
  echo "-- Fresh data folder: $DEPLOY/server/data"
  mkdir -p "$DEPLOY/server/data"
  if [ ! -e "$DEPLOY/.env" ]; then
    echo "-- Creating .env from .env.example — EDIT IT before the app is useful"
    cp "$DEPLOY/.env.example" "$DEPLOY/.env"
    echo "   ^ fill in $DEPLOY/.env (API keys, paths, etc.), then: sudo systemctl restart familyhomecenter"
  fi
else
  # existing device: the old data + .env must be there, or we would start empty
  [ -e "$OLD_DATA" ] || { echo "!! No data at $OLD_DATA — set FHC_OLD_DIR (or FHC_FRESH=1). Nothing changed."; exit 1; }
  [ -e "$OLD_ENV" ]  || { echo "!! No .env at $OLD_ENV — set FHC_OLD_DIR (or FHC_FRESH=1). Nothing changed."; exit 1; }
  if [ ! -e "$DEPLOY/server/data" ]; then
    echo "-- Linking data (never moved): $DEPLOY/server/data -> $OLD_DATA"
    ln -s "$OLD_DATA" "$DEPLOY/server/data"
  else echo "-- $DEPLOY/server/data already present (leaving it)"; fi
  if [ ! -e "$DEPLOY/.env" ]; then
    echo "-- Linking .env (never moved): $DEPLOY/.env -> $OLD_ENV"
    ln -s "$OLD_ENV" "$DEPLOY/.env"
  else echo "-- $DEPLOY/.env already present (leaving it)"; fi
fi

# --- 3. install production dependencies (builds better-sqlite3 + sharp for this device) ---
echo "-- Installing production dependencies (compiles native modules; takes a few minutes)"
( cd "$DEPLOY/server" && npm ci --omit=dev && cp package-lock.json .deployed-lock )

# --- 4. let the updater restart the service without a password ---
echo "-- Allowing '$USER_NAME' to restart the service (sudoers drop-in)"
printf '%s ALL=(root) NOPASSWD: /usr/bin/systemctl restart familyhomecenter\n' "$USER_NAME" \
  | sudo tee /etc/sudoers.d/fhc-update >/dev/null
sudo chmod 440 /etc/sudoers.d/fhc-update

# --- 5. install systemd units, adapted to this device's paths/user, and start ---
echo "-- Installing systemd units and (re)starting"
tmp="$(mktemp -d)"
sed -e "s#/home/pi/fhc#$DEPLOY#g" -e "s#^User=pi#User=$USER_NAME#" -e "s#/usr/bin/node#$NODE_BIN#" \
    "$DEPLOY/familyhomecenter.service" > "$tmp/familyhomecenter.service"
sed -e "s#/home/pi/fhc#$DEPLOY#g" -e "s#^User=pi#User=$USER_NAME#" \
    "$DEPLOY/fhc-update.service" > "$tmp/fhc-update.service"
cp "$DEPLOY/fhc-update.timer" "$tmp/fhc-update.timer"
sudo cp "$tmp/familyhomecenter.service" /etc/systemd/system/familyhomecenter.service
sudo cp "$tmp/fhc-update.service"        /etc/systemd/system/fhc-update.service
sudo cp "$tmp/fhc-update.timer"          /etc/systemd/system/fhc-update.timer
rm -rf "$tmp"
sudo systemctl daemon-reload
sudo systemctl restart familyhomecenter
sudo systemctl enable --now fhc-update.timer

echo
echo "== Done. =="
echo "   Runs from $DEPLOY (built output only) and auto-updates every ~2 minutes."
echo "   Check it:  systemctl status familyhomecenter --no-pager"
echo "   Then open the app → Settings → 🏷️ App version to confirm screen and server match."
if [ "$FRESH" = 1 ]; then
  echo
  echo "   NEW DEVICE: remember to edit $DEPLOY/.env, then: sudo systemctl restart familyhomecenter"
fi
