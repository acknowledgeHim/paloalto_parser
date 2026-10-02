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
 * This app's database is the source of truth; anything in Pi-hole can be rebuilt from it (the
 * "Repair Pi-hole setup" action does exactly that).
 */

const GROUP_PAUSED = 'FHC Paused';
const GROUP_FILTERED = 'FHC Kid filter';
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

interface MemberRow {
  family_member_id: string;
  filtered: number;
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
      paused_until: null,
      allowed_until: null,
    }
  );
}

export function saveMemberRow(row: MemberRow): void {
  db.prepare(
    `INSERT INTO internet_members (family_member_id, filtered, paused_until, allowed_until)
     VALUES (@family_member_id, @filtered, @paused_until, @allowed_until)
     ON CONFLICT(family_member_id) DO UPDATE SET
       filtered = excluded.filtered, paused_until = excluded.paused_until, allowed_until = excluded.allowed_until`
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
  filtered: boolean;
}

export function memberState(memberId: string, now = new Date()): MemberInternetState {
  const row = getMemberRow(memberId);
  const filtered = row.filtered === 1;
  if (row.paused_until && new Date(row.paused_until) > now) {
    return {
      paused: true,
      reason: 'paused',
      until: row.paused_until === FOREVER ? null : row.paused_until,
      schedule_label: null,
      filtered,
    };
  }
  const schedules = db.prepare('SELECT * FROM internet_schedules WHERE family_member_id = ?').all(memberId) as InternetSchedule[];
  const active = activeScheduleEnd(schedules, now);
  if (row.allowed_until && new Date(row.allowed_until) > now) {
    return { paused: false, reason: active ? 'allowed' : null, until: active ? row.allowed_until : null, schedule_label: null, filtered };
  }
  if (active) {
    return { paused: true, reason: 'schedule', until: active.end.toISOString(), schedule_label: active.label || null, filtered };
  }
  return { paused: false, reason: null, until: null, schedule_label: null, filtered };
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
  const { paused, filtered } = await ensureBaseSetup();
  if (site.kind === 'allow') {
    await pihole.upsertDomain('allow', 'regex', siteRegex(site.domain), `${COMMENT} — always allowed`, [paused, filtered]);
  } else {
    await pihole.upsertDomain('deny', 'regex', siteRegex(site.domain), `${COMMENT} — blocked for filtered members`, [filtered]);
  }
}

export async function removeSite(site: InternetSite): Promise<void> {
  await pihole.deleteDomain(site.kind === 'allow' ? 'allow' : 'deny', 'regex', siteRegex(site.domain));
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
  for (const site of db.prepare('SELECT * FROM internet_sites').all() as InternetSite[]) await pushSite(site);
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
  const ours = new Set([paused, filtered]);
  const clients = await pihole.listClients();
  const devices = db.prepare('SELECT * FROM internet_devices').all() as InternetDevice[];
  const now = new Date();
  const stateCache = new Map<string, MemberInternetState>();
  const handled = new Set<number>();

  for (const device of devices) {
    let want: number[] = [];
    if (device.family_member_id) {
      let state = stateCache.get(device.family_member_id);
      if (!state) {
        state = memberState(device.family_member_id, now);
        stateCache.set(device.family_member_id, state);
      }
      if (state.paused) want.push(paused);
      if (state.filtered) want.push(filtered);
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
