import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import * as pihole from '../services/pihole.js';
import {
  FILTER_CATEGORIES,
  getEnabledFilterCategories,
  setEnabledFilterCategories,
  getGravityStatus,
  getSyncStatus,
  getMemberRow,
  saveMemberRow,
  memberState,
  setMemberMode,
  syncAllowEntries,
  recentBlockedSites,
  pauseMember,
  resumeMember,
  normalizeClient,
  normalizeDomain,
  isValidTime,
  pushSite,
  removeSite,
  repairSetup,
  syncDevices,
  syncFilterLists,
  type InternetDevice,
  type InternetSchedule,
  type InternetSite,
  type InternetMode,
  type MemberSite,
} from '../services/internetControl.js';

// Internet controls (Pi-hole) — see services/internetControl.ts and docs/PIHOLE_SETUP.md. Viewing
// is open to everyone (a kid can see "paused until 7:00 AM" and why); every change is parent-only
// via requireAdmin, the same gate as Settings, since a kid un-pausing themselves would defeat the
// point.
export const internetRouter = Router();

function memberExists(id: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM family_members WHERE id = ?').get(id));
}

/** Waits for the Pi-hole sync a change needs, but reports a failure as a warning rather than an
 *  error — the change itself is saved either way and the next minute's sync retries it. */
async function syncAfterChange(): Promise<string | null> {
  try {
    await syncDevices();
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}

/** GET /overview — everything the Internet page shows, in one call. */
internetRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const configured = pihole.isPiholeConfigured();
    let piholeInfo: Record<string, unknown> = { reachable: false, error: null };
    if (configured) {
      try {
        const [summary, blocking] = await Promise.all([pihole.getSummary(), pihole.getBlockingStatus()]);
        piholeInfo = {
          reachable: true,
          error: null,
          blocking,
          queries_today: summary.queries.total,
          blocked_today: summary.queries.blocked,
          percent_blocked: summary.queries.percent_blocked,
          active_clients: summary.clients.active,
          domains_blocked: summary.gravity.domains_being_blocked,
        };
      } catch (err) {
        piholeInfo = { reachable: false, error: (err as Error).message };
      }
    }

    const members = db
      .prepare('SELECT id, name, color, avatar, is_parent FROM family_members ORDER BY sort_order, name')
      .all() as Array<{ id: string; name: string; color: string; avatar: string | null; is_parent: number }>;
    const now = new Date();
    res.json({
      configured,
      pihole: piholeInfo,
      sync: getSyncStatus(),
      gravity: getGravityStatus(),
      members: members.map((m) => ({ ...m, state: memberState(m.id, now) })),
      devices: db.prepare('SELECT id, client, name, family_member_id FROM internet_devices ORDER BY name').all(),
      schedules: db.prepare('SELECT * FROM internet_schedules ORDER BY start_time').all(),
      sites: db.prepare('SELECT id, domain, kind FROM internet_sites ORDER BY domain').all(),
      member_sites: db.prepare('SELECT id, family_member_id, domain FROM internet_member_sites ORDER BY domain').all(),
      filter_categories: FILTER_CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
      enabled_filter_categories: getEnabledFilterCategories(),
    });
  })
);

/** GET /network-devices — what Pi-hole has seen on the network, for the "add a device" picker.
 *  Parent-only: it's a list of every device in the house. */
internetRouter.get(
  '/network-devices',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const known = (db.prepare('SELECT client FROM internet_devices').all() as Array<{ client: string }>).map((d) =>
      d.client.toLowerCase()
    );
    const devices = await pihole.listNetworkDevices();
    res.json(
      devices
        .map((d) => {
          const latest = [...d.ips].sort((a, b) => b.lastSeen - a.lastSeen)[0];
          // Pi-hole uses a fake "ip-<address>" hardware address for a device it can't learn a MAC
          // for (e.g. one that isn't on the same network segment) — identify those by IP instead.
          const mac = d.hwaddr.startsWith('ip-') ? null : d.hwaddr.toUpperCase();
          return {
            client: mac ?? latest?.ip ?? d.hwaddr.slice(3),
            mac,
            ip: latest?.ip ?? null,
            hostname: d.ips.map((i) => i.name).find(Boolean) ?? null,
            vendor: d.macVendor || null,
            last_query: d.lastQuery ? new Date(d.lastQuery * 1000).toISOString() : null,
            queries: d.numQueries,
          };
        })
        .filter((d) => d.queries > 0 && !known.includes(d.client.toLowerCase()))
        .sort((a, b) => (b.last_query ?? '').localeCompare(a.last_query ?? ''))
    );
  })
);

