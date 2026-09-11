#!/usr/bin/env bash
# Generates /etc/mpd-zone1.conf .. mpd-zoneN.conf from mpd-zone.conf.template and creates each
# zone's state directory. Run once during setup (see docs/MUSIC_SETUP.md), and again if you move
# MUSIC_LIBRARY_DIR.
set -euo pipefail

ZONE_COUNT="${1:-4}"
MUSIC_DIR="${2:?Usage: $0 <zone_count> <music_dir> [data_dir]}"
DATA_DIR="${3:-/var/lib/familyhomecenter}"
TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for zone in $(seq 1 "$ZONE_COUNT"); do
  sudo mkdir -p "$DATA_DIR/mpd-zone$zone"
  sudo chown "$(whoami)" "$DATA_DIR/mpd-zone$zone"
  sed -e "s|{{ZONE}}|$zone|g" -e "s|{{MUSIC_DIR}}|$MUSIC_DIR|g" -e "s|{{DATA_DIR}}|$DATA_DIR|g" \
    "$TEMPLATE_DIR/mpd-zone.conf.template" | sudo tee "/etc/mpd-zone$zone.conf" > /dev/null
  echo "wrote /etc/mpd-zone$zone.conf"
done

echo "Now: sudo systemctl enable --now mpd-zone@{1..$ZONE_COUNT}.service"
