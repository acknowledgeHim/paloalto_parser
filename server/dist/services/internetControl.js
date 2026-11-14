import cron from 'node-cron';
import { db, getSetting, setSetting } from '../db.js';
import * as pihole from './pihole.js';
import { trackUsageMinute } from './internetUsage.js';
import { sendWeeklyReport } from './internetReport.js';
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
function approvedGroupName(memberId) {
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
];
const FILTER_SETTING_KEY = 'internet_filter_categories';
export function getEnabledFilterCategories() {
    const raw = getSetting(FILTER_SETTING_KEY, '');
    if (!raw)
        return FILTER_CATEGORIES.filter((c) => c.defaultOn).map((c) => c.key);
    try {
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
export function setEnabledFilterCategories(keys) {
    const valid = keys.filter((k) => FILTER_CATEGORIES.some((c) => c.key === k));
    setSetting(FILTER_SETTING_KEY, JSON.stringify(valid));
}
export function getMemberRow(memberId) {
    return (db.prepare('SELECT * FROM internet_members WHERE family_member_id = ?').get(memberId) ?? {
        family_member_id: memberId,
        filtered: 0,
        approved_only: 0,
        paused_until: null,
        allowed_until: null,
        daily_minutes: null,
        weekend_minutes: null,
        minutes_per_chore: 0,
        extra_minutes: 0,
        extra_minutes_day: null,
    });
}
export function saveMemberRow(row) {
    db.prepare(`INSERT INTO internet_members (family_member_id, filtered, approved_only, paused_until, allowed_until,
       daily_minutes, weekend_minutes, minutes_per_chore, extra_minutes, extra_minutes_day)
     VALUES (@family_member_id, @filtered, @approved_only, @paused_until, @allowed_until,
       @daily_minutes, @weekend_minutes, @minutes_per_chore, @extra_minutes, @extra_minutes_day)
     ON CONFLICT(family_member_id) DO UPDATE SET
       filtered = excluded.filtered, approved_only = excluded.approved_only,
       paused_until = excluded.paused_until, allowed_until = excluded.allowed_until,
       daily_minutes = excluded.daily_minutes, weekend_minutes = excluded.weekend_minutes,
       minutes_per_chore = excluded.minutes_per_chore, extra_minutes = excluded.extra_minutes,
       extra_minutes_day = excluded.extra_minutes_day`).run(row);
}
// ---- Working out someone's current state ----
function atTime(day, hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    return d;
}
/** If any of these schedules is blocking right now, when the (latest-ending) one ends. Uses the
 *  server's local time (TZ in .env), like every other time-of-day feature in this app. */
export function activeScheduleEnd(schedules, now) {
    let result = null;
    for (const s of schedules) {
        if (!s.enabled)
            continue;
        const days = new Set(s.days.split(',').filter(Boolean).map(Number));
        // Today's window, or yesterday's if it runs past midnight into today.
        for (const offset of [0, -1]) {
            const day = new Date(now);
            day.setDate(day.getDate() + offset);
            day.setHours(0, 0, 0, 0);
            if (!days.has(day.getDay()))
                continue;
            const start = atTime(day, s.start_time);
            const end = atTime(day, s.end_time);
            if (end <= start)
                end.setDate(end.getDate() + 1);
            if (now >= start && now < end && (!result || end > result.end))
                result = { end, label: s.label };
        }
    }
    return result;
}
/** Local calendar day as YYYY-MM-DD (server TZ, like everything time-of-day in this app). */
export function localDay(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function endOfDay(d = new Date()) {
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return end;
}
/** Chores/to-dos this person has checked off today. */
export function choresDoneToday(memberId, now = new Date()) {
    return db.prepare('SELECT COUNT(*) AS n FROM task_completions WHERE completed_by_id = ? AND completed_on = ?').get(memberId, localDay(now)).n;
}
export function minutesUsedToday(memberId, now = new Date()) {
    return (db.prepare('SELECT minutes FROM internet_usage WHERE family_member_id = ? AND day = ?').get(memberId, localDay(now))?.minutes ?? 0);
}
/** Today's allowance for someone with a limit set for this kind of day; null = no limit today. */
export function allowanceToday(memberId, now = new Date(), row = getMemberRow(memberId)) {
    const weekend = now.getDay() === 0 || now.getDay() === 6;
    const base = weekend ? row.weekend_minutes : row.daily_minutes;
    if (base === null || base === undefined)
        return null;
    const earned = row.minutes_per_chore > 0 ? choresDoneToday(memberId, now) * row.minutes_per_chore : 0;
    const extra = row.extra_minutes_day === localDay(now) ? row.extra_minutes : 0;
    const total = base + earned + extra;
    const used = minutesUsedToday(memberId, now);
    return { base, earned, extra, total, used, remaining: Math.max(0, total - used) };
}
/** A parent's "+N minutes today" (or an approved request for more time). */
export function addExtraMinutes(memberId, minutes) {
    const row = getMemberRow(memberId);
    const today = localDay();
    row.extra_minutes = (row.extra_minutes_day === today ? row.extra_minutes : 0) + minutes;
    row.extra_minutes_day = today;
    saveMemberRow(row);
}
function rowMode(row) {
    if (row.approved_only === 1)
        return 'approved';
    return row.filtered === 1 ? 'filtered' : 'open';
}
export function setMemberMode(memberId, mode) {
    const row = getMemberRow(memberId);
    row.filtered = mode === 'filtered' ? 1 : 0;
    row.approved_only = mode === 'approved' ? 1 : 0;
    saveMemberRow(row);
}
/** Precedence: a parent's pause, then a parent's "allowed until", then schedules, then the daily
 *  allowance running out (which lasts until midnight). */
export function memberState(memberId, now = new Date()) {
    const row = getMemberRow(memberId);
    const mode = rowMode(row);
    const filtered = mode === 'filtered';
    const allowance = allowanceToday(memberId, now, row);
    const base = { filtered, mode, allowance, schedule_label: null };
    if (row.paused_until && new Date(row.paused_until) > now) {
        return { ...base, paused: true, reason: 'paused', until: row.paused_until === FOREVER ? null : row.paused_until };
    }
    const schedules = db.prepare('SELECT * FROM internet_schedules WHERE family_member_id = ?').all(memberId);
    const active = activeScheduleEnd(schedules, now);
    const limitReached = Boolean(allowance && allowance.remaining <= 0);
    if (row.allowed_until && new Date(row.allowed_until) > now) {
        const overriding = active || limitReached;
        return { ...base, paused: false, reason: overriding ? 'allowed' : null, until: overriding ? row.allowed_until : null };
    }
    if (active) {
        return { ...base, paused: true, reason: 'schedule', until: active.end.toISOString(), schedule_label: active.label || null };
    }
    if (limitReached) {
        return { ...base, paused: true, reason: 'limit', until: endOfDay(now).toISOString() };
    }
    return { ...base, paused: false, reason: null, until: null };
}
/** Pauses for `minutes`, or until resumed if null. Overrides any allowance in effect. */
export function pauseMember(memberId, minutes) {
    const row = getMemberRow(memberId);
    row.paused_until = minutes === null ? FOREVER : new Date(Date.now() + minutes * 60_000).toISOString();
    row.allowed_until = null;
    saveMemberRow(row);
}
/** Internet back on now. With `minutes`, only for that long (bonus time during a schedule);
 *  without, until the current schedule window (if any) ends — next night's bedtime still applies. */
export function resumeMember(memberId, minutes) {
    const row = getMemberRow(memberId);
    row.paused_until = null;
    if (minutes !== null) {
        row.allowed_until = new Date(Date.now() + minutes * 60_000).toISOString();
    }
    else {
        // Until the current schedule window ends, or — if it's the daily allowance that's run out — for
        // the rest of today.
        const schedules = db.prepare('SELECT * FROM internet_schedules WHERE family_member_id = ?').all(memberId);
        const scheduleEnd = activeScheduleEnd(schedules, new Date())?.end ?? null;
        const allowance = allowanceToday(memberId, new Date(), row);
        row.allowed_until = scheduleEnd?.toISOString() ?? (allowance && allowance.remaining <= 0 ? endOfDay().toISOString() : null);
    }
    saveMemberRow(row);
}
// ---- Pi-hole setup ----
let groupIds = null;
/** Makes sure this app's two Pi-hole groups and the pause regex exist — cached once it's worked,
 *  re-checked after any sync error (e.g. someone deleted a group in Pi-hole's own UI). */
async function ensureBaseSetup() {
    if (groupIds)
        return groupIds;
    let groups = await pihole.listGroups();
    for (const name of [GROUP_PAUSED, GROUP_FILTERED]) {
        if (!groups.some((g) => g.name === name))
            await pihole.createGroup(name, COMMENT);
    }
    groups = await pihole.listGroups();
    const paused = groups.find((g) => g.name === GROUP_PAUSED)?.id;
    const filtered = groups.find((g) => g.name === GROUP_FILTERED)?.id;
    if (paused === undefined || filtered === undefined)
        throw new Error("Couldn't create this app's Pi-hole groups");
    await pihole.upsertDomain('deny', 'regex', PAUSE_REGEX, `${COMMENT} — blocks everything while paused`, [paused]);
    groupIds = { paused, filtered };
    return groupIds;
}
/** A site entry as a Pi-hole regex covering the domain and all its subdomains (www., m., …). */
function siteRegex(domain) {
    return `(^|\\.)${domain.replace(/\./g, '\\.')}$`;
}
export async function pushSite(site) {
    if (site.kind === 'allow')
        return syncAllowEntries();
    const { filtered } = await ensureBaseSetup();
    await pihole.upsertDomain('deny', 'regex', siteRegex(site.domain), `${COMMENT} — blocked for filtered members`, [filtered]);
}
/** Call after the site's row is deleted. */
export async function removeSite(site) {
    if (site.kind === 'allow')
        return syncAllowEntries();
    await pihole.deleteDomain('deny', 'regex', siteRegex(site.domain));
}
/** Ids of every per-kid approved group, creating any that are missing for `memberIds`. */
async function approvedGroupIds(memberIds) {
    let groups = await pihole.listGroups();
    const missing = memberIds.filter((id) => !groups.some((g) => g.name === approvedGroupName(id)));
    for (const id of missing) {
        const name = db.prepare('SELECT name FROM family_members WHERE id = ?').get(id)?.name ?? id;
        await pihole.createGroup(approvedGroupName(id), `${COMMENT} — approved sites for ${name}`);
    }
    if (missing.length)
        groups = await pihole.listGroups();
    const ids = new Map();
    for (const id of memberIds) {
        const g = groups.find((x) => x.name === approvedGroupName(id));
        if (g)
            ids.set(id, g.id);
    }
    return ids;
}
/**
 * Makes Pi-hole's allow-entries match this app's household "always allowed" sites plus every kid's
 * approved sites. One regex can only exist once in Pi-hole, so a domain that's both always-allowed
 * and approved for a kid (or approved for two kids) becomes a single entry scoped to every group
 * that needs it. Entries this app made that are no longer wanted are removed; anything added by
 * hand in Pi-hole is left alone.
 */
export async function syncAllowEntries() {
    const { paused, filtered } = await ensureBaseSetup();
    const memberSites = db.prepare('SELECT * FROM internet_member_sites').all();
    const groupFor = await approvedGroupIds([...new Set(memberSites.map((s) => s.family_member_id))]);
    const desired = new Map();
    const want = (domain, ...groups) => {
        const key = siteRegex(domain);
        const set = desired.get(key) ?? new Set();
        groups.forEach((g) => set.add(g));
        desired.set(key, set);
    };
    for (const site of db.prepare("SELECT * FROM internet_sites WHERE kind = 'allow'").all()) {
        want(site.domain, paused, filtered);
    }
    for (const site of memberSites) {
        const g = groupFor.get(site.family_member_id);
        if (g !== undefined)
            want(site.domain, g);
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
        if (!desired.has(d.domain))
            await pihole.deleteDomain('allow', 'regex', d.domain);
    }
}
const gravity = { running: false, finished_at: null, error: null };
export function getGravityStatus() {
    return { ...gravity };
}
function startGravity() {
    if (gravity.running)
        return;
    gravity.running = true;
    gravity.error = null;
    pihole
        .runGravity()
        .catch((err) => {
        gravity.error = err.message;
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
export async function syncFilterLists() {
    const { filtered } = await ensureBaseSetup();
    const enabled = new Set(getEnabledFilterCategories());
    const lists = await pihole.listLists();
    let added = false;
    for (const c of FILTER_CATEGORIES) {
        const on = enabled.has(c.key);
        const existing = lists.find((l) => l.address === c.url);
        if (!existing) {
            if (!on)
                continue; // never added, still off — nothing to do
            await pihole.createList(c.url, `${COMMENT} — kid filter: ${c.label}`, [filtered], true);
            added = true;
        }
        else if (existing.enabled !== on || existing.groups.join() !== String(filtered)) {
            await pihole.updateList(c.url, existing.comment, [filtered], on);
        }
    }
    if (added)
        startGravity();
}
/** Full rebuild of everything this app keeps in Pi-hole, from this app's own database. */
export async function repairSetup() {
    groupIds = null;
    await ensureBaseSetup();
    await syncFilterLists();
    for (const site of db.prepare("SELECT * FROM internet_sites WHERE kind = 'block'").all())
        await pushSite(site);
    await syncAllowEntries();
    await syncDevices();
}
// ---- Device sync ----
function sameClient(a, b) {
    return a.toLowerCase() === b.toLowerCase();
}
const lastSync = { at: null, error: null };
export function getSyncStatus() {
    return { ...lastSync };
}
let syncing = null;
/** Puts every assigned device into exactly the right mix of this app's two groups, and takes them
 *  out of any Pi-hole client that isn't (or is no longer) one of this app's assigned devices.
 *  Concurrent calls share one run. */
export function syncDevices() {
    if (!pihole.isPiholeConfigured())
        return Promise.resolve();
    if (!syncing) {
        syncing = doSync()
            .then(() => {
            lastSync.at = new Date().toISOString();
            lastSync.error = null;
        })
            .catch((err) => {
            lastSync.error = err.message;
            groupIds = null; // re-check the groups next time — one may have been removed by hand
            throw err;
        })
            .finally(() => {
            syncing = null;
        });
    }
    return syncing;
}
async function doSync() {
    const { paused, filtered } = await ensureBaseSetup();
    const clients = await pihole.listClients();
    const devices = db.prepare('SELECT * FROM internet_devices').all();
    const now = new Date();
    const stateCache = new Map();
    const handled = new Set();
    // Every group this app manages — including approved groups of kids no longer in that mode, so
    // their devices get taken back out.
    const approvedMembers = db.prepare(`SELECT family_member_id FROM internet_members m
     WHERE approved_only = 1 OR (filtered = 1 AND EXISTS (SELECT 1 FROM internet_member_sites s WHERE s.family_member_id = m.family_member_id))`).all().map((r) => r.family_member_id);
    const approvedIds = await approvedGroupIds(approvedMembers);
    const ours = new Set([paused, filtered]);
    for (const g of await pihole.listGroups())
        if (g.name.startsWith(APPROVED_PREFIX))
            ours.add(g.id);
    for (const device of devices) {
        let want = [];
        if (device.family_member_id) {
            let state = stateCache.get(device.family_member_id);
            if (!state) {
                state = memberState(device.family_member_id, now);
                stateCache.set(device.family_member_id, state);
            }
            if (state.paused || state.mode === 'approved')
                want.push(paused);
            if (state.mode === 'filtered')
                want.push(filtered);
            // A kid's own allowed sites: the whole list in approved-only mode, and exceptions to the web
            // filter in filtered mode. An actual pause/schedule/limit wins — drop the group then.
            const approvedGroup = approvedIds.get(device.family_member_id);
            if (state.mode !== 'open' && !state.paused && approvedGroup !== undefined)
                want.push(approvedGroup);
        }
        const existing = clients.find((c) => sameClient(c.client, device.client));
        if (!existing) {
            // Only worth creating a Pi-hole client once a rule actually applies. Group 0 = Pi-hole's
            // Default group, so the device keeps getting normal ad blocking too.
            if (want.length > 0)
                await pihole.createClient(device.client, `${device.name} — ${COMMENT}`, [0, ...want]);
            continue;
        }
        handled.add(existing.id);
        const next = [...existing.groups.filter((g) => !ours.has(g)), ...want].sort((a, b) => a - b);
        const current = [...existing.groups].sort((a, b) => a - b);
        if (next.join() !== current.join())
            await pihole.updateClient(existing.client, existing.comment, next);
    }
    // A device removed from this app (or edited to a different address) shouldn't stay paused.
    for (const c of clients) {
        if (handled.has(c.id) || !c.groups.some((g) => ours.has(g)))
            continue;
        await pihole.updateClient(c.client, c.comment, c.groups.filter((g) => !ours.has(g)));
    }
}
/** Fire-and-forget sync after a change — errors are recorded in getSyncStatus() for the page. */
export function syncSoon() {
    syncDevices().catch((err) => console.error('[internet] Pi-hole sync failed:', err.message));
}
/** Every minute (so schedules, timed pauses, and allowances start/end on time — counting the last
 *  minute's usage first), plus once at startup with a full repair so a fresh or reset Pi-hole gets
 *  everything it needs. */
export function startInternetSchedule() {
    if (!pihole.isPiholeConfigured())
        return;
    repairSetup().catch((err) => {
        lastSync.error = err.message;
        console.error('[internet] Initial Pi-hole setup failed:', err.message);
    });
    cron.schedule('* * * * *', () => {
        trackUsageMinute()
            .catch((err) => console.error('[internet] Usage tracking failed:', err.message))
            .finally(syncSoon);
    });
    // The weekly parent report — Sunday 6pm local time.
    cron.schedule('0 18 * * 0', () => {
        sendWeeklyReport()
            .then((n) => console.log(`[internet] Sent weekly report to ${n} parent(s).`))
            .catch((err) => console.log('[internet] Weekly report not sent:', err.message));
    });
}
// ---- Validation helpers for the routes ----
/** A MAC (any common separator, normalized to upper-case colon form — what Pi-hole's own UI
 *  stores) or an IPv4/IPv6 address. Null if it's neither. */
export function normalizeClient(input) {
    const s = input.trim();
    const mac = s.replace(/-/g, ':');
    if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac))
        return mac.toUpperCase();
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split('.').every((n) => Number(n) <= 255))
        return s;
    if (/^[0-9a-f:]+$/i.test(s) && s.includes(':'))
        return s.toLowerCase();
    return null;
}
/** "https://www.YouTube.com/watch?v=…" → "youtube.com". Null if it doesn't look like a domain. */
export function normalizeDomain(input) {
    let s = input.trim().toLowerCase();
    s = s.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '');
    return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(s) ? s : null;
}
export function isValidTime(t) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}
// ---- "What's being blocked?" ----
/** Pi-hole v6 query statuses that mean the lookup was blocked. */
export const BLOCKED_STATUSES = new Set([
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
export function siteForDomain(domain) {
    const labels = domain.toLowerCase().split('.').filter(Boolean);
    const keep = TWO_PART_SUFFIXES.has(labels.slice(-2).join('.')) ? 3 : 2;
    return labels.slice(-keep).join('.');
}
/**
 * What a kid's devices tried and failed to reach lately, grouped by site, newest first — so a
 * parent can see why an approved site is half-broken (it needs another domain, e.g. YouTube needs
 * ytimg.com) and approve the missing piece. Pi-hole's query log is by IP, so MAC-identified devices
 * are looked up in its network table first.
 */
export async function recentBlockedSites(memberId) {
    const devices = db.prepare('SELECT * FROM internet_devices WHERE family_member_id = ?').all(memberId);
    if (devices.length === 0)
        return [];
    const network = await pihole.listNetworkDevices();
    const ips = new Set();
    for (const d of devices) {
        if (!d.client.includes(':') || !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(d.client)) {
            ips.add(d.client); // already an IP
            continue;
        }
        const match = network.find((n) => n.hwaddr.toLowerCase() === d.client.toLowerCase());
        match?.ips.forEach((i) => ips.add(i.ip));
    }
    const approved = new Set(db.prepare('SELECT domain FROM internet_member_sites WHERE family_member_id = ?').all(memberId).map((r) => r.domain));
    const bySite = new Map();
    for (const ip of ips) {
        for (const q of await pihole.getQueriesForClient(ip, 500)) {
            if (!q.status || !BLOCKED_STATUSES.has(q.status))
                continue;
            const site = siteForDomain(q.domain);
            const seen = new Date(q.time * 1000).toISOString();
            const entry = bySite.get(site) ?? { site, examples: [], count: 0, last_seen: seen, approved: approved.has(site) };
            entry.count++;
            if (seen > entry.last_seen)
                entry.last_seen = seen;
            if (entry.examples.length < 3 && !entry.examples.includes(q.domain))
                entry.examples.push(q.domain);
            bySite.set(site, entry);
        }
    }
    return [...bySite.values()].sort((a, b) => b.last_seen.localeCompare(a.last_seen)).slice(0, 40);
}