// ---- Devices ----

internetRouter.post(
  '/devices',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { client, name, family_member_id } = req.body as { client?: string; name?: string; family_member_id?: string | null };
    const normalized = client ? normalizeClient(client) : null;
    if (!normalized) return res.status(400).json({ error: 'Enter a MAC address (AA:BB:CC:DD:EE:FF) or an IP address' });
    if (!name?.trim()) return res.status(400).json({ error: 'Give the device a name' });
    if (family_member_id && !memberExists(family_member_id)) return res.status(400).json({ error: 'Unknown family member' });
    if (db.prepare('SELECT 1 FROM internet_devices WHERE client = ? COLLATE NOCASE').get(normalized)) {
      return res.status(400).json({ error: 'That device is already added' });
    }
    const device: InternetDevice = { id: uuidv4(), client: normalized, name: name.trim(), family_member_id: family_member_id || null };
    db.prepare('INSERT INTO internet_devices (id, client, name, family_member_id) VALUES (@id, @client, @name, @family_member_id)').run(device);
    res.status(201).json({ device, warning: await syncAfterChange() });
  })
);

internetRouter.patch(
  '/devices/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const device = db.prepare('SELECT * FROM internet_devices WHERE id = ?').get(req.params.id) as InternetDevice | undefined;
    if (!device) return res.status(404).json({ error: 'not found' });
    const { name, family_member_id } = req.body as { name?: string; family_member_id?: string | null };
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Give the device a name' });
      device.name = name.trim();
    }
    if (family_member_id !== undefined) {
      if (family_member_id && !memberExists(family_member_id)) return res.status(400).json({ error: 'Unknown family member' });
      device.family_member_id = family_member_id || null;
    }
    db.prepare('UPDATE internet_devices SET name = @name, family_member_id = @family_member_id WHERE id = @id').run(device);
    res.json({ device, warning: await syncAfterChange() });
  })
);

internetRouter.delete(
  '/devices/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM internet_devices WHERE id = ?').run(req.params.id);
    // The sync takes the removed device back out of this app's Pi-hole groups.
    res.json({ warning: await syncAfterChange() });
  })
);

// ---- Per-person controls ----

function parseMinutes(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 7 * 24 * 60 ? n : undefined;
}

/** POST /members/:memberId/pause { minutes? } — no minutes = until a parent resumes it. */
internetRouter.post(
  '/members/:memberId/pause',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!memberExists(req.params.memberId)) return res.status(404).json({ error: 'not found' });
    const minutes = parseMinutes((req.body as { minutes?: unknown }).minutes);
    if (minutes === undefined) return res.status(400).json({ error: 'Invalid minutes' });
    pauseMember(req.params.memberId, minutes);
    res.json({ state: memberState(req.params.memberId), warning: await syncAfterChange() });
  })
);

/** POST /members/:memberId/resume { minutes? } — with minutes = bonus time through a schedule. */
internetRouter.post(
  '/members/:memberId/resume',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!memberExists(req.params.memberId)) return res.status(404).json({ error: 'not found' });
    const minutes = parseMinutes((req.body as { minutes?: unknown }).minutes);
    if (minutes === undefined) return res.status(400).json({ error: 'Invalid minutes' });
    resumeMember(req.params.memberId, minutes);
    res.json({ state: memberState(req.params.memberId), warning: await syncAfterChange() });
  })
);

