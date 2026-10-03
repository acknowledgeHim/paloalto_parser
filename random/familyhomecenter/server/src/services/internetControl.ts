import cron from 'node-cron';
import { db, getSetting, setSetting } from '../db.js';
import * as pihole from './pihole.js';

/**
 * Per-person internet rules (pause, bedtime schedules, kid web filter), enforced by Pi-hole.
 *
 * How it maps onto Pi-hole: this app owns two Pi-hole groups —
 *   - "FHC Paused": holds a single deny regex matching every domain, so a device in this group
 *     can't look anything up (= no internet, short of an address it already knows).
 *   - "FHC Kid filter": the family-filter blocklists (adult content, gambling, …) plus any sites a
 *     parent blocked from this page.
 * Each device assigned to a family member is put into / taken out of those two groups to match that
 * person's current rules, re-checked every minute (so schedules start and end on time) and right
 * after any change. A device's other Pi-hole groups (e.g. Default, so ads stay blocked) are left
 * alone. "Always allowed" sites are allow-entries scoped to both groups, so they keep working even
 * while paused.
 *
 * "Approved sites only" mode reuses the paused group's block-everything rule: the kid's devices go
 * into "FHC Paused" plus their own "FHC Approved <id>" group, which holds allow-entries for just
 * that kid's approved sites. An actual pause or schedule then simply drops the approved group, so
 * a paused approved-only kid is as offline as anyone else (household "always allowed" aside).
 *
 * This app's database is the source of truth; anything in Pi-hole can be rebuilt from it (the
 * "Repair Pi-hole setup" action does exactly that).
 */

const GROUP_PAUSED = 'FHC Paused';
const GROUP_FILTERED = 'FHC Kid filter';
/** Per-kid group for "approved sites only" — suffixed with the start of the member id (stable even
 *  if they're renamed); the comment carries the name for anyone browsing Pi-hole's own UI. */
const APPROVED_PREFIX = 'FHC Approved ';
function approvedGroupName(memberId: string): string {
  return `${APPROVED_PREFIX}${memberId.slice(0, 8)}`;
}
// Matches any domain at all. Deliberately not the more obvious ".*", so it can't collide with a
// catch-all regex someone added by hand in Pi-hole (each regex can only exist once).
const PAUSE_REGEX = '^.+$';
const COMMENT = 'Managed by Family Home Center';
/** paused_until value meaning "until a parent resumes it". */
const FOREVER = '9999-12-31T00:00:00.000Z';

const HAGEZI = 'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/adblock';

/** Blocklists available to the kid filter — HaGeZi's lists, in the Adblock format the list author
 *  recommends for Pi-hole. Each can be switched on/off from the Internet page. */
export const FILTER_CATEGORIES = [
  { key: 'adult', label: 'Adult content', url: `${HAGEZI}/nsfw.txt`, defaultOn: true },
  { key: 'gambling', label: 'Gambling', url: `${HAGEZI}/gambling.medium.txt`, defaultOn: true },
  {
    key: 'bypass',
    label: 'Ways around the filter (VPNs, proxies, private DNS)',
    url: `${HAGEZI}/doh-vpn-proxy-bypass.txt`,
    defaultOn: true,
  },
  {
    key: 'social',
    label: 'Social media (Facebook, Instagram, TikTok, Snapchat, X, Reddit, Discord…)',
    url: `${HAGEZI}/social.txt`,
    defaultOn: false,
  },
] as const;

const FILTER_SETTING_KEY = 'internet_filter_categories';

