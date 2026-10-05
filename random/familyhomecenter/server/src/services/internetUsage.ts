import { db } from '../db.js';
import * as pihole from './pihole.js';
import { BLOCKED_STATUSES, localDay, siteForDomain, type InternetDevice } from './internetControl.js';

/**
 * Estimates how long each kid is online, for daily time allowances (services/internetControl.ts)
 * and the weekly report — from Pi-hole's lookup log, since that's all a DNS server can see.
 *
 * Once a minute: for each person's devices, look at the lookups made since the last check. The
 * minute counts as "online" if there were at least ACTIVE_LOOKUPS real ones — ignoring blocked
 * lookups and the background chatter phones and tablets do all the time even sitting idle in a
 * drawer (push notifications, clock sync, "am I online?" checks). It's an estimate: a video that
 * streams for an hour without new lookups can be under-counted, and an app syncing in the
 * background can occasionally count. Good enough to tell 30 minutes from 3 hours.
 */

const ACTIVE_LOOKUPS = 3;
const SITE_COUNT_DAYS = 60;

/** Lookups devices make on their own, not because someone's using them. */
const BACKGROUND = [
  /(^|\.)push\.apple\.com$/,
  /(^|\.)push-apple\.com\.akadns\.net$/,
  /^captive\.apple\.com$/,
  /(^|\.)time(-ios|-macos)?\.apple\.com$/,
  /(^|\.)mesu\.apple\.com$/,
  /(^|\.)gs-loc\.apple\.com$/,
  /^connectivitycheck\.(gstatic|android)\.com$/,
  /^clients\d*\.google\.com$/,
  /^mtalk\.google\.com$/,
  /^android\.clients\.google\.com$/,
  /^www\.msftconnecttest\.com$/,
  /(^|\.)msftncsi\.com$/,
  /(^|\.)pool\.ntp\.org$/,
  /^time\.(windows|google|cloudflare|nist)\.(com|gov)$/,
  /\.arpa$/,
  /\.local$/,
  /\.lan$/,
  /^wpad\b/,
];

function isBackground(domain: string): boolean {
  return BACKGROUND.some((re) => re.test(domain.toLowerCase()));
}

let lastCheck = Math.floor(Date.now() / 1000) - 60;
let lastPruneDay = '';

export async function trackUsageMinute(): Promise<void> {
  if (!pihole.isPiholeConfigured()) return;
  const devices = db.prepare('SELECT * FROM internet_devices WHERE family_member_id IS NOT NULL').all() as InternetDevice[];
  const now = Math.floor(Date.now() / 1000);
  const since = lastCheck;
  lastCheck = now;
  if (devices.length === 0) return;

  const byMember = new Map<string, InternetDevice[]>();
  for (const d of devices) byMember.set(d.family_member_id!, [...(byMember.get(d.family_member_id!) ?? []), d]);

  // Pi-hole's query log is by IP; MAC-identified devices are looked up in its network table.
  const network = await pihole.listNetworkDevices();
  const ipsFor = (client: string): string[] => {
    if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(client)) return [client];
    return network.find((n) => n.hwaddr.toLowerCase() === client.toLowerCase())?.ips.map((i) => i.ip) ?? [];
  };

  const day = localDay(new Date(now * 1000));
  const addMinute = db.prepare(
    `INSERT INTO internet_usage (family_member_id, day, minutes) VALUES (?, ?, 1)
     ON CONFLICT(family_member_id, day) DO UPDATE SET minutes = minutes + 1`
  );
  const addSite = db.prepare(
    `INSERT INTO internet_site_counts (family_member_id, day, site, lookups, blocked) VALUES (@m, @day, @site, @lookups, @blocked)
     ON CONFLICT(family_member_id, day, site) DO UPDATE SET lookups = lookups + excluded.lookups, blocked = blocked + excluded.blocked`
  );

  for (const [memberId, memberDevices] of byMember) {
    let active = 0;
    const sites = new Map<string, { lookups: number; blocked: number }>();
    for (const device of memberDevices) {
      for (const ip of ipsFor(device.client)) {
        for (const q of await pihole.getQueriesForClient(ip, 500)) {
          if (q.time <= since || q.time > now || isBackground(q.domain)) continue;
          const blocked = Boolean(q.status && BLOCKED_STATUSES.has(q.status));
          if (!blocked) active++;
          const site = siteForDomain(q.domain);
          const entry = sites.get(site) ?? { lookups: 0, blocked: 0 };
          if (blocked) entry.blocked++;
          else entry.lookups++;
          sites.set(site, entry);
        }
      }
    }
    db.transaction(() => {
      if (active >= ACTIVE_LOOKUPS) addMinute.run(memberId, day);
      for (const [site, c] of sites) addSite.run({ m: memberId, day, site, ...c });
    })();
  }

  if (lastPruneDay !== day) {
    lastPruneDay = day;
    const cutoff = localDay(new Date(Date.now() - SITE_COUNT_DAYS * 86_400_000));
    db.prepare('DELETE FROM internet_site_counts WHERE day < ?').run(cutoff);
  }
}