const MODES: InternetMode[] = ['open', 'filtered', 'approved'];

/** PATCH /members/:memberId { mode: 'open' | 'filtered' | 'approved' } (or legacy { filtered }) */
internetRouter.patch(
  '/members/:memberId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!memberExists(req.params.memberId)) return res.status(404).json({ error: 'not found' });
    const { mode, filtered } = req.body as { mode?: string; filtered?: boolean };
    if (mode !== undefined) {
      if (!MODES.includes(mode as InternetMode)) return res.status(400).json({ error: 'Invalid mode' });
      setMemberMode(req.params.memberId, mode as InternetMode);
    } else if (typeof filtered === 'boolean') {
      const row = getMemberRow(req.params.memberId);
      row.filtered = filtered ? 1 : 0;
      saveMemberRow(row);
    }
    res.json({ state: memberState(req.params.memberId), warning: await syncAfterChange() });
  })
);

// ---- A kid's own approved sites ("approved sites only" mode) ----

internetRouter.post(
  '/members/:memberId/sites',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const memberId = req.params.memberId;
    if (!memberExists(memberId)) return res.status(404).json({ error: 'not found' });
    const raw = (req.body as { domain?: string }).domain;
    const normalized = raw ? normalizeDomain(raw) : null;
    if (!normalized) return res.status(400).json({ error: 'Enter a website like example.com' });
    if (db.prepare('SELECT 1 FROM internet_member_sites WHERE family_member_id = ? AND domain = ?').get(memberId, normalized)) {
      return res.status(400).json({ error: 'Already approved' });
    }
    const site: MemberSite = { id: uuidv4(), family_member_id: memberId, domain: normalized };
    db.prepare('INSERT INTO internet_member_sites (id, family_member_id, domain) VALUES (@id, @family_member_id, @domain)').run(site);
    let warning: string | null = null;
    try {
      await syncAllowEntries();
      await syncDevices(); // the kid's approved group may have only just been created
    } catch (err) {
      warning = (err as Error).message;
    }
    res.status(201).json({ site, warning });
  })
);

internetRouter.delete(
  '/members/:memberId/sites/:siteId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM internet_member_sites WHERE id = ? AND family_member_id = ?').run(req.params.siteId, req.params.memberId);
    let warning: string | null = null;
    try {
      await syncAllowEntries();
    } catch (err) {
      warning = (err as Error).message;
    }
    res.json({ warning });
  })
);

/** GET /members/:memberId/blocked — sites this kid's devices tried to reach and couldn't, lately.
 *  Parent-only: it's a view of what a kid's been doing online. */
internetRouter.get(
  '/members/:memberId/blocked',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!memberExists(req.params.memberId)) return res.status(404).json({ error: 'not found' });
    try {
      res.json(await recentBlockedSites(req.params.memberId));
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  })
);

// ---- Schedules ----

function parseSchedule(body: Record<string, unknown>): Omit<InternetSchedule, 'id' | 'family_member_id'> | string {
  const days = Array.isArray(body.days) ? (body.days as unknown[]).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
  if (days.length === 0) return 'Pick at least one day';
  const start = String(body.start_time ?? '');
  const end = String(body.end_time ?? '');
  if (!isValidTime(start) || !isValidTime(end)) return 'Times must be HH:MM';
  if (start === end) return 'Start and end times must be different';
  return {
    label: String(body.label ?? '').trim().slice(0, 60),
    days: [...new Set(days)].sort().join(','),
    start_time: start,
    end_time: end,
    enabled: body.enabled === false ? 0 : 1,
  };
}

internetRouter.post(
  '/schedules',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const memberId = String((req.body as { family_member_id?: string }).family_member_id ?? '');
    if (!memberExists(memberId)) return res.status(400).json({ error: 'Unknown family member' });
    const parsed = parseSchedule(req.body);
    if (typeof parsed === 'string') return res.status(400).json({ error: parsed });
    const schedule: InternetSchedule = { id: uuidv4(), family_member_id: memberId, ...parsed };
    db.prepare(
      `INSERT INTO internet_schedules (id, family_member_id, label, days, start_time, end_time, enabled)
       VALUES (@id, @family_member_id, @label, @days, @start_time, @end_time, @enabled)`
    ).run(schedule);
    res.status(201).json({ schedule, warning: await syncAfterChange() });
  })
);