export function getEnabledFilterCategories(): string[] {
  const raw = getSetting(FILTER_SETTING_KEY, '');
  if (!raw) return FILTER_CATEGORIES.filter((c) => c.defaultOn).map((c) => c.key);
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function setEnabledFilterCategories(keys: string[]): void {
  const valid = keys.filter((k) => FILTER_CATEGORIES.some((c) => c.key === k));
  setSetting(FILTER_SETTING_KEY, JSON.stringify(valid));
}

// ---- Rows ----

export interface InternetDevice {
  id: string;
  client: string;
  name: string;
  family_member_id: string | null;
}

export type InternetMode = 'open' | 'filtered' | 'approved';

interface MemberRow {
  family_member_id: string;
  filtered: number;
  approved_only: number;
  paused_until: string | null;
  allowed_until: string | null;
}

export interface InternetSchedule {
  id: string;
  family_member_id: string;
  label: string;
  days: string;
  start_time: string;
  end_time: string;
  enabled: number;
}

export interface InternetSite {
  id: string;
  domain: string;
  kind: 'allow' | 'block';
}

export function getMemberRow(memberId: string): MemberRow {
  return (
    (db.prepare('SELECT * FROM internet_members WHERE family_member_id = ?').get(memberId) as MemberRow | undefined) ?? {
      family_member_id: memberId,
      filtered: 0,
      approved_only: 0,
      paused_until: null,
      allowed_until: null,
    }
  );
}

export function saveMemberRow(row: MemberRow): void {
  db.prepare(
    `INSERT INTO internet_members (family_member_id, filtered, approved_only, paused_until, allowed_until)
     VALUES (@family_member_id, @filtered, @approved_only, @paused_until, @allowed_until)
     ON CONFLICT(family_member_id) DO UPDATE SET
       filtered = excluded.filtered, approved_only = excluded.approved_only,
       paused_until = excluded.paused_until, allowed_until = excluded.allowed_until`
  ).run(row);
}

// ---- Working out someone's current state ----

function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

/** If any of these schedules is blocking right now, when the (latest-ending) one ends. Uses the
 *  server's local time (TZ in .env), like every other time-of-day feature in this app. */
export function activeScheduleEnd(schedules: InternetSchedule[], now: Date): { end: Date; label: string } | null {
  let result: { end: Date; label: string } | null = null;
  for (const s of schedules) {
    if (!s.enabled) continue;
    const days = new Set(s.days.split(',').filter(Boolean).map(Number));
    // Today's window, or yesterday's if it runs past midnight into today.
    for (const offset of [0, -1]) {
      const day = new Date(now);
      day.setDate(day.getDate() + offset);
      day.setHours(0, 0, 0, 0);
      if (!days.has(day.getDay())) continue;
      const start = atTime(day, s.start_time);
      const end = atTime(day, s.end_time);
      if (end <= start) end.setDate(end.getDate() + 1);
      if (now >= start && now < end && (!result || end > result.end)) result = { end, label: s.label };
    }
  }
  return result;
}

export interface MemberInternetState {
  paused: boolean;
  /** Why — a parent paused it, a schedule is blocking, or a parent allowed it through a schedule. */
  reason: 'paused' | 'schedule' | 'allowed' | null;
  /** When the current pause/schedule/allowance ends; null = until a parent changes it. */
  until: string | null;
  schedule_label: string | null;
  /** Only true in 'filtered' mode. */
  filtered: boolean;
  mode: InternetMode;
}

function rowMode(row: MemberRow): InternetMode {
  if (row.approved_only === 1) return 'approved';
  return row.filtered === 1 ? 'filtered' : 'open';
}

export function setMemberMode(memberId: string, mode: InternetMode): void {
  const row = getMemberRow(memberId);
  row.filtered = mode === 'filtered' ? 1 : 0;
  row.approved_only = mode === 'approved' ? 1 : 0;
  saveMemberRow(row);
}

export function memberState(memberId: string, now = new Date()): MemberInternetState {
  const row = getMemberRow(memberId);
  const mode = rowMode(row);
  const filtered = mode === 'filtered';
  if (row.paused_until && new Date(row.paused_until) > now) {
    return {
      paused: true,
      reason: 'paused',
      until: row.paused_until === FOREVER ? null : row.paused_until,
      schedule_label: null,
      filtered,
      mode,
    };
  }
  const schedules = db.prepare('SELECT * FROM internet_schedules WHERE family_member_id = ?').all(memberId) as InternetSchedule[];
  const active = activeScheduleEnd(schedules, now);
  if (row.allowed_until && new Date(row.allowed_until) > now) {
    return { paused: false, reason: active ? 'allowed' : null, until: active ? row.allowed_until : null, schedule_label: null, filtered, mode };
  }
  if (active) {
    return { paused: true, reason: 'schedule', until: active.end.toISOString(), schedule_label: active.label || null, filtered, mode };
  }
  return { paused: false, reason: null, until: null, schedule_label: null, filtered, mode };
}

/** Pauses for `minutes`, or until resumed if null. Overrides any allowance in effect. */
export function pauseMember(memberId: string, minutes: number | null): void {
  const row = getMemberRow(memberId);
  row.paused_until = minutes === null ? FOREVER : new Date(Date.now() + minutes * 60_000).toISOString();
  row.allowed_until = null;
  saveMemberRow(row);
}

/** Internet back on now. With `minutes`, only for that long (bonus time during a schedule);
 *  without, until the current schedule window (if any) ends — next night's bedtime still applies. */
export function resumeMember(memberId: string, minutes: number | null): void {
  const row = getMemberRow(memberId);
  row.paused_until = null;
  if (minutes !== null) {
    row.allowed_until = new Date(Date.now() + minutes * 60_000).toISOString();
  } else {
    const schedules = db.prepare('SELECT * FROM internet_schedules WHERE family_member_id = ?').all(memberId) as InternetSchedule[];
    row.allowed_until = activeScheduleEnd(schedules, new Date())?.end.toISOString() ?? null;
  }
  saveMemberRow(row);
}

// ---- Pi-hole setup ----

let groupIds: { paused: number; filtered: number } | null = null;

/** Makes sure this app's two Pi-hole groups and the pause regex exist — cached once it's worked,
 *  re-checked after any sync error (e.g. someone deleted a group in Pi-hole's own UI). */
async function ensureBaseSetup(): Promise<{ paused: number; filtered: number }> {
  if (groupIds) return groupIds;
  let groups = await pihole.listGroups();
  for (const name of [GROUP_PAUSED, GROUP_FILTERED]) {
    if (!groups.some((g) => g.name === name)) await pihole.createGroup(name, COMMENT);
  }
  groups = await pihole.listGroups();
  const paused = groups.find((g) => g.name === GROUP_PAUSED)?.id;
  const filtered = groups.find((g) => g.name === GROUP_FILTERED)?.id;
  if (paused === undefined || filtered === undefined) throw new Error("Couldn't create this app's Pi-hole groups");
  await pihole.upsertDomain('deny', 'regex', PAUSE_REGEX, `${COMMENT} — blocks everything while paused`, [paused]);
  groupIds = { paused, filtered };
  return groupIds;
}

/** A site entry as a Pi-hole regex covering the domain and all its subdomains (www., m., …). */
function siteRegex(domain: string): string {
  return `(^|\\.)${domain.replace(/\./g, '\\.')}$`;
}

export async function pushSite(site: InternetSite): Promise<void> {
  if (site.kind === 'allow') return syncAllowEntries();
  const { filtered } = await ensureBaseSetup();
  await pihole.upsertDomain('deny', 'regex', siteRegex(site.domain), `${COMMENT} — blocked for filtered members`, [filtered]);
}

/** Call after the site's row is deleted. */
export async function removeSite(site: InternetSite): Promise<void> {
  if (site.kind === 'allow') return syncAllowEntries();
  await pihole.deleteDomain('deny', 'regex', siteRegex(site.domain));
}

/** Ids of every per-kid approved group, creating any that are missing for `memberIds`. */
async function approvedGroupIds(memberIds: string[]): Promise<Map<string, number>> {
  let groups = await pihole.listGroups();
  const missing = memberIds.filter((id) => !groups.some((g) => g.name === approvedGroupName(id)));
  for (const id of missing) {
    const name = (db.prepare('SELECT name FROM family_members WHERE id = ?').get(id) as { name: string } | undefined)?.name ?? id;
    await pihole.createGroup(approvedGroupName(id), `${COMMENT} — approved sites for ${name}`);
  }
  if (missing.length) groups = await pihole.listGroups();
  const ids = new Map<string, number>();
  for (const id of memberIds) {
    const g = groups.find((x) => x.name === approvedGroupName(id));
    if (g) ids.set(id, g.id);
  }
  return ids;
}

export interface MemberSite {
  id: string;
  family_member_id: string;
  domain: string;
}

/**
 * Makes Pi-hole's allow-entries match this app's household "always allowed" sites plus every kid's
 * approved sites. One regex can only exist once in Pi-hole, so a domain that's both always-allowed
 * and approved for a kid (or approved for two kids) becomes a single entry scoped to every group
 * that needs it. Entries this app made that are no longer wanted are removed; anything added by
 * hand in Pi-hole is left alone.
 */
export async function syncAllowEntries(): Promise<void> {
  const { paused, filtered } = await ensureBaseSetup();
  const memberSites = db.prepare('SELECT * FROM internet_member_sites').all() as MemberSite[];
  const groupFor = await approvedGroupIds([...new Set(memberSites.map((s) => s.family_member_id))]);

  const desired = new Map<string, Set<number>>();
  const want = (domain: string, ...groups: number[]) => {
    const key = siteRegex(domain);
    const set = desired.get(key) ?? new Set<number>();
    groups.forEach((g) => set.add(g));
    desired.set(key, set);
  };
  for (const site of db.prepare("SELECT * FROM internet_sites WHERE kind = 'allow'").all() as InternetSite[]) {
    want(site.domain, paused, filtered);
  }
  for (const site of memberSites) {
    const g = groupFor.get(site.family_member_id);
    if (g !== undefined) want(site.domain, g);
  }

  const existing = (await pihole.listDomains('allow', 'regex')).filter((d) => d.comment?.startsWith(COMMENT));
  for (const [regex, groups] of desired) {
    const sorted = [...groups].sort((a, b) => a - b);
    const current = existing.find((d) => d.domain === regex);
    if (!current || [...current.groups].sort((a, b) => a - b).join() !== sorted.join() || !current.enabled) {
      await pihole.upsertDomain('allow', 'regex', regex, `${COMMENT} — allowed site`, sorted);
    }
  }
  for (const d of existing) {
    if (!desired.has(d.domain)) await pihole.deleteDomain('allow', 'regex', d.domain);
  }
}

export interface GravityStatus {
  running: boolean;
  finished_at: string | null;
  error: string | null;
}
const gravity: GravityStatus = { running: false, finished_at: null, error: null };

export function getGravityStatus(): GravityStatus {
  return { ...gravity };
}

function startGravity(): void {
  if (gravity.running) return;
  gravity.running = true;
  gravity.error = null;
  pihole
    .runGravity()
    .catch((err) => {
      gravity.error = (err as Error).message;
      console.error('[internet] Pi-hole gravity update failed:', err);
    })
    .finally(() => {
      gravity.running = false;
      gravity.finished_at = new Date().toISOString();
    });
}

/** Adds/updates the kid-filter blocklists in Pi-hole to match the enabled categories. Kicks off a
 *  (background) gravity update if a list is new to Pi-hole — enabling/disabling an existing one
 *  takes effect without re-downloading. */
export async function syncFilterLists(): Promise<void> {
  const { filtered } = await ensureBaseSetup();
  const enabled = new Set(getEnabledFilterCategories());
  const lists = await pihole.listLists();
  let added = false;
  for (const c of FILTER_CATEGORIES) {
    const on = enabled.has(c.key);
    const existing = lists.find((l) => l.address === c.url);
    if (!existing) {
      if (!on) continue; // never added, still off — nothing to do
      await pihole.createList(c.url, `${COMMENT} — kid filter: ${c.label}`, [filtered], true);
      added = true;
    } else if (existing.enabled !== on || existing.groups.join() !== String(filtered)) {
      await pihole.updateList(c.url, existing.comment, [filtered], on);
    }
  }
  if (added) startGravity();
}

/** Full rebuild of everything this app keeps in Pi-hole, from this app's own database. */
export async function repairSetup(): Promise<void> {
  groupIds = null;
  await ensureBaseSetup();
  await syncFilterLists();
  for (const site of db.prepare("SELECT * FROM internet_sites WHERE kind = 'block'").all() as InternetSite[]) await pushSite(site);
  await syncAllowEntries();
  await syncDevices();
}

// ---- Device sync ----

function sameClient(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export interface SyncStatus {
  at: string | null;
  error: string | null;
}
const lastSync: SyncStatus = { at: null, error: null };

export function getSyncStatus(): SyncStatus {
  return { ...lastSync };
}

let syncing: Promise<void> | null = null;

/** Puts every assigned device into exactly the right mix of this app's two groups, and takes them
 *  out of any Pi-hole client that isn't (or is no longer) one of this app's assigned devices.
 *  Concurrent calls share one run. */
export function syncDevices(): Promise<void> {
  if (!pihole.isPiholeConfigured()) return Promise.resolve();
  if (!syncing) {
    syncing = doSync()
      .then(() => {
        lastSync.at = new Date().toISOString();
        lastSync.error = null;
      })
      .catch((err) => {
        lastSync.error = (err as Error).message;
        groupIds = null; // re-check the groups next time — one may have been removed by hand
        throw err;
      })
      .finally(() => {
        syncing = null;
      });
  }
  return syncing;
}

async function doSync(): Promise<void> {
  const { paused, filtered } = await ensureBaseSetup();
  const clients = await pihole.listClients();
  const devices = db.prepare('SELECT * FROM internet_devices').all() as InternetDevice[];
  const now = new Date();
  const stateCache = new Map<string, MemberInternetState>();
  const handled = new Set<number>();

  // Every group this app manages — including approved groups of kids no longer in that mode, so
  // their devices get taken back out.
  const approvedMembers = (db.prepare('SELECT family_member_id FROM internet_members WHERE approved_only = 1').all() as Array<{
    family_member_id: string;
  }>).map((r) => r.family_member_id);
  const approvedIds = await approvedGroupIds(approvedMembers);
  const ours = new Set([paused, filtered]);
  for (const g of await pihole.listGroups()) if (g.name.startsWith(APPROVED_PREFIX)) ours.add(g.id);

  for (const device of devices) {
    let want: number[] = [];
    if (device.family_member_id) {
      let state = stateCache.get(device.family_member_id);
      if (!state) {
        state = memberState(device.family_member_id, now);
        stateCache.set(device.family_member_id, state);
      }
      if (state.paused || state.mode === 'approved') want.push(paused);
      if (state.mode === 'filtered') want.push(filtered);
      // An actual pause/schedule wins over approved sites — drop the approved group then.
      const approvedGroup = approvedIds.get(device.family_member_id);
      if (state.mode === 'approved' && !state.paused && approvedGroup !== undefined) want.push(approvedGroup);
    }
    const existing = clients.find((c) => sameClient(c.client, device.client));
    if (!existing) {
      // Only worth creating a Pi-hole client once a rule actually applies. Group 0 = Pi-hole's
      // Default group, so the device keeps getting normal ad blocking too.
      if (want.length > 0) await pihole.createClient(device.client, `${device.name} — ${COMMENT}`, [0, ...want]);
      continue;
    }
    handled.add(existing.id);
    const next = [...existing.groups.filter((g) => !ours.has(g)), ...want].sort((a, b) => a - b);
    const current = [...existing.groups].sort((a, b) => a - b);
    if (next.join() !== current.join()) await pihole.updateClient(existing.client, existing.comment, next);
  }

  // A device removed from this app (or edited to a different address) shouldn't stay paused.
  for (const c of clients) {
    if (handled.has(c.id) || !c.groups.some((g) => ours.has(g))) continue;
    await pihole.updateClient(c.client, c.comment, c.groups.filter((g) => !ours.has(g)));
  }
}

/** Fire-and-forget sync after a change — errors are recorded in getSyncStatus() for the page. */
export function syncSoon(): void {
  syncDevices().catch((err) => console.error('[internet] Pi-hole sync failed:', (err as Error).message));
}

/** Every minute (so schedules and timed pauses start/end on time), plus once at startup with a
 *  full repair so a fresh or reset Pi-hole gets everything it needs. */
export function startInternetSchedule(): void {
  if (!pihole.isPiholeConfigured()) return;
  repairSetup().catch((err) => {
    lastSync.error = (err as Error).message;
    console.error('[internet] Initial Pi-hole setup failed:', (err as Error).message);
  });
  cron.schedule('* * * * *', syncSoon);
}

// ---- Validation helpers for the routes ----

/** A MAC (any common separator, normalized to upper-case colon form — what Pi-hole's own UI
 *  stores) or an IPv4/IPv6 address. Null if it's neither. */
export function normalizeClient(input: string): string | null {
  const s = input.trim();
  const mac = s.replace(/-/g, ':');
  if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) return mac.toUpperCase();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split('.').every((n) => Number(n) <= 255)) return s;
  if (/^[0-9a-f:]+$/i.test(s) && s.includes(':')) return s.toLowerCase();
  return null;
}

