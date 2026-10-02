import { config } from '../config.js';

/**
 * Minimal client for Pi-hole v6's REST API (https://docs.pi-hole.net/api/). Everything this app
 * does to Pi-hole goes through here — see services/internetControl.ts for what it's used for.
 *
 * Auth: POST /api/auth with the web/app password returns a session id ("sid") sent on every later
 * request as X-FTL-SID. Sessions expire after inactivity and Pi-hole caps how many can be open at
 * once, so one sid is reused for as long as it keeps working and only re-requested on a 401. A
 * Pi-hole with no password set hands back a null sid, which simply means no header is needed.
 */

export class PiholeError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

let sid: string | null | undefined; // undefined = not logged in yet; null = no password needed

export function isPiholeConfigured(): boolean {
  return Boolean(config.pihole.url);
}

function baseUrl(): string {
  return config.pihole.url.replace(/\/+$/, '').replace(/\/admin$/, '');
}

async function login(): Promise<void> {
  let resp: Response;
  try {
    resp = await fetch(`${baseUrl()}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: config.pihole.password }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new PiholeError(`Can't reach Pi-hole at ${baseUrl()} (${(err as Error).message})`);
  }
  const body = (await resp.json().catch(() => ({}))) as { session?: { valid?: boolean; sid?: string | null } };
  if (!resp.ok || !body.session?.valid) {
    throw new PiholeError('Pi-hole rejected the password — check PIHOLE_PASSWORD in .env', resp.status);
  }
  sid = body.session.sid ?? null;
}

async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  if (!isPiholeConfigured()) throw new PiholeError('Pi-hole is not set up (PIHOLE_URL is blank)');
  if (sid === undefined) await login();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sid) headers['X-FTL-SID'] = sid;
  let resp: Response;
  try {
    resp = await fetch(`${baseUrl()}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // Gravity (re-downloading blocklists) can legitimately take minutes on a Pi.
      signal: AbortSignal.timeout(path.startsWith('/action/gravity') ? 600_000 : 15_000),
    });
  } catch (err) {
    throw new PiholeError(`Can't reach Pi-hole at ${baseUrl()} (${(err as Error).message})`);
  }
  if (resp.status === 401 && !retried) {
    sid = undefined;
    return request<T>(method, path, body, true);
  }
  if (resp.status === 204) return undefined as T;
  const text = await resp.text();
  if (!resp.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; hint?: string } };
      message = [parsed.error?.message, parsed.error?.hint].filter(Boolean).join(' — ') || text;
    } catch {
      // not JSON — use the raw text
    }
    throw new PiholeError(`Pi-hole ${method} ${path} failed (${resp.status}): ${message}`, resp.status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T; // e.g. gravity's streamed plain-text log
  }
}

// ---- Groups ----

export interface PiholeGroup {
  id: number;
  name: string;
  comment: string | null;
  enabled: boolean;
}

export async function listGroups(): Promise<PiholeGroup[]> {
  return (await request<{ groups: PiholeGroup[] }>('GET', '/groups')).groups;
}

export async function createGroup(name: string, comment: string): Promise<void> {
  await request('POST', '/groups', { name, comment, enabled: true });
}

// ---- Clients (a device, identified by MAC or IP, and which groups it's in) ----

export interface PiholeClient {
  id: number;
  client: string;
  comment: string | null;
  groups: number[];
}

export async function listClients(): Promise<PiholeClient[]> {
  return (await request<{ clients: PiholeClient[] }>('GET', '/clients')).clients;
}

export async function createClient(client: string, comment: string, groups: number[]): Promise<void> {
  await request('POST', '/clients', { client, comment, groups });
}

export async function updateClient(client: string, comment: string | null, groups: number[]): Promise<void> {
  await request('PUT', `/clients/${encodeURIComponent(client)}`, { comment, groups });
}

// ---- Domains (exact/regex allow/deny entries, each scoped to groups) ----

export type DomainType = 'allow' | 'deny';
export type DomainKind = 'exact' | 'regex';

export interface PiholeDomain {
  id: number;
  domain: string;
  type: DomainType;
  kind: DomainKind;
  comment: string | null;
  groups: number[];
  enabled: boolean;
}

function domainPath(type: DomainType, kind: DomainKind, domain?: string): string {
  return `/domains/${type}/${kind}${domain === undefined ? '' : `/${encodeURIComponent(domain)}`}`;
}

export async function getDomain(type: DomainType, kind: DomainKind, domain: string): Promise<PiholeDomain | null> {
  const found = await request<{ domains: PiholeDomain[] }>('GET', domainPath(type, kind, domain));
  return found.domains.find((d) => d.domain === domain) ?? null;
}

/** Creates the entry, or updates its groups/comment if it already exists. */
export async function upsertDomain(
  type: DomainType,
  kind: DomainKind,
  domain: string,
  comment: string,
  groups: number[]
): Promise<void> {
  const existing = await getDomain(type, kind, domain);
  if (!existing) {
    await request('POST', domainPath(type, kind), { domain, comment, groups, enabled: true });
  } else {
    await request('PUT', domainPath(type, kind, domain), { type, kind, comment, groups, enabled: true });
  }
}

export async function deleteDomain(type: DomainType, kind: DomainKind, domain: string): Promise<void> {
  try {
    await request('DELETE', domainPath(type, kind, domain));
  } catch (err) {
    if ((err as PiholeError).status !== 404) throw err; // already gone is fine
  }
}

// ---- Blocklists ("lists" / adlists) ----

export interface PiholeList {
  id: number;
  address: string;
  type: 'block' | 'allow';
  comment: string | null;
  groups: number[];
  enabled: boolean;
}

export async function listLists(): Promise<PiholeList[]> {
  return (await request<{ lists: PiholeList[] }>('GET', '/lists')).lists;
}

export async function createList(address: string, comment: string, groups: number[], enabled: boolean): Promise<void> {
  await request('POST', '/lists?type=block', { address, type: 'block', comment, groups, enabled });
}

export async function updateList(address: string, comment: string | null, groups: number[], enabled: boolean): Promise<void> {
  await request('PUT', `/lists/${encodeURIComponent(address)}?type=block`, { type: 'block', comment, groups, enabled });
}

/** Re-downloads every blocklist and rebuilds Pi-hole's gravity database — needed after adding a
 *  new list (enabling/disabling or re-grouping an existing one isn't). Slow: often a minute+. */
export async function runGravity(): Promise<void> {
  await request('POST', '/action/gravity');
}

// ---- Read-only info ----

export interface PiholeNetworkDevice {
  hwaddr: string;
  macVendor: string | null;
  lastQuery: number;
  numQueries: number;
  ips: Array<{ ip: string; name: string | null; lastSeen: number }>;
}

/** Every device Pi-hole has seen on the network (from its ARP/neighbor table), with addresses and
 *  hostnames — what the "add a device" picker is built from. */
export async function listNetworkDevices(): Promise<PiholeNetworkDevice[]> {
  return (await request<{ devices: PiholeNetworkDevice[] }>('GET', '/network/devices?max_devices=200&max_addresses=4')).devices;
}

export interface PiholeSummary {
  queries: { total: number; blocked: number; percent_blocked: number };
  clients: { active: number; total: number };
  gravity: { domains_being_blocked: number; last_update: number };
}

export async function getSummary(): Promise<PiholeSummary> {
  return request<PiholeSummary>('GET', '/stats/summary');
}

export async function getBlockingStatus(): Promise<string> {
  return (await request<{ blocking: string }>('GET', '/dns/blocking')).blocking;
}
