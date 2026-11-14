#!/usr/bin/env bash
# Pull the latest built output from the fhc-deploy branch and restart the app if anything changed.
# Run by the fhc-update.timer every couple of minutes (and safe to run by hand). Additive and safe:
# it only ever touches the built files in the deploy checkout — never your data, uploads or .env.
set -euo pipefail

DEPLOY="${FHC_DEPLOY_DIR:-/home/pi/fhc}"
cd "$DEPLOY"

before="$(git rev-parse HEAD 2>/dev/null || echo none)"
git fetch --quiet origin fhc-deploy
git reset --hard --quiet origin/fhc-deploy   # the branch is force-pushed; reset tracks it
after="$(git rev-parse HEAD)"

if [ "$before" = "$after" ]; then
  exit 0   # nothing new since last time
fi

echo "fhc-update: $before -> $after"

cd "$DEPLOY/server"
# Re-install production dependencies only when the lockfile actually changed (this rebuilds the
# native modules — better-sqlite3, sharp — for this Pi, which is why they can't ship from CI).
if ! cmp -s package-lock.json .deployed-lock 2>/dev/null; then
  echo "fhc-update: dependencies changed — npm ci --omit=dev"
  npm ci --omit=dev
  cp package-lock.json .deployed-lock
fi

sudo systemctl restart familyhomecenter
echo "fhc-update: restarted familyhomecenter"
