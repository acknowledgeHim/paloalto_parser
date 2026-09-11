#!/usr/bin/env bash
# Convenience installer for a fresh Raspberry Pi OS install.
# See ../docs/PI_SETUP.md for the full walkthrough — this just automates steps 3-5.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — edit it before continuing (weather location, photos dir, calendar creds)."
  exit 1
fi

echo "Installing server dependencies..."
(cd server && npm install && npm run build)

echo "Installing client dependencies..."
(cd client && npm install && npm run build)

echo "Done. Next steps:"
echo "  1. sudo cp scripts/familyhomecenter.service /etc/systemd/system/"
echo "     (edit User=/WorkingDirectory= in that file first if needed)"
echo "  2. sudo systemctl daemon-reload && sudo systemctl enable --now familyhomecenter"
echo "  3. Set up kiosk autostart — see docs/PI_SETUP.md step 6"
