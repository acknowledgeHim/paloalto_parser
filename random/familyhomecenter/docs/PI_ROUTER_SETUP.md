# The Pi as the home router (every device goes through Pi-hole)

With this setup nothing on Wi-Fi can get around Pi-hole, not even a device set to use 8.8.8.8 by
hand. The Pi becomes the router: it hands out addresses (DHCP), shares the internet connection, and
sends every DNS lookup to Pi-hole. The Wi-Fi router stays, as a plain **access point**.

```
            BEFORE                                     AFTER
ISP ─ Border router ─ Wi-Fi router ─ devices     ISP ─ Border router ─(eth0)─ Pi ─(eth1)─ Wi-Fi router (AP) ─ devices
                          └─ Pi                                       router · DHCP · Pi-hole
```

> **Why the Wi-Fi router can't stay a router behind the Pi:** a router hides every device behind
> its own address. Pi-hole would see one device (the router), so per-kid pauses, limits, filters
> and the usage graphs would stop working. In access point mode it's just a radio, and the Pi sees
> every phone and tablet by its real address.

Nothing here touches the app's data. The Pi gets a new address, though, so a few things that use
its address are updated at the end (step 8).

## Before you start

- **Hardware:** a **USB 3 gigabit Ethernet adapter** (about $15), because the Pi 5 has one Ethernet
  port. Pick one with a Realtek **RTL8153** or ASIX **AX88179** chip; both work with no driver
  install. Plug it into a **blue** USB port. You also need two Ethernet cables.
