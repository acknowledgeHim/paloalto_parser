#!/usr/bin/env bash
# Real, trusted HTTPS for the Family Home Center from Let's Encrypt — free, renewed automatically,
# and nothing opened on the router. See docs/LETSENCRYPT_SETUP.md.
#
#   sudo ./scripts/setup-letsencrypt.sh <duckdns-name> <duckdns-token> [pi-lan-ip]
#
# e.g.  sudo ./scripts/setup-letsencrypt.sh huberhome 1234abcd-... 192.168.1.50
#   →  https://huberhome.duckdns.org
#
# How: the DuckDNS name points at the Pi's home-network IP; Caddy proves to Let's Encrypt that it
# owns the name with a DNS record (DNS-01 challenge) instead of a web request from the internet,
# then keeps renewing the certificate itself (~30 days before it expires). Safe to run again.
# Your existing Caddyfile is backed up and kept — the new site is added alongside it.
set -euo pipefail

NAME="${1:-}"
TOKEN="${2:-}"
IP="${3:-$(hostname -I | awk '{print $1}')}"
NAME="${NAME%.duckdns.org}"

if [[ $EUID -ne 0 ]]; then echo "Run with sudo." >&2; exit 1; fi
if [[ -z "$NAME" || -z "$TOKEN" ]]; then
  echo "Usage: sudo $0 <duckdns-name> <duckdns-token> [pi-lan-ip]" >&2
  echo "Get both at https://www.duckdns.org (sign in, add a sub domain, copy the token)." >&2
  exit 1
fi
DOMAIN="$NAME.duckdns.org"
CADDYFILE=/etc/caddy/Caddyfile

echo "==> Pointing $DOMAIN at $IP"
reply=$(curl -fsS "https://www.duckdns.org/update?domains=$NAME&token=$TOKEN&ip=$IP")
if [[ "$reply" != OK* ]]; then echo "DuckDNS said '$reply' — check the name and token." >&2; exit 1; fi

echo "==> Installing Caddy (if needed)"
if ! command -v caddy >/dev/null; then
  apt-get update
  apt-get install -y caddy
fi

echo "==> Adding the DuckDNS module to Caddy (if needed)"
if ! caddy list-modules 2>/dev/null | grep -q '^dns.providers.duckdns$'; then
  caddy add-package github.com/caddy-dns/duckdns
fi
# A plain `apt upgrade` would swap in a Caddy without the module (and the site would stop
# renewing). Upgrade with `sudo caddy upgrade` instead — it keeps the module.
apt-mark hold caddy >/dev/null

echo "==> Giving Caddy the DuckDNS token (readable by root only)"
install -m 600 /dev/null /etc/caddy/duckdns.env
printf 'DUCKDNS_API_TOKEN=%s\n' "$TOKEN" > /etc/caddy/duckdns.env
mkdir -p /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/duckdns.conf <<'EOF'
[Service]
EnvironmentFile=/etc/caddy/duckdns.env
EOF
systemctl daemon-reload

echo "==> Adding $DOMAIN to $CADDYFILE"
touch "$CADDYFILE"
backup="$CADDYFILE.backup-$(date +%Y%m%d-%H%M%S)"
cp "$CADDYFILE" "$backup"
if grep -q "^$DOMAIN {" "$CADDYFILE"; then
  echo "    already there — leaving it as is"
else
  cat >> "$CADDYFILE" <<EOF

# Family Home Center with a real Let's Encrypt certificate (scripts/setup-letsencrypt.sh).
# Caddy renews it automatically.
$DOMAIN {
	tls {
		dns duckdns {env.DUCKDNS_API_TOKEN}
		resolvers 1.1.1.1
	}
	reverse_proxy localhost:3000
}
EOF
fi

if ! (set -a; . /etc/caddy/duckdns.env; caddy validate --adapter caddyfile --config "$CADDYFILE" >/dev/null); then
  echo "Caddyfile didn't validate — putting the previous one back ($backup)." >&2
  cp "$backup" "$CADDYFILE"
  exit 1
fi
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy

echo "==> Waiting for the certificate (usually under a minute)"
for _ in $(seq 1 24); do
  if curl -fsS --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/music/spotify/status" >/dev/null 2>&1; then
    echo
    echo "Done: https://$DOMAIN  (trusted certificate, renews by itself)"
    echo "Previous Caddyfile kept at $backup"
    exit 0
  fi
  sleep 5
done
echo "No certificate yet — see: journalctl -u caddy -n 50 --no-pager" >&2
exit 1