internetRouter.put(
  '/schedules/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM internet_schedules WHERE id = ?').get(req.params.id) as InternetSchedule | undefined;
    if (!existing) return res.status(404).json({ error: 'not found' });
    const parsed = parseSchedule(req.body);
    if (typeof parsed === 'string') return res.status(400).json({ error: parsed });
    const schedule: InternetSchedule = { ...existing, ...parsed };
    db.prepare(
      `UPDATE internet_schedules SET label = @label, days = @days, start_time = @start_time, end_time = @end_time, enabled = @enabled
       WHERE id = @id`
    ).run(schedule);
    res.json({ schedule, warning: await syncAfterChange() });
  })
);

internetRouter.delete(
  '/schedules/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM internet_schedules WHERE id = ?').run(req.params.id);
    res.json({ warning: await syncAfterChange() });
  })
);

// ---- Sites ----

internetRouter.post(
  '/sites',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { domain, kind } = req.body as { domain?: string; kind?: string };
    if (kind !== 'allow' && kind !== 'block') return res.status(400).json({ error: 'kind must be allow or block' });
    const normalized = domain ? normalizeDomain(domain) : null;
    if (!normalized) return res.status(400).json({ error: 'Enter a website like example.com' });
    if (db.prepare('SELECT 1 FROM internet_sites WHERE domain = ? AND kind = ?').get(normalized, kind)) {
      return res.status(400).json({ error: 'Already on the list' });
    }
    const site: InternetSite = { id: uuidv4(), domain: normalized, kind };
    db.prepare('INSERT INTO internet_sites (id, domain, kind) VALUES (@id, @domain, @kind)').run(site);
    let warning: string | null = null;
    try {
      await pushSite(site);
    } catch (err) {
      warning = (err as Error).message;
    }
    res.status(201).json({ site, warning });
  })
);

internetRouter.delete(
  '/sites/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const site = db.prepare('SELECT * FROM internet_sites WHERE id = ?').get(req.params.id) as InternetSite | undefined;
    if (!site) return res.status(404).json({ error: 'not found' });
    if (site.kind === 'allow') {
      // Allow-entries are rebuilt from the database as a whole (they can be shared with kids'
      // approved sites), so the row goes first and the sync follows.
      db.prepare('DELETE FROM internet_sites WHERE id = ?').run(site.id);
      try {
        await removeSite(site);
      } catch (err) {
        return res.json({ warning: (err as Error).message });
      }
      return res.json({ warning: null });
    }
    try {
      await removeSite(site);
    } catch (err) {
      // Keep the row so the removal can be retried, rather than leaving it in Pi-hole untracked.
      return res.status(502).json({ error: (err as Error).message });
    }
    db.prepare('DELETE FROM internet_sites WHERE id = ?').run(site.id);
    res.json({ warning: null });
  })
);

// ---- Filter categories & maintenance ----

internetRouter.put(
  '/filter-categories',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { keys } = req.body as { keys?: string[] };
    if (!Array.isArray(keys)) return res.status(400).json({ error: 'keys must be a list' });
    setEnabledFilterCategories(keys);
    let warning: string | null = null;
    try {
      await syncFilterLists();
    } catch (err) {
      warning = (err as Error).message;
    }
    res.json({ enabled_filter_categories: getEnabledFilterCategories(), gravity: getGravityStatus(), warning });
  })
);

/** POST /repair — rebuilds everything this app keeps in Pi-hole from this app's own database. */
internetRouter.post(
  '/repair',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    try {
      await repairSetup();
    } catch (err) {
      return res.status(502).json({ error: (err as Error).message });
    }
    res.json({ ok: true, gravity: getGravityStatus() });
  })
);
