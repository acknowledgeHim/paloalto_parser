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

export interface SpotifyDevice {
  id: string;
  name: string;
  is_active: boolean;
  volume_percent: number | null;
}

/** Every Spotify Connect device visible to this account — includes our librespot zones once "seen" by the app. */
export async function listDevices(): Promise<SpotifyDevice[]> {
  if (!isSpotifyConnected()) return [];
  const resp = await apiRequest('/me/player/devices');
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.devices ?? [];
}

export async function getCurrentPlayback(): Promise<unknown> {
  if (!isSpotifyConnected()) return null;
  const resp = await apiRequest('/me/player');
  if (resp.status === 204) return null;
  if (!resp.ok) return null;
  return resp.json();
}

export async function transferPlayback(deviceId: string, play = true): Promise<void> {
  await apiRequest('/me/player', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
}

export async function play(deviceId: string, contextUri?: string, uris?: string[]): Promise<void> {
  await apiRequest(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: contextUri || uris ? JSON.stringify({ context_uri: contextUri, uris }) : undefined,
  });
}

export async function pause(deviceId: string): Promise<void> {
  await apiRequest(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' });
}

export async function next(deviceId: string): Promise<void> {
  await apiRequest(`/me/player/next?device_id=${encodeURIComponent(deviceId)}`, { method: 'POST' });
}

export async function previous(deviceId: string): Promise<void> {
  await apiRequest(`/me/player/previous?device_id=${encodeURIComponent(deviceId)}`, { method: 'POST' });
}

export async function setVolume(deviceId: string, percent: number): Promise<void> {
  await apiRequest(`/me/player/volume?volume_percent=${Math.round(percent)}&device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
  });
}

export async function search(query: string, limit = 20): Promise<unknown> {
  if (!isSpotifyConnected()) return null;
  const resp = await apiRequest(`/search?q=${encodeURIComponent(query)}&type=track,album,playlist&limit=${limit}`);
  if (!resp.ok) return null;
  return resp.json();
}

export async function getUserPlaylists(): Promise<unknown> {
  if (!isSpotifyConnected()) return null;
  const resp = await apiRequest('/me/playlists?limit=50');
  if (!resp.ok) return null;
  return resp.json();
}
