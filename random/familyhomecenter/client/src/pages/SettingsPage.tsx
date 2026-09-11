import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

const AVATAR_COLORS = ['#5b8def', '#e2685a', '#3fae66', '#c96fd6', '#e0a638', '#33a3a3'];

interface AuthStatus {
  configured: boolean;
  authenticated: boolean;
}

/** Password gate shown in place of the settings content when a login is configured and not yet passed. */
function SettingsLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/login', { password });
      onSuccess();
    } catch (err) {
      setError((err as Error).message || 'Incorrect password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="settings-login">
      <form className="panel settings-login__form" onSubmit={submit}>
        <h1>Settings</h1>
        <p className="hint">Everything else in the dashboard is open to the family — just this page needs the settings password.</p>
        <input
          autoFocus
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="settings-login__error">{error}</div>}
        <button type="submit" disabled={submitting}>Unlock</button>
      </form>
    </div>
  );
}

export function SettingsPage() {
  const { members, refresh } = useFamilyMembers();
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [name, setName] = useState('');
  const [isParent, setIsParent] = useState(false);
  interface TimingSettings {
    idle_timeout_seconds?: string;
    slideshow_interval_seconds?: string;
  }
  interface CalendarSources {
    google?: { connected: boolean; configured: boolean };
    apple?: { configured: boolean };
  }
  interface SpotifyStatus {
    configured: boolean;
    connected: boolean;
  }
  const [settings, setSettings] = useState<TimingSettings>({});
  const [sources, setSources] = useState<CalendarSources>({});
  const [spotify, setSpotify] = useState<SpotifyStatus>({ configured: false, connected: false });
  const [geoQuery, setGeoQuery] = useState('');
  const [geoResults, setGeoResults] = useState<Array<{ name: string; lat: number; lon: number; admin1?: string; country?: string }>>([]);

  const loadAuth = () => api.get<AuthStatus>('/auth/status').then(setAuth).catch(console.error);

  useEffect(() => {
    loadAuth();
  }, []);

  useEffect(() => {
    if (!auth?.authenticated) return;
    api.get<TimingSettings>('/settings').then(setSettings).catch(console.error);
    api.get<CalendarSources>('/calendar/sources').then(setSources).catch(console.error);
    api.get<SpotifyStatus>('/music/spotify/status').then(setSpotify).catch(console.error);
  }, [auth?.authenticated]);

  const addMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const color = AVATAR_COLORS[members.length % AVATAR_COLORS.length];
    await api.post('/family-members', { name: name.trim(), color, is_parent: isParent });
    setName('');
    setIsParent(false);
    refresh();
  };

  const removeMember = async (id: string) => {
    await api.delete(`/family-members/${id}`);
    refresh();
  };

  const saveTiming = async (patch: Record<string, string>) => {
    setSettings(await api.patch<TimingSettings>('/settings', patch));
  };

  const connectGoogle = async () => {
    const { url } = await api.get<{ url: string }>('/calendar/google/auth-url');
    window.open(url, '_blank', 'noopener');
  };

  const connectSpotify = async () => {
    const { url } = await api.get<{ url: string }>('/music/spotify/auth-url');
    window.open(url, '_blank', 'noopener');
  };

  const runGeocode = async (e: FormEvent) => {
    e.preventDefault();
    if (!geoQuery.trim()) return;
    setGeoResults(
      await api.get<Array<{ name: string; lat: number; lon: number; admin1?: string; country?: string }>>(
        `/weather/geocode?q=${encodeURIComponent(geoQuery)}`
      )
    );
  };

  const logout = async () => {
    await api.post('/auth/logout');
    loadAuth();
  };

  if (!auth) return null; // brief loading flash only
  if (auth.configured && !auth.authenticated) {
    return <SettingsLogin onSuccess={loadAuth} />;
  }

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1>Settings</h1>
        {auth.configured && <button className="secondary" onClick={logout}>Log out</button>}
      </div>

      <section className="panel">
        <h2>Family members</h2>
        <ul className="settings-page__member-list">
          {members.map((m) => (
            <li key={m.id}>
              <span className="avatar-dot" style={{ background: m.color }} /> {m.name}
              {m.is_parent === 1 && <span className="badge">Parent</span>}
              <button className="link-button" onClick={() => removeMember(m.id)}>Remove</button>
            </li>
          ))}
        </ul>
        <form className="task-form" onSubmit={addMember}>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="checkbox">
            <input type="checkbox" checked={isParent} onChange={(e) => setIsParent(e.target.checked)} />
            Parent (can add recurring chores)
          </label>
          <button type="submit">Add family member</button>
        </form>
      </section>

      <section className="panel">
        <h2>Calendar sources</h2>
        <ul className="settings-page__source-list">
          <li>Local calendar — always on ✅</li>
          <li>
            Google Calendar — {sources.google?.connected ? 'Connected ✅' : sources.google?.configured ? 'Not connected' : 'Not configured'}
            {sources.google?.configured && !sources.google?.connected && (
              <button className="link-button" onClick={connectGoogle}>Connect</button>
            )}
            {!sources.google?.configured && <span className="hint"> — set GOOGLE_CLIENT_ID/SECRET in .env, see docs/GOOGLE_CALENDAR_SETUP.md</span>}
          </li>
          <li>
            Apple/iCloud Calendar — {sources.apple?.configured ? 'Configured ✅' : 'Not configured'}
            {!sources.apple?.configured && <span className="hint"> — set APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD in .env, see docs/APPLE_CALENDAR_SETUP.md</span>}
          </li>
        </ul>
      </section>

      <section className="panel">
        <h2>Spotify</h2>
        <p>
          In-dashboard playback control: {spotify.connected ? 'Connected ✅' : spotify.configured ? 'Not connected' : 'Not configured'}
          {spotify.configured && !spotify.connected && (
            <button className="link-button" onClick={connectSpotify}>Connect</button>
          )}
        </p>
        {!spotify.configured && <p className="hint">See docs/SPOTIFY_SETUP.md — casting from a family member's own Spotify app needs no setup here at all.</p>}
      </section>

      <section className="panel">
        <h2>Screensaver / slideshow</h2>
        <label>
          Idle timeout before slideshow starts (seconds)
          <input
            type="number"
            min={30}
            value={settings.idle_timeout_seconds ?? ''}
            onChange={(e) => saveTiming({ idle_timeout_seconds: e.target.value })}
          />
        </label>
        <label>
          Seconds per photo
          <input
            type="number"
            min={3}
            value={settings.slideshow_interval_seconds ?? ''}
            onChange={(e) => saveTiming({ slideshow_interval_seconds: e.target.value })}
          />
        </label>
        <p className="hint">Photo folder is set via PHOTOS_DIR in .env — see docs/PHOTOS_SETUP.md (local folder or SMB share).</p>
      </section>

      <section className="panel">
        <h2>Find your weather coordinates</h2>
        <p className="hint">Search a city, then copy the lat/lon into WEATHER_LAT / WEATHER_LON in .env and restart the server.</p>
        <form className="task-form" onSubmit={runGeocode}>
          <input placeholder="City, State" value={geoQuery} onChange={(e) => setGeoQuery(e.target.value)} />
          <button type="submit">Search</button>
        </form>
        {geoResults.map((r, i) => (
          <div key={i} className="settings-page__geo-result">
            {r.name}{r.admin1 ? `, ${r.admin1}` : ''}{r.country ? `, ${r.country}` : ''} — lat {r.lat}, lon {r.lon}
          </div>
        ))}
      </section>

      {!auth.configured && (
        <p className="hint">Anyone can currently open Settings — set ADMIN_PASSWORD in .env to require a login here. See docs/SETTINGS_LOGIN.md.</p>
      )}
    </div>
  );
}
