#!/usr/bin/env bash
# librespot --onevent hook: forwards Spotify Connect playback events to the dashboard so it can show
# "now playing" and pause local MPD playback on the same zone (see reportSpotifyEvent() in
# server/src/services/music/zoneManager.ts). librespot invokes this script with event details as
# environment variables — see https://github.com/librespot-org/librespot/blob/dev/EVENTS.md
set -euo pipefail

ZONE="${ZONE_NUMBER:?ZONE_NUMBER must be set (the librespot-zone@.service template sets this)}"
TOKEN="${INTERNAL_API_TOKEN:-}"
APP_URL="${FAMILYHOMECENTER_URL:-http://localhost:3000}"

# PLAYER_EVENT is one of: playing, paused, stopped, changed, started, volume_changed, ...
EVENT="${PLAYER_EVENT:-unknown}"

payload=$(cat <<JSON
{
  "event": "$EVENT",
  "meta": {
    "NAME": "${NAME:-}",
    "ARTISTS": "${ARTISTS:-}",
    "ALBUM": "${ALBUM:-}"
  }
}
JSON
)

curl -s -X POST "$APP_URL/api/music/internal/spotify-event/$ZONE" \
  -H "Content-Type: application/json" \
  -H "x-internal-token: $TOKEN" \
  -d "$payload" \
  --max-time 3 || true   # never let a slow/dead dashboard block librespot's own playback