- **Pick the inside network:** these steps use `192.168.50.0/24`, with the Pi at
  **`192.168.50.1`**. It must be different from the border router's network. Check that with
  `ip -4 addr show eth0` while the Pi is still plugged into the border router (or look in the
  border router's admin page). If the border router uses `192.168.50.x`, use e.g. `192.168.60.x`
  everywhere below.
- **Pick a quiet time.** The Wi-Fi drops for a few minutes while you rewire.
- **Work from the Pi's own screen and keyboard**, or over SSH on a wired laptop. Wi-Fi goes away
  part-way through.
- **Keep the way back** (section [Undo](#undo-back-to-the-old-setup)) somewhere you can read
  without the internet, e.g. printed or on your phone's mobile data.
- **Back up first:** `cd ~/paloalto_parser/random/familyhomecenter/server && npm run backup`.

## 1. Plug in the adapter and find the names

```bash
ip -br link
```

The built-in port is `eth0`. The USB adapter shows up as `eth1` (or a name like
`enx00e04c680123`; if so, use that name everywhere this guide says `eth1`).

## 2. Set up the Pi's two connections

`eth0` (outside, to the border router) stays as it is: it gets an address from the border router
automatically.

`eth1` (inside, to the Wi-Fi access point) gets the fixed address. IPv6 stays off on the inside, so
devices can't get an IPv6 DNS server that skips Pi-hole:

```bash
sudo nmcli con add type ethernet ifname eth1 con-name lan \
  ipv4.method manual ipv4.addresses 192.168.50.1/24 ipv4.never-default yes \
  ipv6.method disabled connection.autoconnect yes
```

Turn on forwarding (passing traffic between the two ports):

```bash
echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-fhc-router.conf
sudo sysctl --system | grep ip_forward        # → net.ipv4.ip_forward = 1
```

## 3. The firewall: share the connection, force DNS through Pi-hole

Create `/etc/fhc-router.nft`. It has its own table, so it doesn't touch any other firewall rules
(for example Docker's, if you run Vaultwarden):

```bash
sudo tee /etc/fhc-router.nft >/dev/null <<'EOF'
# Family Home Center — the Pi as router (docs/PI_ROUTER_SETUP.md)
table inet fhc_router
delete table inet fhc_router
table inet fhc_router {
  chain prerouting {
    type nat hook prerouting priority dstnat;
    # Every DNS lookup from inside goes to Pi-hole, whatever server the device asked for.
    iifname "eth1" udp dport 53 redirect to :53
    iifname "eth1" tcp dport 53 redirect to :53
  }
  chain postrouting {
    type nat hook postrouting priority srcnat;
    # Share the internet connection.
    oifname "eth0" masquerade
  }
  chain forward {
    type filter hook forward priority filter; policy drop;
    ct state established,related accept
    # Docker's own containers (e.g. Vaultwarden) — Docker manages those.
    iifname "docker0" accept
    oifname "docker0" accept
    iifname "br-*" accept
    oifname "br-*" accept
    # Encrypted DNS-over-TLS (e.g. Android "Private DNS") would skip Pi-hole.
    iifname "eth1" oifname "eth0" tcp dport 853 drop
    iifname "eth1" oifname "eth0" udp dport 853 drop
    iifname "eth1" oifname "eth0" accept
  }
}
EOF
```

(The first two lines make it safe to load again: they clear only this table before re-adding it.)

**If Docker is installed** (`command -v docker`; the Vaultwarden setup installs it), Docker's own
firewall drops forwarded traffic by default. Let the inside network through it too. The small
script below does both, and a service runs it at boot (and again whenever Docker restarts):

```bash
sudo tee /usr/local/sbin/fhc-router-firewall >/dev/null <<'EOF'
#!/bin/sh
# Family Home Center — the Pi as router (docs/PI_ROUTER_SETUP.md)
set -e
nft -f /etc/fhc-router.nft
if iptables -L DOCKER-USER >/dev/null 2>&1; then
  iptables -C DOCKER-USER -i eth1 -o eth0 -j ACCEPT 2>/dev/null || iptables -I DOCKER-USER -i eth1 -o eth0 -j ACCEPT
  iptables -C DOCKER-USER -i eth0 -o eth1 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null \
    || iptables -I DOCKER-USER -i eth0 -o eth1 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
fi
EOF
sudo chmod +x /usr/local/sbin/fhc-router-firewall

sudo tee /etc/systemd/system/fhc-router-firewall.service >/dev/null <<'EOF'
[Unit]
Description=Family Home Center — Pi as router firewall (docs/PI_ROUTER_SETUP.md)
After=network-online.target docker.service
Wants=network-online.target
PartOf=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/fhc-router-firewall

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now fhc-router-firewall
sudo nft list table inet fhc_router | head -5      # → table inet fhc_router {
```

## 4. Turn on Pi-hole's DHCP server (only for the inside network)

In Pi-hole's admin page (`http://<pi>:8080/admin` or `/admin`): **Settings → DHCP**:

| Setting | Value |
|---|---|
| DHCP server enabled | ✅ |
| Start / End of range | `192.168.50.100` – `192.168.50.250` |
| Router (gateway) | `192.168.50.1` |
| Netmask | `255.255.255.0` |
| Lease time | `24h` |

Or the same from the command line:

```bash
sudo pihole-FTL --config dhcp.start 192.168.50.100
sudo pihole-FTL --config dhcp.end 192.168.50.250
sudo pihole-FTL --config dhcp.router 192.168.50.1
sudo pihole-FTL --config dhcp.netmask 255.255.255.0
sudo pihole-FTL --config dhcp.leaseTime 24h
# Never answer DHCP on the outside port (the border router does that there):
sudo pihole-FTL --config misc.dnsmasq_lines '["no-dhcp-interface=eth0"]'
sudo pihole-FTL --config dhcp.active true
```

Pi-hole only hands out `192.168.50.x` addresses on the port that's in that network (`eth1`). The
`no-dhcp-interface=eth0` line makes doubly sure it never competes with the border router.

**Pi-hole must answer DNS on `eth1`:** Settings → DNS → Interface settings → **"Allow only local
requests"** (the default) is right. Leave "Respond only on interface eth0" **off**.

Fixed addresses for things like printers or cameras: Settings → DHCP → **Static DHCP leases**.

## 5. Switch the Wi-Fi router to access point mode

**Linksys Smart Wi-Fi** (`http://myrouter.local` or `http://192.168.1.1`): **Connectivity →
Internet Settings → Connection Type → Bridge Mode** → "Obtain an IPv4 address automatically" →
Apply. **Velop app:** **Advanced Settings → Internet Settings → Connection Type → Bridge Mode**.
Other brands call it **Access Point mode** or **AP mode**.

This turns off the router's own DHCP and NAT. Its Wi-Fi name and password stay the same, so
devices reconnect by themselves. If there was a Linksys **DHCP reservation** for the Pi, it no
longer matters.

> The old DNS settings from [PIHOLE_SETUP.md](PIHOLE_SETUP.md) step 4 (Static DNS on the Linksys)
> don't matter any more either: the Pi now hands out itself as DNS.

## 6. Rewire

1. **Border router** (any LAN port) → **Pi `eth0`** (built-in port).
2. **Pi `eth1`** (USB adapter) → **Wi-Fi router**. In Linksys Bridge Mode that's its **Internet**
   port. Other brands' AP mode usually say which port to use; most accept either.
3. Any other wired devices (TV, console, switch) plug into the Wi-Fi router's LAN ports, as before.

Restart the Wi-Fi router and wait a couple of minutes.

## 7. Check it works

On the Pi:

```bash
ip -4 -br addr                      # eth0: border router's address · eth1: 192.168.50.1/24
ping -c2 -I eth0 1.1.1.1            # the Pi itself is online
pihole status                       # DNS and DHCP enabled
```

On a phone (turn Wi-Fi off and on first):

- Wi-Fi details show an address `192.168.50.1xx`, router `192.168.50.1`, DNS `192.168.50.1`.
- Websites open.
- **The test that matters:** set DNS by hand to `8.8.8.8` on a laptop or phone, then open an ad
  site. Ads stay blocked, because the Pi still answers.
- In the app: **Internet** page → **🔎 Find devices Pi-hole has seen**. Every phone and tablet should
  be listed by its own MAC address. Pi-hole's line at the top shows the number of active devices.

The kids' devices that were already added by **MAC address** keep working with no changes. Any
added by **IP address** need adding again (their addresses changed). Remove the old entry and add
them from "Find devices".

## 8. Update what uses the Pi's address

The Pi is now at `192.168.50.1` for everything inside the house. Open the app at
**`http://192.168.50.1:3000`** (or your https address below), and:

- **HTTPS / Caddy** ([INTERCOM_SETUP.md](INTERCOM_SETUP.md)): if `/etc/caddy/Caddyfile` names the
  old IP, change it to `192.168.50.1`, then `sudo systemctl reload caddy`. Devices that already
  trust the Pi's certificate keep trusting it (same Caddy). If you use a name like
  `familyhub.local`, nothing changes.
- **Let's Encrypt / DuckDNS** ([LETSENCRYPT_SETUP.md](LETSENCRYPT_SETUP.md)): run the script again
  with the new address: `sudo ./scripts/setup-letsencrypt.sh <name> <token> 192.168.50.1`.
- **🔑 Passwords / Vaultwarden** ([PASSWORDS_SETUP.md](PASSWORDS_SETUP.md)):
  `sudo ./scripts/setup-vaultwarden.sh 192.168.50.1`. Vaults are kept. In the Bitwarden apps, change
  the self-hosted server address to `https://192.168.50.1:8443`.
- **`.env`:** check any address with the old IP (e.g. `SPOTIFY_REDIRECT_URI`, `VAULTWARDEN_URL`).
  `PIHOLE_URL=http://localhost…` stays as it is. Then `sudo systemctl restart familyhomecenter`.
- **Wall tablets / bookmarks / home-screen apps:** open the new address once and re-add them.
- **SMB photo share:** if `PHOTOS_DIR` mounts a NAS by IP and the NAS is now inside, it has a new
  `192.168.50.x` address. Give it a **Static DHCP lease** in Pi-hole and update the mount.

## If something goes wrong

- **Nobody gets an address (phones show "no internet" / `169.254.x.x`):** `pihole status` should
  say DHCP is enabled. Check the cable goes to `eth1` and that `ip -4 -br addr` shows
  `192.168.50.1` on it.
- **Devices get an address but no websites:**
  - `cat /proc/sys/net/ipv4/ip_forward` must be `1`.
  - `sudo nft list table inet fhc_router` must show the rules. If it doesn't, run
    `sudo systemctl restart fhc-router-firewall`.
  - With Docker: `sudo iptables -L DOCKER-USER -n` should show the two ACCEPT lines.
- **Websites work but ads aren't blocked:** `sudo nft list chain inet fhc_router prerouting` should
  show the two `redirect` lines, and `pihole -t` should scroll while a phone browses.
- **A browser still skips Pi-hole:** browsers using DNS-over-HTTPS go over normal web traffic. In
  Pi-hole, **Lists** → add a DoH bypass list, e.g. HaGeZi's **DoH/VPN/TOR/Proxy Bypass**
  (`https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/adblock/doh-vpn-proxy-bypass.txt`),
  then **Tools → Update Gravity**. Pi-hole v6 already blocks Firefox's automatic DoH and iCloud
  Private Relay by default.
- **The Pi is down = the house is offline.** Use the undo below until it's fixed.

## Undo (back to the old setup)

Quick way, if the Pi has died: plug the **Wi-Fi router's Internet port straight into the border
router** and set it back from Bridge Mode to **Automatic Configuration – DHCP** (its normal router
mode). Everything is back as before within a few minutes.

To also undo the Pi's side:

```bash
sudo pihole-FTL --config dhcp.active false
sudo systemctl disable --now fhc-router-firewall
sudo nft delete table inet fhc_router
sudo nmcli con delete lan
sudo rm /etc/sysctl.d/99-fhc-router.conf
```

(Forwarding stays on until the next reboot. That's harmless, and Docker needs it on anyway.)

Then plug the Pi back into the Wi-Fi router and redo step 8 with its old address.
