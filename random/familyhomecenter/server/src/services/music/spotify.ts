import { db } from '../../db.js';
import { config } from '../../config.js';

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

interface StoredTokens {
  access_token: string | null;
  refresh_token: string | null;
  expiry_date: number | null;
}

export function isSpotifyConfigured(): boolean {
  return Boolean(config.spotify.clientId && config.spotify.clientSecret);
}

export function isSpotifyConnected(): boolean {
  const row = db.prepare('SELECT refresh_token FROM spotify_tokens WHERE id = 1').get() as
    | { refresh_token: string | null }
    | undefined;
  return Boolean(row?.refresh_token);
}

export function getSpotifyAuthUrl(): string {
  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('client_id', config.spotify.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', config.spotify.redirectUri);
  url.searchParams.set('scope', SCOPES);
  return url.toString();
}

function basicAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');
}

export async function handleSpotifyCallback(code: string): Promise<void> {
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader() },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.spotify.redirectUri,
    }),
  });
  if (!resp.ok) throw new Error(`Spotify token exchange failed: ${resp.status} ${await resp.text()}`);
  const tokens = await resp.json();
  db.prepare(
    `INSERT INTO spotify_tokens (id, access_token, refresh_token, expiry_date) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET access_token = excluded.access_token, refresh_token = excluded.refresh_token,
       expiry_date = excluded.expiry_date`
  ).run(tokens.access_token, tokens.refresh_token, Date.now() + tokens.expires_in * 1000);
}

async function getValidAccessToken(): Promise<string | null> {
  const row = db.prepare('SELECT * FROM spotify_tokens WHERE id = 1').get() as StoredTokens | undefined;
  if (!row?.refresh_token) return null;

  if (row.access_token && row.expiry_date && row.expiry_date > Date.now() + 30_000) {
    return row.access_token;
  }

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader() },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: row.refresh_token }),
  });
  if (!resp.ok) {
    console.warn('[spotify] refresh failed', resp.status, await resp.text());
    return null;
  }
  const tokens = await resp.json();
  db.prepare(
    `UPDATE spotify_tokens SET access_token = ?, expiry_date = ?,
       refresh_token = COALESCE(?, refresh_token) WHERE id = 1`
  ).run(tokens.access_token, Date.now() + tokens.expires_in * 1000, tokens.refresh_token ?? null);
  return tokens.access_token;
}

async function apiRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Spotify not connected');
  return fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
}

/** Spotify's own words when a call fails ("No active device found", "Premium required"…), so the
 *  Music page can show them instead of a bare 500. */
export class SpotifyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function check(resp: Response, what: string): Promise<Response> {
  if (resp.ok) return resp;
  const text = await resp.text().catch(() => '');
  // Spotify's whole answer goes to the log (journalctl -u familyhomecenter) for anything unexpected.
  console.warn(`[spotify] ${what} → ${resp.status} ${text.slice(0, 500)}`);
  let message = '';
  let reason = '';
  try {
    const body = JSON.parse(text) as { error?: { message?: string; reason?: string } | string; error_description?: string };
    message = (typeof body.error === 'string' ? body.error_description ?? body.error : body.error?.message) ?? '';
    reason = typeof body.error === 'object' ? body.error?.reason ?? '' : '';
  } catch {
    message = text.trim().slice(0, 200); // sometimes plain text, e.g. the "user may not be registered" answer
  }
  let msg = message ? `Spotify said: ${message}` : `Spotify said ${resp.status}`;
  if (reason === 'NO_ACTIVE_DEVICE') msg = 'No speaker picked — choose one under "Play on"';
  else if (reason === 'PREMIUM_REQUIRED' || /premium/i.test(message)) msg = 'Controlling playback needs Spotify Premium on the connected account';
  else if (/not be registered|not registered/i.test(message))
    msg = 'This Spotify account isn’t on your Spotify app’s list — developer.spotify.com → your app → User Management → add it, then Settings → Spotify → Reconnect';
  else if (/restriction violated/i.test(message))
    msg = "That speaker won't take that right now (some can only be controlled from their own app, or it's mid-ad) — try another speaker, or press play in the Spotify app once first";
  else if (/insufficient client scope|scope/i.test(message)) msg = 'Spotify needs permission again — Settings → Spotify → Reconnect';
  else if (resp.status === 404 && /device/i.test(message)) msg = "That speaker isn't available right now — is it on? Tap ↻ to refresh the list.";
  else if (resp.status === 403)
    msg = `${msg} (403 — Spotify refused. Usually: the account needs Premium, or isn't added under User Management in your Spotify developer app.)`;
  throw new SpotifyError(msg, resp.status);
}

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const resp = await check(await apiRequest(path, init), `${init.method ?? 'GET'} ${path.split('?')[0]}`);
  if (resp.status === 204) return null;
  const text = await resp.text();
  return text ? (JSON.parse(text) as T) : null;
}