/** "https://www.YouTube.com/watch?v=…" → "youtube.com". Null if it doesn't look like a domain. */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '');
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(s) ? s : null;
}

export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

// ---- "What's being blocked?" ----

/** Pi-hole v6 query statuses that mean the lookup was blocked. */
const BLOCKED_STATUSES = new Set([
  'GRAVITY',
  'REGEX',
  'DENYLIST',
  'GRAVITY_CNAME',
  'REGEX_CNAME',
  'DENYLIST_CNAME',
  'EXTERNAL_BLOCKED_IP',
  'EXTERNAL_BLOCKED_NULL',
  'EXTERNAL_BLOCKED_NXRA',
  'SPECIAL_DOMAIN',
]);

// Two-part public suffixes common enough to matter for "approve the whole site" suggestions — not
// the full Public Suffix List, just enough that "bbc.co.uk" doesn't come out as "co.uk".
const TWO_PART_SUFFIXES = new Set(['co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'edu.au', 'co.nz', 'co.jp', 'com.br', 'co.in', 'co.za', 'com.mx']);

/** "i.ytimg.com" → "ytimg.com": the site a lookup belongs to, which is what's worth approving. */
export function siteForDomain(domain: string): string {
  const labels = domain.toLowerCase().split('.').filter(Boolean);
  const keep = TWO_PART_SUFFIXES.has(labels.slice(-2).join('.')) ? 3 : 2;
  return labels.slice(-keep).join('.');
}

export interface BlockedSite {
  site: string;
  /** A few of the actual names looked up under it, for context. */
  examples: string[];
  count: number;
  last_seen: string;
  approved: boolean;
}

/**
 * What a kid's devices tried and failed to reach lately, grouped by site, newest first — so a
 * parent can see why an approved site is half-broken (it needs another domain, e.g. YouTube needs
 * ytimg.com) and approve the missing piece. Pi-hole's query log is by IP, so MAC-identified devices
 * are looked up in its network table first.
 */
export async function recentBlockedSites(memberId: string): Promise<BlockedSite[]> {
  const devices = db.prepare('SELECT * FROM internet_devices WHERE family_member_id = ?').all(memberId) as InternetDevice[];
  if (devices.length === 0) return [];
  const network = await pihole.listNetworkDevices();
  const ips = new Set<string>();
  for (const d of devices) {
    if (!d.client.includes(':') || !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(d.client)) {
      ips.add(d.client); // already an IP
      continue;
    }
    const match = network.find((n) => n.hwaddr.toLowerCase() === d.client.toLowerCase());
    match?.ips.forEach((i) => ips.add(i.ip));
  }

  const approved = new Set(
    (db.prepare('SELECT domain FROM internet_member_sites WHERE family_member_id = ?').all(memberId) as Array<{ domain: string }>).map(
      (r) => r.domain
    )
  );
  const bySite = new Map<string, BlockedSite>();
  for (const ip of ips) {
    for (const q of await pihole.getQueriesForClient(ip, 500)) {
      if (!q.status || !BLOCKED_STATUSES.has(q.status)) continue;
      const site = siteForDomain(q.domain);
      const seen = new Date(q.time * 1000).toISOString();
      const entry = bySite.get(site) ?? { site, examples: [], count: 0, last_seen: seen, approved: approved.has(site) };
      entry.count++;
      if (seen > entry.last_seen) entry.last_seen = seen;
      if (entry.examples.length < 3 && !entry.examples.includes(q.domain)) entry.examples.push(q.domain);
      bySite.set(site, entry);
    }
  }
  return [...bySite.values()].sort((a, b) => b.last_seen.localeCompare(a.last_seen)).slice(0, 40);
}
