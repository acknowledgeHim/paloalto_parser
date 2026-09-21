import { useEffect, useState, type FormEvent } from 'react';
import { api, type FamilyMember } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { FamilyMemberFormModal } from '../components/FamilyMemberFormModal.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { PrizeBankSettings } from '../components/PrizeBankSettings.js';

interface AuthStatus {
  member_id: string | null;
  is_admin: boolean;
  admin_gate_active: boolean;
  legacy_recovery_available: boolean;
}

/** Shown in place of the settings content when a parent login is required and not yet passed. */
function SettingsLogin({ onSuccess, legacyAvailable }: { onSuccess: () => void; legacyAvailable: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/login', { password }); // legacy household recovery login
      onSuccess();
    } catch (err) {
      setError((err as Error).message || 'Incorrect password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="settings-login">
      <div className="panel settings-login__form">
        <h1>Settings</h1>
        <p className="hint">
          This needs a parent login. Pick your name in the switcher up top and enter your password
          there{legacyAvailable ? ', or use the household recovery password below' : ''}.
        </p>
        {legacyAvailable && (
          <form onSubmit={submit}>
            <input
              autoFocus
              type="password"
              placeholder="Recovery password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <div className="settings-login__error">{error}</div>}
            <button type="submit" disabled={submitting}>Unlock</button>
          </form>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { members, refresh } = useFamilyMembers();
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [memberModal, setMemberModal] = useState<FamilyMember | 'new' | null>(null);
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
    if (!auth?.is_admin) return;
    api.get<TimingSettings>('/settings').then(setSettings).catch(console.error);
    api.get<CalendarSources>('/calendar/sources').then(setSources).catch(console.error);
    api.get<SpotifyStatus>('/music/spotify/status').then(setSpotify).catch(console.error);
  }, [auth?.is_admin]);

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
  if (auth.admin_gate_active && !auth.is_admin) {
    return <SettingsLogin onSuccess={loadAuth} legacyAvailable={auth.legacy_recovery_available} />;
  }

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1>Settings</h1>
        {auth.admin_gate_active && <button className="secondary" onClick={logout}>Log out</button>}
      </div>

      <section className="panel">
        <h2>Family members</h2>
        <ul className="settings-page__member-list">
          {members.map((m) => (
            <li key={m.id}>
              <MemberAvatar member={m} /> {m.name}
              {m.is_parent === 1 && <span className="badge">Parent</span>}
              <button className="link-button" onClick={() => setMemberModal(m)}>Edit</button>
              <ConfirmButton
                label="Remove"
                confirmLabel={`Delete ${m.name} and all their history?`}
                onConfirm={() => removeMember(m.id)}
              />
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setMemberModal('new')}>Add family member</button>
      </section>

      {memberModal && (
        <FamilyMemberFormModal
          member={memberModal === 'new' ? null : memberModal}
          onClose={() => setMemberModal(null)}
          onSaved={() => {
            setMemberModal(null);
            refresh();
          }}
        />
      )}

      <PrizeBankSettings />

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

      {!auth.admin_gate_active && (
        <p className="hint">
          Anyone can currently open Settings — including the Prize Bank reward amounts above.
          Have a parent set their own password (🔑 icon in the name switcher up top) to require a
          login here. See docs/SETTINGS_LOGIN.md.
        </p>
      )}
    </div>
  );
}