const withDevice = (path: string, deviceId?: string) =>
  deviceId ? `${path}${path.includes('?') ? '&' : '?'}device_id=${encodeURIComponent(deviceId)}` : path;

export interface SpotifyDevice {
  id: string;
  name: string;
  type?: string;
  is_active: boolean;
  is_restricted?: boolean;
  volume_percent: number | null;
}

/** Every Spotify Connect device visible to this account — includes our librespot zones once "seen" by the app. */
export async function listDevices(): Promise<SpotifyDevice[]> {
  if (!isSpotifyConnected()) return [];
  const data = await apiJson<{ devices?: SpotifyDevice[] }>('/me/player/devices');
  return data?.devices ?? [];
}

export async function getCurrentPlayback(): Promise<unknown> {
  if (!isSpotifyConnected()) return null;
  return apiJson('/me/player');
}

export async function transferPlayback(deviceId: string, play = true): Promise<void> {
  await apiJson('/me/player', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
}

/** Play a playlist/album/artist (contextUri — optionally starting at offsetUri), some songs (uris),
 *  or just resume (neither) — on deviceId, or wherever Spotify is already playing. */
export async function play(deviceId?: string, contextUri?: string, uris?: string[], offsetUri?: string): Promise<void> {
  const body: Record<string, unknown> = {};
  if (contextUri) body.context_uri = contextUri;
  if (uris?.length) body.uris = uris;
  if (contextUri && offsetUri) body.offset = { uri: offsetUri };
  await apiJson(withDevice('/me/player/play', deviceId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: Object.keys(body).length ? JSON.stringify(body) : undefined,
  });
}

export async function pause(deviceId?: string): Promise<void> {
  await apiJson(withDevice('/me/player/pause', deviceId), { method: 'PUT' });
}

export async function next(deviceId?: string): Promise<void> {
  await apiJson(withDevice('/me/player/next', deviceId), { method: 'POST' });
}

export async function previous(deviceId?: string): Promise<void> {
  await apiJson(withDevice('/me/player/previous', deviceId), { method: 'POST' });
}

export async function setVolume(deviceId: string | undefined, percent: number): Promise<void> {
  await apiJson(withDevice(`/me/player/volume?volume_percent=${Math.max(0, Math.min(100, Math.round(percent)))}`, deviceId), {
    method: 'PUT',
  });
}

/** Add a song to the end of what's playing. */
export async function addToQueue(uri: string, deviceId?: string): Promise<void> {
  await apiJson(withDevice(`/me/player/queue?uri=${encodeURIComponent(uri)}`, deviceId), { method: 'POST' });
}

// Spotify caps search at 10 per type for apps in development mode, so ask for 10.
export async function search(query: string, limit = 10): Promise<unknown> {
  if (!isSpotifyConnected() || !query.trim()) return null;
  return apiJson(`/search?q=${encodeURIComponent(query)}&type=track,album,playlist,artist&limit=${limit}`);
}

/** All of this account's playlists (theirs and followed), a page of 50 at a time. */
export async function getUserPlaylists(): Promise<unknown[]> {
  if (!isSpotifyConnected()) return [];
  const all: unknown[] = [];
  let path: string | null = '/me/playlists?limit=50';
  for (let page = 0; path && page < 10; page++) {
    const data: { items?: unknown[]; next?: string | null } | null = await apiJson(path);
    all.push(...(data?.items ?? []).filter(Boolean));
    path = data?.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return all;
}

/** A playlist's songs (first 100). Spotify renamed /tracks to /items — try the new one first. */
export async function getPlaylistTracks(playlistId: string): Promise<unknown> {
  const id = encodeURIComponent(playlistId);
  try {
    return await apiJson(`/playlists/${id}/items?limit=100`);
  } catch (err) {
    if (err instanceof SpotifyError && (err.status === 404 || err.status === 403)) return apiJson(`/playlists/${id}/tracks?limit=100`);
    throw err;
  }
}
