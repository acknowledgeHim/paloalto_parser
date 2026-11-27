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
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
let sid; // undefined = not logged in yet; null = no password needed
export function isPiholeConfigured() {
    return Boolean(config.pihole.url);
}
/** Why a fetch failed, in words — Node only says "fetch failed" and hides the real reason in `cause`. */
function unreachable(err) {
    const e = err;
    const code = e.cause?.code ?? (e.name === 'TimeoutError' ? 'TIMEOUT' : '');
    const why = {
        ECONNREFUSED: "nothing is listening on that port — Pi-hole's web server isn't running there (pihole status; check its port)",
        TIMEOUT: "no answer in time — Pi-hole may be busy, stopped, or blocked by a firewall",
        ENOTFOUND: "that host name doesn't resolve — use http://localhost or the Pi's IP",
        EHOSTUNREACH: "that address isn't reachable from the Pi",
    };
    const detail = why[code] ?? e.cause?.message ?? e.message;
    return new PiholeError(`Can't reach Pi-hole at ${baseUrl()} (${code ? `${code}: ` : ''}${detail})`);
}
function baseUrl() {
    return config.pihole.url.replace(/\/+$/, '').replace(/\/admin$/, '');
}
async function login() {
    let resp;
    try {
        resp = await fetch(`${baseUrl()}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: config.pihole.password }),
            signal: AbortSignal.timeout(10_000),
        });
    }
    catch (err) {
        throw unreachable(err);
    }
    const body = (await resp.json().catch(() => ({})));
    if (!resp.ok || !body.session?.valid) {
        throw new PiholeError('Pi-hole rejected the password — check PIHOLE_PASSWORD in .env', resp.status);
    }
    sid = body.session.sid ?? null;
}
async function request(method, path, body, retried = false) {
    if (!isPiholeConfigured())
        throw new PiholeError('Pi-hole is not set up (PIHOLE_URL is blank)');
    if (sid === undefined)
        await login();
    const headers = { 'Content-Type': 'application/json' };
    if (sid)
        headers['X-FTL-SID'] = sid;
    let resp;
    try {
        resp = await fetch(`${baseUrl()}/api${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            // Gravity (re-downloading blocklists) can legitimately take minutes on a Pi.
            signal: AbortSignal.timeout(path.startsWith('/action/gravity') ? 600_000 : 15_000),
        });
    }
    catch (err) {
        throw unreachable(err);
    }
    if (resp.status === 401 && !retried) {
        sid = undefined;
        return request(method, path, body, true);
    }
    if (resp.status === 204)
        return undefined;
    const text = await resp.text();
    if (!resp.ok) {
        let message = text;
        try {
            const parsed = JSON.parse(text);
            message = [parsed.error?.message, parsed.error?.hint].filter(Boolean).join(' — ') || text;
        }
        catch {
            // not JSON — use the raw text
        }
        throw new PiholeError(`Pi-hole ${method} ${path} failed (${resp.status}): ${message}`, resp.status);
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return text; // e.g. gravity's streamed plain-text log
    }
}
export async function listGroups() {
    return (await request('GET', '/groups')).groups;
}
export async function createGroup(name, comment) {
    await request('POST', '/groups', { name, comment, enabled: true });
}
export async function listClients() {
    return (await request('GET', '/clients')).clients;
}
export async function createClient(client, comment, groups) {
    await request('POST', '/clients', { client, comment, groups });
}
export async function updateClient(client, comment, groups) {
    await request('PUT', `/clients/${encodeURIComponent(client)}`, { comment, groups });
}
function domainPath(type, kind, domain) {
    return `/domains/${type}/${kind}${domain === undefined ? '' : `/${encodeURIComponent(domain)}`}`;
}
export async function listDomains(type, kind) {
    return (await request('GET', domainPath(type, kind))).domains;
}
export async function getDomain(type, kind, domain) {
    const found = await request('GET', domainPath(type, kind, domain));
    return found.domains.find((d) => d.domain === domain) ?? null;
}
/** Creates the entry, or updates its groups/comment if it already exists. */
export async function upsertDomain(type, kind, domain, comment, groups) {
    const existing = await getDomain(type, kind, domain);
    if (!existing) {
        await request('POST', domainPath(type, kind), { domain, comment, groups, enabled: true });
    }
    else {
        await request('PUT', domainPath(type, kind, domain), { type, kind, comment, groups, enabled: true });
    }
}
export async function deleteDomain(type, kind, domain) {
    try {
        await request('DELETE', domainPath(type, kind, domain));
    }
    catch (err) {
        if (err.status !== 404)
            throw err; // already gone is fine
    }
}
export async function listLists() {
    return (await request('GET', '/lists')).lists;
}
export async function createList(address, comment, groups, enabled) {
    await request('POST', '/lists?type=block', { address, type: 'block', comment, groups, enabled });
}
export async function updateList(address, comment, groups, enabled) {
    await request('PUT', `/lists/${encodeURIComponent(address)}?type=block`, { type: 'block', comment, groups, enabled });
}
/** Re-downloads every blocklist and rebuilds Pi-hole's gravity database — needed after adding a
 *  new list (enabling/disabling or re-grouping an existing one isn't). Slow: often a minute+. */
export async function runGravity() {
    await request('POST', '/action/gravity');
}
/** Every device Pi-hole has seen on the network (from its ARP/neighbor table), with addresses and
 *  hostnames — what the "add a device" picker is built from. */
export async function listNetworkDevices() {
    return (await request('GET', '/network/devices?max_devices=200&max_addresses=4')).devices;
}
export async function getSummary() {
    return request('GET', '/stats/summary');
}
/** The most recent `length` lookups made by one device (by IP), newest first. */
export async function getQueriesForClient(clientIp, length) {
    const params = new URLSearchParams({ client_ip: clientIp, length: String(length) });
    return (await request('GET', `/queries?${params}`)).queries;
}
export async function getBlockingStatus() {
    return (await request('GET', '/dns/blocking')).blocking;
}
