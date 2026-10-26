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

/**
 * For "time on each site": the pieces a site or app loads from other names, so watching YouTube
 * counts as youtube.com rather than googlevideo.com + ytimg.com.
 */
const APP_PARTS: Record<string, string> = {
  'googlevideo.com': 'youtube.com',
  'ytimg.com': 'youtube.com',
  'youtu.be': 'youtube.com',
  'youtube-nocookie.com': 'youtube.com',
  'youtubekids.com': 'youtube.com',
  'tiktokcdn.com': 'tiktok.com',
  'tiktokcdn-us.com': 'tiktok.com',
  'tiktokv.com': 'tiktok.com',
  'tiktokv.us': 'tiktok.com',
  'ibyteimg.com': 'tiktok.com',
  'byteoversea.com': 'tiktok.com',
  'musical.ly': 'tiktok.com',
  'rbxcdn.com': 'roblox.com',
  'rbx.com': 'roblox.com',
  'robloxlabs.com': 'roblox.com',
  'mojang.com': 'minecraft.net',
  'minecraftservices.com': 'minecraft.net',
  'nflxvideo.net': 'netflix.com',
  'nflximg.net': 'netflix.com',
  'nflxso.net': 'netflix.com',
  'nflxext.com': 'netflix.com',
  'cdninstagram.com': 'instagram.com',
  'fbcdn.net': 'facebook.com',
  'sc-cdn.net': 'snapchat.com',
  'snapkit.com': 'snapchat.com',
  'snap-dev.net': 'snapchat.com',
  'discordapp.com': 'discord.com',
  'discordapp.net': 'discord.com',
  'discord.gg': 'discord.com',
  'discord.media': 'discord.com',
  'epicgames.dev': 'epicgames.com',
  'fortnite.com': 'epicgames.com',
  'scdn.co': 'spotify.com',
  'spotifycdn.com': 'spotify.com',
  'ttvnw.net': 'twitch.tv',
  'jtvnw.net': 'twitch.tv',
  'bamgrid.com': 'disneyplus.com',
  'dssott.com': 'disneyplus.com',
  'disney-plus.net': 'disneyplus.com',
  'pinimg.com': 'pinterest.com',
  'redd.it': 'reddit.com',
  'redditmedia.com': 'reddit.com',
  'redditstatic.com': 'reddit.com',
  'twimg.com': 'x.com',
  'twitter.com': 'x.com',
  'whatsapp.net': 'whatsapp.com',
  'xboxlive.com': 'xbox.com',
  'playstation.net': 'playstation.com',
  'nintendo.net': 'nintendo.com',
};

/** Behind-the-scenes plumbing every site and app uses — never what someone was actually doing. */
const PLUMBING = new Set([
  'gstatic.com', 'googleapis.com', 'gvt1.com', 'gvt2.com', 'googleusercontent.com', 'google-analytics.com',
  'googletagmanager.com', 'googlesyndication.com', 'doubleclick.net', 'app-measurement.com', 'crashlytics.com',
  'firebaseio.com', 'cloudfront.net', 'akamaihd.net', 'akamaized.net', 'akamaiedge.net', 'akamai.net',
  'edgekey.net', 'edgesuite.net', 'fastly.net', 'fastly-edge.com', 'cloudflare.com', 'cloudflare.net',
  'amazonaws.com', 'azureedge.net', 'msedge.net', 'trafficmanager.net', 'icloud.com', 'apple.com',
  'aaplimg.com', 'mzstatic.com', 'cdn-apple.com', 'jsdelivr.net', 'cloudflare-dns.com', 'digicert.com',
  'sentry.io', 'branch.io', 'appsflyer.com', 'adjust.com',
]);

/** The site a lookup's time counts toward, or null for plumbing. */
export function usageSite(site: string): string | null {
  const s = APP_PARTS[site] ?? site;
  return PLUMBING.has(s) ? null : s;
}

let lastCheck = Math.floor(Date.now() / 1000) - 60;

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
  const addHour = db.prepare(
    `INSERT INTO internet_usage_hours (family_member_id, day, hour, minutes) VALUES (?, ?, ?, 1)
     ON CONFLICT(family_member_id, day, hour) DO UPDATE SET minutes = minutes + 1`
  );
  const addSiteMinute = db.prepare(
    `INSERT INTO internet_site_minutes (family_member_id, day, site, minutes) VALUES (?, ?, ?, 1)
     ON CONFLICT(family_member_id, day, site) DO UPDATE SET minutes = minutes + 1`
  );
  const hour = new Date(now * 1000).getHours();
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
      if (active >= ACTIVE_LOOKUPS) {
        addMinute.run(memberId, day);
        addHour.run(memberId, day, hour);
        // This minute counts toward every site that was in use during it (not blocked, not plumbing).
        const used = new Set<string>();
        for (const [site, c] of sites) {
          const u = c.lookups > 0 ? usageSite(site) : null;
          if (u) used.add(u);
        }
        for (const u of used) addSiteMinute.run(memberId, day, u);
      }
      for (const [site, c] of sites) addSite.run({ m: memberId, day, site, ...c });
    })();
  }
}
