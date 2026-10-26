#!/usr/bin/env bash
# 🔑 A private password manager for each person in the house — Vaultwarden (a free, self-hosted
# Bitwarden server) on the Pi, behind Caddy at https://<pi-ip>:8443. See docs/PASSWORDS_SETUP.md.
#
#   sudo ./scripts/setup-vaultwarden.sh [pi-lan-ip]      install / update, sign-ups open
#   sudo ./scripts/setup-vaultwarden.sh --lock           everyone has an account: close sign-ups
#   sudo ./scripts/setup-vaultwarden.sh --unlock         open sign-ups again (adding someone new)
#
# Each person's vault is encrypted on their own device with their own master password before it
# reaches the Pi — the Pi (and any parent) only ever holds scrambled data, so nobody can open
# anyone else's. That also means a forgotten master password can't be reset: the vault is gone.
#
# Data lives in /var/lib/vaultwarden (back it up — see docs/BACKUP.md). Safe to run again; it never
# deletes that folder. Your existing Caddyfile is backed up and kept — the new site is added to it.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "Run with sudo." >&2; exit 1; fi

ENV_FILE=/etc/vaultwarden.env
DATA=/var/lib/vaultwarden
CADDYFILE=/etc/caddy/Caddyfile
PORT=8443
IMAGE=vaultwarden/server:latest

MODE=install
IP=""
case "${1:-}" in
  --lock) MODE=lock ;;
  --unlock) MODE=unlock ;;
  "") ;;
  *) IP="$1" ;;
esac

# Settings kept between runs (so --lock / --unlock remember the address).
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi
if [[ -z "$IP" ]]; then
  IP="${PI_IP:-$(hostname -I | awk '{print $1}')}"
fi
SIGNUPS="${SIGNUPS_ALLOWED:-true}"
[[ $MODE == lock ]] && SIGNUPS=false
[[ $MODE == unlock ]] && SIGNUPS=true
URL="https://$IP:$PORT"

echo "==> Installing Docker (if needed)"
if ! command -v docker >/dev/null; then
  apt-get update
  apt-get install -y docker.io
fi
systemctl enable --now docker >/dev/null

echo "==> Saving settings to $ENV_FILE"
install -m 600 /dev/null "$ENV_FILE.new"
cat > "$ENV_FILE.new" <<EOF
PI_IP=$IP
DOMAIN=$URL
SIGNUPS_ALLOWED=$SIGNUPS
SHOW_PASSWORD_HINT=false
INVITATIONS_ALLOWED=false
EOF
mv "$ENV_FILE.new" "$ENV_FILE"
mkdir -p "$DATA"

echo "==> Starting Vaultwarden (sign-ups $([[ $SIGNUPS == true ]] && echo open || echo closed))"
docker pull -q "$IMAGE" >/dev/null
# Replacing the container keeps everything — the vaults are in $DATA, not in the container.
docker rm -f vaultwarden >/dev/null 2>&1 || true
docker run -d --name vaultwarden --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -v "$DATA":/data \
  -p 127.0.0.1:8222:80 \
  "$IMAGE" >/dev/null

if [[ $MODE == install ]]; then
  echo "==> Adding $URL to $CADDYFILE"
  if ! command -v caddy >/dev/null; then
    apt-get update
    apt-get install -y caddy
  fi
  touch "$CADDYFILE"
  if grep -q "^https://$IP:$PORT {" "$CADDYFILE"; then
    echo "    already there — leaving it as is"
  else
    backup="$CADDYFILE.backup-$(date +%Y%m%d-%H%M%S)"
    cp "$CADDYFILE" "$backup"
    cat >> "$CADDYFILE" <<EOF

# 🔑 Passwords — Vaultwarden (scripts/setup-vaultwarden.sh). Same Caddy certificate as the app, so a
# device that trusts the app's https address trusts this too.
https://$IP:$PORT {
	tls internal
	reverse_proxy 127.0.0.1:8222
}
EOF
    if ! caddy validate --adapter caddyfile --config "$CADDYFILE" >/dev/null 2>&1; then
      echo "Caddyfile didn't validate — putting the previous one back ($backup)." >&2
      cp "$backup" "$CADDYFILE"
      exit 1
    fi
    echo "    previous Caddyfile kept at $backup"
  fi
  systemctl enable caddy >/dev/null 2>&1 || true
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
fi

echo "==> Waiting for it to answer"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8222/alive >/dev/null 2>&1; then
    echo
    echo "Done: $URL"
    if [[ $SIGNUPS == true ]]; then
      echo "Each person: open it (or the app's 🔑 Passwords page) → Create account."
      echo "When everyone has one:  sudo $0 --lock"
    else
      echo "Sign-ups are closed. To add someone new:  sudo $0 --unlock  (then --lock again)"
    fi
    echo "Optional: put  VAULTWARDEN_URL=$URL  in the app's .env (it guesses this address otherwise)."
    exit 0
  fi
  sleep 2
done
echo "Vaultwarden didn't answer — see: docker logs vaultwarden" >&2
exit 1
