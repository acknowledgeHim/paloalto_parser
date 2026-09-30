#!/usr/bin/env bash
# Generates /etc/mpd-zone1.conf .. mpd-zoneN.conf from mpd-zone.conf.template and creates each
# zone's state directory. Run once during setup (see docs/MUSIC_SETUP.md), and again if you move
# MUSIC_LIBRARY_DIR.
set -euo pipefail

ZONE_COUNT="${1:-4}"
MUSIC_DIR="${2:?Usage: $0 <zone_count> <music_dir> [data_dir]}"
DATA_DIR="${3:-/var/lib/familyhomecenter}"
TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_USER="$(whoami)"

# The service unit runs mpd as root (no User= — see mpd-zone@.service), and mpd refuses to start as
# root unless its config names an unprivileged user to drop to. Using whoever ran this script means
# it already owns everything below (the DATA_DIR chown right after) and, on Raspberry Pi OS, the
# default `pi` user is already in the `audio` group the ALSA devices need.
mkdir -p "$MUSIC_DIR"

for zone in $(seq 1 "$ZONE_COUNT"); do
  sudo mkdir -p "$DATA_DIR/mpd-zone$zone"
  sudo chown "$RUN_USER" "$DATA_DIR/mpd-zone$zone"
  sed -e "s|{{ZONE}}|$zone|g" -e "s|{{MUSIC_DIR}}|$MUSIC_DIR|g" -e "s|{{DATA_DIR}}|$DATA_DIR|g" -e "s|{{RUN_USER}}|$RUN_USER|g" \
    "$TEMPLATE_DIR/mpd-zone.conf.template" | sudo tee "/etc/mpd-zone$zone.conf" > /dev/null
  echo "wrote /etc/mpd-zone$zone.conf"
done

echo "Now: sudo systemctl enable --now mpd-zone@{1..$ZONE_COUNT}.service"
